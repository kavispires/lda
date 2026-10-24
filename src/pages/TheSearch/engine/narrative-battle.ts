import type { AuditionSong } from '../types/audition';
import type { EpisodeScene } from '../types/audition-episode';
import type {
  BattleAction,
  BattleEpisode,
  BattleStory,
  BattleStoryStage,
  BattleTeam,
} from '../types/battle-episode';
import type { SimulationState } from '../types/simulation';
import { freezeSimulationSnapshot } from '../utilities/simulation-definitions';
import { chooseAuditionMvp, resolveNarrativeAudience, transferEliminatedFans } from './audition-audience';
import { revealAuditionSecret } from './audition-secrets';
import {
  assignRoles,
  battleWinner,
  captureChanges,
  createCaptains,
  createPairings,
  draftRound,
  episode,
  featuredConflict,
  finish as finishEpisode,
  initialEpisode,
  losingIds,
  member,
  orderedTeams,
  roomHighlight,
  songFor,
} from './battle-episode';
import { addBattleJudging } from './battle-judging';
import {
  battleAudienceEvaluations,
  battleRelationship,
  changeBattleRelationship,
  clampBattle,
  practiceBattleTeam,
  scoreBattleTeam,
} from './battle-scoring';
import { applyPreparation, initializePreparation, playOpening } from './episode-preparation';
import { assertNarrativeBattleEpisode } from './narrative-battle-validation';
import { createSeededRandom, type RandomSource, shuffleWithRandom } from './random';

const JUDGES = [
  { id: 'john', name: 'John Stan', role: 'Music producer' },
  { id: 'megan', name: 'Megan Ryder', role: 'Veteran artist' },
  { id: 'michael', name: 'Michael Lion', role: 'Record-label executive' },
] as const;

function story(state: SimulationState): BattleStory {
  const result = episode(state).story;
  if (!result) throw new Error('The Battles story is missing.');
  return result;
}

function mention(id: string): string {
  return `[[cast:${encodeURIComponent(id)}]]`;
}

function teamMention(team: BattleTeam): string {
  return `Team ${mention(team.captainId)}`;
}

function authoredParagraph(state: SimulationState, text: string) {
  const ids: string[] = [];
  const paragraph = text.replace(/\[\[cast:([^\]]+)\]\]/g, (_token, encoded: string) => {
    const id = decodeURIComponent(encoded);
    ids.push(id);
    return member(state, id).name;
  });
  return { paragraph, ids };
}

function append(
  state: SimulationState,
  stage: BattleStoryStage,
  sequence: number,
  phase: BattleEpisode['phase'],
  kind: EpisodeScene['kind'],
  title: string,
  paragraphs: string[],
  ids: string[] = [],
  host = false,
): EpisodeScene {
  const ep = episode(state);
  Object.assign(story(state), { stage, sequence });
  ep.phase = phase;
  const authored = paragraphs.map((text) => authoredParagraph(state, text));
  const scene: EpisodeScene = {
    id: `battles-scene-${ep.scenes.length}`,
    kind,
    title,
    paragraphs: authored.map((entry) => entry.paragraph),
    contestantIds: ids,
    paragraphContestantIds: authored.map((entry) => entry.ids),
    sequence,
    presentation: host ? 'host' : 'introduction',
    ...(host ? { speaker: { name: 'Mike Philip', role: 'Host' } } : {}),
  };
  ep.scenes.push(scene);
  return scene;
}

function currentTeam(state: SimulationState): BattleTeam {
  const team = orderedTeams(episode(state))[episode(state).teamCursor];
  if (!team) throw new Error('There is no current battle team.');
  return team;
}

function describeDraftTeam(state: SimulationState, team: BattleTeam) {
  const scene = episode(state).scenes.at(-1);
  const chosenId = team.memberIds.at(-1);
  if (!scene || !chosenId) throw new Error('A draft recap requires a completed pick.');
  const chosen = member(state, chosenId);
  const reactions = team.memberIds.slice(0, -1).flatMap((id) => {
    const teammate = member(state, id);
    const outgoing = battleRelationship(chosen, id);
    const incoming = battleRelationship(teammate, chosenId);
    if (outgoing >= 50 && incoming >= 50) return [];
    const paragraph =
      outgoing < 50 && incoming < 50
        ? `Reaction: ${mention(chosenId)} and ${mention(id)} both feel uneasy about having to work together, given their strained relationship.`
        : `Reaction: ${mention(outgoing < 50 ? chosenId : id)} feels uneasy about sharing a team with ${mention(outgoing < 50 ? id : chosenId)}, given their strained relationship.`;
    return [{ paragraph, strength: Math.min(outgoing, incoming) }];
  });
  reactions.sort((a, b) => a.strength - b.strength);
  const additions = [
    `Now the team consists of ${team.memberIds.map(mention).join(', ')}.`,
    ...reactions.slice(0, 2).map((reaction) => reaction.paragraph),
  ].map((paragraph) => authoredParagraph(state, paragraph));
  scene.paragraphs.push(...additions.map((entry) => entry.paragraph));
  scene.paragraphContestantIds?.push(...additions.map((entry) => entry.ids));
  scene.contestantIds = [...team.memberIds];
}

