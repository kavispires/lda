import type { SimulationState } from '../types/simulation';
import { markdown } from './markdown';
import { createRelationshipUpdatesMarkdown } from './relationship-updates';
import { rundownScenes, SHOW_PREMISE, showRundown } from './rundown-presentation';
import { storyText } from './story-presentation';

export function createMusicVideoRundown(state: SimulationState): string {
  const runtime = state.runtime;
  const episode = runtime?.musicVideo;
  if (!runtime || episode?.phase !== 'complete' || !episode.cut)
    throw new Error('Finish this episode before copying its rundown.');
  const name = (id: string) => {
    const person = episode.startingContestants.find((entry) => entry.id === id);
    if (!person) throw new Error(`Unknown Music Videos rundown contestant "${id}".`);
    return markdown(person.name);
  };
  const names = (ids: readonly string[]) => ids.map(name).join(', ');
  const lines = [
    '# The Search - Episode 9: Music Videos',
    '',
    '## Dramatization brief',
    '',
    SHOW_PREMISE,
    '',
    'Ten contestants film one official Squirrel Life music video. Preserve the apparent creative control, actual storyboard ownership, Vivienne Voss discarding their plans, ten solo shoots, five scheduled choreography takes and any genuine single reset. Film strenuous but safely managed work, not actual collapse. Use the recorded footage rather than inventing a perfect final take. Vivienne joins John Stan, Megan Ryder and Michael Lion. Rank 10 leaves before the nine-survivor MVP vote and investigation; the departure farewell comes last.',
    '',
    '## Confirmed opening',
    '',
    `Portraits: ${names(episode.openingCast)}.`,
    '',
  ];
  for (const [field, value] of Object.entries(runtime.preparations?.[9]?.mood ?? {}))
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
  lines.push('## Recorded solo shoots', '');
  for (const entry of episode.solos)
    lines.push(`- ${name(entry.contestantId)}: ${entry.grade}, ${entry.finalScore.toFixed(2)}/100.`);
  lines.push('', '## Actual choreography takes', '');
  for (const take of episode.takes) {
    lines.push(`### Take ${take.scheduledTake}${take.isReset ? ' - reset' : ''}`, '');
    for (const entry of take.evaluations)
      lines.push(`- ${name(entry.contestantId)}: ${entry.grade}, ${entry.finalScore.toFixed(2)}/100.`);
    lines.push('');
  }
  lines.push(
    "## The director's cut",
    '',
    'Shared choreography occupies 20% of the timeline and includes all ten. Five contestants divide the remaining 80% in individual focus. Shared frames count for everyone visible; individual presence percentages do not sum to 100.',
    '',
  );
  for (const id of episode.participantIds)
    lines.push(
      `- ${name(id)}: ${episode.cut.individualFocus[id].toFixed(2)}% individual focus; ${episode.cut.presence[id].toFixed(2)}% total presence.`,
    );
  lines.push(
    '',
    '## Four-judge assessment',
    '',
    'Technical performance and each of the four judges contribute 20%. A Take 4 reset is averaged with the original within that scheduled slot.',
    '',
  );
  for (const entry of episode.panel)
    lines.push(
      `- ${name(entry.contestantId)}: performance ${entry.performance.toFixed(2)}, John ${entry.john.toFixed(2)}, Megan ${entry.megan.toFixed(2)}, Michael ${entry.michael.toFixed(2)}, Vivienne ${entry.director.toFixed(2)}; final ${entry.grade}, ${entry.finalScore.toFixed(2)}/100.`,
    );
  lines.push('', '## Final ten-person standings', '');
  episode.rankedIds.forEach((id, index) => {
    const movement = episode.previousRankedIds.indexOf(id) - index;
    lines.push(
      `${index + 1}. ${name(id)} (${movement === 0 ? 'unchanged' : `${movement > 0 ? 'up' : 'down'} ${Math.abs(movement)} places`})${episode.eliminatedId === id ? ' — eliminated' : ' — continues'}`,
    );
  });
  if (episode.mvp) lines.push('', `Nine-survivor peer MVP: **${name(episode.mvp.winnerId)}**.`, '');
  if (episode.secret?.cardId)
    lines.push(
      '## Recorded investigation',
      '',
      `${name(episode.secret.contestantId)}: **${markdown(episode.secret.title)}**.`,
      '',
      markdown(episode.secret.description),
      '',
    );
  lines.push(
    '',
    `Nine continue: ${names(episode.survivorIds)}.`,
    '',
    'Episode 10 is next; it has not begun.',
    '',
    createRelationshipUpdatesMarkdown(state, 9),
  );
  return showRundown(lines.join('\n'));
}
