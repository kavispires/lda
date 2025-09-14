import { cloneDeep, orderBy, set } from 'lodash';
import type { Dictionary, Song, SongLine, SongPart, SongSection, UID, UpdateValue } from 'types';
import { LETTERS, ROMAN_NUMERALS } from 'utils/constants';
import { removeDuplicates } from 'utils/helpers';
import { generateLine, getLine, getLineStartTime, getLineSummary, getLineValue } from './line-getters';
import { generatePart, getPart } from './part-getters';
import {
  generateSection,
  getSection,
  getSectionSummary,
  getSectionsTypeahead,
  getSectionValue,
} from './section-getters';

/**
 * Updates a property of a song object and returns a new copy of the song with the updated property.
 * @param song - The original song object.
 * @param path - The path to the property to update.
 * @param value - The new value for the property.
 * @param shallow - Optional flag to determine if the song should be cloned deeply (default) or not (used when another action is called within another action).
 * @returns A new song object with the applied updates.
 */
export const updateSong = (song: Song, path: string, value: UpdateValue, shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);

  set(copy, path, value);

  return copy;
};

/**
 * Batch updates a song object with multiple updates.
 * @param song - The song object to update.
 * @param updates - A dictionary of updates where keys are object paths and values are the new values.
 * @param shallow - Optional flag to determine if the song should be cloned deeply (default) or not (used when another action is called within another action).
 * @returns A new song object with the applied updates.
 */
export const batchUpdateSong = (song: Song, updates: Dictionary<UpdateValue>, shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);

  Object.entries(updates).forEach(([path, value]) => {
    set(copy, path, value);
  });

  return copy;
};

/**
 * Updates a specific part of a song's content.
 *
 * @param song - The song object to update
 * @param id - The unique identifier of the content section to update
 * @param value - The new value to set (can be a SongSection, SongLine, or SongPart)
 * @param shallow - If true, performs a shallow copy of the song. If false or undefined, performs a deep clone.
 * @returns A new song object with the updated content
 */
export const updateSongContent = (
  song: Song,
  id: UID,
  value: SongSection | SongLine | SongPart,
  shallow?: boolean,
): Song => {
  const copy = shallow ? song : cloneDeep(song);

  set(copy, `content.${id}`, value);

  return copy;
};

/**
 * Updates a specific value of a song section in a Song object.
 *
 * @param song - The Song object to update
 * @param id - The unique identifier of the section to update
 * @param key - The property key of the section to update
 * @param value - The new value to set for the specified key
 * @param shallow - If true, performs a shallow copy of the song object instead of a deep clone
 * @returns A new Song object with the updated section value
 */
export const updateSongSectionContentValue = (
  song: Song,
  id: UID,
  key: keyof SongSection,
  value: SongSection[keyof SongSection],
  shallow?: boolean,
): Song => {
  const copy = shallow ? song : cloneDeep(song);

  set(copy, `content.${id}.${key}`, value);

  return copy;
};

/**
 * Updates a specific property of a song line in a song object.
 *
 * @param song - The song object to update
 * @param id - The unique identifier of the song line to update
 * @param key - The property name of the song line to update
 * @param value - The new value to set for the specified property
 * @param shallow - Optional flag to determine if a shallow copy should be made instead of a deep clone
 * @returns A new song object with the updated property value
 */
export const updateSongLineContentValue = (
  song: Song,
  id: UID,
  key: keyof SongLine,
  value: SongLine[keyof SongLine],
  shallow?: boolean,
): Song => {
  const copy = shallow ? song : cloneDeep(song);

  set(copy, `content.${id}.${key}`, value);

  return copy;
};

/**
 * Updates a value of a specific key in a song part within a song.
 *
 * @param song - The song object to update
 * @param id - The unique identifier of the song part to update
 * @param key - The key within the song part to update
 * @param value - The new value to set for the specified key
 * @param shallow - Optional flag to determine if a shallow copy should be made instead of a deep clone
 * @returns A new song object with the updated value (either a shallow or deep copy based on the shallow parameter)
 */
export const updateSongPartContentValue = (
  song: Song,
  id: UID,
  key: keyof SongPart,
  value: SongPart[keyof SongPart],
  shallow?: boolean,
): Song => {
  const copy = shallow ? song : cloneDeep(song);

  set(copy, `content.${id}.${key}`, value);

  return copy;
};

