/**
 * Collaborative Prompt Bank Service
 * Step 2.4: Propose prompts (text + R2 image or YouTube/Vimeo embed), anonymous +1/-1 voting,
 * visible comments, and automatic vote reset on prompt edit.
 */

import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import {
  promptBank,
  promptBankComments,
  promptBankVotes,
  type MediaType,
  type UserRole,
} from "@/db/schema";
import type { R2BucketBinding } from "./cloudflare-env";
import {
  buildR2MediaKey,
  validateMediaUpload,
  type AllowedImageMimeType,
} from "./cloudflare-resources";

export const MAX_PROMPT_TITLE_CHARS = 150 as const;

export type PromptVoteValue = 1 | -1;

/**
 * Parses a YouTube or Vimeo URL and returns a safe, normalized iframe embed URL.
 * Returns `null` if the URL is not a valid YouTube or Vimeo video link.
 */
export function parseVideoEmbedUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

  // YouTube formats: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, youtube.com/shorts/ID
  if (host === "youtube.com" || host === "m.youtube.com") {
    const watchId = parsed.searchParams.get("v");
    if (watchId && /^[a-zA-Z0-9_-]{6,20}$/.test(watchId)) {
      return `https://www.youtube.com/embed/${watchId}`;
    }
    const pathMatch = /^\/(?:embed|shorts)\/([a-zA-Z0-9_-]{6,20})/.exec(
      parsed.pathname
    );
    if (pathMatch?.[1]) {
      return `https://www.youtube.com/embed/${pathMatch[1]}`;
    }
    return null;
  }

  if (host === "youtu.be") {
    const shortMatch = /^\/([a-zA-Z0-9_-]{6,20})/.exec(parsed.pathname);
    if (shortMatch?.[1]) {
      return `https://www.youtube.com/embed/${shortMatch[1]}`;
    }
    return null;
  }

  // Vimeo formats: vimeo.com/123456789, player.vimeo.com/video/123456789
  if (host === "vimeo.com") {
    const vimeoMatch = /^\/(\d{5,15})/.exec(parsed.pathname);
    if (vimeoMatch?.[1]) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    return null;
  }

  if (host === "player.vimeo.com") {
    const playerMatch = /^\/video\/(\d{5,15})/.exec(parsed.pathname);
    if (playerMatch?.[1]) {
      return `https://player.vimeo.com/video/${playerMatch[1]}`;
    }
    return null;
  }

  return null;
}

export interface PromptProposalInput {
  title: string;
  body: string;
  mediaType?: MediaType | null;
  mediaUrl?: string | null;
}

export interface PromptValidationResult {
  valid: boolean;
  normalizedMediaUrl: string | null;
  error?: string;
}

/**
 * Validates a prompt proposal's title (1..150 chars), body, and optional image/video media.
 */
export function validatePromptBankInput(
  input: PromptProposalInput
): PromptValidationResult {
  const cleanTitle = input.title.trim();
  const cleanBody = input.body.trim();

  if (!cleanTitle) {
    return {
      valid: false,
      normalizedMediaUrl: null,
      error: "El título de la consigna es obligatorio.",
    };
  }

  if (cleanTitle.length > MAX_PROMPT_TITLE_CHARS) {
    return {
      valid: false,
      normalizedMediaUrl: null,
      error: `El título de la consigna no puede superar los ${MAX_PROMPT_TITLE_CHARS} caracteres.`,
    };
  }

  if (!cleanBody) {
    return {
      valid: false,
      normalizedMediaUrl: null,
      error: "El texto de la consigna es obligatorio.",
    };
  }

  if (input.mediaType === "VIDEO") {
    const embedUrl = parseVideoEmbedUrl(input.mediaUrl ?? "");
    if (!embedUrl) {
      return {
        valid: false,
        normalizedMediaUrl: null,
        error: "Ingresa un enlace válido de YouTube o Vimeo.",
      };
    }
    return { valid: true, normalizedMediaUrl: embedUrl };
  }

  if (input.mediaType === "IMAGE") {
    const cleanUrl = (input.mediaUrl ?? "").trim();
    if (!cleanUrl) {
      return {
        valid: false,
        normalizedMediaUrl: null,
        error: "Debes subir una imagen válida para la consigna.",
      };
    }
    return { valid: true, normalizedMediaUrl: cleanUrl };
  }

  return { valid: true, normalizedMediaUrl: null };
}

export interface AnonymousVoteSummary {
  likes: number;
  dislikes: number;
  currentAdminVote: PromptVoteValue | 0;
}

/**
 * Aggregates prompt bank votes into anonymous totals (`likes` and `dislikes`)
 * plus the logged-in admin's own vote only — never leaking other voters' identities.
 */
export function aggregateAnonymousPromptVotes(
  rows: ReadonlyArray<{ adminId: string; voteValue: number }>,
  currentAdminId: string
): AnonymousVoteSummary {
  let likes = 0;
  let dislikes = 0;
  let currentAdminVote: PromptVoteValue | 0 = 0;

  for (const row of rows) {
    if (row.voteValue === 1) {
      likes += 1;
    } else if (row.voteValue === -1) {
      dislikes += 1;
    }
    if (row.adminId === currentAdminId) {
      currentAdminVote = row.voteValue === 1 ? 1 : row.voteValue === -1 ? -1 : 0;
    }
  }

  return { likes, dislikes, currentAdminVote };
}

/**
 * Creates a new prompt proposal in `prompt_bank` with status `AVAILABLE`.
 */
