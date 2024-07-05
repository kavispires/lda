import { FUID } from './common';

export type Group = {
  /**
   * Unique identifier
   */
  id: FUID;
  /**
   * The type of the entity
   */
  type: 'group';
  /**
   * The name of the group
   */
  name: string;
  /**
   * The artists ids in the group
   */
  artistsIds: FUID[];
};

export type Artist = {
  id: FUID;
  type: 'artist';
  name: string;
  color: string; // probably change to hsl?
  track: 'VOCAL' | 'RAP' | 'DANCE';
};
