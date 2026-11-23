"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { PageReveal } from "@/components/layout/PageReveal";
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
    <div className="flex min-h-screen flex-col bg-paper pb-28 text-ink">
      <Navbar currentPath="/recuperar-clave" />

      <main
        id="contenido"
        className="container flex flex-1 items-center justify-center py-10"
      >
        <PageReveal className="w-full max-w-md">
          <div className="w-full rounded-[28px] border border-rule bg-surface p-8 shadow-card sm:p-10">
          <h1 className="text-3xl sm:text-4xl">
            Recuperar <span className="ta-serif-italic">contraseña</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Ingresa tu correo electrónico y te enviaremos un enlace seguro para
            crear una nueva contraseña.
          </p>

          {submitted ? (
            <div className="mt-6 rounded-input border border-success/30 bg-accent-soft px-4 py-3 text-sm text-accent-deep">
              Si el correo <strong>{email}</strong> está registrado en nuestra
              plataforma, recibirás en unos instantes las instrucciones para
              restablecer tu contraseña.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <div>
                <label
                  htmlFor="recover-email"
                  className="block text-sm font-semibold text-ink"
                >
                  Correo electrónico
                </label>
                <input
                  id="recover-email"
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

              <button
                type="submit"
                disabled={loading}
                className="btn btn--primary w-full"
              >
                {loading ? "Enviando enlace…" : "Enviar enlace"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted">
            <Link href="/login" className="ta-inline-link">
              Volver a entrar
            </Link>
          </p>
          </div>
        </PageReveal>
      </main>
    </div>
  );
}
