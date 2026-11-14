// Exercise the real bootstrap with delayed/failed font requests. Browser checks
// separately measure first-visible line wrapping; these cover its startup races.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../mycelial/index.html', import.meta.url), 'utf8');
const bootstrap = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1]).find((code) => code.includes('The first layout must use the same fonts'));
assert.ok(bootstrap, 'the production font bootstrap is present');

function fixture({ hash = '#1', noApi = false, throws = false } = {}) {
  const requests = [], timers = new Map(), classes = new Set(), visits = [];
  const location = { hash };
  const intro = { initialized: false };
  const fonts = noApi ? undefined : {
    // An unrelated font may remain pending indefinitely: it must not block copy.
    ready: new Promise(() => {}),
    load(font, text) {
      if (throws) throw new Error('font loading unavailable');
      return new Promise((resolve, reject) => requests.push({ font, text, resolve, reject }));
    }
  };
  const context = vm.createContext({
    document: { fonts, documentElement: { classList: { add: (name) => classes.add(name) } } },
    window: { __deckIntro: intro, deckBoot: () => visits.push(location.hash) },
    setTimeout: (fn, ms) => { timers.set(fn, ms); return fn; },
    clearTimeout: (fn) => timers.delete(fn),
  });
  vm.runInContext(bootstrap, context);
  const resolve = (request, faces = [{}]) => request.resolve(faces);
  const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
  const expire = () => { for (const fn of [...timers.keys()]) { timers.delete(fn); fn(); } };
  return { requests, timers, classes, visits, location, intro, resolve, flush, expire };
}

test('first selection waits for every critical face, including the italic heading', async () => {
  const f = fixture();
  assert.equal(f.intro.initialized, true, 'the old script watchdog yields to the bounded font wait');
  assert.equal(f.visits.length, 0);
  const italic = f.requests.find((request) => request.font.startsWith('italic 500'));
  assert.ok(italic);
  for (const request of f.requests) if (request !== italic) f.resolve(request);
  await f.flush();
  assert.equal(f.visits.length, 0, 'normal-font readiness cannot expose a fallback italic line');
  f.resolve(italic);
  await f.flush();
  assert.deepEqual(f.visits, ['#1']);
  assert.equal(f.classes.size, 0);
  assert.equal(f.intro.fontsReady, true);
  assert.equal(f.timers.size, 0);
});

test('font completion selects the latest URL instead of a stale initial slide', async () => {
  const f = fixture({ hash: '' });
  f.location.hash = '#5';
  f.requests.forEach((request) => f.resolve(request));
  await f.flush();
  assert.deepEqual(f.visits, ['#5']);
});

test('hung fonts expose a stable fallback once and late success cannot restart or switch it', async () => {
  const f = fixture();
  assert.equal([...f.timers.values()][0], 8000);
  f.expire();
  assert.deepEqual(f.visits, ['#1']);
  assert.equal(f.classes.has('dt-type-fallback'), true);
  f.location.hash = '#2';
  f.requests.forEach((request) => f.resolve(request));
  await f.flush();
  assert.deepEqual(f.visits, ['#1']);
  assert.equal(f.classes.has('dt-type-fallback'), true);
});

test('failed or missing font faces boot with fallback without waiting for the deadline', async () => {
  for (const missing of [false, true]) {
    const f = fixture();
    f.requests.forEach((request, index) => {
      if (index) f.resolve(request);
      else if (missing) f.resolve(request, []);
      else request.reject(new Error('network error'));
    });
    await f.flush();
    assert.deepEqual(f.visits, ['#1']);
    assert.equal(f.classes.has('dt-type-fallback'), true);
    assert.equal(f.timers.size, 0);
  }
});

test('unsupported and synchronously failing font APIs never leave the deck waiting', () => {
  for (const options of [{ noApi: true }, { throws: true }]) {
    const f = fixture(options);
    assert.deepEqual(f.visits, ['#1']);
    assert.equal(f.classes.has('dt-type-fallback'), true);
    assert.equal(f.timers.size, 0);
  }
});
