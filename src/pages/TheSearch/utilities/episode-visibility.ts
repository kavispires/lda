import type { BattlePhase } from '../types/battle-episode';
import type { ChangeValue } from '../types/common';
import type { Contestant } from '../types/contestant';
import type { SeasonRuntime } from '../types/simulation';

export function isSeasonRankingPath(path: string): boolean {
  return (
    /(^|\.)(rank|currentRank|cumulativeRank|rankHistory|currentRankHistory)(\.|$)/i.test(path) ||
    /(^|\.)aggregations\.score(\.|$)/.test(path)
  );
}

export function isSeasonRankingVisible(runtime: { battle?: { phase: BattlePhase } | null } | null): boolean {
  return !!runtime?.battle && runtime.battle.phase !== 'dorms';
}

/** A display-only copy. The persisted contestant remains the simulation's source of truth. */
export function projectEpisodeContestant(contestant: Contestant, runtime: SeasonRuntime): Contestant {
  const revealed = new Set(
    runtime.revealedSecrets
      .filter((entry) => entry.contestantId === contestant.id)
      .map((entry) => entry.cardId),
  );
  const privateCards = Object.entries(runtime.definitions.cards.secret).filter(([id]) => !revealed.has(id));
  const tokens = privateCards
    .flatMap(([id, card]) => [id, card.name, card.description])
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const scrubText = (text: string): string => {
    let result = text;
    for (const token of tokens) result = result.split(token).join('');
    return result.replace(/\bSECRET_[A-Z0-9_]+\b/g, (id) => (revealed.has(id) ? id : ''));
  };
  const hiddenEvent = (event: string) => scrubText(event) !== event;
  const hideRanking = !isSeasonRankingVisible(runtime);
  const scrub = (value: ChangeValue, path = ''): ChangeValue => {
    if (typeof value === 'string') return scrubText(value);
    if (Array.isArray(value))
      return value
        .filter((child) => typeof child !== 'string' || !hiddenEvent(child))
        .map((child) => scrub(child, path))
        .filter((child) => child === null || typeof child !== 'object' || Object.keys(child).length > 0);
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .filter(
            ([key, child]) =>
              !hiddenEvent(key) &&
              (typeof child !== 'string' || !hiddenEvent(child)) &&
              (!hideRanking || !isSeasonRankingPath(`${path}.${key}`)),
          )
          .map(([key, child]) => [scrubText(key), scrub(child, `${path}.${key}`)]),
      );
    }
    return value;
  };
  const result = structuredClone(contestant);
  result.attributes = result.attributes.filter((id) => !hiddenEvent(id));
  result.events = result.events.filter((event) => !hiddenEvent(event));
  if (hideRanking) {
    result.rank = 0;
    result.aggregations.score = 0;
  }
  result.changeLog = result.changeLog.map((entry) => ({
    ...entry,
    rank: hideRanking ? 0 : entry.rank,
    score: hideRanking && entry.episode === 0 ? 0 : entry.score,
    summary: scrubText(entry.summary),
    events: entry.events.filter((event) => !hiddenEvent(event)),
    change: Object.fromEntries(
      Object.entries(entry.change)
        .filter(([path]) => !hiddenEvent(path) && (!hideRanking || !isSeasonRankingPath(path)))
        .map(([path, value]) => [scrubText(path), scrub(value, path)]),
    ),
    changes: entry.changes
      ?.filter(
        ({ path, cause }) =>
          !hiddenEvent(path) && !hiddenEvent(cause) && (!hideRanking || !isSeasonRankingPath(path)),
      )
      .map((change) => ({
        ...change,
        path: scrubText(change.path),
        cause: scrubText(change.cause),
        ...(change.before === undefined ? {} : { before: scrub(change.before, change.path) }),
        ...(change.after === undefined ? {} : { after: scrub(change.after, change.path) }),
      })),
  }));
  return result;
}
