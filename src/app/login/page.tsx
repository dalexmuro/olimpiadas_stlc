"use client";

import { useState, type FormEvent } from "react";
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

      window.location.href = "/";
    } catch {
      setServerError(
        "No fue posible conectar con el servidor. Inténtalo de nuevo."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleOAuthSignIn(provider: "google" | "microsoft") {
    window.location.href = `/api/auth/sign-in/social?provider=${provider}&callbackURL=/`;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
          {APP_BRAND.clubName}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Iniciar sesión
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Accede a tu cuenta de las {APP_BRAND.contestName}.
        </p>

        <div className="mt-6 grid gap-3">
          <button
            type="button"
            onClick={() => handleOAuthSignIn("google")}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Continuar con Google
          </button>
          <button
            type="button"
            onClick={() => handleOAuthSignIn("microsoft")}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Continuar con Microsoft
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
          <div>
            <label
              htmlFor="login-email"
              className="block text-sm font-medium text-slate-700"
            >
              Correo electrónico
            </label>
            <input
              id="login-email"
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

          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-slate-700"
              >
                Contraseña
              </label>
              <a
                href="/recuperar-clave"
                className="text-xs font-medium text-indigo-700 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </a>
            </div>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 disabled:opacity-50"
          >
            {loading ? "Iniciando sesión..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          ¿Aún no tienes cuenta?{" "}
          <a
            href="/registro"
            className="font-semibold text-indigo-700 hover:underline"
          >
            Crear cuenta
          </a>
        </p>
      </div>
    </main>
  );
}
