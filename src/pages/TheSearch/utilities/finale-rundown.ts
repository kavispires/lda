import type { SimulationState } from '../types/simulation';
import { markdown } from './markdown';
import { createRelationshipUpdatesMarkdown } from './relationship-updates';
import { SHOW_PREMISE, showRundown } from './rundown-presentation';
import { storyText } from './story-presentation';

export function createFinaleRundown(state: SimulationState): string {
  const runtime = state.runtime;
  const episode = runtime?.finale;
  if (!runtime || episode?.phase !== 'complete' || !episode.postSeason || !episode.centerId)
    throw new Error('Finish The Finale before copying its rundown.');
  const name = (id: string) => {
    const entry = episode.startingContestants.find((person) => person.id === id);
    if (!entry) throw new Error(`Unknown finale rundown contestant "${id}".`);
    return markdown(entry.name);
  };
  const lines = [
    '# The Search - Episode 11: The Finale',
    '',
    '## Dramatization brief',
    '',
    SHOW_PREMISE,
    '',
    'Eight finalists perform two original songs in groups of four and one shared live Squirrel Life. Preserve the recorded skill-first captain draft, rehearsals, real support, seven returning judges and performances. Announce only the five debut members, in order 5, 4, 3, 2, 1. First place becomes the official Center. Do not announce places 6-8 or add prolonged farewells. There is no MVP or investigation. The private label choice and viewer-only accounting below are not broadcast, host dialogue or contestant knowledge.',
    '',
    '## Confirmed opening',
    '',
    `Portraits: ${episode.openingCast.map(name).join(', ')}.`,
    '',
  ];
  for (const [field, value] of Object.entries(runtime.preparations?.[11]?.mood ?? {}))
    lines.push(`- ${markdown(field)}: ${markdown(value)}`);
  lines.push('', '## Chronological broadcast', '');
  let sequence: number | undefined;
  for (const scene of episode.scenes) {
    if (scene.sequence !== undefined && scene.sequence !== sequence) {
      sequence = scene.sequence;
      lines.push(`### Sequence ${sequence}`, '');
    }
    lines.push(`#### ${markdown(scene.title)}`, '');
    if (scene.speaker)
      lines.push(`**${markdown(scene.speaker.name)} (${markdown(scene.speaker.role)}):**`, '');
    for (const paragraph of scene.paragraphs) lines.push(markdown(storyText(paragraph)), '');
    for (const dialogue of scene.dialogues ?? []) {
      lines.push(`**${markdown(dialogue.name)} (${markdown(dialogue.role)}):**`, '');
      for (const paragraph of dialogue.paragraphs)
        lines.push(`> ${markdown(storyText(paragraph)).replace(/\n/g, '\n> ')}`, '');
    }
  }
  lines.push('## Original-song arrangements', '');
  for (const team of episode.teams) {
    const song = runtime.definitions.finaleCatalog!.originals.find((entry) => entry.id === team.songId)!;
    lines.push(`### ${markdown(song.name)}`, '', `Captain: ${name(team.captainId)}.`, '');
    for (const part of team.parts)
      lines.push(
        `- ${name(part.contestantId)}: ${markdown(part.track)}; ${markdown(part.arrangement)}. ${markdown(part.staging)}`,
      );
    lines.push('');
  }
  lines.push('## Announced debut members', '');
  for (const id of episode.revealedWinnerIds)
    lines.push(
      `${episode.winnerIds.indexOf(id) + 1}. ${name(id)}${episode.centerId === id ? ' — official Center' : ''}`,
    );
  lines.push(
    '',
    'Confetti falls. Squirrel Zone: The Search has concluded.',
    '',
    '## Private label reference — not broadcast',
    '',
    'Executive knowledge only. Do not dramatize this decision, its bonuses or the following numerical accounting as aired footage or contestant knowledge.',
    '',
  );
  for (const effect of episode.executive!.effects)
    lines.push(
      `- ${name(effect.contestantId)}: production preference ${effect.before.toFixed(2)} → ${effect.after.toFixed(2)}; +${effect.rankingBonus} final points.`,
    );
  lines.push(
    '',
    '## Viewer-only final score details — not broadcast',
    '',
    'Original song and Squirrel Life each supply 50% of the technical result. Final evaluation is 50% technical and 50% the equally weighted mean of seven judges. Retain all prior points, then add 60% evaluation, 30% normalized public votes, 10% normalized production preference and the chosen executive bonus.',
    '',
  );
  for (const id of episode.rankedIds) {
    const panel = episode.panel.find((entry) => entry.contestantId === id)!;
    const score = episode.rankingComponents[id];
    lines.push(
      `- Internal position ${episode.rankedIds.indexOf(id) + 1}: ${name(id)}. Technical ${panel.performance.toFixed(2)}, panel mean ${panel.judgeMean.toFixed(2)}; final evaluation ${panel.finalScore.toFixed(2)}/100 (${panel.grade}). Prior ${score.prior.toFixed(2)} + performance ${score.performance.toFixed(2)} + votes ${score.publicVotes.toFixed(2)} + production ${score.production.toFixed(2)} + executive ${score.executive.toFixed(2)} = ${score.total.toFixed(2)} points.`,
    );
    for (const judge of episode.personnel)
      lines.push(`  ${markdown(judge.name)}: ${panel.judges[judge.id].score.toFixed(2)}/100.`);
  }
  const outcome = episode.postSeason;
  lines.push(
    '',
    '## Viewer-only post-season outcome',
    '',
    `Final audience: ${outcome.audience}. Satisfaction: ${outcome.satisfaction.toFixed(2)}%. Retained group fans: ${outcome.retainedGroupFans}; retained share ${(100 * outcome.retainedShare).toFixed(2)}%. Non-retained viewers: ${outcome.nonRetainedViewers}.`,
    '',
    'Retained group fans = floor(final audience × final satisfaction / 100). This is a derived forecast after the fade to black, not another vote or a change to the live audience ledger.',
    '',
    createRelationshipUpdatesMarkdown(state, 11),
  );
  return showRundown(lines.join('\n'));
}
