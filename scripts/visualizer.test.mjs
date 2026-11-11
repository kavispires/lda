import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import lodash from 'lodash';
import postcss from 'postcss';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { compile } from 'sass';
import ts from 'typescript';

const stub = () => null;
function findElement(node, predicate) {
  if (!React.isValidElement(node)) return;
  if (predicate(node)) return node;
  return React.Children.toArray(node.props.children)
    .map((child) => findElement(child, predicate))
    .find(Boolean);
}
function songWithSections(starts = [1000, 10000, 20000]) {
  const song = {
    id: 'song',
    title: 'Test',
    startAt: 1000,
    endAt: 30000,
    sectionIds: [],
    content: {},
  };
  starts.forEach((start, index) => {
    const id = `section-${index}`;
    const lineId = `line-${index}`;
    const partId = `part-${index}`;
    song.sectionIds.push(id);
    song.content[id] = { id, type: 'section', kind: 'VERSE', number: index + 1, linesIds: [lineId] };
    song.content[lineId] = { id: lineId, type: 'line', sectionId: id, partsIds: [partId] };
    song.content[partId] = { id: partId, type: 'part', startTime: start, endTime: start + 3000 };
  });
  return song;
}

function visualizerHarness({
  hover = false,
  width = 1024,
  song = songWithSections(),
  currentTime = 1000,
  isPlaying = false,
  formation,
  statsWidth = 320,
} = {}) {
  let visible = false;
  let stateIndex = 0;
  const states = [];
  const calls = [];
  const context = {
    song,
    formation,
    hasFormation: !!formation,
    distribution: { mapping: {}, assignees: {} },
    videoControls: {
      currentTime,
      isPlaying,
      seekToStart: () => {
        calls.push(['beginning']);
        context.videoControls.currentTime = song.startAt;
      },
      seekToEnd: () => {
        calls.push(['end']);
        context.videoControls.currentTime = song.endAt;
      },
      playVideo: () => {
        calls.push(['play']);
        context.videoControls.isPlaying = true;
      },
      pauseVideo: () => {
        calls.push(['pause']);
        context.videoControls.isPlaying = false;
      },
      seekTo: (time) => {
        calls.push(['seek', time]);
        context.videoControls.currentTime = time;
      },
      seekAndPlay: (time) => {
        calls.push(['seekAndPlay', time]);
        context.videoControls.currentTime = time;
      },
      onRestart: () => {
        throw new Error('Controls must not reload the visualizer');
      },
    },
    measurements: { stats: { width: statsWidth } },
    barSnapshots: { 0: {} },
    freshness: {},
  };
  const modules = new Map();
  const requireMock = (id, parent) => {
    if (id === 'react') {
      return {
        ...React,
        useState: (value) => {
          const index = stateIndex++;
          if (!(index in states)) states[index] = value;
          return [
            states[index],
            (next) => {
              states[index] = next;
            },
          ];
        },
        useMemo: (fn) => fn(),
      };
    }
    if (id === 'react/jsx-runtime') return jsxRuntime;
    if (id === 'react-use') {
      return {
        useToggle: () => [
          visible,
          (value) => {
            visible = value ?? !visible;
          },
        ],
        useMedia: (query) => (query === '(hover: hover)' ? hover : width <= 767),
        useMeasure: () => [stub, { height: 500 }],
        useKeyPressEvent: stub,
      };
    }
    if (id === '@services/DistributionVisualizerProvider') {
      return { RATE: 1, useDistributionVisualizerContext: () => context };
    }
    if (id === 'clsx') return { default: (...values) => values.filter(Boolean).join(' ') };
    if (id === 'react-router-dom') return { useNavigate: () => stub, useParams: () => ({}) };
    if (id === 'lodash') return lodash;
    if (
      id.startsWith('@utils/song/') ||
      ['@utils/helpers', '@utils/constants', '@utils/formation'].includes(id)
    ) {
      return loadSource(new URL(`../src/${id.slice(1)}.ts`, import.meta.url));
    }
    if (id.startsWith('./') && parent.pathname.includes('/src/utils/')) {
      return loadSource(new URL(`${id}.ts`, parent));
    }
    if (id === './VisualizerControls') return load('VisualizerControls');
    if (id === './VisualizerMobile') return load('VisualizerMobile');
    return new Proxy({}, { get: () => stub });
  };
  function load(name) {
    return loadSource(new URL(`../src/components/Visualizer/${name}.tsx`, import.meta.url));
  }
  function loadSource(url) {
    if (!modules.has(url.href)) {
      const source = readFileSync(url, 'utf8');
      const { outputText } = ts.transpileModule(source, {
        fileName: url.pathname,
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
      });
      const exports = {};
      modules.set(url.href, exports);
      new Function('require', 'exports', outputText)((id) => requireMock(id, url), exports);
    }
    return modules.get(url.href);
  }
  const render = () => {
    stateIndex = 0;
    const root = load('Visualizer').Visualizer();
    return root.type === load('VisualizerMobile').VisualizerMobile ? root.type(root.props) : root;
  };
  return {
    render,
    calls,
    clickControl: (label) => {
      const root = render();
      const controls = React.Children.toArray(root.props.children).find(
        (child) => React.isValidElement(child) && 'isVisible' in child.props,
      );
      const button = findElement(controls.type(controls.props), (node) => node.props['aria-label'] === label);
      assert.ok(button, `Missing control: ${label}`);
      if (!button.props.disabled) button.props.onClick();
      return button;
    },
    controls: () =>
      React.Children.toArray(render().props.children).find(
        (child) => React.isValidElement(child) && 'isVisible' in child.props,
      ),
  };
}

