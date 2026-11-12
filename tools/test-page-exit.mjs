#!/usr/bin/env node
/* ==================================================================== *
 * tools/test-page-exit.mjs — LEAVING GIVES THE GPU BACK.
 *
 * SUBJECT  main.js's pagehide / pageshow pair (the LEAVING GIVES THE GPU
 *          BACK block), sliced out of the file and executed against fakes.
 *
 * WHY. On an 8 GB Mac every reload booted slower than the last: a page's
 * WebGL contexts outlived it in the GPU process while the next page
 * allocated its own. The pair must:
 *   A  lose the context of every three.js canvas and drop it to 1x1, and
 *      end the prelude's thread, on pagehide;
 *   B  keep going when a step throws — the prelude, or one canvas — so a
 *      throw early never leaves a later context alive;
 *   C  be safe to run twice;
 *   D  mark the page as leaving, so main.js's webglcontextlost handler
 *      does not answer the deliberate loss (no restore, no note);
 *   E  reload a page restored from the back/forward cache, and only that.
 * ==================================================================== */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const start = main.indexOf('let leaving = false;');
const endMark = "addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });";
const end = main.indexOf(endMark);
assert.ok(start > 0 && end > start, 'the page-exit block is where this suite expects it');
const block = main.slice(start, end + endMark.length);
assert.ok(main.indexOf('if (leaving) return;') > main.indexOf("canvas.addEventListener('webglcontextlost'"),
  'D: the context-loss handler checks `leaving` before it asks for a restore');

function world({ preludeThrows = false, badCanvas = false } = {}) {
  const listeners = {};
  const log = [];
  const canvas = (name, opts = {}) => ({
    name, width: 2924, height: 1454, lost: 0,
    getContext(type) {
      assert.equal(type, 'webgl2');
      if (opts.throws) throw new Error('transferred');
      return { getExtension: (n) => (n === 'WEBGL_lose_context' ? { loseContext: () => { this.lost++; log.push('lose ' + name); } } : null) };
    },
  });
  const canvases = [canvas('first', { throws: badCanvas }), canvas('scene')];
  const env = {
    addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); },
    heroSpores: { release: () => { log.push('prelude'); if (preludeThrows) throw new Error('prelude'); } },
    document: { querySelectorAll: (sel) => { assert.equal(sel, 'canvas[data-engine]'); return canvases; } },
    location: { reload: () => log.push('reload') },
  };
  const run = new Function(...Object.keys(env), block + '\nreturn () => leaving;');
  const isLeaving = run(...Object.values(env));
  const fire = (t, e = {}) => { for (const fn of listeners[t] || []) fn(e); };
  return { canvases, log, fire, isLeaving, listeners };
}

/* A, D */
{
  const w = world();
  assert.equal(w.isLeaving(), false, 'D: not leaving before pagehide');
  w.fire('pagehide', { persisted: false });
  assert.equal(w.isLeaving(), true, 'D: leaving once pagehide has run');
  assert.deepEqual(w.log, ['prelude', 'lose first', 'lose scene'], 'A: prelude ended, both contexts lost');
  for (const c of w.canvases) assert.deepEqual([c.width, c.height], [1, 1], 'A: every three canvas drops to 1x1');
  /* C */
  w.fire('pagehide', { persisted: true });
  for (const c of w.canvases) assert.deepEqual([c.width, c.height], [1, 1], 'C: a second pagehide is harmless');
}
/* B */
{
  const w = world({ preludeThrows: true, badCanvas: true });
  w.fire('pagehide', {});
  assert.deepEqual(w.log, ['prelude', 'lose scene'], 'B: a throwing prelude and a throwing canvas skip nothing after them');
  for (const c of w.canvases) assert.deepEqual([c.width, c.height], [1, 1], 'B: even the canvas whose context threw is shrunk');
}
/* E */
{
  const w = world();
  w.fire('pageshow', { persisted: false });
  assert.deepEqual(w.log, [], 'E: an ordinary show does nothing');
  w.fire('pageshow', { persisted: true });
  assert.deepEqual(w.log, ['reload'], 'E: a back/forward-cache restore reloads');
}

console.log('page exit: every context lost and shrunk, fenced, repeatable, bfcache restore reloads (A-E passed)');
