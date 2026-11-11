// perf-analyze.js — turns <OUT>/<session>.json (from perf-capture.js) into a per-phase table.
// Usage: node perf-analyze.js <path-to-session.json>   -> prints markdown tables + top events.
'use strict';
const fs = require('fs');
const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const pct = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const r1 = v => v == null ? '-' : (Math.round(v * 10) / 10);
const sum = (a, k) => a.reduce((s, x) => s + (x[k] || 0), 0);

// phase windows from marks: phase i = [marks[i].t, marks[i+1].t)
const marks = d.marks.slice().sort((a, b) => a.t - b.t);
const wins = marks.map((m, i) => ({ name: m.name, t0: m.t, t1: i + 1 < marks.length ? marks[i + 1].t : Infinity }));
const inWin = (t, w) => t >= w.t0 && t < w.t1;

const rows = [];
for (const w of wins) {
  const F = d.frames.filter(f => inWin(f.t, w));
  if (!F.length && !d.events.some(e => inWin(e.t, w))) continue;
  const js = F.map(f => f.jsMs), gaps = F.map(f => f.gap).filter(g => g != null);
  const ev = d.events.filter(e => inWin(e.t, w));
  const heap = F.filter(f => f.heap != null);
  const lt = d.longtasks.filter(e => inWin(e.start, w));
  const res = d.resources.filter(e => inWin(e.start, w));
  rows.push({
    phase: w.name, secs: r1((Math.min(w.t1, d.frames.length ? d.frames[d.frames.length - 1].t : w.t1) - w.t0) / 1000),
    frames: F.length, fpsReal: r1(F.length / Math.max(0.001, (w.t1 - w.t0) / 1000)),
    draws_pf_med: r1(pct(F.map(f => f.draws), 0.5)), draws_pf_max: pct(F.map(f => f.draws), 1),
    verts_tot: sum(F, 'verts'), instances_tot: sum(F, 'instances'), vertsWork_tot: sum(F, 'vertsWork'),
    jsMs_med: r1(pct(js, 0.5)), jsMs_p95: r1(pct(js, 0.95)), jsMs_max: r1(pct(js, 1)),
    jsNoGL_med: r1(pct(F.map(f => f.jsMs - f.glSyncMs), 0.5)), jsNoGL_p95: r1(pct(F.map(f => f.jsMs - f.glSyncMs), 0.95)), jsNoGL_max: r1(pct(F.map(f => f.jsMs - f.glSyncMs), 1)),
    gap_med: r1(pct(gaps, 0.5)), gap_p95: r1(pct(gaps, 0.95)), gap_max: r1(pct(gaps, 1)),
    compiles: sum(F, 'compiles'), links: sum(F, 'links'),
    texUploads: sum(F, 'texCalls'), texMB: r1(sum(F, 'texBytes') / 1048576),
    bufUploads: sum(F, 'bufCalls'), bufMB: r1(sum(F, 'bufBytes') / 1048576),
    glSyncMs: r1(sum(F, 'glSyncMs')), readPix: sum(F, 'readPix'), getErr: sum(F, 'getErr'), fbCreate: sum(F, 'fbCreate'),
    longtasks: lt.length, longtaskMaxMs: r1(Math.max(0, ...lt.map(e => e.dur))),
    loaf: d.loaf.filter(e => inWin(e.start, w)).length,
    lateRes: res.length, lateResKB: r1(res.reduce((s, e) => s + (e.transfer || 0), 0) / 1024),
    heapDeltaMB: heap.length > 1 ? r1((heap[heap.length - 1].heap - heap[0].heap) / 1048576) : '-',
    heapMinMB: heap.length ? r1(Math.min(...heap.map(f => f.heap)) / 1048576) : '-',
    heapMaxMB: heap.length ? r1(Math.max(...heap.map(f => f.heap)) / 1048576) : '-',
    dpr: F.length ? F[F.length - 1].pr : '-', canvas: F.length ? `${F[F.length - 1].dbw}x${F[F.length - 1].dbh}` : '-',
  });
}
console.log('## Per-phase table\n');
const cols = Object.keys(rows[0] || {});
console.log('| ' + cols.join(' | ') + ' |'); console.log('|' + cols.map(() => '---').join('|') + '|');
for (const r of rows) console.log('| ' + cols.map(c => r[c]).join(' | ') + ' |');

