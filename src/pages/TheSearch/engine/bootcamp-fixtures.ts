import type { BootcampAction, BootcampPhase } from '../types/bootcamp-episode';
import type { SimulationState } from '../types/simulation';
import { transitionBootcamp } from './bootcamp-episode';
import { advanceBattleStoryTo, narrativeBattleFixture } from './narrative-battle-fixtures';

let completed: SimulationState | undefined;
export function completedBattlesForBootcamp(): SimulationState {
  completed ??= advanceBattleStoryTo(narrativeBattleFixture(), 'complete');
  return completed;
}
export function nextBootcampAction(state: SimulationState): { action: BootcampAction; revision: number } {
  const ep = state.runtime?.bootcamp;
  const prep = state.runtime?.preparations?.[3];
  if (ep) return { action: { type: 'advance' }, revision: ep.revision };
  if (!prep) return { action: { type: 'start' }, revision: 0 };
  if (!prep.mood)
    return {
      action: {
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
  return {
    action: { type: 'opening-cast', contestantIds: prep.shortlist.slice(0, prep.requiredSelections) },
    revision: prep.revision,
  };
}
export function advanceBootcampTo(initial: SimulationState, phase: BootcampPhase): SimulationState {
  let state = initial;
  for (let count = 0; count < 160 && state.runtime?.bootcamp?.phase !== phase; count++) {
    const { action, revision } = nextBootcampAction(state);
    state = transitionBootcamp(state, action, revision);
  }
  if (state.runtime?.bootcamp?.phase !== phase) throw new Error(`Could not reach Boot Camp ${phase}.`);
  return state;
}
