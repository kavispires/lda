import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Contestant } from '../types/contestant';
import type { SimulationState } from '../types/simulation';
import type { VersatilityAction, VersatilityTeam } from '../types/versatility-episode';
import { createContestant } from '../utilities/contestant-factory';
import { getVersatilityCatalogs, validateVersatilityCatalogs } from '../utilities/versatility-catalogs';
import { revealAuditionSecret, revealExactAuditionSecret } from './audition-secrets';
import { autoCompleteEpisode } from './episode-auto-complete';
import { createSeededRandom } from './random';
import { completedPhotoshootForTracks } from './track-specials-fixtures';
import { canCompleteVersatility, chooseVersatilityPick, createVersatilitySlots } from './versatility-draft';
import { transitionVersatility, validateVersatility } from './versatility-episode';
import { selectVersatilityExpulsion, versatilityFallbackPool } from './versatility-expulsion';
import { versatilityRefuses } from './versatility-rehearsal';
import { scoreVersatility, versatilityBreakthrough } from './versatility-scoring';

const catalogs = getVersatilityCatalogs();
const peopleFor = (vocal: number, rap: number, dance: number): Contestant[] =>
  (['VOCAL', 'RAP', 'DANCE'] as const).flatMap((track, index) =>
    Array.from({ length: [vocal, rap, dance][index] }, (_, person) =>
      createContestant({
        id: `${track}-${person}`,
        name: `${track} ${person}`,
        track,
        rank: 1,
      }),
    ),
  );
const teamFor = (ids: string[]): VersatilityTeam => ({
  id: 'versatility-1',
  name: 'Group 1',
  memberIds: ids,
  captainId: ids[0],
  centerId: ids[0],
  songId: catalogs.versatilitySongs[0].id,
  centerBallots: {},
  partAssignments: Object.fromEntries(
    ids.map((id, index) => [id, catalogs.versatilitySongs[0].parts[index].id]),
  ),
  partReactions: {},
  coordination: 0,
  practice: [],
  leaderElection: null,
  centerElection: null,
  leaderContestants: [],
  centerContestants: [],
  intervention: null,
});
let fixture: Promise<SimulationState> | undefined;
function completedSix() {
  fixture ??= (async () => autoCompleteEpisode(await completedPhotoshootForTracks(), 6))();
  return fixture.then((state) => structuredClone(state));
}
function nextAction(state: SimulationState): { action: VersatilityAction; revision: number } {
  const ep = state.runtime!.versatility;
  if (ep)
    return {
      revision: ep.revision,
      action:
        ep.phase === 'intervention'
          ? { type: 'conflict', choice: 'mediate' }
          : ep.phase === 'secret-choice'
            ? { type: 'secret', contestantId: ep.secretCandidates[0] }
            : { type: 'advance' },
    };
  const prep = state.runtime!.preparations?.[7];
  if (!prep) return { revision: 0, action: { type: 'start' } };
  return {
    revision: prep.revision,
    action: prep.mood
      ? { type: 'opening-cast', contestantIds: prep.shortlist.slice(0, prep.requiredSelections) }
      : {
          type: 'mood',
          choices: {
            vocalColor: prep.moodOptions.vocalColor[0],
            danceStyle: prep.moodOptions.danceStyle[0],
            rapStyle: prep.moodOptions.rapStyle[0],
            visualVibe: prep.moodOptions.visualVibe[0],
            leadershipStyle: prep.moodOptions.leadershipStyle[0],
            genreAffinity: prep.moodOptions.genreAffinity[0],
          },
        },
  };
}
function step(state: SimulationState) {
  const { action, revision } = nextAction(state);
  return transitionVersatility(state, action, revision);
}
function toPhase(state: SimulationState, phase: string) {
  for (let index = 0; index < 100 && state.runtime!.versatility?.phase !== phase; index++)
    state = step(state);
  assert.equal(state.runtime!.versatility?.phase, phase);
  return state;
}

