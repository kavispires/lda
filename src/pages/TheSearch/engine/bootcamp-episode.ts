import type { EpisodeScene } from '../types/audition-episode';
import type { BootcampAction, BootcampEpisode, BootcampPhase } from '../types/bootcamp-episode';
import type { Contestant } from '../types/contestant';
import type { SimulationState } from '../types/simulation';
import { freezeSimulationSnapshot } from '../utilities/simulation-definitions';
import { chooseBootcampMvp, closeBootcampAudience } from './bootcamp-audience';
import {
  bootcampWinner,
  bootcampWinningGroup,
  scoreBootcampGroup,
  scoreBootcampPair,
} from './bootcamp-scoring';
import { assertBootcampEpisode } from './bootcamp-validation';
import { appendContestantHistory, recordContestantChanges } from './change-history';
import { applyPreparation, initializePreparation, playOpening } from './episode-preparation';
import { createSeededRandom, type RandomSource, shuffleWithRandom } from './random';

export const BOOTCAMP_CHALLENGES = [
  'The Marathon Mic',
  'The Action Sequence',
  'The Distraction Box',
  'The Sync Gauntlet',
];
const descriptions = [
  'Two teammates run on side-by-side treadmills while sustaining a vocal note or rap verse. Stamina, consistency and breath control matter.',
  'Two teammates tackle a supervised obstacle course and finish with a synchronized trampoline pose. Acrobatics and partner timing matter; safety comes before bravado.',
  'The remaining pair learns fast hand choreography, then holds the rhythm through lights, sounds, cold air and a sudden music cut. Consistency and learning matter.',
  'All six perform a repetitive dance break in a shallow, supervised splash area. One missed beat resets the group. Miller stops the exercise after five resets if assistance is needed.',
];
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const mention = (id: string) => `{{${encodeURIComponent(id)}}}`;

function episode(state: SimulationState): BootcampEpisode {
  if (!state.runtime?.bootcamp) throw new Error('Start Boot Camp first.');
  return state.runtime.bootcamp;
}
function member(state: SimulationState, id: string): Contestant {
  const person = state.contestants.find((entry) => entry.id === id);
  if (!person) throw new Error(`Unknown Boot Camp contestant "${id}".`);
  return person;
}
function affinity(person: Contestant, id: string): number {
  return person.relationships[id]?.at(-1) ?? 50;
}
function relationship(state: SimulationState, observer: string, target: string, delta: number) {
  if (observer === target) throw new Error('Boot Camp cannot change a self-relationship.');
  const person = member(state, observer);
  person.relationships[target] ??= [50];
  person.relationships[target].push(clamp(affinity(person, target) + delta));
}
function eventText(state: SimulationState, narrative: string, ids: readonly string[]): string {
  let cursor = 0;
  const parts: string[] = [];
  for (const id of ids) {
    const name = member(state, id).name;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'gu');
    pattern.lastIndex = cursor;
    const match = pattern.exec(narrative);
    if (!match) throw new Error('A Boot Camp event mention does not match its recorded text.');
    parts.push(narrative.slice(cursor, match.index), mention(id));
    cursor = match.index + name.length;
  }
  return parts.join('') + narrative.slice(cursor);
}
function append(
  state: SimulationState,
  phase: BootcampPhase,
  sequence: number,
  title: string,
  paragraphs: string[],
  ids: string[] = [],
  speaker?: EpisodeScene['speaker'],
) {
  const ep = episode(state);
  ep.phase = phase;
  const refs: string[][] = [];
  const text = paragraphs.map((paragraph) => {
    const found: string[] = [];
    const result = paragraph.replace(/\{\{([^{}]+)\}\}/g, (_, encoded: string) => {
      const id = decodeURIComponent(encoded);
      found.push(id);
      return member(state, id).name;
    });
    refs.push(found);
    return result;
  });
  ep.scenes.push({
    id: `bootcamp-${ep.scenes.length}`,
    kind: phase === 'ranking' ? 'ranking' : 'recap',
    sequence,
    title,
    paragraphs: text,
    contestantIds: [...new Set(ids)],
    paragraphContestantIds: refs,
    presentation: speaker ? 'host' : 'performance',
    ...(speaker ? { speaker } : {}),
  });
}
const host = { name: 'Mike Philip', role: 'Host' };
const trainer = { name: 'Sargent Miller', role: 'Boot Camp trainer' };

