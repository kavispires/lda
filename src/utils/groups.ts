import type { Artist, Group } from 'types';
import { generateUniqueId } from './song';

/**
 * Creates a new group object with a unique ID, specified name, and empty artist and distribution ID maps.
 *
 * @param name - The name of the group to be created.
 * @returns A `Group` object containing the generated ID, type, name, and empty `artistsIds` and `distributionIds`.
 */
export const createGroup = (name: string): Group => {
  return {
    id: generateUniqueId('g', 18),
    type: 'group',
    name,
    artistsIds: {},
    distributionIds: {},
  };
};

/**
 * Creates a new Artist object with the specified properties.
 *
 * @param name - The name of the artist.
 * @param color - The color associated with the artist.
 * @param track - The track information for the artist.
 * @param stats - Optional statistics for the artist.
 * @returns A new Artist object.
 */
export const createArtist = (
  name: string,
  color: string,
  track: Artist['track'],
  stats?: Artist['stats'],
): Artist => {
  return {
    id: '_',
    type: 'artist',
    name,
    color,
    track,
    ...(stats && { stats }),
  };
};
