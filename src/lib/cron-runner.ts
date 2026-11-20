/**
 * Cloudflare Cron Trigger Engine (every 5 minutes: `*\/5 * * * *`)
 * Step 6.4: Idempotent state-reconciliation pipeline for all 7 stages, reminders, automatic disqualifications, 24h correction windows, and jury pause alerts
 */

import { and, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import {
  editionPrompts,
  editions,
  enrollments,
  promptBank,
  stories,
  storyModificationAlerts,
  users,
  votes,
} from "@/db/schema";
import { dispatchTemplateEmail } from "./email";
import { openCorrectionWindowForPendingAlertInDb } from "./stage4-admin-review";
import {
  closeStage5AndSelectJuryFinalistsInDb,
  pauseJuryStageForMissingVotesInDb,
} from "./stage6-jury";
import {
  MS_PER_HOUR,
  addHoursToUtcIso,
  formatCaracasDateTime,
  parseUtcMs,
} from "./timezone";

export interface CronTickOptions {
  db: AppDatabase;
  baseUrl: string;
  brevoApiKey?: string;
  nowIso?: string;
}

export interface CronTickSummary {
  processed: boolean;
  editionId?: string;
  remindersSent: number;
  promptsClosed: number;
  disqualificationsApplied: number;
  correctionWindowsOpened: number;
  stage5Closed: boolean;
  juryPaused: boolean;
}

/**
 * Helper: checks whether `nowMs` is strictly before `targetMs` and within `windowHours` hours.
 */
export function isWithinLeadingWindowHours(
  nowMs: number,
  targetIso: string,
  windowHours: number
): boolean {
  const targetMs = parseUtcMs(targetIso);
  const diffMs = targetMs - nowMs;
  return diffMs > 0 && diffMs <= windowHours * MS_PER_HOUR;
}

/**
 * Executes one idempotent 5-minute reconciliation tick for the active contest edition.
 * All emails rely on `email_dispatch_logs` unique keys so re-running is always safe.
 */
export async function runContestCronTick(
  options: CronTickOptions
): Promise<CronTickSummary> {
  const summary: CronTickSummary = {
    processed: false,
    remindersSent: 0,
    promptsClosed: 0,
    disqualificationsApplied: 0,
    correctionWindowsOpened: 0,
    stage5Closed: false,
    juryPaused: false,
  };

  const activeEditions = await options.db
    .select()
    .from(editions)
    .where(eq(editions.isActive, true));

  const edition = activeEditions[0];
  if (!edition || edition.winnersAnnounced) {
    return summary;
  }

  summary.processed = true;
  summary.editionId = edition.id;

  const nowIso = options.nowIso ?? new Date().toISOString();
  const nowMs = parseUtcMs(nowIso);
  const cleanBase = options.baseUrl.replace(/\/$/, "");

  const [
    editionEnrollments,
    prompts,
    editionStories,
    allUsers,
    editionVotes,
  ] = await Promise.all([
    options.db
      .select()
      .from(enrollments)
      .where(eq(enrollments.editionId, edition.id)),
    options.db
      .select()
      .from(editionPrompts)
      .where(eq(editionPrompts.editionId, edition.id)),
    options.db
      .select()
      .from(stories)
      .where(eq(stories.editionId, edition.id)),
    options.db.select().from(users),
    options.db
      .select()
      .from(votes)
      .where(eq(votes.editionId, edition.id)),
  ]);

  const userById = new Map(allUsers.map((u) => [u.id, u]));
  const activeEnrollments = editionEnrollments.filter(
    (e) => e.status === "ACTIVE"
  );
  const admins = allUsers.filter(
    (u) => u.role === "ADMIN" || u.role === "SUPERADMIN"
  );
  const jurors = allUsers.filter((u) => u.role === "JURY");

  // -------------------------------------------------------------------------
  // 1. 24h Pre-Stage Reminders (E04 before Stage 2, E08 before Stage 3)
  // -------------------------------------------------------------------------
  if (isWithinLeadingWindowHours(nowMs, edition.writingStartAt, 24)) {
    for (const enr of activeEnrollments) {
      const user = userById.get(enr.userId);
      if (!user) continue;
      const res = await dispatchTemplateEmail({
        db: options.db,
        apiKey: options.brevoApiKey,
        editionId: edition.id,
        templateCode: "E04",
        recipientUserId: user.id,
        recipientEmail: user.email,
        recipientName: user.name ?? user.email,
        contextKey: `stage2_start_24h_${edition.id}`,
        variables: {
          NOMBRE: user.firstName ?? user.name ?? "Participante",
          APELLIDO: user.lastName ?? "",
          EDICION: edition.title,
          FECHA_HORA_CIERRE: formatCaracasDateTime(edition.writingStartAt),
          LINK_PLATAFORMA: `${cleanBase}/concurso`,
        },
        nowIso,
      });
      if (res.dispatched) summary.remindersSent += 1;
    }
  }

  if (isWithinLeadingWindowHours(nowMs, edition.submissionStartAt, 24)) {
    for (const enr of activeEnrollments) {
      const user = userById.get(enr.userId);
      if (!user) continue;
      const res = await dispatchTemplateEmail({
        db: options.db,
        apiKey: options.brevoApiKey,
        editionId: edition.id,
        templateCode: "E08",
        recipientUserId: user.id,
        recipientEmail: user.email,
        recipientName: user.name ?? user.email,
        contextKey: `stage3_start_24h_${edition.id}`,
        variables: {
          NOMBRE: user.firstName ?? user.name ?? "Participante",
          APELLIDO: user.lastName ?? "",
          EDICION: edition.title,
          FECHA_HORA_CIERRE: formatCaracasDateTime(edition.submissionStartAt),
          LINK_PLATAFORMA: `${cleanBase}/concurso`,
        },
        nowIso,
      });
      if (res.dispatched) summary.remindersSent += 1;
    }
  }

  // -------------------------------------------------------------------------
  // 2. Stage 2 Prompt Opening (E05), 1h Reminder (E06) & Closing (E07 / E17)
  // -------------------------------------------------------------------------
  for (const prompt of prompts) {
    const publishedMs = parseUtcMs(prompt.publishedAt);
    const closesMs = parseUtcMs(prompt.closesAt);

    if (nowMs >= publishedMs && nowMs < closesMs) {
      if (prompt.sourcePromptBankId) {
        await options.db
          .update(promptBank)
          .set({ status: "USED", updatedAt: nowIso })
          .where(eq(promptBank.id, prompt.sourcePromptBankId));
      }

      for (const enr of activeEnrollments) {
        const user = userById.get(enr.userId);
        if (!user) continue;
        const res = await dispatchTemplateEmail({
          db: options.db,
          apiKey: options.brevoApiKey,
          editionId: edition.id,
          templateCode: "E05",
          recipientUserId: user.id,
          recipientEmail: user.email,
          recipientName: user.name ?? user.email,
          contextKey: `prompt_${prompt.id}_open`,
          variables: {
            NOMBRE: user.firstName ?? user.name ?? "Participante",
            APELLIDO: user.lastName ?? "",
            EDICION: edition.title,
            NUMERO_CONSIGNA: prompt.promptNumber,
            TITULO_CONSIGNA: prompt.title,
            FECHA_HORA_CIERRE: formatCaracasDateTime(prompt.closesAt),
            LINK_PLATAFORMA: `${cleanBase}/concurso`,
          },
          nowIso,
        });
        if (res.dispatched) summary.remindersSent += 1;
      }
    }

    const submittedEnrollmentIds = new Set(
      editionStories
        .filter((s) => s.promptId === prompt.id)
        .map((s) => s.enrollmentId)
    );

    if (isWithinLeadingWindowHours(nowMs, prompt.closesAt, 1)) {
      for (const enr of activeEnrollments) {
        if (submittedEnrollmentIds.has(enr.id)) continue;
        const user = userById.get(enr.userId);
        if (!user) continue;
        const res = await dispatchTemplateEmail({
          db: options.db,
          apiKey: options.brevoApiKey,
          editionId: edition.id,
          templateCode: "E06",
          recipientUserId: user.id,
          recipientEmail: user.email,
          recipientName: user.name ?? user.email,
          contextKey: `prompt_${prompt.id}_1h_reminder`,
          variables: {
            NOMBRE: user.firstName ?? user.name ?? "Participante",
            APELLIDO: user.lastName ?? "",
            EDICION: edition.title,
            NUMERO_CONSIGNA: prompt.promptNumber,
            TITULO_CONSIGNA: prompt.title,
            FECHA_HORA_CIERRE: formatCaracasDateTime(prompt.closesAt),
            LINK_PLATAFORMA: `${cleanBase}/concurso`,
          },
          nowIso,
        });
        if (res.dispatched) summary.remindersSent += 1;
      }
    }

    if (nowMs >= closesMs && !prompt.closesProcessed) {
      for (const enr of activeEnrollments) {
        if (submittedEnrollmentIds.has(enr.id)) continue;
        const nextMisses = enr.missesCount + 1;
        const user = userById.get(enr.userId);

        if (nextMisses > edition.maxAllowedMisses) {
          await options.db
            .update(enrollments)
            .set({
              missesCount: nextMisses,
              status: "DISQUALIFIED",
              disqualificationReason: "MAX_MISSES",
              disqualifiedAt: nowIso,
            })
            .where(eq(enrollments.id, enr.id));
          enr.status = "DISQUALIFIED";
          summary.disqualificationsApplied += 1;

          if (user) {
            await dispatchTemplateEmail({
              db: options.db,
              apiKey: options.brevoApiKey,
              editionId: edition.id,
              templateCode: "E17",
              recipientUserId: user.id,
              recipientEmail: user.email,
              recipientName: user.name ?? user.email,
              contextKey: `dq_max_misses_${edition.id}`,
              variables: {
                NOMBRE: user.firstName ?? user.name ?? "Participante",
                APELLIDO: user.lastName ?? "",
                EDICION: edition.title,
                CANTIDAD_FALLAS: nextMisses,
                MAX_FALLAS: edition.maxAllowedMisses,
                LINK_PLATAFORMA: `${cleanBase}/concurso`,
              },
              nowIso,
            });
          }
        } else {
          await options.db
            .update(enrollments)
            .set({ missesCount: nextMisses })
            .where(eq(enrollments.id, enr.id));
          enr.missesCount = nextMisses;

          if (nextMisses === edition.maxAllowedMisses && user) {
            const res = await dispatchTemplateEmail({
              db: options.db,
              apiKey: options.brevoApiKey,
              editionId: edition.id,
              templateCode: "E07",
              recipientUserId: user.id,
              recipientEmail: user.email,
              recipientName: user.name ?? user.email,
              contextKey: `warning_max_misses_${prompt.id}`,
              variables: {
                NOMBRE: user.firstName ?? user.name ?? "Participante",
                APELLIDO: user.lastName ?? "",
                EDICION: edition.title,
                CANTIDAD_FALLAS: nextMisses,
                MAX_FALLAS: edition.maxAllowedMisses,
                LINK_PLATAFORMA: `${cleanBase}/concurso`,
              },
              nowIso,
            });
            if (res.dispatched) summary.remindersSent += 1;
          }
        }
      }

      await options.db
        .update(editionPrompts)
        .set({ closesProcessed: true })
        .where(eq(editionPrompts.id, prompt.id));
      summary.promptsClosed += 1;
    }
  }

  // -------------------------------------------------------------------------
  // 3. Stage 3 1h Reminder (E09) & Closing Disqualification (NO_POSTULATION)
  // -------------------------------------------------------------------------
  if (isWithinLeadingWindowHours(nowMs, edition.submissionEndAt, 1)) {
    for (const enr of activeEnrollments) {
      if (enr.status !== "ACTIVE" || enr.postulatedAt) continue;
      const user = userById.get(enr.userId);
      if (!user) continue;
      const res = await dispatchTemplateEmail({
        db: options.db,
        apiKey: options.brevoApiKey,
        editionId: edition.id,
        templateCode: "E09",
        recipientUserId: user.id,
        recipientEmail: user.email,
        recipientName: user.name ?? user.email,
        contextKey: `stage3_1h_reminder_${edition.id}`,
        variables: {
          NOMBRE: user.firstName ?? user.name ?? "Participante",
          APELLIDO: user.lastName ?? "",
          EDICION: edition.title,
          FECHA_HORA_CIERRE: formatCaracasDateTime(edition.submissionEndAt),
          LINK_PLATAFORMA: `${cleanBase}/concurso`,
        },
        nowIso,
      });
      if (res.dispatched) summary.remindersSent += 1;
    }
  }

  if (nowMs >= parseUtcMs(edition.submissionEndAt)) {
    for (const enr of activeEnrollments) {
      if (enr.status !== "ACTIVE" || enr.postulatedAt) continue;
      await options.db
        .update(enrollments)
        .set({
          status: "DISQUALIFIED",
          disqualificationReason: "NO_POSTULATION",
          disqualifiedAt: nowIso,
        })
        .where(eq(enrollments.id, enr.id));
      enr.status = "DISQUALIFIED";
      summary.disqualificationsApplied += 1;

      const user = userById.get(enr.userId);
      if (user) {
        await dispatchTemplateEmail({
          db: options.db,
          apiKey: options.brevoApiKey,
          editionId: edition.id,
          templateCode: "E17",
          recipientUserId: user.id,
          recipientEmail: user.email,
          recipientName: user.name ?? user.email,
          contextKey: `dq_no_postulation_${edition.id}`,
          variables: {
            NOMBRE: user.firstName ?? user.name ?? "Participante",
            APELLIDO: user.lastName ?? "",
            EDICION: edition.title,
            LINK_PLATAFORMA: `${cleanBase}/concurso`,
          },
          nowIso,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 4. Stage 4 Close -> Open 24h Correction Windows (E12) & Expire Windows
  // -------------------------------------------------------------------------
  const storyIds = editionStories.map((s) => s.id);
  const storyById = new Map(editionStories.map((s) => [s.id, s]));
  const enrollmentById = new Map(editionEnrollments.map((e) => [e.id, e]));

  if (nowMs >= parseUtcMs(edition.adminReviewEndAt) && storyIds.length > 0) {
    const pendingAlerts = await options.db
      .select()
      .from(storyModificationAlerts)
      .where(
        and(
          inArray(storyModificationAlerts.storyId, storyIds),
          eq(storyModificationAlerts.status, "PENDING")
        )
      );

    for (const alert of pendingAlerts) {
      const story = storyById.get(alert.storyId);
      if (!story) continue;
      const enr = enrollmentById.get(story.enrollmentId);
      const participant = userById.get(story.authorId);
      if (!enr || !participant || enr.status !== "ACTIVE") continue;

      if (alert.round === 1) {
        await openCorrectionWindowForPendingAlertInDb({
          db: options.db,
          edition,
          alertId: alert.id,
          enrollmentId: enr.id,
          participant,
          storyTitle: story.editedTitle ?? story.originalTitle,
          baseUrl: cleanBase,
          brevoApiKey: options.brevoApiKey,
          nowIso,
        });
        summary.correctionWindowsOpened += 1;
      } else if (
        alert.round === 2 &&
        nowMs >= parseUtcMs(edition.votingStartAt)
      ) {
        await options.db
          .update(storyModificationAlerts)
          .set({ status: "REJECTED", resolvedAt: nowIso })
          .where(eq(storyModificationAlerts.id, alert.id));

        await options.db
          .update(enrollments)
          .set({
            status: "DISQUALIFIED",
            disqualificationReason: "MODIFICATION_REJECTED",
            disqualifiedAt: nowIso,
          })
          .where(eq(enrollments.id, enr.id));
        enr.status = "DISQUALIFIED";
        summary.disqualificationsApplied += 1;

        await dispatchTemplateEmail({
          db: options.db,
          apiKey: options.brevoApiKey,
          editionId: edition.id,
          templateCode: "E17",
          recipientUserId: participant.id,
          recipientEmail: participant.email,
          recipientName: participant.name ?? participant.email,
          contextKey: `dq_mod_rejected_r2_${enr.id}`,
          variables: {
            NOMBRE: participant.firstName ?? participant.name ?? "Participante",
            APELLIDO: participant.lastName ?? "",
            EDICION: edition.title,
            LINK_PLATAFORMA: `${cleanBase}/concurso`,
          },
          nowIso,
        });
      }
    }
  }

  const correctionWindowEndMs = parseUtcMs(
    addHoursToUtcIso(edition.adminReviewEndAt, 24)
  );
  if (nowMs >= correctionWindowEndMs) {
    for (const enr of activeEnrollments) {
      if (
        enr.status === "ACTIVE" &&
        enr.inCorrectionWindow &&
        !enr.correctionSubmittedAt
      ) {
        await options.db
          .update(enrollments)
          .set({
            status: "DISQUALIFIED",
            disqualificationReason: "MODIFICATION_REJECTED",
            disqualifiedAt: nowIso,
            inCorrectionWindow: false,
          })
          .where(eq(enrollments.id, enr.id));
        enr.status = "DISQUALIFIED";
        summary.disqualificationsApplied += 1;

        const user = userById.get(enr.userId);
        if (user) {
          await dispatchTemplateEmail({
            db: options.db,
            apiKey: options.brevoApiKey,
            editionId: edition.id,
            templateCode: "E17",
            recipientUserId: user.id,
            recipientEmail: user.email,
            recipientName: user.name ?? user.email,
            contextKey: `dq_correction_missed_${enr.id}`,
            variables: {
              NOMBRE: user.firstName ?? user.name ?? "Participante",
              APELLIDO: user.lastName ?? "",
              EDICION: edition.title,
              LINK_PLATAFORMA: `${cleanBase}/concurso`,
            },
            nowIso,
          });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 5. Stage 5 Opening (E14), 1h Reminder (E15) & Closing (Top 10+Ties)
  // -------------------------------------------------------------------------
  const votingStartMs = parseUtcMs(edition.votingStartAt);
  const votingEndMs = parseUtcMs(edition.votingEndAt);

  if (nowMs >= votingStartMs && nowMs < votingEndMs) {
    for (const enr of activeEnrollments) {
      if (enr.status !== "ACTIVE") continue;
      const user = userById.get(enr.userId);
      if (!user) continue;
      const res = await dispatchTemplateEmail({
        db: options.db,
        apiKey: options.brevoApiKey,
        editionId: edition.id,
        templateCode: "E14",
        recipientUserId: user.id,
        recipientEmail: user.email,
        recipientName: user.name ?? user.email,
        contextKey: `stage5_voting_open_${edition.id}`,
        variables: {
          NOMBRE: user.firstName ?? user.name ?? "Participante",
          APELLIDO: user.lastName ?? "",
          EDICION: edition.title,
          FECHA_HORA_CIERRE: formatCaracasDateTime(edition.votingEndAt),
          LINK_PLATAFORMA: `${cleanBase}/concurso`,
        },
        nowIso,
      });
      if (res.dispatched) summary.remindersSent += 1;
    }
  }

  if (isWithinLeadingWindowHours(nowMs, edition.votingEndAt, 1)) {
    for (const enr of activeEnrollments) {
      if (enr.status !== "ACTIVE" || enr.hasVoted) continue;
      const user = userById.get(enr.userId);
      if (!user) continue;
      const res = await dispatchTemplateEmail({
        db: options.db,
        apiKey: options.brevoApiKey,
        editionId: edition.id,
        templateCode: "E15",
        recipientUserId: user.id,
        recipientEmail: user.email,
        recipientName: user.name ?? user.email,
        contextKey: `stage5_voting_1h_reminder_${edition.id}`,
        variables: {
          NOMBRE: user.firstName ?? user.name ?? "Participante",
          APELLIDO: user.lastName ?? "",
          EDICION: edition.title,
          FECHA_HORA_CIERRE: formatCaracasDateTime(edition.votingEndAt),
          LINK_PLATAFORMA: `${cleanBase}/concurso`,
        },
        nowIso,
      });
      if (res.dispatched) summary.remindersSent += 1;
    }
  }

  const alreadySelectedFinalists = editionStories.some((s) => s.passedToJury);
  if (nowMs >= votingEndMs && !alreadySelectedFinalists) {
    const stillActive = activeEnrollments.filter((e) => e.status === "ACTIVE");
    const postulated = editionStories.filter((s) => s.isPostulated);
    if (stillActive.length > 0 && postulated.length > 0) {
      const closeRes = await closeStage5AndSelectJuryFinalistsInDb({
        db: options.db,
        edition,
        activeEnrollments: stillActive,
        usersById: userById,
        postulatedStories: postulated,
        baseUrl: cleanBase,
        brevoApiKey: options.brevoApiKey,
        nowIso,
      });
      summary.disqualificationsApplied += closeRes.disqualifiedCount;
      summary.stage5Closed = true;
    }
  }

  // -------------------------------------------------------------------------
  // 6. Stage 6 Jury Opening (E20), 1h Reminder (E21) & Missing-Juror Pause (E23)
  // -------------------------------------------------------------------------
  const juryStartMs = parseUtcMs(edition.juryStartAt);
  const juryEndMs = parseUtcMs(edition.juryEndAt);
  const juryVoterIds = new Set(
    editionVotes.filter((v) => v.voterRole === "JURY").map((v) => v.voterId)
  );

  if (nowMs >= juryStartMs && nowMs < juryEndMs) {
    for (const juror of jurors) {
      const res = await dispatchTemplateEmail({
        db: options.db,
        apiKey: options.brevoApiKey,
        editionId: edition.id,
        templateCode: "E20",
        recipientUserId: juror.id,
        recipientEmail: juror.email,
        recipientName: juror.name ?? juror.email,
        contextKey: `stage6_jury_open_${edition.id}`,
        variables: {
          NOMBRE: juror.firstName ?? juror.name ?? "Jurado",
          APELLIDO: juror.lastName ?? "",
          EDICION: edition.title,
          FECHA_HORA_CIERRE: formatCaracasDateTime(edition.juryEndAt),
          LINK_PLATAFORMA: `${cleanBase}/jurado`,
        },
        nowIso,
      });
      if (res.dispatched) summary.remindersSent += 1;
    }
  }

  if (isWithinLeadingWindowHours(nowMs, edition.juryEndAt, 1)) {
    for (const juror of jurors) {
      if (juryVoterIds.has(juror.id)) continue;
      const res = await dispatchTemplateEmail({
        db: options.db,
        apiKey: options.brevoApiKey,
        editionId: edition.id,
        templateCode: "E21",
        recipientUserId: juror.id,
        recipientEmail: juror.email,
        recipientName: juror.name ?? juror.email,
        contextKey: `stage6_jury_1h_reminder_${edition.id}`,
        variables: {
          NOMBRE: juror.firstName ?? juror.name ?? "Jurado",
          APELLIDO: juror.lastName ?? "",
          EDICION: edition.title,
          FECHA_HORA_CIERRE: formatCaracasDateTime(edition.juryEndAt),
          LINK_PLATAFORMA: `${cleanBase}/jurado`,
        },
        nowIso,
      });
      if (res.dispatched) summary.remindersSent += 1;
    }
  }

  if (
    nowMs >= juryEndMs &&
    !edition.juryPausedMissingVotes &&
    jurors.length > 0 &&
    juryVoterIds.size < jurors.length
  ) {
    await pauseJuryStageForMissingVotesInDb({
      db: options.db,
      edition,
      admins,
      baseUrl: cleanBase,
      brevoApiKey: options.brevoApiKey,
      nowIso,
    });
    summary.juryPaused = true;
  }

  return summary;
}