function showRoom(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const room = ep.rooms[ep.roomCursor];
  if (!room) throw new Error('There is no next dorm room.');
  roomHighlight(state, random);
  const interaction = ep.scenes.pop();
  append(
    state,
    'dorms',
    1,
    'dorms',
    'dorms',
    `Room ${ep.roomCursor}: a new home`,
    [
      'Production assigned this room. Six contestants arrive with no say in who shares their new home.',
      ...room.memberIds.map((id) => {
        const person = member(state, id);
        const others = room.memberIds.filter((other) => other !== id);
        const target = [...others].sort(
          (a, b) =>
            Math.abs(battleRelationship(person, b) - 50) - Math.abs(battleRelationship(person, a) - 50) ||
            a.localeCompare(b),
        )[0];
        const affection = battleRelationship(person, target);
        return `${mention(person.id)} notices ${mention(target)} among the roommates and feels ${
          affection >= 53
            ? 'reassured by a familiar connection'
            : affection <= 47
              ? 'uneasy about sharing such a small space'
              : person.personality.gentleness >= 0
                ? 'open to getting to know everyone'
                : 'protective of personal space'
        }.`;
      }),
      ...(interaction?.paragraphs.slice(0, 1) ?? []),
    ],
    room.memberIds,
  );
  if (interaction?.paragraphContestantIds)
    ep.scenes.at(-1)!.paragraphContestantIds![7] = interaction.paragraphContestantIds[0];
}

function startStory(state: SimulationState, random: RandomSource) {
  const runtime = state.runtime;
  if (!runtime) throw new Error('The season is missing.');
  const before = structuredClone(state.contestants);
  const ep = initialEpisode(state, random);
  ep.version = 2;
  ep.scenes = [];
  ep.story = {
    stage: 'dorms',
    sequence: 1,
    draftPick: 0,
    pairingCursor: 0,
    reviewCursor: 0,
    departureCursor: 0,
    interventions: {},
    exposure: {},
    creditedTeamIds: [],
    matchupReactions: [],
    rankReactions: [],
    rankRevealed: false,
    backlashApplied: false,
  };
  runtime.battle = ep;
  runtime.episode = 2;
  runtime.phase = 'battles';
  showRoom(state, random);
  captureChanges(state, before, 'The Battles: dorms');
}

function showPairing(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const s = story(state);
  const pairing = ep.pairings[s.pairingCursor++];
  if (!pairing) throw new Error('There is no next pairing.');
  const teams = pairing.teamIds.map((id) => ep.teams.find((team) => team.id === id)!);
  const reactions = teams.flatMap((team, index) =>
    team.memberIds.map((id) => {
      const person = member(state, id);
      const targets = teams[1 - index].memberIds
        .map((targetId) => ({
          id: targetId,
          strength: Math.abs(battleRelationship(person, targetId) - 50),
          tie: random(),
        }))
        .sort((a, b) => b.strength - a.strength || a.tie - b.tie);
      const target = targets[0].id;
      const before = battleRelationship(person, target);
      const tense = before < 40 || person.personality.ambition > 4;
      changeBattleRelationship(person, target, tense ? -2 : 1);
      return {
        observerId: id,
        targetId: target,
        before,
        after: battleRelationship(person, target),
        emotion: tense ? 'competitive tension' : 'measured respect',
      };
    }),
  );
  s.matchupReactions.push(...reactions);
  const highlights = [...reactions]
    .sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))
    .slice(0, 2);
  append(
    state,
    'pairings',
    3,
    'pairings',
    'battles',
    `Battle ${s.pairingCursor}: the opponents`,
    [
      `${teamMention(teams[0])} performs "${songFor(state, teams[0]).title}" against ${teamMention(teams[1])} with "${songFor(state, teams[1]).title}".`,
      ...highlights.map(
        (reaction) =>
          `${mention(reaction.observerId)} feels ${reaction.emotion} toward ${mention(reaction.targetId!)}: relationship ${reaction.before} → ${reaction.after}.`,
      ),
    ],
    teams.flatMap((team) => team.memberIds),
    true,
  );
}

