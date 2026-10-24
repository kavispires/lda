import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { BootcampEpisodeView } from '../components/BootcampEpisodeView';
import { CopyEpisodeRundown } from '../components/CopyEpisodeRundown';
import { PersonnelAvatar } from '../components/personnel/PersonnelAvatar';
import { transitionBootcamp } from '../engine/bootcamp-episode';
import { completedBattlesForBootcamp, nextBootcampAction } from '../engine/bootcamp-fixtures';
import { advanceBattleStoryTo, narrativeBattleFixture } from '../engine/narrative-battle-fixtures';
import type { BootcampEpisode, BootcampEvaluation } from '../types/bootcamp-episode';
import type { SimulationState } from '../types/simulation';
import { createSeasonCastProfiles } from './contestant-profile';
import { createEpisodeRundown } from './episode-rundown';
import { projectEpisodeContestant } from './episode-visibility';

let battles: SimulationState;
function fixture() {
  battles ??= advanceBattleStoryTo(narrativeBattleFixture(), 'complete');
  const state = structuredClone(battles);
  const runtime = state.runtime!;
  const ids = runtime.battle!.survivorIds;
  const episode: BootcampEpisode = {
    version: 1,
    phase: 'complete',
    revision: 90,
    lastAction: { revision: 89, action: { type: 'advance' } },
    participantIds: [...ids],
    previousRankedIds: [...ids],
    groups: [0, 1, 2].map((index) => {
      const members = ids.slice(index * 6, index * 6 + 6);
      return {
        id: `group-${index + 1}`,
        memberIds: members,
        pairs: [members.slice(0, 2), members.slice(2, 4), members.slice(4, 6)],
        ballots: {
          1: Object.fromEntries(members.map((id) => [id, members.slice(0, 2)])),
          2: Object.fromEntries(members.map((id) => [id, members.slice(2, 4)])),
        },
        tieKeys: { 1: Object.fromEntries(members.map((id, i) => [id, i / 6])) },
      };
    }),
    round: 4,
    roomCursor: 5,
    groupCursor: 3,
    evaluations: ids.flatMap((id, index): BootcampEvaluation[] => [
      {
        contestantId: id,
        round: Math.floor((index % 6) / 2) + 1,
        rawDice: [2, 3],
        checks: { stamina: { skillLevel: 3, adjustedDice: [3, 3], score: 60 } },
        baseScore: 60,
        finalScore: 65,
        fatigue: 2,
        tieBreakKey: 0.5,
        events: [
          {
            kind: 'support',
            narrative: 'Recorded practical support.',
            contestantIds: [id],
            scoreDelta: 5,
            spotlight: 1,
            relationships: [{ observerId: id, targetId: ids[(index + 1) % ids.length], delta: 1 }],
          },
        ],
      },
      {
        contestantId: id,
        round: 4,
        rawDice: [4, 5],
        checks: { consistency: { skillLevel: 3, adjustedDice: [4, 5], score: 80 } },
        baseScore: 80,
        finalScore: 76,
        fatigue: 2,
        tieBreakKey: 0.6,
        events: [],
      },
    ]),
    groupResults: [0, 1, 2].map((index) => ({
      groupId: `group-${index + 1}`,
      tieBreakKey: 0.25 + index / 10,
      score: 70,
      resets: 5,
      assisted: true,
      staging: ids.slice(index * 6, index * 6 + 6),
      attempts: [{ reset: 5, timing: { [ids[index * 6]]: 55 } }],
    })),
    winners: [ids[0], ids[2], ids[4], ids[6]],
    winningGroupId: 'group-1',
    scoreAwardsApplied: true,
    exposure: Object.fromEntries(ids.map((id) => [id, 1 / 18])),
    audience: {
      votes: Object.fromEntries(ids.map((id) => [id, 100])),
      receptions: Object.fromEntries(ids.map((id) => [id, 0.5])),
      newFans: Object.fromEntries(ids.map((id) => [id, 10])),
      votingPopulation: 1800,
      newViewers: 50,
      satisfactionBefore: 50,
      satisfactionAfter: 55,
      attention: 0.5,
      enjoyment: 0.6,
    },
    mvp: {
      ballots: Object.fromEntries(ids.map((id, index) => [id, ids[(index + 1) % ids.length]])),
      totals: Object.fromEntries(ids.map((id) => [id, 1])),
      winnerId: ids[0],
      tiedIds: [...ids],
    },
    rankedIds: [...ids].reverse(),
    rankRevealed: true,
    initialState: Object.fromEntries(
      state.contestants.map((person) => [
        person.id,
        { condition: person.condition, practice: person.aggregations.practice },
      ]),
    ),
    startingContestants: structuredClone(state.contestants),
    scenes: [
      {
        id: 'dorms',
        kind: 'recap',
        title: 'Empty beds',
        sequence: 1,
        paragraphs: ['Recorded room opinion.'],
        contestantIds: [ids[0]],
      },
      {
        id: 'finale',
        kind: 'recap',
        title: 'Relief and recognition',
        sequence: 8,
        paragraphs: ['All eighteen remain.'],
        contestantIds: [...ids],
        speaker: { name: 'Mike Philip', role: 'Host' },
      },
    ],
    changes: {},
  };
  runtime.bootcamp = episode;
  return { state, runtime, episode, ids };
}

