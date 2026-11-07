import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CurrentSectionDistribution } from '@components/Formation/CurrentSectionDistribution';
import { Stage } from '@components/Formation/Stage';
import { saveFormation, serializeFormation } from '@hooks/useDanceFormation';
import type { Artist, Distribution, Formation, FormationPose, Song } from '@types';
import { renderToStaticMarkup } from 'react-dom/server';
import { ALL_ID, NONE_ID } from './constants';
import {
  activeFormationSingers,
  addFormationSnapshot,
  assignCopiedPose,
  assignTemplate,
  createFormation,
  dancerIds,
  deleteFormationSnapshot,
  deserializeFormation,
  formationErrors,
  initialPose,
  moveFormationDancers,
  poseErrors,
  readFormationTemplate,
  reconcileCast,
  resolveFormationPose,
  retimeSnapshot,
} from './formation';

declare global {
  var __formationTestDb: {
    records: Map<string, Record<string, unknown>>;
    failWrite: boolean;
    writes: number;
    reset: (entries: [string, Record<string, unknown>][]) => void;
  };
}

function fixture(count = 5) {
  const artists: Record<string, Artist> = Object.fromEntries(
    Array.from({ length: count }, (_, i) => {
      const id = String.fromCharCode(97 + i);
      return [id, { id, name: id.toUpperCase(), type: 'artist', color: '#123456', track: 'DANCE' }];
    }),
  );
  const song: Song = {
    id: 'song',
    type: 'song',
    title: 'Formation test',
    originalArtist: 'Test',
    videoId: 'test',
    startAt: 2000,
    endAt: 12000,
    sectionIds: [],
    content: {},
    ready: true,
    createdAt: 1,
  };
  const distribution: Distribution = {
    id: 'dist',
    type: 'distribution',
    songId: 'song',
    groupId: 'group',
    assignees: artists,
    mapping: {},
    maxAssigneeDuration: 10000,
    createdAt: 1,
  };
  const formation = createFormation(distribution, song);
  return { song, distribution, formation };
}

function withDestination(formation: Formation): Formation {
  return {
    ...formation,
    snapshots: [
      formation.snapshots[0],
      {
        id: 'destination',
        timestamp: 8000,
        transition: 1000,
        positions: Object.fromEntries(
          Object.entries(formation.snapshots[0].positions).map(([id, pos]) => [
            id,
            { x: pos.x, y: pos.y + 4 },
          ]),
        ),
      },
    ],
  };
}

test('new formations use only real dancers, one anchored pose and valid scalable geometry', () => {
  const { song, distribution } = fixture();
  distribution.assignees[ALL_ID] = distribution.assignees.a;
  distribution.assignees[NONE_ID] = distribution.assignees.a;
  const formation = createFormation(distribution, song);
  assert.equal(formation.snapshots.length, 1);
  assert.deepEqual(formationErrors(formation, song, dancerIds(distribution)), []);
  assert.equal(formation.assigneesIds.length, 5);
  for (const count of [1, 5, 7, 27, 117, 118, 513]) {
    const positions = initialPose(Array.from({ length: count }, (_, i) => String(i)));
    assert.equal(Object.keys(positions).length, count);
    assert.deepEqual(poseErrors(positions), []);
  }
});

