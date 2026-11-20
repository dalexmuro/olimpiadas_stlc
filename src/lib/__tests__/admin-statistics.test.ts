import { describe, expect, it } from "vitest";
import { computeEditionStatistics } from "../admin-statistics";

describe("Admin Real-Time Statistics (Step 6.2)", () => {
  it("aggregates enrollment totals, disqualification breakdown, prompt counts, jury progress, and sorted final score table", () => {
    const usersById = new Map([
      [
        "u1",
        {
          firstName: "Ana",
          lastName: "Silva",
          name: "Ana Silva",
          email: "ana@example.com",
        },
      ],
      [
        "u2",
        {
          firstName: "Luis",
          lastName: "Pérez",
          name: "Luis Pérez",
          email: "luis@example.com",
        },
      ],
      [
        "u3",
        {
          firstName: "María",
          lastName: "Díaz",
          name: "María Díaz",
          email: "maria@example.com",
        },
      ],
    ]);

    const stats = computeEditionStatistics({
      enrollments: [
        {
          id: "e1",
          userId: "u1",
          status: "ACTIVE",
          disqualificationReason: null,
          postulatedAt: "2026-07-04T10:00:00.000Z",
          hasVoted: true,
        },
        {
          id: "e2",
          userId: "u2",
          status: "ACTIVE",
          disqualificationReason: null,
          postulatedAt: "2026-07-04T11:00:00.000Z",
          hasVoted: false,
        },
        {
          id: "e3",
          userId: "u3",
          status: "DISQUALIFIED",
          disqualificationReason: "MAX_MISSES",
          postulatedAt: null,
          hasVoted: false,
        },
      ],
      prompts: [
        { id: "p2", promptNumber: 2, title: "Cartas" },
        { id: "p1", promptNumber: 1, title: "Reloj" },
      ],
      stories: [
        {
          id: "s1",
          enrollmentId: "e1",
          promptId: "p1",
          authorId: "u1",
          originalTitle: "Reloj uno",
          editedTitle: "Reloj final",
          isPostulated: true,
          participantPoints: 12,
          juryPoints: 15,
          totalPoints: 27,
          passedToJury: true,
          tieBreakerRank: null,
          podiumPlace: 1,
        },
        {
          id: "s2",
          enrollmentId: "e2",
          promptId: "p2",
          authorId: "u2",
          originalTitle: "Sobre amarillo",
          editedTitle: null,
          isPostulated: true,
          participantPoints: 10,
          juryPoints: 10,
          totalPoints: 20,
          passedToJury: true,
          tieBreakerRank: null,
          podiumPlace: 2,
        },
        {
          id: "s3",
          enrollmentId: "e1",
          promptId: "p2",
          authorId: "u1",
          originalTitle: "Borrador no postulado",
          editedTitle: null,
          isPostulated: false,
          participantPoints: 0,
          juryPoints: 0,
          totalPoints: 0,
          passedToJury: false,
          tieBreakerRank: null,
          podiumPlace: null,
        },
      ],
      juryVotesCount: 2,
      totalJurorsCount: 3,
      usersById,
    });

    expect(stats.totalEnrolled).toBe(3);
    expect(stats.activeCount).toBe(2);
    expect(stats.disqualifiedCount).toBe(1);
    expect(stats.postulatedCount).toBe(2);
    expect(stats.participantsVotedCount).toBe(1);
    expect(stats.participantsPendingVoteCount).toBe(1);
    expect(stats.disqualificationBreakdown.MAX_MISSES).toBe(1);
    expect(stats.storiesPerPrompt.map((p) => [p.promptNumber, p.storiesCount])).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect(stats.juryProgress).toEqual({
      votedCount: 2,
      totalJurorsCount: 3,
      pendingCount: 1,
    });
    expect(stats.scoreTable.length).toBe(2);
    expect(stats.scoreTable[0].storyId).toBe("s1");
    expect(stats.scoreTable[0].totalPoints).toBe(27);
    expect(stats.scoreTable[0].authorName).toBe("Ana Silva");
  });
});
