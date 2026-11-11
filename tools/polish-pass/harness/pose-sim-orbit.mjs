// Usage: node pose-sim.mjs <path-to-pose.js> [m4|m5|m6|all]
// Pure-function sims of the manifesto camera, 60 Hz steps (IMPL-pose).
const P = await import(process.argv[2]);
const mode = process.argv[3] || 'all';
const { manifestoPose, descentU, returnSecondsFrom, CAMERA_SECONDS: T, lineSecondsFor, WORD_STAGGER_SECONDS, WORD_VISIBLE_SECONDS } = P;
const { CONTENT } = await import(new URL('../../content/content.js', new URL('file://' + process.argv[2])).href);
const desk = { position:{x:-14.72,y:2.73,z:2.70}, target:{x:-3.06,y:0.83,z:-1.94}, fov:45.5, roll:0 };
const mob = { position:{x:-15.4864,y:5.2453,z:3.4893}, target:{x:-3.023,y:1.3933,z:-1.8471}, fov:53.5004, roll:-5*Math.PI/180, fieldCenter:{x:.251658,z:-1.823989} };
const dir = p => { const d=[p.target.x-p.position.x,p.target.y-p.position.y,p.target.z-p.position.z]; const n=Math.hypot(...d); return d.map(v=>v/n); };
const f2 = v => v.toFixed(1);

if (mode === 'm5' || mode === 'all') {
  const counts = CONTENT.manifesto.lines.map(l => l.trim().split(/\s+/).length);
  const starts = lineSecondsFor(counts);
  const beats = counts.map((c, i) => i === 0 && CONTENT.manifesto.note ? c : c - 1);
  const gaps = starts.slice(1).map((s, i) => s - (starts[i] + beats[i]*WORD_STAGGER_SECONDS + WORD_VISIBLE_SECONDS));
  console.log(`M5 T=${T.toFixed(2)} starts=${starts.join('/')} gaps=${gaps.map(g=>g.toFixed(2)).join('/')}`);
  // final-hold landing: desktop/phone camera speed across the last 3 s
  for (const [nm, from, a] of [['desk', desk, 1.6], ['mob', mob, 390/844]]) {
    const row = [];
    for (const back of [3, 2, 1, 0.5, 0.1]) {
      const s = T - back, p0 = manifestoPose(from, s - 1/60, a), p1 = manifestoPose(from, s, a);
      row.push(`T-${back}:${(Math.hypot(p1.position.x-p0.position.x,p1.position.y-p0.position.y,p1.position.z-p0.position.z)*60).toFixed(2)}u/s`);
    }
    console.log(`  hold ${nm}: ${row.join(' ')}`);
  }
}

if (mode === 'm4' || mode === 'all') {
  for (const [nm, from, a] of [['desk', desk, 1.6], ['mob', mob, 390/844]]) for (const start of [0.1, 0.36, 0.5, 0.75, 1]) {
    const dur = returnSecondsFrom(start); let k = 0, prev = manifestoPose(from, start*T, a), pv = null, rows = [];
    for (let f = 1; ; f++) {
      k = Math.min(1, k + 1/dur/60); const u = descentU(start, k, a, from.position.y); const pose = manifestoPose(from, u*T, a);
      const v = ['x','y','z'].map(c => (pose.position[c]-prev.position[c])*60);
      const speed = Math.hypot(...v);
      const acc = pv ? Math.hypot(...v.map((c,i)=>(c-pv[i])*60)) : 0;
      const d0 = dir(prev), d1 = dir(pose);
      const ang = Math.acos(Math.min(1, d0[0]*d1[0]+d0[1]*d1[1]+d0[2]*d1[2]))*180/Math.PI*60;
      rows.push({ t: f/60, speed, acc, ang, fov: pose.fov }); prev = pose; pv = v; if (u <= 0) break;
    }
    const last = rows[rows.length-1]; const exact = JSON.stringify(prev.position) === JSON.stringify(from.position);
    const pk = rows.reduce((m,r)=>r.speed>m.speed?r:m), pa = rows.slice(1).reduce((m,r)=>r.acc>m.acc?r:m), pg = rows.reduce((m,r)=>r.ang>m.ang?r:m);
    // end-second: speed and pitch rate every 0.1 s; re-acceleration count in last 1 s
    const tail = rows.filter(r => r.t > last.t - 1.0001);
    let reacc = 0; for (let i = 1; i < tail.length; i++) if (tail[i].speed > tail[i-1].speed + 1e-6) reacc++;
    let angUp = 0; for (let i = 1; i < tail.length; i++) if (tail[i].ang > tail[i-1].ang + 1e-6) angUp++;
    const prof = tail.filter((_, i) => i % 6 === 0).map(r => `${f2(r.speed)}/${f2(r.ang)}`).join(' ');
    console.log(`M4 ${nm} u=${start} dur=${dur.toFixed(2)} peakV=${f2(pk.speed)}@${pk.t.toFixed(2)} peakA=${pa.acc.toFixed(0)}@${pa.t.toFixed(2)} peakAng=${f2(pg.ang)}deg/s@${pg.t.toFixed(2)} exact=${exact} lastSec reaccFrames=${reacc} angRiseFrames=${angUp} | end-1s v/ang(deg/s) per 0.1s: ${prof}`);
  }
}

