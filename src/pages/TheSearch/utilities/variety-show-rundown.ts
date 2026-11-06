import type { SimulationState } from '../types/simulation';
import { markdown } from './markdown';
import { createRelationshipUpdatesMarkdown } from './relationship-updates';
import { rundownScenes, SHOW_PREMISE, showRundown } from './rundown-presentation';
import { storyText } from './story-presentation';

export function createVarietyShowRundown(state: SimulationState): string {
  const runtime = state.runtime;
  const episode = runtime?.varietyShow;
  if (!runtime || episode?.phase !== 'complete')
    throw new Error('Finish this episode before copying its rundown.');
  const name = (id: string) => {
    const person = episode.startingContestants.find((entry) => entry.id === id);
    if (!person) throw new Error(`Unknown Variety Show rundown contestant "${id}".`);
    return markdown(person.name);
  };
  const names = (ids: readonly string[]) => ids.map(name).join(', ');
  const lines = [
    '# The Search - Episode 8: Variety Show',
    '',
    '## Dramatization brief',
    '',
    SHOW_PREMISE,
    '',
    'Roxana Michaels joins John Stan, Megan Ryder and Michael Lion. Preserve all actual games, answers, jokes, recoveries, team preparations and results. Icebreaker choices are private: show only category winners and recorded reactions. Do not invent eligibility lists, vote totals, individual choices or a winner knowing who supported them. The three variety acts, not music performances, determine the assessments. Ranks 11 and 12 leave; ten continue.',
    '',
    '## Confirmed opening',
    '',
    `Portraits: ${names(episode.openingCast)}.`,
    '',
  ];
  for (const [field, value] of Object.entries(runtime.preparations?.[8]?.mood ?? {}))
    lines.push(`- ${markdown(field)}: ${markdown(value)}`);
  lines.push('', '## Chronological episode narration', '');
  let sequence: number | undefined;
  for (const scene of rundownScenes(episode.scenes, episode.secret)) {
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
  lines.push('## Icebreaker winners', '');
  for (const category of episode.icebreaker?.categories ?? [])
    if (category.revealed) lines.push(`- ${markdown(category.label)}: **${name(category.winnerId)}**.`);
  lines.push('', '## Teams and recorded variety results', '');
  for (const team of episode.teams) {
    lines.push(
      `### ${markdown(team.name)}`,
      '',
      `Members: ${names(team.memberIds)}.`,
      `Improv leader: ${team.leaderId ? name(team.leaderId) : 'not assigned'}.`,
      '',
    );
    for (const segment of episode.segments.filter((entry) => entry.teamId === team.id)) {
      lines.push(`**${markdown(segment.kind)}:**`, '');
      for (const evaluation of segment.evaluations) {
        if (evaluation.finalScore === null) throw new Error('A completed variety act has no final result.');
        lines.push(
          `- ${name(evaluation.contestantId)}: ${evaluation.grade}, ${evaluation.finalScore.toFixed(2)}/100.`,
        );
      }
      lines.push('');
    }
  }
  lines.push(
    '## Four-judge assessment',
    '',
    'Each judge and the overall variety result contribute equally.',
    '',
  );
  for (const entry of episode.panel)
    lines.push(
      `- ${name(entry.contestantId)}: variety ${entry.variety.toFixed(2)}, John ${entry.john.toFixed(2)}, Megan ${entry.megan.toFixed(2)}, Michael ${entry.michael.toFixed(2)}, Roxana ${entry.roxana.toFixed(2)}; final ${entry.grade}, ${entry.finalScore.toFixed(2)}/100.`,
    );
  if (episode.mvp) lines.push('', `Peer MVP: **${name(episode.mvp.winnerId)}**.`, '');
  if (episode.secret?.cardId)
    lines.push(
      '## Recorded investigation',
      '',
      `${name(episode.secret.contestantId)}: **${markdown(episode.secret.title)}**.`,
      '',
      markdown(episode.secret.description),
      '',
    );
  lines.push('## Final twelve-person standings', '');
  episode.rankedIds.forEach((id, index) => {
    const movement = episode.previousRankedIds.indexOf(id) - index;
    lines.push(
      `${index + 1}. ${name(id)} (${movement === 0 ? 'unchanged' : `${movement > 0 ? 'up' : 'down'} ${Math.abs(movement)} places`})${episode.eliminatedIds.includes(id) ? ' — eliminated' : ' — continues'}`,
    );
  });
  lines.push(
    '',
    `Ten continue: ${names(episode.survivorIds)}.`,
    '',
    'Episode 9 is next; it has not begun.',
    '',
    createRelationshipUpdatesMarkdown(state, 8),
  );
  return showRundown(lines.join('\n'));
}
