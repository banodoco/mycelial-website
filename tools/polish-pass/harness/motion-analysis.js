/* motion-analysis.js — derivatives, discontinuity/plateau detection, copy
 * crossing times, CSV + SVG output. Used by motion-capture.js. Pure node. */
const fs = require('fs');
const path = require('path');

const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const angBetween = (a, b) => { const na = Math.hypot(...a), nb = Math.hypot(...b); if (!na || !nb) return 0; return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (na * nb)))); };

// rotation angle between consecutive 3x3 matrices (column-major, 9 values); trace(R1^T R2) = sum of elementwise products
function rotAngle(r1, r2) {
  let tr = 0; for (let i = 0; i < 9; i++) tr += r1[i] * r2[i];
  return Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2)));
}

function crossing(times, vals, level, t0, t1) {
  // first time the series crosses `level` (either direction); times/vals already relative to motion window
  const out = [];
  for (let i = 1; i < vals.length; i++) {
    const a = vals[i - 1], b = vals[i];
    if (Number.isNaN(a) || Number.isNaN(b)) continue;
    if ((a - level) * (b - level) <= 0 && a !== b) {
      const f = (level - a) / (b - a);
      out.push(times[i - 1] + f * (times[i] - times[i - 1]));
    }
  }
  return out;
}

function analyze(name, rows, meta = {}) {
  const n = rows.length;
  const t0 = rows[0].t;
  const T = rows.map((r) => r.t - t0);
  const rel = (i) => T[i];
  // per-sample derivatives, backward difference stamped at the sample
  const dt = new Array(n).fill(NaN), v = new Array(n).fill(NaN), w = new Array(n).fill(NaN), dirDeg = new Array(n).fill(NaN);
  const dispV = new Array(n).fill(null);
  for (let i = 1; i < n; i++) {
    const a = rows[i - 1], b = rows[i];
    const d = (b.t - a.t) / 1000;
    if (!(d > 0)) continue;
    dt[i] = d;
    const disp = [b.x - a.x, b.y - a.y, b.z - a.z];
    dispV[i] = disp;
    v[i] = Math.hypot(...disp) / d;
    w[i] = rotAngle(a.rot, b.rot) / d * 180 / Math.PI;
  }
  for (let i = 2; i < n; i++) {
    if (dispV[i] && dispV[i - 1] && Math.hypot(...dispV[i]) > 0 && Math.hypot(...dispV[i - 1]) > 0)
      dirDeg[i] = angBetween(dispV[i], dispV[i - 1]) * 180 / Math.PI;
  }
  // accel / jerk
  const acc = new Array(n).fill(NaN), jerk = new Array(n).fill(NaN);
  for (let i = 2; i < n; i++) {
    if (Number.isFinite(v[i]) && Number.isFinite(v[i - 1]) && dt[i] > 0) acc[i] = (v[i] - v[i - 1]) / dt[i];
  }
  for (let i = 3; i < n; i++) {
    if (Number.isFinite(acc[i]) && Number.isFinite(acc[i - 1]) && dt[i] > 0) jerk[i] = (acc[i] - acc[i - 1]) / dt[i];
  }

  // motion window
  let peakV = 0, peakVi = -1, peakW = 0, peakWi = -1;
  for (let i = 1; i < n; i++) {
    if (v[i] > peakV) { peakV = v[i]; peakVi = i; }
    if (w[i] > peakW) { peakW = w[i]; peakWi = i; }
  }
  const thrV = Math.max(peakV * 0.01, 1e-9);
  let s0 = -1, s1 = -1;
  for (let i = 1; i < n; i++) if (v[i] > thrV || w[i] > (peakW * 0.01)) { if (s0 < 0) s0 = i; s1 = i; }
  const motionStartMs = s0 >= 0 ? rel(s0 - 1 >= 0 ? s0 - 1 : 0) : NaN;
  const motionEndMs = s1 >= 0 ? rel(s1) : NaN;
  const inWin = (i) => s0 >= 0 && i >= s0 && i <= s1;

  // discontinuities: |dv| step above max(5*median|dv| in window, 10% of peak)
  const dvs = [], dws = [];
  for (let i = s0 + 1; i <= s1; i++) { if (Number.isFinite(v[i]) && Number.isFinite(v[i - 1])) dvs.push(Math.abs(v[i] - v[i - 1])); if (Number.isFinite(w[i]) && Number.isFinite(w[i - 1])) dws.push(Math.abs(w[i] - w[i - 1])); }
  const medDv = median(dvs), medDw = median(dws);
  const thrDv = Math.max(5 * medDv, 0.10 * peakV), thrDw = Math.max(5 * medDw, 0.10 * peakW);
  const discont = [], angDiscont = [];
  for (let i = Math.max(2, s0 + 1); i <= s1; i++) {
    if (!Number.isFinite(v[i]) || !Number.isFinite(v[i - 1])) continue;
    const dv = v[i] - v[i - 1];
    if (Math.abs(dv) > thrDv) discont.push({ frame: rows[i].frame, tMs: +rel(i).toFixed(1), dv: +dv.toFixed(5), dvPctPeak: +(100 * dv / peakV).toFixed(1), from: +(100 * v[i - 1] / peakV).toFixed(1), to: +(100 * v[i] / peakV).toFixed(1) });
    const dw = w[i] - w[i - 1];
    if (Math.abs(dw) > thrDw) angDiscont.push({ frame: rows[i].frame, tMs: +rel(i).toFixed(1), dwDegS: +dw.toFixed(3), dwPctPeak: +(100 * dw / peakW).toFixed(1) });
  }
  // direction reversals while moving
  const reversals = [];
  for (let i = Math.max(2, s0); i <= s1; i++) {
    if (Number.isFinite(dirDeg[i]) && dirDeg[i] > 90 && v[i] > 0.05 * peakV && v[i - 1] > 0.05 * peakV)
      reversals.push({ frame: rows[i].frame, tMs: +rel(i).toFixed(1), turnDeg: +dirDeg[i].toFixed(1) });
  }
  // plateaus: runs of >=6 frames below 2% of peak speed inside the window
  const plateaus = [];
  for (let i = Math.max(1, s0); i <= s1;) {
    if (v[i] < 0.02 * peakV) {
      let j = i; while (j + 1 <= s1 && v[j + 1] < 0.02 * peakV) j++;
      if (j - i + 1 >= 6) plateaus.push({ startMs: +rel(i).toFixed(1), durMs: +(rel(j) - rel(i)).toFixed(1), frames: j - i + 1, maxSpeedPctPeak: +(100 * Math.max(...v.slice(i, j + 1)) / peakV).toFixed(2) });
      i = j + 1;
    } else i++;
  }
  // copy crossings relative to motion start and end
  const cross = {};
  const seriesIds = Object.keys(rows[0].copy || {});
  const seriesFor = (id) => rows.map((r) => (id === 'manifesto' ? r.manifestoOp : (r.copy[id] ? r.copy[id][0] : NaN)));
  const ids = [meta.from, meta.to].map((x) => (x === 'manifesto-open' ? 'manifesto' : x === 'manifesto-close' ? 'manifesto' : x)).filter((x, i, a) => a.indexOf(x) === i);
  const winStart = motionStartMs, winEnd = motionEndMs;
  for (const id of ids) {
    const key = id === 'manifesto' ? 'manifesto' : id;
    const ser = seriesFor(key);
    if (ser.every((x) => Number.isNaN(x))) { cross[key] = 'NO BLOCK FOUND'; continue; }
    const tt = T, vv = ser;
    const ent = {};
    for (const lvl of [0.1, 0.5, 0.9]) {
      const xs = crossing(tt, vv, lvl);
      ent[`x${Math.round(lvl * 100)}`] = xs.map((x) => ({ tMs: +x.toFixed(1), relStartMs: +(x - winStart).toFixed(1), relEndMs: +(x - winEnd).toFixed(1) }));
    }
    cross[key] = ent;
  }
  // summary
  const sumPlat = plateaus.map((p) => `${p.startMs}ms+${p.durMs}ms`);
  const summary = {
    name, frames: n - 1, sampleStepsMs: [...new Set(T.slice(1).map((t, i) => +(t - T[i]).toFixed(2)))].slice(0, 6),
    motionStartMs: +winStart.toFixed(1), motionEndMs: +winEnd.toFixed(1),
    durationMs: +(winEnd - winStart).toFixed(1),
    peakSpeedUnitsS: +peakV.toFixed(5), peakSpeedAtMs: peakVi > 0 ? +rel(peakVi).toFixed(1) : NaN,
    peakAngDegS: +peakW.toFixed(3), peakAngAtMs: peakWi > 0 ? +rel(peakWi).toFixed(1) : NaN,
    discontinuityThrUnitsS: +thrDv.toFixed(5),
    discontinuities: discont, angDiscontinuities: angDiscont,
    reversals, plateaus: sumPlat,
    copyCross: cross,
    medianAbsDv: +medDv.toFixed(6), medianAbsDw: +medDw.toFixed(4),
    maxAbsAccel: +Math.max(...acc.map((x) => Math.abs(x)).filter(Number.isFinite), 0).toFixed(4),
    maxAbsJerk: +Math.max(...jerk.map((x) => Math.abs(x)).filter(Number.isFinite), 0).toFixed(3),
    pRange: [+Math.min(...rows.map((r) => r.p)).toFixed(5), +Math.max(...rows.map((r) => r.p)).toFixed(5)],
  };
  return { summary, series: { T, v, w, acc, jerk, dirDeg, dt }, rows, meta, name };
}

