// perf-summary.js — compact per-phase markdown table from a perf-capture JSON. Usage: node perf-summary.js <json>
'use strict';
const d = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
const pct = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const f1 = v => Number.isFinite(v) ? (Math.round(v * 10) / 10) : '-';
const sum = (a, k) => a.reduce((s, x) => s + (x[k] || 0), 0);
const marks = d.marks.slice().sort((a, b) => a.t - b.t);
const out = ['| phase | wall s | rAF frames | draws/frame med (max) | verts Σcount (M) | vertsWork Σcount×inst (M) | JS ms/frame excl. GL: med / p95 / max | frame gap s med | compiles | links | tex uploads (n, MB) | buf uploads (n, MB) | GL-sync s | longtask max s | heap Δ MB |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
marks.forEach((m, i) => {
  const t1 = i + 1 < marks.length ? marks[i + 1].t : Infinity;
  const F = d.frames.filter(f => f.t >= m.t && f.t < t1);
  const ev = d.events.filter(e => e.t >= m.t && e.t < t1);
  const lt = d.longtasks.filter(e => e.start >= m.t && e.start < t1);
  const heap = F.filter(f => f.heap != null);
  const jsx = F.map(f => f.jsMs - f.glSyncMs);
  const wall = (Math.min(t1, F.length ? F[F.length - 1].t : t1) - m.t) / 1000;
  out.push(`| ${m.name} | ${f1(wall)} | ${F.length} | ${f1(pct(F.map(f => f.draws), .5))} (${f1(pct(F.map(f => f.draws), 1))}) | ${f1(sum(F, 'verts') / 1e6)} | ${f1(sum(F, 'vertsWork') / 1e6)} | ${f1(pct(jsx, .5))} / ${f1(pct(jsx, .95))} / ${f1(pct(jsx, 1))} | ${f1(pct(F.map(f => f.gap).filter(g => g != null), .5) / 1000)} | ${sum(F, 'compiles') + ev.filter(e => e.kind === 'compileShader').length * 0} | ${sum(F, 'links')} | ${sum(F, 'texCalls')}, ${f1(sum(F, 'texBytes') / 1048576)} | ${sum(F, 'bufCalls')}, ${f1(sum(F, 'bufBytes') / 1048576)} | ${f1(sum(F, 'glSyncMs') / 1000)} | ${f1(Math.max(0, ...lt.map(e => e.dur)) / 1000)} | ${heap.length > 1 ? f1((heap[heap.length - 1].heap - heap[0].heap) / 1048576) : '-'} |`);
});
console.log(out.join('\n'));
