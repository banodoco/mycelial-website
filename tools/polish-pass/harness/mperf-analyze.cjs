// node mperf-analyze.cjs <json>...  — colony-attributable uploads & draws
const fs = require('fs');
for (const p of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(p));
  const fr = d.frames.filter(f => f.phase === 'ascent');
  const ups = d.ups.filter(u => u.phase === 'ascent');
  // per-frame streams present at every rest frame too (hero spores etc.)
  const restUps = d.ups.filter(u => u.phase === 'rest' || u.phase === 'boot');
  const stream = new Set(['bufferSubData 50400', 'bufferSubData 16800', 'bufferSubData 10908']);
  const other = ups.filter(u => !stream.has(`${u.kind} ${u.bytes}`));
  const by = {}; for (const u of other) { const k = `${u.kind} ${u.bytes}`; by[k] = (by[k] || 0) + 1; }
  const big = other.filter(u => u.bytes >= 100000).map(u => `f${u.f} ${u.kind} ${u.bytes}`);
  const y0 = fr[0]?.y, y1 = Math.max(...fr.map(f => f.y));
  const atY = q => { const want = y0 + (y1 - y0) * q; return fr.reduce((b, f) => !b || Math.abs(f.y - want) < Math.abs(b.y - want) ? f : b, null); };
  const pre = d.ups.filter(u => u.phase === 'prewarm');
  console.log(p.split('/').pop(), `frames=${fr.length} y ${y0}->${y1}`);
  console.log('  non-stream uploads ascent: n=' + other.length + ' bytes=' + other.reduce((s, u) => s + u.bytes, 0), 'big(>=100KB):', JSON.stringify(big));
  console.log('  prewarm uploads: n=' + pre.length + ' bytes=' + pre.reduce((s, u) => s + u.bytes, 0));
  console.log('  first 20 frames non-stream bytes=' + other.filter(u => u.f - (d.frames.length - fr.length) < 20).reduce((s,u)=>s+u.bytes,0));
  for (const q of [0, 0.5, 1]) { const f = atY(q); console.log(`  height ${q}: y=${f.y} draws=${f.draws} verts=${f.verts} vertsXinst=${f.work}`); }
}
