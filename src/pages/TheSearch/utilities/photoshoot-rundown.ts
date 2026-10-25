import type { SimulationState } from '../types/simulation';
import { markdown } from './markdown';
import { photoshootFinaleScene } from './photoshoot-ranking-reactions';
import { createRelationshipUpdatesMarkdown } from './relationship-updates';
import { rundownScenes, SHOW_PREMISE, showRundown } from './rundown-presentation';
import { storyText } from './story-presentation';

export function createPhotoshootRundown(state: SimulationState): string {
  const runtime = state.runtime;
  const episode = runtime?.photoshoot;
  if (!runtime || !episode || episode.phase !== 'complete' || !episode.rankRevealed)
    throw new Error('Finish this episode before copying its rundown.');
  const cast = new Map(runtime.initialContestants.map((person) => [person.id, person]));
  const name = (id: string) => {
    const person = cast.get(id);
    if (!person) throw new Error(`The episode rundown has an unknown contestant "${id}".`);
    return markdown(person.name);
  };
  const names = (ids: readonly string[]) => ids.map(name).join(', ');
  const lines = [
    '# The Search - Episode 5: The Photoshoot',
    '',
    '## Dramatization brief',
    '',
    SHOW_PREMISE,
    '',
    'Dramatize the recorded events without changing concepts, draft picks, styling decisions, photographs, ballots or rankings. Distinguish recorded dialogue from added speech. Contestants learn that nobody leaves in Sequence 3, not during the dorm opening. Peer ballots are private from contestants, not viewers. Do not invent images or reveal additional secrets.',
    '',
    '## Cast background',
    '',
    'Public season-entry profiles; the chronological story records later developments.',
    '',
  ];
  for (const id of episode.participantIds) {
    const person = cast.get(id);
    if (!person) throw new Error('A Photoshoot participant has no season-entry profile.');
    lines.push(`### ${name(id)}`, '', `${markdown(person.track)} track.`);
    for (const cardId of new Set([person.persona, ...person.attributes])) {
      const cards = runtime.definitions.cards;
      if (Object.hasOwn(cards.secret, cardId)) continue;
      const card = cards.persona[cardId] ?? cards.identity[cardId] ?? cards.interest[cardId];
      if (card) lines.push(`**${markdown(card.name)}:** ${markdown(card.description)}`);
    }
    for (const [title, values] of [
      ['Personality', person.personality],
      ['Core skills', person.coreSkills],
      ['Utility skills', person.utilitySkills],
      ['Specialties', person.specialties],
    ] as const)
      lines.push(
        `${title}: ${Object.entries(values)
          .map(([key, value]) => `${markdown(key)} ${markdown(String(value))}`)
          .join(', ')}.`,
      );
    lines.push('');
  }
  const preparation = runtime.preparations?.[5];
  if (preparation) {
    lines.push(
      '## Opening preparation',
      '',
      `Portraits: ${names(preparation.slots.filter((id) => id !== null))}.`,
      '',
    );
    for (const [field, value] of Object.entries(preparation.mood ?? {}))
      lines.push(`- ${markdown(field)}: ${markdown(value)}`);
    lines.push('');
  }
  lines.push('## Chronological episode narration', '');
  let sequence: number | undefined;
  for (const recorded of rundownScenes(episode.scenes, episode.secret)) {
    const scene = photoshootFinaleScene(episode, recorded);
    if (scene.sequence !== undefined && scene.sequence !== sequence) {
      sequence = scene.sequence;
      lines.push(`### Sequence ${sequence}`, '');
    }
    lines.push(`#### ${markdown(scene.title)}`, '');
    if (scene.speaker)
      lines.push(`**${markdown(scene.speaker.name)} (${markdown(scene.speaker.role)}):**`, '');
    for (const text of scene.paragraphs) lines.push(markdown(storyText(text)), '');
    for (const dialogue of scene.dialogues ?? []) {
      lines.push(`**${markdown(dialogue.name)} (${markdown(dialogue.role)}):**`, '');
      for (const text of dialogue.paragraphs)
        lines.push(`> ${markdown(storyText(text)).replace(/\n/g, '\n> ')}`, '');
    }
  }
  lines.push('## Concept teams and production decisions', '');
  for (const team of episode.teams) {
    const concept = runtime.definitions.photoshootConcepts?.find((entry) => entry.id === team.conceptId);
    if (!concept) throw new Error('The Photoshoot rundown is missing a selected concept.');
    lines.push(
      `### ${markdown(team.name)}`,
      '',
      `Leader: ${name(team.leaderId)}. Members: ${names(team.memberIds)}.`,
      `Concept: ${markdown(concept.name)}.`,
      `Production: ${team.styling?.choice === 'intervene' ? 'Professional stylists intervene.' : 'The team retains creative control.'}`,
      '',
      '#### Center ballots',
      '',
    );
    for (const [voter, choice] of Object.entries(team.centerBallots))
      lines.push(`- ${name(voter)} votes for ${name(choice)}.`);
    if (team.centerId) lines.push('', `Center: ${name(team.centerId)}.`);
    lines.push('');
  }
  lines.push('## Complete individual photography reference', '');
  for (const photo of episode.individualPhotos)
    lines.push(
      `### ${name(photo.contestantId)}`,
      '',
      `${photo.grade}; ${photo.finalScore.toFixed(2)}/100. Raw dice: ${photo.rawDice.join(' + ')}.`,
      markdown(storyText(photo.description)),
      '',
    );
  lines.push('## Complete group photography reference', '');
  for (const photo of episode.groupPhotos) {
    const team = episode.teams.find((entry) => entry.id === photo.teamId);
    if (!team) throw new Error('The Photoshoot rundown has an unknown cover team.');
    lines.push(`### ${markdown(team.name)}`, '', markdown(storyText(photo.description)), '');
    for (const evaluation of photo.evaluations)
      lines.push(`- ${name(evaluation.contestantId)}: ${evaluation.finalScore.toFixed(2)}/100.`);
    lines.push('');
  }
  if (episode.ultimateVisual) {
    lines.push('## Ultimate Visual ballot', '', 'Private from contestants; public to the viewer.', '');
    for (const [voter, choice] of Object.entries(episode.ultimateVisual.ballots))
      lines.push(`- ${name(voter)} votes for ${name(choice)}.`);
    lines.push(
      '',
      `Winner: **${name(episode.ultimateVisual.winnerId)}**. Their photograph goes viral and their audience preference improves.`,
      '',
    );
  }
  if (episode.secret?.cardId)
    lines.push(
      '## Recorded investigation',
      '',
      `Contestant: ${name(episode.secret.contestantId)}.`,
      markdown(episode.secret.title),
      '',
      markdown(episode.secret.description),
      '',
      'The episode result was locked before the investigation. Outcome-changing consequences remain deferred.',
      '',
    );
  lines.push('## Continuing ranking', '');
  episode.rankedIds.forEach((id, index) => {
    const movement = episode.previousRankedIds.indexOf(id) - index;
    lines.push(
      `${index + 1}. ${name(id)}${movement ? ` (${movement > 0 ? 'up' : 'down'} ${Math.abs(movement)} places)` : ' (unchanged)'}`,
    );
  });
  lines.push('', '## Recorded relationship and happiness changes', '');
  for (const id of episode.participantIds)
    for (const change of episode.changes[id] ?? []) {
      if (change.path !== 'aggregations.happiness' && !change.path.startsWith('relationships.')) continue;
      const label = change.path.startsWith('relationships.')
        ? `outgoing affection toward ${name(change.path.slice('relationships.'.length))}`
        : 'happiness';
      const before = Array.isArray(change.before) ? change.before.at(-1) : change.before;
      const after = Array.isArray(change.after) ? change.after.at(-1) : change.after;
      lines.push(
        `- ${name(id)} - ${label}: ${markdown(JSON.stringify(before) ?? 'not recorded')} -> ${markdown(JSON.stringify(after) ?? 'not recorded')}. ${markdown(change.cause)}.`,
      );
    }
  lines.push(
    '',
    `All sixteen continue: ${names(episode.survivorIds)}.`,
    '',
    'Next time on The Search: Episode 6 - Track Specials.',
    '',
  );
  lines.push('', createRelationshipUpdatesMarkdown(state, 5));
  return showRundown(lines.join('\n'), episode.secret);
}
