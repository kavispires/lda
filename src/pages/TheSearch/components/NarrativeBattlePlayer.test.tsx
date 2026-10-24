import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Children, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transitionBattle } from '../engine/battle-episode';
import { completedAuditionsFixture } from '../engine/battle-fixtures';
import { advanceBattleStoryTo, narrativeBattleFixture } from '../engine/narrative-battle-fixtures';
import type { BattleStory } from '../types/battle-episode';
import type { SimulationState } from '../types/simulation';
import { BattleNarrativeContinue, NarrativeBattlePlayer } from './NarrativeBattlePlayer';

function fixture(stage: BattleStory['stage'] = 'challenge') {
  const state = transitionBattle(completedAuditionsFixture(), { type: 'start' }, 0);
  assert.ok(state.runtime?.battle);
  state.runtime.version = 3;
  const episode = state.runtime.battle;
  episode.version = 2;
  episode.story = {
    stage,
    sequence: 3,
    draftPick: 0,
    pairingCursor: 0,
    reviewCursor: 0,
    departureCursor: 0,
    interventions: {},
    exposure: {},
    creditedTeamIds: [],
    matchupReactions: [],
    rankReactions: [],
    rankRevealed: false,
    backlashApplied: false,
  };
  episode.scenes = [
    {
      id: 'challenge',
      kind: 'opening',
      title: 'The challenge',
      sequence: 3,
      speaker: { name: 'Mike Philip', role: 'Host' },
      paragraphs: ['Six teams face three head-to-head battles.'],
      contestantIds: [],
    },
  ];
  return state;
}

const noAction = () => {
  throw new Error('Rendering or replay must not dispatch an action.');
};

test('battle host scene uses speech and a personnel portrait without leaking saves or survivor counts', () => {
  const html = renderToStaticMarkup(
    <NarrativeBattlePlayer onAction={noAction} onInspect={() => {}} state={fixture()} />,
  );
  assert.match(html, /aria-label="Mike Philip portrait"/);
  assert.match(html, /Six teams face three head-to-head battles/);
  assert.match(html, /Sequence 3/);
  assert.match(html, /Meet the six captains/);
  assert.doesNotMatch(
    html,
    /18 remain|18 survivors|eighteen|Three distinct saves|second chances|Revision|<table/i,
  );
});

test('battle start card does not reveal the save twist', () => {
  const state = fixture();
  assert.ok(state.runtime);
  state.runtime.battle = null;
  const html = renderToStaticMarkup(
    <NarrativeBattlePlayer onAction={noAction} onInspect={() => {}} state={state} />,
  );
  assert.match(html, /Start Episode 2/);
  assert.doesNotMatch(html, /saves|18|eighteen|second chance/i);
});

test('battle credits render the saved opening portraits without advancing or exposing team calculations', () => {
  const state = fixture('credits');
  assert.ok(state.runtime);
  const ids = state.contestants.slice(0, 5).map((person) => person.id);
  state.runtime.openingCast = ids;
  const html = renderToStaticMarkup(
    <NarrativeBattlePlayer onAction={noAction} onInspect={() => {}} state={state} />,
  );
  assert.match(html, /Opening cast/);
  for (const id of ids) assert.ok(html.includes(`images/contestants/${id}.jpg`));
  assert.equal((html.match(/data-contestant-id=/g) ?? []).length, 5);
  assert.doesNotMatch(html, /Raw dice|coordination|<table/);
});

test('judge dialogue has personnel avatars and persisted speech, and the archive never advances', () => {
  const state = fixture('reviews');
  const episode = state.runtime?.battle;
  assert.ok(episode);
  episode.scenes.push({
    id: 'judges',
    kind: 'recap',
    title: 'The panel reviews',
    sequence: 7,
    paragraphs: [],
    contestantIds: [],
    dialogues: [
      { name: 'John Stan', role: 'Music producer', paragraphs: ['The vocal line stayed clear.'] },
      { name: 'Megan Ryder', role: 'Veteran artist', paragraphs: ['You commanded the stage.'] },
      { name: 'Michael Lion', role: 'Record-label executive', paragraphs: ['That was consistent.'] },
    ],
  });
  const html = renderToStaticMarkup(
    <NarrativeBattlePlayer
      actionError="The saved decision could not be published."
      onAction={noAction}
      onInspect={() => {}}
      state={state}
    />,
  );
  for (const judge of ['John Stan', 'Megan Ryder', 'Michael Lion']) {
    assert.ok(html.includes(`aria-label="${judge} portrait"`));
  }
  assert.match(html, /The vocal line stayed clear/);
  assert.match(html, /The saved decision could not be published/);
  assert.match(html, /read-only archive/);
  assert.doesNotMatch(html, /Six teams face three head-to-head battles/);
});

