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
import styles from './NarrativeEpisodeView.module.scss';

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
  assert.doesNotMatch(html, /introduction portrait/);
});

test('Meet introductions show a large portrait on the left and introduction text on the right', () => {
  const state = fixture();
  const episode = state.runtime?.audition;
  assert.ok(episode?.story);
  const contestant = state.contestants[0];
  episode.phase = 'introduction';
  episode.story.presentation = 'introduction';
  episode.story.pendingPerformerId = contestant.id;
  episode.scenes = [
    {
      id: 'meet-contestant',
      kind: 'choices',
      title: `Meet ${contestant.name}`,
      paragraphs: [`${contestant.name} steps forward.`],
      contestantIds: [contestant.id],
      presentation: 'introduction',
    },
  ];
  const html = renderToStaticMarkup(
    <NarrativeAuditionView
      onAction={() => {
        throw new Error('Rendering must not advance');
      }}
      onInspect={() => {}}
      state={state}
    />,
  );
  const portrait = html.match(/<figure\b[^>]*>[\s\S]*?<\/figure>/)?.[0];
  assert.ok(portrait);
  assert.ok(portrait.includes(`aria-label="${contestant.name} introduction portrait"`));
  assert.match(portrait, /width:min\(320px, 100%\)/);
  assert.ok(portrait.includes(`images/contestants/${contestant.id}.jpg`));
  assert.match(portrait, /ant-avatar-square/);
  assert.ok(html.includes(`class="${styles.introduction}"`));
  assert.ok(html.indexOf('</figure>') < html.indexOf(' steps forward.'));
  assert.match(html, /<\/figure><div>/);
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

function ExpandedAuditionEvidence({ state }: { state: SimulationState }) {
  const player = NarrativeAuditionView({ state, onAction: () => {}, onInspect: () => {} });
  assert.ok(isValidElement<{ children: ReactNode }>(player));
  for (const child of Children.toArray(player.props.children)) {
    if (!isValidElement<{ items?: { key: string; children: ReactNode }[] }>(child)) continue;
    const details = child.props.items?.find(({ key }) => key === 'details')?.children;
    if (isValidElement<{ items: { children: ReactNode }[] }>(details))
      return <>{details.props.items[0].children}</>;
  }
  assert.fail('Missing audition evidence');
}

test('the gentler score adjustment is transparent only inside optional audition details', () => {
  const state = fixture();
  const episode = state.runtime?.audition;
  assert.ok(episode);
  for (const version of [1, 2] as const) {
    const result = scorePanelAudition(
      {
        contestant: state.contestants[0],
        song: episode.pool[0],
        preferences: { visualOrUniqueness: 'visual', potentialOrCharisma: 'potential' },
        rawDice: [3, 4],
        tieBreakKey: 0.25,
      },
      0,
      version,
    );
    episode.evaluations = [result];
    const hidden = renderToStaticMarkup(
      <NarrativeAuditionView onAction={() => {}} onInspect={() => {}} state={state} />,
    );
    assert.doesNotMatch(hidden, /Raw panel result|Audition adjustment|remaining headroom/);
    const details = renderToStaticMarkup(<ExpandedAuditionEvidence state={state} />);
    assert.ok(details.includes(`Final ${result.finalScore.toFixed(1)}`));
    if (version === 2) {
      assert.ok(result.panel?.rawFinalScore !== undefined);
      assert.ok(details.includes(`Raw panel result: ${result.panel.rawFinalScore.toFixed(1)}`));
      assert.ok(
        details.includes(
          `Audition adjustment: +${(result.finalScore - result.panel.rawFinalScore).toFixed(1)}`,
        ),
      );
      assert.match(details, /20% of remaining headroom/);
    } else {
      assert.doesNotMatch(details, /Raw panel result|Audition adjustment/);
    }
  }
});

test('credits have five inspectable portraits and never dispatch gameplay on render', () => {
  const state = fixture();
  const ids = state.contestants.slice(0, 5).map((person) => person.id);
  const inspected: string[] = [];
  const node = OpeningCredits({ state, ids, onInspect: (id) => inspected.push(id) });
  assert.ok(isValidElement<{ children: ReactNode }>(node));
  const [cast] = Children.toArray(node.props.children);
  assert.ok(isValidElement<{ children: ReactNode }>(cast));
  for (const child of Children.toArray(cast.props.children)) {
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
