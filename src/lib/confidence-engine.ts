/**
 * Confidence engine for automated financial interpretations.
 * HIGH may auto-process; MEDIUM lightweight confirm; LOW ask before mutation.
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type ConfidenceRecord = {
  level: ConfidenceLevel;
  score: number; // 0–100
  reasons: string[];
  field?: string;
};

export function levelFromScore(score: number): ConfidenceLevel {
  if (score >= 78) return 'high';
  if (score >= 48) return 'medium';
  return 'low';
}

export function buildConfidence(reasons: string[], boosts: number[] = []): ConfidenceRecord {
  let score = Math.min(40, reasons.length * 18);
  for (const b of boosts) score += b;
  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    level: levelFromScore(score),
    score,
    reasons: reasons.filter(Boolean).slice(0, 8),
  };
}

export function mayAutoProcess(c: ConfidenceRecord): boolean {
  return c.level === 'high' && c.score >= 78;
}

export function needsConfirmation(c: ConfidenceRecord): boolean {
  return c.level !== 'high';
}

export function explainConfidence(c: ConfidenceRecord): string {
  if (!c.reasons.length) return 'Limited evidence for this interpretation.';
  return c.reasons.join(' · ');
}
