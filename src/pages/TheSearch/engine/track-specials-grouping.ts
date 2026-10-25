import type { Contestant } from '../types/contestant';
import type { TrackSpecialElection, TrackSpecialTrack } from '../types/track-specials-episode';
import { battleRelationship } from './battle-scoring';
import type { RandomSource } from './random';

export const trackSkill = (track: TrackSpecialTrack) =>
  (({ VOCAL: 'vocals', RAP: 'rap', DANCE: 'dance' }) as const)[track];
export const trackSpecialty = (track: TrackSpecialTrack) =>
  (({ VOCAL: 'vocalColor', RAP: 'rapStyle', DANCE: 'danceStyle' }) as const)[track];

export function trackGroupSizes(count: number): number[] {
  if (!Number.isInteger(count) || count < 0 || count > 16)
    throw new Error('Track grouping requires zero through sixteen performers.');
  if (count <= 4) return count ? [count] : [];
  if (count === 5) return [3, 2];
  const groups = Math.ceil(count / 4);
  const fours = count - 3 * groups;
  return [...Array(fours).fill(4), ...Array(groups - fours).fill(3)];
}

const groupKey = (ids: string[]) => [...ids].sort().join('|');
export function trackAffinity(
  ids: readonly string[],
  relationships: Record<string, Record<string, number>>,
): number {
  let total = 0;
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++)
      total += (relationships[ids[i]][ids[j]] + relationships[ids[j]][ids[i]]) / 2;
  return total;
}

/** Exact subset dynamic programming; anchoring the first remaining ID removes permutations. */
export function optimalTrackGroups(
  rawIds: readonly string[],
  relationships: Record<string, Record<string, number>>,
  tieKeys: Record<string, number>,
): { groups: string[][]; affinity: number } {
  const ids = [...rawIds].sort();
  if (new Set(ids).size !== ids.length) throw new Error('Repeated track grouping participant.');
  const sizes = trackGroupSizes(ids.length);
  const counts = [1, 2, 3, 4].map((size) => sizes.filter((value) => value === size).length);
  const memo = new Map<string, { groups: string[][]; affinity: number; tie: number; key: string }>();
  function solve(
    mask: number,
    left: number[],
  ): { groups: string[][]; affinity: number; tie: number; key: string } {
    if (!mask) return { groups: [], affinity: 0, tie: 0, key: '' };
    const cache = `${mask}:${left.join(',')}`;
    const cached = memo.get(cache);
    if (cached) return cached;
    const first = ids.findIndex((_, index) => (mask & (1 << index)) !== 0);
    const others = ids.map((_, index) => index).filter((index) => index > first && mask & (1 << index));
    let best: ReturnType<typeof solve> | undefined;
    for (let size = 1; size <= 4; size++) {
      if (!left[size - 1]) continue;
      function choose(start: number, chosen: number[]) {
        if (chosen.length === size - 1) {
          const indices = [first, ...chosen];
          const members = indices.map((index) => ids[index]);
          const key = groupKey(members);
          if (!Number.isFinite(tieKeys[key])) throw new Error('Missing saved grouping tie key.');
          const next = [...left];
          next[size - 1]--;
          const remainder = solve(
            indices.reduce((value, index) => value & ~(1 << index), mask),
            next,
          );
          const candidate = {
            groups: [members, ...remainder.groups],
            affinity: trackAffinity(members, relationships) + remainder.affinity,
            tie: tieKeys[key] + remainder.tie,
            key: `${key};${remainder.key}`,
          };
          if (
            !best ||
            candidate.affinity > best.affinity ||
            (candidate.affinity === best.affinity &&
              (candidate.tie < best.tie || (candidate.tie === best.tie && candidate.key < best.key)))
          )
            best = candidate;
          return;
        }
        for (let index = start; index < others.length; index++) choose(index + 1, [...chosen, others[index]]);
      }
      choose(0, []);
    }
    if (!best) throw new Error('Impossible track partition.');
    memo.set(cache, best);
    return best;
  }
  const result = solve((1 << ids.length) - 1, counts);
  return { groups: result.groups, affinity: result.affinity };
}

export function trackGroupingTieKeys(ids: readonly string[], random: RandomSource): Record<string, number> {
  const sorted = [...ids].sort();
  const sizes = new Set(trackGroupSizes(ids.length));
  const result: Record<string, number> = {};
  function choose(start: number, chosen: string[]) {
    if (sizes.has(chosen.length)) result[groupKey(chosen)] = random();
    if (chosen.length === 4) return;
    for (let index = start; index < sorted.length; index++) choose(index + 1, [...chosen, sorted[index]]);
  }
  choose(0, []);
  return result;
}

export function electTrackRole(
  members: readonly Contestant[],
  role: 'leader' | 'center',
  tieKeys: Record<string, number>,
): TrackSpecialElection {
  const ids = members.map(({ id }) => id);
  if (!ids.length) throw new Error('A role election requires members.');
  const ability = (candidate: Contestant) =>
    role === 'leader'
      ? candidate.coreSkills.leadership
      : (candidate.coreSkills[trackSkill(candidate.track)] + candidate.coreSkills.stagePresence) / 2;
  const tie = (a: string, b: string) =>
    ability(members.find((person) => person.id === b)!) -
      ability(members.find((person) => person.id === a)!) ||
    tieKeys[a] - tieKeys[b] ||
    a.localeCompare(b);
  const preferences: Record<string, Record<string, number>> = {};
  const ballots: Record<string, string> = {};
  const totals = Object.fromEntries(ids.map((id) => [id, 0]));
  if (ids.length > 1) {
    for (const voter of members) {
      preferences[voter.id] = Object.fromEntries(
        members.map((candidate) => [
          candidate.id,
          role === 'center'
            ? 0.7 * battleRelationship(voter, candidate.id) + 0.3 * ((ability(candidate) - 1) * 25)
            : candidate.coreSkills.leadership * 1000 +
              Number(voter.specialties.leadershipStyle === candidate.specialties.leadershipStyle) * 100 +
              battleRelationship(voter, candidate.id),
        ]),
      );
      const winner = [...ids].sort(
        (a, b) => preferences[voter.id][b] - preferences[voter.id][a] || tie(a, b),
      )[0];
      ballots[voter.id] = winner;
      totals[winner]++;
    }
  }
  return {
    ballots,
    preferences,
    totals,
    tieKeys,
    winnerId: [...ids].sort((a, b) => totals[b] - totals[a] || tie(a, b))[0],
    appointed: ids.length === 1,
  };
}
