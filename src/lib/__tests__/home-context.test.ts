import { describe, expect, it } from "vitest";
import type { EditionStageSnapshot } from "../contest-stage";
import { formatHomeStageStatus, resolveHomeClosingCta } from "../home-context";

const SAMPLE_EDITION: EditionStageSnapshot = {
  title: "Olimpíadas Literarias 2026",
  registrationStartAt: "2026-06-01T04:00:00.000Z",
  registrationEndAt: "2026-06-10T04:00:00.000Z",
  writingStartAt: "2026-06-10T04:00:00.000Z",
  writingEndAt: "2026-06-20T04:00:00.000Z",
  submissionStartAt: "2026-06-22T04:00:00.000Z",
  submissionEndAt: "2026-06-25T04:00:00.000Z",
  adminReviewStartAt: "2026-06-25T04:00:00.000Z",
  adminReviewEndAt: "2026-06-28T04:00:00.000Z",
  votingStartAt: "2026-06-30T04:00:00.000Z",
  votingEndAt: "2026-07-05T04:00:00.000Z",
  juryStartAt: "2026-07-05T04:00:00.000Z",
  juryEndAt: "2026-07-10T04:00:00.000Z",
};

describe("home-context helpers", () => {
  it("formats fallback status when no active edition exists", () => {
    const status = formatHomeStageStatus(null);
    expect(status.isActive).toBe(false);
    expect(status.stageLabel).toBe(
      "¡Prepárate! La próxima edición se anuncia muy pronto"
    );
    expect(status.timezoneHint).toContain("UTC-4");
  });

  it("formats active edition stage status accurately", () => {
    const regStatus = formatHomeStageStatus(
      SAMPLE_EDITION,
      "2026-06-05T12:00:00.000Z"
    );
    expect(regStatus.isActive).toBe(true);
    expect(regStatus.editionTitle).toBe("Olimpíadas Literarias 2026");
    expect(regStatus.stageLabel).toBe("Inscripciones abiertas");

    const writingStatus = formatHomeStageStatus(
      SAMPLE_EDITION,
      "2026-06-15T12:00:00.000Z"
    );
    expect(writingStatus.stageLabel).toBe("Primera Etapa: Escritura en curso");
  });

  it("resolves visitor closing CTA clarifying permanent account vs enrollment", () => {
    const cta = resolveHomeClosingCta(null);
    expect(cta.primaryLabel).toBe("Crear mi cuenta");
    expect(cta.primaryHref).toBe("/registro");
    expect(cta.secondaryHref).toBe("/bases-del-concurso");
    expect(cta.description).toContain("cuenta permanente");
  });

  it("resolves role-specific closing CTAs for authenticated users", () => {
    expect(resolveHomeClosingCta("PARTICIPANT").primaryHref).toBe("/concurso");
    expect(resolveHomeClosingCta("JURY").primaryHref).toBe("/jurado");
    expect(resolveHomeClosingCta("ADMIN").primaryHref).toBe("/admin");
    expect(resolveHomeClosingCta("SUPERADMIN").primaryHref).toBe("/admin");
  });
});
