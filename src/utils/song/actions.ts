import { Dictionary, FirestoreSong, Song, SongLine, SongPart, SongSection, UID, UpdateValue } from 'types';
import { cloneDeep, get, set } from 'lodash';
import { getPart } from './part-getters';
import { getDifference } from 'utils/helpers';

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

/**
 * Updates a property of a song object and returns a new copy of the song with the updated property.
 * @template T - The type of the property to update.
 * @param {Song} song - The original song object.
 * @param {string} path - The path to the property to update.
 * @param {Song[T]} value - The new value for the property.
 * @returns {Song} - A new copy of the song object with the updated property.
 */
export const updateSong = (song: Song, path: string, value: UpdateValue): Song => {
  const copy = cloneDeep(song);

  set(copy, path, value);

  return copy;
};

export const batchUpdateSong = (song: Song, updates: Dictionary<UpdateValue>): Song => {
  const copy = cloneDeep(song);

  Object.entries(updates).forEach(([path, value]) => {
    set(copy, path, value);
  });

  return copy;
};

export const updateSongContent = (song: Song, id: UID, value: SongSection | SongLine | SongPart): Song => {
  const copy = cloneDeep(song);

  set(copy, `content.${id}`, value);

  return copy;
};

export const mergeParts = (song: Song, partIds: UID[]): Song => {
  const copy = cloneDeep(song);

  // Order parts by start time
  const parts = partIds
    .map((id) => getPart(id, song))
    .sort((a, b) => {
      return a.startTime - b.startTime;
    });

  const basePart = parts[0];

  // Merge parts
  const mergedPart: SongPart = {
    ...basePart,
    id: basePart.id,
    startTime: basePart.startTime,
    endTime: parts[parts.length - 1].endTime,
    text: parts.map((part) => part.text).join(' '),
  };

  // Delete old parts
  partIds.forEach((id) => delete copy.content[id]);

  // Update song with merged part
  set(copy, `content.${basePart.id}`, mergedPart);

  return copy;
};

export const movePart = (song: Song, partId: UID, targetLineId: UID): Song => {
  const copy = cloneDeep(song);
  const part = getPart(partId, song);
  console.log('START MOVE');
  // Disconnect previous line
  set(
    copy,
    `content.${part.lineId}.partsIds`,
    (get(copy, `content.${part.lineId}.partsIds`) ?? []).filter((id: UID) => id !== partId)
  );

  // Connect new line
  set(copy, `content.${partId}.lineId`, targetLineId);
  set(copy, `content.${targetLineId}.partsIds`, [
    ...(get(copy, `content.${targetLineId}.partsIds`) ?? []),
    partId,
  ]);
  console.log('END MOVE');

  console.log(getDifference(copy, song));

  copy.updatedAt = Date.now();

  return copy;
};

/**
 * Connects a part to a line in a song.
 * @param partId - The ID of the part to connect.
 * @param lineId - The ID of the line to connect the part to.
 * @param song - The song object.
 * @returns A new song object with the part connected to the line.
 */
export const connectPartToLine = (partId: UID, lineId: UID, song: Song): Song => {
  const copy = cloneDeep(song);

  set(copy, `content.${partId}.lineId`, lineId);
  set(copy, `content.${lineId}.partsIds`, [...(get(copy, `content.${lineId}.partsIds`) ?? []), partId]);

  return copy;
};

/**
 * Disconnects a part from a line in the song.
 * @param partId - The ID of the part to disconnect.
 * @param lineId - The ID of the line from which to disconnect the part.
 * @param song - The song object.
 * @returns A new song object with the part disconnected from the line.
 */
export const disconnectPartFromLine = (partId: UID, lineId: UID, song: Song): Song => {
  const copy = cloneDeep(song);

  set(copy, `content.${partId}.lineId`, '');
  set(
    copy,
    `content.${lineId}.partsIds`,
    (get(copy, `content.${lineId}.partsIds`) ?? []).filter((id: UID) => id !== partId)
  );

  return copy;
};

/**
 * Connects a line to a section in a song.
 *
 * @param lineId - The ID of the line to connect.
 * @param sectionId - The ID of the section to connect the line to.
 * @param song - The song object.
 * @returns A new song object with the line connected to the section.
 */
export const connectLineToSection = (lineId: UID, sectionId: UID, song: Song): Song => {
  const copy = cloneDeep(song);

  set(copy, `content.${lineId}.sectionId`, sectionId);
  set(copy, `content.${sectionId}.linesIds`, [...(get(copy, `content.${sectionId}.linesIds`) ?? []), lineId]);

  return copy;
};

/**
 * Disconnects a line from a section in a song.
 *
 * @param lineId - The ID of the line to disconnect.
 * @param sectionId - The ID of the section from which to disconnect the line.
 * @param song - The song object.
 * @returns A new song object with the line disconnected from the section.
 */
export const disconnectLineFromSection = (lineId: UID, sectionId: UID, song: Song): Song => {
  const copy = cloneDeep(song);

  set(copy, `content.${lineId}.sectionId`, '');
  set(
    copy,
    `content.${sectionId}.linesIds`,
    (get(copy, `content.${sectionId}.linesIds`) ?? []).filter((id: UID) => id !== lineId)
  );

  return copy;
};