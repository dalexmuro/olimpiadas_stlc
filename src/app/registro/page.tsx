"use client";

import { useState, type FormEvent } from "react";
import { APP_BRAND } from "@/lib/app-metadata";
import { COUNTRIES_LIST, validateRegisterForm } from "@/lib/auth-forms";

export default function RegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    const validation = validateRegisterForm({
      firstName,
      lastName,
      country,
      phone,
      email,
      password,
      confirmPassword,
    });
    setFieldErrors(validation.fieldErrors);
    if (!validation.valid) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: `${firstName.trim()} ${lastName.trim()}`,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          country: country.trim(),
          phone: phone.trim(),
          profileCompleted: true,
          email: email.trim(),
          password,
        }),
      });

      if (!response.ok) {
        setServerError(
          "No se pudo completar el registro. Verifica si el correo ya está registrado."
        );
        return;
      }

      window.location.href = "/verificar-correo?registrado=1";
    } catch {
      setServerError(
        "No fue posible conectar con el servidor. Inténtalo de nuevo."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleOAuthSignIn(provider: "google" | "microsoft") {
    window.location.href = `/api/auth/sign-in/social?provider=${provider}&callbackURL=/completar-perfil`;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
          {APP_BRAND.clubName}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Crear cuenta en el sitio
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Todos los campos son obligatorios para poder participar en las{" "}
          {APP_BRAND.contestName}.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleOAuthSignIn("google")}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Registrarse con Google
          </button>
          <button
            type="button"
            onClick={() => handleOAuthSignIn("microsoft")}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Registrarse con Microsoft
          </button>
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-slate-500">o con tu correo</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {serverError && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="reg-first-name"
                className="block text-sm font-medium text-slate-700"
              >
                Nombre *
              </label>
              <input
                id="reg-first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
              {fieldErrors.firstName && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.firstName}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="reg-last-name"
                className="block text-sm font-medium text-slate-700"
              >
                Apellido *
              </label>
              <input
                id="reg-last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
              {fieldErrors.lastName && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.lastName}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="reg-country"
                className="block text-sm font-medium text-slate-700"
              >
                País de residencia *
              </label>
              <select
                id="reg-country"
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
              {fieldErrors.country && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.country}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="reg-phone"
                className="block text-sm font-medium text-slate-700"
              >
                Número de teléfono *
              </label>
              <input
                id="reg-phone"
                type="tel"
                placeholder="+58 412 1234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
              {fieldErrors.phone && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="reg-email"
              className="block text-sm font-medium text-slate-700"
            >
              Correo electrónico *
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
            />
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="reg-password"
                className="block text-sm font-medium text-slate-700"
              >
                Contraseña *
              </label>
              <input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="reg-confirm-password"
                className="block text-sm font-medium text-slate-700"
              >
                Confirmar contraseña *
              </label>
              <input
                id="reg-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
              {fieldErrors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 disabled:opacity-50"
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          ¿Ya tienes una cuenta?{" "}
          <a
            href="/login"
            className="font-semibold text-indigo-700 hover:underline"
          >
            Iniciar sesión
          </a>
        </p>
      </div>
    </main>
  );
}