test('section sidebar follows the playhead, retains hidden/adlib assignments and highlights only active parts', () => {
  const { song, distribution } = fixture();
  song.sectionIds = ['verse', 'chorus'];
  song.content = {
    verse: { id: 'verse', type: 'section', kind: 'VERSE', number: 1, linesIds: ['line', 'adlib'] },
    chorus: { id: 'chorus', type: 'section', kind: 'CHORUS', number: 1, linesIds: ['next'] },
    line: { id: 'line', type: 'line', sectionId: 'verse', partsIds: ['p', 'p2'] },
    adlib: { id: 'adlib', type: 'line', sectionId: 'verse', partsIds: ['q'], adlib: true, dismissible: true },
    next: { id: 'next', type: 'line', sectionId: 'chorus', partsIds: ['r'] },
    p: {
      id: 'p',
      type: 'part',
      lineId: 'line',
      text: 'First words',
      startTime: 3000,
      endTime: 5000,
      recommendedAssignee: 'a',
    },
    p2: {
      id: 'p2',
      type: 'part',
      lineId: 'line',
      text: 'Later words',
      startTime: 5000,
      endTime: 8000,
      recommendedAssignee: 'a',
    },
    q: {
      id: 'q',
      type: 'part',
      lineId: 'adlib',
      text: 'Hidden response',
      startTime: 3500,
      endTime: 4000,
      recommendedAssignee: 'b',
    },
    r: {
      id: 'r',
      type: 'part',
      lineId: 'next',
      text: 'Next section',
      startTime: 7000,
      endTime: 11000,
      recommendedAssignee: 'c',
    },
  };
  distribution.mapping = { p: ['a', 'b'], q: [ALL_ID], r: [NONE_ID] };
  const before = structuredClone({ song, distribution });
  const render = (timestamp: number) =>
    renderToStaticMarkup(
      <CurrentSectionDistribution
        distribution={distribution}
        onSeek={() => {}}
        song={song}
        timestamp={timestamp}
      />,
    );
  const verse = render(3750);
  assert.match(verse, /VERSE 1/);
  assert.match(verse, /First words/);
  assert.match(verse, /Later words/);
  assert.match(verse, /Hidden response/);
  assert.match(verse, />A<\/span>/);
  assert.match(verse, />B<\/span>/);
  assert.match(verse, />ALL<\/span>/);
  assert.match(verse, /Unassigned/);
  assert.equal((verse.match(/aria-current="true"/g) ?? []).length, 2);
  assert.equal((render(5000).match(/aria-current="true"/g) ?? []).length, 1);
  const chorus = render(7000);
  assert.match(chorus, /CHORUS 1/);
  assert.match(chorus, /Next section/);
  assert.match(chorus, />NONE<\/span>/);
  assert.doesNotMatch(chorus, /First words/);
  assert.match(render(2000), /No section at this playhead/);
  assert.match(render(song.endAt), /No section at this playhead/);
  assert.deepEqual({ song, distribution }, before);
});

test('legacy indexed positions preserve artist identity and timestamps without mutating saved data', () => {
  const legacy = {
    id: '$draft',
    type: 'formation',
    distributionId: 'dist',
    songId: 'song',
    groupId: 'group',
    assigneesIds: ['b', 'a'],
    createdAt: 1,
    timeline: JSON.stringify({ 0: ['3::4', '7::8'], 2500: ['4::5', '8::9'] }),
  };
  const original = structuredClone(legacy);
  const result = deserializeFormation(legacy, 'custom-formation-id');
  assert.equal(result.id, 'custom-formation-id');
  assert.deepEqual(result.snapshots[0].positions, { b: { x: 3, y: 4 }, a: { x: 7, y: 8 } });
  assert.equal(result.snapshots[1].timestamp, 2500);
  assert.equal(result.snapshots[1].transition, 1000);
  assert.deepEqual(legacy, original);
  const { song } = fixture();
  assert.ok(formationErrors(result, song, ['a', 'b']).some((error) => error.includes('inside the song')));
  const restored = deserializeFormation(serializeFormation(result), result.id);
  assert.deepEqual(restored, result);
  assert.throws(() => deserializeFormation({ ...legacy, version: 3 }, 'id'), /Unsupported/);
  assert.throws(
    () => deserializeFormation({ ...legacy, timeline: '{"0":["bad","2::3"]}' }, 'id'),
    /coordinates/,
  );
});

test('movement holds then interpolates in real milliseconds, arriving exactly with hard cuts and final holds', () => {
  const { formation } = fixture();
  const f = withDestination(formation);
  const start = f.snapshots[0].positions.a;
  assert.deepEqual(resolveFormationPose(f.snapshots, 6999).a, start);
  assert.deepEqual(resolveFormationPose(f.snapshots, 7000).a, start);
  assert.equal(resolveFormationPose(f.snapshots, 7500).a.y, start.y + 2);
  assert.equal(resolveFormationPose(f.snapshots, 7525).a.y, start.y + 2.1);
  assert.deepEqual(resolveFormationPose(f.snapshots, 8000), f.snapshots[1].positions);
  assert.deepEqual(resolveFormationPose(f.snapshots, 12000), f.snapshots[1].positions);
  f.snapshots[1].transition = 0;
  assert.deepEqual(resolveFormationPose(f.snapshots, 7999).a, start);
  assert.deepEqual(resolveFormationPose(f.snapshots, 8000), f.snapshots[1].positions);
});

