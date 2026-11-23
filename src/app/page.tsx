import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { HomeInfoSections } from "@/components/home/HomeInfoSections";
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

      <main id="contenido" className="container flex-1">
        <h1 className="visually-hidden">{APP_BRAND.contestName}</h1>

        {/* Open-Paper Editorial Hero: Large centered emblem space framed by subtle corner crop marks */}
        <section
          aria-label="Presentación del certamen"
          className="flex min-h-[78vh] flex-col items-center justify-center py-14 text-center sm:py-20"
        >
          <div
            data-slot="logo-olimpiadas"
            role="img"
            aria-label={`Emblema oficial de las ${APP_BRAND.contestName}`}
            className="ta-crop-stage"
          >
            <span className="ta-crop-corners" aria-hidden="true" />
            <div className="ta-emblem-inner">
              <p className="font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.04em] text-ink sm:text-6xl">
                Olimpíadas
                <br />
                Literarias
              </p>
              {editionStatus.isActive && (
                <span className="mt-2 text-xs font-medium tracking-wide text-muted">
                  {editionStatus.editionTitle}
                </span>
              )}
            </div>
          </div>

          <p className="mt-12 max-w-3xl font-display text-2xl font-bold leading-[1.16] tracking-display text-ink sm:mt-14 sm:text-4xl lg:text-[2.75rem]">
            Escribe sin miedo, juega con cada{" "}
            <span className="ta-serif-italic">consigna</span> y celebra tus{" "}
            <span className="ta-serif-italic">cuentos</span> junto a otros
            lectores.
          </p>

          <div className="ta-status-line mt-9" aria-live="polite">
            <span className="ta-status-dot-airy" aria-hidden="true" />
            <span>
              {editionStatus.stageLabel}
              <span className="ta-caret" aria-hidden="true" />
            </span>
          </div>
        </section>

        {/* Open-Paper Interactive Editorial Index */}
        <StageExplorer />

        {/* Frequently Asked Questions */}
        <HomeInfoSections />

        {/* Open Full-Width Closing Section */}
        <section
          className="ta-closing-open mt-40 pb-20 sm:mt-56 sm:pb-32"
          aria-labelledby="cierre-titulo"
        >
          <div className="max-w-xl">
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

          <Link href={closingCta.primaryHref} className="btn btn--primary">
            {closingCta.primaryLabel}
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}
