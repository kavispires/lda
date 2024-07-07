import { Song, SongLine, SongSection } from 'types';
import { generateUniqueId } from './common';
import { NULL, ROMAN_NUMERALS } from 'utils/constants';
import { getLine, getLineEndTime, getLineStartTime, getLineText } from './line-getters';
import { getCompletionPercentage } from 'utils/helpers';

/**
 * Generates a new song section object.
 *
 * @param {Partial<SongSection>} section - The partial song section object.
 * @returns {SongSection} - The generated song section object.
 */
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

/**
 * Retrieves a specific section from a song based on its section ID.
 * @param sectionId - The ID of the section to retrieve.
 * @param song - The song object containing the sections.
 * @returns The section object with the specified ID.
 * @throws An error if the section with the given ID is not found in the song.
 */
export const getSection = (sectionId: string, song: Song): SongSection => {
  const section = song.content[sectionId] as SongSection;

  if (!section) throw new Error(`Section with id ${sectionId} not found in song ${song.id}`);

  return section;
};

const getSectionLines = (sectionId: string, song: Song): SongLine[] => {
  const section = getSection(sectionId, song);
  return section.linesIds.map((lineId) => getLine(lineId, song));
};

const getSectionName = (sectionId: string, song: Song): string => {
  const section = getSection(sectionId, song);
  return `${section.kind} ${ROMAN_NUMERALS[section.number]}`;
};

const getSectionStartTime = (sectionId: string, song: Song): number => {
  const section = getSection(sectionId, song);
  return getLineStartTime(section.linesIds[0], song);
};

const getSectionEndTime = (sectionId: string, song: Song): number => {
  const section = getSection(sectionId, song);
  return getLineEndTime(section.linesIds[section.linesIds.length - 1], song);
};

const getSectionDuration = (sectionId: string, song: Song): number => {
  return getSectionEndTime(sectionId, song) - getSectionStartTime(sectionId, song);
};

export const getSectionCompletion = (sectionId: string, song: Song): number => {
  const section = getSection(sectionId, song);
  return getCompletionPercentage([section.linesIds.length > 0, section.kind !== NULL]);
};

export const getSectionSummary = (sectionId: string, song: Song) => {
  const section = getSection(sectionId, song);
  const lines = getSectionLines(sectionId, song);
  const name = getSectionName(sectionId, song);
  const startTime = getSectionStartTime(sectionId, song);
  const endTime = getSectionEndTime(sectionId, song);
  const duration = getSectionDuration(sectionId, song);
  const completion = getSectionCompletion(sectionId, song);

  return {
    id: sectionId,
    section,
    lines,
    name,
    startTime,
    endTime,
    duration,
    completion,
    status: completion === 100 ? 'complete' : 'pending',
  };
};

export const getSectionsTypeahead = (song: Song) => {
  const allSectionsIds = Object.keys(song.content).filter((id) => id.startsWith('_s'));

  return allSectionsIds.map((id) => {
    const section = getSection(id, song);
    const sectionName = getSectionName(id, song);
    const lineText = section.linesIds[0] ? getLineText(section.linesIds[0], song) : '';
    return {
      value: id,
      label: `${sectionName} - ${lineText} [${id}]`,
    };
  });
};

/**
 * TODO: Implement the following functions:
 * - sort
 * - addLine
 * - removeLine
 */
