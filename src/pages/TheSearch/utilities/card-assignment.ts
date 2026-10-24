import type { Dictionary } from 'types/common';
import { appendContestantHistory, recordContestantChanges } from '../engine/change-history';
import type { RandomSource } from '../engine/random';
import type { AttributeCard, PropertyChange } from '../types/common';
import type { Contestant } from '../types/contestant';
import type { SimulationDefinitions } from '../types/simulation';
import { normalizeContestant } from './contestant-factory';
import { getAlignment } from './helpers';
import { getSimulationDefinitions } from './simulation-definitions';

/**
 * Maximum retry attempts for card compatibility checks
 */
const MAX_RETRY_ATTEMPTS = 10;

/**
 * Minimum number of contestants that should receive secret cards
 */
const MIN_SECRET_CARDS = 4;

/**
 * Deep clone a contestant object to avoid modifying Firestore data.
 * Also normalizes the contestant to ensure all required fields exist,
 * which is important for contestants created before certain fields were added.
 */
function deepCloneContestant(contestant: Contestant): Contestant {
  const cloned = JSON.parse(JSON.stringify(contestant));
  return normalizeContestant(cloned);
}

/**
 * Get all used persona IDs from all contestants in Firestore
 */
function getUsedPersonaIds(allContestants: Dictionary<Contestant>): Set<string> {
  const used = new Set<string>();
  for (const contestant of Object.values(allContestants)) {
    if (contestant.persona) {
      used.add(contestant.persona);
    }
  }
  return used;
}

/**
 * Select a random persona card that hasn't been used yet
 */
function selectRandomPersona(
  usedPersonas: Set<string>,
  random: RandomSource,
  library: Dictionary<AttributeCard>,
): string | null {
  const available = Object.keys(library).filter((id) => !usedPersonas.has(id));

  if (available.length === 0) {
    return null;
  }

  return available[Math.floor(random() * available.length)];
}

/**
 * Check if a card is compatible with the contestant based on Rules 1 and 2
 *
 * Rule 1: Core skill influences must be within ±1 of current values
 * Rule 2: No contradictions - if existing influence is negative, can't add positive (and vice versa)
 *         Exception: Aggregations are excluded from Rule 2
 */