test('snapshot add copies the actual preview; duplicate selection, bounds and next-transition checks preserve data', () => {
  const { formation, song } = fixture();
  const f = withDestination(formation);
  const before = structuredClone(f);
  const added = addFormationSnapshot(f, 5000, song);
  assert.equal(added.formation.snapshots.length, 3);
  assert.deepEqual(added.formation.snapshots[1].positions, f.snapshots[0].positions);
  added.formation.snapshots[1].positions.a.x++;
  assert.deepEqual(f, before);
  const duplicate = addFormationSnapshot(f, 8000, song);
  assert.equal(duplicate.formation, f);
  assert.equal(duplicate.selectedId, 'destination');
  assert.throws(() => addFormationSnapshot(f, 7500, song), /Shorten the next/);
  assert.throws(() => addFormationSnapshot(f, 1999, song), /inside the song/);
  assert.throws(() => addFormationSnapshot(f, 12001, song), /inside the song/);
  assert.equal(addFormationSnapshot(f, song.endAt, song).formation.snapshots.at(-1)?.timestamp, song.endAt);
});

test('retiming never overwrites or silently shortens transitions; initial pose cannot be removed', () => {
  const { formation, song } = fixture();
  const f = withDestination(formation);
  const before = structuredClone(f);
  assert.throws(() => retimeSnapshot(f, 'destination', 2500, song), /Shorten/);
  assert.throws(() => retimeSnapshot(f, 'destination', 2000, song), /already exists/);
  assert.throws(() => retimeSnapshot(f, f.snapshots[0].id, 3000, song), /anchored/);
  assert.throws(() => retimeSnapshot(f, 'destination', 12001, song), /inside/);
  assert.equal(retimeSnapshot(f, 'destination', 9000, song).snapshots[1].transition, 1000);
  assert.throws(() => deleteFormationSnapshot(f, f.snapshots[0].id, song.startAt), /initial pose/);
  const legacy = {
    ...f,
    snapshots: [
      { ...f.snapshots[0], timestamp: 0 },
      { ...f.snapshots[1], timestamp: song.startAt },
    ],
  };
  const repaired = deleteFormationSnapshot(legacy, legacy.snapshots[0].id, song.startAt);
  assert.equal(repaired.snapshots[0].transition, 0);
  assert.deepEqual(formationErrors(repaired, song, repaired.assigneesIds), []);
  assert.deepEqual(f, before);
});

test('cast reconciliation preserves all matching identities, removes departures and places newcomers at the back', () => {
  const { formation, distribution, song } = fixture();
  const f = withDestination(formation);
  const before = structuredClone(f);
  const result = reconcileCast(f, ['e', 'b', 'a', 'd', 'new']);
  assert.deepEqual(f, before);
  for (const [index, snapshot] of result.snapshots.entries()) {
    assert.deepEqual(snapshot.positions.a, f.snapshots[index].positions.a);
    assert.equal(snapshot.positions.c, undefined);
    assert.equal(snapshot.positions.new.y, 0.5);
    assert.deepEqual(poseErrors(snapshot.positions), []);
  }
  assert.ok(
    formationErrors(f, song, ['a', 'b', 'd', 'e', 'new']).some((error) => error.includes('cast has changed')),
  );
  assert.deepEqual(formationErrors(f, song, dancerIds(distribution)), []);
  assert.ok(
    formationErrors(f, { ...song, endAt: 7000 }, dancerIds(distribution)).some((error) =>
      error.includes('inside'),
    ),
  );
});

test('footprints may touch, but overlaps and offstage group drops are rejected atomically', () => {
  const positions = { a: { x: 1.5, y: 2.5 }, b: { x: 2.5, y: 2.5 }, c: { x: 7.5, y: 2.5 } };
  assert.deepEqual(poseErrors(positions), []);
  assert.throws(() => moveFormationDancers(positions, ['a', 'b'], 5, 0), /overlap/);
  assert.throws(() => moveFormationDancers(positions, ['a', 'b'], -2, 0), /inside/);
  assert.deepEqual(moveFormationDancers(positions, ['a', 'b'], 0, 1).b, { x: 2.5, y: 3.5 });
  assert.deepEqual(positions.a, { x: 1.5, y: 2.5 });
  assert.ok(poseErrors({ a: { x: 2, y: 2 }, b: { x: 2.9, y: 2 } }).length > 0);
});

