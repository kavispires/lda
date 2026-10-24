import type { AuditionEvaluation, AuditionSong } from '../types/audition';
import type {
  AudienceOutcome,
  AuditionReaction,
  BroadcastCut,
  MoodChoices,
  MvpResult,
  ShowAudience,
} from '../types/audition-episode';
import type { Contestant } from '../types/contestant';
import { AUDITION_CONFIG } from './audition-config';
import { rankAuditions } from './audition-scoring';
import type { RandomSource } from './random';

// Local defaults supplement the shared configuration without introducing cut-name bonuses.
const CONFIG = {
  ...AUDITION_CONFIG,
  castSize: 50,
  survivorCount: 30,
  noticedCount: 3,
  technicalReception: 0.4,
  stageReception: 0.3,
  impressionReception: 0.1,
  rawTwist: 10,
  preferenceWeight: 0.5,
  moodMatchWeight: 0.03,
  satisfactionDivisor: 5,
  performanceContribution: 0.6,
  voteContribution: 0.3,
  productionContribution: 0.1,
  cumulativeRetention: 0.75,
  mvpPerformance: 0.4,
  mvpRelationship: 0.4,
  mvpAffinity: 0.2,
  mvpTechnical: 0.5,
  mvpStage: 0.5,
  personalityRange: 20,
} as const;

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const ratio = (value: number) => clamp(value, -1, 1);

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}

function entry<T>(map: ReadonlyMap<string, T>, id: string): T {
  const value = map.get(id);
  if (value === undefined) throw new Error(`Missing audition cast data for ${id}.`);
  return value;
}

function unit(random: RandomSource): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error('Audience random draws must be finite numbers in [0, 1).');
  }
  return value;
}

function pick(weights: readonly number[], random: RandomSource, excluded: readonly number[] = []): number {
  let total = 0;
  for (let index = 0; index < weights.length; index++) {
    if (!excluded.includes(index)) total += weights[index];
  }
  if (!Number.isFinite(total) || total <= 0) throw new Error('Audience selection requires positive weights.');
  let draw = unit(random) * total;
  let last = -1;
  for (let index = 0; index < weights.length; index++) {
    if (excluded.includes(index) || weights[index] <= 0) continue;
    last = index;
    draw -= weights[index];
    if (draw < 0) return index;
  }
  return last;
}

function castMap(contestants: readonly Contestant[]): Map<string, Contestant> {
  const cast = new Map<string, Contestant>();
  for (const contestant of contestants) {
    if (!contestant.id?.trim() || cast.has(contestant.id)) {
      throw new Error('Audience contestant IDs must be nonempty and unique.');
    }
    cast.set(contestant.id, contestant);
  }
  return cast;
}

function validateCast(
  contestants: readonly Contestant[],
  evaluations: readonly AuditionEvaluation[],
  castSize = CONFIG.castSize as number,
) {
  const cast = castMap(contestants);
  if (cast.size !== castSize || evaluations.length !== castSize) {
    throw new Error(`Broadcast requires all ${castSize} unique contestants and evaluations.`);
  }
  const ranked = rankAuditions(evaluations);
  for (const evaluation of ranked) {
    if (!cast.has(evaluation.contestantId))
      throw new Error('Audition evaluation does not belong to this cast.');
    for (const score of [
      evaluation.technical.score,
      evaluation.stagePresence.score,
      ...Object.values(evaluation.impressions).map((impression) => impression.score),
    ]) {
      if (!Number.isFinite(score) || score < 0 || score > 100) {
        throw new Error('Audience delivery scores must be finite and within 0–100.');
      }
    }
    if (
      evaluation.rawDice.length !== 2 ||
      evaluation.rawDice.some((face) => !Number.isInteger(face) || face < 1 || face > 6)
    ) {
      throw new Error('Audience reception requires two raw dice from 1 to 6.');
    }
  }
  return { cast, ranked, byId: new Map(ranked.map((evaluation) => [evaluation.contestantId, evaluation])) };
}

function validateReactions(reactions: readonly AuditionReaction[], cast: Map<string, Contestant>): void {
  for (const reaction of reactions) {
    if (
      !cast.has(reaction.observerId) ||
      !cast.has(reaction.performerId) ||
      reaction.observerId === reaction.performerId ||
      !reaction.narrative.trim()
    ) {
      throw new Error('Broadcast reactions require distinct cast members and recorded footage.');
    }
    for (const value of [
      reaction.gap,
      reaction.relationshipBefore,
      reaction.relationshipAfter,
      reaction.composureBefore,
      reaction.composureAfter,
    ])
      finite(value, 'Recorded reaction value');
  }
}

