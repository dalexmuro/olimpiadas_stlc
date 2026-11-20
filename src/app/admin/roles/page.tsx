"use client";

import { useEffect, useState, type FormEvent } from "react";
import { USER_ROLES, type UserRole } from "@/db/schema";
import {
  evaluateJuryCountStatus,
  filterUsersByQuery,
  type JuryCountStatus,
  type ManagedUserSummary,
} from "@/lib/role-management";

const ROLE_LABELS: Record<UserRole, string> = {
  PARTICIPANT: "Participante",
  JURY: "Jurado",
  ADMIN: "Administrador",
  SUPERADMIN: "Superadministrador",
};

export default function AdminRolesPage() {
  const [usersList, setUsersList] = useState<ManagedUserSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [juryStatus, setJuryStatus] = useState<JuryCountStatus>(
    evaluateJuryCountStatus(0)
  );
  const [selectedRoles, setSelectedRoles] = useState<Record<string, UserRole>>(
    {}
  );
  const [justifications, setJustifications] = useState<Record<string, string>>(
    {}
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  async function loadUsers() {
    try {
      const res = await fetch("/api/admin/roles");
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok: boolean;
        users?: ManagedUserSummary[];
        juryStatus?: JuryCountStatus;
      };
      if (data.ok && data.users) {
        setUsersList(data.users);
        const initialSelection: Record<string, UserRole> = {};
        for (const u of data.users) {
          initialSelection[u.id] = u.role;
        }
        setSelectedRoles(initialSelection);
        if (data.juryStatus) {
          setJuryStatus(data.juryStatus);
        }
      }
    } catch {
      // Ignore initial load error in offline preview
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function handleRoleSave(
    event: FormEvent<HTMLFormElement>,
    user: ManagedUserSummary
  ) {
    event.preventDefault();
    setFeedback(null);
    setErrorMessage(null);

    const nextRole = selectedRoles[user.id] ?? user.role;
    const justification = justifications[user.id] ?? "";

    setSavingUserId(user.id);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetUserId: user.id,
          newRole: nextRole,
          justification,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        juryStatus?: JuryCountStatus;
      };

      if (!res.ok || !data.ok) {
        setErrorMessage(
          data.error ?? "No se pudo actualizar el rol del usuario."
        );
        return;
      }

      setUsersList((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: nextRole } : u))
      );
      setJustifications((prev) => ({ ...prev, [user.id]: "" }));
      if (data.juryStatus) {
        setJuryStatus(data.juryStatus);
      }
      setFeedback(
        `Rol de ${user.email} actualizado a ${ROLE_LABELS[nextRole]} y registrado en el historial.`
      );
    } catch {
      setErrorMessage("Error de conexión al guardar el cambio de rol.");
    } finally {
      setSavingUserId(null);
    }
  }

  const visibleUsers = filterUsersByQuery(usersList, searchQuery);

  return (
    <section className="border-t-2 border-ink pt-6">
      <h1>Gestión de roles</h1>
      <p className="lead mt-3 text-ink-2">
        Asigna o retira roles globales de administrador, jurado o
        superadministrador. Cada cambio queda registrado en el historial.
      </p>

      {/* Validación visual del número impar de jurados */}
      <div
        role="status"
        className={`mt-6 rounded-card border p-4 text-sm ${
          juryStatus.isValidForContest
            ? "border-ink bg-paper text-ink"
            : "border-ink bg-paper-2 text-ink"
        }`}
      >
        <p className="font-display text-base font-extrabold">
          Estado del jurado ({juryStatus.juryCount})
        </p>
        <p className="mt-1 text-ink-2">{juryStatus.message}</p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mt-4 rounded-card border border-error bg-paper-2 p-3 text-sm text-error"
        >
          {errorMessage}
        </div>
      )}

      {feedback && (
        <div className="mt-4 rounded-card border border-ink bg-paper p-3 text-sm text-ink">
          {feedback}
        </div>
      )}

      {/* Buscador de usuarios */}
      <div className="mt-6">
        <label
          htmlFor="role-user-search"
          className="block text-sm font-medium text-ink"
        >
          Buscar usuario por nombre, correo o rol
        </label>
        <input
          id="role-user-search"
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Escribe un nombre o correo electrónico..."
          className="mt-2 block min-h-12 w-full max-w-md rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink"
        />
      </div>

      {/* Lista de usuarios */}
      <div className="mt-8 border-b border-rule">
        {visibleUsers.length === 0 ? (
          <div className="border-t border-rule py-8 text-sm text-muted">
            No se encontraron usuarios que coincidan con la búsqueda.
          </div>
        ) : (
          visibleUsers.map((user) => (
            <form
              key={user.id}
              onSubmit={(e) => handleRoleSave(e, user)}
              className="riso-row"
            >
              <div>
                <p className="font-display text-lg font-extrabold text-ink">
                  {user.firstName || user.lastName
                    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                    : user.name ?? user.email}
                </p>
                <p className="text-sm text-muted">{user.email}</p>
                <p className="mt-1 text-xs text-ink-2">
                  Rol actual: {ROLE_LABELS[user.role]}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label
                    htmlFor={`role-select-${user.id}`}
                    className="block text-xs font-medium text-muted"
                  >
                    Nuevo rol
                  </label>
                  <select
                    id={`role-select-${user.id}`}
                    value={selectedRoles[user.id] ?? user.role}
                    onChange={(e) =>
                      setSelectedRoles((prev) => ({
                        ...prev,
                        [user.id]: e.target.value as UserRole,
                      }))
                    }
                    className="mt-1 block min-h-12 w-full rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink"
                  >
                    {USER_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1">
                  <label
                    htmlFor={`role-reason-${user.id}`}
                    className="block text-xs font-medium text-muted"
                  >
                    Justificación obligatoria
                  </label>
                  <input
                    id={`role-reason-${user.id}`}
                    type="text"
                    value={justifications[user.id] ?? ""}
                    onChange={(e) =>
                      setJustifications((prev) => ({
                        ...prev,
                        [user.id]: e.target.value,
                      }))
                    }
                    placeholder="Motivo del cambio..."
                    className="mt-1 block min-h-12 w-full rounded-card border border-ink bg-paper px-3 py-2 text-sm text-ink"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingUserId === user.id}
                  className="btn btn--secondary"
                >
                  {savingUserId === user.id ? "Guardando..." : "Guardar rol"}
                </button>
              </div>
            </form>
          ))
        )}
      </div>
    </section>
  );
}
