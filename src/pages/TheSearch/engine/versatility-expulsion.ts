import type { Contestant } from '../types/contestant';
import type { SimulationDefinitions } from '../types/simulation';
import type { VersatilityExpulsion } from '../types/versatility-episode';
import { revealExactAuditionSecret } from './audition-secrets';
import { battleRelationship } from './battle-scoring';
import type { RandomSource } from './random';

export function unrevealedVersatilityCards(person: Contestant, definitions: SimulationDefinitions): string[] {
  return person.attributes.filter(
    (id) => Object.hasOwn(definitions.cards.secret, id) && !person.events.includes(`SECRET_REVEALED:${id}`),
  );
}
export function versatilityFallbackPool(
  people: readonly Contestant[],
  selected: Contestant,
  definitions: SimulationDefinitions,
) {
  const revealed = (person: Contestant) =>
    person.events
      .filter((event) => event.startsWith('SECRET_REVEALED:'))
      .map((event) => event.slice('SECRET_REVEALED:'.length));
  const excluded = new Set([...selected.attributes, ...revealed(selected)]);
  const used = new Set(people.flatMap((person) => [...person.attributes, ...revealed(person)]));
  const eligible = Object.values(definitions.cards.secret).filter(
    (card) => !excluded.has(card.id) && Number.isFinite(card.occurrence) && card.occurrence > 0,
  );
  const unused = eligible.filter((card) => !used.has(card.id));
  return (unused.length ? unused : eligible).map((card) => ({ cardId: card.id, weight: card.occurrence }));
}
export function selectVersatilityExpulsion(
  contestants: readonly Contestant[],
  survivorIds: readonly string[],
  definitions: SimulationDefinitions,
  random: RandomSource,
): { contestants: Contestant[]; expulsion: VersatilityExpulsion } {
  if (survivorIds.length !== 13 || new Set(survivorIds).size !== 13)
    throw new Error('Expulsion needs the actual thirteen-person holding room.');
  const people = survivorIds.map((id) => {
    const person = contestants.find((person) => person.id === id);
    if (!person) throw new Error('Missing expulsion survivor.');
    return person;
  });
  const holders = people.filter((person) => unrevealedVersatilityCards(person, definitions).length);
  const eligibleIds = (holders.length ? holders : people).map((person) => person.id);
  const relationships = Object.fromEntries(
    people.map((person) => [
      person.id,
      Object.fromEntries(
        people
          .filter((other) => other.id !== person.id)
          .map((other) => [other.id, battleRelationship(person, other.id)]),
      ),
    ]),
  );
  const incomingTotals = Object.fromEntries(
    eligibleIds.map((id) => [
      id,
      people
        .filter((person) => person.id !== id)
        .reduce((sum, person) => sum + relationships[person.id][id], 0),
    ]),
  );
  const tieKeys = Object.fromEntries(eligibleIds.map((id) => [id, random()]));
  const contestantId = [...eligibleIds].sort(
    (a, b) => incomingTotals[a] - incomingTotals[b] || tieKeys[a] - tieKeys[b] || a.localeCompare(b),
  )[0];
  const selected = people.find((person) => person.id === contestantId)!;
  const assigned = !holders.length;
  const fallbackPool = assigned ? versatilityFallbackPool(contestants, selected, definitions) : [];
  if (assigned && !fallbackPool.length)
    throw new Error('No eligible fallback secret remains for the selected contestant.');
  const assignmentDraw = assigned ? random() : null;
  let cardId = unrevealedVersatilityCards(selected, definitions)[0];
  if (assigned) {
    const target = assignmentDraw! * fallbackPool.reduce((sum, entry) => sum + entry.weight, 0);
    let cumulative = 0;
    cardId = fallbackPool.find((entry) => {
      cumulative += entry.weight;
      return target < cumulative;
    })!.cardId;
  }
  const attached = structuredClone([...contestants]);
  if (assigned) attached.find((person) => person.id === contestantId)!.attributes.push(cardId);
  const revealed = revealExactAuditionSecret(attached, contestantId, cardId, definitions);
  return {
    contestants: revealed.contestants,
    expulsion: {
      contestantId,
      cardId,
      assigned,
      result: revealed.result,
      survivorIds: [...survivorIds],
      eligibleIds,
      incomingTotals,
      relationships,
      tieKeys,
      fallbackPool,
      assignmentDraw,
      beforeContestants: structuredClone([...contestants]),
    },
  };
}
