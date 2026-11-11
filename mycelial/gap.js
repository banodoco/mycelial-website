// Version F, slide 3: where today's creative AI tools sit, hard ↔ easy to use
// against limited ↔ powerful, with the powerful-and-easy corner empty.
// Each tool is a small disc with its own logo, ringed in its group's colour.
// Arriving from slide 2, the field's own dots fly into place as the tools
// (changing colour as they land, then opening into their logos), its dust
// settles where the axes will run, and then the axes draw through it.
// Hovering a tool lifts it and extends it into its name and what it is, and
// eases its neighbours aside; hovering the empty corner raises a few question
// marks.
(() => {
  const root = document.querySelector('[data-gap]');
  if (!root) return;
  const slide = root.closest('.slide');
  const field = document.querySelector('[data-scatter-field]');
  const fieldSlide = field && field.closest('.slide');
  const tools = [...root.querySelectorAll('.gp-dot')];
  const empty = root.querySelector('.gp-empty');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionOff = () => still || window.deckStill?.();
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const rnd = Math.random;
  const rgb = (hex) => { const n = parseInt(hex.replace('#', '').slice(0, 6), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };

  // ---- Idle ---------------------------------------------------------------
  // Each logo's halo breathes on its own slow clock (CSS, paused off-slide).
  tools.forEach((el) => {
    el.style.setProperty('--bp', `${(6 + rnd() * 3).toFixed(2)}s`);
    el.style.setProperty('--bd', `${(-rnd() * 9).toFixed(2)}s`);
  });

  // ---- Hovering ---------------------------------------------------------
  // The tool in focus lifts and glows (CSS); its neighbours ease a little out
  // of its way.
  let focused = null;
  const pct = (el, k) => parseFloat(el.style[k]) / 100;
  const focus = (el) => {
    if (el === focused) return;
    focused = el;
    const w = root.clientWidth, h = root.clientHeight;
    if (!el) {
      tools.forEach((t) => { t.style.removeProperty('--nx'); t.style.removeProperty('--ny'); });
      return;
    }
    const d = el.querySelector('i').offsetWidth;
    const x0 = pct(el, 'left') * w, y0 = pct(el, 'top') * h;
    // Neighbours within a third of the chart drift away from it, the nearest most (a few px).
    const reach = w * 0.3, push = d * 0.35;
    tools.forEach((t) => {
      if (t === el || still) { t.style.removeProperty('--nx'); t.style.removeProperty('--ny'); return; }
      const dx = pct(t, 'left') * w - x0, dy = pct(t, 'top') * h - y0, dist = Math.hypot(dx, dy) || 1;
      const k = Math.pow(clamp(1 - dist / reach), 1.2) * push;
      t.style.setProperty('--nx', `${((dx / dist) * k).toFixed(2)}px`);
      t.style.setProperty('--ny', `${((dy / dist) * k).toFixed(2)}px`);
    });
  };
  // Mouse hover and keyboard focus; touch goes through the tap below instead.
  tools.forEach((el) => {
    el.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') focus(el); });
    el.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') focus(root.querySelector('.gp-dot.is-open')); });
    el.addEventListener('focus', () => focus(el));
    el.addEventListener('blur', () => focus(root.querySelector('.gp-dot.is-open')));
  });

  // Taps (and clicks) open a tool the way hovering does, and never turn the slide.
  root.addEventListener('click', (e) => {
    let hit = e.target.closest('.gp-dot, .gp-empty');
    if (!hit) return;
    if (hit.matches('.gp-dot')) {
      let nearest = null, nearestDistance = Infinity;
      for (const dot of tools) {
        const box = dot.getBoundingClientRect();
        const icon = dot.querySelector('i').getBoundingClientRect();
        if (e.clientX < box.left - 12 || e.clientX > box.right + 12 || e.clientY < box.top - 12 || e.clientY > box.bottom + 12) continue;
        const distance = Math.hypot(e.clientX - (icon.left + icon.width / 2), e.clientY - (icon.top + icon.height / 2));
        if (distance < nearestDistance) { nearest = dot; nearestDistance = distance; }
      }
      if (nearest) hit = nearest;
    }
    e.stopPropagation();
    const open = !hit.classList.contains('is-open');
    root.querySelectorAll('.is-open').forEach((el) => el.classList.remove('is-open'));
    hit.classList.toggle('is-open', open);
    if (hit === empty && open) ask();
    if (hit !== empty) focus(open ? hit : null);
  });
  window.deckOverlay?.register({
    isOpen: () => !!root.querySelector('.is-open'),
    contains: (target) => {
      const item = root.querySelector('.is-open');
      if (!item) return false;
      const detail = item.matches('.gp-dot') ? item.querySelector('span') : item.querySelector('.gp-q');
      return detail?.contains(target) || false;
    },
    close: () => {
      root.querySelectorAll('.is-open').forEach((el) => el.classList.remove('is-open'));
      focus(null);
    },
  });
  // The empty corner: question marks drift up while you look at it.
  let asking = 0;
  const ask = () => {
    const q = document.createElement('b');
    q.className = 'gp-q';
    q.textContent = '?';
    q.style.setProperty('--dx', `${Math.round((rnd() - 0.5) * 52)}px`);
    q.addEventListener('animationend', () => q.remove());
    empty.appendChild(q);
  };
  empty.addEventListener('pointerenter', () => { if (still) return; ask(); clearInterval(asking); asking = setInterval(ask, 420); });
  empty.addEventListener('pointerleave', () => clearInterval(asking));

  // ---- Arriving -----------------------------------------------------------
  // Every tool arrives as an orb that eases up to the disc's size in its
  // group's colour, lands, and then opens into its logo: the orb's fill and
  // glow melt away while the logo inside resolves (--m runs 0 → 1). From the
  // field the orbs are its own dots, flying in; otherwise they bloom in place.
  const sky = document.createElement('canvas');
  sky.className = 'gp-flight';
  sky.setAttribute('aria-hidden', 'true');
  document.body.appendChild(sky);
  const g = sky.getContext('2d');
  let flights = [], flying = false, timers = [], forwardRaf = 0, visitCtx = null, forwardGeneration = 0;
  // Keep the flight layer sized for reuse, and show it only during flight.
  const near = () => slide.classList.contains('on') || !!fieldSlide?.classList.contains('on');
  const show = (on) => { sky.style.display = on ? '' : 'none'; };
  const retireForward = (keepCanvas = false) => {
    forwardGeneration++;
    if (forwardRaf) cancelAnimationFrame(forwardRaf);
    forwardRaf = 0; flying = false; flights = [];
    g?.clearRect(0, 0, innerWidth, innerHeight);
    if (!keepCanvas) {
      show(false);
    }
  };
  const idleSoon = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1000 }) : setTimeout(fn, 100));
  const MORPH = 0.5; // seconds from landing to the settled logo

  // keepBare: a chart its tools have run from stays bare until it is next shown.
  const reset = (keepBare = false) => {
    retireForward(Boolean(backs.length || backRaf || departRaf));
    timers.forEach(window.deckCancelLater);
    timers = [];
    root.classList.remove('is-drawn', 'is-labelled');
    tools.forEach((el) => { el.classList.remove('is-in', 'is-open'); el.style.removeProperty('--m'); });
    settle(keepBare);
    empty.classList.remove('is-open');
    focus(null);
  };
  const later = (ms, f) => timers.push(window.deckLater(f, ms));
  const size = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const width = Math.round(innerWidth * dpr), height = Math.round(innerHeight * dpr);
    if (sky.width !== width) sky.width = width;
    if (sky.height !== height) sky.height = height;
    g?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const keepSky = () => {
    if (near()) setTimeout(() => idleSoon(() => { if (near() && !flying && !backs.length) size(); }), 1200);
  };
  if (near()) size();
  show(false);
  // Where each disc will be once the slide has finished rising into place.
  const lift = () => { const m = getComputedStyle(slide).transform; return m && m !== 'none' ? new DOMMatrixReadOnly(m).f : 0; };
  const disc = (el, dy) => {
    const r = el.querySelector('i').getBoundingClientRect();
    return { x1: r.left + r.width / 2, y1: r.top + r.height / 2 - dy, r1: r.width / 2 + 1.5 }; // the orb covers the ring too
  };
  const tint = (el) => rgb(getComputedStyle(el).getPropertyValue('--c').trim() || '#e0ab5e');
  let flightTime = 0, flightLast = 0, flightStretch = 1;
  // Stretch the generated flight itself: its randomized endpoint still gains exactly half a second.
  const stretchFlight = (ctx) => {
    const end = Math.max(0, ...flights.map((f) => f.delay + f.dur + (f.dot ? MORPH : 0)));
    flightStretch = ctx?.from === 1 && ctx.to === 2 && !ctx.direct && !ctx.rest && end > 0 ? (end + 0.5) / end : 1;
  };
  const fire = (ctx) => {
    flightTime = 0; flightLast = window.deckNow?.() ?? performance.now();
    if (!flying) {
      flying = true; show(true);
      const generation = ++forwardGeneration;
      forwardRaf = requestAnimationFrame((t) => fly(t, ctx, generation));
    }
  };

  // Without the field to fly from: the axes draw, then the tools bloom one by one.
  const enter = (lead = 0, ctx = window.deckNav) => {
    visitCtx = ctx;
    reset();
    size();
    if (motionOff() || ctx?.rest || ctx?.direct) { root.classList.add('is-drawn', 'is-labelled'); tools.forEach((el) => el.classList.add('is-in')); entryFinish?.(ctx, 'completed'); return; }
    const dy = lift();
    tools.forEach((el, i) => {
      const p = disc(el, dy);
      flights.push({ el, ...p, x0: p.x1, y0: p.y1, cx: p.x1, cy: p.y1, r0: 1, c0: tint(el), c1: tint(el),
        delay: lead + 0.45 + i * 0.03, dur: 0.42, dot: true });
    });
    stretchFlight(ctx);
    later(150 * flightStretch, () => { if (ctx?.isTransitionCurrent?.()) root.classList.add('is-drawn'); });
    later((900 + lead * 1000) * flightStretch, () => { if (ctx?.isTransitionCurrent?.()) root.classList.add('is-labelled'); });
    fire(ctx);
  };

  // From the field: its dots become the tools, its dust becomes the axes.
  const arrive = (ctx = visitCtx) => {
    visitCtx = ctx;
    reset();
    const snap = field && field.snapshot ? field.snapshot() : null;
    if (!snap || motionOff()) { enter(0, ctx); return; }
    size();
    const dy = lift();
    const sources = snap.named.slice().sort((a, b) => b.p - a.p);
    const spare = snap.dust.slice();
    const curve = (x0, y0, x1, y1) => {
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, d = Math.hypot(x1 - x0, y1 - y0);
      const bend = (rnd() < 0.5 ? -1 : 1) * d * (0.12 + rnd() * 0.25);
      return { cx: mx + ((y0 - y1) / (d || 1)) * bend, cy: my + ((x1 - x0) / (d || 1)) * bend };
    };
    tools.forEach((el, i) => {
      const p = disc(el, dy);
      const src = sources[i] || spare.pop() || { x: rnd() * innerWidth, y: rnd() * innerHeight, color: '#e0ab5e', r: 2 };
      flights.push({
        el, x0: src.x, y0: src.y, ...p, ...curve(src.x, src.y, p.x1, p.y1),
        r0: Math.max(1.2, src.r || 2), c0: rgb(src.color), c1: tint(el),
        delay: i * 0.025 + rnd() * 0.15, dur: 0.95 + rnd() * 0.35, dot: true,
      });
    });
    // Dust settles along the two axes.
    const box = root.querySelector('.gp-axes').getBoundingClientRect();
    const along = (k) => (k < 0.5
      ? { x: box.left + box.width * (0.04 + 0.92 * (k * 2)), y: box.top - dy + box.height / 2 }
      : { x: box.left + box.width / 2, y: box.top - dy + box.height * (0.04 + 0.92 * ((k - 0.5) * 2)) });
    spare.slice(0, 150).forEach((d, i, all) => {
      const p = along((i + rnd() * 0.6) / all.length);
      flights.push({
        x0: d.x, y0: d.y, x1: p.x, y1: p.y, ...curve(d.x, d.y, p.x, p.y),
        r0: 1.1, r1: 1.1, c0: rgb(d.color), c1: [224, 171, 94], delay: rnd() * 0.25, dur: 0.75 + rnd() * 0.35, dot: false,
      });
    });
    stretchFlight(ctx);
    later(950 * flightStretch, () => { if (ctx?.isTransitionCurrent?.()) root.classList.add('is-drawn'); });
    later(1500 * flightStretch, () => { if (ctx?.isTransitionCurrent?.()) root.classList.add('is-labelled'); });
    fire(ctx);
  };

  const smooth = (k) => k * k * (3 - 2 * k);
  const orb = (x, y, r, c, a, glow) => {
    if (!g) return;
    if (glow > 0.004) {
      const halo = g.createRadialGradient(x, y, 0, x, y, r * 2.4);
      halo.addColorStop(0, `rgba(${c},${glow.toFixed(3)})`);
      halo.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = halo;
      g.beginPath(); g.arc(x, y, r * 2.4, 0, 7); g.fill();
    }
    if (a > 0.004) { g.fillStyle = `rgba(${c},${a.toFixed(3)})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  };
  // Where a flight is a fraction k of the way: its curve, eased in and out; a tool's orb takes its size and colour as it lands.
  const along = (f, k) => {
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const u = 1 - e;
    const x = u * u * f.x0 + 2 * u * e * f.cx + e * e * f.x1;
    const y = u * u * f.y0 + 2 * u * e * f.cy + e * e * f.y1;
    const w = smooth(clamp((k - 0.35) / 0.65)); // size and colour come in as it lands
    const r = f.r0 + (f.r1 - f.r0) * (f.dot ? w : e);
    const c = f.c0.map((v, j) => Math.round(v + (f.c1[j] - v) * (f.dot ? w : e)));
    return { x, y, r, c };
  };
  const fly = (now, ctx = visitCtx, generation = forwardGeneration) => {
    if (generation !== forwardGeneration || ctx !== visitCtx || !ctx?.isTransitionCurrent?.()) return;
    forwardRaf = 0;
    const clock = window.deckNow?.() ?? now;
    flightTime += Math.max(0, (clock - (flightLast || clock)) / 1000) / flightStretch;
    flightLast = clock;
    const t = flightTime;
    g?.clearRect(0, 0, innerWidth, innerHeight);
    const drawn = t > 0.95; // once the axes start drawing, the settled dust fades into them
    flights = flights.filter((f) => {
      const k = clamp((t - f.delay) / f.dur);
      if (k <= 0) return true;
      if (f.dot && k >= 1) {
        // Landed: the disc is there beneath the orb; the orb melts into it as the logo resolves.
        if (!f.el.classList.contains('is-in')) f.el.classList.add('is-in');
        const m = clamp((t - f.delay - f.dur) / MORPH);
        f.el.style.setProperty('--m', smooth(m).toFixed(3));
        if (m >= 1) { f.el.style.removeProperty('--m'); return false; }
        const fade = 1 - smooth(clamp(m / 0.8));
        orb(f.x1, f.y1, f.r1, f.c1, 0.92 * fade, 0.35 * (1 - smooth(m)));
        return true;
      }
      const { x, y, r, c } = along(f, k);
      let a = f.dot ? 0.92 * Math.min(1, k * 6) : 0.75;
      if (!f.dot && drawn) a *= clamp(1 - (t - 0.95) / 0.7);
      if (!f.dot && a <= 0.01) return false;
      orb(x, y, r, c, a, f.dot ? a * 0.35 : 0);
      return true;
    });
    if (flights.length) forwardRaf = requestAnimationFrame((t) => fly(t, ctx, generation));
    else { g?.clearRect(0, 0, innerWidth, innerHeight); flying = false; if (!backs.length) show(false); entryFinish?.(ctx, 'completed'); }
  };

  // ---- Leaving for slide 4, and coming back ---------------------------------
  // On to slide 4 the tools scatter like startled mice, rippling out from the empty ring: each flinches, then darts
  // off a short way towards the bottom left, away from the ring, zigzagging and gathering speed as it goes, and only
  // at the end of its run shrinks and is gone. The axes and labels fade, and the ring is left to lift off alone and
  // become the core's bright eye (core.js). Back from slide 4 it is the same run played backwards, at a slower pace:
  // the ring flies home to its corner while the tools zigzag back in from the bottom left, slowing as they come, and
  // settle in their places with a last small start as it lands; the axes and labels fade in round them.
  const vis = root.parentElement;
  const RUN = 0.6; // seconds from the first tool flinching to the last gone (the chart is put away at 0.7 s)
  const HOME = 0.72; // seconds, coming back, from the first setting off home to the last settled
  let runs = [], awaiting = null, expected = null;
  const settle = (keepBare = false) => {
    runs.forEach((a) => a.cancel());
    runs = [];
    awaiting = null;
    vis?.classList.remove('gp-held');
    if (!keepBare) { root.classList.remove('is-bare'); empty.style.visibility = ''; }
  };
  // Each tool's run, in its own time t (0 → 1): a flinch back towards the ring with a small swell, then off towards
  // the bottom left (leaning away from the ring), accelerating, darting from side to side about its heading; it stays
  // whole for most of the run and shrinks and fades over its last stretch. Coming back plays the same frames backwards.
  const tri = (x) => (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * x)); // a zigzag between -1 and 1, one cycle per unit
  const FLINCH = 0.16; // of each run
  const scurry = (back = false) => {
    runs.forEach((a) => a.cancel());
    runs = [];
    const h = empty.querySelector('i').getBoundingClientRect(), box = root.getBoundingClientRect();
    const hx = h.left + h.width / 2, hy = h.top + h.height / 2;
    const reach = Math.max(36, Math.min(box.width, box.height) * 0.16);
    const mice = tools.map((el) => {
      const r = el.querySelector('i').getBoundingClientRect();
      if (!r.width || (!back && !el.classList.contains('is-in'))) return null;
      const x = r.left + r.width / 2, y = r.top + r.height / 2, d = Math.hypot(x - hx, y - hy) || 1;
      const base = getComputedStyle(el).transform;
      return { el, d, ax: (x - hx) / d, ay: (y - hy) / d, base: base === 'none' ? '' : base };
    });
    const far = Math.max(1, ...mice.map((m) => (m ? m.d : 0)));
    mice.forEach((m) => {
      if (!m) return;
      m.delay = 0.18 * (m.d / far) + 0.04 * rnd(); // rippling out from the ring
      m.dur = 0.34 + 0.08 * rnd();
    });
    const end = Math.max(0.01, ...mice.map((m) => (m ? m.delay + m.dur : 0)));
    const slow = (back ? HOME : RUN) / end;
    mice.forEach((m) => {
      if (!m) return;
      let dx = -0.62 + 0.38 * m.ax, dy = 0.62 + 0.38 * m.ay;
      const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
      const dist = reach * (0.8 + 0.4 * rnd()), amp = Math.max(6, dist * (0.16 + 0.06 * rnd())), turns = 1.1 + 0.4 * rnd(), ph = rnd();
      const frames = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const f = clamp(t / FLINCH), q = clamp((t - FLINCH) / (1 - FLINCH)); // the flinch, then the run
        const a = t < FLINCH ? -0.06 * Math.sin(Math.PI * f) : Math.pow(q, 1.7); // how far out
        const w = amp * (tri(turns * q + ph) - tri(ph)) * Math.min(1, q * 4); // the darts, from its own phase
        const px = dx * dist * a - dy * w, py = dy * dist * a + dx * w;
        const sc = (1 + 0.07 * Math.sin(Math.PI * f)) * (1 - 0.5 * smooth(clamp((t - 0.7) / 0.3)));
        frames.push({ transform: `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) ${m.base} scale(${sc.toFixed(3)})`, opacity: (1 - smooth(clamp((t - 0.78) / 0.22))).toFixed(3) });
      }
      if (back) frames.reverse();
      const delay = (back ? end - m.delay - m.dur : m.delay) * slow;
      runs.push(m.el.animate(frames, { duration: m.dur * slow * 1000, delay: delay * 1000, fill: 'both' }));
    });
  };
  // While its tools run, the chart holds its own layer up; everything but the tools and the ring fades.
  const bare = () => { vis?.classList.add('gp-held'); root.classList.add('is-bare'); };
  // Back from slide 4: the chart waits, its tools away, for the ring (core.js says when its flight begins). Their
  // runs home are laid out now and held at their start, so that the ring's lift-off frame stays light.
  const await_ = (ctx) => {
    visitCtx = ctx;
    reset();
    root.classList.add('is-drawn', 'is-labelled');
    bare();
    empty.style.visibility = 'hidden';
    tools.forEach((el) => el.classList.add('is-in'));
    scurry(true);
    runs.forEach((a) => a.pause());
    awaiting = ctx;
  };
  window.GapScurry = {
    expect: (ctx) => { expected = ctx; },
    // The ring has begun its flight home, lasting `flight` seconds: the tools come home over its last HOME seconds.
    home: (ctx, flight) => {
      if (awaiting !== ctx || !ctx.isCurrent()) return;
      timers.push(window.deckLater(() => {
        if (awaiting === ctx && ctx.isTransitionCurrent()) { root.classList.remove('is-bare'); empty.style.visibility = ''; }
      }, Math.max(0, flight - 0.6) * 1000, ctx));
      const wait = Math.max(0, flight - HOME) * 1000;
      runs.forEach((a) => { a.effect.updateTiming({ delay: a.effect.getTiming().delay + wait }); a.play(); });
      const done = runs.length ? Promise.all(runs.map((a) => a.finished)) : Promise.resolve();
      done.then(() => {
        if (awaiting !== ctx) return;
        settle();
        entryFinish?.(ctx, 'completed');
      }, () => {});
    },
  };

  // ---- Going back ----------------------------------------------------------
  // A step back to slide 2: the arrival from the field, played backwards. Each logo melts back into its orb, which
  // flies back along a curve to one of the field's dots, shrinking and taking on its colour as it goes; the dust
  // lifts off the axes as they fade and flies back out into the field, which waits, still, for its dots.
  let backs = [], backT = 0, backLast = 0, backRaf = 0, departRaf = 0;
  const unfly = (now) => {
    backRaf = 0;
    const clock = window.deckNow?.() ?? now;
    const dt = Math.max(0, (clock - (backLast || clock)) / 1000);
    backLast = clock;
    backT += dt;
    g?.clearRect(0, 0, innerWidth, innerHeight);
    backs = backs.filter((f) => {
      const t = f.end - backT; // the arrival's own clock, running backwards
      if (f.dot) {
        const m = clamp((t - f.delay - f.dur) / MORPH);
        if (m > 0) { // still landed: the logo resolving back into the orb
          f.el.style.setProperty('--m', smooth(m).toFixed(3));
          orb(f.x1, f.y1, f.r1, f.c1, 0.92 * (1 - smooth(clamp(m / 0.8))), 0.35 * (1 - smooth(m)));
          return true;
        }
      }
      const k = clamp((t - f.delay) / f.dur);
      if (k <= 0) return false; // back where it came from
      const { x, y, r, c } = along(f, k);
      let a = f.dot ? 0.92 * Math.min(1, k * 6) : 0.75 * clamp(1 - (t - 0.95) / 0.7) * smooth(clamp(k * 5));
      orb(x, y, r, c, a, f.dot ? a * 0.35 : 0);
      return true;
    });
    if (backs.length) backRaf = requestAnimationFrame(unfly);
    else endDepart();
  };
  const endDepart = () => {
    if (departRaf) cancelAnimationFrame(departRaf);
    departRaf = 0;
    if (backRaf) cancelAnimationFrame(backRaf);
    backRaf = 0; backs = [];
    g?.clearRect(0, 0, innerWidth, innerHeight);
    if (!flying) show(false);
    if (!slide.classList.contains('on')) reset();
    reverseFinish?.(visitCtx, 'completed');
  };
  const depart = (ctx) => {
    visitCtx = ctx;
    const signal = ctx?.signal;
    field.hold?.(2.2);
    // Once the field has drawn a frame, its dots are where they will be met.
    departRaf = requestAnimationFrame(() => {
      departRaf = 0;
      if (signal?.aborted || !ctx?.isTransitionCurrent?.() || slide.classList.contains('on') || !fieldSlide.classList.contains('on')) return;
      const snap = field.snapshot();
      size();
      const targets = snap.named.slice().sort((a, b) => b.p - a.p), spare = snap.dust.slice();
      const curve = (x0, y0, x1, y1) => {
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, d = Math.hypot(x1 - x0, y1 - y0);
        const bend = (rnd() < 0.5 ? -1 : 1) * d * (0.12 + rnd() * 0.25);
        return { cx: mx + ((y0 - y1) / (d || 1)) * bend, cy: my + ((x1 - x0) / (d || 1)) * bend };
      };
      backs = [];
      tools.forEach((el, i) => {
        const p = disc(el, 0);
        const src = targets[i] || spare.pop() || { x: rnd() * innerWidth, y: innerHeight * (0.6 + 0.3 * rnd()), color: '#e0ab5e', r: 2 };
        const f = { el, x0: src.x, y0: src.y, ...p, ...curve(src.x, src.y, p.x1, p.y1), r0: Math.max(1.2, src.r || 2), c0: rgb(src.color), c1: tint(el), delay: 0, dur: 0.95 + rnd() * 0.35, dot: true };
        f.end = f.dur + MORPH; // every logo starts turning back at once, as the chart fades
        backs.push(f);
      });
      const box = root.querySelector('.gp-axes').getBoundingClientRect();
      const along_ = (k) => (k < 0.5
        ? { x: box.left + box.width * (0.04 + 0.92 * (k * 2)), y: box.top + box.height / 2 }
        : { x: box.left + box.width / 2, y: box.top + box.height * (0.04 + 0.92 * ((k - 0.5) * 2)) });
      spare.slice(0, 150).forEach((d, i, all) => {
        const p = along_((i + rnd() * 0.6) / all.length);
        backs.push({ x0: d.x, y0: d.y, x1: p.x, y1: p.y, ...curve(d.x, d.y, p.x, p.y), r0: 1.1, r1: 1.1, c0: rgb(d.color), c1: [224, 171, 94],
          delay: rnd() * 0.25, dur: 0.75 + rnd() * 0.35, dot: false, end: 1.65 });
      });
      backT = 0; backLast = window.deckNow?.() ?? performance.now();
      show(true);
      backRaf = requestAnimationFrame(unfly);
    });
  };

  let entryFinish = null, reverseFinish = null;
  const completion = (ctx, assign, cleanup) => {
    let resolve, done = false;
    const promise = new Promise((r) => { resolve = r; });
    const finish = (owner, result) => {
      if (owner !== ctx || done) return;
      done = true; assign(null); resolve(result);
    };
    assign(finish);
    ctx.defer(() => { finish(ctx, 'cancelled'); cleanup(); });
    return promise;
  };
  const sceneEnter = (ctx) => {
    const promise = completion(ctx, (fn) => { entryFinish = fn; }, () => { retireForward(); if (awaiting === ctx) settle(); if (waiting) { waiting.disconnect(); waiting = null; } });
    visitCtx = ctx;
    const ringBack = expected === ctx; // core.js is about to fly the ring home
    expected = null;
    if (backs.length || backRaf || departRaf) endDepart();
    if (ringBack && ctx.back && !motionOff()) await_(ctx); // a step back lands at rest, but with its tools running home
    else if (ctx.rest || ctx.direct) enter(0, ctx);
    else if (ctx.from === 1) arrive(ctx);
    else begin(ctx);
    return promise;
  };
  const sceneExit = (ctx) => {
    clearInterval(asking);
    focus(null);
    // The neighbouring scene can measure before the network starts its turn.
    if ((ctx.to === 3 && !ctx.direct && !ctx.rest && !motionOff()) || (ctx.to === 1 && ctx.back)) ctx.present(slide, 'dt-leaving');
    if (ctx.to === 1 && field?.snapshot && ctx.back && !motionOff() && tools.every((el) => el.classList.contains('is-in'))) {
      timers.forEach(window.deckCancelLater); timers = []; retireForward(true);
      const promise = completion(ctx, (fn) => { reverseFinish = fn; }, () => endDepart());
      depart(ctx);
      return promise;
    }
    retireForward();
    // On to slide 4: the tools run off as the ring lifts off.
    if (ctx.to === 3 && !ctx.direct && !ctx.rest && !motionOff()) { bare(); scurry(); }
    // A direct navigation can settle before this departure tail has elapsed.
    // Keep the cleanup visit-owned, just like the motion it retires.
    timers.push(window.deckLater(() => {
      if (slide.classList.contains('on')) return;
      reset(ctx.to === 3);
      // Once the slide has faded right out, the bare chart can be put back as it was.
      if (ctx.to === 3) timers.push(window.deckLater(() => { if (!slide.classList.contains('on')) settle(); }, 1400, ctx));
    }, 700, ctx));
  };
  // On a first load the Mycelial mark plays first (dot-transitions.js): the tools bloom once it has landed.
  const html = document.documentElement;
  let waiting = null;
  const begin = (ctx = visitCtx) => {
    if (waiting) { waiting.disconnect(); waiting = null; }
    if (ctx?.direct || !html.classList.contains('dt-intro')) { enter(0, ctx); return; }
    reset();
    waiting = new MutationObserver(() => {
      if (html.classList.contains('dt-intro')) return;
      waiting.disconnect(); waiting = null;
      if (slide.classList.contains('on') && ctx?.isCurrent?.()) enter(0.4, ctx); // as the chart fades up
    });
    waiting.observe(html, { attributes: true, attributeFilter: ['class'] });
  };
  const keep = new MutationObserver(keepSky);
  keep.observe(slide, { attributes: true, attributeFilter: ['class'] });
  if (fieldSlide) keep.observe(fieldSlide, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('deck-motion', () => { if (motionOff() && slide.classList.contains('on')) enter(0, visitCtx); });
  const sceneRestore = (ctx) => {
    if (backs.length || backRaf || departRaf) endDepart();
    if (waiting) { waiting.disconnect(); waiting = null; }
    retireForward(Boolean(backs.length || backRaf || departRaf));
    timers.forEach(window.deckCancelLater); timers = [];
    if (ctx.to !== 2) { reset(); return true; }
    settle();
    // Flight endpoints were measured in the old viewport. Finish at the new
    // chart instead of leaving old pixel coordinates suspended over it.
    show(false);
    g?.clearRect(0, 0, innerWidth, innerHeight);
    root.classList.add('is-drawn', 'is-labelled');
    tools.forEach((el) => { el.classList.add('is-in'); el.style.removeProperty('--m'); });
    return true;
  };
  const sceneResize = (ctx) => {
    if (near()) size();
    return ctx.to !== 2 || (sky.width > 0 && sky.height > 0);
  };
  window.deckRegisterScene?.([2], { enter: sceneEnter, exit: sceneExit, restore: sceneRestore, resize: sceneResize });
})();
