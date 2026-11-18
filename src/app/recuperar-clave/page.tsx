"use client";

import { useState, type FormEvent } from "react";
import { APP_BRAND } from "@/lib/app-metadata";
import { validateForgotPasswordForm } from "@/lib/auth-forms";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateForgotPasswordForm(email);
    setFieldErrors(validation.fieldErrors);
    if (!validation.valid) {
      return;
    }

    setLoading(true);
    try {
      await fetch("/api/auth/forget-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          redirectTo: "/recuperar-clave",
        }),
      });
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
          {APP_BRAND.clubName}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Recuperar contraseña
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Ingresa tu correo electrónico y te enviaremos un enlace seguro para
          crear una nueva contraseña.
        </p>

        {submitted ? (
          <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Si el correo <strong>{email}</strong> está registrado en nuestra
            plataforma, recibirás en unos instantes las instrucciones para
            restablecer tu contraseña.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label
                htmlFor="recover-email"
                className="block text-sm font-medium text-slate-700"
              >
                Correo electrónico
              </label>
              <input
                id="recover-email"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 disabled:opacity-50"
            >
              {loading
                ? "Enviando enlace..."
                : "Enviar enlace de recuperación"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          <a
            href="/login"
            className="font-semibold text-indigo-700 hover:underline"
          >
            Volver a iniciar sesión
          </a>
        </p>
      </div>
    </main>
  );
}
