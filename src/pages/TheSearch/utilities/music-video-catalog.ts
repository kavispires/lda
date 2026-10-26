import source from '../data/music-video-catalog.json';
import type { MusicVideoCatalog } from '../types/music-video-episode';

export function validateMusicVideoCatalog(value: unknown): asserts value is MusicVideoCatalog {
  if (!value || typeof value !== 'object') throw new Error('Invalid Music Videos catalog.');
  const catalog = value as MusicVideoCatalog;
  if (
    catalog.version !== 1 ||
    catalog.theme?.id !== 'squirrel-life' ||
    catalog.theme.title !== 'Squirrel Life' ||
    catalog.director?.id !== 'vivienne-voss' ||
    catalog.director.name !== 'Vivienne Voss' ||
    catalog.director.role !== 'Guest Director'
  )
    throw new Error('Invalid Music Videos theme, director or version.');
  for (const field of ['soloSets', 'storyboardPrompts'] as const) {
    const entries = catalog[field];
    if (
      !Array.isArray(entries) ||
      entries.length < (field === 'soloSets' ? 10 : 1) ||
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
          (field === 'soloSets' && (!('difficulty' in entry) || entry.difficulty !== 3)),
      ) ||
      (field === 'soloSets' &&
        (new Set(entries.map((entry) => entry.name.trim().toLowerCase())).size !== entries.length ||
          new Set(entries.map((entry) => entry.description.trim())).size !== entries.length))
    )
      throw new Error(`Invalid Music Videos ${field}.`);
  }
}

export function getMusicVideoCatalog(): MusicVideoCatalog {
  validateMusicVideoCatalog(source);
  return structuredClone(source);
}
