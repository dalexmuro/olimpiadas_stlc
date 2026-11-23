"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { PageReveal } from "@/components/layout/PageReveal";
import { APP_BRAND } from "@/lib/app-metadata";
import { validateLoginForm } from "@/lib/auth-forms";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    const validation = validateLoginForm({ email, password });
    setFieldErrors(validation.fieldErrors);
    if (!validation.valid) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!response.ok) {
        setServerError(
          "Correo o contraseña incorrectos, o tu cuenta aún no ha sido verificada."
        );
        return;
      }

      window.location.href = "/concurso";
    } catch {
      setServerError(
        "No fue posible conectar con el servidor. Inténtalo de nuevo."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuthSignIn(provider: "google" | "microsoft") {
    setServerError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/sign-in/social", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          callbackURL: "/concurso",
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        url?: string;
        message?: string;
      } | null;

      if (!response.ok || !data?.url) {
        setServerError(
          data?.message ??
            "No fue posible iniciar sesión con este proveedor. Inténtalo de nuevo."
        );
        return;
      }

      window.location.href = data.url;
    } catch {
      setServerError(
        "No fue posible conectar con el servidor. Inténtalo de nuevo."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink pb-28">
      <Navbar currentPath="/login" />

      <main
        id="contenido"
        className="container flex flex-1 items-center justify-center py-6 sm:py-10"
      >
        <PageReveal className="w-full max-w-4xl">
          <section className="ta-split-auth w-full">
          <div className="ta-split-panel">
            <span className="text-sm font-semibold opacity-90">
              {APP_BRAND.contestName}
            </span>

            <div>
              <h2 className="text-accent-ink">
                Tu próxima{" "}
                <span className="font-serif italic font-normal">historia</span>{" "}
                empieza aquí.
              </h2>
              <p className="mt-4 max-w-sm text-base leading-relaxed text-accent-ink/90">
                Inicia sesión o crea tu cuenta en segundos para participar en la
                comunidad.
              </p>
            </div>

            <span className="text-xs font-medium opacity-80">
              Organizado por {APP_BRAND.clubName}
            </span>
          </div>

          <div className="flex flex-col justify-center p-8 sm:p-11">
            <h1 className="text-3xl sm:text-4xl">Entrar</h1>
            <p className="mt-2 text-sm text-muted">
              Accede a tu cuenta de las {APP_BRAND.contestName}.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleOAuthSignIn("google")}
                className="btn btn--secondary w-full"
              >
                Con Google
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleOAuthSignIn("microsoft")}
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
                className="mb-4 rounded-input border border-error/30 bg-error/5 px-4 py-3 text-sm text-error"
              >
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-sm font-semibold text-ink"
                >
                  Correo electrónico
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 block w-full rounded-input border border-rule bg-paper px-4 py-3 text-sm text-ink"
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-xs text-error">{fieldErrors.email}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-semibold text-ink"
                  >
                    Contraseña
                  </label>
                  <Link
                    href="/recuperar-clave"
                    className="inline-flex min-h-[44px] items-center text-xs font-semibold text-accent-2 hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-input border border-rule bg-paper px-4 py-3 text-sm text-ink"
                />
                {fieldErrors.password && (
                  <p className="mt-1 text-xs text-error">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn--primary mt-2 w-full"
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-muted">
              ¿Aún no tienes cuenta?{" "}
              <Link href="/registro" className="ta-inline-link">
                Crear cuenta
              </Link>
            </p>
          </div>
          </section>
        </PageReveal>
      </main>
    </div>
  );
}
