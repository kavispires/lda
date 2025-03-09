import { FUID, RecordTimestamps } from './common';

export type Formation = {
  /**
   * Unique identifier
   */
  id: FUID;
  /**
   * The type of the entity
   */
  type: 'formation';
  /**
   * The distribution id
   */
  distributionId: FUID;
  /**
   * The song id
   */
  songId: FUID;
  /**
   * The group id
   */
  groupId: FUID;
  /**
   * The assignees object
   */
  assigneesIds: FUID[];
  /**
   * Mapping of timestamp and { assigneeId: position }
   * This mapping should show the position of all assignees of each timestamp
   * The value format is positionX::positionY and the index respects the same index as in assigneesIds
   */
  timeline: Record<string, string[]>;
} & RecordTimestamps;

export type FirestoreFormation = Omit<Formation, 'timeline'> & {
  timeline: string;
};