function showDorm(state: SimulationState) {
  const ep = episode(state);
  const rooms = state.runtime!.battle!.rooms.filter((room) =>
    room.memberIds.some((id) => ep.participantIds.includes(id)),
  );
  const room = rooms[ep.roomCursor++];
  if (!room) throw new Error('No occupied dorm remains.');
  const ids = room.memberIds.filter((id) => ep.participantIds.includes(id));
  const empty = room.memberIds.length - ids.length;
  const paragraphs = [
    `${empty} empty ${empty === 1 ? 'bed marks' : 'beds mark'} the teammates who left after The Battles.`,
  ];
  for (const id of ids) {
    const person = member(state, id);
    const p = person.personality;
    const delta = p.extroversion >= 5 ? -empty : p.extroversion <= -5 ? empty : 0;
    const before = person.aggregations.happiness;
    person.aggregations.happiness = clamp(before + delta);
    const lostFriend = room.memberIds.some(
      (other) => !ep.participantIds.includes(other) && affinity(person, other) >= 60,
    );
    const harsh = p.ambition >= 5 && p.gentleness <= -5;
    const opinion = lostFriend
      ? 'The empty beds hurt. Losing an entire team meant losing people I cared about.'
      : harsh
        ? 'A whole team can disappear. Sentiment will not win me a place; I have to be stronger.'
        : p.gentleness >= 5 || p.maturity >= 5
          ? 'People worked hard and still went home together. We should look after whoever is left.'
          : p.sensitivity >= 5
            ? 'After that elimination, I cannot stop wondering whether I will be next.'
            : p.resilience >= 5
              ? 'It was brutal. I am still here, and I need to keep moving.'
              : 'We watched entire teams leave. Everything feels different this morning.';
    paragraphs.push(
      `${mention(id)}: "${opinion}"${before !== person.aggregations.happiness ? ` The quiet room changes happiness ${before} → ${person.aggregations.happiness}.` : ''}`,
    );
    const reactions: { id: string; delta: number; before: number; after: number }[] = [];
    for (const observer of ids.filter((other) => other !== id)) {
      const listener = member(state, observer);
      const agrees = harsh
        ? listener.personality.ambition >= 5 && listener.personality.gentleness < 5
        : listener.personality.gentleness >= 5 ||
          listener.personality.maturity >= 5 ||
          affinity(listener, id) >= 55;
      const disagrees = harsh && (listener.personality.gentleness >= 5 || listener.personality.maturity >= 5);
      const change = agrees ? 1 : disagrees ? -1 : 0;
      if (change) {
        const old = affinity(listener, id);
        relationship(state, observer, id, change);
        reactions.push({ id: observer, delta: change, before: old, after: affinity(listener, id) });
      }
    }
    for (const reaction of reactions.slice(0, 1))
      paragraphs.push(
        `Reaction: ${mention(reaction.id)} ${reaction.delta > 0 ? 'finds reassurance in' : 'recoils from'} ${mention(id)}'s words; relationship ${reaction.before} → ${reaction.after}.`,
      );
  }
  append(
    state,
    'dorms',
    1,
    `Room ${state.runtime!.battle!.rooms.indexOf(room) + 1}: empty beds`,
    paragraphs,
    ids,
  );
}

