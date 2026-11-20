/**
 * Superadmin Email Template Manager (E01-E26)
 * Step 2.6: Edit subjects/bodies, insert {{TAGS}} at cursor, preview, and send test emails
 */

import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { emailTemplates } from "@/db/schema";
import {
  DEFAULT_EMAIL_TEMPLATES,
  type EmailTemplateTag,
} from "@/db/seed";
import { APP_BRAND } from "./app-metadata";
import {
  renderEmailTemplate,
  sendBrevoTransactionalEmail,
  type EmailTemplateVariables,
} from "./email";

export interface EditableEmailTemplate {
  code: string;
  name: string;
  description: string;
  subjectTemplate: string;
  bodyHtmlTemplate: string;
  availableTags: EmailTemplateTag[];
  updatedAt: string | null;
}

/**
 * Inserts a dynamic `{{TAG}}` string into `text` at the exact cursor selection range
 * and returns the updated string plus the new caret position right after the inserted tag.
 */
export function insertTagAtCursor(
  text: string,
  tag: string,
  selectionStart: number,
  selectionEnd: number = selectionStart
): { nextText: string; nextCursorPos: number } {
  const safeStart = Math.max(0, Math.min(selectionStart, text.length));
  const safeEnd = Math.max(safeStart, Math.min(selectionEnd, text.length));

  const nextText = text.slice(0, safeStart) + tag + text.slice(safeEnd);
  return {
    nextText,
    nextCursorPos: safeStart + tag.length,
  };
}

/**
 * Validates subject and HTML body before persisting an email template update.
 */
export function validateEmailTemplateUpdate(input: {
  code: string;
  subjectTemplate: string;
  bodyHtmlTemplate: string;
}): { valid: boolean; error?: string } {
  const known = DEFAULT_EMAIL_TEMPLATES.some((t) => t.code === input.code);
  if (!known) {
    return {
      valid: false,
      error: `Código de plantilla desconocido: "${input.code}".`,
    };
  }
  if (!input.subjectTemplate.trim()) {
    return { valid: false, error: "El asunto del correo es obligatorio." };
  }
  if (!input.bodyHtmlTemplate.trim()) {
    return { valid: false, error: "El cuerpo del correo no puede estar vacío." };
  }
  return { valid: true };
}

/**
 * Generates realistic Spanish sample variables for live previews and test emails.
 */
export function buildSampleEmailPreviewVariables(
  recipientEmail: string,
  recipientName: string = "Dalex"
): EmailTemplateVariables {
  return {
    NOMBRE: recipientName,
    APELLIDO: "Organizador",
    EMAIL: recipientEmail,
    EDICION: "Olimpíadas Literarias de SiTeLoCuento 2026",
    NUMERO_CONSIGNA: 2,
    TITULO_CONSIGNA: "El reloj detenido en la estación",
    TITULO_CUENTO: "Cartas para un tren que nunca llegó",
    CANTIDAD_FALLAS: 2,
    MAX_FALLAS: 2,
    FECHA_HORA_CIERRE: "20/06/2026, 09:00 (hora de Caracas)",
    LINK_PLATAFORMA: APP_BRAND.productionUrl,
    LINK_RESULTADOS: `${APP_BRAND.productionUrl}/resultados`,
  };
}

/**
 * Loads all 26 templates (`E01`–`E26`), merging customized rows from D1 with default seed fallbacks.
 */
export async function listAllEmailTemplatesFromDb(
  db: AppDatabase
): Promise<EditableEmailTemplate[]> {
  const dbRows = await db.select().from(emailTemplates);
  const byCode = new Map(dbRows.map((row) => [row.code, row]));

  return DEFAULT_EMAIL_TEMPLATES.map((seedItem) => {
    const dbRow = byCode.get(seedItem.code);
    if (!dbRow) {
      return {
        code: seedItem.code,
        name: seedItem.name,
        description: seedItem.description,
        subjectTemplate: seedItem.subjectTemplate,
        bodyHtmlTemplate: seedItem.bodyHtmlTemplate,
        availableTags: [...seedItem.availableTags],
        updatedAt: null,
      };
    }

    let parsedTags: EmailTemplateTag[] = [...seedItem.availableTags];
    try {
      const candidate = JSON.parse(dbRow.availableTagsJson) as unknown;
      if (Array.isArray(candidate) && candidate.length > 0) {
        parsedTags = candidate as EmailTemplateTag[];
      }
    } catch {
      // Keep default tags if JSON is malformed
    }

    return {
      code: dbRow.code,
      name: dbRow.name,
      description: dbRow.description,
      subjectTemplate: dbRow.subjectTemplate,
      bodyHtmlTemplate: dbRow.bodyHtmlTemplate,
      availableTags: parsedTags,
      updatedAt: dbRow.updatedAt,
    };
  });
}

/**
 * Saves an edited email template (`subjectTemplate`, `bodyHtmlTemplate`) into Cloudflare D1.
 */
export async function updateEmailTemplateInDb(
  db: AppDatabase,
  options: {
    code: string;
    subjectTemplate: string;
    bodyHtmlTemplate: string;
    nowIso?: string;
  }
): Promise<{ updated: boolean; error?: string }> {
  const validation = validateEmailTemplateUpdate(options);
  if (!validation.valid) {
    return { updated: false, error: validation.error };
  }

  const seedItem = DEFAULT_EMAIL_TEMPLATES.find(
    (t) => t.code === options.code
  );
  if (!seedItem) {
    return { updated: false, error: "Plantilla no encontrada." };
  }

  const nowIso = options.nowIso ?? new Date().toISOString();
  const existing = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.code, options.code));

  if (existing.length > 0) {
    await db
      .update(emailTemplates)
      .set({
        subjectTemplate: options.subjectTemplate.trim(),
        bodyHtmlTemplate: options.bodyHtmlTemplate.trim(),
        updatedAt: nowIso,
      })
      .where(eq(emailTemplates.code, options.code));
  } else {
    await db.insert(emailTemplates).values({
      code: seedItem.code,
      name: seedItem.name,
      description: seedItem.description,
      subjectTemplate: options.subjectTemplate.trim(),
      bodyHtmlTemplate: options.bodyHtmlTemplate.trim(),
      availableTagsJson: JSON.stringify(seedItem.availableTags),
      updatedAt: nowIso,
    });
  }

  return { updated: true };
}

/**
 * Renders a template with sample variables and sends a test email to the Superadmin's address.
 */
export async function sendTestTemplateEmail(options: {
  recipientEmail: string;
  recipientName?: string;
  subjectTemplate: string;
  bodyHtmlTemplate: string;
  apiKey?: string;
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<{ sent: boolean; dryRun: boolean; subject: string; error?: string }> {
  const vars = buildSampleEmailPreviewVariables(
    options.recipientEmail,
    options.recipientName
  );
  const rendered = renderEmailTemplate(
    {
      subjectTemplate: `[PRUEBA] ${options.subjectTemplate}`,
      bodyHtmlTemplate: options.bodyHtmlTemplate,
    },
    vars
  );

  const res = await sendBrevoTransactionalEmail({
    apiKey: options.apiKey,
    dryRun: options.dryRun,
    to: [{ email: options.recipientEmail, name: options.recipientName }],
    subject: rendered.subject,
    htmlContent: rendered.htmlContent,
    fetchImpl: options.fetchImpl,
  });

  return {
    sent: res.sent,
    dryRun: res.dryRun,
    subject: rendered.subject,
    error: res.error,
  };
}
