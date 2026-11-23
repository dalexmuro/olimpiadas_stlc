"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  buildJuryFormulaPreviewBrackets,
  convertCaracasScheduleFormToUtc,
  DEFAULT_JURY_MULTIPLIER_FORMULA,
  validateEditionParameters,
  type EditionScheduleUtc,
  type JuryMultiplierFormula,
} from "@/lib/edition-management";
import { formatCaracasDateTime } from "@/lib/timezone";

interface EditionSummary {
  id: string;
  title: string;
  slug: string;
  isActive: boolean;
  minChars: number;
  maxChars: number;
  maxAllowedMisses: number;
  minSimilarityPct: number;
  registrationStartAt: string;
  juryEndAt: string;
}

const INITIAL_SCHEDULE: EditionScheduleUtc = {
  registrationStartAt: "2026-06-01T09:00",
  registrationEndAt: "2026-06-15T23:59",
  writingStartAt: "2026-06-16T09:00",
  writingEndAt: "2026-06-30T09:00",
  submissionStartAt: "2026-07-02T09:00",
  submissionEndAt: "2026-07-07T23:59",
  adminReviewStartAt: "2026-07-08T00:00",
  adminReviewEndAt: "2026-07-10T09:00",
  votingStartAt: "2026-07-12T09:00",
  votingEndAt: "2026-07-22T23:59",
  juryStartAt: "2026-07-23T09:00",
  juryEndAt: "2026-07-30T23:59",
};

