"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";

export function FooterBounce() {
  const blockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const block = blockRef.current;
    if (!block) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) return;

    let cooldownUntil = 0;

    const triggerBounce = (intensity: number) => {
      const lift = Math.min(136, Math.max(64, intensity));

      gsap.killTweensOf(block);
      const tl = gsap.timeline();
      tl.to(block, {
        y: -lift,
        duration: 0.2,
        ease: "power2.out",
      }).to(block, {
        y: 0,
        duration: 0.78,
        ease: "elastic.out(1.05, 0.42)",
      });
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.deltaY <= 4) return;
      if (document.querySelector('[role="dialog"]')) return;

      const atBottom =
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 8;
      if (!atBottom) return;

      const now = performance.now();
      if (now < cooldownUntil) return;
      cooldownUntil = now + 260;

      triggerBounce(event.deltaY * 0.85);
    };

    window.addEventListener("wheel", handleWheel, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      gsap.killTweensOf(block);
    };
  }, []);

  return (
    <div
      ref={blockRef}
      aria-hidden="true"
      className="ta-footer-bounce-block"
    />
  );
}
