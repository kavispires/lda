import type { Artist, Group } from 'types';
import { generateUniqueId } from './song';

export const createGroup = (name: string): Group => {
  return {
    id: generateUniqueId('g', 18),
    type: 'group',
    name,
    artistsIds: {},
    distributionIds: {},
  };
};

export const createArtist = (name: string, color: string, track: Artist['track']): Artist => {
  return {
    id: '_',
    type: 'artist',
    name,
    color,
    track,
  };
};
