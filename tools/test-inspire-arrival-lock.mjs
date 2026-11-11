/* Intro -> Inspire: the arrival is locked to the camera's flight. Bounds how far
   the heading, the three embers and the chips may run PAST touchdown, and that
   they do not begin before the camera is mostly there. Pure math: the same
   duration table, quintic and gate the shipped code spends. */
import assert from 'node:assert/strict';
import { navigationDurationSeconds } from '../journey/navigation-timing.js';
import { blendEase } from '../journey/camera-blend.js';
import { navCopyArrival, introInspireGate, ARRIVE_WITH_CAMERA_LEAD_S } from '../journey/ui/bands.js';
import { HOTSPOT_ARRIVAL } from '../journey/constants/copy.js';

const dur = navigationDurationSeconds(1.2, 'mission', 'inspire');
const back = navigationDurationSeconds(1.2, 'inspire', 'mission');
assert.equal(dur, back, 'mission<->inspire is symmetric');
assert.ok(dur > 3.2 && dur < 3.5, `one slow arc, got ${dur}`);
const quintic = (f) => blendEase(f);
assert.ok(Math.abs(quintic(0.5) - 0.5) < 1e-12 && quintic(1) === 1);

const STEP = 0.001;
const firstAt = (pred, tMax = dur + 3) => { for (let t = 0; t <= tMax; t += STEP) if (pred(t)) return t; return Infinity; };
const gateAt = (t) => introInspireGate(Math.min(1, t / dur));
// Inspire's ember thresholds (chapters/inspire/index.js LAND_ON / STEP / RISE)
const ON = [0.10, 0.10 + 0.3375, 0.10 + 2 * 0.3375], RISE = 0.1575;
const embersStart = ON.map((th) => firstAt((t) => gateAt(t) >= th));
const emberDone = firstAt((t) => gateAt(t) >= ON[2] + RISE);
const heading = firstAt((t) => navCopyArrival(t, dur, ARRIVE_WITH_CAMERA_LEAD_S) >= 0.995);
// chips: beat armed when each ember opens, floored by beatGapMs, formed over formMs
let prev = -Infinity, chipDone = 0;
for (const s of embersStart) { const at = Math.max(s, prev + HOTSPOT_ARRIVAL.beatGapMs / 1000); prev = at; chipDone = at + HOTSPOT_ARRIVAL.formMs / 1000; }

assert.ok(Math.abs(heading - dur) <= 0.1, `heading full within 100 ms of touchdown: ${heading - dur}`);
assert.ok(embersStart[0] > 0.5 * dur, 'embers wait until the camera is past half-way');
assert.ok(emberDone - dur <= 0.25, `last ember lit within 250 ms of touchdown: ${emberDone - dur}`);
assert.ok(chipDone - dur <= 0.35, `chips settled within 350 ms of touchdown: ${chipDone - dur}`);
assert.ok(gateAt(dur) === 1 && gateAt(0) === 0, 'gate is whole at both ends');
console.log('Inspire arrival lock: ok', JSON.stringify({ dur, heading, embersStart, emberDone, chipDone }));