function intensity(reaction: AuditionReaction): number {
  // Only measured events contribute: normalize the gap and actual relationship/composure changes.
  return clamp(
    100 *
      Math.max(
        Math.abs(reaction.gap) / CONFIG.strongReactionGap,
        Math.abs(reaction.relationshipAfter - reaction.relationshipBefore) /
          CONFIG.strongSameSongRelationshipChange,
        Math.abs(reaction.composureAfter - reaction.composureBefore) / CONFIG.strongReactionGap,
      ),
  );
}

const isNegative = (reaction: AuditionReaction) =>
  reaction.type === 'jealousy' || reaction.type === 'intimidation';

export function createBroadcastCuts(
  contestants: readonly Contestant[],
  evaluations: readonly AuditionEvaluation[],
  reactions: readonly AuditionReaction[],
  random: RandomSource,
  castSize: number = CONFIG.castSize,
): BroadcastCut[] {
  const { cast, ranked, byId } = validateCast(contestants, evaluations, castSize);
  validateReactions(reactions, cast);
  const mandatory = [...ranked.slice(0, 2), ...ranked.slice(-2)].map((evaluation) => evaluation.contestantId);
  const themes = [
    {
      id: 'music',
      title: 'On the stage',
      description: 'A performance-led montage of the recorded auditions.',
    },
    {
      id: 'personalities',
      title: 'In the spotlight',
      description: 'The recorded stage presence and star-quality moments take focus.',
    },
    {
      id: 'backstage',
      title: 'Around the stage',
      description: 'Recorded reactions and backstage cutaways frame the auditions.',
    },
  ] as const;
  return themes.map((theme) => {
    const featuredIds = [...mandatory];
    const available = contestants.filter((contestant) => !featuredIds.includes(contestant.id));
    while (featuredIds.length < CONFIG.featuredCount) {
      const weights = available.map((contestant) => {
        const evaluation = entry(byId, contestant.id);
        if (theme.id === 'music') return 1 + evaluation.technical.score;
        if (theme.id === 'personalities') {
          const impressions = Object.values(evaluation.impressions);
          return 1 + impressions.reduce((sum, impression) => sum + impression.score, 0) / impressions.length;
        }
        return (
          1 +
          reactions
            .filter((reaction) => reaction.observerId === contestant.id)
            .reduce((sum, reaction) => sum + intensity(reaction), 0)
        );
      });
      featuredIds.push(available.splice(pick(weights, random), 1)[0].id);
    }
    return {
      ...theme,
      featuredIds,
      exposure: Object.fromEntries(
        contestants.map(({ id }) => [
          id,
          CONFIG.baselineRuntime / contestants.length +
            (featuredIds.includes(id) ? (1 - CONFIG.baselineRuntime) / CONFIG.featuredCount : 0),
        ]),
      ),
      footage: featuredIds.map((id) => {
        const evaluation = entry(byId, id);
        const position = mandatory.indexOf(id);
        const relative =
          position >= 0
            ? ` One of the ${position < 2 ? 'strongest' : 'weakest'} auditions in this cast.`
            : '';
        const quality =
          evaluation.grade === 'A'
            ? 'An excellent audition.'
            : evaluation.grade === 'F'
              ? 'An audition with substantial delivery difficulties.'
              : `A grade ${evaluation.grade} audition.`;
        const recorded = reactions.filter((reaction) => reaction.observerId === id);
        const focus =
          theme.id === 'music'
            ? 'Technical delivery takes focus.'
            : theme.id === 'personalities'
              ? 'The actual visual, uniqueness, potential and charisma impressions take focus.'
              : recorded.length
                ? 'Recorded backstage reactions take focus.'
                : 'An unremarkable backstage cutaway accompanies the recorded audition; no reaction was captured.';
        return {
          contestantId: id,
          description: `${entry(cast, id).name}: ${quality}${relative} ${focus}${
            recorded.length ? ` ${recorded.map((reaction) => reaction.narrative).join(' ')}` : ''
          }`,
        };
      }),
    };
  });
}

