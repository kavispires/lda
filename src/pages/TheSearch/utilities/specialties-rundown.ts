import type { SimulationState } from '../types/simulation';
import { markdown } from './markdown';
import { createRelationshipUpdatesMarkdown } from './relationship-updates';
import { rundownScenes, SHOW_PREMISE, showRundown } from './rundown-presentation';
import { storyText } from './story-presentation';

export function createSpecialtiesRundown(state: SimulationState): string {
  const runtime = state.runtime;
  const episode = runtime?.specialties;
  if (!runtime || episode?.phase !== 'complete')
    throw new Error('Finish this episode before copying its rundown.');
  const name = (id: string) => {
    const person = episode.startingContestants.find((entry) => entry.id === id);
    if (!person) throw new Error(`Unknown Specialties rundown contestant "${id}".`);
    return markdown(person.name);
  };
  const names = (ids: readonly string[]) => ids.map(name).join(', ');
  const lines = [
    '# The Search - Episode 10: Specialties',
    '',
    '## Dramatization brief',
    '',
    SHOW_PREMISE,
    '',
    'Nine contestants receive solo songs tailored to their primary specialties and visual vibes. Preserve the actual best-friend selections, reciprocal matches, unrequited reactions, rehearsals and nine individual stages. John Stan, Megan Ryder and Michael Lion assess the performances. Secret peer rankings contribute 25% of the evaluation. Contestants learn received averages, never the individual ballots or private motives in the viewer-only reference. Rank 9 leaves before the eight-survivor MVP vote and ordinary investigation. The farewell comes last; eight reach the upcoming finale without starting it.',
    '',
    '## Confirmed opening',
    '',
    `Portraits: ${names(episode.openingCast)}.`,
    '',
  ];
  for (const [field, value] of Object.entries(runtime.preparations?.[10]?.mood ?? {}))
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
  lines.push('## Tailored solo stages', '');
  for (const song of episode.songs)
    lines.push(
      `- ${name(song.contestantId)}: **${markdown(song.name)}**, ${markdown(song.track)}; ${markdown(song.arrangement)}. Primary specialty: ${markdown(song.specialtyDescription)}. Visual direction: ${markdown(song.visualDescription)}.`,
    );
  lines.push(
    '',
    '## Final evaluation',
    '',
    'Track performance counts three times, each regular judge once and the received peer average twice: (3*T+John+Megan+Michael+2*peer)/8. Peer rankings contribute exactly 25% of this evaluation.',
    '',
  );
  for (const entry of episode.panel)
    lines.push(
      `- ${name(entry.contestantId)}: track ${entry.performance.toFixed(2)}, John ${entry.john.toFixed(2)}, Megan ${entry.megan.toFixed(2)}, Michael ${entry.michael.toFixed(2)}, received peer average ${entry.peer.toFixed(2)}; final ${entry.grade}, ${entry.finalScore.toFixed(2)}/100.`,
    );
  lines.push(
    '',
    '## Viewer-only peer ranking reference',
    '',
    'Not broadcast. Do not turn these ballots, personality profiles or motives into host dialogue or contestant knowledge. Contestants learn received averages only.',
    '',
  );
  for (const ballot of episode.peer?.ballots ?? []) {
    lines.push(`### ${name(ballot.voterId)} - ${ballot.profile}`, '');
    ballot.rankedIds.forEach((id, index) => {
      lines.push(`${index + 1}. ${name(id)}`);
    });
    lines.push('', ...ballot.reasons.map((reason) => markdown(reason)), '');
  }
  lines.push('## Final nine-person standings', '');
  episode.rankedIds.forEach((id, index) => {
    const movement = episode.previousRankedIds.indexOf(id) - index;
    lines.push(
      `${index + 1}. ${name(id)} (${movement === 0 ? 'unchanged' : `${movement > 0 ? 'up' : 'down'} ${Math.abs(movement)} places`})${episode.eliminatedId === id ? ' — eliminated' : ' — continues'}`,
    );
  });
  if (episode.mvp) lines.push('', `Eight-survivor peer MVP: **${name(episode.mvp.winnerId)}**.`, '');
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
    `Eight continue: ${names(episode.survivorIds)}.`,
    '',
    'Episode 11 is the upcoming finale; it has not begun.',
    '',
    createRelationshipUpdatesMarkdown(state, 10),
  );
  return showRundown(lines.join('\n'));
}
