import type { BootcampEpisode } from '../types/bootcamp-episode';
import type { SimulationState } from '../types/simulation';
import {
  type AudienceEvidence,
  chooseEvidenceMvp,
  resolveNarrativeEvidenceAudience,
} from './audition-audience';
import { auditionGrade } from './audition-scoring';
import type { RandomSource } from './random';

const RECEPTION_OFFSETS: Readonly<Record<string, number>> = {
  underdog: 5,
  'charming-recovery': 5,
  'trainer-awe': 5,
  'sincere-apology': 5,
  'camera-interaction': 5,
  'gentle-support': 5,
  'sustained-effort': 5,
  'charismatic-edge': 5,
  panic: -3,
  'safe-failed-flip': -3,
  'goofing-off': -3,
  flinch: -3,
  'harsh-confrontation': -3,
  'checking-out': -3,
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function episode(state: SimulationState): BootcampEpisode {
  const runtime = state.runtime;
  if (runtime?.version !== 3 || runtime.episode !== 3 || !runtime.bootcamp)
    throw new Error('Boot Camp audience requires an active Episode 3.');
  return runtime.bootcamp;
}

function evidence(state: SimulationState): AudienceEvidence[] {
  const ep = episode(state);
  if (
    ep.participantIds.length !== 18 ||
    new Set(ep.participantIds).size !== 18 ||
    ep.evaluations.length !== 36 ||
    ep.groupResults.length !== 3 ||
    ep.groups.length !== 3 ||
    ep.winners.length !== 4 ||
    state.runtime!.battle?.phase !== 'complete' ||
    state.runtime!.battle.survivorIds.length !== 18 ||
    ep.participantIds.some((id) => !state.runtime!.battle!.survivorIds.includes(id))
  )
    throw new Error('Boot Camp voting requires all challenges and four announced winners.');
  const records = ep.participantIds.map((id) => {
    const person = state.contestants.find((entry) => entry.id === id);
    const records = ep.evaluations.filter((entry) => entry.contestantId === id);
    const pair = records.find((entry) => entry.round >= 1 && entry.round <= 3);
    const final = records.find((entry) => entry.round === 4);
    const groups = ep.groups.filter((entry) => entry.memberIds.includes(id));
    const group = ep.groupResults.find((entry) => entry.groupId === groups[0]?.id);
    if (
      !person ||
      person.status !== 'ACTIVE' ||
      records.length !== 2 ||
      !pair ||
      !final ||
      groups.length !== 1 ||
      !group ||
      [pair.finalScore, final.finalScore, group.score].some(
        (score) => !Number.isFinite(score) || score < 0 || score > 100,
      )
    )
      throw new Error('Boot Camp audience requires each survivor’s pair, final and group evidence.');
    const composite = 0.5 * pair.finalScore + 0.3 * final.finalScore + 0.2 * group.score;
    const edit = clamp(
      records.reduce(
        (total, record) =>
          total + record.events.reduce((sum, event) => sum + (RECEPTION_OFFSETS[event.kind] ?? 0), 0),
        0,
      ),
      -10,
      10,
    );
    return { id, person, pair, final, group, composite, edit };
  });
  records.sort(
    (a, b) =>
      b.composite - a.composite ||
      b.pair.finalScore - a.pair.finalScore ||
      b.final.finalScore - a.final.finalScore ||
      b.group.score - a.group.score ||
      a.final.tieBreakKey - b.final.tieBreakKey ||
      a.id.localeCompare(b.id),
  );
  return records.map(({ id, person, composite, edit }) => ({
    contestantId: id,
    finalScore: composite,
    reception: clamp(composite + edit, 0, 100),
    observedScore: composite,
    category: person.track,
  }));
}

export function closeBootcampAudience(state: SimulationState, random: RandomSource): void {
  const ep = episode(state);
  if (ep.audience || ep.scoreAwardsApplied) throw new Error('Boot Camp audience has already closed.');
  const runtime = state.runtime!;
  const mood = runtime.preparations?.[3]?.mood;
  if (!mood) throw new Error('Boot Camp voting requires the locked opening mood.');
  const performances = evidence(state);
  if (
    Object.keys(ep.exposure).length !== 18 ||
    Object.keys(ep.exposure).some((id) => !ep.participantIds.includes(id)) ||
    ep.participantIds.some(
      (id) => !Number.isFinite(ep.exposure[id]) || ep.exposure[id] < 2 || ep.exposure[id] > 4,
    )
  )
    throw new Error('Boot Camp footage must contain two to four recorded units per performer.');
  if (ep.winners.some((id) => !ep.participantIds.includes(id)))
    throw new Error('Boot Camp winner does not belong to the cast.');
  const total = ep.participantIds.reduce((sum, id) => sum + ep.exposure[id], 0);
  const exposure = Object.fromEntries(ep.participantIds.map((id) => [id, ep.exposure[id] / total]));
  const cast = ep.participantIds.map((id) => state.contestants.find((person) => person.id === id)!);
  const result = resolveNarrativeEvidenceAudience({
    contestants: cast,
    evidence: performances,
    exposure,
    mood,
    show: runtime.show,
    random,
  });
  const performanceOrder = new Map(performances.map((entry, index) => [entry.contestantId, index]));
  const byId = new Map(result.contestants.map((person) => [person.id, person]));
  for (const person of result.contestants) {
    person.aggregations.screenTime += 100 * exposure[person.id];
    person.aggregations.score += 5 * ep.winners.filter((id) => id === person.id).length;
    person.grade = auditionGrade(performances[performanceOrder.get(person.id)!].finalScore);
    person.missionRating = { A: 5, B: 4, C: 3, D: 2, F: 1 }[person.grade];
    // Closing the ballot must not publish the still-sealed continuing placement.
    person.rank = cast.find((entry) => entry.id === person.id)!.rank;
  }
  ep.rankedIds = [...result.contestants]
    .sort(
      (a, b) =>
        b.aggregations.score - a.aggregations.score ||
        performanceOrder.get(a.id)! - performanceOrder.get(b.id)!,
    )
    .map((person) => person.id);
  state.contestants = state.contestants.map((person) => byId.get(person.id) ?? person);
  runtime.show = result.show;
  ep.audience = result.outcome;
  ep.scoreAwardsApplied = true;
}

export function chooseBootcampMvp(state: SimulationState, random: RandomSource): void {
  const ep = episode(state);
  if (!ep.audience || !ep.scoreAwardsApplied)
    throw new Error('Close Boot Camp audience voting before choosing the MVP.');
  if (ep.mvp) throw new Error('Boot Camp MVP has already been chosen.');
  ep.mvp = chooseEvidenceMvp(
    ep.participantIds.map((id) => state.contestants.find((person) => person.id === id)!),
    evidence(state),
    ep.participantIds,
    random,
    18,
  );
  const winner = state.contestants.find((person) => person.id === ep.mvp!.winnerId)!;
  winner.aggregations.mvp++;
  winner.events.push('BOOTCAMP_MVP');
}
