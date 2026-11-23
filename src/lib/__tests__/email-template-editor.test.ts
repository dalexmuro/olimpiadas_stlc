import { describe, expect, it } from "vitest";
import { createDbClient } from "@/db";
import type { D1DatabaseBinding } from "../cloudflare-env";
import {
  buildSampleEmailPreviewVariables,
  insertTagAtCursor,
  listAllEmailTemplatesFromDb,
  sendTestTemplateEmail,
  updateEmailTemplateInDb,
  validateEmailTemplateUpdate,
} from "../email-template-editor";

function createEmailEditorTestD1(existingRows: unknown[][] = []): {
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
        raw: async <T = unknown[]>() => existingRows as unknown as T[],
      };
    },
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  };
  return { binding, queries };
}

describe("Step 2.6 — Superadmin Email Template Editor (E01-E26)", () => {
  it("inserts dynamic {{TAG}} at the exact cursor selection position", () => {
    const inserted = insertTagAtCursor("Hola , bienvenido", "{{NOMBRE}}", 5, 5);
    expect(inserted).toEqual({
      nextText: "Hola {{NOMBRE}}, bienvenido",
      nextCursorPos: 15,
    });

    const replaced = insertTagAtCursor("Hola X, bienvenido", "{{NOMBRE}}", 5, 6);
    expect(replaced).toEqual({
      nextText: "Hola {{NOMBRE}}, bienvenido",
      nextCursorPos: 15,
    });
  });

  it("validates template codes and required fields before saving", () => {
    expect(
      validateEmailTemplateUpdate({
        code: "E99",
        subjectTemplate: "Asunto",
        bodyHtmlTemplate: "<p>Hola</p>",
      }).valid
    ).toBe(false);

    expect(
      validateEmailTemplateUpdate({
        code: "E05",
        subjectTemplate: "   ",
        bodyHtmlTemplate: "<p>Hola</p>",
      }).valid
    ).toBe(false);

    expect(
      validateEmailTemplateUpdate({
        code: "E05",
        subjectTemplate: "Nueva consigna #{{NUMERO_CONSIGNA}}",
        bodyHtmlTemplate: "<p>Hola {{NOMBRE}}</p>",
      }).valid
    ).toBe(true);
  });

  it("lists all 26 templates merging customized D1 rows with seed fallbacks", async () => {
    const { binding } = createEmailEditorTestD1([
      [
        "E01",
        "Creación de cuenta",
        "Desc",
        "Asunto personalizado {{NOMBRE}}",
        "<p>Cuerpo personalizado</p>",
        '["{{NOMBRE}}","{{EMAIL}}"]',
        "2026-11-20T13:00:00.000Z",
      ],
    ]);
    const db = createDbClient(binding);

    const list = await listAllEmailTemplatesFromDb(db);
    expect(list).toHaveLength(26);
    expect(list[0].code).toBe("E01");
    expect(list[0].subjectTemplate).toBe("Asunto personalizado {{NOMBRE}}");
    expect(list[25].code).toBe("E26");
  });

  it("updates templates in D1 and dispatches test emails with sample variables", async () => {
    const { binding, queries } = createEmailEditorTestD1([
      [
        "E05",
        "Nueva consigna",
        "Desc",
        "Old",
        "<p>Old</p>",
        '["{{NOMBRE}}"]',
        "2026-11-20T12:00:00.000Z",
      ],
    ]);
    const db = createDbClient(binding);

    const saved = await updateEmailTemplateInDb(db, {
      code: "E05",
      subjectTemplate: "Consigna #{{NUMERO_CONSIGNA}} abierta",
      bodyHtmlTemplate: "<p>Hola {{NOMBRE}}, ya puedes escribir.</p>",
    });
    expect(saved).toEqual({ updated: true });
    expect(
      queries.some((q) => q.includes('update "email_templates"'))
    ).toBe(true);

    const sampleVars = buildSampleEmailPreviewVariables("dalexmuro@gmail.com");
    expect(sampleVars.EDICION).toContain("Olimpíadas Literarias");

    const testMail = await sendTestTemplateEmail({
      recipientEmail: "dalexmuro@gmail.com",
      recipientName: "Dalex",
      subjectTemplate: "Consigna #{{NUMERO_CONSIGNA}} para {{NOMBRE}}",
      bodyHtmlTemplate: "<p>Hola {{NOMBRE}}</p>",
      dryRun: true,
    });
    expect(testMail.sent).toBe(true);
    expect(testMail.dryRun).toBe(true);
    expect(testMail.subject).toBe("[PRUEBA] Consigna #2 para Dalex");
  });
});
