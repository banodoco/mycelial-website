#!/usr/bin/env node
/* tools/test-pixel-ratio-cap.mjs — organism/performance.js initialPixelRatio,
 * the ratio a display starts at. Pure: inputs -> pixel ratio.
 *
 *   P1  a desktop (fine pointer) Retina display starts at DESKTOP_MAX_PR,
 *       not at 2 — the owner's 1462x727 window is 2.39 MP of backing store
 *       instead of 4.25 MP
 *   P2  a phone (coarse pointer) keeps 2, and a 3x phone is still capped at 2
 *   P3  a 1x display is untouched: the golden stills (tools/capture.py, DPR 1
 *       at 1440x900 and 430x932) render at exactly the ratio they always did
 *   P4  `?pr=` pins any ratio, above or below the ceiling
 *   P5  a remembered governor verdict below the ceiling wins; one above it
 *       (stored before the ceiling existed) is held to the ceiling
 */
import assert from 'node:assert/strict';
import { initialPixelRatio, DESKTOP_MAX_PR, TOUCH_MAX_PR } from '../organism/performance.js';

const pr = (o) => initialPixelRatio({ pinPr: null, stored: null, dpr: 1, coarse: false, ...o });

assert.equal(DESKTOP_MAX_PR, 1.5);
assert.equal(TOUCH_MAX_PR, 2);
// P1
assert.equal(pr({ dpr: 2 }), 1.5, 'P1: Retina desktop starts at 1.5');
const mp = (w, h, r) => (w * r) * (h * r) / 1e6;
assert.ok(mp(1462, 727, pr({ dpr: 2 })) < 2.4, 'P1: the owner\'s window is under 2.4 MP');
assert.equal(pr({ dpr: 1.25 }), 1.25, 'P1: a 1.25x laptop keeps its own ratio');
// P2
assert.equal(pr({ dpr: 2, coarse: true }), 2, 'P2: a 2x phone keeps 2');
assert.equal(pr({ dpr: 3, coarse: true }), 2, 'P2: a 3x phone is capped at 2, as before');
// P3
assert.equal(pr({ dpr: 1 }), 1, 'P3: capture (DPR 1, desktop size) is unchanged');
assert.equal(pr({ dpr: 1, coarse: true }), 1, 'P3: capture (DPR 1, phone size) is unchanged');
// P4
assert.equal(pr({ dpr: 2, pinPr: 2 }), 2, 'P4: ?pr=2 holds full Retina');
assert.equal(pr({ dpr: 1, pinPr: 3 }), 3, 'P4: ?pr= pins above the screen');
assert.equal(pr({ dpr: 2, pinPr: 0.5 }), 0.5, 'P4: and below');
// P5
assert.equal(pr({ dpr: 2, stored: 1.25 }), 1.25, 'P5: a stepped-down verdict is kept');
assert.equal(pr({ dpr: 2, stored: 2 }), 1.5, 'P5: an old full-Retina verdict is held to the ceiling');
assert.equal(pr({ dpr: 2, stored: 1.75, coarse: true }), 1.75, 'P5: phones keep their verdicts');

console.log('pixel ratio cap: P1-P5 passed');
