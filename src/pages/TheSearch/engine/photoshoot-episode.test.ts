import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Contestant } from '../types/contestant';
import type { MegaGroupsAction } from '../types/mega-groups-episode';
import type {
  IndividualPhoto,
  PhotoshootAction,
  PhotoshootPhase,
  PhotoshootTeam,
} from '../types/photoshoot-episode';
import type { SimulationState } from '../types/simulation';
import { createContestant } from '../utilities/contestant-factory';
import { getPhotoshootConcepts, validatePhotoshootConcepts } from '../utilities/photoshoot-concepts';
import { battleRelationship } from './battle-scoring';
import { advanceBootcampTo, completedBattlesForBootcamp } from './bootcamp-fixtures';
import { transitionMegaGroups } from './mega-groups-episode';
import { transitionPhotoshoot } from './photoshoot-episode';
import {
  choosePhotoshootVisual,
  photoshootStylingQuality,
  scoreGroupPhotoMember,
  scoreIndividualPhoto,
} from './photoshoot-scoring';
import { assertPhotoshootEpisode } from './photoshoot-validation';

let baseline: SimulationState | undefined;
function completedMegaGroups() {
  if (!baseline) {
    let state = advanceBootcampTo(completedBattlesForBootcamp(), 'complete');
    for (let count = 0; count < 140 && state.runtime!.megaGroups?.phase !== 'complete'; count++) {
      const ep = state.runtime!.megaGroups;
      const prep = state.runtime!.preparations?.[4];
      let action: MegaGroupsAction;
      if (ep)
        action =
          ep.phase === 'intervention'
            ? { type: 'conflict', choice: 'mediate' }
            : ep.phase === 'secret-choice'
              ? { type: 'secret', contestantId: ep.secretCandidates[0] }
              : { type: 'advance' };
      else if (!prep) action = { type: 'start' };
      else if (!prep.mood)
        action = {
          type: 'mood',
          choices: {
            vocalColor: prep.moodOptions.vocalColor[0],
            danceStyle: prep.moodOptions.danceStyle[0],
            rapStyle: prep.moodOptions.rapStyle[0],
            visualVibe: prep.moodOptions.visualVibe[0],
            leadershipStyle: prep.moodOptions.leadershipStyle[0],
            genreAffinity: prep.moodOptions.genreAffinity[0],
          },
        };
      else action = { type: 'opening-cast', contestantIds: prep.shortlist.slice(0, prep.requiredSelections) };
      state = transitionMegaGroups(state, action, ep?.revision ?? prep?.revision ?? 0);
    }
    assert.equal(state.runtime!.megaGroups?.phase, 'complete');
    baseline = state;
  }
  return structuredClone(baseline);
}
function next(state: SimulationState, action?: PhotoshootAction) {
  const ep = state.runtime!.photoshoot;
  const prep = state.runtime!.preparations?.[5];
  if (!action) {
    if (ep)
      action =
        ep.phase === 'styling-choice'
          ? { type: 'styling', choice: 'intervene' }
          : ep.phase === 'secret-choice'
            ? { type: 'secret', contestantId: ep.secretCandidates[0] }
            : { type: 'advance' };
    else if (!prep) action = { type: 'start' };
    else if (!prep.mood)
      action = {
        type: 'mood',
        choices: {
          vocalColor: prep.moodOptions.vocalColor[0],
          danceStyle: prep.moodOptions.danceStyle[0],
          rapStyle: prep.moodOptions.rapStyle[0],
          visualVibe: prep.moodOptions.visualVibe[0],
          leadershipStyle: prep.moodOptions.leadershipStyle[0],
          genreAffinity: prep.moodOptions.genreAffinity[0],
        },
      };
    else action = { type: 'opening-cast', contestantIds: prep.shortlist.slice(0, prep.requiredSelections) };
  }
  return transitionPhotoshoot(state, action, ep?.revision ?? prep?.revision ?? 0);
}
function to(state: SimulationState, phase: PhotoshootPhase) {
  for (let count = 0; count < 100 && state.runtime!.photoshoot?.phase !== phase; count++) state = next(state);
  assert.equal(state.runtime!.photoshoot?.phase, phase);
  return state;
}
function scoreFixture(): { contestant: Contestant; team: PhotoshootTeam } {
  const contestant = createContestant({ id: 'photo', name: 'Photo' });
  contestant.coreSkills.visual = 1;
  contestant.coreSkills.uniqueness = 3;
  contestant.coreSkills.stagePresence = 4;
  contestant.utilitySkills.charisma = 5;
  contestant.utilitySkills.potential = 2;
  const team: PhotoshootTeam = {
    id: 'team',
    name: 'Test',
    conceptId: 'test',
    leaderId: contestant.id,
    memberIds: [contestant.id],
    conceptScores: {},
    conceptTieKeys: {},
    proposals: [],
    negotiation: null,
    styling: {
      completed: true,
      choice: 'intervene',
      quality: 50,
      modifier: 15,
      outfitModifiers: { photo: 5 },
      finalOutfits: { photo: 'Tailoring' },
      description: 'Stylist finished.',
    },
    centerId: contestant.id,
    centerBallots: {},
    centerTotals: {},
    centerTieKeys: {},
  };
  return { contestant, team };
}

