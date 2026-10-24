import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContestantDetailModal } from '../components/ContestantDetailModal';
import { createSeasonSetup } from '../engine/season-setup';
import { createContestant } from './contestant-factory';
import { createContestantProfile, createSeasonCastProfiles } from './contestant-profile';

function fixture() {
  const source = Object.fromEntries(
    Array.from({ length: 55 }, (_, index) => {
      const contestant = createContestant({
        id: `profile-${index}`,
        name: `Singer ${index}`,
        updatedAt: 1,
        track: (['VOCAL', 'RAP', 'DANCE'] as const)[index % 3],
        appearance: {
          age: 23,
          height: '180 cm',
          build: 'Lean',
          hairStyle: 'Curly',
          hairColor: 'Black',
          furColor: 'Brown',
          other: 'Silver earring',
        },
        specialties: {
          vocalColor: 'SWEET',
          danceStyle: 'URBAN',
          rapStyle: 'MELODIC',
          visualVibe: '',
          leadershipStyle: '',
          genreAffinity: '',
        },
      });
      return [contestant.id, contestant];
    }),
  );
  const setup = createSeasonSetup(source, { seed: 2948, runId: 'profiles', now: 1000 });
  const contestant = setup.runtime.initialContestants.find((person) =>
    person.attributes.some((id) => Object.hasOwn(setup.runtime.definitions.cards.secret, id)),
  );
  assert.ok(contestant);
  return { ...setup, contestant };
}

