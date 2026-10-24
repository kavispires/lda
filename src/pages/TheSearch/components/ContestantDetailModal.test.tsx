import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TabsProps } from 'antd';
import { isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Contestant } from '../types/contestant';
import { createContestant } from '../utilities/contestant-factory';
import { ContestantDetailModal } from './ContestantDetailModal';

function renderRelationships(contestant: Contestant, allContestants: Contestant[]) {
  const modal = ContestantDetailModal({ contestant, allContestants, onClose: () => {} });
  assert.ok(isValidElement<{ children: ReactNode }>(modal));
  const tabs = modal.props.children;
  assert.ok(isValidElement<TabsProps>(tabs));
  const relationships = tabs.props.items?.find((item) => item.key === 'relationships');
  assert.ok(relationships);
  return renderToStaticMarkup(relationships.children);
}

test('relationship rows exclude self even in old saves, while keeping other contestants with the same name', () => {
  const contestant = createContestant({ id: 'self', name: 'Alex' });
  const other = createContestant({ id: 'other', name: 'Alex' });
  contestant.relationships = { self: [99], other: [51] };
  const before = structuredClone(contestant);
  const html = renderRelationships(contestant, [contestant, other]);
  assert.ok(!html.includes('data-row-key="self"'));
  assert.ok(html.includes('data-row-key="other"'));
  assert.ok(html.includes('Relationships (1)'));
  assert.deepEqual(contestant, before, 'viewing old saves must not rewrite their history');
});

test('relationships containing only self show the empty relationship list', () => {
  const contestant = createContestant({ id: 'self', name: 'Alex' });
  contestant.relationships = { self: [50] };
  const html = renderRelationships(contestant, [contestant]);
  assert.ok(html.includes('Relationships (0)'));
  assert.ok(html.includes('No relationships initialized'));
  assert.ok(!html.includes('data-row-key="self"'));
});

test('unperformed contestant details do not invent a grade or reveal a mission rating', () => {
  const contestant = createContestant({ id: 'waiting', name: 'Waiting performer' });
  const modal = ContestantDetailModal({
    contestant,
    allContestants: [contestant],
    onClose: () => {},
    hidePerformance: true,
  });
  assert.ok(isValidElement<{ children: ReactNode }>(modal));
  assert.ok(isValidElement<TabsProps>(modal.props.children));
  const basic = modal.props.children.props.items?.find((item) => item.key === 'basic');
  assert.ok(basic);
  const html = renderToStaticMarkup(basic.children);
  assert.match(html, /Not performed/);
  assert.doesNotMatch(html, /Mission Rating/);
});
