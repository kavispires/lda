import type { Contestant } from '../types/contestant';
import type {
  VersatilityDraftPick,
  VersatilitySlot,
  VersatilitySong,
  VersatilityTrack,
} from '../types/versatility-episode';
import { battleRelationship } from './battle-scoring';

export const versatilityTracks = ['VOCAL', 'RAP', 'DANCE'] as const;
export const versatilitySkill = (track: VersatilityTrack) =>
  (({ VOCAL: 'vocals', RAP: 'rap', DANCE: 'dance' }) as const)[track];
export const versatilityPriority = (person: Contestant) =>
  ((person.personality.extroversion + 10) * 5 + (person.coreSkills.leadership - 1) * 25) / 2;

export function canCompleteVersatility(
  people: readonly Pick<Contestant, 'id' | 'track'>[],
  slots: readonly VersatilitySlot[],
): boolean {
  if (people.length !== slots.length) return false;
  const assigned = new Map<string, number>();
  function match(index: number, visited: Set<string>): boolean {
    for (const slot of slots) {
      if (slot.track === people[index].track || visited.has(slot.id)) continue;
      visited.add(slot.id);
      const previous = assigned.get(slot.id);
      if (previous === undefined || match(previous, visited)) {
        assigned.set(slot.id, index);
        return true;
      }
    }
    return false;
  }
  return people.every((_, index) => match(index, new Set()));
}

/** Minimize global role imbalance, then within each five-person arrangement. */
export function createVersatilitySlots(
  people: readonly Pick<Contestant, 'id' | 'track'>[],
  songs: readonly VersatilitySong[],
): VersatilitySlot[] {
  if (people.length !== 15 || songs.length !== 3 || new Set(songs.map((song) => song.id)).size !== 3)
    throw new Error('Versatility needs fifteen people and three distinct songs.');
  const primary = versatilityTracks.map((track) => people.filter((person) => person.track === track).length);
  const totals: number[][] = [];
  for (let vocal = 0; vocal <= 15; vocal++)
    for (let rap = 0; rap <= 15 - vocal; rap++) {
      const counts = [vocal, rap, 15 - vocal - rap];
      if (counts.every((count, index) => count <= 15 - primary[index])) totals.push(counts);
    }
  const imbalance = (counts: number[]) => counts.reduce((sum, count) => sum + (count - 5) ** 2, 0);
  totals.sort((a, b) => imbalance(a) - imbalance(b) || a[0] - b[0] || a[1] - b[1]);
  const counts = totals[0];
  const triples: number[][] = [];
  for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5 - a; b++) triples.push([a, b, 5 - a - b]);
  let groups: number[][] | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (const a of triples)
    for (const b of triples) {
      const c = counts.map((count, index) => count - a[index] - b[index]);
      if (c.some((value) => value < 0 || value > 5) || c.reduce((sum, value) => sum + value, 0) !== 5)
        continue;
      const cost = [...a, ...b, ...c].reduce((sum, value) => sum + (value - 5 / 3) ** 2, 0);
      if (cost < best) {
        best = cost;
        groups = [a, b, c];
      }
    }
  if (!groups) throw new Error('No feasible role inventory.');
  const slots = groups.flatMap((group, index) => {
    const tracks = versatilityTracks.flatMap((track, role) =>
      Array.from({ length: group[role] }, () => track),
    );
    return songs[index].parts.map((part, partIndex) => ({
      id: `versatility-${index + 1}:${part.id}`,
      teamId: `versatility-${index + 1}`,
      partId: part.id,
      track: tracks[partIndex],
    }));
  });
  if (!canCompleteVersatility(people, slots)) throw new Error('Role inventory cannot be completed.');
  return slots;
}

export function chooseVersatilityPick(
  contestant: Contestant,
  remaining: readonly Contestant[],
  freeSlots: readonly VersatilitySlot[],
  members: Record<string, string[]>,
  people: readonly Contestant[],
  gamble: number,
  tieKeys: Record<string, number>,
): VersatilityDraftPick {
  const legal = freeSlots.filter(
    (slot) =>
      slot.track !== contestant.track &&
      canCompleteVersatility(
        remaining.filter((person) => person.id !== contestant.id),
        freeSlots.filter((other) => other.id !== slot.id),
      ),
  );
  if (!legal.length) throw new Error('Off-track draft reached an impossible pick.');
  const professional = contestant.personality.discipline >= 5 || contestant.personality.maturity >= 5;
  const hero =
    (contestant.personality.ambition >= 5 || contestant.personality.resilience >= 5) &&
    contestant.utilitySkills.potential >= 4;
  const tactic = professional ? 'professional' : hero && gamble < 0.5 ? 'gamble' : 'stronger';
  const tracks = versatilityTracks.filter((track) => legal.some((slot) => slot.track === track));
  const levels = tracks.map((track) => contestant.coreSkills[versatilitySkill(track)]);
  const target = tactic === 'gamble' ? Math.min(...levels) : Math.max(...levels);
  const preferredTracks = tracks.filter((track) => contestant.coreSkills[versatilitySkill(track)] === target);
  const affection = Object.fromEntries(
    Object.entries(members).map(([teamId, ids]) => [
      teamId,
      ids.length
        ? ids.reduce(
            (sum, id) => sum + battleRelationship(people.find((person) => person.id === contestant.id)!, id),
            0,
          ) / ids.length
        : 50,
    ]),
  );
  const chosen = legal
    .filter((slot) => preferredTracks.includes(slot.track))
    .sort(
      (a, b) =>
        affection[b.teamId] - affection[a.teamId] ||
        tieKeys[a.id] - tieKeys[b.id] ||
        a.id.localeCompare(b.id),
    )[0];
  return {
    contestantId: contestant.id,
    availableSlotIds: legal.map((slot) => slot.id),
    slotId: chosen.id,
    tactic,
    gamble,
    preferredTracks,
    affection,
  };
}
