// The "at which point does a rating count" logic — kept in ONE place so the
// rule is explicit and auditable.
//
// Phase 1: ratings are DISPLAYED but never affect the official MPII score.
// The average is only shown to the public once it clears a quorum, and even
// then it is presented as a separate "community score", not mixed into MPII.

export const QUORUM = 30; // minimum verified ratings before an average is shown
export const PRIOR_MEAN = 3.0; // neutral prior (out of 5) for Bayesian shrinkage
export const PRIOR_WEIGHT = 30; // C: how many "neutral votes" to assume

/** Has this MP cleared the quorum needed to display a community average? */
export function hasQuorum(n: number): boolean {
  return n >= QUORUM;
}

/**
 * Bayesian (shrinkage) average — the smooth "at which point" mechanism.
 * With few ratings it stays near the neutral prior; as verified ratings grow,
 * the real signal emerges. This is what Phase 2 will feed into the 10% voter
 * dimension. In Phase 1 it is for DISPLAY ONLY.
 */
export function bayesianAverage(n: number, avg: number): number {
  if (!n) return PRIOR_MEAN;
  return (PRIOR_WEIGHT * PRIOR_MEAN + n * avg) / (PRIOR_WEIGHT + n);
}
