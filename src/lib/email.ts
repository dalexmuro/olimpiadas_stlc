/**
 * Transactional Email Dispatch Service (Brevo REST API + Template Interpolation + D1 Idempotency)
 * Step 1.9: Email template rendering, Brevo HTTP client, and idempotent dispatch logging
 */

import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { emailDispatchLogs, emailTemplates } from "@/db/schema";
import { DEFAULT_EMAIL_TEMPLATES, type EmailTemplateTag } from "@/db/seed";
import { APP_BRAND } from "./app-metadata";

export const BREVO_SMTP_API_URL = "https://api.brevo.com/v3/smtp/email";

/**
 * Map of tag keys (without curly braces) to string/number values for template interpolation.
 */
export interface EmailTemplateVariables {
  NOMBRE?: string;
  APELLIDO?: string;
  EMAIL?: string;
  EDICION?: string;
  NUMERO_CONSIGNA?: string | number;
  TITULO_CONSIGNA?: string;
  TITULO_CUENTO?: string;
  CANTIDAD_FALLAS?: string | number;
  MAX_FALLAS?: string | number;
  FECHA_HORA_CIERRE?: string;
  LINK_PLATAFORMA?: string;
  LINK_RESULTADOS?: string;
}

const TAG_KEY_MAP: Record<EmailTemplateTag, keyof EmailTemplateVariables> = {
  "{{NOMBRE}}": "NOMBRE",
  "{{APELLIDO}}": "APELLIDO",
  "{{EMAIL}}": "EMAIL",
  "{{EDICION}}": "EDICION",
  "{{NUMERO_CONSIGNA}}": "NUMERO_CONSIGNA",
  "{{TITULO_CONSIGNA}}": "TITULO_CONSIGNA",
  "{{TITULO_CUENTO}}": "TITULO_CUENTO",
  "{{CANTIDAD_FALLAS}}": "CANTIDAD_FALLAS",
  "{{MAX_FALLAS}}": "MAX_FALLAS",
  "{{FECHA_HORA_CIERRE}}": "FECHA_HORA_CIERRE",
  "{{LINK_PLATAFORMA}}": "LINK_PLATAFORMA",
  "{{LINK_RESULTADOS}}": "LINK_RESULTADOS",
};

/**
 * Escapes HTML special characters in user-supplied tag values when interpolating into HTML bodies.
 */
export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Replaces all `{{TAG}}` placeholders in a subject or HTML body string.
 */
export function interpolateEmailTags(
  templateText: string,
  variables: EmailTemplateVariables,
  options: { escapeHtmlValues?: boolean } = {}
): string {
  let output = templateText;

  for (const [tagToken, varKey] of Object.entries(TAG_KEY_MAP) as Array<
    [EmailTemplateTag, keyof EmailTemplateVariables]
  >) {
    const rawValue = variables[varKey];
    const stringValue =
      rawValue === undefined || rawValue === null ? "" : String(rawValue);
    const safeValue = options.escapeHtmlValues
      ? escapeHtml(stringValue)
      : stringValue;

    output = output.split(tagToken).join(safeValue);
  }

  return output;
}

export interface RenderedEmailContent {
  subject: string;
  htmlContent: string;
}

/**
 * Renders both the subject (plain text) and HTML body for a given template and variable set.
 */
export function renderEmailTemplate(
  template: { subjectTemplate: string; bodyHtmlTemplate: string },
  variables: EmailTemplateVariables
): RenderedEmailContent {
  return {
    subject: interpolateEmailTags(template.subjectTemplate, variables, {
      escapeHtmlValues: false,
    }),
    htmlContent: interpolateEmailTags(template.bodyHtmlTemplate, variables, {
      escapeHtmlValues: true,
    }),
  };
}

export interface BrevoRecipient {
  email: string;
  name?: string;
}

export interface SendBrevoEmailInput {
  apiKey?: string;
  dryRun?: boolean;
  fromAddress?: string;
  fromName?: string;
  to: BrevoRecipient[];
  subject: string;
  htmlContent: string;
  fetchImpl?: typeof fetch;
}

