"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import { formatCaracasDateTime } from "@/lib/timezone";

interface AuditLogItem {
  id: string;
  actionType: string;
  actorName: string;
  targetUserName: string | null;
  justification: string;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  DISQUALIFY_USER: "Descalificación manual",
  REINSTATE_USER: "Reincorporación",
  LATE_STORY_UPLOAD: "Carga de cuento tardío",
  LATE_STORY_EDIT: "Edición de cuento tardío",
  TRIGGER_MOD_ALERT: "Alerta de modificaciones",
  VOTE_MOD_ALERT: "Voto en alerta",
  PROMPT_OVERRIDE: "Edición directa de consigna",
  PUBLISH_WINNERS: "Publicación de ganadores",
  ROLE_CHANGE: "Cambio de rol",
};

export default function AdminLogPage() {
  const [entries, setEntries] = useState<AuditLogItem[]>([]);
  const [filterType, setFilterType] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/admin/log");
      const json = (await res.json()) as {
        ok: boolean;
        entries?: AuditLogItem[];
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setErrorMessage(json.error ?? "No se pudo cargar el historial.");
        return;
      }
      setEntries(json.entries ?? []);
    } catch {
      setErrorMessage("Error de conexión al consultar el historial.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const filtered = useMemo(() => {
    if (filterType === "ALL") return entries;
    return entries.filter((e) => e.actionType === filterType);
  }, [entries, filterType]);

  return (
    <div className="space-y-8">
      <header className="border-b-2 border-ink pb-4">
        <div className="flex items-center gap-2 text-accent-2">
          <ScrollText className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm font-semibold">Auditoría inmutable</span>
        </div>
        <h1 className="mt-1">Historial de acciones administrativas</h1>
        <p className="mt-1 text-sm text-ink-2">
          Registro cronológico visible para todos los administradores y
          superadministradores.
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

      <section className="rounded-card border border-ink bg-paper p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label
              htmlFor="filter-action"
              className="text-sm font-semibold text-ink"
            >
              Filtrar por acción:
            </label>
            <select
              id="filter-action"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-input border border-ink bg-paper-2 px-3 py-1.5 text-sm text-ink"
            >
              <option value="ALL">Todas ({entries.length})</option>
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-muted num">
            {filtered.length} registros
          </span>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-muted">Cargando historial…</p>
        ) : filtered.length === 0 ? (
          <p className="mt-6 text-sm text-muted">
            No hay registros de auditoría para el filtro seleccionado.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-rule border-y border-rule">
            {filtered.map((entry) => (
              <li key={entry.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-accent-2">
                    {ACTION_LABELS[entry.actionType] ?? entry.actionType}
                  </span>
                  <span className="text-xs text-muted num">
                    {formatCaracasDateTime(entry.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink">
                  <strong>{entry.actorName}</strong>
                  {entry.targetUserName
                    ? ` sobre ${entry.targetUserName}`
                    : ""}
                </p>
                <p className="mt-1 text-sm text-ink-2">{entry.justification}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
