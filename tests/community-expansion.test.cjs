// Pure geometry/progress regression tests for the optional slide 9 expansion.
// Execute with: node --test tests/community-expansion.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const scope = require('../mycelial/community-expansion.js');

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
