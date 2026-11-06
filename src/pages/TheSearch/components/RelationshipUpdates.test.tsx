import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Button } from 'antd';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { completedBattlesForBootcamp } from '../engine/bootcamp-fixtures';
import { autoCompleteEpisode, type EpisodeNumber } from '../engine/episode-auto-complete';
import { narrativeBattleFixture } from '../engine/narrative-battle-fixtures';
import type { PropertyChange } from '../types/common';
import type { Contestant } from '../types/contestant';
import type { SimulationState } from '../types/simulation';
import { createEpisodeRundown } from '../utilities/episode-rundown';
import {
  createRelationshipUpdatesMarkdown,
  episodeRelationshipUpdates,
} from '../utilities/relationship-updates';
import { createShowRundown } from '../utilities/show-rundown';
import { BootcampEpisodeView } from './BootcampEpisodeView';
import { MegaGroupsEpisodeView } from './MegaGroupsEpisodeView';
import { NarrativeAuditionView, NarrativeBattleView } from './NarrativeEpisodeView';
import { PhotoshootEpisodeView } from './PhotoshootEpisodeView';
import { EpisodeEndScreens, RelationshipUpdates } from './RelationshipUpdates';

function controlledState() {
  const state = structuredClone(completedBattlesForBootcamp());
  const runtime = state.runtime;
  assert.ok(runtime?.audition && runtime.battle);
  for (const contestant of runtime.initialContestants)
    contestant.relationships = Object.fromEntries(runtime.initialContestants.map(({ id }) => [id, [50]]));
  runtime.audition.changes = {};
  runtime.battle.changes = {};
  return state;
}

function shift(toId: string, before: number, after: number): PropertyChange {
  return {
    path: `relationships.${toId}`,
    before: [before],
    after: [before, after],
    cause: 'Recorded interaction',
  };
}

test('Relationship highlights use strict >5 net shifts, inclusive 15-point gaps, directed feelings and no self-pairs', () => {
  const state = controlledState();
  const episode = state.runtime?.audition;
  assert.ok(episode);
  const [a, b, c, d, e] = episode.order;
  episode.changes = {
    [a]: [shift(a, 50, 100), shift(b, 50, 55), shift(c, 50, 44), shift(d, 50, 70), shift(e, 50, 64)],
    [b]: [shift(a, 50, 45)],
    [c]: [shift(a, 50, 56)],
    [d]: [shift(a, 50, 55)],
  };
  const before = JSON.stringify(state);
  const updates = episodeRelationshipUpdates(state, 1);
  assert.deepEqual(updates.changes, [
    { fromId: a, toId: d, before: 50, after: 70, delta: 20 },
    { fromId: a, toId: e, before: 50, after: 64, delta: 14 },
    ...[
      { fromId: a, toId: c, before: 50, after: 44, delta: -6 },
      { fromId: c, toId: a, before: 50, after: 56, delta: 6 },
    ].sort((left, right) => left.fromId.localeCompare(right.fromId)),
  ]);
  assert.deepEqual(updates.gaps, [{ fromId: a, toId: d, fromValue: 70, toValue: 55, gap: 15 }]);
  assert.equal(JSON.stringify(state), before);
});

test('Relationships compare final episode values, not intermediate peaks or cumulative season changes', () => {
  const state = controlledState();
  const runtime = state.runtime;
  assert.ok(runtime?.audition && runtime.battle);
  const [a, b] = runtime.battle.participantIds;
  runtime.audition.changes = { [a]: [shift(b, 50, 70)] };
  runtime.battle.changes = {
    [a]: [shift(b, 70, 90), shift(b, 90, 73)],
    [b]: [shift(a, 50, 44)],
  };
  assert.deepEqual(episodeRelationshipUpdates(state, 2).changes, [
    { fromId: b, toId: a, before: 50, after: 44, delta: -6 },
  ]);
  runtime.battle.changes[a].push(shift(b, 73, 76));
  assert.ok(
    episodeRelationshipUpdates(state, 2).changes.some(
      (entry) => entry.fromId === a && entry.toId === b && entry.before === 70 && entry.delta === 6,
    ),
  );
  const archived = episodeRelationshipUpdates(state, 1);
  const person = state.contestants.find(({ id }) => id === a);
  assert.ok(person);
  person.relationships[b] = [0];
  assert.deepEqual(episodeRelationshipUpdates(state, 1), archived);
  assert.ok(archived.changes.some((entry) => entry.after === 70));
});

type ElementProps = {
  children?: ReactNode;
  onClick?: () => void;
  onBack?: () => void;
  'data-contestant-id'?: string;
};
function elements(node: ReactNode): ReactElement<ElementProps>[] {
  return Children.toArray(node).flatMap((child) =>
    isValidElement<ElementProps>(child) ? [child, ...elements(child.props.children)] : [],
  );
}

function NavigationHarness({
  state,
  controller,
}: {
  state: SimulationState;
  controller: { step: number; notes?: ReactNode };
}) {
  const tree = EpisodeEndScreens({
    state,
    episode: 1,
    onInspect: () => {},
    children: 'Original finale',
  });
  if (controller.step === 0) {
    const button = elements(tree).find(
      (entry) => entry.type === Button && entry.props.children === 'Relationships Updates',
    );
    assert.ok(button?.props.onClick);
    controller.step++;
    button.props.onClick();
  } else if (controller.step === 1) {
    assert.equal(tree.type, RelationshipUpdates);
    const notes = elements(tree).find((entry) => entry.type === RelationshipUpdates);
    assert.ok(notes?.props.onBack);
    controller.notes = notes;
    controller.step++;
    notes.props.onBack();
  }
  return tree;
}

