import type { AuditionReaction, EpisodeScene } from '../types/audition-episode';
import type { ChangeValue } from '../types/common';
import type { SimulationState } from '../types/simulation';
import { recordContestantChanges } from './change-history';

type Tier = 0 | 1 | 3 | 6;
type Activity = { episode: 1 | 2 | 3 | 4 | 5 | 6 | 7; contestantId: string; tv: Tier; experience: 0 | 1 | 3 };

export function recordSceneTV(scene: EpisodeScene, tier?: Tier): EpisodeScene {
  const ordinary: Record<EpisodeScene['kind'], Tier> = {
    opening: 1,
    choices: 1,
    auditions: scene.presentation === 'introduction' ? 3 : 0,
    broadcast: 0,
    audience: 0,
    eliminations: 3,
    mvp: 6,
    secret: 6,
    dorms: 3,
    ranking: 3,
    draft: 1,
    practice: 3,
    battles: 0,
    saves: 6,
    recap: 1,
  };
  const value = tier ?? ordinary[scene.kind];
  if (value && scene.contestantIds.length) {
    scene.tvMoments ??= {};
    scene.tvMoments.appearance = Object.fromEntries(scene.contestantIds.map((id) => [id, value]));
  }
  return scene;
}

export function recordAiredReactions(scene: EpisodeScene, reactions: readonly AuditionReaction[]): void {
  scene.tvMoments ??= {};
  for (const reaction of reactions) {
    const tier =
      Math.abs(reaction.relationshipAfter - reaction.relationshipBefore) >= 5 ||
      Math.abs(reaction.composureAfter - reaction.composureBefore) >= 2
        ? 6
        : 3;
    const moment = `reaction:${reaction.performerId}`;
    scene.tvMoments[moment] ??= {};
    scene.tvMoments[moment][reaction.observerId] =
      scene.tvMoments[moment][reaction.observerId] === 6 ? 6 : tier;
  }
}

