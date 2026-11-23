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


test('all five role-orb centres lie EXACTLY on the inner ellipse', () => {
  for (const tall of [false, true]) {
    const ring = [340, 260, 108, 82];
    const positions = scope.rolePositions(ring, tall);
    assert.equal(positions.length, 5);
    for (const p of positions) {
      const equation = ((p.x-ring[0])/ring[2])**2 + ((p.y-ring[1])/ring[3])**2;
      assert.ok(Math.abs(equation - 1) < 1e-10, 'role must be on the ring, not inset');
    }
  }
});

test('three clear labels and full outer oval fit viewport limits', () => {
  const labels = scope.labelPositions([720,370,130,110], false, .8, {
    width: 1440, height: 900, top: 78, bottom: 680,
  });
  assert.deepEqual(Object.keys(labels).sort(), ['community','open','world']);
  const z = scope.geometry([720,370,130,110], false, {
    width:1440,height:900,top:78,bottom:680
  });
  assert.ok(z.rx < z.openRx && z.openRx < z.reachRx);
  assert.ok(z.ry < z.openRy && z.openRy < z.reachRy);
  assert.ok(z.reachRx > 520, 'wider creative world should fill most desktop width');
  assert.ok(z.reachRx < 680, 'outer ellipse must stay inside desktop bounds');
  assert.ok(z.reachRy < 300, 'outer ellipse must avoid copy and count');
});

test('a single nine-second orbit hits each orb once, including across delayed frames', () => {
  const period = scope.ORBIT_PERIOD, segment = period / 5;
  assert.equal(period, 9);
  assert.equal(scope.orbitAngle(0, 0), -Math.PI/2);
  assert.deepEqual(Array.from(scope.orbitHits(-.1, 0, 0)), [0]);
  assert.deepEqual(Array.from(scope.orbitHits(.1, segment+.01, 0)), [1]);
  assert.deepEqual(Array.from(scope.orbitHits(.1, segment*3+.01, 0)), [1,2,3]);
  assert.deepEqual(Array.from(scope.orbitHits(8.9, 9.01, 0)), [0]);
  assert.deepEqual(Array.from(scope.orbitHits(9.2, 9.3, 0)), []);
  assert.deepEqual(Array.from(scope.orbitHits(3, 4.9, 2.4)), [1]);
  assert.deepEqual(Array.from(scope.orbitHits(4.9, 3, 2.4)), []);
});


test('wide desktop, phone and landscape rings never cross vertically', () => {
  // Regression: .72 * capped reachRy could make the middle ring smaller than the inner one.
  const cases = [
    { ring:[960,425,237,237], view:{width:1920,height:900,top:80,bottom:655} },
    { ring:[960,500,237,237], view:{width:1920,height:1080,top:88,bottom:785} },
    { ring:[1280,600,273,273], view:{width:2560,height:1440,top:100,bottom:1030} },
    { ring:[720,360,185,185], view:{width:1440,height:900,top:80,bottom:685} },
    { ring:[195,330,105,105], view:{width:390,height:844,top:76,bottom:570} },
    { ring:[422,130,152,49], view:{width:844,height:390,top:55,bottom:230,short:true} },
  ];
  for (const {ring,view} of cases) {
    const tall = view.width < view.height;
    const z = scope.geometry(ring,tall,view);
    const innerGap = Math.max(view.short ? 9 : tall ? 12 : 17, ring[3] * .12);
    const outerGap = Math.max(view.short ? 9 : tall ? 11 : 14, ring[3] * .10);
    assert.ok(z.openRy-z.ry >= innerGap - 1e-9,
      'middle ring crosses community ring at ' + view.width + 'x' + view.height);
    assert.ok(z.reachRy-z.openRy >= outerGap - 1e-9,
      'outer ring crosses ecosystem ring at ' + view.width + 'x' + view.height);
    assert.ok(z.rx < z.openRx && z.openRx < z.reachRx);
  }
});
