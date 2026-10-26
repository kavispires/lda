import type { AuditionAction, MoodChoices, MoodOptions } from '../types/audition-episode';
import type { BattleAction } from '../types/battle-episode';
import type { MegaGroupsAction } from '../types/mega-groups-episode';
import type { MusicVideoAction } from '../types/music-video-episode';
import type { EpisodePreparation, PreparationAction } from '../types/narrative';
import type { PhotoshootAction } from '../types/photoshoot-episode';
import { isNarrativeSeason, type SimulationState } from '../types/simulation';
import type { SpecialtiesAction } from '../types/specialties-episode';
import type { TrackSpecialsAction } from '../types/track-specials-episode';
import type { VarietyShowAction } from '../types/variety-show-episode';
import type { VersatilityAction } from '../types/versatility-episode';
import { transitionAudition } from './audition-episode';
import { transitionBattle } from './battle-episode';
import { transitionBootcamp } from './bootcamp-episode';
import { transitionMegaGroups } from './mega-groups-episode';
import { transitionMusicVideo } from './music-video-episode';
import { transitionNarrativeAudition, transitionNarrativeBattle } from './narrative-audition';
import { transitionBattleStory } from './narrative-battle';
import { transitionPhotoshoot } from './photoshoot-episode';
import { transitionSpecialties } from './specialties-episode';
import { transitionTrackSpecials } from './track-specials-episode';
import { transitionVarietyShow } from './variety-show-episode';
import { transitionVersatility } from './versatility-episode';

export type EpisodeNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export function isEpisodeComplete(state: SimulationState, episode: EpisodeNumber): boolean {
  const runtime = state.runtime;
  const record =
    episode === 1
      ? runtime?.audition
      : episode === 2
        ? runtime?.battle
        : episode === 3
          ? runtime?.bootcamp
          : episode === 4
            ? runtime?.megaGroups
            : episode === 5
              ? runtime?.photoshoot
              : episode === 6
                ? runtime?.trackSpecials
                : episode === 7
                  ? runtime?.versatility
                  : episode === 8
                    ? runtime?.varietyShow
                    : episode === 9
                      ? runtime?.musicVideo
                      : runtime?.specialties;
  return record?.phase === 'complete';
}

function first<T>(values: readonly T[], label: string): T {
  if (!values.length) throw new Error(`Cannot auto-complete: no ${label} available.`);
  return values[0];
}

function moodChoices(options: MoodOptions): MoodChoices {
  return {
    vocalColor: first(options.vocalColor, 'vocal color'),
    danceStyle: first(options.danceStyle, 'dance style'),
    rapStyle: first(options.rapStyle, 'rap style'),
    visualVibe: first(options.visualVibe, 'visual vibe'),
    leadershipStyle: first(options.leadershipStyle, 'leadership style'),
    genreAffinity: first(options.genreAffinity, 'genre affinity'),
  };
}

function preparationAction(
  preparation: EpisodePreparation | undefined,
): PreparationAction | { type: 'start' } {
  if (!preparation) return { type: 'start' };
  if (!preparation.mood)
    return { type: 'mood', choices: preparation.randomizedMood ?? moodChoices(preparation.moodOptions) };
  return {
    type: 'opening-cast',
    contestantIds: preparation.shortlist.slice(0, preparation.requiredSelections),
  };
}