test('judge speech links namesake captains using each paragraph’s explicit references', () => {
  const state = fixture('reviews');
  const episode = state.runtime?.battle;
  assert.ok(episode);
  const captains = state.contestants.slice(0, 2);
  for (const captain of captains) captain.name = 'Alex';
  episode.scenes = [
    {
      id: 'judge-namesakes',
      kind: 'recap',
      title: 'The panel reviews',
      sequence: 7,
      paragraphs: [],
      contestantIds: [],
      dialogues: [
        {
          name: 'John Stan',
          role: 'Music producer',
          paragraphs: ['Team Alex kept its vocal line clear.', 'Team Alex found a distinctive sound.'],
          paragraphContestantIds: captains.map((captain) => [captain.id]),
        },
      ],
    },
  ];
  const html = renderToStaticMarkup(
    <NarrativeBattlePlayer onAction={noAction} onInspect={() => {}} state={state} />,
  );
  assert.equal((html.match(/data-contestant-id=/g) ?? []).length, 2);
  assert.ok(
    html.indexOf(`data-contestant-id="${captains[0].id}"`) <
      html.indexOf(`data-contestant-id="${captains[1].id}"`),
  );
  for (const captain of captains) assert.ok(html.includes(`data-contestant-id="${captain.id}"`));
});

test('final ranking has eighteen inline portrait links and no duplicate contestant row', () => {
  const state = fixture('ranking');
  const episode = state.runtime?.battle;
  assert.ok(episode?.story);
  episode.story.rankRevealed = true;
  const people = state.contestants.slice(0, 18);
  episode.scenes = [
    {
      id: 'ranking',
      kind: 'ranking',
      title: 'The first full ranking',
      sequence: 8,
      speaker: { name: 'Mike Philip', role: 'Host' },
      contestantIds: people.map((person) => person.id),
      paragraphs: people.map((person, index) => `${index + 1}. ${person.name}`),
      paragraphContestantIds: people.map((person) => [person.id]),
    },
  ];
  const html = renderToStaticMarkup(
    <NarrativeBattlePlayer onAction={noAction} onInspect={() => {}} state={state} />,
  );
  assert.equal((html.match(/data-contestant-id=/g) ?? []).length, 18);
  for (const person of people) assert.ok(html.includes(`images/contestants/${person.id}.jpg`));
  assert.doesNotMatch(html, /aria-label="Contestant details"/);
});

test('manual battle Continue sends only one action with the persisted revision', () => {
  const actions: unknown[] = [];
  const button = BattleNarrativeContinue({ revision: 37, onAction: (...args) => actions.push(args) });
  assert.deepEqual(actions, []);
  button.props.onClick();
  assert.deepEqual(actions, [[{ type: 'advance' }, 37]]);
});

function ExpandedEvidence({ state }: { state: SimulationState }) {
  const player = NarrativeBattlePlayer({ state, onAction: noAction, onInspect: () => {} });
  assert.ok(isValidElement<{ children: ReactNode }>(player));
  for (const child of Children.toArray(player.props.children)) {
    if (!isValidElement<{ items?: { label: string; children: ReactNode }[] }>(child)) continue;
    const details = child.props.items?.find((item) => item.label.startsWith('Details'));
    if (details) return <>{details.children}</>;
  }
  return null;
}

test('even expanded evidence seals team totals and judge bonuses until that pairing’s winner is announced', () => {
  const reviews = advanceBattleStoryTo(narrativeBattleFixture(), 'reviews');
  const sealed = renderToStaticMarkup(<ExpandedEvidence state={reviews} />);
  assert.match(sealed, /Grade [ABCDF]|Raw dice/);
  assert.doesNotMatch(sealed, /Team score:|base score:|; bonus/i);
  const winners = advanceBattleStoryTo(reviews, 'winners');
  const revealed = renderToStaticMarkup(<ExpandedEvidence state={winners} />);
  assert.match(revealed, /Team score:/);
  assert.match(revealed, /base score:/);
  assert.match(revealed, /bonus/);
});
