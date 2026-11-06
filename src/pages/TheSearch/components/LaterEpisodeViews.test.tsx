import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Button, Modal } from 'antd';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { completedBattlesForBootcamp } from '../engine/bootcamp-fixtures';
import { autoCompleteEpisode } from '../engine/episode-auto-complete';
import type { MegaGroupsAction } from '../types/mega-groups-episode';
import type { PhotoshootAction } from '../types/photoshoot-episode';
import type { SimulationState } from '../types/simulation';
import { photoshootRankingReactions } from '../utilities/photoshoot-ranking-reactions';
import { createPhotoshootRundown } from '../utilities/photoshoot-rundown';
import { MegaGroupsEpisodeView } from './MegaGroupsEpisodeView';
import { NarrativeStage } from './NarrativeStage';
import { PhotoshootEpisodeView } from './PhotoshootEpisodeView';

let baseline: Promise<SimulationState> | undefined;
async function completedSeason() {
  baseline ??= (async () => {
    let state = completedBattlesForBootcamp();
    for (const episode of [3, 4, 5] as const) state = await autoCompleteEpisode(state, episode);
    return state;
  })();
  return structuredClone(await baseline);
}

type ElementProps = {
  children?: ReactNode;
  open?: boolean;
  closable?: boolean;
  keyboard?: boolean;
  mask?: { closable?: boolean };
  footer?: ReactNode;
  onClick?: () => void;
};
function elements(node: ReactNode): ReactElement<ElementProps>[] {
  return Children.toArray(node).flatMap((child) =>
    isValidElement<ElementProps>(child) ? [child, ...elements(child.props.children)] : [],
  );
}

type ActionHandler = (action: MegaGroupsAction | PhotoshootAction, revision: number) => void;

function CapturePlayer({
  state,
  episode,
  onAction,
  capture,
}: {
  state: SimulationState;
  episode: 4 | 5;
  onAction: ActionHandler;
  capture: (tree: ReactNode) => void;
}) {
  const props = {
    state,
    onAction,
    onInspect: () => {},
    actionError: 'Could not save this decision.',
  };
  capture(episode === 4 ? MegaGroupsEpisodeView(props) : PhotoshootEpisodeView(props));
  return null;
}

function player(
  state: SimulationState,
  episode: 4 | 5,
  onAction: ActionHandler = () => {
    assert.fail('Rendering must not dispatch gameplay');
  },
) {
  let tree: ReactNode;
  renderToStaticMarkup(
    <CapturePlayer
      capture={(value) => {
        tree = value;
      }}
      episode={episode}
      onAction={onAction}
      state={state}
    />,
  );
  assert.ok(tree);
  return tree;
}

test('Episodes 4 and 5 opening cards show the five confirmed portraits without an extra contestant roster', async () => {
  for (const number of [4, 5] as const) {
    const state = await completedSeason();
    const record = number === 4 ? state.runtime?.megaGroups : state.runtime?.photoshoot;
    const preparation = state.runtime?.preparations?.[number];
    assert.ok(record && preparation);
    const opening = record.scenes.find((scene) => scene.sequence === 2);
    assert.ok(opening);
    assert.equal(opening.presentation, 'credits');
    record.phase = 'credits';
    record.scenes = [opening];
    const html = renderToStaticMarkup(player(state, number));
    assert.match(html, /aria-label="Opening cast"/, `Episode ${number} must play the shared opening`);
    assert.equal((html.match(/data-contestant-id=/g) ?? []).length, 5);
    assert.doesNotMatch(html, /aria-label="Contestant details"/);
    for (const id of preparation.slots) {
      assert.ok(id);
      assert.ok(html.includes(`images/contestants/${id}.jpg`));
    }
    opening.presentation = 'performance';
    const oldSave = renderToStaticMarkup(player(state, number));
    assert.match(oldSave, /aria-label="Opening cast"/);
    assert.equal((oldSave.match(/data-contestant-id=/g) ?? []).length, 5);
    assert.doesNotMatch(oldSave, /aria-label="Contestant details"/);
  }
});

test('Episodes 4 and 5 require blocking modals for every production and investigation decision', async () => {
  for (const [number, phase, label, expected] of [
    [4, 'intervention', 'Support', { type: 'conflict', choice: 'support' }],
    [4, 'secret-choice', 'Investigate', null],
    [5, 'styling-choice', 'Intervene', { type: 'styling', choice: 'intervene' }],
    [5, 'secret-choice', 'Investigate', null],
  ] as const) {
    const state = await completedSeason();
    if (number === 4) {
      assert.ok(state.runtime?.megaGroups);
      state.runtime.megaGroups.phase = phase;
      state.runtime.megaGroups.secretCandidates = state.runtime.megaGroups.participantIds.slice(0, 3);
    } else {
      assert.ok(state.runtime?.photoshoot);
      state.runtime.photoshoot.phase = phase;
      state.runtime.photoshoot.secretCandidates = state.runtime.photoshoot.participantIds.slice(0, 3);
    }
    const record = number === 4 ? state.runtime?.megaGroups : state.runtime?.photoshoot;
    assert.ok(record);
    const actions: unknown[] = [];
    const tree = player(state, number, (action, revision) => actions.push([action, revision]));
    const modal = elements(tree).find((element) => element.type === Modal && element.props.open);
    assert.ok(modal, `Episode ${number} ${phase} must open a decision modal`);
    assert.equal(modal.props.closable, false);
    assert.equal(modal.props.keyboard, false);
    assert.equal(modal.props.mask?.closable, false);
    assert.equal(modal.props.footer, null);
    assert.match(renderToStaticMarkup(modal.props.children), /Could not save this decision/);
    const stage = elements(tree).find((element) => element.type === NarrativeStage);
    assert.ok(stage);
    assert.doesNotMatch(
      renderToStaticMarkup(stage.props.children),
      /bring in stylists|keep creative control|>Support<|>Mediate<|>Push<|Investigate /,
    );
    const button = elements(modal.props.children).find(
      (element) => element.type === Button && renderToStaticMarkup(element).includes(label),
    );
    assert.ok(button?.props.onClick);
    assert.deepEqual(actions, []);
    button.props.onClick();
    assert.deepEqual(actions, [
      [expected ?? { type: 'secret', contestantId: record.secretCandidates[0] }, record.revision],
    ]);
  }
});