test('native photo checks share raw dice, normalize medium floors, and apply temporary adjustments only once', () => {
  const { contestant, team } = scoreFixture();
  const before = structuredClone(contestant);
  const photo = scoreIndividualPhoto(contestant, team, [1, 6]);
  assert.deepEqual(
    photo.checks.map(({ floor }) => floor),
    [1, 3, 5, 1],
  );
  assert.deepEqual(
    photo.checks.map(({ score }) => score),
    [50, 70, 90, 50],
  );
  assert.equal(photo.technicalScore, 66);
  assert.equal(photo.finalScore, 86);
  assert.equal(photo.feedback[0].score, 64);
  assert.equal(photo.feedback[1].score, 62);
  assert.equal(photo.grade, 'A');
  const cover = scoreGroupPhotoMember(contestant, team, [1, 6], 0, -2);
  assert.equal(cover.technicalScore, 71);
  assert.equal(cover.finalScore, 94);
  assert.deepEqual(contestant, before);
  contestant.coreSkills.uniqueness = 1;
  contestant.personality.curiosity = -10;
  assert.equal(photoshootStylingQuality([contestant]), 0);
  contestant.coreSkills.uniqueness = 5;
  contestant.personality.curiosity = 10;
  assert.equal(photoshootStylingQuality([contestant]), 100);
});

test('Ultimate Visual keeps friendship dominant and applies only the >=95 / +25 exceptional-photo override', () => {
  const cast = ['voter', 'friend', 'rival', 'other'].map((id) => createContestant({ id, name: id }));
  cast[0].relationships.friend = [100];
  cast[0].relationships.rival = [0];
  cast[0].relationships.other = [20];
  const fixturePhoto = scoreIndividualPhoto(scoreFixture().contestant, scoreFixture().team, [1, 6]);
  const photos: IndividualPhoto[] = cast.map(({ id }) => ({
    ...structuredClone(fixturePhoto),
    contestantId: id,
    finalScore: id === 'rival' ? 95 : 70,
  }));
  const ties = Object.fromEntries(
    cast.map(({ id }) => [
      id,
      Object.fromEntries(
        cast.filter((entry) => entry.id !== id).map((entry, index) => [entry.id, index / 10]),
      ),
    ]),
  );
  const awardTies = Object.fromEntries(cast.map(({ id }, index) => [id, index / 10]));
  let result = choosePhotoshootVisual(cast, photos, ties, awardTies);
  assert.equal(result.result.ballots.voter, 'rival');
  assert.equal(result.evidence.voter.override, true);
  photos.find(({ contestantId }) => contestantId === 'friend')!.finalScore = 71;
  result = choosePhotoshootVisual(cast, photos, ties, awardTies);
  assert.equal(result.result.ballots.voter, 'friend');
  assert.equal(result.evidence.voter.override, false);
  photos.find(({ contestantId }) => contestantId === 'friend')!.finalScore = 69;
  photos.find(({ contestantId }) => contestantId === 'rival')!.finalScore = 94;
  result = choosePhotoshootVisual(cast, photos, ties, awardTies);
  assert.equal(result.result.ballots.voter, 'friend');
  for (const [voter, choice] of Object.entries(result.result.ballots)) assert.notEqual(voter, choice);
  assert.equal(
    Object.values(result.result.totals).reduce((sum, value) => sum + value, 0),
    4,
  );
});

