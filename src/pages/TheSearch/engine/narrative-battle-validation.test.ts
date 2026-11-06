import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MoodChoices } from '../types/audition-episode';
import type { BattleAction, BattleEpisode } from '../types/battle-episode';
import type { SimulationState } from '../types/simulation';
import { MOOD_FIELDS } from './audition-episode';
import { completedAuditionsFixture } from './battle-fixtures';
import { transitionBattleStory } from './narrative-battle';
import { assertNarrativeBattleEpisode } from './narrative-battle-validation';

function actionFor(state: SimulationState): { action: BattleAction; revision: number } {
  const runtime = state.runtime!;
  const ep = runtime.battle;
  const preparation = runtime.preparations?.[2];
  if (!ep && !preparation) return { action: { type: 'start' }, revision: 0 };
  if (!ep) {
    assert.ok(preparation);
    return {
      action: !preparation.mood
        ? {
            type: 'mood',
            choices: Object.fromEntries(
              MOOD_FIELDS.map((field) => [field, preparation.moodOptions[field][0]]),
            ) as MoodChoices,
          }
        : {
            type: 'opening-cast',
            contestantIds: preparation.shortlist.slice(0, preparation.requiredSelections),
          },
      revision: preparation.revision,
    };
  }
  const stage = ep.story!.stage;
  return {
    action:
      stage === 'intervention'
        ? { type: 'conflict', choice: 'support' }
        : stage === 'production-save'
          ? { type: 'production-save', contestantId: ep.productionShortlist[0] }
          : stage === 'secret-choice'
            ? { type: 'secret', contestantId: ep.secretCandidates[0] }
            : { type: 'advance' },
    revision: ep.revision,
  };
}

let snapshots: Map<string, SimulationState> | undefined;
function play(): Map<string, SimulationState> {
  if (snapshots) return snapshots;
  let state = structuredClone(completedAuditionsFixture());
  state.runtime!.version = 3;
  state.runtime!.openingCast = state.runtime!.audition!.survivorIds.slice(0, 5);
  for (const person of state.contestants)
    for (const field of MOOD_FIELDS)
      person.specialties[field] = Object.keys(state.runtime!.definitions.specialties[field])[0];
  const result = new Map<string, SimulationState>();
  for (let i = 0; i < 150 && state.runtime!.battle?.phase !== 'complete'; i++) {
    const { action, revision } = actionFor(state);
    state = transitionBattleStory(state, action, revision);
    const ep = state.runtime!.battle;
    if (ep) {
      assertNarrativeBattleEpisode(ep, state.contestants, state.runtime!.definitions);
      result.set(ep.story!.stage, state);
      state = JSON.parse(JSON.stringify(state)) as SimulationState;
      assertNarrativeBattleEpisode(state.runtime!.battle, state.contestants, state.runtime!.definitions);
    }
  }
  assert.equal(state.runtime!.battle?.phase, 'complete');
  snapshots = result;
  return result;
}

function rejects(stage: string, mutate: (episode: BattleEpisode, state: SimulationState) => void): void {
  const state = structuredClone(play().get(stage)!);
  assert.ok(state, `missing ${stage} fixture`);
  mutate(state.runtime!.battle!, state);
  assert.throws(() =>
    assertNarrativeBattleEpisode(state.runtime!.battle, state.contestants, state.runtime!.definitions),
  );
}

test('strict narrative validation accepts every reachable story intermediate and JSON reload through eighteen survivors', () => {
  const states = play();
  assert.ok(states.size >= 25);
  const completed = states.get('complete')!.runtime!.battle!;
  assert.equal(completed.survivorIds.length, 18);
  assert.equal(completed.eliminatedIds.length, 12);
  assert.equal(completed.story!.rankReactions.length, 18);
  assert.equal(completed.story!.creditedTeamIds.length, 6);
});

test('paragraph identity references preserve repeated mentions while scene rosters remain unique', () => {
  const state = structuredClone(play().get('dorms')!);
  const ep = state.runtime!.battle!;
  const scene = ep.scenes.at(-1)!;
  const [a, b] = scene.contestantIds;
  const name = (id: string) => state.contestants.find((person) => person.id === id)!.name;
  scene.paragraphs = [
    `${name(a)} leads Team ${name(a)}.`,
    `${name(a)} considers ${name(b)}; ${name(b)} considers ${name(a)}.`,
  ];
  scene.paragraphContestantIds = [
    [a, a],
    [a, b, b, a],
  ];
  assert.doesNotThrow(() => assertNarrativeBattleEpisode(ep, state.contestants, state.runtime!.definitions));
  scene.paragraphContestantIds[0].push('unknown-contestant');
  assert.throws(() => assertNarrativeBattleEpisode(ep, state.contestants, state.runtime!.definitions));
  scene.paragraphContestantIds[0].pop();
  scene.contestantIds.push(a);
  assert.throws(() => assertNarrativeBattleEpisode(ep, state.contestants, state.runtime!.definitions));
});

