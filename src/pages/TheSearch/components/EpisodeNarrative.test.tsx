import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AuditionReaction } from '../types/audition-episode';
import { EpisodeNarrative, EpisodeSceneNarrative } from './EpisodeNarrative';
import { PropertyChangeValue } from './SimulationChange';

test('audition sentences tag grades and keywords and show colored change directions', () => {
  const html = renderToStaticMarkup(
    <EpisodeNarrative text="Alex is graded C. Jo reacts: relationship 50 → 53; composure 0 → -1." />,
  );
  assert.equal((html.match(/class="ant-tag /g) ?? []).length, 3);
  for (const word of ['graded C', 'relationship', 'composure']) {
    assert.match(html, new RegExp(`>${word}</span>`));
  }
  assert.match(html, /aria-label="Increased"[^>]*style="color:#52c41a"/);
  assert.match(html, /aria-label="Decreased"[^>]*style="color:#ff4d4f"/);
  assert.ok(html.includes('Alex is '));
  assert.ok(html.includes('Jo reacts: '));
});

test('narrative changes handle negative values, decimals and unchanged values without false directions', () => {
  const html = renderToStaticMarkup(
    <EpisodeNarrative text="composure -1 → 0; relationship 5.5 -> 4.25; relationship 50 → 50." />,
  );
  assert.equal((html.match(/aria-label="Increased"/g) ?? []).length, 1);
  assert.equal((html.match(/aria-label="Decreased"/g) ?? []).length, 1);
  const visible = html.replace(/<[^>]*>/g, '');
  assert.ok(!visible.includes('-1'));
  assert.ok(!visible.includes('5.5'));
  assert.ok(visible.includes('4.25'));
  assert.equal((visible.match(/50/g) ?? []).length, 1);
});

test('relationship history direction compares current values rather than growing array lengths', () => {
  const html = renderToStaticMarkup(
    <PropertyChangeValue
      change={{
        path: 'relationships.alex',
        before: [50, 53],
        after: [50, 53, 0],
        cause: 'A difficult interaction',
      }}
    />,
  );
  assert.ok(html.includes('aria-label="Decreased"'));
  assert.ok(!html.includes('aria-label="Increased"'));
  assert.ok(!html.includes('[50,53,0]'));
  assert.match(html, /<code>0<\/code>/);
});

test('history shows arrows only when comparable values actually changed', () => {
  for (const values of [
    { before: 0, after: 0 },
    { after: 4 },
    { before: ['FIRST'], after: ['FIRST', 'SECOND'] },
  ]) {
    const html = renderToStaticMarkup(
      <PropertyChangeValue change={{ path: 'attributes', cause: 'Recorded change', ...values }} />,
    );
    assert.ok(!html.includes('aria-label="Increased"'));
    assert.ok(!html.includes('aria-label="Decreased"'));
  }
  const increased = renderToStaticMarkup(
    <PropertyChangeValue change={{ path: 'aggregations.mvp', before: 0, after: 1, cause: 'Peer award' }} />,
  );
  assert.ok(increased.includes('aria-label="Increased"'));
});

test('live scene hierarchy emphasizes judges and performances while indenting recorded reaction notes', () => {
  const reaction = "Richie feels intimidation after Mateo's audition: composure 0 → -1.";
  const html = renderToStaticMarkup(
    <EpisodeSceneNarrative
      reactions={[
        {
          observerId: 'richie',
          performerId: 'mateo',
          type: 'intimidation',
          sameSong: true,
          gap: 20,
          relationshipBefore: 50,
          relationshipAfter: 45,
          composureBefore: 0,
          composureAfter: -1,
          narrative: reaction,
        },
      ]}
      scene={{
        id: 'live-scene',
        kind: 'auditions',
        title: '4 of 50 auditions complete',
        contestantIds: ['mateo'],
        paragraphs: [
          'The judges settle on visual and potential for this batch.',
          'Mateo performs "Copper Hour": a steady audition, graded C.',
          reaction,
        ],
      }}
    />,
  );
  assert.match(html, /<strong>The judges settle on visual and potential for this batch\.<\/strong>/);
  assert.match(html, /<strong>Mateo performs/);
  assert.equal((html.match(/role="note"/g) ?? []).length, 1);
  assert.match(html, /<div(?=[^>]*role="note")(?=[^>]*ant-typography-secondary)[^>]*>/);
  assert.match(html, /margin-inline-start:(\d+)px/);
  assert.ok(html.includes('aria-label="Decreased"'));
});

test('previously saved audition scenes show only their strongest notes without hiding performances', () => {
  const reactions = [1, 5, -3].map(
    (delta, index): AuditionReaction => ({
      observerId: `observer-${index}`,
      performerId: 'performer',
      type: delta > 0 ? 'admiration' : 'jealousy',
      sameSong: true,
      gap: index === 0 ? 80 : 20,
      relationshipBefore: 50,
      relationshipAfter: 50 + delta,
      composureBefore: 0,
      composureAfter: 0,
      narrative: `Observer${index} reacts: relationship 50 → ${50 + delta}.`,
    }),
  );
  const original = structuredClone(reactions);
  const html = renderToStaticMarkup(
    <EpisodeSceneNarrative
      reactions={reactions}
      scene={{
        id: 'saved-scene',
        kind: 'auditions',
        title: 'Auditions',
        contestantIds: ['performer', 'second'],
        paragraphs: [
          'First performs "Song One": graded B.',
          ...reactions.map((reaction) => reaction.narrative),
          'Second performs "Song Two": graded C.',
        ],
      }}
    />,
  );
  assert.equal((html.match(/role="note"/g) ?? []).length, 2);
  assert.ok(!html.includes('Observer0'));
  assert.ok(html.includes('Observer1'));
  assert.ok(html.includes('Observer2'));
  assert.ok(html.includes('First performs'));
  assert.ok(html.includes('Second performs'));
  assert.deepEqual(reactions, original);
});