function showRehearsal(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const teams = orderedTeams(ep);
  const team = currentTeam(state);
  // Both rehearsal days precede the live battle, even when B's footage airs later.
  if (ep.teamCursor % 2 === 0) {
    for (const partner of teams.slice(ep.teamCursor, ep.teamCursor + 2)) {
      assignRoles(state, partner, random);
      practiceBattleTeam(partner, songFor(state, partner), state.contestants, random);
    }
  }
  ep.conflict = null;
  ep.conflictChoice = null;
  const song = songFor(state, team);
  append(
    state,
    'rehearsal',
    4 + Math.floor(ep.teamCursor / 2),
    'preparation',
    'practice',
    `${team.name}: ${ep.teamCursor % 2 ? 'earlier that day' : 'rehearsal day'}`,
    [
      `${mention(team.captainId)} brings the team together to rehearse "${song.title}".`,
      ...team.memberIds.map((id) => {
        const person = member(state, id);
        const part = song.parts.find((entry) => entry.id === team.partAssignments[id]);
        if (!part) throw new Error('A rehearsal part is missing.');
        return `${mention(person.id)} takes ${part.name} and feels ${team.partReactions[id]} about the assignment. Practice readiness is ${person.aggregations.practice}/5.`;
      }),
      team.memberIds.some((id) => team.partReactions[id] === 'unhappy')
        ? 'Not everyone is comfortable with the arrangement; there is tension to work through.'
        : 'The arrangement gives the team common ground as they learn to move together.',
    ],
    team.memberIds,
  );
}

function showLeadership(state: SimulationState) {
  const team = currentTeam(state);
  append(
    state,
    'leadership',
    story(state).sequence,
    'preparation',
    'practice',
    `${member(state, team.captainId).name} takes the lead`,
    team.practice.map(
      (session) =>
        `${session.title}: ${mention(team.captainId)}'s ${
          session.leadershipSuccess
            ? 'clear direction brings everyone together'
            : 'uncertain direction leaves the team out of sync'
        }. Coordination ${session.coordinationBefore} → ${session.coordinationAfter}.`,
    ),
    team.memberIds,
  );
}

function showCenter(state: SimulationState) {
  const team = currentTeam(state);
  const center = member(state, team.centerId!);
  const votes = Object.values(team.centerBallots).filter((id) => id === center.id).length;
  append(
    state,
    'center',
    story(state).sequence,
    'preparation',
    'practice',
    `${team.name} chooses its center`,
    [
      'Everyone casts one vote for a teammate. The captain is eligible, but nobody can vote for themselves.',
      `${mention(center.id)} wins with ${votes} votes. Stage presence, visual, charisma and personal bonds inform the ballots; tied totals favor charisma, then average core skill, then a saved draw.`,
      `${mention(center.id)} will receive a temporary +1 stage-presence boost, capped at 5, for this performance.`,
    ],
    team.memberIds,
  );
}

function intervene(state: SimulationState, action: Extract<BattleAction, { type: 'conflict' }>) {
  const ep = episode(state);
  const team = currentTeam(state);
  if (
    !ep.conflict ||
    story(state).stage !== 'intervention' ||
    story(state).interventions[team.id] ||
    !['support', 'mediate', 'push'].includes(action.choice)
  )
    throw new Error('Choose support, mediate, or push for the current rehearsal.');
  const [a, b] = ep.conflict.contestantIds.map((id) => member(state, id));
  const coordinationBefore = team.coordination;
  const coordination = action.choice === 'push' ? 3 : action.choice === 'support' ? 2 : 1;
  const bond = action.choice === 'push' ? -3 : action.choice === 'support' ? 1 : 2;
  const beforeA = battleRelationship(a, b.id);
  const beforeB = battleRelationship(b, a.id);
  team.coordination = clampBattle(team.coordination + coordination, -5, 5);
  changeBattleRelationship(a, b.id, bond);
  changeBattleRelationship(b, a.id, bond);
  ep.conflictChoice = action.choice;
  story(state).interventions[team.id] = action.choice;
  append(
    state,
    'intervention-result',
    story(state).sequence,
    'preparation',
    'practice',
    `${team.name}: ${action.choice}`,
    [
      `Production chooses to ${action.choice} ${mention(a.id)} and ${mention(b.id)} through the rehearsal.`,
      `Coordination ${coordinationBefore} → ${team.coordination}.`,
      `${mention(a.id)}'s relationship with ${mention(b.id)} ${beforeA} → ${battleRelationship(a, b.id)}; ${mention(b.id)}'s relationship with ${mention(a.id)} ${beforeB} → ${battleRelationship(b, a.id)}.`,
    ],
    ep.conflict.contestantIds,
  );
}

function reactToPerformance(state: SimulationState) {
  const ep = episode(state);
  const teams = orderedTeams(ep);
  const waiting = teams[ep.teamCursor];
  const delivered = ep.performances.at(-1);
  if (!waiting || !delivered) throw new Error('A battle reaction requires a delivered performance.');
  const resilience =
    waiting.memberIds.reduce((sum, id) => sum + member(state, id).personality.resilience, 0) / 5;
  const composure = delivered.finalScore >= 70 ? (resilience >= 0 ? 1 : -1) : 1;
  for (const id of waiting.memberIds) {
    ep.composure[id] = composure;
    ep.changes[id] ??= [];
    ep.changes[id].push({
      path: 'episode2.composure',
      before: 0,
      after: composure,
      cause: `Immediate stage reaction to ${teams[ep.teamCursor - 1].name}'s performance`,
    });
  }
  append(
    state,
    'opponent-reaction',
    4 + Math.floor(ep.teamCursor / 2),
    'performance',
    'battles',
    `${waiting.name} watches from the wings`,
    [
      `${teamMention(waiting)} responds to ${teamMention(teams[ep.teamCursor - 1])} with ${composure > 0 ? 'focused resolve' : 'visible nerves'}: composure 0 → ${composure}.`,
      'This changes immediate stage readiness, not what happened during rehearsal earlier that day.',
    ],
    waiting.memberIds,
  );
}

