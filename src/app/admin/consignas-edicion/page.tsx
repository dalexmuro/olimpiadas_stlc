"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { MediaType, PromptPackageStatus } from "@/db/schema";
import type { PackageMajorityStatus } from "@/lib/edition-prompts";
import { formatCaracasDateTime } from "@/lib/timezone";

interface EditionPromptRow {
  id: string;
  promptNumber: number;
  title: string;
  body: string;
  mediaType: MediaType | null;
  mediaUrl: string | null;
  publishedAt: string;
  closesAt: string;
}

interface BankPromptOption {
  id: string;
  title: string;
  body: string;
}

export default function AdminEditionPromptsPage() {
  const [edition, setEdition] = useState<{
    id: string;
    title: string;
    promptPackageStatus: PromptPackageStatus;
  } | null>(null);
  const [prompts, setPrompts] = useState<EditionPromptRow[]>([]);
  const [availableBank, setAvailableBank] = useState<BankPromptOption[]>([]);
  const [majority, setMajority] = useState<PackageMajorityStatus | null>(null);
  const [myVoteApproved, setMyVoteApproved] = useState<boolean | null>(null);
  const [isSuperadminUser, setIsSuperadminUser] = useState(false);

  const [selectedBankId, setSelectedBankId] = useState("");
  const [promptNumber, setPromptNumber] = useState(1);
  const [publishedAtCaracas, setPublishedAtCaracas] = useState("2026-06-16T09:00");
  const [durationHours, setDurationHours] = useState(24);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadData() {
    try {
      const res = await fetch("/api/admin/consignas-edicion");
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok: boolean;
        edition: {
          id: string;
          title: string;
          promptPackageStatus: PromptPackageStatus;
        } | null;
        editionPrompts: EditionPromptRow[];
        availableBank: BankPromptOption[];
        majority: PackageMajorityStatus | null;
        myVoteApproved: boolean | null;
        isSuperadmin: boolean;
      };
      if (data.ok) {
        setEdition(data.edition);
        setPrompts(data.editionPrompts);
        setAvailableBank(data.availableBank);
        setMajority(data.majority);
        setMyVoteApproved(data.myVoteApproved);
        setIsSuperadminUser(data.isSuperadmin);
        setPromptNumber(data.editionPrompts.length + 1);
      }
    } catch {
      // Ignore offline preview fetch
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!edition || !selectedBankId) return;
    setErrorMessage(null);
    setFeedback(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/consignas-edicion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          editionId: edition.id,
          promptBankId: selectedBankId,
          promptNumber,
          publishedAtCaracas,
          durationHours,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "No se pudo asignar la consigna.");
        return;
      }
      setSelectedBankId("");
      setFeedback("Consigna asignada a la edición y retirada del banco disponible.");
      await loadData();
    } finally {
      setBusy(false);
    }
  }

  async function handleReturnToBank(editionPromptId: string) {
    setErrorMessage(null);
    setFeedback(null);
    const res = await fetch("/api/admin/consignas-edicion", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ editionPromptId }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!res.ok || !data.ok) {
      setErrorMessage(data.error ?? "No se pudo devolver la consigna al banco.");
      return;
    }
    setFeedback("Consigna devuelta al banco de consignas disponibles.");
    await loadData();
  }

  async function handleSendForValidation() {
    if (!edition) return;
    setErrorMessage(null);
    setFeedback(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/consignas-edicion/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ editionId: edition.id }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        notifiedAdmins?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "No se pudo enviar a validación.");
        return;
      }
      setFeedback(
        `Propuesta enviada a validación. Se notificó por correo (E25) a ${data.notifiedAdmins ?? 0} administradores.`
      );
      await loadData();
    } finally {
      setBusy(false);
    }
  }

  async function handlePackageVote(approved: boolean) {
    if (!edition) return;
    setErrorMessage(null);
    setFeedback(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/consignas-edicion/validate", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ editionId: edition.id, approved }),
      });
      if (res.ok) {
        setFeedback(
          approved
            ? "Has validado el paquete de consignas de esta edición."
            : "Has registrado tu rechazo sobre el paquete de consignas."
        );
        await loadData();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-t-2 border-ink pt-6">
      <h1>Consignas de la edición</h1>
      <p className="lead mt-3 text-ink-2">
        {edition
          ? `Paquete oficial de consignas para ${edition.title}.`
          : "Crea y activa primero una edición en /admin/ediciones para programar consignas."}
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

      {edition && (
        <>
          {/* Estado de validación por mayoría */}
          <div className="mt-6 rounded-card border border-ink bg-paper-2 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-display text-lg font-extrabold text-ink">
                  Estado del paquete:{" "}
                  {edition.promptPackageStatus === "ACCEPTED"
                    ? "Aceptado por mayoría"
                    : edition.promptPackageStatus === "PENDING_VALIDATION"
                      ? "Pendiente de validación de administradores"
                      : "Borrador"}
                </p>
                {majority && (
                  <p className="mt-1 text-sm text-ink-2 num">
                    Validaciones: {majority.approvals} de {majority.totalAdmins}{" "}
                    administradores (mayoría requerida:{" "}
                    {majority.majorityThreshold})
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                {isSuperadminUser && (
                  <button
                    type="button"
                    disabled={busy || prompts.length === 0}
                    onClick={handleSendForValidation}
                    className="btn btn--primary whitespace-nowrap"
                  >
                    Enviar a validación
                  </button>
                )}

                {edition.promptPackageStatus === "PENDING_VALIDATION" && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handlePackageVote(true)}
                      className={`btn ${
                        myVoteApproved === true
                          ? "btn--primary"
                          : "btn--secondary"
                      }`}
                    >
                      Validar paquete
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handlePackageVote(false)}
                      className={`btn ${
                        myVoteApproved === false
                          ? "btn--primary"
                          : "btn--secondary"
                      }`}
                    >
                      Rechazar paquete
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Formulario del Superadmin para asignar consignas desde el Banco */}
          {isSuperadminUser && (
            <form
              onSubmit={handleAssign}
              className="mt-8 space-y-4 border-t border-rule pt-6"
            >
              <h2>Agregar consigna desde el banco disponible</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="ep-bank-select"
                    className="block text-sm font-medium"
                  >
                    Consigna del banco
                  </label>
                  <select
                    id="ep-bank-select"
                    value={selectedBankId}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    className="mt-1 block min-h-12 w-full rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink"
                  >
                    <option value="">Selecciona una consigna…</option>
                    {availableBank.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="ep-num" className="block text-sm font-medium">
                    Número de orden
                  </label>
                  <input
                    id="ep-num"
                    type="number"
                    min={1}
                    value={promptNumber}
                    onChange={(e) => setPromptNumber(Number(e.target.value))}
                    className="mt-1 block min-h-12 w-full rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink num"
                  />
                </div>

                <div>
                  <label htmlFor="ep-pub" className="block text-sm font-medium">
                    Apertura (Hora de Caracas)
                  </label>
                  <input
                    id="ep-pub"
                    type="datetime-local"
                    value={publishedAtCaracas}
                    onChange={(e) => setPublishedAtCaracas(e.target.value)}
                    className="mt-1 block min-h-12 w-full rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink num"
                  />
                </div>

                <div>
                  <label htmlFor="ep-dur" className="block text-sm font-medium">
                    Duración abierta (horas)
                  </label>
                  <input
                    id="ep-dur"
                    type="number"
                    min={1}
                    value={durationHours}
                    onChange={(e) => setDurationHours(Number(e.target.value))}
                    className="mt-1 block min-h-12 w-full rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink num"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy || !selectedBankId}
                className="btn btn--secondary"
              >
                Asignar a la edición
              </button>
            </form>
          )}

          {/* Lista de consignas programadas */}
          <div className="mt-10 border-t-2 border-ink pt-6">
            <h2>Consignas programadas ({prompts.length})</h2>
            <div className="mt-4 border-b border-rule">
              {prompts.length === 0 ? (
                <p className="border-t border-rule py-6 text-sm text-muted">
                  Aún no hay consignas asignadas a esta edición.
                </p>
              ) : (
                prompts.map((p) => (
                  <div key={p.id} className="riso-row">
                    <div>
                      <h3>
                        Consigna {p.promptNumber}: {p.title}
                      </h3>
                      <p className="mt-1 text-xs text-muted num">
                        Abre: {formatCaracasDateTime(p.publishedAt)}
                      </p>
                      <p className="text-xs text-muted num">
                        Cierra: {formatCaracasDateTime(p.closesAt)}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <p className="whitespace-pre-line text-sm text-ink-2">
                        {p.body}
                      </p>
                      {isSuperadminUser && (
                        <div>
                          <button
                            type="button"
                            onClick={() => handleReturnToBank(p.id)}
                            className="btn btn--secondary"
                          >
                            Devolver al banco
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
