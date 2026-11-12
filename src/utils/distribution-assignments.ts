import type { Dictionary, Distribution, Song } from '@types';
import { ALL_ID, NONE_ID } from './constants';
import { getPartDuration } from './song/part-getters';

export const ASSIGNMENT_CONFLICT_MESSAGE = 'NONE cannot be assigned together with ALL.';

export function isRecordedAssignment(ids: string[]): boolean {
  return ids.includes(NONE_ID) && ids.some((id) => id !== NONE_ID && id !== ALL_ID);
}

export function lyricAssigneeIds(ids: string[]): string[] {
  return isRecordedAssignment(ids) ? ids.filter((id) => id !== NONE_ID) : ids;
}

export function liveAssigneeIds(ids: string[]): string[] {
  return ids.includes(NONE_ID) ? [] : ids;
}

export function hasAssignmentConflict(mapping: Distribution['mapping']): boolean {
  return Object.values(mapping).some((ids) => ids.includes(NONE_ID) && ids.includes(ALL_ID));
}

export function updatePartAssignments(
  mapping: Distribution['mapping'],
  partIds: string[],
  assignee: string,
  mode: 'toggle' | 'add',
): { ok: true; mapping: Distribution['mapping'] } | { ok: false; message: string } {
  const next = { ...mapping };
  for (const id of partIds) {
    const current = next[id] ?? [];
    next[id] =
      mode === 'toggle' && current.includes(assignee)
        ? current.filter((value) => value !== assignee)
        : [...new Set([...current, assignee])];
    if (next[id].includes(NONE_ID) && next[id].includes(ALL_ID)) {
      return { ok: false, message: ASSIGNMENT_CONFLICT_MESSAGE };
    }
  }
  return { ok: true, mapping: next };
}

export type PartAssignmentUpdate = { partIds: string[]; assignee: string };

export function addAssignmentBatch(
  mapping: Distribution['mapping'],
  updates: PartAssignmentUpdate[],
): ReturnType<typeof updatePartAssignments> {
  let next = mapping;
  for (const { partIds, assignee } of updates) {
    const result = updatePartAssignments(next, partIds, assignee, 'add');
    if (!result.ok) return result;
    next = result.mapping;
  }
  return { ok: true, mapping: next };
}

export function buildDistributionSummary(
  song: Song,
  mapping: Distribution['mapping'],
  assignees: Distribution['assignees'],
) {
  const summary: Dictionary<number> = Object.fromEntries(Object.keys(assignees).map((id) => [id, 0]));
  for (const [partId, ids] of Object.entries(mapping)) {
    if (isRecordedAssignment(ids)) continue;
    const duration = getPartDuration(partId, song);
    for (const id of ids) {
      if (id !== ALL_ID && id !== NONE_ID) summary[id] = (summary[id] ?? 0) + duration;
    }
  }
  return { summary, maxAssigneeDuration: Math.max(0, ...Object.values(summary)) };
}
