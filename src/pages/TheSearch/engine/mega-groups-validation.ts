import type { BattleCheck } from '../types/battle-episode';
import type { Contestant } from '../types/contestant';
import type { MegaGroupsEpisode } from '../types/mega-groups-episode';
import type { SimulationDefinitions, SimulationState } from '../types/simulation';
import { assertMegaGroupsCatalogs, MEGA_GROUP_IMAGES } from '../utilities/mega-groups-catalogs';
import { battleCheck, clampBattle } from './battle-scoring';

function check(value: unknown, reason: string): asserts value {
  if (!value) throw new Error(`Invalid Mega Groups: ${reason}.`);
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
function number(
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  integer = false,
): asserts value is number {
  check(
    typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max &&
      (!integer || Number.isSafeInteger(value)),
    'invalid number',
  );
}
function ids(value: unknown, known: readonly string[], count?: number): asserts value is string[] {
  array(value);
  check(
    value.every((id) => typeof id === 'string' && known.includes(id)) && new Set(value).size === value.length,
    'unknown or repeated contestant ID',
  );
  check(count === undefined || value.length === count, 'wrong contestant count');
}
function dice(value: unknown) {
  array(value);
  check(value.length === 2, 'two dice required');
  value.forEach((die) => {
    number(die, 1, 6, true);
  });
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[], reason: string) {
  check(Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)), reason);
}
function stringMap(value: unknown, keys: readonly string[], choices: readonly string[]) {
  object(value);
  exactKeys(value, keys, 'incomplete ballot or assignment');
  for (const item of Object.values(value))
    check(typeof item === 'string' && choices.includes(item), 'invalid ballot or assignment');
}
function numberMap(value: unknown, keys: readonly string[], min = 0, max = Number.MAX_SAFE_INTEGER) {
  object(value);
  exactKeys(value, keys, 'incomplete numeric evidence');
  for (const item of Object.values(value)) number(item, min, max);
}
function checkShape(value: unknown) {
  object(value);
  text(value.skill);
  number(value.skillLevel, 1, 5);
  number(value.requiredLevel, 1, 5, true);
  number(value.floor, 1, 6, true);
  dice(value.adjustedDice);
  number(value.score, 0, 100);
  number(value.weight, 1, 2);
}
function changeValue(value: unknown): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    number(value, -Number.MAX_VALUE, Number.MAX_VALUE);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(changeValue);
    return;
  }
  object(value);
  Object.values(value).forEach(changeValue);
}
function changeMap(value: unknown, participants: readonly string[]) {
  object(value);
  for (const [id, entries] of Object.entries(value)) {
    check(participants.includes(id), 'unknown change subject');
    array(entries);
    for (const entry of entries) {
      object(entry);
      text(entry.path);
      text(entry.cause);
      check(entry.path !== `relationships.${id}`, 'self relationship change');
      if (entry.before !== undefined) changeValue(entry.before);
      if (entry.after !== undefined) changeValue(entry.after);
    }
  }
}
const phases = [
  'dorms',
  'credits',
  'briefing',
  'images',
  'choices',
  'transfers',
  'rosters',
  'rehearsal',
  'intervention',
  'center',
  'performance',
  'reviews',
  'jane',
  'mvp',
  'secret-choice',
  'secret-result',
  'ranking',
  'elimination',
  'withdrawal',
  'complete',
];