/**
 * Adds a new part to a specific line in a song.
 *
 * @param song - The song object to modify
 * @param lineId - The unique identifier of the line to add a part to
 * @param shallow - When true, modifies the original song object; when false or undefined, creates a deep clone before modification
 * @returns A modified song object with the new part added to the specified line
 *
 * @remarks
 * - If the line already has parts, the new part will inherit the recommendedAssignee from the last part
 * - Updates the song's updatedAt timestamp to the current time
 * - Ensures no duplicate part IDs exist in the line's partsIds array
 */
export const addNewPartToLine = (song: Song, lineId: UID, shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);

  const line = getLine(lineId, song);
  const newPartProps: Partial<SongPart> & Pick<SongPart, 'lineId'> = { lineId };

  // If the line has other parts, copy over some attributes
  if (line.partsIds.length > 0) {
    const lastPart = getPart(line.partsIds[line.partsIds.length - 1], song);

    newPartProps.recommendedAssignee = lastPart.recommendedAssignee;
  }

  const part = generatePart(newPartProps, copy);
  updateSongContent(copy, part.id, part, true);
  updateSongContent(copy, lineId, { ...line, partsIds: removeDuplicates([...line.partsIds, part.id]) }, true);

  copy.updatedAt = Date.now();

  return copy;
};

export const addNewTextAsPartsToLine = (song: Song, lineId: UID, text: string[], shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);

  const line = getLine(lineId, copy);
  const parts = text.map((partText) => {
    const part = generatePart({ lineId, text: partText }, copy);
    updateSongContent(copy, part.id, part, true);
    return part.id;
  });

  updateSongContent(
    copy,
    lineId,
    { ...line, partsIds: removeDuplicates([...line.partsIds, ...parts]) },
    true,
  );

  copy.updatedAt = Date.now();

  return copy;
};

/**
 * Adds a new line to a specified section in a song.
 *
 * @param song - The song object to which the line will be added
 * @param sectionId - The unique identifier of the section where the line will be added
 * @param shallow - When true, modifies the song object directly; when false or undefined, creates a deep clone before modifications
 * @returns A modified song object with the new line added to the specified section
 *
 * @remarks
 * This function:
 * 1. Creates a new line associated with the given section
 * 2. Updates the song content with the new line
 * 3. Updates the section to include the new line's ID
 * 4. Adds a new part to the created line
 */
export const addNewLineToSection = (song: Song, sectionId: UID, shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);

  const section = getSection(sectionId, copy);
  const newLineProps: Partial<SongLine> & Pick<SongLine, 'sectionId'> = { sectionId };

  const line = generateLine(newLineProps, copy);
  updateSongContent(copy, line.id, line, true);
  updateSongContent(
    copy,
    sectionId,
    { ...section, linesIds: removeDuplicates([...section.linesIds, line.id]) },
    true,
  );

  copy.updatedAt = Date.now();

  return addNewPartToLine(copy, line.id, true);
};

export const addTextAsNewLinesToSection = (
  song: Song,
  sectionId: UID,
  text: string[][],
  shallow?: boolean,
): Song => {
  const copy = shallow ? song : cloneDeep(song);

  // For each line, create its part
  text.forEach((newLineParts) => {
    const newLineProps: Partial<SongLine> & Pick<SongLine, 'sectionId'> = { sectionId };
    const line = generateLine(newLineProps, copy);
    updateSongContent(copy, line.id, line, true);
    connectLineToSection(line.id, sectionId, copy, true);

    newLineParts.forEach((partText) => {
      const part = generatePart({ lineId: line.id, text: partText }, copy);
      updateSongContent(copy, part.id, part, true);
      connectPartToLine(part.id, line.id, copy, true);
    });
  });

  copy.updatedAt = Date.now();

  return copy;
};

/**
 * Adds a new section to a song.
 *
 * @param song - The song to add the section to
 * @param shallow - When true, modifies the song directly without deep cloning it
 * @returns A copy of the song with the new section added (or the same object if shallow is true)
 */
export const addNewSectionToSong = (song: Song, newSection?: SongSection, shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);

  const section = newSection || generateSection({}, copy);
  copy.sectionIds = [...copy.sectionIds, section.id];

  updateSongContent(copy, section.id, section, true);

  copy.updatedAt = Date.now();

  if (newSection) {
    return copy;
  }

  return addNewLineToSection(copy, section.id, true);
};

