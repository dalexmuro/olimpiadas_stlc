/**
 * Text Similarity & Myers Diff Engine (Stage 3 & Stage 4 Anti-Replacement Engine)
 * Step 4.1: Normalizes texts, computes character-level Myers Diff similarity %, and word-level visual diff segments
 */

import { diffChars, diffWordsWithSpace } from "diff";

export type DiffSegmentKind = "unchanged" | "added" | "removed";

export interface DiffSegment {
  kind: DiffSegmentKind;
  value: string;
}

export interface SimilarityAnalysis {
  similarityPct: number;
  isExactOriginal: boolean;
  meetsThreshold: boolean;
  minSimilarityPct: number;
  unchangedChars: number;
  originalLength: number;
  editedLength: number;
}

/**
 * Normalizes story text by trimming outer whitespace and collapsing repeated
 * spaces/newlines into a single space, per Technical Specification §4.1.
 */
export function normalizeTextForSimilarity(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/**
 * Computes word-level Myers Diff segments preserving whitespace for the
 * Stage 4 Admin visual diff viewer (green additions, red deletions).
 */
export function computeWordDiffSegments(
  originalText: string,
  editedText: string
): DiffSegment[] {
  const parts = diffWordsWithSpace(originalText, editedText);
  return parts.map((part) => ({
    kind: part.added ? "added" : part.removed ? "removed" : "unchanged",
    value: part.value,
  }));
}

/**
 * Calculates the Sørensen-Dice / Myers Diff character similarity percentage:
 *   Similarity % = ((2 * C_unchanged) / (L_original + L_edited)) * 100
 */
export function calculateStorySimilarity(
  originalBody: string,
  editedBody: string,
  minSimilarityPct = 70
): SimilarityAnalysis {
  const normOriginal = normalizeTextForSimilarity(originalBody);
  const normEdited = normalizeTextForSimilarity(editedBody);

  const originalLength = normOriginal.length;
  const editedLength = normEdited.length;

  if (originalLength === 0 && editedLength === 0) {
    return {
      similarityPct: 100,
      isExactOriginal: true,
      meetsThreshold: 100 >= minSimilarityPct,
      minSimilarityPct,
      unchangedChars: 0,
      originalLength: 0,
      editedLength: 0,
    };
  }

  if (originalLength === 0 || editedLength === 0) {
    return {
      similarityPct: 0,
      isExactOriginal: false,
      meetsThreshold: 0 >= minSimilarityPct,
      minSimilarityPct,
      unchangedChars: 0,
      originalLength,
      editedLength,
    };
  }

  if (normOriginal === normEdited) {
    return {
      similarityPct: 100,
      isExactOriginal: true,
      meetsThreshold: 100 >= minSimilarityPct,
      minSimilarityPct,
      unchangedChars: originalLength,
      originalLength,
      editedLength,
    };
  }

  const charParts = diffChars(normOriginal, normEdited);
  let unchangedChars = 0;
  for (const part of charParts) {
    if (!part.added && !part.removed) {
      unchangedChars += part.value.length;
    }
  }

  const rawPct = ((2 * unchangedChars) / (originalLength + editedLength)) * 100;
  const similarityPct = Math.min(100, Math.max(0, Number(rawPct.toFixed(2))));

  return {
    similarityPct,
    isExactOriginal: false,
    meetsThreshold: similarityPct >= minSimilarityPct,
    minSimilarityPct,
    unchangedChars,
    originalLength,
    editedLength,
  };
}

/**
 * Formats the Stage 4 Admin story status badge.
 */
export function formatSimilarityBadgeLabel(
  similarityPct: number,
  isExactOriginal: boolean
): string {
  if (isExactOriginal) {
    return "100% original";
  }
  return `Editado (${Math.round(similarityPct)}% similitud)`;
}
