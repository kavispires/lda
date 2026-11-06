import assert from 'node:assert/strict';
import { test } from 'node:test';
import LZString from 'lz-string';
import { decodeSimulationSave, encodeSimulationSave } from './simulation-save-codec';

const packed = (value: unknown) =>
  `the-search:compressed:2:${LZString.compressToUTF16(JSON.stringify(value))}`;

test('compact saves retain JSON values, Unicode and independent copies of repeated snapshots', () => {
  const person = {
    name: 'Performer \u00e9 \ud83c\udfb5',
    relationships: { peer: [0, 50, 100] },
    optional: undefined,
    details: JSON.parse('{"__proto__":{"kept":true},"$ref":0,"nodes":[null,false,"",0]}'),
  };
  const original = { live: person, snapshots: [structuredClone(person), person] };
  const encoded = encodeSimulationSave(original);
  assert.ok(encoded.startsWith('the-search:compressed:2:'));
  const restored = decodeSimulationSave(encoded);
  assert.deepEqual(restored, JSON.parse(JSON.stringify(original)));
  assert.ok(restored && typeof restored === 'object' && 'live' in restored && 'snapshots' in restored);
  assert.ok(Array.isArray(restored.snapshots));
  assert.notEqual(restored.live, restored.snapshots[0]);
  assert.notEqual(restored.snapshots[0], restored.snapshots[1]);
  assert.ok(restored.live && typeof restored.live === 'object' && 'name' in restored.live);
  restored.live.name = 'Changed live profile';
  assert.equal(restored.snapshots[0].name, person.name);
  assert.equal(restored.snapshots[1].name, person.name);
  assert.equal(person.name, original.live.name);
  for (const value of [null, true, false, 0, -42.5, '', [], {}])
    assert.deepEqual(decodeSimulationSave(encodeSimulationSave(value)), value);
});

test('plain JSON and original UTF-16 compressed saves remain readable and adopt compact storage on write', () => {
  const original = { status: 'ready', snapshots: [{ name: 'Before packing', values: [1, 2, 3] }] };
  const json = JSON.stringify(original);
  for (const saved of [json, `the-search:compressed:1:${LZString.compressToUTF16(json)}`]) {
    const restored = decodeSimulationSave(saved);
    assert.deepEqual(restored, original);
    const rewritten = encodeSimulationSave(restored);
    assert.ok(rewritten.startsWith('the-search:compressed:2:'));
    assert.deepEqual(decodeSimulationSave(rewritten), original);
  }
});

test('compact saves reject invalid references, cycles, unsupported formats and excessive expansion', () => {
  const oversized: unknown[] = [null];
  for (let index = 0; index < 30; index++) oversized.push([index, index]);
  const deep: unknown[] = [null];
  for (let index = 0; index < 260; index++) deep.push([index]);
  for (const value of [
    {},
    [0, []],
    [-1, [null]],
    [0.5, [null]],
    [true, [null]],
    [1, [null]],
    [0, [[0]]],
    [0, [{ child: 0 }]],
    [0, [[1], null]],
    [1, [null, ['0']]],
    [1, [null, { child: -1 }]],
    [1, [null, { child: 0.5 }]],
    [oversized.length - 1, oversized],
    [deep.length - 1, deep],
  ])
    assert.throws(() => decodeSimulationSave(packed(value)), /compact simulation save is invalid/);
  assert.throws(
    () => decodeSimulationSave(`the-search:compressed:2:${LZString.compressToUTF16('[0,[1e400]]')}`),
    /compact simulation save is invalid/,
  );
  for (const saved of ['the-search:compressed:2:', 'the-search:compressed:999:anything'])
    assert.throws(() => decodeSimulationSave(saved), /invalid|unsupported/);
  const tooDeep = Array.from({ length: 260 }).reduce<unknown>((value) => [value], null);
  assert.throws(() => encodeSimulationSave(tooDeep), /compact simulation save is invalid/);
});

test('packing repeated season cast snapshots materially reduces storage without removing history', () => {
  const cast = Array.from({ length: 50 }, (_, index) => ({
    id: `contestant-${index}`,
    relationships: Object.fromEntries(
      Array.from({ length: 50 }, (_, peer) => [
        `contestant-${peer}`,
        Array.from({ length: 20 }, (_, beat) => (index * 37 + peer * 11 + beat * 17) % 101),
      ]),
    ),
    history: Array.from({ length: 10 }, (_, episode) => ({
      episode,
      description: `Recorded performance and reactions for contestant ${index} in episode ${episode}`,
    })),
  }));
  const original = {
    contestants: cast,
    episodes: Array.from({ length: 11 }, () => ({ startingCast: cast })),
  };
  const json = JSON.stringify(original);
  const previous = LZString.compressToUTF16(json);
  const encoded = encodeSimulationSave(original);
  assert.ok(encoded.length < previous.length / 2, 'repeated snapshots must use less than half the old quota');
  assert.deepEqual(decodeSimulationSave(encoded), JSON.parse(json));
});
