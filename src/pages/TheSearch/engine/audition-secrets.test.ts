import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AttributeCard } from '../types/common';
import { createContestant } from '../utilities/contestant-factory';
import { revealAuditionSecret, validateSecretConsequences } from './audition-secrets';
import { createSeasonSetup } from './season-setup';

function fixture(consequence: AttributeCard['consequence']) {
  const source = Object.fromEntries(
    Array.from({ length: 50 }, (_, index) => {
      const id = `secret-${index}`;
      return [id, createContestant({ id, name: id })];
    }),
  );
  const setup = createSeasonSetup(source, { seed: 987, runId: 'secret-test', now: 1, formatVersion: 1 });
  const definitions = structuredClone(setup.runtime.definitions);
  const original = Object.values(definitions.cards.secret)[0];
  const card: AttributeCard = { ...original, id: 'TEST_SECRET', consequence };
  definitions.cards.secret = { TEST_SECRET: card };
  const contestant = createContestant({ id: 'holder', name: 'Holder', attributes: ['TEST_SECRET'] });
  return { contestant, definitions };
}

test('secret reveals apply bounded authored effects but defer locked survival and cumulative outcomes', () => {
  const { contestant, definitions } = fixture({
    'coreSkills.vocals': 100,
    'personality.discipline': -100,
    'aggregations.audienceRatio': 5,
    condition: 'INJURED',
    status: 'ELIMINATED',
    'aggregations.rankingScore': -100,
  });
  const before = structuredClone(contestant);
  const resolved = revealAuditionSecret([contestant], contestant.id, definitions);
  const updated = resolved.contestants[0];
  assert.deepEqual(contestant, before);
  assert.equal(updated.coreSkills.vocals, 5);
  assert.equal(updated.personality.discipline, -10);
  assert.equal(updated.aggregations.audienceRatio, 1);
  assert.equal(updated.condition, 'INJURED');
  assert.equal(updated.status, contestant.status);
  assert.equal(updated.aggregations.rankingScore, contestant.aggregations.rankingScore);
  assert.deepEqual(
    resolved.result.deferred.map((entry) => entry.path),
    ['status', 'aggregations.rankingScore'],
  );
  assert.deepEqual(updated.events, [...contestant.events, 'SECRET_REVEALED:TEST_SECRET']);
  assert.throws(
    () => revealAuditionSecret(resolved.contestants, contestant.id, definitions),
    /already been publicly revealed/,
  );
});

test('secret misses change nothing and invalid authored consequences fail explicitly', () => {
  const { contestant, definitions } = fixture({});
  contestant.attributes = [];
  const result = revealAuditionSecret([contestant], contestant.id, definitions);
  assert.equal(result.result.cardId, null);
  assert.deepEqual(result.contestants, [contestant]);
  definitions.cards.secret.TEST_SECRET.consequence = { 'coreSkills.missing': 1 };
  assert.throws(() => validateSecretConsequences(definitions.cards.secret), /unsupported consequence/);
  definitions.cards.secret.TEST_SECRET.consequence = { condition: 'NOT_REAL' };
  assert.throws(() => validateSecretConsequences(definitions.cards.secret), /unsupported consequence/);
});
