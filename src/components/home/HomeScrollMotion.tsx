"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useEffect, useRef, type ReactNode } from "react";

gsap.registerPlugin(ScrollTrigger, SplitText);

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

      return () => {
        splits.forEach((split) => split.revert());
      };
    });

    return () => {
      mm.revert();
    };
  }, []);

  return <div ref={scopeRef}>{children}</div>;
}
