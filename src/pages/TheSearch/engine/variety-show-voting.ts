import type { Contestant } from '../types/contestant';
import type { VarietyShowIcebreaker, VarietyShowIceCategory } from '../types/variety-show-episode';
import { battleRelationship, changeBattleRelationship, clampBattle } from './battle-scoring';
import type { RandomSource } from './random';

export const varietyIceCategories = [
  { id: 'model', label: 'Model', stat: (p: Contestant) => p.coreSkills.visual },
  {
    id: 'girlfriend',
    label: 'Find a girlfriend',
    stat: (p: Contestant) => p.personality.gentleness + p.personality.extroversion,
  },
  { id: 'marry', label: 'Marry first', stat: (p: Contestant) => p.personality.maturity },
  { id: 'rich', label: 'Be rich', stat: (p: Contestant) => p.personality.ambition },
  { id: 'smartest', label: 'Smartest', stat: (p: Contestant) => p.personality.discipline },
  { id: 'creative', label: 'Creative', stat: (p: Contestant) => p.personality.curiosity },
  { id: 'sincere', label: 'Sincere', stat: (p: Contestant) => p.personality.sincerity },
  {
    id: 'best-person',
    label: 'Best Person',
    stat: (p: Contestant) => Object.values(p.personality).reduce((a, b) => a + b, 0),
  },
] as const;

export function resolveVarietyIceCategory(
  people: readonly Contestant[],
  index: number,
  ties: VarietyShowIceCategory['ties'],
): VarietyShowIceCategory {
  const category = varietyIceCategories[index];
  if (!category || people.length !== 12 || new Set(people.map((person) => person.id)).size !== 12)
    throw new Error('Icebreaker requires the actual twelve participants and a valid category.');
  const ids = people.map((person) => person.id);
  const statValues = Object.fromEntries(people.map((person) => [person.id, category.stat(person)]));
  const tie = (keys: Record<string, number>, a: string, b: string) => keys[a] - keys[b] || a.localeCompare(b);
  const shortlistIds = [...ids]
    .sort((a, b) => statValues[b] - statValues[a] || tie(ties.shortlist, a, b))
    .slice(0, 5);
  const ballots = Object.fromEntries(
    people.map((voter) => [
      voter.id,
      shortlistIds
        .filter((id) => id !== voter.id)
        .sort(
          (a, b) =>
            battleRelationship(voter, b) - battleRelationship(voter, a) || tie(ties.ballots[voter.id], a, b),
        )[0],
    ]),
  );
  const totals = Object.fromEntries(
    shortlistIds.map((id) => [id, Object.values(ballots).filter((vote) => vote === id).length]),
  );
  const winnerId = [...shortlistIds].sort((a, b) => totals[b] - totals[a] || tie(ties.result, a, b))[0];
  return {
    id: category.id,
    label: category.label,
    statValues,
    shortlistIds,
    ballots,
    totals,
    winnerId,
    ties: structuredClone(ties),
    revealed: false,
  };
}

export function createVarietyIcebreaker(
  people: readonly Contestant[],
  random: RandomSource,
): VarietyShowIcebreaker {
  const frozenContestants = structuredClone([...people]);
  const keys = () => Object.fromEntries(people.map((person) => [person.id, random()]));
  return {
    frozenContestants,
    categories: varietyIceCategories.map((_, index) =>
      resolveVarietyIceCategory(frozenContestants, index, {
        shortlist: keys(),
        ballots: Object.fromEntries(people.map((person) => [person.id, keys()])),
        result: keys(),
      }),
    ),
    revealCursor: 0,
  };
}

export function awardVarietyIceCategory(
  people: Contestant[],
  ice: VarietyShowIcebreaker,
): VarietyShowIceCategory {
  const category = ice.categories[ice.revealCursor];
  if (!category || category.revealed) throw new Error('No unrevealed icebreaker award.');
  const winner = people.find((person) => person.id === category.winnerId)!;
  winner.aggregations.audienceRatio = clampBattle(winner.aggregations.audienceRatio + 0.1, -1, 1);
  winner.aggregations.happiness = clampBattle(winner.aggregations.happiness + 3);
  for (const [voterId, choice] of Object.entries(category.ballots)) {
    if (choice !== winner.id || voterId === winner.id) continue;
    const voter = people.find((person) => person.id === voterId)!;
    voter.aggregations.happiness = clampBattle(voter.aggregations.happiness + 1);
    changeBattleRelationship(voter, winner.id, 1);
    changeBattleRelationship(winner, voter.id, 1);
  }
  category.revealed = true;
  ice.revealCursor++;
  return category;
}