function advanceAutomatically(state: SimulationState, episode: EpisodeNumber): SimulationState {
  const runtime = state.runtime;
  if (!runtime) throw new Error('Initialize a simulation before auto-completing an episode.');
  if (episode === 1) {
    const current = runtime.audition;
    const preparation = runtime.preparations?.[1];
    let action: AuditionAction = { type: 'advance' };
    if (!current) action = { type: 'start' };
    else if (current.phase === 'opening-cast') {
      if (!preparation) throw new Error('The opening cast preparation is missing.');
      action = {
        type: 'opening-cast',
        contestantIds: preparation.shortlist.slice(0, preparation.requiredSelections),
      };
    } else if (current.phase === 'mood')
      action = { type: 'mood', choices: preparation?.randomizedMood ?? moodChoices(current.moodOptions) };
    else if (current.phase === 'broadcast')
      action = { type: 'broadcast', cutId: first(current.cuts, 'broadcast cut').id };
    else if (current.phase === 'secret')
      action = { type: 'secret', contestantId: first(current.secretCandidates, 'secret candidate') };
    const transition = isNarrativeSeason(runtime) ? transitionNarrativeAudition : transitionAudition;
    return transition(state, action, current?.revision ?? 0);
  }
  if (episode === 2) {
    const current = runtime.battle;
    const preparation = runtime.preparations?.[2];
    let action: BattleAction = { type: 'advance' };
    if (!current) action = preparationAction(preparation);
    else if (current.story) {
      if (current.story.stage === 'intervention') action = { type: 'conflict', choice: 'mediate' };
      else if (current.story.stage === 'production-save')
        action = {
          type: 'production-save',
          contestantId: first(current.productionShortlist, 'production nominee'),
        };
      else if (current.story.stage === 'secret-choice')
        action = { type: 'secret', contestantId: first(current.secretCandidates, 'secret candidate') };
    } else if (current.phase === 'conflict') action = { type: 'conflict', choice: 'mediate' };
    else if (current.phase === 'broadcast')
      action = { type: 'broadcast', cutId: first(current.cuts, 'broadcast cut').id };
    else if (current.phase === 'saves')
      action = {
        type: 'production-save',
        contestantId: first(current.productionShortlist, 'production nominee'),
      };
    else if (current.phase === 'secret')
      action = { type: 'secret', contestantId: first(current.secretCandidates, 'secret candidate') };
    const transition =
      runtime.version === 3
        ? transitionBattleStory
        : runtime.version === 2
          ? transitionNarrativeBattle
          : transitionBattle;
    return transition(state, action, current?.revision ?? preparation?.revision ?? 0);
  }
  if (episode === 10) {
    const current = runtime.specialties;
    const preparation = runtime.preparations?.[10];
    let action: SpecialtiesAction = current ? { type: 'advance' } : preparationAction(preparation);
    if (current?.phase === 'secret-choice')
      action = { type: 'secret', contestantId: first(current.secretCandidates, 'secret candidate') };
    return transitionSpecialties(state, action, current?.revision ?? preparation?.revision ?? 0);
  }
  if (episode === 9) {
    const current = runtime.musicVideo;
    const preparation = runtime.preparations?.[9];
    let action: MusicVideoAction = current ? { type: 'advance' } : preparationAction(preparation);
    if (current?.phase === 'secret-choice')
      action = { type: 'secret', contestantId: first(current.secretCandidates, 'secret candidate') };
    return transitionMusicVideo(state, action, current?.revision ?? preparation?.revision ?? 0);
  }
  if (episode === 8) {
    const current = runtime.varietyShow;
    const preparation = runtime.preparations?.[8];
    let action: VarietyShowAction = current ? { type: 'advance' } : preparationAction(preparation);
    if (current?.phase === 'intervention') action = { type: 'conflict', choice: 'mediate' };
    if (current?.phase === 'secret-choice')
      action = { type: 'secret', contestantId: first(current.secretCandidates, 'secret candidate') };
    return transitionVarietyShow(state, action, current?.revision ?? preparation?.revision ?? 0);
  }
  if (episode === 7) {
    const current = runtime.versatility;
    const preparation = runtime.preparations?.[7];
    let action: VersatilityAction = current ? { type: 'advance' } : preparationAction(preparation);
    if (current?.phase === 'intervention') action = { type: 'conflict', choice: 'mediate' };
    if (current?.phase === 'secret-choice')
      action = { type: 'secret', contestantId: first(current.secretCandidates, 'secret candidate') };
    return transitionVersatility(state, action, current?.revision ?? preparation?.revision ?? 0);
  }
  if (episode === 6) {
    const current = runtime.trackSpecials;
    const preparation = runtime.preparations?.[6];
    let action: TrackSpecialsAction = current ? { type: 'advance' } : preparationAction(preparation);
    if (current?.phase === 'intervention') action = { type: 'conflict', choice: 'mediate' };
    if (current?.phase === 'secret-choice')
      action = { type: 'secret', contestantId: first(current.secretCandidates, 'secret candidate') };
    return transitionTrackSpecials(state, action, current?.revision ?? preparation?.revision ?? 0);
  }
  if (episode === 5) {
    const current = runtime.photoshoot;
    const preparation = runtime.preparations?.[5];
    let action: PhotoshootAction = current ? { type: 'advance' } : preparationAction(preparation);
    if (current?.phase === 'styling-choice') action = { type: 'styling', choice: 'intervene' };
    if (current?.phase === 'secret-choice')
      action = { type: 'secret', contestantId: first(current.secretCandidates, 'secret candidate') };
    return transitionPhotoshoot(state, action, current?.revision ?? preparation?.revision ?? 0);
  }
  if (episode === 4) {
    const current = runtime.megaGroups;
    const preparation = runtime.preparations?.[4];
    let action: MegaGroupsAction = current ? { type: 'advance' } : preparationAction(preparation);
    if (current?.phase === 'intervention') action = { type: 'conflict', choice: 'mediate' };
    if (current?.phase === 'secret-choice')
      action = { type: 'secret', contestantId: first(current.secretCandidates, 'secret candidate') };
    return transitionMegaGroups(state, action, current?.revision ?? preparation?.revision ?? 0);
  }
  const current = runtime.bootcamp;
  const preparation = runtime.preparations?.[3];
  return transitionBootcamp(
    state,
    current ? { type: 'advance' } : preparationAction(preparation),
    current?.revision ?? preparation?.revision ?? 0,
  );
}

export async function autoCompleteEpisode(
  initial: SimulationState,
  episode: EpisodeNumber,
): Promise<SimulationState> {
  if (![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(episode)) throw new Error('Unknown episode.');
  if (initial.status !== 'ready' || !initial.runtime)
    throw new Error('Initialize a simulation before auto-completing an episode.');
  let state = initial;
  for (let step = 0; step < 500; step++) {
    if (isEpisodeComplete(state, episode)) return state;
    // Let the loading indicator paint and keep the browser responsive between batches.
    if (step % 8 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const next = advanceAutomatically(state, episode);
    if (next === state) throw new Error('Auto-completion could not advance the episode.');
    state = next;
  }
  throw new Error('Auto-completion exceeded the episode step limit.');
}
