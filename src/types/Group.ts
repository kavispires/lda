import type { FUID, TypeaheadEntry } from './common';
import type { ListingEntry } from './Listing';

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
  artistsIds: Record<FUID, number>;
  /**
   * Group statistics (JSON stringified GroupStats)
   */
  stats?: string;
};

export type GroupStats = {
  /**
   * Member who ranks #1 most often across distributions
   */
  mostFirst: {
    memberId: FUID;
    memberName: string;
    count: number;
    percentage: number;
  } | null;
  /**
   * Member who ranks #2 most often across distributions
   */
  mostSecond: {
    memberId: FUID;
    memberName: string;
    count: number;
    percentage: number;
  } | null;
  /**
   * Member who ranks last most often across distributions
   */
  mostLast: {
    memberId: FUID;
    memberName: string;
    count: number;
    percentage: number;
  } | null;
  /**
   * Total number of distributions analyzed
   */
  totalDistributions: number;
  /**
   * Timestamp of last calculation
   */
  lastUpdated: number;
};

export type FirebaseGroup = ListingEntry<Group>;

export type FirebaseGroups = Record<FUID, ListingEntry<Group>>;

export type GroupsData = {
  groupsTypeahead: TypeaheadEntry[];
  groups: FirebaseGroups;
};

export type Artist = {
  /**
   * Unique identifier
   */
  id: FUID;
  /**
   * The type of the entity
   */
  type: 'artist';
  /**
   * The name of the artist
   */
  name: string;
  /**
   * The color associated with the artist
   */
  color: string; // probably change to hsl?
  /**
   * The prominent skill of the artist
   */
  track: 'VOCAL' | 'RAP' | 'DANCE';
  /**
   * The stage persona of the artist
   */
  persona?: string;
  /**
   * The statistics of the artist
   */
  stats?: {
    /**
     * Vocal skill rating (1-5)
     */
    vocals: number;
    /**
     * Rap skill rating (1-5)
     */
    rap: number;
    /**
     * Dance skill rating (1-5)
     */
    dance: number;
    /**
     * Stage presence skill rating (1-5)
     */
    stagePresence: number;
    /**
     * Visual looks skill rating (1-5)
     */
    visual: number;
    /**
     * Personality/Visual uniqueness skill rating (1-5)
     */
    uniqueness: number;
  };
};

export type FirebaseArtist = ListingEntry<Artist>;
