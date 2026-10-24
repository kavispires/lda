import type { DeferredConsequence, SecretResult } from '../types/audition-episode';
import type { AttributeCard } from '../types/common';
import type { Contestant } from '../types/contestant';
import type { SimulationDefinitions } from '../types/simulation';
import { STATUSES } from '../utilities/constants';
import { createContestant } from '../utilities/contestant-factory';

const conditions = new Set([
  'STABLE',
  'HEALTHY',
  'STRESSED',
  'ANXIOUS',
  'CONFIDENT',
  'ELATED',
  'DEPRESSED',
  'TIRED',
  'INJURED',
  'RECOVERING',
  'EXHAUSTED',
]);

function hasKey<T extends object>(value: T, key: string): key is Extract<keyof T, string> {
  return Object.hasOwn(value, key);
}

export function validateSecretConsequences(cards: Record<string, AttributeCard>): void {
  const template = createContestant({ id: 'validation', name: 'Validation' });
  for (const card of Object.values(cards)) {
    for (const [path, value] of Object.entries(card.consequence ?? {})) {
      if (path === 'condition' && typeof value === 'string' && conditions.has(value)) continue;
      if (path === 'status' && Object.values(STATUSES).some((status) => status === value)) continue;
      const [category, key, extra] = path.split('.');
      const known =
        !extra &&
        key &&
        ((category === 'coreSkills' && hasKey(template.coreSkills, key)) ||
          (category === 'utilitySkills' && hasKey(template.utilitySkills, key)) ||
          (category === 'personality' && hasKey(template.personality, key)) ||
          (category === 'aggregations' && hasKey(template.aggregations, key)));
      if (!known || typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`Secret "${card.id}" has an unsupported consequence: ${path}.`);
      }
    }
  }
}

export function revealAuditionSecret(
  contestants: readonly Contestant[],
  contestantId: string,
  definitions: SimulationDefinitions,
): { contestants: Contestant[]; result: SecretResult } {
  validateSecretConsequences(definitions.cards.secret);
  const updated = structuredClone([...contestants]);
  const contestant = updated.find((entry) => entry.id === contestantId);
  if (!contestant) throw new Error('The selected secret-check contestant does not exist.');
  const card = contestant.attributes.map((id) => definitions.cards.secret[id]).find(Boolean);
  if (!card) {
    return {
      contestants: updated,
      result: {
        contestantId,
        cardId: null,
        title: 'No secret uncovered',
        description: 'The check reveals nothing. Nothing changes.',
        deferred: [],
      },
    };
  }
  if (contestant.events.includes(`SECRET_REVEALED:${card.id}`)) {
    throw new Error('This secret has already been publicly revealed.');
  }
  const deferred: DeferredConsequence[] = [];
  for (const [path, value] of Object.entries(card.consequence ?? {})) {
    const cause = `Public reveal: ${card.name}`;
    // Outcome-changing effects cannot rewrite the already locked audition cut.
    if (path === 'status' || path === 'aggregations.score') {
      deferred.push({ contestantId, path, value, cause });
      continue;
    }
    if (path === 'condition' && typeof value === 'string') {
      contestant.condition = value;
      continue;
    }
    if (typeof value !== 'number') throw new Error(`Unsupported secret effect "${path}".`);
    const [category, key] = path.split('.');
    if (category === 'coreSkills' && hasKey(contestant.coreSkills, key)) {
      contestant.coreSkills[key] = Math.max(1, Math.min(5, Math.round(contestant.coreSkills[key] + value)));
    } else if (category === 'utilitySkills' && hasKey(contestant.utilitySkills, key)) {
      contestant.utilitySkills[key] = Math.max(
        1,
        Math.min(5, Math.round(contestant.utilitySkills[key] + value)),
      );
    } else if (category === 'personality' && hasKey(contestant.personality, key)) {
      contestant.personality[key] = Math.max(
        -10,
        Math.min(10, Math.round(contestant.personality[key] + value)),
      );
    } else if (category === 'aggregations' && hasKey(contestant.aggregations, key)) {
      const next = contestant.aggregations[key] + value;
      if (key.endsWith('Ratio')) contestant.aggregations[key] = Math.max(-1, Math.min(1, next));
      else if (key === 'happiness' || key === 'contestantsLikeness')
        contestant.aggregations[key] = Math.max(0, Math.min(100, next));
      else if (key === 'practice')
        contestant.aggregations.practice = Math.max(0, Math.min(5, Math.round(next)));
      else contestant.aggregations[key] = Math.max(0, next);
    } else throw new Error(`Unsupported secret effect "${path}".`);
  }
  contestant.events.push(`SECRET_REVEALED:${card.id}`);
  return {
    contestants: updated,
    result: {
      contestantId,
      cardId: card.id,
      title: card.name,
      description: card.description,
      deferred,
    },
  };
}
