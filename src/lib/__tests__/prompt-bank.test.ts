import { describe, expect, it } from "vitest";
import { createDbClient } from "@/db";
import type { D1DatabaseBinding, R2BucketBinding } from "../cloudflare-env";
import {
  MAX_PROMPT_TITLE_CHARS,
  addPromptCommentInDb,
  aggregateAnonymousPromptVotes,
  castAnonymousPromptVoteInDb,
  createPromptProposalInDb,
  editPromptProposalInDb,
  parseVideoEmbedUrl,
  uploadPromptImageToR2,
  validatePromptBankInput,
} from "../prompt-bank";

function createPromptBankTestD1Binding(options: {
  existingPromptRow?: unknown[];
  existingVoteRow?: unknown[];
} = {}): {
  binding: D1DatabaseBinding;
  queries: string[];
} {
  const queries: string[] = [];
  const binding: D1DatabaseBinding = {
    prepare: (query: string) => {
      queries.push(query);
      return {
        bind(..._values: unknown[]) {
          return this;
        },
        first: async <T = Record<string, unknown>>() => null as T | null,
        run: async <T = Record<string, unknown>>() => ({
          success: true,
          results: [] as T[],
        }),
        all: async <T = Record<string, unknown>>() => ({
          success: true,
          results: [] as T[],
        }),
        raw: async <T = unknown[]>() => {
          if (query.includes('from "prompt_bank"') && options.existingPromptRow) {
            return [options.existingPromptRow] as unknown as T[];
          }
          if (
            query.includes('from "prompt_bank_votes"') &&
            options.existingVoteRow
          ) {
            return [options.existingVoteRow] as unknown as T[];
          }
          return [] as unknown as T[];
        },
      };
    },
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  };
  return { binding, queries };
}

describe("Step 2.4 — Collaborative Prompt Bank (Media, Anonymous Votes & Reset on Edit)", () => {
  it("parses YouTube and Vimeo URLs into safe iframe embed URLs and rejects invalid URLs", () => {
    expect(
      parseVideoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    ).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(parseVideoEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ"
    );
    expect(parseVideoEmbedUrl("https://vimeo.com/123456789")).toBe(
      "https://player.vimeo.com/video/123456789"
    );
    expect(parseVideoEmbedUrl("https://example.com/video.mp4")).toBeNull();
    expect(parseVideoEmbedUrl("javascript:alert(1)")).toBeNull();
  });

  it("validates prompt title (1..150 chars), body, and optional image/video media", () => {
    expect(
      validatePromptBankInput({ title: "", body: "Texto válido" }).valid
    ).toBe(false);
    expect(
      validatePromptBankInput({
        title: "a".repeat(MAX_PROMPT_TITLE_CHARS + 1),
        body: "Texto válido",
      }).valid
    ).toBe(false);
    expect(
      validatePromptBankInput({
        title: "La carta perdida",
        body: "Escribe sobre una carta que llega 30 años tarde.",
        mediaType: "VIDEO",
        mediaUrl: "https://youtu.be/abc123XYZ",
      })
    ).toEqual({
      valid: true,
      normalizedMediaUrl: "https://www.youtube.com/embed/abc123XYZ",
    });
  });

  it("aggregates likes/dislikes anonymously without leaking other voter identities", () => {
    const summary = aggregateAnonymousPromptVotes(
      [
        { adminId: "admin_1", voteValue: 1 },
        { adminId: "admin_2", voteValue: 1 },
        { adminId: "admin_3", voteValue: -1 },
      ],
      "admin_2"
    );

    expect(summary).toEqual({
      likes: 2,
      dislikes: 1,
      currentAdminVote: 1,
    });
  });

  it("creates proposals, casts votes, adds comments, and resets all votes when edited", async () => {
    const { binding, queries } = createPromptBankTestD1Binding({
      existingPromptRow: [
        "prompt_1",
        "admin_1",
        "Título original",
        "Cuerpo original",
        null,
        null,
        "AVAILABLE",
        null,
        "2026-11-20T00:00:00.000Z",
        "2026-11-20T00:00:00.000Z",
      ],
    });
    const db = createDbClient(binding);

    const created = await createPromptProposalInDb(db, {
      id: "prompt_1",
      authorId: "admin_1",
      input: { title: "Título original", body: "Cuerpo original" },
    });
    expect(created).toEqual({ created: true, promptId: "prompt_1" });

    await castAnonymousPromptVoteInDb(db, {
      promptBankId: "prompt_1",
      adminId: "admin_2",
      voteValue: 1,
    });
    expect(
      queries.some((q) => q.includes('insert into "prompt_bank_votes"'))
    ).toBe(true);

    const comment = await addPromptCommentInDb(db, {
      promptBankId: "prompt_1",
      authorId: "admin_2",
      commentText: "Gran idea para la tercera consigna.",
      commentId: "c1",
    });
    expect(comment).toEqual({ created: true, commentId: "c1" });

    // Editing by non-author regular admin is rejected
    const forbiddenEdit = await editPromptProposalInDb(db, {
      promptId: "prompt_1",
      editorId: "admin_2",
      editorRole: "ADMIN",
      input: { title: "Editado", body: "Nuevo cuerpo" },
    });
    expect(forbiddenEdit.updated).toBe(false);

    // Editing by author updates prompt AND deletes all prompt_bank_votes (reset to 0)
    const edited = await editPromptProposalInDb(db, {
      promptId: "prompt_1",
      editorId: "admin_1",
      editorRole: "ADMIN",
      input: { title: "Título mejorado", body: "Cuerpo mejorado" },
    });
    expect(edited).toEqual({ updated: true, votesReset: true });
    expect(
      queries.some((q) => q.includes('delete from "prompt_bank_votes"'))
    ).toBe(true);
  });

  it("uploads valid prompt images to Cloudflare R2 under prompts/", async () => {
    const stored = new Map<string, number>();
    const bucket: R2BucketBinding = {
      get: async () => null,
      put: async (key, val) => {
        const size = val instanceof ArrayBuffer ? val.byteLength : 0;
        stored.set(key, size);
        return { key, size };
      },
      delete: async () => undefined,
    };

    const jpegBuffer = new ArrayBuffer(2048);
    new Uint8Array(jpegBuffer).set([0xff, 0xd8, 0xff, 0xe0]);
    const result = await uploadPromptImageToR2({
      mediaBucket: bucket,
      promptScopeId: "admin_1",
      mimeType: "image/jpeg",
      bytes: jpegBuffer,
      timestampMs: 1700000001000,
    });

    expect(result).toEqual({
      uploaded: true,
      imageUrl: "/api/media/prompts/admin_1/1700000001000.jpg",
    });
    expect(stored.get("prompts/admin_1/1700000001000.jpg")).toBe(2048);
  });
});
