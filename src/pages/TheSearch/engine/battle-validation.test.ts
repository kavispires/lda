import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BattleEpisode, BattleSong } from '../types/battle-episode';
import type { SimulationState } from '../types/simulation';
import { BATTLE_SONGS, validateBattleSongs } from '../utilities/battle-songs';
import { advanceBattleTo, completedAuditionsFixture } from './battle-fixtures';
import { assertBattleEpisode } from './battle-validation';

test('battle song catalog rejects malformed IDs, unknown fields/genres/skills, nonfinite/fractional levels and missing or repeated parts', () => {
  const genres = [...new Set(BATTLE_SONGS.map((song) => song.genre))];
  validateBattleSongs(BATTLE_SONGS, genres);
  const mutations: ((songs: BattleSong[]) => void)[] = [
    (songs) => {
      songs.length = 5;
    },
    (songs) => {
      songs[1].id = songs[0].id;
    },
    (songs) => {
      songs[0].title = '';
    },
    (songs) => {
      Object.assign(songs[0], { extra: true });
    },
    (songs) => {
      songs[0].genre = 'missing';
    },
    (songs) => {
      Object.assign(songs[0], { difficulty: Number.POSITIVE_INFINITY });
    },
    (songs) => {
      songs[0].parts.pop();
    },
    (songs) => {
      songs[0].parts[1].id = songs[0].parts[0].id;
    },
    (songs) => {
      Object.assign(songs[0].parts[0].testedSkills[0], { skill: 'memory' });
    },
    (songs) => {
      Object.assign(songs[0].parts[0].testedSkills[0], { skill: 'stagePresence' });
    },
    (songs) => {
      Object.assign(songs[0].parts[0].testedSkills[0], { requiredLevel: 2.5 });
    },
    (songs) => {
      songs[0].parts[0].testedSkills.push(songs[0].parts[0].testedSkills[0]);
    },
  ];
  for (const mutate of mutations) {
    const invalid = structuredClone(BATTLE_SONGS);
    mutate(invalid);
    assert.throws(() => validateBattleSongs(invalid, genres));
  }
});

const start = completedAuditionsFixture();
const completed = advanceBattleTo(start, 'complete');

function rejects(
  state: SimulationState,
  mutate: (episode: BattleEpisode, state: SimulationState) => void,
): void {
  const invalid = structuredClone(state);
  mutate(invalid.runtime!.battle!, invalid);
  assert.throws(
    () => assertBattleEpisode(invalid.runtime!.battle, invalid.contestants, invalid.runtime!.definitions),
    /Invalid Group Battles/,
  );
}

