import type { SimulationState } from '../types/simulation';
import { createEpisodeRundown } from '../utilities/episode-rundown';
import { CopyMarkdownButton } from './CopyMarkdownButton';

export function CopyEpisodeRundown({
  state,
  episode,
}: {
  state: SimulationState;
  episode: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
}) {
  const record =
    episode === 1
      ? state.runtime?.audition
      : episode === 2
        ? state.runtime?.battle
        : episode === 3
          ? state.runtime?.bootcamp
          : episode === 4
            ? state.runtime?.megaGroups
            : episode === 5
              ? state.runtime?.photoshoot
              : episode === 6
                ? state.runtime?.trackSpecials
                : episode === 7
                  ? state.runtime?.versatility
                  : episode === 8
                    ? state.runtime?.varietyShow
                    : episode === 9
                      ? state.runtime?.musicVideo
                      : state.runtime?.specialties;
  if (record?.phase !== 'complete') return null;
  return (
    <CopyMarkdownButton
      createText={() => createEpisodeRundown(state, episode)}
      label="Copy episode rundown"
      successMessage="Markdown rundown copied to clipboard."
    />
  );
}
