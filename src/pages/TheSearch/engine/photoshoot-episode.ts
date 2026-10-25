import type { EpisodeScene } from '../types/audition-episode';
import type { Contestant } from '../types/contestant';
import type {
  GroupPhoto,
  PhotoshootAction,
  PhotoshootConcept,
  PhotoshootEpisode,
  PhotoshootPhase,
  PhotoshootProposal,
  PhotoshootTeam,
  PhotoshootWardrobeChoice,
} from '../types/photoshoot-episode';
import type { SimulationState } from '../types/simulation';
import { validatePhotoshootConcepts } from '../utilities/photoshoot-concepts';
import { freezeSimulationSnapshot } from '../utilities/simulation-definitions';
import { awardNewActivity, recordSceneTV } from './activity-awards';
import { resolveNarrativeEvidenceAudience } from './audition-audience';
import { auditionGrade, rollAuditionDice } from './audition-scoring';
import { revealAuditionSecret } from './audition-secrets';
import { battleRelationship, changeBattleRelationship } from './battle-scoring';
import { appendContestantHistory, recordContestantChanges } from './change-history';
import { applyPreparation, initializePreparation, playOpening } from './episode-preparation';
import {
  choosePhotoshootVisual,
  clampPhoto,
  meanPhoto,
  photoMention as mention,
  normalizePhotoTrait,
  photoshootCheck,
  photoshootConceptPreference,
  photoshootStylingQuality,
  scoreGroupPhotoMember,
  scoreIndividualPhoto,
} from './photoshoot-scoring';
import { assertPhotoshootEpisode, validatePhotoshoot } from './photoshoot-validation';
import { createSeededRandom, type RandomSource, shuffleWithRandom } from './random';

export { assertPhotoshootEpisode, validatePhotoshoot } from './photoshoot-validation';

