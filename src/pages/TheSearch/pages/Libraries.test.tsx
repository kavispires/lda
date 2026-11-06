import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import history from '../data/history-cards.json';
import lifestyle from '../data/lifestyle-cards.json';
import quirks from '../data/quirks-cards.json';
import { LibrariesIndexPage } from './LibrariesIndexPage';
import { LibraryViewerPage } from './LibraryViewerPage';

test('character libraries appear in the listing and their routes display the actual cards', () => {
  const index = renderToStaticMarkup(
    <MemoryRouter>
      <LibrariesIndexPage />
    </MemoryRouter>,
  );
  for (const [path, title, library] of [
    ['lifestyle', 'Lifestyle Cards', lifestyle],
    ['history', 'History Cards', history],
    ['quirks', 'Quirk Cards', quirks],
  ] as const) {
    assert.ok(index.includes(title), title);
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={[`/the-search/libraries/${path}`]}>
        <Routes>
          <Route element={<LibraryViewerPage />} path="/the-search/libraries/:type" />
        </Routes>
      </MemoryRouter>,
    );
    assert.ok(html.includes(title), title);
    const first = Object.values(library).sort((a, b) => a.name.localeCompare(b.name))[0];
    const escapedName = renderToStaticMarkup(<>{first.name}</>);
    assert.ok(html.includes(escapedName), first.name);
    assert.doesNotMatch(html, /Library not found/);
  }
});
