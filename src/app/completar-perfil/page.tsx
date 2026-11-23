"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { PageReveal } from "@/components/layout/PageReveal";
import { APP_BRAND } from "@/lib/app-metadata";
import { COUNTRIES_LIST } from "@/lib/auth-forms";
import { validateProfileCompletionForm } from "@/lib/profile-gate";

export default function CompleteProfilePage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function preloadProfile() {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok: boolean;
          profile?: {
            firstName?: string;
            lastName?: string;
            country?: string;
            phone?: string;
          };
        };
        if (data.ok && data.profile) {
          if (data.profile.firstName) setFirstName(data.profile.firstName);
          if (data.profile.lastName) setLastName(data.profile.lastName);
          if (data.profile.country) setCountry(data.profile.country);
          if (data.profile.phone) setPhone(data.profile.phone);
        }
      } catch {
        // Ignore preload error and let the user fill fields manually
      }
    }
    void preloadProfile();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    const validation = validateProfileCompletionForm({
      firstName,
      lastName,
      country,
      phone,
    });
    setFieldErrors(validation.fieldErrors);
    if (!validation.valid) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/profile/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName, lastName, country, phone }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setServerError(
          data.error ?? "No se pudo guardar tu información. Inténtalo de nuevo."
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

  return (
    <div className="flex min-h-screen flex-col bg-paper pb-28 text-ink">
      <Navbar currentPath="/completar-perfil" />

      <main
        id="contenido"
        className="container flex flex-1 items-center justify-center py-10"
      >
        <PageReveal className="w-full max-w-lg">
          <div className="w-full rounded-[28px] border border-rule bg-surface p-8 shadow-card sm:p-10">
          <h1 className="text-3xl sm:text-4xl">
            Completa tu <span className="ta-serif-italic">perfil</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Para continuar en las{" "}
            <strong className="text-ink">{APP_BRAND.contestName}</strong>, es
            necesario completar tus datos personales obligatorios.
          </p>

        {serverError && (
          <div
            role="alert"
            className="mt-4 rounded-input border border-error/30 bg-error/5 px-4 py-3 text-sm text-error"
          >
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="complete-first-name"
                className="block text-sm font-medium text-ink"
              >
                Nombre *
              </label>
              <input
                id="complete-first-name"
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
                htmlFor="complete-last-name"
                className="block text-sm font-medium text-ink"
              >
                Apellido *
              </label>
              <input
                id="complete-last-name"
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
                htmlFor="complete-country"
                className="block text-sm font-medium text-ink"
              >
                País de residencia *
              </label>
              <select
                id="complete-country"
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
                htmlFor="complete-phone"
                className="block text-sm font-medium text-ink"
              >
                Número de teléfono *
              </label>
              <input
                id="complete-phone"
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

          <button
            type="submit"
            disabled={loading}
            className="btn btn--primary w-full"
          >
            {loading ? "Guardando…" : "Guardar y continuar"}
          </button>
        </form>
          </div>
        </PageReveal>
      </main>
    </div>
  );
}
