import source from '../data/specialties-songs.json';
import type { SpecialtiesCatalog } from '../types/specialties-episode';

export function validateSpecialtiesCatalog(value: unknown): asserts value is SpecialtiesCatalog {
  if (!value || typeof value !== 'object') throw new Error('Invalid Specialties catalog.');
  const catalog = value as SpecialtiesCatalog;
  if (
    catalog.version !== 1 ||
    !Array.isArray(catalog.songs) ||
    catalog.songs.length < 9 ||
    new Set(catalog.songs.map((song) => song?.id)).size !== catalog.songs.length ||
    new Set(catalog.songs.map((song) => song?.name?.trim().toLowerCase())).size !== catalog.songs.length ||
    catalog.songs.some(
      (song) =>
        !song ||
        typeof song.id !== 'string' ||
        !/^[a-z][a-z0-9-]*$/.test(song.id) ||
        typeof song.name !== 'string' ||
        !song.name.trim() ||
        typeof song.description !== 'string' ||
        !song.description.trim() ||
        song.difficulty !== 3 ||
        ['VOCAL', 'RAP', 'DANCE'].some((track) => {
          const arrangement = song.arrangements?.[track as keyof typeof song.arrangements];
          return typeof arrangement !== 'string' || !arrangement.trim();
        }),
    )
  )
    throw new Error('Invalid distinct medium-difficulty Specialties solo templates.');
}

export function getSpecialtiesCatalog(): SpecialtiesCatalog {
  validateSpecialtiesCatalog(source);
  return structuredClone(source);
}
