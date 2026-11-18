import { APP_BRAND, PUBLIC_NAVIGATION_LINKS } from "@/lib/app-metadata";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-between px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
            Club de Escritura {APP_BRAND.clubName}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {APP_BRAND.contestName}
          </h1>
        </div>
        <nav aria-label="Navegación principal" className="flex flex-wrap gap-4">
          {PUBLIC_NAVIGATION_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-indigo-700"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </header>

      <section className="my-12 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
        <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          Zona horaria oficial: {APP_BRAND.officialTimezone} (
          {APP_BRAND.officialUtcOffset})
        </span>
        <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Bienvenido a las {APP_BRAND.contestName}
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
          {APP_BRAND.description}
        </p>
      </section>

      <footer className="border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} {APP_BRAND.contestName} —{" "}
        {APP_BRAND.clubName}
      </footer>
    </main>
  );
}
