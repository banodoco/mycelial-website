// Pure geometry/progress regression tests for the optional slide 9 expansion.
// Execute with: node --test tests/community-expansion.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
// The website is ESM; exercise this classic browser script in its actual window shape.
const source = readFileSync(join(__dirname, '../mycelial/community-expansion.js'), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox, { filename: 'community-expansion.js' });
const scope = sandbox.window.MycelialCommunityExpansion;

test('nesting scales from the fitted existing flywheel geometry', () => {
  for (const tall of [false, true]) {
    const z = scope.geometry([340, 260, 100, 75], tall);
    assert.equal(z.cx, 340);
    assert.equal(z.cy, 260);
    assert.ok(z.rx < z.openRx && z.openRx < z.reachRx);
    assert.ok(z.ry < z.openRy && z.openRy < z.reachRy);
    for (const xy of Object.values(scope.labelPositions([340, 260, 100, 75], tall))) {
      assert.equal(xy.length, 2);
      assert.ok(xy.every(Number.isFinite));
    }
  }
});

test('expansion is absent before its arrival, full on direct or settled slide 9', () => {
  const p = { morph: 0, motesAt: 2.4 };
  assert.equal(scope.visibility({ ...p, time: 0 }), 0);
  assert.equal(scope.visibility({ ...p, time: 30 }), 1);
  assert.equal(scope.visibility({ ...p, time: 2.6 }), 1); // Flowers handoff finishes by 2.6 seconds
  assert.equal(scope.visibility({ ...p, time: 30, morph: 1 }), 0);
});

test('9-to-10 contracts; 10-to-9 expands; reverse 9-to-8 begins without popping', () => {
  const v = (morph, tall = false) => scope.visibility({ morph, tall, time: 30 });
  for (const tall of [false, true]) {
    assert.equal(v(0, tall), 1);
    assert.equal(v(1, tall), 0);
    for (let i = 0; i < 100; i++) assert.ok(v(i / 100, tall) + 1e-9 >= v((i + 1) / 100, tall));
  }
  assert.equal(scope.visibility({ time: 2.6, morph: 0, reversingTo8: true }), 1);
  assert.equal(scope.visibility({ time: 0, morph: 0, reversingTo8: true }), 0);
  assert.ok(scope.visibility({ time: 1.3, morph: 0, reversingTo8: true }) < 1);
});

test('canvas paint is bounded, stateless and restores drawing state', () => {
  let saves = 0, restores = 0, lines = 0;
  const g = {
    save() { saves++; }, restore() { restores++; },
    beginPath() {}, moveTo() {}, lineTo() {}, ellipse() {}, arc() {},
    stroke() { lines++; }, fill() {}, setLineDash() {}, bezierCurveTo() {}
  };
  scope.paint(g, [320, 280, 110, 95], { visibility: 0 });
  assert.equal(lines, 0);
  for (const amount of [0.01, 0.5, 1]) {
    scope.paint(g, [320, 280, 110, 95],
      { visibility: amount, time: 7.2, tall: false, scale: 0.9 });
    assert.equal(saves, restores);
  }
  assert.ok(lines > 4);
});

test('the live deck includes the renderer before flywheel and retains the 8-11 transitions', () => {
  const html = readFileSync(join(__dirname, '../mycelial/index.html'), 'utf8');
  const flywheel = readFileSync(join(__dirname, '../mycelial/flywheel.js'), 'utf8');
  assert.ok(html.indexOf('src="community-expansion.js"') > 0);
  assert.ok(html.indexOf('src="community-expansion.js"') < html.indexOf('src="flywheel.js"'));
  assert.match(html, /carry <em>its creative momentum far beyond it/);
  assert.match(flywheel, /Scope\.paint\(g, cur\.ring/);
  assert.match(flywheel, /reversingTo8: !!unhanding/);
  assert.match(flywheel, /deckRegisterScene\(\[8, 9, 10\]/);
  assert.match(flywheel, /window\.AstridFlowers\.prepareReturn\(ctx\)/);
});
