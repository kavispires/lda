import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AuditionDice } from '../types/audition';
import type { Contestant } from '../types/contestant';
import type { MusicVideoEpisode } from '../types/music-video-episode';
import type { EpisodePreparation } from '../types/narrative';
import type { SimulationState } from '../types/simulation';
import type { SpecialtiesAction, SpecialtiesPerformance } from '../types/specialties-episode';
import { createContestant } from '../utilities/contestant-factory';
import { getSimulationDefinitions } from '../utilities/simulation-definitions';
import { getSpecialtiesCatalog, validateSpecialtiesCatalog } from '../utilities/specialties-songs';
import { createSeededRandom } from './random';
import { transitionSpecialties, validateSpecialties } from './specialties-episode';
import { rehearseSpecialties, scoreSpecialtiesSolo, specialtiesFinalScore } from './specialties-scoring';
import { specialtiesActivityTotals } from './specialties-validation';
import { castSpecialtiesBallots, lockSpecialtiesFriendship } from './specialties-voting';

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const normalized = (level: number, dice: AuditionDice) => {
  const floor = Math.max(1, Math.min(5, 2 * level - 3));
  return 10 * (Math.max(dice[0], floor) + Math.max(dice[1], floor) - 2);
};
const people = () =>
  Array.from({ length: 9 }, (_, index) => {
    const entry = createContestant({
      id: `sp-${index}`,
      name: `Solo Performer ${index}`,
      rank: index + 1,
      status: 'ACTIVE',
      updatedAt: 1,
    });
    for (let other = 0; other < 9; other++) if (other !== index) entry.relationships[`sp-${other}`] = [50];
    return entry;
  });
export function specialtiesFixture(seed = 100): SimulationState {
  const definitions = getSimulationDefinitions();
  const contestants = [
    ...people(),
    ...Array.from({ length: 41 }, (_, index) =>
      createContestant({
        id: `old-${index}`,
        name: `Earlier Performer ${index}`,
        rank: index + 10,
        status: 'ELIMINATED',
        updatedAt: 1,
      }),
    ),
  ];
  for (const entry of contestants) {
    for (const field of Object.keys(entry.specialties) as (keyof typeof entry.specialties)[])
      entry.specialties[field] = Object.keys(definitions.specialties[field])[0];
    entry.aggregations.rankingScore = 200 - entry.rank;
    entry.aggregations.practice = 4;
  }
  const ids = contestants.slice(0, 9).map((entry) => entry.id);
  const mood = structuredClone(contestants[0].specialties);
  const opening = ids.slice(0, 5);
  const previous = {
    version: 1,
    phase: 'complete',
    survivorIds: ids,
    scenes: [],
    storyboards: [],
    solos: [],
    takes: [],
    steps: [{ endState: seed }],
  } as unknown as MusicVideoEpisode;
  const prep9: EpisodePreparation = {
    episode: 9,
    revision: 1,
    lastAction: { revision: 0, action: { type: 'mood', choices: mood } },
    moodOptions: Object.fromEntries(
      Object.entries(mood).map(([field, value]) => [field, [value, value]]),
    ) as EpisodePreparation['moodOptions'],
    mood,
    randomizedMood: null,
    shortlist: ids.slice(5),
    slots: opening,
    requiredSelections: 0,
    openingPlayed: true,
  };
  return {
    status: 'ready',
    persistenceError: null,
    createdAt: 1,
    contestants,
    runtime: {
      version: 3,
      runId: 'native-specialties',
      seed,
      randomState: seed,
      episode: 9,
      phase: 'episode-complete',
      setup: { useBias: false, selectedIds: contestants.map((entry) => entry.id) },
      sourceContestants: Object.fromEntries(contestants.map((entry) => [entry.id, structuredClone(entry)])),
      initialContestants: structuredClone(contestants),
      definitions,
      audition: null,
      musicVideo: previous,
      openingCast: opening,
      preparations: { 9: prep9 },
      show: { audience: 200, general: 200, satisfaction: 50, fans: {}, pendingAttrition: 0 },
      revealedSecrets: [],
      deferredConsequences: [],
    },
  };
}
export function nextSpecialtiesAction(state: SimulationState): {
  action: SpecialtiesAction;
  revision: number;
} {
  const ep = state.runtime!.specialties;
  if (ep)
    return {
      revision: ep.revision,
      action:
        ep.phase === 'secret-choice'
          ? { type: 'secret', contestantId: ep.secretCandidates[0] }
          : { type: 'advance' },
    };
  const prep = state.runtime!.preparations?.[10];
  if (!prep) return { revision: 0, action: { type: 'start' } };
  return {
    revision: prep.revision,
    action: !prep.mood
      ? {
          type: 'mood',
          choices: Object.fromEntries(
            Object.entries(prep.moodOptions).map(([field, values]) => [field, values[0]]),
          ) as NonNullable<typeof prep.mood>,
        }
      : { type: 'opening-cast', contestantIds: prep.shortlist.slice(0, prep.requiredSelections) },
  };
}
function next(state: SimulationState) {
  const { action, revision } = nextSpecialtiesAction(state);
  return transitionSpecialties(state, action, revision);
}
function until(state: SimulationState, predicate: (state: SimulationState) => boolean) {
  for (let steps = 0; steps < 90; steps++) {
    if (predicate(state)) return state;
    state = next(state);
  }
  throw new Error('Specialties did not reach the requested seam.');
}
let completeCache: SimulationState | undefined;
const completeSeason = () =>
  (completeCache ??= until(
    specialtiesFixture(),
    (state) => state.runtime!.specialties?.phase === 'complete',
  ));