function createGroups(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const shuffled = shuffleWithRandom(ep.participantIds, random);
  ep.groups = [0, 1, 2].map((index) => ({
    id: `Group ${String.fromCharCode(65 + index)}`,
    memberIds: shuffled.slice(index * 6, index * 6 + 6),
    pairs: [],
    ballots: {},
    tieKeys: {},
  }));
  const paragraphs: string[] = [];
  for (const group of ep.groups) {
    paragraphs.push(`${group.id}: ${group.memberIds.map(mention).join(', ')}.`);
    const highlights: string[] = [];
    for (const observer of group.memberIds) {
      const person = member(state, observer);
      const p = person.personality;
      for (const target of group.memberIds.filter((id) => id !== observer)) {
        const before = affinity(person, target);
        const disposition = (before - 50) / 5 + p.gentleness + p.maturity - p.sensitivity - p.ambition;
        relationship(state, observer, target, disposition >= 0 ? 1 : -1);
        if (Math.abs(before - 50) >= 5 && highlights.length < 2)
          highlights.push(
            `Reaction: ${mention(observer)} ${disposition >= 0 ? 'welcomes' : 'feels tense about'} sharing a group with ${mention(target)}; relationship ${before} → ${affinity(person, target)}.`,
          );
      }
    }
    paragraphs.push(...highlights);
  }
  append(state, 'groups', 3, 'Three groups, chosen by chance', paragraphs, ep.participantIds);
}

function ballot(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const group = ep.groups[ep.groupCursor++];
  const used = new Set(group.pairs.flat());
  const eligible = group.memberIds.filter((id) => !used.has(id));
  const ballots: Record<string, string[]> = {};
  const ties = Object.fromEntries(eligible.map((id) => [id, random()]));
  const totals = Object.fromEntries(eligible.map((id) => [id, 0]));
  const strength = (id: string) => {
    const person = member(state, id);
    return [...Object.values(person.coreSkills), ...Object.values(person.utilitySkills)].reduce(
      (sum, value) => sum + value,
      0,
    );
  };
  const paragraphs = ['The exercise is still hidden. All six teammates must nominate two eligible members.'];
  if (ep.round === 3) {
    group.pairs.push(eligible);
    paragraphs.push(`Only ${eligible.map(mention).join(' and ')} remain eligible. There is no new ballot.`);
  } else {
    for (const voter of group.memberIds) {
      const person = member(state, voter);
      const p = person.personality;
      let chosen: string[];
      if (p.maturity >= 5) {
        const ordered = [...eligible].sort((a, b) => strength(b) - strength(a) || ties[a] - ties[b]);
        chosen = [ordered[0], ordered[ordered.length - 1]];
      } else {
        const preference = (target: string) =>
          affinity(person, target) / 10 +
          (target === voter ? p.ambition + p.extroversion - Math.max(0, p.gentleness) : 0);
        chosen = [...eligible].sort((a, b) => preference(b) - preference(a) || ties[a] - ties[b]).slice(0, 2);
      }
      ballots[voter] = chosen;
      chosen.forEach((id) => {
        totals[id]++;
      });
      paragraphs.push(
        `${mention(voter)} nominates ${chosen.map(mention).join(' and ')}${p.maturity >= 5 ? ', trying to balance stronger and less experienced teammates' : chosen.includes(voter) ? ', putting themself forward' : ', trusting those teammates with an unknown test'}.`,
      );
    }
    const chosen = [...eligible].sort((a, b) => totals[b] - totals[a] || ties[a] - ties[b]).slice(0, 2);
    group.pairs.push(chosen);
    group.ballots[String(ep.round)] = ballots;
    group.tieKeys[String(ep.round)] = ties;
    paragraphs.push(
      `The vote selects ${chosen.map(mention).join(' and ')}. ${chosen.map((id) => `${mention(id)} receives ${totals[id]} votes`).join('; ')}.`,
    );
    const frustrated = eligible.find(
      (id) => !chosen.includes(id) && member(state, id).personality.ambition >= 5,
    );
    const planner = group.memberIds.find(
      (id) =>
        id !== frustrated &&
        member(state, id).personality.maturity >= 5 &&
        !ballots[id].includes(frustrated ?? ''),
    );
    if (frustrated && planner) {
      relationship(state, frustrated, planner, -1);
      paragraphs.push(
        `Reaction: ${mention(frustrated)} wanted to step up and resents ${mention(planner)}'s balancing argument; relationship falls to ${affinity(member(state, frustrated), planner)}.`,
      );
    }
  }
  append(
    state,
    'ballots',
    ep.round + 3,
    `${group.id}: blind selection ${ep.round}`,
    paragraphs,
    group.memberIds,
  );
}