test('Boot Camp rundown preserves real challenge evidence, ballots, fatigue, group attempts and outcomes', () => {
  const { state, runtime, episode } = fixture();
  const before = JSON.stringify(state);
  const text = createEpisodeRundown(state, 3);
  assert.match(text, /^# The Search - Episode 3: Boot Camp/);
  assert.equal((text.match(/^### Round \d —/gm) ?? []).length, 36);
  assert.equal((text.match(/ nominates /g) ?? []).length, 36);
  assert.match(text, /Raw dice: 2 \+ 3/);
  assert.match(text, /adjusted dice 3 \+ 3/);
  assert.match(text, /temporary fatigue 2/);
  assert.match(text, /Recorded practical support/);
  assert.match(text, /5 resets; assisted finish \/ safety stop/);
  assert.match(text, /Round 4 individual winner/);
  assert.match(text, /Peer MVP:/);
  assert.match(text, /1\. /);
  assert.doesNotMatch(text, /undefined|NaN|Leading judge|selected broadcast|investigated contestant/i);
  for (const secret of Object.values(runtime.definitions.cards.secret)) {
    assert.ok(!text.includes(secret.id));
  }
  assert.equal(JSON.stringify(state), before);
  episode.phase = 'relief';
  assert.throws(() => createEpisodeRundown(state, 3), /Finish this episode/);
});

test('Boot Camp does not alter archived rundowns or initialization-only cast profiles', () => {
  const { state, runtime } = fixture();
  const previous = { ...state, runtime: { ...runtime, bootcamp: undefined } };
  for (const episode of [1, 2] as const)
    assert.equal(createEpisodeRundown(state, episode), createEpisodeRundown(previous, episode));
  assert.equal(createSeasonCastProfiles(runtime), createSeasonCastProfiles(previous.runtime));
});

test('Boot Camp projection preserves public Episode 2 scores until ranking and never reapplies battle projection', () => {
  const { state, runtime, episode, ids } = fixture();
  const person = state.contestants.find((entry) => entry.id === ids[0])!;
  const prior = episode.startingContestants.find((entry) => entry.id === ids[0])!;
  person.rank = 18;
  person.aggregations.score = 999999;
  person.aggregations.audienceRatio = 0.99;
  person.grade = 'F';
  person.changeLog.push({ ...structuredClone(prior.changeLog.at(-1)!), episode: 3, score: 999999 });
  episode.phase = 'relief';
  episode.rankRevealed = false;
  const hidden = projectEpisodeContestant(person, runtime);
  assert.equal(hidden.rank, prior.rank);
  assert.equal(hidden.aggregations.score, prior.aggregations.score);
  assert.equal(hidden.aggregations.audienceRatio, prior.aggregations.audienceRatio);
  assert.equal(hidden.grade, 'F');
  assert.ok(hidden.changeLog.every((entry) => entry.episode !== 3));
  episode.rankRevealed = true;
  const visible = projectEpisodeContestant(person, runtime);
  assert.equal(visible.rank, 18);
  assert.equal(visible.aggregations.score, 999999);
  assert.equal(visible.grade, 'F');
});

test('Boot Camp player offers explicit start without spoiling exercises or the finale', () => {
  const { state, runtime } = fixture();
  runtime.bootcamp = null;
  delete runtime.preparations?.[3];
  const html = renderToStaticMarkup(
    <BootcampEpisodeView onAction={() => {}} onInspect={() => {}} state={state} />,
  );
  assert.match(html, /Start Episode 3/);
  assert.doesNotMatch(
    html,
    /no elimination|all eighteen remain|Marathon Mic|Action Sequence|Distraction Box|Sync Gauntlet/i,
  );
  const avatar = renderToStaticMarkup(<PersonnelAvatar name="Sargent Miller" />);
  assert.match(avatar, /Sargent Miller portrait/);
  assert.match(avatar, /<svg/);
});

test('Boot Camp player presents actual speaker metadata and only offers rundown after completion', () => {
  const { state, episode } = fixture();
  const html = renderToStaticMarkup(
    <BootcampEpisodeView onAction={() => {}} onInspect={() => {}} state={state} />,
  );
  assert.match(html, /Mike Philip/);
  assert.match(html, /Copy episode rundown/);
  episode.phase = 'ballots';
  episode.scenes = episode.scenes.slice(0, 1);
  episode.evaluations = [];
  episode.groupResults = [];
  episode.winners = [];
  episode.mvp = null;
  episode.rankRevealed = false;
  const partial = renderToStaticMarkup(
    <BootcampEpisodeView onAction={() => {}} onInspect={() => {}} state={state} />,
  );
  assert.match(partial, /Empty beds/);
  assert.doesNotMatch(partial, /All eighteen remain|Copy episode rundown/);
  assert.equal(renderToStaticMarkup(<CopyEpisodeRundown episode={3} state={state} />), '');
});

test('Boot Camp trainer dialogue renders portraits and ordered contestant references, including namesakes', () => {
  const { state, episode, ids } = fixture();
  const first = state.contestants.find((person) => person.id === ids[0])!;
  const second = state.contestants.find((person) => person.id === ids[1])!;
  first.name = 'Shared Name';
  second.name = 'Shared Name';
  episode.scenes = [
    {
      id: 'assessment',
      kind: 'recap',
      title: 'Miller assesses the pair',
      sequence: 4,
      paragraphs: [],
      contestantIds: [],
      dialogues: [
        {
          name: 'Sargent Miller',
          role: 'Boot Camp trainer',
          paragraphs: ['Shared Name maintained their pacing.', 'Shared Name recovered their timing.'],
          paragraphContestantIds: [[first.id], [second.id]],
        },
      ],
    },
  ];
  const before = JSON.stringify(state);
  const html = renderToStaticMarkup(
    <BootcampEpisodeView onAction={() => {}} onInspect={() => {}} state={state} />,
  );
  assert.match(html, /Sargent Miller portrait/);
  assert.match(html, /Boot Camp trainer/);
  assert.match(html, /maintained their pacing/);
  assert.match(html, /recovered their timing/);
  const dialogueHtml = html.replace(/<ol aria-label="Episode 3 ranking"[\s\S]*?<\/ol>/g, '');
  const linkedIds = [...dialogueHtml.matchAll(/data-contestant-id="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(linkedIds, [first.id, second.id]);
  const text = createEpisodeRundown(state, 3);
  assert.match(text, /\*\*Sargent Miller \(Boot Camp trainer\):\*\*/);
  assert.match(text, /> Shared Name maintained their pacing/);
  assert.equal(JSON.stringify(state), before);
});

test('actual Boot Camp flow renders every phase without raw tokens, premature finale claims, or early rundown copying', () => {
  let state = completedBattlesForBootcamp();
  const rendered = new Set<string>();
  const noAction = () => {
    throw new Error('Rendering must not dispatch an action.');
  };
  for (let beat = 0; beat < 160; beat++) {
    const phase = state.runtime?.bootcamp?.phase;
    const preparation = state.runtime?.preparations?.[3];
    const key = phase ?? (preparation ? (preparation.mood ? 'opening-cast' : 'mood') : 'start');
    if (!rendered.has(key)) {
      const html = renderToStaticMarkup(
        <BootcampEpisodeView onAction={noAction} onInspect={noAction} state={state} />,
      );
      assert.doesNotMatch(html, /\{\{|\}\}|&lt;\/?Tag&gt;|\bNaN\b|\bundefined\b/, key);
      if (!phase || !['relief', 'mvp', 'ranking', 'complete'].includes(phase))
        assert.doesNotMatch(
          html,
          /no[- ]elimination|not an elimination|all eighteen (?:remain|are staying)|everyone.{0,80}safe tonight/i,
          key,
        );
      if (phase !== 'complete') assert.doesNotMatch(html, /Copy episode rundown/, key);
      else assert.match(html, /Copy episode rundown/);
      if (phase === 'performance') {
        assert.match(html, /Sargent Miller portrait/);
        assert.match(html, /Boot Camp trainer/);
      }
      rendered.add(key);
    }
    if (phase === 'complete') break;
    const { action, revision } = nextBootcampAction(state);
    state = transitionBootcamp(state, action, revision);
  }
  for (const phase of [
    'start',
    'mood',
    'dorms',
    'credits',
    'briefing',
    'groups',
    'ballots',
    'reveal',
    'performance',
    'winner',
    'relief',
    'mvp',
    'ranking',
    'complete',
  ])
    assert.ok(rendered.has(phase), `Rendered actual ${phase} phase`);
});
