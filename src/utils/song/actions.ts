import { FirestoreSong, Song, SongLine, SongPart, SongSection, UID } from 'types';
import { cloneDeep, get, set } from 'lodash';

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
export const updateSong = <T extends keyof Song>(song: Song, path: string, value: Song[T]): Song => {
  const copy = cloneDeep(song);

  set(copy, path, value);

  return copy;
};

export const updateSongContent = (song: Song, id: UID, value: SongSection | SongLine | SongPart): Song => {
  const copy = cloneDeep(song);

  set(copy, `content.${id}`, value);

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