function writeOutputs(outDir, name, rows, result, cfg = {}) {
  const { series: S, summary } = result;
  const t0 = rows[0].t;
  const copyIds = Object.keys(rows[0].copy || {});
  const head = ['frame', 'action', 't_ms', 'rel_ms', 'dt_s', 'raf_fires', 'raf_ts_ms', 'p', 'travel', 'cam_x', 'cam_y', 'cam_z', 'fwd_x', 'fwd_y', 'fwd_z', 'up_x', 'up_y', 'up_z', 'fov',
    'speed_u_s', 'ang_deg_s', 'accel_u_s2', 'jerk_u_s3', 'dir_change_deg', ...copyIds.map((c) => `copy_${c}_block`), ...copyIds.map((c) => `copy_${c}_heading`), ...copyIds.map((c) => `copy_${c}_sub`), 'manifesto_op'];
  const f = (x, d = 6) => (Number.isFinite(x) ? +x.toFixed(d) : '');
  const lines = [head.join(',')];
  rows.forEach((r, i) => {
    const fires = i > 0 ? r.rafN - rows[i - 1].rafN : '';
    const row = [r.frame, r.action, +(r.t - t0).toFixed(3), +(r.t - t0).toFixed(3), f(S.dt[i], 6), fires, f(r.rafTs, 2), f(r.p, 6), f(r.travel, 6), f(r.x), f(r.y), f(r.z),
      f(r.fwd[0]), f(r.fwd[1]), f(r.fwd[2]), f(r.up[0]), f(r.up[1]), f(r.up[2]), f(r.fov, 3),
      f(S.v[i], 5), f(S.w[i], 3), f(S.acc[i], 4), f(S.jerk[i], 3), f(S.dirDeg[i], 2),
      ...copyIds.map((c) => f(r.copy[c][0], 4)), ...copyIds.map((c) => f(r.copy[c][1], 4)), ...copyIds.map((c) => f(r.copy[c][2], 4)), f(r.manifestoOp, 4)];
    lines.push(row.join(','));
  });
  fs.writeFileSync(path.join(outDir, `${name}.csv`), lines.join('\n') + '\n');
  fs.writeFileSync(path.join(outDir, `${name}.summary.json`), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(outDir, `${name}.svg`), chartSvg(name, rows, result, copyIds));
}

