import type { Distribution, FUID, Song, UID } from '@types';
import { distributor } from '@utils';
import { ALL_ID, NONE_ID, SECTION_KINDS } from '@utils/constants';

export type SectionMode = 'all' | 'minimal' | 'none';
export type AdlibMode = 'all' | 'minimal' | 'none';
export type DistributionMode = 'all' | 'minimal' | 'none';

/**
 * Section kinds that are always shown when `sectionMode` is `minimal`.
 */
const MINIMAL_SECTION_KINDS = new Set<string>([
  SECTION_KINDS.PRE_CHORUS,
  SECTION_KINDS.CHORUS,
  SECTION_KINDS.BRIDGE,
]);

/**
 * Words that, once a line's text is stripped of special characters, are considered
 * "filler" ad-libs (e.g. "(Oh!)", "Yeah~") and get excluded when `adlibMode` is `minimal`.
 * Tweak this list as needed.
 */
export const ADLIB_FILLER_WORDS: string[] = [
  'oh',
  'eh',
  'hm',
  'huh',
  'uh',
  'woah',
  'ah',
  'yeah',
  'hey',
  'wow',
  'ye',
];

const SPECIAL_CHARS_REGEX = /[()[\]{}!~.,?;:'"*_-]/g;

/**
 * Removes special characters/punctuation commonly found around ad-libs.
 */
export const stripSpecialCharacters = (text: string): string => text.replace(SPECIAL_CHARS_REGEX, '').trim();

const REPEATED_LETTERS_REGEX = /(.)\1+/g;

/**
 * Collapses sequential duplicate letters down to a single occurrence, e.g. "oooh" and
 * "ohh" both normalize to "oh", so drawn-out ad-lib spellings still match the base word.
 */
export const normalizeRepeatedLetters = (word: string): string => word.replace(REPEATED_LETTERS_REGEX, '$1');

/**
 * Determines whether a line's text is made up entirely of "filler" ad-lib words
 * (e.g. "oh", "yeah") once special characters are stripped and repeated letters (e.g.
 * "oooh", "ohh") are collapsed down to their base spelling.
 */
export const isFillerAdlib = (text: string, fillerWords: string[] = ADLIB_FILLER_WORDS): boolean => {
  const cleaned = stripSpecialCharacters(text).toLowerCase();
  const words = cleaned.split(/\s+/).filter(Boolean);

  if (words.length === 0) return true;

  const normalizedFillerWords = fillerWords.map(normalizeRepeatedLetters);

  return words.every((word) => normalizedFillerWords.includes(normalizeRepeatedLetters(word)));
};

/**
 * Determines whether an ad-lib line is just an echo of an adjacent line (the line right
 * before or after it), ignoring case and special characters/punctuation, e.g. main line
 * "I love You" matches ad-lib "(I love you~.)". Partial matches also count, e.g. the
 * ad-lib "(burn it up!)" is considered an echo of "Burn it up, burn it up, fever high!".
 */
export const isEchoAdlib = (text: string, adjacentTexts: string[]): boolean => {
  const cleaned = stripSpecialCharacters(text).toLowerCase();
  if (!cleaned) return false;

  return adjacentTexts.some((adjacentText) =>
    stripSpecialCharacters(adjacentText).toLowerCase().includes(cleaned),
  );
};

export type DistributionOptions = {
  mapping: Distribution['mapping'];
  assignees: Distribution['assignees'];
  mode: DistributionMode;
};

export type BuildLyricsOptions = {
  sectionMode: SectionMode;
  adlibMode: AdlibMode;
  fillerWords?: string[];
  distribution?: DistributionOptions;
};

/**
 * Resolves the assignee label(s) for a line, e.g. `[Deby/Sam]`, `[ALL]`, or `[~]`.
 * Returns an empty string when no assignees are mapped for the line.
 */
const getLineAssigneeLabel = (partsIds: UID[], { mapping, assignees }: DistributionOptions): string => {
  const orderedFuids: FUID[] = [];
  const seen = new Set<FUID>();

  partsIds.forEach((partId) => {
    (mapping[partId] ?? []).forEach((fuid) => {
      if (!seen.has(fuid)) {
        seen.add(fuid);
        orderedFuids.push(fuid);
      }
    });
  });

  if (orderedFuids.length === 0) return '';

  const hasOtherAssignees = orderedFuids.some((fuid) => fuid !== NONE_ID);
  const relevantFuids = hasOtherAssignees ? orderedFuids.filter((fuid) => fuid !== NONE_ID) : orderedFuids;

  const labels = relevantFuids.map((fuid) => {
    if (fuid === NONE_ID) return '~';
    if (fuid === ALL_ID) return 'ALL';
    return assignees[fuid]?.name ?? fuid;
  });

  return `[${labels.join('/')}]`;
};

/**
 * Extracts the concatenated text of all parts in a line.
 */
const getLinePartsText = (partsIds: UID[], song: Song): string => {
  return partsIds
    .map((partId) => {
      const part = song.content[partId];
      return part?.type === 'part' ? part.text : '';
    })
    .filter(Boolean)
    .join(' ');
};

/**
 * Builds a map of lineId -> adjacent (previous/next) line texts, based on the song's
 * chronological line order, used to detect echo ad-libs.
 */
const buildLineAdjacencyMap = (song: Song): Map<UID, string[]> => {
  const allLines = distributor.getAllLines(song);
  const adjacencyMap = new Map<UID, string[]>();

  allLines.forEach((line, index) => {
    const adjacentTexts: string[] = [];
    if (index > 0) adjacentTexts.push(getLinePartsText(allLines[index - 1].partsIds, song));
    if (index < allLines.length - 1) adjacentTexts.push(getLinePartsText(allLines[index + 1].partsIds, song));
    adjacencyMap.set(line.id, adjacentTexts);
  });

  return adjacencyMap;
};

/**
 * Builds the plain-text lyrics representation of a song, honoring the given
 * section/ad-lib/distribution formatting options.
 */
export const buildLyricsText = (song: Song, options: BuildLyricsOptions): string => {
  const { sectionMode, adlibMode, fillerWords, distribution } = options;

  const sections = distributor.getAllSections(song);
  const lineAdjacencyMap = buildLineAdjacencyMap(song);
  let previousAssigneeLabel = '';

  const sectionsText = sections
    .map((section, index) => {
      const isRepeatOfPrevious = index > 0 && sections[index - 1].kind === section.kind;

      const showHeader =
        !isRepeatOfPrevious &&
        (sectionMode === 'all' || (sectionMode === 'minimal' && MINIMAL_SECTION_KINDS.has(section.kind)));

      const header = showHeader ? section.kind.toUpperCase().replace(/_/g, '-') : '';

      const lines = section.linesIds
        .map((lineId) => {
          const line = song.content[lineId];
          if (line.type !== 'line') return '';

          const partsText = getLinePartsText(line.partsIds, song);
          if (!partsText) return '';

          if (line.adlib) {
            if (adlibMode === 'none') return '';
            if (adlibMode === 'minimal') {
              if (isFillerAdlib(partsText, fillerWords)) return '';
              if (isEchoAdlib(partsText, lineAdjacencyMap.get(lineId) ?? [])) return '';
            }
          }

          if (!distribution || distribution.mode === 'none') return partsText;

          const assigneeLabel = getLineAssigneeLabel(line.partsIds, distribution);

          if (distribution.mode === 'minimal') {
            const isRepeatedLabel = assigneeLabel === previousAssigneeLabel;
            previousAssigneeLabel = assigneeLabel;
            if (isRepeatedLabel) return partsText;
          } else {
            previousAssigneeLabel = assigneeLabel;
          }

          return assigneeLabel ? `${assigneeLabel} ${partsText}` : partsText;
        })
        .filter(Boolean);

      if (lines.length === 0) return '';

      return header ? `${header}\n${lines.join('\n')}` : lines.join('\n');
    })
    .filter(Boolean);

  return sectionsText.join('\n\n');
};