function perform(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const s = story(state);
  const team = currentTeam(state);
  const composure = ep.composure[team.memberIds[0]] ?? 0;
  const result = addBattleJudging(
    scoreBattleTeam(team, songFor(state, team), state.contestants, composure, random, true),
    state.contestants,
  );
  ep.performances.push(result);
  s.creditedTeamIds.push(team.id);
  for (const evaluation of result.evaluations) {
    const person = member(state, evaluation.contestantId);
    person.grade = evaluation.grade;
    person.missionRating = { A: 5, B: 4, C: 3, D: 2, F: 1 }[evaluation.grade];
    person.events.push('GROUP_BATTLES_PERFORMED');
    person.aggregations.screenTime += 100 / 30;
    s.exposure[person.id] = 1 / 30;
    ep.composure[person.id] = 0;
    if (composure) {
      ep.changes[person.id] ??= [];
      ep.changes[person.id].push({
        path: 'episode2.composure',
        before: composure,
        after: 0,
        cause: 'Temporary composure is consumed by The Battles performance',
      });
    }
  }
  append(
    state,
    'performance',
    4 + Math.floor(ep.teamCursor / 2),
    'performance',
    'battles',
    `${team.name} takes the stage`,
    [
      `${teamMention(team)} performs "${songFor(state, team).title}". The center, ${mention(team.centerId!)}, steps into the spotlight.`,
      ...result.evaluations.map(
        (evaluation) =>
          `${mention(evaluation.contestantId)} delivers their part: graded ${evaluation.grade}.`,
      ),
      'The judges record their evaluations. The battle result remains sealed.',
    ],
    team.memberIds,
  );
  ep.teamCursor++;
}

function closeAudience(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const runtime = state.runtime!;
  const mood = runtime.preparations?.[2]?.mood;
  if (!mood || ep.audience)
    throw new Error('Audience closure requires an uncounted episode and opening mood.');
  const songs: AuditionSong[] = ep.teams.map((team) => {
    const song = songFor(state, team);
    return {
      id: song.id,
      title: song.title,
      description: song.description,
      track: 'VOCAL',
      genre: song.genre,
      part: { testedSkills: song.parts[0].testedSkills },
    };
  });
  const result = resolveNarrativeAudience({
    contestants: ep.participantIds.map((id) => member(state, id)),
    evaluations: battleAudienceEvaluations(ep.teams, ep.performances),
    reactions: [],
    exposure: story(state).exposure,
    mood,
    show: runtime.show,
    random,
    songs,
    castSize: 30,
  });
  const updated = new Map(result.contestants.map((person) => [person.id, person]));
  state.contestants = state.contestants.map((person) => updated.get(person.id) ?? person);
  runtime.show = result.show;
  ep.audience = result.outcome;
  ep.finalRankedIds = [...result.contestants].sort((a, b) => a.rank - b.rank).map((person) => person.id);
}

function review(state: SimulationState) {
  const ep = episode(state);
  const s = story(state);
  const pair = ep.pairings[s.reviewCursor++];
  const performances = pair.teamIds.map((id) => ep.performances.find((entry) => entry.teamId === id)!);
  const scene = append(
    state,
    'reviews',
    7,
    'audience',
    'battles',
    `Battle ${s.reviewCursor}: the judges reflect`,
    ['All performances are complete. The panel considers what each team brought to the stage.'],
    pair.teamIds.flatMap((id) => ep.teams.find((team) => team.id === id)!.memberIds),
  );
  scene.dialogues = JUDGES.map((judge) => ({
    name: judge.name,
    role: judge.role,
    paragraphContestantIds: performances.map((performance) => [
      ep.teams.find((team) => team.id === performance.teamId)!.captainId,
    ]),
    paragraphs: performances.map((performance) => {
      const judging = performance.judging?.[judge.id];
      if (!judging) throw new Error('A recorded judge evaluation is missing.');
      return `${ep.teams.find((team) => team.id === performance.teamId)!.name}: ${judging.comment}`;
    }),
  }));
}

function winner(state: SimulationState) {
  const ep = episode(state);
  const pair = ep.pairings[ep.revealedResults++];
  pair.winnerId = battleWinner(ep, pair.teamIds);
  const winning = ep.teams.find((team) => team.id === pair.winnerId)!;
  const losing = ep.teams.find((team) => pair.teamIds.includes(team.id) && team.id !== winning.id)!;
  append(
    state,
    'winners',
    7,
    'results',
    'battles',
    `Battle ${ep.revealedResults}: the result`,
    [
      `${teamMention(winning)} wins against ${teamMention(losing)}. The five members of ${teamMention(winning)} are safe.`,
      `${teamMention(losing)} is provisionally eliminated. Its members wait for the final outcome; this is not yet a final departure.`,
    ],
    [...winning.memberIds, ...losing.memberIds],
    true,
  );
}

