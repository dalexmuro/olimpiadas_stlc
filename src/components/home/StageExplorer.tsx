"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";

const CONTEST_STAGES = [
  {
    num: "01",
    stepLabel: "Primera Etapa: Escritura",
    title: "La chispa de cada consigna",
    description: "Responde a cada consigna y da forma a nuevas historias.",
  },
  {
    num: "02",
    stepLabel: "Segunda Etapa: Postulación",
    title: "Selección y edición",
    description:
      "Escoge tu mejor cuento y dale el toque final antes de compartirlo.",
  },
  {
    num: "03",
    stepLabel: "Tercera Etapa: Veredicto",
    title: "Lectura y votación",
    description:
      "Lee a los demás autores, descubre nuevas voces y celebra el podio final.",
  },
] as const;

type DocumentWithViewTransition = Document & {
  startViewTransition?: (updateCallback: () => void) => {
    finished: Promise<void>;
  };
};

export function StageExplorer() {
  const [activeIndex, setActiveIndex] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = CONTEST_STAGES[activeIndex];

  function transitionToStage(nextIndex: number, moveFocus: boolean) {
    if (nextIndex === activeIndex) {
      if (moveFocus) tabRefs.current[nextIndex]?.focus();
      return;
    }

    const doc = document as DocumentWithViewTransition;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (typeof doc.startViewTransition === "function" && !prefersReduced) {
      doc.startViewTransition(() => {
        flushSync(() => {
          setActiveIndex(nextIndex);
        });
      });
    } else {
      setActiveIndex(nextIndex);
    }

    if (moveFocus) {
      tabRefs.current[nextIndex]?.focus();
    }
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    const count = CONTEST_STAGES.length;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      transitionToStage((index + 1) % count, true);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      transitionToStage((index - 1 + count) % count, true);
    } else if (event.key === "Home") {
      event.preventDefault();
      transitionToStage(0, true);
    } else if (event.key === "End") {
      event.preventDefault();
      transitionToStage(count - 1, true);
    }
  }

  return (
    <section
      id="etapas"
      aria-labelledby="etapas-titulo"
      className="mt-16 scroll-mt-24 border-t border-rule pt-10 sm:mt-20 sm:pt-12"
    >
      <div className="mb-12 flex flex-wrap items-baseline justify-between gap-4 sm:mb-14">
        <h2 id="etapas-titulo">
          Tres pasos, un solo <span className="ta-serif-italic">cuento</span>
        </h2>
        <span className="num text-xs font-semibold tracking-wide text-muted sm:text-sm">
          {current.num} / 0{CONTEST_STAGES.length}
        </span>
      </div>

      <div className="ta-index-grid">
        <div
          className="ta-index-list"
          role="tablist"
          aria-label="Etapas del certamen"
          aria-orientation="vertical"
        >
          {CONTEST_STAGES.map((stage, index) => {
            const isSelected = index === activeIndex;
            return (
              <button
                key={stage.stepLabel}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                id={`stage-tab-${index}`}
                type="button"
                role="tab"
                tabIndex={isSelected ? 0 : -1}
                aria-selected={isSelected}
                aria-controls="stage-spotlight-panel"
                onClick={() => transitionToStage(index, false)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className="ta-index-btn"
              >
                <span className="ta-index-num" aria-hidden="true">
                  {stage.num}
                </span>
                <span className="ta-step-content">
                  <span className="ta-index-step">{stage.stepLabel}</span>
                  <span className="ta-index-title">{stage.title}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div
          id="stage-spotlight-panel"
          role="tabpanel"
          aria-labelledby={`stage-tab-${activeIndex}`}
          data-stage={activeIndex}
          className="ta-stage-read"
        >
          <div key={`head-${activeIndex}`} className="ta-spot-enter">
            <span className="ta-stage-kicker">
              <span className="ta-stage-rule" aria-hidden="true" />
              <span className="ta-spot-tag-text">{current.stepLabel}</span>
            </span>
            <h3 className="ta-spot-title mt-5 font-display text-[clamp(1.75rem,3vw+0.4rem,2.75rem)] font-extrabold leading-[1.06] tracking-display text-ink">
              {current.title}
            </h3>
          </div>

          <p
            key={`body-${activeIndex}`}
            className="ta-spot-desc ta-spot-enter ta-spot-enter--delay max-w-lg text-lg leading-relaxed text-ink-2 sm:text-xl"
          >
            {current.description}
          </p>
        </div>
      </div>
    </section>
  );
}
