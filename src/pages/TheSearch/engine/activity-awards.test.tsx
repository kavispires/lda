import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { EpisodeNarrative } from '../components/EpisodeNarrative';
import type { AuditionReaction, EpisodeScene } from '../types/audition-episode';
import type { SimulationState } from '../types/simulation';
import { createEpisodeRundown } from '../utilities/episode-rundown';
import { projectEpisodeContestant } from '../utilities/episode-visibility';
import { awardNewActivity, recordAiredReactions, recordSceneTV } from './activity-awards';
import { advanceBootcampTo, completedBattlesForBootcamp } from './bootcamp-fixtures';
import { transitionBattleStory } from './narrative-battle';
import {
  advanceBattleStoryTo,
  narrativeBattleFixture,
  nextBattleStoryAction,
} from './narrative-battle-fixtures';
import { decodeSimulationState } from './simulation-persistence';

function oldSave(state: SimulationState): string {
  return JSON.stringify(state, (key, value: unknown) => {
    if (key === 'progression' || key === 'tvMoments') return undefined;
    if (key === 'aggregations' && value !== null && typeof value === 'object' && 'rankingScore' in value) {
      const { rankingScore, ...rest } = value;
      return { ...rest, score: rankingScore };
    }
    return value;
  });
}

test('TV awards accumulate by actual moment tier, including negative drama, without altering competition points', () => {
  const before = completedBattlesForBootcamp();
  const original = JSON.stringify(before);
  const next = structuredClone(before);
  const people = next.contestants.slice(0, 3);
  const scene: EpisodeScene = {
    id: 'new-camera-moments',
    kind: 'recap',
    title: 'A glance, a conversation, and a heated argument',
    paragraphs: [],
    contestantIds: people.map((person) => person.id),
    tvMoments: { appearance: { [people[0].id]: 1, [people[1].id]: 3, [people[2].id]: 6 } },
  };
  next.runtime!.battle!.scenes.push(scene);
  const awarded = awardNewActivity(before, next);
  for (const [index, person] of people.entries()) {
    const prior = before.contestants.find((entry) => entry.id === person.id)!;
    assert.equal(person.aggregations.score, prior.aggregations.score + [1, 3, 6][index]);
    assert.equal(person.aggregations.rankingScore, prior.aggregations.rankingScore);
    assert.equal(person.aggregations.experience, prior.aggregations.experience);
    assert.equal(person.rank, prior.rank);
  }
  assert.equal(awarded.runtime!.randomState, before.runtime!.randomState);
  const repeated = awardNewActivity(awarded, structuredClone(awarded));
  assert.deepEqual(repeated, awarded);
  assert.equal(JSON.stringify(before), original);
  const hidden = projectEpisodeContestant(people[0], { ...awarded.runtime!, battle: null });
  assert.equal(hidden.aggregations.score, people[0].aggregations.score);
  assert.equal(hidden.aggregations.rankingScore, 0);
});

test('practice and completed performances earn XP once, including failed challenges and full-group participation', () => {
  const start = completedBattlesForBootcamp();
  const final = advanceBootcampTo(start, 'complete');
  const episode = final.runtime!.bootcamp!;
  for (const person of final.contestants) {
    const prior = start.contestants.find((entry) => entry.id === person.id)!;
    assert.equal(
      person.aggregations.experience,
      prior.aggregations.experience + (episode.participantIds.includes(person.id) ? 6 : 0),
    );
    assert.deepEqual(person.coreSkills, prior.coreSkills);
    assert.deepEqual(person.utilitySkills, prior.utilitySkills);
  }
  const ledger = final.runtime!.progression!.awards;
  const xp = (number: number) =>
    Object.entries(ledger)
      .filter(([key]) => key.startsWith(`[${number},`))
      .reduce((sum, [, award]) => sum + award.experience, 0);
  assert.equal(xp(1), 50 * 3);
  assert.equal(xp(2), 30 * 2 + 30 * 3);
  assert.equal(xp(3), 18 * 2 * 3);
  const failed = episode.evaluations.find((evaluation) => evaluation.finalScore < 60);
  assert.ok(failed);
  const award = ledger[JSON.stringify([3, `challenge:${failed.round}`, failed.contestantId])];
  assert.equal(award.experience, 3);
  assert.deepEqual(decodeSimulationState(JSON.stringify(final)), JSON.parse(JSON.stringify(final)));
});

test('distinct aired reactions in one montage accumulate separately without repeating the same reaction', () => {
  const before = completedBattlesForBootcamp();
  const observer = before.runtime!.audition!.reactions[0].observerId;
  const reactions = before
    .runtime!.audition!.reactions.filter((reaction) => reaction.observerId === observer)
    .slice(0, 2)
    .map(
      (reaction): AuditionReaction => ({
        ...reaction,
        type: 'jealousy',
        relationshipBefore: 50,
        relationshipAfter: 49,
        composureBefore: 0,
        composureAfter: 0,
      }),
    );
  assert.equal(new Set(reactions.map((reaction) => reaction.performerId)).size, 2);
  const scene: EpisodeScene = {
    id: 'two-aired-reactions',
    kind: 'recap',
    title: 'Two reactions',
    paragraphs: [],
    contestantIds: [observer],
  };
  recordAiredReactions(scene, reactions);
  recordAiredReactions(scene, reactions);
  const next = structuredClone(before);
  next.runtime!.battle!.scenes.push(scene);
  const after = awardNewActivity(before, next).contestants.find((person) => person.id === observer)!;
  const prior = before.contestants.find((person) => person.id === observer)!;
  assert.equal(after.aggregations.score, prior.aggregations.score + 6);
  assert.equal(after.aggregations.experience, prior.aggregations.experience);
});

