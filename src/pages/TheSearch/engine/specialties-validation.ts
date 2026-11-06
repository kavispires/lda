import type { Contestant } from '../types/contestant';
import type { MusicVideoEpisode } from '../types/music-video-episode';
import type { SimulationDefinitions, SimulationState } from '../types/simulation';
import type { SpecialtiesEpisode } from '../types/specialties-episode';
import { validateSpecialtiesCatalog } from '../utilities/specialties-songs';
import { recordContestantChanges } from './change-history';
import { validateFinalePreparation, validateSpecialtiesPreparation } from './episode-preparation';
import { createSeededRandom } from './random';
import {
  applySpecialtiesAction,
  captureSpecialtiesStart,
  initializeSpecialties,
} from './specialties-runtime';

function fail(detail: string): never {
  throw new Error(`Invalid Specialties episode: ${detail}.`);
}
const same = (actual: unknown, expected: unknown, detail: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(detail);
};
const uniqueIds = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === 'string') && new Set(value).size === value.length;
function nativeEvidence(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(nativeEvidence);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([field]) => field !== 'changeLog')
        .map(([field, entry]) => [field, nativeEvidence(entry)]),
    );
  return value;
}
export function specialtiesActivityTotals(
  ep: SpecialtiesEpisode,
): Record<string, { tv: number; experience: number }> {
  return Object.fromEntries(
    ep.participantIds.map((id) => {
      const solo = ep.performances.find((entry) => entry.contestantId === id);
      const tv =
        ep.scenes.reduce(
          (sum, scene) =>
            sum +
            Object.values(scene.tvMoments ?? {}).reduce((total, moment) => total + (moment[id] ?? 0), 0),
          0,
        ) + (solo ? (solo.observedScore >= 85 ? 6 : 3) : 0);
      const experience = ep.rehearsals.filter((entry) => entry.contestantId === id).length + (solo ? 3 : 0);
      return [id, { tv, experience }];
    }),
  );
}
function replayActivity(state: SimulationState, before: ReturnType<typeof specialtiesActivityTotals>) {
  const ep = state.runtime!.specialties!;
  const after = specialtiesActivityTotals(ep);
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
function replay(ep: SpecialtiesEpisode, definitions: SimulationDefinitions): SimulationState {
  validateSpecialtiesCatalog(definitions.specialtiesCatalog);
  if (
    ep.version !== 1 ||
    !Number.isSafeInteger(ep.revision) ||
    ep.revision < 0 ||
    ep.revision > 90 ||
    !uniqueIds(ep.participantIds) ||
    ep.participantIds.length !== 9 ||
    !Array.isArray(ep.startingContestants) ||
    ep.startingContestants.length !== 50 ||
    !uniqueIds(ep.startingContestants.map((entry) => entry?.id)) ||
    !Array.isArray(ep.steps) ||
    ep.steps.length !== ep.revision ||
    !ep.startingPreparation ||
    ep.startingPreparation.episode !== 10 ||
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
  if (startingActive.length !== 9 || startingActive.some((entry) => !ep.participantIds.includes(entry.id)))
    fail('starting active survivors');
  same(
    ep.startingContestants.map((entry) => entry.rank).sort((a, b) => a - b),
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
      runId: 'native-specialties-replay',
      seed: ep.randomStartState,
      randomState: ep.randomStartState,
      episode: 9,
      phase: 'episode-complete',
      setup: { useBias: false, selectedIds: ep.startingContestants.map((entry) => entry.id) },
      sourceContestants: {},
      initialContestants: [],
      definitions,
      audition: null,
      musicVideo: { phase: 'complete', survivorIds: [...ep.participantIds] } as MusicVideoEpisode,
      openingCast: [...ep.startingOpeningCast],
      preparations: { 10: structuredClone(ep.startingPreparation) },
      show: structuredClone(ep.startingShow),
      revealedSecrets: structuredClone(ep.startingRevealedSecrets),
      deferredConsequences: structuredClone(ep.startingDeferredConsequences),
    },
  };
  const before = structuredClone(state.contestants);
  initializeSpecialties(state, ep.randomStartState);
  captureSpecialtiesStart(state, before);
  for (const [index, step] of ep.steps.entries()) {
    if (
      !step ||
      step.revision !== index ||
      !step.action ||
      !['advance', 'secret'].includes(step.action.type) ||
      !Number.isSafeInteger(step.drawCount) ||
      step.drawCount < 0 ||
      state.runtime!.specialties!.phase === 'complete'
    )
      fail('action chronology');
    const beforeActivity = specialtiesActivityTotals(state.runtime!.specialties!);
    let drawCount = 0;
    applySpecialtiesAction(state, step.action, () => {
      const value = random.next();
      drawCount++;
      return value;
    });
    same(step.drawCount, drawCount, 'seeded action draw count');
    same(step.endState, random.getState(), 'seeded action end state');
    replayActivity(state, beforeActivity);
    state.runtime!.specialties!.steps.push({
      revision: index,
      action: structuredClone(step.action),
      drawCount,
      endState: random.getState(),
    });
  }
  state.runtime!.randomState = random.getState();
  same(
    ep,
    state.runtime!.specialties,
    'independently reconstructed footage, choices, checks, ballots, effects and outcomes',
  );
  return state;
}
function assertLiveCast(contestants: readonly Contestant[], expected: SimulationState) {
  if (contestants.length !== 50 || !uniqueIds(contestants.map((entry) => entry.id)))
    fail('full live fifty-person cast');
  const live = new Map(contestants.map((entry) => [entry.id, entry]));
  for (const entry of expected.contestants) {
    const actual = live.get(entry.id);
    if (!actual) fail(`missing contestant ${entry.id}`);
    same(nativeEvidence(actual), nativeEvidence(entry), `live contestant ${entry.id}`);
    const normalizeHistory = (person: Contestant) =>
      person.changeLog.map((log) =>
        log.episode === 10
          ? { ...log, phaseId: log.phaseId?.replace(/^.*:specialties:complete$/, 'specialties:complete') }
          : log,
      );
    same(normalizeHistory(actual), normalizeHistory(entry), `preserved history ${entry.id}`);
  }
  same(
    contestants.map((entry) => entry.rank).sort((a, b) => a - b),
    Array.from({ length: 50 }, (_, index) => index + 1),
    'fifty final placements',
  );
}
export function assertSpecialtiesEpisode(
  value: unknown,
  contestants: readonly Contestant[],
  definitions: SimulationDefinitions,
): asserts value is SpecialtiesEpisode {
  if (!value || typeof value !== 'object') fail('missing record');
  assertLiveCast(contestants, replay(value as SpecialtiesEpisode, definitions));
}
export function validateSpecialties(state: SimulationState): void {
  const runtime = state.runtime;
  if (!runtime?.specialties) {
    validateSpecialtiesPreparation(state);
    return;
  }
  const ep = runtime.specialties;
  if (
    runtime.version !== 3 ||
    (runtime.finale
      ? runtime.episode !== 11 || ep.phase !== 'complete'
      : runtime.episode !== 10 ||
        runtime.phase !== (ep.phase === 'complete' ? 'episode-complete' : 'specialties'))
  )
    fail('runtime phase');
  const expected = replay(ep, runtime.definitions);
  const next = runtime.finale;
  assertLiveCast(next?.startingContestants ?? state.contestants, expected);
  same(
    runtime.preparations?.[11]?.randomAudit?.startState ?? runtime.randomState,
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
  same(runtime.preparations![10], expected.runtime!.preparations![10], 'opening played once');
  if (!runtime.preparations?.[11]) same(runtime.openingCast, ep.startingOpeningCast, 'locked opening cast');
  same(ep.randomStartState, runtime.preparations![10]!.randomAudit!.endState, 'preparation RNG handoff');
  validateSpecialtiesPreparation(state);
  validateFinalePreparation(state);
}
