import { battleRelationship } from '../engine/battle-scoring';
import { type EpisodeNumber, isEpisodeComplete } from '../engine/episode-auto-complete';
import type { ChangeValue } from '../types/common';
import type { SimulationState } from '../types/simulation';
import { markdown } from './markdown';

export interface RelationshipShift {
  fromId: string;
  toId: string;
  before: number;
  after: number;
  delta: number;
}

export interface RelationshipGap {
  fromId: string;
  toId: string;
  fromValue: number;
  toValue: number;
  gap: number;
}

function affection(value: ChangeValue | undefined): number {
  if (value === undefined) return 50;
  const result = Array.isArray(value) ? value.at(-1) : value;
  if (typeof result !== 'number' || !Number.isFinite(result) || result < 0 || result > 100)
    throw new Error('Relationship updates require valid recorded affection.');
  return result;
}

export function episodeRelationshipUpdates(
  state: SimulationState,
  episode: EpisodeNumber,
): { changes: RelationshipShift[]; gaps: RelationshipGap[] } {
  const runtime = state.runtime;
  if (!runtime || !isEpisodeComplete(state, episode))
    throw new Error('Finish this episode before viewing its relationship updates.');
  const cast = runtime.initialContestants;
  const ids = new Set(cast.map(({ id }) => id));
  const records = [
    runtime.audition,
    runtime.battle,
    runtime.bootcamp,
    runtime.megaGroups,
    runtime.photoshoot,
    runtime.trackSpecials,
    runtime.versatility,
  ];
  const current = records[episode - 1];
  if (!current) throw new Error('The relationship updates are missing their episode.');
  // Rebuild recorded endpoints so archives never inherit later feelings.
  const values = new Map(
    cast.map((person) => [
      person.id,
      new Map(
        cast.filter(({ id }) => id !== person.id).map(({ id }) => [id, battleRelationship(person, id)]),
      ),
    ]),
  );
  let previous = values;
  for (let index = 0; index < episode; index++) {
    const record = records[index];
    if (record?.phase !== 'complete')
      throw new Error('The relationship updates require the previous completed episodes.');
    if (index === episode - 1)
      previous = new Map([...values].map(([id, relationships]) => [id, new Map(relationships)]));
    for (const [fromId, changes] of Object.entries(record.changes)) {
      for (const change of changes) {
        if (!change.path.startsWith('relationships.')) continue;
        let toId = change.path.slice('relationships.'.length);
        if (!ids.has(toId) && toId.endsWith('.affection')) toId = toId.slice(0, -'.affection'.length);
        const relationships = values.get(fromId);
        if (!relationships || !ids.has(toId))
          throw new Error('Relationship updates contain an unknown contestant.');
        if (fromId !== toId) relationships.set(toId, affection(change.after));
      }
    }
  }
  const changes: RelationshipShift[] = [];
  for (const [fromId, relationships] of values) {
    for (const [toId, after] of relationships) {
      const before = previous.get(fromId)?.get(toId);
      if (before === undefined) throw new Error('A previous relationship value is missing.');
      const delta = after - before;
      if (Math.abs(delta) > 5) changes.push({ fromId, toId, before, after, delta });
    }
  }
  const participants = 'order' in current ? current.order : current.participantIds;
  const gaps: RelationshipGap[] = [];
  for (const [index, firstId] of participants.entries()) {
    for (const secondId of participants.slice(index + 1)) {
      const firstValue = values.get(firstId)?.get(secondId);
      const secondValue = values.get(secondId)?.get(firstId);
      if (firstValue === undefined || secondValue === undefined)
        throw new Error('An episode participant is missing their relationship history.');
      const gap = Math.abs(firstValue - secondValue);
      if (gap >= 15)
        gaps.push(
          firstValue > secondValue
            ? { fromId: firstId, toId: secondId, fromValue: firstValue, toValue: secondValue, gap }
            : { fromId: secondId, toId: firstId, fromValue: secondValue, toValue: firstValue, gap },
        );
    }
  }
  const byIds = (a: { fromId: string; toId: string }, b: { fromId: string; toId: string }) =>
    a.fromId.localeCompare(b.fromId) || a.toId.localeCompare(b.toId);
  changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || byIds(a, b));
  gaps.sort((a, b) => b.gap - a.gap || byIds(a, b));
  return { changes, gaps };
}

export function createRelationshipUpdatesMarkdown(state: SimulationState, episode: EpisodeNumber): string {
  const updates = episodeRelationshipUpdates(state, episode);
  const cast = new Map(state.runtime?.initialContestants.map((person) => [person.id, person.name]));
  const name = (id: string) => {
    const result = cast.get(id);
    if (result === undefined) throw new Error('A relationship update has an unknown contestant.');
    return markdown(result);
  };
  const lines = [
    '## Relationships Updates',
    '',
    'Viewer-only observations, not part of the broadcast. Do not turn these notes into host dialogue or additional scenes.',
    '',
    episode === 1
      ? 'Net changes compared with season-entry relationships.'
      : 'Net changes compared with the previous episode ending.',
    '',
    '### Improved or worsened',
    '',
    ...updates.changes.map(
      ({ fromId, toId, delta, after }) =>
        `- ${name(fromId)} toward ${name(toId)}: ${delta > 0 ? '↑' : '↓'} ${Math.abs(delta)}; now ${after}/100.`,
    ),
    ...(!updates.changes.length ? ['No relationships changed by more than 5 points.'] : []),
    '',
    "### Uneven feelings in this episode's cast",
    '',
    ...updates.gaps.map(
      ({ fromId, toId, fromValue, toValue, gap }) =>
        `- ${name(fromId)} toward ${name(toId)}: ${fromValue}/100; ${name(toId)} toward ${name(fromId)}: ${toValue}/100. Gap: ${gap} points.`,
    ),
    ...(!updates.gaps.length ? ['No mutual-feeling gaps of 15 points or more.'] : []),
  ];
  return `${lines.join('\n')}\n`;
}
