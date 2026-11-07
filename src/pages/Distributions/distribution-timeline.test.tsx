import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Artist, Distribution, Song, SongLine, SongPart } from '@types';
import { ALL_ID, NONE_ID } from '@utils/constants';
import { renderToStaticMarkup } from 'react-dom/server';
import { DistributionTimeline } from './DistributionTimeline';
import { buildDistributionTimeline } from './distribution-timeline';

const assignees: Record<string, Artist> = {
  a: { id: 'a', type: 'artist', name: 'Ana', color: '#ff0000', track: 'VOCAL' },
  b: { id: 'b', type: 'artist', name: 'Ben', color: '#0000ff', track: 'RAP' },
  c: { id: 'c', type: 'artist', name: 'Cam', color: '#00ff00', track: 'DANCE' },
};

function songWith(
  parts: { id: string; start: number; end: number; line?: Partial<SongLine> }[],
  bounds: Pick<Song, 'startAt' | 'endAt'> = { startAt: 1000, endAt: 11000 },
): Song {
  const content: Song['content'] = {};
  for (const { id, start, end, line } of parts) {
    const lineId = `line-${id}`;
    content[lineId] = {
      id: lineId,
      type: 'line',
      partsIds: [id],
      sectionId: 'section',
      ...line,
    };
    content[id] = {
      id,
      type: 'part',
      text: id,
      startTime: start,
      endTime: end,
      lineId,
      recommendedAssignee: 'A',
    };
  }
  content.section = {
    id: 'section',
    type: 'section',
    kind: 'VERSE',
    number: 1,
    linesIds: parts.map(({ id }) => `line-${id}`),
  };
  return {
    id: 'song',
    type: 'song',
    title: 'Timeline test',
    originalArtist: 'Test',
    videoId: 'test',
    ...bounds,
    content,
    sectionIds: ['section'],
    ready: true,
    createdAt: 0,
    updatedAt: 0,
  };
}

test('clips to the configured song window and preserves exact proportional placement and gaps', () => {
  const song = songWith([
    { id: 'first', start: 0, end: 3000 },
    { id: 'last', start: 9000, end: 12000 },
    { id: 'outside', start: 15000, end: 16000 },
  ]);
  const result = buildDistributionTimeline(song, { first: ['a'], last: ['b'], outside: ['c'] }, assignees);
  assert.equal(result.error, null);
  assert.deepEqual(
    result.segments.map(({ startTime, endTime, startPercent, widthPercent, assigneeIds }) => ({
      startTime,
      endTime,
      startPercent,
      widthPercent,
      assigneeIds,
    })),
    [
      { startTime: 1000, endTime: 3000, startPercent: 0, widthPercent: 20, assigneeIds: ['a'] },
      { startTime: 3000, endTime: 9000, startPercent: 20, widthPercent: 60, assigneeIds: [] },
      { startTime: 9000, endTime: 11000, startPercent: 80, widthPercent: 20, assigneeIds: ['b'] },
    ],
  );
});

test('regular intervals mask only the overlapping adlib portion, even when unassigned or NONE', () => {
  const song = songWith([
    { id: 'adlib', start: 1000, end: 11000, line: { adlib: true } },
    { id: 'regular', start: 3000, end: 5000 },
    { id: 'unassigned', start: 6000, end: 7000 },
    { id: 'none', start: 8000, end: 9000 },
  ]);
  const result = buildDistributionTimeline(
    song,
    { adlib: ['c'], regular: ['a'], none: [NONE_ID] },
    assignees,
  );
  assert.equal(result.error, null);
  assert.deepEqual(
    result.segments.map(({ startTime, endTime, assigneeIds }) => [startTime, endTime, assigneeIds]),
    [
      [1000, 3000, ['c']],
      [3000, 5000, ['a']],
      [5000, 6000, ['c']],
      [6000, 7000, []],
      [7000, 8000, ['c']],
      [8000, 9000, []],
      [9000, 11000, ['c']],
    ],
  );
});

test('deduplicates simultaneous singers and stacks dismissible harmonies in stable color order', () => {
  const song = songWith([
    { id: 'regular', start: 1000, end: 11000 },
    { id: 'harmony', start: 3000, end: 5000, line: { harmonyOf: 'line-regular', dismissible: true } },
    { id: 'duplicate', start: 3500, end: 4500 },
    { id: 'adlib', start: 1000, end: 11000, line: { adlib: true } },
  ]);
  const mapping = { regular: ['b', 'b'], harmony: ['b', 'a', 'a'], duplicate: ['b'], adlib: ['c'] };
  const result = buildDistributionTimeline(song, mapping, assignees);
  assert.equal(result.error, null);
  assert.deepEqual(
    result.segments.map(({ assigneeIds }) => assigneeIds),
    [['b'], ['a', 'b'], ['b']],
  );
  assert.deepEqual(result.segments[1].colors, ['#ff0000', '#0000ff']);
  const html = renderToStaticMarkup(
    <DistributionTimeline assignees={assignees} mapping={mapping} song={song} />,
  );
  assert.match(
    html,
    /class="distribution-timeline__singer" style="background:#ff0000"><\/span><span aria-hidden="true" class="distribution-timeline__singer" style="background:#0000ff"/,
  );
  assert.equal((html.match(/class="distribution-timeline__singer"/g) ?? []).length, 4);
  assert.doesNotMatch(html, /gradient/);
  assert.match(html, /Ana, Ben: 3\.00-5\.00s/);
  assert.doesNotMatch(html, /Cam/);

  const harmonyOnly = buildDistributionTimeline(
    song,
    { regular: [], harmony: ['b'], adlib: ['c'] },
    assignees,
  );
  assert.deepEqual(
    harmonyOnly.segments.map((segment) => segment.assigneeIds),
    [[], ['b'], []],
  );
});

