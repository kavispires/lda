import type { SimulationState } from '../types/simulation';
import type { TrackSpecialsAction, TrackSpecialsPhase } from '../types/track-specials-episode';
import { completedBattlesForBootcamp } from './bootcamp-fixtures';
import { autoCompleteEpisode } from './episode-auto-complete';
import { transitionTrackSpecials } from './track-specials-episode';

let photoshoot: Promise<SimulationState> | undefined;
export async function completedPhotoshootForTracks(): Promise<SimulationState> {
  photoshoot ??= (async () => {
    let state = structuredClone(completedBattlesForBootcamp());
    for (const number of [3, 4, 5] as const) state = await autoCompleteEpisode(state, number);
    return state;
  })();
  return structuredClone(await photoshoot);
}
export function nextTrackAction(state: SimulationState): { action: TrackSpecialsAction; revision: number } {
  const ep = state.runtime!.trackSpecials;
  const prep = state.runtime!.preparations?.[6];
  if (ep)
    return {
      action:
        ep.phase === 'intervention'
          ? { type: 'conflict', choice: 'mediate' }
          : ep.phase === 'secret-choice'
            ? { type: 'secret', contestantId: ep.secretCandidates[0] }
            : { type: 'advance' },
      revision: ep.revision,
    };
  if (!prep) return { action: { type: 'start' }, revision: 0 };
  return {
    action: prep.mood
      ? { type: 'opening-cast', contestantIds: prep.shortlist.slice(0, prep.requiredSelections) }
      : {
          type: 'mood',
          choices: {
            vocalColor: prep.moodOptions.vocalColor[0],
            danceStyle: prep.moodOptions.danceStyle[0],
            rapStyle: prep.moodOptions.rapStyle[0],
            visualVibe: prep.moodOptions.visualVibe[0],
            leadershipStyle: prep.moodOptions.leadershipStyle[0],
            genreAffinity: prep.moodOptions.genreAffinity[0],
          },
        },
    revision: prep.revision,
  };
}
export function advanceTracksTo(initial: SimulationState, phase: TrackSpecialsPhase): SimulationState {
  let state = initial;
  for (let step = 0; step < 160 && state.runtime!.trackSpecials?.phase !== phase; step++) {
    const { action, revision } = nextTrackAction(state);
    state = transitionTrackSpecials(state, action, revision);
  }
  if (state.runtime!.trackSpecials?.phase !== phase)
    throw new Error(`Could not reach Track Specials ${phase}.`);
  return state;
}
