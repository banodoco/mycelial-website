// The gate and the deck's opening share one definition of the visible screen (visibleView, visibleMiddle).
// Run: node --test tests/visible-view.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const deckHtml = readFileSync(new URL('../mycelial/index.html', import.meta.url), 'utf8');
const gateHtml = readFileSync(new URL('../mycelial/gate.html', import.meta.url), 'utf8');
const networkSource = readFileSync(new URL('../mycelial/dot-transitions.js', import.meta.url), 'utf8');

const snippet = (html) => {
  const start = html.indexOf('/* visible-view:begin');
  const end = html.indexOf('/* visible-view:end */');
  assert.ok(start >= 0 && end > start, 'visible-view block present');
  return html.slice(start, end).split('\n').map((line) => line.trim()).join('\n');
};

const load = (win) => {
  const context = vm.createContext({ ...win, Math });
  context.window = context;
  vm.runInContext(`${snippet(deckHtml)}\nthis.visibleView = visibleView; this.visibleMiddle = visibleMiddle;`, context);
  return context;
};

test('the gate and the deck carry the same definition', () => {
  assert.equal(snippet(gateHtml), snippet(deckHtml));
});

test('the visible screen is the visual viewport, not a large innerHeight', () => {
  // Chrome on an iPhone while loading: the page told 880, 738 on screen.
  const ios = load({ innerWidth: 430, innerHeight: 880, visualViewport: { width: 430, height: 738, scale: 1, offsetTop: 0, offsetLeft: 0 } });
  assert.deepEqual({ ...ios.visibleView() }, { x: 215, y: 369, w: 430, h: 738, top: 0, bottom: 738 });
  const offset = load({ innerWidth: 400, innerHeight: 800, visualViewport: { width: 400, height: 500, scale: 1, offsetTop: 40, offsetLeft: 0 } });
  assert.equal(offset.visibleView().y, 290);
  // Pinch zoom or no visual viewport: the layout viewport.
  const zoomed = load({ innerWidth: 400, innerHeight: 800, visualViewport: { width: 200, height: 400, scale: 2, offsetTop: 100, offsetLeft: 50 } });
  assert.equal(zoomed.visibleView().y, 400);
  assert.equal(load({ innerWidth: 400, innerHeight: 800 }).visibleView().y, 400);
});

test('the middle is re-read every call and glides to a change without a hop', () => {
  const vv = { width: 430, height: 880, scale: 1, offsetTop: 0, offsetLeft: 0 };
  const win = load({ innerWidth: 430, innerHeight: 880, visualViewport: vv });
  const middle = win.visibleMiddle(0.6);
  assert.equal(middle(0.016), 440); // the first read is taken as it is
  vv.height = 738; // the bars settle, with no event
  let at = 440, worst = 0;
  for (let i = 0; i < 40; i++) {
    const next = middle(1 / 60);
    worst = Math.max(worst, Math.abs(next - at));
    at = next;
  }
  assert.equal(at, 369);
  assert.ok(worst < 3, `largest step ${worst.toFixed(2)} px`);
  vv.height = 738.6; // sub-pixel noise is taken directly
  assert.equal(middle(1 / 60), 369.3);
});

test('the deck opening seats its mark from the shared definition', () => {
  assert.match(networkSource, /window\.deckView\?\.\(\)/);
  assert.match(networkSource, /window\.deckMiddle\?\.\(/);
  assert.match(deckHtml, /window\.deckView = visibleView;/);
  assert.match(deckHtml, /window\.deckMiddle = visibleMiddle;/);
});