function activities(state: SimulationState): Map<string, Activity> {
  const result = new Map<string, Activity>();
  const runtime = state.runtime;
  if (!runtime) return result;
  const cast = new Set(state.contestants.map((person) => person.id));
  const add = (event: string, activity: Activity) => {
    if (!cast.has(activity.contestantId)) throw new Error('Activity refers to an unknown contestant.');
    const key = JSON.stringify([activity.episode, event, activity.contestantId]);
    if (result.has(key)) throw new Error('Activity identity must be unique.');
    result.set(key, activity);
  };
  for (const number of [1, 2, 3, 4, 5, 6, 7] as const) {
    const episode =
      number === 1
        ? runtime.audition
        : number === 2
          ? runtime.battle
          : number === 3
            ? runtime.bootcamp
            : number === 4
              ? runtime.megaGroups
              : number === 5
                ? runtime.photoshoot
                : number === 6
                  ? runtime.trackSpecials
                  : runtime.versatility;
    for (const scene of episode?.scenes ?? []) {
      if (scene.tvMoments === undefined) continue;
      if (scene.tvMoments === null || typeof scene.tvMoments !== 'object' || Array.isArray(scene.tvMoments))
        throw new Error('Invalid recorded TV moment.');
      for (const [moment, participants] of Object.entries(scene.tvMoments)) {
        if (!moment.trim() || !isRecord(participants)) throw new Error('Invalid recorded TV moment.');
        for (const [id, tv] of Object.entries(participants)) {
          if (tv !== 1 && tv !== 3 && tv !== 6) throw new Error('Invalid recorded TV award.');
          add(`scene:${scene.id}:${moment}`, { episode: number, contestantId: id, tv, experience: 0 });
        }
      }
    }
  }
  for (const evaluation of runtime.audition?.evaluations ?? [])
    add('performance', {
      episode: 1,
      contestantId: evaluation.contestantId,
      tv: evaluation.grade === 'A' ? 6 : 3,
      experience: 3,
    });
  const battle = runtime.battle;
  // Rehearsals are completed before the battle, even when their footage airs later.
  for (const team of battle?.teams ?? []) {
    for (const practice of team.practice)
      for (const person of practice.contestants)
        add(`practice:${team.id}:${practice.session}`, {
          episode: 2,
          contestantId: person.contestantId,
          tv: 0,
          experience: 1,
        });
  }
  for (const performance of battle?.performances ?? [])
    for (const evaluation of performance.evaluations)
      add(`performance:${performance.teamId}`, {
        episode: 2,
        contestantId: evaluation.contestantId,
        tv: evaluation.grade === 'A' ? 6 : 3,
        experience: 3,
      });
  for (const evaluation of runtime.bootcamp?.evaluations ?? [])
    add(`challenge:${evaluation.round}`, {
      episode: 3,
      contestantId: evaluation.contestantId,
      tv: evaluation.events.some((event) => event.spotlight > 0) ? 6 : 3,
      experience: 3,
    });
  for (const team of runtime.megaGroups?.teams ?? [])
    for (const practice of team.practice)
      for (const person of practice.contestants)
        add(`practice:${team.id}:${practice.session}`, {
          episode: 4,
          contestantId: person.contestantId,
          tv: 0,
          experience: 1,
        });
  for (const performance of runtime.megaGroups?.performances ?? [])
    for (const evaluation of performance.evaluations)
      add(`performance:${performance.teamId}:${performance.songId}`, {
        episode: 4,
        contestantId: evaluation.contestantId,
        tv: evaluation.grade === 'A' ? 6 : 3,
        experience: 3,
      });
  for (const team of runtime.photoshoot?.teams ?? [])
    if (team.styling)
      for (const contestantId of team.memberIds)
        add(`styling:${team.id}`, { episode: 5, contestantId, tv: 0, experience: 1 });
  for (const photo of runtime.photoshoot?.individualPhotos ?? [])
    add('individual-photo', {
      episode: 5,
      contestantId: photo.contestantId,
      tv: photo.grade === 'A' ? 6 : 3,
      experience: 3,
    });
  for (const photo of runtime.photoshoot?.groupPhotos ?? [])
    for (const evaluation of photo.evaluations)
      add(`group-photo:${photo.teamId}`, {
        episode: 5,
        contestantId: evaluation.contestantId,
        tv: evaluation.finalScore >= 85 ? 6 : 3,
        experience: 3,
      });
  for (const team of runtime.trackSpecials?.teams ?? [])
    for (const practice of team.practice)
      for (const person of practice.contestants)
        add(`practice:${team.id}:${practice.session}`, {
          episode: 6,
          contestantId: person.contestantId,
          tv: 0,
          experience: 1,
        });
  for (const performance of runtime.trackSpecials?.performances ?? [])
    for (const evaluation of performance.evaluations)
      add(`performance:${performance.teamId}`, {
        episode: 6,
        contestantId: evaluation.contestantId,
        tv: evaluation.grade === 'A' ? 6 : 3,
        experience: 3,
      });
  for (const team of runtime.versatility?.teams ?? [])
    for (const practice of team.practice)
      for (const person of practice.contestants)
        add(`practice:${team.id}:${practice.session}`, {
          episode: 7,
          contestantId: person.contestantId,
          tv: 0,
          experience: 1,
        });
  for (const performance of runtime.versatility?.performances ?? [])
    for (const evaluation of performance.evaluations)
      add(`performance:${performance.teamId}`, {
        episode: 7,
        contestantId: evaluation.contestantId,
        tv: evaluation.grade === 'A' ? 6 : 3,
        experience: 3,
      });
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function restoreActivityProgression(state: SimulationState, stored: unknown): void {
  if (!state.runtime) return;
  const known = activities(state);
  if (stored === undefined) {
    state.runtime.progression = { version: 1, baseline: [...known.keys()], awards: {} };
    for (const person of state.contestants) person.aggregations.score = 0;
    return;
  }
  if (
    !isRecord(stored) ||
    stored.version !== 1 ||
    !Array.isArray(stored.baseline) ||
    !stored.baseline.every((key): key is string => typeof key === 'string' && known.has(key)) ||
    new Set(stored.baseline).size !== stored.baseline.length ||
    !isRecord(stored.awards)
  )
    throw new Error('Invalid saved activity progression.');
  const baseline = stored.baseline;
  const awards: NonNullable<NonNullable<SimulationState['runtime']>['progression']>['awards'] = {};
  const totals = new Map(state.contestants.map((person) => [person.id, 0]));
  for (const [key, value] of Object.entries(stored.awards)) {
    const activity = known.get(key);
    if (
      !activity ||
      baseline.includes(key) ||
      !isRecord(value) ||
      value.tv !== activity.tv ||
      value.experience !== activity.experience
    )
      throw new Error('Invalid saved activity award.');
    awards[key] = { tv: activity.tv, experience: activity.experience };
    totals.set(activity.contestantId, (totals.get(activity.contestantId) ?? 0) + activity.tv);
  }
  if ([...known.keys()].some((key) => !baseline.includes(key) && !Object.hasOwn(awards, key)))
    throw new Error('The saved activity ledger is incomplete.');
  if (state.contestants.some((person) => person.aggregations.score !== totals.get(person.id)))
    throw new Error('Saved TV totals do not match their recorded activity.');
  state.runtime.progression = { version: 1, baseline, awards };
}

export function awardNewActivity(before: SimulationState, next: SimulationState): SimulationState {
  if (before === next || !next.runtime) return next;
  if (!next.runtime.progression)
    next.runtime.progression = { version: 1, baseline: [...activities(before).keys()], awards: {} };
  const progression = next.runtime.progression;
  const baseline = new Set(progression.baseline);
  const byId = new Map(next.contestants.map((person) => [person.id, person]));
  const tvTotals = new Map(next.contestants.map((person) => [person.id, 0]));
  const changes = new Map<string, { tv: number; experience: number; episode: Activity['episode'] }>();
  for (const [key, activity] of activities(next)) {
    if (baseline.has(key)) continue;
    tvTotals.set(activity.contestantId, (tvTotals.get(activity.contestantId) ?? 0) + activity.tv);
    if (Object.hasOwn(progression.awards, key)) continue;
    if (activity.episode !== next.runtime.episode)
      throw new Error('An activity transition cannot award a different episode.');
    progression.awards[key] = { tv: activity.tv, experience: activity.experience };
    const total = changes.get(activity.contestantId) ?? { tv: 0, experience: 0, episode: activity.episode };
    if (total.episode !== activity.episode)
      throw new Error('An activity transition cannot replay earlier episodes.');
    total.tv += activity.tv;
    total.experience += activity.experience;
    changes.set(activity.contestantId, total);
  }
  for (const [id, total] of changes) {
    const person = byId.get(id);
    if (!person) throw new Error('An activity recipient is missing.');
    const previous = structuredClone(person);
    person.aggregations.score += total.tv;
    person.aggregations.experience += total.experience;
    if (!Number.isFinite(person.aggregations.score) || !Number.isFinite(person.aggregations.experience))
      throw new Error('Activity totals must remain finite.');
    const recorded = recordContestantChanges(previous, person, 'Completed episode activity');
    const episode =
      total.episode === 1
        ? next.runtime.audition
        : total.episode === 2
          ? next.runtime.battle
          : total.episode === 3
            ? next.runtime.bootcamp
            : total.episode === 4
              ? next.runtime.megaGroups
              : total.episode === 5
                ? next.runtime.photoshoot
                : total.episode === 6
                  ? next.runtime.trackSpecials
                  : next.runtime.versatility;
    if (!episode) throw new Error('Activity requires its recorded episode.');
    episode.changes[id] ??= [];
    episode.changes[id].push(...recorded);
    const finalChanges: Record<string, ChangeValue> = {};
    for (const change of recorded) if (change.after !== undefined) finalChanges[change.path] = change.after;
    person.changeLog = person.changeLog.map((entry) =>
      entry.episode !== total.episode
        ? entry
        : {
            ...entry,
            changes: [...(entry.changes ?? []), ...recorded],
            change: {
              ...entry.change,
              ...finalChanges,
            },
          },
    );
  }
  if (next.contestants.some((person) => person.aggregations.score !== tvTotals.get(person.id)))
    throw new Error('TV value must come only from recorded on-camera activity.');
  return next;
}
