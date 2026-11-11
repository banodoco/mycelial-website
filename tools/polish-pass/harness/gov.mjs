import assert from 'node:assert/strict';
const { createAdaptiveResolution } = await import('/home/user/wt/perf/organism/performance.js');
let pr = 2, syncs = 0, flying = true;
const f = createAdaptiveResolution({ renderer: { getPixelRatio: () => pr, setPixelRatio: (v) => { pr = v; } },
  policy: { stored: 2, remember() {} }, syncSizes: () => syncs++, calibrateAt: 1, canStep: () => !flying });
let t = 0; for (let i = 0; i < 200; i++) f(t += 0.05, 0.05);
assert.equal(pr, 2, 'held mid-flight'); flying = false; f(t += 0.05, 0.05);
assert.equal(pr, 1.75); assert.equal(syncs, 1); console.log('governor hold ok');
