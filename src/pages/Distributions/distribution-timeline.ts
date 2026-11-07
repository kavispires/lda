import type { Distribution, Song } from '@types';
import { ALL_ID, NONE_ID } from '@utils/constants';

export type DistributionTimelineSegment = {
  startTime: number;
  endTime: number;
  startPercent: number;
  widthPercent: number;
  assigneeIds: string[];
  names: string[];
  colors: string[];
};

type TimelineResult = {
  segments: DistributionTimelineSegment[];
  error: string | null;
};

export function buildDistributionTimeline(
  song: Song,
  mapping: Distribution['mapping'],
  assignees: Distribution['assignees'],
): TimelineResult {
  const duration = song.endAt - song.startAt;
  if (!Number.isFinite(song.startAt) || !Number.isFinite(song.endAt) || song.startAt < 0 || duration <= 0) {
    return { segments: [], error: 'Timeline unavailable: the song needs a valid start and end time.' };
  }

  const intervals: {
    startTime: number;
    endTime: number;
    adlib: boolean;
    assigneeIds: string[];
  }[] = [];
  const boundaries = new Set([song.startAt, song.endAt]);

  for (const part of Object.values(song.content)) {
    if (part.type !== 'part') continue;
    if (!Number.isFinite(part.startTime) || !Number.isFinite(part.endTime) || part.endTime < part.startTime) {
      return { segments: [], error: 'Timeline unavailable: a song part has invalid timing.' };
    }

    const startTime = Math.max(song.startAt, part.startTime);
    const endTime = Math.min(song.endAt, part.endTime);
    if (endTime <= startTime) continue;

    const line = song.content[part.lineId];
    if (line?.type !== 'line') {
      return { segments: [], error: 'Timeline unavailable: a song part is missing its line.' };
    }

    const assigneeIds = (mapping[part.id] ?? []).filter((id) => id !== NONE_ID);
    if (assigneeIds.some((id) => id !== ALL_ID && !assignees[id])) {
      return { segments: [], error: 'Timeline unavailable: an assigned artist is missing.' };
    }

    intervals.push({ startTime, endTime, adlib: Boolean(line.adlib), assigneeIds });
    boundaries.add(startTime);
    boundaries.add(endTime);
  }

  const times = [...boundaries].sort((a, b) => a - b);
  const segments: DistributionTimelineSegment[] = [];
  const nameOf = (id: string) => (id === ALL_ID ? 'ALL' : assignees[id].name);
  for (let index = 0; index < times.length - 1; index++) {
    const startTime = times[index];
    const endTime = times[index + 1];
    const active = intervals.filter((part) => part.startTime <= startTime && part.endTime > startTime);
    const regular = active.filter((part) => !part.adlib);
    // Regular coverage wins even when it has no assigned singer.
    const preferred = regular.length > 0 ? regular : active;
    const assigneeIds = [...new Set(preferred.flatMap((part) => part.assigneeIds))].sort(
      (a, b) => nameOf(a).localeCompare(nameOf(b)) || a.localeCompare(b),
    );
    const previous = segments.at(-1);
    if (
      previous &&
      previous.assigneeIds.length === assigneeIds.length &&
      previous.assigneeIds.every((id, i) => id === assigneeIds[i])
    ) {
      previous.endTime = endTime;
      previous.widthPercent = ((endTime - previous.startTime) / duration) * 100;
      continue;
    }

    segments.push({
      startTime,
      endTime,
      startPercent: ((startTime - song.startAt) / duration) * 100,
      widthPercent: ((endTime - startTime) / duration) * 100,
      assigneeIds,
      names: assigneeIds.map(nameOf),
      colors: assigneeIds.map((id) => (id === ALL_ID ? '#000000' : assignees[id].color)),
    });
  }

  return { segments, error: null };
}
