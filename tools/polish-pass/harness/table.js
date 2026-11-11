// Builds a compact markdown table from the per-transition summaries.
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.summary.json')).sort();
const r1 = (x) => (x === undefined || x === null || Number.isNaN(x) ? 'n/a' : (+x).toFixed(1));
const lines = ['| transition | dur ms | peak v (u/s) @ms | peak w (deg/s) @ms | disc. frames (dv, % peak) | ang. disc. | reversals | plateaus | copy block 10/50/90 (rel. start ms) |', '|---|---|---|---|---|---|---|---|---|'];
for (const f of files) {
  const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const disc = s.discontinuities.map((d) => `f${d.frame}@${d.tMs}:${d.dvPctPeak > 0 ? '+' : ''}${d.dvPctPeak}%`).join(' ') || 'none';
  const cc = Object.entries(s.copyCross).filter(([k]) => k !== 'mission').map(([k, v]) => (typeof v === 'string' ? `${k}: ${v}` : `${k}: ${['x10', 'x50', 'x90'].map((q) => (v[q] && v[q][0] ? r1(v[q][0].relStartMs) : 'none')).join('/')}`)).join('; ');
  lines.push(`| ${s.name} | ${r1(s.durationMs)} | ${r1(s.peakSpeedUnitsS)} @${r1(s.peakSpeedAtMs)} | ${r1(s.peakAngDegS)} @${r1(s.peakAngAtMs)} | ${disc} | ${s.angDiscontinuities.length} | ${s.reversals.length} | ${s.plateaus.map((p) => `${p.startMs}+${p.durMs}`).join(', ') || 'none'} | ${cc} |`);
}
console.log(lines.join('\n'));
