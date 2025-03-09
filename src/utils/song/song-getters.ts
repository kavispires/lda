import { orderBy } from 'lodash';
import type { Song, SongLine, SongPart, SongSection } from 'types';
import { getCompletionPercentage } from 'utils/helpers';

import { getLine, getLineCompletion, getLineStartTime } from './line-getters';
import { getPartCompletion } from './part-getters';
import { getSection, getSectionCompletion } from './section-getters';

/**
 * Generates a new Song object with the provided properties.
 * @param {Pick<Song, 'title' | 'videoId' | 'originalArtist' | 'duration'>} songData - The data used to generate the Song object.
 * @returns {Song} - The generated Song object.
 */
export const generateSong = ({
  title,
  videoId,
  originalArtist,
  startAt,
  endAt,
}: Pick<Song, 'title' | 'videoId' | 'originalArtist' | 'startAt' | 'endAt'>): Song => {
  return {
    id: '_',
    type: 'song',
    title,
    videoId,
    originalArtist,
    sectionIds: [],
    content: {},
    startAt,
    endAt,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ready: false,
  };
};

/**
 * Calculates the completion percentage of a song based on its sections, lines, and parts.
 * @param song - The song object.
 * @returns The completion percentage of the song as a number.
 */
export const getSongCompletion = (song: Song): number => {
  const sections = song.sectionIds.map((sectionId) => getSection(sectionId, song));
  const sectionsCompletion = sections.map((section) => getSectionCompletion(section.id, song));
  const lines = sections.flatMap((section) => section.linesIds.map((lineId) => getLine(lineId, song)));
  const linesCompletion = lines.map((line) => getLineCompletion(line.id, song));
  const partsCompletion = lines.flatMap((line) =>
    line.partsIds.map((partId) => getPartCompletion(partId, song)),
  );

  return getCompletionPercentage([
    song.sectionIds.length > 0,
    ...sectionsCompletion,
    ...linesCompletion,
    ...partsCompletion,
  ]);
};

/**
 * Retrieves all sections of a song.
 */
export const getAllSections = (song: Song) => {
  return song.sectionIds.map((sectionId) => getSection(sectionId, song)) as SongSection[];
};

/**
 * Retrieves all lines from a song and returns them in ascending order based on their start time.
 */
export const getAllLines = (song: Song) => {
  return orderBy(
    Object.values(song.content).filter((entity) => entity.type === 'line') as SongLine[],
    (o) => getLineStartTime(o.id, song),
    'asc',
  );
};

/**
 * Retrieves all parts from a song.
 */
export const getAllParts = (song: Song) => {
  return Object.values(song.content).filter((entity) => entity.type === 'part') as SongPart[];
};

export const getPartsWithDurationCompletion = (song: Song) => {
  const allParts = getAllParts(song);

  const partsWithDuration = allParts.filter((part) => part.startTime !== part.endTime);

  return Math.floor((partsWithDuration.length / allParts.length) * 100);
};

export const isSongReady = (song: Song) => {
  return [
    !!song.title.trim(),
    !!song.videoId.trim(),
    !!song.originalArtist.trim(),
    song.sectionIds.length > 0,
    getAllParts(song).every((part) => (part.endTime ?? 0) - (part.startTime ?? 0) > 0),
  ].every(Boolean);
};
