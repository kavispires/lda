import type { FinaleAction } from '../types/finale-episode';
import type { SimulationState } from '../types/simulation';
import { validateFinaleCatalog } from '../utilities/finale-songs';
import { freezeSimulationSnapshot } from '../utilities/simulation-definitions';
import { awardNewActivity } from './activity-awards';
import { applyPreparation, initializePreparation, validateFinalePreparation } from './episode-preparation';
import {
  applyFinaleAction,
  captureFinaleStart,
  initializeFinale,
  publishFinaleHistory,
} from './finale-runtime';
import { validateFinale } from './finale-validation';
import { createSeededRandom } from './random';

export { assertFinaleEpisode, validateFinale } from './finale-validation';

const sameAction = (first: FinaleAction, second: FinaleAction) =>
  JSON.stringify(first) === JSON.stringify(second);
function finalize(state: SimulationState, random: ReturnType<typeof createSeededRandom>): SimulationState {
  state.runtime!.randomState = random.getState();
  validateFinalePreparation(state);
  freezeSimulationSnapshot(state.runtime!.initialContestants);
  freezeSimulationSnapshot(state.runtime!.sourceContestants);
  freezeSimulationSnapshot(state.runtime!.definitions);
  if (state.runtime!.finale) freezeSimulationSnapshot(state.runtime!.finale.startingContestants);
  state.persistenceError = null;
  return state;
}
export function transitionFinale(
  current: SimulationState,
  action: FinaleAction,
  expectedRevision: number,
): SimulationState {
  const runtime = current.runtime;
  if (runtime?.version !== 3 || current.status !== 'ready' || runtime.specialties?.phase !== 'complete')
    throw new Error('Complete Specialties before starting the Finale.');
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    throw new Error('A valid Finale revision is required.');
  const old = runtime.finale;
  const prep = runtime.preparations?.[11];
  if (!old && !prep) {
    if (action.type !== 'start' || expectedRevision !== 0)
      throw new Error('Start Episode 11 preparation first.');
    const next = structuredClone(current);
    const random = createSeededRandom(runtime.randomState);
    initializePreparation(next, 11, random.next);
    return finalize(next, random);
  }
  if (
    (old?.lastAction.revision === expectedRevision && sameAction(old.lastAction.action, action)) ||
    (prep?.lastAction?.revision === expectedRevision && sameAction(prep.lastAction.action, action)) ||
    (!old && action.type === 'start' && expectedRevision === 0 && prep?.revision === 0)
  )
    return current;
  if (!old) {
    if (expectedRevision !== prep!.revision) throw new Error('This Finale preparation action is stale.');
    if (!['mood', 'opening-cast', 'randomize-mood'].includes(action.type))
      throw new Error('Confirm the opening mood and replacements first.');
    validateFinalePreparation(current);
    const next = structuredClone(current);
    const random = createSeededRandom(runtime.randomState);
    const before = structuredClone(next.contestants);
    applyPreparation(
      next,
      action as Extract<FinaleAction, { type: 'mood' | 'opening-cast' | 'randomize-mood' }>,
      random.next,
    );
    const nextPrep = next.runtime!.preparations![11]!;
    nextPrep.revision++;
    nextPrep.lastAction = {
      revision: expectedRevision,
      action: structuredClone(action) as NonNullable<typeof nextPrep.lastAction>['action'],
    };
    if (nextPrep.mood && !nextPrep.requiredSelections) {
      validateFinaleCatalog(next.runtime!.definitions.finaleCatalog);
      initializeFinale(next, random.getState());
      captureFinaleStart(next, before);
    }
    const result = awardNewActivity(current, finalize(next, random));
    validateFinale(result);
    return result;
  }
  if (expectedRevision !== old.revision) throw new Error('This Finale action is stale; reload the episode.');
  if (old.phase === 'complete') throw new Error('The season is complete.');
  validateFinale(current);
  const next = structuredClone(current);
  const random = createSeededRandom(runtime.randomState);
  let drawCount = 0;
  applyFinaleAction(next, action, () => {
    const value = random.next();
    drawCount++;
    return value;
  });
  next.runtime!.finale!.steps.push({
    revision: expectedRevision,
    action: structuredClone(action),
    drawCount,
    endState: random.getState(),
  });
  const result = awardNewActivity(current, finalize(next, random));
  publishFinaleHistory(result);
  validateFinale(result);
  return result;
}
