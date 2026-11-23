"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { DEFAULT_EMAIL_TEMPLATES } from "@/db/seed";
import { renderEmailTemplate } from "@/lib/email";
import {
  buildSampleEmailPreviewVariables,
  insertTagAtCursor,
  type EditableEmailTemplate,
} from "@/lib/email-template-editor";
import { sanitizeHtml } from "@/lib/security";

const INITIAL_FALLBACK_TEMPLATES: EditableEmailTemplate[] =
  DEFAULT_EMAIL_TEMPLATES.map((t) => ({
    code: t.code,
    name: t.name,
    description: t.description,
    subjectTemplate: t.subjectTemplate,
    bodyHtmlTemplate: t.bodyHtmlTemplate,
    availableTags: [...t.availableTags],
    updatedAt: null,
  }));

export default function AdminEmailTemplatesPage() {
  const [templates, setTemplates] = useState<EditableEmailTemplate[]>(
    INITIAL_FALLBACK_TEMPLATES
  );
  const [selectedCode, setSelectedCode] = useState<string>("E01");
  const [subject, setSubject] = useState<string>(
    INITIAL_FALLBACK_TEMPLATES[0].subjectTemplate
  );
  const [bodyHtml, setBodyHtml] = useState<string>(
    INITIAL_FALLBACK_TEMPLATES[0].bodyHtmlTemplate
  );
  const [superadminEmail, setSuperadminEmail] = useState<string>("");
  const [canEdit, setCanEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    async function loadTemplates() {
      try {
        const res = await fetch("/api/admin/correos");
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok: boolean;
          canEdit?: boolean;
          templates?: EditableEmailTemplate[];
          superadminEmail?: string;
        };
        if (data.ok && data.templates && data.templates.length > 0) {
          setCanEdit(Boolean(data.canEdit));
          setTemplates(data.templates);
          const first = data.templates[0];
          setSelectedCode(first.code);
          setSubject(first.subjectTemplate);
          setBodyHtml(first.bodyHtmlTemplate);
          if (data.superadminEmail) {
            setSuperadminEmail(data.superadminEmail);
          }
        }
      } catch {
        // Keeps default fallback templates in offline preview
      }
    }
    void loadTemplates();
  }, []);

  const activeTemplate =
    templates.find((t) => t.code === selectedCode) ?? templates[0];

  function handleSelectTemplate(code: string) {
    const found = templates.find((t) => t.code === code);
    if (!found) return;
    setSelectedCode(found.code);
    setSubject(found.subjectTemplate);
    setBodyHtml(found.bodyHtmlTemplate);
    setFeedback(null);
    setErrorMessage(null);
  }

  function handleInsertTag(tag: string) {
    const el = bodyRef.current;
    const start = el ? el.selectionStart : bodyHtml.length;
    const end = el ? el.selectionEnd : bodyHtml.length;
    const { nextText, nextCursorPos } = insertTagAtCursor(
      bodyHtml,
      tag,
      start,
      end
    );
    setBodyHtml(nextText);

    requestAnimationFrame(() => {
      if (bodyRef.current) {
        bodyRef.current.focus();
        bodyRef.current.setSelectionRange(nextCursorPos, nextCursorPos);
      }
    });
  }

  function wrapSelectionWithHtml(openTag: string, closeTag: string) {
    const el = bodyRef.current;
    const start = el ? el.selectionStart : bodyHtml.length;
    const end = el ? el.selectionEnd : bodyHtml.length;
    const selected = bodyHtml.slice(start, end) || "texto";
    const snippet = `${openTag}${selected}${closeTag}`;
    const { nextText, nextCursorPos } = insertTagAtCursor(
      bodyHtml,
      snippet,
      start,
      end
    );
    setBodyHtml(nextText);
    requestAnimationFrame(() => {
      if (bodyRef.current) {
        bodyRef.current.focus();
        bodyRef.current.setSelectionRange(nextCursorPos, nextCursorPos);
      }
    });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setFeedback(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/correos", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: activeTemplate.code,
          subjectTemplate: subject,
          bodyHtmlTemplate: bodyHtml,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "No se pudo guardar la plantilla.");
        return;
      }

      setTemplates((prev) =>
        prev.map((t) =>
          t.code === activeTemplate.code
            ? { ...t, subjectTemplate: subject, bodyHtmlTemplate: bodyHtml }
            : t
        )
      );
      setFeedback(
        `Plantilla ${activeTemplate.code} guardada correctamente.`
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    setErrorMessage(null);
    setFeedback(null);
    setTesting(true);
    try {
      const res = await fetch("/api/admin/correos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subjectTemplate: subject,
          bodyHtmlTemplate: bodyHtml,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        dryRun?: boolean;
        recipientEmail?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "No se pudo enviar el correo de prueba.");
        return;
      }
      setFeedback(
        data.dryRun
          ? `Simulación completada (modo prueba sin DNS activo) para ${data.recipientEmail ?? superadminEmail}.`
          : `Correo de prueba enviado a ${data.recipientEmail ?? superadminEmail}.`
      );
    } finally {
      setTesting(false);
    }
  }

  const preview = renderEmailTemplate(
    { subjectTemplate: subject, bodyHtmlTemplate: bodyHtml },
    buildSampleEmailPreviewVariables(superadminEmail)
  );

  return (
    <section className="border-t-2 border-ink pt-6">
      <h1>Plantillas de correos automáticos (E01–E26)</h1>
      <p className="lead mt-3 text-ink-2">
        Edita el asunto y contenido de cada correo del certamen. Haz clic en
        cualquier etiqueta para insertarla directamente en la posición del
        cursor.
      </p>

      {!canEdit && (
        <div
          role="status"
          className="mt-6 rounded-card border border-rule bg-accent-soft px-4 py-3 text-sm text-ink-2"
        >
          Modo solo lectura: puedes consultar todas las plantillas y su vista
          previa, pero solo el superadministrador puede editarlas.
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="mt-6 rounded-card border border-error bg-paper-2 p-4 text-sm text-error"
        >
          {errorMessage}
        </div>
      )}

      {feedback && (
        <div className="mt-6 rounded-card border border-ink bg-paper p-4 text-sm text-ink">
          {feedback}
        </div>
      )}

      <div className="mt-8 border-t border-rule pt-6">
        <label htmlFor="tpl-selector" className="block text-sm font-medium">
          Seleccionar plantilla de correo
        </label>
        <select
          id="tpl-selector"
          value={selectedCode}
          onChange={(e) => handleSelectTemplate(e.target.value)}
          className="mt-2 block min-h-12 w-full rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink"
        >
          {templates.map((t) => (
            <option key={t.code} value={t.code}>
              {t.code}: {t.name}
            </option>
          ))}
        </select>
        <p className="mt-2 text-sm text-muted">{activeTemplate.description}</p>
      </div>

      <form onSubmit={handleSave} className="mt-6 space-y-5">
        <fieldset disabled={!canEdit} className="space-y-5 border-0 p-0 disabled:opacity-80">
        <div>
          <label htmlFor="tpl-subject" className="block text-sm font-medium">
            Asunto del correo
          </label>
          <input
            id="tpl-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 block min-h-12 w-full rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink"
          />
        </div>

        <div>
          <p className="text-sm font-medium text-ink">
            Etiquetas dinámicas disponibles (clic para insertar en el cuerpo)
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {activeTemplate.availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleInsertTag(tag)}
                className="btn btn--secondary"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="tpl-body" className="block text-sm font-medium">
              Cuerpo del mensaje (HTML con formato)
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => wrapSelectionWithHtml("<strong>", "</strong>")}
                className="riso-link text-sm font-medium"
              >
                Negrita
              </button>
              <button
                type="button"
                onClick={() => wrapSelectionWithHtml("<em>", "</em>")}
                className="riso-link text-sm font-medium"
              >
                Cursiva
              </button>
              <button
                type="button"
                onClick={() => wrapSelectionWithHtml("<p>", "</p>")}
                className="riso-link text-sm font-medium"
              >
                Párrafo
              </button>
            </div>
          </div>

          <textarea
            ref={bodyRef}
            id="tpl-body"
            rows={8}
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            className="mt-2 block w-full rounded-card border border-ink bg-paper p-3 text-sm text-ink"
          />
        </div>

        </fieldset>

        {canEdit && (
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={saving} className="btn btn--primary">
              {saving ? "Guardando..." : "Guardar plantilla"}
            </button>
            <button
              type="button"
              disabled={testing}
              onClick={handleSendTest}
              className="btn btn--secondary whitespace-nowrap"
            >
              {testing ? "Enviando prueba…" : "Enviar correo de prueba"}
            </button>
          </div>
        )}
      </form>

      {/* Vista previa renderizada con datos de ejemplo */}
      <div className="mt-10 border-t-2 border-ink pt-6">
        <h2>Vista previa en vivo</h2>
        <div className="mt-4 rounded-card border border-ink bg-paper-2 p-6">
          <p className="text-sm font-medium text-muted">Asunto:</p>
          <p className="mt-1 font-display text-lg font-extrabold text-ink">
            {preview.subject}
          </p>
          <div
            className="riso-prose mt-4 border-t border-rule pt-4"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(preview.htmlContent) }}
          />
        </div>
      </div>
    </section>
  );
}
