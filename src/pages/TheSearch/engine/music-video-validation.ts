import type { Contestant } from '../types/contestant';
import type { MusicVideoEpisode } from '../types/music-video-episode';
import type { SimulationDefinitions, SimulationState } from '../types/simulation';
import type { VarietyShowEpisode } from '../types/variety-show-episode';
import { validateMusicVideoCatalog } from '../utilities/music-video-catalog';
import { recordContestantChanges } from './change-history';
import { validateMusicVideoPreparation, validateSpecialtiesPreparation } from './episode-preparation';
import { applyMusicVideoAction, captureMusicVideoStart, initializeMusicVideo } from './music-video-runtime';
import { createSeededRandom } from './random';

function fail(detail: string): never {
  throw new Error(`Invalid Music Videos episode: ${detail}.`);
}
const same = (actual: unknown, expected: unknown, detail: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(detail);
};
const uniqueIds = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === 'string') && new Set(value).size === value.length;

// Historical logs have a runtime-specific phase ID; their native effects are checked separately.
function nativeEvidence(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => nativeEvidence(entry));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([field]) => field !== 'changeLog')
        .map(([field, entry]) => [field, nativeEvidence(entry)]),
    );
  return value;
}

function activityTotals(ep: MusicVideoEpisode): Record<string, { tv: number; experience: number }> {
  return Object.fromEntries(
    ep.participantIds.map((id) => {
      const solo = ep.solos.find((entry) => entry.contestantId === id);
      const tv =
        ep.scenes.reduce(
          (sum, scene) =>
            sum +
            Object.values(scene.tvMoments ?? {}).reduce((total, moment) => total + (moment[id] ?? 0), 0),
          0,
        ) +
        (solo ? (solo.finalScore >= 85 ? 6 : 3) : 0) +
        (ep.filmingCompleted ? 3 : 0);
      const experience =
        ep.storyboards.filter((entry) => entry.contestantId === id && entry.completed).length +
        (solo ? 3 : 0) +
        (ep.filmingCompleted ? 3 : 0);
      return [id, { tv, experience }];
    }),
  );
}

function replayActivity(state: SimulationState, before: ReturnType<typeof activityTotals>) {
  const ep = state.runtime!.musicVideo!;
  const after = activityTotals(ep);
  for (const entry of state.contestants) {
    if (!after[entry.id]) continue;
    const tv = after[entry.id].tv - before[entry.id].tv;
    const experience = after[entry.id].experience - before[entry.id].experience;
    if (!tv && !experience) continue;
    const previous = { ...entry, aggregations: { ...entry.aggregations } };
    entry.aggregations.score += tv;
    entry.aggregations.experience += experience;
    ep.changes[entry.id] ??= [];
    ep.changes[entry.id].push(...recordContestantChanges(previous, entry, 'Completed episode activity'));
  }
}

function replay(ep: MusicVideoEpisode, definitions: SimulationDefinitions): SimulationState {
  validateMusicVideoCatalog(definitions.musicVideoCatalog);
  if (
    ep.version !== 1 ||
    !Number.isSafeInteger(ep.revision) ||
    ep.revision < 0 ||
    ep.revision > 80 ||
    !uniqueIds(ep.participantIds) ||
    ep.participantIds.length !== 10 ||
    !Array.isArray(ep.startingContestants) ||
    ep.startingContestants.length !== 50 ||
    !uniqueIds(ep.startingContestants.map((entry) => entry?.id)) ||
    !Array.isArray(ep.steps) ||
    ep.steps.length !== ep.revision ||
    !ep.startingPreparation ||
    ep.startingPreparation.episode !== 9 ||
    ep.startingPreparation.openingPlayed ||
    !ep.startingPreparation.mood ||
    ep.startingPreparation.requiredSelections !== 0 ||
    ep.startingPreparation.randomAudit?.endState !== ep.randomStartState ||
    !uniqueIds(ep.startingOpeningCast) ||
    ep.startingOpeningCast.length !== 5 ||
    ep.startingOpeningCast.some((id) => !ep.participantIds.includes(id)) ||
    !Array.isArray(ep.startingRevealedSecrets) ||
    !Array.isArray(ep.startingDeferredConsequences)
  )
    fail('version, starting cast, preparation or action journal');
  const startingActive = ep.startingContestants.filter((entry) => entry.status === 'ACTIVE');
  if (startingActive.length !== 10 || startingActive.some((entry) => !ep.participantIds.includes(entry.id)))
    fail('starting active survivors');
  const placements = ep.startingContestants.map((entry) => entry.rank).sort((a, b) => a - b);
  same(
    placements,
    Array.from({ length: 50 }, (_, index) => index + 1),
    'starting fifty placements',
  );
  same(ep.startingPreparation.slots, ep.startingOpeningCast, 'confirmed starting opening');
  const random = createSeededRandom(ep.randomStartState);
  const state: SimulationState = {
    status: 'ready',
    persistenceError: null,
    createdAt: 1,
    contestants: structuredClone(ep.startingContestants),
    runtime: {
      version: 3,
      runId: 'native-music-video-replay',
      seed: ep.randomStartState,
      randomState: ep.randomStartState,
      episode: 8,
      phase: 'episode-complete',
      setup: { useBias: false, selectedIds: ep.startingContestants.map((entry) => entry.id) },
      sourceContestants: {},
      initialContestants: [],
      definitions,
      audition: null,
      varietyShow: { phase: 'complete', survivorIds: [...ep.participantIds] } as VarietyShowEpisode,
      openingCast: [...ep.startingOpeningCast],
      preparations: { 9: structuredClone(ep.startingPreparation) },
      show: structuredClone(ep.startingShow),
      revealedSecrets: structuredClone(ep.startingRevealedSecrets),
      deferredConsequences: structuredClone(ep.startingDeferredConsequences),
    },
  };
  const before = structuredClone(state.contestants);
  initializeMusicVideo(state, ep.randomStartState);
  captureMusicVideoStart(state, before);
  for (const [index, step] of ep.steps.entries()) {
    if (
      !step ||
      step.revision !== index ||
      !step.action ||
      !['advance', 'secret'].includes(step.action.type) ||
      !Number.isSafeInteger(step.drawCount) ||
      step.drawCount < 0 ||
      state.runtime!.musicVideo!.phase === 'complete'
    )
      fail('action chronology');
    const beforeActivity = activityTotals(state.runtime!.musicVideo!);
    let drawCount = 0;
    applyMusicVideoAction(state, step.action, () => {
      const value = random.next();
      drawCount++;
      return value;
    });
    same(step.drawCount, drawCount, 'seeded action draw count');
    same(step.endState, random.getState(), 'seeded action end state');
    replayActivity(state, beforeActivity);
    state.runtime!.musicVideo!.steps.push({
      revision: index,
      action: structuredClone(step.action),
      drawCount,
      endState: random.getState(),
    });
  }
  state.runtime!.randomState = random.getState();
  same(ep, state.runtime!.musicVideo, 'independently reconstructed footage, effects, phase and outcome');
  return state;
}

