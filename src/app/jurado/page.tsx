/**
 * Jury Blind Evaluation & Stage 6b Tie-Breaker Page (/jurado)
 * Step 5.2: Waiting notice prior to Stage 6, blind Top 3 evaluation over Top 10+ties finalists, and conditional Stage 6b tie-breaker
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { JuryTieBreakerView } from "@/components/jury/JuryTieBreakerView";
import { Stage5Voting } from "@/components/stages/Stage5Voting";
import { createDbClient } from "@/db";
import {
  editionPrompts,
  editions,
  enrollments,
  stories,
  storyReadsPreselections,
  tieBreakerRounds,
  tieBreakerVotes,
  users,
  votes,
} from "@/db/schema";
import { createAuthInstance, resolveRequestUrlFromHeaders } from "@/lib/auth";
import type { CloudflareEnv } from "@/lib/cloudflare-env";
import { resolveCurrentContestStage } from "@/lib/contest-stage";
import { resolveJuryMultiplier } from "@/lib/edition-management";
import {
  sortStoriesDeterministicallyForVoter,
  type AnonymousVotingStoryItem,
} from "@/lib/stage5-voting";
import { parseJuryBracketsJson } from "@/lib/stage6-jury";
import { formatCaracasDateTime } from "@/lib/timezone";

export const dynamic = "force-dynamic";

function formatTiedPositionsLabel(code: string): string {
  switch (code) {
    case "1_2_3":
      return "1er, 2do y 3er lugar";
    case "1_2":
      return "1er y 2do lugar";
    case "2_3":
      return "2do y 3er lugar";
    case "3_ONLY":
      return "3er lugar";
    default:
      return "el podio final";
  }
}

export default async function JuradoPage() {
  const { env } = await getCloudflareContext({ async: true });
  const cfEnv = env as unknown as CloudflareEnv;
  const db = createDbClient(cfEnv.DB);
  const reqHeaders = await headers();
  const auth = createAuthInstance(
    db,
    cfEnv,
    resolveRequestUrlFromHeaders(reqHeaders)
  );
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [userRows, activeEditions] = await Promise.all([
    db.select().from(users).where(eq(users.id, session.user.id)),
    db.select().from(editions).where(eq(editions.isActive, true)),
  ]);

  const juror = userRows[0];
  if (!juror || juror.role !== "JURY") {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <section className="rounded-card border border-ink bg-paper-2 p-8">
          <h1>Acceso restringido</h1>
          <p className="lead mt-3 text-ink-2">
            Esta sección es exclusiva para miembros designados del jurado.
          </p>
        </section>
      </main>
    );
  }

  const edition = activeEditions[0];
  if (!edition) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <section className="rounded-card border border-ink bg-paper-2 p-8">
          <h1>Panel del Jurado</h1>
          <p className="lead mt-3 text-ink-2">
            Actualmente no hay ninguna edición activa del concurso.
          </p>
        </section>
      </main>
    );
  }

  const now = new Date();
  const stage = resolveCurrentContestStage(edition, now);

  if (stage === "WINNERS_ANNOUNCED") {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <section className="rounded-card border border-ink bg-paper-2 p-8">
          <h1>{edition.title}</h1>
          <p className="lead mt-3 text-ink-2">
            La evaluación del jurado concluyó y los ganadores ya fueron
            anunciados. Gracias por tu labor en esta edición.
          </p>
          <div className="mt-6">
            <a href="/resultados" className="btn btn--primary">
              Ver resultados oficiales
            </a>
          </div>
        </section>
      </main>
    );
  }

  if (stage !== "JURY_EVALUATION" && stage !== "JURY_TIE_BREAKER") {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <section className="rounded-card border border-ink bg-paper-2 p-8">
          <h1>Panel del Jurado: {edition.title}</h1>
          <p className="lead mt-3 text-ink-2">
            La etapa de evaluación del jurado aún no ha comenzado. Los cuentos
            finalistas aparecerán aquí de forma anónima al concluir las
            votaciones de los participantes.
          </p>
          <p className="mt-4 text-sm text-ink-2 num">
            Inicio programado:{" "}
            <strong>{formatCaracasDateTime(edition.juryStartAt)}</strong>.
          </p>
        </section>
      </main>
    );
  }

  const [
    promptRows,
    finalistStories,
    jurorProgress,
    jurorVotes,
    votingParticipants,
  ] = await Promise.all([
    db
      .select()
      .from(editionPrompts)
      .where(eq(editionPrompts.editionId, edition.id)),
    db
      .select()
      .from(stories)
      .where(
        and(eq(stories.editionId, edition.id), eq(stories.passedToJury, true))
      ),
    db
      .select()
      .from(storyReadsPreselections)
      .where(
        and(
          eq(storyReadsPreselections.editionId, edition.id),
          eq(storyReadsPreselections.voterId, juror.id)
        )
      ),
    db
      .select()
      .from(votes)
      .where(
        and(
          eq(votes.editionId, edition.id),
          eq(votes.voterId, juror.id),
          eq(votes.voterRole, "JURY")
        )
      ),
    db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.editionId, edition.id),
          eq(enrollments.hasVoted, true)
        )
      ),
  ]);

  const promptById = new Map(promptRows.map((p) => [p.id, p]));
  const progressByStoryId = new Map(jurorProgress.map((p) => [p.storyId, p]));

  const anonymousFinalists: AnonymousVotingStoryItem[] = finalistStories.map(
    (s) => {
      const prompt = promptById.get(s.promptId);
      const progress = progressByStoryId.get(s.id);
      return {
        id: s.id,
        promptNumber: prompt?.promptNumber ?? 0,
        promptTitle: prompt?.title ?? "",
        promptBody: prompt?.body ?? "",
        promptMediaType: prompt?.mediaType ?? null,
        promptMediaUrl: prompt?.mediaUrl ?? null,
        title: s.editedTitle ?? s.originalTitle,
        body: s.editedBody ?? s.originalBody,
        isOwnStory: false,
        isRead: progress?.isRead ?? false,
        isPreselected: progress?.isPreselected ?? false,
      };
    }
  );

  // Conditional Stage 6b Tie-Breaker
  if (stage === "JURY_TIE_BREAKER") {
    const openRounds = await db
      .select()
      .from(tieBreakerRounds)
      .where(
        and(
          eq(tieBreakerRounds.editionId, edition.id),
          eq(tieBreakerRounds.isResolved, false)
        )
      );
    const activeRound = openRounds[0];

    if (activeRound) {
      let tiedIds: string[] = [];
      try {
        tiedIds = JSON.parse(activeRound.tiedStoryIdsJson) as string[];
      } catch {
        tiedIds = [];
      }
      const tiedSet = new Set(tiedIds);
      const tiedStories = sortStoriesDeterministicallyForVoter(
        juror.id,
        anonymousFinalists.filter((s) => tiedSet.has(s.id))
      );

      const myTbVotes = await db
        .select()
        .from(tieBreakerVotes)
        .where(
          and(
            eq(tieBreakerVotes.tieBreakerRoundId, activeRound.id),
            eq(tieBreakerVotes.jurorId, juror.id)
          )
        );

      return (
        <main className="mx-auto max-w-4xl space-y-8 px-4 py-12">
          <header className="border-b-2 border-ink pb-4">
            <h1>Panel del Jurado: {edition.title}</h1>
            <p className="mt-2 text-sm text-ink-2">
              Evaluación anónima a ciegas (los votos de los participantes
              permanecen ocultos).
            </p>
          </header>

          <JuryTieBreakerView
            tiedPositionsLabel={formatTiedPositionsLabel(
              activeRound.tiedPositions
            )}
            initialHasVoted={myTbVotes.length > 0}
            tiedStories={tiedStories}
          />
        </main>
      );
    }
  }

  const randomizedFinalists = sortStoriesDeterministicallyForVoter(
    juror.id,
    anonymousFinalists
  );

  const brackets = parseJuryBracketsJson(edition.juryBracketsJson);
  const weights = resolveJuryMultiplier(votingParticipants.length, brackets);

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-12">
      <header className="border-b-2 border-ink pb-4">
        <h1>Panel del Jurado: {edition.title}</h1>
        <p className="mt-2 text-sm text-ink-2">
          Evalúas los {randomizedFinalists.length} cuentos finalistas de forma
          100% anónima. Los votos de los participantes permanecen ocultos.
        </p>
      </header>

      <Stage5Voting
        initialHasVoted={jurorVotes.length > 0}
        votingEndAt={edition.juryEndAt}
        stories={randomizedFinalists}
        stateEndpoint="/api/contest/voting/state"
        castEndpoint="/api/jury/vote"
        pointsLabels={{
          first: `${weights.first} pts`,
          second: `${weights.second} pts`,
          third: `${weights.third} pts`,
        }}
        headingTitle="Evaluación del jurado (Finalistas)"
      />
    </main>
  );
}
