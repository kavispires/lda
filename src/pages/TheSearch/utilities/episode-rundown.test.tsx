import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuditionEpisodeView } from '../components/AuditionEpisodeView';
import { BattleEpisodeView } from '../components/BattleEpisodeView';
import { CopyEpisodeRundown } from '../components/CopyEpisodeRundown';
import { copyMarkdown } from '../components/CopyMarkdownButton';
import { NarrativeBattlePlayer } from '../components/NarrativeBattlePlayer';
import { NarrativeAuditionView } from '../components/NarrativeEpisodeView';
import { advanceBattleTo, completedAuditionsFixture } from '../engine/battle-fixtures';
import { autoCompleteEpisode } from '../engine/episode-auto-complete';
import { advanceBattleStoryTo, narrativeBattleFixture } from '../engine/narrative-battle-fixtures';
import type { SimulationState } from '../types/simulation';
import { createEpisodeRundown } from './episode-rundown';

let auditions: SimulationState;
let battles: SimulationState;
function completedAuditions() {
  auditions ??= narrativeBattleFixture();
  return auditions;
}
function completedBattles() {
  battles ??= advanceBattleStoryTo(completedAuditions(), 'complete');
  return battles;
}
const noAction = () => {
  throw new Error('Copy controls must not advance the simulation.');
};