function performanceOrder(ep: BattleEpisode, a: string, b: string): number {
  const evaluations = ep.performances.flatMap((entry) => entry.evaluations);
  const first = evaluations.find((entry) => entry.contestantId === a)!;
  const second = evaluations.find((entry) => entry.contestantId === b)!;
  return (
    second.finalScore - first.finalScore ||
    second.technicalScore - first.technicalScore ||
    first.tieBreakKey - second.tieBreakKey ||
    a.localeCompare(b)
  );
}

function saveJudge(state: SimulationState) {
  const ep = episode(state);
  ep.judgeSaveId = losingIds(ep).sort((a, b) => performanceOrder(ep, a, b))[0];
  append(
    state,
    'judge-save',
    8,
    'saves',
    'saves',
    'The judges offer a lifeline',
    [
      `${mention(ep.judgeSaveId)} is saved by the judges for the strongest individual battle performance among the provisionally eliminated contestants.`,
    ],
    [ep.judgeSaveId],
    true,
  );
}

function saveAudience(state: SimulationState) {
  const ep = episode(state);
  if (!ep.audience) throw new Error('Votes have not closed.');
  ep.audienceSaveId = losingIds(ep)
    .filter((id) => id !== ep.judgeSaveId)
    .sort((a, b) => ep.audience!.votes[b] - ep.audience!.votes[a] || performanceOrder(ep, a, b))[0];
  append(
    state,
    'audience-save',
    8,
    'saves',
    'saves',
    'The audience has spoken',
    [
      `${mention(ep.audienceSaveId)} receives the audience save, with the most votes among the remaining eligible contestants.`,
    ],
    [ep.audienceSaveId],
    true,
  );
}

function productionChoice(state: SimulationState) {
  const ep = episode(state);
  ep.productionShortlist = losingIds(ep)
    .filter((id) => id !== ep.judgeSaveId && id !== ep.audienceSaveId)
    .sort(
      (a, b) =>
        member(state, b).aggregations.productionRatio - member(state, a).aggregations.productionRatio ||
        performanceOrder(ep, a, b),
    )
    .slice(0, 3);
  append(
    state,
    'production-save',
    8,
    'saves',
    'saves',
    'One final lifeline',
    ['The production team and label have one final save. Choose one of these three eligible contestants.'],
    ep.productionShortlist,
    true,
  );
}

function saveProduction(state: SimulationState, id: string) {
  const ep = episode(state);
  if (!ep.productionShortlist.includes(id))
    throw new Error('Choose a contestant from the production shortlist.');
  ep.productionSaveId = id;
  const saved = new Set([ep.judgeSaveId, ep.audienceSaveId, id]);
  ep.eliminatedIds = losingIds(ep).filter((entry) => !saved.has(entry));
  ep.survivorIds = ep.finalRankedIds.filter((entry) => !ep.eliminatedIds.includes(entry));
  append(
    state,
    'save-result',
    8,
    'results',
    'saves',
    'The final save is locked',
    [
      `${mention(id)} receives the production save. All three lifelines go to different contestants.`,
      'The remaining contestants on the losing teams must now say goodbye.',
    ],
    [id],
    true,
  );
}

export function applyNarrativeBattleBacklash(state: SimulationState) {
  const ep = episode(state);
  const s = story(state);
  if (s.backlashApplied) return;
  const baselines = new Map(
    ep.survivorIds.map((id) => [
      id,
      new Map(ep.participantIds.map((target) => [target, battleRelationship(member(state, id), target)])),
    ]),
  );
  for (const id of ep.survivorIds) {
    const person = member(state, id);
    const { gentleness, maturity, sensitivity } = person.personality;
    const penalty = clampBattle(-10 + gentleness + maturity - sensitivity, -15, 0);
    const totals = new Map<string, number>();
    for (const friend of ep.eliminatedIds) {
      if (baselines.get(id)!.get(friend)! < 60) continue;
      const losing = ep.teams.find((team) => team.memberIds.includes(friend))!;
      const pair = ep.pairings.find((entry) => entry.teamIds.includes(losing.id))!;
      const winning = ep.teams.find((team) => team.id === pair.winnerId)!;
      for (const target of winning.memberIds)
        if (target !== id) totals.set(target, Math.max(-15, (totals.get(target) ?? 0) + penalty));
    }
    for (const [target, delta] of totals) changeBattleRelationship(person, target, delta);
  }
  s.backlashApplied = true;
}