export default function AdminEditionsPage() {
  const [editionsList, setEditionsList] = useState<EditionSummary[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [title, setTitle] = useState("Olimpíadas Literarias 2026");
  const [slug, setSlug] = useState("2026");
  const [isActive, setIsActive] = useState(true);
  const [minChars, setMinChars] = useState(100);
  const [maxChars, setMaxChars] = useState(3000);
  const [maxAllowedMisses, setMaxAllowedMisses] = useState(2);
  const [minSimilarityPct, setMinSimilarityPct] = useState(70);
  const [juryFormula, setJuryFormula] = useState<JuryMultiplierFormula>({
    ...DEFAULT_JURY_MULTIPLIER_FORMULA,
  });
  const [schedule, setSchedule] = useState<EditionScheduleUtc>(INITIAL_SCHEDULE);
  const [errors, setErrors] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadEditions() {
    try {
      const res = await fetch("/api/admin/ediciones");
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok: boolean;
        canEdit?: boolean;
        editions?: EditionSummary[];
      };
      if (data.ok && data.editions) {
        setEditionsList(data.editions);
        setCanEdit(Boolean(data.canEdit));
      }
    } catch {
      // Ignore offline preview fetch
    }
  }

  useEffect(() => {
    void loadEditions();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors([]);
    setFeedback(null);

    let utcSchedule: EditionScheduleUtc;
    try {
      utcSchedule = convertCaracasScheduleFormToUtc(schedule);
    } catch (err) {
      setErrors([
        err instanceof Error
          ? err.message
          : "Revisa que todas las fechas estén completas.",
      ]);
      return;
    }

    const clientValidation = validateEditionParameters({
      title,
      slug,
      isActive,
      minChars,
      maxChars,
      maxAllowedMisses,
      minSimilarityPct,
      juryFormula,
      ...utcSchedule,
    });

    if (!clientValidation.valid) {
      setErrors(clientValidation.errors);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/ediciones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          isActive,
          minChars,
          maxChars,
          maxAllowedMisses,
          minSimilarityPct,
          juryFormula,
          scheduleCaracas: schedule,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        errors?: string[];
      };
      if (!res.ok || !data.ok) {
        setErrors(data.errors ?? ["No se pudo guardar la edición."]);
        return;
      }
      setFeedback("Edición creada y calendario validado correctamente.");
      await loadEditions();
    } catch {
      setErrors(["Error de conexión al guardar la edición."]);
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(editionId: string) {
    setErrors([]);
    setFeedback(null);
    const res = await fetch("/api/admin/ediciones", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ editionId }),
    });
    if (res.ok) {
      setFeedback("Edición activada como edición oficial en curso.");
      await loadEditions();
    }
  }

  function updateScheduleField(key: keyof EditionScheduleUtc, value: string) {
    setSchedule((prev) => ({ ...prev, [key]: value }));
  }

  const previewTiers = buildJuryFormulaPreviewBrackets(juryFormula, 4);

  return (
    <section className="border-t-2 border-ink pt-6">
      <h1>Ediciones y calendario oficial</h1>
      <p className="lead mt-3 text-ink-2">
        Crea cada edición anual, define las reglas de escritura y programa las
        etapas en hora oficial de Caracas (UTC-4). El sistema exige orden
        secuencial y 48 horas mínimas antes de Postulación y antes de Votaciones.
      </p>

      {errors.length > 0 && (
        <div
          role="alert"
          className="mt-6 rounded-card border border-error bg-paper-2 p-4 text-sm text-error"
        >
          <p className="font-display font-extrabold">
            Revisa la configuración de la edición:
          </p>
          <ul className="mt-2 list-disc pl-5">
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {!canEdit && (
        <div
          role="status"
          className="mt-6 rounded-card border border-rule bg-accent-soft px-4 py-3 text-sm text-ink-2"
        >
          Modo solo lectura: puedes consultar las ediciones y su configuración,
          pero los cambios están reservados al superadministrador.
        </div>
      )}

      {feedback && (
        <div className="mt-6 rounded-card border border-ink bg-paper p-4 text-sm text-ink">
          {feedback}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-8" noValidate>
        <fieldset disabled={!canEdit} className="space-y-8 border-0 p-0 disabled:opacity-80">
        {/* Identificación y reglas */}
        <div className="border-t border-rule pt-6">
          <h2>Identificación y reglas</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ed-title" className="block text-sm font-medium">
                Título de la edición
              </label>
              <input
                id="ed-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 block min-h-12 w-full rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink"
              />
            </div>

            <div>
              <label htmlFor="ed-slug" className="block text-sm font-medium">
                Identificador (slug URL)
              </label>
              <input
                id="ed-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="mt-1 block min-h-12 w-full rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink"
              />
            </div>

            <div>
              <label htmlFor="ed-min-chars" className="block text-sm font-medium">
                Mínimo de caracteres
              </label>
              <input
                id="ed-min-chars"
                type="number"
                value={minChars}
                onChange={(e) => setMinChars(Number(e.target.value))}
                className="mt-1 block min-h-12 w-full rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink num"
              />
            </div>

            <div>
              <label htmlFor="ed-max-chars" className="block text-sm font-medium">
                Máximo de caracteres (solo cuento)
              </label>
              <input
                id="ed-max-chars"
                type="number"
                value={maxChars}
                onChange={(e) => setMaxChars(Number(e.target.value))}
                className="mt-1 block min-h-12 w-full rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink num"
              />
            </div>

            <div>
              <label htmlFor="ed-max-misses" className="block text-sm font-medium">
                Máximo de fallas permitidas
              </label>
              <input
                id="ed-max-misses"
                type="number"
                value={maxAllowedMisses}
                onChange={(e) => setMaxAllowedMisses(Number(e.target.value))}
                className="mt-1 block min-h-12 w-full rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink num"
              />
            </div>

            <div>
              <label htmlFor="ed-similarity" className="block text-sm font-medium">
                Similitud mínima en edición (%)
              </label>
              <input
                id="ed-similarity"
                type="number"
                value={minSimilarityPct}
                onChange={(e) => setMinSimilarityPct(Number(e.target.value))}
                className="mt-1 block min-h-12 w-full rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink num"
              />
            </div>
          </div>

          <label className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Activar esta edición inmediatamente como edición en curso
          </label>
        </div>

        {/* Cálculo automático de puntaje del jurado */}
        <div className="border-t border-rule pt-6">
          <h2>Escalones de puntaje del jurado</h2>
          <p className="mt-1 text-sm text-muted">
            El multiplicador K se calcula automáticamente según la cantidad de
            participantes activos que llegan a votación (1er lugar = 3K, 2do =
            2K, 3ro = 1K).
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="jury-step-size"
                className="block text-sm font-medium"
              >
                Participantes por escalón
              </label>
              <input
                id="jury-step-size"
                type="number"
                min={1}
                value={juryFormula.stepSize}
                onChange={(e) =>
                  setJuryFormula((prev) => ({
                    ...prev,
                    stepSize: Number(e.target.value),
                  }))
                }
                className="mt-1 block min-h-12 w-full rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink num"
              />
            </div>

            <div>
              <label
                htmlFor="jury-base-multiplier"
                className="block text-sm font-medium"
              >
                Incremento de multiplicador K por escalón
              </label>
              <input
                id="jury-base-multiplier"
                type="number"
                min={1}
                value={juryFormula.baseMultiplier}
                onChange={(e) =>
                  setJuryFormula((prev) => ({
                    ...prev,
                    baseMultiplier: Number(e.target.value),
                  }))
                }
                className="mt-1 block min-h-12 w-full rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink num"
              />
            </div>
          </div>

          <div className="mt-4 rounded-card border border-rule bg-paper-2 p-4">
            <p className="text-xs font-semibold text-ink">
              Vista previa automática (escala de forma ilimitada)
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {previewTiers.map((tier) => (
                <div
                  key={tier.min}
                  className="flex items-center justify-between rounded-card border border-rule bg-paper px-3 py-2 text-xs num"
                >
                  <span className="font-medium text-ink">
                    {tier.min} a {tier.max} participantes
                  </span>
                  <span className="text-muted">
                    K={tier.k} ({tier.k * 3}/{tier.k * 2}/{tier.k} pts)
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted num">
              … y así sucesivamente (+{Math.max(1, Math.floor(juryFormula.baseMultiplier || 1))}× cada{" "}
              {Math.max(1, Math.floor(juryFormula.stepSize || 1))} participantes).
            </p>
          </div>
        </div>

        {/* Calendario en hora de Caracas */}
        <div className="border-t border-rule pt-6">
          <h2>Calendario de etapas (Hora de Caracas, UTC-4)</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(
              [
                ["registrationStartAt", "1. Inicio de Inscripciones"],
                ["registrationEndAt", "1. Fin de Inscripciones"],
                ["writingStartAt", "2. Inicio de Envío de cuentos"],
                ["writingEndAt", "2. Fin de Envío de cuentos"],
                ["submissionStartAt", "3. Inicio de Postulación (+48h mín.)"],
                ["submissionEndAt", "3. Fin de Postulación"],
                ["adminReviewStartAt", "4. Inicio de Revisión Admin"],
                ["adminReviewEndAt", "4. Fin de Revisión Admin"],
                ["votingStartAt", "5. Inicio de Votaciones (+48h mín.)"],
                ["votingEndAt", "5. Fin de Votaciones"],
                ["juryStartAt", "6. Inicio de Evaluación del Jurado"],
                ["juryEndAt", "6. Fin de Evaluación del Jurado"],
              ] as Array<[keyof EditionScheduleUtc, string]>
            ).map(([key, label]) => (
              <div key={key}>
                <label htmlFor={`sched-${key}`} className="block text-sm font-medium">
                  {label}
                </label>
                <input
                  id={`sched-${key}`}
                  type="datetime-local"
                  value={schedule[key]}
                  onChange={(e) => updateScheduleField(key, e.target.value)}
                  className="mt-1 block min-h-12 w-full rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink num"
                />
              </div>
            ))}
          </div>
        </div>

        </fieldset>

        {canEdit && (
          <button type="submit" disabled={saving} className="btn btn--primary">
            {saving ? "Guardando edición..." : "Crear edición oficial"}
          </button>
        )}
      </form>

      {/* Ediciones existentes */}
      {editionsList.length > 0 && (
        <div className="mt-12 border-t-2 border-ink pt-6">
          <h2>Ediciones registradas</h2>
          <div className="mt-4 border-b border-rule">
            {editionsList.map((ed) => (
              <div key={ed.id} className="riso-row">
                <div>
                  <h3>{ed.title}</h3>
                  <p className="text-sm text-muted">
                    Slug: {ed.slug} ({ed.isActive ? "Activa" : "Inactiva"})
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="text-sm text-ink-2 num">
                    Inicio: {formatCaracasDateTime(ed.registrationStartAt)}
                  </p>
                  {canEdit && !ed.isActive && (
                    <button
                      type="button"
                      onClick={() => handleActivate(ed.id)}
                      className="btn btn--secondary"
                    >
                      Activar edición
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
