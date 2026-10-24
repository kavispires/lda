import { AUDITION_CONFIG } from '../engine/audition-config';
import type { AuditionReaction } from '../types/audition-episode';

export function selectAuditionHighlights(reactions: readonly AuditionReaction[]): AuditionReaction[] {
  return [...reactions]
    .sort(
      (left, right) =>
        Math.abs(right.relationshipAfter - right.relationshipBefore) -
          Math.abs(left.relationshipAfter - left.relationshipBefore) ||
        Math.abs(right.composureAfter - right.composureBefore) -
          Math.abs(left.composureAfter - left.composureBefore) ||
        right.gap - left.gap,
    )
    .slice(0, AUDITION_CONFIG.highlightedReactions);
}
