import type { Contestant } from '../types/contestant';
import type { SeasonRuntime, SimulationDefinitions } from '../types/simulation';
import { processSimulationContestants } from '../utilities/card-assignment';
import { freezeSimulationSnapshot, getSimulationDefinitions } from '../utilities/simulation-definitions';
import { selectDiverseContestants } from '../utilities/simulation-helpers';
import { selectAuditionPool } from './audition-live';
import { validateSecretConsequences } from './audition-secrets';
import { createSeededRandom } from './random';

export function createSeasonSetup(
  sourceContestants: Record<string, Contestant>,
  options: {
    seed: number;
    runId: string;
    now: number;
    useBias?: boolean;
    definitions?: SimulationDefinitions;
    formatVersion?: 1 | 2 | 3;
  },
): { contestants: Contestant[]; runtime: SeasonRuntime; createdAt: number } {
  if (!options.runId.trim() || !Number.isFinite(options.now)) {
    throw new Error('Season setup requires a run ID and creation timestamp.');
  }
  const random = createSeededRandom(options.seed);
  const source = freezeSimulationSnapshot(structuredClone(sourceContestants));
  for (const [id, contestant] of Object.entries(source)) {
    if (contestant.id !== id) throw new Error(`Source contestant "${id}" has a mismatched ID.`);
  }
  const definitions = freezeSimulationSnapshot(
    structuredClone(options.definitions ?? getSimulationDefinitions()),
  );
  validateSecretConsequences(definitions.cards.secret);
  const auditionPoolIds = selectAuditionPool(definitions.auditionSongs, random.next).map((song) => song.id);
  const useBias = options.useBias ?? false;
  const selectedIds = selectDiverseContestants(source, useBias, random.next);
  const contestants = processSimulationContestants(selectedIds, source, {
    random: random.next,
    definitions,
    now: options.now,
  });
  return {
    contestants,
    runtime: {
      version: options.formatVersion ?? 3,
      runId: options.runId,
      seed: options.seed,
      randomState: random.getState(),
      episode: 0,
      phase: 'setup-complete',
      progression: { version: 1, baseline: [], awards: {} },
      setup: { useBias, selectedIds, auditionPoolIds },
      sourceContestants: source,
      initialContestants: freezeSimulationSnapshot(structuredClone(contestants)),
      definitions,
      audition: null,
      show: { audience: 100000, satisfaction: 50, general: 100000, fans: {}, pendingAttrition: 0 },
      revealedSecrets: [],
      deferredConsequences: [],
    },
    createdAt: options.now,
  };
}