function validateShow(show: ShowAudience): void {
  for (const count of [show.audience, show.general, show.pendingAttrition, ...Object.values(show.fans)]) {
    if (!Number.isSafeInteger(count) || count < 0)
      throw new Error('Audience populations must be nonnegative safe integers.');
  }
  if (
    !Number.isFinite(show.satisfaction) ||
    show.satisfaction < 0 ||
    show.satisfaction > 100 ||
    show.pendingAttrition > show.audience
  )
    throw new Error('Invalid show satisfaction or pending attrition.');
  if (show.general + Object.values(show.fans).reduce((sum, count) => sum + count, 0) !== show.audience) {
    throw new Error('Audience must equal general viewers plus all fans.');
  }
}

function validateCut(cut: BroadcastCut, ids: readonly string[]): void {
  if (
    cut.featuredIds.length !== CONFIG.featuredCount ||
    new Set(cut.featuredIds).size !== CONFIG.featuredCount ||
    cut.featuredIds.some((id) => !ids.includes(id))
  )
    throw new Error('Broadcast cut requires ten unique cast features.');
  if (
    Object.keys(cut.exposure).length !== ids.length ||
    Object.keys(cut.exposure).some((id) => !ids.includes(id))
  )
    throw new Error('Broadcast exposure must include exactly the full cast.');
  const floor = CONFIG.baselineRuntime / ids.length;
  if (
    ids.some((id) => !Number.isFinite(cut.exposure[id]) || cut.exposure[id] < floor) ||
    Math.abs(ids.reduce((sum, id) => sum + cut.exposure[id], 0) - 1) > 1e-9
  ) {
    throw new Error('Broadcast exposure must meet the baseline floor and total one.');
  }
  if (cut.footage.some((footage) => !ids.includes(footage.contestantId))) {
    throw new Error('Broadcast footage must belong to this cast.');
  }
}

function reception(evaluation: AuditionEvaluation): number {
  const [first, second] = evaluation.rawDice;
  const twist = first === second ? (first === 1 ? CONFIG.rawTwist : first === 6 ? -CONFIG.rawTwist : 0) : 0;
  return clamp(
    CONFIG.technicalReception * evaluation.technical.score +
      CONFIG.stageReception * evaluation.stagePresence.score +
      CONFIG.impressionReception *
        (evaluation.impressions.visual.score +
          evaluation.impressions.uniqueness.score +
          evaluation.impressions.charisma.score) +
      twist,
  );
}

interface AudienceInput {
  contestants: readonly Contestant[];
  evaluations: readonly AuditionEvaluation[];
  reactions: readonly AuditionReaction[];
  mood: MoodChoices;
  show: ShowAudience;
  random: RandomSource;
  /** Frozen song metadata enables genre diversity; absent metadata uses recorded contestant tracks. */
  songs?: readonly AuditionSong[];
  castSize?: number;
}

type AudienceResult = { contestants: Contestant[]; show: ShowAudience; outcome: AudienceOutcome };
type ShownScene = { share: number; reactions: readonly AuditionReaction[] };

export function resolveBroadcast(input: AudienceInput & { cut: BroadcastCut }): AudienceResult {
  const { cut, contestants, reactions } = input;
  validateCut(
    cut,
    contestants.map(({ id }) => id),
  );
  return resolveAudience({
    ...input,
    exposure: cut.exposure,
    creditScreenTime: true,
    scenes: cut.featuredIds.map((id) => {
      const descriptions = cut.footage
        .filter((footage) => footage.contestantId === id)
        .map((footage) => footage.description);
      return {
        share:
          Math.max(0, cut.exposure[id] - CONFIG.baselineRuntime / contestants.length) /
          (1 - CONFIG.baselineRuntime),
        reactions: reactions.filter(
          (reaction) =>
            reaction.observerId === id &&
            descriptions.some((description) => description.includes(reaction.narrative)),
        ),
      };
    }),
  });
}

