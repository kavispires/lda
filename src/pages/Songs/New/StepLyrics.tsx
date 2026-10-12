import { DatabaseFilled, MessageFilled, NotificationFilled } from '@ant-design/icons';
import { PlaybackVideo } from '@components/Video/PlaybackVideo';
import { useCreateSongMutation } from '@hooks/useCreateSongMutation';
import type { Song, UID } from '@types';
import { distributor } from '@utils';
import { SECTION_KINDS } from '@utils/constants';
import { Button, Divider, Input, Space, Typography } from 'antd';
import { cloneDeep } from 'lodash';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocalStorage } from 'react-use';
import type { NewSong } from '../NewSongPage';
import { NewSongQuickLog } from './NewSongQuickLog';

const TEMP_TEXTAREA_LYRICS = 'TEMP_TEXTAREA_LYRICS';

type StepLyricsProps = {
  newSong: NewSong;
  updateNewSong: (data: Partial<NewSong>) => void;
  setStep: React.Dispatch<React.SetStateAction<number>>;
};

export function StepLyrics({ newSong }: StepLyricsProps) {
  const navigate = useNavigate();
  const songMutation = useCreateSongMutation();

  const [song, setSong] = useState<Song>(
    distributor.generateSong({
      title: newSong.title,
      videoId: newSong.videoId,
      originalArtist: newSong.originalArtist,
      startAt: newSong.startAt,
      endAt: newSong.endAt,
    }),
  );

  // Saves lyrics in local storage in case context is lost, this date is removed upon saving
  const [tempLyrics, setTempLyrics, removeTempLyrics] = useLocalStorage<string>(TEMP_TEXTAREA_LYRICS, '', {
    raw: true,
  });
  const [textarea, setTextarea] = useState<string>(
    tempLyrics || '[verse]\nSample lyrics!\nSample |lyrics (sample lyrics.)\n\nSampleLyrics',
  );
  const [textareaUsedValue, setTextareaUsedValue] = useState<string>('');

  const onTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextarea(e.target.value);
    setTempLyrics(e.target.value);
  };

  const onParse = () => {
    setSong(buildSections(textarea, song));
    setTextareaUsedValue(textarea);
  };

  const onSave = () => {
    songMutation.mutate(song, {
      onSuccess: (response) => {
        removeTempLyrics();
        navigate(`/songs/${response.id}/edit`);
      },
    });
  };

  return (
    <>
      <div className="grid grid-cols-2">
        <div>
          <Typography.Title level={3}>Building Sections from Lyrics</Typography.Title>
          <Typography.Paragraph>
            Paste the lyrics and press enter to auto-generate the sections and lines.
            <br />
            An line break creates a Line, a double line break generates a Section, and <code>|</code>{' '}
            generates parts.
            <br />
            Click on each Section <DatabaseFilled />, Line <MessageFilled />, and Part <NotificationFilled />{' '}
            to edit their options.
          </Typography.Paragraph>
        </div>

        <div className="container-center">
          <PlaybackVideo videoId={newSong.videoId} width={240} />
        </div>
      </div>

      <div className="grid grid-cols-2">
        <Input.TextArea
          autoSize={{ minRows: 10, maxRows: 30 }}
          onChange={onTextAreaChange}
          placeholder="Insert lyrics here"
          value={textarea}
        />
        <NewSongQuickLog song={song} />
      </div>
      <Space className="my-4 container-center">
        <Button onClick={onParse}>Parse Lyrics</Button>
      </Space>
      {!!song.sectionIds.length && (
        <>
          <Divider />
          <Typography.Paragraph>
            After verifying if all parts, lines, and sections were built correctly, press the button below to
            create a database record so you can time the parts next.
          </Typography.Paragraph>
          <Space className="my-4 container-center">
            <Button
              disabled={textareaUsedValue !== textarea}
              loading={songMutation.isPending}
              onClick={onSave}
              size="large"
              type="primary"
            >
              Create Song
            </Button>
          </Space>
        </>
      )}
    </>
  );
}

