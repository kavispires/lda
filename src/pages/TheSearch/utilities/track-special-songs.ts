import catalog from '../data/track-special-songs.json';
import type { TrackSpecialSong } from '../types/track-specials-episode';
import { DANCE_STYLES, GENRE_AFFINITIES, RAP_STYLES, VOCAL_COLORS } from './attribute-libraries';

export function validateTrackSpecialSongs(value: unknown): TrackSpecialSong[] {
  const fail = () => {
    throw new Error('Invalid Track Specials songs or exact-size arrangements.');
  };
  const object = (input: unknown): Record<string, unknown> => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return fail();
    return input as Record<string, unknown>;
  };
  const exact = (input: Record<string, unknown>, keys: string[]) => {
    if (Object.keys(input).length !== keys.length || keys.some((key) => !Object.hasOwn(input, key))) fail();
  };
  const text = (input: unknown) => typeof input === 'string' && input.trim().length > 0;
  if (!Array.isArray(value)) return fail();
  const ids = new Set<string>();
  const counts = { VOCAL: 0, RAP: 0, DANCE: 0 };
  for (const raw of value) {
    const song = object(raw);
    exact(song, ['id', 'title', 'description', 'track', 'genre', 'favoredSpecialties', 'arrangements']);
    if (['id', 'title', 'description', 'genre'].some((key) => !text(song[key]))) fail();
    const id = String(song.id);
    if (ids.has(id)) fail();
    ids.add(id);
    if (song.track !== 'VOCAL' && song.track !== 'RAP' && song.track !== 'DANCE') return fail();
    counts[song.track]++;
    const specialties = { VOCAL: VOCAL_COLORS, RAP: RAP_STYLES, DANCE: DANCE_STYLES }[song.track];
    if (!Object.hasOwn(GENRE_AFFINITIES, String(song.genre))) fail();
    if (
      !Array.isArray(song.favoredSpecialties) ||
      !song.favoredSpecialties.length ||
      song.favoredSpecialties.some((entry) => !text(entry) || !Object.hasOwn(specialties, String(entry))) ||
      new Set(song.favoredSpecialties).size !== song.favoredSpecialties.length
    )
      fail();
    const arrangements = object(song.arrangements);
    exact(arrangements, ['1', '2', '3', '4']);
    for (const size of [1, 2, 3, 4]) {
      const parts = arrangements[String(size)];
      if (!Array.isArray(parts) || parts.length !== size) return fail();
      const partIds = new Set<string>();
      for (const rawPart of parts) {
        const part = object(rawPart);
        exact(part, ['id', 'name', 'requiredLevel']);
        if (
          !text(part.id) ||
          !text(part.name) ||
          partIds.has(String(part.id)) ||
          !Number.isInteger(part.requiredLevel) ||
          Number(part.requiredLevel) < 1 ||
          Number(part.requiredLevel) > 5
        )
          fail();
        partIds.add(String(part.id));
      }
    }
  }
  if (Object.values(counts).some((count) => count < 4)) fail();
  return structuredClone(value) as TrackSpecialSong[];
}

export function getTrackSpecialSongs(): TrackSpecialSong[] {
  return validateTrackSpecialSongs(catalog);
}
