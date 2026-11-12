import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_ID, NONE_ID } from './constants';
import {
  addAssignmentBatch,
  hasAssignmentConflict,
  isRecordedAssignment,
  liveAssigneeIds,
  lyricAssigneeIds,
  updatePartAssignments,
} from './distribution-assignments';

test('NONE with members is lyric attribution only, while NONE-only and ALL-only retain their meanings', () => {
  for (const members of [['a'], ['a', 'b']]) {
    const ids = [NONE_ID, ...members];
    assert.equal(isRecordedAssignment(ids), true);
    assert.deepEqual(lyricAssigneeIds(ids), members);
    assert.deepEqual(liveAssigneeIds(ids), []);
  }
  assert.equal(isRecordedAssignment([NONE_ID]), false);
  assert.deepEqual(lyricAssigneeIds([NONE_ID]), [NONE_ID]);
  assert.deepEqual(liveAssigneeIds([ALL_ID]), [ALL_ID]);
  assert.deepEqual(liveAssigneeIds(['a', 'b']), ['a', 'b']);
});

test('single and bulk assignments reject conflicting markers without mutation and permit resolving old conflicts', () => {
  const mapping = { first: ['a'], second: [ALL_ID] };
  const original = structuredClone(mapping);
  assert.equal(updatePartAssignments(mapping, ['first'], NONE_ID, 'toggle').ok, true);
  assert.equal(updatePartAssignments(mapping, ['second'], NONE_ID, 'toggle').ok, false);
  assert.equal(updatePartAssignments(mapping, ['first', 'second'], NONE_ID, 'add').ok, false);
  assert.deepEqual(mapping, original);
  assert.equal(hasAssignmentConflict({ part: [NONE_ID, ALL_ID] }), true);
  for (const marker of [NONE_ID, ALL_ID]) {
    const resolved = updatePartAssignments({ part: [NONE_ID, ALL_ID, 'a'] }, ['part'], marker, 'toggle');
    assert.equal(resolved.ok, true);
    if (resolved.ok) assert.equal(hasAssignmentConflict(resolved.mapping), false);
  }
  const added = updatePartAssignments({ part: [NONE_ID, 'a'] }, ['part'], 'a', 'add');
  assert.deepEqual(added, { ok: true, mapping: { part: [NONE_ID, 'a'] } });
});

test('pasting several assignment groups is atomic even when a later group conflicts', () => {
  const mapping = { first: [], second: [ALL_ID] };
  const original = structuredClone(mapping);
  const result = addAssignmentBatch(mapping, [
    { partIds: ['first'], assignee: 'a' },
    { partIds: ['second'], assignee: NONE_ID },
  ]);
  assert.equal(result.ok, false);
  assert.deepEqual(mapping, original);
  assert.deepEqual(
    addAssignmentBatch(mapping, [
      { partIds: ['first'], assignee: NONE_ID },
      { partIds: ['first'], assignee: 'a' },
    ]),
    { ok: true, mapping: { first: [NONE_ID, 'a'], second: [ALL_ID] } },
  );
});
