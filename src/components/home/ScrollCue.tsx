"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

interface ScrollCueProps {
  targetId: string;
}

export function ScrollCue({ targetId }: ScrollCueProps) {
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;

    const updateFromRect = () => {
      const rect = target.getBoundingClientRect();
      // Hide as soon as the target section enters (or is above) the viewport
      setIsHidden(rect.top < window.innerHeight - 16);
    };

    updateFromRect();

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const enteredOrPassed =
          entry.isIntersecting || entry.boundingClientRect.top < window.innerHeight - 16;
        setIsHidden(enteredOrPassed);
      },
      { threshold: 0.01, rootMargin: "0px 0px -16px 0px" }
    );

    observer.observe(target);
    window.addEventListener("scroll", updateFromRect, { passive: true });
    window.addEventListener("resize", updateFromRect, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateFromRect);
      window.removeEventListener("resize", updateFromRect);
    };
  }, [targetId]);

  function handleScrollDown() {
    const target = document.getElementById(targetId);
    if (!target) return;
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    target.scrollIntoView({
      behavior: prefersReduced ? "auto" : "smooth",
      block: "start",
    });
  }

  return (
    <button
      type="button"
      onClick={handleScrollDown}
      aria-label="Desplazarse a las etapas del certamen"
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
  );
}
