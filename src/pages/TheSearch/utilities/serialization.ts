import type { Contestant } from '../types/contestant';

/**
 * Serializes a Contestant object to a JSON string
 * @param contestant - The contestant object to serialize
 * @returns JSON string representation of the contestant
 */
export function serializeContestant(contestant: Contestant): string {
  return JSON.stringify(contestant);
}

/**
 * Deserializes a JSON string to a Contestant object
 * @param json - The JSON string to deserialize
 * @returns The deserialized Contestant object
 */
export function deserializeContestant(json: string): Contestant {
  return JSON.parse(json) as Contestant;
}

/**
 * Serializes a collection of contestants to a Record of JSON strings
 * @param contestants - Record of contestant objects keyed by ID
 * @returns Record of JSON strings keyed by contestant ID
 */
export function serializeContestantCollection(
  contestants: Record<string, Contestant>,
): Record<string, string> {
  const serialized: Record<string, string> = {};

  for (const [id, contestant] of Object.entries(contestants)) {
    serialized[id] = serializeContestant(contestant);
  }

  return serialized;
}

/**
 * Deserializes a collection of JSON strings to contestant objects
 * @param serialized - Record of JSON strings keyed by contestant ID
 * @returns Record of Contestant objects keyed by ID
 */
export function deserializeContestantCollection(
  serialized: Record<string, string>,
): Record<string, Contestant> {
  const contestants: Record<string, Contestant> = {};

  for (const [id, json] of Object.entries(serialized)) {
    try {
      contestants[id] = deserializeContestant(json);
    } catch {
      // Skip invalid contestant data
    }
  }

  return contestants;
}