function assignmentCost(source: FormationPose, target: FormationPose) {
  return Object.entries(source).reduce(
    (sum, [id, pos]) => sum + Math.hypot(pos.x - target[id].x, pos.y - target[id].y),
    0,
  );
}

test('copied poses reassign every slot by minimum total travel, not copied identity or greedy proximity', () => {
  const source = Object.fromEntries([2, 3, 8, 13, 18].map((x, i) => [String(i), { x, y: 9 }]));
  const copied = Object.fromEntries([2.2, 0.5, 8, 13, 18].map((x, i) => [String(i), { x, y: 9 }]));
  const before = structuredClone({ source, copied });
  const result = assignCopiedPose(source, copied);
  assert.ok(Math.abs(assignmentCost(source, result) - 2.3) < 1e-8);
  assert.deepEqual(result['0'], copied['1']);
  assert.deepEqual(result['1'], copied['0']);
  assert.deepEqual(Object.keys(result).sort(), Object.keys(source).sort());
  assert.deepEqual(poseErrors(result), []);
  result['0'].x++;
  assert.deepEqual({ source, copied }, before);
  assert.throws(() => assignCopiedPose(source, { a: { x: 2, y: 2 } }), /counts must match/);
  assert.throws(() => assignCopiedPose(source, { ...copied, 0: { x: 0, y: 9 } }), /inside/);
  assert.throws(() => assignCopiedPose({ ...source, 0: { x: Number.NaN, y: 9 } }, copied), /finite/);
  for (const count of [1, 3, 9, 40]) {
    const positions = initialPose(Array.from({ length: count }, (_, i) => `dancer-${i}`));
    const reversed = Object.fromEntries(
      Object.keys(positions).map((id, i, ids) => [id, positions[ids[ids.length - i - 1]]]),
    );
    assert.deepEqual(assignCopiedPose(positions, reversed), positions);
  }
});

test('equal-cost copied-pose matching favors current dancers closer to the audience, then center', () => {
  const copied = { left: { x: 12.5, y: 9.5 }, right: { x: 14.5, y: 9.5 } };
  const audience = { back: { x: 13.5, y: 8.5 }, front: { x: 13.5, y: 10.5 } };
  assert.deepEqual(assignCopiedPose(audience, copied), {
    front: copied.left,
    back: copied.right,
  });
  const center = { outer: { x: 10.5, y: 9.5 }, inner: { x: 12.5, y: 9.5 } };
  const vertical = { front: { x: 11.5, y: 10.5 }, back: { x: 11.5, y: 8.5 } };
  const result = assignCopiedPose(center, vertical);
  assert.deepEqual(result, { inner: vertical.front, outer: vertical.back });
  assert.deepEqual(
    assignCopiedPose(
      Object.fromEntries(Object.entries(center).reverse()),
      Object.fromEntries(Object.entries(vertical).reverse()),
    ),
    result,
  );
  const tied = { z: { x: 14.5, y: 9.5 }, a: { x: 12.5, y: 9.5 } };
  const symmetric = { front: { x: 13.5, y: 10.5 }, back: { x: 13.5, y: 8.5 } };
  assert.deepEqual(assignCopiedPose(tied, symmetric), { a: symmetric.front, z: symmetric.back });
});