export function resolveNarrativeAudience(input: {
  castSize?: number;
  contestants: readonly Contestant[];
  evaluations: readonly AuditionEvaluation[];
  reactions: readonly AuditionReaction[];
  exposure: Record<string, number>;
  mood: MoodChoices;
  show: ShowAudience;
  random: RandomSource;
  songs: readonly AuditionSong[];
}): AudienceResult {
  const ids = input.contestants.map(({ id }) => id);
  if (
    Object.keys(input.exposure).length !== ids.length ||
    Object.keys(input.exposure).some((id) => !ids.includes(id)) ||
    ids.some((id) => !Number.isFinite(input.exposure[id]) || input.exposure[id] <= 0) ||
    Math.abs(ids.reduce((sum, id) => sum + input.exposure[id], 0) - 1) > 1e-9
  ) {
    throw new Error('Narrative exposure must be positive for the full cast and total one.');
  }
  return resolveAudience({
    ...input,
    creditScreenTime: false,
    scenes: ids.map((id) => ({
      share: input.exposure[id],
      reactions: input.reactions.filter((reaction) => reaction.observerId === id),
    })),
  });
}

function resolveAudience(
  input: AudienceInput & {
    exposure: Record<string, number>;
    scenes: readonly ShownScene[];
    creditScreenTime: boolean;
  },
): AudienceResult {
  const { contestants, evaluations, reactions, mood, random, songs } = input;
  const coverage = input.exposure;
  const { cast, ranked, byId } = validateCast(contestants, evaluations, input.castSize);
  validateReactions(reactions, cast);
  validateShow(input.show);
  const ids = contestants.map(({ id }) => id);
  for (const [id, count] of Object.entries(input.show.fans)) {
    if (count > 0 && !cast.has(id))
      throw new Error(`Loyal fans have no eligible favorite: ${id}. Transfer fans before voting.`);
  }
  const show = structuredClone(input.show);
  const updated = structuredClone([...contestants]);
  const receptions = Object.fromEntries(
    evaluations.map((evaluation) => [evaluation.contestantId, reception(evaluation)]),
  );
  const shownReception = ids.reduce((sum, id) => sum + coverage[id] * receptions[id], 0);
  const songGenres = songs ? new Map(songs.map((song) => [song.id, song.genre])) : null;
  if (songGenres && evaluations.some((evaluation) => !songGenres.has(evaluation.songId))) {
    throw new Error('Broadcast song metadata must include every recorded audition song.');
  }
  const categoryShares = new Map<string, number>();
  for (const id of ids) {
    const category = songGenres?.get(entry(byId, id).songId) ?? entry(cast, id).track;
    categoryShares.set(category, (categoryShares.get(category) ?? 0) + coverage[id]);
  }
  // Simpson diversity: a single category is 0; equal coverage of available categories is 100.
  const categories = categoryShares.size;
  const variety =
    categories < 2
      ? 0
      : clamp(
          (100 * (1 - [...categoryShares.values()].reduce((sum, share) => sum + share * share, 0))) /
            (1 - 1 / categories),
        );
  let actualSceneIntensity = 0;
  let negativeSceneShare = 0;
  for (const { share: sceneShare, reactions: shown } of input.scenes) {
    if (!shown.length) continue;
    actualSceneIntensity +=
      (sceneShare * shown.reduce((sum, reaction) => sum + intensity(reaction), 0)) / shown.length;
    negativeSceneShare +=
      (sceneShare *
        shown.reduce((sum, reaction) => sum + (isNegative(reaction) ? intensity(reaction) / 100 : 0), 0)) /
      shown.length;
  }
  // Enjoyment = .8 reception + .2 variety - 20 negative-scene share;
  // attention = .7 reception + .3 actual scene intensity. Both are bounded 0–100.
  const enjoyment = clamp(
    CONFIG.receptionEnjoymentWeight * shownReception +
      CONFIG.varietyEnjoymentWeight * variety -
      CONFIG.negativeScenePenalty * negativeSceneShare,
  );
  const attention = clamp(
    CONFIG.receptionAttentionWeight * shownReception + CONFIG.sceneAttentionWeight * actualSceneIntensity,
  );
  const satisfactionBefore = show.satisfaction;
  show.satisfaction = clamp(
    show.satisfaction +
      clamp(
        Math.round((enjoyment - CONFIG.satisfactionNeutral) / CONFIG.satisfactionDivisor),
        -CONFIG.maxSatisfactionChange,
        CONFIG.maxSatisfactionChange,
      ),
  );
  const newViewers = Math.round(
    show.audience *
      CONFIG.maxViewerGrowth *
      clamp((attention - CONFIG.attentionGrowthThreshold) / (100 - CONFIG.attentionGrowthThreshold), 0, 1),
  );
  show.audience += newViewers;
  show.general += newViewers;
  const votingPopulation = show.audience;
  const exposure = ids.map((id) => coverage[id]);
  // Appeal is frozen before popularity updates; acquired viewers join general before this vote.
  const appeal = contestants.map((contestant) => {
    const preference = ratio(finite(contestant.aggregations.audienceRatio, 'Audience preference'));
    const matches = (Object.keys(mood) as (keyof MoodChoices)[]).filter(
      (key) => mood[key] === contestant.specialties[key],
    ).length;
    return (
      Math.max(1, receptions[contestant.id]) *
      (1 + preference * CONFIG.preferenceWeight) *
      (1 + CONFIG.moodMatchWeight * matches)
    );
  });
  const generalVotes = ids.map(() => 0);
  for (let viewer = 0; viewer < show.general; viewer++) {
    const noticed: number[] = [];
    for (let index = 0; index < Math.min(CONFIG.noticedCount, ids.length); index++) {
      noticed.push(pick(exposure, random, noticed));
    }
    const selected = pick(
      noticed.map((index) => appeal[index]),
      random,
    );
    generalVotes[noticed[selected]]++;
  }
  const votes = Object.fromEntries(ids.map((id, index) => [id, generalVotes[index] + (show.fans[id] ?? 0)]));
  const newFans: Record<string, number> = {};
  const maximumVotes = Math.max(...Object.values(votes));
  for (let index = 0; index < updated.length; index++) {
    const contestant = updated[index];
    const id = contestant.id;
    const aggregations = contestant.aggregations;
    newFans[id] = Math.round(
      generalVotes[index] *
        CONFIG.fanConversion *
        (1 + ratio(finite(aggregations.fanbaseRatio, 'Fanbase preference'))),
    );
    show.general -= newFans[id];
    show.fans[id] = (show.fans[id] ?? 0) + newFans[id];
    if (input.creditScreenTime) {
      // Narrative beats have already credited their screen time.
      aggregations.screenTime = finite(aggregations.screenTime, 'Screen time') + 100 * coverage[id];
    }
    aggregations.audienceRatio = ratio(
      ratio(aggregations.audienceRatio) +
        coverage[id] *
          ((receptions[id] - CONFIG.satisfactionNeutral) / CONFIG.satisfactionNeutral) *
          CONFIG.popularityScale,
    );
    const production = 50 * (ratio(finite(aggregations.productionRatio, 'Production preference')) + 1);
    const contribution =
      CONFIG.performanceContribution * entry(byId, id).finalScore +
      CONFIG.voteContribution * (maximumVotes ? (100 * votes[id]) / maximumVotes : 0) +
      CONFIG.productionContribution * production;
    aggregations.score =
      CONFIG.cumulativeRetention * finite(aggregations.score, 'Cumulative score') + contribution;
  }
  const auditionOrder = new Map(ranked.map((evaluation, index) => [evaluation.contestantId, index]));
  [...updated]
    .sort(
      (left, right) =>
        right.aggregations.score - left.aggregations.score ||
        entry(auditionOrder, left.id) - entry(auditionOrder, right.id),
    )
    .forEach((contestant, index) => {
      contestant.rank = index + 1;
    });
  show.pendingAttrition = Math.round(
    show.audience *
      CONFIG.maxNextEpisodeAttrition *
      clamp((CONFIG.satisfactionNeutral - show.satisfaction) / CONFIG.satisfactionNeutral, 0, 1),
  );
  validateShow(show);
  return {
    contestants: updated,
    show,
    outcome: {
      votes,
      receptions,
      newFans,
      votingPopulation,
      newViewers,
      satisfactionBefore,
      satisfactionAfter: show.satisfaction,
      attention,
      enjoyment,
    },
  };
}