/**
 * Merges multiple song parts into a single part.
 *
 * The merged part will have:
 * - The properties of the first part (sorted by start time)
 * - Start time of the first part
 * - End time of the last part
 * - Text concatenated from all parts with spaces in between
 *
 * @param song - The song object containing the parts to merge
 * @param partIds - Array of part IDs to merge
 * @param shallow - If true, modifies the original song object; if false or undefined, creates a deep clone
 * @returns The modified song object with merged parts
 */
export const mergeParts = (song: Song, partIds: UID[], shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);

  // Order parts by start time
  const parts = orderBy(
    partIds.map((id) => getPart(id, song)),
    ['startTime'],
    ['asc'],
  );

  const basePart = parts[0];

  // Disconnect other parts before merge
  parts.slice(1).forEach((part) => {
    disconnectPartFromLine(part.id, part.lineId, copy, true);
  });

  // Merge parts
  const mergedPart: SongPart = {
    ...basePart,
    id: basePart.id,
    startTime: basePart.startTime,
    endTime: parts[parts.length - 1].endTime,
    text: parts.map((part) => part.text).join(' '),
  };

  // Update song with merged part
  updateSongContent(copy, basePart.id, mergedPart, true);

  return copy;
};

/**
 * Moves multiple parts to the same line in a song. The parts are rearranged based on their start times.
 *
 * @param song - The song object containing the parts to be moved
 * @param partIds - Array of part IDs to be moved together
 * @param shallow - If true, modifies the original song object; if false or undefined, creates a deep clone
 * @returns The modified song object
 *
 * @remarks
 * The function takes the first part's line as the target line and moves all other parts to that line.
 * Parts are ordered by their start times in ascending order before being processed.
 */
export const movePartsTogether = (song: Song, partIds: UID[], shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);

  // Order parts by start time
  const parts = orderBy(
    partIds.map((id) => getPart(id, song)),
    ['startTime'],
    ['asc'],
  );

  const lineId = parts[0].lineId;

  // Disconnect the other lines and connect them to the first line
  parts.slice(1).forEach((part) => {
    disconnectPartFromLine(part.id, part.lineId, copy, true);
    connectPartToLine(part.id, lineId, copy, true);
  });

  copy.updatedAt = Date.now();

  sortLine(copy, lineId, true);

  return copy;
};

/**
 * Moves a song part to a different line.
 *
 * This function performs the following operations:
 * 1. Creates a copy of the song (deep or shallow based on the shallow parameter)
 * 2. Retrieves the part to be moved
 * 3. Verifies the target line exists
 * 4. Disconnects the part from its current line
 * 5. Connects the part to the target line
 * 6. Updates the song's updatedAt timestamp
 *
 * @param song - The song object to modify
 * @param partId - The unique ID of the part to move
 * @param targetLineId - The unique ID of the line to move the part to
 * @param shallow - If true, performs a shallow copy of the song; otherwise performs a deep copy
 * @returns A modified copy of the song with the part moved to the target line
 * @throws Error if the target line does not exist
 */
export const movePartToLine = (song: Song, partId: UID, targetLineId: UID, shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);

  const part = getPart(partId, song);

  // Make sure the line exists
  const targetLine = getLine(targetLineId, copy);
  if (!targetLine) {
    throw new Error(`Target line ${targetLineId} does not exist`);
  }

  // Disconnect the current line
  disconnectPartFromLine(part.id, part.lineId, copy, true);

  // Connect new line
  connectPartToLine(part.id, targetLineId, copy, true);

  sortLine(copy, targetLineId, true);

  copy.updatedAt = Date.now();

  return copy;
};

/**
 * Deletes a part from a song
 *
 * @param song - The song from which to delete a part
 * @param partId - The unique identifier of the part to delete
 * @param shallow - Optional flag to indicate if a shallow copy of the song should be made instead of a deep clone
 * @returns A copy of the song with the part deleted
 */
export const deletePart = (song: Song, partId: UID, shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);

  const part = getPart(partId, song);

  // Disconnect part from line
  disconnectPartFromLine(partId, part.lineId, copy, true);

  // Delete part
  delete copy.content[partId];

  copy.updatedAt = Date.now();

  return copy;
};

// TODO: Verify
export const deleteLine = (song: Song, lineId: UID, shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);

  const line = getLine(lineId, song);

  if (line.partsIds.length > 0) {
    throw new Error('You must delete all parts from a line before deleting the line.');
  }

  // Disconnect line from section
  disconnectLineFromSection(line.id, line.sectionId, copy, true);

  // Delete line
  delete copy.content[line.id];

  copy.updatedAt = Date.now();

  return copy;
};

