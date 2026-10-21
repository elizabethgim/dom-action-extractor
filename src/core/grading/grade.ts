// Lightweight heuristic grader for free-text model answers against a
// reference answer. Not authoritative — just a quick signal for manual
// testing, since exact-string grading is useless for natural-language answers
// (e.g. "South Sudan, 5.862%" vs "South Sudan had the highest rate at 5.86%").

export type GradeResult = "correct" | "incorrect" | "partial" | "unknown";

function normalize(s: string) {
  return s.toLowerCase().replace(/[,%]/g, " ").replace(/\s+/g, " ").trim();
}

// Words longer than 2 chars, excluding pure numbers (numbers are checked separately).
function nameTokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length > 2 && !/^-?\d+(\.\d+)?$/.test(t));
}

function numberTokens(s: string): number[] {
  const matches = s.match(/-?\d+(\.\d+)?/g) ?? [];
  return matches.map(Number);
}

function numbersClose(a: number, b: number) {
  const tolerance = Math.max(0.05, Math.abs(b) * 0.02); // 2% relative or 0.05 absolute
  return Math.abs(a - b) <= tolerance;
}

export function gradeAnswer(modelAnswer: string | null, expectedAnswer: string | null): GradeResult {
  if (!expectedAnswer) return "unknown";
  if (!modelAnswer || !modelAnswer.trim()) return "incorrect";

  const modelNorm = normalize(modelAnswer);
  const expectedNames = nameTokens(expectedAnswer);
  const expectedNumbers = numberTokens(expectedAnswer);
  const modelNumbers = numberTokens(modelAnswer);

  const nameMatch = expectedNames.length === 0 || expectedNames.some((n) => modelNorm.includes(n));
  const numberMatch =
    expectedNumbers.length === 0 || expectedNumbers.some((en) => modelNumbers.some((mn) => numbersClose(en, mn)));

  if (nameMatch && numberMatch) return "correct";
  if (nameMatch || numberMatch) return "partial";
  return "incorrect";
}

export const GRADE_LABEL: Record<GradeResult, string> = {
  correct: "✅ Likely correct",
  partial: "⚠️ Partial match",
  incorrect: "❌ Likely incorrect",
  unknown: "❓ No reference answer",
};

export const GRADE_COLOR: Record<GradeResult, string> = {
  correct: "#16a34a",
  partial: "#d97706",
  incorrect: "#dc2626",
  unknown: "#6b7280",
};
