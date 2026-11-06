import catalog from '../data/photoshoot-concepts.json';
import type { PhotoshootConcept } from '../types/photoshoot-episode';
import { VISUAL_VIBES } from './attribute-libraries';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid Photoshoot concepts: expected an object.');
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: readonly string[]) {
  if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key)))
    throw new Error('Invalid Photoshoot concepts: missing or unknown keys.');
}
function text(value: unknown) {
  if (typeof value !== 'string' || !value.trim())
    throw new Error('Invalid Photoshoot concepts: nonempty text required.');
}
function fit(value: unknown, keys: readonly string[]) {
  const map = object(value);
  exact(map, keys);
  if (Object.values(map).some((score) => score !== 0 && score !== 50 && score !== 100))
    throw new Error('Invalid Photoshoot concepts: fit must be 0, 50 or 100.');
}
export function validatePhotoshootConcepts(
  value: unknown,
  visualVibeKeys: readonly string[],
): PhotoshootConcept[] {
  if (
    visualVibeKeys.length !== 7 ||
    new Set(visualVibeKeys).size !== visualVibeKeys.length ||
    visualVibeKeys.some((key) => typeof key !== 'string' || !key.trim())
  )
    throw new Error('Invalid Photoshoot concepts: seven distinct frozen visual vibe keys required.');
  if (!Array.isArray(value) || value.length !== 4)
    throw new Error('Invalid Photoshoot concepts: exactly four concepts required.');
  const ids = new Set<string>();
  const traits = [
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
  ];
  for (const raw of value) {
    const entry = object(raw);
    exact(entry, ['id', 'name', 'description', 'preferredTraits', 'vibeFit', 'outfits', 'props']);
    for (const key of ['id', 'name', 'description']) text(entry[key]);
    if (ids.has(String(entry.id))) throw new Error('Invalid Photoshoot concepts: repeated concept ID.');
    ids.add(String(entry.id));
    if (
      !Array.isArray(entry.preferredTraits) ||
      entry.preferredTraits.length !== 2 ||
      new Set(entry.preferredTraits).size !== 2 ||
      entry.preferredTraits.some((trait) => !traits.includes(trait))
    )
      throw new Error('Invalid Photoshoot concepts: two distinct known preferred traits required.');
    fit(entry.vibeFit, visualVibeKeys);
    for (const key of ['outfits', 'props']) {
      const choices = entry[key];
      if (!Array.isArray(choices) || !choices.length)
        throw new Error('Invalid Photoshoot concepts: wardrobe choices required.');
      const choiceIds = new Set<string>();
      for (const rawChoice of choices) {
        const choice = object(rawChoice);
        exact(choice, ['id', 'name', 'novelty', 'vibeFit']);
        text(choice.id);
        text(choice.name);
        if (choiceIds.has(String(choice.id)))
          throw new Error('Invalid Photoshoot concepts: repeated wardrobe ID.');
        choiceIds.add(String(choice.id));
        if (
          typeof choice.novelty !== 'number' ||
          !Number.isFinite(choice.novelty) ||
          choice.novelty < 0 ||
          choice.novelty > 100
        )
          throw new Error('Invalid Photoshoot concepts: novelty must be bounded.');
        fit(choice.vibeFit, visualVibeKeys);
      }
    }
  }
  return structuredClone(value) as PhotoshootConcept[];
}
export function getPhotoshootConcepts(): PhotoshootConcept[] {
  return validatePhotoshootConcepts(catalog, Object.keys(VISUAL_VIBES));
}
