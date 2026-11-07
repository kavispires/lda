import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildBulkLineUpdates } from '@components/Log/EditLinesForm';
import { LogLine } from '@components/Log/LogLine';
import { buildLyricsText } from '@components/Lyrics/copyLyricsUtils';
import { AdlibBox, LyricBox } from '@components/Visualizer/LyricBox';
import { serializeSong } from '@hooks/useSong';
import { buildDistributionTimeline } from '@pages/Distributions/distribution-timeline';
import type { Artist, Distribution, Song, SongLine } from '@types';
import { distributor } from '@utils';
import { applyLineFlagChanges, isInlineEligible } from '@utils/song/line-flags';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  buildBarSnapshots,
  buildLyricsSnapshots,
  buildUpNextSnapshots,
} from './DistributionVisualizerProvider';

const artists: Record<string, Artist> = {
  a: { id: 'a', type: 'artist', name: 'Ana', color: '#ff0000', track: 'VOCAL' },
  b: { id: 'b', type: 'artist', name: 'Ben', color: '#0000ff', track: 'RAP' },
};

function fixture(flags: Partial<SongLine> = {}) {
  const song: Song = {
    id: 'song',
    type: 'song',
    title: 'Inline test',
    originalArtist: 'Test',
    videoId: 'test',
    startAt: 0,
    endAt: 8000,
    sectionIds: ['section'],
    ready: true,
    createdAt: 0,
    updatedAt: 0,
    content: {
      section: { id: 'section', type: 'section', kind: 'VERSE', number: 1, linesIds: ['regular', 'adlib'] },
      regular: { id: 'regular', type: 'line', sectionId: 'section', partsIds: ['p1'] },
      adlib: { id: 'adlib', type: 'line', sectionId: 'section', partsIds: ['p2'], adlib: true, ...flags },
      p1: {
        id: 'p1',
        type: 'part',
        lineId: 'regular',
        text: 'Main phrase',
        startTime: 2000,
        endTime: 5000,
        recommendedAssignee: 'A',
      },
      p2: {
        id: 'p2',
        type: 'part',
        lineId: 'adlib',
        text: '(Inline phrase)',
        startTime: 3000,
        endTime: 6000,
        recommendedAssignee: 'B',
      },
    },
  };
  const distribution: Distribution = {
    id: 'distribution',
    type: 'distribution',
    songId: song.id,
    groupId: 'group',
    assignees: artists,
    mapping: { p1: ['a'], p2: ['b'] },
    maxAssigneeDuration: 3000,
    createdAt: 0,
    updatedAt: 0,
  };
  return { song, distribution };
}

test('inline adlibs use only main lyrics and main Up Next; legacy adlibs retain the side channels', () => {
  for (const inline of [undefined, false, true]) {
    const { song, distribution } = fixture({ inline });
    const lyrics = buildLyricsSnapshots(distribution, song);
    const previews = buildUpNextSnapshots(distribution, song);
    assert.equal(
      Object.values(lyrics.lyricsSnapshots).some((item) => item.id === 'adlib'),
      inline === true,
    );
    assert.equal(
      Object.values(lyrics.adlibsSnapshots).some((item) => item.id === 'adlib'),
      inline !== true,
    );
    assert.equal(
      Object.values(previews.upNext)
        .flat()
        .some((item) => item.name === 'Ben'),
      inline === true,
    );
    assert.equal(
      Object.values(previews.adlibUpNext)
        .flat()
        .some((item) => item.name === 'Ben'),
      inline !== true,
    );
    if (inline) {
      assert.equal(lyrics.lyricsSnapshots[30].lines[0].parts[0].text, 'Inline phrase');
      assert.deepEqual(lyrics.lyricsSnapshots[30].lines[0].parts[0].colors, ['#0000ff']);
      assert.equal(previews.upNext[18][0].name, 'Ben');
    }
  }
  const { song, distribution } = fixture({ inline: true, dismissible: true });
  const lyrics = buildLyricsSnapshots(distribution, song);
  assert.deepEqual(lyrics.adlibsSnapshots, {});
  assert.deepEqual(
    Object.values(lyrics.lyricsSnapshots).map((item) => item.id),
    ['regular'],
  );
  const previews = buildUpNextSnapshots(distribution, song);
  assert.deepEqual(previews.adlibUpNext, {});
  assert.deepEqual(
    Object.values(previews.upNext)
      .flat()
      .map((item) => item.name),
    ['Ana'],
  );
});

