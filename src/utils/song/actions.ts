import { cloneDeep, get, set } from 'lodash';
import type { Dictionary, Song, SongLine, SongPart, SongSection, UID, UpdateValue } from 'types';
import { getDifference } from 'utils/helpers';

import { generateLine, getLine } from './line-getters';
import { generatePart, getPart } from './part-getters';
import { getSection } from './section-getters';

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

export const addNewPartToLine = (song: Song, lineId: UID): Song => {
  const copy = cloneDeep(song);

  const line = getLine(lineId, song);
  const newPartProps: Partial<SongPart> & Pick<SongPart, 'lineId'> = { lineId };

  // If the line has other parts, copy over some attributes
  if (line.partsIds.length > 0) {
    const lastPart = getPart(line.partsIds[line.partsIds.length - 1], song);

    newPartProps.recommendedAssignee = lastPart.recommendedAssignee;
  }

  const part = generatePart(newPartProps);
  set(copy, `content.${part.id}`, part);
  set(copy, `content.${lineId}.partsIds`, [...line.partsIds, part.id]);

  copy.updatedAt = Date.now();

  return copy;
};

export const addNewLineToSection = (song: Song, sectionId: UID): Song => {
  const copy = cloneDeep(song);

  const section = getSection(sectionId, song);
  const newLineProps: Partial<SongLine> & Pick<SongLine, 'sectionId'> = { sectionId };

  const line = generateLine(newLineProps);
  set(copy, `content.${line.id}`, line);
  set(copy, `content.${sectionId}.linesIds`, [...section.linesIds, line.id]);

  return addNewPartToLine(copy, line.id);
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
    (get(copy, `content.${part.lineId}.partsIds`) ?? []).filter((id: UID) => id !== partId),
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

export const deletePart = (song: Song, partId: UID): Song => {
  const copy = cloneDeep(song);
  const part = getPart(partId, song);

  // Disconnect part from line
  set(
    copy,
    `content.${part.lineId}.partsIds`,
    (get(copy, `content.${part.lineId}.partsIds`) ?? []).filter((id: UID) => id !== partId),
  );

  // Delete part
  delete copy.content[partId];

  copy.updatedAt = Date.now();

  return copy;
};

export const deleteLine = (song: Song, lineId: UID): Song => {
  const copy = cloneDeep(song);
  const line = getLine(lineId, song);

  if (line.partsIds.length > 0) {
    throw new Error('You must delete all parts from a line before deleting the line.');
  }
  console.log('PRE', get(copy, `content.${line.sectionId}.linesIds`)?.join(', '));
  // Disconnect line from section
  set(
    copy,
    `content.${line.sectionId}.linesIds`,
    (get(copy, `content.${line.sectionId}.linesIds`) ?? []).filter((id: UID) => id !== lineId),
  );

  console.log('POST', get(copy, `content.${line.sectionId}.linesIds`)?.join(', '));

  // Delete line
  delete copy.content[lineId];

  try {
    const line = getLine(lineId, copy);
    console.log(line);
  } catch (e) {
    console.log('ERROR', e);
  }

  copy.updatedAt = Date.now();

  console.log('IT WORKED');
  return copy;
};

export const deleteSection = (song: Song, sectionId: UID): Song => {
  const copy = cloneDeep(song);
  const section = getSection(sectionId, song);

  if (section.linesIds.length > 0) {
    throw new Error('You must delete all lines from a section before deleting the section.');
  }

  // Delete lines
  section.linesIds.forEach((lineId) => deleteLine(copy, lineId));

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
    (get(copy, `content.${lineId}.partsIds`) ?? []).filter((id: UID) => id !== partId),
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
    (get(copy, `content.${sectionId}.linesIds`) ?? []).filter((id: UID) => id !== lineId),
  );

  return copy;
};
