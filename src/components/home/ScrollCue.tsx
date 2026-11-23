"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

export interface ScrollSectionTarget {
  id: string;
  label: string;
}

interface ScrollCueProps {
  sections: ScrollSectionTarget[];
}

export function ScrollCue({ sections }: ScrollCueProps) {
  const [nextIndex, setNextIndex] = useState<number>(1);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    if (sections.length < 2) return;

    const updateActiveSection = () => {
      const viewportHeight = window.innerHeight;
      const lastSection = document.getElementById(
        sections[sections.length - 1].id
      );

      // Hide as soon as the final section ("¿Listo para escribir...?" + footer) is in view
      if (lastSection) {
        const lastRect = lastSection.getBoundingClientRect();
        const nearBottom =
          window.scrollY + viewportHeight >=
          document.documentElement.scrollHeight - 40;
        if (lastRect.top <= viewportHeight * 0.65 || nearBottom) {
          setIsHidden(true);
          return;
        }
      }

      setIsHidden(false);

      // Determine the current section based on which section crosses the upper-middle viewport
      const pivot = viewportHeight * 0.42;
      let currentIdx = 0;
      for (let i = 0; i < sections.length; i++) {
        const el = document.getElementById(sections[i].id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= pivot) {
          currentIdx = i;
        }
      }

      const upcomingIdx = Math.min(currentIdx + 1, sections.length - 1);
      setNextIndex(upcomingIdx);
    };

    updateActiveSection();

    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, [sections]);

  const nextSection = sections[nextIndex];

  function handleScrollNext() {
    if (!nextSection) return;
    const target = document.getElementById(nextSection.id);
    if (!target) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReduced) {
      target.scrollIntoView({ behavior: "auto", block: "start" });
      return;
    }

    window.dispatchEvent(
      new CustomEvent("olimpiadas:page-transition", {
        detail: { targetId: nextSection.id, direction: 1 },
      })
    );
  }

  return (
    <div className="ta-scroll-cue-wrap">
      <button
        type="button"
        onClick={handleScrollNext}
        aria-label={
          nextSection
            ? `Desplazarse a ${nextSection.label}`
            : "Desplazarse hacia abajo"
        }
        aria-hidden={isHidden}
        tabIndex={isHidden ? -1 : 0}
        className={`ta-scroll-cue ${isHidden ? "ta-scroll-cue--hidden" : ""}`}
      >
        <ChevronDown
          className="ta-scroll-cue-icon h-7 w-7"
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
