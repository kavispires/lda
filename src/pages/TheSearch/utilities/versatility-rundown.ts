import type { SimulationState } from '../types/simulation';
import { markdown } from './markdown';
import { createRelationshipUpdatesMarkdown } from './relationship-updates';
import { rundownScenes, SHOW_PREMISE, showRundown } from './rundown-presentation';
import { storyText } from './story-presentation';

export function createVersatilityRundown(state: SimulationState): string {
  const runtime = state.runtime;
  const episode = runtime?.versatility;
  if (!runtime || episode?.phase !== 'complete' || !episode.expelledId || !episode.expulsion)
    throw new Error('Finish this episode before copying its rundown.');
  const cast = new Map(runtime.initialContestants.map((person) => [person.id, person]));
  const name = (id: string) => {
    const person = cast.get(id);
    if (!person) throw new Error(`Unknown Versatility rundown contestant "${id}".`);
    return markdown(person.name);
  };
  const names = (ids: readonly string[]) => ids.map(name).join(', ');
  const lines = [
    '# The Search - Episode 7: Versatility',
    '',
    '## Dramatization brief',
    '',
    SHOW_PREMISE,
    '',
    'Keep the recorded off-track assignments, performances, judges, real skill breakthroughs and departures unchanged. The Doubt Girls guest joins all three regular judges and is revealed only in Sequence 4. The double elimination happens before the holding-room interlude and surprise expulsion. The actual secret is disclosed; production separately decides to remove the contestant. Do not invent misconduct for a health or background secret. The relationship-based selection is production reference, not a peer expulsion ballot or contestant knowledge.',
    '',
    '## Cast background',
    '',
    'Public season-entry reference. Skill growth and revelations belong to their actual chronological scenes.',
    '',
  ];
  for (const id of episode.participantIds) {
    const contestant = cast.get(id);
    if (!contestant) throw new Error('A Versatility performer has no original profile.');
    lines.push(`### ${name(id)}`, '', `${markdown(contestant.track)} primary track.`);
    for (const cardId of new Set([contestant.persona, ...contestant.attributes])) {
      const cards = runtime.definitions.cards;
      if (Object.hasOwn(cards.secret, cardId)) continue;
      const card = cards.persona[cardId] ?? cards.identity[cardId] ?? cards.interest[cardId];
      if (card) lines.push(`**${markdown(card.name)}:** ${markdown(card.description)}`);
    }
    for (const [label, values] of [
      ['Personality', contestant.personality],
      ['Core skills', contestant.coreSkills],
      ['Utility skills', contestant.utilitySkills],
      ['Specialties', contestant.specialties],
    ] as const)
      lines.push(
        `${label}: ${Object.entries(values)
          .map(([key, value]) => `${markdown(key)} ${markdown(String(value))}`)
          .join(', ')}.`,
      );
    lines.push('');
  }
  const preparation = runtime.preparations?.[7];
  if (preparation) {
    lines.push(
      '## Confirmed opening',
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
  const guest = runtime.definitions.doubtGirls?.find((member) => member.id === episode.guestId);
  if (!guest) throw new Error('The completed Versatility episode has no recorded guest judge.');
  lines.push(
    '## Panel and group reference',
    '',
    `John Stan, Megan Ryder, Michael Lion and **${markdown(guest.name)}** of Doubt Girls.`,
    '',
  );
  for (const team of episode.teams) {
    const song = runtime.definitions.versatilitySongs?.find((entry) => entry.id === team.songId);
    if (!song) throw new Error('A Versatility group has no recorded song.');
    lines.push(
      `### ${markdown(team.name)} — ${markdown(song.title)}`,
      '',
      `Members: ${names(team.memberIds)}.`,
      `Leader: ${name(team.captainId)}. Center: ${team.centerId ? name(team.centerId) : 'not assigned'}.`,
      '',
    );
    const performance = episode.performances.find((entry) => entry.teamId === team.id);
    if (!performance) throw new Error('A completed Versatility group has no performance.');
    for (const evaluation of performance.evaluations)
      lines.push(
        `- ${name(evaluation.contestantId)}: ${markdown(evaluation.track)} role, ${evaluation.grade}, ${evaluation.finalScore.toFixed(2)}/100.`,
      );
    lines.push('');
  }
  lines.push('## Recorded breakthroughs', '');
  const gains = episode.breakthroughs.filter((entry) => entry.after > entry.before);
  for (const gain of gains)
    lines.push(
      `- ${name(gain.contestantId)}: ${markdown(gain.skill)} improved from ${gain.before} to ${gain.after}.`,
    );
  if (!gains.length) lines.push('No permanent skill breakthrough occurred this week.');
  lines.push('', '## Announced fifteen-person ranking', '');
  episode.rankedIds.forEach((id, index) => {
    const movement = episode.previousRankedIds.indexOf(id) - index;
    lines.push(
      `${index + 1}. ${name(id)} (${movement === 0 ? 'unchanged' : `${movement > 0 ? 'up' : 'down'} ${Math.abs(movement)} places`})${episode.eliminatedIds.includes(id) ? ' — eliminated' : ''}`,
    );
  });
  lines.push(
    '',
    '## The holding room and expulsion',
    '',
    'After ranks 14 and 15 leave, thirteen contestants return backstage before production interrupts.',
    `**${name(episode.expelledId)}** is expelled after the revelation of **${markdown(episode.expulsion.result.title)}**.`,
    markdown(episode.expulsion.result.description),
    '',
    'This is an administrative departure, not a third ranked elimination.',
    '',
    '## Final season placements after the three departures',
    '',
  );
  [...episode.survivorIds, episode.expelledId, ...episode.eliminatedIds].forEach((id, index) => {
    lines.push(
      `${index + 1}. ${name(id)}${id === episode.expelledId ? ' — expelled' : episode.eliminatedIds.includes(id) ? ' — eliminated' : ' — continues'}`,
    );
  });
  if (episode.mvp) {
    lines.push('', '## Twelve-person private peer MVP vote', '');
    for (const [voter, choice] of Object.entries(episode.mvp.ballots))
      lines.push(`- ${name(voter)} votes for ${name(choice)}.`);
    lines.push('', `MVP: **${name(episode.mvp.winnerId)}**.`, '');
  }
  if (episode.secret?.cardId)
    lines.push(
      '## Recorded closing investigation',
      '',
      `${name(episode.secret.contestantId)}: **${markdown(episode.secret.title)}**.`,
      '',
      markdown(episode.secret.description),
      '',
    );
  lines.push(
    `Twelve continue: ${names(episode.survivorIds)}.`,
    '',
    'Next time on The Search: Episode 8 - Variety Show.',
    '',
    createRelationshipUpdatesMarkdown(state, 7).trim(),
    '',
  );
  return showRundown(lines.join('\n'), episode.secret);
}
