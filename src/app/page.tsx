import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { HomeInfoSections } from "@/components/home/HomeInfoSections";
import { HomeScrollMotion } from "@/components/home/HomeScrollMotion";
import { ScrollCue, type ScrollSectionTarget } from "@/components/home/ScrollCue";
import { StageExplorer } from "@/components/home/StageExplorer";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { createDbClient } from "@/db";
import { editions, users, type UserRole } from "@/db/schema";
import { APP_BRAND } from "@/lib/app-metadata";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import type { EditionStageSnapshot } from "@/lib/contest-stage";
import {
  formatHomeStageStatus,
  resolveHomeClosingCta,
} from "@/lib/home-context";

export const dynamic = "force-dynamic";

async function loadHomeContext(): Promise<{
  userRole: UserRole | null;
  userName: string | null;
  activeEdition: EditionStageSnapshot | null;
  hasPastEditions: boolean;
}> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;
    if (!cfEnv?.DB) {
      return {
        userRole: null,
        userName: null,
        activeEdition: null,
        hasPastEditions: false,
      };
    }

    const db = createDbClient(cfEnv.DB);
    const auth = createAuthInstance(db, cfEnv);
    const reqHeaders = await headers();

    const [sessionResult, activeEditions, completedEditions] = await Promise.all([
      auth.api.getSession({ headers: reqHeaders }).catch(() => null),
      db
        .select()
        .from(editions)
        .where(eq(editions.isActive, true))
        .catch(() => []),
      db
        .select({ id: editions.id })
        .from(editions)
        .where(eq(editions.winnersAnnounced, true))
        .catch(() => []),
    ]);

    let userRole: UserRole | null = null;
    let userName: string | null = null;

    if (sessionResult?.user?.id) {
      const userRows = await db
        .select({
          role: users.role,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.id, sessionResult.user.id));

      const currentUser = userRows[0];
      if (currentUser) {
        userRole = currentUser.role;
        const fullName =
          `${currentUser.firstName ?? ""} ${currentUser.lastName ?? ""}`.trim();
        userName = fullName || sessionResult.user.name || null;
      }
    }

    const activeEditionRow = activeEditions[0] ?? null;
    const activeEdition: EditionStageSnapshot | null = activeEditionRow
      ? {
          title: activeEditionRow.title,
          registrationStartAt: activeEditionRow.registrationStartAt,
          registrationEndAt: activeEditionRow.registrationEndAt,
          writingStartAt: activeEditionRow.writingStartAt,
          writingEndAt: activeEditionRow.writingEndAt,
          submissionStartAt: activeEditionRow.submissionStartAt,
          submissionEndAt: activeEditionRow.submissionEndAt,
          adminReviewStartAt: activeEditionRow.adminReviewStartAt,
          adminReviewEndAt: activeEditionRow.adminReviewEndAt,
          votingStartAt: activeEditionRow.votingStartAt,
          votingEndAt: activeEditionRow.votingEndAt,
          juryStartAt: activeEditionRow.juryStartAt,
          juryEndAt: activeEditionRow.juryEndAt,
          juryPausedMissingVotes: activeEditionRow.juryPausedMissingVotes,
          tieBreakerActive: activeEditionRow.tieBreakerActive,
          winnersAnnounced: activeEditionRow.winnersAnnounced,
        }
      : null;

    return {
      userRole,
      userName,
      activeEdition,
      hasPastEditions: completedEditions.length > 0,
    };
  } catch {
    return {
      userRole: null,
      userName: null,
      activeEdition: null,
      hasPastEditions: false,
    };
  }
}

const HOME_SECTIONS: ScrollSectionTarget[] = [
  { id: "inicio", label: "Inicio" },
  { id: "etapas", label: "Tres pasos, un solo cuento" },
  { id: "preguntas", label: "Preguntas frecuentes" },
  { id: "cierre", label: "Cierre" },
];

