import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AttributeCard } from '../types/common';
import type { SeasonRuntime } from '../types/simulation';
import { createContestant } from './contestant-factory';
import { projectEpisodeContestant } from './episode-visibility';

const card: AttributeCard = {
  id: 'SECRET_TEST',
  type: 'SECRET',
  group: 'history',
  name: 'Private biography',
  description: 'An undisclosed past',
  occurrence: 1,
  influences: {},
};

function fixture() {
  const contestant = createContestant({ id: 'one', name: 'One', updatedAt: 1 });
  contestant.attributes = ['PUBLIC', card.id];
  contestant.events = ['PUBLIC_EVENT', card.id];
  contestant.rank = 7;
  contestant.aggregations.score = 123;
  contestant.changeLog = [
    {
      episode: 1,
      rank: 7,
      score: 76.4321,
      missionRating: 4,
      status: contestant.status,
      summary: `A performance; ${card.name}`,
      events: ['AUDITION', card.id],
      change: {
        rank: 7,
        'aggregations.score': 123,
        snapshot: {
          attributes: [card.id, { description: card.description }],
          aggregations: { score: 123, happiness: 60 },
          rank: 7,
        },
      },
      changes: [
        { path: 'rank', before: 0, after: 7, cause: 'Standings' },
        { path: 'aggregations.score', before: 0, after: 123, cause: 'Contribution' },
        { path: 'aggregations', before: { score: 0 }, after: { score: 123, happiness: 60 }, cause: 'Update' },
        {
          path: 'attributes',
          after: [card.id, 'PUBLIC'],
          cause: `Assigned ${card.name}: ${card.description}`,
        },
        { path: `events.${card.id}`, after: card.description, cause: card.id },
      ],
    },
  ];
  const runtime: SeasonRuntime = {
    version: 1,
    runId: 'visibility',
    seed: 1,
    randomState: 1,
    episode: 1,
    phase: 'auditions',
    setup: { useBias: false, selectedIds: ['one'] },
    sourceContestants: { one: contestant },
    initialContestants: [contestant],
    definitions: {
      cards: { persona: {}, identity: {}, interest: {}, secret: { [card.id]: card } },
      specialties: {
        vocalColor: {},
        danceStyle: {},
        rapStyle: {},
        visualVibe: {},
        leadershipStyle: {},
        genreAffinity: {},
      },
      zodiacSigns: {},
      auditionSongs: [],
    },
    audition: null,
    show: { audience: 100, satisfaction: 50, general: 100, fans: {}, pendingAttrition: 0 },
    revealedSecrets: [],
    deferredConsequences: [],
  };
  return { contestant, runtime };
}

test('simulation projection removes unrevealed secret identities from attributes, events and nested history', () => {
  const { contestant, runtime } = fixture();
  const before = structuredClone(contestant);
  const projected = projectEpisodeContestant(contestant, runtime);
  assert.deepEqual(projected.attributes, ['PUBLIC']);
  assert.deepEqual(projected.events, ['PUBLIC_EVENT']);
  assert.deepEqual(projected.changeLog[0].events, ['AUDITION']);
  for (const token of [card.id, card.name, card.description]) {
    assert.equal(JSON.stringify(projected).includes(token), false, token);
  }
  assert.equal(JSON.stringify(projected).includes('[unrevealed]'), false);
  assert.equal(
    projected.changeLog[0].changes?.some((change) => change.path.startsWith('events.')),
    false,
  );
  assert.deepEqual(contestant, before);
  projected.coreSkills.vocals = 5;
  projected.changeLog[0].events.push('EDIT');
  assert.deepEqual(contestant, before);
});

test('only the selected contestant’s revealed secret becomes inspectable', () => {
  const { contestant, runtime } = fixture();
  runtime.revealedSecrets = [{ contestantId: 'someone-else', cardId: card.id }];
  assert.equal(projectEpisodeContestant(contestant, runtime).attributes.includes(card.id), false);
  runtime.revealedSecrets.push({ contestantId: contestant.id, cardId: card.id });
  const projected = projectEpisodeContestant(contestant, runtime);
  assert.ok(projected.attributes.includes(card.id));
  assert.ok(projected.events.includes(card.id));
  assert.ok(projected.changeLog[0].summary.includes(card.name));
});

test('cumulative rankings and nested score changes are hidden without concealing judged audition scores', () => {
  const { contestant, runtime } = fixture();
  const projected = projectEpisodeContestant(contestant, runtime);
  assert.equal(projected.rank, 0);
  assert.equal(projected.aggregations.score, 0);
  assert.equal(projected.changeLog[0].rank, 0);
  assert.equal(projected.changeLog[0].score, 76.4321);
  assert.equal('rank' in projected.changeLog[0].change, false);
  assert.equal('aggregations.score' in projected.changeLog[0].change, false);
  assert.deepEqual(projected.changeLog[0].change.snapshot, {
    attributes: [],
    aggregations: { happiness: 60 },
  });
  assert.deepEqual(projected.changeLog[0].changes?.find((change) => change.path === 'aggregations')?.after, {
    happiness: 60,
  });
  assert.equal(
    projected.changeLog[0].changes?.some(
      (change) => change.path === 'rank' || change.path === 'aggregations.score',
    ),
    false,
  );
  contestant.changeLog[0].episode = 0;
  assert.equal(projectEpisodeContestant(contestant, runtime).changeLog[0].score, 0);
});
