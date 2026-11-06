import source from '../data/variety-show-challenges.json';
import type { VarietyShowCatalog } from '../types/variety-show-episode';

export function validateVarietyShowCatalog(value: unknown): asserts value is VarietyShowCatalog {
  if (!value || typeof value !== 'object') throw new Error('Invalid Variety Show catalog.');
  const catalog = value as VarietyShowCatalog;
  if (
    catalog.version !== 1 ||
    catalog.guest?.id !== 'roxana' ||
    catalog.guest.name !== 'Roxana Michaels' ||
    catalog.guest.role !== 'Actress'
  )
    throw new Error('Invalid Variety Show guest or catalog version.');
  for (const field of ['physicalGames', 'interviewPrompts', 'improvScenes', 'propBoxes'] as const) {
    const entries = catalog[field];
    if (
      !Array.isArray(entries) ||
      !entries.length ||
      new Set(entries.map((entry) => entry?.id)).size !== entries.length ||
      entries.some(
        (entry) =>
          !entry ||
          typeof entry.id !== 'string' ||
          !/^[a-z][a-z0-9-]*$/.test(entry.id) ||
          typeof entry.name !== 'string' ||
          !entry.name.trim() ||
          typeof entry.description !== 'string' ||
          !entry.description.trim() ||
          entry.difficulty !== 3,
      )
    )
      throw new Error(`Invalid Variety Show ${field}.`);
  }
}

export function getVarietyShowCatalog(): VarietyShowCatalog {
  validateVarietyShowCatalog(source);
  return structuredClone(source);
}
