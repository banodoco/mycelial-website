/* The owner changed the click arrival: the words and camera land first,
   then the three Inspire embers and markers form in their existing order. */
import assert from 'node:assert/strict';
import { navigationDurationSeconds } from '../journey/navigation-timing.js';
import { blendEase } from '../journey/camera-blend.js';
import { restProgress } from '../journey/route.js';
import { createCopyArrival } from '../journey/ui/copy-arrival.js';
import { HOTSPOT_ARRIVAL } from '../journey/constants/copy.js';
import { connectEntryLightProgress, CONNECT_ENTRY_DURATION_S, CONNECT_LIGHT_LEAD_S } from '../journey/chapters/connect/entry-timing.js';

const STEP = 1 / 120;
const targetP = restProgress('inspire');
const thresholds = [0.10, 0.4375, 0.775];
function fixture() {
  return createCopyArrival({ blocks: {}, actionRows: {}, heroBlock: null,
    rail: { setHeroEase() {} }, reduceMotion: { matches: false } });
}
function ride(source, dur) {
  const copy = fixture();
  const fromP = restProgress(source);
  copy.step({ chapterId: source, dt: 0, travelP: fromP });
  const ticket = { fromP, targetP, phase: 0, elapsed: 0, dur };
  for (let t = 0; t < dur; t += STEP) {
    ticket.elapsed = t; ticket.phase = blendEase(t / dur);
    copy.step({ chapterId: 'inspire', dt: t === 0 ? 0 : STEP,
      travelP: fromP + (targetP - fromP) * ticket.phase, railFlight: ticket });
    assert.equal(copy.ease('inspire'), 0, 'no ember while the camera is flying');
  }
  ticket.elapsed = dur; ticket.phase = 1;
  copy.step({ chapterId: 'inspire', dt: STEP, travelP: targetP, railFlight: ticket });
  assert.equal(copy.ease('inspire'), 0, 'no ember on the final in-flight frame');
  let heading = null;
  const starts = [];
  for (let t = dur; t < dur + 4; t += STEP) {
    copy.step({ chapterId: 'inspire', dt: STEP, travelP: targetP });
    if (heading === null && copy.debug.bands.inspire.eased >= 0.995) heading = t;
    while (starts.length < thresholds.length && copy.ease('inspire') >= thresholds[starts.length]) {
      starts.push(t);
    }
  }
  assert.equal(starts.length, 3, 'all three markers have arrived');
  assert.ok(heading !== null && starts[0] - Math.max(dur, heading) >= 0.30,
    'first ember waits a visible beat after camera and words');
  for (let i = 1; i < starts.length; i++) {
    assert.ok(Math.abs(starts[i] - starts[i - 1] - HOTSPOT_ARRIVAL.beatGapMs / 1000) < 2 * STEP,
      'preserve the three-beat cadence');
  }
  assert.ok(copy.ease('inspire') >= 0.999, 'arrival completes');
  return { source, dur, heading, starts };
}
const dur = navigationDurationSeconds(1.2, 'mission', 'inspire');
const back = navigationDurationSeconds(1.2, 'inspire', 'mission');
assert.equal(dur, back, 'mission<->inspire is symmetric');
assert.ok(dur > 3.2 && dur < 3.5, 'preserve the existing camera arc');
const intro = ride('mission', dur);
const reverse = ride('equip', 1.6);
const placement = fixture();
placement.step({ chapterId: 'inspire', dt: 0, travelP: targetP });
assert.equal(placement.ease('inspire'), 1, 'direct placement stays settled');
// Connect's lead is in wall-clock seconds, not a faster formation envelope.
assert.equal(connectEntryLightProgress(0), 0, 'waiting entry remains dark');
assert.equal(connectEntryLightProgress(1), 1, 'entry settles at the same endpoint');
for (const t of [0.25, 0.9, 1.4, 2.1, 2.5]) {
  const shifted = connectEntryLightProgress(blendEase(t / CONNECT_ENTRY_DURATION_S));
  const expected = blendEase(Math.min(1, (t + CONNECT_LIGHT_LEAD_S) / CONNECT_ENTRY_DURATION_S));
  assert.ok(Math.abs(shifted - expected) < 1e-6, '500 ms lead, existing easing');
}
console.log('Chapter arrival timing: ok', JSON.stringify({ intro, reverse }));
