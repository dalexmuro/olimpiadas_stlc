import { APP_BRAND } from "@/lib/app-metadata";

export default function VerifyEmailPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          Verificación de cuenta
        </span>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">
          Revisa tu correo electrónico
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Te hemos enviado un correo electrónico de bienvenida desde{" "}
          <strong>{APP_BRAND.supportEmail}</strong> con un enlace para verificar
          tu cuenta en las <strong>{APP_BRAND.contestName}</strong>.
        </p>
        <p className="mt-3 text-xs text-slate-500">
          Si no lo encuentras en tu bandeja principal, revisa la carpeta de
          Promociones o Correo no deseado (Spam).
        </p>
        <div className="mt-6">
          <a
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800"
          >
            Ir a iniciar sesión
          </a>
        </div>
      </div>
    </main>
  );
}
