import songJson from '../data/audition-songs.json';
import type {
  AuditionGenre,
  AuditionLevel,
  AuditionSong,
  AuditionTechnicalSkill,
  AuditionTrack,
} from '../types/audition';
import { GENRE_AFFINITIES } from './attribute-libraries';

const primarySkills = { VOCAL: 'vocals', RAP: 'rap', DANCE: 'dance' } as const;

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, expected: readonly string[], path: string): void {
  if (Object.keys(value).some((key) => !expected.includes(key))) {
    throw new Error(`${path} has unknown fields; expected ${expected.join(', ')}.`);
  }
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${path} must be nonempty text.`);
  return value;
}

function isTrack(value: unknown): value is AuditionTrack {
  return value === 'VOCAL' || value === 'RAP' || value === 'DANCE';
}

function isGenre(value: unknown, genreIds: readonly string[]): value is AuditionGenre {
  return typeof value === 'string' && genreIds.includes(value);
}

function isTechnicalSkill(value: unknown): value is AuditionTechnicalSkill {
  return (
    value === 'vocals' ||
    value === 'rap' ||
    value === 'dance' ||
    value === 'visual' ||
    value === 'uniqueness' ||
    value === 'leadership'
  );
}

export function isAuditionLevel(value: unknown): value is AuditionLevel {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

/** Validates editable JSON and returns a detached catalog with deeply frozen song definitions. */
export function validateAuditionSongs(
  value: unknown,
  genreIds: readonly string[] = Object.keys(GENRE_AFFINITIES),
): AuditionSong[] {
  if (!Array.isArray(genreIds) || genreIds.some((id) => typeof id !== 'string' || !id.trim())) {
    throw new Error('Audition genre IDs must be an array of nonempty strings.');
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Audition songs must be a nonempty array.');
  }
  const ids = new Set<string>();
  const songs = value.map((entry: unknown, index): AuditionSong => {
    const path = `Audition songs[${index}]`;
    const song = record(entry, path);
    keys(song, ['id', 'title', 'description', 'track', 'genre', 'part'], path);
    const id = text(song.id, `${path}.id`);
    if (ids.has(id)) throw new Error(`${path}: duplicate song ID "${id}".`);
    ids.add(id);
    const title = text(song.title, `${path}.title`);
    const description = text(song.description, `${path}.description`);
    const track = song.track;
    if (!isTrack(track)) throw new Error(`${path}.track is unknown.`);
    const genre = song.genre;
    if (!isGenre(genre, genreIds)) throw new Error(`${path}.genre is unknown.`);
    const part = record(song.part, `${path}.part`);
    keys(part, ['testedSkills'], `${path}.part`);
    if (!Array.isArray(part.testedSkills) || part.testedSkills.length === 0) {
      throw new Error(`${path}.part.testedSkills must be a nonempty ordered array.`);
    }
    const seen = new Set<AuditionTechnicalSkill>();
    const testedSkills = part.testedSkills.map((entry: unknown, skillIndex) => {
      const skillPath = `${path}.part.testedSkills[${skillIndex}]`;
      const requirement = record(entry, skillPath);
      keys(requirement, ['skill', 'requiredLevel'], skillPath);
      const skill = requirement.skill;
      if (!isTechnicalSkill(skill)) throw new Error(`${skillPath}.skill is unknown or not technical.`);
      if (seen.has(skill)) throw new Error(`${skillPath}: duplicate tested skill "${skill}".`);
      seen.add(skill);
      const requiredLevel = requirement.requiredLevel;
      if (!isAuditionLevel(requiredLevel)) {
        throw new Error(`${skillPath}.requiredLevel must be an integer from 1 to 5.`);
      }
      return Object.freeze({ skill, requiredLevel });
    });
    if (testedSkills[0].skill !== primarySkills[track]) {
      throw new Error(`${path}: first tested skill must be ${primarySkills[track]} for track ${track}.`);
    }
    return Object.freeze({
      id,
      title,
      description,
      track,
      genre,
      part: Object.freeze({ testedSkills: Object.freeze(testedSkills) }),
    });
  });
  return songs;
}

const editableSongs: unknown = songJson;

export function getAuditionSongs(): AuditionSong[] {
  return validateAuditionSongs(editableSongs);
}
