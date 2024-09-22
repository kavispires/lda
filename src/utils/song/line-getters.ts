import { Song, SongLine, SongPart, SongSection } from 'types';
import { generateUniqueId } from './common';
import { getSection } from './section-getters';
import { getPart } from './part-getters';
import { getCompletionPercentage } from 'utils/helpers';

/**
 * Generates a song line object.
 * @param {Partial<SongLine> & Pick<SongLine, 'sectionId'>} options - The options for generating the song line.
 * @returns {SongLine} The generated song line object.
 */
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

/**
 * Retrieves a specific line from a song based on its ID.
 * @param lineId - The ID of the line to retrieve.
 * @param song - The song object containing the lines.
 * @returns The line object corresponding to the given ID.
 * @throws An error if the line with the specified ID is not found in the song.
 */
export const getLine = (lineId: string, song: Song, bypassError?: boolean): SongLine => {
  const line = song.content[lineId] as SongLine;

  if (!line) {
    // TODO: this is hacky af
    if (bypassError) return { partsIds: [] } as unknown as SongLine;
    throw new Error(`Line with id ${lineId} not found in song ${song.id}`);
  }

  return line;
};

/**
 * Retrieves the section to which a line belongs.
 * @param lineId - The ID of the line.
 * @param song - The song object containing the line.
 * @returns The section object to which the line belongs.
 */
const getLineSection = (lineId: string, song: Song): SongSection => {
  const line = getLine(lineId, song);
  return getSection(line.sectionId, song);
};

/**
 * Retrieves the parts of a line.
 * @param lineId - The ID of the line.
 * @param song - The song object containing the line.
 * @returns The parts of the line.
 */
export const getLineParts = (lineId: string, song: Song): SongPart[] => {
  const line = getLine(lineId, song);
  return line.partsIds.map((partId) => getPart(partId, song));
};

/**
 * Retrieves the text of a line.
 * @param lineId - The ID of the line.
 * @param song - The song object containing the line.
 * @returns The text of the line.
 */
export const getLineText = (lineId: string, song: Song): string => {
  const line = getLine(lineId, song);
  if (line.partsIds.length === 0) return '[Empty Line]';

  return getLineParts(lineId, song)
    .map(({ text }) => text)
    .join(' ');
};

/**
 * Retrieves the start time of a line.
 * @param lineId - The ID of the line.
 * @param song - The song object containing the line.
 * @returns The start time of the line.
 */
export const getLineStartTime = (lineId: string, song: Song): number => {
  return getLineParts(lineId, song)?.[0]?.startTime ?? 0;
};

/**
 * Retrieves the end time of a line.
 * @param lineId - The ID of the line.
 * @param song - The song object containing the line.
 * @returns The end time of the line.
 */
export const getLineEndTime = (lineId: string, song: Song): number => {
  return getLineParts(lineId, song).slice(-1)?.[0]?.endTime ?? 0;
};

/**
 * Calculates the duration of a line.
 * @param lineId - The ID of the line.
 * @param song - The song object containing the line.
 * @returns The duration of the line in milliseconds.
 */
const getLineDuration = (lineId: string, song: Song): number => {
  return getLineEndTime(lineId, song) - getLineStartTime(lineId, song);
};

/**
 * Calculates the completion percentage of a line in a song.
 * @param lineId - The ID of the line.
 * @param song - The song object.
 * @returns The completion percentage of the line.
 */
export const getLineCompletion = (lineId: string, song: Song): number => {
  const line = getLine(lineId, song);
  return getCompletionPercentage([Boolean(line.sectionId), line.partsIds.length > 0]);
};

/**
 * Retrieves the summary of a line.
 * @param lineId - The ID of the line.
 * @param song - The song object containing the line.
 * @returns The summary of the line.
 */
export const getLineSummary = (lineId: string, song: Song) => {
  const line = getLine(lineId, song);
  const section = getLineSection(lineId, song);
  const text = getLineText(lineId, song);
  const startTime = getLineStartTime(lineId, song);
  const endTime = getLineEndTime(lineId, song);
  const duration = getLineDuration(lineId, song);
  const completion = getLineCompletion(lineId, song);

  return {
    id: lineId,
    line,
    section,
    text,
    startTime,
    endTime,
    duration,
    completion,
    status: completion === 100 ? 'complete' : 'pending',
  };
};

export const getLinesTypeahead = (song: Song) => {
  const allLinesIds = Object.keys(song.content).filter((id) => id.startsWith('_l'));

  return allLinesIds.map((id) => {
    return {
      value: id,
      label: `${getLineText(id, song)} [${id}]`,
    };
  });
};

/**
 * TODO: Implement the following functions:
 * - sort
 * - addPart
 * - removePart
 * - connectSection
 * - disconnectSection
 */