test('ALL is solid black and simultaneous adlibs share colors only without regular coverage', () => {
  const song = songWith([
    { id: 'one', start: 1000, end: 11000, line: { adlib: true } },
    { id: 'two', start: 1000, end: 11000, line: { adlib: true } },
    { id: 'all', start: 4000, end: 6000 },
    { id: 'none', start: 6000, end: 8000 },
  ]);
  const result = buildDistributionTimeline(
    song,
    { one: ['b'], two: ['a'], all: [ALL_ID], none: [NONE_ID] },
    assignees,
  );
  assert.equal(result.error, null);
  assert.deepEqual(
    result.segments.map(({ colors }) => colors),
    [['#ff0000', '#0000ff'], ['#000000'], [], ['#ff0000', '#0000ff']],
  );
});

test('touching parts do not overlap and untimed parts or empty songs add no colored duration', () => {
  const song = songWith([
    { id: 'first', start: 1000, end: 6000 },
    { id: 'second', start: 6000, end: 11000 },
    { id: 'unset', start: 0, end: 0 },
    { id: 'zero', start: 3000, end: 3000 },
  ]);
  const result = buildDistributionTimeline(
    song,
    { first: ['a'], second: ['b'], unset: ['c'], zero: ['c'] },
    assignees,
  );
  assert.deepEqual(
    result.segments.map(({ assigneeIds, widthPercent }) => [assigneeIds, widthPercent]),
    [
      [['a'], 50],
      [['b'], 50],
    ],
  );
  const empty = buildDistributionTimeline(songWith([]), {}, assignees);
  assert.equal(empty.error, null);
  assert.deepEqual(
    empty.segments.map(({ colors, widthPercent }) => [colors, widthPercent]),
    [[[], 100]],
  );
  const tiny = buildDistributionTimeline(
    songWith([{ id: 'tiny', start: 1001, end: 1002 }]),
    { tiny: ['a'] },
    assignees,
  );
  assert.equal(tiny.segments[1].startPercent, 0.01);
  assert.equal(tiny.segments[1].widthPercent, 0.01);
});

test('malformed bounds, part timing and missing references show a warning instead of invalid CSS', () => {
  const song = songWith([{ id: 'part', start: 1000, end: 11000 }]);
  const part = song.content.part;
  assert.equal(part.type, 'part');
  if (part.type !== 'part') throw new Error('Expected fixture part');
  const invalidParts: SongPart[] = [
    { ...part, startTime: Number.NaN },
    { ...part, endTime: Number.POSITIVE_INFINITY },
    { ...part, endTime: 500 },
    { ...part, lineId: 'missing' },
  ];
  const invalidSongs = [
    { ...song, endAt: song.startAt },
    { ...song, endAt: 0 },
    { ...song, startAt: -1000 },
    { ...song, startAt: Number.NaN },
    { ...song, endAt: Number.POSITIVE_INFINITY },
    ...invalidParts.map((invalid) => ({ ...song, content: { ...song.content, part: invalid } })),
  ];
  for (const invalid of invalidSongs) {
    const result = buildDistributionTimeline(invalid, { part: ['a'] }, assignees);
    assert.ok(result.error);
    assert.deepEqual(result.segments, []);
    const html = renderToStaticMarkup(
      <DistributionTimeline assignees={assignees} mapping={{ part: ['a'] }} song={invalid} />,
    );
    assert.match(html, /Timeline unavailable/);
    assert.doesNotMatch(html, /NaN|Infinity|distribution-timeline__segment/);
  }
  assert.match(
    buildDistributionTimeline(song, { part: ['missing'] }, assignees).error ?? '',
    /assigned artist is missing/,
  );
});

test('renders current unsaved assignments without mutating saved data or adding playback interaction', () => {
  const song = songWith([{ id: 'part', start: 1000, end: 11000 }]);
  const savedMapping: Distribution['mapping'] = { part: ['a'] };
  const before = JSON.stringify({ song, savedMapping, assignees });
  const render = (mapping: Distribution['mapping']) =>
    renderToStaticMarkup(<DistributionTimeline assignees={assignees} mapping={mapping} song={song} />);
  const initial = render(savedMapping);
  const assigned = render({ ...savedMapping, part: ['b', 'c'] });
  const cleared = render({ part: [] });
  assert.match(initial, /background:#ff0000/);
  assert.match(
    assigned,
    /class="distribution-timeline__singer" style="background:#0000ff"><\/span><span aria-hidden="true" class="distribution-timeline__singer" style="background:#00ff00"/,
  );
  assert.doesNotMatch(assigned, /gradient/);
  assert.doesNotMatch(assigned, /Ana/);
  assert.doesNotMatch(cleared, /#ff0000|#0000ff|#00ff00/);
  assert.match(cleared, /Unassigned \/ instrumental/);
  assert.match(assigned, /aria-label="Distribution timeline"/);
  assert.doesNotMatch(assigned, /<button|role="slider"|tabindex|playhead|progressbar/);
  assert.equal(JSON.stringify({ song, savedMapping, assignees }), before);
});
