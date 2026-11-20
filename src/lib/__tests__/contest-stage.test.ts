import { describe, expect, it } from "vitest";
import {
  buildContestTimeline,
  canUserAccessContestWorkspace,
  resolveCurrentContestStage,
  resolveParticipantStatusLabel,
  type EditionStageSnapshot,
} from "../contest-stage";

const SAMPLE_EDITION: EditionStageSnapshot = {
  title: "Olimpíadas Literarias de SiTeLoCuento 2026",
  registrationStartAt: "2026-06-01T13:00:00.000Z",
  registrationEndAt: "2026-06-15T13:00:00.000Z",
  writingStartAt: "2026-06-16T13:00:00.000Z",
  writingEndAt: "2026-06-30T13:00:00.000Z",
  submissionStartAt: "2026-07-02T13:00:00.000Z",
  submissionEndAt: "2026-07-07T13:00:00.000Z",
  adminReviewStartAt: "2026-07-08T13:00:00.000Z",
  adminReviewEndAt: "2026-07-10T13:00:00.000Z",
  votingStartAt: "2026-07-12T13:00:00.000Z",
  votingEndAt: "2026-07-22T13:00:00.000Z",
  juryStartAt: "2026-07-23T13:00:00.000Z",
  juryEndAt: "2026-07-30T13:00:00.000Z",
};

describe("Step 3.1 — ContestHeader Stage Machine, Timeline & Access Restriction", () => {
  it("resolves every contest stage accurately across timestamps and runtime flags", () => {
    expect(
      resolveCurrentContestStage(SAMPLE_EDITION, "2026-05-20T12:00:00.000Z")
    ).toBe("BEFORE_REGISTRATION");
    expect(
      resolveCurrentContestStage(SAMPLE_EDITION, "2026-06-05T12:00:00.000Z")
    ).toBe("REGISTRATION");
    expect(
      resolveCurrentContestStage(SAMPLE_EDITION, "2026-06-20T12:00:00.000Z")
    ).toBe("WRITING");
    expect(
      resolveCurrentContestStage(SAMPLE_EDITION, "2026-07-01T12:00:00.000Z")
    ).toBe("BUFFER_BEFORE_SUBMISSION");
    expect(
      resolveCurrentContestStage(SAMPLE_EDITION, "2026-07-04T12:00:00.000Z")
    ).toBe("SUBMISSION");
    expect(
      resolveCurrentContestStage(SAMPLE_EDITION, "2026-07-09T12:00:00.000Z")
    ).toBe("ADMIN_REVIEW");
    expect(
      resolveCurrentContestStage(SAMPLE_EDITION, "2026-07-11T12:00:00.000Z")
    ).toBe("BUFFER_BEFORE_VOTING");
    expect(
      resolveCurrentContestStage(SAMPLE_EDITION, "2026-07-15T12:00:00.000Z")
    ).toBe("VOTING");
    expect(
      resolveCurrentContestStage(SAMPLE_EDITION, "2026-07-25T12:00:00.000Z")
    ).toBe("JURY_EVALUATION");
    expect(
      resolveCurrentContestStage(
        { ...SAMPLE_EDITION, tieBreakerActive: true },
        "2026-07-31T12:00:00.000Z"
      )
    ).toBe("JURY_TIE_BREAKER");
    expect(
      resolveCurrentContestStage(
        { ...SAMPLE_EDITION, winnersAnnounced: true },
        "2026-08-01T12:00:00.000Z"
      )
    ).toBe("WINNERS_ANNOUNCED");
  });

  it("builds the 7-stage timeline marking past, current, and upcoming stages", () => {
    const timeline = buildContestTimeline(
      SAMPLE_EDITION,
      "2026-07-04T12:00:00.000Z" // During SUBMISSION
    );

    expect(timeline).toHaveLength(7);
    expect(timeline[0].state).toBe("PAST"); // Inscripciones
    expect(timeline[1].state).toBe("PAST"); // Envío de cuentos
    expect(timeline[2].state).toBe("CURRENT"); // Postulación y edición
    expect(timeline[3].state).toBe("UPCOMING"); // Revisión de administradores
    expect(timeline[4].state).toBe("UPCOMING"); // Votaciones
  });

  it("resolves dynamic Spanish status badges for every participant state", () => {
    expect(resolveParticipantStatusLabel("REGISTRATION", null)).toBe(
      "No inscrito"
    );
    expect(
      resolveParticipantStatusLabel("WRITING", { status: "ACTIVE" })
    ).toBe("Participando");
    expect(
      resolveParticipantStatusLabel("SUBMISSION", {
        status: "ACTIVE",
        selectedStoryId: "s1",
      })
    ).toBe("Editando cuento a postular");
    expect(
      resolveParticipantStatusLabel("SUBMISSION", {
        status: "ACTIVE",
        selectedStoryId: "s1",
        postulatedAt: "2026-07-05T12:00:00.000Z",
      })
    ).toBe("Cuento postulado");
    expect(
      resolveParticipantStatusLabel("BUFFER_BEFORE_VOTING", {
        status: "ACTIVE",
        postulatedAt: "2026-07-05T12:00:00.000Z",
      })
    ).toBe("Esperando votaciones");
    expect(
      resolveParticipantStatusLabel("VOTING", {
        status: "ACTIVE",
        hasVoted: true,
      })
    ).toBe("Votación enviada");
    expect(
      resolveParticipantStatusLabel("WRITING", { status: "DISQUALIFIED" })
    ).toBe("Descalificado");
    expect(
      resolveParticipantStatusLabel("WINNERS_ANNOUNCED", { status: "ACTIVE" })
    ).toBe("Concurso finalizado");
  });

  it("restricts contest workspace access for non-enrolled users after Stage 1 closes", () => {
    expect(canUserAccessContestWorkspace("REGISTRATION", false)).toBe(true);
    expect(canUserAccessContestWorkspace("WRITING", false)).toBe(false);
    expect(canUserAccessContestWorkspace("VOTING", false)).toBe(false);
    expect(canUserAccessContestWorkspace("WRITING", true)).toBe(true);
    expect(canUserAccessContestWorkspace("VOTING", true)).toBe(true);
  });
});