const host = { name: 'Mike Philip', role: 'Host' };
const megan = { name: 'Megan Ryder', role: 'Veteran artist' };
const michael = { name: 'Michael Lion', role: 'Record-label executive' };
function episode(state: SimulationState): PhotoshootEpisode {
  const ep = state.runtime?.photoshoot;
  if (!ep) throw new Error('Start the Photoshoot first.');
  return ep;
}
function person(state: SimulationState, id: string): Contestant {
  const value = state.contestants.find((entry) => entry.id === id);
  if (!value) throw new Error(`Unknown Photoshoot contestant "${id}".`);
  return value;
}
function plain(state: SimulationState, text: string) {
  return text.replace(/\[\[contestant:([^\]]+)\]\]/g, (_, id: string) => person(state, id).name);
}
function concept(state: SimulationState, team: PhotoshootTeam): PhotoshootConcept {
  const result = state.runtime!.definitions.photoshootConcepts!.find((entry) => entry.id === team.conceptId);
  if (!result) throw new Error('Missing frozen Photoshoot concept.');
  return result;
}
function append(
  state: SimulationState,
  phase: PhotoshootPhase,
  sequence: number,
  title: string,
  paragraphs: string[],
  ids: string[] = [],
  speaker?: EpisodeScene['speaker'],
  tier?: 0 | 1 | 3 | 6,
) {
  const ep = episode(state);
  const references: string[][] = [];
  const text = paragraphs.map((paragraph) => {
    const refs: string[] = [];
    const output = paragraph.replace(/\[\[contestant:([^\]]+)\]\]/g, (_, id: string) => {
      refs.push(id);
      return person(state, id).name;
    });
    references.push(refs);
    return output;
  });
  const kind: EpisodeScene['kind'] =
    phase === 'dorms'
      ? 'dorms'
      : phase === 'draft' || phase === 'concepts'
        ? 'draft'
        : phase === 'styling-choice' || phase === 'styling-result'
          ? 'practice'
          : phase === 'individual' || phase === 'group'
            ? 'battles'
            : phase === 'ranking'
              ? 'ranking'
              : phase === 'ultimate-visual'
                ? 'mvp'
                : phase === 'secret-choice' || phase === 'secret-result'
                  ? 'secret'
                  : phase === 'credits'
                    ? 'opening'
                    : 'recap';
  ep.phase = phase;
  const scene = recordSceneTV(
    {
      id: `photoshoot-${ep.scenes.length}`,
      sequence,
      kind,
      title,
      paragraphs: text,
      contestantIds: [...new Set(ids)],
      paragraphContestantIds: references,
      presentation: speaker ? 'host' : 'performance',
      ...(speaker ? { speaker } : {}),
    },
    tier,
  );
  ep.scenes.push(scene);
  // A shared shot credits each visible person; this is not the normalized voting exposure.
  for (const id of scene.contestantIds) {
    if (!ep.participantIds.includes(id)) continue;
    ep.screenTime[id] += 1;
    person(state, id).aggregations.screenTime += 1;
  }
}
function start(state: SimulationState) {
  const runtime = state.runtime!;
  const previous = runtime.megaGroups!;
  const ids = [...previous.survivorIds];
  const active = state.contestants.filter((entry) => entry.status === 'ACTIVE').map(({ id }) => id);
  if (
    ids.length !== 16 ||
    new Set(ids).size !== 16 ||
    active.length !== 16 ||
    active.some((id) => !ids.includes(id))
  )
    throw new Error('The Photoshoot requires exactly the sixteen active Mega Groups survivors.');
  validatePhotoshootConcepts(
    runtime.definitions.photoshootConcepts,
    Object.keys(runtime.definitions.specialties.visualVibe),
  );
  runtime.photoshoot = {
    version: 1,
    phase: 'dorms',
    revision: 0,
    lastAction: { revision: 0, action: { type: 'start' } },
    participantIds: ids,
    previousRankedIds: [...ids],
    startingContestants: structuredClone(state.contestants),
    teams: [],
    draftPicks: [],
    teamCursor: 0,
    individualCursor: 0,
    groupCursor: 0,
    individualPhotos: [],
    groupPhotos: [],
    attention: Object.fromEntries(ids.map((id) => [id, 0])),
    receptionBonuses: Object.fromEntries(ids.map((id) => [id, 0])),
    screenTime: Object.fromEntries(ids.map((id) => [id, 0])),
    peerTieKeys: {},
    awardTieKeys: {},
    peerEvidence: {},
    peerVote: null,
    audience: null,
    ultimateVisual: null,
    sealedRankingScores: {},
    rankingTieKeys: {},
    secretCandidates: [],
    secret: null,
    rankedIds: [],
    rankRevealed: false,
    survivorIds: [],
    scenes: [],
    changes: {},
  };
  runtime.episode = 5;
  runtime.phase = 'photoshoot';
  const paragraphs = [
    `The beds left by ${mention(previous.eliminatedId!)} and ${mention(previous.withdrawnId!)} are empty after two different goodbyes. Nobody knows what this week will ask of them.`,
  ];
  const visible: string[] = [];
  for (const room of runtime.battle!.rooms) {
    const occupants = room.memberIds.filter((id) => ids.includes(id));
    if (!occupants.length) continue;
    visible.push(...occupants);
    const first = [...occupants].sort(
      (a, b) =>
        person(state, a).aggregations.happiness - person(state, b).aggregations.happiness ||
        a.localeCompare(b),
    )[0];
    const helper = occupants
      .filter((id) => id !== first)
      .sort(
        (a, b) =>
          battleRelationship(person(state, b), first) +
            person(state, b).personality.gentleness -
            battleRelationship(person(state, a), first) -
            person(state, a).personality.gentleness || a.localeCompare(b),
      )[0];
    const departedHere = room.memberIds.filter(
      (id) => id === previous.eliminatedId || id === previous.withdrawnId,
    );
    paragraphs.push(
      `${room.id}: ${occupants.map(mention).join(', ')} ${
        departedHere.length
          ? `look toward the bed once used by ${departedHere.map(mention).join(' and ')}`
          : 'sit among the same occupied and empty beds as before'
      }.`,
    );
    if (helper) {
      const supportive =
        person(state, helper).personality.gentleness >= 5 ||
        battleRelationship(person(state, helper), first) >= 60;
      paragraphs.push(
        supportive
          ? `${mention(first)} admits, "Two goodbyes in one night is hard to take." ${mention(helper)} stays beside them: "We can talk before the next call."`
          : `${mention(first)} says, "I keep wondering who will be next." ${mention(helper)} answers carefully: "I do not know. I am trying to focus on getting through the next day."`,
      );
    } else
      paragraphs.push(
        `${mention(first)} sits quietly in their actual room, thinking about the two departures.`,
      );
  }
  append(state, 'dorms', 1, 'After the double departure', paragraphs, visible);
}
function appointLeader(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const leaderId = ep.previousRankedIds[ep.teams.length];
  const available = state.runtime!.definitions.photoshootConcepts!.filter(
    (entry) => !ep.teams.some((team) => team.conceptId === entry.id),
  );
  const leader = person(state, leaderId);
  const conceptTieKeys = Object.fromEntries(available.map(({ id }) => [id, random()]));
  const conceptScores = Object.fromEntries(
    available.map((entry) => [entry.id, photoshootConceptPreference(leader, entry)]),
  );
  const selected = [...available].sort(
    (a, b) =>
      conceptScores[b.id] - conceptScores[a.id] ||
      conceptTieKeys[a.id] - conceptTieKeys[b.id] ||
      a.id.localeCompare(b.id),
  )[0];
  const team: PhotoshootTeam = {
    id: `photo-team-${ep.teams.length + 1}`,
    name: selected.name,
    leaderId,
    conceptId: selected.id,
    memberIds: [leaderId],
    conceptScores,
    conceptTieKeys,
    proposals: [],
    negotiation: null,
    styling: null,
    centerId: null,
    centerBallots: {},
    centerTotals: {},
    centerTieKeys: {},
  };
  ep.teams.push(team);
  leader.aggregations.leader++;
  const fit = selected.vibeFit[leader.specialties.visualVibe];
  append(
    state,
    'concepts',
    3,
    `${leader.name} chooses a concept`,
    [
      `Previous finalist rank ${ep.teams.length}: ${mention(leaderId)} becomes a Concept Leader and chooses ${selected.name}. ${selected.description}`,
      fit === 100
        ? 'The visual direction feels like a natural match.'
        : fit === 0
          ? 'This is the best available choice, but the visual direction clashes with their usual look.'
          : 'The direction is unfamiliar rather than an automatic advantage.',
    ],
    [leaderId],
    host,
  );
}
function draft(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const team = ep.teams[ep.draftPicks.length % 4];
  const picked = new Set(ep.teams.flatMap((entry) => entry.memberIds));
  const availableIds = ep.participantIds.filter((id) => !picked.has(id));
  const tieKeys = Object.fromEntries(availableIds.map((id) => [id, random()]));
  const leader = person(state, team.leaderId);
  const core = (id: string) => meanPhoto(Object.values(person(state, id).coreSkills));
  const chosen = [...availableIds].sort(
    (a, b) =>
      battleRelationship(leader, b) - battleRelationship(leader, a) ||
      person(state, b).utilitySkills.charisma - person(state, a).utilitySkills.charisma ||
      core(b) - core(a) ||
      tieKeys[a] - tieKeys[b] ||
      a.localeCompare(b),
  )[0];
  team.memberIds.push(chosen);
  const passedOverIds: string[] = [];
  for (const id of availableIds) {
    if (id === chosen) continue;
    const unpicked = person(state, id);
    const p = unpicked.personality;
    if (p.gentleness >= 5 || p.maturity >= 5) continue;
    const delta = p.sensitivity <= -5 ? -2 : -1;
    changeBattleRelationship(unpicked, leader.id, delta);
    changeBattleRelationship(unpicked, chosen, delta);
    passedOverIds.push(id);
  }
  const round = Math.floor(ep.draftPicks.length / 4) + 1;
  ep.draftPicks.push({ teamId: team.id, contestantId: chosen, round, tieKeys, availableIds, passedOverIds });
  const fit = concept(state, team).vibeFit[person(state, chosen).specialties.visualVibe];
  const paragraphs = [
    `Round ${round}: ${mention(leader.id)} chooses ${mention(chosen)} for ${team.name}. ${
      availableIds.length === 1
        ? 'They were the last available contestant, and take a breath before joining.'
        : 'The leader puts existing bonds first, then camera charm and all-round ability.'
    }`,
    fit === 0
      ? `${mention(chosen)} studies the concept board: "That is not my usual look. I will have to find a way into it."`
      : fit === 100
        ? `${mention(chosen)} recognizes a visual direction that suits them.`
        : `${mention(chosen)} approaches an unfamiliar concept without assuming it will be easy.`,
    ...passedOverIds
      .slice(0, 3)
      .map(
        (id) =>
          `${mention(id)} looks away after being passed over; both the leader and the chosen teammate feel a little further away.`,
      ),
  ];
  append(state, 'draft', 3, `${leader.name}'s draft pick`, paragraphs, [
    leader.id,
    chosen,
    ...passedOverIds.slice(0, 3),
  ]);
}
function prepareStyling(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const team = ep.teams[ep.teamCursor];
  const board = concept(state, team);
  const choose = (
    choices: PhotoshootWardrobeChoice[],
    contestant: Contestant,
    keys: Record<string, number>,
  ) => {
    for (const choice of choices) keys[choice.id] = random();
    return [...choices].sort(
      (a, b) =>
        b.vibeFit[contestant.specialties.visualVibe] - a.vibeFit[contestant.specialties.visualVibe] ||
        Math.abs(a.novelty - normalizePhotoTrait(contestant.personality.curiosity)) -
          Math.abs(b.novelty - normalizePhotoTrait(contestant.personality.curiosity)) ||
        keys[a.id] - keys[b.id] ||
        a.id.localeCompare(b.id),
    )[0];
  };
  team.proposals = team.memberIds.map((id): PhotoshootProposal => {
    const contestant = person(state, id);
    const tieKeys: Record<string, number> = {};
    const outfitKeys: Record<string, number> = {};
    const propKeys: Record<string, number> = {};
    const outfit = choose(board.outfits, contestant, outfitKeys);
    const prop = choose(board.props, contestant, propKeys);
    for (const [key, value] of Object.entries(outfitKeys)) tieKeys[`outfit:${key}`] = value;
    for (const [key, value] of Object.entries(propKeys)) tieKeys[`prop:${key}`] = value;
    return {
      contestantId: id,
      outfitId: outfit.id,
      outfitName: outfit.name,
      propId: prop.id,
      propName: prop.name,
      outfitFit: outfit.vibeFit[contestant.specialties.visualVibe],
      conceptFit: board.vibeFit[contestant.specialties.visualVibe],
      tieKeys,
    };
  });
  const leaderProposal = team.proposals.find((entry) => entry.contestantId === team.leaderId)!;
  const challenger = team.proposals.find((entry) => {
    const p = person(state, entry.contestantId).personality;
    return (
      entry.contestantId !== team.leaderId &&
      p.ambition >= 5 &&
      p.gentleness <= -5 &&
      entry.outfitId !== leaderProposal.outfitId
    );
  });
  const mediator = challenger
    ? team.memberIds.find(
        (id) =>
          id !== team.leaderId &&
          id !== challenger.contestantId &&
          person(state, id).personality.gentleness >= 5,
      )
    : undefined;
  if (challenger) {
    changeBattleRelationship(person(state, challenger.contestantId), team.leaderId, -2);
    changeBattleRelationship(person(state, team.leaderId), challenger.contestantId, -2);
    if (mediator) {
      changeBattleRelationship(person(state, team.leaderId), mediator, 1);
      changeBattleRelationship(person(state, challenger.contestantId), mediator, 1);
    }
  }
  const negotiation = challenger
    ? `${mention(challenger.contestantId)} challenges ${mention(team.leaderId)}'s ${leaderProposal.outfitName} direction, insisting on ${challenger.outfitName}. The leader asks for a coherent cover; neither enjoys the disagreement.${
        mediator
          ? ` ${mention(mediator)} suggests keeping individual details within the common palette; both listen.`
          : ''
      }`
    : `${mention(team.leaderId)} proposes a shared palette around ${leaderProposal.outfitName}, listens to each proposal and leaves room for individual details. There is no forced argument.`;
  team.negotiation = {
    leaderOutfitId: leaderProposal.outfitId,
    challengerId: challenger?.contestantId ?? null,
    mediatorId: mediator ?? null,
    description: negotiation,
  };
  append(
    state,
    'styling-choice',
    4,
    `${team.name}: the wardrobe room`,
    [
      ...team.proposals.map(
        (entry) =>
          `${mention(entry.contestantId)} proposes ${entry.outfitName} with ${entry.propName}. ${
            entry.outfitFit === 0
              ? 'Even their best available outfit clashes with their usual visual style.'
              : entry.outfitFit === 50
                ? 'The outfit is a neutral match, not a natural advantage.'
                : 'The outfit fits their visual style.'
          }`,
      ),
      negotiation,
      'Production can bring in a stylist, or let the team finish styling themselves. Their original proposals stay part of the story.',
    ],
    team.memberIds,
    undefined,
    challenger ? 6 : 3,
  );
  team.negotiation.description = plain(state, team.negotiation.description);
}
function style(state: SimulationState, choice: 'intervene' | 'self-style') {
  const ep = episode(state);
  const team = ep.teams[ep.teamCursor];
  if (team.styling) throw new Error('This styling session is already complete.');
  const quality = photoshootStylingQuality(team.memberIds.map((id) => person(state, id)));
  const modifier = choice === 'intervene' ? 15 : clampPhoto(0.5 * (quality - 50), -15, 25);
  const outfitModifiers: Record<string, number> = {};
  const finalOutfits: Record<string, string> = {};
  for (const proposal of team.proposals) {
    outfitModifiers[proposal.contestantId] = choice === 'intervene' ? 5 : (proposal.outfitFit - 50) / 10;
    finalOutfits[proposal.contestantId] =
      choice === 'intervene'
        ? `a stylist-fitted ${team.name} ensemble, with ${proposal.propName}`
        : `${proposal.outfitName}, with ${proposal.propName}`;
    if (choice === 'intervene') {
      const contestant = person(state, proposal.contestantId);
      contestant.aggregations.happiness = clampPhoto(contestant.aggregations.happiness - 3);
    }
  }
  const description =
    choice === 'intervene'
      ? 'The stylist finishes four concept-appropriate looks. The team appreciates the polish but loses a little happiness at having its choices overruled.'
      : quality >= 50
        ? 'The team completes its own styling, using its curiosity and distinctive ideas to find a workable look.'
        : 'The team completes its own styling, but familiar choices and limited experimentation leave the looks uncertain.';
  team.styling = { completed: true, choice, quality, modifier, outfitModifiers, finalOutfits, description };
  append(
    state,
    'styling-result',
    4,
    `${team.name}: the final looks`,
    [description, ...team.memberIds.map((id) => `${mention(id)} is ready in ${finalOutfits[id]}.`)],
    team.memberIds,
  );
}
function individual(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const id = ep.participantIds[ep.individualCursor];
  const contestant = person(state, id);
  const team = ep.teams.find((entry) => entry.memberIds.includes(id))!;
  const photo = scoreIndividualPhoto(contestant, team, rollAuditionDice(random));
  if (photo.banter) {
    ep.attention[id]++;
    ep.receptionBonuses[id] += 5;
  }
  if (photo.finalScore >= 85 || photo.finalScore < 40) {
    for (const observerId of ep.participantIds.filter((other) => other !== id)) {
      const observer = person(state, observerId);
      const before = battleRelationship(observer, id);
      const supportive = observer.personality.gentleness >= 5 || before >= 60;
      const awe = photo.finalScore >= 85;
      const kind = awe ? 'awe' : supportive ? 'support' : 'awkward';
      const delta = awe || supportive ? 1 : -1;
      changeBattleRelationship(observer, id, delta);
      const description = awe
        ? `${mention(observerId)} leans toward the monitor: "That expression really works."`
        : supportive
          ? `${mention(observerId)} turns to ${mention(id)}: "One difficult frame does not define you. Keep going."`
          : `${mention(observerId)} falls quiet at the monitor; the uncomfortable frame makes their distance more obvious.`;
      photo.reactions.push({
        observerId,
        performerId: id,
        kind,
        delta,
        relationshipBefore: before,
        relationshipAfter: battleRelationship(observer, id),
        description,
        highlighted: photo.reactions.length < 3,
      });
    }
  }
  ep.individualPhotos.push(photo);
  ep.individualCursor++;
  append(
    state,
    'individual',
    5,
    `${contestant.name}: the individual shoot`,
    [
      photo.description,
      ...(photo.banter
        ? [
            `${mention(id)} jokes with the photographer, then asks for one more frame. The relaxed exchange makes the edit.`,
          ]
        : []),
      'John Stan watches beside Megan and Michael; this is photography, not a music test.',
      ...photo.reactions.filter((entry) => entry.highlighted).map((entry) => entry.description),
    ],
    [id],
    undefined,
    photo.banter ? 3 : 0,
  );
  const scene = ep.scenes.at(-1)!;
  scene.paragraphContestantIds![0] = [id];
  scene.dialogues = photo.feedback.map((entry) => ({
    ...(entry.judgeId === 'megan' ? megan : michael),
    paragraphs: [
      entry.description.replace(
        /\[\[contestant:([^\]]+)\]\]/g,
        (_, target: string) => person(state, target).name,
      ),
    ],
    paragraphContestantIds: [[id]],
  }));
  for (const reaction of photo.reactions.filter((entry) => entry.highlighted)) {
    scene.tvMoments ??= {};
    scene.tvMoments[`reaction:${id}:${reaction.observerId}`] = { [reaction.observerId]: 3 };
    ep.screenTime[reaction.observerId]++;
    person(state, reaction.observerId).aggregations.screenTime++;
  }
  for (const reaction of photo.reactions) reaction.description = plain(state, reaction.description);
}
function electCenter(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const team = ep.teams[ep.groupCursor];
  team.centerTotals = Object.fromEntries(team.memberIds.map((id) => [id, 0]));
  const ties: Record<string, Record<string, number>> = {};
  for (const voter of team.memberIds) {
    ties[voter] = Object.fromEntries(team.memberIds.map((id) => [id, random()]));
    const preference = (id: string) => {
      const candidate = person(state, id);
      return (
        candidate.coreSkills.visual +
        candidate.coreSkills.uniqueness +
        candidate.utilitySkills.charisma +
        battleRelationship(person(state, voter), id) / 20
      );
    };
    const chosen = [...team.memberIds].sort(
      (a, b) =>
        preference(b) - preference(a) ||
        person(state, b).coreSkills.stagePresence - person(state, a).coreSkills.stagePresence ||
        ties[voter][a] - ties[voter][b] ||
        a.localeCompare(b),
    )[0];
    team.centerBallots[voter] = chosen;
    team.centerTotals[chosen]++;
  }
  ties.result = Object.fromEntries(team.memberIds.map((id) => [id, random()]));
  team.centerTieKeys = ties;
  team.centerId = [...team.memberIds].sort(
    (a, b) =>
      team.centerTotals[b] - team.centerTotals[a] ||
      person(state, b).coreSkills.visual - person(state, a).coreSkills.visual ||
      person(state, b).utilitySkills.charisma - person(state, a).utilitySkills.charisma ||
      ties.result[a] - ties.result[b] ||
      a.localeCompare(b),
  )[0];
  person(state, team.centerId).aggregations.center++;
  append(
    state,
    'center',
    6,
    `${team.name}: choosing a center`,
    [
      'The four members elect their cover center. The leader is eligible, and members may vote for themselves.',
      ...team.memberIds.map((id) => `${mention(id)} votes for ${mention(team.centerBallots[id])}.`),
      `${mention(team.centerId)} takes the center position.`,
    ],
    team.memberIds,
    undefined,
    1,
  );
}
function group(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const team = ep.teams[ep.groupCursor];
  const raw = Object.fromEntries(team.memberIds.map((id) => [id, rollAuditionDice(random)]));
  const actions: GroupPhoto['actions'] = [];
  for (const id of team.memberIds.filter((other) => other !== team.centerId)) {
    const contestant = person(state, id);
    if (contestant.personality.ambition >= 5) {
      const success = photoshootCheck(contestant, 'stagePresence', raw[id]).score >= 70;
      const description = success
        ? `${mention(id)} steps across ${mention(team.centerId!)}'s camera line and pulls the eye with a strong pose. The focus-stealing works, but the others resent the interruption.`
        : `${mention(id)} steps across ${mention(team.centerId!)}'s camera line, but the uncertain pose breaks the composition. Michael asks them to return to the agreed shape.`;
      actions.push({
        contestantId: id,
        beneficiaryId: id,
        type: 'steal',
        success,
        modifier: success ? 10 : -10,
        description,
      });
      for (const other of team.memberIds.filter((target) => target !== id)) {
        changeBattleRelationship(
          person(state, other),
          id,
          success ? (other === team.centerId ? -8 : -6) : other === team.centerId ? -4 : -3,
        );
      }
      if (success) {
        ep.attention[id]++;
        ep.receptionBonuses[id] += 5;
      }
    } else if (contestant.personality.gentleness >= 5) {
      const beneficiaryId = team.centerId!;
      changeBattleRelationship(person(state, beneficiaryId), id, 2);
      actions.push({
        contestantId: id,
        beneficiaryId,
        type: 'yield',
        success: true,
        modifier: -5,
        description: `${mention(id)} lowers their prop and turns a shoulder aside so ${mention(beneficiaryId)} has a clean line to the camera. The edit catches the quiet support.`,
      });
      ep.attention[id]++;
      ep.receptionBonuses[id] += 5;
    }
  }
  const relationshipMean = meanPhoto(
    team.memberIds.flatMap((id) =>
      team.memberIds
        .filter((other) => other !== id)
        .map((other) => battleRelationship(person(state, id), other)),
    ),
  );
  const baseCohesion = clampPhoto((relationshipMean - 50) / 10, -5, 5);
  const supportCohesion = Math.min(6, 2 * actions.filter((entry) => entry.type === 'yield').length);
  const stealingPenalty = Math.min(6, 3 * actions.filter((entry) => entry.type === 'steal').length);
  const cohesionModifier = baseCohesion + supportCohesion - stealingPenalty;
  const evaluations = team.memberIds.map((id) =>
    scoreGroupPhotoMember(
      person(state, id),
      team,
      raw[id],
      actions.find((entry) => entry.contestantId === id)?.modifier ?? 0,
      cohesionModifier,
    ),
  );
  const finalScore = meanPhoto(evaluations.map((entry) => entry.finalScore));
  const grade = auditionGrade(finalScore);
  const description = `${team.name}: ${team.memberIds.map(mention).join(', ')} ${
    finalScore >= 70 ? 'form a convincing shared cover' : 'share a cover with uneven individual poses'
  }, centered on ${mention(team.centerId!)}. ${concept(state, team).description} Cover edit: ${grade}.`;
  ep.groupPhotos.push({
    teamId: team.id,
    centerId: team.centerId!,
    evaluations,
    actions,
    relationshipMean,
    baseCohesion,
    supportCohesion,
    stealingPenalty,
    cohesionModifier,
    finalScore,
    grade,
    description,
  });
  ep.groupCursor++;
  append(
    state,
    'group',
    6,
    `${team.name}: the cover shoot`,
    [
      description,
      ...actions.map((entry) => entry.description),
      ...evaluations.map((entry) => entry.description),
      `Michael Lion: "${
        finalScore >= 70
          ? 'The four looks read as a cover, not just four separate portraits.'
          : 'I can see individual ideas, but the shared shape does not hold consistently.'
      }"`,
    ],
    team.memberIds,
    michael,
    0,
  );
  const scene = ep.scenes.at(-1)!;
  evaluations.forEach((entry, index) => {
    scene.paragraphContestantIds![1 + actions.length + index] = [entry.contestantId];
  });
  for (const action of actions) {
    scene.tvMoments ??= {};
    scene.tvMoments[`${action.type}:${action.contestantId}`] = {
      [action.contestantId]: action.type === 'steal' ? 6 : 3,
      ...(action.beneficiaryId !== action.contestantId ? { [action.beneficiaryId]: 3 as const } : {}),
    };
    action.description = plain(state, action.description);
  }
  ep.groupPhotos.at(-1)!.description = plain(state, description);
}
function gallery(state: SimulationState) {
  const ep = episode(state);
  append(
    state,
    'gallery',
    7,
    'The finished gallery',
    [
      'The sixteen individual edits and four covers are displayed exactly as photographed.',
      ...ep.individualPhotos.map((entry) => entry.description),
      ...ep.groupPhotos.map((entry) => entry.description),
    ],
    ep.participantIds,
    undefined,
    0,
  );
  ep.scenes.at(-1)!.paragraphContestantIds = [
    [],
    ...ep.individualPhotos.map((entry) => [entry.contestantId]),
    ...ep.groupPhotos.map((entry) => [...ep.teams.find((team) => team.id === entry.teamId)!.memberIds]),
  ];
}
function ballots(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  ep.peerTieKeys = Object.fromEntries(
    ep.participantIds.map((voter) => [
      voter,
      Object.fromEntries(ep.participantIds.filter((id) => id !== voter).map((id) => [id, random()])),
    ]),
  );
  ep.awardTieKeys = Object.fromEntries(ep.participantIds.map((id) => [id, random()]));
  const vote = choosePhotoshootVisual(
    ep.participantIds.map((id) => person(state, id)),
    ep.individualPhotos,
    ep.peerTieKeys,
    ep.awardTieKeys,
  );
  ep.peerVote = vote.result;
  ep.peerEvidence = vote.evidence;
  append(
    state,
    'ballots',
    7,
    'Sixteen private peer ballots',
    [
      'Every performer privately votes for Ultimate Visual. There are no self-votes. The contestants do not see one another’s ballots; the viewer sees every choice.',
      ...ep.participantIds.map((id) => `${mention(id)} votes for ${mention(vote.result.ballots[id])}.`),
      'The result will be announced by Mike at the results desk.',
    ],
    [],
    undefined,
    0,
  );
}
function awardAndLock(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  if (!ep.peerVote) throw new Error('Cast the gallery ballots first.');
  ep.ultimateVisual = structuredClone(ep.peerVote);
  const winner = person(state, ep.ultimateVisual.winnerId);
  winner.aggregations.mvp++;
  winner.aggregations.audienceRatio = clampPhoto(winner.aggregations.audienceRatio + 0.1, -1, 1);
  winner.events.push('PHOTOSHOOT_ULTIMATE_VISUAL');
  append(
    state,
    'ultimate-visual',
    8,
    'Ultimate Visual',
    [
      `${mention(winner.id)} is Ultimate Visual with ${ep.ultimateVisual.totals[winner.id]} peer votes.`,
      'The gallery award is announced before the audience closes its ordinary ballot. All sixteen will continue.',
    ],
    [winner.id],
    host,
  );
  const evidence = ep.participantIds.map((id) => {
    const individual = ep.individualPhotos.find((entry) => entry.contestantId === id)!;
    const group = ep.groupPhotos
      .flatMap((entry) => entry.evaluations)
      .find((entry) => entry.contestantId === id)!;
    const finalScore = 0.6 * individual.finalScore + 0.4 * group.finalScore;
    return {
      contestantId: id,
      finalScore,
      observedScore: finalScore,
      reception: clampPhoto(finalScore + Math.min(10, ep.receptionBonuses[id])),
      category: ep.teams.find((entry) => entry.memberIds.includes(id))!.conceptId,
    };
  });
  const weights = Object.fromEntries(ep.participantIds.map((id) => [id, 2 + Math.min(2, ep.attention[id])]));
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const exposure = Object.fromEntries(ep.participantIds.map((id) => [id, weights[id] / total]));
  const result = resolveNarrativeEvidenceAudience({
    contestants: ep.participantIds.map((id) => person(state, id)),
    evidence,
    exposure,
    mood: state.runtime!.preparations![5]!.mood!,
    show: state.runtime!.show,
    random,
  });
  const tie = Object.fromEntries(ep.participantIds.map((id) => [id, random()]));
  ep.rankingTieKeys = tie;
  ep.sealedRankingScores = Object.fromEntries(
    result.contestants.map((entry) => [entry.id, entry.aggregations.rankingScore]),
  );
  ep.rankedIds = [...result.contestants]
    .sort(
      (a, b) =>
        b.aggregations.rankingScore - a.aggregations.rankingScore ||
        tie[a.id] - tie[b.id] ||
        a.id.localeCompare(b.id),
    )
    .map(({ id }) => id);
  // Keep the old visible points until Mike opens the sealed ranking.
  for (const contestant of result.contestants) {
    contestant.rank = person(state, contestant.id).rank;
    contestant.aggregations.rankingScore = person(state, contestant.id).aggregations.rankingScore;
  }
  const byId = new Map(result.contestants.map((entry) => [entry.id, entry]));
  state.contestants = state.contestants.map((entry) => byId.get(entry.id) ?? entry);
  state.runtime!.show = result.show;
  ep.audience = result.outcome;
}
function investigation(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const eligible = ep.participantIds.filter(
    (id) => !person(state, id).events.some((event) => event.startsWith('SECRET_REVEALED:')),
  );
  const available = eligible.some((id) =>
    person(state, id).attributes.some((attribute) =>
      Object.hasOwn(state.runtime!.definitions.cards.secret, attribute),
    ),
  );
  ep.secretCandidates = available ? shuffleWithRandom(eligible, random).slice(0, 3) : [];
  if (!ep.secretCandidates.length) {
    append(
      state,
      'secret-result',
      8,
      'The investigation desk is closed',
      [
        'No active unrevealed secret remains available. The investigation is skipped without a substitute award.',
      ],
      [],
      host,
      0,
    );
  } else {
    append(
      state,
      'secret-choice',
      8,
      'The three-person investigation shortlist',
      [
        'The audience result is sealed. Choose one of these randomly shortlisted performers for a secret check; a miss changes nothing.',
        ...ep.secretCandidates.map((id) => mention(id)),
        ...(ep.secretCandidates.length < 3
          ? ['Fewer than three eligible performers remain, so every eligible name is offered.']
          : []),
      ],
      ep.secretCandidates,
      host,
      0,
    );
  }
}
function revealRanking(state: SimulationState) {
  const ep = episode(state);
  ep.rankRevealed = true;
  const lines = ep.rankedIds.map((id, index) => {
    const contestant = person(state, id);
    const previous = ep.previousRankedIds.indexOf(id) + 1;
    const movement = previous - index - 1;
    contestant.rank = index + 1;
    contestant.aggregations.rankingScore = ep.sealedRankingScores[id];
    const individual = ep.individualPhotos.find((entry) => entry.contestantId === id)!;
    contestant.grade = individual.grade;
    contestant.missionRating = { A: 5, B: 4, C: 3, D: 2, F: 1 }[individual.grade];
    contestant.aggregations.happiness = clampPhoto(contestant.aggregations.happiness + Math.sign(movement));
    return `${index + 1}. ${mention(id)} ${
      movement > 0
        ? `↑ rises from ${previous}`
        : movement < 0
          ? `↓ falls from ${previous}`
          : `holds ${previous}`
    }. ${
      index >= 13
        ? 'The relief of staying is mixed with concern about Episode 6; nothing about next week is decided.'
        : movement > 0
          ? 'The news brings a relieved smile.'
          : movement < 0
            ? 'They take a breath and absorb the disappointment.'
            : 'They nod at the familiar place.'
    }`;
  });
  append(
    state,
    'ranking',
    8,
    'The sixteen-person standings',
    ['Mike opens the sealed cumulative ranking. No one is eliminated or asked to withdraw.', ...lines],
    ep.rankedIds,
    host,
  );
}
function advance(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  switch (ep.phase) {
    case 'dorms':
      playOpening(state, 5);
      append(
        state,
        'credits',
        2,
        'Opening credits',
        ['The confirmed opening portraits introduce a new week. Sixteen performers remain.'],
        state.runtime!.openingCast,
      );
      break;
    case 'credits':
      append(
        state,
        'briefing',
        3,
        'Four concepts, sixteen safe places',
        [
          '"This week is The Photoshoot. Nobody will be eliminated. You will make individual edits and four concept covers."',
          'The announcement finally lets the room breathe after the double departure.',
          ...ep.participantIds
            .slice(0, 3)
            .map(
              (id) =>
                `${mention(id)} ${
                  person(state, id).personality.sensitivity >= 5
                    ? 'lets their tense shoulders fall, visibly relieved'
                    : 'exhales and turns their attention to the concept boards'
                }.`,
            ),
          'The previous final top four will lead. They choose available concepts in rank order, then draft one through four for three rounds.',
        ],
        ep.participantIds.slice(0, 3),
        host,
      );
      break;
    case 'briefing':
      appointLeader(state, random);
      break;
    case 'concepts':
      if (ep.teams.length < 4) appointLeader(state, random);
      else draft(state, random);
      break;
    case 'draft':
      if (ep.draftPicks.length < 12) draft(state, random);
      else prepareStyling(state, random);
      break;
    case 'styling-result':
      if (ep.teamCursor < 3) {
        ep.teamCursor++;
        prepareStyling(state, random);
      } else individual(state, random);
      break;
    case 'individual':
      if (ep.individualCursor < 16) individual(state, random);
      else electCenter(state, random);
      break;
    case 'center':
      group(state, random);
      break;
    case 'group':
      if (ep.groupCursor < 4) electCenter(state, random);
      else gallery(state);
      break;
    case 'gallery':
      ballots(state, random);
      break;
    case 'ballots':
      awardAndLock(state, random);
      break;
    case 'ultimate-visual':
      investigation(state, random);
      break;
    case 'secret-result':
      revealRanking(state);
      break;
    case 'ranking':
      ep.survivorIds = [...ep.rankedIds];
      append(
        state,
        'complete',
        8,
        'The Photoshoot: sixteen continue',
        [
          ...ep.survivorIds.map((id, index) => `${index + 1}. ${mention(id)}.`),
          'All sixteen continue. Episode 5 is complete. Episode 6 is next and has not begun.',
        ],
        ep.survivorIds,
        host,
        0,
      );
      state.runtime!.phase = 'episode-complete';
      break;
    default:
      throw new Error('Choose the available Photoshoot action before continuing.');
  }
}
function capture(state: SimulationState, before: readonly Contestant[], cause: string, sceneId?: string) {
  const ep = episode(state);
  const scene = ep.scenes.at(-1);
  for (const id of ep.participantIds) {
    const changes = recordContestantChanges(
      before.find((entry) => entry.id === id)!,
      person(state, id),
      cause,
    );
    ep.changes[id] ??= [];
    ep.changes[id].push(...changes);
    if (scene && scene.id !== sceneId && changes.length) {
      scene.contestantChanges ??= {};
      scene.contestantChanges[id] = structuredClone(changes);
    }
  }
}
function finalize(state: SimulationState, random: ReturnType<typeof createSeededRandom>) {
  state.runtime!.randomState = random.getState();
  freezeSimulationSnapshot(state.runtime!.initialContestants);
  freezeSimulationSnapshot(state.runtime!.sourceContestants);
  freezeSimulationSnapshot(state.runtime!.definitions);
  if (state.runtime!.photoshoot) freezeSimulationSnapshot(state.runtime!.photoshoot.startingContestants);
  validatePhotoshoot(state);
  state.persistenceError = null;
  return state;
}
export function transitionPhotoshoot(
  current: SimulationState,
  action: PhotoshootAction,
  expectedRevision: number,
): SimulationState {
  return awardNewActivity(current, transitionInternal(current, action, expectedRevision));
}
function transitionInternal(current: SimulationState, action: PhotoshootAction, revision: number) {
  const runtime = current.runtime;
  if (runtime?.version !== 3 || current.status !== 'ready' || runtime.megaGroups?.phase !== 'complete')
    throw new Error('Complete Mega Groups in a current-format season before the Photoshoot.');
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new Error('A valid Photoshoot revision is required.');
  const old = runtime.photoshoot;
  const prep = runtime.preparations?.[5];
  if (!old) {
    if (!prep) {
      if (action.type !== 'start' || revision !== 0) throw new Error('Start Episode 5 preparation first.');
      const next = structuredClone(current);
      const random = createSeededRandom(runtime.randomState);
      initializePreparation(next, 5, random.next);
      return finalize(next, random);
    }
    if (
      (action.type === 'start' && revision === 0 && prep.revision === 0) ||
      (prep.lastAction?.revision === revision &&
        JSON.stringify(prep.lastAction.action) === JSON.stringify(action))
    )
      return current;
    if (revision !== prep.revision) throw new Error('This Photoshoot opening preparation action is stale.');
    if (action.type !== 'mood' && action.type !== 'opening-cast' && action.type !== 'randomize-mood')
      throw new Error('Confirm the opening mood and replacement cast first.');
    const next = structuredClone(current);
    const random = createSeededRandom(runtime.randomState);
    const before = structuredClone(next.contestants);
    applyPreparation(next, action, random.next);
    const nextPrep = next.runtime!.preparations![5]!;
    nextPrep.revision++;
    nextPrep.lastAction = { revision, action: structuredClone(action) };
    if (nextPrep.mood && !nextPrep.requiredSelections) {
      start(next);
      capture(next, before, 'Photoshoot: after the double departure');
    }
    return finalize(next, random);
  }
  if (
    (old.lastAction.revision === revision &&
      JSON.stringify(old.lastAction.action) === JSON.stringify(action)) ||
    (prep?.lastAction?.revision === revision &&
      JSON.stringify(prep.lastAction.action) === JSON.stringify(action))
  )
    return current;
  if (old.revision !== revision) throw new Error('This Photoshoot action is stale; reload the episode.');
  if (old.phase === 'complete') throw new Error('The Photoshoot is complete.');
  assertPhotoshootEpisode(old, current.contestants, runtime.definitions);
  const next = structuredClone(current);
  const random = createSeededRandom(runtime.randomState);
  const before = structuredClone(next.contestants);
  const ep = episode(next);
  ep.revision++;
  ep.lastAction = { revision, action: structuredClone(action) };
  if (action.type === 'styling') {
    if (ep.phase !== 'styling-choice' || !['intervene', 'self-style'].includes(action.choice))
      throw new Error('No Photoshoot styling decision is available.');
    style(next, action.choice);
  } else if (action.type === 'secret') {
    if (ep.phase !== 'secret-choice' || !ep.secretCandidates.includes(action.contestantId))
      throw new Error('Choose an eligible Photoshoot secret candidate.');
    const result = revealAuditionSecret(next.contestants, action.contestantId, next.runtime!.definitions);
    next.contestants = result.contestants;
    ep.secret = result.result;
    next.runtime!.deferredConsequences.push(...result.result.deferred);
    if (result.result.cardId)
      next.runtime!.revealedSecrets.push({ contestantId: action.contestantId, cardId: result.result.cardId });
    append(
      next,
      'secret-result',
      8,
      result.result.title,
      [
        `${mention(action.contestantId)}: ${result.result.description}`,
        'The sealed audience result and all sixteen continuing places are unchanged.',
      ],
      [action.contestantId],
      undefined,
      result.result.cardId ? 6 : 0,
    );
  } else if (action.type === 'advance') advance(next, random.next);
  else throw new Error('Only the current Photoshoot story action is available.');
  capture(next, before, `Photoshoot: ${old.phase}`, old.scenes.at(-1)?.id);
  if (ep.phase === 'complete') {
    next.contestants = next.contestants.map((contestant) =>
      !ep.participantIds.includes(contestant.id)
        ? contestant
        : appendContestantHistory(
            contestant,
            {
              episode: 5,
              phaseId: `${runtime.runId}:photoshoot:complete`,
              rank: contestant.rank,
              status: contestant.status,
              score: contestant.aggregations.rankingScore,
              missionRating: contestant.missionRating,
              summary: 'The Photoshoot completed; all sixteen continue.',
              events: contestant.events.filter((event) => event.startsWith('PHOTOSHOOT_')),
            },
            ep.changes[contestant.id] ?? [],
          ),
    );
  }
  return finalize(next, random);
}
