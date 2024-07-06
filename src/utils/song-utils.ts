import { FirestoreSong, Song, SongLine, SongPart, SongSection } from 'types';

import { NULL } from './constants';

/**
 * Generates a unique identifier.
 * @param length The length of the generated identifier. Default is 5.
 * @returns A unique identifier.
 */
export const generateUniqueId = (function () {
  const cache: Record<string, true> = {};

  function generate(prefix = '', length = 3): string {
    const id =
      '_' +
      prefix +
      Math.random()
        .toString(36)
        .slice(2, 2 + length);
    if (cache[id]) {
      return generate(prefix, length);
    }

    cache[id] = true;
    return id;
  }

  return generate;
})();

export const generateSong = ({
  title,
  videoId,
  originalArtist,
  duration,
}: Pick<Song, 'title' | 'videoId' | 'originalArtist' | 'duration'>): Song => {
  return {
    id: '_',
    type: 'song',
    title,
    videoId,
    originalArtist,
    duration,
    sectionIds: [],
    content: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};

export const generateSection = ({
  id = generateUniqueId('s', 2),
  kind = NULL,
  number = 1,
  linesIds = [],
  ...rest
}: Partial<SongSection>): SongSection => {
  return {
    id,
    type: 'section',
    kind,
    number,
    linesIds,
    ...rest,
  };
};

export const generateLine = ({
  id = generateUniqueId('l', 2),
  partsIds = [],
  sectionId,
  ...rest
}: Partial<SongLine> & Pick<SongLine, 'sectionId'>): SongLine => {
  return {
    id,
    type: 'line',
    partsIds,
    sectionId,
    ...rest,
  };
};

export const generatePart = ({
  id = generateUniqueId('p', 3),
  text = '',
  startTime = 0,
  endTime = 0,
  recommendedAssignee = 'X',
  ...rest
}: Partial<SongPart> & Pick<SongPart, 'lineId'>): SongPart => {
  return {
    id,
    type: 'part',
    text,
    startTime,
    endTime,
    recommendedAssignee,
    ...rest,
  };
};

/**
 * Serializes a Song object into a FirestoreSong object.
 * @param song - The Song object to be serialized.
 * @returns The serialized FirestoreSong object.
 */
export const serializeSong = (song: Song): FirestoreSong => {
  return {
    ...song,
    content: JSON.stringify(song.content),
  };
};

/**
 * Deserializes a FirestoreSong object into a Song object.
 * @param fbSong - The FirestoreSong object to deserialize.
 * @returns The deserialized Song object.
 */
export const deserializeSong = (fbSong: FirestoreSong): Song => {
  return {
    ...fbSong,
    content: JSON.parse(fbSong.content),
  };
};
