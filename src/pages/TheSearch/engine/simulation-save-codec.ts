import LZString from 'lz-string';

const PREFIX = 'the-search:compressed:';
const MAX_EXPANDED_LENGTH = 256 * 1024 * 1024;
const MAX_DEPTH = 256;
type PackedNode = null | boolean | number | string | number[] | Record<string, number>;

function isReference(value: unknown, limit: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < limit;
}

function isPackedNode(value: unknown, index: number): value is PackedNode {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  const references = Array.isArray(value) ? value : Object.values(value);
  return references.every((reference) => isReference(reference, index));
}

export function encodeSimulationSave(value: unknown): string {
  const nodes: PackedNode[] = [];
  const indices = new Map<string, number>();
  // The reviver visits children first, so identical snapshots have identical child references.
  const root: number = JSON.parse(JSON.stringify(value), (_key, node: PackedNode) => {
    const key = JSON.stringify(node);
    const existing = indices.get(key);
    if (existing !== undefined) return existing;
    const index = nodes.length;
    indices.set(key, index);
    nodes.push(node);
    return index;
  });
  validatePackedTable([root, nodes]);
  return `${PREFIX}2:${LZString.compressToUTF16(JSON.stringify([root, nodes]))}`;
}

function validatePackedTable(value: unknown): { root: number; nodes: PackedNode[] } {
  const invalid = (): never => {
    throw new Error('The compact simulation save is invalid.');
  };
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !Array.isArray(value[1]) ||
    !isReference(value[0], value[1].length)
  )
    return invalid();
  const root = value[0];
  const nodes: PackedNode[] = [];
  const lengths: number[] = [];
  const depths: number[] = [];
  for (const node of value[1]) {
    if (!isPackedNode(node, nodes.length)) return invalid();
    let length: number;
    let depth = 0;
    if (node !== null && typeof node === 'object') {
      const references: number[] = Array.isArray(node) ? node : Object.values(node);
      length = 2 + Math.max(0, references.length - 1);
      for (const reference of references) {
        length += lengths[reference];
        depth = Math.max(depth, depths[reference] + 1);
      }
      if (!Array.isArray(node)) for (const key of Object.keys(node)) length += JSON.stringify(key).length + 1;
    } else length = JSON.stringify(node).length;
    if (length > MAX_EXPANDED_LENGTH || depth > MAX_DEPTH) return invalid();
    nodes.push(node);
    lengths.push(length);
    depths.push(depth);
  }
  return { root, nodes };
}

function unpack(value: unknown): unknown {
  const { root, nodes } = validatePackedTable(value);
  // Expand each reference separately: live contestants must never alias frozen historical snapshots.
  const restore = (index: number): unknown => {
    const node = nodes[index];
    if (Array.isArray(node)) return node.map(restore);
    if (node !== null && typeof node === 'object')
      return Object.fromEntries(Object.entries(node).map(([key, reference]) => [key, restore(reference)]));
    return node;
  };
  return restore(root);
}

export function decodeSimulationSave(stored: string): unknown {
  if (!stored.startsWith(PREFIX)) return JSON.parse(stored);
  const version = stored.slice(PREFIX.length, PREFIX.length + 2);
  if (version !== '1:' && version !== '2:')
    throw new Error('The saved simulation uses an unsupported compression format.');
  const json = LZString.decompressFromUTF16(stored.slice(PREFIX.length + 2));
  if (!json) throw new Error('The compressed simulation save is invalid.');
  const value: unknown = JSON.parse(json);
  return version === '2:' ? unpack(value) : value;
}
