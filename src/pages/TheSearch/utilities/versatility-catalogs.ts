import members from '../data/doubt-girls.json';
import songs from '../data/versatility-songs.json';
import type { SimulationDefinitions } from '../types/simulation';
import type { DoubtGirlsMember, VersatilitySong } from '../types/versatility-episode';
import {
  DANCE_STYLES,
  GENRE_AFFINITIES,
  LEADERSHIP_STYLES,
  RAP_STYLES,
  VISUAL_VIBES,
  VOCAL_COLORS,
} from './attribute-libraries';

const specialties = {
  vocalColor: VOCAL_COLORS,
  danceStyle: DANCE_STYLES,
  rapStyle: RAP_STYLES,
  visualVibe: VISUAL_VIBES,
  leadershipStyle: LEADERSHIP_STYLES,
  genreAffinity: GENRE_AFFINITIES,
};
export function validateVersatilityCatalogs(
  songsValue: unknown,
  membersValue: unknown,
  libraryValue: unknown = specialties,
): void {
  const fail = (): never => {
    throw new Error('Invalid Versatility songs or Doubt Girls catalog.');
  };
  const object = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : fail();
  const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
  const exact = (value: Record<string, unknown>, keys: string[]) => {
    if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) fail();
  };
  const libraryObject = object(libraryValue);
  for (const field of Object.keys(specialties)) object(libraryObject[field]);
  const library = libraryObject as SimulationDefinitions['specialties'];
  if (
    !Array.isArray(songsValue) ||
    songsValue.length < 3 ||
    !Array.isArray(membersValue) ||
    membersValue.length !== 5
  )
    fail();
  const ids = new Set<string>();
  for (const raw of songsValue as unknown[]) {
    const song = object(raw);
    exact(song, ['id', 'title', 'concept', 'genre', 'parts']);
    if (['id', 'title', 'concept', 'genre'].some((key) => !text(song[key])) || ids.has(String(song.id)))
      fail();
    ids.add(String(song.id));
    if (
      !Object.hasOwn(library.genreAffinity, String(song.genre)) ||
      !Array.isArray(song.parts) ||
      song.parts.length !== 5
    )
      fail();
    const parts = new Set<string>();
    for (const rawPart of song.parts as unknown[]) {
      const part = object(rawPart);
      exact(part, ['id', 'name', 'alternatives']);
      if (!text(part.id) || !text(part.name) || parts.has(String(part.id))) fail();
      parts.add(String(part.id));
      const alternatives = object(part.alternatives);
      exact(alternatives, ['VOCAL', 'RAP', 'DANCE']);
      for (const track of ['VOCAL', 'RAP', 'DANCE']) {
        const alternative = object(alternatives[track]);
        exact(alternative, ['difficulty', 'action']);
        if (
          !Number.isInteger(alternative.difficulty) ||
          Number(alternative.difficulty) < 1 ||
          Number(alternative.difficulty) > 5 ||
          !text(alternative.action)
        )
          fail();
      }
    }
  }
  ids.clear();
  for (const raw of membersValue as unknown[]) {
    const member = object(raw);
    exact(member, ['id', 'name', 'role', 'favoredSpecialties']);
    if (['id', 'name', 'role'].some((key) => !text(member[key])) || ids.has(String(member.id))) fail();
    ids.add(String(member.id));
    if (!Array.isArray(member.favoredSpecialties) || member.favoredSpecialties.length !== 2) fail();
    const references = new Set<string>();
    for (const rawReference of member.favoredSpecialties as unknown[]) {
      const reference = object(rawReference);
      exact(reference, ['field', 'value']);
      const field = reference.field as keyof typeof library;
      const key = `${String(field)}:${String(reference.value)}`;
      if (
        !Object.hasOwn(library, field) ||
        !Object.hasOwn(library[field], String(reference.value)) ||
        references.has(key)
      )
        fail();
      references.add(key);
    }
  }
}
export function getVersatilityCatalogs(): {
  versatilitySongs: VersatilitySong[];
  doubtGirls: DoubtGirlsMember[];
} {
  validateVersatilityCatalogs(songs, members);
  return structuredClone({ versatilitySongs: songs, doubtGirls: members }) as {
    versatilitySongs: VersatilitySong[];
    doubtGirls: DoubtGirlsMember[];
  };
}