function evidence(cast: Contestant[]): SpecialtiesPerformance[] {
  return cast.map(
    (entry, index) => ({ contestantId: entry.id, observedScore: 90 - 8 * index }) as SpecialtiesPerformance,
  );
}
describe('native Specialties independent mechanics', () => {
  it('provides nine distinct original medium arrangements even for nine identical tracks', () => {
    const catalog = getSpecialtiesCatalog();
    validateSpecialtiesCatalog(catalog);
    for (const track of ['VOCAL', 'RAP', 'DANCE'] as const)
      assert.equal(
        catalog.songs.filter((song) => song.arrangements[track].trim() && song.difficulty === 3).length,
        9,
      );
    const bad = structuredClone(catalog);
    bad.songs[1].id = bad.songs[0].id;
    assert.throws(() => validateSpecialtiesCatalog(bad));
    const state = until(specialtiesFixture(), (entry) => entry.runtime!.specialties?.phase === 'songs');
    const ep = state.runtime!.specialties!;
    assert.equal(new Set(ep.songs.map((song) => song.songId)).size, 9);
    for (const song of ep.songs) {
      const owner = state.contestants.find((entry) => entry.id === song.contestantId)!;
      const field =
        owner.track === 'VOCAL' ? 'vocalColor' : owner.track === 'RAP' ? 'rapStyle' : 'danceStyle';
      assert.equal(song.specialtyId, owner.specialties[field]);
      assert.equal(song.visualVibeId, owner.specialties.visualVibe);
      assert.equal(song.difficulty, 3);
    }
    const mixed = specialtiesFixture(15);
    for (const [index, entry] of mixed.contestants.slice(0, 9).entries())
      entry.track = index % 2 ? 'RAP' : 'DANCE';
    const assigned = until(mixed, (entry) => entry.runtime!.specialties?.phase === 'songs').runtime!
      .specialties!;
    for (const song of assigned.songs)
      assert.equal(
        song.arrangement,
        catalog.songs.find((template) => template.id === song.songId)!.arrangements[song.track],
      );
  });
  it('locks pure greatest outgoing affection, freezes ties and never uses popularity or skills', () => {
    const cast = people();
    cast[0].relationships[cast[1].id] = [11];
    cast[0].relationships[cast[2].id] = [13];
    for (const other of cast.slice(3)) cast[0].relationships[other.id] = [0];
    cast[1].aggregations.rankingScore = 100000;
    const game = lockSpecialtiesFriendship(cast, createSeededRandom(38).next);
    assert.equal(game.choices[0].targetId, cast[2].id);
    for (const choice of game.choices) {
      const voter = cast.find((entry) => entry.id === choice.contestantId)!;
      const sorted = cast
        .filter((entry) => entry.id !== voter.id)
        .sort(
          (a, b) =>
            (voter.relationships[b.id]?.at(-1) ?? 50) - (voter.relationships[a.id]?.at(-1) ?? 50) ||
            choice.tieKeys[a.id] - choice.tieKeys[b.id] ||
            a.id.localeCompare(b.id),
        );
      assert.equal(choice.targetId, sorted[0].id);
      assert.notEqual(choice.targetId, voter.id);
    }
    cast[0].relationships[cast[1].id].push(100);
    assert.equal(game.snapshot[0].relationships[cast[1].id].at(-1), 11);
    assert.equal(game.choices[0].targetId, cast[2].id);
  });
  it('reveals four canonical pairs only when their second choice airs, clamps rewards and penalizes only sensitive unrequited choices', () => {
    const state = specialtiesFixture();
    const cast = state.contestants.slice(0, 9);
    for (const [index, entry] of cast.entries()) {
      for (const other of cast) if (other.id !== entry.id) entry.relationships[other.id] = [0];
      entry.relationships[cast[index < 8 ? index ^ 1 : 0].id] = [1];
      entry.aggregations.happiness = index === 0 ? 95 : 50;
      entry.aggregations.audienceRatio = 0.95;
      entry.aggregations.fanbaseRatio = 0.96;
      entry.personality.sensitivity = 5;
    }
    const credits = until(state, (entry) => entry.runtime!.specialties?.phase === 'credits');
    let current = next(credits);
    assert.equal(current.runtime!.specialties!.friendship!.rewards.length, 0);
    current = next(current);
    assert.equal(current.runtime!.specialties!.friendship!.pairs.length, 1);
    assert.equal(current.contestants[0].aggregations.happiness, 100);
    assert.equal(current.contestants[0].aggregations.audienceRatio, 1);
    assert.equal(current.contestants[0].aggregations.fanbaseRatio, 1);
    current = until(current, (entry) => entry.runtime!.specialties?.phase === 'friendship-reactions');
    const game = current.runtime!.specialties!.friendship!;
    assert.equal(game.pairs.length, 4);
    assert.equal(game.rewards.length, 8);
    assert.deepEqual(
      game.reactions.map((entry) => entry.contestantId),
      [cast[8].id],
    );
    assert.equal(game.reactions[0].after, 47);
    for (const pair of game.pairs) assert.deepEqual(pair, [...pair].sort());
    for (const entry of current.contestants.slice(0, 9))
      assert.deepEqual(
        entry.relationships,
        credits.contestants.find((other) => other.id === entry.id)!.relationships,
      );
  });
  it('allows zero pairs and does not penalize insensitive unrequited choices', () => {
    const state = specialtiesFixture(13);
    for (const [index, entry] of state.contestants.slice(0, 9).entries()) {
      for (const other of state.contestants.slice(0, 9))
        if (other.id !== entry.id) entry.relationships[other.id] = [0];
      entry.relationships[`sp-${(index + 1) % 9}`] = [10];
      entry.personality.sensitivity = index === 0 ? 4 : 5;
    }
    const result = until(state, (entry) => entry.runtime!.specialties?.phase === 'friendship-reactions');
    assert.equal(result.runtime!.specialties!.friendship!.pairs.length, 0);
    assert.equal(result.runtime!.specialties!.friendship!.reactions.length, 8);
    assert.equal(result.contestants[0].aggregations.happiness, 50);
  });
  it('independently computes both weighted rehearsals with one pair, max practice and the conjunctive endurance gate', () => {
    const entry = people()[0];
    entry.utilitySkills.learning = 4;
    entry.utilitySkills.memory = 2;
    entry.utilitySkills.consistency = 2;
    entry.utilitySkills.stamina = 1;
    entry.aggregations.practice = 5;
    for (const session of [1, 2] as const)
      for (const dice of [
        [1, 2],
        [5, 6],
      ] as AuditionDice[]) {
        const result = rehearseSpecialties(entry, session, dice, 4);
        const skills =
          session === 1
            ? (['learning', 'memory', 'consistency'] as const)
            : (['stamina', 'consistency', 'memory'] as const);
        const sums = skills.map((skill) => normalized(entry.utilitySkills[skill], dice) / 10 + 2);
        const weighted = (2 * sums[0] + sums[1] + sums[2]) / 4;
        close(result.weightedSum, weighted);
        assert.equal(result.sessionPractice, Math.min(5, Math.floor(weighted / 2)));
        assert.equal(result.practiceAfter, Math.max(4, result.sessionPractice));
        assert.equal(
          result.enduranceStruggle,
          session === 2 &&
            entry.utilitySkills.consistency < 3 &&
            normalized(entry.utilitySkills.stamina, dice) < 50,
        );
        assert.equal(result.readinessModifier, result.enduranceStruggle ? -5 : 0);
        assert.equal(entry.aggregations.practice, 5);
      }
    entry.utilitySkills.consistency = 3;
    assert.equal(rehearseSpecialties(entry, 2, [1, 1]).enduranceStruggle, false);
  });
  it('independently reconstructs normalized checks, matching caps, three judges, stage gate, Awe and exact 25% peer formula', () => {
    const entry = people()[0];
    entry.coreSkills.vocals = 3;
    entry.coreSkills.rap = 3;
    entry.coreSkills.dance = 3;
    entry.coreSkills.stagePresence = 4;
    entry.coreSkills.visual = 5;
    entry.coreSkills.uniqueness = 2;
    entry.coreSkills.leadership = 2;
    entry.utilitySkills.potential = 3;
    entry.utilitySkills.consistency = 2;
    entry.personality.extroversion = -5;
    entry.personality.ambition = 5;
    for (const dice of [
      [1, 2],
      [3, 4],
      [6, 6],
    ] as AuditionDice[]) {
      const result = scoreSpecialtiesSolo(entry, 'test-song', dice, 4, -5);
      const track = normalized(3, dice);
      const visual = normalized(5, dice);
      const baseStage = normalized(4, dice);
      const shrinking = dice[0] + dice[1] <= 4 && baseStage < 50;
      const stage = Math.max(0, baseStage - (shrinking ? 5 : 0));
      const technical = clamp(Math.min(100, track + 10) + 8 - 5);
      const megan = (stage + normalized(2, dice) + normalized(3, dice)) / 3;
      const michael = (Math.min(100, visual + 10) + normalized(2, dice) + normalized(2, dice)) / 3;
      close(result.technical, technical);
      close(result.megan, megan);
      close(result.michael, michael);
      close(result.observedScore, (4 * technical + megan + michael) / 6);
      assert.equal(result.shrinking, shrinking);
      assert.equal(result.trainerAwe, stage >= 85);
      for (const peer of [0, 37.5, 100])
        close(specialtiesFinalScore(result, peer), (4 * technical + megan + michael + 2 * peer) / 8);
      close(specialtiesFinalScore(result, 100) - specialtiesFinalScore(result, 0), 25);
      assert.equal('grade' in result, false);
    }
    entry.coreSkills.stagePresence = 1;
    assert.equal(scoreSpecialtiesSolo(entry, 'test', [1, 2], 0, 0).shrinking, true);
    assert.equal(scoreSpecialtiesSolo(entry, 'test', [5, 5], 0, 0).shrinking, false);
    entry.personality.extroversion = 0;
    entry.coreSkills.leadership = 3;
    assert.equal(scoreSpecialtiesSolo(entry, 'test', [1, 2], 0, 0).shrinking, false);
    entry.coreSkills.stagePresence = 3;
    assert.equal(scoreSpecialtiesSolo(entry, 'test', [6, 6], 0, 0).trainerAwe, false);
  });
  it('uses objective precedence, both strategic gates, only top-two sabotage, blended preferences and saved ties', () => {
    const cast = people();
    for (const entry of cast) {
      entry.personality.sincerity = 0;
      entry.personality.maturity = 0;
      entry.personality.ambition = 0;
    }
    cast[0].personality = { ...cast[0].personality, sincerity: -5, ambition: 5, maturity: 5 };
    cast[1].personality = { ...cast[1].personality, sincerity: 5, ambition: 10 };
    cast[2].personality = { ...cast[2].personality, sincerity: -5, ambition: 5 };
    cast[3].personality = { ...cast[3].personality, sincerity: -4, ambition: 5 };
    cast[4].personality = { ...cast[4].personality, sincerity: -5, ambition: 4 };
    cast[5].relationships[cast[8].id] = [100];
    for (const other of cast.slice(0, 8)) if (other.id !== cast[5].id) cast[5].relationships[other.id] = [0];
    const performances = evidence(cast);
    performances[7].observedScore = performances[6].observedScore;
    const peer = castSpecialtiesBallots(cast, performances, createSeededRandom(55).next);
    assert.deepEqual(
      peer.ballots.slice(0, 5).map((ballot) => ballot.profile),
      ['objective', 'objective', 'strategic', 'blended', 'blended'],
    );
    for (const ballot of peer.ballots) {
      assert.equal(ballot.rankedIds.length, 8);
      assert.equal(new Set(ballot.rankedIds).size, 8);
      assert.ok(!ballot.rankedIds.includes(ballot.voterId));
      const voter = cast.find((entry) => entry.id === ballot.voterId)!;
      const scores = Object.fromEntries(
        performances.map((entry) => [entry.contestantId, entry.observedScore]),
      );
      const baseline = cast
        .filter((entry) => entry.id !== voter.id)
        .map((entry) => entry.id)
        .sort((a, b) => scores[b] - scores[a] || ballot.tieKeys[a] - ballot.tieKeys[b] || a.localeCompare(b));
      assert.deepEqual(ballot.baselineIds, baseline);
      if (ballot.profile === 'strategic') {
        assert.deepEqual(ballot.threatIds, baseline.slice(0, 2));
        assert.deepEqual(ballot.rankedIds, [...baseline.slice(2), baseline[1], baseline[0]]);
      } else if (ballot.profile === 'objective') assert.deepEqual(ballot.rankedIds, baseline);
      else {
        const expected = [...baseline].sort(
          (a, b) =>
            (scores[b] + (voter.relationships[b]?.at(-1) ?? 50)) / 2 -
              (scores[a] + (voter.relationships[a]?.at(-1) ?? 50)) / 2 ||
            ballot.tieKeys[a] - ballot.tieKeys[b] ||
            a.localeCompare(b),
        );
        assert.deepEqual(ballot.rankedIds, expected);
      }
    }
    assert.equal(peer.ballots[5].rankedIds[0], cast[8].id);
    let positions = 0;
    let averages = 0;
    for (const recipient of cast) {
      const votes = peer.ballots
        .filter((ballot) => ballot.voterId !== recipient.id)
        .map((ballot) => ballot.rankedIds.indexOf(recipient.id) + 1);
      assert.equal(votes.length, 8);
      positions += votes.reduce((sum, position) => sum + position, 0);
      const expected = votes.reduce((sum, position) => sum + (100 * (8 - position)) / 7, 0) / 8;
      close(peer.averages[recipient.id], expected);
      assert.deepEqual(
        peer.received[recipient.id],
        peer.ballots
          .filter((ballot) => ballot.voterId !== recipient.id)
          .map((ballot) => {
            const place = ballot.rankedIds.indexOf(recipient.id) + 1;
            return { voterId: ballot.voterId, place, score: (100 * (8 - place)) / 7 };
          }),
      );
      averages += expected;
    }
    assert.equal(positions, 324);
    close(averages, 450);
    assert.equal(
      Object.values(peer.received)
        .flat()
        .reduce((sum, vote) => sum + vote.place, 0),
      324,
    );
    close(
      Object.values(peer.averages).reduce((sum, value) => sum + value, 0),
      450,
    );
    for (const ballot of peer.ballots) {
      const given = Object.values(peer.received)
        .flat()
        .filter((vote) => vote.voterId === ballot.voterId);
      assert.equal(
        given.reduce((sum, vote) => sum + vote.place, 0),
        36,
      );
      close(
        given.reduce((sum, vote) => sum + vote.score, 0),
        400,
      );
      assert.equal(Math.min(...given.map((vote) => vote.score)), 0);
      assert.equal(Math.max(...given.map((vote) => vote.score)), 100);
    }
    for (const entry of cast) {
      entry.rank = 100 - entry.rank;
      entry.aggregations.rankingScore *= -3;
    }
    assert.deepEqual(
      castSpecialtiesBallots(cast, performances, createSeededRandom(55).next).ballots,
      peer.ballots,
    );
  });
});
describe('native Specialties chronology and reconstructed validation', () => {
  it('keeps each reveal/rehearsal/solo player-paced with no future grades or extra dice', () => {
    let state = specialtiesFixture();
    let priorRehearsals = 0;
    let priorPerformances = 0;
    while (state.runtime!.specialties?.phase !== 'complete') {
      const old = state.runtime!.specialties;
      const command = nextSpecialtiesAction(state);
      state = transitionSpecialties(state, command.action, command.revision);
      const ep = state.runtime!.specialties;
      if (!ep) continue;
      if (ep.rehearsals.length > priorRehearsals || ep.performances.length > priorPerformances) {
        assert.equal(ep.steps.at(-1)!.drawCount, 2);
        assert.equal(ep.rehearsals.length - priorRehearsals + ep.performances.length - priorPerformances, 1);
      }
      if (!ep.peer) assert.equal(ep.panel.length, 0);
      if (ep.phase === 'performances')
        assert.deepEqual(
          ep.scenes.at(-1)!.dialogues?.map((dialogue) => dialogue.name),
          ['John Stan', 'Megan Ryder', 'Michael Lion'],
        );
      if (ep.phase === 'peer-rankings') {
        assert.equal(ep.peer!.ballots.length, 9);
        assert.equal(ep.panel.length, 0);
      }
      if (old && !ep.rankRevealed)
        for (const id of ep.participantIds) {
          const start: Contestant = ep.startingContestants.find((entry) => entry.id === id)!;
          const live = state.contestants.find((entry) => entry.id === id)!;
          assert.equal(live.rank, start.rank);
          assert.equal(live.aggregations.rankingScore, start.aggregations.rankingScore);
        }
      priorRehearsals = ep.rehearsals.length;
      priorPerformances = ep.performances.length;
      const reloaded = JSON.parse(JSON.stringify(state)) as SimulationState;
      validateSpecialties(reloaded);
      assert.deepEqual(nextSpecialtiesAction(reloaded), nextSpecialtiesAction(state));
    }
    completeCache = state;
    const ep = state.runtime!.specialties!;
    assert.equal(ep.rehearsals.length, 18);
    assert.equal(ep.performances.length, 9);
    assert.equal(ep.rehearsals.length + ep.performances.length, 27);
    assert.equal(state.runtime!.episode, 10);
  });
  it('has one rank-nine exit, eight no-self MVP ballots, fixed old placements, conserved fans and exactly +5 XP', () => {
    const state = completeSeason();
    validateSpecialties(state);
    const ep = state.runtime!.specialties!;
    assert.equal(ep.survivorIds.length, 8);
    assert.equal(ep.eliminatedId, ep.rankedIds[8]);
    assert.equal(state.contestants.filter((entry) => entry.status === 'ACTIVE').length, 8);
    assert.deepEqual(Object.keys(ep.mvp!.ballots).sort(), [...ep.survivorIds].sort());
    for (const [voter, candidate] of Object.entries(ep.mvp!.ballots)) {
      assert.notEqual(voter, candidate);
      assert.ok(ep.survivorIds.includes(candidate));
    }
    assert.equal(ep.fanTransfers.length, 1);
    const fanTotal = (show: typeof ep.startingShow) =>
      show.general + Object.values(show.fans).reduce((sum, fans) => sum + fans, 0);
    assert.equal(fanTotal(ep.fanTransfers[0].before), fanTotal(ep.fanTransfers[0].after));
    for (const entry of state.contestants) {
      const start = ep.startingContestants.find((other) => other.id === entry.id)!;
      if (ep.participantIds.includes(entry.id)) {
        assert.equal(entry.aggregations.experience - start.aggregations.experience, 5);
        assert.equal(entry.aggregations.practice, start.aggregations.practice);
      } else assert.deepEqual(entry, start);
    }
    assert.equal(new Set(state.contestants.map((entry) => entry.rank)).size, 50);
    assert.match(ep.scenes.at(-1)!.paragraphs.join(' '), /upcoming finale/);
    assert.doesNotMatch(ep.scenes.at(-1)!.paragraphs.join(' '), /one more cut/i);
    const totals = specialtiesActivityTotals(ep);
    for (const id of ep.participantIds) assert.equal(totals[id].experience, 5);
  });
  it('reconstructs independently and rejects plausible corruption, extra valid RNG draws and live boundary changes', () => {
    const baseline = completeSeason();
    const mutations: ((state: SimulationState) => void)[] = [
      (state) => {
        state.runtime!.specialties!.friendship!.choices[0].targetId = 'sp-8';
      },
      (state) => {
        state.runtime!.specialties!.friendship!.snapshot[0].relationships['sp-1'].push(99);
      },
      (state) => {
        state.runtime!.specialties!.rehearsals[0].practiceAfter++;
      },
      (state) => {
        state.runtime!.specialties!.performances[0].checks.visual.score--;
      },
      (state) => {
        state.runtime!.specialties!.performances[0].observedScore++;
      },
      (state) => {
        const ballot = state.runtime!.specialties!.peer!.ballots[0];
        [ballot.rankedIds[0], ballot.rankedIds[1]] = [ballot.rankedIds[1], ballot.rankedIds[0]];
      },
      (state) => {
        state.runtime!.specialties!.panel[0].finalScore++;
      },
      (state) => {
        state.runtime!.specialties!.steps[0].drawCount++;
      },
      (state) => {
        state.runtime!.specialties!.steps[1].endState =
          createSeededRandom(state.runtime!.specialties!.steps[1].endState).next() * 0xffffffff;
      },
      (state) => {
        state.contestants[30].aggregations.happiness++;
      },
      (state) => {
        state.runtime!.show.general++;
      },
      (state) => {
        state.runtime!.specialties!.scenes[2].paragraphs[0] += ' invented';
      },
      (state) => {
        state.runtime!.randomState = createSeededRandom(state.runtime!.randomState).getState() + 1;
      },
    ];
    for (const mutate of mutations) {
      const corrupt = structuredClone(baseline);
      mutate(corrupt);
      assert.throws(() => validateSpecialties(corrupt));
    }
    const extra = structuredClone(baseline);
    const random = createSeededRandom(extra.runtime!.specialties!.steps.at(-1)!.endState);
    random.next();
    extra.runtime!.specialties!.steps.at(-1)!.drawCount++;
    extra.runtime!.specialties!.steps.at(-1)!.endState = random.getState();
    extra.runtime!.randomState = random.getState();
    assert.throws(() => validateSpecialties(extra));
  });
  it('makes stale/duplicate actions immutable and forbids starting Episode 11', () => {
    const state = until(specialtiesFixture(), (entry) => entry.runtime!.specialties?.phase === 'credits');
    const command = nextSpecialtiesAction(state);
    const result = transitionSpecialties(state, command.action, command.revision);
    assert.equal(transitionSpecialties(result, command.action, command.revision), result);
    const unchanged = JSON.stringify(result);
    assert.throws(() =>
      transitionSpecialties(result, { type: 'secret', contestantId: 'sp-0' }, command.revision),
    );
    assert.equal(JSON.stringify(result), unchanged);
    const completed = completeSeason();
    assert.throws(() =>
      transitionSpecialties(completed, { type: 'advance' }, completed.runtime!.specialties!.revision),
    );
    assert.equal(completed.runtime!.episode, 10);
  });
  it('handles investigation misses and an exact second hidden card without an extra exit', () => {
    const fixture = specialtiesFixture(44);
    const entry = fixture.contestants[0];
    const id = entry.id;
    const cards = Object.keys(fixture.runtime!.definitions.cards.secret);
    assert.ok(cards.length >= 2);
    entry.aggregations.rankingScore = 10000;
    entry.attributes = cards.slice(0, 2);
    entry.events.push(`SECRET_REVEALED:${cards[0]}`);
    fixture.runtime!.revealedSecrets.push({ contestantId: id, cardId: cards[0] });
    for (const other of fixture.contestants.filter((other) => other.status === 'ACTIVE' && other.id !== id)) {
      other.attributes = [];
      other.events.push('SECRET_REVEALED:previous');
    }
    const state = until(fixture, (other) => other.runtime!.specialties?.phase === 'secret-choice');
    const ep = state.runtime!.specialties!;
    assert.deepEqual(ep.secretCandidates, [id]);
    const hit = next(state);
    validateSpecialties(JSON.parse(JSON.stringify(hit)));
    assert.equal(hit.runtime!.specialties!.secret!.cardId, cards[1]);
    assert.equal(hit.runtime!.specialties!.survivorIds.length, 8);
    assert.equal(hit.contestants.filter((other) => other.status === 'ACTIVE').length, 8);
    assert.equal(hit.runtime!.revealedSecrets.filter((other) => other.contestantId === id).length, 2);
    const missFixture = specialtiesFixture(45);
    missFixture.contestants[0].aggregations.rankingScore = 10000;
    missFixture.contestants[0].attributes = [cards[0]];
    const miss = until(missFixture, (other) => other.runtime!.specialties?.phase === 'secret-choice');
    const missEp = miss.runtime!.specialties!;
    const candidate = missEp.secretCandidates.find((other) => other !== missFixture.contestants[0].id);
    assert.ok(candidate);
    const missed = transitionSpecialties(miss, { type: 'secret', contestantId: candidate }, missEp.revision);
    validateSpecialties(JSON.parse(JSON.stringify(missed)));
    assert.equal(missed.runtime!.specialties!.secret!.cardId, null);
    assert.equal(missed.runtime!.specialties!.survivorIds.length, 8);
  });
});
