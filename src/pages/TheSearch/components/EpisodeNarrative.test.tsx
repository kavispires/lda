import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Children, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AuditionReaction } from '../types/audition-episode';
import { EpisodeContestantList, EpisodeNarrative, EpisodeSceneNarrative } from './EpisodeNarrative';
import { PropertyChangeValue } from './SimulationChange';

test('introductions render track and card-name tags without treating card names as contestant mentions', () => {
  const html = renderToStaticMarkup(
    <EpisodeNarrative
      contestants={[
        { id: 'declan', name: 'Declan' },
        { id: 'magnet', name: 'The Drama Magnet' },
      ]}
      mentionedIds={['declan']}
      onInspect={() => {}}
      text="Declan steps forward: he chose the <Tag>Dance</Tag> track, his zodiac sign is Scorpio. Even when he's silent, drama finds him. <Tag>The Drama Magnet</Tag>"
    />,
  );
  assert.match(html, />Dance<\/span>/);
  assert.match(html, />The Drama Magnet<\/span>/);
  assert.match(html, /Even when he&#x27;s silent, drama finds him/);
  assert.equal((html.match(/class="ant-tag /g) ?? []).length, 2);
  assert.equal((html.match(/data-contestant-id=/g) ?? []).length, 1);
  assert.ok(!html.includes('&lt;Tag&gt;'));
  const unrecorded = renderToStaticMarkup(
    <EpisodeNarrative
      contestants={[
        { id: 'declan', name: 'Declan' },
        { id: 'magnet', name: 'The Drama Magnet' },
      ]}
      onInspect={() => {}}
      text="Declan: <Tag>The Drama Magnet</Tag>"
    />,
  );
  assert.equal((unrecorded.match(/data-contestant-id=/g) ?? []).length, 1);
});

test('sentence mentions are name-only links without losing tags or change arrows', () => {
  const html = renderToStaticMarkup(
    <EpisodeNarrative
      contestants={[
        { id: 'ana', name: 'Ana' },
        { id: 'ana-maria', name: 'Ana Maria' },
      ]}
      onInspect={() => {}}
      text="Ana Maria selects Ana, not Anabel: relationship 50 → 55; graded B."
    />,
  );
  assert.equal((html.match(/data-contestant-id=/g) ?? []).length, 2);
  assert.ok(html.includes('data-contestant-id="ana-maria"'));
  assert.ok(html.includes('data-contestant-id="ana"'));
  assert.ok(!html.includes('images/contestants/ana-maria.jpg'));
  assert.ok(!html.includes('images/contestants/ana.jpg'));
  assert.match(html, /aria-label="Increased"/);
  assert.match(html, />graded B<\/span>/);
  assert.ok(html.includes('Anabel'));
});

test('ordered identities route same-name mentions to the correct details and escape regex characters', () => {
  const inspected: string[] = [];
  const text = 'Alex (Jr.) selects Alex (Jr.).';
  const contestants = [
    { id: 'captain', name: 'Alex (Jr.)' },
    { id: 'picked', name: 'Alex (Jr.)' },
  ];
  const node = EpisodeNarrative({
    text,
    contestants,
    mentionedIds: ['captain', 'picked'],
    onInspect: (id) => inspected.push(id),
    showProtagonistAvatar: true,
  });
  assert.ok(isValidElement<{ children: ReactNode }>(node));
  type LinkProps = { 'data-contestant-id': string; onClick: () => void };
  const links = Children.toArray(node.props.children).filter(
    (child) => isValidElement<LinkProps>(child) && typeof child.props['data-contestant-id'] === 'string',
  );
  for (const link of links) {
    assert.ok(isValidElement<LinkProps>(link));
    link.props.onClick();
  }
  assert.deepEqual(inspected, ['captain', 'picked']);
  const html = renderToStaticMarkup(node);
  assert.ok(html.includes('images/contestants/captain.jpg'));
  assert.ok(!html.includes('images/contestants/picked.jpg'));
  inspected.length = 0;
  const list = EpisodeContestantList({
    contestants,
    ids: ['picked', 'captain', 'picked'],
    onInspect: (id) => inspected.push(id),
  });
  assert.ok(isValidElement<{ children: ReactNode }>(list));
  for (const button of Children.toArray(list.props.children)) {
    assert.ok(isValidElement<LinkProps>(button));
    button.props.onClick();
  }
  assert.deepEqual(inspected, ['picked', 'captain']);
  assert.equal(text, 'Alex (Jr.) selects Alex (Jr.).');
});

test('legacy scenes link repeated unique names without guessing between namesakes', () => {
  const html = renderToStaticMarkup(
    <EpisodeNarrative
      contestants={[
        { id: 'first-alex', name: 'Alex' },
        { id: 'other-alex', name: 'Alex' },
        { id: 'jo', name: 'Jo' },
      ]}
      onInspect={() => {}}
      showProtagonistAvatar
      text="Alex watches Jo. Jo performs next."
    />,
  );
  assert.equal((html.match(/data-contestant-id="jo"/g) ?? []).length, 2);
  assert.ok(!html.includes('data-contestant-id="first-alex"'));
  assert.ok(!html.includes('data-contestant-id="other-alex"'));
  assert.ok(html.includes('Alex watches'));
});
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
      contestants={[
        { id: 'performer', name: 'First' },
        { id: 'second', name: 'Second' },
        ...reactions.map((reaction, index) => ({ id: reaction.observerId, name: `Observer${index}` })),
      ]}
      onInspect={() => {}}
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
  const visible = html.replace(/<[^>]*>/g, '');
  assert.ok(visible.includes('First performs'));
  assert.ok(visible.includes('Second performs'));
  const footerIndex = html.indexOf('aria-label="Contestant details"');
  assert.ok(footerIndex > html.lastIndexOf('Song Two'), 'all buttons follow the section text');
  assert.ok(!html.slice(0, footerIndex).includes('<img'));
  const footer = html.slice(footerIndex);
  for (const id of ['performer', 'second', 'observer-1', 'observer-2']) {
    assert.equal((footer.match(new RegExp(`data-contestant-id="${id}"`, 'g')) ?? []).length, 1);
    assert.ok(footer.includes(`images/contestants/${id}.jpg`));
  }
  assert.ok(!footer.includes('observer-0'));
  assert.deepEqual(reactions, original);
});

test('sections switch from trailing portrait buttons to inline portraits only above 20 unique contestants', () => {
  for (const count of [20, 21]) {
    const contestants = Array.from({ length: count }, (_, index) => ({
      id: `actor-${index}`,
      name: `Actor ${index}`,
    }));
    const html = renderToStaticMarkup(
      <EpisodeSceneNarrative
        contestants={contestants}
        onInspect={() => {}}
        reactions={[]}
        scene={{
          id: 'large-section',
          kind: 'choices',
          title: 'The stage',
          contestantIds: contestants.map(({ id }) => id),
          paragraphs: [...contestants.map(({ name }) => `${name} joins the stage.`), 'Actor 0 returns.'],
          paragraphContestantIds: [...contestants.map(({ id }) => [id]), ['actor-0']],
        }}
      />,
    );
    const footer = html.indexOf('aria-label="Contestant details"');
    if (count === 20) {
      assert.ok(footer > 0, 'twenty unique contestants still get buttons despite repeated mentions');
      assert.ok(!html.slice(0, footer).includes('<img'));
      assert.equal((html.match(/<img /g) ?? []).length, 20);
    } else {
      assert.equal(footer, -1, 'twenty-one contestants never get a trailing button group');
      assert.equal((html.match(/<img /g) ?? []).length, 22);
      assert.equal((html.match(/data-contestant-id=/g) ?? []).length, 22);
    }
  }
});
