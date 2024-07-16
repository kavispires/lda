import { Artist } from './Group';
import { FUID, RecordTimestamps, UID } from './common';

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
   *
   */
  songId: FUID;
  /**
   *
   */
  groupId: FUID;
  /**
   *
   */
  assignees: Record<FUID, Artist>;
  /**
   * Mapping of partId and memberId
   */
  mapping: Record<UID, FUID[]>;
  /**
   *
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