function survivorCast(contestants: readonly Contestant[], survivorIds: readonly string[]) {
  const cast = castMap(contestants);
  if (new Set(survivorIds).size !== survivorIds.length || survivorIds.some((id) => !cast.has(id))) {
    throw new Error('Survivor IDs must be unique members of the cast.');
  }
  return { cast, survivors: survivorIds.map((id) => entry(cast, id)) };
}

function relationship(from: Contestant, to: Contestant): number {
  const history = from.relationships[to.id];
  // Missing history is an unmodified neutral relationship, not a reversed-direction lookup.
  return clamp(finite(history?.length ? history[history.length - 1] : 50, 'Directional relationship'));
}

function allocate(total: number, weights: readonly number[], random: RandomSource): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const quotas = weights.map((weight) => (total * weight) / weightSum);
  const counts = quotas.map(Math.floor);
  const remainder = total - counts.reduce((sum, count) => sum + count, 0);
  if (!remainder) return counts;
  const priorities = quotas.map((quota, index) => ({
    index,
    fraction: quota - counts[index],
    tie: unit(random),
  }));
  priorities.sort(
    (left, right) => right.fraction - left.fraction || left.tie - right.tie || left.index - right.index,
  );
  for (const { index } of priorities.slice(0, remainder)) counts[index]++;
  return counts;
}