if (mode === 'm6' || mode === 'all') {
  const W = 390, H = 844, A = W/H;
  const pts = []; for (let i=-6;i<=6;i++) for (let j=-6;j<=6;j++) pts.push({ x:i*3, y:0.3, z:-1.8+j*3 });
  // screen basis from the pose with the up vector three.js lookAt would use, except near vertical
  // where screen-up follows the heading (matches the stable residual heading).
  const basis = pose => { const p=pose.position,q=pose.target; let fx=q.x-p.x,fy=q.y-p.y,fz=q.z-p.z; const n=Math.hypot(fx,fy,fz); fx/=n;fy/=n;fz/=n;
    const h=Math.hypot(fx,fz); const hx=fx/h, hz=fz/h; let ux=hx-fx*(hx*fx+hz*fz), uy=-fy*(hx*fx+hz*fz), uz=hz-fz*(hx*fx+hz*fz);
    if (fy > -0.999) { ux=-fy*hx; uy=h; uz=-fy*hz; }
    const un=Math.hypot(ux,uy,uz); ux/=un;uy/=un;uz/=un;
    return { fx,fy,fz,ux,uy,uz, rx:fy*uz-fz*uy, ry:fz*ux-fx*uz, rz:fx*uy-fy*ux }; };
  const proj = (pose,b,pt) => { const p=pose.position; const x=pt.x-p.x,y=pt.y-p.y,z=pt.z-p.z; const d=x*b.fx+y*b.fy+z*b.fz; const t=Math.tan(pose.fov*Math.PI/360);
    return { nx:(x*b.rx+y*b.ry+z*b.rz)/(d*t*A), ny:(x*b.ux+y*b.uy+z*b.uz)/(d*t), d }; };
  const sample = s => { const pose = manifestoPose(mob, s, A), b = basis(pose); const dt = 1/60;
    const p2 = manifestoPose(mob, Math.max(0, s-dt), A), b2 = basis(p2); let mv=0,c=0;
    if (s > 0) for (const pt of pts) { const a=proj(p2,b2,pt), q=proj(pose,b,pt); if (a.d>0&&q.d>0&&Math.abs(q.nx)<1&&Math.abs(q.ny)<1) { mv+=Math.hypot((q.nx-a.nx)*W/2,(q.ny-a.ny)*H/2); c++; } }
    const hq = proj(pose, b, { x:0, y:3, z:0 });
    return { pose, px: c ? mv/c/dt : 0, heroPxU: H/2/(hq.d*Math.tan(pose.fov*Math.PI/360)) }; };
  const out = [];
  for (const s of [0.25, 0.5, 1, 2, 3, 5, 8, 15, 25, T-1]) { const r = sample(s); out.push(`${s.toFixed(2)}:${f2(r.px)}px/s,${f2(r.heroPxU)}px/u`); }
  console.log(`M6 series: ${out.join(' ')}`);
  if (process.env.FINE) { const fine = []; for (let s = 0.25; s <= 9; s += 0.25) { const r = sample(s); fine.push(`${s}:${r.px.toFixed(0)}/${r.heroPxU.toFixed(1)}`); } console.log(`M6 fine px/s / px/u: ${fine.join(' ')}`); }
  let h0 = sample(0).heroPxU, hmax = h0, minPx = Infinity, minAt = 0, maxZoomInAfter = 0, prevH = h0, zoomRates = [];
  let prevV = null, maxDV = 0, maxDVAt = 0;
  for (let f = 1; f <= Math.round(T*60); f++) { const s = f/60, r = sample(s);
    hmax = Math.max(hmax, r.heroPxU);
    if (s >= 0.5 && s <= T-2 && r.px < minPx) { minPx = r.px; minAt = s; }
    if (s > 1.5 && r.heroPxU > prevH + 1e-9) maxZoomInAfter = Math.max(maxZoomInAfter, s);
    if (f % 60 === 0) zoomRates.push((-(r.heroPxU - sample(s-1).heroPxU)/r.heroPxU*100).toFixed(1));
    if (prevV !== null) { const dv = Math.abs(r.px - prevV)*60; if (dv > maxDV) { maxDV = dv; maxDVAt = s; } }
    prevV = r.px; prevH = r.heroPxU; }
  const e = manifestoPose(mob, T, A);
  const he = Math.atan2(e.target.z-e.position.z, e.target.x-e.position.x)*180/Math.PI;
  console.log(`M6 hero growth max ${((hmax/h0-1)*100).toFixed(1)}%, min px/s in [0.5,T-2] ${f2(minPx)}@${minAt.toFixed(2)}, last zoom-in after 1.5s at ${maxZoomInAfter.toFixed(2)}, max |d(px/s)/dt| ${maxDV.toFixed(0)}@${maxDVAt.toFixed(2)}`);
  console.log(`M6 zoom-out %/s per second: ${zoomRates.join(' ')}`);
  console.log(`M6 end pose y=${e.position.y} xz=${e.position.x.toFixed(3)},${e.position.z.toFixed(3)} heading=${he.toFixed(2)}deg fov=${e.fov}`);
}

