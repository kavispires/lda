import type { SimulationState } from '../types/simulation';
import { findPublicAttributeCard } from './attribute-libraries';
import { markdown } from './markdown';
import { createRelationshipUpdatesMarkdown } from './relationship-updates';
import { rundownScenes, SHOW_PREMISE, showRundown } from './rundown-presentation';
import { storyText } from './story-presentation';

export function createTrackSpecialsRundown(state: SimulationState): string {
  const runtime = state.runtime;
  const episode = runtime?.trackSpecials;
  if (!runtime || episode?.phase !== 'complete' || !episode.rankRevealed)
    throw new Error('Finish this episode before copying its rundown.');
  const cast = new Map(runtime.initialContestants.map((person) => [person.id, person]));
  const name = (id: string) => {
    const person = cast.get(id);
    if (!person) throw new Error(`Unknown Track Specials rundown contestant "${id}".`);
    return markdown(person.name);
  };
  const names = (ids: readonly string[]) => ids.map(name).join(', ');
  const lines = [
    '# The Search - Episode 6: Track Specials',
    '',
    '## Dramatization brief',
    '',
    SHOW_PREMISE,
    '',
    'Keep the recorded groups, performances, jury ballots, awards, peer MVP, ranking and departure unchanged. The 34-person jury, including the voluntary withdrawal, is revealed only in Sequence 5. Jurors are returning guests, not reinstated competitors. The regular judges observe but award no points. Jury ballots are viewer knowledge, not information secretly shared with the contestants. Best and Worst awards can contradict one another. Do not invent extra secrets or departures.',
    '',
    '## Cast background',
    '',
    'Public season-entry profiles; later developments belong to the chronological story.',
    '',
  ];
  for (const id of episode.participantIds) {
    const contestant = cast.get(id);
    if (!contestant) throw new Error('A Track Specials performer has no initial profile.');
    lines.push(`### ${name(id)}`, '', `${markdown(contestant.track)} track.`);
    for (const cardId of new Set([contestant.persona, ...contestant.attributes])) {
      const cards = runtime.definitions.cards;
      if (Object.hasOwn(cards.secret, cardId)) continue;
      const card = findPublicAttributeCard(cards, cardId);
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
  const preparation = runtime.preparations?.[6];
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
  for (const scene of rundownScenes(episode.scenes, episode.secret)) {
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
  lines.push(
    '## Returning jury',
    '',
    names(episode.juryIds),
    '',
    'All returned as guests; their earlier departures and season placements remain final.',
    '',
  );
  lines.push('## Track groups and performances', '');
  for (const team of episode.teams) {
    const song = runtime.definitions.trackSpecialSongs?.find((entry) => entry.id === team.songId);
    if (!song) throw new Error('A Track Specials group has no recorded song.');
    lines.push(
      `### ${markdown(team.name)}`,
      '',
      `Members: ${names(team.memberIds)}.`,
      `Leader: ${name(team.captainId)}. Center: ${team.centerId ? name(team.centerId) : 'not assigned'}.`,
      `Track: ${markdown(team.track)}. Song: ${markdown(song.title)}.`,
      '',
    );
    for (const [role, election] of [
      ['Leader', team.leaderElection],
      ['Center', team.centerElection],
    ] as const) {
      if (!election) throw new Error('A completed Track Specials group has no role election.');
      lines.push(`#### ${role}`, '');
      if (election.appointed)
        lines.push(`${name(election.winnerId)} takes the solo role; no peer ballot.`, '');
      else {
        for (const [voter, choice] of Object.entries(election.ballots))
          lines.push(`- ${name(voter)} votes for ${name(choice)}.`);
        lines.push('');
      }
    }
    if (team.intervention?.choice)
      lines.push(`Production's rehearsal decision: ${markdown(team.intervention.choice)}.`, '');
    const performance = episode.performances.find((entry) => entry.teamId === team.id);
    for (const evaluation of performance?.evaluations ?? [])
      lines.push(
        `- ${name(evaluation.contestantId)}: ${evaluation.grade}, ${evaluation.finalScore.toFixed(2)}/100 before jury awards.`,
      );
    lines.push('');
  }
  lines.push(
    '## Complete jury ballot reference',
    '',
    'Viewer knowledge; individual ballots are not announced to the competitors.',
    '',
  );
  for (const award of episode.awards) {
    const recipient = (id: string) => {
      if (award.category !== 'group') return name(id);
      const team = episode.teams.find((entry) => entry.id === id);
      if (!team) throw new Error('The jury rundown contains an unknown group.');
      return markdown(team.name);
    };
    lines.push(`### ${markdown(award.category)}`, '');
    if (award.status === 'not-contested') {
      lines.push('No eligible track performers; this category is not contested.', '');
      continue;
    }
    if (award.status === 'uncontested')
      lines.push('Uncontested Best; there is no eligible separate Worst.', '');
    for (const [voter, ballot] of Object.entries(award.ballots))
      lines.push(
        `- ${name(voter)}: Best ${recipient(ballot.bestId)}; Worst ${ballot.worstId ? recipient(ballot.worstId) : 'not contested'}.`,
      );
    if (award.bestId)
      lines.push('', `Best: **${recipient(award.bestId)}** (${award.bestTotals[award.bestId]} votes).`);
    if (award.worstId)
      lines.push(`Worst: **${recipient(award.worstId)}** (${award.worstTotals[award.worstId]} votes).`);
    lines.push('');
  }
  if (episode.mvp) {
    lines.push('## Private peer MVP ballot', '', 'Private from contestants; visible to the viewer.', '');
    for (const [voter, choice] of Object.entries(episode.mvp.ballots))
      lines.push(`- ${name(voter)} votes for ${name(choice)}.`);
    lines.push('', `MVP: **${name(episode.mvp.winnerId)}**.`, '');
  }
  if (episode.secret?.cardId)
    lines.push(
      '## Recorded investigation',
      '',
      `${name(episode.secret.contestantId)}: ${markdown(episode.secret.title)}`,
      '',
      markdown(episode.secret.description),
      '',
      'The ranking was locked before this revelation.',
      '',
    );
  lines.push('## Continuing ranking', '');
  episode.rankedIds.forEach((id, index) => {
    const movement = episode.previousRankedIds.indexOf(id) - index;
    lines.push(
      `${index + 1}. ${name(id)}${movement ? ` (${movement > 0 ? 'up' : 'down'} ${Math.abs(movement)} places)` : ' (unchanged)'}${id === episode.eliminatedId ? ' — eliminated' : ''}`,
    );
  });
  lines.push(
    '',
    `Fifteen continue: ${names(episode.survivorIds)}.`,
    '',
    'Next time on The Search: Episode 7 - Versatility.',
    '',
    createRelationshipUpdatesMarkdown(state, 6),
  );
  return showRundown(lines.join('\n'), episode.secret);
}
