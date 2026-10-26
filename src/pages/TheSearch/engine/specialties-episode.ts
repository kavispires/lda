import type { SimulationState } from '../types/simulation';
import type { SpecialtiesAction } from '../types/specialties-episode';
import { freezeSimulationSnapshot } from '../utilities/simulation-definitions';
import { validateSpecialtiesCatalog } from '../utilities/specialties-songs';
import { awardNewActivity } from './activity-awards';
import {
  applyPreparation,
  initializePreparation,
  validateSpecialtiesPreparation,
} from './episode-preparation';
import { createSeededRandom } from './random';
import {
  applySpecialtiesAction,
  captureSpecialtiesStart,
  initializeSpecialties,
} from './specialties-runtime';
import { validateSpecialties } from './specialties-validation';

export { assertSpecialtiesEpisode, validateSpecialties } from './specialties-validation';

const sameAction = (first: SpecialtiesAction, second: SpecialtiesAction) =>
  JSON.stringify(first) === JSON.stringify(second);
function finalize(state: SimulationState, random: ReturnType<typeof createSeededRandom>): SimulationState {
  state.runtime!.randomState = random.getState();
  validateSpecialtiesPreparation(state);
  freezeSimulationSnapshot(state.runtime!.initialContestants);
  freezeSimulationSnapshot(state.runtime!.sourceContestants);
  freezeSimulationSnapshot(state.runtime!.definitions);
  if (state.runtime!.specialties) freezeSimulationSnapshot(state.runtime!.specialties.startingContestants);
  state.persistenceError = null;
  return state;
}
export function transitionSpecialties(
  current: SimulationState,
  action: SpecialtiesAction,
  expectedRevision: number,
): SimulationState {
  const runtime = current.runtime;
  if (runtime?.version !== 3 || current.status !== 'ready' || runtime.musicVideo?.phase !== 'complete')
    throw new Error('Complete Music Videos before starting Specialties.');
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    throw new Error('A valid Specialties revision is required.');
  const old = runtime.specialties;
  const prep = runtime.preparations?.[10];
  if (!old && !prep) {
    if (action.type !== 'start' || expectedRevision !== 0)
      throw new Error('Start Episode 10 preparation first.');
    const next = structuredClone(current);
    const random = createSeededRandom(runtime.randomState);
    initializePreparation(next, 10, random.next);
    return finalize(next, random);
  }
  if (
    (old?.lastAction.revision === expectedRevision && sameAction(old.lastAction.action, action)) ||
    (prep?.lastAction?.revision === expectedRevision && sameAction(prep.lastAction.action, action)) ||
    (!old && action.type === 'start' && expectedRevision === 0 && prep?.revision === 0)
  )
    return current;
  if (!old) {
    if (expectedRevision !== prep!.revision) throw new Error('This Specialties preparation action is stale.');
    if (!['mood', 'opening-cast', 'randomize-mood'].includes(action.type))
      throw new Error('Confirm the opening mood and replacements first.');
    validateSpecialtiesPreparation(current);
    const next = structuredClone(current);
    const random = createSeededRandom(runtime.randomState);
    const before = structuredClone(next.contestants);
    applyPreparation(
      next,
      action as Extract<SpecialtiesAction, { type: 'mood' | 'opening-cast' | 'randomize-mood' }>,
      random.next,
    );
    const nextPrep = next.runtime!.preparations![10]!;
    nextPrep.revision++;
    nextPrep.lastAction = {
      revision: expectedRevision,
      action: structuredClone(action) as NonNullable<typeof nextPrep.lastAction>['action'],
    };
    if (nextPrep.mood && !nextPrep.requiredSelections) {
      validateSpecialtiesCatalog(next.runtime!.definitions.specialtiesCatalog);
      initializeSpecialties(next, random.getState());
      captureSpecialtiesStart(next, before);
    }
    const result = awardNewActivity(current, finalize(next, random));
    validateSpecialties(result);
    return result;
  }
  if (expectedRevision !== old.revision)
    throw new Error('This Specialties action is stale; reload the episode.');
  if (old.phase === 'complete') throw new Error('Specialties is complete.');
  validateSpecialties(current);
  const next = structuredClone(current);
  const random = createSeededRandom(runtime.randomState);
  let drawCount = 0;
  applySpecialtiesAction(next, action, () => {
    const value = random.next();
    drawCount++;
    return value;
  });
  next.runtime!.specialties!.steps.push({
    revision: expectedRevision,
    action: structuredClone(action),
    drawCount,
    endState: random.getState(),
  });
  const result = awardNewActivity(current, finalize(next, random));
  validateSpecialties(result);
  return result;
}
