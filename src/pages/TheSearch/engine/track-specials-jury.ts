import type { Contestant, PersonalityTraits } from '../types/contestant';
import type {
  TrackSpecialAward,
  TrackSpecialCategory,
  TrackSpecialJuror,
  TrackSpecialsEpisode,
} from '../types/track-specials-episode';
import { clampBattle } from './battle-scoring';
import type { RandomSource } from './random';

export const TRACK_SPECIAL_CATEGORIES: TrackSpecialCategory[] = [
  'group',
  'overall',
  'vocalist',
  'rapper',
  'dancer',
  'visual',
  'uniqueness',
];
export function trackJurorProfile(traits: PersonalityTraits): TrackSpecialJuror['profile'] {
  if (traits.sincerity >= 5 || traits.maturity >= 5) return 'objective';
  if (traits.sincerity <= -5 || traits.ambition >= 5 || traits.sensitivity >= 5) return 'biased';
  return 'blended';
}
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
export function trackCategoryEvidence(ep: TrackSpecialsEpisode, category: TrackSpecialCategory) {
  const evaluations = ep.performances.flatMap((performance) => performance.evaluations);
  if (category === 'group')
    return Object.fromEntries(
      ep.teams.map((team) => [
        team.id,
        ep.performances.find((performance) => performance.teamId === team.id)!.meanScore,
      ]),
    );
  const track = ({ vocalist: 'VOCAL', rapper: 'RAP', dancer: 'DANCE' } as const)[category as 'vocalist'];
  return Object.fromEntries(
    evaluations
      .filter(
        (entry) =>
          !track ||
          ep.startingContestants.find((person) => person.id === entry.contestantId)!.track === track,
      )
      .map((entry) => [
        entry.contestantId,
        category === 'visual'
          ? entry.visualCheck.score
          : category === 'uniqueness'
            ? entry.uniquenessCheck.score
            : track
              ? entry.trackCheck.score
              : entry.rawScore,
      ]),
  );
}
export function trackJuryPreference(juror: TrackSpecialJuror, objective: number, affection: number) {
  return juror.profile === 'objective'
    ? objective
    : juror.profile === 'biased'
      ? affection
      : (objective + affection) / 2;
}
export function castTrackAwards(ep: TrackSpecialsEpisode, random: RandomSource): TrackSpecialAward[] {
  if (ep.performances.length !== ep.teams.length || !ep.juryRevealed || ep.awards.length)
    throw new Error('Jury ballots require every performance, exactly once.');
  return TRACK_SPECIAL_CATEGORIES.map((category) => {
    const objectiveEvidence = trackCategoryEvidence(ep, category);
    const eligibleIds = Object.keys(objectiveEvidence);
    const award: TrackSpecialAward = {
      category,
      status:
        eligibleIds.length === 0 ? 'not-contested' : eligibleIds.length === 1 ? 'uncontested' : 'contested',
      eligibleIds,
      objectiveEvidence,
      preferences: {},
      tieKeys: {},
      tallyTieKeys: {},
      ballots: {},
      bestTotals: Object.fromEntries(eligibleIds.map((id) => [id, 0])),
      worstTotals: Object.fromEntries(eligibleIds.map((id) => [id, 0])),
      bestId: eligibleIds.length === 1 ? eligibleIds[0] : null,
      worstId: null,
    };
    if (eligibleIds.length < 2) return award;
    award.tallyTieKeys = Object.fromEntries(eligibleIds.map((id) => [id, random()]));
    for (const juror of ep.juryProfiles) {
      const preferences = Object.fromEntries(
        eligibleIds.map((id) => {
          const affection =
            category === 'group'
              ? mean(
                  ep.teams
                    .find((team) => team.id === id)!
                    .memberIds.map((member) => juror.relationships[member]),
                )
              : juror.relationships[id];
          return [id, trackJuryPreference(juror, objectiveEvidence[id], affection)];
        }),
      );
      const keys = Object.fromEntries(eligibleIds.map((id) => [id, random()]));
      award.preferences[juror.contestantId] = preferences;
      award.tieKeys[juror.contestantId] = keys;
      const tie = (a: string, b: string) => keys[a] - keys[b] || a.localeCompare(b);
      const bestId = [...eligibleIds].sort((a, b) => preferences[b] - preferences[a] || tie(a, b))[0];
      const worstId = eligibleIds
        .filter((id) => id !== bestId)
        .sort((a, b) => preferences[a] - preferences[b] || tie(a, b))[0];
      award.ballots[juror.contestantId] = { bestId, worstId };
      award.bestTotals[bestId]++;
      award.worstTotals[worstId]++;
    }
    const tallyTie = (a: string, b: string) =>
      award.tallyTieKeys[a] - award.tallyTieKeys[b] || a.localeCompare(b);
    award.bestId = [...eligibleIds].sort(
      (a, b) =>
        award.bestTotals[b] - award.bestTotals[a] ||
        objectiveEvidence[b] - objectiveEvidence[a] ||
        tallyTie(a, b),
    )[0];
    award.worstId = [...eligibleIds].sort(
      (a, b) =>
        award.worstTotals[b] - award.worstTotals[a] ||
        objectiveEvidence[a] - objectiveEvidence[b] ||
        tallyTie(a, b),
    )[0];
    return award;
  });
}

export function trackAwardEffects(ep: TrackSpecialsEpisode, includeBest = true, includeWorst = true) {
  return Object.fromEntries(
    ep.participantIds.map((id) => {
      const factors: number[] = [];
      let happiness = 0;
      for (const award of ep.awards) {
        const recipients = (recipient: string | null) =>
          recipient !== null &&
          (award.category === 'group'
            ? ep.teams.find((team) => team.id === recipient)!.memberIds.includes(id)
            : recipient === id);
        if (includeBest && recipients(award.bestId)) {
          factors.push(award.category === 'overall' ? 1.35 : 1.2);
          happiness += 6;
        }
        if (includeWorst && recipients(award.worstId)) {
          factors.push(award.category === 'overall' ? 0.65 : 0.8);
          happiness -= 8;
        }
      }
      return [
        id,
        {
          factors,
          multiplier: clampBattle(
            factors.reduce((product, factor) => product * factor, 1),
            0.4,
            2,
          ),
          happiness: clampBattle(happiness, -16, 12),
        },
      ];
    }),
  );
}

export function frozenTrackJurors(
  cast: readonly Contestant[],
  participantIds: readonly string[],
): TrackSpecialJuror[] {
  const departed = cast.filter((person) => !participantIds.includes(person.id));
  if (departed.length !== 34 || departed.some((person) => person.status === 'ACTIVE' || person.rank < 17))
    throw new Error('Track Specials requires all 34 recorded departures, including the withdrawal.');
  return departed.map((person) => ({
    contestantId: person.id,
    profile: trackJurorProfile(person.personality),
    traits: structuredClone(person.personality),
    relationships: Object.fromEntries(
      participantIds.map((id) => [id, person.relationships[id]?.at(-1) ?? 50]),
    ),
    departure: {
      rank: person.rank,
      status: person.status,
      events: person.events.filter(
        (event) => /ELIMINAT|WITHDRAW|DEFEAT|DEPART/.test(event) && !event.startsWith('SECRET_'),
      ),
    },
  }));
}
