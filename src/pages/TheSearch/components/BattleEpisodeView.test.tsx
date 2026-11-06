import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { transitionBattle } from '../engine/battle-episode';
import { completedAuditionsFixture } from '../engine/battle-fixtures';
import type { AuditionEpisode, EpisodeScene } from '../types/audition-episode';
import type { BattleEpisode, BattlePhase, BattleTeam } from '../types/battle-episode';
import type { SimulationState } from '../types/simulation';
import { createContestant } from '../utilities/contestant-factory';
import { BattleEpisodeView } from './BattleEpisodeView';

function fixture(phase: BattlePhase = 'dorms'): SimulationState {
  const contestants = ['a', 'b', 'c', 'd'].map((id) =>
    createContestant({ id, name: `Contestant ${id.toUpperCase()}`, updatedAt: 1 }),
  );
  const audition: AuditionEpisode = {
    version: 1,
    relationshipPolicy: 'everyone-forms-opinions',
    phase: 'complete',
    revision: 1,
    lastAction: { revision: 0, action: { type: 'start' } },
    pool: [],
    moodOptions: {
      vocalColor: [],
      danceStyle: [],
      rapStyle: [],
      visualVibe: [],
      leadershipStyle: [],
      genreAffinity: [],
    },
    mood: null,
    songChoices: {},
    order: [],
    cursor: 0,
    evaluations: [],
    batches: [],
    composure: {},
    reactions: [],
    scenes: [],
    changes: {},
    cuts: [],
    selectedCutId: null,
    audience: null,
    rankedIds: [],
    survivorIds: contestants.map((person) => person.id),
    eliminatedIds: [],
    revealedEliminations: 0,
    mvp: null,
    secretCandidates: [],
    secret: null,
  };
  const team = (id: string, memberIds: string[]): BattleTeam => ({
    id,
    name: `Team ${id.toUpperCase()}`,
    captainId: memberIds[0],
    memberIds,
    songId: 'unrevealed-song',
    centerId: memberIds[1],
    centerBallots: {},
    partAssignments: {},
    partReactions: {},
    coordination: 0,
    practice: [],
  });
  const battle: BattleEpisode = {
    version: 1,
    phase,
    revision: 7,
    lastAction: { revision: 6, action: { type: 'advance' } },
    participantIds: contestants.map((person) => person.id),
    rankedIds: ['d', 'c', 'b', 'a'],
    finalRankedIds: ['a', 'b', 'c', 'd'],
    rooms: [{ id: 'room-1', memberIds: ['a', 'b'] }],
    roomCursor: 1,
    teams: [team('a', ['a', 'b']), team('b', ['c', 'd'])],
    draftRound: 1,
    pairings: [{ id: 'match-1', teamIds: ['a', 'b'], winnerId: 'b' }],
    teamCursor: 0,
    performances: [],
    composure: {},
    conflict: null,
    conflictChoice: null,
    scenes: [],
    changes: {},
    cuts: [],
    selectedCutId: null,
    audience: null,
    judgeSaveId: 'a',
    audienceSaveId: 'b',
    productionShortlist: ['c'],
    productionSaveId: 'c',
    survivorIds: ['a', 'b', 'c'],
    eliminatedIds: ['d'],
    revealedResults: 0,
    mvp: null,
    secretCandidates: ['a'],
    secret: null,
  };
  return {
    contestants,
    status: 'ready',
    createdAt: 1,
    persistenceError: null,
    runtime: {
      version: 1,
      runId: 'frozen-run',
      seed: 1,
      randomState: 1,
      episode: 2,
      phase: 'battles',
      setup: { useBias: false, selectedIds: contestants.map((person) => person.id) },
      sourceContestants: Object.fromEntries(contestants.map((person) => [person.id, person])),
      initialContestants: contestants,
      definitions: {
        cards: { persona: {}, identity: {}, interest: {}, secret: {} },
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
      audition,
      battle,
      show: { audience: 0, satisfaction: 0, general: 0, fans: {}, pendingAttrition: 0 },
      revealedSecrets: [],
      deferredConsequences: [],
    },
  };
}

function episode(state: SimulationState) {
  assert.ok(state.runtime?.battle);
  return state.runtime.battle;
}

function scene(
  id: string,
  kind: EpisodeScene['kind'],
  paragraphs: string[],
  contestantIds = ['a'],
): EpisodeScene {
  return { id, kind, title: `Scene ${id}`, paragraphs, contestantIds };
}

function render(state: SimulationState, actionError?: string) {
  const before = structuredClone(state);
  const html = renderToStaticMarkup(
    <BattleEpisodeView
      actionError={actionError}
      onAction={() => assert.fail('render must never dispatch')}
      onInspect={() => assert.fail('render must never inspect')}
      state={state}
    />,
  );
  assert.deepEqual(state, before, 'view must not mutate persisted state');
  return html;
}

test('Episode 2 starts explicitly only after the audition is complete', () => {
  const state = fixture();
  assert.ok(state.runtime);
  state.runtime.battle = null;
  assert.match(render(state), /Start Episode 2/);
  assert.ok(state.runtime.audition);
  state.runtime.audition.phase = 'live';
  assert.equal(render(state), '');
  state.runtime = null;
  assert.equal(render(state), '');
});

test('dorms reveal neither the ranking, draft teams nor future audience and result information', () => {
  const state = fixture();
  episode(state).scenes = [scene('dorms-1', 'dorms', ['The first room meets.'])];
  const html = render(state);
  assert.match(html, /Moving into the dorms/);
  assert.match(html, /Continue — Moving into the dorms/);
  assert.match(html, /room highlights shown: 1 \/ 5/);
  for (const hidden of [
    'Opening overall ranking',
    'Teams and revealed preparation',
    'Battle matchups',
    'audience votes',
    'Winner:',
    'Announced departures',
    'unrevealed-song',
  ]) {
    assert.ok(!html.includes(hidden), `${hidden} must remain hidden`);
  }
});

test('all five complete room assignments are visible on arrival before any room highlight', () => {
  const state = transitionBattle(completedAuditionsFixture(), { type: 'start' }, 0);
  assert.equal(episode(state).roomCursor, 0);
  const html = render(state);
  const assignments = html.match(/<section aria-label="Dorm room assignments">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(assignments, 'room assignments should be expanded on arrival');
  for (let index = 1; index <= 5; index++) {
    assert.ok(assignments.includes(`Room ${index} — 6 contestants`));
  }
  assert.equal((assignments.match(/>Performer \d+</g) ?? []).length, 30);
  for (const id of episode(state).participantIds) {
    const contestant = state.contestants.find((entry) => entry.id === id);
    assert.ok(contestant);
    assert.ok(assignments.includes(`>${contestant.name}<`));
  }
});

test('the stage ranking is available after dorms without revealing the draft or production formula', () => {
  const state = fixture('ranking');
  episode(state).scenes = [
    scene('ranking', 'ranking', ['Public votes and performances contribute to the overall ranking.']),
  ];
  const html = render(state);
  assert.match(html, /Opening overall ranking/);
  assert.match(html, /debut top five/);
  for (const hidden of [
    'Teams and revealed preparation',
    'productionRatio',
    '60/30/10',
    '0.75',
    'Revealed audience votes',
  ]) {
    assert.ok(!html.includes(hidden));
  }
});

test('drafts put portrait buttons after name-only sentences while rankings keep portraits in their rows', () => {
  for (const kind of ['draft', 'ranking'] as const) {
    const state = fixture(kind);
    const saved = scene(
      kind,
      kind,
      kind === 'draft'
        ? ['Contestant A selects Contestant B because charisma breaks the relationship tie.']
        : ['The host announces the ranking.', '1. Contestant A', '2. Contestant B'],
    );
    saved.paragraphContestantIds = kind === 'draft' ? [['a', 'b']] : [[], ['a'], ['b']];
    episode(state).scenes = [saved];
    const html = render(state);
    const current = html.match(new RegExp(`<section aria-label="Scene ${kind}">([\\s\\S]*?)</section>`))?.[1];
    assert.ok(current);
    assert.ok(current.includes('data-contestant-id="a"'));
    assert.ok(current.includes('data-contestant-id="b"'));
    assert.ok(current.includes('images/contestants/a.jpg'));
    assert.ok(current.includes('images/contestants/b.jpg'));
    const footerIndex = current.indexOf('aria-label="Contestant details"');
    if (kind === 'draft') {
      assert.ok(current.includes('charisma breaks'));
      assert.ok(footerIndex > current.indexOf('charisma breaks'));
      assert.ok(!current.slice(0, footerIndex).includes('<img'));
      const footer = current.slice(footerIndex);
      for (const id of ['a', 'b']) {
        assert.equal((footer.match(new RegExp(`data-contestant-id="${id}"`, 'g')) ?? []).length, 1);
      }
    } else {
      assert.equal(footerIndex, -1);
      assert.equal((current.match(/<img /g) ?? []).length, 2);
    }
  }
});

test('current saved scene is prominent, numeric effects are notes, and history uses buttons', () => {
  const state = fixture('preparation');
  episode(state).scenes = [
    scene('draft', 'draft', ['An earlier draft announcement.']),
    scene('prep-a', 'practice', ['Team A chooses its parts.', 'Practice 1 → 3; composure 0 → -2.']),
  ];
  const html = render(state);
  assert.match(html, /<h3[^>]*>Scene prep-a<\/h3>/);
  assert.match(html, /<strong>Team A chooses its parts\.<\/strong>/);
  assert.match(html, /role="note"/);
  assert.match(html, /aria-label="Increased"/);
  assert.match(html, /aria-label="Decreased"/);
  assert.match(html, /Scene history/);
  assert.ok(!html.includes('An earlier draft announcement.'));
  assert.ok(!html.includes('ant-select'));
  assert.ok(!html.includes('unrevealed-song'));
  assert.ok(!html.includes('Winner:'));
});

test('decision phases pause without any advance control, including failed persistence', () => {
  for (const phase of ['conflict', 'broadcast', 'saves', 'secret'] as const) {
    const state = fixture(phase);
    const html = render(state, 'Storage write failed');
    assert.match(html, /Episode paused — your decision is required\./);
    assert.ok(!html.includes('Continue —'), `${phase} must not permit advancing behind its dialog`);
    assert.ok(!html.includes('Start Episode 2'));
    // Modal content is portaled and intentionally not asserted in server-rendered HTML.
    assert.equal(episode(state).phase, phase);
  }
});

test('precomputed future performances do not increase the visible stage progress', () => {
  const state = fixture('performance');
  const battle = episode(state);
  battle.scenes = [scene('perform-a', 'battles', ['Team A performs.'], ['a', 'b'])];
  battle.performances = ['a', 'b'].map((teamId) => ({
    teamId,
    evaluations: [],
    meanScore: 60,
    coordination: 0,
    finalScore: 60,
  }));
  const html = render(state);
  assert.match(html, /1 \/ 6 team performances/);
  assert.ok(!html.includes('Winner:'));
  assert.ok(!html.includes('Revealed audience votes'));
});

test('announced winners are visible before a production save but never during performance or broadcast', () => {
  for (const phase of ['performance', 'broadcast', 'audience', 'saves', 'results'] as const) {
    const state = fixture(phase);
    episode(state).revealedResults = 1;
    const html = render(state);
    if (phase === 'saves' || phase === 'results') {
      assert.match(html, /Announced battle winners/);
      assert.match(html, /Team B/);
      assert.ok(!html.includes('Announced departures and saves'), 'a winner is not a departure announcement');
    } else {
      assert.ok(!html.includes('Announced battle winners'));
      assert.ok(!html.includes('Winner:'));
    }
  }
});

test('the new audience ranking requires its saved reveal scene, not merely precomputed totals', () => {
  const state = fixture('audience');
  const battle = episode(state);
  battle.audience = {
    votes: { a: 123 },
    receptions: {},
    newFans: {},
    votingPopulation: 123,
    newViewers: 0,
    satisfactionBefore: 50,
    satisfactionAfter: 50,
    attention: 1,
    enjoyment: 1,
  };
  assert.ok(!render(state).includes('Revealed audience votes and combined ranking'));
  battle.scenes = [scene('audience', 'audience', ['The audience has voted.'])];
  assert.match(render(state), /Revealed audience votes and combined ranking/);
});

test('completed episodes show an explicit recap and never auto-start Episode 3', () => {
  const state = fixture('complete');
  episode(state).scenes = [scene('recap', 'recap', ['The episode closes.'])];
  const html = render(state);
  assert.match(html, /Episode 2 complete — recap/);
  assert.match(html, /3 contestants remain/);
  assert.match(html, /Episode 3 does not start automatically/);
  assert.ok(!html.includes('Continue —'));
  assert.ok(!html.includes('Start Episode 3'));
});
