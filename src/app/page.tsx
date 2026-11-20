import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { APP_BRAND } from "@/lib/app-metadata";

const CONTEST_FAQS = [
  {
    question: "¿Cómo se entra al certamen?",
    answer:
      "Creas tu cuenta una sola vez en la plataforma con correo y contraseña, Google o Microsoft. Cuando abre la edición anual, confirmas tu inscripción aceptando las bases.",
  },
  {
    question: "¿Cómo funcionan las consignas?",
    answer:
      "El equipo organizador publica consignas programadas. Escribes un cuento en texto plano por consigna respetando el límite de caracteres y el cierre en hora de Caracas.",
  },
  {
    question: "¿Qué pasa al elegir mi cuento a postular?",
    answer:
      "Al cerrar la escritura, lees todos tus cuentos enviados, eliges uno de forma definitiva y puedes pulir su estilo y ortografía conservando la esencia del relato original.",
  },
  {
    question: "¿Cómo se definen los tres ganadores?",
    answer:
      "Todos los autores activos leen de forma anónima y votan por su podio. Los diez cuentos más votados pasan a un jurado impar que define el resultado final.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col justify-between bg-paper text-ink">
      <Navbar currentPath="/" />

      <main className="flex-1">
        {/* Hero Banner (visible within 1280x800 above the fold) */}
        <section className="container pt-14 pb-20 sm:pt-20 sm:pb-24">
          <div className="grid grid-cols-1 items-end gap-10 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <p className="text-sm font-medium text-muted">
                Club de escritura {APP_BRAND.clubName}, hora oficial de Caracas
                ({APP_BRAND.officialUtcOffset})
              </p>
              <h1 className="mt-4">
                <span className="misreg" data-text="Olimpíadas">
                  Olimpíadas
                </span>{" "}
                Literarias de SiTeLoCuento.
              </h1>
              <p className="lead mt-6 text-ink-2">
                Certamen anual de cuentos cortos con consignas, edición y lectura
                anónima.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a href="/registro" className="btn btn--primary">
                  Crear cuenta
                </a>
                <a href="/login" className="btn btn--secondary">
                  Iniciar sesión
                </a>
                <a href="/bases-del-concurso" className="riso-link text-sm font-medium">
                  Leer las bases del concurso
                </a>
              </div>
            </div>

            <div className="lg:col-span-4">
              <div
                data-slot="logo-olimpiadas"
                data-alt="Emblema oficial de las Olimpíadas Literarias de SiTeLoCuento"
                className="flex min-h-48 flex-col justify-between rounded-card border border-ink p-6"
              >
                <span className="text-sm font-medium text-muted">
                  Emblema oficial de la edición
                </span>
                <p className="font-display text-2xl font-extrabold text-ink">
                  {APP_BRAND.clubName}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Three-plate risograph process separations (Riso Range: Steps as separations) */}
        <section className="border-t border-rule py-20 sm:py-24">
          <div className="container">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-end">
              <h2 className="lg:col-span-7">Tres pasadas, un solo cuento</h2>
              <p className="text-ink-2 lg:col-span-5">
                Desde la primera consigna hasta la lectura del jurado, cada
                etapa se imprime sobre la anterior.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
              <article>
                <div className="riso-plate">
                  <span className="text-sm font-medium text-muted">
                    Primera pasada
                  </span>
                  <p className="font-display text-3xl font-extrabold leading-none text-ink">
                    Consignas en tiempo real
                  </p>
                </div>
                <h3 className="mt-4">Escritura</h3>
                <p className="mt-1 text-sm text-ink-2">
                  Un cuento por consigna, en texto plano y dentro del límite de
                  caracteres de la edición.
                </p>
              </article>

              <article>
                <div className="riso-plate">
                  <div className="riso-plate-disc" aria-hidden="true" />
                  <span className="relative z-10 text-sm font-medium text-ink">
                    Segunda pasada
                  </span>
                  <p className="relative z-10 font-display text-3xl font-extrabold leading-none text-ink">
                    Selección y edición
                  </p>
                </div>
                <h3 className="mt-4">Postulación</h3>
                <p className="mt-1 text-sm text-ink-2">
                  Eliges tu mejor relato de forma irreversible y pules el texto
                  antes de enviarlo a concurso.
                </p>
              </article>

              <article>
                <div className="riso-plate grained">
                  <div
                    className="riso-plate-disc riso-plate-disc--overprint"
                    aria-hidden="true"
                  />
                  <span className="relative z-10 text-sm font-medium text-ink">
                    Hoja completa
                  </span>
                  <p className="relative z-10 font-display text-3xl font-extrabold leading-none text-ink">
                    Lectura anónima y jurado
                  </p>
                </div>
                <h3 className="mt-4">Veredicto</h3>
                <p className="mt-1 text-sm text-ink-2">
                  Voto secreto entre autores y evaluación de un jurado impar
                  sobre los diez finalistas.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* Questions as rows on light pink screen (Riso Range: Rows on paper-2) */}
        <section className="band--screen border-t border-rule py-20 sm:py-24">
          <div className="container">
            <h2>Reglas esenciales del certamen</h2>
            <div className="mt-10 border-b border-rule">
              {CONTEST_FAQS.map((item) => (
                <div key={item.question} className="riso-row">
                  <h3>{item.question}</h3>
                  <p className="text-ink-2">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Solid blue closing statement band with grain */}
        <section className="band--solid grained py-20 sm:py-24">
          <div className="container relative z-10 flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <h2 className="text-paper">
                Tu cuenta sirve para todas las ediciones.
              </h2>
              <p className="mt-4 max-w-xl text-paper">
                Regístrate hoy, completa tu perfil y queda listo para
                inscribirte apenas abran las inscripciones oficiales.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <a href="/registro" className="btn btn--primary">
                Crear mi cuenta
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