test('episode rundown includes every audition, montage introduction, judge comment, and final outcome as Markdown', () => {
  const state = completedAuditions();
  const before = JSON.stringify(state);
  const text = createEpisodeRundown(state, 1);
  const runtime = state.runtime;
  const episode = runtime?.audition;
  assert.ok(runtime);
  assert.ok(episode?.mvp && episode.secret);
  assert.match(text, /^# The Search - Episode 1: Auditions\n/);
  assert.match(text, /## Dramatization brief/);
  assert.match(text, /> /);
  assert.doesNotMatch(text, /<Tag>|<\/Tag>|undefined|NaN/);
  assert.equal((text.match(/They receive \*\*grade /g) ?? []).length, 50);
  assert.equal((text.match(/Leading judge \*\*/g) ?? []).length, 50);
  assert.equal((text.match(/^### Sequence /gm) ?? []).length, 11);
  for (const scene of episode.scenes) {
    if (scene.kind === 'secret' && !episode.secret.cardId) continue;
    assert.ok(text.includes(scene.title));
    for (const paragraphs of Object.values(scene.introductions ?? {}))
      for (const paragraph of paragraphs)
        assert.ok(text.includes(paragraph.replaceAll('<Tag>', '**').replaceAll('</Tag>', '**')));
  }
  for (const evaluation of episode.evaluations) {
    assert.ok(evaluation.panel);
    assert.ok(text.includes(evaluation.panel.comment));
  }
  assert.match(text, /\*\*Survivors \(30\):\*\*/);
  assert.match(text, /\*\*Departures \(20\):\*\*/);
  const winnerId = episode.mvp.winnerId;
  const winner = runtime.initialContestants.find((person) => person.id === winnerId);
  assert.ok(winner);
  assert.ok(text.includes(`**Peer MVP: ${winner.name}**`));
  if (episode.secret.cardId) assert.ok(text.includes(episode.secret.description));
  else assert.ok(!text.includes(episode.secret.description));
  assert.equal(JSON.stringify(state), before);
});

test('all episode rundowns read as the show and omit skipped or unsuccessful investigations without losing revelations', async () => {
  let season = completedBattles();
  for (const number of [3, 4, 5] as const) season = await autoCompleteEpisode(season, number);
  for (const number of [1, 2, 3, 4, 5] as const) {
    const state = structuredClone(season);
    const runtime = state.runtime;
    assert.ok(runtime);
    const record =
      number === 1
        ? runtime.audition
        : number === 2
          ? runtime.battle
          : number === 3
            ? runtime.bootcamp
            : number === 4
              ? runtime.megaGroups
              : runtime.photoshoot;
    assert.ok(record);
    record.scenes.unshift({
      id: 'show-language',
      kind: 'opening',
      title: 'The competition continues',
      paragraphs: ['This simulation follows the contestants. The SIMULATION has begun.'],
      contestantIds: [],
    });
    const before = JSON.stringify(state);
    const text = createEpisodeRundown(state, number);
    assert.match(text, /televised talent competition to find the next Squirrel Zone/);
    assert.match(text, /This show follows the contestants\. The show has begun\./);
    assert.doesNotMatch(text, /simulation/i);
    assert.equal(JSON.stringify(state), before, 'copying never rewrites stored scenes');
    if (!('secret' in record)) {
      assert.doesNotMatch(text, /investigat/i);
      continue;
    }
    const contestantId = 'order' in record ? record.order[0] : record.participantIds[0];
    const card = Object.values(runtime.definitions.cards.secret)[0];
    assert.ok(card);
    const otherScenes = record.scenes.filter((scene) => scene.kind !== 'secret');
    for (const outcome of ['miss', 'skipped', 'revealed'] as const) {
      record.secret =
        outcome === 'skipped'
          ? null
          : {
              contestantId,
              cardId: outcome === 'revealed' ? card.id : null,
              title: outcome === 'revealed' ? 'A real revelation' : 'No secret uncovered',
              description:
                outcome === 'revealed'
                  ? 'A previously hidden truth comes to light.'
                  : 'The check reveals nothing. Nothing changes.',
              deferred: [],
            };
      record.scenes = [
        ...otherScenes,
        {
          id: 'award-with-investigation-teaser',
          kind: 'mvp',
          title: 'Recognition',
          paragraphs: [
            'The contestants celebrate the award. Before we close, production has one final secret investigation.',
          ],
          contestantIds: [],
        },
        {
          id: 'investigation-choice',
          kind: 'secret',
          title: 'The secret investigation shortlist',
          paragraphs: ['Production chooses a contestant for investigation.'],
          contestantIds: [contestantId],
        },
        {
          id: 'investigation-result',
          kind: 'secret',
          title: record.secret?.title ?? 'The investigation desk is closed',
          paragraphs: [
            record.secret?.description ??
              'No active unrevealed secret remains. The investigation is skipped.',
          ],
          contestantIds: [contestantId],
        },
      ];
      const original = JSON.stringify(state);
      const copy = createEpisodeRundown(state, number);
      assert.doesNotMatch(copy, /simulation/i);
      assert.match(copy, /The contestants celebrate the award\./);
      if (outcome === 'revealed') {
        assert.match(copy, /A real revelation/);
        assert.match(copy, /A previously hidden truth comes to light\./);
        assert.match(copy, /investigat/i);
      } else {
        assert.doesNotMatch(copy, /investigat|No secret uncovered|The check reveals nothing/i);
        assert.doesNotMatch(copy, /A real revelation|A previously hidden truth/);
      }
      assert.equal(JSON.stringify(state), original);
    }
  }
});

test('episode rundown covers all Battles rehearsals, judges, saves, rankings, and recorded reactions', () => {
  const state = completedBattles();
  const before = JSON.stringify(state);
  const text = createEpisodeRundown(state, 2);
  const runtime = state.runtime;
  const episode = runtime?.battle;
  assert.ok(runtime);
  assert.ok(episode?.story);
  assert.match(text, /^# The Search - Episode 2: The Battles\n/);
  assert.equal((text.match(/^### Sequence /gm) ?? []).length, 8);
  assert.equal((text.match(/individual score \*\*/g) ?? []).length, 30);
  assert.equal((text.match(/Final team score: \*\*/g) ?? []).length, 6);
  assert.equal((text.match(/Production chooses to \*\*mediate\*\*/g) ?? []).length, 6);
  assert.equal((text.match(/^- Center ballot:/gm) ?? []).length, 30);
  assert.equal((text.match(/contributing .* team points\./g) ?? []).length, 18);
  assert.equal((text.match(/\*\*Winner:/g) ?? []).length, 3);
  assert.match(text, /\*\*Judges save: /);
  assert.match(text, /\*\*Audience save: /);
  assert.match(text, /\*\*Production save: /);
  const cast = runtime.initialContestants;
  for (const [index, id] of episode.survivorIds.entries()) {
    const person = cast.find((person) => person.id === id);
    assert.ok(person);
    assert.ok(text.includes(`${index + 1}. ${person.name}`));
  }
  for (const reaction of [...episode.story.rankReactions, ...episode.story.matchupReactions])
    assert.ok(text.includes(`feels ${reaction.emotion}`));
  assert.match(text, /\*\*Survivors \(18\):\*\*/);
  assert.match(text, /\*\*Departures \(12\):\*\*/);
  assert.match(text, /bottom of the ranking will be eliminated/);
  assert.doesNotMatch(text, /<Tag>|<\/Tag>|undefined|NaN/);
  assert.equal(JSON.stringify(state), before);
});

test('episode rundown for archived Auditions is identical after Battles and excludes later secrets and mutable state', () => {
  const expected = createEpisodeRundown(completedAuditions(), 1);
  const later = structuredClone(completedBattles());
  assert.equal(createEpisodeRundown(later, 1), expected);
  assert.ok(later.runtime?.battle?.secret);
  later.runtime.battle.secret.title = 'FUTURE SECRET TITLE';
  later.runtime.battle.secret.description = 'FUTURE SECRET DESCRIPTION';
  later.runtime.openingCast = ['FUTURE OPENING CAST'];
  for (const person of later.contestants) {
    person.name = 'FUTURE CONTESTANT NAME';
    person.personality.ambition = 999;
    person.rank = 999;
  }
  const hidden = Object.values(later.runtime.definitions.cards.secret)[0];
  hidden.name = 'UNREVEALED SECRET NAME';
  hidden.description = 'UNREVEALED SECRET DESCRIPTION';
  later.runtime.initialContestants[0].attributes.push(hidden.id);
  later.runtime.revealedSecrets.push({
    contestantId: later.runtime.initialContestants[0].id,
    cardId: hidden.id,
  });
  assert.equal(createEpisodeRundown(later, 1), expected);
  assert.doesNotMatch(createEpisodeRundown(later, 2), /UNREVEALED SECRET/);
});

test('episode rundown supports completed legacy episodes without inventing modern judges or a new ranking reveal', () => {
  const legacyAuditions = completedAuditionsFixture();
  const first = createEpisodeRundown(legacyAuditions, 1);
  const legacyBattles = advanceBattleTo(legacyAuditions, 'complete');
  const second = createEpisodeRundown(legacyBattles, 2);
  assert.equal(createEpisodeRundown(legacyBattles, 1), first);
  assert.match(first, /selected broadcast package/);
  assert.match(second, /selected broadcast package/);
  assert.doesNotMatch(first, /Leading judge \*\*/);
  assert.doesNotMatch(second, /Final survivor ranking|contributing .* team points/);
  for (const [episode, state] of [
    [1, legacyAuditions],
    [2, legacyBattles],
  ] as const) {
    const View = episode === 1 ? AuditionEpisodeView : BattleEpisodeView;
    const html = renderToStaticMarkup(<View onAction={noAction} onInspect={noAction} state={state} />);
    assert.match(html, /Copy episode rundown/);
  }
});

test('episode rundown converts narrative tags to emphasis and escapes Markdown in supplied names and descriptions', () => {
  const state = structuredClone(completedAuditions());
  const episode = state.runtime?.audition;
  assert.ok(state.runtime);
  assert.ok(episode);
  episode.scenes[0].paragraphs = ['A <Tag>Dance</Tag> audition; the title is [not a link](unsafe).'];
  state.runtime.initialContestants[0].name = 'A_*[name]';
  const text = createEpisodeRundown(state, 1);
  assert.ok(text.includes('A **Dance** audition; the title is \\[not a link\\](unsafe).'));
  assert.ok(text.includes('A\\_\\*\\[name\\]'));
});

test('episode rundown rejects unavailable and incomplete episodes and copy controls appear only after completion', () => {
  const state = structuredClone(completedAuditions());
  assert.throws(() => createEpisodeRundown(state, 2), /Finish this episode/);
  assert.equal(renderToStaticMarkup(<CopyEpisodeRundown episode={2} state={state} />), '');
  assert.ok(state.runtime?.audition);
  state.runtime.audition.phase = 'secret';
  assert.throws(() => createEpisodeRundown(state, 1), /Finish this episode/);
  assert.equal(renderToStaticMarkup(<CopyEpisodeRundown episode={1} state={state} />), '');
  state.runtime.audition.phase = 'complete';
  for (const [View, completed] of [
    [NarrativeAuditionView, completedAuditions()],
    [NarrativeBattlePlayer, completedBattles()],
  ] as const) {
    assert.match(
      renderToStaticMarkup(<View onAction={noAction} onInspect={noAction} state={completed} />),
      /Copy episode rundown/,
    );
  }
});

test('episode rundown clipboard waits for the actual write, copies Markdown, and propagates permission failures', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    let copied = '';
    let finish!: () => void;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        clipboard: {
          writeText: (text: string) => {
            copied = text;
            return new Promise<void>((resolve) => {
              finish = resolve;
            });
          },
        },
      },
    });
    let resolved = false;
    const pending = copyMarkdown(createEpisodeRundown(completedAuditions(), 1)).then(() => {
      resolved = true;
    });
    assert.equal(copied, createEpisodeRundown(completedAuditions(), 1));
    await Promise.resolve();
    assert.equal(resolved, false);
    finish();
    await pending;
    assert.equal(resolved, true);
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        clipboard: {
          writeText: async () => {
            throw new Error('Clipboard permission denied');
          },
        },
      },
    });
    await assert.rejects(
      copyMarkdown(createEpisodeRundown(completedBattles(), 2)),
      /Clipboard permission denied/,
    );
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    await assert.rejects(
      copyMarkdown(createEpisodeRundown(completedAuditions(), 1)),
      /Clipboard access is unavailable/,
    );
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
});
