import type { Contestant } from '../types/contestant';
import type { SeasonRuntime, SimulationState } from '../types/simulation';

export function seasonRanks(
  contestants: readonly Contestant[],
  runtime: SeasonRuntime,
): ReadonlyMap<string, number> {
  const byId = new Map(contestants.map((person) => [person.id, person]));
  if (byId.size !== contestants.length) throw new Error('Season ranking contains duplicate contestants.');
  const person = (id: string) => {
    const result = byId.get(id);
    if (!result) throw new Error(`Season ranking refers to unknown contestant "${id}".`);
    return result;
  };
  const auditionRank = (id: string) => {
    const contestant = person(id);
    const recorded = contestant.changeLog.find((entry) => entry.episode === 1)?.rank;
    return recorded && recorded > 0 ? recorded : contestant.rank;
  };
  const auditionDepartures = [...(runtime.audition?.eliminatedIds ?? [])].sort(
    (a, b) => auditionRank(a) - auditionRank(b),
  );
  const battleEliminated = new Set(runtime.battle?.eliminatedIds ?? []);
  const battleDepartures = runtime.battle?.finalRankedIds.filter((id) => battleEliminated.has(id)) ?? [];
  if (battleDepartures.length !== battleEliminated.size)
    throw new Error('Season ranking is missing locked battle placements.');
  const megaDepartures = [runtime.megaGroups?.withdrawnId, runtime.megaGroups?.eliminatedId].filter(
    (id): id is string => !!id && person(id).status === 'ELIMINATED',
  );
  const trackDepartures = runtime.trackSpecials?.eliminatedId ? [runtime.trackSpecials.eliminatedId] : [];
  const versatilityDepartures = [
    ...(runtime.versatility?.expelledId ? [runtime.versatility.expelledId] : []),
    ...(runtime.versatility?.eliminatedIds ?? []),
  ];
  const varietyDepartures = runtime.varietyShow?.eliminatedIds ?? [];
  const musicVideoDepartures = runtime.musicVideo?.eliminatedId ? [runtime.musicVideo.eliminatedId] : [];
  const departed = new Set([
    ...auditionDepartures,
    ...battleDepartures,
    ...megaDepartures,
    ...trackDepartures,
    ...versatilityDepartures,
    ...varietyDepartures,
    ...musicVideoDepartures,
  ]);
  const remaining = contestants
    .filter((entry) => !departed.has(entry.id))
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.id);
  const ordered = [
    ...remaining,
    ...musicVideoDepartures,
    ...varietyDepartures,
    ...versatilityDepartures,
    ...trackDepartures,
    ...megaDepartures,
    ...battleDepartures,
    ...auditionDepartures,
  ];
  if (ordered.length !== contestants.length || new Set(ordered).size !== ordered.length)
    throw new Error('Season ranking must contain every contestant exactly once.');
  return new Map(ordered.map((id, index) => [person(id).id, index + 1]));
}

export function applySeasonRanks(state: SimulationState): void {
  if (!state.runtime) return;
  const ranks = seasonRanks(state.contestants, state.runtime);
  for (const contestant of state.contestants) {
    const rank = ranks.get(contestant.id);
    if (rank === undefined) throw new Error('A contestant is missing their season rank.');
    contestant.rank = rank;
  }
}