test('old saves preserve competition points and experience, adopt TV at zero, and award only future activity', () => {
  const old = completedBattlesForBootcamp();
  const serialized = oldSave(old);
  const restored = decodeSimulationState(serialized);
  for (const person of restored.contestants) {
    const prior = old.contestants.find((entry) => entry.id === person.id)!;
    assert.equal(person.aggregations.score, 0);
    assert.equal(person.aggregations.rankingScore, prior.aggregations.rankingScore);
    assert.equal(person.aggregations.experience, prior.aggregations.experience);
    assert.equal(person.rank, prior.rank);
  }
  assert.equal(restored.runtime!.randomState, old.runtime!.randomState);
  assert.deepEqual(restored.runtime!.progression!.awards, {});
  const again = decodeSimulationState(JSON.stringify(restored));
  assert.deepEqual(again, restored);
  const final = advanceBootcampTo(again, 'complete');
  for (const person of final.contestants) {
    const prior = restored.contestants.find((entry) => entry.id === person.id)!;
    const participated = final.runtime!.bootcamp!.participantIds.includes(person.id);
    assert.equal(person.aggregations.experience, prior.aggregations.experience + (participated ? 6 : 0));
    assert.equal(person.aggregations.score > 0, participated);
  }
  assert.ok(Object.keys(final.runtime!.progression!.awards).every((key) => key.startsWith('[3,')));
});

test('adopting a partial episode does not reaward completed rehearsals when their footage airs later', () => {
  const partial = advanceBattleStoryTo(narrativeBattleFixture(), 'rehearsal');
  const opponent = partial.runtime!.battle!.teams.find(
    (team) =>
      team.practice.length > 0 &&
      !partial.runtime!.battle!.scenes.some(
        (scene) => scene.kind === 'practice' && scene.contestantIds.includes(team.captainId),
      ),
  );
  assert.ok(opponent);
  let state = decodeSimulationState(oldSave(partial));
  const experience = opponent.memberIds.map(
    (id) => state.contestants.find((person) => person.id === id)!.aggregations.experience,
  );
  for (let turn = 0; turn < 20; turn++) {
    const { action, revision } = nextBattleStoryAction(state);
    state = transitionBattleStory(state, action, revision);
    if (
      state.runtime!.battle!.scenes.some(
        (scene) => scene.kind === 'practice' && scene.contestantIds.includes(opponent.captainId),
      )
    )
      break;
  }
  assert.ok(
    state.runtime!.battle!.scenes.some(
      (scene) => scene.kind === 'practice' && scene.contestantIds.includes(opponent.captainId),
    ),
  );
  assert.deepEqual(
    opponent.memberIds.map(
      (id) => state.contestants.find((person) => person.id === id)!.aggregations.experience,
    ),
    experience,
  );
  assert.deepEqual(decodeSimulationState(JSON.stringify(state)), JSON.parse(JSON.stringify(state)));
});

test('migrated nested ranking evidence remains hidden before the public ranking reveal', () => {
  const before = narrativeBattleFixture();
  before.contestants[0].changeLog[0].change.legacySnapshot = { aggregations: { score: 789 } };
  const restored = decodeSimulationState(oldSave(before));
  const projected = projectEpisodeContestant(restored.contestants[0], restored.runtime!);
  assert.equal(projected.aggregations.score, 0);
  assert.equal(projected.aggregations.rankingScore, 0);
  assert.deepEqual(projected.changeLog[0].change.legacySnapshot, { aggregations: {} });
});

test('invalid TV awards and persisted ledgers fail explicitly', () => {
  const before = completedBattlesForBootcamp();
  const next = structuredClone(before);
  const scene = recordSceneTV({
    id: 'invalid-recipient',
    kind: 'recap',
    title: 'Invalid',
    paragraphs: [],
    contestantIds: ['unknown'],
  });
  next.runtime!.battle!.scenes.push(scene);
  assert.throws(() => awardNewActivity(before, next), /unknown contestant/);
  const damaged = structuredClone(before);
  const first = Object.values(damaged.runtime!.progression!.awards)[0];
  first.tv = -1;
  assert.throws(() => decodeSimulationState(JSON.stringify(damaged)), /activity award/);
  const mismatched = structuredClone(before);
  mismatched.contestants[0].aggregations.score++;
  assert.throws(() => decodeSimulationState(JSON.stringify(mismatched)), /TV totals/);
  const past = structuredClone(before);
  past.runtime!.audition!.scenes.push(
    recordSceneTV({
      id: 'past-episode-edit',
      kind: 'recap',
      title: 'Past event',
      paragraphs: [],
      contestantIds: [past.contestants[0].id],
    }),
  );
  assert.throws(() => awardNewActivity(before, past), /different episode/);
});

test('live and archived story presentation and copied rundowns keep point mechanics silent', () => {
  const final = advanceBootcampTo(completedBattlesForBootcamp(), 'complete');
  const legacy =
    'A contestant is the individual winner. Their audience preference rises, and five continuing-score points will be included in the closing ranking.';
  const html = renderToStaticMarkup(<EpisodeNarrative text={legacy} />);
  assert.match(html, /individual winner/);
  assert.doesNotMatch(html, /points|preference|score/);
  final.runtime!.bootcamp!.scenes.at(-1)!.paragraphs.push(legacy);
  const text = createEpisodeRundown(final, 3);
  assert.doesNotMatch(
    text,
    /continuing-score|rankingScore|aggregations\.(score|experience)|TV Score|Winner reward|\bXP\b|hidden ranking points/i,
  );
});
