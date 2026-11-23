import { describe, expect, it } from "vitest";
import { createDbClient } from "@/db";
import type { D1DatabaseBinding } from "../cloudflare-env";
import {
  BREVO_SMTP_API_URL,
  dispatchTemplateEmail,
  escapeHtml,
  interpolateEmailTags,
  renderEmailTemplate,
  sendBrevoTransactionalEmail,
} from "../email";

function createEmailTestD1Binding(options: {
  existingDispatchRow?: unknown[];
  customTemplateRow?: unknown[];
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
          if (query.includes("email_dispatch_logs") && options.existingDispatchRow) {
            return [options.existingDispatchRow] as unknown as T[];
          }
          if (query.includes("email_templates") && options.customTemplateRow) {
            return [options.customTemplateRow] as unknown as T[];
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

describe("Step 1.9 — Brevo Transactional Email Service & Idempotent Dispatch", () => {
  it("escapes HTML in body values while keeping plain text in subjects", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );

    const rendered = renderEmailTemplate(
      {
        subjectTemplate: "Cuento «{{TITULO_CUENTO}}» de {{NOMBRE}}",
        bodyHtmlTemplate:
          "<p>Autor: {{NOMBRE}} {{APELLIDO}} — Obra: {{TITULO_CUENTO}} ({{NUMERO_CONSIGNA}})</p>",
      },
      {
        NOMBRE: "María",
        APELLIDO: "Pérez",
        TITULO_CUENTO: "El <Río> & el Mar",
        NUMERO_CONSIGNA: 2,
      }
    );

    expect(rendered.subject).toBe("Cuento «El <Río> & el Mar» de María");
    expect(rendered.htmlContent).toBe(
      "<p>Autor: María Pérez — Obra: El &lt;Río&gt; &amp; el Mar (2)</p>"
    );
  });

  it("interpolates all 12 supported dynamic tags accurately", () => {
    const template =
      "{{NOMBRE}}|{{APELLIDO}}|{{EMAIL}}|{{EDICION}}|{{NUMERO_CONSIGNA}}|{{TITULO_CONSIGNA}}|{{TITULO_CUENTO}}|{{CANTIDAD_FALLAS}}|{{MAX_FALLAS}}|{{FECHA_HORA_CIERRE}}|{{LINK_PLATAFORMA}}|{{LINK_RESULTADOS}}";

    const result = interpolateEmailTags(template, {
      NOMBRE: "Ana",
      APELLIDO: "Gómez",
      EMAIL: "ana@sitelocuento.com",
      EDICION: "Olimpíadas 2026",
      NUMERO_CONSIGNA: 3,
      TITULO_CONSIGNA: "El espejo",
      TITULO_CUENTO: "Reflejos",
      CANTIDAD_FALLAS: 1,
      MAX_FALLAS: 2,
      FECHA_HORA_CIERRE: "15/06/2026, 09:00 (hora de Caracas)",
      LINK_PLATAFORMA: "https://olimpiadas.sitelocuento.com/panel",
      LINK_RESULTADOS: "https://olimpiadas.sitelocuento.com/resultados",
    });

    expect(result).toBe(
      "Ana|Gómez|ana@sitelocuento.com|Olimpíadas 2026|3|El espejo|Reflejos|1|2|15/06/2026, 09:00 (hora de Caracas)|https://olimpiadas.sitelocuento.com/panel|https://olimpiadas.sitelocuento.com/resultados"
    );
  });

  it("supports dry-run mode when Brevo domain/API key is pending or dryRun is true", async () => {
    const noKeyResult = await sendBrevoTransactionalEmail({
      to: [{ email: "autor@ejemplo.com", name: "Autor" }],
      subject: "Prueba",
      htmlContent: "<p>Hola</p>",
    });
    expect(noKeyResult.sent).toBe(true);
    expect(noKeyResult.dryRun).toBe(true);
    expect(noKeyResult.messageId).toMatch(/^dry-run-/);

    const emptyRecipients = await sendBrevoTransactionalEmail({
      apiKey: "xkeysib-test",
      to: [],
      subject: "Prueba",
      htmlContent: "<p>Hola</p>",
    });
    expect(emptyRecipients.sent).toBe(false);
    expect(emptyRecipients.error).toContain("At least one recipient");
  });

  it("sends live HTTP request to Brevo v3 SMTP API and handles API errors", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody = "";

    const mockFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedHeaders = (init?.headers as Record<string, string>) ?? {};
      capturedBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ messageId: "<msg-123@brevo>" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    };

    const liveResult = await sendBrevoTransactionalEmail({
      apiKey: "xkeysib-live-key",
      to: [{ email: "lector@ejemplo.com", name: "Lector" }],
      subject: "Asunto de prueba",
      htmlContent: "<p>Contenido</p>",
      fetchImpl: mockFetch,
    });

    expect(liveResult).toEqual({
      sent: true,
      dryRun: false,
      messageId: "<msg-123@brevo>",
    });
    expect(capturedUrl).toBe(BREVO_SMTP_API_URL);
    expect(capturedHeaders["api-key"]).toBe("xkeysib-live-key");
    expect(JSON.parse(capturedBody)).toEqual({
      sender: {
        email: "olimpiadas@sitelocuento.com",
        name: "Olimpíadas Literarias",
      },
      to: [{ email: "lector@ejemplo.com", name: "Lector" }],
      subject: "Asunto de prueba",
      htmlContent: "<p>Contenido</p>",
    });

    const failingFetch: typeof fetch = async () =>
      new Response("Sender domain not verified", { status: 400 });

    const errorResult = await sendBrevoTransactionalEmail({
      apiKey: "xkeysib-live-key",
      to: [{ email: "lector@ejemplo.com" }],
      subject: "Asunto",
      htmlContent: "<p>Contenido</p>",
      fetchImpl: failingFetch,
    });
    expect(errorResult.sent).toBe(false);
    expect(errorResult.error).toContain("Brevo API error (400)");
  });

  it("enforces idempotency via email_dispatch_logs and records successful dispatches", async () => {
    // 1. Duplicate check skips sending
    const duplicateDb = createDbClient(
      createEmailTestD1Binding({
        existingDispatchRow: [
          "E06:user_1:prompt_1_1h",
          "ed_2026",
          "E06",
          "user_1",
          "prompt_1_1h",
          "2026-11-18T12:00:00.000Z",
        ],
      }).binding
    );

    const skipped = await dispatchTemplateEmail({
      db: duplicateDb,
      templateCode: "E06",
      recipientUserId: "user_1",
      recipientEmail: "user1@ejemplo.com",
      contextKey: "prompt_1_1h",
      variables: { NOMBRE: "Carlos", NUMERO_CONSIGNA: 1 },
      dryRun: true,
    });

    expect(skipped).toEqual({
      dispatched: false,
      skippedDuplicate: true,
      dryRun: false,
    });

    // 2. First-time dispatch renders template and inserts log row
    const { binding, queries } = createEmailTestD1Binding();
    const freshDb = createDbClient(binding);

    const dispatched = await dispatchTemplateEmail({
      db: freshDb,
      templateCode: "E05",
      recipientUserId: "user_2",
      recipientEmail: "user2@ejemplo.com",
      contextKey: "prompt_2_open",
      editionId: "ed_2026",
      variables: {
        NOMBRE: "Elena",
        EDICION: "Olimpíadas 2026",
        NUMERO_CONSIGNA: 2,
        TITULO_CONSIGNA: "La lluvia",
        FECHA_HORA_CIERRE: "20/06/2026, 09:00 (hora de Caracas)",
        LINK_PLATAFORMA: "https://olimpiadas.sitelocuento.com",
      },
      dryRun: true,
      nowIso: "2026-11-18T15:00:00.000Z",
    });

    expect(dispatched.dispatched).toBe(true);
    expect(dispatched.skippedDuplicate).toBe(false);
    expect(dispatched.dryRun).toBe(true);
    expect(dispatched.subject).toBe(
      "¡Ya está disponible la Consigna #2 de Olimpíadas 2026!"
    );
    expect(
      queries.some((q) => q.includes('insert into "email_dispatch_logs"'))
    ).toBe(true);
  });
});
