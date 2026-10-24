import type { AuditionEvaluation, AuditionPreferences, AuditionSong, AuditionTrack } from '../types/audition';
import type { AuditionReaction, AuditionRelationshipPolicy } from '../types/audition-episode';
import type { Contestant } from '../types/contestant';
import { TRACKS } from '../utilities/constants';
import { AUDITION_CONFIG } from './audition-config';
import { drawAuditionTieBreakKey, rollAuditionDice, scoreAudition } from './audition-scoring';
import type { RandomSource } from './random';

/** Tunable defaults: alternate-track weight = primary capability ^ 1.
 * Reaction weights start at 1, adding 3 per positive normalized named trait.
 * Better: admiration/inspiration use gentleness+maturity, jealousy ambition,
 * intimidation ambition+sensitivity. Weaker: confidence ambition+maturity,
 * sympathy gentleness+sensitivity. No extra personality bonuses affect scoring.
 */
export const AUDITION_LIVE_DEFAULTS = {
  capabilityExponent: 1,
  reactionBaseWeight: 1,
  reactionTraitWeight: 3,
} as const;

const primarySkills = { VOCAL: 'vocals', RAP: 'rap', DANCE: 'dance' } as const;
const tracks = Object.values(TRACKS);
const expectedPreferences: AuditionPreferences = {
  visualOrUniqueness: 'visual',
  potentialOrCharisma: 'potential',
};

function unit(random: RandomSource): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error('Audition random draws must be finite numbers in [0, 1).');
  }
  return value;
}

function weightedChoice<T>(values: readonly T[], weight: (value: T) => number, random: RandomSource): T {
  if (values.length === 0) throw new Error('Audition selection requires nonempty options.');
  const weights = values.map(weight);
  if (weights.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error('Audition selection weights must be positive finite numbers.');
  }
  let remaining = unit(random) * weights.reduce((sum, value) => sum + value, 0);
  for (let index = 0; index < values.length; index++) {
    remaining -= weights[index];
    if (remaining < 0) return values[index];
  }
  return values[values.length - 1];
}

export function selectAuditionPool(catalog: readonly AuditionSong[], random: RandomSource): AuditionSong[] {
  const buckets = tracks.flatMap((track) => {
    const songs = catalog.filter((song) => song.track === track);
    return [
      {
        track,
        name: 'approachable',
        songs: songs.filter(
          (song) => song.part.testedSkills[0].requiredLevel <= AUDITION_CONFIG.approachableMax,
        ),
      },
      {
        track,
        name: 'intermediate',
        songs: songs.filter(
          (song) => song.part.testedSkills[0].requiredLevel === AUDITION_CONFIG.intermediateLevel,
        ),
      },
      {
        track,
        name: 'demanding',
        songs: songs.filter(
          (song) => song.part.testedSkills[0].requiredLevel >= AUDITION_CONFIG.demandingMin,
        ),
      },
    ];
  });
  for (const bucket of buckets) {
    if (bucket.songs.length === 0) {
      throw new Error(`Audition catalog is missing the ${bucket.track} ${bucket.name} bucket.`);
    }
  }
  return buckets.map(({ songs }) => songs[Math.floor(unit(random) * songs.length)]);
}

export function chooseAuditionSongs(
  contestants: readonly Contestant[],
  pool: readonly AuditionSong[],
  random: RandomSource,
): Record<string, string> {
  for (const track of tracks) {
    if (!pool.some((song) => song.track === track))
      throw new Error(`Audition pool is missing track ${track}.`);
  }
  const choices: Record<string, string> = {};
  for (const contestant of contestants) {
    if (Object.hasOwn(choices, contestant.id))
      throw new Error(`Duplicate audition contestant ID "${contestant.id}".`);
    const { investment, maturity, discipline, curiosity } = contestant.personality;
    const veto = investment >= 7 || maturity >= 7 || discipline >= 7;
    const chance =
      discipline <= -7 && curiosity >= 7 ? AUDITION_CONFIG.riskTakingChance : AUDITION_CONFIG.offTrackChance;
    let track: AuditionTrack = contestant.track;
    if (!veto && unit(random) < chance) {
      track = weightedChoice(
        tracks.filter((other) => other !== contestant.track),
        (other) => contestant.coreSkills[primarySkills[other]] ** AUDITION_LIVE_DEFAULTS.capabilityExponent,
        random,
      );
    }
    choices[contestant.id] = weightedChoice(
      pool.filter((song) => song.track === track),
      (song) => {
        let gap = 0;
        let total = 0;
        song.part.testedSkills.forEach(({ skill, requiredLevel }, index) => {
          const weight = index === 0 ? 2 : 1;
          gap += weight * Math.abs(contestant.coreSkills[skill] - requiredLevel);
          total += weight;
        });
        const genreWeight =
          song.genre === contestant.specialties.genreAffinity ? AUDITION_CONFIG.genreWeight : 1;
        return genreWeight / (1 + gap / total) ** AUDITION_CONFIG.fitExponent;
      },
      random,
    ).id;
  }
  return choices;
}

