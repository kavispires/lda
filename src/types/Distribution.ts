import type { FUID, RecordTimestamps, UID } from './common';
import type { Artist } from './Group';

export type Distribution = {
  /**
   * Unique identifier
   */
  id: FUID;
  /**
   * The type of the entity
   */
  type: 'distribution';
  /**
   * The song id
   */
  songId: FUID;
  /**
   * The group id
   */
  groupId: FUID;
  /**
   * The assignees
   */
  assignees: Record<FUID, Artist>;
  /**
   * Mapping of partId and memberId
   */
  mapping: Record<UID, FUID[]>;
  /**
   * The name of the distribution
   */
  name?: string;
  /**
   * Total max assigned milliseconds for an assignee
   */
  maxAssigneeDuration: number;
  /**
   * Total assigned milliseconds per assignee
   */
  summary?: Record<FUID, number>;
} & RecordTimestamps;

export type FirestoreDistribution = Omit<Distribution, 'mapping'> & {
  mapping: string;
};

export type DistributionListingData = {
  status: 'draft' | 'active';
  formationId?: FUID;
};