function departures(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const s = story(state);
  const pair = ep.pairings[s.departureCursor++];
  const losing = ep.teams.find((team) => pair.teamIds.includes(team.id) && team.id !== pair.winnerId)!;
  const departing = losing.memberIds.filter((id) => ep.eliminatedIds.includes(id));
  for (const id of departing) {
    member(state, id).status = 'ELIMINATED';
    member(state, id).events.push('GROUP_BATTLES_ELIMINATED');
  }
  const saved = losing.memberIds.filter((id) => ep.survivorIds.includes(id));
  append(
    state,
    'departures',
    8,
    'results',
    'eliminations',
    `${losing.name}: the goodbyes`,
    [
      `${departing.map(mention).join(', ')} leave the competition.`,
      ...(saved.length ? [`${saved.map(mention).join(', ')} remain, relieved by their second chance.`] : []),
      'Sadness at leaving and relief at surviving fill the room.',
    ],
    losing.memberIds,
    true,
  );
  if (s.departureCursor === 3) {
    const before = new Map(
      ep.survivorIds.map((id) => [
        id,
        new Map(ep.survivorIds.map((target) => [target, battleRelationship(member(state, id), target)])),
      ]),
    );
    applyNarrativeBattleBacklash(state);
    const highlights = ep.survivorIds
      .flatMap((id) =>
        ep.survivorIds
          .filter(
            (target) =>
              target !== id && battleRelationship(member(state, id), target) < before.get(id)!.get(target)!,
          )
          .map(
            (target) =>
              `${mention(id)} struggles with ${mention(target)}'s team eliminating a friend: relationship ${before.get(id)!.get(target)} → ${battleRelationship(member(state, id), target)}.`,
          ),
      )
      .slice(0, 2);
    const scene = ep.scenes.at(-1)!;
    const authored = highlights.map((text) => authoredParagraph(state, text));
    scene.paragraphs.push(...authored.map((entry) => entry.paragraph));
    scene.paragraphContestantIds?.push(...authored.map((entry) => entry.ids));
    state.runtime!.show = transferEliminatedFans(
      state.runtime!.show,
      state.contestants,
      ep.survivorIds,
      random,
    );
  }
}

function mvp(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  ep.mvp = chooseAuditionMvp(
    ep.participantIds.map((id) => member(state, id)),
    battleAudienceEvaluations(ep.teams, ep.performances),
    ep.survivorIds,
    random,
    { castSize: 30, survivorCount: 18 },
  );
  const person = member(state, ep.mvp.winnerId);
  person.aggregations.mvp++;
  person.events.push('GROUP_BATTLES_MVP');
  append(
    state,
    'mvp',
    8,
    'mvp',
    'mvp',
    'The survivors choose their MVP',
    [
      `${mention(person.id)} wins the eighteen survivors' peer ballot. Nobody votes for themselves, and the honor adds no hidden ranking points.`,
    ],
    [person.id],
    true,
  );
}

function secretChoice(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const runtime = state.runtime!;
  const eligible = ep.participantIds.filter(
    (id) =>
      !member(state, id).attributes.some(
        (cardId) =>
          Object.hasOwn(runtime.definitions.cards.secret, cardId) &&
          (member(state, id).events.includes(`SECRET_REVEALED:${cardId}`) ||
            runtime.revealedSecrets.some((entry) => entry.contestantId === id && entry.cardId === cardId)),
      ),
  );
  ep.secretCandidates = shuffleWithRandom(eligible, random).slice(0, 3);
  if (!ep.secretCandidates.length) return rankingRule(state);
  append(
    state,
    'secret-choice',
    8,
    'secret',
    'secret',
    'One last question',
    ['Before the final announcement, production may investigate one contestant from this shortlist.'],
    ep.secretCandidates,
  );
}

function rankingRule(state: SimulationState) {
  append(
    state,
    'ranking-rule',
    8,
    'secret',
    'ranking',
    'A new chapter of the competition',
    [
      'From the next episode onward, your place in the ranking matters more than ever. The contestants at the bottom of the ranking will be eliminated.',
      'Tonight’s battle results and saves are final. Now, for the first time, let us see the complete ranking of the contestants who remain.',
    ],
    [],
    true,
  );
}

function ranking(state: SimulationState) {
  const ep = episode(state);
  story(state).rankRevealed = true;
  ep.survivorIds.forEach((id, index) => {
    member(state, id).rank = index + 1;
  });
  append(
    state,
    'ranking',
    8,
    'secret',
    'ranking',
    'The first full survivor ranking',
    ep.survivorIds.map((id, index) => `${index + 1}. ${mention(id)}`),
    ep.survivorIds,
    true,
  );
  ep.scenes.at(-1)!.paragraphContestantIds = ep.survivorIds.map((id) => [id]);
}

