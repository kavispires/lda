import type { SimulationState } from '../types/simulation';
import { createShowRundown } from '../utilities/show-rundown';
import { CopyMarkdownButton } from './CopyMarkdownButton';

export function CopyShowSoFar({ state }: { state: SimulationState }) {
  if (!state.runtime) return null;
  return (
    <CopyMarkdownButton
      createText={() => createShowRundown(state)}
      label="Copy Show So Far"
      successMessage="Show so far copied as Markdown."
    />
  );
}