export function assertMusicVideoEpisode(
  value: unknown,
  contestants: readonly Contestant[],
  definitions: SimulationDefinitions,
): asserts value is MusicVideoEpisode {
  if (!value || typeof value !== 'object') fail('missing record');
  const ep = value as MusicVideoEpisode;
  const expected = replay(ep, definitions);
  assertLiveCast(contestants, expected);
}

function assertLiveCast(contestants: readonly Contestant[], expected: SimulationState): void {
  if (contestants.length !== 50 || !uniqueIds(contestants.map((entry) => entry.id)))
    fail('full live fifty-person cast');
  const live = new Map(contestants.map((entry) => [entry.id, entry]));
  for (const entry of expected.contestants) {
    same(nativeEvidence(live.get(entry.id)), nativeEvidence(entry), `live contestant ${entry.id}`);
    const normalizeHistory = (person: Contestant) =>
      person.changeLog.map((log) =>
        log.episode === 9
          ? {
              ...log,
              phaseId: log.phaseId?.replace(/^.*:music-video:complete$/, 'music-video:complete'),
            }
          : log,
      );
    const actual = live.get(entry.id);
    if (!actual) fail(`missing live contestant ${entry.id}`);
    same(normalizeHistory(actual), normalizeHistory(entry), `preserved history ${entry.id}`);
  }
  same(
    [...contestants].map((entry) => entry.rank).sort((a, b) => a - b),
    Array.from({ length: 50 }, (_, index) => index + 1),
    'all fifty final placements',
  );
}

export function validateMusicVideo(state: SimulationState): void {
  const runtime = state.runtime;
  if (!runtime?.musicVideo) {
    validateMusicVideoPreparation(state);
    return;
  }
  if (
    runtime.version !== 3 ||
    (runtime.specialties
      ? runtime.episode !== 10 || runtime.musicVideo.phase !== 'complete'
      : runtime.episode !== 9 ||
        runtime.phase !== (runtime.musicVideo.phase === 'complete' ? 'episode-complete' : 'music-video'))
  )
    fail('runtime phase');
  const ep = runtime.musicVideo;
  const expected = replay(ep, runtime.definitions);
  const next = runtime.specialties;
  assertLiveCast(next?.startingContestants ?? state.contestants, expected);
  same(
    runtime.preparations?.[10]?.randomAudit?.startState ?? runtime.randomState,
    expected.runtime!.randomState,
    'seeded episode boundary',
  );
  same(next?.startingShow ?? runtime.show, expected.runtime!.show, 'audience and fan transfer boundary');
  same(
    next?.startingRevealedSecrets ?? runtime.revealedSecrets,
    expected.runtime!.revealedSecrets,
    'once-only revealed cards',
  );
  same(
    next?.startingDeferredConsequences ?? runtime.deferredConsequences,
    expected.runtime!.deferredConsequences,
    'once-only deferred consequences',
  );
  same(runtime.preparations![9], expected.runtime!.preparations![9], 'opening played once');
  if (!runtime.preparations?.[10]) same(runtime.openingCast, ep.startingOpeningCast, 'locked opening cast');
  same(ep.randomStartState, runtime.preparations![9]!.randomAudit!.endState, 'preparation RNG handoff');
  validateMusicVideoPreparation(state);
  validateSpecialtiesPreparation(state);
}
