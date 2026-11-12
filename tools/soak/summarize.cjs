// NOT shipped: nothing imports it.
// Tabulates one or more mobile-soak.cjs JSON outputs as a markdown table:
//   node tools/soak/summarize.cjs before.json after.json
'use strict';
const fs = require('fs');
const cols = [
  ['heapMB', s => s.heapMB],
  ['glMB', s => s.glMB],
  ['tex', s => s.gl && s.gl.tex], ['buf', s => s.gl && s.gl.buf], ['fb', s => s.gl && s.gl.fb],
  ['rb', s => s.gl && s.gl.rb], ['prog', s => s.gl && s.gl.prog], ['vao', s => s.gl && s.gl.vao],
  ['3geo', s => s.three && s.three.geometries], ['3tex', s => s.three && s.three.textures],
  ['nodes', s => s.domAttached], ['detached', s => s.detached], ['listeners', s => s.listeners],
  ['timeouts', s => s.timeouts], ['intervals', s => s.intervals], ['raf', s => s.raf], ['idleCb', s => s.idle],
  ['observers', s => s.observers && Object.values(s.observers).reduce((a, b) => a + b, 0)],
  ['workers', s => s.workersLive], ['anims', s => s.animations], ['willChange', s => s.willChange],
  ['draws/frame rest', s => s.rest && s.rest.drawsPerRaf],
  ['draws/frame idle', s => s.rest && s.rest.idle && s.rest.idle.rafPerS ? Math.round(s.rest.idle.drawsPerS / s.rest.idle.rafPerS) : ''],
  ['warmWalkMs', s => s.warmWalkMs && s.warmWalkMs.ms],
];
for (const f of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  console.log(`\n### ${f}\n`);
  console.log('| sample | ' + cols.map(c => c[0]).join(' | ') + ' |');
  console.log('|---|' + cols.map(() => '---:').join('|') + '|');
  for (const s of d.samples) {
    if (s.failed) { console.log(`| ${s.label} | FAILED: ${s.failed} |`); continue; }
    console.log(`| ${s.label} | ` + cols.map(c => { const v = c[1](s); return v === undefined || v === null ? '' : v; }).join(' | ') + ' |');
  }
  const ok = d.samples.filter(s => !s.failed && /^loop/.test(s.label));
  if (ok.length >= 3) {
    const a = ok[1], b = ok[ok.length - 1], n = ok.length - 2;
    console.log(`\nper-loop growth, loop2 -> loop${ok.length} (${n} loops): ` + cols.slice(0, 17).map(c => {
      const x = c[1](a), y = c[1](b); return typeof x === 'number' && typeof y === 'number' ? `${c[0]} ${((y - x) / n).toFixed(2)}` : null;
    }).filter(Boolean).join(', '));
  }
  if (d.ctxLoss && d.ctxLoss.length) console.log('\ncontext loss: ' + JSON.stringify(d.ctxLoss));
  if (d.hidden) console.log('hidden: ' + JSON.stringify(d.hidden) + '   menu open: ' + JSON.stringify(d.menu));
  console.log(`errors (${(d.errors || []).length}): ` + (d.errors || []).slice(0, 8).join(' || '));
}
