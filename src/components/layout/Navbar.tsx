"use client";

import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { UserRole } from "@/db/schema";
import { APP_BRAND } from "@/lib/app-metadata";

gsap.registerPlugin(ScrollToPlugin);

const SITELOCUENTO_URL = "https://www.sitelocuento.com";

export interface NavbarProps {
  currentPath?: string;
  userRole?: UserRole | null;
  userName?: string | null;
  showEditions?: boolean;
}

function resolvePrimaryWorkspace(userRole?: UserRole | null): {
  label: string;
  shortLabel: string;
  href: string;
} {
  if (userRole === "ADMIN" || userRole === "SUPERADMIN") {
    return { label: "Panel Admin", shortLabel: "Admin", href: "/admin" };
  }
  if (userRole === "JURY") {
    return { label: "Jurado", shortLabel: "Jurado", href: "/jurado" };
  }
  if (userRole === "PARTICIPANT") {
    return { label: "Concurso", shortLabel: "Concurso", href: "/concurso" };
  }
  return { label: "Entrar", shortLabel: "Entrar", href: "/login" };
}

export function Navbar({
  currentPath = "/",
  userRole = null,
  userName = null,
  showEditions = false,
}: NavbarProps) {
  const isHome = currentPath === "/";
  const [heroLogoHidden, setHeroLogoHidden] = useState(!isHome);
  const [showClubModal, setShowClubModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const burgerTopRef = useRef<HTMLSpanElement>(null);
  const burgerBotRef = useRef<HTMLSpanElement>(null);
  const menuTlRef = useRef<gsap.core.Timeline | null>(null);

  const workspace = resolvePrimaryWorkspace(userRole);

  useEffect(() => {
    if (!isHome) {
      setHeroLogoHidden(true);
      return;
    }

    const heroLogo = document.getElementById("hero-emblem-trigger");
    if (!heroLogo) {
      setHeroLogoHidden(false);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setHeroLogoHidden(!entry.isIntersecting);
      },
      { threshold: 0.08, rootMargin: "-64px 0px 0px 0px" }
    );

    observer.observe(heroLogo);
    return () => observer.disconnect();
  }, [isHome]);

  // Build GSAP orchestrated ease-reverse timeline for bottom menu
  useEffect(() => {
    const panel = panelRef.current;
    const scrim = scrimRef.current;
    const lineTop = burgerTopRef.current;
    const lineBot = burgerBotRef.current;
    if (!panel || !scrim || !lineTop || !lineBot) return;

    const items = panel.querySelectorAll<HTMLElement>("[data-orch-item]");

    const tl = gsap.timeline({
      paused: true,
      defaults: { ease: "power3.out" },
      onReverseComplete: () => {
        gsap.set(panel, { visibility: "hidden" });
        scrim.style.pointerEvents = "none";
      },
    });

    tl.set(panel, { visibility: "visible" })
      .to(scrim, { opacity: 1, duration: 0.28 }, 0)
      .fromTo(
        panel,
        { opacity: 0, y: 20, scale: 0.92 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.42,
          ease: "back.out(1.4)",
        },
        0.02
      )
      .fromTo(
        items,
        { opacity: 0, y: 12 },
        {
          opacity: 1,
          y: 0,
          duration: 0.3,
          stagger: 0.05,
          ease: "power3.out",
        },
        0.12
      )
      .to(lineTop, { y: 4.5, rotation: 45, duration: 0.24 }, 0)
      .to(lineBot, { y: -4.5, rotation: -45, duration: 0.24 }, 0);

    menuTlRef.current = tl;

    return () => {
      tl.kill();
      menuTlRef.current = null;
    };
  }, [isHome, showEditions, userRole]);

  // Play / reverse orchestrated menu timeline when menuOpen changes
  useEffect(() => {
    const tl = menuTlRef.current;
    const scrim = scrimRef.current;
    const panel = panelRef.current;

    window.dispatchEvent(
      new CustomEvent("olimpiadas:menu-toggle", {
        detail: { open: menuOpen },
      })
    );

    if (!tl || !scrim || !panel) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (menuOpen) {
      scrim.style.pointerEvents = "auto";
      if (prefersReduced) {
        tl.progress(1).pause();
      } else {
        tl.timeScale(1).play();
      }
    } else {
      if (prefersReduced) {
        tl.progress(0).pause();
        gsap.set(panel, { visibility: "hidden" });
        scrim.style.pointerEvents = "none";
      } else {
        tl.timeScale(1.55).reverse();
      }
    }
  }, [menuOpen]);

  useEffect(() => {
    if (!showClubModal && !menuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowClubModal(false);
        setMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showClubModal, menuOpen]);

  const menuLinks = [
    ...(!isHome
      ? [{ label: "Inicio", hint: "Portada", href: "/" }]
      : []),
    {
      label: "Bases del Concurso",
      hint: "Reglamento",
      href: "/bases-del-concurso",
    },
    { label: "Quiénes somos", hint: "El club", href: "/quienes-somos" },
    ...(showEditions
      ? [{ label: "Ediciones", hint: "Archivo", href: "/ediciones" }]
      : []),
    ...(userRole
      ? [
          {
            label: userName ?? "Mi Perfil",
            hint: "Cuenta",
            href: "/perfil",
            mobileOnly: true,
          },
        ]
      : []),
  ];

  const showDualHeader = !isHome || heroLogoHidden;

  function handleContestLogoClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!isHome) return;
    event.preventDefault();
    setMenuOpen(false);
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) {
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    gsap.killTweensOf(window);
    gsap.to(window, {
      scrollTo: { y: 0, autoKill: true },
      duration: 0.5,
      ease: "power3.inOut",
    });
  }

  return (
    <>
      <header
        className={`ta-top-shell ${showDualHeader ? "ta-top-shell--stuck" : ""}`}
      >
        <div className="container ta-top-bar">
          <Link
            href="/"
            onClick={handleContestLogoClick}
            aria-current={isHome ? "page" : undefined}
            aria-label={
              isHome
                ? `${APP_BRAND.contestName} — Volver arriba`
                : `${APP_BRAND.contestName} — Ir al inicio`
            }
            aria-hidden={!showDualHeader}
            tabIndex={showDualHeader ? 0 : -1}
            className={`ta-contest-mini gap-2.5 hover:text-accent-deep ${showDualHeader ? "ta-contest-mini--visible" : ""}`}
          >
            <img
              src="/images/logo-olimpiadas.svg"
              alt=""
              aria-hidden="true"
              className="h-7 w-auto"
            />
            <span>{APP_BRAND.contestName}</span>
          </Link>

          <div className="ml-auto flex items-center gap-3 sm:gap-5">
            {userRole && (
              <Link
                href="/perfil"
                aria-current={currentPath === "/perfil" ? "page" : undefined}
                className="riso-nav-link hidden sm:inline-flex"
              >
                {userName ?? "Mi Perfil"}
              </Link>
            )}

            <Link
              href={workspace.href}
              aria-current={currentPath === workspace.href ? "page" : undefined}
              className="ta-top-cta"
            >
              <span className="sm:hidden">{workspace.shortLabel}</span>
              <span className="hidden sm:inline">{workspace.label}</span>
            </Link>

            <button
              type="button"
              onClick={() => setShowClubModal(true)}
              title="Sitio oficial de la comunidad SiTeLoCuento"
              aria-label="Sitio oficial de la comunidad SiTeLoCuento"
              className="ta-brand ta-brand-trigger"
            >
              <img
                src="/images/logo-sitelocuento.png"
                alt="SiTeLoCuento"
                className="h-7 w-auto sm:h-8"
              />
              <span className="ta-tooltip" role="tooltip">
                Sitio oficial de la comunidad SiTeLoCuento
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Subtle scrim behind orchestrated bottom menu */}
      <div
        ref={scrimRef}
        className="ta-menu-scrim"
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Compact Orchestrated Bottom Menu */}
      <div
        className="ta-dock-wrap"
        data-menu-open={menuOpen ? "true" : undefined}
      >
        <div className="ta-orch-anchor">
          <nav
            ref={panelRef}
            id="ta-orch-menu-panel"
            aria-label="Navegación principal"
            aria-hidden={!menuOpen}
            className="ta-orch-panel"
          >
            {menuLinks.map((link) => {
              const isActive = currentPath === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  data-orch-item
                  tabIndex={menuOpen ? 0 : -1}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={`ta-orch-item ${"mobileOnly" in link && link.mobileOnly ? "sm:hidden" : ""}`}
                >
                  <span>{link.label}</span>
                  <span className="ta-orch-hint">{link.hint}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ta-dock">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              aria-controls="ta-orch-menu-panel"
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú de navegación"}
              className={`ta-dock-link ta-dock-toggle ${menuOpen ? "ta-dock-toggle--open" : ""}`}
            >
              <span className="ta-burger" aria-hidden="true">
                <span ref={burgerTopRef} />
                <span ref={burgerBotRef} />
              </span>
              <span>{menuOpen ? "Cerrar" : "Menú"}</span>
            </button>
          </div>
        </div>
      </div>

      {showClubModal && (
        <div
          className="ta-modal-backdrop"
          onClick={() => setShowClubModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="stlc-exit-title"
            className="ta-modal-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="stlc-exit-title"
              className="font-display text-2xl font-bold tracking-display text-ink"
            >
              ¿Quieres visitar la comunidad de{" "}
              <span className="ta-serif-italic">{APP_BRAND.clubName}</span>?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
              Estás por salir de las {APP_BRAND.contestName} para abrir el sitio
              oficial del club de escritura {APP_BRAND.clubName} en una nueva
              pestaña.
            </p>
            <div className="mt-7 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClubModal(false)}
                className="btn btn--secondary"
              >
                Quedarme aquí
              </button>
              <a
                href={SITELOCUENTO_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowClubModal(false)}
                className="btn btn--primary"
              >
                Ir a {APP_BRAND.clubName}
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