test('concept fit validation uses frozen archived vibe keys and rejects omissions, unknown keys and duplicate choices', () => {
  const concepts = getPhotoshootConcepts();
  const keys = Object.keys(concepts[0].vibeFit);
  const archived = structuredClone(concepts);
  const remap = (fit: Record<string, 0 | 50 | 100>) =>
    Object.fromEntries(Object.entries(fit).map(([key, value]) => [`ARCHIVED_${key}`, value]));
  for (const concept of archived) {
    concept.vibeFit = remap(concept.vibeFit);
    for (const choice of [...concept.outfits, ...concept.props]) {
      choice.vibeFit = remap(choice.vibeFit);
    }
  }
  assert.deepEqual(
    validatePhotoshootConcepts(
      archived,
      keys.map((key) => `ARCHIVED_${key}`),
    ),
    archived,
  );
  assert.throws(() => validatePhotoshootConcepts(archived, keys), /missing or unknown/);
  delete concepts[0].vibeFit.WARM;
  assert.throws(() => validatePhotoshootConcepts(concepts, keys), /missing or unknown/);
  const duplicate = getPhotoshootConcepts();
  duplicate[0].props.push(structuredClone(duplicate[0].props[0]));
  assert.throws(() => validatePhotoshootConcepts(duplicate, keys), /repeated wardrobe/);
});

test('styling is four exclusive gates and photography advances only the current contestant or team', () => {
  const initial = completedMegaGroups();
  const original = structuredClone(initial);
  let state = to(initial, 'styling-choice');
  assert.deepEqual(initial, original);
  const ep = state.runtime!.photoshoot!;
  assert.equal(ep.draftPicks.length, 12);
  assert.deepEqual(
    ep.draftPicks.map(({ teamId }) => teamId),
    Array.from({ length: 12 }, (_, index) => ep.teams[index % 4].id),
  );
  assert.equal(ep.individualPhotos.length, 0);
  assert.equal(ep.teams.filter(({ styling }) => styling).length, 0);
  const firstIds = [...ep.teams[0].memberIds];
  const happiness = Object.fromEntries(
    firstIds.map((id) => [id, state.contestants.find((entry) => entry.id === id)!.aggregations.happiness]),
  );
  const revision = ep.revision;
  const action = { type: 'styling', choice: 'intervene' } as const;
  state = next(state, action);
  assert.equal(transitionPhotoshoot(state, action, revision), state);
  assert.throws(() => transitionPhotoshoot(state, { type: 'advance' }, revision), /stale/);
  assert.throws(() => next(state, { type: 'styling', choice: 'self-style' }), /No Photoshoot styling/);
  for (const id of firstIds) {
    assert.equal(
      state.contestants.find((entry) => entry.id === id)!.aggregations.happiness,
      Math.max(0, happiness[id] - 3),
    );
    assert.ok(
      state
        .runtime!.photoshoot!.scenes.at(-1)!
        .contestantChanges?.[id].some((entry) => entry.path === 'aggregations.happiness'),
    );
  }
  state = next(state);
  assert.equal(state.runtime!.photoshoot!.teamCursor, 1);
  const nextIds = state.runtime!.photoshoot!.teams[1].memberIds;
  const beforeSelf = nextIds.map(
    (id) => state.contestants.find((entry) => entry.id === id)!.aggregations.happiness,
  );
  state = next(state, { type: 'styling', choice: 'self-style' });
  assert.deepEqual(
    nextIds.map((id) => state.contestants.find((entry) => entry.id === id)!.aggregations.happiness),
    beforeSelf,
  );
  state = to(state, 'individual');
  assert.equal(state.runtime!.photoshoot!.teams.filter(({ styling }) => styling).length, 4);
  assert.equal(state.runtime!.photoshoot!.individualPhotos.length, 1);
  assert.equal(state.runtime!.photoshoot!.groupPhotos.length, 0);
  assert.equal(state.runtime!.photoshoot!.audience, null);
  state = next(state);
  assert.equal(state.runtime!.photoshoot!.individualPhotos.length, 2);
  state = to(state, 'center');
  assert.equal(state.runtime!.photoshoot!.groupPhotos.length, 0);
  state = next(state);
  assert.equal(state.runtime!.photoshoot!.groupPhotos.length, 1);
});