export function transferEliminatedFans(
  input: ShowAudience,
  contestants: readonly Contestant[],
  survivorIds: readonly string[],
  random: RandomSource,
): ShowAudience {
  validateShow(input);
  const { cast, survivors } = survivorCast(contestants, survivorIds);
  const survivorSet = new Set(survivorIds);
  const show = structuredClone(input);
  for (const [id, fans] of Object.entries(input.fans)) {
    if (survivorSet.has(id)) continue;
    if (fans && !cast.has(id)) throw new Error(`Cannot transfer fans without departed contestant ${id}.`);
    show.fans[id] = 0;
    const transferred = survivors.length ? Math.floor(fans * CONFIG.fanTransfer) : 0;
    show.general += fans - transferred;
    if (!transferred) continue;
    const departed = entry(cast, id);
    const counts = allocate(
      transferred,
      survivors.map((survivor) => 1 + Math.max(0, relationship(departed, survivor) - 50)),
      random,
    );
    survivors.forEach((survivor, index) => {
      show.fans[survivor.id] = (show.fans[survivor.id] ?? 0) + counts[index];
    });
  }
  validateShow(show);
  return show;
}

export function chooseAuditionMvp(
  contestants: readonly Contestant[],
  evaluations: readonly AuditionEvaluation[],
  survivorIds: readonly string[],
  random: RandomSource,
  options: { castSize?: number; survivorCount?: number } = {},
): MvpResult {
  const { byId } = validateCast(contestants, evaluations, options.castSize);
  const { survivors } = survivorCast(contestants, survivorIds);
  if (survivors.length !== (options.survivorCount ?? CONFIG.survivorCount))
    throw new Error(`MVP requires all ${options.survivorCount ?? CONFIG.survivorCount} survivors.`);
  const totals = Object.fromEntries(survivorIds.map((id) => [id, 0]));
  const ballots: Record<string, string> = {};
  for (const voter of survivors) {
    const eligible = survivors.filter((candidate) => candidate.id !== voter.id);
    const weights = eligible.map((candidate) => {
      const evaluation = entry(byId, candidate.id);
      const observed =
        CONFIG.mvpTechnical * evaluation.technical.score + CONFIG.mvpStage * evaluation.stagePresence.score;
      const traits = Object.keys(voter.personality) as (keyof Contestant['personality'])[];
      if (!traits.length) throw new Error('MVP affinity requires personality traits.');
      const affinity =
        traits.reduce((sum, trait) => {
          const first = finite(voter.personality[trait], 'MVP personality trait');
          const second = finite(candidate.personality[trait], 'MVP personality trait');
          if (Math.abs(first) > 10 || Math.abs(second) > 10)
            throw new Error('MVP personality traits must be within -10–10.');
          return sum + 100 * (1 - Math.abs(first - second) / CONFIG.personalityRange);
        }, 0) / traits.length;
      return (
        CONFIG.mvpPerformance * observed +
        CONFIG.mvpRelationship * relationship(voter, candidate) +
        CONFIG.mvpAffinity * affinity
      );
    });
    const winner = eligible[pick(weights, random)].id;
    ballots[voter.id] = winner;
    totals[winner]++;
  }
  const highest = Math.max(...Object.values(totals));
  const tiedIds = survivorIds.filter((id) => totals[id] === highest);
  const winnerId = tiedIds.length === 1 ? tiedIds[0] : tiedIds[Math.floor(unit(random) * tiedIds.length)];
  return { ballots, totals, winnerId, tiedIds };
}
