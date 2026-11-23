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

test('five named actor-orbs replace the earlier dense role diagram', () => {
  assert.equal(scope.ROLES.length, 5);
  assert.equal(new Set(scope.ROLES).size, 5);
  const ring = [200, 300, 118, 118];
  for (const tall of [false, true]) {
    const positions = scope.rolePositions(ring, tall);
    assert.equal(positions.length, 5);
    assert.ok(positions.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
    assert.ok(positions.every(p => ((p.x-200)/118)**2 + ((p.y-300)/118)**2 <= 1.001));
  }
  const fw = readFileSync(join(__dirname, '../mycelial/flywheel.js'), 'utf8');
  assert.match(fw, /Scope\.paintRoles\(g, cur\.ring/);
  assert.match(fw, /\['artists', 'g0', 'g1', 'g2', 'inspire', 'equip'\]\.includes\(key\)\) opacity = 0/);
});

test('all five orbiters sit EXACTLY on the community ellipse', () => {
  for (const ring of [[200, 300, 118, 118], [720, 330, 234, 176], [422, 130, 156, 49]]) {
    const [cx, cy, rx, ry] = ring;
    for (const p of scope.rolePositions(ring)) {
      const contour = ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2;
      assert.ok(Math.abs(contour - 1) < 1e-10, 'orb must be attached to stroke');
    }
  }
});
test('three nested complete ring geometries expand dramatically on desktop', () => {
  const inner = [720, 360, 185, 185];
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 844, height: 390, short: true },
  ]) {
    const tall = viewport.width < viewport.height;
    const ring = viewport.width === 1440 ? inner :
      viewport.width === 390 ? [195, 330, 105, 105] : [422, 130, 152, 49];
    const z = scope.geometry(ring, tall, viewport);
    assert.ok(z.rx < z.openRx && z.openRx < z.outerRx);
    assert.ok(z.ry < z.openRy && z.openRy < z.outerRy);
    const pos = scope.labelPositions(ring, tall, 1, viewport);
    assert.deepEqual(Object.keys(pos).sort(), ['community','open','world'].sort());
    assert.ok(Object.values(pos).every(p => p.length === 2 && p.every(Number.isFinite)));
  }
  const wide = scope.geometry(inner, false, {width: 1440, height: 900});
  assert.ok(wide.outerRx > inner[2] * 3.0, 'wider world must stretch across the screen');
});
test('outer world is a complete ellipse and hit flash only affects its target orb', () => {
  const ellipses = [];
  const gradient = () => ({ addColorStop() {} });
  const mock = {
    save() {}, restore() {}, setLineDash() {}, beginPath() {}, moveTo() {}, lineTo() {},
    closePath() {}, stroke() {}, fill() {}, arc() {}, createRadialGradient: gradient,
    ellipse(cx,cy,rx,ry,r,start,end) { ellipses.push({cx,cy,rx,ry,start,end}); },
  };
  scope.paint(mock, [720,360,190,190], {width:1440,height:900,visibility:1,scale:1,time:6});
  assert.ok(ellipses.length >= 4);
  assert.ok(ellipses.every(e => Math.abs(e.end-e.start-2*Math.PI) < 1e-9), 'no half-arcs');
  scope.paintRoles(mock, [720,360,190,190], {time:6,opacity:1,impacts:[0,1,0,0,0]});
});