/**
 * Merges multiple lines in a song into a single line.
 *
 * This function takes a song and an array of line IDs to merge. It keeps the first line
 * (ordered by start time) and moves all parts from other lines into this keeper line.
 *
 * @param song - The song object containing lines to merge
 * @param linesIds - Array of line IDs to be merged
 * @param shallow - If true, performs a shallow copy of the song; otherwise, performs a deep clone
 * @returns A new song object with the specified lines merged
 *
 * @remarks
 * The function performs the following steps:
 * 1. Orders the lines by start time
 * 2. Selects the first line as the "keeper" line
 * 3. Disconnects all parts from the other lines
 * 4. Connects all those parts to the keeper line
 */
export const mergeLines = (song: Song, linesIds: UID[], shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);

  // Order lines by start time
  const lines = orderBy(
    linesIds.map((id) => getLineSummary(id, song)),
    ['startTime'],
    ['asc'],
  );

  // Get first line as keeper
  const baseLine = lines[0];
  const linesToMerge = lines.slice(1);

  // Disconnect all other parts from their lines
  linesToMerge.forEach((line) => {
    line.line.partsIds.forEach((partId) => {
      const part = getPart(partId, copy);
      disconnectPartFromLine(partId, part.lineId, copy, true);
    });
  });

  // Connect all other parts to the keeper
  linesToMerge.forEach((line) => {
    line.line.partsIds.forEach((partId) => {
      connectPartToLine(partId, baseLine.id, copy, true);
    });
  });

  // Disconnect the other lines from their original sections
  linesToMerge.forEach((line) => {
    disconnectLineFromSection(line.id, line.section.id, copy, true);
  });

  sortLine(copy, baseLine.id, true);

  return copy;
};

/**
 * Moves specified lines to a target section within a song.
 *
 * This function:
 * 1. Disconnects the specified lines from their original sections
 * 2. Connects these lines to the target section
 * 3. Removes any sections that become empty after the lines are moved
 *
 * @param song - The song object to modify
 * @param linesIds - Array of line IDs to be moved
 * @param sectionId - Target section ID where lines will be moved to
 * @param shallow - If true, performs a shallow modification on the original song object;
 *                  if false or undefined, creates a deep copy before modification
 * @returns The modified song object (either the original or a deep copy, depending on the shallow parameter)
 */
export const moveLinesToSection = (song: Song, linesIds: UID[], sectionId: UID, shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);

  const modifiedSections: UID[] = [];

  // Disconnect lines from their original sections
  linesIds.forEach((lineId) => {
    const line = getLine(lineId, copy);
    modifiedSections.push(line.sectionId);
    disconnectLineFromSection(lineId, line.sectionId, copy, true);
  });

  // Connect lines to the new section
  linesIds.forEach((lineId) => {
    connectLineToSection(lineId, sectionId, copy, true);
  });

  // Verify if any section is now empty, if so, remove it from song
  modifiedSections.forEach((sectionId) => {
    const section = getSection(sectionId, copy);
    if (section.linesIds.length === 0) {
      deleteSection(copy, sectionId, true);
    }
  });

  sortSection(copy, sectionId, true);

  return copy;
};

/**
 * Deletes a section from a song.
 *
 * @param song - The song object containing the section to delete
 * @param sectionId - The unique ID of the section to delete
 * @param shallow - If true, modifies the original song object; if false or undefined, creates a deep clone first
 * @returns The modified song object (either the original or a clone depending on the shallow parameter)
 * @throws Error if the section contains lines (section.linesIds.length > 0)
 */
export const deleteSection = (song: Song, sectionId: UID, shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);
  const section = getSection(sectionId, song);

  if (section.linesIds.length > 0) {
    throw new Error('You must delete all lines from a section before deleting the section.');
  }

  // Delete lines
  section.linesIds.forEach((lineId) => {
    deleteLine(copy, lineId);
  });

  copy.updatedAt = Date.now();

  return copy;
};