describe('Versatility native core', () => {
  it('validates typed catalog references and all five real alternatives per song', () => {
    validateVersatilityCatalogs(catalogs.versatilitySongs, catalogs.doubtGirls);
    const broken = structuredClone(catalogs.doubtGirls);
    broken[0].favoredSpecialties[0].value = 'INVENTED';
    assert.throws(() => validateVersatilityCatalogs(catalogs.versatilitySongs, broken));
    assert.throws(() => validateVersatilityCatalogs(catalogs.versatilitySongs, catalogs.doubtGirls, null));
    const songs = structuredClone(catalogs.versatilitySongs);
    songs[0].parts.pop();
    assert.throws(() => validateVersatilityCatalogs(songs, catalogs.doubtGirls));
  });
  it('completes all 136 primary-track distributions with fifteen individual safe picks', () => {
    let distributions = 0;
    for (let vocal = 0; vocal <= 15; vocal++)
      for (let rap = 0; rap <= 15 - vocal; rap++) {
        distributions++;
        const people = peopleFor(vocal, rap, 15 - vocal - rap);
        const slots = createVersatilitySlots(people, catalogs.versatilitySongs);
        const rosters: Record<string, string[]> = Object.fromEntries(
          ['versatility-1', 'versatility-2', 'versatility-3'].map((id) => [id, []]),
        );
        let free = [...slots];
        let remaining = [...people];
        assert.equal(canCompleteVersatility(remaining, free), true);
        const random = createSeededRandom(vocal * 100 + rap);
        for (const person of people) {
          const pick = chooseVersatilityPick(
            person,
            remaining,
            free,
            rosters,
            people,
            random.next(),
            Object.fromEntries(slots.map((slot) => [slot.id, random.next()])),
          );
          const slot = free.find((slot) => slot.id === pick.slotId)!;
          assert.notEqual(slot.track, person.track);
          rosters[slot.teamId].push(person.id);
          free = free.filter((other) => other.id !== slot.id);
          remaining = remaining.filter((other) => other.id !== person.id);
          assert.equal(canCompleteVersatility(remaining, free), true);
        }
        assert.deepEqual(
          Object.values(rosters).map((ids) => ids.length),
          [5, 5, 5],
        );
      }
    assert.equal(distributions, 136);
  });
  it('rejects greedy dead ends and preserves professional priority over a hero gamble', () => {
    const people = peopleFor(1, 1, 0);
    people[0].coreSkills.rap = 5;
    people[0].coreSkills.dance = 1;
    const slots = [
      { id: 'rap', teamId: 'one', partId: 'one', track: 'RAP' as const },
      { id: 'dance', teamId: 'two', partId: 'two', track: 'DANCE' as const },
    ];
    assert.equal(canCompleteVersatility([people[1]], [slots[0]]), false);
    people[0].personality.discipline = 5;
    people[0].personality.ambition = 10;
    people[0].utilitySkills.potential = 5;
    const pick = chooseVersatilityPick(people[0], people, slots, { one: [], two: [] }, people, 0, {
      rap: 0,
      dance: 0,
    });
    assert.equal(pick.slotId, 'rap');
    assert.equal(pick.tactic, 'professional');
    people[0].personality.discipline = 0;
    people[0].personality.maturity = 0;
    const blockedGamble = chooseVersatilityPick(people[0], people, slots, { one: [], two: [] }, people, 0, {
      rap: 0,
      dance: 0,
    });
    assert.equal(blockedGamble.slotId, 'rap');
    assert.equal(blockedGamble.availableSlotIds.length, 1);
  });
  it('uses affection for otherwise equivalent choices and saves the 50% gamble', () => {
    const people = peopleFor(2, 0, 0);
    const person = people[0];
    person.coreSkills.rap = person.coreSkills.dance = 3;
    person.relationships[people[1].id] = [90];
    const slots = [
      { id: 'a', teamId: 'one', partId: 'a', track: 'RAP' as const },
      { id: 'b', teamId: 'two', partId: 'b', track: 'DANCE' as const },
    ];
    assert.equal(
      chooseVersatilityPick(person, people, slots, { one: [people[1].id], two: [] }, people, 0.9, {
        a: 0.9,
        b: 0,
      }).slotId,
      'a',
    );
    person.coreSkills.rap = 5;
    person.coreSkills.dance = 1;
    person.personality.discipline = 0;
    person.personality.maturity = 0;
    person.personality.ambition = 5;
    person.utilitySkills.potential = 4;
    assert.equal(
      chooseVersatilityPick(person, people, slots, { one: [], two: [] }, people, 0.49, { a: 0, b: 0 }).slotId,
      'b',
    );
    assert.equal(
      chooseVersatilityPick(person, people, slots, { one: [], two: [] }, people, 0.5, { a: 0, b: 0 }).slotId,
      'a',
    );
  });
  it('keeps nonstacking capped specialty boosts in the guest check only and reuses raw dice', () => {
    const person = peopleFor(1, 0, 0)[0];
    const team = teamFor([person.id]);
    person.coreSkills.rap = 1;
    person.coreSkills.stagePresence = 5;
    person.specialties.leadershipStyle = 'CARETAKER';
    person.specialties.vocalColor = 'STANDARD';
    const result = scoreVersatility(
      person,
      team,
      catalogs.versatilitySongs[0],
      'RAP',
      catalogs.doubtGirls[0],
      [1, 3],
      2,
      0,
    );
    assert.equal(result.effectiveGuestSkill, 3);
    assert.equal(result.baseSkill, 1);
    assert.equal(result.stageCheck.skillLevel, 5);
    assert.equal(result.john, result.trackCheck.score);
    assert.equal(result.guest, 0.7 * result.guestTrackCheck.score + 0.3 * result.stageCheck.score);
    assert.equal(
      result.finalScore,
      Math.min(
        100,
        (3 * result.trackCheck.score + 2 * result.guest + result.john + result.megan + result.michael) / 8 +
          4,
      ),
    );
    person.specialties.leadershipStyle = 'OTHER';
    person.specialties.vocalColor = 'OTHER';
    const plain = scoreVersatility(
      person,
      team,
      catalogs.versatilitySongs[0],
      'RAP',
      catalogs.doubtGirls[0],
      [1, 3],
      2,
      0,
    );
    for (const key of ['trackCheck', 'stageCheck', 'john', 'megan', 'michael'] as const)
      assert.deepEqual(result[key], plain[key]);
    person.coreSkills.rap = 4;
    person.specialties.vocalColor = 'STANDARD';
    assert.equal(
      scoreVersatility(
        person,
        team,
        catalogs.versatilitySongs[0],
        'RAP',
        catalogs.doubtGirls[0],
        [1, 3],
        0,
        -10,
      ).effectiveGuestSkill,
      5,
    );
  });
  it('enumerates all 36 growth pairs at potential 1..5 and truthfully caps gains', () => {
    const person = peopleFor(1, 0, 0)[0];
    person.coreSkills.rap = 2;
    for (let potential = 1; potential <= 5; potential++) {
      person.utilitySkills.potential = potential;
      let passes = 0;
      for (let gate = 1; gate <= 6; gate++)
        for (let die = 1; die <= 6; die++) {
          const result = versatilityBreakthrough(person, 'RAP', gate, die);
          passes += Number(result.passed);
          assert.equal(result.after, result.passed ? 3 : 2);
        }
      assert.equal(passes, potential);
    }
    person.coreSkills.rap = 5;
    assert.equal(versatilityBreakthrough(person, 'RAP', 6, 1).after, 5);
    assert.equal(person.coreSkills.rap, 5);
  });
  it('requires a stalled second session and both trait gates for refusal', () => {
    const person = peopleFor(1, 0, 0)[0];
    const team = teamFor([person.id]);
    person.specialties.visualVibe = 'MASCULINE';
    person.personality.curiosity = -5;
    person.personality.maturity = 4;
    team.practice = [
      {},
      { contestants: [{ contestantId: person.id, improved: true }] },
    ] as VersatilityTeam['practice'];
    assert.equal(versatilityRefuses(person, team), false);
    team.practice[1].contestants[0].improved = false;
    assert.equal(versatilityRefuses(person, team), true);
    person.personality.maturity = 5;
    assert.equal(versatilityRefuses(person, team), false);
    person.personality.maturity = 4;
    person.personality.curiosity = 5;
    assert.equal(versatilityRefuses(person, team), false);
  });
  it('completes a genuine season with locked old snapshots, three departures and no self MVP', async () => {
    const initial = await completedSix();
    const frozen = structuredClone(initial);
    let state = toPhase(initial, 'holding');
    const ep = state.runtime!.versatility!;
    assert.equal(ep.expulsion, null);
    assert.equal(ep.expelledId, null);
    assert.equal(ep.survivorIds.length, 13);
    assert.equal(ep.guestId !== null, true);
    assert.equal(ep.performances.length, 3);
    assert.deepEqual(initial, frozen);
    const oldPerformance = structuredClone(ep.performances);
    state = toPhase(state, 'complete');
    validateVersatility(state);
    const complete = state.runtime!.versatility!;
    assert.equal(complete.survivorIds.length, 12);
    assert.equal(complete.eliminatedIds.length, 2);
    assert.ok(complete.expelledId);
    assert.deepEqual(complete.performances, oldPerformance);
    assert.deepEqual(complete.startingContestants, initial.contestants);
    assert.deepEqual(state.runtime!.initialContestants, initial.runtime!.initialContestants);
    assert.deepEqual(state.runtime!.sourceContestants, initial.runtime!.sourceContestants);
    for (const person of state.contestants) {
      const before = initial.contestants.find((entry) => entry.id === person.id)!;
      if (!complete.participantIds.includes(person.id)) {
        assert.equal(person.rank, before.rank);
        assert.equal(person.status, before.status);
      } else assert.equal(person.aggregations.practice, complete.priorPractice[person.id]);
    }
    assert.equal(new Set(state.contestants.map((person) => person.rank)).size, 50);
    assert.equal(state.contestants.filter((person) => person.status === 'ACTIVE').length, 12);
    assert.equal(state.contestants.find((person) => person.id === complete.expelledId)!.rank, 13);
    assert.equal(Object.keys(complete.mvp!.ballots).length, 12);
    for (const [voter, candidate] of Object.entries(complete.mvp!.ballots)) assert.notEqual(voter, candidate);
    assert.equal(
      state.runtime!.show.general +
        Object.values(state.runtime!.show.fans).reduce((sum, count) => sum + count, 0),
      state.runtime!.show.audience,
    );
    assert.ok(Object.isFrozen(complete.startingContestants));
    for (const person of state.contestants.filter((person) => complete.participantIds.includes(person.id))) {
      assert.equal(
        person.aggregations.experience -
          initial.contestants.find((entry) => entry.id === person.id)!.aggregations.experience,
        5,
      );
      assert.ok(person.changeLog.some((entry) => entry.episode === 7));
    }
    for (const mutate of [
      (copy: SimulationState) => {
        copy.runtime!.versatility!.performances[0].evaluations[0].finalScore++;
      },
      (copy: SimulationState) => {
        copy.runtime!.versatility!.breakthroughs[0].gateDie = 0;
      },
      (copy: SimulationState) => {
        copy.runtime!.versatility!.draftPicks[0].tactic = 'gamble';
      },
      (copy: SimulationState) => {
        copy.runtime!.versatility!.expulsion!.incomingTotals[complete.expelledId!]++;
      },
      (copy: SimulationState) => {
        copy.contestants.find((person) => person.id === complete.survivorIds[0])!.coreSkills.vocals = 0;
      },
    ]) {
      const copy = structuredClone(state);
      mutate(copy);
      assert.throws(() => validateVersatility(copy));
    }
  });
  it('is revision-bound, duplicate-idempotent and atomic on rejected actions', async () => {
    const initial = toPhase(await completedSix(), 'draft');
    const snapshot = structuredClone(initial);
    const revision = initial.runtime!.versatility!.revision;
    const next = transitionVersatility(initial, { type: 'advance' }, revision);
    assert.equal(transitionVersatility(next, { type: 'advance' }, revision), next);
    assert.throws(() => transitionVersatility(next, { type: 'conflict', choice: 'push' }, revision));
    assert.throws(() =>
      transitionVersatility(initial, { type: 'secret', contestantId: initial.contestants[0].id }, revision),
    );
    assert.deepEqual(initial, snapshot);
  });
  it('reveals an exact second card while preserving first-card wrapper semantics', async () => {
    const state = await completedSix();
    const definitions = state.runtime!.definitions;
    const cards = Object.keys(definitions.cards.secret).slice(0, 2);
    const person = structuredClone(state.contestants[0]);
    person.attributes = [...cards];
    person.events = [`SECRET_REVEALED:${cards[0]}`];
    assert.throws(() => revealAuditionSecret([person], person.id, definitions));
    const result = revealExactAuditionSecret([person], person.id, cards[1], definitions);
    assert.equal(result.result.cardId, cards[1]);
    assert.equal(result.result.description, definitions.cards.secret[cards[1]].description);
    assert.ok(result.contestants[0].events.includes(`SECRET_REVEALED:${cards[0]}`));
    assert.ok(result.contestants[0].events.includes(`SECRET_REVEALED:${cards[1]}`));
    assert.throws(() => revealExactAuditionSecret(result.contestants, person.id, cards[1], definitions));
    assert.throws(() => revealExactAuditionSecret([person], person.id, 'invented', definitions));
  });
  it('uses all twelve incoming bonds and selects actual unrevealed holders before fallback', async () => {
    const state = await completedSix();
    const definitions = state.runtime!.definitions;
    const people = structuredClone(state.contestants.slice(0, 13));
    const cards = Object.keys(definitions.cards.secret).slice(0, 2);
    for (const person of people) {
      person.attributes = [];
      person.events = [];
    }
    people[0].attributes = [...cards];
    people[0].events = [`SECRET_REVEALED:${cards[0]}`];
    people[1].attributes = [cards[0]];
    for (const person of people) {
      if (person.id !== people[0].id) person.relationships[people[0].id] = [10];
      if (person.id !== people[1].id) person.relationships[people[1].id] = [20];
    }
    const selected = selectVersatilityExpulsion(
      people,
      people.map((person) => person.id),
      definitions,
      () => 0.5,
    );
    assert.equal(selected.expulsion.contestantId, people[0].id);
    assert.equal(selected.expulsion.incomingTotals[people[0].id], 120);
    assert.equal(selected.expulsion.cardId, cards[1]);
    assert.equal(selected.expulsion.assigned, false);
    for (const person of people) {
      person.events = [];
      person.attributes = [];
    }
    const fallback = selectVersatilityExpulsion(
      people,
      people.map((person) => person.id),
      definitions,
      () => 0.5,
    );
    assert.equal(fallback.expulsion.assigned, true);
    assert.ok(
      fallback.contestants
        .find((person) => person.id === fallback.expulsion.contestantId)!
        .attributes.includes(fallback.expulsion.cardId),
    );
    const selectedPerson = people.find((person) => person.id === fallback.expulsion.contestantId)!;
    selectedPerson.attributes = Object.keys(definitions.cards.secret);
    selectedPerson.events = selectedPerson.attributes.map((id) => `SECRET_REVEALED:${id}`);
    assert.deepEqual(versatilityFallbackPool(people, selectedPerson, definitions), []);
    assert.throws(() =>
      selectVersatilityExpulsion(
        people,
        people.map((person) => person.id),
        definitions,
        () => 0.5,
      ),
    );
  });
});
