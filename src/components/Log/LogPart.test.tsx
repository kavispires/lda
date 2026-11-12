import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Song, SongPart } from '@types';
import { renderToStaticMarkup } from 'react-dom/server';
import { LogPart } from './LogPart';

test('timed and untimed parts retain distinct connection icons', () => {
  const part: SongPart = {
    id: 'part',
    type: 'part',
    text: 'Test',
    startTime: 1000,
    endTime: 2000,
    recommendedAssignee: 'A',
    lineId: 'line',
  };
  const song: Song = {
    id: 'song',
    type: 'song',
    title: 'Icon test',
    originalArtist: 'Test',
    videoId: 'test',
    startAt: 0,
    endAt: 10000,
    sectionIds: [],
    content: { part },
    ready: true,
    createdAt: 0,
    updatedAt: 0,
  };
  const timed = renderToStaticMarkup(<LogPart hideStatusIcon id="part" onConnect={() => {}} song={song} />);
  const untimed = renderToStaticMarkup(
    <LogPart
      hideStatusIcon
      id="part"
      onConnect={() => {}}
      song={{
        ...song,
        content: { part: { ...part, endTime: 1000 } },
      }}
    />,
  );
  assert.match(timed, /class="[^"]*\blucide-plug\b/);
  assert.doesNotMatch(timed, /\blucide-unplug\b/);
  assert.match(untimed, /class="[^"]*\blucide-unplug\b/);
});
