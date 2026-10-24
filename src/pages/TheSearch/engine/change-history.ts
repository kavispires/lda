import type { ChangeValue, PropertyChange } from '../types/common';
import type { ChangeLogEntry, Contestant } from '../types/contestant';

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function snapshot(value: unknown): ChangeValue | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    return value.map((entry) => {
      const result = snapshot(entry);
      if (result === undefined) throw new Error('Change history cannot contain undefined array values.');
      return result;
    });
  }
  if (isObject(value)) {
    const result: Record<string, ChangeValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      const copy = snapshot(entry);
      if (copy !== undefined) result[key] = copy;
    }
    return result;
  }
  throw new Error('Change history requires serializable contestant values.');
}

export function recordContestantChanges(
  before: Contestant,
  after: Contestant,
  cause: string,
): PropertyChange[] {
  if (!cause.trim()) throw new Error('Every contestant change requires a cause.');
  if (before.id !== after.id) throw new Error('A contestant change cannot replace the contestant ID.');
  const changes: PropertyChange[] = [];
  const visit = (oldValue: unknown, newValue: unknown, path: string) => {
    if (isObject(oldValue) && isObject(newValue)) {
      for (const key of new Set([...Object.keys(oldValue), ...Object.keys(newValue)])) {
        if (!path && key === 'changeLog') continue;
        visit(oldValue[key], newValue[key], path ? `${path}.${key}` : key);
      }
      return;
    }
    const previous = snapshot(oldValue);
    const next = snapshot(newValue);
    if (JSON.stringify(previous) !== JSON.stringify(next)) {
      changes.push({
        path,
        ...(previous === undefined ? {} : { before: previous }),
        ...(next === undefined ? {} : { after: next }),
        cause,
      });
    }
  };
  visit(before, after, '');
  return changes;
}

export function appendContestantHistory(
  contestant: Contestant,
  entry: Omit<ChangeLogEntry, 'change' | 'changes'>,
  changes: PropertyChange[],
): Contestant {
  if (!entry.phaseId?.trim()) throw new Error('A persisted contestant history entry requires a phase ID.');
  const change: ChangeLogEntry['change'] = {};
  for (const item of changes) {
    // Detailed changes retain every intermediate value; this map keeps the legacy final-value view.
    if (item.after !== undefined) change[item.path] = structuredClone(item.after);
  }
  const nextEntry = { ...structuredClone(entry), change, changes: structuredClone(changes) };
  const existing = contestant.changeLog.find((item) => item.phaseId === entry.phaseId);
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(nextEntry)) {
      throw new Error(
        `Contestant history phase "${entry.phaseId}" was already recorded with different outcomes.`,
      );
    }
    return contestant;
  }
  return {
    ...contestant,
    changeLog: [...contestant.changeLog, nextEntry],
  };
}
