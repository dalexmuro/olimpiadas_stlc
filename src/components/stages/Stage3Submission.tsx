"use client";

import { useMemo, useState, type FormEvent } from "react";
import { BookOpen, CheckCircle2, FileText } from "lucide-react";
import type { DisqualificationReason, EnrollmentStatus } from "@/db/schema";
import {
  validateStage3EditInput,
  type Stage3StoryItem,
} from "@/lib/stage3-submission";
import { formatCaracasDateTime } from "@/lib/timezone";
import { DisqualifiedNotice } from "./DisqualifiedNotice";
import { PromptViewerModal } from "./PromptViewerModal";
import { Stage3StoryEditor } from "./Stage3StoryEditor";
import { Stage3StoryReader } from "./Stage3StoryReader";

export interface Stage3SubmissionProps {
  enrollmentStatus: EnrollmentStatus;
  disqualificationReason: DisqualificationReason | null;
  initialSelectedStoryId: string | null;
  minChars: number;
  maxChars: number;
  minSimilarityPct: number;
  submissionEndAt: string;
  stories: Stage3StoryItem[];
}

export function Stage3Submission({
  enrollmentStatus,
  disqualificationReason,
  initialSelectedStoryId,
  minChars,
  maxChars,
  minSimilarityPct,
  submissionEndAt,
  stories: initialStories,
}: Stage3SubmissionProps) {
  const [stories, setStories] = useState<Stage3StoryItem[]>(initialStories);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(
    initialSelectedStoryId
  );
  const [readingIndex, setReadingIndex] = useState<number | null>(null);
  const [promptModalStory, setPromptModalStory] =
    useState<Stage3StoryItem | null>(null);
  const [confirmSelectStory, setConfirmSelectStory] =
    useState<Stage3StoryItem | null>(null);
  const [confirmPostulateOpen, setConfirmPostulateOpen] = useState(false);

  const selectedStory = useMemo(
    () => stories.find((s) => s.id === selectedStoryId) ?? null,
    [stories, selectedStoryId]
  );

  const [editTitle, setEditTitle] = useState<string>(
    selectedStory?.editedTitle ?? selectedStory?.originalTitle ?? ""
  );
  const [editBody, setEditBody] = useState<string>(
    selectedStory?.editedBody ?? selectedStory?.originalBody ?? ""
  );
  const [busyAction, setBusyAction] = useState<
    "select" | "save_draft" | "postulate" | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const editValidation = useMemo(() => {
    if (!selectedStory) return null;
    return validateStage3EditInput({
      title: editTitle,
      body: editBody,
      originalBody: selectedStory.originalBody,
      minChars,
      maxChars,
      minSimilarityPct,
    });
  }, [selectedStory, editTitle, editBody, minChars, maxChars, minSimilarityPct]);

  if (enrollmentStatus === "DISQUALIFIED") {
    return <DisqualifiedNotice reason={disqualificationReason} />;
  }

  async function handleConfirmSelect(story: Stage3StoryItem) {
    setBusyAction("select");
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/contest/submission", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "select", storyId: story.id }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErrorMessage(
          data.error ?? "No se pudo seleccionar el cuento. Inténtalo de nuevo."
        );
        return;
      }

      setStories((prev) =>
        prev.map((item) =>
          item.id === story.id
            ? {
                ...item,
                isSelectedForPostulation: true,
                editedTitle: item.originalTitle,
                editedBody: item.originalBody,
                editedCharCount: item.originalCharCount,
                similarityPct: 100,
              }
            : item
        )
      );
      setSelectedStoryId(story.id);
      setEditTitle(story.originalTitle);
      setEditBody(story.originalBody);
      setReadingIndex(null);
      setConfirmSelectStory(null);
      setSuccessMessage(
        "Cuento seleccionado. Ahora puedes editarlo antes de postularlo definitivamente."
      );
    } catch {
      setErrorMessage("Error de conexión al seleccionar el cuento.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStory || !editValidation?.valid) return;
    setBusyAction("save_draft");
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/contest/submission", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save_draft",
          storyId: selectedStory.id,
          title: editTitle,
          body: editBody,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        charCount?: number;
        similarityPct?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "No se pudo guardar el borrador.");
        return;
      }

      setStories((prev) =>
        prev.map((item) =>
          item.id === selectedStory.id
            ? {
                ...item,
                editedTitle: editTitle.trim(),
                editedBody: editBody,
                editedCharCount: data.charCount ?? editBody.length,
                similarityPct: data.similarityPct ?? editValidation.similarityPct,
              }
            : item
        )
      );
      setSuccessMessage(
        "Borrador guardado. Recuerda presionar 'Postular definitivamente' cuando estés listo."
      );
    } catch {
      setErrorMessage("Error de conexión al guardar el borrador.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleConfirmPostulate() {
    if (!selectedStory || !editValidation?.valid) return;
    setBusyAction("postulate");
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/contest/submission", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "postulate",
          storyId: selectedStory.id,
          title: editTitle,
          body: editBody,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        postulatedAt?: string;
        similarityPct?: number;
        charCount?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "No se pudo completar la postulación.");
        return;
      }

      const postulatedAt = data.postulatedAt ?? new Date().toISOString();
      setStories((prev) =>
        prev.map((item) =>
          item.id === selectedStory.id
            ? {
                ...item,
                editedTitle: editTitle.trim(),
                editedBody: editBody,
                editedCharCount: data.charCount ?? editBody.length,
                similarityPct: data.similarityPct ?? editValidation.similarityPct,
                isPostulated: true,
                postulatedAt,
              }
            : item
        )
      );
      setConfirmPostulateOpen(false);
    } catch {
      setErrorMessage("Error de conexión al postular tu cuento.");
    } finally {
      setBusyAction(null);
    }
  }

  if (selectedStory?.isPostulated) {
    return (
      <div className="space-y-6">
        <section className="rounded-card border border-ink bg-paper-2 p-8">
          <div className="flex items-start gap-3">
            <CheckCircle2
              className="mt-1 h-5 w-5 shrink-0 text-success"
              aria-hidden="true"
            />
            <div>
              <h2>Cuento postulado definitivamente</h2>
              <p className="lead mt-3 text-ink-2">
                Tu cuento{" "}
                <strong>
                  {selectedStory.editedTitle ?? selectedStory.originalTitle}
                </strong>{" "}
                (Consigna {selectedStory.promptNumber}) fue postulado con éxito.
              </p>
              {selectedStory.postulatedAt && (
                <p className="mt-3 text-sm text-ink-2 num">
                  Fecha de postulación:{" "}
                  <strong>
                    {formatCaracasDateTime(selectedStory.postulatedAt)}
                  </strong>
                  .
                </p>
              )}
              <p className="mt-3 text-sm text-muted">
                Hemos enviado un correo de confirmación. Tu obra pasará a la
                etapa de revisión de los administradores al cerrar esta fase.
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setPromptModalStory(selectedStory)}
                  className="btn btn--secondary"
                >
                  <FileText className="mr-2 inline h-4 w-4" aria-hidden="true" />
                  Ver consigna completa
                </button>
              </div>
            </div>
          </div>
        </section>

        {promptModalStory && (
          <PromptViewerModal
            prompt={promptModalStory}
            onClose={() => setPromptModalStory(null)}
          />
        )}
      </div>
    );
  }

  const readingStory =
    readingIndex !== null ? (stories[readingIndex] ?? null) : null;

  return (
    <div className="space-y-6">
      <div
        role="status"
        className="border-l-4 border-accent bg-paper-2 px-5 py-4 text-sm font-medium text-ink"
      >
        Recuerda que esta etapa no ha sido completada hasta que selecciones
        &apos;Postular definitivamente&apos;. Cierre de la etapa:{" "}
        <strong className="num">{formatCaracasDateTime(submissionEndAt)}</strong>.
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="border-l-2 border-error py-1 pl-4 text-sm text-error"
        >
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="border-l-2 border-success py-1 pl-4 text-sm text-success"
        >
          {successMessage}
        </div>
      )}

      {!selectedStory && !readingStory && (
        <section className="rounded-card border border-ink bg-paper p-8">
          <h2>Tus cuentos de la etapa de escritura</h2>
          <p className="lead mt-2 text-ink-2">
            Lee con calma los cuentos que entregaste y elige el único que
            deseas editar y postular para las votaciones.
          </p>

          {stories.length === 0 ? (
            <p className="mt-6 text-sm text-error">
              No se encontraron cuentos entregados en la etapa anterior.
            </p>
          ) : (
            <ul className="mt-6 divide-y divide-rule border-y border-rule">
              {stories.map((story, idx) => (
                <li
                  key={story.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                >
                  <div>
                    <p className="text-xs font-semibold text-accent-2">
                      Consigna {story.promptNumber}
                    </p>
                    <p className="mt-1 font-display text-lg font-extrabold text-ink">
                      {story.originalTitle}
                    </p>
                    <p className="mt-1 text-xs text-muted num">
                      {story.originalCharCount} caracteres
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReadingIndex(idx)}
                    className="btn btn--secondary"
                  >
                    <BookOpen className="mr-2 inline h-4 w-4" aria-hidden="true" />
                    Leer cuento
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!selectedStory && readingStory && readingIndex !== null && (
        <Stage3StoryReader
          story={readingStory}
          readingIndex={readingIndex}
          totalStories={stories.length}
          onBackToList={() => setReadingIndex(null)}
          onPrev={() => setReadingIndex((i) => (i !== null ? i - 1 : 0))}
          onNext={() =>
            setReadingIndex((i) =>
              i !== null ? Math.min(stories.length - 1, i + 1) : 0
            )
          }
          onOpenPrompt={setPromptModalStory}
          onRequestSelect={setConfirmSelectStory}
        />
      )}

      {selectedStory && editValidation && (
        <Stage3StoryEditor
          story={selectedStory}
          editTitle={editTitle}
          editBody={editBody}
          minChars={minChars}
          maxChars={maxChars}
          minSimilarityPct={minSimilarityPct}
          validation={editValidation}
          busyAction={busyAction}
          onTitleChange={setEditTitle}
          onBodyChange={setEditBody}
          onSaveDraft={handleSaveDraft}
          onOpenPrompt={setPromptModalStory}
          onOpenConfirmPostulate={() => setConfirmPostulateOpen(true)}
        />
      )}

      {promptModalStory && (
        <PromptViewerModal
          prompt={promptModalStory}
          onClose={() => setPromptModalStory(null)}
        />
      )}

      {confirmSelectStory && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-select-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
        >
          <div className="w-full max-w-lg rounded-card border-2 border-ink bg-paper p-6">
            <h3 id="confirm-select-title">Confirmar selección irreversible</h3>
            <p className="mt-3 text-sm text-ink-2">
              Vas a seleccionar{" "}
              <strong>{confirmSelectStory.originalTitle}</strong> (Consigna{" "}
              {confirmSelectStory.promptNumber}) para editar y postular. Una vez
              confirmado, no podrás cambiarlo por otro cuento.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={busyAction === "select"}
                onClick={() => setConfirmSelectStory(null)}
                className="btn btn--secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busyAction === "select"}
                onClick={() => handleConfirmSelect(confirmSelectStory)}
                className="btn btn--primary"
              >
                {busyAction === "select"
                  ? "Confirmando…"
                  : "Sí, seleccionar este cuento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmPostulateOpen && selectedStory && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-postulate-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
        >
          <div className="w-full max-w-lg rounded-card border-2 border-ink bg-paper p-6">
            <h3 id="confirm-postulate-title">
              Confirmar postulación definitiva
            </h3>
            <p className="mt-3 text-sm text-ink-2">
              Al confirmar, tu cuento <strong>{editTitle.trim()}</strong>{" "}
              quedará postulado de forma definitiva y no podrás volver a
              editarlo.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={busyAction === "postulate"}
                onClick={() => setConfirmPostulateOpen(false)}
                className="btn btn--secondary"
              >
                Seguir editando
              </button>
              <button
                type="button"
                disabled={busyAction === "postulate"}
                onClick={handleConfirmPostulate}
                className="btn btn--primary"
              >
                {busyAction === "postulate"
                  ? "Postulando…"
                  : "Confirmar postulación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
