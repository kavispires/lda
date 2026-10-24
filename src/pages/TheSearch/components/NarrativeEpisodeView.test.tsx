import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Children, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transitionAudition } from '../engine/audition-episode';
import { scorePanelAudition } from '../engine/audition-panel';
import { createSeasonSetup } from '../engine/season-setup';
import type { BattleEpisode } from '../types/battle-episode';
import type { SimulationState } from '../types/simulation';
import { createContestant } from '../utilities/contestant-factory';
import {
  NarrativeAuditionView,
  NarrativeBattleView,
  NarrativeContinue,
  OpeningCredits,
} from './NarrativeEpisodeView';

function fixture(): SimulationState {
  const source = Object.fromEntries(
    Array.from({ length: 50 }, (_, index) => {
      const person = createContestant({ id: `narrative-${index}`, name: `Artist ${index}`, updatedAt: 1 });
      return [person.id, person];
    }),
  );
  const state = transitionAudition(
    {
      ...createSeasonSetup(source, { seed: 190, runId: 'narrative-ui', now: 1, formatVersion: 2 }),
      status: 'ready',
      persistenceError: null,
    },
    { type: 'start' },
    0,
  );
  assert.ok(state.runtime?.audition);
  state.runtime.audition.phase = 'host-intro';
  state.runtime.audition.story = {
    sequence: 1,
    presentation: 'host',
    pendingPerformerId: null,
    exposure: {},
    creditedIds: [],
    farewellBaseline: {},
    farewellAppliedIds: [],
  };
  state.runtime.audition.scenes = [
    {
      id: 'welcome',
      kind: 'opening',
      title: 'Welcome to The Search',
      paragraphs: ['Fifty contestants begin their journey.'],
      contestantIds: [],
    },
  ];
  return state;
}

test('host opening is narrative-first and explicitly has no grade before a performance', () => {
  const html = renderToStaticMarkup(
    <NarrativeAuditionView
      onAction={() => {
        throw new Error('Render must not advance');
      }}
      onInspect={() => {}}
      state={fixture()}
    />,
  );
  assert.match(html, /Mike Philip/);
  assert.match(html, /aria-label="Mike Philip portrait"[^>]*><svg/);
  assert.match(html, /Fifty contestants begin their journey/);
  assert.match(html, /No grade yet/);
  assert.match(html, /Play the opening sequence/);
  assert.doesNotMatch(html, /<table|Raw dice|Revision|Grade A/);
});

for (const [position, judge] of [
  [0, 'John Stan'],
  [7, 'Megan Ryder'],
  [14, 'Michael Lion'],
] as const) {
  test(`performance bubble uses ${judge}'s portrait, persisted comment and grade`, () => {
    const state = fixture();
    const episode = state.runtime?.audition;
    assert.ok(episode?.story);
    episode.phase = 'live';
    episode.story.presentation = 'performance';
    const person = state.contestants[0];
    const song = episode.pool[0];
    const result = scorePanelAudition(
      {
        contestant: person,
        song,
        preferences: { visualOrUniqueness: 'visual', potentialOrCharisma: 'potential' },
        rawDice: [3, 4],
        tieBreakKey: 0.25,
      },
      position,
    );
    assert.ok(result.panel);
    episode.evaluations = [
      {
        ...result,
        grade: 'D',
        panel: {
          ...result.panel,
          comment: 'Your stage presence needs more confidence.',
        },
      },
    ];
    episode.scenes = [
      {
        id: 'performance',
        kind: 'auditions',
        title: 'A first performance',
        paragraphs: ['The performance concludes.'],
        contestantIds: [person.id],
      },
    ];
    const html = renderToStaticMarkup(
      <NarrativeAuditionView onAction={() => {}} onInspect={() => {}} state={state} />,
    );
    assert.ok(html.includes(`aria-label="${judge} portrait"`));
    assert.match(html, /ant-avatar[^>]*><svg/);
    assert.match(html, /Grade D/);
    assert.match(html, /Your stage presence needs more confidence/);
    assert.doesNotMatch(html, /Raw dice|<table/);
  });
}

test('judge introductions show all three personnel portraits', () => {
  const state = fixture();
  const episode = state.runtime?.audition;
  assert.ok(episode?.story);
  episode.story.presentation = 'judges';
  const html = renderToStaticMarkup(
    <NarrativeAuditionView onAction={() => {}} onInspect={() => {}} state={state} />,
  );
  for (const name of ['John Stan', 'Megan Ryder', 'Michael Lion']) {
    assert.ok(html.includes(`aria-label="${name} portrait"`));
  }
  assert.equal((html.match(/<svg aria-hidden="true" height="100%"/g) ?? []).length, 3);
});

test('credits have five inspectable portraits and never dispatch gameplay on render', () => {
  const state = fixture();
  const ids = state.contestants.slice(0, 5).map((person) => person.id);
  const inspected: string[] = [];
  const node = OpeningCredits({ state, ids, onInspect: (id) => inspected.push(id) });
  assert.ok(isValidElement<{ children: ReactNode }>(node));
  for (const child of Children.toArray(node.props.children)) {
    assert.ok(isValidElement<{ onClick: () => void }>(child));
    child.props.onClick();
  }
  assert.deepEqual(inspected, ids);
  const html = renderToStaticMarkup(node);
  assert.equal((html.match(/data-contestant-id=/g) ?? []).length, 5);
  for (const id of ids) assert.ok(html.includes(`images/contestants/${id}.jpg`));
  assert.doesNotMatch(html, /ant-image/);
});

test('manual Continue passes the expected revision once and only when clicked', () => {
  const actions: unknown[] = [];
  const button = NarrativeContinue({ revision: 23, onAction: (...args) => actions.push(args) });
  assert.deepEqual(actions, []);
  button.props.onClick();
  assert.deepEqual(actions, [[{ type: 'advance' }, 23]]);
});

test('battle credits pause at the persisted credits boundary without exposing the dashboard', () => {
  const state = fixture();
  const openingCast = state.contestants.slice(0, 5).map((person) => person.id);
  assert.ok(state.runtime);
  state.runtime.openingCast = openingCast;
  const battle: BattleEpisode = {
    version: 1,
    phase: 'dorms',
    lastAction: { revision: 3, action: { type: 'advance' } },
    participantIds: openingCast,
    rankedIds: [],
    finalRankedIds: [],
    rooms: [],
    roomCursor: 0,
    teams: [],
    draftRound: 0,
    pairings: [],
    teamCursor: 0,
    performances: [],
    composure: {},
    conflict: null,
    conflictChoice: null,
    changes: {},
    cuts: [],
    selectedCutId: null,
    audience: null,
    judgeSaveId: null,
    audienceSaveId: null,
    productionShortlist: [],
    productionSaveId: null,
    survivorIds: [],
    eliminatedIds: [],
    revealedResults: 0,
    mvp: null,
    secretCandidates: [],
    secret: null,
    scenes: [
      {
        id: 'credits',
        kind: 'opening',
        title: 'Opening credits',
        paragraphs: [],
        contestantIds: openingCast,
      },
    ],
    revision: 4,
  };
  const html = renderToStaticMarkup(
    <NarrativeBattleView
      onAction={() => {
        throw new Error('Render must not advance');
      }}
      onInspect={() => {}}
      state={{ ...state, runtime: { ...state.runtime, battle } }}
    />,
  );
  assert.match(html, /Opening credits/);
  assert.match(html, /The next morning/);
  assert.doesNotMatch(html, /Revision|<table|Raw dice/);
  assert.equal((html.match(/data-contestant-id=/g) ?? []).length, 5);
});