// ---- extra metrics (verify copy): peak px/s overall and early, cruise mean, final pose ----
if (mode === 'extra' || mode === 'all') {
  const W = 390, H = 844, A = W/H;
  const pts = []; for (let i=-6;i<=6;i++) for (let j=-6;j<=6;j++) pts.push({ x:i*3, y:0.3, z:-1.8+j*3 });
  const basis = pose => { const p=pose.position,q=pose.target; let fx=q.x-p.x,fy=q.y-p.y,fz=q.z-p.z; const n=Math.hypot(fx,fy,fz); fx/=n;fy/=n;fz/=n;
    const h=Math.hypot(fx,fz); const hx=fx/h, hz=fz/h; let ux=hx-fx*(hx*fx+hz*fz), uy=-fy*(hx*fx+hz*fz), uz=hz-fz*(hx*fx+hz*fz);
    if (fy > -0.999) { ux=-fy*hx; uy=h; uz=-fy*hz; }
    const un=Math.hypot(ux,uy,uz); ux/=un;uy/=un;uz/=un;
    return { fx,fy,fz,ux,uy,uz, rx:fy*uz-fz*uy, ry:fz*ux-fx*uz, rz:fx*uy-fy*ux }; };
  const proj = (pose,b,pt) => { const p=pose.position; const x=pt.x-p.x,y=pt.y-p.y,z=pt.z-p.z; const d=x*b.fx+y*b.fy+z*b.fz; const t=Math.tan(pose.fov*Math.PI/360);
    return { nx:(x*b.rx+y*b.ry+z*b.rz)/(d*t*A), ny:(x*b.ux+y*b.uy+z*b.uz)/(d*t), d }; };
  const pxs = s => { const pose = manifestoPose(mob, s, A), b = basis(pose); const dt = 1/60;
    const p2 = manifestoPose(mob, Math.max(0, s-dt), A), b2 = basis(p2); let mv=0,c=0;
    for (const pt of pts) { const a=proj(p2,b2,pt), q=proj(pose,b,pt); if (a.d>0&&q.d>0&&Math.abs(q.nx)<1&&Math.abs(q.ny)<1) { mv+=Math.hypot((q.nx-a.nx)*W/2,(q.ny-a.ny)*H/2); c++; } }
    return c ? mv/c/dt : 0; };
  let peakAll=0, peakAllAt=0, peakEarly=0, peakEarlyAt=0, cs=0, cn=0;
  for (let f = 1; f <= Math.round(T*60); f++) { const s = f/60, v = pxs(s);
    if (v > peakAll) { peakAll = v; peakAllAt = s; }
    if (s <= 3 && v > peakEarly) { peakEarly = v; peakEarlyAt = s; }
    if (s >= 5 && s <= 25) { cs += v; cn++; } }
  const cruise = cs / cn;
  const e = manifestoPose(mob, T, A), e0 = manifestoPose(mob, T - 0.0001, A);
  const hdg = p => Math.atan2(p.target.z-p.position.z, p.target.x-p.position.x)*180/Math.PI;
  const hd = Math.hypot(e.position.x-mob.fieldCenter.x, e.position.z-mob.fieldCenter.z);
  console.log(`EXTRA peakPxs=${peakAll.toFixed(1)}@${peakAllAt.toFixed(2)} peakPxs[0,3]=${peakEarly.toFixed(1)}@${peakEarlyAt.toFixed(2)} cruiseMean[5,25]=${cruise.toFixed(2)}`);
  console.log(`EXTRA finalPos=${e.position.x.toFixed(4)},${e.position.y.toFixed(4)},${e.position.z.toFixed(4)} target=${e.target.x.toFixed(4)},${e.target.y.toFixed(4)},${e.target.z.toFixed(4)} heading=${hdg(e).toFixed(3)} horizDistFromFieldCentre=${hd.toFixed(4)} fov=${e.fov} roll=${e.roll}`);
  const dist = p => Math.hypot(p.position.x-p.target.x, p.position.y-p.target.y, p.position.z-p.target.z);
  console.log(`EXTRA camera-to-target distance=${dist(e).toFixed(4)} height=${e.position.y.toFixed(4)} pitch=${(Math.asin((e.target.y-e.position.y)/dist(e))*180/Math.PI).toFixed(3)}deg`);
}
