"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { FilePlus2, RotateCcw, UserX, Users, X } from "lucide-react";
import {
  MAX_STORY_TITLE_LENGTH,
  countStoryBodyChars,
} from "@/lib/stage2-writing";

interface ParticipantRow {
  enrollmentId: string;
  userId: string;
  fullName: string;
  email: string;
  status: "ACTIVE" | "DISQUALIFIED";
  disqualificationReason: string | null;
  missesCount: number;
  storiesCount: number;
  hasPostulated: boolean;
  hasVoted: boolean;
}

interface PromptOption {
  id: string;
  promptNumber: number;
  title: string;
}

interface EditionLimits {
  id: string;
  title: string;
  minChars: number;
  maxChars: number;
  maxAllowedMisses: number;
}

type ModalMode =
  | { kind: "disqualify"; participant: ParticipantRow }
  | { kind: "reinstate"; participant: ParticipantRow }
  | { kind: "late_story"; participant: ParticipantRow }
  | null;

export default function AdminParticipantesPage() {
  const [edition, setEdition] = useState<EditionLimits | null>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [prompts, setPrompts] = useState<PromptOption[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalMode>(null);

  const [justification, setJustification] = useState("");
  const [promptId, setPromptId] = useState("");
  const [storyTitle, setStoryTitle] = useState("");
  const [storyBody, setStoryBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/admin/participantes");
      const json = (await res.json()) as {
        ok: boolean;
        edition?: EditionLimits | null;
        participants?: ParticipantRow[];
        prompts?: PromptOption[];
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setErrorMessage(json.error ?? "No se pudieron cargar los participantes.");
        return;
      }
      setEdition(json.edition ?? null);
      setParticipants(json.participants ?? []);
      setPrompts(json.prompts ?? []);
      const firstPromptId = json.prompts?.[0]?.id;
      if (firstPromptId) {
        setPromptId((prev) => prev || firstPromptId);
      }
    } catch {
      setErrorMessage("Error de conexión al cargar participantes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q)
    );
  }, [participants, query]);

  function openModal(next: ModalMode) {
    setModal(next);
    setJustification("");
    setStoryTitle("");
    setStoryBody("");
    setErrorMessage(null);
    setFeedbackMessage(null);
  }

  async function handleModalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    setBusy(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const payload =
        modal.kind === "late_story"
          ? {
              action: "late_story",
              enrollmentId: modal.participant.enrollmentId,
              promptId,
              title: storyTitle,
              body: storyBody,
              justification,
            }
          : {
              action: modal.kind,
              enrollmentId: modal.participant.enrollmentId,
              justification,
            };

      const res = await fetch("/api/admin/participantes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        ok: boolean;
        autoReactivated?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setErrorMessage(json.error ?? "No se pudo ejecutar la intervención.");
        return;
      }

      if (modal.kind === "disqualify") {
        setFeedbackMessage(
          "Participante descalificado manualmente y correo E18 enviado."
        );
      } else if (modal.kind === "reinstate") {
        setFeedbackMessage(
          "Participante reincorporado y correo E19 enviado."
        );
      } else {
        setFeedbackMessage(
          json.autoReactivated
            ? "Cuento guardado y participante reactivado automáticamente con correo E19."
            : "Cuento tardío registrado en el historial de auditoría."
        );
      }
      setModal(null);
      await loadData();
    } catch {
      setErrorMessage("Error de conexión al guardar la intervención.");
    } finally {
      setBusy(false);
    }
  }

  const charCount = countStoryBodyChars(storyBody);

  return (
    <div className="space-y-8">
      <header className="border-b-2 border-ink pb-4">
        <div className="flex items-center gap-2 text-accent-2">
          <Users className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm font-semibold">Intervención manual</span>
        </div>
        <h1 className="mt-1">Participantes de la edición</h1>
        <p className="mt-1 text-sm text-ink-2">
          {edition
            ? `${edition.title} (${participants.length} inscritos)`
            : "No hay una edición activa configurada."}
        </p>
      </header>

      {errorMessage && (
        <div
          role="alert"
          className="border-l-2 border-error py-1 pl-4 text-sm text-error"
        >
          {errorMessage}
        </div>
      )}

      {feedbackMessage && (
        <div
          role="status"
          className="border-l-2 border-success py-1 pl-4 text-sm text-success"
        >
          {feedbackMessage}
        </div>
      )}

      <section className="rounded-card border border-ink bg-paper p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <label htmlFor="search-participants" className="sr-only">
            Buscar participante
          </label>
          <input
            id="search-participants"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o correo…"
            className="w-full max-w-md rounded-input border border-ink bg-paper-2 px-3 py-2 text-sm text-ink"
          />
          <span className="text-xs text-muted num">
            Mostrando {filtered.length} de {participants.length}
          </span>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-muted">Cargando participantes…</p>
        ) : filtered.length === 0 ? (
          <p className="mt-6 text-sm text-muted">
            No se encontraron participantes inscritos.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-rule border-y border-rule">
            {filtered.map((p) => (
              <li
                key={p.enrollmentId}
                className="flex flex-wrap items-center justify-between gap-4 py-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={
                        p.status === "ACTIVE"
                          ? "font-semibold text-success"
                          : "font-semibold text-error"
                      }
                    >
                      {p.status === "ACTIVE" ? "Activo" : "Descalificado"}
                    </span>
                    {p.disqualificationReason && (
                      <span className="text-muted">
                        ({p.disqualificationReason})
                      </span>
                    )}
                    <span className="text-muted num">
                      Fallas: {p.missesCount} / Cuentos: {p.storiesCount}
                    </span>
                  </div>
                  <p className="mt-1 font-display text-base font-extrabold text-ink">
                    {p.fullName}
                  </p>
                  <p className="text-xs text-muted">{p.email}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openModal({ kind: "late_story", participant: p })}
                    className="btn btn--secondary"
                  >
                    <FilePlus2
                      className="mr-1.5 inline h-4 w-4"
                      aria-hidden="true"
                    />
                    Cuento tardío
                  </button>

                  {p.status === "ACTIVE" ? (
                    <button
                      type="button"
                      onClick={() =>
                        openModal({ kind: "disqualify", participant: p })
                      }
                      className="btn btn--secondary"
                    >
                      <UserX
                        className="mr-1.5 inline h-4 w-4"
                        aria-hidden="true"
                      />
                      Descalificar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        openModal({ kind: "reinstate", participant: p })
                      }
                      className="btn btn--primary"
                    >
                      <RotateCcw
                        className="mr-1.5 inline h-4 w-4"
                        aria-hidden="true"
                      />
                      Reincorporar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {modal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="intervention-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-card border-2 border-ink bg-paper p-6">
            <div className="flex items-start justify-between gap-4 border-b border-rule pb-3">
              <div>
                <h3 id="intervention-modal-title">
                  {modal.kind === "disqualify"
                    ? "Descalificar manualmente"
                    : modal.kind === "reinstate"
                      ? "Reincorporar participante"
                      : "Cargar o editar cuento tardío"}
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Participante: <strong>{modal.participant.fullName}</strong> (
                  {modal.participant.email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label="Cerrar modal"
                className="btn btn--secondary"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form
              onSubmit={handleModalSubmit}
              className="mt-5 space-y-5"
              noValidate
            >
              {modal.kind === "late_story" && edition && (
                <>
                  <div>
                    <label
                      htmlFor="late-prompt"
                      className="block text-sm font-semibold text-ink"
                    >
                      Consigna
                    </label>
                    <select
                      id="late-prompt"
                      value={promptId}
                      onChange={(e) => setPromptId(e.target.value)}
                      className="mt-2 w-full rounded-input border border-ink bg-paper-2 px-3 py-2 text-sm text-ink"
                    >
                      {prompts.map((pr) => (
                        <option key={pr.id} value={pr.id}>
                          Consigna {pr.promptNumber}: {pr.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="late-title"
                      className="block text-sm font-semibold text-ink"
                    >
                      Título del cuento
                    </label>
                    <input
                      id="late-title"
                      type="text"
                      maxLength={MAX_STORY_TITLE_LENGTH}
                      value={storyTitle}
                      onChange={(e) => setStoryTitle(e.target.value)}
                      className="mt-2 w-full rounded-input border border-ink bg-paper-2 px-3 py-2 text-sm text-ink"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs">
                      <label
                        htmlFor="late-body"
                        className="font-semibold text-ink"
                      >
                        Texto del cuento
                      </label>
                      <span
                        className={`font-semibold num ${
                          charCount < edition.minChars ||
                          charCount > edition.maxChars
                            ? "text-error"
                            : "text-success"
                        }`}
                      >
                        {charCount} caracteres ({edition.minChars} a{" "}
                        {edition.maxChars})
                      </span>
                    </div>
                    <textarea
                      id="late-body"
                      rows={8}
                      value={storyBody}
                      onChange={(e) => setStoryBody(e.target.value)}
                      className="mt-2 w-full rounded-input border border-ink bg-paper-2 px-3 py-2 text-sm text-ink"
                      required
                    />
                  </div>
                </>
              )}

              <div>
                <label
                  htmlFor="intervention-justification"
                  className="block text-sm font-semibold text-ink"
                >
                  Justificación obligatoria (se registra en el historial)
                </label>
                <textarea
                  id="intervention-justification"
                  rows={3}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Describe el motivo de esta intervención…"
                  className="mt-2 w-full rounded-input border border-ink bg-paper-2 px-3 py-2 text-sm text-ink"
                  required
                />
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-rule pt-4">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setModal(null)}
                  className="btn btn--secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy || justification.trim().length < 5}
                  className="btn btn--primary"
                >
                  {busy ? "Guardando…" : "Confirmar acción"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