test('persistence validator rejects malformed rosters, rooms, draft, centers, parts, rolls, scores and forged completed episodes', () => {
  assertBattleEpisode(completed.runtime!.battle, completed.contestants, completed.runtime!.definitions);
  const mutations: ((episode: BattleEpisode, state: SimulationState) => void)[] = [
    (ep) => {
      ep.participantIds.pop();
    },
    (ep) => {
      ep.rooms[0].memberIds[0] = ep.rooms[1].memberIds[0];
    },
    (ep) => {
      ep.draftRound = 3;
    },
    (ep) => {
      ep.teams[0].captainId = ep.rankedIds[7];
    },
    (ep) => {
      ep.teams[0].memberIds[1] = ep.teams[1].memberIds[1];
    },
    (ep) => {
      const id = ep.teams[0].memberIds[0];
      ep.teams[0].centerBallots[id] = id;
    },
    (ep) => {
      ep.teams[0].partAssignments[ep.teams[0].memberIds[0]] = 'not-a-part';
    },
    (ep) => {
      ep.teams[0].coordination = 6;
    },
    (ep) => {
      ep.teams[0].practice.pop();
    },
    (ep) => {
      ep.teams[0].practice[0].leadershipCheck.successThreshold = 5;
    },
    (ep) => {
      ep.teams[0].practice[0].coordinationAfter = 5;
    },
    (ep) => {
      Object.assign(ep.teams[0].practice[0].contestants[0].rawDice, { 0: 7 });
    },
    (ep) => {
      ep.teams[0].practice[0].contestants[0].practiceAfter = 0;
    },
    (ep) => {
      ep.performances.pop();
    },
    (ep) => {
      ep.performances[0].evaluations[0].finalScore = Number.NaN;
    },
    (ep) => {
      ep.performances[0].evaluations[0].technicalChecks.pop();
    },
    (ep) => {
      ep.performances[0].evaluations[0].stageCheck.skillLevel = 6;
    },
    (ep) => {
      ep.performances[0].evaluations[0].impressionChecks.pop();
    },
    (ep) => {
      ep.performances[0].finalScore += 0.1;
    },
    (ep) => {
      assert.ok(ep.audience);
      ep.audience.votes[ep.participantIds[0]]++;
    },
    (ep) => {
      ep.audienceSaveId = ep.judgeSaveId;
    },
    (ep) => {
      ep.productionSaveId = ep.judgeSaveId;
    },
    (ep) => {
      ep.survivorIds[0] = ep.eliminatedIds[0];
    },
    (ep) => {
      assert.ok(ep.mvp);
      const id = ep.survivorIds[0];
      ep.mvp.ballots[id] = id;
    },
    (ep) => {
      ep.lastAction.revision--;
    },
    (ep) => {
      Object.assign(ep.lastAction.action, { type: 'unknown' });
    },
    (ep) => {
      ep.revealedResults = 2;
    },
    (ep) => {
      ep.secret = null;
    },
    (ep, state) => {
      state.contestants.find((entry) => entry.id === ep.participantIds[0])!.changeLog.pop();
    },
  ];
  for (const mutate of mutations) rejects(completed, mutate);
});

test('persistence validator enforces intermediate phase timing instead of accepting a forged partial completion', () => {
  const opening = advanceBattleTo(start, 'dorms');
  rejects(opening, (ep) => {
    ep.phase = 'broadcast';
  });

  test('scene identities reject malformed or unknown references while older scenes remain loadable', () => {
    rejects(completed, (ep) => {
      ep.scenes[0].paragraphContestantIds = [];
    });
    rejects(completed, (ep) => {
      ep.scenes[0].paragraphContestantIds = ep.scenes[0].paragraphs.map(() => ['missing-contestant']);
    });
    rejects(completed, (ep) => {
      Object.assign(ep.scenes[0], {
        paragraphContestantIds: ep.scenes[0].paragraphs.map(() => [42]),
      });
    });
    rejects(completed, (ep) => {
      Object.assign(ep.scenes[0], {
        paragraphContestantIds: ep.scenes[0].paragraphs.map(() => null),
      });
    });
    const legacy = structuredClone(completed);
    for (const scene of legacy.runtime!.battle!.scenes) delete scene.paragraphContestantIds;
    assertBattleEpisode(legacy.runtime!.battle, legacy.contestants, legacy.runtime!.definitions);
  });
  rejects(opening, (ep) => {
    ep.phase = 'complete';
  });
  rejects(opening, (ep) => {
    ep.roomCursor = 5;
  });
  const practice = advanceBattleTo(start, 'preparation');
  rejects(practice, (ep) => {
    ep.phase = 'performance';
    ep.teamCursor = 1;
  });
  rejects(practice, (ep) => {
    const unprepared = ep.teams.find((team) => !team.practice.length);
    const prepared = ep.teams.find((team) => team.practice.length);
    assert.ok(unprepared);
    assert.ok(prepared);
    unprepared.practice = prepared.practice;
  });
  const audience = advanceBattleTo(start, 'audience');
  rejects(audience, (ep) => {
    ep.pairings[0].winnerId = ep.pairings[0].teamIds[0];
  });
  const results = advanceBattleTo(start, 'results');
  rejects(results, (ep, state) => {
    state.contestants.find((entry) => entry.id === ep.eliminatedIds[0])!.status = 'ELIMINATED';
  });
});
