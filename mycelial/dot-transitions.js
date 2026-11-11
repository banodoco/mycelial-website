// Version F: each slide's text hangs from a small node of mycelium, seen from
// above, in the main site's own language: fine gold threads, short curling
// side-branches, tiny bright nodes. Turning the slide, the text is drawn into
// its node; a hypha grows across to where the next slide's text begins, its
// tip lit as it travels and side-branches sprouting behind it; where it
// arrives the node blooms, grows a small tuft, and threads run down into the
// text: the words appear where the network reaches, spreading from the node.
// Leaving, threads reach across the text and draw it back in.
// Old threads fade to about half and stay, so the network builds up across
// the deck; on first load the Mycelial mark draws itself in the middle of the
// screen and travels out to become the first node. Between turns
// the node drifts a little and the text trails it. Other versions untouched.
(() => {
  const VER = 'f';
  const html = document.documentElement;
  const slides = [...document.querySelectorAll('.slide')];
  // Reduced motion, or the viewer's own "animations off" switch (window.deckStill), which can change at any time.
  let still = window.deckStill ? window.deckStill() : matchMedia('(prefers-reduced-motion: reduce)').matches;
  const active = () => html.dataset.ver === VER;
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const rnd = Math.random;

  const dot = document.createElement('div');
  dot.className = 'dt-dot';
  dot.setAttribute('aria-hidden', 'true');
  const core = document.createElement('i'); // the visible node; pulses without moving its anchor
  dot.appendChild(core);
  const net = document.createElement('canvas');
  net.className = 'dt-net';
  net.setAttribute('aria-hidden', 'true');
  // The Mycelial mark (the opening, and the crown on the last slide) has a small canvas of its own, so whatever
  // quiets the network behind a slide's picture never fades the mark.
  // The Mycelial mark is vector, the brand's own geometry (assets/brand/favicon.svg) drawn in stroke by stroke, so it
  // is as sharp as the wordmark on any screen: drawn on a canvas it came out soft on an iPhone, however many pixels.
  const SVGNS = 'http://www.w3.org/2000/svg';
  const markCv = document.createElementNS(SVGNS, 'svg');
  markCv.setAttribute('class', 'dt-mark');
  markCv.setAttribute('aria-hidden', 'true');
  document.body.append(net, markCv, dot);
  const g = net.getContext('2d');
  // Settled threads are drawn once into an offscreen layer and leave the frame loop, so the network can spread
  // across the whole screen while each frame only draws what is still growing or glowing.
  const ground = document.createElement('canvas'), gg = ground.getContext('2d');

  // ---- The network ---------------------------------------------------------
  // A hypha is a polyline that grows along its length. Fresh threads glow,
  // then settle to a faint trace; kept ones (a node's tuft) stay faintly,
  // the rest fade away.
  const THREAD = '240,200,119', NODE = '255,217,145';
  const REST = 0.42; // what a lasting thread settles to, as a share of its fresh glow
  let hyphae = [], blooms = [], nodes = [], netOn = false, netRaf = 0, netLast = 0, dpr = 1;
  let vw = innerWidth, vh = innerHeight;
  // The settled network as geometry, so a resize can redraw it in place: { pts, w, a } threads and { x, y, a } nodes.
  let baked = [];
  const CAP = 6000; // past this the network is full: new threads still glow on their way, then fade instead of staying

  const bakeLine = (pts, w, a) => {
    gg.strokeStyle = `rgba(${THREAD},${a.toFixed(3)})`;
    gg.lineWidth = w;
    gg.beginPath();
    gg.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) gg.lineTo(pts[i][0], pts[i][1]);
    gg.stroke();
  };
  const bakeDot = (x, y, a) => {
    gg.fillStyle = `rgba(${NODE},${a.toFixed(3)})`;
    gg.beginPath(); gg.arc(x, y, 1.25, 0, 7); gg.fill();
  };
  const rebake = () => {
    gg.setTransform(dpr, 0, 0, dpr, 0, 0);
    gg.clearRect(0, 0, vw, vh);
    gg.lineCap = 'round';
    gg.lineJoin = 'round';
    for (const b of baked) b.pts ? bakeLine(b.pts, b.w, b.a) : bakeDot(b.x, b.y, b.a);
  };

  // How much of the screen the network has reached: thread length per cell of a coarse grid, measured so that
  // the same reading means the same density on any screen (one unit is 90 px of thread per 90 × 90 px), a phone
  // a little fuller.
  const GX = 16, GY = 10;
  let cover = new Float32Array(GX * GY), junctions = [];
  const note = (pts) => {
    const cw = vw / GX, ch = vh / GY, unit = Math.max(32, (cw * ch) / 90);
    for (let i = 1; i < pts.length; i++) {
      const cx = Math.floor((pts[i][0] + pts[i - 1][0]) / 2 / cw), cy = Math.floor((pts[i][1] + pts[i - 1][1]) / 2 / ch);
      if (cx >= 0 && cy >= 0 && cx < GX && cy < GY) cover[cy * GX + cx] += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) / unit;
    }
    // Points new threads can set off from (shared with the geometry, so they move with it on a resize).
    for (let i = 0; i < pts.length; i += 7) {
      if (junctions.length < 1600) junctions.push(pts[i]);
      else junctions[Math.floor(rnd() * junctions.length)] = pts[i];
    }
  };

  // How much the settled network is stretched across, against down, from the shape it grew in.
  let warp = 1;
  // A small resize (an address bar coming or going) stretches the network to the new screen, unseen. A change of
  // shape (a phone turned, a window made much wider or narrower) would flatten its threads, so there the network
  // keeps its shape: it is scaled evenly, the slide's node (from, to) or else the middle staying put in it, and
  // size() says so, for the ground it no longer reaches to be grown over.
  const size = (from, to) => {
    dpr = Math.min(2, devicePixelRatio || 1);
    let sx = innerWidth / vw, sy = innerHeight / vh;
    const o = from || { x: vw / 2, y: vh / 2 };
    vw = innerWidth; vh = innerHeight;
    const n = to || { x: vw / 2, y: vh / 2 };
    net.width = ground.width = Math.round(vw * dpr);
    net.height = ground.height = Math.round(vh * dpr);
    const w = warp * sx / sy, even = w > 1.25 || w < 0.8;
    if (even) { const k = Math.sqrt(sx * sy); sx = k / Math.sqrt(warp); sy = k * Math.sqrt(warp); warp = 1; } else warp = w;
    if (sx !== 1 || sy !== 1 || even) {
      const [ox, oy, nx, ny] = even ? [o.x, o.y, n.x, n.y] : [0, 0, 0, 0];
      const seen = new Set();
      for (const b of baked) {
        if (!b.pts) { b.x = nx + (b.x - ox) * sx; b.y = ny + (b.y - oy) * sy; continue; }
        if (seen.has(b.pts)) continue;
        seen.add(b.pts);
        for (const p of b.pts) { p[0] = nx + (p[0] - ox) * sx; p[1] = ny + (p[1] - oy) * sy; }
      }
      if (even) { cover = new Float32Array(GX * GY); junctions = []; seen.forEach(note); }
    }
    rebake();
    return even;
  };
  size();

  const lengths = (pts) => {
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return len;
  };
  // A wandering path from a to b: a random walk that steers harder as it nears.
  const wander = (a, b) => {
    const pts = [[a.x, a.y]];
    let x = a.x, y = a.y;
    let ang = Math.atan2(b.y - a.y, b.x - a.x) + (rnd() - 0.5) * 1.4;
    for (let i = 0; i < 600; i++) {
      const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy);
      if (d < 9) { pts.push([b.x, b.y]); break; }
      const diff = ((Math.atan2(dy, dx) - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      ang += diff * (0.07 + 0.5 * clamp(1 - d / 260)) + (rnd() - 0.5) * 0.45;
      x += Math.cos(ang) * 6; y += Math.sin(ang) * 6;
      pts.push([x, y]);
    }
    return pts;
  };
  // A free side-branch: sets off at an angle and curls as it goes.
  const curl = (x, y, ang, length) => {
    const pts = [[x, y]];
    const bend = (rnd() - 0.5) * 0.12;
    for (let s = 0; s < length; s += 5) {
      ang += bend + (rnd() - 0.5) * 0.3;
      x += Math.cos(ang) * 5; y += Math.sin(ang) * 5;
      pts.push([x, y]);
    }
    return pts;
  };

  const hypha = (pts, o = {}) => {
    const len = lengths(pts);
    const full = baked.length > CAP && !o.keep;
    const h = {
      pts, len, total: len[len.length - 1], grown: 0, age: -(o.delay || 0), after: 0, done: false,
      width: o.width || 0.8, alpha: o.alpha || 0.45, speed: o.speed || 300, duration: o.duration || 0, tip: o.tip ?? 1,
      keep: !!o.keep, rest: full ? 0 : o.rest ?? REST, glow: 1, smooth: !!o.smooth, fade: o.fade || 4.5, branches: o.branches || [], depth: o.depth || 0, onDone: o.onDone || null, owner: o.owner || null,
    };
    if (h.keep || h.rest) note(pts);
    hyphae.push(h);
    wake();
    return h;
  };
  // Side-branches to sprout as a thread grows past them.
  const plan = (total, depth) => {
    const out = [];
    for (let at = 25 + rnd() * 30; at < total - 18; at += 32 + rnd() * 55) {
      out.push({ at, side: rnd() < 0.5 ? -1 : 1, length: (depth ? 10 + rnd() * 22 : 18 + rnd() * 60), done: false });
    }
    return out;
  };
  const pointAt = (h, d) => {
    let i = 1;
    while (i < h.len.length - 1 && h.len[i] < d) i++;
    const t = clamp((d - h.len[i - 1]) / ((h.len[i] - h.len[i - 1]) || 1));
    const [x0, y0] = h.pts[i - 1], [x1, y1] = h.pts[i];
    return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, ang: Math.atan2(y1 - y0, x1 - x0), i };
  };
  // A node blooms: a soft flash, and a tuft of short threads that stays.
  const bloom = (p, reach = 1) => {
    blooms.push({ x: p.x, y: p.y, age: 0 });
    // Fanned upward and sideways, away from the text that hangs below.
    const n = 5 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const ang = -Math.PI / 2 + (k / (n - 1) - 0.5) * 2.9 + (rnd() - 0.5) * 0.35;
      hypha(curl(p.x, p.y, ang, (8 + rnd() * 16) * reach), { width: 0.7, alpha: 0.4, speed: 110 + rnd() * 70, keep: true, delay: rnd() * 0.12, depth: 2 });
    }
    wake();
  };
  // The old node's tuft dims to a trace like everything else (the new node grows its own).
  const release = () => {
    hyphae.forEach((h) => { if (h.keep) { h.keep = false; h.rest = h.rest || REST; } });
    nodes.forEach((n) => { if (n.keep) { n.keep = false; n.rest = n.rest || REST; } });
  };

  // How bright a thread should be now: fresh threads glow, then settle to a
  // resting trace (a node's own tuft rests brighter); passing threads fade out.
  const target = (h) => {
    if (h.age < 0) return 0;
    const fresh = h.done ? Math.exp(-h.after / Math.min(0.9, h.fade * 0.5)) : 1;
    if (h.keep) return 0.6 + 0.4 * fresh;
    if (h.rest) return h.rest + (1 - h.rest) * fresh;
    return fresh * clamp(1 - h.after / h.fade);
  };

  // The Mycelial mark, from the site's own favicon (a 64-unit grid centred on 32,32).
  const MARK = {
    nodes: [[14, 24, 3.4], [29, 13, 3], [45, 21, 5], [50, 39, 3.2], [42, 51, 3], [21, 45, 4.6]],
    curves: [[14, 24, 28, 23, 29, 13], [29, 13, 35, 30, 21, 45], [21, 45, 36, 31, 45, 21], [45, 21, 43, 35, 50, 39],
      [50, 39, 36, 37, 42, 51], [42, 51, 35, 38, 21, 45], [21, 45, 25, 33, 14, 24], [14, 24, 33, 25, 42, 51], [21, 45, 30, 32, 45, 21]],
  };
  let mark = null; // { x, y, t, size, shrink, trail, shed }

  // Side-branches sprout where the thread has grown past them.
  const sprout = (h) => {
    for (const b of h.branches) {
      if (b.done || h.grown < b.at) continue;
      b.done = true;
      const p = pointAt(h, b.at);
      nodes.push({ x: p.x, y: p.y, age: 0, keep: h.keep, rest: h.rest, owner: h.owner });
      const pts = curl(p.x, p.y, p.ang + b.side * (0.5 + rnd() * 0.6), b.length);
      hypha(pts, { width: h.width * 0.7, alpha: h.alpha * 0.8, speed: 140 + rnd() * 90, keep: h.keep, rest: h.rest, depth: h.depth + 1, tip: h.tip, owner: h.owner,
        branches: h.depth < 1 && rnd() < 0.55 ? plan(lengths(pts).at(-1), h.depth + 1) : [] });
    }
  };
  // A lasting thread that has settled to its trace goes into the ground layer; so does a settled node.
  const settled = (h) => h.done && !h.keep && h.rest > 0 && h.age >= 0 && h.after > 1 && Math.abs(h.glow - h.rest) < 0.02;
  const bake = (h) => {
    const b = { pts: h.pts, w: h.width, a: h.alpha * h.rest };
    baked.push(b);
    bakeLine(b.pts, b.w, b.a);
  };
  const bakeNode = (n) => {
    const b = { x: n.x, y: n.y, a: n.rest * 0.6 };
    baked.push(b);
    bakeDot(b.x, b.y, b.a);
  };
  // Grow everything still growing to its end at once and settle it (a resize, or reduced motion).
  const ripen = () => {
    for (let i = 0; i < hyphae.length; i++) { // branches sprouting here join the end of the list and ripen in turn
      const h = hyphae[i];
      h.onDone = null;
      if (h.age < 0) h.age = 0;
      h.grown = h.total;
      sprout(h);
      h.done = true; h.after = 99; h.glow = target(h);
    }
    nodes.forEach((n) => { n.age = 99; });
    blooms = [];
    hyphae = hyphae.filter((h) => { if (settled(h)) { bake(h); return false; } return h.keep || h.rest > 0; });
    nodes = nodes.filter((n) => { if (n.keep) return true; if (n.rest) bakeNode(n); return false; });
  };

  const step = (dt) => {
    for (const h of hyphae) {
      h.age += dt;
      if (h.age < 0) continue;
      if (!h.done) {
        const k = clamp(h.age / (h.duration || 1));
        h.grown = h.duration
          ? h.total * (h.smooth ? 0.5 - 0.5 * Math.cos(Math.PI * k) : (1 - Math.pow(1 - k, 2.2)) * clamp(k * 3))
          : Math.min(h.total, h.grown + h.speed * dt);
        sprout(h);
        if (h.grown >= h.total - 0.01) {
          h.grown = h.total; h.done = true;
          if (h.onDone) { const f = h.onDone; h.onDone = null; f(); }
        }
      } else h.after += dt;
    }
    for (const h of hyphae) h.glow += (target(h) - h.glow) * (1 - Math.exp(-dt / 0.35));
    for (const n of nodes) n.age += dt;
    for (const b of blooms) b.age += dt;
    // The mark rides the tip of its thread, shrinking, and sheds its nodes along the way.
    if (mark) {
      mark.t += dt;
      if (mark.folding !== undefined) {
        mark.folding += dt / 0.5;
        mark.shrink = clamp(mark.folding);
        if (mark.folding >= 1) mark = null;
      }
      const tr = mark && mark.trail;
      if (tr) {
        const p = pointAt(tr, tr.grown), u = tr.grown / tr.total;
        mark.x = p.x; mark.y = p.y;
        mark.shrink = u * u * (3 - 2 * u);
        if (mark.shed < 4 && u > 0.2 + mark.shed * 0.17) {
          mark.shed++;
          nodes.push({ x: p.x, y: p.y, age: 0, keep: false, rest: 0.5 });
          hypha(curl(p.x, p.y, p.ang + (rnd() < 0.5 ? -1 : 1) * (0.7 + rnd() * 0.6), 14 + rnd() * 30), { width: 0.7, alpha: 0.45, speed: 160, depth: 1 });
        }
      }
    }
    // Resting threads stay as a trace (in the ground layer once settled); passing ones (through the text) go entirely.
    hyphae = hyphae.filter((h) => {
      if (settled(h)) { bake(h); return false; }
      return h.keep || h.rest || h.age < 0 || !h.done || h.after < h.fade;
    });
    nodes = nodes.filter((n) => {
      if (n.keep) return true;
      if (n.rest) { if (n.age > 3) { bakeNode(n); return false; } return true; }
      return n.age < 5;
    });
    blooms = blooms.filter((b) => b.age < 0.9);
    for (const z of zones) {
      if (z.wait > 0) { z.wait -= dt; continue; }
      z.a += (z.to - z.a) * (1 - Math.exp(-dt / 0.3));
    }
    zones = zones.filter((z) => z.to > 0 || z.a > 0.01);
  };

  // The mark, drawn on its own canvas around (cx, cy).
  // The mark's parts, made once in the art's own 64-unit space; each frame only moves and scales the group and sets
  // the strokes' weights, how far each has drawn in, and the opacities.
  let markParts = null;
  const markSvg = () => {
    if (markParts) return markParts;
    const el = (name, attrs, parent) => {
      const n = document.createElementNS(SVGNS, name);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      parent.append(n);
      return n;
    };
    const defs = el('defs', {}, markCv);
    const glowOf = (id) => {
      const gr = el('radialGradient', { id }, defs);
      el('stop', { offset: 1, 'stop-color': `rgb(${NODE})`, 'stop-opacity': 0 }, gr);
      const stop = el('stop', { offset: 0, 'stop-color': `rgb(${NODE})`, 'stop-opacity': 0 }, gr);
      gr.prepend(stop);
      return stop;
    };
    const art = el('g', {}, markCv);
    const haloStop = glowOf('dt-mark-halo');
    el('circle', { cx: 32, cy: 32, r: 36, fill: 'url(#dt-mark-halo)' }, art);
    const ring = el('circle', { cx: 32, cy: 32, r: 27, fill: 'none', 'stroke-linecap': 'round', transform: 'rotate(-90 32 32)' }, art);
    // Each curve's length, measured from its own quadratic so it needs no layout.
    const lengths = MARK.curves.map(([x0, y0, qx, qy, x1, y1]) => {
      let L = 0, px = x0, py = y0;
      for (let s2 = 1; s2 <= 48; s2++) {
        const t = s2 / 48, u = 1 - t, x = u * u * x0 + 2 * u * t * qx + t * t * x1, y = u * u * y0 + 2 * u * t * qy + t * t * y1;
        L += Math.hypot(x - px, y - py); px = x; py = y;
      }
      return L;
    });
    const curves = MARK.curves.map(([x0, y0, qx, qy, x1, y1]) =>
      el('path', { d: `M${x0} ${y0}Q${qx} ${qy} ${x1} ${y1}`, fill: 'none', 'stroke-linecap': 'round' }, art));
    const nodes = MARK.nodes.map(([x, y], i) => ({
      stop: glowOf(`dt-mark-n${i}`),
      glow: el('circle', { cx: x, cy: y, fill: `url(#dt-mark-n${i})` }, art),
      core: el('circle', { cx: x, cy: y }, art),
    }));
    return (markParts = { art, haloStop, ring, curves, lengths, nodes });
  };
  const setAttrs = (n, attrs) => { for (const k in attrs) n.setAttribute(k, attrs[k]); };
  const drawMark = (m, cx, cy) => {
    const p = markSvg(), k = m.t;
    const S = (m.size * (1 - 0.94 * m.shrink)) / 54; // px per unit; the ring spans 54 units
    const fade = (1 - 0.55 * m.shrink) * (m.faint || 1);
    const fine = m.faint ? 0.55 : 1; // the large faint crown is drawn in a finer hand, so the words over it stay clear
    // A phone's small mark (and the mark shrinking on its ride) keeps lines of real weight and tight glows: hairline,
    // half-transparent strokes in wide halos read as a smudge beside the solid wordmark. A desktop's larger mark is
    // already above these floors and draws as before.
    const glowK = 2.2 + 0.8 * clamp((S - 1) / 1.5);
    const ink = `rgba(${THREAD},${(0.8 * fade).toFixed(3)})`;
    p.art.setAttribute('transform', `translate(${cx - 32 * S} ${cy - 32 * S}) scale(${S})`);
    p.haloStop.setAttribute('stop-opacity', (0.1 * clamp(k / 1) * fade).toFixed(3));
    const rp = clamp(k / 0.8), C = 2 * Math.PI * 27;
    setAttrs(p.ring, { stroke: ink, 'stroke-width': Math.max(m.crown ? 1.1 : 1.15, S * 0.66 * fine) / S,
      'stroke-dasharray': `${rp * C} ${C}`, visibility: rp > 0 ? 'visible' : 'hidden' });
    const w = Math.max(m.crown ? 0.9 : 0.85, S * 0.5 * fine) / S;
    p.curves.forEach((c, i) => {
      const q = clamp((k - 0.2 - i * 0.05) / 0.5), L = p.lengths[i];
      setAttrs(c, { stroke: ink, 'stroke-width': w, 'stroke-dasharray': `${q * L} ${L + 1}`, visibility: q > 0 ? 'visible' : 'hidden' });
    });
    p.nodes.forEach((n, i) => {
      const r = MARK.nodes[i][2], a = clamp((k - 0.15 - i * 0.08) / 0.25) * fade;
      const rr = Math.max(1.4, r * S * 0.8 * (m.faint ? 0.55 : 1)), vis = a > 0 ? 'visible' : 'hidden';
      n.stop.setAttribute('stop-opacity', (0.5 * a * fine).toFixed(3));
      setAttrs(n.glow, { r: (rr * glowK) / S, visibility: vis });
      setAttrs(n.core, { r: rr / S, fill: `rgba(255,236,190,${Math.min(1, a * fine * 1.2).toFixed(3)})`, visibility: vis });
    });
  };

  // Under the text the network is softened, never removed: a soft-edged shape of the text's lines, cut from the
  // drawn network at CUT strength. Slides that soften the network themselves (an inline mask) keep theirs.
  const CUT = 0.72;
  let zones = [], chrome = null;
  const zoneCanvases = new Map(), discCanvases = new Map(), chromeKey = {};
  const scratch = (cache, key, w, h) => {
    let cv = cache.get(key);
    if (cv && (cv.width !== w || cv.height !== h)) {
      // A fading zone may still hold the old surface on a rapid return.
      zones = zones.filter((z) => z.cv !== cv);
      cv.width = cv.height = 0;
      cache.delete(key);
      cv = null;
    }
    if (!cv) {
      cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cache.set(key, cv);
    } else {
      // A slide can be revisited before its preceding zone has faded out.
      zones = zones.filter((z) => z.cv !== cv);
    }
    const c = cv.getContext('2d');
    if (!c) return null;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    c.shadowColor = 'rgba(0,0,0,0)'; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0;
    if ('filter' in c) c.filter = 'none';
    return { cv, c };
  };
  const zone = (els, key) => {
    const rs = [];
    const range = document.createRange();
    for (const el of els) {
      range.selectNodeContents(el);
      const trim = el.classList.contains('num') ? 0.3 : 0.18; // the label hugs its glyphs, clear of the node above it
      for (const r of range.getClientRects()) if (r.width > 1 && r.height > 1) rs.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, trim });
    }
    if (!rs.length) return null;
    const P = 18;
    const x0 = Math.min(...rs.map((r) => r.left)) - 2 * P, y0 = Math.min(...rs.map((r) => r.top)) - 2 * P;
    const w = Math.max(...rs.map((r) => r.right)) + 2 * P - x0, h = Math.max(...rs.map((r) => r.bottom)) + 2 * P - y0;
    const surface = scratch(zoneCanvases, key, Math.ceil(w * dpr), Math.ceil(h * dpr));
    if (!surface) return null;
    const { cv, c } = surface;
    c.scale(dpr, dpr);
    // Safari has no canvas filter: the same blur, as the shadow of the shapes drawn just off the canvas
    // (shadowBlur is twice the blur's deviation, and like the filter it ignores the scale).
    const off = 'filter' in c ? 0 : w + 4 * P;
    if (off) { c.shadowColor = '#000'; c.shadowBlur = 2 * P * 0.55; c.shadowOffsetX = off * dpr; }
    else c.filter = `blur(${P * 0.55}px)`;
    c.fillStyle = '#000';
    // Blur the combined text silhouette once, including Safari's shadow fallback.
    c.beginPath();
    for (const r of rs) {
      const py = r.height * r.trim;
      c.roundRect(r.left - x0 - P * 0.6 - off, r.top - y0 + py - P * 0.25, r.width + P * 1.2, r.height - 2 * py + P * 0.5, 10);
    }
    c.fill();
    return { cv, x: x0, y: y0, w, h, a: 0, to: 1 };
  };
  // A soft disc, under the crown, so the mark reads cleanly over a full network.
  const disc = (x, y, r, key) => {
    const R = r * 1.5, size = Math.ceil(2 * R * dpr);
    const surface = scratch(discCanvases, key, size, size);
    if (!surface) return null;
    const { cv, c } = surface;
    const grad = c.createRadialGradient(R * dpr, R * dpr, 0, R * dpr, R * dpr, R * dpr);
    grad.addColorStop(0, '#000');
    grad.addColorStop(0.6, '#000');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = grad;
    c.fillRect(0, 0, cv.width, cv.height);
    return { cv, x: x - R, y: y - R, w: 2 * R, h: 2 * R, a: 0, to: 1 };
  };
  // Decoration must never hold up copy or transition completion.
  const safeZone = (elements, key) => { try { return zone(elements(), key); } catch { return null; } };
  // The text block of a slide: its column, the label included.
  // Canonical copy is revealed by its ink: the real nodes stay opaque, unmasked
  // and in place, and only their glyph colour spreads. Slides 3–5 and the wheel
  // (9–11) share this one path; each kind names its own CSS class and variables.
  const stableCopy = (column) => !!inkOf(column);
  const inkOf = (column) => column.matches('.gap-copy') ? 'gap' : column.matches('.as-copy') ? 'as'
    : column.closest('.fw-host') ? 'fw' : null;
  const copyContent = (column) => column.matches('.gap-copy')
    ? column.querySelector(':scope > .gap-copy-content') : column;
  const lines = (s) => textOf(s).flatMap((col) => [...copyContent(col).children]);
  // The deck's own chrome: the wordmark, the counter and its buttons.
  const chromeEls = () => [name, ...document.querySelectorAll('.chrome #count, .chrome button')];
  const soften = () => {
    const own = !net.style.maskImage;
    g.globalCompositeOperation = 'destination-out';
    for (const z of own ? [chrome, ...zones] : [chrome, ...zones.filter((z) => z.crown)]) {
      if (!z || z.a <= 0.005) continue;
      g.globalAlpha = z.a * CUT;
      g.drawImage(z.cv, z.x, z.y, z.w, z.h);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  };

  // A soft light, drawn once: growing tips and blooms are stamped with it rather than building a gradient each frame.
  const glowDot = document.createElement('canvas');
  glowDot.width = glowDot.height = 64;
  {
    const c = glowDot.getContext('2d'), grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${NODE},1)`);
    grad.addColorStop(1, `rgba(${NODE},0)`);
    c.fillStyle = grad;
    c.fillRect(0, 0, 64, 64);
  }
  const stamp = (x, y, r, a) => {
    if (a <= 0.003) return;
    g.globalAlpha = Math.min(1, a);
    g.drawImage(glowDot, x - r, y - r, 2 * r, 2 * r);
    g.globalAlpha = 1;
  };

  const drawThreads = (lasting) => {
    for (const h of hyphae) {
      if (!!(h.keep || h.rest) !== lasting) continue;
      const glow = h.glow;
      if (glow <= 0.005 || h.grown <= 0) continue;
      const end = h.grown >= h.total;
      const tip = end ? { x: h.pts.at(-1)[0], y: h.pts.at(-1)[1], i: h.pts.length - 1 } : pointAt(h, h.grown);
      g.beginPath();
      g.moveTo(h.pts[0][0], h.pts[0][1]);
      for (let i = 1; i < tip.i; i++) g.lineTo(h.pts[i][0], h.pts[i][1]);
      g.lineTo(tip.x, tip.y);
      g.strokeStyle = `rgba(${THREAD},${(h.alpha * glow).toFixed(3)})`;
      g.lineWidth = h.width;
      g.stroke();
      if (!h.done) {
        // The lit stretch just behind a growing tip, and the tip itself.
        const from = pointAt(h, Math.max(0, h.grown - 46));
        g.beginPath();
        g.moveTo(from.x, from.y);
        for (let i = from.i; i < tip.i; i++) g.lineTo(h.pts[i][0], h.pts[i][1]);
        g.lineTo(tip.x, tip.y);
        g.strokeStyle = `rgba(${NODE},${Math.min(1, h.alpha * 1.7 * h.tip).toFixed(3)})`;
        g.lineWidth = h.width + 0.5;
        g.stroke();
        stamp(tip.x, tip.y, h.depth ? 4 : 9, (h.depth ? 0.45 : 0.75) * h.tip);
      }
    }
  };
  const drawNodes = (lasting) => {
    for (const n of nodes) {
      if (!!(n.keep || n.rest) !== lasting) continue;
      const a = (n.keep ? 0.35 + 0.35 * Math.exp(-n.age / 0.8)
        : n.rest ? n.rest * 0.6 + 0.4 * Math.exp(-n.age / 1.2) : 0.7 * clamp(1 - n.age / 5)) * clamp(n.age / 0.15);
      g.fillStyle = `rgba(${NODE},${a.toFixed(3)})`;
      g.beginPath(); g.arc(n.x, n.y, 1.25, 0, 7); g.fill();
    }
  };

  // The mark rides on its own layer, moved into place. Its art is updated only while it changes: the opening mark as
  // it draws itself in and rides out; the large crown behind the last slide's words is set once, at its finished art,
  // and comes in and folds away by the layer's opacity and scale (crown(), uncrown()).
  let markBox = 0, markKey = '';
  const drawMarkLayer = () => {
    if (!mark) {
      // SVG parts set their own visibility, so they can override visibility:hidden on the parent.
      // Retire the whole layer when its mark is gone; no old strokes may survive behind another slide.
      markCv.style.display = 'none';
      markBox = 0; markKey = '';
      return;
    }
    markCv.style.display = '';
    const dev = devicePixelRatio || 1, B = Math.ceil(mark.size * 1.5 + 16);
    // Its corner on the screen's own pixel grid, placed by left/top rather than a transform.
    const left = Math.round((mark.x - B / 2) * dev) / dev, top = Math.round((mark.y - B / 2) * dev) / dev;
    if (markCv.style.left !== `${left}px`) markCv.style.left = `${left}px`;
    if (markCv.style.top !== `${top}px`) markCv.style.top = `${top}px`;
    const art = mark.crown ? { ...mark, t: 2, shrink: 0 } : mark;
    const key = `${B}|${mark.x}|${mark.y}|${art.shrink}|${Math.min(art.t, 1.2)}`;
    if (key === markKey) return;
    markKey = key;
    if (B !== markBox) {
      markBox = B;
      setAttrs(markCv, { width: B, height: B, viewBox: `0 0 ${B} ${B}` });
    }
    markCv.style.visibility = '';
    drawMark(art, mark.x - left, mark.y - top);
  };

  // The settled ground, then what is still growing on it, softened under the text together; then the passing
  // threads that draw the text in and out, the blooms, and the mark, all at full strength.
  const draw = () => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, net.width, net.height);
    if (baked.length) g.drawImage(ground, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    drawThreads(true);
    drawNodes(true);
    soften();
    drawThreads(false);
    drawNodes(false);
    for (const b of blooms) {
      const e = clamp(b.age / 0.9);
      stamp(b.x, b.y, 5 + 30 * (1 - Math.pow(1 - e, 3)), 0.55 * (1 - e));
    }
    drawMarkLayer();
  };

  // Runs only while something is growing, glowing or fading.
  const moving = () => (mark && (mark.trail || mark.folding !== undefined || mark.t < 1.6)) || blooms.length || nodes.some((n) => (n.keep || n.rest ? n.age < 3 : true))
    || zones.some((z) => Math.abs(z.a - z.to) > 0.01)
    || hyphae.some((h) => h.age < 0 || !h.done || Math.abs(h.glow - target(h)) > 0.004 || !(h.keep || h.rest || h.after >= h.fade));
  const tick = (now) => {
    netRaf = 0;
    if (document.getElementById('overview')?.classList.contains('on')) { netOn = false; netLast = 0; return; }
    now = window.deckNow();
    const dt = Math.max(0, (now - (netLast || now)) / 1000);
    netLast = now;
    step(dt);
    draw();
    if (moving()) netRaf = requestAnimationFrame(tick);
    else { netOn = false; netLast = 0; }
  };
  function wake() {
    if (document.getElementById('overview')?.classList.contains('on')) return;
    if (!netOn) { netOn = true; netLast = window.deckNow(); netRaf = requestAnimationFrame(tick); }
  }
  const syncNetMotion = () => {
    if (document.getElementById('overview')?.classList.contains('on')) {
      if (netRaf) cancelAnimationFrame(netRaf);
      netRaf = 0; netOn = false; netLast = 0;
    } else if (moving()) wake();
  };
  window.addEventListener('deck-overview', syncNetMotion);
  const clearNet = () => {
    hyphae = []; nodes = []; blooms = []; mark = null;
    baked = []; junctions = []; cover = new Float32Array(GX * GY); warp = 1;
    rebake();
    draw();
  };

  // ---- Sprawl ----------------------------------------------------------------
  // Besides the thread from node to node, every new slide grows the network out into ground it hasn't reached,
  // the bottom-left first. By slide k it has reached FILL[k] of the screen's cells with at least DEPTH[k] cell
  // widths of thread each. Going into slide 5 that jumps, and the network bursts out across the whole screen;
  // by the last slides it fills it. Going back never takes any away, and once full it stops growing.
  const FILL = [0.1, 0.24, 0.36, 0.48, 0.9, 0.92, 0.94, 0.96, 0.98, 1, 1];
  const DEPTH = [0.7, 0.7, 0.75, 0.8, 0.85, 0.95, 1.05, 1.15, 1.25, 1.4, 1.5];
  const short = (lvl) => {
    let below = 0;
    for (const c of cover) if (c < DEPTH[lvl]) below++;
    return below - Math.floor((1 - FILL[lvl]) * GX * GY);
  };
  // Somewhere the network is thin: weighted towards the emptiest cells and, early on, the bottom-left.
  const pickCell = (lvl) => {
    let sum = 0;
    const w = Array.from(cover, (c, i) => {
      if (c >= DEPTH[lvl]) return 0;
      const x = (i % GX + 0.5) / GX, y = (Math.floor(i / GX) + 0.5) / GY;
      const v = Math.pow(1 - c / DEPTH[lvl], 2) * (lvl < 4 && x < 0.45 && y > 0.5 ? 3.5 : 1);
      sum += v;
      return v;
    });
    let r = rnd() * sum;
    for (let i = 0; i < w.length; i++) if ((r -= w[i]) <= 0 && w[i] > 0) return i;
    return -1;
  };
  // Set off from the nearest part of the network (one of the closest few of a sample).
  const pickStart = (to) => {
    if (!junctions.length) return null;
    const near = [];
    for (let k = 0; k < 70; k++) {
      const p = junctions[Math.floor(rnd() * junctions.length)];
      near.push([Math.hypot(p[0] - to.x, p[1] - to.y), p]);
    }
    near.sort((a, b) => a[0] - b[0]);
    const p = near[Math.floor(rnd() * Math.min(3, near.length))][1];
    return { x: p[0], y: p[1] };
  };
  const sprawl = (lvl, from, delay = 0) => {
    lvl = clamp(lvl, 0, FILL.length - 1);
    const need = short(lvl);
    if (need <= 0) return;
    const burst = need > 40; // a big step (into slide 5, or a jump ahead): many threads at once, fast, from all over
    const most = burst ? 46 : 12;
    const cw = vw / GX, ch = vh / GY;
    for (let n = 0, tries = 0; n < most && tries < most * 3 && short(lvl) > 0; tries++) {
      const cell = pickCell(lvl);
      if (cell < 0) break;
      const to = { x: (cell % GX + 0.15 + 0.7 * rnd()) * cw, y: (Math.floor(cell / GX) + 0.15 + 0.7 * rnd()) * ch };
      const start = (burst && from && rnd() < 0.15) ? from : pickStart(to) || from;
      if (!start) break;
      const pts = wander(start, to);
      const total = lengths(pts).at(-1);
      if (total < 40) { cover[cell] += DEPTH[lvl]; continue; } // already there: count the cell as reached
      hypha(pts, burst
        ? { width: 0.75, alpha: 0.44, speed: 560 + rnd() * 320, delay: delay + rnd() * 0.55, branches: plan(total, 0), tip: 0.8 }
        : { width: 0.75, alpha: 0.42, speed: 190 + rnd() * 110, delay: delay + 0.2 + rnd() * 1.1, branches: plan(total, 0), tip: 0.45 });
      n++;
    }
  };

  // ---- Slides, text and the node --------------------------------------------
  // In F each slide's label sits inside its text column, directly above the
  // headline, so label and text travel as one block under the node.
  const columnOf = (s) => s.querySelector(':scope > .split > :first-child');
  const homes = new Map();
  const adopt = () => slides.forEach((s) => {
    const num = s.querySelector(':scope > .num'), col = columnOf(s);
    if (!num || !col) return;
    homes.set(num, s);
    copyContent(col).prepend(num);
  });
  const restore = () => homes.forEach((s, num) => s.insertBefore(num, s.querySelector(':scope > .split')));

  const textOf = (s) => [s.matches('.fw-raise') ? s.querySelector(':scope > .split') : columnOf(s), s.querySelector(':scope > .fw-stat')].filter(Boolean);
  const copyRectsOf = (el) => {
    const items = el.matches('.fw-stat') ? [el] : el.matches('.split') ? [...el.children].flatMap((child, i) => i === 0 ? [...child.children] : [child]) : [...copyContent(el).children];
    return items.flatMap((item) => {
      if (getComputedStyle(item).display === 'none' || (item.matches('.num') && item.closest('.fw-raise'))) return [];
      if (item.matches('.fw-stat')) {
        const range = document.createRange(); range.selectNodeContents(item);
        return [...range.getClientRects()].filter((r) => r.width && r.height);
      }
      const r = item.getBoundingClientRect(); return r.width && r.height ? [r] : [];
    });
  };
  const copyRects = (context) => textOf(slides[context.to]).flatMap(copyRectsOf);
  // The node sits just above the start of the label (its end when right-aligned, its middle when centred).
  const anchorOf = (s) => {
    const col = columnOf(s);
    const first = col && (col.querySelector('.num') || col.querySelector('h1'));
    if (!first) return null;
    if (s.matches('.fw-raise')) {
      const r = first.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    const range = document.createRange();
    range.selectNodeContents(first);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0);
    if (!rects.length) return null;
    const line = rects.filter((r) => Math.abs(r.top - rects[0].top) < 6);
    const left = Math.min(...line.map((r) => r.left)), right = Math.max(...line.map((r) => r.right));
    const align = getComputedStyle(first).textAlign;
    const x = align === 'center' ? (left + right) / 2 : align === 'right' || align === 'end' ? right - 3 : left + 3;
    return { x, y: rects[0].top - 13 };
  };
  // Capture the participating copy before scene hooks write styles. Keep only
  // immutable viewport coordinates for the copy masks and thread geometry.
  const copyOffset = (el) => {
    const match = /^translate\(\s*([+-]?[\d.]+)px,\s*([+-]?[\d.]+)px\s*\)$/.exec(el.style.transform);
    return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 0, y: 0 };
  };
  const geometry = (from, to) => {
    const boxes = new Map();
    for (const slide of [slides[from], slides[to]].filter(Boolean)) {
      for (const el of textOf(slide)) {
        const r = el.getBoundingClientRect();
        const offset = copyOffset(el);
        boxes.set(el, Object.freeze({ left: r.left - offset.x, top: r.top - offset.y, right: r.right - offset.x, bottom: r.bottom - offset.y, width: r.width, height: r.height }));
      }
    }
    const column = columnOf(slides[to]), p = anchorOf(slides[to]);
    const initial = copyOffset(column);
    const anchor = p && { x: p.x - initial.x, y: p.y - initial.y };
    const rects = textOf(slides[to]).flatMap((el) => {
      const offset = copyOffset(el);
      return copyRectsOf(el).map((r) => ({ el, left: r.left - offset.x, top: r.top - offset.y, right: r.right - offset.x, bottom: r.bottom - offset.y, width: r.width, height: r.height }));
    });
    const root = document.querySelector('[data-astrid-flowers]');
    const r = root?.getBoundingClientRect();
    const flowers = r ? Object.freeze({ left: r.left, top: r.top }) : null;
    return Object.freeze({
      get anchor() { const offset = copyOffset(column); return anchor && { x: anchor.x + offset.x, y: anchor.y + offset.y }; },
      get rects() { return rects.map(({ el, ...r }) => { const offset = copyOffset(el); return { ...r, left: r.left + offset.x, right: r.right + offset.x, top: r.top + offset.y, bottom: r.bottom + offset.y }; }); },
      flowers, box: (el) => {
      const b = boxes.get(el);
      if (!b) return null;
      const offset = copyOffset(el);
      return { left: b.left + offset.x, top: b.top + offset.y, right: b.right + offset.x, bottom: b.bottom + offset.y, width: b.width, height: b.height };
    } });
  };
  const place = (p) => { dot.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`; };

  // Text shows only inside a soft-edged circle around the node; growing the
  // circle reveals it from the node outward, shrinking it draws it back in.
  const SOFT = 150;
  const masks = new WeakMap();
  // Every disposable masked clone, by the canonical node it stands in for.
  const overlays = new Map();
  const copyTrace = window.__deckDebug ? [] : null;
  const traceCopy = (operation, slide, context = window.deckNav) => {
    if (!copyTrace) return;
    copyTrace.push({ operation, generation: context?.generation ?? null,
      selected: context?.to ?? null, slide: slides.indexOf(slide),
      active: !!slide?.classList.contains('on'), settled: !!slide?.hasAttribute('data-settled'),
      surfaces: overlays.size,
      roots: slide ? textOf(slide).map((el) => ({
        hidden: el.classList.contains('dt-copy-hidden'),
        mask: el.style.maskImage || el.style.webkitMaskImage || '',
        registered: overlays.has(el),
      })) : [],
    });
    if (copyTrace.length > 96) copyTrace.shift();
  };
  const removeOverlay = (el) => {
    const overlay = overlays.get(el);
    if (overlay) overlay.remove();
    overlays.delete(el);
    masks.delete(el);
  };
  const clearOverlays = (slide) => textOf(slide).forEach(removeOverlay);
  const cancelOverlay = (slide, state) => {
    if (copyStates.get(slide) !== state || !['hidden', 'revealing', 'gathering'].includes(state.phase)) return;
    if (state.timer) window.deckCancelLater(state.timer);
    state.timer = null;
    state.phase = 'interrupted';
    state.resolve?.('cancelled');
    // Revoke the writer without inventing a visible endpoint. The next owner
    // gathers from this exact mask (including radius zero). Terminal recovery
    // explicitly reconciles all slides, rather than using cancellation to show.
    traceCopy('interrupt', slide, state.context);
  };
  // Keep the real copy in the layout and reserve masks for disposable paint layers.
  const overlayFor = (el) => {
    if (overlays.has(el)) return overlays.get(el);
    const wasHidden = el.classList.contains('dt-copy-hidden');
    el.classList.remove('dt-copy-hidden');
    const b = el.getBoundingClientRect(), style = getComputedStyle(el);
    const overlay = el.cloneNode(true);
    // Structural selectors such as :first-child differ on the sibling clone.
    // Freeze each element's computed style so every line keeps its original layout.
    const originals = [el, ...el.querySelectorAll('*')];
    const clones = [overlay, ...overlay.querySelectorAll('*')];
    originals.forEach((original, i) => {
      const computed = getComputedStyle(original), clone = clones[i];
      const declarations = [];
      for (let j = 0; j < computed.length; j++) {
        const property = computed[j];
        // WebKit's resolved stroke-color enables an extra text stroke when
        // written back onto HTML. Keep gradient glyphs identical to live copy.
        if (property === 'stroke-color' && original.namespaceURI !== 'http://www.w3.org/2000/svg') continue;
        const priority = computed.getPropertyPriority(property);
        declarations.push(`${property}:${computed.getPropertyValue(property)}${priority ? ' !important' : ''};`);
      }
      // Apply the frozen style once per node. Thousands of individual CSSOM
      // writes can block WebKit for the entire wheel transition.
      clone.style.cssText += declarations.join('');
    });
    if (wasHidden) el.classList.add('dt-copy-hidden');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');
    overlay.classList.remove('dt-copy-hidden');
    overlay.classList.add('dt-copy-overlay');
    overlay.style.removeProperty('visibility');
    overlay.style.removeProperty('opacity');
    [overlay, ...overlay.querySelectorAll('[id]')].forEach((node) => node.removeAttribute('id'));
    Object.assign(overlay.style, { position: 'fixed', left: `${b.left}px`, top: `${b.top}px`,
      width: `${b.width}px`, height: `${b.height}px`, boxSizing: 'border-box', margin: '0',
      transform: 'none', translate: 'none', textAlign: style.textAlign });
    el.after(overlay);
    // Fixed descendants of transformed ancestors use that ancestor's coordinates.
    const placed = overlay.getBoundingClientRect();
    overlay.style.left = `${b.left + b.left - placed.left}px`;
    overlay.style.top = `${b.top + b.top - placed.top}px`;
    overlays.set(el, overlay);
    return overlay;
  };
  // All copy mask and visibility writes pass through this one function.
  const paintCopy = (el, at, r, hidden = false, bounds = null) => {
    if (stableCopy(el)) {
      // Animate glyph/gradient ink on a stable, opaque semantic tree. No
      // opacity layer, clone, mask or visibility swap participates.
      const content = copyContent(el), kind = inkOf(el);
      if (at) masks.set(el, { at: { ...at }, r });
      else masks.delete(el);
      const alpha = at ? String(clamp(r / reach(el, at, bounds))) : hidden ? '0' : '1';
      // The same viewport origin, radius and soft edge as the clone mask. A
      // fixed background shares one circle across every wrapped fragment. The
      // wheel has no per-colour alpha rules: its hidden endpoint is a spread of
      // radius zero, so one mechanism covers hidden, partial and gathered.
      const spreading = Boolean(at) || (hidden && kind === 'fw');
      content.classList.toggle(`${kind}-spreading`, spreading);
      if (spreading) {
        content.style.setProperty(`--${kind}-x`, `${(at ? at.x : 0).toFixed(1)}px`);
        content.style.setProperty(`--${kind}-y`, `${(at ? at.y : 0).toFixed(1)}px`);
        content.style.setProperty(`--${kind}-inner`, `${Math.max(0, r - SOFT).toFixed(1)}px`);
        content.style.setProperty(`--${kind}-outer`, `${Math.max(0.01, r).toFixed(1)}px`);
      } else {
        for (const name of ['x', 'y', 'inner', 'outer']) content.style.removeProperty(`--${kind}-${name}`);
      }
      // Boxes that are not glyphs (slide 5's mobile links, slide 11's question
      // pill) sit outside the ink: they follow the same visit's progress.
      if (kind !== 'gap') el.closest('.slide')?.style.setProperty(`--${kind}-reveal-alpha`, alpha);
      if (kind === 'as') {
        // SVG braces cannot clip text like glyphs: reveal them using the same
        // node-centred radial mask, in their own coordinate system.
        content.querySelectorAll('.story-brace, .story-bridge').forEach((svg) => {
          if (!at) {
            svg.style.maskImage = svg.style.webkitMaskImage = '';
            return;
          }
          const rect = svg.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          const x = at.x - rect.left, y = at.y - rect.top;
          const value = `radial-gradient(circle at ${x.toFixed(1)}px ${y.toFixed(1)}px, #000 ${Math.max(0, r - SOFT).toFixed(1)}px, transparent ${Math.max(0.01, r).toFixed(1)}px)`;
          svg.style.maskImage = svg.style.webkitMaskImage = value;
        });
      }
      const property = `--${kind}-copy-alpha`;
      const ink = at ? '1' : alpha;
      if (content.style.getPropertyValue(property) !== ink) content.style.setProperty(property, ink);
      return;
    }
    if (at) {
      masks.set(el, { at: { ...at }, r });
      const b = bounds || el.getBoundingClientRect();
      const x = at.x - b.left, y = at.y - b.top;
      const value = r <= 0 ? 'linear-gradient(transparent, transparent)'
        : `radial-gradient(circle at ${x.toFixed(1)}px ${y.toFixed(1)}px, #000 ${Math.max(0, r - SOFT).toFixed(1)}px, transparent ${r.toFixed(1)}px)`;
      // Only a disposable clone is ever masked; the real copy waits hidden beneath it.
      const surface = overlayFor(el);
      surface.style.webkitMaskImage = surface.style.maskImage = value;
      copyContent(el).classList.add('dt-copy-hidden');
    } else {
      removeOverlay(el);
      copyContent(el).classList.toggle('dt-copy-hidden', hidden);
    }
  };
  const copyStates = new WeakMap();
  const REVEAL_GRACE = 700; // wall ms a live reveal may overrun its deadline before recovery takes over
  const ownsCopy = (slide, state, transient = false) => !!state &&
    copyStates.get(slide) === state && state.context?.isCurrent() &&
    (!transient || (state.context.isTransitionCurrent() &&
      ['hidden', 'revealing', 'gathering'].includes(state.phase)));
  const claimCopy = (slide, context, phase) => {
    if (!context?.isTransitionCurrent() ||
        (slide !== slides[context.from] && slide !== slides[context.to])) return null;
    const old = copyStates.get(slide);
    if (old?.timer) window.deckCancelLater(old.timer);
    old?.resolve?.('cancelled');
    let resolve;
    const state = { slide, context, phase, timer: null,
      done: new Promise(r => { resolve = r; }), resolve: null };
    state.resolve = resolve;
    copyStates.set(slide, state);
    context.transitionDefer(() => cancelOverlay(slide, state));
    return state;
  };
  // Only this endpoint operation may discard a reveal and publish shown/retired.
  // Transient callbacks must supply their state; terminal reconciliation supplies
  // the current navigation. A registry entry is never a visibility decision.
  const endCopy = (slide, hidden, context, expected = null) => {
    if (!slide || !context?.isCurrent() ||
        hidden === (slide === slides[context.to]) ||
        (expected && !ownsCopy(slide, expected))) return false;
    const old = copyStates.get(slide);
    if (old?.timer) window.deckCancelLater(old.timer);
    const state = { context, slide, phase: hidden ? 'retired' : 'shown' };
    copyStates.set(slide, state); // revoke all old writers before changing paint
    put.x = NaN;
    let complete = true;
    textOf(slide).forEach(el => {
      try {
        if (!stableCopy(el)) el.style.transform = '';
        paintCopy(el, null, 0, hidden);
      } catch (error) { complete = false; console.error('Deck copy restoration failed', error); }
    });
    if (!complete) state.phase = 'failed';
    old?.resolve?.(complete && !hidden ? 'completed' : 'cancelled');
    traceCopy(hidden ? 'retire' : 'show', slide, context);
    return complete;
  };
  const copy = {
    hide(slide, context, at = anchorOf(slide), deadline = 0) {
      if (slide !== slides[context?.to] || !context?.isTransitionCurrent()) return null;
      const old = copyStates.get(slide);
      const reuse = old?.context === context && ['hidden', 'revealing'].includes(old.phase);
      const state = reuse ? old : claimCopy(slide, context, 'hidden');
      if (!state) return null;
      if (state.timer) window.deckCancelLater(state.timer);
      state.timer = null;
      if (!reuse) clearOverlays(slide);
      if (deadline) {
        // Failure recovery belongs to the existing terminal transaction. It
        // stops writers, reconciles scenes and copy, then declares settlement.
        const expire = () => { if (ownsCopy(slide, state, true)) window.deckTransaction('recover', context); };
        state.timer = window.deckLater(() => {
          if (!ownsCopy(slide, state, true)) return;
          // A reveal lands on a painted frame; this timer needs none, and the deck
          // clock shrinks its margin as the pace rises. A reveal that is already
          // running gets real frames to land by itself before it is replaced.
          if (state.phase === 'revealing') state.timer = window.deckLater(expire, REVEAL_GRACE * (window.deckPace?.() || 1), context);
          else expire();
        }, deadline, context);
      }
      textOf(slide).forEach(el => paintCopy(el, at, 0, !at, context.geometry?.box(el)));
      traceCopy('hide', slide, context);
      return state;
    },
    gather(slide, context) { return claimCopy(slide, context, 'gathering'); },
    pending(slide, context) {
      const state = copyStates.get(slide);
      return state?.context === context && ['hidden', 'revealing'].includes(state.phase);
    },
    completion(slide) { return copyStates.get(slide)?.done || Promise.resolve('completed'); },
    show(slide, context = window.deckNav, expected = null) { return endCopy(slide, false, context, expected); },
    retire(slide, context = window.deckNav, expected = null) { return endCopy(slide, true, context, expected); },
    reconcile(context) {
      if (!context?.isCurrent()) return false;
      let complete = true;
      slides.forEach(slide => { if (!endCopy(slide, slide !== slides[context.to], context)) complete = false; });
      // Orphaned surfaces can be disposed, never promoted to selected copy.
      for (const el of [...overlays.keys()]) if (!el.closest('.slide')) removeOverlay(el);
      return complete;
    },
    paint(el, at, r, bounds, state) {
      const slide = el.closest('.slide');
      if (!ownsCopy(slide, state, true)) return false;
      paintCopy(el, at, r, false, bounds);
      return true;
    },
    get liveCloneCount() {
      return overlays.size;
    },
  };
  const reach = (el, at, bounds) => {
    const b = bounds || el.getBoundingClientRect();
    return Math.max(...[[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]]
      .map(([x, y]) => Math.hypot(x - at.x, y - at.y))) + SOFT;
  };
  // These forward arrivals keep their picture pace and let only the copy breathe.
  const copyExtra = (context) => {
    if (!(context?.dir > 0) || context.direct || context.rest) return 0;
    if (context.from === 0 && context.to === 1) return 1500;
    // Slide 4's words start when they did and take a second longer to arrive.
    if (context.from === 2 && context.to === 3) return 1000;
    // Slide 8 too: a second more on screen, on its 1.3× arrival clock.
    if (context.from === 6 && context.to === 7) return 1300;
    // Slide 7 arrives on a quickened clock (deckStoryPacing, 1.45×). Its words
    // keep slide 2's unhurried spread: about two seconds on screen.
    if (context.from === 5 && context.to === 6) return 2000;
    return (context.from === 3 && context.to === 4) || (context.from === 4 && context.to === 5) ? 500 : 0;
  };
  // A step back unwinds: the words return by the gather played backwards, not
  // by a second forward entrance. It runs at a third of the gather's speed
  // (1.2 s on screen, whatever pace the step back runs at), so the words come
  // back alongside the picture's own reverse instead of snapping in ahead of it.
  const unwinding = (context) => context?.dir < 0 && !context.direct;
  const UNWIND = 3; // how many times longer than the gather its reverse takes
  const unwindMs = () => GATHER * UNWIND * (window.deckPace?.() || 1);
  // On a step back the words land with the picture. Each reverse picture's length on
  // the deck clock (ms from the turn's start to its landing), by the slide stepped back
  // from: measured, and the same within a few percent on phone and desktop screens.
  const REVERSE_PICTURE = [0, 2240, 1965, 3320, 2250, 3860, 4720, 2725, 2700, 1640, 1620];
  const UNWIND_FLOOR = 700; // wall ms: the shortest the unwind may be squeezed to when the words had to wait
  // Step-backs set by eye where landing together is not what reads best, by the slide stepped
  // back from, in ms on screen: when the unwind starts, how long it takes, and (free) whether it
  // may start while the picture is still passing over the words' place.
  const UNWIND_TUNE = {
    10: { start: 0, length: 670, free: true }, // 11→10: from the start of the wheel's return, as long as before
    9: { start: 0, length: 1200, free: true }, // 10→9: with the wheel's return, not after it
    8: { start: 1470, length: 700 },           // 9→8: as the picture above arrives
    7: { start: 370, length: 785, free: true }, // 8→7: half a second sooner, as long as before
    4: { start: 680, length: 660, free: true }, // 5→4: half a second sooner, as long as before
  };
  const landings = new WeakMap(); // navigation → { at: deck time its reverse picture lands, length: a tuned unwind (deck ms) }
  const pictureLands = (context) => unwinding(context) && context.to === context.from - 1 ? REVERSE_PICTURE[context.from] || 0 : 0;
  // As long as the full unwind when there is room for it before the landing; shorter,
  // down to the floor, when the picture kept the words waiting past that point.
  const unwindFor = (context) => {
    const full = unwindMs(), landing = landings.get(context);
    if (!landing) return full;
    return landing.length || clamp(landing.at - context.now(), UNWIND_FLOOR * (window.deckPace?.() || 1), full);
  };
  const revealDuration = (slide, at, context) => unwinding(context) ? unwindMs()
    : Math.max(0, ...textOf(slide).map((el) => clamp(reach(el, at, context?.geometry?.box(el)) / 0.62, 1100, 1600) + copyExtra(context)));
  // Points spread through a text block, for threads to run to or from.
  const spots = (el, n, bounds) => {
    const b = bounds || el.getBoundingClientRect();
    return Array.from({ length: n }, (_, i) => ({
      x: b.left + b.width * (0.08 + 0.84 * rnd()),
      y: b.top + b.height * ((i + 0.3 + rnd() * 0.4) / n),
    }));
  };
  const seep = (k) => 0.5 - 0.5 * Math.cos(Math.PI * k); // gentle in, gentle out
  const easeIn = (k) => k * k * (3 - 2 * k) * k;
  const easeUnwind = (k) => 1 - easeIn(1 - k); // the gather's own curve, run backwards
  const textTweens = new Set(), textTweensByContext = new Map();
  const tween = (duration, ease, step, delay = 0, context = window.deckNav) => {
    let raf = 0, stopped = false, resolve;
    const p = new Promise((r) => { resolve = r; });
    const started = context.now();
    const blocked = () => document.getElementById('overview')?.classList.contains('on');
    const tick = () => {
      raf = 0;
      if (stopped || blocked()) return;
      if (!context.isCurrent() || context.terminal) { p.stop(); return; }
      const elapsed = context.now() - started - delay;
      const k = clamp(elapsed / (typeof duration === 'function' ? duration() : duration));
      if (elapsed >= 0) step(ease(k));
      if (k < 1) raf = requestAnimationFrame(tick); else { stopped = true; resolve('completed'); }
    };
    // Text can still be revealing when a slide's build is paused.
    const syncMotion = () => {
      if (stopped) return;
      if (blocked()) { cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener('deck-overview', syncMotion);
    p.then(() => {
      textTweens.delete(p);
      const owned = textTweensByContext.get(context);
      owned?.delete(p);
      if (owned && !owned.size) textTweensByContext.delete(context);
      window.removeEventListener('deck-overview', syncMotion);
    });
    syncMotion();
    p.stop = () => { if (stopped) return; stopped = true; cancelAnimationFrame(raf); resolve('cancelled'); };
    textTweens.add(p);
    if (!textTweensByContext.has(context)) textTweensByContext.set(context, new Set());
    textTweensByContext.get(context).add(p);
    const release = context.transitionDefer(p.stop);
    p.then(release);
    return p;
  };
  const stopText = (context) => {
    const owned = context ? textTweensByContext.get(context) : textTweens;
    [...(owned || [])].forEach((tw) => tw.stop());
  };

  // Threads run from the node down into the text, and the words appear where
  // they reach. The circle's edge keeps pace with the threads' tips.
  // The final forward visit can breathe before the wheel has fully cleared.
  // Its original clearance still anchors the end: no scene hold is shortened.
  const gentleTiming = (context) => {
    const started = context.now();
    let readyAt = null;
    context.textReady.then((result) => {
      if (result === 'completed' && context.isTransitionCurrent()) readyAt = context.now();
    });
    return (base) => {
      const leadCurve = (elapsed) => {
        const q = Math.max(0, elapsed) / base;
        return { value: 0.5 * (1 - Math.exp(-q * q)), slope: q * Math.exp(-q * q) / base };
      };
      return {
        duration: () => (readyAt ?? context.textDeadline) - started + base,
        ease: () => {
          const elapsed = context.now() - started;
          if (readyAt === null) return leadCurve(elapsed).value;
          const first = leadCurve(readyAt - started), q = clamp((context.now() - readyAt) / base);
          // Hermite continuation preserves the gentle speed at clearance and
          // eases to rest at precisely the original reveal's completion time.
          return (2 * q ** 3 - 3 * q ** 2 + 1) * first.value
            + (q ** 3 - 2 * q ** 2 + q) * first.slope * base
            + (-2 * q ** 3 + 3 * q ** 2);
        },
      };
    };
  };
  const reveal = (s, at, delay = 0, context = window.deckNav, timing = null) => {
    if (!context.isTransitionCurrent()) return [];
    // All slides use the same owner and their existing rendering paths.
    const state = copy.hide(s, context, at, delay + revealDuration(s, at, context) + (timing ? Math.max(0, context.textDeadline - context.now()) : 0) + 400);
    if (!state) return [];
    state.phase = 'revealing';
    const tw = [];
    for (const el of textOf(s)) {
      const bounds = context.geometry?.box(el);
      // The third slide's copy spreads from its upper right on every layout,
      // even where the mobile label and the travelling node sit on the left.
      const origin = el.matches('.gap-copy') && context.from === 1
        ? { x: (bounds || el.getBoundingClientRect()).right, y: at.y }
        : at;
      copy.paint(el, origin, 0, bounds, state);
      const far = reach(el, origin, bounds);
      const back = unwinding(context) && !timing;
      const duration = back ? unwindFor(context) : clamp(far / 0.62, 1100, 1600) + copyExtra(context);
      if (!still) {
        for (const p of spots(el, back ? 6 : 7, bounds)) {
          const pts = wander(at, p);
          const d = lengths(pts).at(-1);
          // The gather's threads, running out from the node instead of into it.
          if (back) hypha(pts, { width: 0.6, alpha: 0.3, depth: 1, fade: 0.7, rest: 0, duration: duration / 1000 * 0.95, owner: context, delay: delay / 1000 });
          else hypha(pts, { width: 0.6, alpha: 0.3, depth: 1, fade: 1.1, rest: 0, smooth: true, owner: context, delay: delay / 1000, duration: ((duration + (timing ? 1000 : 0)) / 1000) * clamp(d / (far - SOFT), 0.3, 1) });
        }
      }
      const motion = timing?.(duration);
      const run = tween(motion?.duration || duration, motion?.ease || (back ? easeUnwind : seep), (k) => {
        if (!s.classList.contains('on')) return;
        if (copyStates.get(s) !== state) return;
        copy.paint(el, origin, k * far, context.geometry?.box(el), state);
      }, delay, context);
      tw.push(run);
    }
    Promise.all(tw).then((results) => {
      if (copyStates.get(s) === state && results.every((result) => result === 'completed') && context.isCurrent() && !context.terminal) {
        copy.show(s, context, state);
      }
    });
    return tw;
  };
  copy.reveal = reveal;
  // Threads reach across the text and draw it back into the node.
  const GATHER = 400;
  const gather = (s, at, context) => {
    const tw = [];
    const state = copy.gather(s, context);
    if (!state) return tw;
    for (const el of textOf(s)) {
      const bounds = context.geometry?.box(el);
      const saved = masks.get(el), centre = saved?.at || at, far = saved?.r ?? reach(el, at, bounds);
      copy.paint(el, centre, far, bounds, state);
      for (const p of spots(el, 6, bounds)) {
        hypha(wander(p, at), { width: 0.6, alpha: 0.3, depth: 1, fade: 0.7, rest: 0, duration: 0.38, owner: context });
      }
      const run = tween(GATHER, easeIn, (k) => {
        if (copyStates.get(s) === state && !s.classList.contains('on')) copy.paint(el, centre, (1 - k) * far, context.geometry?.box(el), state);
      }, 0, context);
      tw.push(run);
    }
    Promise.all(tw).then((results) => {
      if (copyStates.get(s) === state && results.every((result) => result === 'completed') && context.isCurrent() && !s.classList.contains('on')) copy.retire(s, context, state);
    });
    return tw;
  };
  // How far into the gather (ms) the new text starts growing from its node: OVERLAP of the way, so its first words
  // show as the old is about half drawn in; or, where the two nodes are close, once what is left of the old text no
  // longer reaches the new node, so the two never show in the same place.
  const OVERLAP = 0.3;
  const overlap = (s, from, to, context) => {
    const d = Math.hypot(to.x - from.x, to.y - from.y);
    let k = OVERLAP;
    for (const el of textOf(s)) { const far = reach(el, from, context.geometry?.box(el)); while (k < 1 && (1 - easeIn(k)) * far > d) k += 0.02; }
    return Math.min(1, k) * GATHER;
  };
  let current = null, visit = null;
  const finishNetwork = (context) => {
    if (context.isCurrent()) {
      // Network completion reports its milestone only. The controller's terminal
      // transaction owns settlement; no resource collection can show/hide text.
      traceCopy('finish', slides[context.to], context);
      if (visit?.context === context) visit.resolve('completed');
    }
  };
  let anchor = null, turning = null;
  if (window.__deckDebug) Object.defineProperty(window.__deckDebug, 'network', { get: () => ({
    current: current ? slides.indexOf(current) : null,
    turning: turning?.context?.generation ?? null, visit: visit?.context?.generation ?? null,
    textTweens: textTweens.size, zones: zones.length, hyphae: hyphae.length, baked: baked.length,
    canvas: [net.width, net.height],
  }) });
  // The thread each slide's node was reached by, from the slide before: a step back runs back along it.
  const trails = new Map();
  const trailBack = (prev, next, from, to) => {
    const t = trails.get(prev);
    if (!t || t.prev !== next) return null;
    const a = t.pts[0], b = t.pts.at(-1);
    if (Math.hypot(a[0] - to.x, a[1] - to.y) > 24 || Math.hypot(b[0] - from.x, b[1] - from.y) > 24) return null; // moved since (a resize)
    return [[from.x, from.y], ...t.pts.slice(1, -1).reverse().map(([x, y]) => [x, y]), [to.x, to.y]];
  };
  let drift = { x: 0, y: 0 }, trail = { x: 0, y: 0 }, t = 0, last = 0;
  // Each arrival restarts the tiny idle wander from its landing point.
  // Otherwise the sine's current phase adds a visible 1–2px hop immediately
  // after the motion finishes, particularly obvious on backward navigation.
  let driftBlend = 0;
  const put = { x: NaN, y: NaN }; // where the idle text was last put (none since it was last cleared)

  // Idle: the node wanders a pixel or two; the text follows a beat behind.
  let idleRaf = 0;
  const canDrift = () => active() && !document.getElementById('overview')?.classList.contains('on') && !still;
  const syncIdle = () => {
    if (!canDrift()) { if (idleRaf) cancelAnimationFrame(idleRaf); idleRaf = 0; last = 0; return; }
    if (!idleRaf) { last = 0; idleRaf = requestAnimationFrame(idle); }
  };
  const idle = (now) => {
    idleRaf = 0;
    if (!canDrift()) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    idleRaf = requestAnimationFrame(idle);
    if (turning || !anchor) return;
    t += dt;
    driftBlend = Math.min(1, driftBlend + dt / 1.7);
    const blend = driftBlend * driftBlend * (3 - 2 * driftBlend);
    drift = { x: blend * 1.8 * Math.sin(t * 0.45), y: blend * 1.3 * Math.sin(t * 0.31 + 1) };
    const k = 1 - Math.exp(-1.6 * dt);
    trail.x += (drift.x * 0.7 - trail.x) * k;
    trail.y += (drift.y * 0.7 - trail.y) * k;
    place({ x: anchor.x + drift.x, y: anchor.y + drift.y });
    // The text is moved only once it has drifted an eighth of a device pixel from where it was last put (at most
    // 0.6 px/s, most frames move it by far less), so a frame that would not change what is seen repaints nothing.
    const e = 1 / (8 * (devicePixelRatio || 1));
    if (!(Math.abs(trail.x - put.x) < e && Math.abs(trail.y - put.y) < e)) {
      put.x = trail.x; put.y = trail.y;
      textOf(current).forEach((el) => {
        if (!stableCopy(el)) el.style.transform = `translate(${trail.x.toFixed(2)}px, ${trail.y.toFixed(2)}px)`;
      });
    }
  };
  window.addEventListener('deck-overview', syncIdle);
  window.addEventListener('deck-motion', () => {
    still = window.deckStill();
    if (still && active()) {
      endOpening();
      settle(true);
    }
    syncIdle();
  });
  syncIdle();

  const pulse = (k) => core.animate([{ transform: 'scale(1)' }, { transform: `scale(${k})` }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' });

  // ---- The name, the opening and the ending ----------------------------------
  // The site's wordmark. On first load it sits beneath the mark, then settles
  // small into the deck's footer, left of the progress bar, like the site's own
  // signature: onto the footer's invisible copy of it (.chrome .brand).
  const name = document.createElement('a');
  name.className = 'dt-name';
  name.href = '/';
  name.target = '_blank';
  name.rel = 'noopener';
  name.textContent = 'Mycelial';
  name.setAttribute('aria-label', 'Mycelial home');
  name.tabIndex = -1;
  name.setAttribute('aria-hidden', 'true');
  document.body.appendChild(name);
  // On the screen's pixel grid, so the wordmark's own layer is never resampled half a pixel over.
  const onGrid = (v) => Math.round(v * (devicePixelRatio || 1)) / (devicePixelRatio || 1);
  const nameAt = (x, y, k) => `translate(${onGrid(x)}px, ${onGrid(y)}px) translateY(-50%) scale(${k})`;
  // How far below the mark's middle the wordmark's middle sits in the opening: the ring's radius, a clear gap, then the
  // rise of the caps above the middle of the 22 px line (DM Sans caps are 0.7 em tall and top out 0.28 em above it).
  // The gap is most of a cap height plus a little of the mark, so a phone's small mark still reads as a lockup with its
  // name and a desktop's large one keeps its proportion. The same as the gate's (gate.html), so the hand-off holds still.
  const nameDrop = (size) => size / 2 + (0.8 * 0.7 * 22 + 0.07 * size) + 0.28 * 22;
  const nameSlot = document.querySelector('.chrome .brand');
  const nameCorner = () => {
    const r = nameSlot && nameSlot.getBoundingClientRect();
    if (!r || !r.width) return nameAt(Math.max(16, innerWidth * 0.024), innerHeight - 62, 0.58);
    return nameAt(r.left, r.top + r.height / 2, parseFloat(getComputedStyle(nameSlot).fontSize) / 22);
  };
  const nameRest = () => {
    name.getAnimations().forEach((a) => a.cancel());
    name.style.transform = nameCorner();
    name.classList.add('is-resting');
    name.classList.toggle('is-on', active());
    name.classList.add('is-home');
    name.tabIndex = 0;
    name.removeAttribute('aria-hidden');
  };

  // The closing slide uses the Mycelial mark in the label's reserved space.
  const deck = () => slides.filter((sl) => (sl.dataset.v || '').split(' ').includes(VER));
  const lastSlide = () => deck().at(-1);
  const levelOf = (s) => Math.max(0, deck().indexOf(s));
  const crownAt = () => {
    const at = anchorOf(lastSlide());
    return at && { x: at.x, y: at.y, size: 54 };
  };
  // On entry the arriving node grows into the mark. Returning to slide 10 can still fold it back into the wheel's
  // central glow, following the wheel's progress. Its surface is drawn once; only its transform and opacity move.
  let following = null; // { glow, back }
  const crown = (at, now, glow) => {
    // A reversal resumes the very same mark at the wheel's current progress.
    if (glow && mark?.crown && following) {
      following = { glow, back: false };
      return;
    }
    if (!now && !glow && mark && mark.crown && mark.folding === undefined) return; // already growing out of the glow
    const c = crownAt() || { x: at.x, y: at.y, size: 54 };
    mark = { x: c.x, y: c.y, t: now ? 2 : -0.2, size: c.size, shrink: 0, trail: null, shed: 0, crown: true, faint: 0.75 };
    try {
      const z = disc(mark.x, mark.y, c.size * 0.42, lastSlide());
      if (z) zones.push(Object.assign(z, { crown: true, a: now ? 1 : 0 }));
    } catch { /* The mark still works without its softening disc. */ }
    markCv.getAnimations().forEach((a) => a.cancel());
    markCv.style.transform = markCv.style.opacity = markCv.style.transition = '';
    following = glow ? { glow, back: false } : null;
    if (glow) { markCv.style.transition = 'none'; followAt(0); } // it follows the wheel frame by frame, not its own fade
    else if (!now) markCv.animate([{ opacity: 1, scale: '0.11' }, { opacity: 1, scale: '1' }], { duration: 850, easing: 'cubic-bezier(.22,.7,.2,1)', fill: 'backwards' });
    wake();
  };
  const followAt = (f) => {
    // The glow's radius is atmospheric, not the size of the emerging mark.
    // Starting at half-size made the visible growth almost imperceptible.
    const g = following.glow, q = clamp(f), s = 0.08;
    if (q >= 1) { markCv.style.transform = markCv.style.opacity = ''; return; }
    markCv.style.transform = `translate(${((g.x - mark.x) * (1 - q)).toFixed(1)}px, ${((g.y - mark.y) * (1 - q)).toFixed(1)}px) scale(${(s + (1 - s) * q).toFixed(4)})`;
    const o = clamp(q / 0.15);
    markCv.style.opacity = (o * o * (3 - 2 * o)).toFixed(3);
  };
  window.AstridMark = {
    follow(f) {
      if (!following || !mark || !mark.crown) return;
      followAt(f);
      if (!following.back && f >= 1) { following = null; markCv.style.transition = ''; } // grown: at rest in its own place
      else if (following.back && f <= 0) { following = null; mark = null; drawMarkLayer(); markCv.style.transform = markCv.style.opacity = markCv.style.transition = ''; wake(); } // gone into the glow
    },
  };
  // Leaving the last slide the mark folds into its middle; back to slide 10 (glow given) the wheel runs its growth
  // backwards instead (follow), shrinking it back into the glow at the wheel's middle.
  const uncrown = (glow) => {
    if (!mark || !mark.crown) return;
    markCv.getAnimations().forEach((a) => a.cancel());
    if (glow) { following = { glow, back: true }; markCv.style.transition = 'none'; return; }
    following = null;
    markCv.style.transform = markCv.style.opacity = markCv.style.transition = '';
    mark.folding = 0; // step() times it; the canvas folds into its middle as it fades
    const cs = getComputedStyle(markCv), from = { opacity: cs.opacity, scale: cs.scale === 'none' ? '1' : cs.scale };
    markCv.animate([from, { opacity: 0, scale: '0.06' }], { duration: 500, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
    wake();
  };

  // First load: the mark draws itself in the middle of the screen over its
  // name, then rides a growing thread out to the slide's node, shrinking and
  // shedding its nodes into the network; the name settles into the corner;
  // where the mark lands the text is revealed and the slide fades in.
  let opening = null, openingPending = true;
  const endOpening = () => {
    openingPending = false;
    window.__deckIntro?.clearGate();
    window.__deckIntro?.showChrome();
    html.classList.remove('dt-intro', 'dt-unveil');
    if (!opening) return;
    opening.timers.forEach(window.deckCancelLater);
    if (opening.trail) opening.trail.onDone = null;
    opening = null;
    mark = null;
    dot.classList.remove('is-moving');
    nameRest();
  };
  const open = (context) => {
    const target = current;
    if (!active() || still || !current || !anchor) return false;
    const intro = window.__deckIntro, gate = intro?.gate;
    const placed = gate && gate.w === innerWidth && gate.h === innerHeight &&
      [gate.x, gate.y, gate.size].every(Number.isFinite) && gate.size > 0;
    const size = placed ? gate.size : Math.min(innerWidth, innerHeight) * 0.2;
    // Without a gate to take over from, the lockup (the mark with its name beneath) is centred as one shape: the
    // mark alone on the middle line leaves the pair sitting low, by half of what the name adds below it.
    const lift = (nameDrop(size) + 0.35 * 22 - size / 2) / 2;
    const c = placed ? { x: gate.x, y: gate.y } : { x: innerWidth / 2, y: innerHeight / 2 - lift };
    html.classList.add('dt-intro');
    dot.classList.add('is-moving');
    copy.hide(current, context, anchor, 5000);
    clearNet();
    mark = { x: c.x, y: c.y, t: gate ? 1.6 : 0, size, shrink: 0, trail: null, shed: 0 };
    markCv.getAnimations().forEach((an) => an.cancel());
    wake();
    opening = { context, timers: [], trail: null };
    name.classList.remove('is-home');
    name.tabIndex = -1;
    name.setAttribute('aria-hidden', 'true');
    name.classList.remove('is-resting');
    name.style.transform = nameAt(c.x - name.offsetWidth / 2, c.y + nameDrop(size), 1); // beneath the mark, clear of it
    name.style.transitionDelay = gate ? '' : '.35s';
    name.classList.add('is-on');
    if (gate) {
      // Swap the poster for finished live art in this task, with no empty frame.
      draw();
      intro.poster?.remove();
      delete intro.poster;
      html.style.background = '';
    }
    const land = () => {
      if (!context.isCurrent() || context.terminal) return;
      opening = null;
      mark = null;
      html.classList.add('dt-unveil'); // fade in from here on, never out
      html.classList.remove('dt-intro');
      window.deckLater(() => html.classList.remove('dt-unveil'), 1300, context);
      place(anchor);
      dot.classList.remove('is-moving'); pulse(1.8); bloom(anchor);
      if (current === lastSlide()) crown(anchor);
      window.deckArrived(context);
      if (copy.pending(target, context)) copy.reveal(target, anchor, 60, context);
      copy.completion(target).then((result) => { if (result === 'completed') finishNetwork(context); });
      sprawl(levelOf(current), anchor, 0.15);
    };
    opening.timers.push(window.deckLater(() => {
      if (!opening) return;
      if (gate) {
        html.classList.add('dt-gate-turn');
        intro.gateFade = document.querySelector('.chrome').animate([{ opacity: 0 }, { opacity: 1 }],
          { duration: 1400, easing: 'ease', fill: 'forwards' });
        intro.gateFade.finished.then(() => intro.clearGate()).catch(() => {});
      } else if (html.classList.contains('dt-chrome-wait')) {
        intro.chromeFade = document.querySelector('.chrome').animate([{ opacity: 0 }, { opacity: 1 }],
          { duration: 1400, easing: 'ease', fill: 'forwards' });
        intro.chromeFade.finished.then(() => intro.showChrome()).catch(() => {});
      }
      name.style.transitionDelay = '';
      name.classList.add('is-resting');
      const glide = name.animate([{ transform: name.style.transform }, { transform: nameCorner() }],
        { duration: 1400, easing: 'cubic-bezier(.6,0,.25,1)', fill: 'forwards' });
      glide.finished.then(() => { if (!opening || opening.trail?.done) nameRest(); }).catch(() => {});
      const pts = wander(c, anchor);
      const total = lengths(pts).at(-1);
      opening.trail = mark.trail = hypha(pts, { width: 1.05, alpha: 0.55, duration: clamp(total / 700, 0.9, 1.5), smooth: true, branches: plan(total, 0), onDone: land });
    }, gate ? 160 : 1700));
    return true;
  };

  // The node's own tuft and anything passing go; whatever else is growing settles where it is.
  const keepGround = () => {
    hyphae = hyphae.filter((h) => !h.keep && h.rest > 0);
    nodes = nodes.filter((n) => !n.keep && n.rest);
    mark = null;
    ripen();
  };
  // wipe: start the network afresh (first load, switching version); otherwise the ground stays (a resize, a jump).
  const settle = (grow, wipe, context = window.deckNav, announce = true) => {
    const targetSlide = Number.isInteger(context?.to) ? slides[context.to] : current;
    if (targetSlide) current = targetSlide;
    if (turning?.context === context) turning.cancel();
    stopText(context);
    if (active()) adopt(); else restore();
    [slides[context.from], slides[context.to]].filter(Boolean).forEach((sl) => context.present(sl, '', 'dt-leaving dt-release'));
    copy.reconcile(context);
    trail = { x: 0, y: 0 }; drift = { x: 0, y: 0 }; driftBlend = 0;
    anchor = targetSlide ? anchorOf(targetSlide) : null;
    const on = active() && !!anchor;
    dot.classList.toggle('is-on', on);
    net.classList.toggle('is-on', on);
    markCv.classList.toggle('is-on', on);
    dot.classList.remove('is-moving');
    if (wipe) clearNet(); else keepGround();
    nameRest();
    const ch = safeZone(chromeEls, chromeKey);
    chrome = ch && Object.assign(ch, { a: 1 });
    const z = on && safeZone(() => lines(targetSlide), targetSlide);
    zones = z ? [Object.assign(z, { a: 1 })] : [];
    draw();
    if (!on) return;
    place(anchor);
    if (announce) {
      window.deckArrived(context);
      if (still) finishNetwork(context);
    }
    if (still || (context.direct && !context.intro)) { // direct loads also need the network at this slide's full reach
      sprawl(levelOf(targetSlide), anchor);
      ripen();
      if (targetSlide === lastSlide()) crown(anchor, true);
      draw();
      return;
    }
    bloom(anchor);
    if (!grow) { hyphae.forEach((h) => { h.age = 0; h.grown = h.total; h.done = true; h.after = 5; h.glow = target(h); }); blooms = []; }
    if (targetSlide === lastSlide()) crown(anchor, !grow);
    draw();
  };

  const turn = (prev, next, context) => {
    const started = context.now();
    if (turning) turning.cancel();
    const tweens = [], timers = [], anims = [];
    let done = false, landed;
    const finish = () => { if (!done) { done = true; turning = null; } };
    const transition = {
      context,
      cancel() {
        // A completed reveal can still have an outgoing retirement pending.
        // The next visit owns copy initialization and presentation retirement.
        timers.forEach(window.deckCancelLater);
        if (done) return;
        done = true;
        landed?.('cancelled');
        tweens.forEach((tw) => tw.stop());
        // Cancellation stops this turn; copy ownership transfers without repainting.
        anims.forEach((a) => a.cancel());
        // Retire only this interrupted turn's transient drawing, not ambient growth.
        hyphae = hyphae.filter((h) => h.owner !== context);
        nodes = nodes.filter((n) => n.owner !== context);
        dot.classList.remove('is-moving');
        if (anchor) place(anchor);
        turning = null;
      },
    };
    turning = transition;
    context.transitionDefer(() => transition.cancel());
    const from = { x: (anchor ? anchor.x : 0) + drift.x, y: (anchor ? anchor.y : 0) + drift.y };
    const glow = (s) => !still && window.AstridFlywheel?.glow(s); // slide 10's glow, between it and the last slide
    uncrown(prev === lastSlide() && next === deck().at(-2) && glow(1));
    zones.forEach((z) => { z.to = 0; z.wait = z.crown ? 0.2 : 0.45; }); // the old text's softening lifts once it is drawn in
    wake();

    // 1. Threads reach across the old text and draw it back into its node.
    context.present(prev, 'dt-leaving');
    // Start the outgoing clock before measuring and initializing the next
    // slide, so expensive layout work counts towards the gather.
    tweens.push(...gather(prev, from, context));
    current = next;
    const to = context.geometry?.anchor || anchorOf(next) || from;
    // The final mark shares the wheel's clock and starts at the same central
    // glow into which it folds on the return trip.
    const wheelGlow = next === lastSlide() && prev === deck().at(-2) && glow(1);
    if (wheelGlow) crown(to, false, wheelGlow);
    // Give these pictures a moment to establish themselves before their copy grows.
    const pictureLead = context.dir > 0 && [2, 3, 5].includes(context.to) ? 800 : 0;
    const gentleFinal = context.from === slides.length - 2 && context.to === slides.length - 1 && context.dir > 0 && !context.rest;
    // Upright cards cross the copy later. Bound their head start as well, so
    // the slow reveal begins about a second before its former visible onset.
    const finalLead = gentleFinal && innerWidth <= 760 && innerHeight > innerWidth ? 1100 : 0;
    // A step back: start the unwind so that it ends as the reverse picture lands.
    const lands = pictureLands(context), tune = lands ? UNWIND_TUNE[context.from] : null;
    const onScreen = window.deckPace?.() || 1; // deck ms per ms on screen, for this turn
    if (lands) landings.set(context, { at: started + lands, length: tune ? tune.length * onScreen : 0 });
    let early = tune ? tune.start * onScreen
      : Math.max(overlap(prev, from, to, context), pictureLead, finalLead, lands ? lands - unwindMs() : 0);
    // The original hold also bounds recovery for the longer final reveal.
    const revealAt = Math.max(started + early, context.textDeadline);
    const copyVisit = copy.hide(next, context, to, Math.max(0, revealAt - context.now()) + revealDuration(next, to, context) + 400);
    anchor = to;
    drift = { x: 0, y: 0 }; trail = { x: 0, y: 0 }; driftBlend = 0;
    // Other routes still grow the closing mark when the node arrives below.

    // The new text grows from its node while the old is still being drawn in (overlap), or once a picture crossing
    // its place has cleared, the node's travel running alongside; the turn is done once the text is whole
    // and the node has arrived.
    const reached = new Promise((r) => { landed = r; });
    Promise.all([copyVisit.done, reached]).then((results) => {
      if (done || context.terminal || !context.isCurrent() || results.some((result) => result !== 'completed')) return;
      finish(); finishNetwork(context);
    });
    const grow = () => {
      if (done || context.terminal || !context.isCurrent() || !copy.pending(next, context)) return;
      const shown = copy.reveal(next, to, 0, context, gentleFinal ? gentleTiming(context) : null);
      tweens.push(...shown);
      try {
        const z = zone(lines(next), next);
        if (z) zones.push(z);
      } catch { /* Copy reveal continues if softening cannot be drawn. */ }
    };
    // 3. Arrival: the node blooms (or, on the last slide, becomes the mark).
    const arrive = () => {
      if (done || context.terminal || !context.isCurrent()) return;
      place(to);
      dot.classList.remove('is-moving'); anims.push(pulse(1.8)); bloom(to);
      if (next === lastSlide()) crown(to);
      window.deckArrived(context);
      context.present(prev, 'dt-release'); // the old slide may fade now; its parts stay hidden
      timers.push(window.deckLater(() => {
        if (prev.classList.contains('on')) return;
        context.present(prev, '', 'dt-leaving dt-release');
        copy.retire(prev, context);
      }, 700, context));
      landed('completed');
    };

    // 2. The network grows across to the next node, or simply re-blooms in place.
    const travel = () => {
      if (done || context.terminal || !context.isCurrent()) return;
      release();
      sprawl(levelOf(next), from);
      const far = Math.hypot(to.x - from.x, to.y - from.y) > 6;
      if (!far) { arrive(); return; }
      dot.classList.add('is-moving');
      // A step back runs back along the thread it came by, lighting it as it passes; no new thread grows.
      const way = window.deckNav?.back ? trailBack(prev, next, from, to) : null;
      const pts = way || wander(from, to);
      const total = lengths(pts).at(-1);
      hypha(pts, { width: 1.05, alpha: 0.55, duration: clamp(total / 950, 0.45, 1.05), onDone: arrive, owner: context, ...(way ? { rest: 0, fade: 2.4 } : { branches: plan(total, 0) }) });
      if (!way && (window.deckNav?.dir || 0) > 0) trails.set(next, { prev, pts });
    };
    let travelDue = true, textDue = true;
    // One clock owns both milestones. If the main thread wakes late, begin
    // already-due travel before starting text work in this same task.
    const advanceTurn = () => {
      if (done || context.terminal || !context.isCurrent()) return;
      let elapsed = context.now() - started;
      if (travelDue && elapsed >= 340) { travelDue = false; travel(); }
      elapsed = context.now() - started;
      if (textDue && elapsed >= early) {
        textDue = false;
        if (gentleFinal || tune?.free) grow();
        else context.textReady.then((result) => { if (result === 'completed' && context.isCurrent() && !context.terminal) grow(); });
      }
      if (travelDue || textDue) {
        const nextAt = Math.min(travelDue ? 340 : Infinity, textDue ? early : Infinity);
        timers.push(window.deckLater(advanceTurn, Math.max(0, nextAt - (context.now() - started)), context));
      }
    };
    timers.push(window.deckLater(advanceTurn, Math.max(0, Math.min(early, 340) - (context.now() - started)), context));
    // The expected landing is only a forecast. A picture that finishes sooner (or had no
    // reverse to play) never leaves the words waiting on it.
    if (lands) {
      const landed = (event) => {
        if (event.detail?.generation !== context.generation || event.detail.phase !== 'entry') return;
        // Its landing is now known, not forecast: words still to come follow at once, in the short unwind.
        landings.get(context).at = context.now();
        if (textDue && !tune) { early = 0; advanceTurn(); }
      };
      window.addEventListener('deck-phase', landed);
      context.transitionDefer(() => window.removeEventListener('deck-phase', landed));
    }
  };

  // Selection is output from the controller; it is no longer observed here.
  const enter = (context) => {
    const prev = current, next = slides[context.to];
    current = next;
    const promise = new Promise((resolve) => { visit = { context, resolve }; });
    const ownVisit = visit;
    context.transitionDefer(() => { ownVisit.resolve('cancelled'); });
    if (context.intro) {
      openingPending = true;
      context.transitionDefer(endOpening);
      settle(true, true, context, false);
      startOpening(context);
      return promise;
    }
    endOpening();
    html.classList.remove('dt-font-wait');
    if (context.direct) {
      settle(false, context.from === null, context);
      finishNetwork(context);
      if (document.fonts?.status === 'loading') document.fonts.ready.then(() => {
        if (context.isCurrent()) window.deckTransaction('fonts', context);
      });
      return promise;
    }
    if (!active() || still || (context.rest && !context.back) || !prev || prev.classList.contains('out')) {
      settle(true, false, context);
      if (active() && anchor && !still) {
        copy.reveal(next, anchor, 200, context);
        copy.completion(next).then((result) => { if (result === 'completed') finishNetwork(context); });
        if (!context.rest) sprawl(levelOf(current), anchor, 0.2);
      } else finishNetwork(context);
    } else turn(prev, next, context);
    return promise;
  };

  // Switching into F grows the node and runs the current slide's text out of it.
  let was = active();
  new MutationObserver(() => {
    const now = active();
    if (now === was) return;
    was = now;
    endOpening();
    settle(true, true);
    syncIdle();
    if (now && current && anchor && !still) { copy.reveal(current, anchor, 250); sprawl(levelOf(current), anchor, 0.25); }
  }).observe(html, { attributes: true, attributeFilter: ['data-ver'] });

  // A resize keeps the network (see size), growing it at once over ground a new shape of screen leaves bare;
  // the node, its tuft and the text's softening find their places.
  const resize = (context) => {
    const targetSlide = slides[context.to];
    if (targetSlide) current = targetSlide;
    const busy = turning || opening, tuft = busy ? [] : hyphae.filter((h) => h.keep);
    endOpening();
    window.deckArrived(context);
    keepGround();
    const was = anchor;
    anchor = targetSlide ? anchorOf(targetSlide) : null;
    if (size(was, anchor) && anchor && active()) { sprawl(levelOf(targetSlide), anchor); ripen(); }
    // A viewport change retires text work as well as node travel, including a
    // rest reveal that has no `turning` object. Completion belongs to this visit.
    if (busy || textTweens.size || overlays.size) {
      settle(false, false, context);
      if (targetSlide) finishNetwork(context);
      return;
    }
    if (was && anchor) for (const h of tuft) for (const p of h.pts) { p[0] += anchor.x - was.x; p[1] += anchor.y - was.y; }
    hyphae.push(...tuft);
    if (tuft.length) wake();
    if (anchor) place(anchor);
    nameRest();
    const ch = safeZone(chromeEls, chromeKey);
    chrome = ch && Object.assign(ch, { a: 1 });
    const z = active() && targetSlide && safeZone(() => lines(targetSlide), targetSlide);
    zones = z ? [Object.assign(z, { a: 1 })] : [];
    if (anchor && targetSlide === lastSlide()) crown(anchor, true);
    draw();
    if (targetSlide) finishNetwork(context);
  };
  // First navigation starts only after every scene has registered.
  const startOpening = (firstContext) => {
    const launchOpening = () => {
      if (!firstContext.isTransitionCurrent()) return;
      if (window.__deckIntro?.failed) {
        openingPending = false;
        settle(false, false, firstContext);
        finishNetwork(firstContext);
        return;
      }
      html.classList.remove('dt-font-wait');
      // Font readiness is page-scoped; it cannot restart an obsolete visit.
      if (!openingPending) {
        window.__deckIntro?.clearGate(); window.__deckIntro?.showChrome();
        html.classList.remove('dt-intro');
        return;
      }
      openingPending = false;
      if (!open(firstContext)) {
        window.__deckIntro?.clearGate();
        window.__deckIntro?.showChrome();
        html.classList.remove('dt-intro'); // hidden before first paint, but there is no opening to play
        window.deckArrived(firstContext);
        if (active() && current && anchor && !still) {
          copy.reveal(current, anchor, 350, firstContext);
          copy.completion(current).then((result) => { if (result === 'completed') finishNetwork(firstContext); });
          sprawl(levelOf(current), anchor, 0.3);
        } else finishNetwork(firstContext);
      }
    };
    if (window.__deckIntro) window.__deckIntro.initialized = true;
    if (!active() || still || !document.fonts) launchOpening();
    else {
      let started = false;
      const launch = () => { if (started) return; started = true; clearTimeout(ceiling); launchOpening(); };
      const ceiling = setTimeout(launch, 2500);
      firstContext.transitionDefer(() => clearTimeout(ceiling));
      try {
        const fonts = document.fonts;
        const needed = [
          fonts.load('400 22px "DM Sans"', 'MYCELIAL'),
          fonts.load('400 72px "Cormorant Garamond"', 'Mycelial'),
          fonts.load('italic 400 16px "Cormorant Garamond"', '01'),
          fonts.load('italic 500 72px "Cormorant Garamond"', 'Mycelial'),
          fonts.load('400 20px "EB Garamond"', 'Mycelial')
        ];
        Promise.allSettled([...needed, fonts.ready]).then(launch);
      } catch { launch(); }
    }
  };
  const finishText = (context) => {
    if (!context.isCurrent()) return false;
    // Recovery may complete textReady while the reveal's continuation is queued.
    // Stop its owner before clearing copy; every destination element is still
    // attempted if cancellation or another element's cleanup throws.
    let failed = false;
    const attempt = (fn) => { try { fn(); } catch (error) { failed = true; console.error('Deck text finalization failed', error); } };
    if (turning?.context === context) attempt(() => turning.cancel());
    if (opening?.context === context) attempt(endOpening);
    attempt(() => stopText(context));
    const destination = slides[context.to];
    if (!destination) return false;
    let complete = false;
    attempt(() => { complete = copy.reconcile(context); });
    if (complete) finishNetwork(context);
    return complete && !failed;
  };
  window.deckCopy = copy;
  // Opt-in diagnostics only. Read after capturing a failing screen: this getter
  // reports computed paint state without mutating it or scheduling repairs.
  if (window.__deckDebug) Object.defineProperty(window.__deckDebug, 'copy', { get: () => ({
    trace: copyTrace.slice(), surfaces: overlays.size, clones: copy.liveCloneCount,
    wheel: slides.filter((slide) => slide.matches('.fw-host')).map((slide) => ({
      slide: slides.indexOf(slide), active: slide.classList.contains('on'),
      settled: slide.hasAttribute('data-settled'), phase: copyStates.get(slide)?.phase,
      roots: textOf(slide).map((el) => {
        const style = getComputedStyle(el);
        return { hidden: el.classList.contains('dt-copy-hidden'), registered: overlays.has(el),
          spreading: el.classList.contains('fw-spreading'), outer: el.style.getPropertyValue('--fw-outer'),
          mask: style.maskImage || style.webkitMaskImage, visibility: style.visibility,
          opacity: style.opacity, transform: style.transform };
      }),
    })),
  }) });

  window.deckRegisterNetwork({ enter, resize, finish: finishText, copyRects, geometry });
})();
