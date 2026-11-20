/**
 * Stage 7 Winners Announcement & Public Archive Domain Logic
 * Step 6.1: Manual publish-winners readiness check, E26 broadcast to all stakeholders, PUBLISH_WINNERS audit log, and chronological story sorting (zero scores exposed)
 */

import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { auditLogs, editions } from "@/db/schema";
import { dispatchTemplateEmail } from "./email";
import { parseUtcMs } from "./timezone";

export interface PublishReadinessInput {
  edition: {
    winnersAnnounced: boolean;
    tieBreakerActive: boolean;
    juryPausedMissingVotes: boolean;
  };
  totalJurorsCount: number;
  juryVotesCount: number;
  hasUnresolvedTieBreaker: boolean;
}

export interface PublishReadinessResult {
  ready: boolean;
  reason?: string;
}

/**
 * Checks whether Admins/Superadmin can press "Publicar y Anunciar Ganadores".
 */
export function evaluatePublishWinnersReadiness(
  input: PublishReadinessInput
): PublishReadinessResult {
  if (input.edition.winnersAnnounced) {
    return {
      ready: false,
      reason: "Los ganadores de esta edición ya fueron publicados.",
    };
  }
  if (input.totalJurorsCount === 0) {
    return {
      ready: false,
      reason: "No hay miembros del jurado asignados en la plataforma.",
    };
  }
  if (input.juryVotesCount < input.totalJurorsCount) {
    return {
      ready: false,
      reason: `Faltan votos del jurado (${input.juryVotesCount} de ${input.totalJurorsCount} completados).`,
    };
  }
  if (input.edition.juryPausedMissingVotes) {
    return {
      ready: false,
      reason: "La evaluación del jurado está en pausa por votos pendientes.",
    };
  }
  if (input.edition.tieBreakerActive || input.hasUnresolvedTieBreaker) {
    return {
      ready: false,
      reason: "Existe una ronda de desempate del jurado pendiente de resolución.",
    };
  }

  return { ready: true };
}

/**
 * Sorts published stories chronologically by prompt number ascending, then submission timestamp ascending.
 * Public archives NEVER sort by or expose numeric scores.
 */
export function sortPublishedEditionStoriesChronologically<
  T extends { promptNumber: number; submittedAt: string },
>(storyList: T[]): T[] {
  return [...storyList].sort((a, b) => {
    if (a.promptNumber !== b.promptNumber) {
      return a.promptNumber - b.promptNumber;
    }
    return parseUtcMs(a.submittedAt) - parseUtcMs(b.submittedAt);
  });
}

export interface AnnouncementRecipient {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
}

export interface PublishWinnersInput {
  db: AppDatabase;
  edition: {
    id: string;
    title: string;
    slug: string;
    winnersAnnounced: boolean;
    tieBreakerActive: boolean;
    juryPausedMissingVotes: boolean;
  };
  actorAdminId: string;
  totalJurorsCount: number;
  juryVotesCount: number;
  hasUnresolvedTieBreaker: boolean;
  recipients: AnnouncementRecipient[];
  baseUrl: string;
  brevoApiKey?: string;
  nowIso?: string;
}

export interface PublishWinnersResult {
  published: boolean;
  announcedAt?: string;
  notifiedCount?: number;
  error?: string;
}

/**
 * Publishes the edition winners, records `PUBLISH_WINNERS` in `audit_logs`,
 * and dispatches `E26` to every unique participant (active & disqualified), juror, admin, and superadmin.
 */
export async function publishWinnersInDb(
  input: PublishWinnersInput
): Promise<PublishWinnersResult> {
  const readiness = evaluatePublishWinnersReadiness({
    edition: input.edition,
    totalJurorsCount: input.totalJurorsCount,
    juryVotesCount: input.juryVotesCount,
    hasUnresolvedTieBreaker: input.hasUnresolvedTieBreaker,
  });

  if (!readiness.ready) {
    return { published: false, error: readiness.reason };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();

  await input.db
    .update(editions)
    .set({
      winnersAnnounced: true,
      winnersAnnouncedAt: nowIso,
      updatedAt: nowIso,
    })
    .where(eq(editions.id, input.edition.id));

  await input.db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    editionId: input.edition.id,
    actorId: input.actorAdminId,
    actionType: "PUBLISH_WINNERS",
    targetUserId: null,
    targetStoryId: null,
    justification: `Publicación oficial de ganadores de ${input.edition.title}.`,
    metadataJson: JSON.stringify({
      announcedAt: nowIso,
      editionSlug: input.edition.slug,
    }),
    createdAt: nowIso,
  });

  // Deduplicate recipients by user ID
  const uniqueById = new Map<string, AnnouncementRecipient>();
  for (const r of input.recipients) {
    if (!uniqueById.has(r.id)) {
      uniqueById.set(r.id, r);
    }
  }

  const cleanBase = input.baseUrl.replace(/\/$/, "");
  let notifiedCount = 0;

  for (const recipient of uniqueById.values()) {
    const res = await dispatchTemplateEmail({
      db: input.db,
      apiKey: input.brevoApiKey,
      editionId: input.edition.id,
      templateCode: "E26",
      recipientUserId: recipient.id,
      recipientEmail: recipient.email,
      recipientName: recipient.name ?? recipient.email,
      contextKey: `winners_announced_${input.edition.id}`,
      variables: {
        NOMBRE: recipient.firstName ?? recipient.name ?? "Participante",
        APELLIDO: recipient.lastName ?? "",
        EDICION: input.edition.title,
        LINK_PLATAFORMA: `${cleanBase}/ediciones/${input.edition.slug}`,
        LINK_RESULTADOS: `${cleanBase}/resultados`,
      },
      nowIso,
    });
    if (res.dispatched) {
      notifiedCount += 1;
    }
  }

  return {
    published: true,
    announcedAt: nowIso,
    notifiedCount,
  };
}
