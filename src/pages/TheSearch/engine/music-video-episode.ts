import type { MusicVideoAction } from '../types/music-video-episode';
import type { SimulationState } from '../types/simulation';
import { validateMusicVideoCatalog } from '../utilities/music-video-catalog';
import { freezeSimulationSnapshot } from '../utilities/simulation-definitions';
import { awardNewActivity } from './activity-awards';
import {
  applyPreparation,
  initializePreparation,
  validateMusicVideoPreparation,
} from './episode-preparation';
import { applyMusicVideoAction, captureMusicVideoStart, initializeMusicVideo } from './music-video-runtime';
import { validateMusicVideo } from './music-video-validation';
import { createSeededRandom } from './random';

export { assertMusicVideoEpisode, validateMusicVideo } from './music-video-validation';

const sameAction = (first: MusicVideoAction, second: MusicVideoAction) =>
  JSON.stringify(first) === JSON.stringify(second);

function finalize(state: SimulationState, random: ReturnType<typeof createSeededRandom>): SimulationState {
  state.runtime!.randomState = random.getState();
  validateMusicVideoPreparation(state);
  freezeSimulationSnapshot(state.runtime!.initialContestants);
  freezeSimulationSnapshot(state.runtime!.sourceContestants);
  freezeSimulationSnapshot(state.runtime!.definitions);
  if (state.runtime!.musicVideo) freezeSimulationSnapshot(state.runtime!.musicVideo.startingContestants);
  state.persistenceError = null;
  return state;
}

export function transitionMusicVideo(
  current: SimulationState,
  action: MusicVideoAction,
  expectedRevision: number,
): SimulationState {
  const runtime = current.runtime;
  if (runtime?.version !== 3 || current.status !== 'ready' || runtime.varietyShow?.phase !== 'complete')
    throw new Error('Complete Variety Show before starting Music Videos.');
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    throw new Error('A valid Music Videos revision is required.');
  const old = runtime.musicVideo;
  const prep = runtime.preparations?.[9];
  if (!old && !prep) {
    if (action.type !== 'start' || expectedRevision !== 0)
      throw new Error('Start Episode 9 preparation first.');
    const next = structuredClone(current);
    const random = createSeededRandom(runtime.randomState);
    initializePreparation(next, 9, random.next);
    return finalize(next, random);
  }
  if (
    (old?.lastAction.revision === expectedRevision && sameAction(old.lastAction.action, action)) ||
    (prep?.lastAction?.revision === expectedRevision && sameAction(prep.lastAction.action, action)) ||
    (!old && action.type === 'start' && expectedRevision === 0 && prep?.revision === 0)
  )
    return current;
  if (!old) {
    if (expectedRevision !== prep!.revision)
      throw new Error('This Music Videos preparation action is stale.');
    if (!['mood', 'opening-cast', 'randomize-mood'].includes(action.type))
      throw new Error('Confirm the opening mood and replacements first.');
    validateMusicVideoPreparation(current);
    const next = structuredClone(current);
    const random = createSeededRandom(runtime.randomState);
    const before = structuredClone(next.contestants);
    applyPreparation(
      next,
      action as Extract<MusicVideoAction, { type: 'mood' | 'opening-cast' | 'randomize-mood' }>,
      random.next,
    );
    const nextPrep = next.runtime!.preparations![9]!;
    nextPrep.revision++;
    nextPrep.lastAction = {
      revision: expectedRevision,
      action: structuredClone(action) as NonNullable<typeof nextPrep.lastAction>['action'],
    };
    if (nextPrep.mood && !nextPrep.requiredSelections) {
      validateMusicVideoCatalog(next.runtime!.definitions.musicVideoCatalog);
      initializeMusicVideo(next, random.getState());
      captureMusicVideoStart(next, before);
    }
    const result = awardNewActivity(current, finalize(next, random));
    validateMusicVideo(result);
    return result;
  }
  if (expectedRevision !== old.revision)
    throw new Error('This Music Videos action is stale; reload the episode.');
  if (old.phase === 'complete') throw new Error('Music Videos is complete.');
  validateMusicVideo(current);
  const next = structuredClone(current);
  const random = createSeededRandom(runtime.randomState);
  let drawCount = 0;
  applyMusicVideoAction(next, action, () => {
    const value = random.next();
    drawCount++;
    return value;
  });
  next.runtime!.musicVideo!.steps.push({
    revision: expectedRevision,
    action: structuredClone(action),
    drawCount,
    endState: random.getState(),
  });
  const result = awardNewActivity(current, finalize(next, random));
  validateMusicVideo(result);
  return result;
}
