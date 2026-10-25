import { isEpisodeComplete } from '../engine/episode-auto-complete';
import type { SimulationState } from '../types/simulation';
import { createSeasonCastProfiles } from './contestant-profile';
import { createEpisodeRundown } from './episode-rundown';
import { showRundown } from './rundown-presentation';

const introduction =
  '“The Search” is a 11-episode reality TV competition to choose the next iteration of the global pop sensation, the boyband “Squirrel Zone” which tragically ended their course years ago. Who is gonna be the power vocal, the dance sensation, the edgy rapper, the mesmerizing visual, and the X factor glue? Stay tuned!”';

export function createShowRundown(state: SimulationState): string {
  if (!state.runtime) throw new Error('Initialize the show before copying its story.');
  const episodes = ([1, 2, 3, 4, 5, 6, 7] as const)
    .filter((episode) => isEpisodeComplete(state, episode))
    .map((episode) => createEpisodeRundown(state, episode).trim());
  return `${[introduction, showRundown(createSeasonCastProfiles(state.runtime)).trim(), ...episodes].join(
    '\n\n---\n\n',
  )}\n`;
}