function reveal(state: SimulationState) {
  const ep = episode(state);
  ep.groupCursor = 0;
  append(
    state,
    'reveal',
    ep.round + 3,
    BOOTCAMP_CHALLENGES[ep.round - 1],
    [
      descriptions[ep.round - 1],
      ...ep.groups.map(
        (group) =>
          `${group.id} sends ${(ep.round === 4 ? group.memberIds : group.pairs[ep.round - 1]).map(mention).join(', ')}.`,
      ),
    ],
    ep.participantIds,
    trainer,
  );
}

function perform(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  const group = ep.groups[ep.groupCursor++];
  const ids = ep.round === 4 ? group.memberIds : group.pairs[ep.round - 1];
  const contestants = ids.map((id) => member(state, id));
  const result =
    ep.round === 4
      ? scoreBootcampGroup(
          contestants,
          ep.evaluations.filter((entry) => entry.round < 4),
          group.id,
          random,
        )
      : { evaluations: scoreBootcampPair(contestants, ep.round, random), result: null };
  ep.evaluations.push(...result.evaluations);
  if (result.result) ep.groupResults.push(result.result);
  const paragraphs: string[] = [];
  for (const evaluation of result.evaluations) {
    const person = member(state, evaluation.contestantId);
    if (evaluation.fatigue > 0 && ['STABLE', 'HEALTHY', 'CONFIDENT'].includes(person.condition))
      person.condition = 'TIRED';
    paragraphs.push(
      `${mention(person.id)} completes the assessment with ${evaluation.finalScore.toFixed(1)}/100${ep.round === 4 ? ` after carrying ${evaluation.fatigue} fatigue` : ''}.`,
    );
    for (const event of evaluation.events) {
      for (const change of event.relationships)
        relationship(state, change.observerId, change.targetId, change.delta);
      const tag = `BOOTCAMP_${event.kind.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
      if (!person.events.includes(tag)) person.events.push(tag);
      // Event prose comes from the recorded scoring evidence, not invented reactions.
      paragraphs.push(eventText(state, event.narrative, event.contestantIds));
    }
    const priorBase = ep.round === 4 ? 1 : 0;
    const usedSpotlights = Math.max(0, ep.exposure[person.id] - priorBase);
    const extra = Math.min(
      Math.max(0, 2 - usedSpotlights),
      evaluation.events.reduce((sum, event) => sum + event.spotlight, 0),
    );
    ep.exposure[person.id] += 1 + extra;
  }
  if (result.result)
    paragraphs.push(
      `${group.id} finishes ${result.result.assisted ? 'with Miller’s assistance' : 'in synchronized time'} after ${result.result.resets} resets. Group result: ${result.result.score.toFixed(1)}/100.`,
    );
  append(
    state,
    'performance',
    ep.round + 3,
    `${group.id}: ${BOOTCAMP_CHALLENGES[ep.round - 1]}`,
    paragraphs,
    ids,
  );
  episode(state).scenes.at(-1)!.dialogues = [
    {
      ...trainer,
      paragraphs: result.evaluations.map(
        (evaluation) =>
          `${member(state, evaluation.contestantId).name}, ${
            evaluation.finalScore >= 75
              ? 'you kept control when the pressure rose. That is the standard I am looking for.'
              : evaluation.finalScore >= 50
                ? 'you found some control, but the uneven moments still showed. Keep working on the timing.'
                : 'the pressure exposed gaps today. A difficult assessment is information you can use, not a reason to stop trying.'
          }`,
      ),
      paragraphContestantIds: result.evaluations.map((evaluation) => [evaluation.contestantId]),
    },
  ];
}

function winner(state: SimulationState) {
  const ep = episode(state);
  const id = bootcampWinner(ep.evaluations.filter((entry) => entry.round === ep.round));
  ep.winners.push(id);
  const person = member(state, id);
  person.aggregations.audienceRatio = Math.min(1, person.aggregations.audienceRatio + 0.05);
  const paragraphs = [
    `${mention(id)} is the individual winner. Their audience preference rises, and five continuing-score points will be included in the closing ranking.`,
  ];
  if (ep.round === 4) {
    ep.winningGroupId = bootcampWinningGroup(ep.groups, ep.groupResults, ep.evaluations);
    paragraphs.push(
      `${ep.winningGroupId} wins the full-group challenge. The individual award considers all eighteen contestants, independently of the group result.`,
    );
  }
  append(state, 'winner', ep.round + 3, 'Miller announces the result', paragraphs, [id], trainer);
}

function start(state: SimulationState) {
  const runtime = state.runtime!;
  const ids = runtime.battle!.survivorIds;
  runtime.bootcamp = {
    version: 1,
    phase: 'dorms',
    revision: 0,
    lastAction: { revision: 0, action: { type: 'start' } },
    participantIds: [...ids],
    previousRankedIds: [...ids],
    groups: [],
    round: 1,
    roomCursor: 0,
    groupCursor: 0,
    evaluations: [],
    groupResults: [],
    winners: [],
    winningGroupId: null,
    scoreAwardsApplied: false,
    exposure: Object.fromEntries(ids.map((id) => [id, 0])),
    audience: null,
    mvp: null,
    rankedIds: [],
    rankRevealed: false,
    initialState: Object.fromEntries(
      ids.map((id) => {
        const person = member(state, id);
        return [id, { condition: person.condition, practice: person.aggregations.practice }];
      }),
    ),
    startingContestants: structuredClone(state.contestants),
    scenes: [],
    changes: {},
  };
  runtime.episode = 3;
  runtime.phase = 'bootcamp';
  showDorm(state);
}

function advance(state: SimulationState, random: RandomSource) {
  const ep = episode(state);
  switch (ep.phase) {
    case 'dorms': {
      const occupied = state.runtime!.battle!.rooms.filter((room) =>
        room.memberIds.some((id) => ep.participantIds.includes(id)),
      ).length;
      if (ep.roomCursor < occupied) showDorm(state);
      else {
        playOpening(state, 3);
        append(
          state,
          'credits',
          2,
          'Opening credits',
          ['Eighteen voices. One uncertain next step.'],
          state.runtime!.openingCast,
        );
      }
      break;
    }
    case 'credits':
      append(
        state,
        'briefing',
        3,
        'Meet Sargent Miller',
        [
          'Today we leave the stage for Boot Camp. Sargent Miller will assess how you perform under pressure.',
          'You will be randomly divided into three groups of six. For each of the first three tests, two different teammates will step forward. Your entire group takes the fourth test.',
          'Your team will choose the first two pairs before learning what each exercise involves. Nobody can repeat; the last pair is determined automatically. Your results will count toward the continuing ranking.',
        ],
        [],
        host,
      );
      break;
    case 'briefing':
      createGroups(state, random);
      break;
    case 'groups':
      ballot(state, random);
      break;
    case 'ballots':
      if (ep.groupCursor < 3) ballot(state, random);
      else reveal(state);
      break;
    case 'reveal':
      perform(state, random);
      break;
    case 'performance':
      if (ep.groupCursor < 3) perform(state, random);
      else winner(state);
      break;
    case 'winner':
      if (ep.round < 4) {
        ep.round++;
        ep.groupCursor = 0;
        if (ep.round === 4) reveal(state);
        else ballot(state, random);
      } else {
        closeBootcampAudience(state, random);
        for (const id of ep.participantIds) {
          const person = member(state, id);
          person.condition = ep.initialState[id].condition;
          person.aggregations.practice = ep.initialState[id].practice;
        }
        append(
          state,
          'relief',
          8,
          'An unexpected announcement',
          [
            'All eighteen of you are staying. Today was an assessment, not an elimination.',
            'Your performances and public support still count toward the continuing ranking. The bottom places will matter on the next elimination night.',
            ...ep.groups.map(
              (group) =>
                `${group.memberIds.map(mention).join(', ')} can finally breathe again: everyone in ${group.id} is safe tonight.`,
            ),
          ],
          ep.participantIds,
          host,
        );
      }
      break;
    case 'relief':
      chooseBootcampMvp(state, random);
      append(
        state,
        'mvp',
        8,
        'The Boot Camp peer MVP',
        [
          `The eighteen contestants have voted. ${mention(ep.mvp!.winnerId)} is their peer MVP, with ${ep.mvp!.totals[ep.mvp!.winnerId]} votes.`,
        ],
        [ep.mvp!.winnerId],
        host,
      );
      break;
    case 'mvp': {
      ep.rankRevealed = true;
      const standings = ep.rankedIds.map((id, index) => {
        const old = ep.previousRankedIds.indexOf(id) + 1;
        return `${index + 1}. ${mention(id)}${old !== index + 1 ? `, ${old > index + 1 ? 'up' : 'down'} from ${old}` : ', holding their place'}.`;
      });
      const reactions: { movement: number; text: string }[] = [];
      for (const [index, id] of ep.rankedIds.entries()) {
        const person = member(state, id);
        person.rank = index + 1;
        const movement = ep.previousRankedIds.indexOf(id) - index;
        const delta = Math.sign(movement);
        person.aggregations.happiness = clamp(person.aggregations.happiness + delta);
        if (movement) {
          const response =
            movement > 0
              ? person.personality.ambition >= 5
                ? 'allows a brief smile, then fixes their attention on the places still above them'
                : 'lets out a relieved breath as the improvement sinks in'
              : person.personality.sensitivity >= 5
                ? 'struggles to hide their disappointment at slipping down the list'
                : 'takes the fall in position quietly and resolves to answer it at the next challenge';
          reactions.push({ movement: Math.abs(movement), text: `${mention(id)} ${response}.` });
        }
        if (index) {
          const above = ep.rankedIds[index - 1];
          const p = person.personality;
          const disposition =
            (affinity(person, above) - 50) / 5 + p.gentleness + p.maturity - p.sensitivity - p.ambition;
          const shift = clamp(Math.round(disposition / 10), -2, 2);
          relationship(state, id, above, shift);
          if (shift && Math.abs(movement) > 0) {
            reactions.push({
              movement: Math.abs(movement),
              text:
                shift > 0
                  ? `${mention(id)} acknowledges ${mention(above)} with a small, respectful nod; seeing them just ahead strengthens that respect.`
                  : `${mention(id)} looks toward ${mention(above)}, now immediately ahead, and the comparison adds a little resentment.`,
            });
          }
        }
      }
      append(
        state,
        'ranking',
        8,
        'The continuing ranking',
        [
          ...standings,
          ...reactions
            .sort((a, b) => b.movement - a.movement)
            .slice(0, 4)
            .map((reaction) => reaction.text),
        ],
        ep.rankedIds,
        host,
      );
      break;
    }
    case 'ranking':
      append(
        state,
        'complete',
        8,
        'Boot Camp ends',
        [
          'Eighteen contestants leave the training ground with new confidence, bruised pride, and a ranking that will matter next time.',
        ],
        ep.participantIds,
      );
      state.runtime!.phase = 'episode-complete';
      break;
    default:
      throw new Error('Boot Camp is complete.');
  }
}

function capture(state: SimulationState, before: readonly Contestant[], cause: string) {
  const ep = episode(state);
  for (const id of ep.participantIds) {
    const previous = before.find((person) => person.id === id);
    if (!previous) throw new Error('A Boot Camp history snapshot is missing.');
    const changes = recordContestantChanges(previous, member(state, id), cause);
    ep.changes[id] ??= [];
    ep.changes[id].push(...changes);
  }
}
function finalize(state: SimulationState, random: ReturnType<typeof createSeededRandom>) {
  const runtime = state.runtime!;
  runtime.randomState = random.getState();
  freezeSimulationSnapshot(runtime.initialContestants);
  freezeSimulationSnapshot(runtime.sourceContestants);
  freezeSimulationSnapshot(runtime.definitions);
  if (runtime.bootcamp) {
    freezeSimulationSnapshot(runtime.bootcamp.startingContestants);
    assertBootcampEpisode(runtime.bootcamp, state.contestants, runtime.definitions);
  }
  state.persistenceError = null;
  return state;
}

export function transitionBootcamp(
  current: SimulationState,
  action: BootcampAction,
  revision: number,
): SimulationState {
  const runtime = current.runtime;
  if (!runtime || runtime.version !== 3 || current.status !== 'ready' || runtime.battle?.phase !== 'complete')
    throw new Error('Complete The Battles in a current-format season before Boot Camp.');
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new Error('A valid Boot Camp revision is required.');
  const old = runtime.bootcamp;
  const prep = runtime.preparations?.[3];
  if (!old) {
    if (!prep) {
      if (action.type !== 'start' || revision !== 0) throw new Error('Start Episode 3 preparation first.');
      const next = structuredClone(current);
      const random = createSeededRandom(runtime.randomState);
      initializePreparation(next, 3, random.next);
      return finalize(next, random);
    }
    if (
      (action.type === 'start' && revision === 0 && prep.revision === 0) ||
      (prep.lastAction?.revision === revision &&
        JSON.stringify(prep.lastAction.action) === JSON.stringify(action))
    )
      return current;
    if (revision !== prep.revision) throw new Error('This opening preparation action is stale.');
    if (action.type !== 'mood' && action.type !== 'opening-cast' && action.type !== 'randomize-mood')
      throw new Error('Confirm the opening mood and replacement cast first.');
    const next = structuredClone(current);
    const random = createSeededRandom(runtime.randomState);
    const before = structuredClone(next.contestants);
    applyPreparation(next, action, random.next);
    const nextPrep = next.runtime!.preparations![3]!;
    nextPrep.revision++;
    nextPrep.lastAction = { revision, action: structuredClone(action) };
    if (nextPrep.mood && !nextPrep.requiredSelections) {
      start(next);
      capture(next, before, 'Boot Camp: dorm arrival');
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
  if (old.revision !== revision) throw new Error('This Boot Camp action is stale; reload the episode.');
  if (old.phase === 'complete') throw new Error('Boot Camp is complete.');
  if (action.type !== 'advance') throw new Error('Only continuing is available at this beat.');
  assertBootcampEpisode(old, current.contestants, runtime.definitions);
  const next = structuredClone(current);
  const random = createSeededRandom(runtime.randomState);
  const before = structuredClone(next.contestants);
  const ep = episode(next);
  ep.revision++;
  ep.lastAction = { revision, action: structuredClone(action) };
  advance(next, random.next);
  capture(next, before, `Boot Camp: ${old.phase}`);
  if (ep.phase === 'complete') {
    next.contestants = next.contestants.map((person) =>
      !ep.participantIds.includes(person.id)
        ? person
        : appendContestantHistory(
            person,
            {
              episode: 3,
              phaseId: `${runtime.runId}:bootcamp:complete`,
              rank: person.rank,
              status: person.status,
              score: person.aggregations.score,
              missionRating: person.missionRating,
              summary: 'Boot Camp completed.',
              events: person.events.filter((event) => event.startsWith('BOOTCAMP_')),
            },
            ep.changes[person.id] ?? [],
          ),
    );
  }
  return finalize(next, random);
}