const buildSections = (textarea: string, song: Song) => {
  const songCopy = cloneDeep(song);
  const content: Song['content'] = {};

  // If a line ends with a single trailing period, strip it. If it ends with two or more
  // dots (an ellipsis), replace them with the `…` character instead. Trailing commas are
  // stripped as well.
  const stripTrailingPunctuation = (entry: string) => {
    const withoutPeriod = entry.replace(/\.+\s*$/, (match) => {
      const dots = match.trim();
      if (dots.length >= 2) return '…';
      return '';
    });
    const withoutComma = withoutPeriod.replace(/,\s*$/, '');
    // Same treatment for the content right before a closing parenthesis
    return withoutComma.replace(/(\.+)(\s*\))$/, (_, dots: string, close: string) =>
      dots.length >= 2 ? `…${close}` : close,
    );
  };

  // Moves parenthesized content into its own line: `Hello (it's me)` -> `Hello`, `(it's me)`
  const splitParentheses = (entry: string) => {
    if (!/\([^)]*\)/.test(entry)) return [entry];
    const segments = entry
      .split(/(\([^)]*\))/)
      .map((segment) => segment.trim())
      .filter(Boolean);
    return segments.length > 0 ? segments : [entry];
  };

  // Remove double spaces and first line and last line line breaks
  const filteredTextarea = textarea
    .split('\n')
    .flatMap(splitParentheses)
    .map(stripTrailingPunctuation)
    .filter((entry, index, list) => {
      const line = entry.trim();
      // Empty lines
      if (line === '') {
        // First line
        if (index === 0) return false;
        // Last line is empty
        if (index === list.length - 1) return false;
        // Double empty lines
        if (list[index - 1]?.trim() === '') return false;
      }
      return true;
    });

  const sectionIds: UID[] = [];
  let lineIds: UID[] = [];
  let newSectionId = distributor.generateUniqueId('s', 2);
  let pendingKind: string | undefined;

  const flushSection = () => {
    const newSection = distributor.generateSection({ id: newSectionId, linesIds: lineIds });
    if (pendingKind) newSection.kind = pendingKind;
    sectionIds.push(newSectionId);
    content[newSectionId] = newSection;
    lineIds = [];
    pendingKind = undefined;
    newSectionId = distributor.generateUniqueId('s', 2);
  };

  filteredTextarea.forEach((entry, index, list) => {
    const line = entry.trim();
    // Whenever there's an empty line, it means a new session is about to start, so save the previous data
    const bracketMatch = line.match(/^\[([^\]]*)\]$/);
    if (bracketMatch) {
      // A `[kind]` line is not a lyric line: it starts a new section of the closest matching kind
      if (lineIds.length) flushSection();
      pendingKind = findClosestSectionKind(bracketMatch[1]);
    } else if (line === '') {
      // Keep a pending `[kind]` for the next lines if no lines were collected yet
      if (lineIds.length || !pendingKind) flushSection();
    } else {
      const newLine = distributor.generateLine({ sectionId: newSectionId });
      // Split lines, create a part for each fragment
      const partsIds = entry
        .split('|')
        .map((part) => {
          const text = part?.trim() ?? '';
          if (text) {
            const newPart = distributor.generatePart({ text, lineId: newLine.id });
            content[newPart.id] = newPart;
            return newPart.id;
          }
          return undefined;
        })
        .filter(Boolean) as UID[];

      newLine.sectionId = newSectionId;
      newLine.partsIds = partsIds;
      lineIds.push(newLine.id);
      content[newLine.id] = newLine;
    }

    // Handle saving the last section
    if (index === list.length - 1 && lineIds.length) flushSection();
  });

  // TODO: Should sort by startAt ?

  songCopy.content = content;
  songCopy.sectionIds = sectionIds;
  songCopy.updatedAt = Date.now();

  return songCopy;
};

const SECTION_KIND_ALIASES: Record<string, string> = {
  REFRAIN: SECTION_KINDS.CHORUS,
  PRECHORUS: SECTION_KINDS.PRE_CHORUS,
  POSTCHORUS: SECTION_KINDS.POST_CHORUS,
  SOLO: SECTION_KINDS.INSTRUMENT_SOLO,
  INSTRUMENTAL: SECTION_KINDS.INSTRUMENT_SOLO,
  DANCEBREAK: SECTION_KINDS.DANCE_BREAK,
  INSTRUMENTSOLO: SECTION_KINDS.INSTRUMENT_SOLO,
  RAPVERSE: SECTION_KINDS.RAP,
  VERSES: SECTION_KINDS.VERSE,
  CHORUSES: SECTION_KINDS.CHORUS,
};

const levenshtein = (a: string, b: string) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
};

/**
 * Finds the section kind closest to a bracket label (e.g. `[Verse 2]`, `[pre chorus]`, `[Chrous]`).
 * Returns undefined when nothing is reasonably close.
 */
const findClosestSectionKind = (label: string): string | undefined => {
  // Drop numbering and separators: "Verse 2" -> "VERSE", "Pre-Chorus" -> "PRECHORUS"
  const normalized = label.toUpperCase().replace(/[^A-Z]/g, '');
  if (!normalized) return undefined;

  if (SECTION_KIND_ALIASES[normalized]) return SECTION_KIND_ALIASES[normalized];

  const candidates = Object.values(SECTION_KINDS)
    .filter((kind) => kind !== SECTION_KINDS.UNKNOWN)
    .map((kind) => ({ kind: kind as string, key: kind.replace(/_/g, '') }));

  const exact = candidates.find((c) => c.key === normalized);
  if (exact) return exact.kind;

  let best: { kind: string; distance: number } | undefined;
  candidates.forEach(({ kind, key }) => {
    const distance = levenshtein(normalized, key);
    if (!best || distance < best.distance) best = { kind, distance };
  });

  const threshold = Math.max(2, Math.floor(normalized.length / 3));
  return best && best.distance <= threshold ? best.kind : undefined;
};
