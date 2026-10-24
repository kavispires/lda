import type { BattlePhase, BattleStory } from '../types/battle-episode';
import type { ChangeValue } from '../types/common';
import type { Contestant } from '../types/contestant';
import type { SeasonRuntime } from '../types/simulation';

export function isSeasonRankingPath(path: string): boolean {
  return (
    /(^|\.)(rank|currentRank|cumulativeRank|rankHistory|currentRankHistory)(\.|$)/i.test(path) ||
    /(^|\.)aggregations\.score(\.|$)/.test(path)
  );
}

export function isSeasonRankingVisible(
  runtime: { battle?: { phase: BattlePhase; story?: Pick<BattleStory, 'rankRevealed'> } | null } | null,
): boolean {
  return (
    !!runtime?.battle &&
    (runtime.battle.story ? runtime.battle.story.rankRevealed : runtime.battle.phase !== 'dorms')
  );
}

function projectBattleReveals(contestant: Contestant, runtime: SeasonRuntime): Contestant {
  const result = structuredClone(contestant);
  const episode = runtime.battle;
  if (runtime.version !== 3 || !episode?.story) return result;
  if (!episode.participantIds.includes(contestant.id)) return result;
  const team = episode.teams.find((entry) => entry.memberIds.includes(contestant.id));
  const teamShown = (kind: string) =>
    !!team &&
    episode.scenes.some(
      (scene) => scene.kind === kind && scene.contestantIds.some((id) => team.memberIds.includes(id)),
    );
  const rehearsed = teamShown('practice');
  const performed = !!team && episode.story.creditedTeamIds.includes(team.id);
  const centered =
    performed ||
    (!!team &&
      episode.scenes.some(
        (scene) =>
          /\b(center|ballot)\b/i.test(scene.title) &&
          scene.contestantIds.some((id) => team.memberIds.includes(id)),
      )) ||
    (episode.story.stage === 'center' && episode.scenes.at(-1)?.contestantIds.includes(contestant.id));
  const changes = episode.changes[contestant.id] ?? [];
  // The opposing team's flashback can already be calculated. Undo only its hidden
  // rehearsal/performance changes, leaving public draft and dorm interactions intact.
  for (const change of [...changes].reverse()) {
    const rehearsalCapture =
      /^The Battles: (pairings|performance)$/.test(change.cause) &&
      (!change.path.startsWith('relationships.') ||
        !!team?.memberIds.includes(change.path.slice('relationships.'.length)));
    const hidden =
      (!rehearsed &&
        (rehearsalCapture ||
          /\b(rehearsal|practice|preparation|leadership|part assignment|center)\b/i.test(change.cause))) ||
      (!performed && change.cause !== 'The Battles: performance' && /\bperformance\b/i.test(change.cause));
    if (!hidden || change.before === undefined) continue;
    if (!/^(relationships\.|events$|condition$|missionRating$|grade$|aggregations\.)/.test(change.path))
      continue;
    const path = change.path.split('.');
    let target = result as unknown as Record<string, unknown>;
    for (const key of path.slice(0, -1)) {
      if (!target[key] || typeof target[key] !== 'object') break;
      target = target[key] as Record<string, unknown>;
    }
    const key = path.at(-1);
    if (key) target[key] = structuredClone(change.before);
  }
  const initial = runtime.initialContestants.find((entry) => entry.id === contestant.id);
  const audition = runtime.audition?.evaluations.find((entry) => entry.contestantId === contestant.id);
  const priorHistory = [...contestant.changeLog].reverse().find((entry) => entry.episode === 1);
  if (!performed) {
    const beforeGrade = changes.find((change) => change.path === 'grade')?.before;
    result.grade =
      audition?.grade ??
      (typeof beforeGrade === 'string'
        ? (beforeGrade as Contestant['grade'])
        : (initial?.grade ?? result.grade));
    result.missionRating = priorHistory?.missionRating ?? initial?.missionRating ?? result.missionRating;
  }
  if (!rehearsed) {
    result.aggregations.practice = 0;
    if (team?.captainId === contestant.id && team.practice.length > 0) {
      result.aggregations.leader = Math.max(0, contestant.aggregations.leader - 1);
    }
  } else if (team) {
    const practice = team.practice.at(-1)?.contestants.find((entry) => entry.contestantId === contestant.id);
    if (practice) result.aggregations.practice = practice.practiceAfter;
  }
  if (!centered && team?.centerId === contestant.id) {
    result.aggregations.center = Math.max(0, contestant.aggregations.center - 1);
  }
  // Episode-end history is an atomic archive, not a preview of precomputed beats.
  if (!episode.story.rankRevealed) result.changeLog = result.changeLog.filter((entry) => entry.episode !== 2);
  return result;
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
  const scrub = (value: ChangeValue, path = '', concealRanking = hideRanking): ChangeValue => {
    if (typeof value === 'string') return scrubText(value);
    if (Array.isArray(value))
      return value
        .filter((child) => typeof child !== 'string' || !hiddenEvent(child))
        .map((child) => scrub(child, path, concealRanking))
        .filter((child) => child === null || typeof child !== 'object' || Object.keys(child).length > 0);
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .filter(
            ([key, child]) =>
              !hiddenEvent(key) &&
              (typeof child !== 'string' || !hiddenEvent(child)) &&
              (!concealRanking || !isSeasonRankingPath(`${path}.${key}`)),
          )
          .map(([key, child]) => [scrubText(key), scrub(child, `${path}.${key}`, concealRanking)]),
      );
    }
    return value;
  };
  const result = projectBattleReveals(contestant, runtime);
  result.attributes = result.attributes.filter((id) => !hiddenEvent(id));
  result.events = result.events.filter((event) => !hiddenEvent(event));
  if (hideRanking) {
    result.rank = 0;
    result.aggregations.score = 0;
  } else if (runtime.version === 3 && runtime.battle && !runtime.battle.survivorIds.includes(result.id)) {
    result.rank = 0;
  }
  result.changeLog = result.changeLog.map((entry) => {
    const hideHistoricalRanking = hideRanking || runtime.version === 3;
    return {
      ...entry,
      rank:
        hideRanking || (runtime.version === 3 && (entry.episode < 2 || entry.status === 'ELIMINATED'))
          ? 0
          : entry.rank,
      score: hideHistoricalRanking && entry.episode === 0 ? 0 : entry.score,
      summary: scrubText(entry.summary),
      events: entry.events.filter((event) => !hiddenEvent(event)),
      change: Object.fromEntries(
        Object.entries(entry.change)
          .filter(([path]) => !hiddenEvent(path) && (!hideHistoricalRanking || !isSeasonRankingPath(path)))
          .map(([path, value]) => [scrubText(path), scrub(value, path, hideHistoricalRanking)]),
      ),
      changes: entry.changes
        ?.filter(
          ({ path, cause }) =>
            !hiddenEvent(path) &&
            !hiddenEvent(cause) &&
            (!hideHistoricalRanking || !isSeasonRankingPath(path)),
        )
        .map((change) => ({
          ...change,
          path: scrubText(change.path),
          cause: scrubText(change.cause),
          ...(change.before === undefined
            ? {}
            : { before: scrub(change.before, change.path, hideHistoricalRanking) }),
          ...(change.after === undefined
            ? {}
            : { after: scrub(change.after, change.path, hideHistoricalRanking) }),
        })),
    };
  });
  return result;
}