export default async function HomePage() {
  const { userRole, userName, activeEdition, hasPastEditions } =
    await loadHomeContext();
  const editionStatus = formatHomeStageStatus(activeEdition);
  const closingCta = resolveHomeClosingCta(userRole);

  return (
    <div className="flex min-h-screen flex-col justify-between bg-paper text-ink">
      <Navbar
        currentPath="/"
        userRole={userRole}
        userName={userName}
        showEditions={hasPastEditions}
      />

      <main id="contenido" className="flex-1">
        <HomeScrollMotion>
          <h1 className="visually-hidden">{APP_BRAND.contestName}</h1>

          {/* Panel 1: Open-Paper Editorial Hero */}
          <section
            id="inicio"
            data-gsap="panel"
            aria-label="Presentación del certamen"
            className="ta-panel flex min-h-[calc(100svh-76px)] flex-col items-center justify-center pb-40 pt-6 text-center sm:pb-44 sm:pt-8"
          >
            <div
              data-gsap="panel-inner"
              className="container flex flex-col items-center py-6"
            >
              <div
                id="hero-emblem-trigger"
                className="flex flex-col items-center"
              >
                <img
                  data-gsap="hero-logo-img"
                  src="/images/logo-olimpiadas.svg"
                  alt={`Emblema oficial de las ${APP_BRAND.contestName}`}
                  className="h-auto w-56 sm:w-72"
                />
                <p
                  data-gsap="hero-title"
                  className="mt-4 font-display text-4xl font-extrabold leading-none tracking-[-0.035em] text-ink sm:text-5xl"
                >
                  Olimpíadas <span className="ta-serif-italic">Literarias</span>
                </p>
                {editionStatus.isActive && (
                  <span
                    data-gsap="hero-edition"
                    className="mt-2 text-xs font-medium tracking-wide text-muted"
                  >
                    {editionStatus.editionTitle}
                  </span>
                )}
              </div>

              <p
                data-gsap="hero-tagline"
                className="mt-12 max-w-3xl font-display text-2xl font-bold leading-[1.16] tracking-display text-ink sm:mt-14 sm:text-4xl lg:text-[2.75rem]"
              >
                Escribe sin miedo, juega con cada{" "}
                <span className="ta-serif-italic">consigna</span> y celebra tus{" "}
                <span className="ta-serif-italic">cuentos</span> junto a otros
                lectores
              </p>

              <div
                data-gsap="hero-status"
                className="ta-status-line mt-9"
                aria-live="polite"
              >
                <span className="ta-status-dot-airy" aria-hidden="true" />
                <span>
                  {editionStatus.stageLabel}
                  <span className="ta-caret" aria-hidden="true" />
                </span>
              </div>
            </div>
          </section>

          {/* Panel 2: Open-Paper Interactive Editorial Index */}
          <StageExplorer />

          {/* Panel 3: Frequently Asked Questions */}
          <HomeInfoSections />

          {/* Panel 4: Open Full-Width Closing Section */}
          <section
            id="cierre"
            data-gsap="closing-section"
            className="ta-panel flex min-h-[calc(100svh-210px)] flex-col justify-center border-t border-rule py-24 sm:py-28"
            aria-labelledby="cierre-titulo"
          >
            <div className="container flex flex-wrap items-end justify-between gap-8">
              <div data-gsap="closing-copy" className="max-w-xl">
                <h2 id="cierre-titulo">
                  {userRole ? (
                    closingCta.heading
                  ) : (
                    <>
                      ¿Listo para escribir tu próxima{" "}
                      <span className="ta-serif-italic">historia</span>?
                    </>
                  )}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
                  {closingCta.description}
                </p>
              </div>

              <Link
                data-gsap="closing-cta"
                href={closingCta.primaryHref}
                className="btn btn--primary"
              >
                {closingCta.primaryLabel}
              </Link>
            </div>
          </section>

          <ScrollCue sections={HOME_SECTIONS} />
        </HomeScrollMotion>
      </main>

      <Footer flushTop />
    </div>
  );
}