test('inline placement follows regular grouping and overlap behavior exactly', () => {
  const inline = fixture({ inline: true });
  const regular = fixture({ adlib: false });
  const withoutInlineStyle = (result: ReturnType<typeof buildLyricsSnapshots>) => ({
    ...result,
    lyricsSnapshots: Object.fromEntries(
      Object.entries(result.lyricsSnapshots).map(([time, snapshot]) => [
        time,
        { ...snapshot, lines: snapshot.lines.map(({ parts }) => ({ parts })) },
      ]),
    ),
  });
  assert.deepEqual(
    withoutInlineStyle(buildLyricsSnapshots(inline.distribution, inline.song)),
    buildLyricsSnapshots(regular.distribution, regular.song),
  );
  assert.deepEqual(
    buildUpNextSnapshots(inline.distribution, inline.song),
    buildUpNextSnapshots(regular.distribution, regular.song),
  );
  inline.distribution.mapping.p2 = ['a'];
  regular.distribution.mapping.p2 = ['a'];
  assert.deepEqual(
    withoutInlineStyle(buildLyricsSnapshots(inline.distribution, inline.song)),
    buildLyricsSnapshots(regular.distribution, regular.song),
  );
  assert.equal(
    Object.values(buildLyricsSnapshots(inline.distribution, inline.song).lyricsSnapshots)[0].lines.length,
    2,
  );
});

test('inline lyrics render italic without italicizing regular lines grouped under the same singer', () => {
  const { song, distribution } = fixture({ inline: true });
  const separate = buildLyricsSnapshots(distribution, song).lyricsSnapshots;
  assert.equal(separate[30].lines[0].inline, true);
  distribution.mapping.p2 = ['a'];
  const grouped = buildLyricsSnapshots(distribution, song).lyricsSnapshots[20];
  assert.equal(grouped.lines[0].inline, undefined);
  assert.equal(grouped.lines[1].inline, true);
  const markup = renderToStaticMarkup(<LyricBox assignees={artists} snapshot={grouped} timestamp={35} />);
  const lines = [...markup.matchAll(/<div class="lyric-box__line">([\s\S]*?)<\/div>/g)];
  assert.equal(lines.length, 2);
  assert.match(lines[0][1], /font-style:normal/);
  assert.doesNotMatch(lines[0][1], /font-style:italic/);
  assert.match(lines[1][1], /font-style:italic/);
});

test('side-panel adlibs render italic lyrics while leaving singer labels unchanged', () => {
  const { song, distribution } = fixture();
  const snapshot = buildLyricsSnapshots(distribution, song).adlibsSnapshots[30];
  const markup = renderToStaticMarkup(<AdlibBox assignees={artists} snapshot={snapshot} />);
  assert.match(markup, /class="adlib-box__text" style="font-style:italic"/);
  assert.match(markup, /class="adlib-box__speakers"><span style="color:#0000ff">Ben<\/span>/);
});

test('song line previews distinguish side and inline adlibs in clickable and read-only views', () => {
  for (const onClick of [undefined, () => {}]) {
    for (const flags of [{}, { inline: true }, { adlib: false }]) {
      const { song } = fixture(flags);
      const markup = renderToStaticMarkup(
        <LogLine id="adlib" onClick={onClick} song={song}>
          {null}
        </LogLine>,
      );
      if (flags.adlib === false) {
        assert.doesNotMatch(markup, /&gt;/);
      } else if (flags.inline) {
        assert.match(markup, /&gt; /);
        assert.doesNotMatch(markup, /&gt;&gt;/);
      } else {
        assert.match(markup, /&gt;&gt; /);
      }
    }
  }
});

