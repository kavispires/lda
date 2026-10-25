import type { ChangeValue } from '../types/common';
import type { SimulationState } from '../types/simulation';
import { createBootcampRundown } from './bootcamp-rundown';
import { markdown } from './markdown';
import { createMegaGroupsRundown } from './mega-groups-rundown';
import { createPhotoshootRundown } from './photoshoot-rundown';
import { storyText } from './story-presentation';

function affection(value: ChangeValue | undefined): number | undefined {
  if (typeof value === 'number') return value;
  if (Array.isArray(value)) {
    const last = value.at(-1);
    if (typeof last === 'number') return last;
  }
  return undefined;
}

export function createEpisodeRundown(state: SimulationState, episodeNumber: 1 | 2 | 3 | 4 | 5): string {
  if (episodeNumber === 5) return createPhotoshootRundown(state);
  if (episodeNumber === 4) return createMegaGroupsRundown(state);
  if (episodeNumber === 3) return createBootcampRundown(state);
  const runtime = state.runtime;
  const record = episodeNumber === 1 ? runtime?.audition : runtime?.battle;
  if (!runtime || !record || record.phase !== 'complete')
    throw new Error('Finish this episode before copying its rundown.');
  const ids = 'order' in record ? record.order : record.participantIds;
  const cast = new Map(runtime.initialContestants.map((person) => [person.id, person]));
  const person = (id: string) => {
    const result = cast.get(id);
    if (!result) throw new Error(`The episode rundown has an unknown contestant "${id}".`);
    return result;
  };
  const name = (id: string) => markdown(person(id).name);
  const names = (people: readonly string[]) => people.map(name).join(', ');
  const cards = runtime.definitions.cards;
  const lines: string[] = [
    `# The Search - Episode ${episodeNumber}: ${episodeNumber === 1 ? 'Auditions' : 'The Battles'}`,
    '',
    '## Dramatization brief',
    '',
    'This is a factual rundown of a completed simulation episode. Dramatize the recorded events, emotions, and relationships without changing performances, votes, saves, rankings, or departures. Do not invent or reveal additional secrets. Distinguish recorded speech from any dialogue you add.',
    '',
    'The chronological story is followed by production reference material, including events condensed into montages and reactions that were not necessarily shown on screen.',
    '',
    '## Cast background',
    '',
    'Character descriptions, personality traits, and core skills are the season-entry reference. The episode events below record subsequent developments.',
    '',
  ];
  for (const id of ids) {
    const contestant = person(id);
    const persona = cards.persona[contestant.persona];
    if (!persona) throw new Error(`The episode rundown has an unknown persona "${contestant.persona}".`);
    const zodiac = runtime.definitions.zodiacSigns[contestant.zodiacSign]?.name ?? contestant.zodiacSign;
    lines.push(
      `### ${name(id)}`,
      '',
      `${markdown(contestant.track)} track; zodiac sign ${markdown(zodiac)}.`,
      `**${markdown(persona.name)}:** ${markdown(persona.description)}`,
      ...contestant.attributes
        .filter((cardId) => cardId !== contestant.persona && !Object.hasOwn(cards.secret, cardId))
        .map((cardId) => {
          const card = cards.identity[cardId] ?? cards.interest[cardId] ?? cards.persona[cardId];
          if (!card) throw new Error(`The episode rundown has an unknown public card "${cardId}".`);
          return `**${markdown(card.name)}:** ${markdown(card.description)}`;
        }),
      `Personality: ${Object.entries(contestant.personality)
        .map(([trait, value]) => `${trait} ${value > 0 ? '+' : ''}${value}`)
        .join(', ')}.`,
      `Core skills: ${Object.entries(contestant.coreSkills)
        .map(([skill, value]) => `${skill} ${value}/5`)
        .join(', ')}.`,
      '',
    );
  }
  const preparation = runtime.preparations?.[episodeNumber];
  const mood = preparation?.mood ?? ('mood' in record ? record.mood : runtime.audition?.mood);
  if (preparation || mood) {
    lines.push('## Opening preparation', '');
    if (preparation?.slots.every((id) => id !== null))
      lines.push(`Opening cast: ${names(preparation.slots.filter((id) => id !== null))}.`, '');
    if (mood) {
      for (const field of Object.keys(mood) as (keyof typeof mood)[]) {
        const label = runtime.definitions.specialties[field][mood[field]]?.name ?? mood[field];
        lines.push(`- ${field}: ${markdown(label)}`);
      }
      lines.push('');
    }
    if (preparation?.openingPlayed)
      lines.push(
        'The opening played once, granting its selected contestants the small opening-popularity benefit.',
        '',
      );
  }
  lines.push('## Chronological episode narration', '');
  let sequence: number | undefined;
  for (const scene of record.scenes) {
    if (scene.sequence !== undefined && scene.sequence !== sequence) {
      sequence = scene.sequence;
      lines.push(`### Sequence ${sequence}`, '');
    }
    lines.push(`${scene.sequence === undefined ? '###' : '####'} ${markdown(scene.title)}`, '');
    if (scene.speaker)
      lines.push(`**${markdown(scene.speaker.name)} (${markdown(scene.speaker.role)}):**`, '');
    for (const paragraph of scene.paragraphs) {
      const text = markdown(storyText(paragraph));
      lines.push(scene.speaker ? `> ${text.replace(/\n/g, '\n> ')}` : text, '');
    }
    for (const dialogue of scene.dialogues ?? []) {
      lines.push(`**${markdown(dialogue.name)} (${markdown(dialogue.role)}):**`, '');
      for (const paragraph of dialogue.paragraphs)
        lines.push(`> ${markdown(storyText(paragraph)).replace(/\n/g, '\n> ')}`, '');
    }
    for (const [id, paragraphs] of Object.entries(scene.introductions ?? {})) {
      lines.push(`**Full montage introduction: ${name(id)}**`, '');
      for (const paragraph of paragraphs) lines.push(markdown(paragraph), '');
    }
  }
  lines.push('## Production reference: complete performance record', '');
  if ('order' in record) {
    const evaluations = new Map(
      record.evaluations.map((evaluation) => [evaluation.contestantId, evaluation]),
    );
    for (const [index, id] of record.order.entries()) {
      const evaluation = evaluations.get(id);
      const song = record.pool.find((entry) => entry.id === evaluation?.songId);
      if (!evaluation || !song)
        throw new Error(`The completed rundown is missing ${person(id).name}'s audition.`);
      lines.push(
        `### ${index + 1}. ${name(id)}`,
        '',
        `${name(id)} auditions with "${markdown(song.title)}" on the ${markdown(song.track)} track${song.track !== person(id).track ? ', stepping outside their usual track' : ''}. They receive **grade ${evaluation.grade}**, with a final score of **${evaluation.finalScore.toFixed(2)}**.`,
        '',
      );
      if (evaluation.panel) {
        const judges = { john: 'John Stan', megan: 'Megan Ryder', michael: 'Michael Lion' };
        lines.push(
          `Judge evaluations: ${Object.entries(evaluation.panel.scores)
            .map(([id, score]) => `${judges[id as keyof typeof judges]} ${score.toFixed(2)}`)
            .join('; ')}.`,
          `Leading judge **${judges[evaluation.panel.lead]}**: "${markdown(evaluation.panel.comment)}"`,
          '',
        );
      }
      if (record.audience) lines.push(`Audience votes: ${record.audience.votes[id]}.`, '');
      const reactions = record.reactions.filter((reaction) => reaction.performerId === id);
      if (reactions.length) {
        lines.push('Recorded reactions (including those not shown in the edit):', '');
        for (const reaction of reactions) lines.push(`- ${markdown(reaction.narrative)}`);
        lines.push('');
      }
    }
  } else {
    lines.push('### Dorm assignments', '');
    for (const [index, room] of record.rooms.entries())
      lines.push(`- Room ${index + 1}: ${names(room.memberIds)}.`);
    lines.push('');
    if (record.story?.matchupReactions.length) {
      lines.push('### Every recorded opponent reaction', '');
      for (const reaction of record.story.matchupReactions)
        lines.push(
          `- ${name(reaction.observerId)} feels ${markdown(reaction.emotion)}${reaction.targetId ? ` toward ${name(reaction.targetId)}: outgoing affection ${reaction.before} to ${reaction.after}` : ''}.`,
        );
      lines.push('');
    }
    for (const [index, pairing] of record.pairings.entries()) {
      lines.push(`### Battle ${index + 1}`, '');
      for (const teamId of pairing.teamIds) {
        const team = record.teams.find((entry) => entry.id === teamId);
        const performance = record.performances.find((entry) => entry.teamId === teamId);
        const song = runtime.definitions.battleSongs?.find((entry) => entry.id === team?.songId);
        if (!team || !performance || !song)
          throw new Error('The completed rundown is missing a team performance.');
        lines.push(
          `#### ${markdown(team.name)}`,
          '',
          `Captain: ${name(team.captainId)}. Team: ${names(team.memberIds)}.`,
          `Song: "${markdown(song.title)}".${team.centerId ? ` Elected center: ${name(team.centerId)}.` : ''}`,
          '',
        );
        for (const practice of team.practice)
          lines.push(
            `${markdown(practice.title)}: ${name(team.captainId)}'s leadership ${practice.leadershipSuccess ? 'succeeds' : 'struggles'}; coordination moves from ${practice.coordinationBefore} to ${practice.coordinationAfter}.`,
            '',
          );
        const intervention =
          record.story?.interventions[teamId] ??
          (record.conflict?.teamId === teamId ? record.conflictChoice : null);
        if (intervention) lines.push(`Production chooses to **${intervention}** this rehearsal.`, '');
        for (const [voter, choice] of Object.entries(team.centerBallots))
          lines.push(`- Center ballot: ${name(voter)} votes for ${name(choice)}.`);
        lines.push('');
        for (const evaluation of performance.evaluations) {
          const part = song.parts.find((entry) => entry.id === evaluation.partId);
          if (!part) throw new Error('The completed rundown is missing a performance part.');
          lines.push(
            `- ${name(evaluation.contestantId)} performs ${markdown(part.name)}, feeling ${team.partReactions[evaluation.contestantId]} about the assignment: **grade ${evaluation.grade}**, individual score **${evaluation.finalScore.toFixed(2)}**${evaluation.centerBonus ? '; temporary center boost applied' : ''}${evaluation.composure ? `; temporary rival-performance composure ${evaluation.composure > 0 ? '+' : ''}${evaluation.composure}` : ''}.`,
          );
          if (record.audience)
            lines.push(`  Audience votes: ${record.audience.votes[evaluation.contestantId]}.`);
        }
        lines.push(
          '',
          `Final team score: **${performance.finalScore.toFixed(2)}**; coordination: ${performance.coordination}.`,
          '',
        );
        if (performance.judging) {
          for (const [id, judge] of Object.entries(performance.judging))
            lines.push(
              `- ${id === 'john' ? 'John Stan' : id === 'megan' ? 'Megan Ryder' : 'Michael Lion'}: ${judge.score.toFixed(2)}/100, contributing ${judge.bonus.toFixed(2)} team points. ${markdown(judge.comment)}`,
            );
          lines.push('');
        }
      }
      const winner = record.teams.find((team) => team.id === pairing.winnerId);
      if (!winner) throw new Error('The completed rundown is missing a battle winner.');
      lines.push(`**Winner: ${markdown(winner.name)}.**`, '');
    }
    for (const [label, id] of [
      ['Judges save', record.judgeSaveId],
      ['Audience save', record.audienceSaveId],
      ['Production save', record.productionSaveId],
    ] as const) {
      if (!id) throw new Error('The completed rundown is missing a save.');
      lines.push(`**${label}: ${name(id)}.**`, '');
    }
    if (record.story?.rankRevealed) {
      lines.push('### Final survivor ranking', '');
      for (const [index, id] of record.survivorIds.entries()) lines.push(`${index + 1}. ${name(id)}`);
      lines.push('');
    }
    if (record.story?.rankReactions.length) {
      lines.push('### Every recorded placement reaction', '');
      for (const reaction of record.story.rankReactions)
        lines.push(
          `- ${name(reaction.observerId)} feels ${markdown(reaction.emotion)}${reaction.targetId ? ` toward ${name(reaction.targetId)}: outgoing affection ${reaction.before} to ${reaction.after}` : ' at taking first place'}.`,
        );
      lines.push('');
    }
  }
  if (record.selectedCutId) {
    const cut = record.cuts.find((entry) => entry.id === record.selectedCutId);
    if (!cut) throw new Error('The completed rundown is missing the selected broadcast package.');
    lines.push(
      '## Production reference: selected broadcast package',
      '',
      `**${markdown(cut.title)}:** ${markdown(cut.description)}`,
      '',
    );
    for (const footage of cut.footage)
      lines.push(`- ${name(footage.contestantId)}: ${markdown(footage.description)}`);
    lines.push('');
  }
  lines.push(
    '## Production reference: relationship consequences',
    '',
    'These are recorded net changes across the episode, not necessarily separate on-screen interactions. Relationships are directional.',
    '',
  );
  for (const id of ids) {
    const changes = record.changes[id] ?? [];
    const shifts: string[] = [];
    for (const targetId of ids) {
      if (targetId === id) continue;
      const entries = changes.filter(
        (change) =>
          change.path === `relationships.${targetId}` ||
          change.path === `relationships.${targetId}.affection`,
      );
      if (!entries.length) continue;
      const before = affection(entries[0].before);
      const after = affection(entries.at(-1)?.after);
      if (before !== undefined && after !== undefined && before !== after)
        shifts.push(`toward ${name(targetId)}: ${before} to ${after}`);
    }
    if (shifts.length) lines.push(`- **${name(id)}**: ${shifts.join('; ')}.`);
  }
  lines.push(
    '',
    '## Final outcome',
    '',
    `**Survivors (${record.survivorIds.length}):** ${names(record.survivorIds)}.`,
    `**Departures (${record.eliminatedIds.length}):** ${names(record.eliminatedIds)}.`,
    '',
  );
  if (record.mvp) {
    lines.push(
      `**Peer MVP: ${name(record.mvp.winnerId)}**, with ${record.mvp.totals[record.mvp.winnerId]} votes.`,
      '',
      'Recorded peer ballots (production reference, not necessarily announced individually):',
      '',
    );
    for (const [voter, choice] of Object.entries(record.mvp.ballots))
      lines.push(`- ${name(voter)} votes for ${name(choice)}.`);
    lines.push('');
  }
  if (record.secret) {
    lines.push(
      `### Closing investigation: ${markdown(record.secret.title)}`,
      '',
      `Investigated contestant: ${name(record.secret.contestantId)}.`,
      markdown(record.secret.description),
      '',
    );
    if (record.secret.deferred.length)
      lines.push(
        'Outcome-changing consequences are deferred; the completed episode results remain locked.',
        '',
      );
  }
  return `${lines.join('\n').trim()}\n`;
}
