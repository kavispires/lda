import type { Contestant, UtilitySkills } from '../types/contestant';
import type { TrackSpecialElection } from '../types/track-specials-episode';
import type { VersatilityTeam } from '../types/versatility-episode';
import { auditionMinimumFace, rollAuditionDice } from './audition-scoring';
import { battleCheck, battleRelationship, changeBattleRelationship, clampBattle } from './battle-scoring';
import type { RandomSource } from './random';

export function electVersatilityRole(
  members: readonly Contestant[],
  role: 'leader' | 'center',
  tieKeys: Record<string, number>,
): TrackSpecialElection {
  const ability = (id: string) => {
    const person = members.find((person) => person.id === id)!;
    return role === 'leader' ? person.coreSkills.leadership : person.coreSkills.stagePresence;
  };
  const tie = (a: string, b: string) =>
    ability(b) - ability(a) ||
    (role === 'center'
      ? members.find((person) => person.id === b)!.coreSkills.visual -
        members.find((person) => person.id === a)!.coreSkills.visual
      : 0) ||
    tieKeys[a] - tieKeys[b] ||
    a.localeCompare(b);
  const ids = members.map((person) => person.id);
  const preferences = Object.fromEntries(
    members.map((voter) => [
      voter.id,
      Object.fromEntries(
        members.map((candidate) => [
          candidate.id,
          role === 'leader'
            ? candidate.coreSkills.leadership * 1000 +
              Number(voter.specialties.leadershipStyle === candidate.specialties.leadershipStyle) * 100 +
              battleRelationship(voter, candidate.id)
            : 0.7 * battleRelationship(voter, candidate.id) +
              0.3 * (candidate.coreSkills.stagePresence - 1) * 25,
        ]),
      ),
    ]),
  );
  const ballots = Object.fromEntries(
    ids.map((id) => [id, [...ids].sort((a, b) => preferences[id][b] - preferences[id][a] || tie(a, b))[0]]),
  );
  const totals = Object.fromEntries(
    ids.map((id) => [id, Object.values(ballots).filter((vote) => vote === id).length]),
  );
  return {
    ballots,
    preferences,
    totals,
    tieKeys,
    winnerId: [...ids].sort((a, b) => totals[b] - totals[a] || tie(a, b))[0],
    appointed: false,
  };
}

export function practiceVersatilityTeam(team: VersatilityTeam, members: Contestant[], random: RandomSource) {
  const session = team.practice.length;
  if (session >= 2) throw new Error('Exactly two rehearsals are allowed.');
  const skills: (keyof UtilitySkills)[] =
    session === 0 ? ['learning', 'memory', 'consistency'] : ['stamina', 'consistency', 'memory'];
  const leader = members.find((person) => person.id === team.captainId)!;
  const leaderDice = rollAuditionDice(random);
  const leadershipCheck = battleCheck('leadership', leader.coreSkills.leadership, 3, leaderDice);
  const leadershipSuccess = leadershipCheck.adjustedDice[0] + leadershipCheck.adjustedDice[1] >= 8;
  const coordinationBefore = team.coordination;
  const coordinationChange = leadershipSuccess ? 1 : -1;
  team.coordination = clampBattle(coordinationBefore + coordinationChange, -5, 5);
  const contestants = members.map((person) => {
    const rawDice = rollAuditionDice(random);
    const checks = skills.map((skill, index) => ({
      skill,
      skillLevel: person.utilitySkills[skill],
      requiredLevel: 3 as const,
      floor: auditionMinimumFace(person.utilitySkills[skill], 3),
      weight: index ? 1 : 2,
      adjustedDice: battleCheck(skill, person.utilitySkills[skill], 3, rawDice).adjustedDice,
    }));
    const weightedSum =
      checks.reduce((sum, check) => sum + (check.adjustedDice[0] + check.adjustedDice[1]) * check.weight, 0) /
      4;
    const practiceBefore = person.aggregations.practice;
    const sessionPractice = Math.min(5, Math.floor(weightedSum / 2));
    const practiceAfter = Math.max(practiceBefore, sessionPractice);
    person.aggregations.practice = practiceAfter;
    if (person.id !== leader.id)
      changeBattleRelationship(
        person,
        leader.id,
        leadershipSuccess
          ? 1
          : battleRelationship(person, leader.id) < 40 || person.personality.gentleness < -3
            ? -2
            : -1,
      );
    return {
      contestantId: person.id,
      rawDice,
      checks,
      practiceBefore,
      practiceAfter,
      weightedSum,
      sessionPractice,
      improved: practiceAfter > practiceBefore,
    };
  });
  team.practice.push({
    session: session + 1,
    title: session === 0 ? 'Part learning' : 'Full rehearsal',
    leaderDice,
    leadershipCheck: { ...leadershipCheck, successThreshold: 8 },
    leadershipSuccess,
    coordinationBefore,
    coordinationAfter: team.coordination,
    coordinationChange,
    contestants,
  });
}

export function versatilityRefuses(person: Contestant, team: VersatilityTeam): boolean {
  const second = team.practice[1]?.contestants.find((record) => record.contestantId === person.id);
  return ['MASCULINE', 'SWAG'].includes(person.specialties.visualVibe) ||
    person.specialties.rapStyle === 'SWAG'
    ? person.personality.curiosity <= -5 && person.personality.maturity < 5 && second?.improved === false
    : false;
}