function isCardCompatible(
  contestant: Contestant,
  card: AttributeCard,
  existingInfluences: Record<string, number>,
): boolean {
  const influences = { ...card.set, ...card.influences };

  for (const [path, value] of Object.entries(influences)) {
    // Rule 1: Check core skills for ±1 constraint
    if (path.startsWith('coreSkills.')) {
      const skillName = path.split('.')[1] as keyof typeof contestant.coreSkills;
      const currentValue = contestant.coreSkills[skillName];

      // If the influence would push the skill beyond ±1 of current value
      if (typeof currentValue === 'number' && typeof value === 'number') {
        const potentialNewValue = currentValue + value;
        if (Math.abs(potentialNewValue - currentValue) > 1) {
          return false;
        }
      }
    }

    // Rule 2: Check for contradictions (except aggregations)
    if (!path.startsWith('aggregations.')) {
      const existingInfluence = existingInfluences[path];

      if (
        existingInfluence !== undefined &&
        typeof value === 'number' &&
        typeof existingInfluence === 'number'
      ) {
        // If existing is negative and new is positive (or vice versa)
        if ((existingInfluence < 0 && value > 0) || (existingInfluence > 0 && value < 0)) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Select a random card that is compatible with the contestant and hasn't been used yet
 */
function selectCompatibleCard(
  cardLibrary: Dictionary<AttributeCard>,
  contestant: Contestant,
  existingInfluences: Record<string, number>,
  usedCards: Set<string>,
  random: RandomSource,
): string | null {
  const availableCardIds = Object.keys(cardLibrary).filter((id) => !usedCards.has(id));

  if (availableCardIds.length === 0) {
    return null; // No available cards left
  }

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    const randomId = availableCardIds[Math.floor(random() * availableCardIds.length)];
    const card = cardLibrary[randomId];

    if (isCardCompatible(contestant, card, existingInfluences)) {
      return randomId;
    }
  }

  // After max attempts, return null (will skip this card type)
  return null;
}

/**
 * Assign attribute cards to a contestant
 */
export function assignAttributeCards(
  contestant: Contestant,
  secretCardIndices: Set<number>,
  currentIndex: number,
  usedPersonas: Set<string>,
  usedIdentityCards: Set<string>,
  usedInterestCards: Set<string>,
  usedSecretCards: Set<string>,
  random: RandomSource = Math.random,
  cards = getSimulationDefinitions().cards,
): {
  personaId: string | null;
  identityId: string | null;
  interestId: string | null;
  secretId: string | null;
} {
  // Collect existing influences from persona
  const existingInfluences: Record<string, number> = {};

  // Assign persona (use existing if available, otherwise select random)
  let personaId: string | null = null;
  if (contestant.persona && cards.persona[contestant.persona]) {
    // Use the contestant's existing persona
    personaId = contestant.persona;
    usedPersonas.add(personaId);
  } else {
    // Assign a new random persona (ensuring uniqueness)
    personaId = selectRandomPersona(usedPersonas, random, cards.persona);
    if (personaId) {
      usedPersonas.add(personaId);
    }
  }

  if (personaId) {
    const personaCard = cards.persona[personaId];
    for (const [path, value] of Object.entries({ ...personaCard.set, ...personaCard.influences })) {
      if (typeof value === 'number') {
        existingInfluences[path] = value;
      }
    }
  }

  // Assign identity card
  const identityId = selectCompatibleCard(
    cards.identity,
    contestant,
    existingInfluences,
    usedIdentityCards,
    random,
  );
  if (identityId) {
    usedIdentityCards.add(identityId);
    const identityCard = cards.identity[identityId];
    for (const [path, value] of Object.entries({ ...identityCard.set, ...identityCard.influences })) {
      if (typeof value === 'number') {
        existingInfluences[path] = (existingInfluences[path] || 0) + value;
      }
    }
  }

  // Assign interest card
  const interestId = selectCompatibleCard(
    cards.interest,
    contestant,
    existingInfluences,
    usedInterestCards,
    random,
  );
  if (interestId) {
    usedInterestCards.add(interestId);
    const interestCard = cards.interest[interestId];
    for (const [path, value] of Object.entries({ ...interestCard.set, ...interestCard.influences })) {
      if (typeof value === 'number') {
        existingInfluences[path] = (existingInfluences[path] || 0) + value;
      }
    }
  }

  // Assign secret card (if this contestant should get one)
  let secretId: string | null = null;
  if (secretCardIndices.has(currentIndex)) {
    secretId = selectCompatibleCard(cards.secret, contestant, existingInfluences, usedSecretCards, random);
    if (secretId) {
      usedSecretCards.add(secretId);
    }
  }

  return { personaId, identityId, interestId, secretId };
}

/**
 * Determine which contestants should receive secret cards
 * At least 4 contestants should get secrets (~13-15%)
 */
export function selectSecretCardRecipients(
  totalContestants: number,
  random: RandomSource = Math.random,
): Set<number> {
  if (!Number.isInteger(totalContestants) || totalContestants < MIN_SECRET_CARDS) {
    throw new Error(`Secret assignment requires at least ${MIN_SECRET_CARDS} contestants.`);
  }
  const numSecrets = Math.max(MIN_SECRET_CARDS, Math.floor(totalContestants * 0.14));
  const indices = new Set<number>();

  while (indices.size < numSecrets) {
    indices.add(Math.floor(random() * totalContestants));
  }

  return indices;
}

/**
 * Collect all influences from assigned cards and contestant's specialty attributes
 */
function collectAllInfluences(
  contestant: Contestant,
  cardIds: {
    personaId: string | null;
    identityId: string | null;
    interestId: string | null;
    secretId: string | null;
  },
  definitions: SimulationDefinitions,
): Record<string, { values: number[]; sets: number | string | undefined }> {
  const influences: Record<string, { values: number[]; sets: number | string | undefined }> = {};

  const addInfluence = (path: string, value: number | string, isSet = false) => {
    if (!influences[path]) {
      influences[path] = { values: [], sets: undefined };
    }

    if (isSet) {
      influences[path].sets = value;
    } else if (typeof value === 'number') {
      influences[path].values.push(value);
    }
  };

  // Collect from attribute cards
  const cards: Array<{ card: AttributeCard | undefined; id: string | null }> = [
    {
      card: cardIds.personaId ? definitions.cards.persona[cardIds.personaId] : undefined,
      id: cardIds.personaId,
    },
    {
      card: cardIds.identityId ? definitions.cards.identity[cardIds.identityId] : undefined,
      id: cardIds.identityId,
    },
    {
      card: cardIds.interestId ? definitions.cards.interest[cardIds.interestId] : undefined,
      id: cardIds.interestId,
    },
    { card: cardIds.secretId ? definitions.cards.secret[cardIds.secretId] : undefined, id: cardIds.secretId },
  ];

  for (const { card } of cards) {
    if (card) {
      // Process sets
      if (card.set) {
        for (const [path, value] of Object.entries(card.set)) {
          addInfluence(path, value, true);
        }
      }

      // Process influences
      if (card.influences) {
        for (const [path, value] of Object.entries(card.influences)) {
          addInfluence(path, value, false);
        }
      }
    }
  }

  // Collect from specialty attributes
  const specialties = [
    { value: contestant.specialties.vocalColor, library: definitions.specialties.vocalColor },
    { value: contestant.specialties.danceStyle, library: definitions.specialties.danceStyle },
    { value: contestant.specialties.rapStyle, library: definitions.specialties.rapStyle },
    { value: contestant.specialties.visualVibe, library: definitions.specialties.visualVibe },
    { value: contestant.specialties.leadershipStyle, library: definitions.specialties.leadershipStyle },
    { value: contestant.specialties.genreAffinity, library: definitions.specialties.genreAffinity },
  ];

  for (const { value, library } of specialties) {
    const specialtyCard = library[value];
    if (specialtyCard?.influences) {
      for (const [path, influenceValue] of Object.entries(specialtyCard.influences)) {
        addInfluence(path, influenceValue, false);
      }
    }
  }

  // Collect from zodiac sign
  const zodiacCard = definitions.zodiacSigns[contestant.zodiacSign];
  if (zodiacCard?.influences) {
    for (const [path, value] of Object.entries(zodiacCard.influences)) {
      addInfluence(path, value, false);
    }
  }

  return influences;
}

/**
 * Apply influences to contestant and calculate final values
 * Uses different calculation methods based on property type
 */
function applyInfluences(
  contestant: Contestant,
  influences: Record<string, { values: number[]; sets: number | string | undefined }>,
): Record<string, number | string> {
  const changes: Record<string, number | string> = {};

  for (const [path, { values, sets }] of Object.entries(influences)) {
    // Phase 1: Apply sets first (they override initial values)
    if (sets !== undefined) {
      const parts = path.split('.');
      if (parts.length === 2) {
        const [category, property] = parts;
        if (category === 'coreSkills' && property in contestant.coreSkills) {
          contestant.coreSkills[property as keyof typeof contestant.coreSkills] = sets as number;
          changes[path] = sets;
        } else if (category === 'utilitySkills' && property in contestant.utilitySkills) {
          contestant.utilitySkills[property as keyof typeof contestant.utilitySkills] = sets as number;
          changes[path] = sets;
        } else if (category === 'personality' && property in contestant.personality) {
          contestant.personality[property as keyof typeof contestant.personality] = sets as number;
          changes[path] = sets;
        }
      }
      continue; // Sets don't combine with influences
    }

    // Phase 2 & 3: Calculate and apply influences
    if (values.length > 0) {
      const parts = path.split('.');
      if (parts.length === 2) {
        const [category, property] = parts;

        // Aggregations: Simple sum
        if (category === 'aggregations' && property in contestant.aggregations) {
          const sum = values.reduce((acc, val) => acc + val, 0);
          const currentValue = contestant.aggregations[property as keyof typeof contestant.aggregations];
          const newValue = (currentValue as number) + sum;
          contestant.aggregations[property as keyof typeof contestant.aggregations] = newValue as never;
          changes[path] = newValue;
        }
        // Core skills: Weighted mean (current*2 + sum) / (1 + count)
        else if (category === 'coreSkills' && property in contestant.coreSkills) {
          const currentValue = contestant.coreSkills[property as keyof typeof contestant.coreSkills];
          const sum = values.reduce((acc, val) => acc + val, 0);
          const newValue = Math.round((currentValue * 2 + sum) / (1 + values.length));
          contestant.coreSkills[property as keyof typeof contestant.coreSkills] = Math.max(
            1,
            Math.min(5, newValue),
          ) as never;
          changes[path] = contestant.coreSkills[property as keyof typeof contestant.coreSkills];
        }
        // Utility skills: Weighted mean (current*2 + sum) / (1 + count)
        else if (category === 'utilitySkills' && property in contestant.utilitySkills) {
          const currentValue = contestant.utilitySkills[property as keyof typeof contestant.utilitySkills];
          const sum = values.reduce((acc, val) => acc + val, 0);
          const newValue = Math.round((currentValue * 2 + sum) / (1 + values.length));
          contestant.utilitySkills[property as keyof typeof contestant.utilitySkills] = Math.max(
            1,
            Math.min(5, newValue),
          ) as never;
          changes[path] = contestant.utilitySkills[property as keyof typeof contestant.utilitySkills];
        }
        // Personality: Weighted mean (current*2 + sum) / (1 + count)
        else if (category === 'personality' && property in contestant.personality) {
          const currentValue = contestant.personality[property as keyof typeof contestant.personality];
          const sum = values.reduce((acc, val) => acc + val, 0);
          const newValue = Math.round((currentValue * 2 + sum) / (1 + values.length));
          contestant.personality[property as keyof typeof contestant.personality] = Math.max(
            -10,
            Math.min(10, newValue),
          ) as never;
          changes[path] = contestant.personality[property as keyof typeof contestant.personality];
        }
      }
    }
  }

  return changes;
}

/**
 * Initialize relationships for a contestant
 * All contestants start with a relationship score of 50 with every other contestant.
 */
function initializeRelationships(contestantIds: string[], ownerId: string): Record<string, number[]> {
  const relationships: Record<string, number[]> = {};

  for (const id of contestantIds) {
    if (id === ownerId) continue;
    relationships[id] = [50];
  }

  return relationships;
}

/**
 * Main function to process all contestants in the simulation
 * - Deep clones contestants from Firestore
 * - Assigns cards
 * - Applies influences
 * - Recalculates alignment
 * - Initializes relationships
 * - Creates change log
 */
export function processSimulationContestants(
  selectedIds: string[],
  allContestants: Dictionary<Contestant>,
  options: { random?: RandomSource; definitions?: SimulationDefinitions; now?: number } = {},
): Contestant[] {
  const random = options.random ?? Math.random;
  const definitions = options.definitions ?? getSimulationDefinitions();
  const now = options.now ?? Date.now();
  if (new Set(selectedIds).size !== selectedIds.length)
    throw new Error('The selected cast contains duplicate IDs.');
  const secretCardRecipients = selectSecretCardRecipients(selectedIds.length, random);
  const processedContestants: Contestant[] = [];

  // Track used cards to ensure no duplicates across all contestants
  const usedPersonas = getUsedPersonaIds(allContestants);
  const usedIdentityCards = new Set<string>();
  const usedInterestCards = new Set<string>();
  const usedSecretCards = new Set<string>();

  for (let i = 0; i < selectedIds.length; i++) {
    const originalContestant = allContestants[selectedIds[i]];
    if (!originalContestant) throw new Error(`Selected contestant "${selectedIds[i]}" does not exist.`);

    // Deep clone to avoid modifying Firestore data
    let contestant = deepCloneContestant(originalContestant);
    const changes: PropertyChange[] = recordContestantChanges(
      originalContestant,
      contestant,
      'Normalize source profile',
    );
    const recordMutation = (cause: string, mutate: () => void) => {
      const before = structuredClone(contestant);
      mutate();
      changes.push(...recordContestantChanges(before, contestant, cause));
    };

    // Assign attribute cards with uniqueness tracking
    const cardIds = assignAttributeCards(
      contestant,
      secretCardRecipients,
      i,
      usedPersonas,
      usedIdentityCards,
      usedInterestCards,
      usedSecretCards,
      random,
      definitions.cards,
    );

    // Collect all influences
    const influences = collectAllInfluences(contestant, cardIds, definitions);

    // Apply influences and get changes
    recordMutation('Apply assigned card, specialty and zodiac influences', () => {
      applyInfluences(contestant, influences);
    });

    // Recalculate alignment based on new personality traits
    const newAlignment = getAlignment(contestant.personality);
    if (newAlignment !== contestant.alignment) {
      recordMutation('Recalculate alignment after setup influences', () => {
        contestant.alignment = newAlignment;
      });
    }

    // Initialize relationships
    recordMutation('Initialize cast relationships', () => {
      contestant.relationships = initializeRelationships(selectedIds, contestant.id);
    });

    // Update attributes array with assigned card IDs
    recordMutation('Assign setup cards and persona', () => {
      contestant.attributes = [
        cardIds.personaId,
        cardIds.identityId,
        cardIds.interestId,
        cardIds.secretId,
      ].filter((id): id is string => id !== null);
      if (cardIds.personaId) contestant.persona = cardIds.personaId;
    });

    recordMutation('Initialize hidden season rank, reset episode Practice and timestamp setup', () => {
      contestant.rank = i + 1;
      contestant.aggregations.practice = 0;
      contestant.updatedAt = now;
    });
    contestant = appendContestantHistory(
      contestant,
      {
        phaseId: 'setup',
        episode: 0,
        missionRating: contestant.missionRating,
        rank: contestant.rank,
        score: contestant.aggregations.score,
        status: contestant.status,
        summary: 'Initial Setup',
        events: contestant.attributes,
      },
      changes,
    );

    processedContestants.push(contestant);
  }

  return processedContestants;
}