function shape(
  value: unknown,
  known: readonly string[],
  definitions: SimulationDefinitions,
): asserts value is MegaGroupsEpisode {
  object(value);
  check(value.version === 1 && phases.includes(String(value.phase)), 'unsupported version or phase');
  number(value.revision, 0, Number.MAX_SAFE_INTEGER, true);
  object(value.lastAction);
  number(value.lastAction.revision, 0, Number.MAX_SAFE_INTEGER, true);
  object(value.lastAction.action);
  check(
    ['start', 'advance', 'conflict', 'secret'].includes(String(value.lastAction.action.type)),
    'invalid last action',
  );
  if (value.lastAction.action.type === 'conflict')
    check(
      ['support', 'mediate', 'push'].includes(String(value.lastAction.action.choice)),
      'invalid conflict choice',
    );
  ids(value.participantIds, known, 18);
  const participants = value.participantIds;
  if (value.lastAction.action.type === 'secret') ids([value.lastAction.action.contestantId], participants, 1);
  ids(value.previousRankedIds, participants, 18);
  array(value.startingContestants);
  check(value.startingContestants.length === known.length, 'missing starting snapshot');
  const startIds: string[] = [];
  for (const entry of value.startingContestants) {
    object(entry);
    text(entry.id);
    startIds.push(entry.id);
    text(entry.name);
    check(['ACTIVE', 'ELIMINATED', 'WINNER'].includes(String(entry.status)), 'invalid starting status');
    object(entry.coreSkills);
    object(entry.utilitySkills);
    object(entry.personality);
    object(entry.aggregations);
    object(entry.relationships);
    for (const key of ['vocals', 'rap', 'dance', 'stagePresence', 'visual', 'uniqueness', 'leadership'])
      number(entry.coreSkills[key], 1, 5, true);
    for (const key of ['potential', 'memory', 'stamina', 'learning', 'acrobatics', 'consistency', 'charisma'])
      number(entry.utilitySkills[key], 1, 5, true);
    for (const key of [
      'discipline',
      'curiosity',
      'extroversion',
      'sensitivity',
      'gentleness',
      'sincerity',
      'ambition',
      'resilience',
      'maturity',
      'investment',
    ])
      number(entry.personality[key], -10, 10);
    for (const key of ['practice', 'happiness', 'rankingScore'])
      number(entry.aggregations[key], 0, Number.MAX_SAFE_INTEGER);
    for (const [id, history] of Object.entries(entry.relationships)) {
      check(known.includes(id) && id !== entry.id, 'invalid snapshot relationship');
      array(history);
      check(history.length, 'empty snapshot relationship');
      history.forEach((item) => {
        number(item, 0, 100);
      });
    }
  }
  ids(startIds, known, known.length);
  object(value.comfort);
  ids([value.comfort.distressedId, value.comfort.comforterId], participants, 2);
  check(typeof value.comfort.visitor === 'boolean', 'invalid comfort visit');
  numberMap(value.comfort.tieKeys, participants, 0, 1);
  object(value.hands);
  for (const key of ['tired', 'fun', 'ready']) ids(value.hands[key], participants);
  number(value.questionCursor, 0, 3, true);
  check(
    value.testId === null || definitions.megaGroupTests?.some((test) => test.id === value.testId),
    'unknown image test',
  );
  ids(value.blindOrder, participants);
  array(value.choices);
  check(value.choices.length <= 18, 'too many blind choices');
  for (const raw of value.choices) {
    object(raw);
    ids([raw.contestantId], participants, 1);
    array(raw.sums);
    check(raw.sums.length === 2, 'two personality sums required');
    raw.sums.forEach((sum) => {
      number(sum, -20, 20);
    });
    number(raw.side, 0, 1, true);
    if (raw.tieKey !== null) number(raw.tieKey, 0, 1);
  }
  array(value.teams);
  check(value.teams.length === 0 || value.teams.length === 2, 'two teams required');
  const teamIds: string[] = [];
  for (const team of value.teams) {
    object(team);
    text(team.id);
    text(team.name);
    teamIds.push(team.id);
    ids(team.memberIds, participants);
    ids(team.initialMemberIds, participants);
    check(team.captainId === '' || team.memberIds.includes(String(team.captainId)), 'invalid leader');
    check(team.centerId === null || team.memberIds.includes(String(team.centerId)), 'invalid center');
    array(team.songIds);
    check(
      team.songIds.length === 2 && team.songIds[0] !== team.songIds[1],
      'two distinct team songs required',
    );
    for (const songId of team.songIds)
      check(
        definitions.megaGroupSongs?.some((song) => song.id === songId),
        'unknown song',
      );
    check(team.songId === team.songIds[0], 'primary song mismatch');
    object(team.assignmentsBySong);
    for (const [songId, assignments] of Object.entries(team.assignmentsBySong)) {
      check(team.songIds.includes(songId), 'assignment for unknown team song');
      const song = definitions.megaGroupSongs!.find((entry) => entry.id === songId)!;
      stringMap(
        assignments,
        team.memberIds,
        song.parts.map((part) => part.id),
      );
      object(assignments);
      check(new Set(Object.values(assignments)).size === 9, 'parts must be distinct');
    }
    object(team.partAssignments);
    if (Object.keys(team.partAssignments).length) {
      const song = definitions.megaGroupSongs!.find((entry) => entry.id === team.songId)!;
      stringMap(
        team.partAssignments,
        team.memberIds,
        song.parts.map((part) => part.id),
      );
    }
    object(team.partReactions);
    for (const [id, reaction] of Object.entries(team.partReactions))
      check(
        team.memberIds.includes(id) && ['happy', 'neutral', 'unhappy'].includes(String(reaction)),
        'invalid part reaction',
      );
    for (const role of ['leader', 'center']) {
      const ballots = team[`${role}Ballots`];
      const totals = team[`${role}Totals`];
      object(ballots);
      object(totals);
      if (Object.keys(ballots).length) {
        stringMap(ballots, team.memberIds, team.memberIds);
        numberMap(totals, team.memberIds, 0, 9);
      } else check(!Object.keys(totals).length, 'totals without role ballots');
    }
    object(team.roleTieKeys);
    for (const [role, ties] of Object.entries(team.roleTieKeys)) {
      check(role === 'leader' || role === 'center', 'unknown role draw');
      numberMap(ties, team.memberIds, 0, 1);
    }
    number(team.coordination, -5, 5, true);
    array(team.practice);
    check(team.practice.length === 0 || team.practice.length === 2, 'two practice sessions required');
    for (const [index, session] of team.practice.entries()) {
      object(session);
      check(session.session === index + 1, 'practice session mismatch');
      text(session.title);
      dice(session.leaderDice);
      checkShape(session.leadershipCheck);
      object(session.leadershipCheck);
      check(session.leadershipCheck.successThreshold === 8, 'leadership threshold mismatch');
      check(typeof session.leadershipSuccess === 'boolean', 'invalid leadership result');
      number(session.coordinationChange, -1, 1);
      number(session.coordinationBefore, -5, 5);
      number(session.coordinationAfter, -5, 5);
      array(session.contestants);
      check(session.contestants.length === 9, 'all nine must practice');
      const practiced: string[] = [];
      for (const entry of session.contestants) {
        object(entry);
        text(entry.contestantId);
        practiced.push(entry.contestantId);
        dice(entry.rawDice);
        for (const key of ['practiceBefore', 'practiceAfter', 'sessionPractice']) number(entry[key], 0, 5);
        number(entry.weightedSum, 2, 12);
        check(typeof entry.improved === 'boolean', 'invalid practice improvement');
        array(entry.checks);
        check(entry.checks.length === 3, 'practice checks missing');
        for (const rawCheck of entry.checks) {
          object(rawCheck);
          check(
            ['learning', 'memory', 'consistency', 'stamina'].includes(String(rawCheck.skill)),
            'unknown practice skill',
          );
          number(rawCheck.skillLevel, 1, 5);
          number(rawCheck.requiredLevel, 1, 5);
          number(rawCheck.floor, 1, 6);
          number(rawCheck.weight, 1, 2);
          dice(rawCheck.adjustedDice);
        }
      }
      ids(practiced, team.memberIds, 9);
    }
  }
  check(new Set(teamIds).size === teamIds.length, 'duplicate team ID');
  if (value.transfer !== null) {
    const transfer = value.transfer;
    object(transfer);
    check(
      transfer.fromTeamId === null || teamIds.includes(String(transfer.fromTeamId)),
      'invalid transfer team',
    );
    number(transfer.excess, 0, 9, true);
    ids(transfer.movedIds, participants, transfer.excess);
    for (const key of ['ballots', 'evidence', 'totals', 'tieKeys']) object(transfer[key]);
    object(transfer.ballots);
    object(transfer.evidence);
    for (const [voter, ballot] of Object.entries(transfer.ballots)) {
      check(participants.includes(voter), 'unknown transfer voter');
      ids(ballot, participants, transfer.excess);
      check(!ballot.includes(voter), 'self transfer nomination');
      const evidence = transfer.evidence[voter];
      object(evidence);
      for (const [id, raw] of Object.entries(evidence)) {
        check(participants.includes(id) && id !== voter, 'invalid transfer evidence target');
        object(raw);
        for (const key of ['relationship', 'skill', 'blend']) number(raw[key], 0, 100);
        check(
          Math.abs(Number(raw.blend) - (Number(raw.relationship) + Number(raw.skill)) / 2) < 1e-8,
          'transfer blend mismatch',
        );
      }
    }
  }
  number(value.performanceCursor, 0, 3, true);
  number(value.reviewCursor, 0, 3, true);
  array(value.performances);
  check(value.performances.length <= 4, 'too many performances');
  for (const performance of value.performances) {
    object(performance);
    check(teamIds.includes(String(performance.teamId)), 'unknown performing team');
    check(
      definitions.megaGroupSongs!.some((song) => song.id === performance.songId),
      'unknown performance song',
    );
    for (const key of ['meanScore', 'finalScore', 'baseScore']) number(performance[key], 0, 100);
    number(performance.coordination, -5, 5);
    array(performance.evaluations);
    check(performance.evaluations.length === 9, 'nine evaluations required');
    const performed: string[] = [];
    for (const evaluation of performance.evaluations) {
      object(evaluation);
      text(evaluation.contestantId);
      performed.push(evaluation.contestantId);
      text(evaluation.partId);
      dice(evaluation.rawDice);
      for (const key of ['technicalScore', 'stageScore', 'impressionScore', 'finalScore'])
        number(evaluation[key], 0, 100);
      number(evaluation.composure, -5, 5);
      number(evaluation.tieBreakKey, 0, 1);
      number(evaluation.centerBonus, 0, 1, true);
      check(['A', 'B', 'C', 'D', 'F'].includes(String(evaluation.grade)), 'invalid performance grade');
      for (const key of ['technicalChecks', 'impressionChecks']) {
        array(evaluation[key]);
        check(evaluation[key].length, 'missing performance checks');
        evaluation[key].forEach(checkShape);
      }
      checkShape(evaluation.stageCheck);
    }
    ids(performed, participants, 9);
    object(performance.judging);
    exactKeys(performance.judging, ['john', 'megan', 'michael'], 'three judges required');
    for (const result of Object.values(performance.judging)) {
      object(result);
      number(result.score, 0, 100);
      number(result.bonus, 0, 2);
      text(result.comment);
      array(result.checks);
      check(result.checks.length, 'judge evidence missing');
      result.checks.forEach(checkShape);
    }
  }
  if (value.conflict !== null) {
    object(value.conflict);
    check(teamIds.includes(String(value.conflict.teamId)), 'invalid conflict team');
    ids(value.conflict.contestantIds, participants, 2);
    text(value.conflict.description);
  }
  object(value.interventions);
  for (const [id, choice] of Object.entries(value.interventions))
    check(
      teamIds.includes(id) && ['support', 'mediate', 'push'].includes(String(choice)),
      'invalid intervention',
    );
  array(value.jane);
  for (const entry of value.jane) {
    object(entry);
    ids([entry.contestantId], participants, 1);
    number(entry.score, 0, 100);
    check(typeof entry.approved === 'boolean', 'invalid Jane approval');
    array(entry.checks);
    check(entry.checks.length === 4, 'Jane requires four saved checks');
    entry.checks.forEach(checkShape);
  }
  if (value.audience !== null) {
    object(value.audience);
    for (const key of ['votes', 'receptions', 'newFans'])
      numberMap(value.audience[key], participants, 0, key === 'receptions' ? 100 : Number.MAX_SAFE_INTEGER);
    for (const key of [
      'votingPopulation',
      'newViewers',
      'satisfactionBefore',
      'satisfactionAfter',
      'attention',
      'enjoyment',
    ])
      number(value.audience[key]);
  }
  if (value.mvp !== null) {
    object(value.mvp);
    ids([value.mvp.winnerId], participants, 1);
    ids(value.mvp.tiedIds, participants);
    stringMap(value.mvp.ballots, participants, participants);
    numberMap(value.mvp.totals, participants, 0, 18);
    object(value.mvp.ballots);
    object(value.mvp.totals);
    for (const id of participants) {
      check(value.mvp.ballots[id] !== id, 'self MVP vote');
      check(
        value.mvp.totals[id] === Object.values(value.mvp.ballots).filter((choice) => choice === id).length,
        'MVP vote total mismatch',
      );
    }
    const maximum = Math.max(...Object.values(value.mvp.totals).map(Number));
    const leaders = participants.filter(
      (id) =>
        value.mvp &&
        typeof value.mvp === 'object' &&
        'totals' in value.mvp &&
        (value.mvp.totals as Record<string, unknown>)[id] === maximum,
    );
    check(
      JSON.stringify([...value.mvp.tiedIds].sort()) === JSON.stringify(leaders.sort()) &&
        value.mvp.tiedIds.includes(String(value.mvp.winnerId)),
      'invalid MVP winner',
    );
  }
  ids(value.secretCandidates, participants);
  if (value.secret !== null) {
    object(value.secret);
    ids([value.secret.contestantId], participants, 1);
    check(
      value.secret.cardId === null ||
        (typeof value.secret.cardId === 'string' &&
          Object.hasOwn(definitions.cards.secret, value.secret.cardId)),
      'unknown secret card',
    );
    text(value.secret.title);
    text(value.secret.description);
    array(value.secret.deferred);
    for (const entry of value.secret.deferred) {
      object(entry);
      check(entry.contestantId === value.secret.contestantId, 'invalid deferred secret subject');
      text(entry.path);
      text(entry.cause);
      changeValue(entry.value);
    }
  }
  for (const key of ['rankedIds', 'finalRankedIds', 'survivorIds']) ids(value[key], participants);
  check(typeof value.rankRevealed === 'boolean', 'invalid rank reveal');
  for (const key of ['eliminatedId', 'withdrawnId'])
    check(value[key] === null || participants.includes(String(value[key])), 'invalid departure');
  check(
    value.withdrawalReason === null ||
      ['unhappy-uninvested', 'lowest-ranked'].includes(String(value.withdrawalReason)),
    'invalid withdrawal reason',
  );
  if (value.withdrawalEvidence !== null) {
    object(value.withdrawalEvidence);
    ids([value.withdrawalEvidence.unhappiestId], participants, 1);
    const remaining = participants.filter((id) => id !== value.eliminatedId);
    numberMap(value.withdrawalEvidence.tieKeys, remaining, 0, 1);
    numberMap(value.withdrawalEvidence.happiness, remaining, 0, 100);
    number(value.withdrawalEvidence.investment, -10, 10);
  }
  numberMap(value.initialPractice, participants, 0, 5);
  array(value.scenes);
  for (const [index, scene] of value.scenes.entries()) {
    object(scene);
    check(scene.id === `mega-groups-${index}`, 'scene identity mismatch');
    text(scene.title);
    check(
      [
        'opening',
        'choices',
        'auditions',
        'broadcast',
        'audience',
        'eliminations',
        'mvp',
        'secret',
        'dorms',
        'ranking',
        'draft',
        'practice',
        'battles',
        'saves',
        'recap',
      ].includes(String(scene.kind)),
      'invalid scene kind',
    );
    array(scene.paragraphs);
    check(scene.paragraphs.length, 'empty scene');
    scene.paragraphs.forEach(text);
    ids(scene.contestantIds, participants);
    number(scene.sequence, 1, 10, true);
    array(scene.paragraphContestantIds);
    check(scene.paragraphContestantIds.length === scene.paragraphs.length, 'paragraph reference mismatch');
    for (const refs of scene.paragraphContestantIds) {
      array(refs);
      check(
        refs.every((id) => typeof id === 'string' && participants.includes(id)),
        'invalid paragraph reference',
      );
    }
    if (scene.speaker !== undefined) {
      object(scene.speaker);
      text(scene.speaker.name);
      text(scene.speaker.role);
    }
    if (scene.contestantChanges !== undefined) changeMap(scene.contestantChanges, participants);
    if (scene.illustrations !== undefined) {
      array(scene.illustrations);
      check(scene.illustrations.length === 2 && scene.sequence === 4, 'invalid image-pair illustration');
      const test = definitions.megaGroupTests!.find((entry) => entry.id === value.testId);
      check(test && scene.title === `Blind images: ${test.name}`, 'illustrations outside test reveal');
      for (const [side, illustration] of scene.illustrations.entries()) {
        object(illustration);
        text(illustration.src);
        text(illustration.label);
        check(
          illustration.src === MEGA_GROUP_IMAGES[test.sides[side].image] &&
            illustration.label === test.sides[side].name,
          'test illustration mismatch',
        );
      }
    }
    if (scene.tvMoments !== undefined) {
      object(scene.tvMoments);
      for (const [moment, entries] of Object.entries(scene.tvMoments)) {
        text(moment);
        object(entries);
        for (const [id, tier] of Object.entries(entries))
          check(participants.includes(id) && [1, 3, 6].includes(Number(tier)), 'invalid aired TV moment');
      }
    }
  }
  changeMap(value.changes, participants);
}

