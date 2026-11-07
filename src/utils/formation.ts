import type {
  Distribution,
  Formation,
  FormationPose,
  FormationSnapshot,
  FormationTemplate,
  Song,
  StagePosition,
} from '@types';
import { ALL_ID, NONE_ID } from './constants';

export const STAGE_WIDTH = 27;
export const STAGE_HEIGHT = 19;
const EPSILON = 1e-8;

export function dancerIds(distribution: Pick<Distribution, 'assignees'>) {
  return Object.keys(distribution.assignees)
    .filter((id) => id !== ALL_ID && id !== NONE_ID)
    .sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPosition(value: unknown): StagePosition {
  if (
    !isRecord(value) ||
    typeof value.x !== 'number' ||
    typeof value.y !== 'number' ||
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y)
  ) {
    throw new Error('Invalid dancer coordinates.');
  }
  return { x: value.x, y: value.y };
}

export function deserializeFormation(value: unknown, documentId: string): Formation {
  if (
    !isRecord(value) ||
    !Array.isArray(value.assigneesIds) ||
    !value.assigneesIds.every((id): id is string => typeof id === 'string' && id.length > 0) ||
    new Set(value.assigneesIds).size !== value.assigneesIds.length ||
    typeof value.distributionId !== 'string' ||
    typeof value.songId !== 'string' ||
    typeof value.groupId !== 'string' ||
    value.type !== 'formation' ||
    typeof value.createdAt !== 'number' ||
    !Number.isFinite(value.createdAt)
  ) {
    throw new Error('Invalid formation document.');
  }
  const ids = value.assigneesIds;
  let snapshots: FormationSnapshot[];
  if (value.version === 2) {
    if (typeof value.snapshots !== 'string') throw new Error('Missing formation snapshots.');
    const raw: unknown = JSON.parse(value.snapshots);
    if (!Array.isArray(raw)) throw new Error('Invalid formation snapshots.');
    snapshots = raw.map((entry: unknown) => {
      if (
        !isRecord(entry) ||
        typeof entry.id !== 'string' ||
        !entry.id ||
        typeof entry.timestamp !== 'number' ||
        !Number.isFinite(entry.timestamp) ||
        typeof entry.transition !== 'number' ||
        !Number.isFinite(entry.transition) ||
        !isRecord(entry.positions)
      )
        throw new Error('Invalid formation snapshot.');
      return {
        id: entry.id,
        timestamp: entry.timestamp,
        transition: entry.transition,
        positions: Object.fromEntries(
          Object.entries(entry.positions).map(([id, pos]) => [id, readPosition(pos)]),
        ),
      };
    });
  } else {
    if (value.version !== undefined || typeof value.timeline !== 'string') {
      throw new Error('Unsupported formation format.');
    }
    const timeline: unknown = JSON.parse(value.timeline);
    if (!isRecord(timeline)) throw new Error('Invalid legacy formation timeline.');
    snapshots = Object.entries(timeline)
      .map(([timestamp, positions]) => {
        if (
          !Number.isFinite(Number(timestamp)) ||
          !Array.isArray(positions) ||
          positions.length !== ids.length
        ) {
          throw new Error('Invalid legacy formation snapshot.');
        }
        return {
          id: `legacy-${timestamp}`,
          timestamp: Number(timestamp),
          transition: 0,
          positions: Object.fromEntries(
            ids.map((id, index) => {
              const encoded: unknown = positions[index];
              if (typeof encoded !== 'string') throw new Error('Invalid legacy dancer coordinates.');
              const parts = encoded.split('::');
              if (parts.length !== 2 || parts.some((part) => !part.trim()))
                throw new Error('Invalid legacy dancer coordinates.');
              return [id, readPosition({ x: Number(parts[0]), y: Number(parts[1]) })];
            }),
          ),
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);
    snapshots = snapshots.map((snapshot, index) => ({
      ...snapshot,
      transition: index === 0 ? 0 : Math.min(1000, snapshot.timestamp - snapshots[index - 1].timestamp),
    }));
  }
  if (
    !snapshots.length ||
    new Set(snapshots.map((s) => s.id)).size !== snapshots.length ||
    new Set(snapshots.map((s) => s.timestamp)).size !== snapshots.length
  ) {
    throw new Error('Formation must contain uniquely identified, uniquely timed snapshots.');
  }
  return {
    id: documentId,
    type: 'formation',
    version: 2,
    distributionId: value.distributionId,
    songId: value.songId,
    groupId: value.groupId,
    assigneesIds: [...ids],
    snapshots: snapshots.sort((a, b) => a.timestamp - b.timestamp),
    createdAt: value.createdAt,
    ...(typeof value.updatedAt === 'number' ? { updatedAt: value.updatedAt } : {}),
  };
}

export function poseErrors(positions: FormationPose): string[] {
  const errors: string[] = [];
  const entries = Object.entries(positions);
  for (const [index, [id, pos]] of entries.entries()) {
    if (
      !Number.isFinite(pos.x) ||
      !Number.isFinite(pos.y) ||
      pos.x < 0.5 ||
      pos.x > STAGE_WIDTH - 0.5 ||
      pos.y < 0.5 ||
      pos.y > STAGE_HEIGHT - 0.5
    ) {
      errors.push(`${id} must be entirely inside the stage.`);
    }
    for (const [otherId, other] of entries.slice(index + 1)) {
      if (Math.hypot(pos.x - other.x, pos.y - other.y) < 1 - EPSILON) {
        errors.push(`${id} and ${otherId} overlap.`);
      }
    }
  }
  return errors;
}

export function moveFormationDancers(
  positions: FormationPose,
  ids: string[],
  dx: number,
  dy: number,
): FormationPose {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || ids.some((id) => !positions[id])) {
    throw new Error('Invalid dancer move.');
  }
  const next = Object.fromEntries(
    Object.entries(positions).map(([id, pos]) => [
      id,
      ids.includes(id) ? { x: pos.x + dx, y: pos.y + dy } : { ...pos },
    ]),
  );
  for (const id of ids) {
    const pos = next[id];
    if (pos.x < 0.5 || pos.x > STAGE_WIDTH - 0.5 || pos.y < 0.5 || pos.y > STAGE_HEIGHT - 0.5) {
      throw new Error('Dancers must stay entirely inside the stage. Move reverted.');
    }
    if (
      Object.entries(next).some(
        ([otherId, other]) => otherId !== id && Math.hypot(pos.x - other.x, pos.y - other.y) < 1 - EPSILON,
      )
    ) {
      throw new Error('Dancers cannot overlap. Move reverted.');
    }
  }
  return next;
}

export function formationErrors(
  formation: Formation,
  song: Pick<Song, 'id' | 'startAt' | 'endAt'>,
  ids: string[],
) {
  const errors: string[] = [];
  if (!Number.isFinite(song.startAt) || !Number.isFinite(song.endAt) || song.startAt >= song.endAt) {
    return ['Song start/end bounds are invalid.'];
  }
  if (formation.songId !== song.id) errors.push('Formation belongs to another song.');
  if (ids.length === 0) errors.push('A formation needs at least one dancer.');
  if (
    ids.length !== formation.assigneesIds.length ||
    ids.some((id) => !formation.assigneesIds.includes(id))
  ) {
    errors.push('The distribution cast has changed. Review and save the formation.');
  }
  const snapshots = [...formation.snapshots].sort((a, b) => a.timestamp - b.timestamp);
  if (!snapshots.length || snapshots[0].timestamp !== song.startAt) {
    errors.push('The first pose must be anchored to song start.');
  }
  if (new Set(snapshots.map((s) => s.id)).size !== snapshots.length)
    errors.push('Snapshot IDs must be unique.');
  snapshots.forEach((snapshot, index) => {
    const label = formatFormationTime(snapshot.timestamp);
    if (
      !Number.isInteger(snapshot.timestamp) ||
      snapshot.timestamp < song.startAt ||
      snapshot.timestamp > song.endAt
    ) {
      errors.push(`${label}: timestamp must be inside the song.`);
    }
    const gap = index ? snapshot.timestamp - snapshots[index - 1].timestamp : 0;
    if (index && gap <= 0) errors.push(`${label}: duplicate snapshot time.`);
    if (!Number.isFinite(snapshot.transition) || snapshot.transition < 0 || snapshot.transition > gap) {
      errors.push(`${label}: incoming transition exceeds the available gap.`);
    }
    const positionIds = Object.keys(snapshot.positions);
    if (positionIds.length !== ids.length || ids.some((id) => !snapshot.positions[id])) {
      errors.push(`${label}: pose must contain the entire current cast, and no other dancers.`);
    }
    errors.push(...poseErrors(snapshot.positions).map((error) => `${label}: ${error}`));
  });
  return errors;
}

export function initialPose(ids: string[]): FormationPose {
  if (!ids.length || ids.length > STAGE_WIDTH * STAGE_HEIGHT)
    throw new Error('Stage capacity is 1-513 dancers.');
  const step = ids.length <= 117 ? 2 : 1;
  const columns = Math.min(ids.length, step === 2 ? 13 : 27);
  const rows = Math.ceil(ids.length / columns);
  return Object.fromEntries(
    ids.map((id, index) => {
      const row = Math.floor(index / columns);
      const rowLength = Math.min(columns, ids.length - row * columns);
      return [
        id,
        {
          x: STAGE_WIDTH / 2 + ((index % columns) - (rowLength - 1) / 2) * step,
          y: STAGE_HEIGHT / 2 + (row - (rows - 1) / 2) * step,
        },
      ];
    }),
  );
}

export function createFormation(distribution: Distribution, song: Song): Formation {
  const ids = dancerIds(distribution);
  return {
    id: '$draft',
    type: 'formation',
    version: 2,
    distributionId: distribution.id,
    songId: song.id,
    groupId: distribution.groupId,
    assigneesIds: ids,
    createdAt: Date.now(),
    snapshots: [
      { id: crypto.randomUUID(), timestamp: song.startAt, transition: 0, positions: initialPose(ids) },
    ],
  };
}

export function reconcileCast(formation: Formation, ids: string[]): Formation {
  const snapshots = formation.snapshots.map((snapshot) => {
    const positions = Object.fromEntries(
      Object.entries(snapshot.positions).filter(([id]) => ids.includes(id)),
    );
    for (const id of ids) {
      if (positions[id]) continue;
      let found: StagePosition | undefined;
      for (let y = 0.5; y < STAGE_HEIGHT && !found; y++) {
        for (let x = 0.5; x < STAGE_WIDTH; x++) {
          if (Object.values(positions).every((pos) => Math.hypot(pos.x - x, pos.y - y) >= 1 - EPSILON)) {
            found = { x, y };
            break;
          }
        }
      }
      if (!found)
        throw new Error(`No free position for ${id} at ${formatFormationTime(snapshot.timestamp)}.`);
      positions[id] = found;
    }
    return { ...snapshot, positions };
  });
  return { ...formation, assigneesIds: [...ids], snapshots };
}

export function resolveFormationPose(snapshots: FormationSnapshot[], timestamp: number): FormationPose {
  if (!snapshots.length) throw new Error('Formation has no snapshots.');
  const ordered = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
  let previous = ordered[0];
  for (const next of ordered.slice(1)) {
    if (timestamp >= next.timestamp) {
      previous = next;
      continue;
    }
    const start = next.timestamp - next.transition;
    if (next.transition === 0 || timestamp <= start) return structuredClone(previous.positions);
    const progress = (timestamp - start) / next.transition;
    return Object.fromEntries(
      Object.entries(previous.positions).map(([id, pos]) => {
        const target = next.positions[id];
        if (!target) throw new Error(`Missing dancer ${id} in destination snapshot.`);
        return [id, { x: pos.x + (target.x - pos.x) * progress, y: pos.y + (target.y - pos.y) * progress }];
      }),
    );
  }
  return structuredClone(previous.positions);
}

export function addFormationSnapshot(
  formation: Formation,
  timestamp: number,
  song: Pick<Song, 'startAt' | 'endAt'>,
) {
  if (!Number.isInteger(timestamp) || timestamp < song.startAt || timestamp > song.endAt) {
    throw new Error('Snapshot time must be inside the song.');
  }
  const existing = formation.snapshots.find((s) => s.timestamp === timestamp);
  if (existing) return { formation, selectedId: existing.id };
  const previous = [...formation.snapshots].reverse().find((s) => s.timestamp < timestamp);
  const snapshot = {
    id: crypto.randomUUID(),
    timestamp,
    transition: previous ? Math.min(1000, timestamp - previous.timestamp) : 0,
    positions: resolveFormationPose(formation.snapshots, timestamp),
  };
  const next = formation.snapshots.find((s) => s.timestamp > timestamp);
  if (next && next.transition > next.timestamp - timestamp) {
    throw new Error("Shorten the next snapshot's incoming transition before inserting here.");
  }
  if (poseErrors(snapshot.positions).length)
    throw new Error('Dancers overlap at this playhead. Seek to a clear arrangement before adding.');
  return {
    formation: {
      ...formation,
      snapshots: [...formation.snapshots, snapshot].sort((a, b) => a.timestamp - b.timestamp),
    },
    selectedId: snapshot.id,
  };
}

export function retimeSnapshot(
  formation: Formation,
  id: string,
  timestamp: number,
  song: Pick<Song, 'startAt' | 'endAt'>,
) {
  const selected = formation.snapshots.find((s) => s.id === id);
  if (!selected) throw new Error('Select a snapshot.');
  if (selected.timestamp === song.startAt && timestamp !== song.startAt)
    throw new Error('The first pose is anchored to song start.');
  if (!Number.isInteger(timestamp) || timestamp < song.startAt || timestamp > song.endAt)
    throw new Error('Snapshot time must be inside the song.');
  if (formation.snapshots.some((s) => s.id !== id && s.timestamp === timestamp))
    throw new Error('A snapshot already exists at that time.');
  const snapshots = formation.snapshots
    .map((s) => (s.id === id ? { ...s, timestamp } : s))
    .sort((a, b) => a.timestamp - b.timestamp);
  for (const [index, snapshot] of snapshots.entries()) {
    const gap = index ? snapshot.timestamp - snapshots[index - 1].timestamp : 0;
    if (snapshot.transition > gap)
      throw new Error('Shorten the affected incoming transitions before retiming.');
  }
  return { ...formation, snapshots };
}

export function deleteFormationSnapshot(formation: Formation, id: string, startAt: number): Formation {
  const snapshot = formation.snapshots.find((s) => s.id === id);
  if (!snapshot) throw new Error('Select a snapshot.');
  if (formation.snapshots.length === 1 || snapshot.timestamp === startAt)
    throw new Error('The initial pose cannot be deleted.');
  const snapshots = formation.snapshots
    .filter((s) => s.id !== id)
    .map((s, index) => (index === 0 ? { ...s, transition: 0 } : s));
  return { ...formation, snapshots };
}

export function readFormationTemplate(value: unknown, id: string): FormationTemplate {
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    (value.dancerCount !== 5 && value.dancerCount !== 7) ||
    !Array.isArray(value.positions) ||
    value.positions.length !== value.dancerCount ||
    typeof value.createdAt !== 'number' ||
    !Number.isFinite(value.createdAt)
  ) {
    throw new Error(`Invalid formation template ${id}.`);
  }
  const positions = value.positions.map(readPosition);
  const errors = poseErrors(Object.fromEntries(positions.map((pos, index) => [String(index), pos])));
  if (errors.length) throw new Error(`Invalid formation template ${id}: ${errors.join(' ')}`);
  return {
    id,
    name: value.name.trim(),
    dancerCount: value.dancerCount,
    positions,
    createdAt: value.createdAt,
    ...(typeof value.updatedAt === 'number' ? { updatedAt: value.updatedAt } : {}),
  };
}

