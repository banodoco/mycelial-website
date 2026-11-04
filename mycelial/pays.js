// Version F, slide 7: how it pays. Above the text, in the deck's gold-thread
// language: on the left a few machines running Astrid locally (a terminal, a
// GPU, a node graph), the nerds who build on it; their threads converge into
// the core, slide 4's lens with the mink inside; past a dotted boundary, the
// core reaches out across widening arcs to a great many people, everyone else,
// on the hosted version. Pulses run from the builders into the core, and from
// the core outward, wave after wave. On an upright phone the story runs bottom
// to top: devices at the foot, the core above them, the crowd fanning out above.
// Arriving from slide 6, the pixel mink travels from the stack into the lens.
// Its core, builders and people are kept as data (window.AstridPays) so the next
// slide, the foundation, can carry the picture on.
(() => {
  const root = document.querySelector('[data-astrid-pays]');
  const M = window.AstridMink;
  if (!root || !M) return;
  const slide = root.closest('.slide');
  const canvas = root.querySelector('.pa-canvas');
  const g = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionOff = () => still || window.deckStill?.();
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const ease = (k) => 1 - Math.pow(1 - k, 3);
  const easeIO = (q) => (q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2);
  const THREAD = '240,200,119', NODE = '255,217,145', CORE = '255,241,214';
  const TAU = Math.PI * 2;

  // ---- Labels -------------------------------------------------------------------
  const tag = (cls, html) => {
    const el = document.createElement('div');
    el.className = `pa-ax ${cls}`;
    el.innerHTML = html;
    root.appendChild(el);
    return el;
  };
  const labels = {
    local: tag('pa-side', '<b>Nerds · local</b><span>Make it more capable</span>'),
    hosted: tag('pa-side', '<b>Everyone else · hosted</b><span>Pay for an easier way to create</span>'),
    core: tag('pa-core', 'Astrid'),
  };

  // A soft light, stamped wherever something glows.
  const glow = document.createElement('canvas');
  glow.width = glow.height = 128;
  {
    const sg = glow.getContext('2d');
    if (sg) {
      const rg = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
      rg.addColorStop(0, `rgba(${NODE},1)`); rg.addColorStop(0.35, `rgba(${NODE},0.35)`); rg.addColorStop(1, `rgba(${NODE},0)`);
      sg.fillStyle = rg; sg.fillRect(0, 0, 128, 128);
    }
  }
  const halo = (x, y, r, a) => { if (a <= 0.003 || r <= 0) return; g.globalAlpha = Math.min(1, a); g.drawImage(glow, x - r, y - r, r * 2, r * 2); g.globalAlpha = 1; };
  const dot = (x, y, r, color, a) => { if (a <= 0.003 || r <= 0) return; g.fillStyle = `rgba(${color},${Math.min(1, a).toFixed(3)})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
  const node = (x, y, size, a) => { if (a <= 0.003) return; const r = 2.6 * size * Math.max(0.7, k); halo(x, y, r * 4.4, 0.45 * a); dot(x, y, r, NODE, 0.95 * a); dot(x - r * 0.15, y - r * 0.2, r * 0.62, CORE, 0.9 * a); };

  // ---- Paths ------------------------------------------------------------------------
  const line = (pts) => {
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, len, total: len[len.length - 1] };
  };
  const at = (h, d) => {
    d = clamp(d, 0, h.total);
    let lo = 1, hi = h.len.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (h.len[m] < d) lo = m + 1; else hi = m; }
    const l0 = h.len[lo - 1], t = (d - l0) / ((h.len[lo] - l0) || 1);
    const [x0, y0] = h.pts[lo - 1], [x1, y1] = h.pts[lo];
    return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, i: lo };
  };
  const stroke = (h, d0, d1, w, color, a) => {
    if (a <= 0.003 || d1 <= d0) return;
    const p = at(h, d0), q = at(h, d1);
    g.lineWidth = w; g.strokeStyle = `rgba(${color},${Math.min(1, a).toFixed(3)})`;
    g.beginPath(); g.moveTo(p.x, p.y);
    for (let i = p.i; i < q.i; i++) g.lineTo(h.pts[i][0], h.pts[i][1]);
    g.lineTo(q.x, q.y); g.stroke();
  };
  const bez = (p0, c0, c1, p1, n = 32) => Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t;
    return [u * u * u * p0.x + 3 * u * u * t * c0.x + 3 * u * t * t * c1.x + t * t * t * p1.x, u * u * u * p0.y + 3 * u * u * t * c0.y + 3 * u * t * t * c1.y + t * t * t * p1.y];
  });

  // ---- Geometry -----------------------------------------------------------------------
  // Drawn in the reference's own units (1672 x 941), scaled by k about the middle.
  // The core: a lens centred at (750, 415), 136 wide and 226 tall, in those units.
  const CORE_REF = { cx: 750, cy: 415, w: 136, h: 226 };
  // On an upright phone the story is turned to run up the screen: reference x maps to height (ky above the lens's
  // middle, kyLow below it) and reference y to width (kx). On a narrow screen that is not upright the picture sits
  // above the text, positions stretched down by ky (across by k). Beside the text on
  // the left, it is laid out in the room to the right: positions stretch by kx across and ky down. Either way,
  // sizes (circles, the lens, the mink, dots) scale by k so nothing is squashed.
  let W = 0, H = 0, dpr = 1, k = 1, kx = 1, ky = 1, kyLow = 1, ox = 0, oy = 0, LW = 1, small = false, portraitFlow = false;
  const X = (rx, ry = 415) => portraitFlow ? ox + (ry - 415) * kx : ox + (rx - (small ? 836 : 150)) * (small ? k : kx);
  const Y = (ry, rx = 750) => portraitFlow ? oy - (rx - 750) * (rx > 750 ? ky : kyLow) : oy + (ry - 415) * ky;
  const P = (rx, ry) => ({ x: X(rx, ry), y: Y(ry, rx) });
  let seed = 1;
  const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  let machines = [], feeds = [], lens = null, lensLines = [], arcs = [], rays = [], boundary = null, cell = 3;

  const put = (el, x, y, alignX, alignY) => {
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.transform = `translate(${(x - w * alignX).toFixed(1)}px, ${(y - h * alignY).toFixed(1)}px)`;
  };
  const layout = () => {
    const b = root.getBoundingClientRect();
    if (!b.width || !b.height) return false;
    W = b.width; H = b.height;
    dpr = Math.min(2, Math.round(devicePixelRatio || 1) || 1);
    if (canvas.width !== Math.round(W * dpr)) canvas.width = Math.round(W * dpr);
    if (canvas.height !== Math.round(H * dpr)) canvas.height = Math.round(H * dpr);
    small = W <= 760 && (H >= W || H > 500); // a phone held upright (one on its side takes the wide layout)
    portraitFlow = small && H >= W;
    const num = slide.querySelector('.num'), top = num.getBoundingClientRect().top - b.top;
    const low = !small && H <= 500; // a phone on its side: less air round the picture, and the footer to clear
    // The side labels: larger and centred on their groups when upright; as styled otherwise.
    labels.local.style.fontSize = labels.hosted.style.fontSize = portraitFlow ? '14.5px' : '';
    labels.local.style.textAlign = labels.hosted.style.textAlign = portraitFlow ? 'center' : '';
    if (portraitFlow) {
      // Upright, the story runs up the screen: the builders' devices at the foot, Astrid above them, everyone else
      // fanning out above her. Reference x is turned upward (ky above the lens, kyLow below it) and reference y runs
      // across (kx). The hosted label crowns the fan; the local label sits under the devices, clear of the words.
      const capH = labels.hosted.offsetHeight, locH = labels.local.offsetHeight;
      const edge = Math.max(26, 0.045 * H);
      const crest = edge + capH + 14; // the far front's crest (reference x 1580)
      const foot = top - edge - locH - 10; // the devices' lower edge
      const q = 0.8; // the feeds rise a little less steeply than the fan, so the fan keeps its breadth
      kx = Math.min((W - 56) / 690, 0.62);
      ky = (foot - crest) / (830 + 537 * q + 52 * 1.3 * q); // first guess, sizes at about 1.3 ky
      k = Math.min(kx, 0.62, Math.max(0.28, 1.3 * ky));
      ky = (foot - crest - 52 * k) / (830 + 537 * q);
      kyLow = q * ky;
      ox = W / 2;
      oy = crest + 830 * ky; // the lens's middle
    } else if (small) { // narrow but not upright: the picture spans reference x 150..1580 and y 70..760
      // The picture and the words are one group (the phone CSS centres the words under the picture's
      // room): it stands half as tall again as its width allows, and its foot sits 34 px above the label.
      k = Math.min((W - 24) / 1430, (top - 74) / 690);
      ky = Math.min(1.5 * k, (top - 74) / 690);
      ox = W / 2 - 29 * k;
      oy = Math.max(40, top - 34 - 690 * ky) + 345 * ky;
    } else { // to the right of the text: from ~96 px past the text column to 64 px short of the edge, centred down the slide
      const column = slide.querySelector('.split > :first-child'), text = column.getBoundingClientRect();
      const left = text.right - b.left + (low ? 48 : 96), right = W - (low ? 32 : 64); // the builders keep ~96 px of air after the text
      kx = (right - left - 20) / 1430;
      ky = Math.min((H - (low ? 120 : 230)) / 690, 1.0);
      k = Math.min(ky, kx * 1.35, 1.05);
      ox = left + 52 * k - 63 * kx; // the builders' circles (reference x 213) sit just inside the left edge
      // The picture's middle (reference y 415, the lens) follows the whole text column, including its subtitle;
      // measured by layout (offsets), not by boxes, which the slide's entry and the text's drift move.
      let mid = column.offsetHeight / 2;
      for (let n = column; n && n !== slide; n = n.offsetParent) mid += n.offsetTop;
      oy = low ? (H - 64) / 2 : clamp(mid, 40 + 330 * ky, H - 100 - 330 * ky);
    }
    LW = Math.max(0.75, Math.min(1.15, k * 1.1));
    seed = 20261015;
    // The builders' machines, and their threads into the core's left side.
    // The core: three strands of a lens, nodes at its tips and on its sides.
    // The mink is this slide's hero: as large a whole-number cell as fits (4 beside the text), the lens widened to hold her.
    cell = small ? 1 : low ? 2 : k >= 0.45 ? 4 : 3;
    const lw0 = small ? CORE_REF.w * k : Math.max(CORE_REF.w * k, 23 * cell + 40);
    lens = { c: P(CORE_REF.cx, CORE_REF.cy), w: lw0, h: Math.max(CORE_REF.h * k, lw0 * 1.66) };
    // Where the feeds arrive and the rays leave: its left and right sides (upright, the feeds meet its foot, below).
    const lensL = { x: lens.c.x - lens.w / 2, y: lens.c.y }, lensR = portraitFlow ? { x: lens.c.x, y: lens.c.y - lens.h / 2 } : { x: lens.c.x + lens.w / 2, y: lens.c.y };
    // Its three strands, each side traced from the middle out (built once here, not every frame).
    lensLines = [[0, 1.2, 0.95], [6 * k, 0.9, 0.55], [-4 * k, 0.8, 0.35]].flatMap(([inset, w, a]) => [-1, 1].map((side) => ({ h: line(lensPts(side, 40, inset)), w, a })));
    machines = [[213, 277, 'term'], [213, 424, 'gpu'], [213, 570, 'graph']].map(([x, y, kind], i) => ({ ...P(x, y), r: 52 * k, kind, i }));
    feeds = machines.map((m, i) => {
      const end = portraitFlow
        ? { x: lens.c.x + (i - 1) * 0.22 * lens.w, y: lens.c.y + lens.h / 2 + 2 * k }
        : { x: lensL.x + 2 * k, y: lensL.y + (i - 1) * 12 * k };
      const start = portraitFlow ? { x: m.x, y: m.y - m.r } : { x: m.x + m.r, y: m.y };
      const dx = end.x - start.x, dy = end.y - start.y;
      const c0 = portraitFlow ? { x: start.x + dx * 0.4, y: start.y + dy * 0.4 } : { x: start.x + dx * 0.4, y: start.y };
      const c1 = portraitFlow ? { x: end.x - dx * 0.4, y: end.y - dy * 0.4 } : { x: end.x - dx * 0.4, y: end.y };
      const h = line(bez(start, c0, c1, end, 48));
      h.nodes = [0.3, 0.68].map((f) => f * h.total);
      return h;
    });
    // The boundary: hosted begins past this line (clear of the lens when the picture is narrowed).
    // Upright there is none: the hosted label over the fan and the local one under the devices name the two sides.
    boundary = portraitFlow ? null : { x: Math.max(X(836), lens.c.x + lens.w / 2 + 16 * k), y0: Y(120), y1: Y(705) };
    // Everyone else: wave fronts of people widening out from the core, as in the reference: each an arc
    // (centre u, radius r, half-height hh, in reference units), the last a dense band.
    arcs = [];
    const FRONTS = [[895, 225, 180, 18, 1], [1000, 265, 225, 22, 1], [1103, 327, 275, 28, 1], [1206, 359, 330, 46, 3]];
    FRONTS.forEach(([u, r, hh, n, rows], ai) => {
      const dots = [], span = Math.asin(Math.min(1, hh / r));
      for (let row = 0; row < rows; row++) {
        const rr = r + (rows > 1 ? (row - 1) * 11 : 0), m = rows > 1 ? Math.round(n * (row === 1 ? 1.1 : 0.9)) : n;
        for (let j = 0; j < m; j++) {
          const a = -span + (2 * span * (j + (rows > 1 ? rnd() * 0.6 : 0))) / (m - 1);
          const jit = rows > 1 ? (rnd() - 0.5) * 6 : 0;
          dots.push({ ...P(u + Math.cos(a) * (rr + jit), 415 + Math.sin(a) * (rr + jit)), a: a / span, r: rows > 1 ? 1.1 + rnd() * 0.8 : 1.7 + rnd() * 0.4, bright: rnd() < (rows > 1 ? 0.3 : 0.15) });
        }
      }
      const thread = rows > 1 ? null : line(Array.from({ length: 41 }, (_, j) => { const a = -span + (2 * span * j) / 40, rx = u + Math.cos(a) * r, ry = 415 + Math.sin(a) * r; return [X(rx, ry), Y(ry, rx)]; }));
      // For the waves: how far each person (and each stretch of thread) is from the core; and a phase to twinkle by.
      dots.forEach((d, j) => { d.dc = Math.hypot(d.x - lens.c.x, d.y - lens.c.y); d.ph = (j * 2.39996 + ai * 1.7) % TAU; });
      if (thread) thread.dc = thread.pts.slice(1).map(([x, y], j) => Math.hypot((x + thread.pts[j][0]) / 2 - lens.c.x, (y + thread.pts[j][1]) / 2 - lens.c.y));
      arcs.push({ x: u + r, dots, thread, t0: 1.7 + ai * 0.28 });
    });
    // Rays from the core's right tip out to the far front, a few bright people on them.
    rays = [[-0.42, 0.62], [-0.27, 0.45], [-0.1, 0.78], [0.03, 0.3], [0.16, 0.66], [0.3, 0.5], [0.45, 0.85]].map(([a, mark], i) => {
      const start = portraitFlow ? { x: lensR.x + (i - 3) * 4 * k, y: lensR.y } : { x: lensR.x, y: lensR.y + (i - 3) * 4 * k };
      // Upright, each ray stops in the far front (centre 1206, radius 348) instead of running on to the screen's top.
      const len = portraitFlow ? 386 * Math.cos(a) + Math.sqrt((386 * Math.cos(a)) ** 2 - (386 ** 2 - 348 ** 2)) : 760;
      const end = P(820 + Math.cos(a) * len, 415 + Math.sin(a) * len);
      return Object.assign(line([[start.x, start.y], [end.x, end.y]]), { mark, i });
    });
    // Labels.
    if (!portraitFlow) labels.local.style.fontSize = labels.hosted.style.fontSize = `${Math.max(small ? 10.5 : 13, 23 * k).toFixed(1)}px`;
    labels.core.style.fontSize = portraitFlow ? '14px' : `${Math.max(small ? 11 : 14, 25 * k).toFixed(1)}px`;
    if (portraitFlow) { // the hosted label crowns the fan, the local one sits under the devices; Astrid beside her lens (rays leave its top)
      put(labels.hosted, W / 2, Y(415, 1580) - 14, 0.5, 1);
      put(labels.local, W / 2, machines[1].y + machines[1].r + 10, 0.5, 0);
      put(labels.core, lens.c.x + lens.w / 2 + 10, lens.c.y, 0, 0.5);
    } else {
      put(labels.local, X(150), Y(118), 0, 0.5); // the two sides' names share a line, either side of the boundary's top
      put(labels.hosted, X(1170), Y(118), 0.5, 0.5);
      put(labels.core, lens.c.x + M.LENS.x * cell, lens.c.y - lens.h / 2 - 28 * k, 0.5, 0.5); // over her
    }
    return true;
  };

  // ---- Time ----------------------------------------------------------------------------
  const END = 3.2;
  // The first builder publishes as their threads finish drawing, so the first wave goes out as the people
  // appear; after that someone publishes every second or two. A wave is a ripple out of the core
  // (v: px a second, band: its width, both times k) that brightens whatever it passes.
  const FIRST = 1.9, EVERY = [1.3, 2.6], WAVE = { v: 520, band: 34, life: 2.4 };
  let ta = 0, running = false, raf = 0, last = 0, timers = [], entryCtx = null, reverseCtx = null;
  let entryFinish = null, reverseFinish = null;
  let coreOwner = null;
  let coreHeld = false; // slide 8 is drawing the core (on its way out, or on its way back here): this picture leaves it out
  let pulses = [], waves = [], nextPulse = 0, lastFrom = -1, glintAt = -9;
  const k01 = (t0, d) => clamp((ta - t0) / d);

  // ---- Drawing ---------------------------------------------------------------------------
  const lensPts = (side, n, inset) => { // a vesica edge: side -1 left, +1 right
    const hw = lens.w / 2 - inset, hh = lens.h / 2 - inset * 0.6, c = (hw * hw - hh * hh) / (2 * hw), R = hw - c;
    return Array.from({ length: n + 1 }, (_, i) => { const y = -hh + (2 * hh * i) / n; return [lens.c.x + side * (c + Math.sqrt(Math.max(0, R * R - y * y))), lens.c.y + y]; });
  };
  const glyph = (m, a) => {
    if (a <= 0) return;
    const s = m.r / 52, x = m.x, y = m.y;
    halo(x, y, m.r * 1.5, 0.06 * a);
    g.lineWidth = 1.5 * LW;
    g.strokeStyle = `rgba(${THREAD},${(0.95 * a).toFixed(3)})`;
    g.beginPath(); g.arc(x, y, m.r, 0, TAU); g.stroke();
    g.lineWidth = 1.4 * LW;
    g.strokeStyle = `rgba(${CORE},${(0.82 * a).toFixed(3)})`;
    g.beginPath();
    if (m.kind === 'term' || m.kind === 'graph') { // a monitor on its stand
      g.roundRect(x - 26 * s, y - 20 * s, 52 * s, 34 * s, 3 * s);
      g.moveTo(x, y + 14 * s); g.lineTo(x, y + 21 * s); g.moveTo(x - 10 * s, y + 21 * s); g.lineTo(x + 10 * s, y + 21 * s);
    }
    if (m.kind === 'term') { g.moveTo(x - 16 * s, y - 10 * s); g.lineTo(x - 9 * s, y - 4 * s); g.lineTo(x - 16 * s, y + 2 * s); }
    if (m.kind === 'graph') { g.moveTo(x - 13 * s, y + 4 * s); g.lineTo(x - 1 * s, y - 9 * s); g.lineTo(x + 12 * s, y + 3 * s); }
    if (m.kind === 'gpu') { // a graphics card: its board, its fan, its bracket
      g.roundRect(x - 26 * s, y - 15 * s, 50 * s, 28 * s, 3 * s);
      g.moveTo(x + 24 * s, y - 15 * s); g.lineTo(x + 30 * s, y - 15 * s); g.lineTo(x + 30 * s, y + 18 * s);
      g.moveTo(x - 20 * s, y + 13 * s); g.lineTo(x - 20 * s, y + 18 * s); g.lineTo(x + 4 * s, y + 18 * s); g.lineTo(x + 4 * s, y + 13 * s);
      g.moveTo(x + 12 * s, y - 1 * s); g.arc(x + 2 * s, y - 1 * s, 10 * s, 0, TAU);
      for (let b = 0; b < 5; b++) { const an = (b / 5) * TAU + ta * 0.6; g.moveTo(x + 2 * s, y - 1 * s); g.lineTo(x + 2 * s + Math.cos(an) * 9 * s, y - 1 * s + Math.sin(an) * 9 * s); }
    }
    g.stroke();
    if (m.kind === 'term') { // its cursor blinks
      g.strokeStyle = `rgba(${CORE},${(0.82 * a * (ta % 1.1 < 0.62 ? 1 : 0.18)).toFixed(3)})`;
      g.beginPath(); g.moveTo(x - 6 * s, y + 3 * s); g.lineTo(x + 4 * s, y + 3 * s); g.stroke();
    }
    if (m.kind === 'graph') [[-13, 4], [-1, -9], [12, 3]].forEach(([dx, dy]) => dot(x + dx * s, y + dy * s, 2.2 * s, CORE, 0.9 * a));
    // Publishing: a ring of light leaves the machine as its work sets off for the core.
    let pub = 0;
    for (const p of pulses) if (p.i === m.i) pub = Math.max(pub, 1 - (ta - p.t0) / 0.8);
    if (pub > 0) {
      halo(x, y, m.r * 1.7, 0.14 * pub);
      g.lineWidth = (0.6 + 1.1 * pub) * LW; g.strokeStyle = `rgba(${NODE},${(0.55 * pub).toFixed(3)})`;
      g.beginPath(); g.arc(x, y, m.r + 14 * k * (1 - pub), 0, TAU); g.stroke();
    }
    if (portraitFlow) node(x, y - m.r, 0.9 + 0.5 * pub, a);
    else node(x + m.r, y, 0.9 + 0.5 * pub, a);
  };
  // A nearest-neighbour sprite keeps its pixels crisp at fractional flight scales.
  const flightSprite = document.createElement('canvas');
  flightSprite.width = 23; flightSprite.height = 20;
  const flightPixels = flightSprite.getContext('2d');
  M.POSES.profile.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') { flightPixels.fillStyle = M.COLORS[ch]; flightPixels.fillRect(x, y, 1, 1); }
  }));
  const paintMinkAt = (x, y, u) => {
    g.save(); g.imageSmoothingEnabled = false;
    g.drawImage(flightSprite, x, y, 23 * u, 20 * u);
    g.restore();
  };
  // From slide 6: where she starts, in this slide's coordinates.
  let fly = null, flightTextRelease = null;
  const releaseFlightText = () => { flightTextRelease?.(); flightTextRelease = null; };
  const FLY = { charge: 0.5, travel: 1.25, land: 0.6 }; // seconds: unfold, cross, settle
  const FLIGHT_START = 0.95 - FLY.charge - FLY.travel; // scene clock when the mink leaves the stack
  const STACK_ARRIVAL_STRETCH = (END - FLIGHT_START + 0.75) / (END - FLIGHT_START);
  const inLens = () => ({ x: lens.c.x + M.LENS.x * cell, y: lens.c.y + M.LENS.y * cell }); // her centre, optically centred in the lens
  // Sample the remaining quadratic flight, including the mink and its trailing glow.
  const flightCrossesCopy = (ctx, f, q0, q1) => {
    const b = root.getBoundingClientRect(), end = inLens(), u = Math.max(f.c, cell);
    const start = { x: f.x + 11.5 * f.c, y: f.y + 10 * f.c };
    const cp = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - 140 * k };
    const rects = ctx.copyRects(), pad = Math.max(12 * u, 17 * u);
    for (let i = 0; i <= 40; i++) {
      const q = q0 + (q1 - q0) * i / 40, v = 1 - q;
      const x = b.left + v * v * start.x + 2 * v * q * cp.x + q * q * end.x;
      const y = b.top + v * v * start.y + 2 * v * q * cp.y + q * q * end.y;
      if (rects.some((r) => x + pad > r.left && x - pad < r.right && y + pad > r.top && y - pad < r.bottom)) return true;
    }
    return false;
  };
  const flightGeometry = () => {
    const r = window.deckStackFlight?.source(window.deckNav);
    if (!r?.width || !layout()) return null;
    const b = root.getBoundingClientRect();
    return { x: r.left - b.left, y: r.top - b.top, c: r.c };
  };
  const checkFlightText = (ctx) => {
    if (!flightTextRelease || !fly) return;
    const h = ta - fly.t0, q = 0.5 - 0.5 * Math.cos(Math.PI * clamp((h - FLY.charge) / FLY.travel));
    // Include the tail behind the moving mink when checking the remaining path.
    const clear = fly.back ? !flightCrossesCopy(ctx, fly, 0, Math.min(1, q + 0.264)) : !flightCrossesCopy(ctx, fly, Math.max(0, q - 0.264), 1);
    if (clear) releaseFlightText();
  };
  const paintMink = (x, y, a, glint = 0) => { // the real pixel mink, crisp, centred on (x, y), her eye lit by glint
    if (a <= 0 || (fly && ta < fly.landed)) return;
    const P2 = M.POSES.profile, G2 = M.POSES.glint, u = cell, w = P2[0].length * u, h = P2.length * u;
    const x0 = Math.round(x - w / 2), y0 = Math.round(y - h / 2);
    g.globalAlpha = a;
    for (let j = 0; j < P2.length; j++) for (let i = 0; i < P2[0].length; i++) {
      const ch = P2[j][i];
      if (ch === '.') continue;
      g.fillStyle = M.COLORS[ch];
      g.fillRect(x0 + i * u, y0 + j * u, u, u);
    }
    if (glint > 0.01) {
      g.globalAlpha = a * glint;
      for (let j = 0; j < G2.length; j++) for (let i = 0; i < G2[0].length; i++) {
        const ch = G2[j][i];
        if (ch === '.' || ch === P2[j][i]) continue;
        g.fillStyle = M.COLORS[ch];
        g.fillRect(x0 + i * u, y0 + j * u, u, u);
      }
    }
    g.globalAlpha = 1;
  };

  const draw = () => {
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    if (!lens) return;
    g.lineCap = 'round'; g.lineJoin = 'round';
    // The core: the lens traces from its tips, the mink inside it.
    const ql = coreHeld ? 0 : ease(k01(0.05, 1.0));
    halo(lens.c.x, lens.c.y, lens.h * 0.55, 0.12 * ql);
    if (ql > 0) {
      for (const { h, w, a } of lensLines) { const mid = h.total / 2, half = mid * ql; stroke(h, mid - half, mid + half, w * LW, THREAD, a); }
      node(lens.c.x, lens.c.y - lens.h / 2, 1, ql); node(lens.c.x, lens.c.y + lens.h / 2, 1, ql);
    }
    const her = inLens();
    if (!coreHeld) paintMink(her.x, her.y, smooth(k01(0.5, 0.5)), ta - glintAt < 0.5 ? 1 : 0);
    // The builders: their machines, and their threads into the core.
    machines.forEach((m, i) => {
      const q = ease(k01(0.4 + i * 0.12, 0.6));
      glyph(m, q);
      const qf = ease(k01(0.8 + i * 0.12, 0.8));
      if (qf > 0) {
        const f = feeds[i];
        stroke(f, 0, f.total * qf, 1 * LW, THREAD, 0.65);
        f.nodes.forEach((d) => { if (d <= f.total * qf) node(at(f, d).x, at(f, d).y, 1, 1); });
        for (let j = -1; j <= 1; j++) if (qf >= 1) node(f.pts[f.pts.length - 1][0], f.pts[f.pts.length - 1][1], 0.6, 1);
      }
    });
    // Each wave is a ripple out of the core: lit(d) is how brightly it lights a point d px from the core.
    const reach = waves.map((w) => (ta - w.t0) * WAVE.v * k);
    const lit = (d) => { let l = 0; for (const R of reach) { const u = (d - R) / (WAVE.band * k); if (u > -3 && u < 3) l = Math.max(l, Math.exp(-u * u)); } return l; };
    // The boundary between local and hosted.
    const qb = k01(1.4, 0.6);
    if (qb > 0 && boundary) {
      for (let y = boundary.y0; y < boundary.y0 + (boundary.y1 - boundary.y0) * ease(qb); y += 7 * k) dot(boundary.x, y, 0.75 * Math.max(0.8, k), NODE, 0.35 + 0.45 * lit(Math.hypot(boundary.x - lens.c.x, y - lens.c.y)));
    }
    // Everyone else: rays out of the core, and arcs of people widening out.
    const qr = ease(k01(1.5, 1.0));
    rays.forEach((r) => {
      if (qr <= 0) return;
      stroke(r, 0, r.total * qr, 0.6 * LW, THREAD, 0.3);
      if (qr >= r.mark) node(at(r, r.total * r.mark).x, at(r, r.total * r.mark).y, 0.95, smooth(clamp((qr - r.mark) * 5)));
      if (qr < 1) return;
      for (const R of reach) { // a mote rides each ray out with the wave, fading as it goes
        const d = R - lens.w / 2;
        if (d <= 0 || d >= r.total) continue;
        const p = at(r, d), f = 1 - d / r.total;
        halo(p.x, p.y, 7 * k, 0.5 * f); dot(p.x, p.y, 1.3 * Math.max(0.8, k), CORE, 0.8 * f);
      }
    });
    for (const a of arcs) {
      const q = k01(a.t0, 0.7);
      if (q <= 0) continue;
      if (a.thread) {
        const mid = a.thread.total / 2, half = mid * ease(q);
        stroke(a.thread, mid - half, mid + half, 0.6 * LW, THREAD, 0.28);
        if (q >= 1 && reach.length) { // the stretch of thread the wave is crossing
          const P3 = a.thread.pts;
          g.lineWidth = 0.9 * LW;
          for (let j = 0; j < a.thread.dc.length; j++) {
            const l = lit(a.thread.dc[j]);
            if (l < 0.03) continue;
            g.strokeStyle = `rgba(${NODE},${(0.42 * l).toFixed(3)})`;
            g.beginPath(); g.moveTo(P3[j][0], P3[j][1]); g.lineTo(P3[j + 1][0], P3[j + 1][1]); g.stroke();
          }
        }
      }
      for (const d of a.dots) {
        const local = clamp((q - Math.abs(d.a) * 0.35) * 2.6);
        if (local <= 0) continue;
        const l = reach.length ? lit(d.dc) : 0, tw = 1 + (d.bright ? 0.22 : 0.1) * Math.sin(ta * (0.8 + d.ph * 0.12) + d.ph);
        const al = (d.bright ? 1 : 0.85) * local * tw + 0.45 * l;
        halo(d.x, d.y, (d.bright ? 9 : 6.5) * k * (1 + 0.7 * l), (d.bright ? 0.6 : 0.36) * al);
        dot(d.x, d.y, d.r * Math.max(0.8, k) * (1 + 0.35 * l), CORE, al);
      }
    }
    // Pulses: from a builder into the core.
    for (const p of pulses) {
      const f = feeds[p.i], d = easeIO(clamp((ta - p.t0) / 1.4)) * f.total;
      stroke(f, Math.max(0, d - 40 * k), d, 1.2 * LW, NODE, 0.7);
      const q = at(f, d); halo(q.x, q.y, 9 * k, 0.75); dot(q.x, q.y, 1.8 * Math.max(0.8, k), CORE, 1);
    }
    // The core flares as a wave leaves it.
    for (const w of waves) { const e = ta - w.t0; if (e < 0.6) halo(lens.c.x, lens.c.y, lens.h * (0.35 + 0.4 * e), 0.25 * (1 - e / 0.6)); }
    if (fly) drawFly();
  };
  // The flight, in hand-off time h (0 when she leaves slide 6).
  const drawFly = () => {
    const f = fly, h = ta - f.t0, u0 = f.c, u1 = cell;
    const centre = inLens();
    const end = { x: Math.round(centre.x - 11.5 * u1) + 11.5 * u1, y: Math.round(centre.y - 10 * u1) + 10 * u1 }; // match paintMink at rest
    const T1 = FLY.charge, T2 = T1 + FLY.travel;
    if (f.back) f.flight?.draw(h / FLY.charge);
    if (h < T1) { // Hold at the agent plane while the stack unfolds on the reverse journey.
      if (!f.back) paintMinkAt(f.x, f.y, u0);
      return;
    }
    if (h < T2) { // the flight: an arc across into the lens, a trail of light behind her
      const q = 0.5 - 0.5 * Math.cos(Math.PI * clamp((h - T1) / FLY.travel)); // a gentle sine ease for travel
      const u = u0 + (u1 - u0) * (1 - (1 - q) ** 2);
      const s0 = { x: f.x + 11.5 * u0, y: f.y + 10 * u0 }, cp = { x: (s0.x + end.x) / 2, y: Math.min(s0.y, end.y) - 140 * k };
      const pos = (t) => { const v = 1 - t; return { x: v * v * s0.x + 2 * v * t * cp.x + t * t * end.x, y: v * v * s0.y + 2 * v * t * cp.y + t * t * end.y }; };
      for (let j = 12; j >= 1; j--) { // the trail
        const t = f.back ? Math.min(1, q + j * 0.022) : Math.max(0, q - j * 0.022), p = pos(t), a = (1 - j / 13) * 0.55; // behind her, either way
        halo(p.x, p.y, (10 - j * 0.5) * Math.max(1, u / 2), a * 0.6); dot(p.x, p.y, 1.8 - j * 0.1, CORE, a);
      }
      const p = pos(q);
      halo(p.x, p.y, 17 * u, 0.45);
      paintMinkAt(p.x - 11.5 * u, p.y - 10 * u, u, 0);
      return;
    }
    // Landed: a soft flare in the lens.
    const q = clamp((h - T2) / FLY.land);
    halo(lens.c.x, lens.c.y, lens.h * (0.3 + 0.5 * ease(q)), 0.45 * (1 - q));
    paintMinkAt(end.x - 11.5 * u1, end.y - 10 * u1, u1, 0);
    if (q >= 1 && !f.back) { fly = null; releaseFlightText(); }
  };
  const smooth = (q) => q * q * (3 - 2 * q);

  const advance = (dt, ctx = entryCtx) => {
    ta += dt;
    if (ta >= END && !fly) entryFinish?.(ctx, 'completed');
    if (ta < FIRST) return;
    // A builder publishes something; it reaches the core; a wave goes out to everyone.
    if (ta >= nextPulse && !(window.deckPace?.() > 1)) { // (none sets off while the entry is hurried on)
      lastFrom = (lastFrom + 1 + Math.floor(Math.random() * 2)) % 3;
      pulses.push({ i: lastFrom, t0: ta }); nextPulse = ta + EVERY[0] + Math.random() * (EVERY[1] - EVERY[0]);
    }
    pulses = pulses.filter((p) => {
      if (ta - p.t0 < 1.4) return true;
      waves.push({ t0: ta });
      if (ta - glintAt > 4) glintAt = ta; // now and then, her eye lights as the work comes in
      return false;
    });
    waves = waves.filter((w) => ta - w.t0 < WAVE.life);
  };

  // ---- Coming and going -----------------------------------------------------------------
  const tick = (ctx, now) => {
    raf = 0;
    if (!running || ctx !== entryCtx || !ctx?.isCurrent?.()) return;
    const clock = window.deckNow?.() ?? now;
    const dt = Math.max(0, (clock - (last || clock)) / 1000);
    last = clock;
    // Keep the stack collapse and the reverse route at their existing pace.
    const stretch = ctx.from === 5 && ctx.to === 6 && !ctx.direct && !ctx.rest && ta < END ? STACK_ARRIVAL_STRETCH : 1;
    advance(dt / stretch, ctx);
    draw();
    checkFlightText(ctx);
    raf = requestAnimationFrame((t) => tick(ctx, t));
  };
  const start = (ctx = entryCtx) => { if (running || still || document.getElementById('overview')?.classList.contains('on') || window.deckStill?.()) return; entryCtx = ctx; running = true; last = window.deckNow?.() ?? performance.now(); raf = requestAnimationFrame((t) => tick(ctx, t)); };
  const stop = () => { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; };
  const reset = () => {
    timers.forEach(window.deckCancelLater); timers = [];
    pulses = []; waves = []; ta = 0; fly = null; glintAt = -9; coreHeld = false; coreOwner = null;
    root.classList.remove('is-labelled');
    canvas.style.transition = ''; canvas.style.opacity = ''; Object.values(labels).forEach((el) => { el.style.opacity = ''; });
    if (g) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height); }
  };
  const begin = (ctx = entryCtx) => {
    entryCtx = ctx;
    // Flowers may already own the returning core when source.exit runs before
    // this target's enter. Reset the old visit without releasing that claim.
    const returningCore = coreOwner === ctx && coreHeld;
    reset();
    if (returningCore) { coreOwner = ctx; coreHeld = true; }
    if (!layout()) return;
    if (motionOff() || ctx?.rest || ctx?.direct) { ta = 9; nextPulse = ta + 0.3; root.classList.add('is-labelled'); draw(); entryFinish?.(ctx, 'completed'); if (!motionOff()) { document.documentElement.classList.add('pa-quiet'); start(ctx); } return; }
    ta = -0.2; nextPulse = FIRST;
    timers.push(window.deckLater(() => { if (ctx?.isCurrent?.() && slide.classList.contains('on')) document.documentElement.classList.add('pa-quiet'); }, 150, ctx));
    timers.push(window.deckLater(() => { if (ctx?.isCurrent?.()) root.classList.add('is-labelled'); }, 1400, ctx));
    start(ctx);
  };
  // From slide 6, the stack-owned avatar crosses into this slide's lens.
  const stackSlide = document.querySelector('.st-host');
  const flyIn = (ctx = entryCtx) => {
    entryCtx = ctx;
    const r = window.deckStackFlight?.source(ctx), u0 = r?.c;
    if (motionOff() || !r?.width || !u0) return false;
    reset();
    if (!layout()) return false;
    const b = root.getBoundingClientRect(), x = r.left - b.left, y = r.top - b.top;
    ta = FLIGHT_START; // the lens finishes tracing as she reaches it
    fly = { t0: ta - FLY.charge, x, y, c: u0, landed: ta + FLY.travel };
    // The stack scene owns source visibility for this forward transfer.
    draw(); // Paint the travelling mink before releasing the source-owned copy.
    slide.classList.add('pa-arrive');
    // Leave the copy in place until a painted frame of the target can replace it.
    window.deckStackFlight?.ready(ctx);
    timers.push(window.deckLater(() => { if (ctx?.isCurrent?.()) slide.classList.remove('pa-arrive'); }, 900, ctx));
    timers.push(window.deckLater(() => { if (ctx?.isCurrent?.() && slide.classList.contains('on')) document.documentElement.classList.add('pa-quiet'); }, 400, ctx));
    timers.push(window.deckLater(() => { if (ctx?.isCurrent?.()) root.classList.add('is-labelled'); }, (FLY.charge + FLY.travel + 0.4) * STACK_ARRIVAL_STRETCH * 1000, ctx));
    nextPulse = FIRST;
    start(ctx);
    return true;
  };
  // ---- Going back to slide 6 --------------------------------------------------------------
  // A step back: the arrival from slide 6 played backwards. The picture ungrows (the people, the rays, the boundary,
  // the builders' threads and machines) back to the lens around the mink; she lights up, lifts out of it as the lens
  // untraces, flies back along her arc to the agent plane, and the stack unfolds around her.
  let unflying = null;
  const unfly = (ctx) => {
    const r = window.deckStackFlight?.source(ctx), u0 = r?.c;
    if (!r?.width || !u0) return false;
    reverseCtx = ctx;
    stop();
    timers.forEach(window.deckCancelLater); timers = [];
    pulses = []; waves = []; glintAt = -9;
    const b = root.getBoundingClientRect(), x = r.left - b.left, y = r.top - b.top;
    const t0 = FLIGHT_START; // the arrival's own clock, as flyIn set it
    fly = { t0, x, y, c: u0, landed: t0 + FLY.charge + FLY.travel, back: true };
    ta = Math.min(ta, END);
    fly.flight = window.deckStackFlight?.hold(ctx, r);
    if (!fly.flight) { fly = null; return false; }
    fly.flight.hideCopy();
    reverseCtx.present(slide, 'dt-rewind dt-over'); // over the stack, which waits for her
    reverseCtx.present(stackSlide, 'dt-return');
    unflying = { ctx, flight: fly.flight, last: window.deckNow?.() ?? performance.now(), raf: 0 };
    const u = unflying;
    u.raf = requestAnimationFrame((now) => unstep(u, now));
    return true;
  };
  const unstep = (u, now) => {
    if (unflying !== u || !u.ctx.isCurrent() || u.ctx.terminal) return;
    u.raf = 0;
    const clock = window.deckNow?.() ?? now;
    const dt = Math.max(0, (clock - (u.last || clock)) / 1000);
    u.last = clock;
    const h = ta - fly.t0;
    // The picture ungrows a little quicker than it grew (as a second visit would); her flight keeps its own time.
    ta -= h > FLY.charge + FLY.travel + FLY.land ? dt / 0.7 : dt;
    const hn = ta - fly.t0;
    if (hn < FLY.charge + FLY.travel + 0.4) root.classList.remove('is-labelled');
    if (hn < 0.4) document.documentElement.classList.remove('pa-quiet');
    if (hn <= 0) { endUnfly(); return; }
    draw();
    checkFlightText(reverseCtx);
    u.raf = requestAnimationFrame((now) => unstep(u, now));
  };
  const endUnfly = (owner = unflying?.ctx) => {
    const u = unflying;
    if (!u || u.ctx !== owner) return;
    unflying = null;
    if (u.raf) cancelAnimationFrame(u.raf);
    fly = null;
    u.flight?.release();
    u.ctx.present(slide, 'dt-rewound', 'dt-rewind dt-over');
    u.ctx.present(stackSlide, '', 'dt-return dt-await');
    document.documentElement.classList.remove('pa-quiet');
    if (!slide.classList.contains('on')) reset();
    releaseFlightText();
    reverseFinish?.(u.ctx, 'completed');
  };

  const completion = (ctx, assign, cleanup) => {
    let resolve, settled = false;
    const promise = new Promise((done) => { resolve = done; });
    const finish = (owner, result) => {
      if (owner !== ctx || settled) return;
      settled = true; assign(null); resolve(result);
    };
    assign(finish);
    ctx.defer(() => { finish(ctx, 'cancelled'); cleanup(); });
    return promise;
  };
  const sceneEnter = (ctx) => {
    const promise = completion(ctx, (fn) => { entryFinish = fn; }, () => { stop(); fly = null; });
    entryCtx = ctx;
    if (ctx.rest || ctx.direct) { begin(ctx); return promise; }
    if (ctx.from === 5) {
      const path = flightGeometry();
      if (path && flightCrossesCopy(ctx, path, 0, 1)) {
        // The avatar stands up for 0.18 s and the stack collapses for 0.5 s; the pays clock then runs from FLIGHT_START to END.
        flightTextRelease = ctx.holdText(() => {
          stop(); fly = null; window.deckStackFlight?.ready(ctx);
          ta = END + 0.2; root.classList.add('is-labelled'); draw(); entryFinish?.(ctx, 'completed');
        }, (0.68 + END - FLIGHT_START + 0.75 + 0.3) * 1000);
        ctx.defer(releaseFlightText);
      }
      Promise.resolve(window.deckStackFlight?.collapsed(ctx)).then((result) => {
        if (!ctx.isTransitionCurrent() || result === 'cancelled') return;
        if (!flyIn(ctx)) { releaseFlightText(); window.deckStackFlight?.ready(ctx); begin(ctx); }
      });
    } else begin(ctx);
    return promise;
  };
  const sceneExit = (ctx) => {
    if (ctx.to === 5 && ctx.back && !motionOff() && !fly && lens && ta >= END) {
      const promise = completion(ctx, (fn) => { reverseFinish = fn; }, () => endUnfly(ctx));
      const path = flightGeometry();
      if (path && flightCrossesCopy(ctx, path, 0, 1)) {
        // Unfly accelerates the ungrowing portion by 0.7, then reverses the flight at normal speed.
        const flightEnd = FLY.charge + FLY.travel + FLY.land;
        const duration = (END - FLIGHT_START - flightEnd) * 0.7 + flightEnd;
        flightTextRelease = ctx.holdText(() => endUnfly(ctx), (duration + 0.3) * 1000);
        ctx.defer(releaseFlightText);
      }
      queueMicrotask(() => { if (ctx.isTransitionCurrent() && !unfly(ctx)) { releaseFlightText(); reverseFinish?.(ctx, 'completed'); } });
      return promise;
    }
    stop(); fly = null; slide.classList.remove('pa-arrive');
    document.documentElement.classList.remove('pa-quiet');
    timers.push(window.deckLater(() => { if (!slide.classList.contains('on')) reset(); }, 700, ctx));
    return undefined;
  };
  const sceneRestore = (ctx) => {
    endUnfly(ctx);
    if (ctx.to === 6) {
      coreOwner = null; coreHeld = false;
      canvas.style.transition = ''; canvas.style.opacity = '';
      labels.local.style.opacity = labels.hosted.style.opacity = labels.core.style.opacity = '';
      if (lens) draw();
    }
    if (ctx.to === 6 && (fly || ta < END)) {
      entryCtx = ctx; fly = null; window.deckStackFlight?.ready(ctx);
      timers.forEach(window.deckCancelLater); timers = [];
      slide.classList.remove('pa-arrive');
      ta = END + 0.2; root.classList.add('is-labelled');
      document.documentElement.classList.add('pa-quiet');
      if (!layout()) return false;
      draw(); entryFinish?.(ctx, 'completed');
      if (!motionOff()) start(ctx);
    }
    releaseFlightText();
    return true;
  };
  const sceneResize = (ctx) => {
    if (ctx.to !== 6) return true;
    if (!layout()) return false;
    draw();
    return true;
  };
  window.deckRegisterScene?.([6], { enter: sceneEnter, exit: sceneExit, restore: sceneRestore, resize: sceneResize });
  const syncMotion = () => {
    if (motionOff() && slide.classList.contains('on')) { endUnfly(); stop(); begin(); }
    else if (document.getElementById('overview')?.classList.contains('on')) { endUnfly(); stop(); }
    else if (slide.classList.contains('on') && ta > 0) start();
  };
  window.addEventListener('deck-overview', syncMotion);
  window.addEventListener('deck-motion', syncMotion);
  root.addEventListener('click', (e) => e.stopPropagation());

  // For the next slide: where this slide's core sits, in viewport pixels.
  window.AstridPays = {
    CORE_REF,
    core() {
      if (!lens) layout();
      const b = root.getBoundingClientRect();
      return lens && { x: b.left + lens.c.x, y: b.top + lens.c.y, w: lens.w, h: lens.h, cell };
    },
    // Going on to the foundation, this picture carries on: its core, its builders and everyone else, in viewport pixels.
    snapshot({ rest = false } = {}) {
      // A reverse handoff needs this slide's destination even when a prior
      // visit has retired, or the viewer loaded Flowers directly.
      if (rest && !layout()) return null;
      if (!lens || (!rest && ta < END)) return null;
      const b = root.getBoundingClientRect(), v = (p) => ({ x: b.left + p.x, y: b.top + p.y });
      return {
        core: { ...v(lens.c), w: lens.w, h: lens.h, cell },
        mink: { ...v(inLens()), cell }, // her centre, as paintMink draws her
        machines: machines.map((m) => ({ ...v(m), r: m.r })),
        people: arcs.flatMap((a) => a.dots).map((d) => ({ ...v(d), r: d.r * Math.max(0.8, k), bright: d.bright })),
        k, lw: LW,
      };
    },
    // Slide 8 carries the core on, and brings it back on a step back: this picture leaves it out meanwhile, and
    // takes it back in the frame slide 8 lets go of its own, so only one mink is ever on screen.
    holdCore(on, owner) {
      if (on) { if (!owner?.isTransitionCurrent?.()) return; coreOwner = owner; coreHeld = true; }
      else { if (!owner || coreOwner !== owner) return; coreOwner = null; coreHeld = false; }
      if (!on && lens && slide.classList.contains('on')) draw();
    },
    hide(owner) { // fade out as the next slide's picture takes over
      if (!owner?.isTransitionCurrent?.()) return;
      coreOwner = owner; coreHeld = true; draw(); // the core goes at once: slide 8 draws it from this frame, in the same place
      canvas.style.transition = 'opacity .35s ease'; canvas.style.opacity = '0';
      labels.local.style.opacity = labels.hosted.style.opacity = labels.core.style.opacity = '0';
    },
  };

})();
