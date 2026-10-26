import type { SeasonRuntime } from '../types/simulation';
import { findPublicAttributeCard } from './attribute-libraries';
import { markdown } from './markdown';

function label(key: string): string {
  const words = key.replace(/([a-z])([A-Z])/g, '$1 $2');
  return words[0].toUpperCase() + words.slice(1);
}

export function createSeasonCastProfiles(runtime: SeasonRuntime): string {
  const profiles = runtime.initialContestants.map((contestant) =>
    createContestantProfile(runtime, contestant.id).replace(/^#/gm, '##'),
  );
  return `# The Search - Season cast\n\n${profiles.join('\n')}`;
}

export function createContestantProfile(runtime: SeasonRuntime, contestantId: string): string {
  const contestant = runtime.initialContestants.find((entry) => entry.id === contestantId);
  if (!contestant) throw new Error(`No initialized profile exists for contestant "${contestantId}".`);
  const { cards, specialties, zodiacSigns } = runtime.definitions;
  const persona = cards.persona[contestant.persona];
  const zodiac = zodiacSigns[contestant.zodiacSign];
  if (!persona || !zodiac) throw new Error('The initialized profile has an unknown persona or zodiac sign.');
  const revealed = new Set(
    runtime.revealedSecrets
      .filter((entry) => entry.contestantId === contestantId)
      .map((entry) => entry.cardId),
  );
  const lines = [
    `# ${markdown(contestant.name)} - Contestant profile`,
    '',
    '## Basic information',
    '',
    `- ID: ${markdown(contestant.id)}`,
    `- Type: ${contestant.type}`,
    `- Name: ${markdown(contestant.name)}`,
    `- Track: ${contestant.track}`,
    `- Brand color: ${markdown(contestant.color)}`,
    `- Alignment: ${markdown(contestant.alignment)}`,
    `- Setup profile timestamp: ${contestant.updatedAt}`,
    ...(contestant.bias === undefined ? [] : [`- Bias selection: ${contestant.bias ? 'Yes' : 'No'}`]),
    '',
    '## Appearance',
    '',
    ...Object.entries(contestant.appearance).map(
      ([key, value]) => `- ${label(key)}: ${markdown(String(value) || '(not specified)')}`,
    ),
    '',
    '## Persona',
    '',
    `**${markdown(persona.name)}** (${markdown(persona.id)})`,
    '',
    markdown(persona.description),
    '',
    '## Zodiac sign',
    '',
    `**${markdown(zodiac.name)}** (${markdown(zodiac.id)})`,
    '',
    markdown(zodiac.description),
    '',
    '## Specialties',
    '',
  ];
  for (const key of Object.keys(contestant.specialties) as (keyof typeof contestant.specialties)[]) {
    const id = contestant.specialties[key];
    if (!id) {
      lines.push(`- ${label(key)}: (not specified)`);
      continue;
    }
    const specialty = specialties[key][id];
    if (!specialty) throw new Error(`The initialized profile has an unknown ${key} specialty "${id}".`);
    lines.push(
      `- **${label(key)}: ${markdown(specialty.name)}** (${markdown(id)}). ${markdown(specialty.description)}`,
    );
  }
  for (const [title, values] of [
    ['Core skills (1-5)', contestant.coreSkills],
    ['Utility skills (1-5)', contestant.utilitySkills],
    ['Personality (-10 to +10)', contestant.personality],
  ] as const) {
    lines.push('', `## ${title}`, '');
    for (const [key, value] of Object.entries(values)) lines.push(`- ${label(key)}: ${value}`);
  }
  lines.push('', '## Attribute cards', '');
  for (const id of new Set(contestant.attributes)) {
    if (id === contestant.persona || (Object.hasOwn(cards.secret, id) && !revealed.has(id))) continue;
    const card = findPublicAttributeCard(cards, id) ?? cards.secret[id];
    if (!card) throw new Error(`The initialized profile has an unknown attribute card "${id}".`);
    const category = Object.hasOwn(cards.secret, id) ? 'Revealed secret' : label(card.type);
    lines.push(
      `### ${category}: ${markdown(card.name)} (${markdown(id)})`,
      '',
      markdown(card.description),
      '',
    );
  }
  return `${lines.join('\n').trim()}\n`;
}
