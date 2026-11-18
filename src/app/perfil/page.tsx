"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { APP_BRAND } from "@/lib/app-metadata";
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

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
            {APP_BRAND.contestName}
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Mi Perfil</h1>
        </div>
        <a
          href="/"
          className="text-sm font-semibold text-indigo-700 hover:underline"
        >
          Volver al inicio
        </a>
      </div>

      {/* Sección 1: Foto de perfil */}
      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Foto de perfil</h2>
        <p className="mt-1 text-xs text-slate-500">
          Formatos permitidos: JPG, PNG o WEBP (máximo 5 MB). Si resultas entre
          los 3 ganadores, esta foto se mostrará junto a tu cuento en la página
          de resultados.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-lg font-bold text-slate-500">
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
            <label
              htmlFor="avatar-upload"
              className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {avatarUploading ? "Subiendo..." : "Cambiar foto"}
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
              <p className="mt-2 text-xs text-red-600">{avatarError}</p>
            )}
            {avatarMessage && (
              <p className="mt-2 text-xs text-emerald-700">{avatarMessage}</p>
            )}
          </div>
        </div>
      </section>

      {/* Sección 2: Datos personales y Correo */}
      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Información personal y correo
        </h2>

        {profileAlert && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {profileAlert}
          </div>
        )}
        {profileMessage && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {profileMessage}
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="mt-4 space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="prof-first-name"
                className="block text-sm font-medium text-slate-700"
              >
                Nombre *
              </label>
              <input
                id="prof-first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
              {profileErrors.firstName && (
                <p className="mt-1 text-xs text-red-600">
                  {profileErrors.firstName}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="prof-last-name"
                className="block text-sm font-medium text-slate-700"
              >
                Apellido *
              </label>
              <input
                id="prof-last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
              {profileErrors.lastName && (
                <p className="mt-1 text-xs text-red-600">
                  {profileErrors.lastName}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="prof-country"
                className="block text-sm font-medium text-slate-700"
              >
                País de residencia *
              </label>
              <select
                id="prof-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              >
                <option value="">Selecciona un país...</option>
                {COUNTRIES_LIST.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {profileErrors.country && (
                <p className="mt-1 text-xs text-red-600">
                  {profileErrors.country}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="prof-phone"
                className="block text-sm font-medium text-slate-700"
              >
                Número de teléfono *
              </label>
              <input
                id="prof-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
              {profileErrors.phone && (
                <p className="mt-1 text-xs text-red-600">
                  {profileErrors.phone}
                </p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="prof-email"
              className="block text-sm font-medium text-slate-700"
            >
              Correo electrónico *
            </label>
            <input
              id="prof-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
            />
            {profileErrors.email && (
              <p className="mt-1 text-xs text-red-600">{profileErrors.email}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="rounded-lg bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 disabled:opacity-50"
          >
            {savingProfile ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      </section>

      {/* Sección 3: Cambiar contraseña */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Cambiar contraseña
        </h2>

        {passwordAlert && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {passwordAlert}
          </div>
        )}
        {passwordMessage && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {passwordMessage}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-4" noValidate>
          <div>
            <label
              htmlFor="prof-current-password"
              className="block text-sm font-medium text-slate-700"
            >
              Contraseña actual
            </label>
            <input
              id="prof-current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
            />
            {passwordErrors.currentPassword && (
              <p className="mt-1 text-xs text-red-600">
                {passwordErrors.currentPassword}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="prof-new-password"
                className="block text-sm font-medium text-slate-700"
              >
                Nueva contraseña
              </label>
              <input
                id="prof-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
              {passwordErrors.newPassword && (
                <p className="mt-1 text-xs text-red-600">
                  {passwordErrors.newPassword}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="prof-confirm-new-password"
                className="block text-sm font-medium text-slate-700"
              >
                Confirmar nueva contraseña
              </label>
              <input
                id="prof-confirm-new-password"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
              {passwordErrors.confirmNewPassword && (
                <p className="mt-1 text-xs text-red-600">
                  {passwordErrors.confirmNewPassword}
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={savingPassword}
            className="rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:opacity-50"
          >
            {savingPassword
              ? "Actualizando contraseña..."
              : "Actualizar contraseña"}
          </button>
        </form>
      </section>
    </main>
  );
}