function chartSvg(name, rows, result, copyIds) {
  const { series: S, summary, meta } = result;
  const W = 960, PH = 150, GAP = 34, L = 70, R = 20;
  const panels = 3, H = panels * PH + (panels + 1) * GAP + 40;
  const T = S.T;
  const tMax = Math.max(...T, 1);
  const xOf = (t) => L + (W - L - R) * (t / tMax);
  const polyFor = (vals, yMax, yMin, top) => {
    const pts = [];
    vals.forEach((y, i) => { if (Number.isFinite(y)) pts.push(`${xOf(T[i]).toFixed(1)},${(top + PH - (PH * (y - yMin) / (yMax - yMin || 1))).toFixed(1)}`); });
    return pts.join(' ');
  };
  const axis = (top, yMin, yMax, label, color) => {
    let s = `<rect x="${L}" y="${top}" width="${W - L - R}" height="${PH}" fill="none" stroke="#999"/>`;
    s += `<text x="${L - 8}" y="${top + 12}" font-size="11" text-anchor="end">${yMax.toFixed(2)}</text>`;
    s += `<text x="${L - 8}" y="${top + PH}" font-size="11" text-anchor="end">${yMin.toFixed(2)}</text>`;
    s += `<text x="${L + 6}" y="${top + 14}" font-size="12" fill="${color}">${label}</text>`;
    return s;
  };
  const vLines = (top) => {
    let s = '';
    const mk = (t, c, lab) => { if (!Number.isFinite(t)) return ''; return `<line x1="${xOf(t)}" x2="${xOf(t)}" y1="${top}" y2="${top + PH}" stroke="${c}" stroke-dasharray="4 3"/><text x="${xOf(t) + 3}" y="${top + PH - 4}" font-size="10" fill="${c}">${lab}</text>`; };
    s += mk(summary.motionStartMs, '#2a7', 'start');
    s += mk(summary.motionEndMs, '#2a7', 'end');
    s += mk(summary.peakSpeedAtMs, '#c33', 'peak v');
    return s;
  };
  const dMarks = (top) => summary.discontinuities.map((d) => `<circle cx="${xOf(d.tMs)}" cy="${top + 6}" r="3.5" fill="#d0a000"/>`).join('');
  const rMarks = (top) => summary.reversals.map((d) => `<circle cx="${xOf(d.tMs)}" cy="${top + 14}" r="3.5" fill="#c33"/>`).join('');
  let body = '';
  // panel 1 speed
  let top = GAP;
  const vMax = Math.max(summary.peakSpeedUnitsS, 1e-9);
  body += axis(top, 0, vMax, 'speed (units/s)', '#1f5fbf');
  body += `<polyline fill="none" stroke="#1f5fbf" stroke-width="1.6" points="${polyFor(S.v, vMax, 0, top)}"/>`;
  body += vLines(top) + dMarks(top) + rMarks(top);
  // panel 2 angular speed
  top += PH + GAP;
  const wMax = Math.max(summary.peakAngDegS, 1e-9);
  body += axis(top, 0, wMax, 'angular speed (deg/s)', '#7a3fbf');
  body += `<polyline fill="none" stroke="#7a3fbf" stroke-width="1.6" points="${polyFor(S.w, wMax, 0, top)}"/>`;
  body += vLines(top);
  // panel 3 copy opacity
  top += PH + GAP;
  body += axis(top, 0, 1, 'copy opacity (heading)', '#2a7a2a');
  const palette = ['#2a7a2a', '#c07000', '#b03060', '#555'];
  const idsShown = [...new Set([meta.from, meta.to].map((x) => (x && x.startsWith('manifesto') ? 'manifesto' : x)))];
  idsShown.forEach((id, k) => {
    const ser = id === 'manifesto' ? rows.map((r) => r.manifestoOp) : rows.map((r) => (r.copy[id] ? r.copy[id][1] : NaN));
    body += `<polyline fill="none" stroke="${palette[k % 4]}" stroke-width="1.6" points="${polyFor(ser, 1, 0, top)}"/>`;
    body += `<text x="${L + 6 + 170 * k}" y="${top + 28}" font-size="11" fill="${palette[k % 4]}">${id} heading</text>`;
  });
  // x axis
  const ax = top + PH + 16;
  body += `<text x="${L}" y="${ax + 6}" font-size="11">0 ms</text><text x="${W - R}" y="${ax + 6}" font-size="11" text-anchor="end">${tMax.toFixed(0)} ms (rel. to action)</text>`;
  const title = `<text x="${L}" y="20" font-size="14" font-weight="bold">${name} (${cfgLabel(meta)}) · duration ${summary.durationMs} ms · peak speed ${summary.peakSpeedUnitsS} u/s at ${summary.peakSpeedAtMs} ms · discontinuities ${summary.discontinuities.length} · reversals ${summary.reversals.length} · plateaus ${summary.plateaus.length}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif" background="#fff"><rect width="${W}" height="${H}" fill="#fff"/>${title}${body}</svg>\n`;
}
function cfgLabel(meta) { return ''; }

module.exports = { analyze, writeOutputs };
