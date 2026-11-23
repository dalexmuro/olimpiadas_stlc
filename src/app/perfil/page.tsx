"use client";

import Link from "next/link";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PageReveal } from "@/components/layout/PageReveal";
import { COUNTRIES_LIST } from "@/lib/auth-forms";
import { validateMediaUpload } from "@/lib/cloudflare-resources";
import {
  validatePasswordChangeForm,
  validateProfileUpdateForm,
} from "@/lib/profile-service";

export default function ProfilePage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>(
    {}
  );
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileAlert, setProfileAlert] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>(
    {}
  );
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordAlert, setPasswordAlert] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [signingOut, setSigningOut] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok: boolean;
          profile?: {
            firstName: string;
            lastName: string;
            country: string;
            phone: string;
            email: string;
            avatarUrl: string | null;
          };
        };
        if (data.ok && data.profile) {
          setFirstName(data.profile.firstName);
          setLastName(data.profile.lastName);
          setCountry(data.profile.country);
          setPhone(data.profile.phone);
          setEmail(data.profile.email);
          setAvatarUrl(data.profile.avatarUrl);
        }
      } catch {
        // Ignore initial load error in preview
      }
    }
    void loadProfile();
  }, []);

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarError(null);
    setAvatarMessage(null);

    const validation = validateMediaUpload({
      mimeType: file.type,
      sizeBytes: file.size,
    });
    if (!validation.valid) {
      setAvatarError(validation.error ?? "Imagen no válida.");
      return;
    }

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload/avatar", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as {
        ok: boolean;
        avatarUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setAvatarError(data.error ?? "No se pudo subir la foto.");
        return;
      }

      setAvatarUrl(data.avatarUrl ?? null);
      setAvatarMessage("Foto de perfil actualizada correctamente.");
    } catch {
      setAvatarError("Error de conexión al subir la imagen.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileMessage(null);
    setProfileAlert(null);

    const validation = validateProfileUpdateForm({
      firstName,
      lastName,
      country,
      phone,
      email,
    });
    setProfileErrors(validation.fieldErrors);
    if (!validation.valid) return;

    setSavingProfile(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName, lastName, country, phone, email }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        emailChanged?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setProfileAlert(data.error ?? "No se pudo actualizar el perfil.");
        return;
      }

      if (data.emailChanged) {
        setProfileMessage(
          "Perfil actualizado. Como cambiaste tu correo electrónico, hemos enviado un enlace de verificación a tu nueva dirección."
        );
      } else {
        setProfileMessage("Datos personales guardados correctamente.");
      }
    } catch {
      setProfileAlert("No fue posible conectar con el servidor.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordAlert(null);

    const validation = validatePasswordChangeForm({
      currentPassword,
      newPassword,
      confirmNewPassword,
    });
    setPasswordErrors(validation.fieldErrors);
    if (!validation.valid) return;

    setSavingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          revokeOtherSessions: false,
        }),
      });
      if (!res.ok) {
        setPasswordAlert(
          "No se pudo cambiar la contraseña. Verifica tu contraseña actual."
        );
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordMessage("Contraseña actualizada exitosamente.");
    } catch {
      setPasswordAlert("No fue posible conectar con el servidor.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
        credentials: "same-origin",
      });
    } finally {
      window.location.href = "/";
    }
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!res.ok || !data?.ok) {
        setDeleteError(
          data?.error ?? "No fue posible eliminar tu cuenta. Inténtalo de nuevo."
        );
        return;
      }

      window.location.href = "/";
    } catch {
      setDeleteError("No fue posible conectar con el servidor.");
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-between bg-paper text-ink">
      <Navbar currentPath="/perfil" />

      <main id="contenido" className="container flex-1 py-16 sm:py-24">
        <PageReveal className="mx-auto max-w-3xl">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-t border-rule pt-8">
            <h1>
              Mi <span className="ta-serif-italic">Perfil</span>
            </h1>
            <Link href="/" className="ta-inline-link text-sm">
              Volver al inicio
            </Link>
          </div>

          {/* Sección 1: Foto de perfil */}
          <section className="mb-8 rounded-[24px] border border-rule bg-surface p-7 shadow-card sm:p-8">
        <h2>Foto de perfil</h2>
        <p className="mt-2 text-xs text-muted">
          Formatos permitidos: JPG, PNG o WEBP (máximo 5 MB). Si resultas entre
          los 3 ganadores, esta foto se mostrará junto a tu cuento en la página
          de resultados.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-rule bg-paper text-lg font-bold text-ink">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Foto de perfil"
                className="h-full w-full object-cover"
              />
            ) : (
              <span>
                {(firstName[0] ?? "U").toUpperCase()}
                {(lastName[0] ?? "").toUpperCase()}
              </span>
            )}
          </div>

          <div>
            <label htmlFor="avatar-upload" className="btn btn--secondary">
              {avatarUploading ? "Subiendo…" : "Cambiar foto"}
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              disabled={avatarUploading}
              className="hidden"
            />
            {avatarError && (
              <p className="mt-2 text-xs text-error">{avatarError}</p>
            )}
            {avatarMessage && (
              <p className="mt-2 text-xs text-success">{avatarMessage}</p>
            )}
          </div>
        </div>
      </section>

      {/* Sección 2: Datos personales y Correo */}
      <section className="mb-8 rounded-[24px] border border-rule bg-surface p-7 shadow-card sm:p-8">
        <h2>Información personal y correo</h2>

        {profileAlert && (
          <div className="mt-4 border-l-2 border-error py-1 pl-3 text-sm text-error">
            {profileAlert}
          </div>
        )}
        {profileMessage && (
          <div className="mt-4 border-l-2 border-success py-1 pl-3 text-sm text-success">
            {profileMessage}
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="mt-5 space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="prof-first-name"
                className="block text-sm font-medium text-ink"
              >
                Nombre *
              </label>
              <input
                id="prof-first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1.5 block w-full rounded-input border border-rule bg-paper px-3.5 py-2.5 text-sm text-ink"
              />
              {profileErrors.firstName && (
                <p className="mt-1 text-xs text-error">
                  {profileErrors.firstName}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="prof-last-name"
                className="block text-sm font-medium text-ink"
              >
                Apellido *
              </label>
              <input
                id="prof-last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1.5 block w-full rounded-input border border-rule bg-paper px-3.5 py-2.5 text-sm text-ink"
              />
              {profileErrors.lastName && (
                <p className="mt-1 text-xs text-error">
                  {profileErrors.lastName}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="prof-country"
                className="block text-sm font-medium text-ink"
              >
                País de residencia *
              </label>
              <select
                id="prof-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="mt-1.5 block w-full rounded-input border border-rule bg-paper px-3.5 py-2.5 text-sm text-ink"
              >
                <option value="">Selecciona un país…</option>
                {COUNTRIES_LIST.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {profileErrors.country && (
                <p className="mt-1 text-xs text-error">
                  {profileErrors.country}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="prof-phone"
                className="block text-sm font-medium text-ink"
              >
                Número de teléfono *
              </label>
              <input
                id="prof-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1.5 block w-full rounded-input border border-rule bg-paper px-3.5 py-2.5 text-sm text-ink"
              />
              {profileErrors.phone && (
                <p className="mt-1 text-xs text-error">{profileErrors.phone}</p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="prof-email"
              className="block text-sm font-medium text-ink"
            >
              Correo electrónico *
            </label>
            <input
              id="prof-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 block w-full rounded-input border border-rule bg-paper px-3.5 py-2.5 text-sm text-ink"
            />
            {profileErrors.email && (
              <p className="mt-1 text-xs text-error">{profileErrors.email}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="btn btn--primary"
          >
            {savingProfile ? "Guardando…" : "Guardar cambios"}
          </button>
        </form>
      </section>

      {/* Sección 3: Cambiar contraseña */}
      <section className="rounded-[24px] border border-rule bg-surface p-7 shadow-card sm:p-8">
        <h2>Cambiar contraseña</h2>

        {passwordAlert && (
          <div className="mt-4 border-l-2 border-error py-1 pl-3 text-sm text-error">
            {passwordAlert}
          </div>
        )}
        {passwordMessage && (
          <div className="mt-4 border-l-2 border-success py-1 pl-3 text-sm text-success">
            {passwordMessage}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-4" noValidate>
          <div>
            <label
              htmlFor="prof-current-password"
              className="block text-sm font-medium text-ink"
            >
              Contraseña actual
            </label>
            <input
              id="prof-current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1.5 block w-full rounded-input border border-rule bg-paper px-3.5 py-2.5 text-sm text-ink"
            />
            {passwordErrors.currentPassword && (
              <p className="mt-1 text-xs text-error">
                {passwordErrors.currentPassword}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="prof-new-password"
                className="block text-sm font-medium text-ink"
              >
                Nueva contraseña
              </label>
              <input
                id="prof-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1.5 block w-full rounded-input border border-rule bg-paper px-3.5 py-2.5 text-sm text-ink"
              />
              {passwordErrors.newPassword && (
                <p className="mt-1 text-xs text-error">
                  {passwordErrors.newPassword}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="prof-confirm-new-password"
                className="block text-sm font-medium text-ink"
              >
                Confirmar nueva contraseña
              </label>
              <input
                id="prof-confirm-new-password"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="mt-1.5 block w-full rounded-input border border-rule bg-paper px-3.5 py-2.5 text-sm text-ink"
              />
              {passwordErrors.confirmNewPassword && (
                <p className="mt-1 text-xs text-error">
                  {passwordErrors.confirmNewPassword}
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={savingPassword}
            className="btn btn--secondary"
          >
            {savingPassword ? "Actualizando…" : "Actualizar contraseña"}
          </button>
        </form>
      </section>

      {/* Sección 4: Sesión y eliminación de cuenta */}
      <section className="mt-8 rounded-[24px] border border-rule bg-surface p-7 shadow-card sm:p-8">
        <h2>Sesión y cuenta</h2>
        <p className="mt-2 text-sm text-muted">
          Cierra tu sesión actual en este dispositivo o elimina tu cuenta de
          forma permanente.
        </p>

        {deleteError && !showDeleteModal && (
          <div
            role="alert"
            className="mt-4 rounded-input border border-error/30 bg-error/5 px-4 py-3 text-sm text-error"
          >
            {deleteError}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-6">
          <button
            type="button"
            onClick={() => {
              setDeleteError(null);
              setShowDeleteModal(true);
            }}
            className="btn border-error/40 bg-surface text-error hover:border-error hover:bg-error/5"
          >
            Eliminar cuenta
          </button>

          <button
            type="button"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
            className="btn btn--secondary"
          >
            {signingOut ? "Cerrando sesión…" : "Cerrar sesión"}
          </button>
        </div>
      </section>
        </PageReveal>
      </main>

      {showDeleteModal && (
        <div
          className="ta-modal-backdrop"
          onClick={() => !deletingAccount && setShowDeleteModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="ta-modal-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="delete-account-title"
              className="font-display text-2xl font-bold tracking-display text-ink"
            >
              ¿Eliminar tu cuenta permanentemente?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Esta acción cerrará tu sesión y borrará tus datos personales y
              accesos vinculados. No se puede deshacer.
            </p>

            {deleteError && (
              <div
                role="alert"
                className="mt-4 rounded-input border border-error/30 bg-error/5 px-4 py-3 text-sm text-error"
              >
                {deleteError}
              </div>
            )}

            <div className="mt-7 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={deletingAccount}
                onClick={() => setShowDeleteModal(false)}
                className="btn btn--secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingAccount}
                onClick={() => void handleDeleteAccount()}
                className="btn border-error bg-error text-accent-ink hover:opacity-90"
              >
                {deletingAccount ? "Eliminando…" : "Sí, eliminar mi cuenta"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
