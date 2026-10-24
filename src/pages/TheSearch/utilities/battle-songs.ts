import songs from '../data/battle-songs.json';
import type { BattleSong } from '../types/battle-episode';
import { GENRE_AFFINITIES } from './attribute-libraries';
import { freezeSimulationSnapshot } from './simulation-definitions';

function object(value: unknown, keys: readonly string[], path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${path} must be an object.`);
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !keys.includes(key)) || keys.some((key) => !(key in result)))
    throw new Error(`${path} has missing or unknown fields.`);
  return result;
}

function text(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${path} must be nonempty text.`);
}

function level(value: unknown, path: string): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5)
    throw new Error(`${path} must be an integer from 1 to 5.`);
}

/** Validate editable songs without coercion, repairing, or consulting a mutable runtime catalog. */
export function validateBattleSongs(
  value: unknown,
  genreIds: readonly string[],
): asserts value is BattleSong[] {
  if (!Array.isArray(genreIds) || genreIds.some((id) => typeof id !== 'string' || !id.trim()))
    throw new Error('Battle genre IDs must be nonempty strings.');
  if (!Array.isArray(value) || value.length < 6)
    throw new Error('Group Battles requires at least six songs.');
  const ids = new Set<string>();
  for (const [index, entry] of value.entries()) {
    const path = `Battle songs[${index}]`;
    const song = object(entry, ['id', 'title', 'description', 'genre', 'difficulty', 'parts'], path);
    for (const key of ['id', 'title', 'description', 'genre']) text(song[key], `${path}.${key}`);
    const id = song.id as string;
    if (ids.has(id)) throw new Error(`${path} has a duplicate song ID.`);
    ids.add(id);
    if (!genreIds.includes(song.genre as string)) throw new Error(`${path}.genre is unknown.`);
    level(song.difficulty, `${path}.difficulty`);
    if (!Array.isArray(song.parts) || song.parts.length !== 5)
      throw new Error(`${path} requires five parts.`);
    const parts = new Set<string>();
    for (const partValue of song.parts) {
      const part = object(partValue, ['id', 'name', 'testedSkills'], `${path}.parts`);
      text(part.id, 'Battle part ID');
      text(part.name, 'Battle part name');
      if (parts.has(part.id)) throw new Error(`${path} has duplicate part IDs.`);
      parts.add(part.id);
      if (!Array.isArray(part.testedSkills) || !part.testedSkills.length)
        throw new Error(`${path} part needs ordered tested skills.`);
      const skills = new Set<string>();
      for (const requirement of part.testedSkills) {
        const check = object(requirement, ['skill', 'requiredLevel'], `${path}.testedSkills`);
        if (
          typeof check.skill !== 'string' ||
          !['vocals', 'rap', 'dance', 'visual', 'uniqueness', 'leadership'].includes(check.skill)
        )
          throw new Error(`${path} has an unknown or nontechnical skill.`);
        if (skills.has(check.skill)) throw new Error(`${path} has duplicate tested skills.`);
        skills.add(check.skill);
        level(check.requiredLevel, `${path}.requiredLevel`);
      }
    }
  }
}

export function getBattleSongs(): BattleSong[] {
  const catalog: unknown = structuredClone(songs);
  validateBattleSongs(catalog, Object.keys(GENRE_AFFINITIES));
  return freezeSimulationSnapshot(catalog);
}

export const BATTLE_SONGS: BattleSong[] = getBattleSongs();