function visibleScore(evaluation: AuditionEvaluation): number {
  return (
    0.55 * evaluation.technical.score +
    0.35 * evaluation.stagePresence.score +
    0.025 * Object.values(evaluation.impressions).reduce((sum, check) => sum + check.score, 0)
  );
}

function expectedScore(contestant: Contestant, song: AuditionSong, composure: number): number {
  let sum = 0;
  for (let first = 1; first <= 6; first++) {
    for (let second = 1; second <= 6; second++) {
      sum += visibleScore(
        scoreAudition({
          contestant,
          song,
          composure,
          preferences: expectedPreferences,
          rawDice: [first, second],
          tieBreakKey: 0,
        }),
      );
    }
  }
  return sum / 36;
}

function reactionType(observer: Contestant, better: boolean, random: RandomSource): AuditionReaction['type'] {
  const trait = (name: keyof Contestant['personality']) => Math.max(0, observer.personality[name]) / 10;
  const weights: Partial<Record<AuditionReaction['type'], number>> = better
    ? {
        admiration: trait('gentleness') + trait('maturity'),
        inspiration: trait('gentleness') + trait('maturity'),
        intimidation: trait('ambition') + trait('sensitivity'),
        jealousy: trait('ambition'),
      }
    : {
        confidence: trait('ambition') + trait('maturity'),
        sympathy: trait('gentleness') + trait('sensitivity'),
      };
  return weightedChoice(
    Object.keys(weights) as AuditionReaction['type'][],
    (type) =>
      AUDITION_LIVE_DEFAULTS.reactionBaseWeight +
      AUDITION_LIVE_DEFAULTS.reactionTraitWeight * (weights[type] ?? 0),
    random,
  );
}

function checkedComposure(value: number): number {
  if (!Number.isInteger(value) || value < -1 || value > 1) {
    throw new Error('Audition composure must be an integer from -1 to 1.');
  }
  return value;
}

function relationship(observer: Contestant, performerId: string): number {
  const history = observer.relationships[performerId];
  if (
    history !== undefined &&
    (!Array.isArray(history) || history.some((score) => !Number.isFinite(score) || score < 0 || score > 100))
  ) {
    throw new Error(`Invalid audition relationship score for ${observer.id} toward ${performerId}.`);
  }
  return history?.[history.length - 1] ?? 50;
}

