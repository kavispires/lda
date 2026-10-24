import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createContestant } from '../utilities/contestant-factory';
import { appendContestantHistory, recordContestantChanges } from './change-history';

test('history preserves intermediate changes, reversals, arrays and causes without modifying the source', () => {
  const source = createContestant({ id: 'bob', name: 'Bob', updatedAt: 1 });
  const intermediate = structuredClone(source);
  intermediate.aggregations.happiness = 40;
  intermediate.attributes = ['CARD'];
  intermediate.relationships.other = [50, 60];
  intermediate.bias = true;
  const final = structuredClone(intermediate);
  final.aggregations.happiness = source.aggregations.happiness;
  const changes = [
    ...recordContestantChanges(source, intermediate, 'Conflict'),
    ...recordContestantChanges(intermediate, final, 'Reconciliation'),
  ];
  const entry = {
    phaseId: 'episode-1',
    episode: 1,
    missionRating: 3,
    rank: 12,
    score: 60,
    status: final.status,
    summary: 'Audition completed',
    events: ['CONFLICT', 'RECONCILIATION'],
  };
  const logged = appendContestantHistory(final, entry, changes);
  const history = logged.changeLog[0];
  assert.deepEqual(
    history.changes?.filter((change) => change.path === 'aggregations.happiness'),
    [
      { path: 'aggregations.happiness', before: 50, after: 40, cause: 'Conflict' },
      { path: 'aggregations.happiness', before: 40, after: 50, cause: 'Reconciliation' },
    ],
  );
  assert.deepEqual(history.change.attributes, ['CARD']);
  assert.deepEqual(history.change['relationships.other'], [50, 60]);
  assert.equal(history.change.bias, true);
  assert.equal(source.changeLog.length, 0);
  assert.deepEqual(source.attributes, []);
  assert.deepEqual(recordContestantChanges(final, logged, 'Append history'), []);
  assert.equal(appendContestantHistory(logged, entry, changes), logged);
  assert.throws(
    () => appendContestantHistory(logged, { ...entry, score: 61 }, changes),
    /different outcomes/,
  );
  changes[0].cause = 'Modified external input';
  assert.equal(history.changes?.[0].cause, 'Conflict');
});

test('history records deleted fields and rejects missing causes and replaced contestant IDs', () => {
  const source = createContestant({ id: 'bob', name: 'Bob', bias: true });
  const changed = structuredClone(source);
  delete changed.bias;
  assert.deepEqual(recordContestantChanges(source, changed, 'Remove bias'), [
    { path: 'bias', before: true, cause: 'Remove bias' },
  ]);
  assert.throws(() => recordContestantChanges(source, changed, ''), /requires a cause/);
  assert.throws(
    () => recordContestantChanges(source, { ...changed, id: 'other' }, 'Replace'),
    /contestant ID/,
  );
});
