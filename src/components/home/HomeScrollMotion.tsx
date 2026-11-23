"use client";

import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useEffect, useRef, type ReactNode } from "react";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, SplitText);

const HOME_SECTION_IDS = ["inicio", "etapas", "preguntas", "cierre"] as const;

interface HomeScrollMotionProps {
  children: ReactNode;
}

export function HomeScrollMotion({ children }: HomeScrollMotionProps) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;

    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const splits: SplitText[] = [];

      // 1. Expressive horizontal kinetic text entrance on load (SplitText)
      const heroLogoImg = scope.querySelector<HTMLElement>(
        '[data-gsap="hero-logo-img"]'
      );
      const heroTitle = scope.querySelector<HTMLElement>(
        '[data-gsap="hero-title"]'
      );
      const heroEdition = scope.querySelector<HTMLElement>(
        '[data-gsap="hero-edition"]'
      );
      const heroTagline = scope.querySelector<HTMLElement>(
        '[data-gsap="hero-tagline"]'
      );
      const heroStatus = scope.querySelector<HTMLElement>(
        '[data-gsap="hero-status"]'
      );

      const heroTl = gsap.timeline({
        onComplete: () => {
          splits.forEach((split) => split.revert());
          splits.length = 0;
        },
      });

      if (heroLogoImg) {
        heroTl.from(heroLogoImg, {
          y: 16,
          scale: 0.94,
          opacity: 0,
          duration: 0.6,
          ease: "power3.out",
          clearProps: "transform,opacity",
        });
      }

      if (heroTitle) {
        const titleSplit = SplitText.create(heroTitle, {
          type: "chars,words",
        });
        splits.push(titleSplit);
        heroTl.from(
          titleSplit.chars,
          {
            x: 26,
            opacity: 0,
            duration: 0.65,
            stagger: 0.024,
            ease: "power4.out",
          },
          heroLogoImg ? "-=0.38" : 0
        );
      }

      if (heroEdition) {
        heroTl.from(
          heroEdition,
          {
            x: 16,
            opacity: 0,
            duration: 0.45,
            ease: "power3.out",
            clearProps: "transform,opacity",
          },
          "-=0.35"
        );
      }

      if (heroTagline) {
        const taglineSplit = SplitText.create(heroTagline, {
          type: "words",
        });
        splits.push(taglineSplit);
        heroTl.from(
          taglineSplit.words,
          {
            x: 30,
            opacity: 0,
            duration: 0.65,
            stagger: 0.04,
            ease: "power3.out",
          },
          "-=0.32"
        );
      }

      if (heroStatus) {
        heroTl.from(
          heroStatus,
          {
            y: 12,
            opacity: 0,
            duration: 0.5,
            ease: "power2.out",
            clearProps: "transform,opacity",
          },
          "-=0.28"
        );
      }

      // 2. Section content reveal helper (always starts from clean visible DOM, never stuck at opacity: 0)
      const animateSectionEntrance = (
        sectionId: string,
        direction: 1 | -1
      ) => {
        const offsetY = direction > 0 ? 22 : -22;

        if (sectionId === "etapas") {
          const targets = scope.querySelectorAll<HTMLElement>(
            '[data-gsap="stages-header"], [data-gsap="stage-item"], [data-gsap="stage-panel"]'
          );
          if (targets.length > 0) {
            gsap.killTweensOf(targets);
            gsap.fromTo(
              targets,
              { y: offsetY, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: 0.55,
                stagger: 0.07,
                ease: "power3.out",
                clearProps: "transform,opacity",
              }
            );
          }
          return;
        }

        if (sectionId === "preguntas") {
          const targets = scope.querySelectorAll<HTMLElement>(
            '[data-gsap="faq-intro"], [data-gsap="faq-item"]'
          );
          if (targets.length > 0) {
            gsap.killTweensOf(targets);
            gsap.fromTo(
              targets,
              { y: offsetY, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: 0.5,
                stagger: 0.045,
                ease: "power3.out",
                clearProps: "transform,opacity",
              }
            );
          }
          return;
        }

        if (sectionId === "cierre") {
          const targets = scope.querySelectorAll<HTMLElement>(
            '[data-gsap="closing-copy"], [data-gsap="closing-cta"]'
          );
          if (targets.length > 0) {
            gsap.killTweensOf(targets);
            gsap.fromTo(
              targets,
              { y: offsetY, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: 0.55,
                stagger: 0.1,
                ease: "power3.out",
                clearProps: "transform,opacity",
              }
            );
          }
        }
      };

      // 3. Full-page block-by-block transition with rising/falling Amber Curtain panel
      let lockedUntil = 0;

      const runAmberPanelTransition = (
        targetId: string,
        target: number | HTMLElement,
        direction: 1 | -1
      ) => {
        const curtain = curtainRef.current;
        const now = performance.now();
        lockedUntil = now + 760;

        if (!curtain) {
          gsap.killTweensOf(window);
          gsap.to(window, {
            scrollTo: { y: target, autoKill: false },
            duration: 0.6,
            ease: "power3.inOut",
          });
          return;
        }

        const enterFrom = direction > 0 ? 105 : -105;
        const exitTo = direction > 0 ? -105 : 105;

        gsap.killTweensOf(curtain);
        gsap.killTweensOf(window);

        const tl = gsap.timeline();
        tl.fromTo(
          curtain,
          { y: 0, yPercent: enterFrom, autoAlpha: 1 },
          {
            y: 0,
            yPercent: 0,
            duration: 0.26,
            ease: "power3.inOut",
          }
        )
          .add(() => {
            if (typeof target === "number") {
              window.scrollTo({ top: target, behavior: "auto" });
            } else {
              const top =
                target.getBoundingClientRect().top + window.scrollY;
              window.scrollTo({ top, behavior: "auto" });
            }

            // Sync Navbar, ScrollCue, and ScrollTrigger immediately after jump
            ScrollTrigger.update();
            window.dispatchEvent(new Event("scroll"));
            requestAnimationFrame(() => {
              ScrollTrigger.update();
              window.dispatchEvent(new Event("scroll"));
            });

            // Reveal the newly arrived section right as the amber curtain lifts away
            animateSectionEntrance(targetId, direction);
          })
          .to(curtain, {
            y: 0,
            yPercent: exitTo,
            duration: 0.34,
            ease: "power3.out",
          })
          .set(curtain, { autoAlpha: 0 });
      };

      const getActiveSectionIndex = (sections: HTMLElement[]): number => {
        const pivot = window.innerHeight * 0.45;
        let activeIdx = 0;
        for (let i = 0; i < sections.length; i++) {
          if (sections[i].getBoundingClientRect().top <= pivot) {
            activeIdx = i;
          }
        }
        return activeIdx;
      };

      const handleWheel = (event: WheelEvent) => {
        // Ignore pinch-zoom gestures, tiny trackpad jitter, or open dialogs
        if (event.ctrlKey || Math.abs(event.deltaY) < 6) return;
        if (document.querySelector('[role="dialog"]')) return;

        const sections = HOME_SECTION_IDS.map((id) =>
          document.getElementById(id)
        ).filter((el): el is HTMLElement => el !== null);
        if (sections.length < 2) return;

        const now = performance.now();
        if (now < lockedUntil) {
          event.preventDefault();
          return;
        }

        const direction: 1 | -1 = event.deltaY > 0 ? 1 : -1;
        const currentIdx = getActiveSectionIndex(sections);
        const currentEl = sections[currentIdx];
        const rect = currentEl.getBoundingClientRect();

        // If the active section is taller than the viewport (e.g. expanded FAQs),
        // let the user finish scrolling within it before paging to the next block.
        if (direction > 0 && rect.bottom > window.innerHeight + 12) {
          return;
        }
        if (direction < 0 && rect.top < -12) {
          return;
        }

        const targetIdx = currentIdx + direction;
        if (targetIdx < 0 || targetIdx >= sections.length) {
          return;
        }

        event.preventDefault();
        const targetEl = sections[targetIdx];
        const targetId = targetEl.id;
        const scrollTarget: number | HTMLElement =
          targetIdx === 0 ? 0 : targetEl;
        runAmberPanelTransition(targetId, scrollTarget, direction);
      };

      const handleCustomTransition = (event: Event) => {
        const custom = event as CustomEvent<{
          targetId?: string;
          direction?: 1 | -1;
        }>;
        const targetId = custom.detail?.targetId;
        if (!targetId) return;
        const targetEl = document.getElementById(targetId);
        if (!targetEl) return;

        const now = performance.now();
        if (now < lockedUntil) return;

        runAmberPanelTransition(
          targetId,
          targetId === "inicio" ? 0 : targetEl,
          custom.detail?.direction ?? 1
        );
      };

      window.addEventListener("wheel", handleWheel, { passive: false });
      window.addEventListener(
        "olimpiadas:page-transition",
        handleCustomTransition
      );

      return () => {
        window.removeEventListener("wheel", handleWheel);
        window.removeEventListener(
          "olimpiadas:page-transition",
          handleCustomTransition
        );
        splits.forEach((split) => split.revert());
      };
    });

    return () => {
      mm.revert();
    };
  }, []);

  return (
    <div ref={scopeRef}>
      {children}
      <div
        ref={curtainRef}
        className="ta-transition-curtain"
        aria-hidden="true"
      />
    </div>
  );
}