export function applyBattleRankReactions(state: SimulationState) {
  const ep = episode(state);
  const s = story(state);
  if (!s.rankRevealed || s.rankReactions.length)
    throw new Error('Rank reactions require a fresh full ranking reveal.');
  s.rankReactions = ep.survivorIds.map((id, index) => {
    const person = member(state, id);
    const target = index ? ep.survivorIds[index - 1] : null;
    const before = target ? battleRelationship(person, target) : 50;
    const { gentleness, maturity, sensitivity, ambition } = person.personality;
    const disposition = (before - 50) / 5 + gentleness + maturity - sensitivity - ambition;
    const delta = target ? clampBattle(Math.round(disposition / 10), -2, 2) : 0;
    if (target) changeBattleRelationship(person, target, delta);
    return {
      observerId: id,
      targetId: target,
      before,
      after: target ? battleRelationship(person, target) : before,
      emotion:
        delta < 0
          ? 'resentment and determination'
          : delta > 0
            ? 'respect and support'
            : index < 6
              ? 'pride'
              : index < 12
                ? 'relief'
                : 'insecurity and determination',
    };
  });
  const highlights = [...s.rankReactions]
    .sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))
    .slice(0, 3);
  append(
    state,
    'rank-reactions',
    8,
    'secret',
    'ranking',
    'The ranking sinks in',
    highlights.map(
      (reaction) =>
        `${mention(reaction.observerId)} feels ${reaction.emotion}${
          reaction.targetId
            ? ` toward ${mention(reaction.targetId)}, one place above: relationship ${reaction.before} → ${reaction.after}`
            : ' at taking first place'
        }.`,
    ),
    [
      ...new Set(
        highlights.flatMap((reaction) =>
          reaction.targetId ? [reaction.observerId, reaction.targetId] : [reaction.observerId],
        ),
      ),
    ],
  );
}

function advance(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const s = story(state);
  switch (s.stage) {
    case 'dorms':
      if (ep.roomCursor < 5) showRoom(state, random);
      else {
        playOpening(state, 2);
        append(
          state,
          'credits',
          2,
          'dorms',
          'opening',
          'Opening credits',
          ['A new chapter of The Search begins.'],
          state.runtime!.openingCast,
        );
      }
      break;
    case 'credits':
      append(
        state,
        'challenge',
        3,
        'ranking',
        'battles',
        'Mike explains The Battles',
        [
          'Today you will form six teams of five. The top six contestants from the previous combined standings will be your captains.',
          'Captains take turns choosing teammates. Each team will face one opponent, and the losing teams face elimination.',
        ],
        [],
        true,
      );
      break;
    case 'challenge':
      createCaptains(ep);
      for (const team of ep.teams) team.name = `Team ${member(state, team.captainId).name}`;
      append(
        state,
        'captains',
        3,
        'draft',
        'draft',
        'Six captains take the floor',
        [
          ...ep.teams.map(
            (team, index) => `${index + 1}. ${mention(team.captainId)} will lead ${teamMention(team)}.`,
          ),
          'Only the captains are announced now. The complete survivor ranking will be revealed at the end of the episode.',
        ],
        ep.teams.map((team) => team.captainId),
        true,
      );
      break;
    case 'captains':
    case 'draft':
      if (s.draftPick < 24) {
        const teamIndex = s.draftPick % 6;
        draftRound(state, random, teamIndex);
        describeDraftTeam(state, ep.teams[teamIndex]);
        s.draftPick++;
        s.stage = 'draft';
        const scene = ep.scenes.at(-1)!;
        scene.sequence = 3;
        scene.presentation = 'introduction';
      } else {
        createPairings(state, random, false);
        ep.scenes.pop();
        showPairing(state, random);
      }
      break;
    case 'pairings':
      if (s.pairingCursor < 3) showPairing(state, random);
      else showRehearsal(state, random);
      break;
    case 'rehearsal':
      showLeadership(state);
      break;
    case 'leadership':
      showCenter(state);
      break;
    case 'center':
      featuredConflict(state);
      s.stage = 'intervention';
      ep.scenes.at(-1)!.sequence = s.sequence;
      ep.scenes.at(-1)!.presentation = 'introduction';
      break;
    case 'intervention-result':
      perform(state, random);
      break;
    case 'performance':
      if (ep.teamCursor % 2) reactToPerformance(state);
      else if (ep.teamCursor < 6) showRehearsal(state, random);
      else {
        closeAudience(state, random);
        review(state);
      }
      break;
    case 'opponent-reaction':
      showRehearsal(state, random);
      break;
    case 'reviews':
      if (s.reviewCursor < 3) review(state);
      else winner(state);
      break;
    case 'winners':
      if (ep.revealedResults < 3) winner(state);
      else
        append(
          state,
          'twist',
          8,
          'saves',
          'saves',
          'Three unexpected lifelines',
          [
            'There is one more chance. The judges, the audience, and production will each save one contestant from the losing teams.',
          ],
          [],
          true,
        );
      break;
    case 'twist':
      saveJudge(state);
      break;
    case 'judge-save':
      saveAudience(state);
      break;
    case 'audience-save':
      productionChoice(state);
      break;
    case 'save-result':
      departures(state, random);
      break;
    case 'departures':
      if (s.departureCursor < 3) departures(state, random);
      else mvp(state, random);
      break;
    case 'mvp':
      secretChoice(state, random);
      break;
    case 'secret-result':
      rankingRule(state);
      break;
    case 'ranking-rule':
      ranking(state);
      break;
    case 'ranking':
      applyBattleRankReactions(state);
      break;
    case 'rank-reactions':
      s.stage = 'complete';
      break;
    default:
      throw new Error('Make the current production decision before continuing.');
  }
}