export function resolveLiveAudition(input: {
  contestants: Contestant[];
  pool: readonly AuditionSong[];
  songChoices: Record<string, string>;
  performerId: string;
  previousEvaluations: readonly AuditionEvaluation[];
  preferences: AuditionPreferences;
  composure: Record<string, number>;
  random: RandomSource;
  relationshipPolicy?: AuditionRelationshipPolicy;
}): {
  contestants: Contestant[];
  evaluation: AuditionEvaluation;
  composure: Record<string, number>;
  reactions: AuditionReaction[];
} {
  const { performerId, previousEvaluations, random } = input;
  const policy = input.relationshipPolicy ?? 'everyone-forms-opinions';
  if (policy !== 'reactions-only' && policy !== 'everyone-forms-opinions') {
    throw new Error('Unsupported audition relationship policy.');
  }
  const everyoneFormsOpinions = policy === 'everyone-forms-opinions';
  const performer = input.contestants.find((contestant) => contestant.id === performerId);
  if (!performer) throw new Error(`Unknown audition performer "${performerId}".`);
  if (new Set(input.contestants.map(({ id }) => id)).size !== input.contestants.length) {
    throw new Error('Duplicate audition contestant IDs.');
  }
  const past = new Map(previousEvaluations.map((evaluation) => [evaluation.contestantId, evaluation]));
  if (past.has(performerId)) throw new Error(`Contestant "${performerId}" already auditioned.`);
  const songs = new Map(input.pool.map((song) => [song.id, song]));
  const selectedSong = (id: string): AuditionSong => {
    const song = songs.get(input.songChoices[id]);
    if (!song) throw new Error(`Missing locked audition song for "${id}".`);
    return song;
  };
  const composure = { ...input.composure };
  for (const value of Object.values(composure)) checkedComposure(value);
  for (const contestant of input.contestants) {
    selectedSong(contestant.id);
    if (contestant.id !== performerId) relationship(contestant, performerId);
  }
  const evaluation = scoreAudition({
    contestant: performer,
    song: selectedSong(performerId),
    composure: composure[performerId] ?? 0,
    preferences: input.preferences,
    rawDice: rollAuditionDice(random),
    tieBreakKey: drawAuditionTieBreakKey(random),
  });
  composure[performerId] = 0;
  const reactions: AuditionReaction[] = [];
  const contestants = input.contestants.map((contestant): Contestant => {
    if (contestant.id === performerId) {
      return {
        ...contestant,
        grade: evaluation.grade,
        missionRating: { A: 5, B: 4, C: 3, D: 2, F: 1 }[evaluation.grade],
      };
    }
    const previous = past.get(contestant.id);
    const composureBefore = composure[contestant.id] ?? 0;
    const reference = previous
      ? visibleScore(previous)
      : expectedScore(contestant, selectedSong(contestant.id), composureBefore);
    const difference = visibleScore(evaluation) - reference;
    const gap = Math.abs(difference);
    const sameSong = evaluation.songId === (previous?.songId ?? input.songChoices[contestant.id]);
    const threshold = sameSong ? AUDITION_CONFIG.sameSongReactionGap : AUDITION_CONFIG.reactionGap;
    const quietOpinion = everyoneFormsOpinions ? reactionType(contestant, difference > 0, random) : null;
    const notable =
      gap >= threshold &&
      unit(random) < (sameSong ? AUDITION_CONFIG.sameSongReactionChance : AUDITION_CONFIG.reactionChance);
    if (!notable && !everyoneFormsOpinions) return contestant;
    const type = quietOpinion ?? reactionType(contestant, difference > 0, random);
    const relationshipBefore = relationship(contestant, performerId);
    const amount = everyoneFormsOpinions
      ? !notable
        ? AUDITION_CONFIG.quietOpinionChange
        : sameSong && gap >= AUDITION_CONFIG.strongSameSongGap
          ? AUDITION_CONFIG.strongSameSongOpinionChange
          : AUDITION_CONFIG.notableOpinionChange
      : sameSong && gap >= AUDITION_CONFIG.strongSameSongGap
        ? AUDITION_CONFIG.strongSameSongRelationshipChange
        : AUDITION_CONFIG.ordinaryRelationshipChange;
    const relationshipDelta = everyoneFormsOpinions
      ? type === 'admiration' || type === 'inspiration' || type === 'sympathy'
        ? amount
        : -amount
      : type === 'jealousy'
        ? -amount
        : type === 'admiration' || type === 'sympathy'
          ? amount
          : 0;
    const relationshipAfter = Math.max(0, Math.min(100, relationshipBefore + relationshipDelta));
    const readinessDelta = !notable
      ? 0
      : type === 'intimidation'
        ? -1
        : type === 'inspiration' || type === 'confidence'
          ? 1
          : 0;
    const composureAfter = previous
      ? composureBefore
      : Math.max(-1, Math.min(1, composureBefore + readinessDelta));
    if (relationshipBefore === relationshipAfter && composureBefore === composureAfter) return contestant;
    if (composureBefore !== composureAfter) composure[contestant.id] = composureAfter;
    const outcomes = [
      ...(relationshipBefore !== relationshipAfter
        ? [`relationship ${relationshipBefore} → ${relationshipAfter}`]
        : []),
      ...(composureBefore !== composureAfter ? [`composure ${composureBefore} → ${composureAfter}`] : []),
    ];
    if (notable)
      reactions.push({
        observerId: contestant.id,
        performerId,
        type,
        sameSong,
        gap,
        relationshipBefore,
        relationshipAfter,
        composureBefore,
        composureAfter,
        narrative: `${contestant.name} feels ${type} after ${performer.name}'s audition: ${outcomes.join('; ')}.`,
      });
    if (relationshipBefore === relationshipAfter) return contestant;
    return {
      ...contestant,
      relationships: {
        ...contestant.relationships,
        [performerId]: [...(contestant.relationships[performerId] ?? []), relationshipAfter],
      },
    };
  });
  return { contestants, evaluation, composure, reactions };
}
