import { Song, SongPart, UID } from 'types';
import { generateUniqueId } from './common';
import { DEFAULT_ASSIGNEE } from 'utils/constants';
import { getCompletionPercentage } from 'utils/helpers';

/**
 * Generates a song part object.
 *
 * @param {Partial<SongPart> & Pick<SongPart, 'lineId'>} options - The options for generating the song part.
 * @returns {SongPart} The generated song part object.
 */
export const generatePart = ({
  id = generateUniqueId('p', 3),
  text = '[No text]',
  endTime = 0,
  startTime = 0,
  recommendedAssignee = DEFAULT_ASSIGNEE,
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
 * Retrieves a specific part from a song.
 * @param partId - The ID of the part to retrieve.
 * @param song - The song object containing the parts.
 * @returns The requested song part.
 * @throws Error if the part with the specified ID is not found in the song.
 */
export const getPart = (partId: UID, song: Song): SongPart => {
  const part = song.content[partId] as SongPart;

  if (!part) throw new Error(`Part with id ${partId} not found in song ${song.id}`);

  return part;
};

/**
 * Calculates the duration of a song part.
 * @param partId - The ID of the song part.
 * @param song - The song object containing the part.
 * @returns The duration of the song part in milliseconds.
 */
const getPartDuration = (partId: UID, song: Song): number => {
  const part = getPart(partId, song);

  return part.endTime - part.startTime;
};

/**
 * Calculates the completion percentage of a song part based on certain criteria.
 * @param partId - The ID of the song part.
 * @param song - The song object containing the part.
 * @returns The completion percentage as a number.
 */
export const getPartCompletion = (partId: UID, song: Song): number => {
  const part = getPart(partId, song);

  return getCompletionPercentage([
    getPartDuration(partId, song) > 0,
    part.recommendedAssignee !== DEFAULT_ASSIGNEE,
    Boolean(part.text.trim()),
    Boolean(part.lineId),
  ]);
};

/**
 * Retrieves the summary of a song part.
 * @param partId - The ID of the song part.
 * @param song - The song object containing the part.
 * @returns An object containing the part, duration, completion, and completeness status of the part.
 */
export const getPartSummary = (partId: UID, song: Song) => {
  const part = getPart(partId, song);

  const duration = getPartDuration(partId, song);
  const completion = getPartCompletion(partId, song);

  return {
    id: partId,
    part,
    duration,
    completion,
    status: completion === 100 ? 'complete' : 'pending',
  };
};
