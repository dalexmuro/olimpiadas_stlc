"use client";

import { useState, type FormEvent } from "react";
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
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
          Paso obligatorio
        </span>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">
          Completa tu perfil
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Para continuar en las <strong>{APP_BRAND.contestName}</strong>, es
          necesario que completes todos tus datos personales obligatorios.
        </p>

        {serverError && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="complete-first-name"
                className="block text-sm font-medium text-slate-700"
              >
                Nombre *
              </label>
              <input
                id="complete-first-name"
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
                htmlFor="complete-last-name"
                className="block text-sm font-medium text-slate-700"
              >
                Apellido *
              </label>
              <input
                id="complete-last-name"
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
                htmlFor="complete-country"
                className="block text-sm font-medium text-slate-700"
              >
                País de residencia *
              </label>
              <select
                id="complete-country"
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
                htmlFor="complete-phone"
                className="block text-sm font-medium text-slate-700"
              >
                Número de teléfono *
              </label>
              <input
                id="complete-phone"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 disabled:opacity-50"
          >
            {loading ? "Guardando datos..." : "Guardar y continuar"}
          </button>
        </form>
      </div>
    </main>
  );
}