test('Photoshoot finale keeps one ranking instead of relisting the cast', async () => {
  const state = await completedSeason();
  const episode = state.runtime?.photoshoot;
  assert.ok(episode);
  const html = renderToStaticMarkup(player(state, 5));
  const stage = html.match(/<section aria-label="Episode 5 narrative"[\s\S]*?<\/section>/)?.[0];
  assert.ok(stage);
  assert.equal((stage.match(/aria-label="Episode 5 standings"/g) ?? []).length, 1);
  assert.doesNotMatch(stage, /aria-label="Contestant details"/);
});

test('Photoshoot finale records reactions to the largest actual rise and fall', async () => {
  const state = await completedSeason();
  const episode = state.runtime?.photoshoot;
  assert.ok(episode);
  const movers = episode.rankedIds.map((id, index) => ({
    id,
    movement: episode.previousRankedIds.indexOf(id) - index,
  }));
  const rise = [...movers].sort((left, right) => right.movement - left.movement)[0];
  const fall = [...movers].sort((left, right) => left.movement - right.movement)[0];
  assert.ok(rise.movement >= 3 && fall.movement <= -3);
  const finale = episode.scenes.at(-1);
  assert.ok(finale);
  for (const mover of [rise, fall]) {
    const name = state.contestants.find(({ id }) => id === mover.id)?.name;
    assert.ok(name);
    assert.ok(
      finale.paragraphs.some(
        (paragraph) => paragraph.includes(name) && /\b(climbs|rises|drops|falls)\b/.test(paragraph),
      ),
      `${name} must react to moving ${mover.movement} places`,
    );
  }
  assert.ok(finale.contestantIds.length < 16);
  assert.deepEqual(finale.paragraphContestantIds, [...finale.contestantIds.map((id) => [id]), []]);
  for (const id of episode.rankedIds.slice(-3)) {
    const name = state.contestants.find((entry) => entry.id === id)?.name;
    assert.ok(name);
    assert.ok(finale.paragraphs.some((line) => line.includes(name) && line.includes('bottom three')));
  }
  const copy = createPhotoshootRundown(state);
  for (const paragraph of finale.paragraphs) assert.ok(copy.includes(paragraph));
});

test('Previously saved Photoshoot finales show reactions without rewriting outcomes or history', async () => {
  const state = await completedSeason();
  const episode = state.runtime?.photoshoot;
  const finale = episode?.scenes.at(-1);
  assert.ok(episode && finale);
  finale.paragraphs.push('The room lets out a final cheer.');
  finale.paragraphContestantIds?.push([]);
  assert.match(renderToStaticMarkup(player(state, 5)), /The room lets out a final cheer/);
  assert.match(createPhotoshootRundown(state), /The room lets out a final cheer/);
  finale.kind = 'recap';
  finale.contestantIds = [...episode.rankedIds];
  finale.paragraphs = [
    ...episode.rankedIds.map((id, index) => {
      const contestant = episode.startingContestants.find((entry) => entry.id === id);
      assert.ok(contestant);
      return `${index + 1}. ${contestant.name}.`;
    }),
    'All sixteen continue. Episode 5 is complete. Episode 6 is next and has not begun.',
  ];
  finale.paragraphContestantIds = [...episode.rankedIds.map((id) => [id]), []];
  const before = JSON.stringify(state);
  const tree = player(state, 5);
  const stage = elements(tree).find((element) => element.type === NarrativeStage);
  assert.ok(stage);
  const html = renderToStaticMarkup(stage);
  assert.equal((html.match(/aria-label="Episode 5 standings"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /aria-label="Contestant details"/);
  assert.match(html, /climbs \d+ places/);
  assert.match(html, /drops \d+ places/);
  const closingCopy = createPhotoshootRundown(state)
    .split('#### The Photoshoot: sixteen continue')[1]
    ?.split('## Concept teams')[0];
  assert.ok(closingCopy);
  assert.match(closingCopy, /climbs \d+ places/);
  assert.match(closingCopy, /drops \d+ places/);
  assert.doesNotMatch(closingCopy, /^\d+\. /m);
  assert.equal(JSON.stringify(state), before);
});

test('Unchanged Photoshoot standings focus on bottom-three concern, not invented movement', async () => {
  const state = await completedSeason();
  const episode = state.runtime?.photoshoot;
  assert.ok(episode);
  episode.previousRankedIds = [...episode.rankedIds];
  const reactions = photoshootRankingReactions(episode);
  assert.deepEqual(reactions.contestantIds, episode.rankedIds.slice(-3));
  assert.doesNotMatch(reactions.paragraphs.join('\n'), /\bclimbs\b|\bdrops\b/);
  episode.rankRevealed = false;
  assert.throws(() => photoshootRankingReactions(episode), /announced ranking/);
});
