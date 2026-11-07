import type { SongLine } from '@types';

export const isInlineEligible = (line: Pick<SongLine, 'adlib' | 'dismissible'>): boolean =>
  line.adlib === true && !line.dismissible;

export function applyLineFlagChanges(line: SongLine, changes: Partial<SongLine>): SongLine {
  const next = { ...line, ...changes };
  if (changes.harmonyOf) {
    next.dismissible = true;
    next.adlib = false;
  } else if (changes.adlib) {
    next.harmonyOf = undefined;
  }
  if (next.inline && !isInlineEligible(next)) {
    next.inline = false;
  }
  return next;
}