export async function createPromptProposalInDb(
  db: AppDatabase,
  options: {
    id?: string;
    authorId: string;
    input: PromptProposalInput;
    nowIso?: string;
  }
): Promise<{ created: boolean; promptId?: string; error?: string }> {
  const validation = validatePromptBankInput(options.input);
  if (!validation.valid) {
    return { created: false, error: validation.error };
  }

  const nowIso = options.nowIso ?? new Date().toISOString();
  const promptId = options.id ?? `prompt_${Date.now()}`;

  await db.insert(promptBank).values({
    id: promptId,
    authorId: options.authorId,
    title: options.input.title.trim(),
    body: options.input.body.trim(),
    mediaType: options.input.mediaType ?? null,
    mediaUrl: validation.normalizedMediaUrl,
    status: "AVAILABLE",
    assignedEditionId: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  return { created: true, promptId };
}

/**
 * Edits an existing prompt proposal in `prompt_bank`.
 * Business Rule: Editing a proposed prompt automatically resets all its anonymous votes to zero.
 */
export async function editPromptProposalInDb(
  db: AppDatabase,
  options: {
    promptId: string;
    editorId: string;
    editorRole: UserRole;
    input: PromptProposalInput;
    nowIso?: string;
  }
): Promise<{ updated: boolean; votesReset: boolean; error?: string }> {
  const validation = validatePromptBankInput(options.input);
  if (!validation.valid) {
    return { updated: false, votesReset: false, error: validation.error };
  }

  const rows = await db
    .select()
    .from(promptBank)
    .where(eq(promptBank.id, options.promptId));
  const existing = rows[0];

  if (!existing) {
    return {
      updated: false,
      votesReset: false,
      error: "Consigna propuesta no encontrada.",
    };
  }

  if (existing.status === "USED") {
    return {
      updated: false,
      votesReset: false,
      error: "No se puede editar una consigna que ya fue publicada en una edición.",
    };
  }

  if (
    existing.authorId !== options.editorId &&
    options.editorRole !== "SUPERADMIN"
  ) {
    return {
      updated: false,
      votesReset: false,
      error:
        "Solo el autor de la propuesta o el superadministrador pueden editar esta consigna.",
    };
  }

  const nowIso = options.nowIso ?? new Date().toISOString();

  await db
    .update(promptBank)
    .set({
      title: options.input.title.trim(),
      body: options.input.body.trim(),
      mediaType: options.input.mediaType ?? null,
      mediaUrl: validation.normalizedMediaUrl,
      updatedAt: nowIso,
    })
    .where(eq(promptBank.id, options.promptId));

  // Mandatory rule: editing a proposed prompt resets all its votes to zero
  await db
    .delete(promptBankVotes)
    .where(eq(promptBankVotes.promptBankId, options.promptId));

  return { updated: true, votesReset: true };
}

/**
 * Casts or updates an admin's anonymous +1 / -1 vote on a prompt proposal.
 */
export async function castAnonymousPromptVoteInDb(
  db: AppDatabase,
  options: {
    promptBankId: string;
    adminId: string;
    voteValue: PromptVoteValue;
  }
): Promise<{ saved: boolean }> {
  const existing = await db
    .select()
    .from(promptBankVotes)
    .where(
      and(
        eq(promptBankVotes.promptBankId, options.promptBankId),
        eq(promptBankVotes.adminId, options.adminId)
      )
    );

  if (existing.length > 0) {
    await db
      .update(promptBankVotes)
      .set({ voteValue: options.voteValue })
      .where(
        and(
          eq(promptBankVotes.promptBankId, options.promptBankId),
          eq(promptBankVotes.adminId, options.adminId)
        )
      );
  } else {
    await db.insert(promptBankVotes).values({
      id: `pbv_${options.promptBankId}_${options.adminId}`,
      promptBankId: options.promptBankId,
      adminId: options.adminId,
      voteValue: options.voteValue,
    });
  }

  return { saved: true };
}

/**
 * Adds a visible comment from an admin on a prompt proposal.
 */
export async function addPromptCommentInDb(
  db: AppDatabase,
  options: {
    promptBankId: string;
    authorId: string;
    commentText: string;
    nowIso?: string;
    commentId?: string;
  }
): Promise<{ created: boolean; commentId?: string; error?: string }> {
  const cleanText = options.commentText.trim();
  if (!cleanText) {
    return { created: false, error: "El comentario no puede estar vacío." };
  }

  const nowIso = options.nowIso ?? new Date().toISOString();
  const commentId = options.commentId ?? `pbc_${Date.now()}`;

  await db.insert(promptBankComments).values({
    id: commentId,
    promptBankId: options.promptBankId,
    authorId: options.authorId,
    commentText: cleanText,
    createdAt: nowIso,
  });

  return { created: true, commentId };
}

/**
 * Validates and uploads a prompt image (JPG/PNG/WEBP <= 5 MB) to Cloudflare R2 under `prompts/`.
 */
export async function uploadPromptImageToR2(options: {
  mediaBucket: R2BucketBinding;
  promptScopeId: string;
  mimeType: string;
  bytes: ArrayBuffer;
  timestampMs?: number;
}): Promise<{ uploaded: boolean; imageUrl?: string; error?: string }> {
  const validation = validateMediaUpload({
    mimeType: options.mimeType,
    sizeBytes: options.bytes.byteLength,
  });

  if (!validation.valid) {
    return { uploaded: false, error: validation.error };
  }

  const timestampMs = options.timestampMs ?? Date.now();
  const objectKey = buildR2MediaKey(
    "prompts",
    options.promptScopeId,
    options.mimeType as AllowedImageMimeType,
    timestampMs
  );

  await options.mediaBucket.put(objectKey, options.bytes, {
    httpMetadata: {
      contentType: options.mimeType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  return {
    uploaded: true,
    imageUrl: `/api/media/${objectKey}`,
  };
}
