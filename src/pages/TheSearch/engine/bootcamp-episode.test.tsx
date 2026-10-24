import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { BootcampEpisodeView } from '../components/BootcampEpisodeView';
import { EpisodeSceneNarrative } from '../components/EpisodeNarrative';
import { createSeasonCastProfiles } from '../utilities/contestant-profile';
import { createEpisodeRundown } from '../utilities/episode-rundown';
import { transitionBootcamp } from './bootcamp-episode';
import { advanceBootcampTo, completedBattlesForBootcamp, nextBootcampAction } from './bootcamp-fixtures';
import { assertBootcampEpisode } from './bootcamp-validation';
import { decodeSimulationState } from './simulation-persistence';

test('Boot Camp ranking shows places gained or lost after the rank, including on the final screen', () => {
  const beforeReveal = advanceBootcampTo(completedBattlesForBootcamp(), 'mvp');
  assert.doesNotMatch(
    renderToStaticMarkup(
      <BootcampEpisodeView onAction={() => {}} onInspect={() => {}} state={beforeReveal} />,
    ),
    /aria-label="Episode 3 ranking"/,
  );
  const ranked = advanceBootcampTo(beforeReveal, 'ranking');
  const episode = ranked.runtime!.bootcamp!;
  episode.previousRankedIds = [...episode.rankedIds];
  [episode.previousRankedIds[0], episode.previousRankedIds[5]] = [
    episode.previousRankedIds[5],
    episode.previousRankedIds[0],
  ];
  for (const state of [ranked, advanceBootcampTo(ranked, 'complete')]) {
    const original = JSON.stringify(state);
    const html = renderToStaticMarkup(
      <BootcampEpisodeView onAction={() => {}} onInspect={() => {}} state={state} />,
    );
    const list = html.match(/<ol aria-label="Episode 3 ranking"[^>]*>([\s\S]*?)<\/ol>/)?.[1];
    assert.ok(list);
    const rows = [...list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((match) => match[1]);
    assert.equal(rows.length, 18);
    assert.match(rows[0], /aria-label="Up 5 places"/);
    assert.match(rows[0], /aria-label="Increased"/);
    assert.match(rows[0].replace(/<[^>]+>/g, ''), /^1\.\s*5/);
    assert.match(rows[5], /aria-label="Down 5 places"/);
    assert.match(rows[5], /aria-label="Decreased"/);
    assert.match(rows[5].replace(/<[^>]+>/g, ''), /^6\.\s*5/);
    assert.doesNotMatch(rows[1], /aria-label="(?:Up|Down|Increased|Decreased)/);
    for (const [index, id] of episode.rankedIds.entries())
      assert.ok(rows[index].includes(`data-contestant-id="${id}"`));
    assert.equal(JSON.stringify(state), original);
  }
});

test('Boot Camp completes eight sequences with four individual wins, all eighteen surviving and immutable old archives', () => {
  const start = completedBattlesForBootcamp();
  const original = JSON.stringify(start);
  const state = advanceBootcampTo(start, 'complete');
  const runtime = state.runtime;
  const ep = runtime?.bootcamp;
  assert.ok(runtime && ep?.audience && ep.mvp);
  assert.equal(ep.evaluations.length, 36);
  assert.equal(
    new Set(ep.evaluations.filter((entry) => entry.round < 4).map((entry) => entry.contestantId)).size,
    18,
  );
  assert.equal(ep.winners.length, 4);
  assert.equal(ep.groups.length, 3);
  assert.equal(new Set(ep.groups.flatMap((group) => group.memberIds)).size, 18);
  assert.equal(ep.rankedIds.length, 18);
  assert.equal(ep.rankRevealed, true);
  assert.equal(ep.scoreAwardsApplied, true);
  assert.equal(Object.values(ep.mvp.ballots).length, 18);
  assert.equal(state.contestants.filter((person) => person.status === 'ACTIVE').length, 18);
  assert.deepEqual(
    ep.rankedIds.map((id) => state.contestants.find((person) => person.id === id)?.rank),
    Array.from({ length: 18 }, (_, index) => index + 1),
  );
  assert.equal(new Set(ep.scenes.map((scene) => scene.sequence)).size, 8);
  assert.equal(JSON.stringify(runtime.battle), JSON.stringify(start.runtime?.battle));
  assert.equal(JSON.stringify(runtime.audition), JSON.stringify(start.runtime?.audition));
  assert.equal(JSON.stringify(start), original);
  for (const id of ep.participantIds) {
    const person = state.contestants.find((person) => person.id === id);
    const old = start.contestants.find((person) => person.id === id);
    assert.ok(person && old);
    assert.deepEqual(person.coreSkills, old.coreSkills);
    assert.deepEqual(person.utilitySkills, old.utilitySkills);
    assert.deepEqual(person.personality, old.personality);
    assert.equal(person.condition, old.condition);
    assert.equal(person.aggregations.practice, old.aggregations.practice);
    assert.ok(person.changeLog.some((entry) => entry.episode === 3));
    assert.ok(!person.relationships[id]);
  }
  assert.equal(
    runtime.show.general + Object.values(runtime.show.fans).reduce((sum, fans) => sum + fans, 0),
    runtime.show.audience,
  );
  for (const scene of ep.scenes) {
    const html = renderToStaticMarkup(
      <EpisodeSceneNarrative
        contestants={state.contestants}
        onInspect={() => {}}
        reactions={[]}
        scene={scene}
      />,
    );
    assert.doesNotMatch(html, /\{\{|NaN|undefined/);
  }
  assert.equal(createEpisodeRundown(state, 1), createEpisodeRundown(start, 1));
  assert.equal(createEpisodeRundown(state, 2), createEpisodeRundown(start, 2));
  assert.equal(createSeasonCastProfiles(runtime), createSeasonCastProfiles(start.runtime!));
});

test('Boot Camp every-beat reload and duplicate advance match an uninterrupted run', () => {
  let direct = completedBattlesForBootcamp();
  let restored = decodeSimulationState(JSON.stringify(direct));
  for (let turn = 0; turn < 160 && direct.runtime?.bootcamp?.phase !== 'complete'; turn++) {
    const { action, revision } = nextBootcampAction(direct);
    direct = transitionBootcamp(direct, action, revision);
    restored = transitionBootcamp(restored, action, revision);
    assert.deepEqual(JSON.parse(JSON.stringify(restored)), JSON.parse(JSON.stringify(direct)));
    const duplicate = transitionBootcamp(restored, action, revision);
    assert.equal(duplicate, restored);
    restored = decodeSimulationState(JSON.stringify(restored));
    assert.deepEqual(JSON.parse(JSON.stringify(restored)), JSON.parse(JSON.stringify(direct)));
  }
  assert.equal(direct.runtime?.bootcamp?.phase, 'complete');
});

test('Boot Camp final individual standout can come from a losing group', () => {
  const start = structuredClone(completedBattlesForBootcamp());
  start.runtime!.randomState = 1;
  const state = advanceBootcampTo(start, 'complete');
  const ep = state.runtime!.bootcamp!;
  const winningGroup = ep.groups.find((group) => group.id === ep.winningGroupId);
  assert.ok(winningGroup);
  assert.ok(!winningGroup.memberIds.includes(ep.winners[3]));
});

test('Boot Camp empty beds affect only extroversion thresholds and are applied once per room', () => {
  const start = structuredClone(completedBattlesForBootcamp());
  const ids = start.runtime!.battle!.survivorIds;
  const thresholds = [5, -5, 4, -4, 0];
  ids.forEach((id, index) => {
    const person = start.contestants.find((person) => person.id === id)!;
    person.personality.extroversion = thresholds[index % thresholds.length];
    person.aggregations.happiness = index % 2 ? 100 : 0;
  });
  const state = advanceBootcampTo(start, 'credits');
  for (const id of ids) {
    const old = start.contestants.find((person) => person.id === id)!;
    const room = start.runtime!.battle!.rooms.find((room) => room.memberIds.includes(id))!;
    const empty = room.memberIds.filter((other) => !ids.includes(other)).length;
    const delta = old.personality.extroversion >= 5 ? -empty : old.personality.extroversion <= -5 ? empty : 0;
    const current = state.contestants.find((person) => person.id === id)!;
    assert.equal(
      current.aggregations.happiness,
      Math.max(0, Math.min(100, old.aggregations.happiness + delta)),
    );
    const opinion = state
      .runtime!.bootcamp!.scenes.filter((scene) => scene.sequence === 1)
      .flatMap((scene) =>
        scene.paragraphs.filter(
          (_, index) =>
            scene.paragraphContestantIds?.[index].length === 1 &&
            scene.paragraphContestantIds[index][0] === id,
        ),
      )[0];
    assert.ok(opinion);
    assert.equal(
      opinion.includes('happiness'),
      old.aggregations.happiness !== current.aggregations.happiness,
    );
    assert.doesNotMatch(opinion, /happiness from/);
  }
});

test('Boot Camp ballots permit self nomination, lock all groups before reveals, and use all eighteen exactly once', () => {
  const start = structuredClone(completedBattlesForBootcamp());
  for (const person of start.contestants) {
    person.personality.ambition = 10;
    person.personality.extroversion = 10;
    person.personality.maturity = 0;
    person.personality.gentleness = 0;
  }
  let state = advanceBootcampTo(start, 'ballots');
  const ep = state.runtime!.bootcamp!;
  const first = ep.groups[0];
  for (const voter of first.memberIds) assert.ok(first.ballots['1'][voter].includes(voter));
  while (state.runtime!.bootcamp!.groupCursor < 3) {
    const { action, revision } = nextBootcampAction(state);
    state = transitionBootcamp(state, action, revision);
  }
  assert.equal(state.runtime!.bootcamp!.phase, 'ballots');
  assert.doesNotMatch(JSON.stringify(state.runtime!.bootcamp!.scenes), /Marathon Mic/);
  state = advanceBootcampTo(state, 'complete');
  for (const group of state.runtime!.bootcamp!.groups) {
    assert.equal(Object.keys(group.ballots['1']).length, 6);
    assert.equal(Object.keys(group.ballots['2']).length, 6);
    assert.equal(group.ballots['3'], undefined);
    assert.equal(new Set(group.pairs.flat()).size, 6);
  }
});

test('Boot Camp strict validation rejects forged winners, repeated entrants, altered checks and self MVP votes', () => {
  const state = advanceBootcampTo(completedBattlesForBootcamp(), 'complete');
  const runtime = state.runtime!;
  const ep = runtime.bootcamp!;
  const validate = (value: unknown) => assertBootcampEpisode(value, state.contestants, runtime.definitions);
  const winner = structuredClone(ep);
  winner.winners[0] = winner.participantIds.find(
    (id) => !ep.evaluations.some((entry) => entry.round === 1 && entry.contestantId === id),
  )!;
  assert.throws(() => validate(winner), /winner/);
  const pair = structuredClone(ep);
  pair.groups[0].pairs[1][0] = pair.groups[0].pairs[0][0];
  assert.throws(() => validate(pair), /duplicate/);
  const evidence = structuredClone(ep);
  Object.values(evidence.evaluations[0].checks)[0].score += 0.5;
  assert.throws(() => validate(evidence), /score mismatch/);
  const mvp = structuredClone(ep);
  mvp.mvp!.ballots[mvp.participantIds[0]] = mvp.participantIds[0];
  assert.throws(() => validate(mvp), /self MVP/);
  const reset = structuredClone(ep);
  reset.groupResults[0].resets = 6;
  assert.throws(() => validate(reset), /0..5/);
  const finalScore = structuredClone(ep);
  finalScore.evaluations[0].finalScore = finalScore.evaluations[0].finalScore === 100 ? 99 : 100;
  assert.throws(() => validate(finalScore), /final score mismatch/);
  const dialogue = structuredClone(ep);
  const assessment = dialogue.scenes.find((scene) => scene.dialogues)?.dialogues?.[0];
  assert.ok(assessment);
  assessment.paragraphContestantIds = [];
  assert.throws(() => validate(dialogue), /dialogue identities/);
  const premature = structuredClone(ep);
  premature.phase = 'reveal';
  assert.throws(() => validate(premature), /phase mismatch/);
  const groupWinner = structuredClone(ep);
  groupWinner.winningGroupId = groupWinner.groups.find((group) => group.id !== ep.winningGroupId)!.id;
  assert.throws(() => validate(groupWinner), /group winner/);
});

test('Boot Camp rejects older formats, invalid decisions, stale actions and incomplete predecessor episodes', () => {
  const start = structuredClone(completedBattlesForBootcamp());
  start.runtime!.version = 2;
  assert.throws(() => transitionBootcamp(start, { type: 'start' }, 0), /current-format/);
  start.runtime!.version = 3;
  start.runtime!.battle!.phase = 'mvp';
  assert.throws(() => transitionBootcamp(start, { type: 'start' }, 0), /Complete The Battles/);
  const state = advanceBootcampTo(completedBattlesForBootcamp(), 'groups');
  assert.throws(
    () => transitionBootcamp(state, { type: 'start' }, state.runtime!.bootcamp!.revision),
    /Only continuing/,
  );
  assert.throws(() => transitionBootcamp(state, { type: 'advance' }, 999), /stale/);
});
