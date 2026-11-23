"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { UserRole } from "@/db/schema";
import { APP_BRAND } from "@/lib/app-metadata";

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
  const workspace = resolvePrimaryWorkspace(userRole);

  useEffect(() => {
    if (!isHome) {
      setHeroLogoHidden(true);
      return;
    }

    const heroLogo = document.querySelector('[data-slot="logo-olimpiadas"]');
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

  useEffect(() => {
    if (!showClubModal) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowClubModal(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showClubModal]);

  const dockLinks = [
    ...(!isHome ? [{ label: "Inicio", shortLabel: "Inicio", href: "/" }] : []),
    { label: "Bases", shortLabel: "Bases", href: "/bases-del-concurso" },
    { label: "Quiénes somos", shortLabel: "El club", href: "/quienes-somos" },
    ...(showEditions
      ? [{ label: "Ediciones", shortLabel: "Ediciones", href: "/ediciones" }]
      : []),
  ];

  const showDualHeader = !isHome || heroLogoHidden;

  return (
    <>
      <header
        className={`ta-top-shell ${showDualHeader ? "ta-top-shell--stuck" : ""}`}
      >
        <div className="container ta-top-bar">
          <Link
            href="/"
            aria-current={isHome ? "page" : undefined}
            aria-label={`${APP_BRAND.contestName} — Ir al inicio`}
            aria-hidden={!showDualHeader}
            tabIndex={showDualHeader ? 0 : -1}
            className={`ta-contest-mini hover:text-accent-deep ${showDualHeader ? "ta-contest-mini--visible" : ""}`}
          >
            {APP_BRAND.contestName}
          </Link>

          <div className="ml-auto flex items-center gap-5">
            {userRole && (
              <Link
                href="/perfil"
                aria-current={currentPath === "/perfil" ? "page" : undefined}
                className="riso-nav-link hidden sm:inline-flex"
              >
                {userName ?? "Mi Perfil"}
              </Link>
            )}

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

      <div className="ta-dock-wrap">
        <nav className="ta-dock" aria-label="Navegación principal">
          {dockLinks.map((link) => {
            const isActive = currentPath === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className="ta-dock-link"
              >
                <span className="sm:hidden">{link.shortLabel}</span>
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}

          <Link
            href={workspace.href}
            aria-current={currentPath === workspace.href ? "page" : undefined}
            className="ta-dock-link ta-dock-cta"
          >
            <span className="sm:hidden">{workspace.shortLabel}</span>
            <span className="hidden sm:inline">{workspace.label}</span>
          </Link>
        </nav>
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
              oficial de nuestra comunidad (www.sitelocuento.com).
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