export function assertMegaGroupsEpisode(
  value: unknown,
  contestants: readonly Contestant[],
  definitions: SimulationDefinitions,
): asserts value is MegaGroupsEpisode {
  assertMegaGroupsCatalogs(
    definitions.megaGroupTests,
    definitions.megaGroupSongs,
    Object.keys(definitions.specialties.genreAffinity),
  );
  shape(
    value,
    contestants.map((entry) => entry.id),
    definitions,
  );
  const ep = value;
  check(
    ep.scenes.length === ep.revision + 1 && ep.lastAction.revision === Math.max(0, ep.revision - 1),
    'revision/scene mismatch',
  );
  const distressed = [...ep.participantIds].sort((a, b) => {
    const first = ep.startingContestants.find((entry) => entry.id === a)!;
    const second = ep.startingContestants.find((entry) => entry.id === b)!;
    return (
      first.aggregations.happiness - second.aggregations.happiness ||
      ep.comfort.tieKeys[a] - ep.comfort.tieKeys[b] ||
      a.localeCompare(b)
    );
  })[0];
  check(ep.comfort.distressedId === distressed, 'comfort did not select the current unhappiest person');
  const stage = phases.indexOf(ep.phase);
  const at = (phase: string) => phases.indexOf(phase);
  const assigned = stage >= at('images');
  check(
    ep.teams.length === (assigned ? 2 : 0) &&
      (ep.testId !== null) === assigned &&
      ep.blindOrder.length === (assigned ? 18 : 0),
    'image assignment phase mismatch',
  );
  check(
    ep.questionCursor === (stage < at('briefing') ? 0 : stage > at('briefing') ? 3 : ep.questionCursor),
    'hand question phase mismatch',
  );
  if (stage < at('rehearsal'))
    check(ep.performanceCursor === 0 && ep.reviewCursor === 0, 'premature performance cursor');
  if (stage >= at('jane'))
    check(ep.performanceCursor === 3 && ep.reviewCursor === 3, 'incomplete final performance reviews');
  if (['rehearsal', 'intervention', 'center'].includes(ep.phase))
    check(ep.reviewCursor === (ep.performanceCursor ? 3 : 0), 'pre-performance review cursor mismatch');
  if (ep.phase === 'performance') check(ep.reviewCursor === 0, 'premature review');
  if (ep.phase === 'reviews') check(ep.reviewCursor >= 1 && ep.reviewCursor <= 3, 'missing judge review');
  if (assigned) {
    const test = definitions.megaGroupTests!.find((entry) => entry.id === ep.testId)!;
    check(
      ep.scenes.filter((scene) => scene.illustrations !== undefined).length === 1,
      'missing test reveal illustrations',
    );
    check(new Set(ep.teams.flatMap((team) => team.songIds)).size === 4, 'four distinct songs required');
    ep.choices.forEach((choice, index) => {
      check(choice.contestantId === ep.blindOrder[index], 'blind choice order mismatch');
      const source = ep.startingContestants.find((entry) => entry.id === choice.contestantId)!;
      const sums = test.sides.map((side) =>
        side.traits.reduce((sum, trait) => sum + source.personality[trait], 0),
      );
      check(JSON.stringify(choice.sums) === JSON.stringify(sums), 'blind personality evidence mismatch');
      const side = sums[0] === sums[1] ? Number(choice.tieKey! >= 0.5) : Number(sums[1] > sums[0]);
      check(
        (choice.tieKey !== null) === (sums[0] === sums[1]) && choice.side === side,
        'blind choice does not match evidence',
      );
    });
    if (stage >= at('transfers')) check(ep.choices.length === 18, 'incomplete blind choices');
    else if (ep.phase !== 'choices') check(ep.choices.length === 0, 'premature blind choice');
    ep.teams.forEach((team, index) => {
      check(
        team.id === `mega-${index === 0 ? 'a' : 'b'}` && team.name === test.sides[index].name,
        'test team identity mismatch',
      );
      check(
        JSON.stringify(team.initialMemberIds) ===
          JSON.stringify(
            ep.choices.filter((choice) => choice.side === index).map((choice) => choice.contestantId),
          ),
        'initial roster mismatch',
      );
    });
    if (stage < at('transfers')) {
      check(ep.transfer === null, 'premature transfer');
      ep.teams.forEach((team) => {
        check(
          JSON.stringify(team.memberIds) === JSON.stringify(team.initialMemberIds),
          'premature roster changes',
        );
      });
    } else {
      check(ep.transfer !== null, 'missing transfer record');
      const transfer = ep.transfer;
      const from = ep.teams.find((team) => team.initialMemberIds.length > 9);
      check(
        transfer.fromTeamId === (from?.id ?? null) &&
          transfer.excess === (from ? from.initialMemberIds.length - 9 : 0),
        'overcrowding mismatch',
      );
      if (from) {
        exactKeys(transfer.ballots, from.initialMemberIds, 'all original overcrowded members must vote');
        exactKeys(transfer.evidence, from.initialMemberIds, 'transfer evidence missing');
        numberMap(transfer.totals, from.initialMemberIds, 0, 18);
        numberMap(transfer.tieKeys, from.initialMemberIds, 0, 1);
        for (const voter of from.initialMemberIds) {
          const choices = transfer.ballots[voter];
          ids(choices, from.initialMemberIds, transfer.excess);
          const eligible = from.initialMemberIds.filter((id) => id !== voter);
          exactKeys(transfer.evidence[voter], eligible, 'transfer candidate evidence mismatch');
          const expected = [...eligible]
            .sort(
              (a, b) =>
                transfer.evidence[voter][a].blend - transfer.evidence[voter][b].blend ||
                transfer.tieKeys[a] - transfer.tieKeys[b] ||
                a.localeCompare(b),
            )
            .slice(0, transfer.excess);
          check(JSON.stringify(choices) === JSON.stringify(expected), 'nomination priorities mismatch');
        }
        for (const id of from.initialMemberIds)
          check(
            transfer.totals[id] ===
              Object.values(transfer.ballots).filter((ballot) => ballot.includes(id)).length,
            'transfer vote total mismatch',
          );
        const expectedMoved = [...from.initialMemberIds]
          .sort(
            (a, b) =>
              transfer.totals[b] - transfer.totals[a] ||
              transfer.tieKeys[a] - transfer.tieKeys[b] ||
              a.localeCompare(b),
          )
          .slice(0, transfer.excess);
        check(
          JSON.stringify(transfer.movedIds) === JSON.stringify(expectedMoved),
          'transfer cutoff mismatch',
        );
      } else
        check(
          !Object.keys(transfer.ballots).length &&
            !Object.keys(transfer.evidence).length &&
            !Object.keys(transfer.totals).length &&
            !Object.keys(transfer.tieKeys).length,
          'unneeded transfer evidence',
        );
      const all = ep.teams.flatMap((team) => team.memberIds);
      ids(all, ep.participantIds, 18);
      for (const team of ep.teams) {
        ids(team.memberIds, ep.participantIds, 9);
        const expected =
          from?.id === team.id
            ? team.initialMemberIds.filter((id) => !transfer.movedIds.includes(id))
            : [...team.initialMemberIds, ...transfer.movedIds];
        check(JSON.stringify(team.memberIds) === JSON.stringify(expected), 'final roster mismatch');
      }
    }
  }
  const late = stage >= at('jane');
  const expectedPerformances = late
    ? 4
    : stage >= at('rehearsal')
      ? ep.performanceCursor + (ep.phase === 'performance' || ep.phase === 'reviews' ? 1 : 0)
      : 0;
  check(ep.performances.length === expectedPerformances, 'premature or missing performance');
  check((ep.conflict !== null) === (ep.phase === 'intervention'), 'intervention phase mismatch');
  for (const [index, team] of ep.teams.entries()) {
    const prepared = stage >= at('rehearsal') && (index === 0 || ep.performanceCursor >= 1 || late);
    check(team.practice.length === (prepared ? 2 : 0), 'practice phase mismatch');
    check(
      Object.keys(team.leaderBallots).length === (prepared ? 9 : 0) &&
        Object.keys(team.assignmentsBySong).length === (prepared ? 2 : 0),
      'roles/parts phase mismatch',
    );
    check((team.captainId !== '') === prepared, 'leader phase mismatch');
    const centerExpected =
      prepared &&
      (late ||
        index < ep.performanceCursor ||
        (index === ep.performanceCursor % 2 && !['rehearsal', 'intervention'].includes(ep.phase)));
    check((team.centerId !== null) === centerExpected, 'center election phase mismatch');
    if (team.centerId !== null) {
      check(prepared && Object.keys(team.centerBallots).length === 9, 'center before preparation');
      check(team.memberIds.includes(team.centerId), 'invalid center member');
    } else check(Object.keys(team.centerBallots).length === 0, 'center ballots without center');
    for (const role of ['leader', 'center'] as const) {
      const ballots = role === 'leader' ? team.leaderBallots : team.centerBallots;
      const totals = role === 'leader' ? team.leaderTotals : team.centerTotals;
      if (!Object.keys(ballots).length) continue;
      check(team.roleTieKeys[role], 'missing role draw');
      for (const id of team.memberIds)
        check(
          totals[id] === Object.values(ballots).filter((choice) => choice === id).length,
          'role vote total mismatch',
        );
      const winner = role === 'leader' ? team.captainId : team.centerId!;
      check(totals[winner] === Math.max(...Object.values(totals)), 'role winner lacks most votes');
    }
  }
  ep.performances.forEach((performance, index) => {
    const team = ep.teams[index % 2];
    const songId = team.songIds[Math.floor(index / 2)];
    check(
      performance.teamId === team.id && performance.songId === songId && team.centerId,
      'performance order or team mismatch',
    );
    ids(
      performance.evaluations.map((entry) => entry.contestantId),
      team.memberIds,
      9,
    );
    const expectedMean = performance.evaluations.reduce((sum, entry) => sum + entry.finalScore, 0) / 9;
    check(
      Math.abs(performance.meanScore - expectedMean) < 1e-8 &&
        Math.abs(performance.baseScore! - clampBattle(expectedMean + performance.coordination)) < 1e-8,
      'group score divisor mismatch',
    );
    check(
      Math.abs(
        performance.finalScore -
          clampBattle(
            performance.baseScore! +
              Object.values(performance.judging!).reduce((sum, entry) => sum + entry.score, 0) / 60,
          ),
      ) < 1e-8,
      'judge score mismatch',
    );
    for (const entry of performance.evaluations) {
      check(
        entry.partId === team.assignmentsBySong[songId][entry.contestantId] &&
          entry.centerBonus === Number(entry.contestantId === team.centerId),
        'performed part/center mismatch',
      );
      const part = definitions
        .megaGroupSongs!.find((song) => song.id === songId)!
        .parts.find((part) => part.id === entry.partId)!;
      const required = part.testedSkills;
      const source = ep.startingContestants.find((person) => person.id === entry.contestantId)!;
      const expectedTechnicalCount =
        required.length + Number(entry.technicalChecks.at(-1)?.skill === 'practice');
      check(entry.technicalChecks.length === expectedTechnicalCount, 'technical requirements mismatch');
      required.forEach((requirement, checkIndex) => {
        const item = entry.technicalChecks[checkIndex];
        check(
          item.skill === requirement.skill &&
            item.requiredLevel === requirement.requiredLevel &&
            item.skillLevel === source.coreSkills[requirement.skill] &&
            item.weight === (checkIndex ? 1 : 2),
          'assigned song check mismatch',
        );
      });
      check(
        entry.composure === 0 &&
          entry.stageCheck.skill === 'stagePresence' &&
          entry.stageCheck.requiredLevel === 3 &&
          entry.stageCheck.skillLevel ===
            clampBattle(source.coreSkills.stagePresence + Number(entry.contestantId === team.centerId), 1, 5),
        'stage/center evidence mismatch',
      );
      const technical =
        entry.technicalChecks.reduce((sum, item) => sum + item.score * item.weight, 0) /
        entry.technicalChecks.reduce((sum, item) => sum + item.weight, 0);
      check(
        Math.abs(technical - entry.technicalScore) < 1e-8 &&
          Math.abs(entry.stageScore - entry.stageCheck.score) < 1e-8,
        'individual check arithmetic mismatch',
      );
      check(entry.impressionChecks.length === 4, 'four impression checks required');
      const impression = entry.impressionChecks.reduce((sum, item) => sum + item.score, 0) / 4;
      check(
        Math.abs(impression - entry.impressionScore) < 1e-8 &&
          Math.abs(
            entry.finalScore - clampBattle(0.55 * technical + 0.35 * entry.stageScore + 0.2 * impression),
          ) < 1e-8,
        'individual score mismatch',
      );
      const normalized = (item: BattleCheck, normalizedScore: boolean) => {
        const expected = battleCheck(
          item.skill,
          item.skillLevel,
          item.requiredLevel,
          entry.rawDice,
          item.weight,
        );
        check(
          expected.floor === item.floor &&
            JSON.stringify(expected.adjustedDice) === JSON.stringify(item.adjustedDice),
          'performance dice mismatch',
        );
        check(
          Math.abs(item.score - expected.score * (normalizedScore ? 1.25 : 1)) < 1e-8,
          'performance check mismatch',
        );
      };
      entry.technicalChecks.forEach((item) => {
        normalized(item, false);
      });
      normalized(entry.stageCheck, true);
      entry.impressionChecks.forEach((item) => {
        normalized(item, true);
      });
    }
  });
  check(ep.jane.length === (late ? 18 : 0), 'Jane assessment phase mismatch');
  if (late) {
    ids(
      ep.jane.map((entry) => entry.contestantId),
      ep.participantIds,
      18,
    );
    for (const entry of ep.jane) {
      const source = ep.startingContestants.find((person) => person.id === entry.contestantId)!;
      const records = ep.performances
        .flatMap((performance) => performance.evaluations)
        .filter((evaluation) => evaluation.contestantId === entry.contestantId);
      const expectedChecks = records.flatMap((record) =>
        [
          ['consistency', source.utilitySkills.consistency] as const,
          ['uniqueness', source.coreSkills.uniqueness] as const,
        ].map(([skill, level]) => {
          const expected = battleCheck(skill, level, 3, record.rawDice);
          return { ...expected, score: expected.score * 1.25 };
        }),
      );
      check(
        JSON.stringify(entry.checks) === JSON.stringify(expectedChecks),
        'Jane did not reuse performance dice',
      );
      const score = entry.checks.reduce((sum, item) => sum + item.score, 0) / 4;
      check(Math.abs(entry.score - score) < 1e-8 && entry.approved === score >= 70, 'Jane approval mismatch');
    }
  }
  const closed = stage >= at('mvp');
  check(
    (ep.audience !== null) === closed &&
      (ep.mvp !== null) === closed &&
      ep.rankedIds.length === (closed ? 18 : 0),
    'audience/MVP closure mismatch',
  );
  if (ep.audience)
    check(
      Object.values(ep.audience.votes).reduce((sum, value) => sum + value, 0) ===
        ep.audience.votingPopulation,
      'audience votes do not conserve population',
    );
  check(ep.rankRevealed === stage >= at('ranking'), 'public ranking reveal mismatch');
  check(
    (ep.eliminatedId !== null) === stage >= at('elimination') &&
      (ep.withdrawnId !== null) === stage >= at('withdrawal'),
    'departure phase mismatch',
  );
  if (ep.eliminatedId !== null)
    check(ep.eliminatedId === ep.rankedIds[17], 'competitive departure is not rank eighteen');
  const departed = [ep.eliminatedId, ep.withdrawnId].filter((id): id is string => id !== null);
  ids(departed, ep.participantIds);
  const expectedSurvivors = closed ? ep.rankedIds.filter((id) => !departed.includes(id)) : [];
  check(
    JSON.stringify(ep.survivorIds) === JSON.stringify(departed.length ? expectedSurvivors : []),
    'survivor ranking mismatch',
  );
  if (ep.withdrawnId) {
    check(
      ep.finalRankedIds.length === 18 &&
        JSON.stringify(ep.finalRankedIds) ===
          JSON.stringify([...ep.survivorIds, ep.withdrawnId, ep.eliminatedId]) &&
        ep.withdrawalReason !== null,
      'final placement mismatch',
    );
    check(ep.withdrawalEvidence, 'missing withdrawal evidence');
    const record = ep.withdrawalEvidence;
    const remaining = ep.rankedIds.filter((id) => id !== ep.eliminatedId);
    const unhappiest = [...remaining].sort(
      (a, b) =>
        record.happiness[a] - record.happiness[b] ||
        record.tieKeys[a] - record.tieKeys[b] ||
        a.localeCompare(b),
    )[0];
    check(record.unhappiestId === unhappiest, 'withdrawal did not check single unhappiest person');
    const uninvested = record.investment < 0;
    check(
      ep.withdrawnId === (uninvested ? unhappiest : remaining.at(-1)) &&
        ep.withdrawalReason === (uninvested ? 'unhappy-uninvested' : 'lowest-ranked'),
      'withdrawal rule mismatch',
    );
  } else
    check(
      !ep.finalRankedIds.length && ep.withdrawalReason === null && ep.withdrawalEvidence === null,
      'premature final placement',
    );
  for (const id of ep.participantIds) {
    const current = contestants.find((entry) => entry.id === id)!;
    check(current.status === (departed.includes(id) ? 'ELIMINATED' : 'ACTIVE'), 'departure status mismatch');
    if (ep.rankRevealed) {
      const expectedRank = ep.withdrawnId ? ep.finalRankedIds.indexOf(id) + 1 : ep.rankedIds.indexOf(id) + 1;
      check(current.rank === expectedRank, 'published rank mismatch');
    }
  }
}

