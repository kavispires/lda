import type { FUID, RecordTimestamps } from './common';

export type StagePosition = { x: number; y: number };
export type FormationPose = Record<FUID, StagePosition>;

export type FormationSnapshot = {
  id: string;
  timestamp: number;
  /** Milliseconds of movement immediately before this destination. */
  transition: number;
  positions: FormationPose;
};

export type Formation = {
  id: FUID;
  type: 'formation';
  version: 2;
  distributionId: FUID;
  songId: FUID;
  groupId: FUID;
  assigneesIds: FUID[];
  snapshots: FormationSnapshot[];
} & RecordTimestamps;

export type FirestoreFormation = Omit<Formation, 'snapshots'> & { snapshots: string };

export type FormationTemplate = {
  id: FUID;
  name: string;
  dancerCount: 5 | 7;
  positions: StagePosition[];
} & RecordTimestamps;