test('tablet taps toggle controls without synthetic mouse events hiding or reopening them', () => {
  const harness = visualizerHarness();
  assert.equal(harness.render().props.className, 'visualizer');
  assert.equal(harness.controls().props.isVisible, false);
  harness.render().props.onMouseEnter?.();
  harness.render().props.onClick?.();
  harness.render().props.onMouseLeave?.();
  assert.equal(harness.controls().props.isVisible, true);
  harness.render().props.onMouseEnter?.();
  harness.render().props.onClick?.();
  harness.render().props.onMouseLeave?.();
  assert.equal(harness.controls().props.isVisible, false);
});

test('mouse hover still reveals controls and desktop clicks do not toggle them', () => {
  const harness = visualizerHarness({ hover: true });
  harness.render().props.onMouseEnter();
  assert.equal(harness.controls().props.isVisible, true);
  harness.render().props.onClick?.();
  assert.equal(harness.controls().props.isVisible, true);
  harness.render().props.onMouseLeave();
  assert.equal(harness.controls().props.isVisible, false);
});

test('interacting with the controls stops the tap before it reaches the visualizer', () => {
  const harness = visualizerHarness();
  harness.render().props.onClick?.();
  const controls = harness.controls();
  let stopped = false;
  controls.type(controls.props).props.onClick({
    stopPropagation: () => {
      stopped = true;
    },
  });
  assert.equal(stopped, true);
  assert.equal(harness.controls().props.isVisible, true);
});

test('phone layout keeps its existing tap toggle', () => {
  const harness = visualizerHarness({ width: 767 });
  assert.equal(harness.render().props.className, 'visualizer-mobile');
  harness.render().props.onClick();
  assert.equal(harness.controls().props.isVisible, true);
  harness.render().props.onClick();
  assert.equal(harness.controls().props.isVisible, false);
});

test('playback buttons play, pause, and seek without restarting the visualizer', () => {
  const harness = visualizerHarness();
  harness.clickControl('Play');
  harness.clickControl('Pause');
  harness.clickControl('Go to beginning');
  harness.clickControl('Go to end');
  assert.deepEqual(harness.calls, [['play'], ['pause'], ['beginning'], ['end']]);
});

test('section skips use a two-second lead-in and repeated skips advance while paused', () => {
  const harness = visualizerHarness();
  assert.equal(harness.clickControl('Previous section').props.disabled, true);
  harness.clickControl('Next section');
  harness.clickControl('Next section');
  assert.equal(harness.clickControl('Next section').props.disabled, true);
  harness.clickControl('Previous section');
  harness.clickControl('Previous section');
  assert.equal(harness.clickControl('Previous section').props.disabled, true);
  assert.deepEqual(harness.calls, [
    ['seek', 8000],
    ['seek', 18000],
    ['seek', 8000],
    ['seek', 1000],
  ]);
});

