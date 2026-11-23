import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { APP_BRAND } from "@/lib/app-metadata";

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper pb-28 text-ink">
      <Navbar currentPath="/verificar-correo" />

      <main
        id="contenido"
        className="container flex flex-1 items-center justify-center py-10"
      >
        <div className="w-full max-w-md rounded-[28px] border border-rule bg-surface p-8 text-center shadow-card sm:p-10">
          <h1 className="text-3xl sm:text-4xl">
            Revisa tu <span className="ta-serif-italic">correo</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Te hemos enviado un correo de bienvenida desde{" "}
            <strong className="text-ink">{APP_BRAND.supportEmail}</strong> con
            un enlace para verificar tu cuenta en las{" "}
            <strong className="text-ink">{APP_BRAND.contestName}</strong>.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Si no lo encuentras en tu bandeja principal, revisa la carpeta de
            Promociones o Correo no deseado.
          </p>
          <div className="mt-8">
            <Link href="/login" className="btn btn--primary w-full">
              Ir a entrar
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
