"use client";

import { Check, Eye, EyeOff, Info } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { PageReveal } from "@/components/layout/PageReveal";
import { APP_BRAND } from "@/lib/app-metadata";
import {
  COUNTRIES_LIST,
  evaluatePasswordStrength,
  validateRegisterForm,
} from "@/lib/auth-forms";

export default function RegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordInfo, setShowPasswordInfo] = useState(false);
  const passwordInfoRef = useRef<HTMLDivElement>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [duplicateEmailAlert, setDuplicateEmailAlert] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordStrength = evaluatePasswordStrength(password);

  useEffect(() => {
    if (!showPasswordInfo) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        passwordInfoRef.current &&
        !passwordInfoRef.current.contains(event.target as Node)
      ) {
        setShowPasswordInfo(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowPasswordInfo(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showPasswordInfo]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    setDuplicateEmailAlert(false);

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
      // Verify email availability before creating account
      const checkRes = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (checkRes.ok) {
        const checkData = (await checkRes.json()) as {
          ok?: boolean;
          exists?: boolean;
        };
        if (checkData.exists) {
          setDuplicateEmailAlert(true);
          setFieldErrors((prev) => ({
            ...prev,
            email: "Este correo electrónico ya tiene una cuenta registrada.",
          }));
          setServerError(
            "Ya existe una cuenta registrada con este correo electrónico."
          );
          return;
        }
      }

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

  async function handleOAuthSignIn(provider: "google" | "microsoft") {
    setServerError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/sign-in/social", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          callbackURL: "/completar-perfil",
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        url?: string;
        message?: string;
      } | null;

      if (!response.ok || !data?.url) {
        setServerError(
          data?.message ??
            "No fue posible continuar con este proveedor. Inténtalo de nuevo."
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
    <div className="flex min-h-screen flex-col bg-paper pb-28 text-ink">
      <Navbar currentPath="/registro" />

      <main
        id="contenido"
        className="container flex flex-1 items-center justify-center py-6 sm:py-10"
      >
        <PageReveal className="w-full max-w-5xl">
          <section className="ta-split-auth w-full">
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
            disabled={loading}
            onClick={() => void handleOAuthSignIn("google")}
            aria-label="Registrarse con Google"
            className="btn btn--secondary w-full"
          >
            Con Google
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleOAuthSignIn("microsoft")}
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
            className="mb-4 rounded-input border border-error/30 bg-error/5 px-4 py-3 text-sm text-error"
          >
            <p>{serverError}</p>
            {duplicateEmailAlert && (
              <p className="mt-1.5 text-xs text-ink">
                Puedes{" "}
                <Link href="/login" className="ta-inline-link">
                  iniciar sesión
                </Link>{" "}
                o{" "}
                <Link href="/recuperar-clave" className="ta-inline-link">
                  recuperar tu contraseña
                </Link>
                .
              </p>
            )}
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
              <div
                ref={passwordInfoRef}
                className="relative flex items-center gap-1.5"
              >
                <label
                  htmlFor="reg-password"
                  className="block text-sm font-medium text-ink"
                >
                  Contraseña *
                </label>
                <button
                  type="button"
                  onClick={() => setShowPasswordInfo((prev) => !prev)}
                  aria-expanded={showPasswordInfo}
                  aria-controls="password-rules-popover"
                  aria-label="Ver requisitos de seguridad de la contraseña"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-accent-deep"
                >
                  <Info className="h-4 w-4" aria-hidden="true" />
                </button>

                {showPasswordInfo && (
                  <div
                    id="password-rules-popover"
                    role="tooltip"
                    className="absolute bottom-full left-0 z-20 mb-2 w-72 rounded-[16px] border border-rule bg-surface p-4 text-xs shadow-card"
                  >
                    <p className="font-semibold text-ink">
                      Requisitos de contraseña
                    </p>
                    <div
                      className={`mt-2 flex items-center gap-1.5 ${passwordStrength.minLength ? "font-medium text-accent-deep" : "text-muted"}`}
                    >
                      <Check
                        className={`h-3.5 w-3.5 shrink-0 ${passwordStrength.minLength ? "opacity-100" : "opacity-30"}`}
                        aria-hidden="true"
                      />
                      <span>Al menos 8 caracteres</span>
                    </div>
                    <p className="mt-2.5 text-muted">
                      Y al menos 3 de los siguientes (
                      <span className="num font-semibold text-ink">
                        {Math.min(passwordStrength.categoriesMet, 3)}/3
                      </span>
                      ):
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {[
                        {
                          ok: passwordStrength.hasUppercase,
                          label: "Una mayúscula",
                        },
                        {
                          ok: passwordStrength.hasLowercase,
                          label: "Una minúscula",
                        },
                        { ok: passwordStrength.hasNumber, label: "Un número" },
                        {
                          ok: passwordStrength.hasSpecial,
                          label: "Un carácter especial",
                        },
                      ].map((rule) => (
                        <li
                          key={rule.label}
                          className={`flex items-center gap-1.5 ${rule.ok ? "font-medium text-accent-deep" : "text-muted"}`}
                        >
                          <Check
                            className={`h-3.5 w-3.5 shrink-0 ${rule.ok ? "opacity-100" : "opacity-30"}`}
                            aria-hidden="true"
                          />
                          <span>{rule.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="relative mt-1.5">
                <input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-input border border-rule bg-paper py-2.5 pl-3.5 pr-11 text-sm text-ink"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-muted transition-colors hover:text-ink"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
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
              <div className="relative mt-1.5">
                <input
                  id="reg-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full rounded-input border border-rule bg-paper py-2.5 pl-3.5 pr-11 text-sm text-ink"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={
                    showConfirmPassword
                      ? "Ocultar confirmación de contraseña"
                      : "Mostrar confirmación de contraseña"
                  }
                  aria-pressed={showConfirmPassword}
                  className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-muted transition-colors hover:text-ink"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
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
        </PageReveal>
      </main>
    </div>
  );
}