export const mergeSections = (song: Song, sectionIds: UID[], shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);

  // Order sections by start time
  const sections = orderBy(
    sectionIds.map((id) => getSectionSummary(id, song)),
    ['startTime'],
    ['asc'],
  );

  // Get first section as keeper
  const baseSection = sections[0];
  const sectionsToMerge = sections.slice(1);

  // Disconnect all other lines from their sections
  sectionsToMerge.forEach((section) => {
    section.section.linesIds.forEach((lineId) => {
      const line = getLine(lineId, copy);
      disconnectLineFromSection(lineId, line.sectionId, copy, true);
    });
  });

  // Connect all other lines to the keeper
  sectionsToMerge.forEach((section) => {
    section.section.linesIds.forEach((lineId) => {
      connectLineToSection(lineId, baseSection.id, copy, true);
    });
  });

  const sectionsIdsToMerge = sectionsToMerge.map((section) => section.id);

  // Remove empty sections from song
  // Remove merged sections from song's sectionIds
  copy.sectionIds = copy.sectionIds.filter((id) => !sectionsIdsToMerge.includes(id));

  // Delete the merged sections from content
  sectionsIdsToMerge.forEach((sectionId) => {
    delete copy.content[sectionId];
  });

  sortSection(copy, baseSection.id, true);

  return copy;
};

/**
 * Converts a part to a new line in the song.
 * @param song - The song object.
 * @param partId - The ID of the part to convert.
 * @param shallow - Whether to perform a shallow copy.
 * @returns A new song object with the part converted to a new line.
 */
export const convertPartToNewLine = (song: Song, partId: UID, shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);

  const part = getPart(partId, song);
  const lineId = part.lineId;
  const previousLine = getLine(lineId, song);

  // Disconnect part from previous line
  disconnectPartFromLine(partId, lineId, copy, true);

  // Create new line
  const newLine = generateLine({
    partsIds: [partId],
    sectionId: previousLine.sectionId,
  });
  // Add line to song
  updateSongContent(copy, newLine.id, newLine, true);

  // Connect line to section, and line to part
  connectPartToLine(partId, newLine.id, copy, true);
  connectLineToSection(newLine.id, previousLine.sectionId, copy, true);

  return copy;
};

/**
 * Connects a part to a line in a song (and vice-versa).
 * @param partId - The ID of the part to connect.
 * @param lineId - The ID of the line to connect the part to.
 * @param song - The song object.
 * @returns A new song object with the part connected to the line.
 */
export const connectPartToLine = (partId: UID, lineId: UID, song: Song, shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);

  updateSongPartContentValue(copy, partId, 'lineId', lineId, true);
  updateSongLineContentValue(
    copy,
    lineId,
    'partsIds',
    removeDuplicates([...getLineValue(lineId, 'partsIds', song, []), partId]),
    true,
  );

  return copy;
};

/**
 * Disconnects a part from a line in the song (and vice-versa).
 * @param partId - The ID of the part to disconnect.
 * @param lineId - The ID of the line from which to disconnect the part.
 * @param song - The song object.
 * @returns A new song object with the part disconnected from the line.
 */
