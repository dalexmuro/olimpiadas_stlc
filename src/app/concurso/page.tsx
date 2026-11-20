/**
 * Participant Contest Workspace Page (/concurso)
 * Step 3.3: Integrates ContestHeader, non-enrolled restriction, Stage 1 Registration, and Stage 2 Writing
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ContestHeader } from "@/components/participant/ContestHeader";
import { Stage1Registration } from "@/components/stages/Stage1Registration";
import { Stage2Writing } from "@/components/stages/Stage2Writing";
import { createDbClient } from "@/db";
import {
  editionPrompts,
  editions,
  enrollments,
  stories,
  users,
} from "@/db/schema";
import { createAuthInstance } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import {
  canUserAccessContestWorkspace,
  resolveCurrentContestStage,
  resolveParticipantStatusLabel,
} from "@/lib/contest-stage";
import { shouldRedirectToCompleteProfile } from "@/lib/profile-gate";
import {
  resolveStage2ViewState,
  type Stage2ExistingStorySnapshot,
} from "@/lib/stage2-writing";
import { formatCaracasDateTime } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function ConcursoPage() {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const auth = createAuthInstance(db, cfEnv);

  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [userRows, activeEditions] = await Promise.all([
    db.select().from(users).where(eq(users.id, session.user.id)),
    db.select().from(editions).where(eq(editions.isActive, true)),
  ]);

  const user = userRows[0];
  if (!user) {
    redirect("/login");
  }

  if (
    shouldRedirectToCompleteProfile(
      {
        firstName: user.firstName,
        lastName: user.lastName,
        country: user.country,
        phone: user.phone,
        profileCompleted: user.profileCompleted,
      },
      "/concurso"
    )
  ) {
    redirect("/completar-perfil");
  }

  const edition = activeEditions[0];
  if (!edition) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <section className="rounded-card border border-ink bg-paper-2 p-8">
          <h1>Olimpíadas Literarias de SiTeLoCuento</h1>
          <p className="lead mt-3 text-ink-2">
            Actualmente no hay ninguna edición activa del concurso. Te
            avisaremos cuando abran las próximas inscripciones.
          </p>
        </section>
      </main>
    );
  }

  const enrollmentRows = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.editionId, edition.id),
        eq(enrollments.userId, user.id)
      )
    );
  const enrollment = enrollmentRows[0] ?? null;

  const now = new Date();
  const nowIso = now.toISOString();
  const stage = resolveCurrentContestStage(edition, now);
  const statusLabel = resolveParticipantStatusLabel(stage, enrollment);
  const canAccess = canUserAccessContestWorkspace(stage, Boolean(enrollment));

  if (!canAccess) {
    return (
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-12">
        <ContestHeader
          edition={edition}
          enrollment={enrollment}
          nowIso={nowIso}
        />
        <section className="rounded-card border border-ink bg-paper-2 p-8">
          <h2>Inscripciones cerradas</h2>
          <p className="lead mt-3 text-ink-2">
            El período de inscripción para {edition.title} ya concluyó y tu
            cuenta no figura inscrita en esta edición.
          </p>
          <p className="mt-4 text-sm text-ink-2">
            Puedes actualizar tus datos en tu perfil y consultar las bases o
            ediciones anteriores mientras esperas la próxima convocatoria.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <a href="/perfil" className="btn btn--secondary">
              Ir a mi perfil
            </a>
            <a href="/bases-del-concurso" className="riso-link self-center text-sm font-medium">
              Bases del Concurso
            </a>
          </div>
        </section>
      </main>
    );
  }

  let stage2Content: React.ReactNode = null;
  if (
    (stage === "WRITING" || stage === "BUFFER_BEFORE_SUBMISSION") &&
    enrollment
  ) {
    const promptRows = await db
      .select()
      .from(editionPrompts)
      .where(eq(editionPrompts.editionId, edition.id))
      .orderBy(asc(editionPrompts.promptNumber));

    const viewState = resolveStage2ViewState({
      enrollmentStatus: enrollment.status,
      disqualificationReason: enrollment.disqualificationReason,
      prompts: promptRows.map((p) => ({
        id: p.id,
        promptNumber: p.promptNumber,
        title: p.title,
        body: p.body,
        mediaType: p.mediaType,
        mediaUrl: p.mediaUrl,
        publishedAt: p.publishedAt,
        closesAt: p.closesAt,
      })),
      submissionStartAt: edition.submissionStartAt,
      nowIso: now,
    });

    let initialStory: Stage2ExistingStorySnapshot | null = null;
    if (viewState.kind === "OPEN_PROMPT") {
      const storyRows = await db
        .select({
          id: stories.id,
          promptId: stories.promptId,
          originalTitle: stories.originalTitle,
          originalBody: stories.originalBody,
          originalCharCount: stories.originalCharCount,
          submittedAt: stories.submittedAt,
        })
        .from(stories)
        .where(
          and(
            eq(stories.enrollmentId, enrollment.id),
            eq(stories.promptId, viewState.prompt.id)
          )
        );
      initialStory = storyRows[0] ?? null;
    }

    stage2Content = (
      <Stage2Writing
        editionId={edition.id}
        userId={user.id}
        minChars={edition.minChars}
        maxChars={edition.maxChars}
        missesCount={enrollment.missesCount}
        maxAllowedMisses={edition.maxAllowedMisses}
        viewState={viewState}
        initialStory={initialStory}
      />
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-12">
      <ContestHeader
        edition={edition}
        enrollment={enrollment}
        nowIso={nowIso}
      />

      {stage === "BEFORE_REGISTRATION" && (
        <section className="rounded-card border border-ink bg-paper-2 p-8">
          <h2>Próximamente</h2>
          <p className="lead mt-3 text-ink-2">
            Las inscripciones para {edition.title} abrirán el{" "}
            <strong className="num">
              {formatCaracasDateTime(edition.registrationStartAt)}
            </strong>
            .
          </p>
        </section>
      )}

      {stage === "REGISTRATION" && (
        <Stage1Registration
          editionTitle={edition.title}
          registrationEndAt={edition.registrationEndAt}
          writingStartAt={edition.writingStartAt}
          isEnrolled={Boolean(enrollment)}
        />
      )}

      {stage2Content}

      {stage !== "BEFORE_REGISTRATION" &&
        stage !== "REGISTRATION" &&
        stage !== "WRITING" &&
        stage !== "BUFFER_BEFORE_SUBMISSION" && (
          <section className="rounded-card border border-ink bg-paper-2 p-8">
            <h2>Etapa en curso</h2>
            <p className="lead mt-3 text-ink-2">
              Tu estatus actual es <strong>{statusLabel}</strong>. Esta vista se
              habilitará conforme avance la etapa correspondiente.
            </p>
          </section>
        )}
    </main>
  );
}