function minimumTravelAssignment(costs: number[][]): number[] {
  const count = costs.length;
  if (costs.some((row) => row.some((cost) => !Number.isFinite(cost)))) {
    throw new Error('Current dancer coordinates must be finite.');
  }
  const rowPotential = Array<number>(count + 1).fill(0);
  const columnPotential = Array<number>(count + 1).fill(0);
  const matchedRow = Array<number>(count + 1).fill(0);
  const previous = Array<number>(count + 1).fill(0);
  for (let row = 1; row <= count; row++) {
    matchedRow[0] = row;
    const minimum = Array<number>(count + 1).fill(Number.POSITIVE_INFINITY);
    const used = Array<boolean>(count + 1).fill(false);
    let column = 0;
    do {
      used[column] = true;
      const currentRow = matchedRow[column];
      let delta = Number.POSITIVE_INFINITY;
      let next = 0;
      for (let candidate = 1; candidate <= count; candidate++) {
        if (used[candidate]) continue;
        const cost =
          costs[currentRow - 1][candidate - 1] - rowPotential[currentRow] - columnPotential[candidate];
        if (cost < minimum[candidate]) {
          minimum[candidate] = cost;
          previous[candidate] = column;
        }
        if (minimum[candidate] < delta) {
          delta = minimum[candidate];
          next = candidate;
        }
      }
      for (let candidate = 0; candidate <= count; candidate++) {
        if (used[candidate]) {
          rowPotential[matchedRow[candidate]] += delta;
          columnPotential[candidate] -= delta;
        } else minimum[candidate] -= delta;
      }
      column = next;
    } while (matchedRow[column] !== 0);
    do {
      const next = previous[column];
      matchedRow[column] = matchedRow[next];
      column = next;
    } while (column !== 0);
  }
  const result = Array<number>(count);
  for (let column = 1; column <= count; column++) result[matchedRow[column] - 1] = column - 1;

  // Resolve equal optima in row/column priority order without adding artificial travel costs.
  const tight = costs.map((row, index) =>
    row.flatMap((cost, column) =>
      Math.abs(cost - rowPotential[index + 1] - columnPotential[column + 1]) <= EPSILON / count
        ? [column]
        : [],
    ),
  );
  for (let row = 0; row < count; row++) {
    for (const column of tight[row]) {
      const owner = matchedRow[column + 1] - 1;
      if (owner === row) break;
      if (owner < row) continue;
      const visited = new Set([column]);
      const rematch = (displaced: number): boolean => {
        for (const candidate of tight[displaced]) {
          const next = matchedRow[candidate + 1] - 1;
          if (visited.has(candidate) || next < row) continue;
          visited.add(candidate);
          if (next === row || rematch(next)) {
            result[displaced] = candidate;
            matchedRow[candidate + 1] = displaced + 1;
            return true;
          }
        }
        return false;
      };
      if (rematch(owner)) {
        result[row] = column;
        matchedRow[column + 1] = row + 1;
        break;
      }
    }
  }
  return result;
}

