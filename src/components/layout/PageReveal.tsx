"use client";

import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useEffect, useRef, type ReactNode } from "react";

gsap.registerPlugin(SplitText);

interface PageRevealProps {
  children: ReactNode;
  className?: string;
}

export function PageReveal({ children, className }: PageRevealProps) {
  const scopeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;

    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const splits: SplitText[] = [];
      const heading = scope.querySelector<HTMLElement>("h1");

      const tl = gsap.timeline({
        onComplete: () => {
          splits.forEach((s) => s.revert());
          splits.length = 0;
        },
      });

      if (heading) {
        const headingSplit = SplitText.create(heading, { type: "words" });
        splits.push(headingSplit);
        tl.from(headingSplit.words, {
          x: 20,
          opacity: 0,
          duration: 0.55,
          stagger: 0.04,
          ease: "power3.out",
        });
      }

      const bodyBlocks = Array.from(scope.children).filter(
        (el): el is HTMLElement => el instanceof HTMLElement
      );

      if (bodyBlocks.length > 0) {
        tl.from(
          bodyBlocks,
          {
            y: 16,
            opacity: 0,
            duration: 0.55,
            stagger: 0.06,
            ease: "power3.out",
            clearProps: "transform,opacity",
          },
          0
        );
      }

      return () => {
        splits.forEach((s) => s.revert());
      };
    });

    return () => {
      mm.revert();
    };
  }, []);

  return (
    <div ref={scopeRef} className={className}>
      {children}
    </div>
  );
}