test('dialogue references permit repeated known IDs and reject unknown IDs or misaligned paragraph counts', () => {
  const state = structuredClone(play().get('reviews')!);
  const ep = state.runtime!.battle!;
  const dialogue = ep.scenes.at(-1)!.dialogues![0];
  const id = ep.participantIds[0];
  dialogue.paragraphContestantIds = dialogue.paragraphs.map(() => [id, id]);
  const validate = () => assertNarrativeBattleEpisode(ep, state.contestants, state.runtime!.definitions);
  assert.doesNotThrow(validate);
  dialogue.paragraphContestantIds[0].push('unknown-contestant');
  assert.throws(validate, /dialogue paragraph mentions has unknown IDs/);
  dialogue.paragraphContestantIds[0].pop();
  dialogue.paragraphContestantIds.pop();
  assert.throws(validate, /dialogue paragraph identity alignment mismatch/);
});

test('narrative validation rejects altered score inputs, judge evidence, center bonuses and repeated exposure', () => {
  const mutations: ((episode: BattleEpisode) => void)[] = [
    (ep) => {
      ep.performances[0].finalScore += 0.1;
    },
    (ep) => {
      ep.performances[0].baseScore! += 0.1;
    },
    (ep) => {
      ep.performances[0].judging!.john.score += 0.1;
    },
    (ep) => {
      ep.performances[0].judging!.megan.bonus += 0.1;
    },
    (ep) => {
      ep.performances[0].judging!.michael.checks[1].skillLevel = 0;
    },
    (ep) => {
      ep.performances[0].judging!.john.comment = 'An invented rehearsal fight.';
    },
    (ep) => {
      ep.performances[0].evaluations[0].centerBonus = 1 - ep.performances[0].evaluations[0].centerBonus!;
    },
    (ep) => {
      ep.performances[0].evaluations[0].technicalChecks[0].skillLevel = 1;
    },
    (ep) => {
      ep.performances[0].evaluations[0].stageCheck.score += 1;
    },
    (ep) => {
      Object.assign(ep.performances[0].evaluations[0].rawDice, { 0: 7 });
    },
    (ep) => {
      ep.story!.exposure[ep.participantIds[0]] = 2 / 30;
    },
    (ep) => {
      ep.story!.creditedTeamIds[1] = ep.story!.creditedTeamIds[0];
    },
    (ep) => {
      ep.teams[0].centerBallots[ep.teams[0].captainId] = ep.teams[0].captainId;
    },
    (ep) => {
      ep.teams[0].centerId = ep.teams[1].captainId;
    },
    (ep) => {
      delete ep.story!.interventions[ep.teams[0].id];
    },
  ];
  for (const mutation of mutations) rejects('reviews', mutation);
});

test('narrative validation rejects impossible chronology, saves, departures, ballots and ranking reactions', () => {
  rejects('dorms', (ep) => {
    ep.rooms[0].memberIds[0] = ep.rooms[1].memberIds[0];
  });
  rejects('draft', (ep) => {
    ep.story!.draftPick--;
  });
  rejects('intervention', (ep) => {
    ep.story!.rankRevealed = true;
  });
  rejects('reviews', (ep) => {
    ep.story!.sequence = 6;
  });
  rejects('reviews', (ep) => {
    ep.scenes.at(-1)!.dialogues![0].paragraphs = [];
  });
  rejects('reviews', (ep) => {
    ep.audience!.votes[ep.participantIds[0]]++;
  });
  rejects('reviews', (ep) => {
    ep.finalRankedIds.reverse();
  });
  rejects('production-save', (ep) => {
    ep.audienceSaveId = ep.judgeSaveId;
  });
  rejects('production-save', (ep) => {
    ep.productionShortlist[0] = ep.judgeSaveId!;
  });
  rejects('departures', (ep, state) => {
    state.contestants.find((person) => person.id === ep.survivorIds[0])!.status = 'ELIMINATED';
  });
  rejects('complete', (ep) => {
    ep.story!.rankReactions.pop();
  });
  rejects('complete', (ep) => {
    ep.story!.rankReactions[1].targetId = ep.story!.rankReactions[1].observerId;
  });
  rejects('complete', (ep) => {
    ep.story!.rankReactions[1].after = ep.story!.rankReactions[1].before + 3;
  });
  rejects('complete', (ep, state) => {
    state.contestants.find((person) => person.id === ep.survivorIds[0])!.rank = 2;
  });
  rejects('complete', (ep) => {
    ep.mvp!.ballots[ep.survivorIds[0]] = ep.survivorIds[0];
  });
});
