import Link from "next/link";

const HOME_FAQS = [
  {
    question: "¿Necesito ser escritor profesional o tener experiencia previa?",
    answer:
      "No. Olimpíadas Literarias está pensado para cualquier persona con ganas de jugar con las palabras, destrabar la hoja en blanco y compartir lecturas en comunidad.",
  },
  {
    question: "¿Crear mi cuenta ya me inscribe en la próxima edición?",
    answer:
      "No, crear tu cuenta no te inscribe automáticamente, pero te permite estar informado en cuanto abra la próxima edición. Tu cuenta es permanente y sirve para todas las ediciones: cuando abran las inscripciones, solo entras y confirmas tu participación en un clic.",
  },
  {
    question: "¿Cómo funcionan las consignas de escritura?",
    answer:
      "Durante la primera etapa se publican consignas disparadoras con un plazo definido. Cada una te da un punto de partida para crear un relato corto nuevo y mantener el impulso.",
  },
  {
    question: "¿Qué pasa si no puedo entregar alguna consigna?",
    answer:
      "Cada edición establece un margen de tolerancia de consignas sin entregar antes de quedar fuera de competencia. Puedes consultar el detalle vigente en las Bases del Concurso.",
  },
  {
    question: "¿Puedo corregir y editar mi cuento antes de postularlo?",
    answer:
      "Sí. Al cerrar la etapa de escritura escoges tu cuento favorito y tienes una etapa dedicada para pulirlo y editarlo conservando su esencia original.",
  },
  {
    question: "¿Cómo se eligen los cuentos ganadores?",
    answer:
      "En dos instancias: primero los propios participantes leen de forma anónima y votan sus tres favoritos; luego el jurado independiente evalúa a los finalistas para definir el 1.º, 2.º y 3.º lugar.",
  },
  {
    question: "¿Qué pasa con los cuentos cuando termina la edición?",
    answer:
      "Al publicar los resultados, los cuentos finalistas y el podio quedan disponibles en el archivo de Ediciones para que toda la comunidad pueda leerlos y celebrarlos.",
  },
] as const;

export function HomeInfoSections() {
  return (
    <section aria-labelledby="faq-titulo" className="mt-40 sm:mt-56">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14">
        <div data-gsap="faq-intro" className="lg:col-span-4">
          <h2 id="faq-titulo">
            Preguntas <span className="ta-serif-italic">frecuentes</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
            Todo lo esencial para animarte a participar. Puedes revisar el
            reglamento completo en{" "}
            <Link href="/bases-del-concurso" className="ta-inline-link">
              Bases del Concurso
            </Link>
            .
          </p>
        </div>

        <div className="divide-y divide-rule border-y border-rule lg:col-span-8">
          {HOME_FAQS.map((item) => (
            <details
              key={item.question}
              data-gsap="faq-item"
              className="ta-faq-item"
            >
              <summary className="ta-faq-summary">
                <span>{item.question}</span>
                <span className="ta-faq-icon" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="ta-faq-answer">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
