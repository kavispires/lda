import type { AuditionDice, AuditionGrade } from './audition';
import type { AudienceOutcome, EpisodeScene, MvpResult, SecretResult } from './audition-episode';
import type { PropertyChange } from './common';
import type { Contestant, PersonalityTraits } from './contestant';
import type { PreparationAction } from './narrative';

export interface PhotoshootWardrobeChoice {
  id: string;
  name: string;
  novelty: number;
  vibeFit: Record<string, 0 | 50 | 100>;
}

export interface PhotoshootConcept {
  id: string;
  name: string;
  description: string;
  preferredTraits: [keyof PersonalityTraits, keyof PersonalityTraits];
  vibeFit: Record<string, 0 | 50 | 100>;
  outfits: PhotoshootWardrobeChoice[];
  props: PhotoshootWardrobeChoice[];
}

export type PhotoshootAction =
  | PreparationAction
  | { type: 'start' }
  | { type: 'advance' }
  | { type: 'styling'; choice: 'intervene' | 'self-style' }
  | { type: 'secret'; contestantId: string };

export type PhotoshootPhase =
  | 'dorms'
  | 'credits'
  | 'briefing'
  | 'concepts'
  | 'draft'
  | 'styling-choice'
  | 'styling-result'
  | 'individual'
  | 'center'
  | 'group'
  | 'gallery'
  | 'ballots'
  | 'ultimate-visual'
  | 'secret-choice'
  | 'secret-result'
  | 'ranking'
  | 'complete';

export interface PhotoshootCheck {
  skill: 'visual' | 'uniqueness' | 'charisma' | 'potential' | 'stagePresence';
  skillLevel: number;
  requiredLevel: 3;
  floor: number;
  adjustedDice: AuditionDice;
  score: number;
}

export interface PhotoshootProposal {
  contestantId: string;
  outfitId: string;
  propId: string;
  outfitName: string;
  propName: string;
  outfitFit: 0 | 50 | 100;
  conceptFit: 0 | 50 | 100;
  tieKeys: Record<string, number>;
}

export interface PhotoshootTeam {
  id: string;
  name: string;
  leaderId: string;
  conceptId: string;
  memberIds: string[];
  conceptScores: Record<string, number>;
  conceptTieKeys: Record<string, number>;
  proposals: PhotoshootProposal[];
  negotiation: null | {
    leaderOutfitId: string;
    challengerId: string | null;
    mediatorId: string | null;
    description: string;
  };
  styling: null | {
    completed: true;
    choice: 'intervene' | 'self-style';
    quality: number;
    modifier: number;
    outfitModifiers: Record<string, number>;
    finalOutfits: Record<string, string>;
    description: string;
  };
  centerId: string | null;
  centerBallots: Record<string, string>;
  centerTotals: Record<string, number>;
  centerTieKeys: Record<string, Record<string, number>>;
}

export interface PhotoshootReaction {
  observerId: string;
  performerId: string;
  kind: 'awe' | 'support' | 'awkward';
  delta: 1 | -1;
  relationshipBefore: number;
  relationshipAfter: number;
  description: string;
  highlighted: boolean;
}

export interface IndividualPhoto {
  contestantId: string;
  teamId: string;
  rawDice: AuditionDice;
  checks: PhotoshootCheck[];
  technicalScore: number;
  stylingModifier: number;
  outfitModifier: number;
  finalScore: number;
  grade: AuditionGrade;
  description: string;
  banter: boolean;
  feedback: { judgeId: 'megan' | 'michael'; score: number; description: string }[];
  reactions: PhotoshootReaction[];
}

export interface GroupPhotoEvaluation {
  contestantId: string;
  rawDice: AuditionDice;
  checks: PhotoshootCheck[];
  technicalScore: number;
  stylingModifier: number;
  outfitModifier: number;
  centerBonus: number;
  actionModifier: number;
  cohesionModifier: number;
  finalScore: number;
  grade: AuditionGrade;
  description: string;
}

export interface PhotoshootGroupAction {
  contestantId: string;
  beneficiaryId: string;
  type: 'steal' | 'yield';
  success: boolean;
  modifier: number;
  description: string;
}

export interface GroupPhoto {
  teamId: string;
  centerId: string;
  evaluations: GroupPhotoEvaluation[];
  actions: PhotoshootGroupAction[];
  relationshipMean: number;
  baseCohesion: number;
  supportCohesion: number;
  stealingPenalty: number;
  cohesionModifier: number;
  finalScore: number;
  grade: AuditionGrade;
  description: string;
}

export interface PhotoshootEpisode {
  version: 1;
  phase: PhotoshootPhase;
  revision: number;
  lastAction: { revision: number; action: PhotoshootAction };
  participantIds: string[];
  startingContestants: Contestant[];
  previousRankedIds: string[];
  teams: PhotoshootTeam[];
  draftPicks: {
    teamId: string;
    contestantId: string;
    round: number;
    tieKeys: Record<string, number>;
    availableIds: string[];
    passedOverIds: string[];
  }[];
  teamCursor: number;
  individualCursor: number;
  groupCursor: number;
  individualPhotos: IndividualPhoto[];
  groupPhotos: GroupPhoto[];
  attention: Record<string, number>;
  receptionBonuses: Record<string, number>;
  screenTime: Record<string, number>;
  peerTieKeys: Record<string, Record<string, number>>;
  awardTieKeys: Record<string, number>;
  peerEvidence: Record<
    string,
    {
      closestFriendId: string;
      override: boolean;
      preferences: Record<string, number>;
      relationships: Record<string, number>;
    }
  >;
  peerVote: MvpResult | null;
  audience: AudienceOutcome | null;
  ultimateVisual: MvpResult | null;
  sealedRankingScores: Record<string, number>;
  rankingTieKeys: Record<string, number>;
  secretCandidates: string[];
  secret: SecretResult | null;
  rankedIds: string[];
  rankRevealed: boolean;
  survivorIds: string[];
  scenes: EpisodeScene[];
  changes: Record<string, PropertyChange[]>;
}
