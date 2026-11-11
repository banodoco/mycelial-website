#!/usr/bin/env node
/* Oracle: a route-faithful RETURN (Inspire -> Intro) must ride one eased arc
 * to rest. The camera's pace table is floor-free, so the path length it has
 * covered at blend phase f is exactly blendEase(f) * pathLen — it reaches the
 * end at f = 1, with the ease's own zero velocity. The floored table (which
 * paces the published presentedP) appends fake length at the stationary end;
 * the camera used to ride it and hard-stopped ~0.5 s early. */
import assert from 'node:assert/strict';
import { routePaceP, blendEase } from '../journey/camera-blend.js';

const N = 256, pathLen = 24, floor = 0.15 * pathLen / N;
// raw metric of a return leg: cruise, then a vanishing tail, then a flat hero end
const raw = new Float64Array(N + 1);
for (let i = 1; i <= N; i++) {
  const x = i / N;                          // 0 = Inspire rest, 1 = hero end
  const step = x > 0.8 ? Math.max(0, 1 - (x - 0.8) / 0.12) : 1;
  raw[i] = raw[i - 1] + step;
}
const scale = pathLen / raw[N];
for (let i = 0; i <= N; i++) raw[i] *= scale;
const cum = Float64Array.from(raw);
let total = 0, prev = 0;
for (let i = 1; i <= N; i++) { total += Math.max(cum[i] - prev, floor); prev = cum[i]; cum[i] = total; }
assert.ok(total > pathLen * 1.01, 'fixture must carry floor length');
const blend = { routeFromP: 0.2, routeTargetP: 0, routePace: { cum, total, pathLen, camCum: raw, camTotal: pathLen } };

const lengthAt = (p) => {                    // raw path length covered at coordinate p
  const f = (p - blend.routeFromP) / (blend.routeTargetP - blend.routeFromP) * N;
  const lo = Math.min(Math.floor(f), N - 1);
  return raw[lo] + (raw[lo + 1] - raw[lo]) * (f - lo);
};
for (const f of [0.1, 0.3, 0.5, 0.7, 0.85, 0.95, 0.99]) {
  const e = blendEase(f);
  const covered = lengthAt(routePaceP(blend, e, true)) / pathLen;
  assert.ok(Math.abs(covered - e) < 2e-3, `camera path fraction ${covered} != eased phase ${e} at f=${f}`);
}
assert.equal(routePaceP(blend, blendEase(1), true), blend.routeTargetP);
assert.equal(routePaceP(blend, blendEase(1)), blend.routeTargetP);
// the published coordinate still spends the floor, so the two tables differ
assert.notEqual(routePaceP(blend, 0.97), routePaceP(blend, 0.97, true));
console.log('return pace: camera rides the raw path metric, reaches rest at f = 1');
