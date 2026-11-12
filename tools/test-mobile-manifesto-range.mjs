import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONTENT } from '../content/content.js';
import { manifestoVerse } from '../content/manifesto-verse.js';
import { manifestoPose, mobileReadingSchedule, lineSecondsFor, WORD_STAGGER_SECONDS, WORD_REVEAL_SECONDS, WORD_VISIBLE_SECONDS, WORD_VISIBLE_FRACTION, ascentAt, CAMERA_SECONDS, aerialPlacements, planAerialReveals } from '../journey/manifesto/pose.js';
const makeRng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const groundY = () => 0;
const from = { position: { x: 8, y: 3, z: 9 }, target: { x: 0, y: 2, z: 0 }, fov: 46 };
const aspect = 390 / 844;
// Stanzas in reveal beats, verse-line breaths included (content/manifesto-verse.js).
const counts = CONTENT.manifesto.lines.map(stanza => manifestoVerse(stanza).span);
const beats = counts.map((count, i) => i === 0 && CONTENT.manifesto.note ? count : count - 1);
const reading = mobileReadingSchedule(lineSecondsFor(counts), beats);
for (let i = 1; i < counts.length; i++) {
  const previousVisible = reading.reveal[i - 1] + beats[i - 1] * WORD_STAGGER_SECONDS + WORD_VISIBLE_SECONDS;
  assert.ok(reading.admit[i] >= previousVisible, 'prior copy is visibly readable when scroll begins');
  assert.equal(reading.admit[i], Math.max(previousVisible, reading.reveal[i] - 2));
  assert.ok(reading.reveal[i] > reading.admit[i], 'scroll leads incoming copy after the preceding paragraph is readable');
}
assert.deepEqual(reading.reveal, lineSecondsFor(counts), 'original text reveal beats are unchanged');
const inkKeys = readFileSync(new URL('../journey/site.css', import.meta.url), 'utf8').split('@keyframes j-manifesto-ink {')[1];
assert.match(inkKeys, new RegExp(`${Math.round(WORD_VISIBLE_FRACTION * 100)}%\\s*\\{\\s*opacity:\\s*1;`), 'readability clock follows the actual CSS opacity key');
// the reveal actually painted (mycelial.css replaces the keyframes by name)
const liveInk = readFileSync(new URL('../mycelial.css', import.meta.url), 'utf8').split('@keyframes j-manifesto-ink-light {')[1];
assert.match(liveInk, new RegExp(`${Math.round(WORD_VISIBLE_FRACTION * 100)}%\\s*\\{\\s*opacity:\\s*1;`), 'readability clock follows the live CSS opacity key');
assert.equal(reading.seconds, reading.reveal.at(-1) + beats.at(-1) * WORD_STAGGER_SECONDS + WORD_REVEAL_SECONDS,
  'mobile camera endpoint is the last complete word fade');
const end = manifestoPose(from, CAMERA_SECONDS, aspect);
assert.equal(end.position.y, 38);
assert.equal(end.position.x, from.target.x, 'overhead zoom keeps its horizontal position');
assert.equal(end.position.z, from.target.z, 'overhead zoom keeps its horizontal position');
const down = end.position.y - end.target.y;
assert.ok(Math.hypot(end.target.x - end.position.x, end.target.z - end.position.z) / down < 1.1e-5,
  'mobile endpoint looks straight down with a stable heading');
assert.deepEqual(manifestoPose(from, 0, aspect).position, from.position);
for (let t = 2; t < CAMERA_SECONDS; t += 1) {
  assert.ok(manifestoPose(from, t, aspect).position.y > manifestoPose(from, t - 0.5, aspect).position.y,
    `mobile camera continues climbing at ${t}s`);
}
assert.deepEqual(end, manifestoPose(from, CAMERA_SECONDS + 5, aspect));
{
  // A Return is one glide (journey/manifesto/glide.js) from the pose on
  // screen: from any height, on either viewport, it comes down without ever
  // climbing again and lands exactly on the rest.
  const { createGlide, sampleGlide } = await import('../journey/manifesto/glide.js');
  for (const view of [aspect, 1.6]) {
    for (const start of [0.2, 0.6, 1]) {
      const glide = createGlide(manifestoPose(from, start * CAMERA_SECONDS, view), from, view);
      let previous = Infinity;
      for (let k = 0; k <= 1; k += 1 / 64) {
        const y = sampleGlide(glide, k).position.y;
        assert.ok(y <= previous + 1e-9, 'return descends monotonically, including the phone opening lift');
        previous = y;
      }
      const end = sampleGlide(glide, 1).position;
      assert.ok(Math.hypot(end.x - from.position.x, end.y - from.position.y, end.z - from.position.z) < 1e-9, 'the glide lands on the rest');
    }
  }
}
for (let t = 0.5; t < CAMERA_SECONDS; t += 0.5) {
  const lift = manifestoPose(from, t, aspect).position.y - from.position.y - 16;
  assert.ok(ascentAt(t, aspect) >= ascentAt(t - 0.5, aspect), 'mobile navigation rides a monotone ascent');
  if (t >= 3.5) assert.ok(Math.abs(lift - (38 - from.position.y - 16) * ascentAt(t, aspect)) < 1e-9,
    'mobile navigation and camera use the same gradual ascent');
}
assert.ok(ascentAt(10, 1.6) > ascentAt(10, aspect), 'desktop retains its earlier lift');

const bodies = aerialPlacements([], makeRng(0x41e21a), groundY);
const mobilePlan = planAerialReveals(bodies, from, aspect, new Float32Array(bodies.length * 2));
const desktopPlan = planAerialReveals(bodies, from, 1.6, new Float32Array(bodies.length * 2));
const count = plan => bodies.filter((_, i) => plan[i * 2] <= CAMERA_SECONDS).length;
assert.ok(count(mobilePlan) > 30, 'nearby field still has organic detail');
assert.ok(count(mobilePlan) <= 140, 'phone never draws the full aerial field');
assert.equal(count(desktopPlan), bodies.length, 'desktop full field preserved');
console.log(`Mobile manifesto: 38-unit elevation, orbiting overhead heading, full ${reading.seconds.toFixed(2)}s reading motion; ${count(mobilePlan)}/${count(desktopPlan)} scheduled bodies.`);
