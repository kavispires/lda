import type { Contestant } from '../types/contestant';
import type {
  SpecialtiesFriendship,
  SpecialtiesPeer,
  SpecialtiesPerformance,
} from '../types/specialties-episode';
import { battleRelationship } from './battle-scoring';
import type { RandomSource } from './random';
import { specialtiesMean } from './specialties-scoring';

function requireNine(people: readonly Contestant[]) {
  if (people.length !== 9 || new Set(people.map((entry) => entry.id)).size !== 9)
    throw new Error('Specialties needs nine unique voters.');
}
export function lockSpecialtiesFriendship(
  people: readonly Contestant[],
  random: RandomSource,
): SpecialtiesFriendship {
  requireNine(people);
  const snapshot = structuredClone([...people]);
  const choices = snapshot.map((voter) => {
    const others = snapshot.filter((entry) => entry.id !== voter.id);
    const tieKeys = Object.fromEntries(others.map((entry) => [entry.id, random()]));
    others.sort(
      (a, b) =>
        battleRelationship(voter, b.id) - battleRelationship(voter, a.id) ||
        tieKeys[a.id] - tieKeys[b.id] ||
        a.id.localeCompare(b.id),
    );
    return {
      contestantId: voter.id,
      targetId: others[0].id,
      affection: battleRelationship(voter, others[0].id),
      tieKeys,
    };
  });
  return {
    snapshot,
    choices,
    revealedIds: [],
    pairs: [],
    rewards: [],
    reactions: [],
    reactionsComplete: false,
  };
}
export function castSpecialtiesBallots(
  people: readonly Contestant[],
  performances: readonly SpecialtiesPerformance[],
  random: RandomSource,
): SpecialtiesPeer {
  requireNine(people);
  const snapshot = structuredClone([...people]);
  if (performances.length !== 9 || new Set(performances.map((entry) => entry.contestantId)).size !== 9)
    throw new Error('Complete all nine solos before peer ballots.');
  const scores = Object.fromEntries(performances.map((entry) => [entry.contestantId, entry.observedScore]));
  if (snapshot.some((entry) => !Number.isFinite(scores[entry.id])))
    throw new Error('Missing observed solo evidence.');
  const ballots: SpecialtiesPeer['ballots'] = snapshot.map((voter) => {
    const ids = snapshot.filter((entry) => entry.id !== voter.id).map((entry) => entry.id);
    const tieKeys = Object.fromEntries(ids.map((id) => [id, random()]));
    const compare = (a: string, b: string) =>
      scores[b] - scores[a] || tieKeys[a] - tieKeys[b] || a.localeCompare(b);
    const baselineIds = [...ids].sort(compare);
    const profile =
      voter.personality.sincerity >= 5 || voter.personality.maturity >= 5
        ? 'objective'
        : voter.personality.ambition >= 5 && voter.personality.sincerity <= -5
          ? 'strategic'
          : 'blended';
    const threatIds = profile === 'strategic' ? baselineIds.slice(0, 2) : [];
    const rankedIds =
      profile === 'strategic'
        ? [...baselineIds.slice(2), threatIds[1], threatIds[0]]
        : profile === 'objective'
          ? [...baselineIds]
          : [...ids].sort(
              (a, b) =>
                0.5 * scores[b] +
                  0.5 * battleRelationship(voter, b) -
                  (0.5 * scores[a] + 0.5 * battleRelationship(voter, a)) ||
                tieKeys[a] - tieKeys[b] ||
                a.localeCompare(b),
            );
    return {
      voterId: voter.id,
      profile,
      baselineIds,
      threatIds,
      rankedIds,
      tieKeys,
      reasons: rankedIds.map((id, index) => {
        const observed = scores[id];
        if (profile === 'strategic' && threatIds.includes(id))
          return `Observed solo evidence ${observed.toFixed(2)} identifies the ${id === threatIds[0] ? 'strongest' : 'second strongest'} eligible threat; privately assigns place ${index + 1} below the other six.`;
        if (profile === 'blended') {
          const affection = battleRelationship(voter, id);
          return `Observed solo evidence ${observed.toFixed(2)} and outgoing affection ${affection.toFixed(2)} have equal weight: preference ${((observed + affection) / 2).toFixed(2)}, place ${index + 1}. Equal preferences use the locked tie order.`;
        }
        return `Observed solo evidence ${observed.toFixed(2)} determines place ${index + 1}${profile === 'strategic' ? ' among the six non-threat peers' : ''}. Equal evidence uses the locked tie order, not affection.`;
      }),
    };
  });
  const received = Object.fromEntries(
    snapshot.map((entry) => [
      entry.id,
      ballots
        .filter((ballot) => ballot.voterId !== entry.id)
        .map((ballot) => {
          const place = ballot.rankedIds.indexOf(entry.id) + 1;
          return { voterId: ballot.voterId, place, score: (100 * (8 - place)) / 7 };
        }),
    ]),
  );
  const averages = Object.fromEntries(
    snapshot.map((entry) => [entry.id, specialtiesMean(received[entry.id].map((vote) => vote.score))]),
  );
  return { snapshot, ballots, received, averages };
}
