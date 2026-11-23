"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { MediaType } from "@/db/schema";
import {
  parseVideoEmbedUrl,
  validatePromptBankInput,
  type PromptVoteValue,
} from "@/lib/prompt-bank";

interface PromptCommentItem {
  id: string;
  authorName: string;
  commentText: string;
  createdAt: string;
}

interface PromptBankItem {
  id: string;
  authorId: string;
  authorName: string;
  canEdit: boolean;
  title: string;
  body: string;
  mediaType: MediaType | null;
  mediaUrl: string | null;
  likes: number;
  dislikes: number;
  currentAdminVote: PromptVoteValue | 0;
  comments: PromptCommentItem[];
}

export default function AdminPromptBankPage() {
  const [prompts, setPrompts] = useState<PromptBankItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaType, setMediaType] = useState<MediaType | "">("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
    {}
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function loadPrompts() {
    try {
      const res = await fetch("/api/admin/banco-consignas");
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok: boolean;
        prompts?: PromptBankItem[];
      };
      if (data.ok && data.prompts) {
        setPrompts(data.prompts);
      }
    } catch {
      // Ignore offline preview fetch
    }
  }

  useEffect(() => {
    void loadPrompts();
  }, []);

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/prompt-image", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as {
        ok: boolean;
        imageUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "No se pudo subir la imagen.");
        return;
      }
      setMediaType("IMAGE");
      setMediaUrl(data.imageUrl ?? "");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setFeedback(null);

    const normalizedMediaType: MediaType | null =
      mediaType === "IMAGE" || mediaType === "VIDEO" ? mediaType : null;

    const validation = validatePromptBankInput({
      title,
      body,
      mediaType: normalizedMediaType,
      mediaUrl: normalizedMediaType ? mediaUrl : null,
    });

    if (!validation.valid) {
      setErrorMessage(validation.error ?? "Datos inválidos.");
      return;
    }

    setSaving(true);
    try {
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch("/api/admin/banco-consignas", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { promptId: editingId } : {}),
          title,
          body,
          mediaType: normalizedMediaType,
          mediaUrl: normalizedMediaType ? mediaUrl : null,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "No se pudo guardar la consigna.");
        return;
      }

      setFeedback(
        editingId
          ? "Consigna actualizada. Sus votos anónimos se reiniciaron a cero."
          : "Consigna propuesta publicada en el banco colaborativo."
      );
      setEditingId(null);
      setTitle("");
      setBody("");
      setMediaType("");
      setMediaUrl("");
      await loadPrompts();
    } finally {
      setSaving(false);
    }
  }

  function startEditing(item: PromptBankItem) {
    setEditingId(item.id);
    setTitle(item.title);
    setBody(item.body);
    setMediaType(item.mediaType ?? "");
    setMediaUrl(item.mediaUrl ?? "");
    setFeedback(null);
    setErrorMessage(null);
  }

  async function handleVote(promptBankId: string, voteValue: PromptVoteValue) {
    setErrorMessage(null);
    const res = await fetch("/api/admin/banco-consignas/vote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ promptBankId, voteValue }),
    });
    if (res.ok) {
      await loadPrompts();
    }
  }

  async function handleCommentSubmit(
    event: FormEvent<HTMLFormElement>,
    promptBankId: string
  ) {
    event.preventDefault();
    const commentText = (commentDrafts[promptBankId] ?? "").trim();
    if (!commentText) return;

    const res = await fetch("/api/admin/banco-consignas/comment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ promptBankId, commentText }),
    });
    if (res.ok) {
      setCommentDrafts((prev) => ({ ...prev, [promptBankId]: "" }));
      await loadPrompts();
    }
  }

  const videoPreviewUrl =
    mediaType === "VIDEO" ? parseVideoEmbedUrl(mediaUrl) : null;

  return (
    <section className="border-t-2 border-ink pt-6">
      <h1>Banco colaborativo de consignas</h1>
      <p className="lead mt-3 text-ink-2">
        Propón consignas futuras con texto y multimedia opcional. Los votos con
        pulgar arriba o abajo son anónimos; editar una propuesta reinicia sus
        votos a cero.
      </p>

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

      {/* Formulario de propuesta / edición */}
      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-4 border-t border-rule pt-6"
        noValidate
      >
        <h2>{editingId ? "Editar consigna propuesta" : "Proponer nueva consigna"}</h2>
        {editingId && (
          <p className="text-sm text-muted">
            Aviso: al guardar cambios en esta consigna, sus votos anónimos
            volverán a cero.
          </p>
        )}

        <div>
          <label htmlFor="pb-title" className="block text-sm font-medium">
            Título de la consigna (máx. 150 caracteres)
          </label>
          <input
            id="pb-title"
            type="text"
            maxLength={150}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block min-h-12 w-full rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink"
          />
        </div>

        <div>
          <label htmlFor="pb-body" className="block text-sm font-medium">
            Texto de la consigna
          </label>
          <textarea
            id="pb-body"
            rows={14}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1 block min-h-96 w-full resize-y rounded-card border border-ink bg-paper p-3 text-sm leading-relaxed text-ink"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pb-media-type" className="block text-sm font-medium">
              Multimedia opcional
            </label>
            <select
              id="pb-media-type"
              value={mediaType}
              onChange={(e) => {
                setMediaType(e.target.value as MediaType | "");
                setMediaUrl("");
              }}
              className="mt-1 block min-h-12 w-full rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink"
            >
              <option value="">Sin multimedia (solo texto)</option>
              <option value="IMAGE">Imagen (JPG, PNG o WEBP, máx. 5 MB)</option>
              <option value="VIDEO">Video incrustado (YouTube o Vimeo)</option>
            </select>
          </div>

          {mediaType === "VIDEO" && (
            <div>
              <label htmlFor="pb-video-url" className="block text-sm font-medium">
                Enlace de YouTube o Vimeo
              </label>
              <input
                id="pb-video-url"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                className="mt-1 block min-h-12 w-full rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink"
              />
            </div>
          )}

          {mediaType === "IMAGE" && (
            <div>
              <label htmlFor="pb-image-file" className="block text-sm font-medium">
                Subir imagen de consigna
              </label>
              <input
                id="pb-image-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageUpload}
                disabled={uploading}
                className="mt-2 block text-sm text-ink"
              />
            </div>
          )}
        </div>

        {videoPreviewUrl && (
          <div className="max-w-md border border-ink">
            <iframe
              src={videoPreviewUrl}
              title="Vista previa del video de consigna"
              className="aspect-video w-full"
              allowFullScreen
            />
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className="btn btn--primary">
            {saving
              ? "Guardando..."
              : editingId
                ? "Guardar cambios y reiniciar votos"
                : "Publicar propuesta"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setTitle("");
                setBody("");
                setMediaType("");
                setMediaUrl("");
              }}
              className="btn btn--secondary"
            >
              Cancelar edición
            </button>
          )}
        </div>
      </form>

      {/* Lista de propuestas disponibles */}
      <div className="mt-12 border-t-2 border-ink pt-6">
        <h2>Consignas disponibles en el banco ({prompts.length})</h2>

        <div className="mt-6 space-y-8">
          {prompts.length === 0 ? (
            <p className="text-sm text-muted">
              Aún no hay consignas propuestas disponibles en el banco.
            </p>
          ) : (
            prompts.map((item) => (
              <article
                key={item.id}
                className="border-t border-rule pt-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3>{item.title}</h3>
                    <p className="mt-1 text-sm text-muted">
                      Propuesta por {item.authorName}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleVote(item.id, 1)}
                      aria-label={`Me gusta (${item.likes})`}
                      className={`btn ${
                        item.currentAdminVote === 1
                          ? "btn--primary"
                          : "btn--secondary"
                      }`}
                    >
                      <ThumbsUp className="mr-2 h-4 w-4" aria-hidden="true" />
                      <span className="num">{item.likes}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleVote(item.id, -1)}
                      aria-label={`No me gusta (${item.dislikes})`}
                      className={`btn ${
                        item.currentAdminVote === -1
                          ? "btn--primary"
                          : "btn--secondary"
                      }`}
                    >
                      <ThumbsDown className="mr-2 h-4 w-4" aria-hidden="true" />
                      <span className="num">{item.dislikes}</span>
                    </button>

                    {item.canEdit && (
                      <button
                        type="button"
                        onClick={() => startEditing(item)}
                        className="btn btn--secondary"
                      >
                        Editar
                      </button>
                    )}
                  </div>
                </div>

                <p className="mt-4 whitespace-pre-line text-ink-2">
                  {item.body}
                </p>

                {item.mediaType === "IMAGE" && item.mediaUrl && (
                  <div className="mt-4 max-w-md border border-ink">
                    <img
                      src={item.mediaUrl}
                      alt={item.title}
                      className="w-full"
                    />
                  </div>
                )}

                {item.mediaType === "VIDEO" && item.mediaUrl && (
                  <div className="mt-4 max-w-md border border-ink">
                    <iframe
                      src={item.mediaUrl}
                      title={item.title}
                      className="aspect-video w-full"
                      allowFullScreen
                    />
                  </div>
                )}

                {/* Comentarios visibles */}
                <div className="mt-6 border-t border-rule pt-4">
                  <p className="text-sm font-medium text-ink">
                    Comentarios ({item.comments.length})
                  </p>
                  <div className="mt-3 space-y-2">
                    {item.comments.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-card bg-paper-2 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-ink">
                          {c.authorName}:{" "}
                        </span>
                        <span className="text-ink-2">{c.commentText}</span>
                      </div>
                    ))}
                  </div>

                  <form
                    onSubmit={(e) => handleCommentSubmit(e, item.id)}
                    className="mt-3 flex flex-wrap gap-3"
                  >
                    <input
                      type="text"
                      value={commentDrafts[item.id] ?? ""}
                      onChange={(e) =>
                        setCommentDrafts((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      placeholder="Añadir un comentario sobre esta consigna..."
                      className="min-h-12 flex-1 rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink"
                    />
                    <button type="submit" className="btn btn--secondary">
                      Comentar
                    </button>
                  </form>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
