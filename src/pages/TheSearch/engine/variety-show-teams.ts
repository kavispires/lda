import type { Contestant } from '../types/contestant';
import type { VarietyShowTeam } from '../types/variety-show-episode';
import { battleRelationship } from './battle-scoring';
import { electVersatilityRole } from './versatility-rehearsal';

export function createVarietyShowTeams(
  drawOrder: readonly string[],
  people: readonly Contestant[],
): VarietyShowTeam[] {
  if (
    drawOrder.length !== 12 ||
    new Set(drawOrder).size !== 12 ||
    people.length !== 12 ||
    people.some((person) => !drawOrder.includes(person.id))
  )
    throw new Error('A blind Variety Show draw requires twelve unique participants.');
  return ['Red', 'Blue', 'Yellow'].map((name, index) => {
    const memberIds = drawOrder.slice(index * 4, index * 4 + 4);
    const members = memberIds.map((id) => people.find((person) => person.id === id)!);
    const pairs = members
      .flatMap((first, i) =>
        members.slice(i + 1).map((second) => ({
          contestantIds: [first.id, second.id] as [string, string],
          gap: Math.abs(first.personality.ambition - second.personality.ambition),
        })),
      )
      .filter((pair) => pair.gap >= 10)
      .sort((a, b) => b.gap - a.gap);
    return {
      id: `variety-${index + 1}`,
      name: `${name} Team`,
      memberIds,
      leaderId: null,
      leaderElection: null,
      leaderContestants: [],
      ambitionClash: pairs[0] ?? null,
      preparation: null,
    };
  });
}

export function electVarietyShowLeader(members: readonly Contestant[], tieKeys: Record<string, number>) {
  return electVersatilityRole(members, 'leader', tieKeys);
}

export function varietyShowConflict(members: readonly Contestant[]): [string, string] | null {
  for (const first of members)
    for (const second of members) {
      if (first.id >= second.id) continue;
      const strained =
        Math.min(battleRelationship(first, second.id), battleRelationship(second, first.id)) < 40;
      const incompatible =
        (first.personality.curiosity >= 5 &&
          second.personality.discipline >= 5 &&
          second.personality.curiosity <= -5) ||
        (second.personality.curiosity >= 5 &&
          first.personality.discipline >= 5 &&
          first.personality.curiosity <= -5);
      if (
        incompatible ||
        (strained && (first.personality.gentleness <= -5 || second.personality.gentleness <= -5))
      )
        return [first.id, second.id];
    }
  return null;
}

export function varietyShowIdeas(members: readonly Contestant[]) {
  const pair = varietyShowConflict(members);
  return members.map((member, i) => ({
    contestantId: member.id,
    description:
      member.id === pair?.[0]
        ? 'Change the prop’s purpose halfway through and let the next entrant discover the surprise.'
        : member.id === pair?.[1]
          ? 'Keep the prop’s purpose fixed and repeat the agreed cue before every entrance.'
          : i === 0
            ? 'Establish the ordinary task before introducing the misplaced object.'
            : i === 1
              ? 'Give the prop a surprising but harmless new purpose.'
              : i === 2
                ? 'Repeat a clear cue so the next person knows when to enter.'
                : 'Bring back the first object in the final exchange to close the scene.',
  }));
}

export function varietyShowConflictDescription(members: readonly Contestant[]): string | null {
  const pair = varietyShowConflict(members);
  if (!pair) return null;
  return `${members.find((member) => member.id === pair[0])!.name} proposes changing the prop's purpose mid-scene; ${members.find((member) => member.id === pair[1])!.name} insists on fixed entrances and a repeated prop cue. They cannot yet agree on the handoff.`;
}
