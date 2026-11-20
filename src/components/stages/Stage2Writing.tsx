"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  PenLine,
  Save,
} from "lucide-react";
import { parseVideoEmbedUrl } from "@/lib/prompt-bank";
import {
  MAX_STORY_TITLE_LENGTH,
  buildLocalDraftStorageKey,
  countStoryBodyChars,
  validateStage2StoryInput,
  type Stage2ExistingStorySnapshot,
  type Stage2ViewState,
} from "@/lib/stage2-writing";
import {
  formatCaracasDateTime,
  getRemainingTimeBreakdown,
  type CountdownBreakdown,
} from "@/lib/timezone";

export interface Stage2WritingProps {
  editionId: string;
  userId: string;
  minChars: number;
  maxChars: number;
  missesCount: number;
  maxAllowedMisses: number;
  viewState: Stage2ViewState;
  initialStory: Stage2ExistingStorySnapshot | null;
}

interface StoredLocalDraft {
  title: string;
  body: string;
  savedAt: string;
}

function useLiveCountdown(targetIso: string | null): CountdownBreakdown | null {
  const [countdown, setCountdown] = useState<CountdownBreakdown | null>(() =>
    targetIso ? getRemainingTimeBreakdown(targetIso) : null
  );

  useEffect(() => {
    if (!targetIso) {
      setCountdown(null);
      return;
    }
    const tick = () => setCountdown(getRemainingTimeBreakdown(targetIso));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [targetIso]);

  return countdown;
}

export function Stage2Writing({
  editionId,
  userId,
  minChars,
  maxChars,
  missesCount,
  maxAllowedMisses,
  viewState,
  initialStory,
}: Stage2WritingProps) {
  const openPrompt = viewState.kind === "OPEN_PROMPT" ? viewState.prompt : null;
  const countdownTargetIso =
    viewState.kind === "OPEN_PROMPT"
      ? viewState.prompt.closesAt
      : viewState.kind === "WAITING_NEXT_PROMPT"
        ? viewState.nextOpensAt
        : viewState.kind === "WAITING_SUBMISSION_STAGE"
          ? viewState.submissionStartAt
          : null;

  const countdown = useLiveCountdown(countdownTargetIso);

  const storageKey = openPrompt
    ? buildLocalDraftStorageKey(editionId, openPrompt.id, userId)
    : null;

  const [editorOpen, setEditorOpen] = useState<boolean>(false);
  const [title, setTitle] = useState<string>(initialStory?.originalTitle ?? "");
  const [body, setBody] = useState<string>(initialStory?.originalBody ?? "");
  const [lastSubmittedAt, setLastSubmittedAt] = useState<string | null>(
    initialStory?.submittedAt ?? null
  );
  const [localSavedAt, setLocalSavedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Restore local draft from localStorage if newer than the server copy
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredLocalDraft;
      if (typeof parsed.title !== "string" || typeof parsed.body !== "string") {
        return;
      }
      const serverTime = initialStory?.submittedAt
        ? Date.parse(initialStory.submittedAt)
        : 0;
      const localTime = parsed.savedAt ? Date.parse(parsed.savedAt) : 0;
      if (!initialStory || localTime > serverTime) {
        setTitle(parsed.title);
        setBody(parsed.body);
        setLocalSavedAt(parsed.savedAt);
      }
    } catch {
      // Ignore malformed localStorage entries
    }
  }, [storageKey, initialStory]);

  // Auto-save to localStorage while writing
  useEffect(() => {
    if (!storageKey || !editorOpen) return;
    const savedAt = new Date().toISOString();
    const payload: StoredLocalDraft = { title, body, savedAt };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
      setLocalSavedAt(savedAt);
    } catch {
      // Storage quota or private mode fallback
    }
  }, [storageKey, editorOpen, title, body]);

  const validation = useMemo(
    () => validateStage2StoryInput({ title, body, minChars, maxChars }),
    [title, body, minChars, maxChars]
  );

  const charCount = countStoryBodyChars(body);

  if (viewState.kind === "DISQUALIFIED") {
    return (
      <section className="rounded-card border border-error bg-paper-2 p-8">
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="mt-1 h-5 w-5 shrink-0 text-error"
            aria-hidden="true"
          />
          <div>
            <h2>Participación descalificada</h2>
            <p className="lead mt-3 text-ink-2">{viewState.reasonLabel}</p>
            <p className="mt-4 text-sm text-ink-2">
              Agradecemos tu participación en esta edición. Podrás leer los
              cuentos ganadores cuando se anuncien los resultados finales.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (viewState.kind === "WAITING_NEXT_PROMPT") {
    return (
      <section className="rounded-card border border-ink bg-paper-2 p-8">
        <div className="flex items-center gap-2 text-ink-2">
          <Clock className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm font-medium">
            Consigna {viewState.nextPromptNumber} en camino
          </span>
        </div>
        <h2 className="mt-3">Próxima consigna en…</h2>
        <p className="mt-4 font-display text-4xl font-extrabold text-ink num">
          {countdown ? countdown.formatted : "Calculando…"}
        </p>
        <p className="mt-4 text-sm text-ink-2 num">
          Apertura programada:{" "}
          <strong>{formatCaracasDateTime(viewState.nextOpensAt)}</strong>.
        </p>
        <p className="mt-2 text-xs text-muted">
          Durante la etapa de escritura solo permanece visible la consigna
          abierta en curso. Tus cuentos enviados volverán a aparecer al iniciar
          la etapa de selección y edición.
        </p>
      </section>
    );
  }

  if (viewState.kind === "WAITING_SUBMISSION_STAGE") {
    return (
      <section className="rounded-card border border-ink bg-paper-2 p-8">
        <div className="flex items-center gap-2 text-ink-2">
          <Clock className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm font-medium">Etapa de escritura cerrada</span>
        </div>
        <h2 className="mt-3">
          El período de recepción de cuentos ha terminado, inicio de la etapa de
          selección en…
        </h2>
        <p className="mt-4 font-display text-4xl font-extrabold text-ink num">
          {countdown ? countdown.formatted : "Calculando…"}
        </p>
        <p className="mt-4 text-sm text-ink-2 num">
          Inicio de postulación y edición:{" "}
          <strong>{formatCaracasDateTime(viewState.submissionStartAt)}</strong>.
        </p>
      </section>
    );
  }

  const prompt = viewState.prompt;
  const videoEmbedUrl =
    prompt.mediaType === "VIDEO" && prompt.mediaUrl
      ? parseVideoEmbedUrl(prompt.mediaUrl)
      : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!validation.valid) {
      setErrorMessage(
        validation.errors[0] ?? "Revisa los campos antes de enviar."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/contest/stories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          promptId: prompt.id,
          title,
          body,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        submittedAt?: string;
        updatedExisting?: boolean;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setErrorMessage(
          data.error ?? "No se pudo guardar tu cuento. Inténtalo de nuevo."
        );
        return;
      }

      const savedTime = data.submittedAt ?? new Date().toISOString();
      setLastSubmittedAt(savedTime);
      setSuccessMessage(
        data.updatedExisting
          ? "Tu cuento fue actualizado correctamente. Puedes seguir editándolo hasta el cierre de la consigna."
          : "Tu cuento fue enviado correctamente. Puedes volver a editarlo cuantas veces necesites antes del cierre."
      );
      if (storageKey) {
        try {
          window.localStorage.removeItem(storageKey);
          setLocalSavedAt(null);
        } catch {
          // Ignore
        }
      }
    } catch {
      setErrorMessage("Error de conexión al enviar tu cuento.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-card border border-ink bg-paper p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-rule pb-4">
          <div>
            <p className="text-sm font-semibold text-accent-2">
              Consigna {prompt.promptNumber}
            </p>
            <h2 className="mt-1">{prompt.title}</h2>
          </div>
          <div className="text-right text-xs text-ink-2 num">
            <p>
              Cierra: <strong>{formatCaracasDateTime(prompt.closesAt)}</strong>
            </p>
            <p className="mt-1 text-muted">
              Fallas registradas: {missesCount} / {maxAllowedMisses}
            </p>
          </div>
        </div>

        {countdown?.isUnderOneHour && !countdown.expired && (
          <div
            role="status"
            className="mt-6 flex items-center gap-3 border-l-2 border-error py-1 pl-4 text-sm font-semibold text-error num"
          >
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Queda menos de una hora para el cierre: {countdown.formatted}
            </span>
          </div>
        )}

        <div className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-ink">
          {prompt.body}
        </div>

        {prompt.mediaType === "IMAGE" && prompt.mediaUrl && (
          <figure className="mt-6">
            <img
              src={prompt.mediaUrl}
              alt={`Imagen de apoyo para la consigna ${prompt.promptNumber}`}
              className="max-h-96 w-auto border border-rule object-contain"
            />
          </figure>
        )}

        {videoEmbedUrl && (
          <div className="mt-6 aspect-video w-full max-w-2xl overflow-hidden border border-rule">
            <iframe
              src={videoEmbedUrl}
              title={`Video de la consigna ${prompt.promptNumber}`}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {lastSubmittedAt && (
          <div className="mt-6 flex items-center gap-2 border-l-2 border-success py-1 pl-4 text-sm text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="num">
              Último envío registrado el{" "}
              {formatCaracasDateTime(lastSubmittedAt)}.
            </span>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => {
              setEditorOpen((prev) => !prev);
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className="btn btn--primary"
          >
            <PenLine className="mr-2 inline h-4 w-4" aria-hidden="true" />
            {editorOpen
              ? "Ocultar editor"
              : lastSubmittedAt
                ? "Editar mi cuento"
                : "Escribir / Postular"}
          </button>
          <span className="text-xs text-muted num">
            Extensión requerida: {minChars} a {maxChars} caracteres (incluyendo
            espacios).
          </span>
        </div>
      </section>

      {editorOpen && (
        <section className="rounded-card border border-ink bg-paper-2 p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3>Tu cuento para la consigna {prompt.promptNumber}</h3>
            {localSavedAt && (
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                Borrador guardado localmente
              </span>
            )}
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mt-4 border-l-2 border-error py-1 pl-4 text-sm text-error"
            >
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              className="mt-4 border-l-2 border-success py-1 pl-4 text-sm text-success"
            >
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-6" noValidate>
            <div>
              <label
                htmlFor="story-title"
                className="block text-sm font-semibold text-ink"
              >
                Título del cuento
              </label>
              <input
                id="story-title"
                type="text"
                maxLength={MAX_STORY_TITLE_LENGTH}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Escribe el título de tu cuento"
                className="mt-2 w-full rounded-input border border-ink bg-paper px-3 py-2 text-base text-ink"
                required
              />
              <p className="mt-1 text-xs text-muted num">
                {title.trim().length} / {MAX_STORY_TITLE_LENGTH} caracteres
              </p>
            </div>

            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <label
                  htmlFor="story-body"
                  className="block text-sm font-semibold text-ink"
                >
                  Cuerpo del cuento (texto plano)
                </label>
                <span
                  className={`text-sm font-semibold num ${
                    charCount < minChars || charCount > maxChars
                      ? "text-error"
                      : "text-success"
                  }`}
                >
                  {charCount} caracteres (mín. {minChars} / máx. {maxChars})
                </span>
              </div>
              <textarea
                id="story-body"
                rows={14}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Escribe aquí tu historia…"
                className="mt-2 w-full rounded-input border border-ink bg-paper px-3 py-3 text-base leading-relaxed text-ink"
                required
              />
              {charCount > 0 && charCount < minChars && (
                <p className="mt-1 text-xs text-error num">
                  Te faltan {minChars - charCount} caracteres para alcanzar el
                  mínimo permitido.
                </p>
              )}
              {charCount > maxChars && (
                <p className="mt-1 text-xs text-error num">
                  Excedes el máximo permitido por {charCount - maxChars}{" "}
                  caracteres.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={
                  submitting || !validation.valid || Boolean(countdown?.expired)
                }
                className="btn btn--primary"
              >
                {submitting
                  ? "Guardando…"
                  : lastSubmittedAt
                    ? "Guardar nueva versión"
                    : "Enviar cuento"}
              </button>
              <span className="text-xs text-muted">
                Solo se conservará la última versión enviada antes del cierre.
              </span>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
