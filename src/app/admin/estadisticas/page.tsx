"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import type { EditionStatisticsSnapshot } from "@/lib/admin-statistics";
import { formatCaracasDateTime } from "@/lib/timezone";

interface StatsApiResponse {
  ok: boolean;
  edition?: {
    id: string;
    title: string;
    juryPausedMissingVotes: boolean;
    tieBreakerActive: boolean;
    winnersAnnounced: boolean;
  } | null;
  stats?: EditionStatisticsSnapshot | null;
  generatedAt?: string;
  error?: string;
}

const DQ_LABELS: Array<{
  key: keyof EditionStatisticsSnapshot["disqualificationBreakdown"];
  label: string;
}> = [
  { key: "MAX_MISSES", label: "Exceso de consignas sin entregar" },
  { key: "NO_POSTULATION", label: "No postuló cuento en Etapa 3" },
  { key: "MODIFICATION_REJECTED", label: "Modificaciones rechazadas" },
  { key: "NO_VOTE", label: "No votó en Etapa 5" },
  { key: "MANUAL_ADMIN", label: "Descalificación manual por admin" },
];

export default function AdminEstadisticasPage() {
  const [data, setData] = useState<StatsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/admin/estadisticas");
      const json = (await res.json()) as StatsApiResponse;
      if (!res.ok || !json.ok) {
        setErrorMessage(
          json.error ?? "No se pudieron cargar las estadísticas."
        );
        return;
      }
      setData(json);
    } catch {
      setErrorMessage("Error de conexión al consultar las estadísticas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const stats = data?.stats ?? null;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-rule pb-4">
        <div>
          <h1 className="flex items-center gap-2.5">
            <BarChart3 className="h-6 w-6 text-accent" aria-hidden="true" />
            <span>Estadísticas en tiempo real</span>
          </h1>
          {data?.edition && (
            <p className="mt-1.5 text-sm text-muted">
              {data.edition.title}
              {data.generatedAt
                ? ` — Actualizado: ${formatCaracasDateTime(data.generatedAt)}`
                : ""}
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => void loadStats()}
          className="btn btn--secondary"
        >
          <RefreshCw className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </header>

      {errorMessage && (
        <div
          role="alert"
          className="border-l-2 border-error py-1 pl-4 text-sm text-error"
        >
          {errorMessage}
        </div>
      )}

      {!loading && !stats && !errorMessage && (
        <section className="rounded-card border border-ink bg-paper-2 p-6">
          <p className="text-sm text-ink-2">
            No hay ninguna edición activa para mostrar estadísticas.
          </p>
        </section>
      )}

      {stats && (
        <>
          {/* Summary KPIs */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-card border border-ink bg-paper p-5">
              <p className="text-xs text-muted">Inscritos totales</p>
              <p className="mt-2 font-display text-3xl font-extrabold text-ink num">
                {stats.totalEnrolled}
              </p>
            </div>
            <div className="rounded-card border border-ink bg-paper p-5">
              <p className="text-xs text-muted">Participantes activos</p>
              <p className="mt-2 font-display text-3xl font-extrabold text-success num">
                {stats.activeCount}
              </p>
            </div>
            <div className="rounded-card border border-ink bg-paper p-5">
              <p className="text-xs text-muted">Descalificados</p>
              <p className="mt-2 font-display text-3xl font-extrabold text-error num">
                {stats.disqualifiedCount}
              </p>
            </div>
            <div className="rounded-card border border-ink bg-paper p-5">
              <p className="text-xs text-muted">Cuentos postulados</p>
              <p className="mt-2 font-display text-3xl font-extrabold text-ink num">
                {stats.postulatedCount}
              </p>
            </div>
          </section>

          {/* Voting Progress & Disqualification Breakdown */}
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-card border border-ink bg-paper-2 p-6">
              <h2>Avance de votaciones</h2>
              <dl className="mt-4 divide-y divide-rule border-y border-rule text-sm">
                <div className="flex justify-between py-3">
                  <dt className="text-ink-2">Participantes que votaron</dt>
                  <dd className="font-semibold text-ink num">
                    {stats.participantsVotedCount} / {stats.activeCount}
                  </dd>
                </div>
                <div className="flex justify-between py-3">
                  <dt className="text-ink-2">Participantes pendientes</dt>
                  <dd className="font-semibold text-ink num">
                    {stats.participantsPendingVoteCount}
                  </dd>
                </div>
                <div className="flex justify-between py-3">
                  <dt className="text-ink-2">Jurados que votaron</dt>
                  <dd className="font-semibold text-ink num">
                    {stats.juryProgress.votedCount} /{" "}
                    {stats.juryProgress.totalJurorsCount}
                  </dd>
                </div>
                <div className="flex justify-between py-3">
                  <dt className="text-ink-2">Jurados pendientes</dt>
                  <dd className="font-semibold text-ink num">
                    {stats.juryProgress.pendingCount}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-card border border-ink bg-paper-2 p-6">
              <h2>Causas de descalificación</h2>
              <dl className="mt-4 divide-y divide-rule border-y border-rule text-sm">
                {DQ_LABELS.map(({ key, label }) => (
                  <div key={key} className="flex justify-between py-3">
                    <dt className="text-ink-2">{label}</dt>
                    <dd className="font-semibold text-ink num">
                      {stats.disqualificationBreakdown[key]}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          {/* Stories per Prompt */}
          <section className="rounded-card border border-ink bg-paper p-6">
            <h2>Cuentos recibidos por consigna</h2>
            {stats.storiesPerPrompt.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                No hay consignas asignadas a esta edición.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-rule border-y border-rule text-sm">
                {stats.storiesPerPrompt.map((item) => (
                  <li
                    key={item.promptId}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <span>
                      <strong>Consigna {item.promptNumber}:</strong>{" "}
                      {item.title}
                    </span>
                    <span className="font-semibold text-ink num">
                      {item.storiesCount} cuentos
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Complete Final Score Table (Admin & Superadmin ONLY) */}
          <section className="rounded-card border border-ink bg-paper p-6">
            <h2>Tabla completa de puntajes finales</h2>
            <p className="mt-1 text-xs text-muted">
              Información confidencial visible únicamente para Administradores y
              Superadministrador.
            </p>

            {stats.scoreTable.length === 0 ? (
              <p className="mt-4 text-sm text-muted">
                Aún no hay cuentos postulados en esta edición.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-ink text-xs text-muted">
                      <th className="py-2 pr-3">Podio</th>
                      <th className="py-2 pr-3">Cuento</th>
                      <th className="py-2 pr-3">Autor</th>
                      <th className="py-2 pr-3">Consigna</th>
                      <th className="py-2 pr-3 text-right">Pts. Part.</th>
                      <th className="py-2 pr-3 text-right">Pts. Jurado</th>
                      <th className="py-2 pr-3 text-right">Total</th>
                      <th className="py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {stats.scoreTable.map((row) => (
                      <tr key={row.storyId}>
                        <td className="py-3 pr-3 font-semibold text-accent-2 num">
                          {row.podiumPlace ? `${row.podiumPlace}º` : " "}
                        </td>
                        <td className="py-3 pr-3 font-medium text-ink">
                          {row.title}
                        </td>
                        <td className="py-3 pr-3 text-ink-2">
                          {row.authorName}
                        </td>
                        <td className="py-3 pr-3 text-muted num">
                          #{row.promptNumber}
                        </td>
                        <td className="py-3 pr-3 text-right num">
                          {row.participantPoints}
                        </td>
                        <td className="py-3 pr-3 text-right num">
                          {row.juryPoints}
                        </td>
                        <td className="py-3 pr-3 text-right font-semibold text-ink num">
                          {row.totalPoints}
                        </td>
                        <td className="py-3 text-xs">
                          {row.passedToJury ? "Finalista jurado" : row.enrollmentStatus}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