test('copied-pose matching and tie priority agree with exhaustive assignment across varied poses', () => {
  const pool = Array.from({ length: 18 }, (_, i) => ({
    x: 1.5 + (i % 6) * 4,
    y: 1.5 + Math.floor(i / 6) * 4,
  }));
  for (let sample = 0; sample < 16; sample++) {
    const count = 3 + (sample % 4);
    const source = Object.fromEntries(
      Array.from({ length: count }, (_, i) => [`d${i}`, pool[(sample * 7 + i * 5) % pool.length]]),
    );
    const copied = Object.fromEntries(
      Array.from({ length: count }, (_, i) => [
        `slot${i}`,
        {
          ...pool[(sample * 11 + i * 7) % pool.length],
          x: pool[(sample * 11 + i * 7) % pool.length].x + 0.5,
        },
      ]),
    );
    const priority = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      b.y - a.y || Math.abs(a.x - 13.5) - Math.abs(b.x - 13.5);
    const ids = Object.keys(source).sort((a, b) => priority(source[a], source[b]) || a.localeCompare(b));
    const targets = Object.values(copied).sort((a, b) => priority(a, b) || a.x - b.x);
    let minimum = Number.POSITIVE_INFINITY;
    let expected: FormationPose = {};
    function enumerate(available: string[], chosen: string[], cost: number) {
      if (!available.length) {
        if (cost < minimum - 1e-9) {
          minimum = cost;
          expected = Object.fromEntries(chosen.map((id, i) => [id, targets[i]]));
        }
        return;
      }
      const target = targets[chosen.length];
      for (const id of available) {
        enumerate(
          available.filter((other) => other !== id),
          [...chosen, id],
          cost + Math.hypot(source[id].x - target.x, source[id].y - target.y),
        );
      }
    }
    enumerate(ids, [], 0);
    const result = assignCopiedPose(source, copied);
    assert.ok(Math.abs(assignmentCost(source, result) - minimum) < 1e-8);
    assert.deepEqual(result, expected, `Optimal tie assignment for sample ${sample}`);
  }
});

test('five/seven template assignment matches a brute-force optimum, beats greedy and never aliases templates', () => {
  for (const count of [5, 7] as const) {
    const positions = initialPose(Array.from({ length: count }, (_, i) => String(i)));
    const targets = Object.values(positions).map((pos, i) => ({
      x: pos.x + (i % 2 ? 1 : 0),
      y: pos.y + 3 + (i % 2),
    }));
    let minimum = Number.POSITIVE_INFINITY;
    const ids = Object.keys(positions);
    function enumerate(available: number[], cost: number, index: number) {
      if (!available.length) {
        minimum = Math.min(minimum, cost);
        return;
      }
      for (const target of available) {
        const source = positions[ids[index]];
        const pos = targets[target];
        enumerate(
          available.filter((item) => item !== target),
          cost + Math.hypot(source.x - pos.x, source.y - pos.y),
          index + 1,
        );
      }
    }
    enumerate(
      targets.map((_, i) => i),
      0,
      0,
    );
    const result = assignTemplate(positions, { dancerCount: count, positions: targets });
    assert.ok(Math.abs(assignmentCost(positions, result) - minimum) < 1e-8);
    assert.equal(new Set(Object.values(result).map((pos) => `${pos.x}:${pos.y}`)).size, count);
    result[ids[0]].x++;
    assert.notEqual(
      result[ids[0]].x,
      assignTemplate(positions, { dancerCount: count, positions: targets })[ids[0]].x,
    );
  }
  const source = Object.fromEntries([2, 3, 8, 13, 18].map((x, i) => [String(i), { x, y: 9 }]));
  const targets = [2.2, 0.5, 8, 13, 18].map((x) => ({ x, y: 9 }));
  assert.ok(
    Math.abs(assignmentCost(source, assignTemplate(source, { dancerCount: 5, positions: targets })) - 2.3) <
      1e-8,
  );
  assert.throws(() => assignTemplate(source, { dancerCount: 7, positions: targets }), /counts must match/);
});

