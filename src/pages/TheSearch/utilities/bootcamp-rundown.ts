import type { SimulationState } from '../types/simulation';
import { markdown } from './markdown';
import { SHOW_PREMISE, showRundown } from './rundown-presentation';
import { storyText } from './story-presentation';

/** Boot Camp has its own evidence contract, not audition or song records. */
export function createBootcampRundown(state: SimulationState): string {
  const runtime = state.runtime;
  const episode = runtime?.bootcamp;
  if (!runtime || !episode || episode.phase !== 'complete' || !episode.rankRevealed)
    throw new Error('Finish this episode before copying its rundown.');
  const cast = new Map(runtime.initialContestants.map((person) => [person.id, person]));
  const name = (id: string) => {
    const person = cast.get(id);
    if (!person) throw new Error(`The episode rundown has an unknown contestant "${id}".`);
    return markdown(person.name);
  };
  const names = (ids: readonly string[]) => ids.map(name).join(', ');
  const groupName = (id: string) => `Group ${episode.groups.findIndex((group) => group.id === id) + 1}`;
  const lines = [
    '# The Search - Episode 3: Boot Camp',
    '',
    '## Dramatization brief',
    '',
    SHOW_PREMISE,
    '',
    'Dramatize only the recorded events, emotions, performances, and directional relationships. Keep results locked, distinguish recorded speech from added dialogue, and do not invent or reveal secrets. The no-elimination announcement belongs only in the finale.',
    '',
    '## Cast background',
    '',
    'These are season-entry public descriptions, not newly gained skills or friendships.',
    '',
  ];
  for (const id of episode.participantIds) {
    const person = cast.get(id)!;
    const cards = runtime.definitions.cards;
    lines.push(`### ${name(id)}`, '', `${markdown(person.track)} track.`);
    for (const cardId of [person.persona, ...person.attributes.filter((entry) => entry !== person.persona)]) {
      if (Object.hasOwn(cards.secret, cardId)) continue;
      const card = cards.persona[cardId] ?? cards.identity[cardId] ?? cards.interest[cardId];
      if (card) lines.push(`**${markdown(card.name)}:** ${markdown(card.description)}`);
    }
    lines.push(
      `Personality: ${Object.entries(person.personality)
        .map(([trait, value]) => `${trait} ${value}`)
        .join(', ')}.`,
      `Core skills: ${Object.entries(person.coreSkills)
        .map(([skill, value]) => `${skill} ${value}/5`)
        .join(', ')}.`,
      `Utility skills: ${Object.entries(person.utilitySkills)
        .map(([skill, value]) => `${skill} ${value}/5`)
        .join(', ')}.`,
      '',
    );
  }
  const preparation = runtime.preparations?.[3];
  if (preparation) {
    lines.push(
      '## Opening preparation',
      '',
      `Opening cast: ${names(preparation.slots.filter((id) => id !== null))}.`,
    );
    if (preparation.mood)
      for (const [field, id] of Object.entries(preparation.mood)) {
        const category = field as keyof typeof preparation.mood;
        const label = runtime.definitions.specialties[category][id]?.name ?? id;
        lines.push(`- ${markdown(field)}: ${markdown(label)}`);
      }
    if (preparation.openingPlayed)
      lines.push('The opening aired once; each selected cast member received +0.02 audience preference.');
    lines.push('');
  }
  lines.push('## Chronological episode narration', '');
  let sequence: number | undefined;
  for (const scene of episode.scenes) {
    if (scene.sequence !== undefined && scene.sequence !== sequence) {
      sequence = scene.sequence;
      lines.push(`### Sequence ${sequence}`, '');
    }
    lines.push(`#### ${markdown(scene.title)}`, '');
    if (scene.speaker)
      lines.push(`**${markdown(scene.speaker.name)} (${markdown(scene.speaker.role)}):**`, '');
    for (const paragraph of scene.paragraphs)
      lines.push(
        `${scene.speaker ? '> ' : ''}${markdown(storyText(paragraph)).replace(/\n/g, scene.speaker ? '\n> ' : '\n')}`,
        '',
      );
    for (const dialogue of scene.dialogues ?? []) {
      lines.push(`**${markdown(dialogue.name)} (${markdown(dialogue.role)}):**`, '');
      for (const paragraph of dialogue.paragraphs)
        lines.push(`> ${markdown(storyText(paragraph)).replace(/\n/g, '\n> ')}`, '');
    }
  }
  lines.push('## Production reference: groups and blind pair selection', '');
  for (const group of episode.groups) {
    lines.push(`### ${groupName(group.id)}`, '', `Members: ${names(group.memberIds)}.`, '');
    for (const [index, pair] of group.pairs.entries())
      lines.push(
        `- Round ${index + 1} pair: ${names(pair)}${index === 2 ? ' (remaining eligible members; no ballot)' : ''}.`,
      );
    for (const [round, ballots] of Object.entries(group.ballots)) {
      lines.push('', `#### Round ${round} ballots`, '');
      for (const [voter, choices] of Object.entries(ballots))
        lines.push(`- ${name(voter)} nominates ${names(choices)}.`);
      for (const [id, key] of Object.entries(group.tieKeys[round] ?? {}))
        lines.push(`- Saved tie key: ${name(id)} — ${key}.`);
    }
    lines.push('');
  }
  lines.push('## Production reference: complete performance record', '');
  for (const evaluation of episode.evaluations) {
    lines.push(
      `### Round ${evaluation.round} — ${name(evaluation.contestantId)}`,
      '',
      `Raw dice: ${evaluation.rawDice.join(' + ')}. Base score ${evaluation.baseScore.toFixed(2)}; final individual score **${evaluation.finalScore.toFixed(2)}**; temporary fatigue ${evaluation.fatigue}; saved tie key ${evaluation.tieBreakKey}.`,
    );
    for (const [skill, check] of Object.entries(evaluation.checks))
      lines.push(
        `- ${markdown(skill)}: level ${check.skillLevel}; adjusted dice ${check.adjustedDice.join(' + ')}; score ${check.score.toFixed(2)}.`,
      );
    for (const event of evaluation.events) {
      lines.push(
        `- ${markdown(event.kind)}: ${markdown(event.narrative)} Technical adjustment ${event.scoreDelta}; spotlight ${event.spotlight}; involved: ${names(event.contestantIds)}.`,
      );
      for (const shift of event.relationships)
        lines.push(
          `  - ${name(shift.observerId)} toward ${name(shift.targetId)}: ${shift.delta > 0 ? '+' : ''}${shift.delta} affection.`,
        );
    }
    lines.push('');
  }
  lines.push('## Production reference: final group attempts', '');
  for (const result of episode.groupResults) {
    lines.push(
      `### ${groupName(result.groupId)}`,
      '',
      `Staging: ${names(result.staging)}.`,
      `Final group score **${result.score.toFixed(2)}**; ${result.resets} resets; ${result.assisted ? 'assisted finish / safety stop' : 'completed without assistance'}; saved tie key ${result.tieBreakKey}.`,
    );
    for (const attempt of result.attempts)
      lines.push(
        `- After ${attempt.reset} resets: ${Object.entries(attempt.timing)
          .map(([id, value]) => `${name(id)} timing ${value.toFixed(2)}`)
          .join('; ')}.`,
      );
    lines.push('');
  }
  lines.push('## Production reference: winners', '');
  for (const [index, id] of episode.winners.entries())
    lines.push(`- Round ${index + 1} individual winner: **${name(id)}**.`);
  if (episode.winningGroupId) lines.push(`- Final winning group: **${groupName(episode.winningGroupId)}**.`);
  lines.push(
    '',
    'Temporary fatigue is cleared without altering permanent skills or pre-existing conditions.',
    '',
    '## Production reference: recorded property changes',
    '',
  );
  for (const id of episode.participantIds) {
    for (const change of episode.changes[id] ?? []) {
      if (/^aggregations\.(score|rankingScore|experience)$/.test(change.path)) continue;
      if (!/^(relationships\.|aggregations\.|condition$|grade$|missionRating$|rank$)/.test(change.path))
        continue;
      const path = change.path.startsWith('relationships.')
        ? `outgoing affection toward ${name(change.path.split('.')[1])}`
        : markdown(change.path);
      lines.push(
        `- ${name(id)} — ${path}: ${markdown(JSON.stringify(change.before) ?? 'not recorded')} → ${markdown(JSON.stringify(change.after) ?? 'not recorded')}. Cause: ${markdown(change.cause)}.`,
      );
    }
  }
  if (episode.audience) {
    lines.push(
      '',
      '## Audience outcome',
      '',
      `Voting population: ${episode.audience.votingPopulation}; new viewers: ${episode.audience.newViewers}; satisfaction ${episode.audience.satisfactionBefore} → ${episode.audience.satisfactionAfter}.`,
      '',
    );
    for (const id of episode.participantIds)
      lines.push(
        `- ${name(id)}: votes ${episode.audience.votes[id]}; reception ${episode.audience.receptions[id]}; new fans ${episode.audience.newFans[id]}; recorded exposure ${episode.exposure[id] ?? 0}.`,
      );
  }
  lines.push(
    '',
    '## Final outcome',
    '',
    'Mike announces that all eighteen remain. The search for the next Squirrel Zone continues.',
    '',
  );
  if (episode.mvp) {
    lines.push(
      `**Peer MVP: ${name(episode.mvp.winnerId)}**, with ${episode.mvp.totals[episode.mvp.winnerId]} votes. No hidden ranking bonus.`,
      '',
    );
    for (const [voter, choice] of Object.entries(episode.mvp.ballots))
      lines.push(`- ${name(voter)} votes for ${name(choice)}.`);
  }
  lines.push('', '### Updated continuing ranking', '');
  for (const [index, id] of episode.rankedIds.entries()) lines.push(`${index + 1}. ${name(id)}`);
  return showRundown(`${lines.join('\n').trim()}\n`);
}
