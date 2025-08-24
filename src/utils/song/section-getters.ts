import type { Song, SongLine, SongSection } from 'types';
import { NULL } from 'utils/constants';
import { getCompletionPercentage } from 'utils/helpers';
import { generateUniqueId } from './common';
import { getLine, getLineEndTime, getLineStartTime, getLineText } from './line-getters';

/**
 * Generates a new song section object.
 *
 * @param {Partial<SongSection>} section - The partial song section object.
 * @returns {SongSection} - The generated song section object.
 */
export const generateSection = ({
  id = generateUniqueId('s', 2),
  kind = NULL,
  number = '',
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

/**
 * Retrieves the value of a specific key from a section.
 * @template K - The key of the SongSection object to retrieve.
 * @param sectionId - The ID of the section.
 * @param key - The key of the value to retrieve.
 * @param song - The song object containing the section.
 * @param defaultValue - An optional default value to return if the key is not found.
 * @returns The value of the specified key from the section.
 */
export const getSectionValue = <K extends keyof SongSection>(
  sectionId: string,
  key: K,
  song: Song,
  defaultValue: SongSection[K],
): SongSection[K] => {
  const section = getSection(sectionId, song);
  return section[key] ?? defaultValue;
};

const getSectionLines = (sectionId: string, song: Song): SongLine[] => {
  const section = getSection(sectionId, song);
  return section?.linesIds?.map((lineId) => getLine(lineId, song));
};

const getSectionName = (sectionId: string, song: Song): string => {
  const section = getSection(sectionId, song);
  return `${section.kind} ${section.number}`;
};

export const getSectionStartTime = (sectionId: string, song: Song): number => {
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
  const partIds = lines.flatMap((line) => line.partsIds);
  const name = getSectionName(sectionId, song);
  const startTime = getSectionStartTime(sectionId, song);
  const endTime = getSectionEndTime(sectionId, song);
  const duration = getSectionDuration(sectionId, song);
  const completion = getSectionCompletion(sectionId, song);

  return {
    id: sectionId,
    section,
    partIds,
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
