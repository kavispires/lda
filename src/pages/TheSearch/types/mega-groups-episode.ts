import type { AudienceOutcome, EpisodeScene, MvpResult, SecretResult } from './audition-episode';
import type { BattleCheck, BattleConflictChoice, BattlePerformance, BattleTeam } from './battle-episode';
import type { PropertyChange } from './common';
import type { Contestant, PersonalityTraits } from './contestant';
import type { PreparationAction } from './narrative';

export interface MegaGroupTestPair {
  id: string;
  name: string;
  sides: [
    { name: string; image: string; traits: [keyof PersonalityTraits, keyof PersonalityTraits] },
    { name: string; image: string; traits: [keyof PersonalityTraits, keyof PersonalityTraits] },
  ];
}

export type MegaGroupsAction =
  | PreparationAction
  | { type: 'start' }
  | { type: 'advance' }
  | { type: 'conflict'; choice: BattleConflictChoice }
  | { type: 'secret'; contestantId: string };

export type MegaGroupsPhase =
  | 'dorms'
  | 'credits'
  | 'briefing'
  | 'images'
  | 'choices'
  | 'transfers'
  | 'rosters'
  | 'rehearsal'
  | 'intervention'
  | 'center'
  | 'performance'
  | 'reviews'
  | 'jane'
  | 'mvp'
  | 'secret-choice'
  | 'secret-result'
  | 'ranking'
  | 'elimination'
  | 'withdrawal'
  | 'complete';

export interface MegaGroupTeam extends BattleTeam {
  initialMemberIds: string[];
  songIds: [string, string];
  assignmentsBySong: Record<string, Record<string, string>>;
  leaderBallots: Record<string, string>;
  leaderTotals: Record<string, number>;
  centerTotals: Record<string, number>;
  roleTieKeys: Record<string, Record<string, number>>;
}

export interface MegaGroupsEpisode {
  version: 1;
  phase: MegaGroupsPhase;
  revision: number;
  lastAction: { revision: number; action: MegaGroupsAction };
  participantIds: string[];
  startingContestants: Contestant[];
  previousRankedIds: string[];
  comfort: { distressedId: string; comforterId: string; visitor: boolean; tieKeys: Record<string, number> };
  hands: { tired: string[]; fun: string[]; ready: string[] };
  questionCursor: number;
  testId: string | null;
  blindOrder: string[];
  choices: { contestantId: string; sums: [number, number]; side: 0 | 1; tieKey: number | null }[];
  teams: MegaGroupTeam[];
  transfer: {
    fromTeamId: string | null;
    excess: number;
    ballots: Record<string, string[]>;
    evidence: Record<string, Record<string, { relationship: number; skill: number; blend: number }>>;
    totals: Record<string, number>;
    tieKeys: Record<string, number>;
    movedIds: string[];
  } | null;
  performanceCursor: number;
  reviewCursor: number;
  performances: (BattlePerformance & { songId: string })[];
  conflict: { teamId: string; contestantIds: string[]; description: string } | null;
  interventions: Record<string, BattleConflictChoice>;
  jane: { contestantId: string; checks: BattleCheck[]; score: number; approved: boolean }[];
  audience: AudienceOutcome | null;
  mvp: MvpResult | null;
  secretCandidates: string[];
  secret: SecretResult | null;
  rankedIds: string[];
  rankRevealed: boolean;
  finalRankedIds: string[];
  eliminatedId: string | null;
  withdrawnId: string | null;
  withdrawalReason: 'unhappy-uninvested' | 'lowest-ranked' | null;
  withdrawalEvidence: {
    unhappiestId: string;
    tieKeys: Record<string, number>;
    happiness: Record<string, number>;
    investment: number;
  } | null;
  survivorIds: string[];
  initialPractice: Record<string, number>;
  scenes: EpisodeScene[];
  changes: Record<string, PropertyChange[]>;
}
