import type { SimulationState } from '../types/simulation';
import { markdown } from './markdown';
import { createRelationshipUpdatesMarkdown } from './relationship-updates';
import { rundownScenes, SHOW_PREMISE, showRundown } from './rundown-presentation';
import { storyText } from './story-presentation';

export function createMegaGroupsRundown(state: SimulationState): string {
  const runtime = state.runtime;
  const episode = runtime?.megaGroups;
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
    '# The Search - Episode 4: Mega Groups',
    '',
    '## Dramatization brief',
    '',
    SHOW_PREMISE,
    '',
    'Dramatize the recorded events without changing choices, ballots, performances, rankings or departures. Distinguish recorded dialogue from added speech. Transfer votes are secret from contestants, not viewers. Reveal Jane only in Sequence 9 and the withdrawal only in Sequence 10. Do not invent or reveal additional secrets.',
    '',
    '## Cast background',
    '',
    'Public season-entry descriptions; these are not newly acquired skills or relationships.',
    '',
  ];
  for (const id of episode.participantIds) {
    const person = cast.get(id)!;
    lines.push(`### ${name(id)}`, '', `${markdown(person.track)} track.`);
    for (const cardId of new Set([person.persona, ...person.attributes])) {
      const libraries = runtime.definitions.cards;
      if (Object.hasOwn(libraries.secret, cardId)) continue;
      const card = libraries.persona[cardId] ?? libraries.identity[cardId] ?? libraries.interest[cardId];
      if (card) lines.push(`**${markdown(card.name)}:** ${markdown(card.description)}`);
    }
    for (const [title, values] of [
      ['Personality', person.personality],
      ['Core skills', person.coreSkills],
      ['Utility skills', person.utilitySkills],
    ] as const)
      lines.push(
        `${title}: ${Object.entries(values)
          .map(([key, value]) => `${key} ${value}`)
          .join(', ')}.`,
      );
    lines.push('');
  }
  const preparation = runtime.preparations?.[4];
  if (preparation) {
    lines.push('## Opening', '', names(preparation.slots.filter((id) => id !== null)), '');
    if (preparation.mood)
      for (const [field, value] of Object.entries(preparation.mood))
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
  lines.push('## Recorded team ballots', '');
  if (episode.transfer) {
    lines.push('### Transfer nominations (secret from contestants)', '');
    for (const [voter, choices] of Object.entries(episode.transfer.ballots))
      lines.push(`- ${name(voter)} nominates ${names(choices)}.`);
    lines.push('', `Transferred: ${names(episode.transfer.movedIds)}.`, '');
  }
  for (const team of episode.teams) {
    lines.push(`### ${markdown(team.name)}`, '', `Final members: ${names(team.memberIds)}.`, '');
    for (const [role, ballots] of [
      ['Leader', team.leaderBallots],
      ['Center', team.centerBallots],
    ] as const) {
      lines.push(`#### ${role} ballots`, '');
      for (const [voter, choice] of Object.entries(ballots))
        lines.push(`- ${name(voter)} votes for ${name(choice)}.`);
      lines.push('');
    }
  }
  lines.push('## Complete performance reference', '');
  for (const performance of episode.performances) {
    const song = runtime.definitions.megaGroupSongs?.find((entry) => entry.id === performance.songId);
    if (!song) throw new Error('The Mega Groups rundown is missing a performed song.');
    lines.push(`### ${markdown(song.title)}`, '');
    for (const evaluation of performance.evaluations) {
      lines.push(
        `- **${name(evaluation.contestantId)}:** ${evaluation.grade}, ${evaluation.finalScore.toFixed(2)}/100; part ${markdown(evaluation.partId)}; raw dice ${evaluation.rawDice.join(' + ')}.`,
      );
      for (const check of [
        ...evaluation.technicalChecks,
        evaluation.stageCheck,
        ...evaluation.impressionChecks,
      ])
        lines.push(
          `  - ${markdown(check.skill)}: level ${check.skillLevel}, adjusted dice ${check.adjustedDice.join(' + ')}, result ${check.score.toFixed(2)}.`,
        );
    }
    for (const [judge, result] of Object.entries(performance.judging ?? {}))
      lines.push(`- ${markdown(judge)}: ${markdown(result.comment)}`);
    lines.push('');
  }
  if (episode.mvp) {
    lines.push('## Peer MVP ballot', '', `Winner: **${name(episode.mvp.winnerId)}**.`, '');
    for (const [voter, choice] of Object.entries(episode.mvp.ballots))
      lines.push(`- ${name(voter)} votes for ${name(choice)}.`);
    lines.push('');
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
      'Any outcome-changing consequences remain deferred; the recorded Episode 4 result is locked.',
      '',
    );
  lines.push('## Announced performance ranking', '');
  episode.rankedIds.forEach((id, index) => {
    const movement = episode.previousRankedIds.indexOf(id) - index;
    lines.push(
      `${index + 1}. ${name(id)}${movement ? ` (${movement > 0 ? 'up' : 'down'} ${Math.abs(movement)} places)` : ''}`,
    );
  });
  lines.push('', '## Final season placements after departures', '');
  episode.finalRankedIds.forEach((id, index) => {
    lines.push(
      `${index + 1}. ${name(id)}${id === episode.withdrawnId ? ' - withdrew' : id === episode.eliminatedId ? ' - eliminated by ranking' : ' - continues'}`,
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
    `Sixteen survivors: ${names(episode.survivorIds)}.`,
    '',
    'Next time on The Search: Episode 5 - The Photoshoot.',
    '',
  );
  lines.push('', createRelationshipUpdatesMarkdown(state, 4));
  return showRundown(lines.join('\n'), episode.secret);
}
