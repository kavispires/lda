import type { Contestant } from '../types/contestant';
import type { FinaleCatalog, FinaleDraftPick, FinaleTeam } from '../types/finale-episode';
import { battleRelationship } from './battle-scoring';
import { type RandomSource, shuffleWithRandom } from './random';

export function createFinaleTeams(
  previousRankedIds: readonly string[],
  catalog: FinaleCatalog,
  random: RandomSource,
): FinaleTeam[] {
  if (previousRankedIds.length !== 8 || new Set(previousRankedIds).size !== 8)
    throw new Error('Finale draft requires eight unique previous ranks.');
  const songs = shuffleWithRandom(catalog.originals, random).slice(0, 2);
  return previousRankedIds
    .slice(0, 2)
    .map((captainId, index) => ({ captainId, memberIds: [captainId], songId: songs[index].id, parts: [] }));
}
export function draftFinalePick(
  contestants: readonly Contestant[],
  teams: FinaleTeam[],
  turn: number,
  random: RandomSource,
): FinaleDraftPick {
  const snake = [0, 1, 1, 0, 0, 1];
  if (!Number.isInteger(turn) || turn < 0 || turn >= snake.length)
    throw new Error('Invalid Finale draft turn.');
  const team = teams[snake[turn]];
  const captain = contestants.find((entry) => entry.id === team.captainId);
  if (!captain) throw new Error('Missing Finale captain.');
  const selected = new Set(teams.flatMap((entry) => entry.memberIds));
  const eligible = contestants
    .filter((entry) => !selected.has(entry.id))
    .map((entry) => {
      const stage = 25 * (entry.coreSkills.stagePresence - 1);
      const consistency = 25 * (entry.utilitySkills.consistency - 1);
      return {
        contestantId: entry.id,
        stage,
        consistency,
        ability: 0.5 * stage + 0.5 * consistency,
        affection: battleRelationship(captain, entry.id),
        tieKey: random(),
      };
    });
  if (!eligible.length) throw new Error('No eligible Finale draft candidate.');
  const sorted = [...eligible].sort(
    (a, b) =>
      b.ability - a.ability ||
      b.affection - a.affection ||
      a.tieKey - b.tieKey ||
      a.contestantId.localeCompare(b.contestantId),
  );
  team.memberIds.push(sorted[0].contestantId);
  return { captainId: team.captainId, contestantId: sorted[0].contestantId, eligible };
}
export function assignFinaleParts(
  contestants: readonly Contestant[],
  teams: FinaleTeam[],
  catalog: FinaleCatalog,
  random: RandomSource,
): void {
  for (const team of teams) {
    const song = catalog.originals.find((entry) => entry.id === team.songId);
    if (!song || team.memberIds.length !== 4 || team.parts.length)
      throw new Error('Finale parts require one complete unduplicated team.');
    const members = team.memberIds
      .map((id) => {
        const entry = contestants.find((person) => person.id === id);
        if (!entry) throw new Error('Missing Finale member.');
        const skill =
          entry.track === 'VOCAL'
            ? entry.coreSkills.vocals
            : entry.track === 'RAP'
              ? entry.coreSkills.rap
              : entry.coreSkills.dance;
        return { entry, skill, tieKey: random() };
      })
      .sort((a, b) => b.skill - a.skill || a.tieKey - b.tieKey || a.entry.id.localeCompare(b.entry.id));
    team.parts = members.map(({ entry, tieKey }, index) => {
      const part = song.parts[index];
      return {
        contestantId: entry.id,
        partId: part.id,
        track: entry.track,
        arrangement: part.arrangements[entry.track],
        staging: part.staging,
        tieKey,
      };
    });
  }
}