export function validateMegaGroups(state: SimulationState): void {
  const runtime = state.runtime;
  if (!runtime?.megaGroups) {
    if (runtime?.preparations?.[4]) {
      check(runtime.version === 3 && runtime.bootcamp?.phase === 'complete', 'invalid Episode 4 preparation');
      assertMegaGroupsCatalogs(
        runtime.definitions.megaGroupTests,
        runtime.definitions.megaGroupSongs,
        Object.keys(runtime.definitions.specialties.genreAffinity),
      );
    }
    return;
  }
  check(
    runtime.version === 3 && runtime.episode === 4 && runtime.bootcamp?.phase === 'complete',
    'invalid Episode 4 runtime',
  );
  assertMegaGroupsEpisode(runtime.megaGroups, state.contestants, runtime.definitions);
  const comfort = runtime.megaGroups.comfort;
  const room = runtime.battle?.rooms.find((entry) => entry.memberIds.includes(comfort.distressedId));
  const roommates = (room?.memberIds ?? []).filter(
    (id) => id !== comfort.distressedId && runtime.megaGroups!.participantIds.includes(id),
  );
  const eligible = roommates.length
    ? roommates
    : runtime.megaGroups.participantIds.filter((id) => id !== comfort.distressedId);
  const gentlest = [...eligible].sort((a, b) => {
    const first = runtime.megaGroups!.startingContestants.find((entry) => entry.id === a)!;
    const second = runtime.megaGroups!.startingContestants.find((entry) => entry.id === b)!;
    return (
      second.personality.gentleness - first.personality.gentleness ||
      comfort.tieKeys[a] - comfort.tieKeys[b] ||
      a.localeCompare(b)
    );
  })[0];
  check(
    comfort.comforterId === gentlest && comfort.visitor === !roommates.length,
    'comforter does not match the surviving dorm',
  );
  check(
    runtime.phase === (runtime.megaGroups.phase === 'complete' ? 'episode-complete' : 'mega-groups'),
    'runtime phase mismatch',
  );
}
