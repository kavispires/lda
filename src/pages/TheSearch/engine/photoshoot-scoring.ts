import type { AuditionDice } from '../types/audition';
import type { MvpResult } from '../types/audition-episode';
import type { Contestant } from '../types/contestant';
import type {
  GroupPhotoEvaluation,
  IndividualPhoto,
  PhotoshootCheck,
  PhotoshootConcept,
  PhotoshootEpisode,
  PhotoshootTeam,
} from '../types/photoshoot-episode';
import { auditionGrade, auditionMinimumFace } from './audition-scoring';
import { battleRelationship } from './battle-scoring';

export const clampPhoto = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
export const meanPhoto = (values: readonly number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
export const normalizePhotoTrait = (value: number) => (value + 10) * 5;
export const photoMention = (id: string) => `[[contestant:${id}]]`;

export function photoshootCheck(
  contestant: Contestant,
  skill: PhotoshootCheck['skill'],
  rawDice: AuditionDice,
): PhotoshootCheck {
  if (rawDice.length !== 2 || rawDice.some((die) => !Number.isInteger(die) || die < 1 || die > 6))
    throw new Error('Photoshoot requires two saved dice from 1 to 6.');
  const skillLevel =
    skill === 'potential' || skill === 'charisma'
      ? contestant.utilitySkills[skill]
      : contestant.coreSkills[skill];
  const floor = auditionMinimumFace(skillLevel, 3);
  const adjustedDice: AuditionDice = [Math.max(floor, rawDice[0]), Math.max(floor, rawDice[1])];
  return {
    skill,
    skillLevel,
    requiredLevel: 3,
    floor,
    adjustedDice,
    score: 10 * (adjustedDice[0] + adjustedDice[1] - 2),
  };
}

export function photoshootConceptPreference(contestant: Contestant, concept: PhotoshootConcept) {
  const fit = concept.vibeFit[contestant.specialties.visualVibe];
  if (fit === undefined) throw new Error('Missing frozen Photoshoot visual vibe fit.');
  return (
    0.7 * fit +
    0.3 *
      meanPhoto(concept.preferredTraits.map((trait) => normalizePhotoTrait(contestant.personality[trait])))
  );
}

export function photoshootStylingQuality(contestants: readonly Contestant[]) {
  return (
    0.5 * meanPhoto(contestants.map((entry) => (entry.coreSkills.uniqueness - 1) * 25)) +
    0.5 * meanPhoto(contestants.map((entry) => normalizePhotoTrait(entry.personality.curiosity)))
  );
}

export function scoreIndividualPhoto(
  contestant: Contestant,
  team: PhotoshootTeam,
  rawDice: AuditionDice,
): IndividualPhoto {
  if (!team.styling) throw new Error('Complete styling before photography.');
  const checks = (['visual', 'uniqueness', 'charisma', 'potential'] as const).map((skill) =>
    photoshootCheck(contestant, skill, rawDice),
  );
  const score = (skill: PhotoshootCheck['skill']) => checks.find((entry) => entry.skill === skill)!.score;
  const technicalScore = 0.4 * score('visual') + 0.4 * score('uniqueness') + 0.2 * score('charisma');
  const stylingModifier = team.styling.modifier;
  const outfitModifier = team.styling.outfitModifiers[contestant.id];
  const finalScore = clampPhoto(technicalScore + stylingModifier + outfitModifier);
  const grade = auditionGrade(finalScore);
  const description = `${contestant.name} wears ${team.styling.finalOutfits[contestant.id]}: ${
    grade === 'A'
      ? 'a striking editorial portrait with a confident gaze'
      : grade === 'B'
        ? 'a convincing portrait with a clear pose'
        : grade === 'C'
          ? 'a usable portrait, with some uncertain expression'
          : grade === 'D'
            ? 'a hesitant pose that never quite settles'
            : 'a visibly awkward frame; the expression and outfit do not come together'
  }. Individual edit: ${grade}.`;
  const megan = 0.7 * score('uniqueness') + 0.3 * score('potential');
  const michael = 0.7 * score('visual') + 0.3 * score('charisma');
  return {
    contestantId: contestant.id,
    teamId: team.id,
    rawDice: [...rawDice],
    checks,
    technicalScore,
    stylingModifier,
    outfitModifier,
    finalScore,
    grade,
    description,
    banter: contestant.personality.extroversion >= 5 || contestant.utilitySkills.charisma >= 4,
    feedback: [
      {
        judgeId: 'megan',
        score: megan,
        description: `${contestant.name}, ${
          megan >= 70
            ? 'your distinctive expression suggests real possibilities'
            : megan >= 40
              ? 'there is an idea here, but I need a more personal expression'
              : 'the expression feels borrowed; find something that is yours'
        }. ${stylingModifier > 0 ? 'The styling helps frame that work.' : 'The styling does not rescue the uncertain expression.'}`,
      },
      {
        judgeId: 'michael',
        score: michael,
        description: `${contestant.name}, ${
          michael >= 70
            ? 'your gaze and connection with the camera read clearly'
            : michael >= 40
              ? 'the camera connection comes and goes'
              : 'the camera catches your hesitation rather than a clear intention'
        }. ${finalScore >= 70 ? 'The final frame holds together.' : 'The final frame still needs work.'}`,
      },
    ],
    reactions: [],
  };
}

export function scoreGroupPhotoMember(
  contestant: Contestant,
  team: PhotoshootTeam,
  rawDice: AuditionDice,
  actionModifier: number,
  cohesionModifier: number,
): GroupPhotoEvaluation {
  if (!team.styling || !team.centerId) throw new Error('Styling and a center are required.');
  const checks = (['visual', 'uniqueness', 'stagePresence', 'charisma'] as const).map((skill) =>
    photoshootCheck(contestant, skill, rawDice),
  );
  const technicalScore = checks.reduce(
    (sum, check, index) => sum + check.score * [0.35, 0.25, 0.25, 0.15][index],
    0,
  );
  const centerBonus = contestant.id === team.centerId ? 5 : 0;
  const stylingModifier = team.styling.modifier;
  const outfitModifier = team.styling.outfitModifiers[contestant.id];
  const finalScore = clampPhoto(
    technicalScore + stylingModifier + outfitModifier + centerBonus + actionModifier + cohesionModifier,
  );
  const grade = auditionGrade(finalScore);
  return {
    contestantId: contestant.id,
    rawDice: [...rawDice],
    checks,
    technicalScore,
    stylingModifier,
    outfitModifier,
    centerBonus,
    actionModifier,
    cohesionModifier,
    finalScore,
    grade,
    description: `${contestant.name} ${
      contestant.id === team.centerId ? 'anchors the center of the cover' : 'takes a place in the cover'
    }; ${
      finalScore >= 70
        ? 'the pose reads clearly beside the others'
        : 'the pose looks uncertain beside the others'
    }. Personal cover edit: ${grade}.`,
  };
}

export function choosePhotoshootVisual(
  contestants: readonly Contestant[],
  photos: readonly IndividualPhoto[],
  tieKeys: PhotoshootEpisode['peerTieKeys'],
  awardTieKeys: Record<string, number>,
): { result: MvpResult; evidence: PhotoshootEpisode['peerEvidence'] } {
  const score = (id: string) => {
    const photo = photos.find((entry) => entry.contestantId === id);
    if (!photo) throw new Error('Ultimate Visual requires every individual photograph.');
    return photo.finalScore;
  };
  const ballots: Record<string, string> = {};
  const totals = Object.fromEntries(contestants.map(({ id }) => [id, 0]));
  const evidence: PhotoshootEpisode['peerEvidence'] = {};
  for (const voter of contestants) {
    const eligible = contestants.map(({ id }) => id).filter((id) => id !== voter.id);
    const tie = (a: string, b: string) =>
      score(b) - score(a) || tieKeys[voter.id][a] - tieKeys[voter.id][b] || a.localeCompare(b);
    const closestFriendId = [...eligible].sort(
      (a, b) => battleRelationship(voter, b) - battleRelationship(voter, a) || tie(a, b),
    )[0];
    const preferences = Object.fromEntries(
      eligible.map((id) => [id, 0.65 * battleRelationship(voter, id) + 0.35 * score(id)]),
    );
    const exceptional = eligible.filter((id) => score(id) >= 95 && score(id) - score(closestFriendId) >= 25);
    const chosen = exceptional.length
      ? exceptional.sort(tie)[0]
      : eligible.sort((a, b) => preferences[b] - preferences[a] || tie(a, b))[0];
    ballots[voter.id] = chosen;
    totals[chosen]++;
    evidence[voter.id] = {
      closestFriendId,
      override: exceptional.length > 0,
      preferences,
      relationships: Object.fromEntries(eligible.map((id) => [id, battleRelationship(voter, id)])),
    };
  }
  const max = Math.max(...Object.values(totals));
  const tiedIds = contestants.map(({ id }) => id).filter((id) => totals[id] === max);
  const winnerId = [...tiedIds].sort(
    (a, b) => score(b) - score(a) || awardTieKeys[a] - awardTieKeys[b] || a.localeCompare(b),
  )[0];
  return { result: { ballots, totals, winnerId, tiedIds }, evidence };
}