test('section skips keep playing and go to the previous section rather than restarting the current one', () => {
  const harness = visualizerHarness({ currentTime: 15000, isPlaying: true });
  harness.clickControl('Previous section');
  harness.clickControl('Next section');
  assert.deepEqual(harness.calls, [
    ['seekAndPlay', 1000],
    ['seekAndPlay', 8000],
  ]);
});

test('section skips ignore empty sections and sections outside the song window', () => {
  const song = songWithSections([1000, 10000, 40000]);
  song.sectionIds.unshift('empty');
  song.content.empty = { id: 'empty', type: 'section', kind: 'VERSE', number: '', linesIds: [] };
  const harness = visualizerHarness({ song });
  harness.clickControl('Next section');
  assert.equal(harness.clickControl('Next section').props.disabled, true);
  assert.deepEqual(harness.calls, [['seek', 8000]]);
  const empty = visualizerHarness({ song: songWithSections([]) });
  assert.equal(empty.clickControl('Previous section').props.disabled, true);
  assert.equal(empty.clickControl('Next section').props.disabled, true);
});

test('sections whose lead-ins clamp to the same song start do not trap previous-section navigation', () => {
  const harness = visualizerHarness({ song: songWithSections([1000, 2000, 10000]), currentTime: 15000 });
  harness.clickControl('Previous section');
  assert.equal(harness.clickControl('Previous section').props.disabled, true);
  harness.clickControl('Next section');
  assert.deepEqual(harness.calls, [
    ['seek', 1000],
    ['seek', 8000],
  ]);
});

test('formation playback is always mirrored without a mirror checkbox or changes to saved coordinates', () => {
  const formation = {
    snapshots: [{ id: 'pose', timestamp: 0, transition: 0, positions: { dancer: { x: 4.5, y: 3.5 } } }],
  };
  const harness = visualizerHarness({ formation });
  const checkbox = findElement(harness.render(), (node) => node.props.children === 'Formation');
  checkbox.props.onChange({ target: { checked: true } });
  const root = harness.render();
  const stage = findElement(root, (node) => 'positions' in node.props);
  assert.equal(stage.props.frontAtTop, true);
  assert.deepEqual(stage.props.positions, { dancer: { x: 4.5, y: 15.5 } });
  assert.deepEqual(formation.snapshots[0].positions, { dancer: { x: 4.5, y: 3.5 } });
  assert.equal(
    findElement(root, (node) => node.props.children === 'Mirror formation'),
    undefined,
  );
});

test('toggling formation leaves the video props unchanged', () => {
  const harness = visualizerHarness({
    formation: { snapshots: [{ id: 'pose', timestamp: 0, transition: 0, positions: {} }] },
    statsWidth: 640,
  });
  const video = () => findElement(harness.render(), (node) => node.props.className === 'visualizer__video');
  const original = video().props;
  const toggle = (checked) => {
    findElement(harness.render(), (node) => node.props.children === 'Formation').props.onChange({
      target: { checked },
    });
  };
  toggle(true);
  assert.deepEqual(video().props, original);
  toggle(false);
  assert.deepEqual(video().props, original);
});

test('formation does not change the video or title presentation', () => {
  const { css } = compile(
    fileURLToPath(new URL('../src/components/Visualizer/Visualizer.scss', import.meta.url)),
    { loadPaths: [fileURLToPath(new URL('../src', import.meta.url))] },
  );
  const stylesheet = postcss.parse(css);
  const stylesFor = (className, formation) => {
    const styles = {};
    const selectors = [`.${className}`];
    if (formation) selectors.push(`.visualizer--formation .${className}`);
    for (const selector of selectors) {
      stylesheet.walkRules((rule) => {
        if (rule.selectors.includes(selector)) {
          rule.walkDecls((declaration) => {
            styles[declaration.prop] = declaration.value;
          });
        }
      });
    }
    return styles;
  };
  for (const className of ['visualizer__video', 'visualizer__title']) {
    assert.deepEqual(stylesFor(className, true), stylesFor(className, false));
  }
});
