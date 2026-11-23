"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, type ReactNode } from "react";

gsap.registerPlugin(ScrollTrigger);

interface HomeScrollMotionProps {
  children: ReactNode;
}

export function HomeScrollMotion({ children }: HomeScrollMotionProps) {
  const scopeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;

    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // 1. Calm editorial hero entrance on initial load
      const heroItems = scope.querySelectorAll<HTMLElement>(
        '[data-gsap="hero-emblem"], [data-gsap="hero-tagline"], [data-gsap="hero-status"]'
      );
      if (heroItems.length > 0) {
        gsap.from(heroItems, {
          y: 22,
          opacity: 0,
          duration: 0.75,
          stagger: 0.1,
          ease: "power3.out",
          clearProps: "transform,opacity",
        });
      }

      // Subtle scrub parallax as the hero scrolls out of view
      const heroSection = scope.querySelector<HTMLElement>(
        '[data-gsap="hero-section"]'
      );
      const heroContent = scope.querySelector<HTMLElement>(
        '[data-gsap="hero-content"]'
      );
      if (heroSection && heroContent) {
        gsap.to(heroContent, {
          y: -36,
          opacity: 0.25,
          ease: "none",
          scrollTrigger: {
            trigger: heroSection,
            start: "top top",
            end: "bottom top",
            scrub: 0.6,
          },
        });
      }

      // 2. Stages section ("Tres pasos, un solo cuento")
      const stagesSection = scope.querySelector<HTMLElement>("#etapas");
      if (stagesSection) {
        const stagesHeader = stagesSection.querySelector<HTMLElement>(
          '[data-gsap="stages-header"]'
        );
        if (stagesHeader) {
          gsap.from(stagesHeader, {
            y: 28,
            opacity: 0,
            duration: 0.75,
            ease: "power3.out",
            clearProps: "transform",
            scrollTrigger: {
              trigger: stagesSection,
              start: "top 85%",
              once: true,
            },
          });
        }

        const stageItems = stagesSection.querySelectorAll<HTMLElement>(
          '[data-gsap="stage-item"]'
        );
        if (stageItems.length > 0) {
          gsap.from(stageItems, {
            y: 24,
            opacity: 0,
            duration: 0.65,
            stagger: 0.11,
            ease: "power3.out",
            clearProps: "transform",
            scrollTrigger: {
              trigger: stageItems[0],
              start: "top 84%",
              once: true,
            },
          });
        }

        const stagePanel = stagesSection.querySelector<HTMLElement>(
          '[data-gsap="stage-panel"]'
        );
        if (stagePanel) {
          gsap.from(stagePanel, {
            y: 32,
            opacity: 0,
            scale: 0.985,
            duration: 0.85,
            delay: 0.12,
            ease: "power3.out",
            clearProps: "transform",
            scrollTrigger: {
              trigger: stagePanel,
              start: "top 84%",
              once: true,
            },
          });
        }
      }

      // 3. FAQ section ("Preguntas frecuentes")
      const faqIntro = scope.querySelector<HTMLElement>(
        '[data-gsap="faq-intro"]'
      );
      if (faqIntro) {
        gsap.from(faqIntro, {
          y: 26,
          opacity: 0,
          duration: 0.75,
          ease: "power3.out",
          clearProps: "transform",
          scrollTrigger: {
            trigger: faqIntro,
            start: "top 85%",
            once: true,
          },
        });
      }

      const faqItems = scope.querySelectorAll<HTMLElement>(
        '[data-gsap="faq-item"]'
      );
      if (faqItems.length > 0) {
        gsap.from(faqItems, {
          y: 20,
          opacity: 0,
          duration: 0.58,
          stagger: 0.065,
          ease: "power2.out",
          clearProps: "transform",
          scrollTrigger: {
            trigger: faqItems[0],
            start: "top 84%",
            once: true,
          },
        });
      }

      // 4. Closing CTA section
      const closingSection = scope.querySelector<HTMLElement>(
        '[data-gsap="closing-section"]'
      );
      if (closingSection) {
        const closingCopy = closingSection.querySelector<HTMLElement>(
          '[data-gsap="closing-copy"]'
        );
        const closingCta = closingSection.querySelector<HTMLElement>(
          '[data-gsap="closing-cta"]'
        );

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: closingSection,
            start: "top 86%",
            once: true,
          },
        });

        if (closingCopy) {
          tl.from(closingCopy, {
            y: 28,
            opacity: 0,
            duration: 0.8,
            ease: "power3.out",
            clearProps: "transform",
          });
        }

        if (closingCta) {
          tl.from(
            closingCta,
            {
              y: 18,
              opacity: 0,
              scale: 0.96,
              duration: 0.65,
              ease: "power3.out",
              clearProps: "transform",
            },
            "-=0.5"
          );
        }
      }
    });

    return () => {
      mm.revert();
    };
  }, []);

  return <div ref={scopeRef}>{children}</div>;
}