test('placement never changes adlib duration, timeline priority or clipboard filters', () => {
  const side = fixture();
  const inline = fixture({ inline: true });
  assert.deepEqual(
    buildBarSnapshots(inline.distribution, inline.song),
    buildBarSnapshots(side.distribution, side.song),
  );
  const bars = buildBarSnapshots(inline.distribution, inline.song);
  assert.equal(bars[60].b.duration, 0);
  assert.equal(bars[60].b.fullDuration, 30);
  const timeline = buildDistributionTimeline(inline.song, inline.distribution.mapping, artists);
  assert.deepEqual(timeline, buildDistributionTimeline(side.song, side.distribution.mapping, artists));
  assert.deepEqual(timeline.segments.find((segment) => segment.startTime === 2000)?.assigneeIds, ['a']);
  assert.equal(buildLyricsText(inline.song, { sectionMode: 'none', adlibMode: 'none' }), 'Main phrase');
  assert.equal(
    buildLyricsText(inline.song, { sectionMode: 'none', adlibMode: 'all' }),
    buildLyricsText(side.song, { sectionMode: 'none', adlibMode: 'all' }),
  );
});

test('line edits enforce inline eligibility and existing harmony exclusivity without mutating inputs', () => {
  const line = distributor.getLine('adlib', fixture({ inline: true }).song);
  const original = structuredClone(line);
  for (const changes of [{ adlib: false }, { dismissible: true }, { harmonyOf: 'regular' }]) {
    const next = applyLineFlagChanges(line, changes);
    assert.equal(next.inline, false);
    assert.equal(isInlineEligible(next), false);
  }
  assert.equal(applyLineFlagChanges({ ...line, inline: false }, { inline: true }).inline, true);
  assert.equal(applyLineFlagChanges({ ...line, adlib: false }, { inline: true }).inline, false);
  const harmony = applyLineFlagChanges(line, { harmonyOf: 'regular' });
  assert.equal(harmony.adlib, false);
  assert.equal(harmony.dismissible, true);
  assert.equal(applyLineFlagChanges(harmony, { adlib: true }).harmonyOf, undefined);
  assert.deepEqual(line, original);
});

test('bulk false-only edits apply and mixed untouched values stay per-line', () => {
  const { song } = fixture({ inline: true });
  const lines = distributor.getAllLines(song);
  assert.deepEqual(buildBulkLineUpdates(lines, { inline: false }), {
    'content.regular.inline': false,
    'content.adlib.inline': false,
  });
  const adlibOff = distributor.batchUpdateSong(song, buildBulkLineUpdates(lines, { adlib: false }));
  assert.equal(distributor.getLine('adlib', adlibOff).inline, false);
  const hidden = distributor.batchUpdateSong(song, buildBulkLineUpdates(lines, { dismissible: true }));
  assert.equal(distributor.getLine('adlib', hidden).inline, false);
  const result = distributor.batchUpdateSong(song, buildBulkLineUpdates(lines, { 'skill.level': 2 }));
  assert.equal(distributor.getLine('regular', result).adlib, undefined);
  assert.equal(distributor.getLine('adlib', result).adlib, true);
  assert.equal(distributor.getLine('adlib', result).inline, true);
  assert.deepEqual(buildBulkLineUpdates(lines, {}), {});
});

test('serialization round-trips valid inline flags and removes invalid flags without mutating the song', () => {
  for (const flags of [
    { inline: true },
    { inline: false },
    { inline: true, adlib: false },
    { inline: true, dismissible: true },
    {},
  ]) {
    const { song } = fixture(flags);
    const original = structuredClone(song);
    const restored: Song = { ...serializeSong(song), content: JSON.parse(serializeSong(song).content) };
    const line = distributor.getLine('adlib', restored);
    assert.equal(line.inline, flags.inline && flags.adlib !== false && !flags.dismissible ? true : undefined);
    assert.deepEqual(song, original);
    assert.equal(distributor.getLine('regular', restored).inline, undefined);
  }
});