test('contestant profile copies initialized appearance, descriptions, specialties, and all modified skills and traits', () => {
  const { runtime, contestant } = fixture();
  const before = JSON.stringify(runtime);
  const text = createContestantProfile(runtime, contestant.id);
  assert.match(text, /^# Singer \d+ - Contestant profile\n/);
  assert.doesNotMatch(
    text,
    /Profile at the end of initialization|Numeric traits and skills already include|Only revealed secret cards are identified/,
  );
  assert.match(text, /- Age: 23/);
  assert.match(text, /- Height: 180 cm/);
  assert.match(text, /- Build: Lean/);
  assert.match(text, /- Hair Style: Curly/);
  assert.match(text, /- Hair Color: Black/);
  assert.match(text, /- Fur Color: Brown/);
  assert.match(text, /- Other: Silver earring/);
  assert.ok(text.includes(`- Brand color: \\${contestant.color}`));
  assert.ok(text.includes(runtime.definitions.cards.persona[contestant.persona].description));
  assert.ok(text.includes(runtime.definitions.zodiacSigns[contestant.zodiacSign].description));
  for (const values of [contestant.coreSkills, contestant.utilitySkills, contestant.personality]) {
    for (const [key, value] of Object.entries(values)) {
      const words = key.replace(/([a-z])([A-Z])/g, '$1 $2');
      const label = words[0].toUpperCase() + words.slice(1);
      assert.ok(text.includes(`- ${label}: ${value}\n`), `${key} must use its final setup value`);
    }
  }
  assert.notDeepEqual(contestant.personality, runtime.sourceContestants[contestant.id].personality);
  for (const [key, id] of Object.entries(contestant.specialties)) {
    if (!id) continue;
    const field = key as keyof typeof contestant.specialties;
    assert.ok(text.includes(runtime.definitions.specialties[field][id].description));
  }
  for (const id of contestant.attributes) {
    const card = runtime.definitions.cards.identity[id] ?? runtime.definitions.cards.interest[id];
    if (card) assert.ok(text.includes(card.description));
  }
  assert.equal(JSON.stringify(runtime), before);
});

test('contestant profile retains setup values after episode mutations and omits all competition data', () => {
  const { runtime, contestants, contestant } = fixture();
  const expected = createContestantProfile(runtime, contestant.id);
  const current = contestants.find((entry) => entry.id === contestant.id);
  assert.ok(current);
  current.name = 'EPISODE NAME';
  current.updatedAt = 9999999;
  current.coreSkills.vocals = 999;
  current.utilitySkills.potential = 999;
  current.personality.ambition = 999;
  current.rank = 999;
  current.grade = 'F';
  current.condition = 'EPISODE CONDITION';
  current.status = 'ELIMINATED';
  current.events.push('EPISODE EVENT');
  current.missionRating = 999;
  current.aggregations.happiness = 999;
  current.relationships['EPISODE RELATIONSHIP'] = [999];
  current.changeLog.push({
    episode: 1,
    missionRating: 999,
    rank: 999,
    score: 999,
    status: 'ELIMINATED',
    summary: 'EPISODE LOG',
    events: [],
    change: {},
  });
  const text = createContestantProfile(runtime, contestant.id);
  assert.equal(text, expected);
  assert.doesNotMatch(
    text,
    /999|EPISODE |Aggregations|Relationships|Grade:|Status:|Rank:|Condition:|Mission rating:|Events:|Change log:/,
  );
});

test('contestant profile identifies only assigned secrets revealed for that contestant, without reapplying modifiers', () => {
  const { runtime, contestant } = fixture();
  const hiddenId = contestant.attributes.find((id) => Object.hasOwn(runtime.definitions.cards.secret, id));
  assert.ok(hiddenId);
  const hidden = runtime.definitions.cards.secret[hiddenId];
  const hiddenText = createContestantProfile(runtime, contestant.id);
  assert.ok(!hiddenText.includes(hidden.id));
  assert.ok(!hiddenText.includes(hidden.description));
  runtime.revealedSecrets.push({ contestantId: 'someone-else', cardId: hiddenId });
  assert.equal(createContestantProfile(runtime, contestant.id), hiddenText);
  runtime.revealedSecrets.push({ contestantId: contestant.id, cardId: hiddenId });
  const revealed = createContestantProfile(runtime, contestant.id);
  assert.ok(revealed.includes('### Revealed secret:'));
  assert.ok(revealed.includes(hidden.description));
  assert.ok(revealed.includes(hidden.id.replaceAll('_', '\\_')));
  const beforeStats = hiddenText.split('## Core skills')[1].split('## Attribute cards')[0];
  const afterStats = revealed.split('## Core skills')[1].split('## Attribute cards')[0];
  assert.equal(afterStats, beforeStats);
});

test('contestant profile bulk export includes the whole original cast regardless of current status or page', () => {
  const { runtime, contestants } = fixture();
  const expected = createSeasonCastProfiles(runtime);
  assert.match(expected, /^# The Search - Season cast\n/);
  const ids = [...expected.matchAll(/^- ID: (.+)$/gm)].map((match) => match[1]);
  assert.equal(ids.length, 50);
  assert.deepEqual(
    ids,
    runtime.initialContestants.map((contestant) => contestant.id),
  );
  assert.equal((expected.match(/^## Singer \d+ - Contestant profile$/gm) ?? []).length, 50);
  assert.equal((expected.match(/^### Personality /gm) ?? []).length, 50);
  for (const current of contestants) {
    current.status = 'ELIMINATED';
    current.personality.ambition = 999;
    current.rank = 999;
  }
  assert.equal(createSeasonCastProfiles(runtime), expected);
  assert.doesNotMatch(expected, /999|Aggregations|Relationships|Grade:|Status:|Rank:|Condition:/);
});

test('contestant profile copying is no longer offered in individual modals', () => {
  const { runtime, contestants, contestant } = fixture();
  const current = contestants.find((entry) => entry.id === contestant.id);
  assert.ok(current);
  current.personality.ambition = 999;
  const modal = ContestantDetailModal({
    contestant: current,
    allContestants: contestants,
    definitions: runtime.definitions,
    onClose: () => {},
  });
  assert.ok(isValidElement<{ footer: ReactNode }>(modal));
  assert.ok(Array.isArray(modal.props.footer));
  const footer = renderToStaticMarkup(<>{modal.props.footer}</>);
  assert.match(footer, /Close/);
  assert.doesNotMatch(footer, /Copy/);
});

test('contestant profile rejects a missing setup snapshot and escapes user-supplied Markdown', () => {
  const { runtime, contestant } = fixture();
  assert.throws(() => createContestantProfile(runtime, 'missing'), /No initialized profile/);
  const edited = structuredClone(runtime);
  const initial = edited.initialContestants.find((entry) => entry.id === contestant.id);
  assert.ok(initial);
  initial.name = 'Alex_*[test]';
  initial.appearance.other = '<script> [not a link](unsafe)';
  const text = createContestantProfile(edited, contestant.id);
  assert.ok(text.startsWith('# Alex\\_\\*\\[test\\]'));
  assert.ok(text.includes('\\<script\\> \\[not a link\\](unsafe)'));
});