function finalize(state: SimulationState, random: ReturnType<typeof createSeededRandom>) {
  const runtime = state.runtime!;
  runtime.randomState = random.getState();
  freezeSimulationSnapshot(runtime.sourceContestants);
  freezeSimulationSnapshot(runtime.initialContestants);
  freezeSimulationSnapshot(runtime.definitions);
  state.persistenceError = null;
  if (runtime.battle) assertNarrativeBattleEpisode(runtime.battle, state.contestants, runtime.definitions);
  return state;
}

export function transitionBattleStory(
  current: SimulationState,
  action: BattleAction,
  revision: number,
): SimulationState {
  const runtime = current.runtime;
  if (!runtime || runtime.version !== 3 || current.status !== 'ready')
    throw new Error('Start a new simulation to watch The Battles.');
  if (!Number.isInteger(revision) || revision < 0) throw new Error('A valid battle revision is required.');
  const old = runtime.battle;
  const preparation = runtime.preparations?.[2];
  if (!old) {
    if (runtime.audition?.phase !== 'complete') throw new Error('Complete Auditions first.');
    if (!preparation) {
      if (action.type !== 'start' || revision !== 0) throw new Error('Start Episode 2 preparation first.');
      const next = structuredClone(current);
      const random = createSeededRandom(runtime.randomState);
      initializePreparation(next, 2, random.next);
      return finalize(next, random);
    }
    if (
      (action.type === 'start' && revision === 0 && preparation.revision === 0) ||
      (preparation.lastAction?.revision === revision &&
        JSON.stringify(preparation.lastAction.action) === JSON.stringify(action))
    )
      return current;
    if (revision !== preparation.revision) throw new Error('This preparation action is stale.');
    if (action.type !== 'mood' && action.type !== 'opening-cast' && action.type !== 'randomize-mood')
      throw new Error('Complete the opening mood and cast first.');
    const next = structuredClone(current);
    const random = createSeededRandom(runtime.randomState);
    applyPreparation(next, action, random.next);
    const prep = next.runtime!.preparations![2]!;
    prep.revision++;
    prep.lastAction = { revision, action: structuredClone(action) };
    if (prep.mood && prep.slots.every((id) => id !== null)) startStory(next, random.next);
    return finalize(next, random);
  }
  if (
    (old.lastAction.revision === revision &&
      JSON.stringify(old.lastAction.action) === JSON.stringify(action)) ||
    (preparation?.lastAction?.revision === revision &&
      JSON.stringify(preparation.lastAction.action) === JSON.stringify(action))
  )
    return current;
  if (revision !== old.revision) throw new Error('This battle action is stale; reload the current episode.');
  assertNarrativeBattleEpisode(old, current.contestants, runtime.definitions);
  if (old.phase === 'complete') throw new Error('The Battles is complete.');
  const next = structuredClone(current);
  const random = createSeededRandom(runtime.randomState);
  const before = structuredClone(next.contestants);
  const ep = episode(next);
  ep.revision++;
  ep.lastAction = { revision, action: structuredClone(action) };
  const stage = story(next).stage;
  if (action.type === 'advance') advance(next, random.next);
  else if (action.type === 'conflict') intervene(next, action);
  else if (action.type === 'production-save' && stage === 'production-save')
    saveProduction(next, action.contestantId);
  else if (action.type === 'secret' && stage === 'secret-choice') {
    if (!ep.secretCandidates.includes(action.contestantId))
      throw new Error('Choose someone from the secret shortlist.');
    const result = revealAuditionSecret(next.contestants, action.contestantId, next.runtime!.definitions);
    next.contestants = result.contestants;
    ep.secret = result.result;
    if (ep.secret.cardId) {
      next.runtime!.revealedSecrets.push({ contestantId: action.contestantId, cardId: ep.secret.cardId });
      next.runtime!.deferredConsequences.push(...ep.secret.deferred);
    }
    append(
      next,
      'secret-result',
      8,
      'secret',
      'secret',
      ep.secret.title,
      [
        ep.secret.description,
        ...(ep.secret.deferred.length
          ? ['Outcome-changing effects are deferred; tonight’s results remain locked.']
          : []),
      ],
      [action.contestantId],
    );
  } else throw new Error('That decision is not available in the current story beat.');
  captureChanges(next, before, `The Battles: ${stage}`);
  if (story(next).stage === 'complete') {
    finishEpisode(next);
    const final = episode(next).scenes.at(-1)!;
    final.sequence = 8;
    final.presentation = 'host';
    final.speaker = { name: 'Mike Philip', role: 'Host' };
    final.paragraphs = [
      'Eighteen contestants remain. From now on, the bottom of the ranking faces elimination. The Search continues.',
    ];
  }
  return finalize(next, random);
}
