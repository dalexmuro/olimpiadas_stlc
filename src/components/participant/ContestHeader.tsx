import {
  buildContestTimeline,
  canUserAccessContestWorkspace,
  resolveCurrentContestStage,
  resolveParticipantStatusLabel,
  type EditionStageSnapshot,
  type ParticipantEnrollmentSnapshot,
} from "@/lib/contest-stage";

export interface ContestHeaderProps {
  edition: EditionStageSnapshot;
  enrollment: ParticipantEnrollmentSnapshot | null;
  nowIso?: string;
}

export function ContestHeader({
  edition,
  enrollment,
  nowIso,
}: ContestHeaderProps) {
  const currentStage = resolveCurrentContestStage(edition, nowIso);
  const timeline = buildContestTimeline(edition, nowIso);
  const statusLabel = resolveParticipantStatusLabel(currentStage, enrollment);
  const canAccessContest = canUserAccessContestWorkspace(
    currentStage,
    Boolean(enrollment)
  );

  return (
    <section className="border-b-2 border-ink bg-paper py-8">
      <div className="container">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1>{edition.title}</h1>
            <p className="mt-2 text-sm text-muted">
              Hora oficial del certamen: Caracas, Venezuela (UTC-4)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-card border border-ink bg-paper-2 px-4 py-2 text-sm">
              <span className="text-muted">Tu estatus: </span>
              <strong className="font-display font-extrabold text-ink">
                {statusLabel}
              </strong>
            </div>
            <a href="/perfil" className="btn btn--secondary">
              Editar mi perfil
            </a>
          </div>
        </div>

        {/* Línea de tiempo visual de las etapas */}
        <ol
          aria-label="Línea de tiempo de etapas del concurso"
          className="mt-8 grid grid-cols-1 gap-3 border-t border-rule pt-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {timeline.map((item) => {
            const labelClass =
              item.state === "CURRENT"
                ? "font-display text-base font-extrabold text-ink underline decoration-accent decoration-2 underline-offset-4"
                : item.state === "PAST"
                  ? "text-sm text-muted line-through"
                  : "text-sm text-muted";

            return (
              <li
                key={item.id}
                aria-current={item.state === "CURRENT" ? "step" : undefined}
                className="border-l-2 border-rule pl-3"
              >
                <p className={labelClass}>{item.label}</p>
                <p className="mt-1 text-xs text-muted num">
                  {item.dateRangeLabel}
                </p>
              </li>
            );
          })}
        </ol>

        {!canAccessContest && (
          <div
            role="status"
            className="mt-6 rounded-card border border-ink bg-paper-2 p-4 text-sm text-ink"
          >
            <p className="font-display text-base font-extrabold">
              Inscripciones cerradas para esta edición
            </p>
            <p className="mt-1 text-ink-2">
              Tu cuenta no está inscrita en la edición en curso. Puedes
              actualizar tus datos personales en tu perfil y participar en la
              próxima edición anual.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
