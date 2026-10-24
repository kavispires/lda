import type { SimulationState } from '../types/simulation';
import { createEpisodeRundown } from '../utilities/episode-rundown';
import { CopyMarkdownButton } from './CopyMarkdownButton';

export function CopyEpisodeRundown({ state, episode }: { state: SimulationState; episode: 1 | 2 }) {
  const record = episode === 1 ? state.runtime?.audition : state.runtime?.battle;
  if (record?.phase !== 'complete') return null;
  return (
    <CopyMarkdownButton
      createText={() => createEpisodeRundown(state, episode)}
      label="Copy episode rundown"
      successMessage="Markdown rundown copied to clipboard."
    />
  );
}