test('template validation enforces anonymous five/seven geometry and deterministic tie matching', () => {
  const positions = Object.values(initialPose(['1', '2', '3', '4', '5']));
  const template = readFormationTemplate(
    { name: '  Row  ', dancerCount: 5, positions, createdAt: 1 },
    'template',
  );
  assert.equal(template.name, 'Row');
  const source = initialPose(['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(
    assignTemplate(source, template),
    assignTemplate(Object.fromEntries(Object.entries(source).reverse()), template),
  );
  assert.throws(() => readFormationTemplate({ ...template, dancerCount: 6 }, 'bad'), /Invalid/);
  assert.throws(
    () => readFormationTemplate({ ...template, positions: positions.map(() => ({ x: 2, y: 2 })) }, 'bad'),
    /overlap/,
  );
});

test('singing highlights union regular, hidden, adlib and ALL assignments at exact half-open times', () => {
  const { song, distribution } = fixture();
  song.content = {
    hidden: { id: 'hidden', type: 'line', dismissible: true, adlib: true, sectionId: 's', partsIds: ['p'] },
    p: {
      id: 'p',
      type: 'part',
      lineId: 'hidden',
      text: 'test',
      startTime: 3001,
      endTime: 4001,
      recommendedAssignee: '',
    },
    q: {
      id: 'q',
      type: 'part',
      lineId: 'hidden',
      text: 'test',
      startTime: 3500,
      endTime: 3600,
      recommendedAssignee: '',
    },
  };
  distribution.mapping = { p: ['a', 'b', NONE_ID], q: [ALL_ID] };
  assert.deepEqual(activeFormationSingers(song, distribution, 3000), []);
  assert.deepEqual(activeFormationSingers(song, distribution, 3001), ['a', 'b']);
  assert.deepEqual(activeFormationSingers(song, distribution, 3550).sort(), dancerIds(distribution));
  assert.deepEqual(activeFormationSingers(song, distribution, 4001), []);
  const markup = renderToStaticMarkup(
    <Stage activeIds={['b']} artists={distribution.assignees} positions={initialPose(['a', 'b'])} />,
  );
  assert.equal((markup.match(/formation-stage__dancer--singing/g) ?? []).length, 1);
  assert.ok(markup.includes('B, singing'));
});

function seedPersistence() {
  const { song, distribution, formation } = fixture();
  __formationTestDb.reset([
    ['songs/song', { ...song }],
    ['distributions/dist', { ...distribution }],
    [
      'listings/distributions',
      { dist: { id: 'dist', name: 'Original listing', data: { snippet: 'original', groupId: 'group' } } },
    ],
  ]);
  return { song, distribution, formation };
}

test('formation save atomically links the actual document, distribution and listing without losing listing metadata', async () => {
  const { formation } = seedPersistence();
  const saved = await saveFormation(formation);
  assert.equal(saved.id, 'dist');
  assert.equal(__formationTestDb.records.get('distributions/dist')?.formationId, 'dist');
  const listing = __formationTestDb.records.get('listings/distributions');
  assert.deepEqual(listing?.dist, {
    id: 'dist',
    name: 'Original listing',
    updatedAt: saved.updatedAt,
    data: { snippet: 'original', groupId: 'group', formationId: 'dist' },
  });
  assert.deepEqual(deserializeFormation(__formationTestDb.records.get('formations/dist'), 'dist'), saved);
  const custom = { ...saved, id: 'custom-id' };
  __formationTestDb.records.delete('formations/dist');
  __formationTestDb.records.set('distributions/dist', {
    ...__formationTestDb.records.get('distributions/dist'),
    formationId: 'custom-id',
  });
  __formationTestDb.records.set('formations/custom-id', { ...serializeFormation(custom) });
  await saveFormation(custom);
  assert.equal(__formationTestDb.records.has('formations/dist'), false);
  assert.equal(__formationTestDb.records.get('distributions/dist')?.formationId, 'custom-id');
});

test('failed writes, stale cast/window and concurrent edits never partially save or overwrite choreography', async () => {
  const { formation, song } = seedPersistence();
  const before = structuredClone([...__formationTestDb.records]);
  __formationTestDb.failWrite = true;
  await assert.rejects(saveFormation(formation), /failed write/);
  assert.deepEqual([...__formationTestDb.records], before);
  __formationTestDb.failWrite = false;
  __formationTestDb.records.set('songs/song', { ...song, startAt: 3000 });
  await assert.rejects(saveFormation(formation), /anchored|inside/);
  assert.equal(__formationTestDb.records.has('formations/dist'), false);
  const fresh = seedPersistence();
  const saved = await saveFormation(fresh.formation);
  await assert.rejects(saveFormation(fresh.formation), /already exists/);
  __formationTestDb.records.set('formations/dist', {
    ...serializeFormation(saved),
    updatedAt: (saved.updatedAt ?? 0) + 1,
  });
  await assert.rejects(saveFormation(saved), /edited elsewhere/);
});