export function assignCopiedPose(positions: FormationPose, copied: FormationPose): FormationPose {
  const ids = Object.keys(positions);
  const targets = Object.values(copied);
  if (!ids.length || ids.length !== targets.length) {
    throw new Error('Copied pose and snapshot dancer counts must match.');
  }
  const errors = poseErrors(copied);
  if (errors.length) throw new Error(errors.join(' '));
  const comparePosition = (a: StagePosition, b: StagePosition) =>
    b.y - a.y || Math.abs(a.x - STAGE_WIDTH / 2) - Math.abs(b.x - STAGE_WIDTH / 2);
  ids.sort((a, b) => comparePosition(positions[a], positions[b]) || (a < b ? -1 : a > b ? 1 : 0));
  targets.sort((a, b) => comparePosition(a, b) || a.x - b.x);
  const assignment = minimumTravelAssignment(
    targets.map((target) =>
      ids.map((id) => Math.hypot(positions[id].x - target.x, positions[id].y - target.y)),
    ),
  );
  return Object.fromEntries(assignment.map((dancer, index) => [ids[dancer], { ...targets[index] }]));
}

export function assignTemplate(
  positions: FormationPose,
  template: Pick<FormationTemplate, 'dancerCount' | 'positions'>,
): FormationPose {
  const ids = Object.keys(positions).sort();
  if (
    (ids.length !== 5 && ids.length !== 7) ||
    ids.length !== template.dancerCount ||
    template.positions.length !== ids.length
  ) {
    throw new Error('Template and snapshot dancer counts must match (5 or 7).');
  }
  const errors = poseErrors(Object.fromEntries(template.positions.map((pos, index) => [String(index), pos])));
  if (errors.length) throw new Error(errors.join(' '));
  const assignment = minimumTravelAssignment(
    ids.map((id) =>
      template.positions.map((target) => Math.hypot(positions[id].x - target.x, positions[id].y - target.y)),
    ),
  );
  return Object.fromEntries(ids.map((id, index) => [id, { ...template.positions[assignment[index]] }]));
}

export function activeFormationSingers(song: Song, distribution: Distribution, timestamp: number): string[] {
  const active = new Set<string>();
  if (timestamp < song.startAt || timestamp >= song.endAt) return [];
  const ids = dancerIds(distribution);
  for (const part of Object.values(song.content)) {
    if (part.type !== 'part' || timestamp < part.startTime || timestamp >= part.endTime) continue;
    for (const id of distribution.mapping[part.id] ?? []) {
      if (id === ALL_ID)
        ids.forEach((dancer) => {
          active.add(dancer);
        });
      else if (id !== NONE_ID && ids.includes(id)) active.add(id);
    }
  }
  return [...active];
}

export function formatFormationTime(timestamp: number) {
  const value = Math.max(0, Math.round(timestamp));
  return `${Math.floor(value / 60000)}:${String(Math.floor(value / 1000) % 60).padStart(2, '0')}.${String(value % 1000).padStart(3, '0')}`;
}