test('Viewer-only relationship screens open after the finale, return without gameplay, link contestants and handle empty notes', () => {
  const state = controlledState();
  const runtime = state.runtime;
  const episode = runtime?.audition;
  assert.ok(runtime && episode);
  const [a, b] = episode.order;
  episode.changes = { [a]: [shift(b, 50, 75)], [b]: [shift(a, 50, 43)] };
  const before = JSON.stringify(state);
  const controller: { step: number; notes?: ReactNode } = { step: 0 };
  const final = renderToStaticMarkup(<NavigationHarness controller={controller} state={state} />);
  assert.equal(controller.step, 2);
  assert.match(final, /Original finale/);
  assert.ok(controller.notes);
  const notes = renderToStaticMarkup(controller.notes);
  assert.match(notes, /Relationships Updates/);
  assert.match(notes, /NOT PART OF THE BROADCAST/);
  assert.match(notes, /aria-label="Increased"/);
  assert.match(notes, /aria-label="Decreased"/);
  assert.match(notes, /Gap: 32 points/);
  assert.doesNotMatch(notes, /Mike Philip|class="[^"]*speaker/);
  const inspected: string[] = [];
  const content = RelationshipUpdates({
    state,
    episode: 1,
    onInspect: (id) => inspected.push(id),
    onBack: () => {},
  });
  const link = elements(content).find((entry) => entry.props['data-contestant-id'] === a);
  assert.ok(link?.props.onClick);
  link.props.onClick();
  assert.deepEqual(inspected, [a]);
  assert.equal(JSON.stringify(state), before);
  episode.changes = {};
  const empty = renderToStaticMarkup(
    <RelationshipUpdates episode={1} onBack={() => {}} onInspect={() => {}} state={state} />,
  );
  assert.match(empty, /No relationships changed by more than 5 points/);
  assert.match(empty, /No mutual-feeling gaps of 15 points or more/);
  const archive = renderToStaticMarkup(
    <EpisodeEndScreens enabled={false} episode={1} onInspect={() => {}} state={state}>
      Earlier scene
    </EpisodeEndScreens>,
  );
  assert.doesNotMatch(archive, /Relationships Updates/);
  runtime.audition = null;
  assert.throws(() => episodeRelationshipUpdates(state, 1), /Finish this episode/);
  const unfinished = renderToStaticMarkup(
    <EpisodeEndScreens episode={1} onInspect={() => {}} state={state}>
      Unfinished episode
    </EpisodeEndScreens>,
  );
  assert.doesNotMatch(unfinished, /Relationships Updates/);
});

test('All five relationship summaries match actual episode boundaries and remain frozen in later archives and copies', async () => {
  let state = narrativeBattleFixture();
  const snapshots: { episode: EpisodeNumber; contestants: Contestant[]; summary: string }[] = [];
  const players = [
    NarrativeAuditionView,
    NarrativeBattleView,
    BootcampEpisodeView,
    MegaGroupsEpisodeView,
    PhotoshootEpisodeView,
  ];
  for (const episode of [1, 2, 3, 4, 5] as const) {
    if (episode !== 1) state = await autoCompleteEpisode(state, episode);
    const runtime = state.runtime;
    assert.ok(runtime);
    const previous = snapshots.at(-1)?.contestants ?? runtime.initialContestants;
    const updates = episodeRelationshipUpdates(state, episode);
    const actual: string[] = [];
    for (const contestant of state.contestants) {
      const prior = previous.find(({ id }) => id === contestant.id);
      assert.ok(prior);
      for (const other of state.contestants) {
        if (other.id === contestant.id) continue;
        const before = prior.relationships[other.id]?.at(-1) ?? 50;
        const after = contestant.relationships[other.id]?.at(-1) ?? 50;
        if (Math.abs(after - before) > 5) actual.push(`${contestant.id}|${other.id}|${before}|${after}`);
      }
    }
    assert.deepEqual(
      updates.changes.map(({ fromId, toId, before, after }) => `${fromId}|${toId}|${before}|${after}`).sort(),
      actual.sort(),
      `Episode ${episode} must use its real starting and final relationship values`,
    );
    for (const gap of updates.gaps) {
      const first = state.contestants.find(({ id }) => id === gap.fromId);
      const second = state.contestants.find(({ id }) => id === gap.toId);
      assert.ok(first && second);
      assert.equal(gap.fromValue, first.relationships[second.id]?.at(-1) ?? 50);
      assert.equal(gap.toValue, second.relationships[first.id]?.at(-1) ?? 50);
    }
    const before = JSON.stringify(state);
    const summary = createRelationshipUpdatesMarkdown(state, episode);
    assert.ok(createEpisodeRundown(state, episode).endsWith(summary));
    const Player = players[episode - 1];
    const html = renderToStaticMarkup(<Player onAction={() => {}} onInspect={() => {}} state={state} />);
    assert.match(html, />Relationships Updates<\/span>/);
    assert.equal(JSON.stringify(state), before);
    snapshots.push({ episode, contestants: structuredClone(state.contestants), summary });
  }
  for (const { episode, summary } of snapshots)
    assert.equal(createRelationshipUpdatesMarkdown(state, episode), summary);
  const show = createShowRundown(state);
  assert.equal((show.match(/^## Relationships Updates$/gm) ?? []).length, 5);
  assert.equal((show.match(/Viewer-only observations, not part of the broadcast/g) ?? []).length, 5);
});