export const disconnectPartFromLine = (partId: UID, lineId: UID, song: Song, shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);

  updateSongPartContentValue(copy, partId, 'lineId', '', true);
  updateSongLineContentValue(
    copy,
    lineId,
    'partsIds',
    getLineValue(lineId, 'partsIds', song, []).filter((id: UID) => id !== partId),
    true,
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
export const connectLineToSection = (lineId: UID, sectionId: UID, song: Song, shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);

  updateSongLineContentValue(copy, lineId, 'sectionId', sectionId, true);
  updateSongSectionContentValue(
    copy,
    sectionId,
    'linesIds',
    removeDuplicates([...getSectionValue(sectionId, 'linesIds', song, []), lineId]),
    true,
  );

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
export const disconnectLineFromSection = (
  lineId: UID,
  sectionId: UID,
  song: Song,
  shallow?: boolean,
): Song => {
  const copy = shallow ? song : cloneDeep(song);

  updateSongLineContentValue(copy, lineId, 'sectionId', '', true);

  updateSongSectionContentValue(
    copy,
    sectionId,
    'linesIds',
    getSectionValue(sectionId, 'linesIds', song, []).filter((id: UID) => id !== lineId),
    true,
  );

  return copy;
};

/**
 * Determines and applies section numbering for a song based on section types and their sequence.
 *
 * Numbering rules:
 * - If a section kind appears only once in the song, it gets no number ('')
 * - Consecutive sections of the same kind are numbered with Roman numerals (I, II, III, etc.)
 * - If multiple sections of the same kind appear consecutively within a group, they get additional
 *   letter notation (I.A, I.B, I.C, etc.)
 *
 * @param song - The song object to process
 * @param shallow - If true, modifies the original song object; if false or undefined, creates a deep clone
 * @returns The processed song object with updated section numbering
 *
 * @example
 *  For a song with sections: Verse, Chorus, Verse, Bridge, Chorus
 *  After processing:
 *  - First Verse: I
 *  - First Chorus: I
 *  - Second Verse: II
 *  - Bridge: '' (no number since it appears once)
 *  - Second Chorus: II
 */
export const determineSectionsNumbering = (song: Song, shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);

  // Get all sections and order them by starting time
  const allSectionsIds = getSectionsTypeahead(copy);

  // Count how many time a section kind happens in the song
  const sectionsCount: Record<string, number> = {};
  allSectionsIds.forEach((entry) => {
    const section = getSection(entry.value, copy);
    sectionsCount[section.kind] = (sectionsCount[section.kind] || 0) + 1;
  });

  if (sectionsCount.NULL > 0) return copy;

  // Set the property .number of each section following the rules:
  // If the section kind only happens once, set .number as ''
  // If the sections are consecutive (in order in the allSectionsIds), it should be numbered I, II, III, etc.
  // However, if the same section type happens within the same chorus block, it should be appended by a capital letter A,B,C (I.A, I.B, I.C...)

  // Track occurrences of each section kind
  const kindCounter: Record<string, number> = {};
  // Track consecutive sections of the same kind
  const consecutiveGroups: Record<string, string[]> = {};
  let currentGroup: string | null = null;
  let currentKind: string | null = null;

  // First pass: identify consecutive groups of the same section kind
  allSectionsIds.forEach((entry, index) => {
    const sectionId = entry.value;
    const section = getSection(sectionId, copy);

    if (currentKind === section.kind) {
      // This section is of the same kind as the previous one
      if (currentGroup) {
        consecutiveGroups[currentGroup].push(sectionId);
      }
    } else {
      // This is a new kind of section
      currentKind = section.kind;
      currentGroup = `${section.kind}_${index}`;
      consecutiveGroups[currentGroup] = [sectionId];
    }
  });

  // Second pass: apply numbering rules
  Object.values(consecutiveGroups).forEach((group) => {
    const firstSectionId = group[0];
    const firstSection = getSection(firstSectionId, copy);
    const sectionKind = firstSection.kind;

    // If this section kind only appears once in the song
    if (sectionsCount[sectionKind] === 1) {
      updateSongSectionContentValue(copy, firstSectionId, 'number', '', true);
      return;
    }

    // If this kind isn't being tracked yet
    if (kindCounter[sectionKind] === undefined) {
      kindCounter[sectionKind] = 0;
    }

    // Increment counter for this kind
    kindCounter[sectionKind]++;

    // Apply Roman numeral to the first occurrence
    const romanNumeral = ROMAN_NUMERALS[kindCounter[sectionKind] - 1];

    if (group.length === 1) {
      // Single section of this kind in this group
      updateSongSectionContentValue(copy, firstSectionId, 'number', romanNumeral, true);
    } else {
      // Multiple consecutive sections of the same kind
      // First one gets the Roman numeral + '.A'
      updateSongSectionContentValue(copy, firstSectionId, 'number', `${romanNumeral}.A`, true);

      // Subsequent ones get the same Roman numeral + '.B', '.C', etc.
      group.slice(1).forEach((sectionId, idx) => {
        const letterIndex = idx + 1; // Start at B (index 1)
        updateSongSectionContentValue(
          copy,
          sectionId,
          'number',
          `${romanNumeral}.${LETTERS[letterIndex]}`,
          true,
        );
      });
    }
  });

  return copy;
};

export const sortLine = (song: Song, lineId: UID, shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);

  const line = getLine(lineId, copy);
  line.partsIds = orderBy(line.partsIds, [(partId) => getPart(partId, copy).startTime], ['asc']);

  return copy;
};

export const sortSection = (song: Song, sectionId: UID, shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);

  const section = getSection(sectionId, copy);

  // Sort all lines first
  section.linesIds.forEach((lineId) => {
    sortLine(song, lineId, true);
  });

  section.linesIds = orderBy(section.linesIds, [(lineId) => getLineStartTime(lineId, copy)], ['asc']);

  return copy;
};

export const sortSong = (song: Song, shallow?: boolean): Song => {
  const copy = shallow ? song : cloneDeep(song);

  // Sort all sections
  copy.sectionIds.forEach((sectionId) => {
    sortSection(copy, sectionId, true);
  });

  return copy;
};