test('gallery votes precede the award and locked audience ranking, while strict validation rejects native evidence corruption', () => {
  let state = to(completedMegaGroups(), 'gallery');
  const originalEpisodes = [
    structuredClone(state.runtime!.audition),
    structuredClone(state.runtime!.battle),
    structuredClone(state.runtime!.bootcamp),
    structuredClone(state.runtime!.megaGroups),
  ];
  state = next(state);
  assert.equal(state.runtime!.photoshoot!.phase, 'ballots');
  assert.equal(state.runtime!.photoshoot!.ultimateVisual, null);
  assert.equal(state.runtime!.photoshoot!.audience, null);
  const vote = state.runtime!.photoshoot!.peerVote!;
  const winner = state.contestants.find(({ id }) => id === vote.winnerId)!;
  const previousMvp = winner.aggregations.mvp;
  const ratio = winner.aggregations.audienceRatio;
  const visiblePoints = Object.fromEntries(
    state.contestants.map((entry) => [entry.id, entry.aggregations.rankingScore]),
  );
  state = next(state);
  const ep = state.runtime!.photoshoot!;
  assert.equal(ep.phase, 'ultimate-visual');
  assert.ok(ep.audience);
  assert.equal(state.contestants.find(({ id }) => id === vote.winnerId)!.aggregations.mvp, previousMvp + 1);
  assert.ok(
    state.contestants.find(({ id }) => id === vote.winnerId)!.aggregations.audienceRatio >=
      Math.min(1, ratio + 0.1),
  );
  assert.equal(ep.rankRevealed, false);
  assert.deepEqual(
    Object.fromEntries(state.contestants.map((entry) => [entry.id, entry.aggregations.rankingScore])),
    visiblePoints,
  );
  const validate = (record: unknown) =>
    assertPhotoshootEpisode(record, state.contestants, state.runtime!.definitions);
  validate(JSON.parse(JSON.stringify(ep)));
  const invalidDice = structuredClone(ep);
  invalidDice.individualPhotos[0].rawDice = [0, 1];
  assert.throws(() => validate(invalidDice), /invalid bounded number/);
  const invalidComposite = structuredClone(ep);
  invalidComposite.groupPhotos[0].evaluations[0].technicalScore += 1;
  assert.throws(() => validate(invalidComposite), /composite mismatch/);
  const selfVote = structuredClone(ep);
  const id = ep.participantIds[0];
  selfVote.peerVote!.ballots[id] = id;
  assert.throws(() => validate(selfVote), /self vote/);
  const invalidStyling = structuredClone(ep);
  invalidStyling.teams[0].styling!.modifier = 16;
  assert.throws(() => validate(invalidStyling), /styling modifier mismatch/);
  const locked = [...ep.rankedIds];
  state = to(state, 'complete');
  assert.deepEqual(state.runtime!.photoshoot!.rankedIds, locked);
  assert.equal(state.contestants.filter(({ status }) => status === 'ACTIVE').length, 16);
  assert.deepEqual(
    [state.runtime!.audition, state.runtime!.battle, state.runtime!.bootcamp, state.runtime!.megaGroups],
    originalEpisodes,
  );
  assert.ok(!JSON.stringify(state.runtime!.photoshoot).includes('[[contestant:'));
});

test('successful focus stealing takes priority over gentleness, while yielding supports only the actual center', () => {
  for (const steal of [true, false]) {
    const initial = completedMegaGroups();
    for (const contestant of initial.contestants.filter(({ status }) => status === 'ACTIVE')) {
      contestant.personality.ambition = steal ? 10 : -10;
      contestant.personality.gentleness = 10;
      contestant.coreSkills.stagePresence = 5;
    }
    let state = to(initial, 'center');
    const team = state.runtime!.photoshoot!.teams[0];
    const before = new Map(state.contestants.map((entry) => [entry.id, structuredClone(entry)]));
    state = next(state);
    const photo = state.runtime!.photoshoot!.groupPhotos[0];
    assert.equal(photo.actions.length, 3);
    assert.equal(photo.supportCohesion, steal ? 0 : 6);
    assert.equal(photo.stealingPenalty, steal ? 6 : 0);
    for (const action of photo.actions) {
      assert.equal(action.type, steal ? 'steal' : 'yield');
      assert.equal(action.success, true);
      assert.equal(action.modifier, steal ? 10 : -5);
      assert.notEqual(action.contestantId, team.centerId);
      if (steal) {
        for (const observer of team.memberIds.filter((id) => id !== action.contestantId)) {
          const current = state.contestants.find(({ id }) => id === observer)!;
          assert.equal(
            battleRelationship(current, action.contestantId),
            Math.max(
              0,
              battleRelationship(before.get(observer)!, action.contestantId) -
                (observer === team.centerId ? 8 : 6),
            ),
          );
        }
      } else {
        assert.equal(action.beneficiaryId, team.centerId);
        const center = state.contestants.find(({ id }) => id === team.centerId)!;
        assert.equal(
          battleRelationship(center, action.contestantId),
          Math.min(100, battleRelationship(before.get(center.id)!, action.contestantId) + 2),
        );
      }
    }
  }
});
