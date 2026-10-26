import type { Contestant } from '../types/contestant';
import type { FinaleEpisode } from '../types/finale-episode';
import type { SimulationDefinitions, SimulationState } from '../types/simulation';
import type { SpecialtiesEpisode } from '../types/specialties-episode';
import type { VersatilityEpisode } from '../types/versatility-episode';
import { validateFinaleCatalog } from '../utilities/finale-songs';
import { recordContestantChanges } from './change-history';
import { validateFinalePreparation } from './episode-preparation';
import {
  applyFinaleAction,
  captureFinaleStart,
  initializeFinale,
  publishFinaleHistory,
} from './finale-runtime';
import { createSeededRandom } from './random';

function fail(detail: string): never {
  throw new Error(`Invalid Finale episode: ${detail}.`);
}
const same = (actual: unknown, expected: unknown, detail: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(detail);
};
const uniqueIds = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === 'string') && new Set(value).size === value.length;
export function finaleActivityTotals(ep: FinaleEpisode): Record<string, { tv: number; experience: number }> {
  return Object.fromEntries(
    ep.participantIds.map((id) => {
      const original = ep.originalPerformances.find((entry) => entry.contestantId === id);
      const theme = ep.themePerformances.find((entry) => entry.contestantId === id);
      const tv =
        ep.scenes.reduce(
          (sum, scene) =>
            sum +
            Object.values(scene.tvMoments ?? {}).reduce((total, moment) => total + (moment[id] ?? 0), 0),
          0,
        ) +
        (original ? (original.technical >= 85 ? 6 : 3) : 0) +
        (theme ? (theme.technical >= 85 ? 6 : 3) : 0);
      return [
        id,
        {
          tv,
          experience:
            ep.rehearsals.filter((entry) => entry.contestantId === id).length +
            (original ? 3 : 0) +
            (theme ? 3 : 0),
        },
      ];
    }),
  );
}
function replayActivity(state: SimulationState, before: ReturnType<typeof finaleActivityTotals>) {
  const ep = state.runtime!.finale!;
  const after = finaleActivityTotals(ep);
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
function replay(ep: FinaleEpisode, definitions: SimulationDefinitions): SimulationState {
  validateFinaleCatalog(definitions.finaleCatalog);
  if (
    ep.version !== 1 ||
    !Number.isSafeInteger(ep.revision) ||
    ep.revision < 0 ||
    ep.revision > 70 ||
    !uniqueIds(ep.participantIds) ||
    ep.participantIds.length !== 8 ||
    !Array.isArray(ep.startingContestants) ||
    ep.startingContestants.length !== 50 ||
    !uniqueIds(ep.startingContestants.map((entry) => entry?.id)) ||
    !Array.isArray(ep.steps) ||
    ep.steps.length !== ep.revision ||
    !ep.startingPreparation ||
    ep.startingPreparation.episode !== 11 ||
    ep.startingPreparation.openingPlayed ||
    !ep.startingPreparation.mood ||
    ep.startingPreparation.requiredSelections !== 0 ||
    ep.startingPreparation.randomAudit?.endState !== ep.randomStartState ||
    !uniqueIds(ep.startingOpeningCast) ||
    ep.startingOpeningCast.length !== 5 ||
    ep.startingOpeningCast.some((id) => !ep.participantIds.includes(id)) ||
    !Array.isArray(ep.startingRevealedSecrets) ||
    !Array.isArray(ep.startingDeferredConsequences) ||
    typeof ep.startingGuestId !== 'string' ||
    !definitions.doubtGirls?.some((guest) => guest.id === ep.startingGuestId) ||
    definitions.musicVideoCatalog?.theme.id !== definitions.finaleCatalog.theme.id
  )
    fail('version, fifty-person boundary, actual guest, preparation or action journal');
  const active = ep.startingContestants.filter((entry) => entry.status === 'ACTIVE');
  if (active.length !== 8 || active.some((entry) => !ep.participantIds.includes(entry.id)))
    fail('exactly eight starting survivors');
  same(
    ep.startingContestants.map((entry) => entry.rank).sort((a, b) => a - b),
    Array.from({ length: 50 }, (_, index) => index + 1),
    'starting fifty placements',
  );
  if (
    active.some((entry) => entry.rank < 1 || entry.rank > 8) ||
    ep.startingContestants.some(
      (entry) => !ep.participantIds.includes(entry.id) && entry.status !== 'ELIMINATED',
    )
  )
    fail('prior departure boundary');
  same(ep.startingPreparation.slots, ep.startingOpeningCast, 'locked opening');
  const random = createSeededRandom(ep.randomStartState);
  const state: SimulationState = {
    status: 'ready',
    persistenceError: null,
    createdAt: 1,
    contestants: structuredClone(ep.startingContestants),
    runtime: {
      version: 3,
      runId: 'native-finale-replay',
      seed: ep.randomStartState,
      randomState: ep.randomStartState,
      episode: 10,
      phase: 'episode-complete',
      setup: { useBias: false, selectedIds: ep.startingContestants.map((entry) => entry.id) },
      sourceContestants: {},
      initialContestants: [],
      definitions,
      audition: null,
      specialties: { phase: 'complete', survivorIds: [...ep.participantIds] } as SpecialtiesEpisode,
      versatility: { guestId: ep.startingGuestId } as VersatilityEpisode,
      openingCast: [...ep.startingOpeningCast],
      preparations: { 11: structuredClone(ep.startingPreparation) },
      show: structuredClone(ep.startingShow),
      revealedSecrets: structuredClone(ep.startingRevealedSecrets),
      deferredConsequences: structuredClone(ep.startingDeferredConsequences),
    },
  };
  const before = structuredClone(state.contestants);
  initializeFinale(state, ep.randomStartState);
  captureFinaleStart(state, before);
  for (const [index, step] of ep.steps.entries()) {
    if (
      !step ||
      step.revision !== index ||
      !step.action ||
      !['advance', 'executive'].includes(step.action.type) ||
      !Number.isSafeInteger(step.drawCount) ||
      step.drawCount < 0 ||
      state.runtime!.finale!.phase === 'complete'
    )
      fail('action chronology');
    const beforeActivity = finaleActivityTotals(state.runtime!.finale!);
    let drawCount = 0;
    applyFinaleAction(state, step.action, () => {
      const value = random.next();
      drawCount++;
      return value;
    });
    same(step.drawCount, drawCount, 'actual seeded draw count');
    same(step.endState, random.getState(), 'actual seeded end state');
    replayActivity(state, beforeActivity);
    publishFinaleHistory(state);
    state.runtime!.finale!.steps.push({
      revision: index,
      action: structuredClone(step.action),
      drawCount,
      endState: random.getState(),
    });
  }
  state.runtime!.randomState = random.getState();
  same(
    ep,
    state.runtime!.finale,
    'independently replayed draft, choice, live acts, seven judges, public vote, reveals and closing evidence',
  );
  return state;
}
function normalizedContestant(entry: Contestant) {
  return {
    ...entry,
    changeLog: entry.changeLog.map((log) =>
      log.episode === 11
        ? { ...log, phaseId: log.phaseId?.replace(/^.*:finale:complete$/, 'finale:complete') }
        : log,
    ),
  };
}
function assertLiveCast(contestants: readonly Contestant[], expected: SimulationState) {
  if (contestants.length !== 50 || !uniqueIds(contestants.map((entry) => entry.id)))
    fail('full live fifty-person cast');
  for (const entry of expected.contestants) {
    const actual = contestants.find((person) => person.id === entry.id);
    if (!actual) fail(`missing contestant ${entry.id}`);
    same(
      normalizedContestant(actual),
      normalizedContestant(entry),
      `live contestant and history ${entry.id}`,
    );
  }
  same(
    contestants.map((entry) => entry.rank).sort((a, b) => a - b),
    Array.from({ length: 50 }, (_, index) => index + 1),
    'fifty unique season placements',
  );
}
export function assertFinaleEpisode(
  value: unknown,
  contestants: readonly Contestant[],
  definitions: SimulationDefinitions,
): asserts value is FinaleEpisode {
  if (!value || typeof value !== 'object') fail('missing native record');
  assertLiveCast(contestants, replay(value as FinaleEpisode, definitions));
}
export function validateFinale(state: SimulationState): void {
  const runtime = state.runtime;
  if (!runtime?.finale) {
    validateFinalePreparation(state);
    return;
  }
  const ep = runtime.finale;
  if (
    runtime.version !== 3 ||
    runtime.episode !== 11 ||
    runtime.phase !== (ep.phase === 'complete' ? 'season-complete' : 'finale') ||
    state.status !== 'ready'
  )
    fail('native runtime phase');
  const expected = replay(ep, runtime.definitions);
  assertLiveCast(state.contestants, expected);
  same(runtime.randomState, expected.runtime!.randomState, 'live random state');
  same(runtime.show, expected.runtime!.show, 'conserved audience and fan transfers');
  same(runtime.revealedSecrets, ep.startingRevealedSecrets, 'unchanged revealed secrets');
  same(runtime.deferredConsequences, ep.startingDeferredConsequences, 'unchanged deferred consequences');
  same(runtime.versatility?.guestId, ep.startingGuestId, 'actual returning guest');
  same(runtime.preparations![11], expected.runtime!.preparations![11], 'once-only opening');
  same(runtime.openingCast, ep.startingOpeningCast, 'confirmed opening portraits');
  validateFinalePreparation(state);
}
