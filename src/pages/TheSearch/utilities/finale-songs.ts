import source from '../data/finale-songs.json';
import type { FinaleCatalog } from '../types/finale-episode';

export function validateFinaleCatalog(value: unknown): asserts value is FinaleCatalog {
  const catalog = value as FinaleCatalog | null;
  const text = (entry: unknown): entry is string => typeof entry === 'string' && !!entry.trim();
  const identities = (entries: { id: string; name: string }[]) =>
    new Set(entries.map((entry) => entry.id)).size === entries.length &&
    new Set(entries.map((entry) => entry.name.trim().toLowerCase())).size === entries.length;
  if (
    !catalog ||
    catalog.version !== 1 ||
    !Array.isArray(catalog.originals) ||
    catalog.originals.length < 2 ||
    catalog.originals.some(
      (song) =>
        !song ||
        !text(song.id) ||
        !/^[a-z][a-z0-9-]*$/.test(song.id) ||
        song.id === 'squirrel-life' ||
        !text(song.name) ||
        !text(song.description) ||
        song.difficulty !== 4 ||
        !Array.isArray(song.parts) ||
        song.parts.length !== 4 ||
        song.parts.some(
          (part) =>
            !part ||
            !text(part.id) ||
            !text(part.name) ||
            !text(part.staging) ||
            (['VOCAL', 'RAP', 'DANCE'] as const).some((track) => !text(part.arrangements?.[track])),
        ) ||
        !identities(song.parts),
    ) ||
    !identities(catalog.originals) ||
    catalog.theme?.id !== 'squirrel-life' ||
    catalog.theme.title !== 'Squirrel Life' ||
    catalog.theme.difficulty !== 3 ||
    !text(catalog.theme.staging)
  )
    throw new Error('Invalid distinct Finale originals, four-part primary arrangements or live theme.');
}

export function getFinaleCatalog(): FinaleCatalog {
  validateFinaleCatalog(source);
  return structuredClone(source);
}
