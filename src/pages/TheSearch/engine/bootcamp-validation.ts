import type { BootcampEpisode } from '../types/bootcamp-episode';
import type { Contestant } from '../types/contestant';
import type { SimulationDefinitions } from '../types/simulation';
import { battleCheck } from './battle-scoring';
import { bootcampWinner, bootcampWinningGroup } from './bootcamp-scoring';

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid Boot Camp: ${message}.`);
}
function object(value: unknown): asserts value is Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), 'expected an object');
}
function array(value: unknown): asserts value is unknown[] {
  check(Array.isArray(value), 'expected an array');
}
function text(value: unknown): asserts value is string {
  check(typeof value === 'string' && value.trim(), 'expected nonempty text');
}
function number(value: unknown, min: number, max: number, integer = false): asserts value is number {
  check(
    typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max &&
      (!integer || Number.isInteger(value)),
    `number outside ${min}..${max}`,
  );
}
function ids(
  value: unknown,
  known: readonly string[],
  count?: number,
  unique = true,
): asserts value is string[] {
  array(value);
  check(
    value.every((id) => typeof id === 'string' && known.includes(id)),
    'unknown contestant ID',
  );
  check(!unique || new Set(value).size === value.length, 'duplicate contestant ID');
  if (count !== undefined) check(value.length === count, `expected ${count} IDs`);
}
function dice(value: unknown) {
  array(value);
  check(value.length === 2, 'two dice required');
  value.forEach((die) => {
    number(die, 1, 6, true);
  });
}
const phases = [
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
];

function assertShape(value: unknown, known: readonly string[]): asserts value is BootcampEpisode {
  object(value);
  check(value.version === 1 && phases.includes(String(value.phase)), 'unsupported version or phase');
  number(value.revision, 0, Number.MAX_SAFE_INTEGER, true);
  object(value.lastAction);
  number(value.lastAction.revision, 0, Number.MAX_SAFE_INTEGER, true);
  object(value.lastAction.action);
  check(
    value.lastAction.action.type === 'start' || value.lastAction.action.type === 'advance',
    'invalid last action',
  );
  ids(value.participantIds, known, 18);
  const participants = value.participantIds;
  ids(value.previousRankedIds, participants, 18);
  ids(value.rankedIds, participants);
  ids(value.winners, participants, undefined, false);
  check(value.winners.length <= 4, 'too many winners');
  number(value.round, 1, 4, true);
  number(value.groupCursor, 0, 3, true);
  number(value.roomCursor, 1, 5, true);
  check(
    typeof value.rankRevealed === 'boolean' && typeof value.scoreAwardsApplied === 'boolean',
    'invalid reveal or award state',
  );
  object(value.exposure);
  check(Object.keys(value.exposure).length === 18, 'coverage must contain the whole cast');
  for (const id of participants) number(value.exposure[id], 0, 4);
  object(value.initialState);
  check(Object.keys(value.initialState).length === 18, 'starting conditions missing');
  for (const id of participants) {
    const initial = value.initialState[id];
    object(initial);
    text(initial.condition);
    number(initial.practice, 0, 100);
  }
  array(value.startingContestants);
  check(value.startingContestants.length === known.length, 'starting cast snapshot missing');
  const startingIds: string[] = [];
  for (const person of value.startingContestants) {
    object(person);
    text(person.id);
    startingIds.push(person.id);
    for (const field of ['coreSkills', 'utilitySkills', 'personality']) object(person[field]);
  }
  ids(startingIds, known, known.length);
  array(value.groups);
  check(value.groups.length === 0 || value.groups.length === 3, 'three groups required');
  const groupIds: string[] = [];
  const members: string[] = [];
  for (const group of value.groups) {
    object(group);
    text(group.id);
    groupIds.push(group.id);
    ids(group.memberIds, participants, 6);
    members.push(...group.memberIds);
    array(group.pairs);
    check(group.pairs.length <= 3, 'too many pair selections');
    const used: string[] = [];
    for (const pair of group.pairs) {
      ids(pair, group.memberIds, 2);
      used.push(...pair);
    }
    ids(used, group.memberIds);
    object(group.ballots);
    object(group.tieKeys);
    for (let round = 1; round <= Math.min(group.pairs.length, 2); round++)
      check(group.ballots[String(round)] !== undefined, 'selected pair has no ballots');
    check(
      Object.keys(group.ballots).every((round) => round === '1' || round === '2'),
      'invalid ballot round',
    );
    for (const [round, ballots] of Object.entries(group.ballots)) {
      object(ballots);
      check(Object.keys(ballots).length === 6, 'all six teammates must vote');
      const prior = group.pairs.slice(0, Number(round) - 1).flat();
      const eligible = group.memberIds.filter((id) => !prior.includes(id));
      const ties = group.tieKeys[round];
      object(ties);
      check(Object.keys(ties).length === eligible.length, 'tie keys must match eligibility');
      const totals = new Map(eligible.map((id) => [id, 0]));
      for (const voter of group.memberIds) {
        const choices = ballots[voter];
        ids(choices, eligible, 2);
        choices.forEach((id) => {
          totals.set(id, (totals.get(id) ?? 0) + 1);
        });
      }
      const typedTies = new Map<string, number>();
      for (const id of eligible) {
        const tie = ties[id];
        number(tie, 0, 1);
        typedTies.set(id, tie);
      }
      const expected = [...eligible]
        .sort(
          (a, b) =>
            (totals.get(b) ?? 0) - (totals.get(a) ?? 0) || (typedTies.get(a) ?? 0) - (typedTies.get(b) ?? 0),
        )
        .slice(0, 2);
      check(
        JSON.stringify(group.pairs[Number(round) - 1]) === JSON.stringify(expected),
        'pair does not match its ballots',
      );
    }
  }
  check(new Set(groupIds).size === groupIds.length, 'duplicate group ID');
  if (members.length) ids(members, participants, 18);
  check(
    value.winningGroupId === null || groupIds.includes(String(value.winningGroupId)),
    'invalid winning group',
  );
  array(value.evaluations);
  for (const evaluation of value.evaluations) {
    object(evaluation);
    ids([evaluation.contestantId], participants, 1);
    number(evaluation.round, 1, 4, true);
    dice(evaluation.rawDice);
    number(evaluation.baseScore, 0, 100);
    number(evaluation.finalScore, 0, 100);
    number(evaluation.fatigue, 0, 5);
    number(evaluation.tieBreakKey, 0, 1);
    object(evaluation.checks);
    check(Object.keys(evaluation.checks).length >= 2, 'performance checks missing');
    for (const evidence of Object.values(evaluation.checks)) {
      object(evidence);
      number(evidence.skillLevel, 1, 5);
      dice(evidence.adjustedDice);
      number(evidence.score, 0, 100);
    }
    array(evaluation.events);
    for (const event of evaluation.events) {
      object(event);
      text(event.kind);
      text(event.narrative);
      ids(event.contestantIds, participants, undefined, false);
      number(event.scoreDelta, -100, 100);
      number(event.spotlight, 0, 2);
      array(event.relationships);
      for (const change of event.relationships) {
        object(change);
        ids([change.observerId, change.targetId], participants, 2);
        number(change.delta, -5, 5);
      }
    }
  }
  array(value.groupResults);
  check(value.groupResults.length <= 3, 'too many group results');
  for (const result of value.groupResults) {
    object(result);
    check(groupIds.includes(String(result.groupId)), 'unknown result group');
    number(result.tieBreakKey, 0, 1);
    number(result.score, 0, 100);
    number(result.resets, 0, 5, true);
    check(typeof result.assisted === 'boolean', 'invalid assistance state');
    const group = value.groups.find((entry) => {
      object(entry);
      return entry.id === result.groupId;
    });
    object(group);
    ids(group.memberIds, participants, 6);
    ids(result.staging, group.memberIds, 6);
    array(result.attempts);
    check(result.attempts.length === result.resets + 1, 'reset count does not match attempts');
    for (const [index, attempt] of result.attempts.entries()) {
      object(attempt);
      check(attempt.reset === index, 'attempt order is invalid');
      object(attempt.timing);
      check(Object.keys(attempt.timing).length === 6, 'timing must cover the group');
      const timing = attempt.timing;
      group.memberIds.forEach((id) => {
        number(timing[id], 0, 100);
      });
      if (index < result.resets)
        check(
          Object.values(timing).some((score) => typeof score === 'number' && score < 60),
          'reset after successful synchronization',
        );
    }
    const lastAttempt = result.attempts.at(-1);
    object(lastAttempt);
    object(lastAttempt.timing);
    const needsAssistance = Object.values(lastAttempt.timing).some(
      (score) => typeof score === 'number' && score < 60,
    );
    check(
      result.assisted === needsAssistance && (!needsAssistance || result.resets === 5),
      'invalid safety-stop result',
    );
  }
  array(value.scenes);
  check(value.scenes.length > 0, 'no story scene');
  const sceneIds = new Set<string>();
  for (const scene of value.scenes) {
    object(scene);
    text(scene.id);
    check(!sceneIds.has(scene.id), 'duplicate scene ID');
    sceneIds.add(scene.id);
    text(scene.title);
    check(scene.kind === 'recap' || scene.kind === 'ranking', 'invalid Boot Camp scene kind');
    number(scene.sequence, 1, 8, true);
    ids(scene.contestantIds, participants);
    array(scene.paragraphs);
    scene.paragraphs.forEach(text);
    array(scene.paragraphContestantIds);
    check(scene.paragraphContestantIds.length === scene.paragraphs.length, 'paragraph identities missing');
    for (const refs of scene.paragraphContestantIds) ids(refs, participants, undefined, false);
    if (scene.speaker !== undefined) {
      object(scene.speaker);
      text(scene.speaker.name);
      text(scene.speaker.role);
    }
    if (scene.dialogues !== undefined) {
      array(scene.dialogues);
      for (const dialogue of scene.dialogues) {
        object(dialogue);
        text(dialogue.name);
        text(dialogue.role);
        array(dialogue.paragraphs);
        check(dialogue.paragraphs.length > 0, 'empty trainer assessment');
        dialogue.paragraphs.forEach(text);
        array(dialogue.paragraphContestantIds);
        check(
          dialogue.paragraphContestantIds.length === dialogue.paragraphs.length,
          'dialogue identities missing',
        );
        for (const refs of dialogue.paragraphContestantIds) ids(refs, participants, undefined, false);
      }
    }
  }
  object(value.changes);
  for (const [id, changes] of Object.entries(value.changes)) {
    check(participants.includes(id), 'unknown change recipient');
    array(changes);
    for (const change of changes) {
      object(change);
      text(change.path);
      text(change.cause);
      check(change.path !== `relationships.${id}`, 'self relationship change');
    }
  }
  if (value.audience !== null) {
    object(value.audience);
    for (const field of ['votes', 'receptions', 'newFans']) {
      const values = value.audience[field];
      object(values);
      check(Object.keys(values).length === 18, 'audience result must cover the cast');
      for (const id of participants)
        number(values[id], 0, field === 'receptions' ? 100 : Number.MAX_SAFE_INTEGER, field !== 'receptions');
    }
    for (const field of [
      'votingPopulation',
      'newViewers',
      'satisfactionBefore',
      'satisfactionAfter',
      'attention',
      'enjoyment',
    ])
      number(value.audience[field], 0, Number.MAX_SAFE_INTEGER);
  }
  if (value.mvp !== null) {
    object(value.mvp);
    ids([value.mvp.winnerId], participants, 1);
    ids(value.mvp.tiedIds, participants);
    object(value.mvp.ballots);
    object(value.mvp.totals);
    check(Object.keys(value.mvp.ballots).length === 18, 'eighteen MVP ballots required');
    const totals = new Map(participants.map((id) => [id, 0]));
    for (const id of participants) {
      const choice = value.mvp.ballots[id];
      ids([choice], participants, 1);
      check(choice !== id, 'self MVP vote');
      if (typeof choice === 'string') totals.set(choice, (totals.get(choice) ?? 0) + 1);
    }
    for (const id of participants) check(value.mvp.totals[id] === totals.get(id), 'MVP total mismatch');
    const maximum = Math.max(...totals.values());
    const leaders = participants.filter((id) => totals.get(id) === maximum).sort();
    check(
      JSON.stringify([...value.mvp.tiedIds].sort()) === JSON.stringify(leaders),
      'MVP tied leaders mismatch',
    );
    check(value.mvp.tiedIds.includes(String(value.mvp.winnerId)), 'MVP winner not in tied leaders');
  }
}

export function assertBootcampEpisode(
  value: unknown,
  contestants: readonly Contestant[],
  _definitions: SimulationDefinitions,
): asserts value is BootcampEpisode {
  assertShape(
    value,
    contestants.map((person) => person.id),
  );
  const ep = value;
  const closed = ['relief', 'mvp', 'ranking', 'complete'].includes(ep.phase);
  const beforeGroups = ['dorms', 'credits', 'briefing'].includes(ep.phase);
  check(ep.groups.length === (beforeGroups ? 0 : 3), 'group assignment phase mismatch');
  check(!beforeGroups || ep.round === 1, 'challenge before group assignment');
  check(
    ep.winners.length === (closed ? 4 : ep.round - (ep.phase === 'winner' ? 0 : 1)),
    'challenge winner phase mismatch',
  );
  check(ep.scenes.length === ep.revision + 1, 'scene revision mismatch');
  check(ep.lastAction.revision === Math.max(0, ep.revision - 1), 'last action revision mismatch');
  for (const [index, group] of ep.groups.entries()) {
    const selected =
      ep.phase === 'groups'
        ? 0
        : ep.phase === 'ballots'
          ? ep.round - (index < ep.groupCursor ? 0 : 1)
          : Math.min(ep.round, 3);
    check(group.pairs.length === selected, 'blind pair selection phase mismatch');
  }
  const perRound = [1, 2, 3, 4].map((round) =>
    ep.evaluations.filter((evaluation) => evaluation.round === round),
  );
  for (const [index, results] of perRound.entries()) {
    ids(
      results.map((evaluation) => evaluation.contestantId),
      ep.participantIds,
    );
    check(results.length <= (index === 3 ? 18 : 6), 'too many round evaluations');
    check(index + 1 <= ep.round || results.length === 0, 'future challenge evaluated');
    const expectedCount =
      index + 1 < ep.round || closed || ep.phase === 'winner'
        ? index + 1 <= ep.round
          ? index === 3
            ? 18
            : 6
          : 0
        : index + 1 === ep.round && ep.phase === 'performance'
          ? ep.groupCursor * (index === 3 ? 6 : 2)
          : 0;
    check(results.length === expectedCount, 'performance phase mismatch');
    for (const result of results) {
      const group = ep.groups.find((entry) => entry.memberIds.includes(result.contestantId));
      check(
        group && (index === 3 || group.pairs[index]?.includes(result.contestantId)),
        'ineligible challenge entrant',
      );
      const source = ep.startingContestants.find((person) => person.id === result.contestantId);
      check(source, 'performance profile missing');
      const required =
        index === 1
          ? ['acrobatics', 'consistency']
          : index === 2
            ? ['consistency', 'learning']
            : ['stamina', 'consistency'];
      const keys = Object.keys(result.checks);
      check(
        required.every((key) => keys.includes(key)) && keys.length === (index === 0 ? 3 : 2),
        'challenge checks mismatch',
      );
      for (const [key, evidence] of Object.entries(result.checks)) {
        const utility = (['stamina', 'consistency', 'acrobatics', 'learning'] as const).find(
          (name) => name === key,
        );
        const core = index === 0 && (key === 'vocals' || key === 'rap') ? key : undefined;
        check(utility || core, 'unknown challenge skill');
        const level = utility ? source.utilitySkills[utility] : core ? source.coreSkills[core] : undefined;
        check(evidence.skillLevel === level, 'challenge skill level mismatch');
        const expected = battleCheck('bootcamp', evidence.skillLevel, 3, result.rawDice, 1);
        check(
          JSON.stringify(expected.adjustedDice) === JSON.stringify(evidence.adjustedDice),
          'adjusted dice mismatch',
        );
        check(Math.abs((expected.score * 100) / 80 - evidence.score) < 1e-8, 'utility check score mismatch');
      }
      const score = (key: string) => result.checks[key].score;
      let base: number;
      if (index === 0) {
        const delivery = result.checks.vocals ?? result.checks.rap;
        check(delivery, 'microphone delivery missing');
        base = 0.5 * score('stamina') + 0.3 * score('consistency') + 0.2 * delivery.score;
      } else if (index === 1) {
        const partner = results.find(
          (entry) =>
            entry.contestantId !== result.contestantId && group.pairs[1].includes(entry.contestantId),
        );
        check(partner?.checks.consistency, 'partner timing missing');
        base =
          0.6 * score('acrobatics') +
          0.2 * score('consistency') +
          0.2 * Math.min(score('consistency'), partner.checks.consistency.score);
      } else if (index === 2) base = 0.6 * score('consistency') + 0.4 * score('learning');
      else base = 0.5 * score('stamina') + 0.5 * score('consistency');
      check(Math.abs(result.baseScore - base) < 1e-8, 'challenge base score mismatch');
      const final = Math.max(
        0,
        Math.min(100, base + result.events.reduce((sum, event) => sum + event.scoreDelta, 0)),
      );
      check(Math.abs(result.finalScore - final) < 1e-8, 'challenge final score mismatch');
    }
  }
  ids(
    perRound
      .slice(0, 3)
      .flat()
      .map((evaluation) => evaluation.contestantId),
    ep.participantIds,
  );
  ep.winners.forEach((id, index) => {
    check(perRound[index].length === (index === 3 ? 18 : 6), 'winner before all performances');
    check(id === bootcampWinner(perRound[index]), 'winner does not match performance evidence');
  });
  check(
    new Set(ep.groupResults.map((result) => result.groupId)).size === ep.groupResults.length,
    'duplicate group results',
  );
  if (ep.winningGroupId !== null) {
    check(
      ep.groupResults.length === 3 &&
        perRound[3].length === 18 &&
        ep.winningGroupId === bootcampWinningGroup(ep.groups, ep.groupResults, ep.evaluations),
      'group winner does not match performance evidence',
    );
  }
  for (const id of ep.participantIds) {
    const current = contestants.find((person) => person.id === id);
    const start = ep.startingContestants.find((person) => person.id === id);
    check(current && start && current.status === 'ACTIVE', 'participant departed');
    for (const field of ['coreSkills', 'utilitySkills', 'personality'] as const)
      check(JSON.stringify(current[field]) === JSON.stringify(start[field]), 'permanent profile growth');
  }
  check((ep.audience !== null) === closed && ep.scoreAwardsApplied === closed, 'audience closure mismatch');
  if (closed) {
    check(
      ep.winners.length === 4 && ep.groupResults.length === 3 && ep.winningGroupId !== null,
      'final results missing',
    );
    ids(ep.rankedIds, ep.participantIds, 18);
    check(
      ep.audience &&
        Object.values(ep.audience.votes).reduce((sum, votes) => sum + votes, 0) ===
          ep.audience.votingPopulation,
      'votes do not conserve population',
    );
  } else check(ep.rankedIds.length === 0 && !ep.rankRevealed, 'premature ranking');
  check(ep.rankRevealed === ['ranking', 'complete'].includes(ep.phase), 'ranking reveal mismatch');
  if (ep.rankRevealed) {
    ep.rankedIds.forEach((id, index) => {
      check(contestants.find((person) => person.id === id)?.rank === index + 1, 'published rank mismatch');
    });
  }
  check((ep.mvp !== null) === ['mvp', 'ranking', 'complete'].includes(ep.phase), 'MVP closure mismatch');
}