// Heavy events inside transitions/manifesto (phase != load/settle) with stacks.
console.log('\n## Shader compiles/links, big buffer and texture uploads (>=256 KB or >4 ms), by phase\n');
const heavy = d.events.filter(e => ['compileShader', 'linkProgram', 'bufferData', 'bufferSubData', 'texImage2D', 'texSubImage2D', 'texStorage2D', 'texStorage3D', 'texImage3D', 'compileWait', 'linkWait', 'readPixels'].includes(e.kind));
const byPhase = {};
for (const e of heavy) (byPhase[e.phase] = byPhase[e.phase] || []).push(e);
for (const [ph, list] of Object.entries(byPhase)) {
  const kinds = {}; for (const e of list) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  console.log(`- ${ph}: ${Object.entries(kinds).map(([k, v]) => `${k}x${v}`).join(', ')}`);
}
console.log('\n## Ranked event details (mid-transition/manifesto first; top 60 by ms then bytes)\n');
const interesting = heavy.filter(e => e.phase !== 'load' && e.phase !== 'settle5s' && e.phase !== 'boot');
const rank = interesting.sort((a, b) => (b.ms - a.ms) || (b.bytes - a.bytes)).slice(0, 60);
for (const e of rank) {
  const id = e.kind === 'compileShader' ? `hash=${e.hash} ${e.type} defines=[${(e.defines || []).join(',')}] head="${(e.head || '').replace(/\n/g, '\\n').slice(0, 120)}"`
    : e.kind === 'linkProgram' ? `shaders=${JSON.stringify(e.shaders.map(s => s.hash + (s.defines.length ? ' [' + s.defines.join(',') + ']' : '')))}`
    : e.dims ? `dims=${JSON.stringify(e.dims)} ${e.ifmt ? 'ifmt=0x' + e.ifmt.toString(16) : ''}`
    : e.target !== undefined ? `target=0x${e.target.toString(16)} usage=${e.usage}` : '';
  console.log(`- t=${e.t}ms [${e.phase}] ${e.kind} ms=${e.ms} bytes=${e.bytes} ${id}`);
  if (e.stack) console.log('    stack: ' + e.stack.filter(s => !s.includes('<anonymous>')).slice(0, 8).map(s => s.replace(/\s+/g, ' ')).join(' <- '));
}
console.log('\n## Workers / fetches during transitions (non-load phases)\n');
for (const w of d.workers) console.log(`- Worker ${w.url} at ${w.t}ms [${w.phase}]`);
const fx = d.fetches.filter(f => !['load', 'boot'].includes(f.phase));
console.log(`- fetches after load: ${fx.length}; ${fx.slice(0, 15).map(f => f.url + ' [' + f.phase + ']').join('; ')}`);
console.log('\n## Long animation frames (top 15 by duration)\n');
for (const l of [...d.loaf].sort((a, b) => b.dur - a.dur).slice(0, 15)) console.log(`- ${l.start}ms dur=${l.dur} blocking=${l.blocking} scripts=${JSON.stringify(l.scripts.slice(0, 3))}`);
console.log('\n## Long tasks (top 15)\n');
for (const l of [...d.longtasks].sort((a, b) => b.dur - a.dur).slice(0, 15)) console.log(`- ${l.start}ms dur=${l.dur} attr=${JSON.stringify(l.attr)}`);
console.log('\n## Manifesto draw/vertex growth (phase manifesto-ascent, deciles of frames)\n');
const mf = d.frames.filter(f => wins.find(w => w.name === 'manifesto-ascent' && inWin(f.t, w)));
if (mf.length) {
  const n = mf.length, step = Math.max(1, Math.floor(n / 10));
  for (let i = 0; i < n; i += step) {
    const seg = mf.slice(i, i + step);
    console.log(`- frames ${i}-${i + seg.length - 1}: draws_med=${r1(pct(seg.map(f => f.draws), .5))} verts_med=${r1(pct(seg.map(f => f.verts), .5))} instances_med=${r1(pct(seg.map(f => f.instances), .5))} vertsWork_med=${r1(pct(seg.map(f => f.vertsWork), .5))} jsMs_p95=${r1(pct(seg.map(f => f.jsMs), .95))} cam=${JSON.stringify(seg[seg.length - 1].cam || null)}`);
  }
}
console.log('\n## Phases (decision basis)\n');
for (const p of d.phases || []) console.log(`- ${p.name}: ${(p.wallMs / 1000).toFixed(1)}s, ended by ${p.endedBy}${p.note ? ' (' + p.note + ')' : ''}`);
console.log('\nmeta: ' + JSON.stringify(d.meta));
