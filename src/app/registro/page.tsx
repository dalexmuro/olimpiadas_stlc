"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Navbar } from "@/components/layout/Navbar";
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
    <div className="flex min-h-screen flex-col bg-paper pb-28 text-ink">
      <Navbar currentPath="/registro" />

      <main
        id="contenido"
        className="container flex flex-1 items-center justify-center py-6 sm:py-10"
      >
        <section className="ta-split-auth w-full max-w-5xl">
          <div className="ta-split-panel">
            <span className="text-sm font-semibold opacity-90">
              {APP_BRAND.contestName}
            </span>

            <div>
              <h2 className="text-accent-ink">
                Únete a la{" "}
                <span className="font-serif italic font-normal">comunidad</span>
                .
              </h2>
              <p className="mt-4 max-w-sm text-base leading-relaxed text-accent-ink/90">
                Crea tu cuenta permanente una sola vez para recibir avisos y
                participar en las próximas ediciones.
              </p>
            </div>

            <span className="text-xs font-medium opacity-80">
              Organizado por {APP_BRAND.clubName}
            </span>
          </div>

          <div className="flex flex-col justify-center p-8 sm:p-11">
            <h1 className="text-3xl sm:text-4xl">Crear cuenta</h1>
            <p className="mt-2 text-sm text-muted">
              Todos los campos son obligatorios para participar en las{" "}
              {APP_BRAND.contestName}.
            </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleOAuthSignIn("google")}
            aria-label="Registrarse con Google"
            className="btn btn--secondary w-full"
          >
            Con Google
          </button>
          <button
            type="button"
            onClick={() => handleOAuthSignIn("microsoft")}
            aria-label="Registrarse con Microsoft"
            className="btn btn--secondary w-full"
          >
            Con Microsoft
          </button>
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-rule" />
          <span className="text-xs text-muted">o con tu correo</span>
          <div className="h-px flex-1 bg-rule" />
        </div>

        {serverError && (
          <div
            role="alert"
            className="mb-4 border-l-2 border-error py-1 pl-3 text-sm text-error"
          >
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="reg-first-name"
                className="block text-sm font-medium text-ink"
              >
                Nombre *
              </label>
              <input
                id="reg-first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1.5 block w-full rounded-input border border-rule bg-paper px-3.5 py-2.5 text-sm text-ink"
              />
              {fieldErrors.firstName && (
                <p className="mt-1 text-xs text-error">
                  {fieldErrors.firstName}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="reg-last-name"
                className="block text-sm font-medium text-ink"
              >
                Apellido *
              </label>
              <input
                id="reg-last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1.5 block w-full rounded-input border border-rule bg-paper px-3.5 py-2.5 text-sm text-ink"
              />
              {fieldErrors.lastName && (
                <p className="mt-1 text-xs text-error">
                  {fieldErrors.lastName}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="reg-country"
                className="block text-sm font-medium text-ink"
              >
                País de residencia *
              </label>
              <select
                id="reg-country"
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
              {fieldErrors.country && (
                <p className="mt-1 text-xs text-error">{fieldErrors.country}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="reg-phone"
                className="block text-sm font-medium text-ink"
              >
                Número de teléfono *
              </label>
              <input
                id="reg-phone"
                type="tel"
                placeholder="+58 412 1234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1.5 block w-full rounded-input border border-rule bg-paper px-3.5 py-2.5 text-sm text-ink"
              />
              {fieldErrors.phone && (
                <p className="mt-1 text-xs text-error">{fieldErrors.phone}</p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="reg-email"
              className="block text-sm font-medium text-ink"
            >
              Correo electrónico *
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 block w-full rounded-input border border-rule bg-paper px-3.5 py-2.5 text-sm text-ink"
            />
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-error">{fieldErrors.email}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="reg-password"
                className="block text-sm font-medium text-ink"
              >
                Contraseña *
              </label>
              <input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 block w-full rounded-input border border-rule bg-paper px-3.5 py-2.5 text-sm text-ink"
              />
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-error">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="reg-confirm-password"
                className="block text-sm font-medium text-ink"
              >
                Confirmar contraseña *
              </label>
              <input
                id="reg-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1.5 block w-full rounded-input border border-rule bg-paper px-3.5 py-2.5 text-sm text-ink"
              />
              {fieldErrors.confirmPassword && (
                <p className="mt-1 text-xs text-error">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn--primary w-full"
          >
            {loading ? "Creando cuenta…" : "Crear cuenta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          ¿Ya tienes una cuenta?{" "}
          <Link href="/login" className="ta-inline-link">
            Entrar
          </Link>
        </p>
          </div>
        </section>
      </main>
    </div>
  );
}