export interface SendBrevoEmailResult {
  sent: boolean;
  dryRun: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sends a transactional email via Brevo's HTTP v3 API (`/v3/smtp/email`).
 * Falls back cleanly to `dryRun: true` when `dryRun` is enabled or `apiKey` is not configured yet
 * (e.g., while DNS domain verification is pending).
 */
export async function sendBrevoTransactionalEmail(
  input: SendBrevoEmailInput
): Promise<SendBrevoEmailResult> {
  if (input.to.length === 0) {
    return {
      sent: false,
      dryRun: false,
      error: "At least one recipient is required.",
    };
  }

  const trimmedKey = input.apiKey?.trim();
  if (input.dryRun || !trimmedKey) {
    return {
      sent: true,
      dryRun: true,
      messageId: `dry-run-${Date.now()}`,
    };
  }

  const fetchFn = input.fetchImpl ?? fetch;
  const payload = {
    sender: {
      email: input.fromAddress ?? APP_BRAND.supportEmail,
      name: input.fromName ?? APP_BRAND.contestName,
    },
    to: input.to.map((r) => ({
      email: r.email.trim(),
      ...(r.name ? { name: r.name.trim() } : {}),
    })),
    subject: input.subject,
    htmlContent: input.htmlContent,
  };

  const response = await fetchFn(BREVO_SMTP_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": trimmedKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    return {
      sent: false,
      dryRun: false,
      error: `Brevo API error (${response.status}): ${errorBody}`,
    };
  }

  const data = (await response.json()) as { messageId?: string };
  return {
    sent: true,
    dryRun: false,
    messageId: data.messageId,
  };
}

export interface DispatchTemplateEmailInput {
  db: AppDatabase;
  templateCode: string;
  recipientUserId: string;
  recipientEmail: string;
  recipientName?: string;
  contextKey: string;
  editionId?: string;
  variables: EmailTemplateVariables;
  apiKey?: string;
  dryRun?: boolean;
  fromAddress?: string;
  fromName?: string;
  nowIso?: string;
  fetchImpl?: typeof fetch;
}

export interface DispatchTemplateEmailResult {
  dispatched: boolean;
  skippedDuplicate: boolean;
  dryRun: boolean;
  subject?: string;
  messageId?: string;
  error?: string;
}

/**
 * Idempotently dispatches one of the E01-E26 automated emails:
 * 1. Checks `email_dispatch_logs` for `(templateCode, recipientUserId, contextKey)`.
 *    If already sent, returns `{ dispatched: false, skippedDuplicate: true }`.
 * 2. Loads the template from D1 `email_templates` (or falls back to `DEFAULT_EMAIL_TEMPLATES`).
 * 3. Interpolates `{{TAGS}}` and sends via Brevo (or dry-run if domain/key is not active yet).
 * 4. Records the dispatch in `email_dispatch_logs`.
 */
export async function dispatchTemplateEmail(
  input: DispatchTemplateEmailInput
): Promise<DispatchTemplateEmailResult> {
  const existingLogs = await input.db
    .select()
    .from(emailDispatchLogs)
    .where(
      and(
        eq(emailDispatchLogs.templateCode, input.templateCode),
        eq(emailDispatchLogs.recipientUserId, input.recipientUserId),
        eq(emailDispatchLogs.contextKey, input.contextKey)
      )
    );

  if (existingLogs.length > 0) {
    return {
      dispatched: false,
      skippedDuplicate: true,
      dryRun: false,
    };
  }

  const dbTemplates = await input.db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.code, input.templateCode));

  const fallbackTemplate = DEFAULT_EMAIL_TEMPLATES.find(
    (t) => t.code === input.templateCode
  );

  const activeTemplate = dbTemplates[0] ?? fallbackTemplate;
  if (!activeTemplate) {
    return {
      dispatched: false,
      skippedDuplicate: false,
      dryRun: false,
      error: `Unknown email template code "${input.templateCode}".`,
    };
  }

  const rendered = renderEmailTemplate(
    {
      subjectTemplate: activeTemplate.subjectTemplate,
      bodyHtmlTemplate: activeTemplate.bodyHtmlTemplate,
    },
    input.variables
  );

  const sendResult = await sendBrevoTransactionalEmail({
    apiKey: input.apiKey,
    dryRun: input.dryRun,
    fromAddress: input.fromAddress,
    fromName: input.fromName,
    to: [{ email: input.recipientEmail, name: input.recipientName }],
    subject: rendered.subject,
    htmlContent: rendered.htmlContent,
    fetchImpl: input.fetchImpl,
  });

  if (!sendResult.sent) {
    return {
      dispatched: false,
      skippedDuplicate: false,
      dryRun: sendResult.dryRun,
      subject: rendered.subject,
      error: sendResult.error,
    };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const logId = `${input.templateCode}:${input.recipientUserId}:${input.contextKey}`;

  await input.db
    .insert(emailDispatchLogs)
    .values({
      id: logId,
      editionId: input.editionId ?? null,
      templateCode: input.templateCode,
      recipientUserId: input.recipientUserId,
      contextKey: input.contextKey,
      sentAt: nowIso,
    })
    .onConflictDoNothing();

  return {
    dispatched: true,
    skippedDuplicate: false,
    dryRun: sendResult.dryRun,
    subject: rendered.subject,
    messageId: sendResult.messageId,
  };
}
