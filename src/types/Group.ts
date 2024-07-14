import { FUID, TypeaheadEntry } from './common';
import { ListingEntry } from './Listing';

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
  artistsIds: Record<FUID, true>;
  /**
   * The distributions ids in the group;
   */
  distributionIds: Record<FUID, number>;
};

export type FirebaseGroup = ListingEntry<Group>;

export type FirebaseGroups = Record<FUID, ListingEntry<Group>>;

export type GroupsData = {
  groupsTypeahead: TypeaheadEntry[];
  groups: FirebaseGroups;
};

export type Artist = {
  id: FUID;
  type: 'artist';
  name: string;
  color: string; // probably change to hsl?
  track: 'VOCAL' | 'RAP' | 'DANCE';
};

export type FirebaseArtist = ListingEntry<Artist>;
