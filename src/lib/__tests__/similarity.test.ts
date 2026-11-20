import { describe, expect, it } from "vitest";
import {
  calculateStorySimilarity,
  computeWordDiffSegments,
  formatSimilarityBadgeLabel,
  normalizeTextForSimilarity,
} from "../similarity";

describe("Text Similarity & Myers Diff Engine (Step 4.1)", () => {
  it("normalizes leading/trailing whitespace and collapses repeated spaces and newlines", () => {
    expect(
      normalizeTextForSimilarity("  Había   una\n\nvez   un reloj.  ")
    ).toBe("Había una vez un reloj.");
  });

  it("returns 100% original when texts match after whitespace normalization", () => {
    const result = calculateStorySimilarity(
      "El mar estaba calmo.\n\nNadie hablaba.",
      "  El mar estaba calmo.   Nadie hablaba.  ",
      70
    );
    expect(result.similarityPct).toBe(100);
    expect(result.isExactOriginal).toBe(true);
    expect(result.meetsThreshold).toBe(true);
    expect(formatSimilarityBadgeLabel(result.similarityPct, result.isExactOriginal)).toBe(
      "100% original"
    );
  });

  it("allows minor stylistic edits above the threshold and rejects complete story replacements", () => {
    const original =
      "Aquella tarde de octubre la estación de trenes olía a lluvia recién caída y a café tostado. Elena revisó su reloj por tercera vez antes de cruzar el andén.";
    const minorEdit =
      "Aquella tarde de octubre la vieja estación de trenes olía a lluvia recién caída y a café amargo. Elena revisó su reloj por tercera vez antes de cruzar el andén.";
    const fullReplacement =
      "Los astronautas descendieron sobre el cráter helado mientras la nave principal orbitaba en silencio absoluto sobre la luna oscura de Júpiter.";

    const minorAnalysis = calculateStorySimilarity(original, minorEdit, 70);
    expect(minorAnalysis.isExactOriginal).toBe(false);
    expect(minorAnalysis.similarityPct).toBeGreaterThan(85);
    expect(minorAnalysis.meetsThreshold).toBe(true);
    expect(
      formatSimilarityBadgeLabel(
        minorAnalysis.similarityPct,
        minorAnalysis.isExactOriginal
      )
    ).toContain("Editado (");

    const replacementAnalysis = calculateStorySimilarity(
      original,
      fullReplacement,
      70
    );
    expect(replacementAnalysis.similarityPct).toBeLessThan(50);
    expect(replacementAnalysis.meetsThreshold).toBe(false);
  });

  it("computes word-level visual diff segments marking additions and removals", () => {
    const segments = computeWordDiffSegments(
      "El gato negro saltó el muro.",
      "El gato blanco saltó el muro alto."
    );

    expect(segments.some((s) => s.kind === "removed" && s.value.includes("negro"))).toBe(
      true
    );
    expect(segments.some((s) => s.kind === "added" && s.value.includes("blanco"))).toBe(
      true
    );
    expect(segments.some((s) => s.kind === "added" && s.value.includes("alto"))).toBe(
      true
    );
    expect(segments.some((s) => s.kind === "unchanged")).toBe(true);
  });

  it("handles empty edge cases gracefully", () => {
    const bothEmpty = calculateStorySimilarity("   ", "", 70);
    expect(bothEmpty.similarityPct).toBe(100);

    const oneEmpty = calculateStorySimilarity("Texto original", "   ", 70);
    expect(oneEmpty.similarityPct).toBe(0);
    expect(oneEmpty.meetsThreshold).toBe(false);
  });
});
