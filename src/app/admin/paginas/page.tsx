"use client";

import { useEffect, useState, type FormEvent } from "react";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { DEFAULT_SITE_PAGES } from "@/db/seed";
import type { PublicPageSlug, ResolvedSitePage } from "@/lib/public-pages";
import { sanitizeHtml } from "@/lib/security";

const INITIAL_PAGES: ResolvedSitePage[] = DEFAULT_SITE_PAGES.map((p) => ({
  slug: p.slug,
  title: p.title,
  contentHtml: p.contentHtml,
  updatedAt: null,
  fromDatabase: false,
}));

export default function AdminSitePagesEditorPage() {
  const [pages, setPages] = useState<ResolvedSitePage[]>(INITIAL_PAGES);
  const [selectedSlug, setSelectedSlug] =
    useState<PublicPageSlug>("bases-del-concurso");
  const [title, setTitle] = useState(INITIAL_PAGES[0].title);
  const [contentHtml, setContentHtml] = useState(INITIAL_PAGES[0].contentHtml);
  const [canEdit, setCanEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadPages() {
      try {
        const res = await fetch("/api/admin/paginas");
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok: boolean;
          canEdit?: boolean;
          pages?: ResolvedSitePage[];
        };
        if (data.ok && data.pages && data.pages.length > 0) {
          setCanEdit(Boolean(data.canEdit));
          setPages(data.pages);
          setSelectedSlug(data.pages[0].slug);
          setTitle(data.pages[0].title);
          setContentHtml(data.pages[0].contentHtml);
        }
      } catch {
        // Keeps default seed fallback in offline preview
      }
    }
    void loadPages();
  }, []);

  function handleSelectPage(slug: PublicPageSlug) {
    const found = pages.find((p) => p.slug === slug);
    if (!found) return;
    setSelectedSlug(found.slug);
    setTitle(found.title);
    setContentHtml(found.contentHtml);
    setFeedback(null);
    setErrorMessage(null);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setFeedback(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/paginas", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: selectedSlug,
          title,
          contentHtml,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "No se pudo guardar la página.");
        return;
      }

      setPages((prev) =>
        prev.map((p) =>
          p.slug === selectedSlug
            ? { ...p, title, contentHtml, fromDatabase: true }
            : p
        )
      );
      setFeedback("Página pública actualizada correctamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border-t-2 border-ink pt-6">
      <h1>Editor de páginas públicas</h1>
      <p className="lead mt-3 text-ink-2">
        Actualiza el contenido oficial de las Bases del Concurso y la historia
        del club en ¿Quiénes somos?.
      </p>

      {!canEdit && (
        <div
          role="status"
          className="mt-6 rounded-card border border-rule bg-accent-soft px-4 py-3 text-sm text-ink-2"
        >
          Modo solo lectura: puedes revisar el contenido de las páginas
          públicas, pero solo el superadministrador puede guardar cambios.
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

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => handleSelectPage("bases-del-concurso")}
          className={`btn ${
            selectedSlug === "bases-del-concurso"
              ? "btn--primary"
              : "btn--secondary"
          }`}
        >
          Bases del Concurso
        </button>
        <button
          type="button"
          onClick={() => handleSelectPage("quienes-somos")}
          className={`btn ${
            selectedSlug === "quienes-somos"
              ? "btn--primary"
              : "btn--secondary"
          }`}
        >
          ¿Quiénes somos?
        </button>
        <a
          href={`/${selectedSlug}`}
          target="_blank"
          rel="noreferrer"
          className="riso-link text-sm font-medium"
        >
          Ver página pública
        </a>
      </div>

      <form onSubmit={handleSave} className="mt-8 space-y-5">
        <fieldset disabled={!canEdit} className="space-y-5 border-0 p-0 disabled:opacity-80">
        <div>
          <label htmlFor="page-title" className="block text-sm font-medium">
            Título de la página
          </label>
          <input
            id="page-title"
            type="text"
            maxLength={150}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block min-h-12 w-full rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink"
          />
        </div>

        <RichTextEditor
          id="page-content"
          label="Contenido de la página"
          contentKey={selectedSlug}
          value={contentHtml}
          onChange={setContentHtml}
          readOnly={!canEdit}
          minHeightClass="min-h-72"
        />

        </fieldset>

        {canEdit && (
          <button type="submit" disabled={saving} className="btn btn--primary">
            {saving ? "Guardando página…" : "Guardar cambios"}
          </button>
        )}
      </form>

      <div className="mt-10 border-t-2 border-ink pt-6">
        <h2>Vista previa</h2>
        <article className="mt-4 rounded-card border border-ink bg-paper p-6">
          <p className="font-display text-2xl font-extrabold text-ink">
            {title}
          </p>
          <div
            className="riso-prose mt-4"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(contentHtml) }}
          />
        </article>
      </div>
    </section>
  );
}
