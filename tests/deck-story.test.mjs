// Dependency-free checks for the synchronous intro enhancement and overlay API.
// Run from the repository root: node --test tests/deck-story.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../mycelial/deck-overlay.js', import.meta.url), 'utf8');
function fixture(selectors = ['.ac-host', '.as-host', '.st-host']) {
  const hosts = new Map(selectors.map(selector => {
    const classes = new Set();
    const heading = { innerHTML: 'Old headline' };
    const body = { textContent: 'Old body', hidden: false };
    return [selector, { heading, body, classList: {
      contains: name => classes.has(name), add: name => classes.add(name),
    }, querySelector: name => name === 'h1' ? heading : name === '.body' ? body : null }];
  }));
  const styles = new Map();
  const listeners = new Map();
  const context = vm.createContext({
    console,
    document: {
      querySelector: name => hosts.get(name) || null,
      getElementById: id => styles.get(id) || null,
      createElement: tag => { assert.equal(tag, 'style'); return {}; },
      head: { appendChild: element => styles.set(element.id, element) },
    },
    window: { addEventListener: (type, fn) => listeners.set(type, fn) },
  });
  const run = () => vm.runInContext(source, context);
  run();
  const event = extra => ({ prevented: false, stopped: false,
    preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...extra });
  return { hosts, styles, listeners, context, run, event };
}

test('updates the three canonical headings synchronously, without replacing them', () => {
  const f = fixture();
  for (const host of f.hosts.values()) {
    assert.equal(host.querySelector('h1'), host.heading);
    assert.ok(host.classList.contains('story-refined'));
    assert.equal(host.body.textContent, '');
    assert.equal(host.body.hidden, true);
  }
  assert.match(f.hosts.get('.ac-host').heading.innerHTML, /agent-powered creative workspace/);
  const intro = f.hosts.get('.as-host').heading.innerHTML;
  assert.match(intro, /Meet /);
  assert.match(intro, /href="https:\/\/astrid\.haus\/"/);
  assert.match(intro, /open AI community’s models, tools and knowledge/);
  assert.match(intro, /We start with video/);
  assert.doesNotMatch(intro, /No installs|OpenAI models/);
  const stack = f.hosts.get('.st-host').heading.innerHTML;
  assert.match(stack, /yours to shape/);
  assert.match(stack, /extend every layer/);
  assert.match(stack, /community-built creative platform/);
  assert.equal(f.styles.size, 1);
});

test('re-entry neither duplicates styles nor replaces canonical nodes', () => {
  const f = fixture();
  const heading = f.hosts.get('.as-host').heading;
  const style = f.styles.get('deck-intro-story');
  f.run();
  assert.equal(f.styles.size, 1);
  assert.equal(f.styles.get('deck-intro-story'), style);
  assert.equal(f.hosts.get('.as-host').heading, heading);
});

test('other pages can use overlays without any intro slides', () => {
  const f = fixture([]);
  assert.equal(f.styles.size, 0);
  assert.equal(typeof f.context.window.deckOverlay.register, 'function');
});

test('CSS keeps the existing alpha contract and includes narrow/short layouts', () => {
  const css = fixture().styles.get('deck-intro-story').textContent;
  assert.match(css, /var\(--as-copy-alpha, 1\)/);
  assert.match(css, /max-width: 760px/);
  assert.match(css, /max-height: 500px/);
  assert.match(css, /max-width: 1100px/);
  assert.doesNotMatch(css, /(?:animation|transition)\s*:/);
});

test('Escape dismisses a detail without navigating, while arrows still navigate', () => {
  const f = fixture();
  const reasons = [];
  f.context.window.deckOverlay.register({ isOpen: () => true, contains: () => false,
    close: reason => reasons.push(reason) });
  const escape = f.event({ key: 'Escape' });
  f.listeners.get('keydown')(escape);
  assert.equal(reasons.pop(), 'escape');
  assert.equal(escape.prevented, true);
  assert.equal(escape.stopped, true);
  const arrow = f.event({ key: 'ArrowRight' });
  f.listeners.get('keydown')(arrow);
  assert.equal(reasons.pop(), 'navigation');
  assert.equal(arrow.prevented, false);
});

test('inside clicks are preserved, outside clicks dismiss only the open detail', () => {
  const f = fixture();
  const inside = {};
  const reasons = [];
  const unregister = f.context.window.deckOverlay.register({ isOpen: () => true,
    contains: target => target === inside, close: reason => reasons.push(reason) });
  const internal = f.event({ target: inside });
  f.listeners.get('click')(internal);
  assert.equal(reasons.length, 0);
  const outside = f.event({ target: {} });
  f.listeners.get('click')(outside);
  assert.deepEqual(reasons, ['outside']);
  assert.equal(outside.prevented, true);
  unregister();
  f.listeners.get('click')(f.event({ target: {} }));
  assert.equal(reasons.length, 1);
});
