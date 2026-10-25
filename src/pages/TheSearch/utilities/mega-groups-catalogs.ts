import songs from '../data/mega-group-songs.json';
import tests from '../data/mega-group-tests.json';
import type { BattleSong } from '../types/battle-episode';
import type { MegaGroupTestPair } from '../types/mega-groups-episode';
import { GENRE_AFFINITIES } from './attribute-libraries';
import { freezeSimulationSnapshot } from './simulation-definitions';

export const MEGA_GROUP_IMAGES: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob('../data/mega-group-images/*.svg', { eager: true, query: '?url', import: 'default' }),
  ).map(([path, url]) => [path.split('/').at(-1)!, url as string]),
);
const traits = new Set([
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
]);
const technical = new Set(['vocals', 'rap', 'dance', 'visual', 'uniqueness', 'leadership']);

function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Mega Groups catalog entry must be an object.');
  const entry = value as Record<string, unknown>;
  if (keys.some((key) => !Object.hasOwn(entry, key)) || Object.keys(entry).some((key) => !keys.includes(key)))
    throw new Error('Mega Groups catalog has missing or unknown fields.');
  return entry;
}
function text(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Mega Groups catalog needs nonempty text.');
}
function level(value: unknown) {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 5)
    throw new Error('Mega Groups difficulty must be from 1 to 5.');
}
export function validateMegaGroupTests(value: unknown): asserts value is MegaGroupTestPair[] {
  if (!Array.isArray(value) || !value.length) throw new Error('Mega Groups requires image test pairs.');
  const ids = new Set<string>();
  for (const raw of value) {
    const entry = object(raw, ['id', 'name', 'sides']);
    text(entry.id);
    text(entry.name);
    if (ids.has(entry.id)) throw new Error('Duplicate Mega Groups test ID.');
    ids.add(entry.id);
    if (!Array.isArray(entry.sides) || entry.sides.length !== 2)
      throw new Error('A Mega Groups test requires two sides.');
    const names = new Set<string>();
    for (const rawSide of entry.sides) {
      const side = object(rawSide, ['name', 'image', 'traits']);
      text(side.name);
      text(side.image);
      if (names.has(side.name)) throw new Error('A Mega Groups test requires distinct side names.');
      names.add(side.name);
      if (!Object.hasOwn(MEGA_GROUP_IMAGES, side.image)) throw new Error('Unknown local Mega Groups image.');
      if (
        !Array.isArray(side.traits) ||
        side.traits.length !== 2 ||
        new Set(side.traits).size !== 2 ||
        side.traits.some((trait) => !traits.has(trait))
      )
        throw new Error('A Mega Groups side requires two distinct known personality traits.');
    }
  }
}
export function validateMegaGroupSongs(
  value: unknown,
  genreIds: readonly string[] = Object.keys(GENRE_AFFINITIES),
): asserts value is BattleSong[] {
  if (!Array.isArray(genreIds) || genreIds.some((id) => typeof id !== 'string' || !id.trim()))
    throw new Error('Mega Groups genre IDs must be nonempty strings.');
  if (!Array.isArray(value) || value.length < 4) throw new Error('Mega Groups requires at least four songs.');
  const ids = new Set<string>();
  for (const raw of value) {
    const song = object(raw, ['id', 'title', 'description', 'genre', 'difficulty', 'parts']);
    for (const key of ['id', 'title', 'description', 'genre']) text(song[key]);
    const id = String(song.id);
    if (ids.has(id)) throw new Error('Duplicate Mega Groups song ID.');
    ids.add(id);
    if (!genreIds.includes(String(song.genre))) throw new Error('Unknown Mega Groups genre.');
    level(song.difficulty);
    if (!Array.isArray(song.parts) || song.parts.length !== 9)
      throw new Error('Mega Groups songs require nine parts.');
    const parts = new Set<string>();
    for (const rawPart of song.parts) {
      const part = object(rawPart, ['id', 'name', 'testedSkills']);
      text(part.id);
      text(part.name);
      if (parts.has(part.id)) throw new Error('Duplicate Mega Groups part ID.');
      parts.add(part.id);
      if (!Array.isArray(part.testedSkills) || !part.testedSkills.length)
        throw new Error('Mega Groups parts need tested skills.');
      const seen = new Set<string>();
      for (const rawCheck of part.testedSkills) {
        const check = object(rawCheck, ['skill', 'requiredLevel']);
        text(check.skill);
        if (!technical.has(check.skill) || seen.has(check.skill))
          throw new Error('Invalid Mega Groups tested skill.');
        seen.add(check.skill);
        level(check.requiredLevel);
      }
    }
  }
  const difficulties = value.map((song) => song.difficulty);
  if (Math.max(...difficulties) - Math.min(...difficulties) > 1)
    throw new Error('Mega Groups songs need comparable difficulty.');
}
export function assertMegaGroupsCatalogs(
  testPairs: unknown,
  songCatalog: unknown,
  genreIds: readonly string[] = Object.keys(GENRE_AFFINITIES),
): void {
  validateMegaGroupsCatalogs(testPairs, songCatalog, genreIds);
}
export function validateMegaGroupsCatalogs(
  testPairs: unknown,
  songCatalog: unknown,
  genreIds: readonly string[] = Object.keys(GENRE_AFFINITIES),
): void {
  validateMegaGroupTests(testPairs);
  validateMegaGroupSongs(songCatalog, genreIds);
}
export function getMegaGroupsCatalogs(): {
  megaGroupTests: MegaGroupTestPair[];
  megaGroupSongs: BattleSong[];
} {
  const megaGroupTests: unknown = structuredClone(tests);
  const megaGroupSongs: unknown = structuredClone(songs);
  validateMegaGroupTests(megaGroupTests);
  validateMegaGroupSongs(megaGroupSongs);
  return freezeSimulationSnapshot({ megaGroupTests, megaGroupSongs });
}
