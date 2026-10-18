// Version F, slide 1: recipients of the last Arca Gidan Prize, their films as cards standing on a slow ring seen a
// little from above, each named at its top. The film at the front plays; the others wait round the ring, smaller and
// dimmer, as stills from their films (same-origin, so slide 2 can sample them). Now and then the ring turns one place,
// unhurried, and holds again. A pointer resting on the ring stops it; a card hovered, clicked, tapped or focused comes
// round to the front, and the ring can be turned by hand. The front film opens in a player that grows out of its card
// (or, for a film that can't be embedded, its page on arcagidan.com). Leaving the slide, the ring recedes into the
// distance, which is where slide 2's field picks up (it samples each card where it stands: faces()).
(() => {
  const root = document.querySelector('[data-collage]');
  if (!root) return;
  const slide = root.closest('.slide');
  const vis = root.closest('.vis');
  const text = slide.querySelector('.split > :first-child');
  const sub = text.querySelector('.body');
  const label = vis.querySelector('.vc-label');
  const tiles = [...root.querySelectorAll('.vc-tile')];
  const N = tiles.length, STEP = (2 * Math.PI) / N;
  // Reduced motion, or the viewer's own "animations off" switch (window.deckStill): no previews, a ring that never
  // turns by itself, and one that jumps rather than swings when asked.
  let still = window.deckStill ? window.deckStill() : matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STREAM = 'https://customer-xt84pg68d7eakb9h.cloudflarestream.com'; // where arcagidan.com hosts its films
  const FILM = 16 / 9; // every film here is 16:9
  const CARD = 4 / 5; // every card is the shape of To be continued's still
  let open = null;
  const primed = new Map(); // tile → its film's poster, fetched ahead of a click
  const resting = new Map(); // tile → the timer that brings its still back
  const overviewOpen = () => document.getElementById('overview')?.classList.contains('on');
  const posterOf = (tile) => `${STREAM}/${tile.dataset.film}/thumbnails/thumbnail.jpg?time=${tile.dataset.at}s&height=720`;
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const wrap = (a) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI)); // to (-π, π]

  // Each card crops its still and preview to 4:5 round its subject (data-crop, an object-position), and carries its
  // title and artist inside its top edge.
  tiles.forEach((t) => {
    t.querySelectorAll('img, video').forEach((m) => { m.style.objectPosition = t.dataset.crop || '50% 50%'; });
    const name = document.createElement('span');
    name.className = 'vc-name';
    name.setAttribute('aria-hidden', 'true'); // the button already says it
    name.append(Object.assign(document.createElement('b'), { textContent: t.dataset.title }),
      Object.assign(document.createElement('i'), { textContent: ' · ' }), Object.assign(document.createElement('span'), { textContent: t.dataset.artist }));
    t.appendChild(name);
  });

  // ---- The ring --------------------------------------------------------------------------------------------------
  // Lengths are in card heights; the ring is fitted to .vis and scaled to pixels by k.
  const DEG = Math.PI / 180;
  const W1 = CARD; // a card's width
  const G = { R: 1.55, cam: 2.5, P: 3.9, H: 1.7, lift: 24 * DEG, yaw: 26 * DEG, k: 100, cx: 0, cy: 0, front: 1 };
  // A point (y down from the floor, z toward us) as the camera sees it, before scaling: x, y and depth. The camera
  // stands above the ring and looks level, its lens shifted down (as an architect's camera does), so the floor opens
  // into an ellipse and the cards at the back show over the front one, while every card stays upright and the front
  // one square on.
  const see = (x, y, z) => {
    const p = G.P / (G.P - z);
    return [x * p, (y + G.H) * p, z];
  };
  // Where card i stands at ring angle a (0 is the front): turned partly with the ring, so the ones at the sides show
  // the curve, while those at the back still face us across it.
  const stand = (a) => ({ x: G.R * Math.sin(a), z: G.R * Math.cos(a), yaw: G.yaw * Math.sin(a) });
  // A point on a card (u across, v down from its top) in the world.
  const corner = (f, u, v) => {
    const dx = (u - 0.5) * W1;
    return [f.x + dx * Math.cos(f.yaw), v - 1, f.z - dx * Math.sin(f.yaw)];
  };

  // Each card's matrix: its own pixels (laid out at the size it has at the front, so it is only ever drawn smaller)
  // to the ring's box, perspective included, so the browser and slide 2 see exactly the same quad.
  const matrixOf = (a) => {
    const f = stand(a), q = 1 / (G.k * G.front);
    const cy = Math.cos(f.yaw), sy = Math.sin(f.yaw);
    // x, y, z affine in the card's pixels (u, v): x = x0 + xu·u, y = y0 + yv·v, z = z0 + zu·u.
    const x0 = f.x - (W1 / 2) * cy, xu = q * cy;
    const y0 = G.H - 1, yv = q;
    const z0 = f.z + (W1 / 2) * sy, zu = -q * sy;
    const W0 = 1 - z0 / G.P, Wu = -zu / G.P;
    const m = [
      G.k * xu + G.cx * Wu, G.cy * Wu, 0, Wu,
      0, G.k * yv, 0, 0,
      0, 0, 1, 0,
      G.k * x0 + G.cx * W0, G.k * y0 + G.cy * W0, 0, W0,
    ];
    return { m, depth: f.z };
  };
  const apply = (m, u, v) => { const w = m[3] * u + m[7] * v + m[15]; return [(m[0] * u + m[4] * v + m[12]) / w, (m[1] * u + m[5] * v + m[13]) / w]; };

  // The whole ring's reach on screen over a turn (unscaled), so it is fitted once and never spills.
  const FLOOR = 1.1; // the floor's line runs just outside the cards' feet
  const reach = () => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const take = ([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
    for (let a = 0; a < 2 * Math.PI; a += STEP / 6) {
      const f = stand(a);
      for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) take(see(...corner(f, u, v)));
    }
    for (let a = 0; a < 2 * Math.PI; a += Math.PI / 24) take(see(G.R * FLOOR * Math.sin(a), 0, G.R * FLOOR * Math.cos(a)));
    return { x0, x1, y0, y1 };
  };

  // The floor: a hairline circle the cards stand on, and a small node at each one's foot (the front one's lit).
  const NS = 'http://www.w3.org/2000/svg';
  const floor = document.createElementNS(NS, 'svg');
  floor.setAttribute('class', 'vc-floor');
  floor.setAttribute('aria-hidden', 'true');
  const track = document.createElementNS(NS, 'path');
  floor.appendChild(track);
  const nodes = tiles.map(() => floor.appendChild(document.createElementNS(NS, 'circle')));
  root.prepend(floor);

  // Fit the ring into .vis (inside its padding, above the label), wider than the space where a narrow screen lets the
  // side cards run off its edges.
  let box = null, holes = [];
  const SHADE = 0.9; // how deep the shade under the words goes
  // The words' lines, each one box however many inline pieces it has (its em, a link), let down by dy.
  const lineBoxes = (dy) => {
    const out = [];
    for (const el of text.querySelectorAll('.num, h1, .body')) {
      const range = document.createRange();
      range.selectNodeContents(el);
      for (const r of range.getClientRects()) {
        if (r.width < 2) continue;
        const line = out.find((b) => Math.abs(b.mid - (r.top + r.bottom) / 2 - dy) < r.height * 0.4);
        if (line) { line.left = Math.min(line.left, r.left); line.right = Math.max(line.right, r.right); continue; }
        out.push({ left: r.left, right: r.right, top: r.top + dy, bottom: r.bottom + dy, h: r.height, mid: (r.top + r.bottom) / 2 + dy });
      }
    }
    return out;
  };
  // The mask: white where the ring shows, the lines' boxes in feathered dark.
  const shadeOf = (w, h) => {
    const rects = holes.map((b) => `<rect x="${b.x0.toFixed(1)}" y="${b.y0.toFixed(1)}" width="${(b.x1 - b.x0).toFixed(1)}" height="${(b.y1 - b.y0).toFixed(1)}" rx="${(b.f).toFixed(1)}"/>`).join('');
    const f = Math.max(...holes.map((b) => b.f));
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(0)}" height="${h.toFixed(0)}"><defs>` +
      `<filter id="f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(f * 0.55).toFixed(1)}"/></filter>` +
      `<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${w.toFixed(0)}" height="${h.toFixed(0)}"><rect width="100%" height="100%" fill="#fff"/>` +
      `<g filter="url(#f)" fill="#000" fill-opacity="${SHADE}">${rects}</g></mask></defs><rect width="100%" height="100%" fill="#fff" mask="url(#m)"/></svg>`;
  };
  // How much of the ring shows at a point in its box (the mask, for slide 2's motes): the same feathered boxes.
  const through = (x, y) => {
    let dark = 0;
    for (const b of holes) {
      const dx = Math.max(b.x0 - x, 0, x - b.x1), dy = Math.max(b.y0 - y, 0, y - b.y1), d = Math.hypot(dx, dy);
      const inside = Math.min(x - b.x0, b.x1 - x, y - b.y0, b.y1 - y);
      const e = inside > 0 ? 0.5 + 0.5 * clamp(inside / b.f) : 0.5 - 0.5 * clamp(d / b.f);
      dark = Math.max(dark, e);
    }
    return 1 - SHADE * dark;
  };
  const chrome = document.querySelector('.chrome');
  const layout = () => {
    const cs = getComputedStyle(vis);
    const pad = ['Top', 'Right', 'Bottom', 'Left'].map((s) => parseFloat(cs[`padding${s}`]) || 0);
    const W = vis.clientWidth - pad[1] - pad[3], H = vis.clientHeight - pad[0] - pad[2];
    if (W <= 0 || H <= 0) return false;
    // Seen well enough from above that the cards at the back show over the front one. The ring keeps its size
    // however many films stand on it: more of them simply stand closer together.
    Object.assign(G, W < H * 0.9
      ? { R: 1.35, cam: 2.5, lift: 19 * DEG, yaw: 28 * DEG }
      : { R: 1.55, cam: 2.5, lift: 24 * DEG, yaw: 26 * DEG });
    G.P = G.cam * G.R; // the camera's distance, in ring radii
    G.H = G.P * Math.tan(G.lift); // and its height, as the angle it looks down at the ring's middle
    G.front = G.P / (G.P - G.R);
    const under = label.offsetHeight + 16;
    // How much of the ring's width must be on screen: on a phone held upright the side cards run off its edges.
    const cover = W < H * 0.9 ? 0.72 : W < H * 1.25 ? 0.88 : 1;
    const r = reach(), rw = r.x1 - r.x0, rh = r.y1 - r.y0;
    // The ring's middle as the eye sees it at rest: half way from the tops of the cards at the back to the foot of
    // the front one (unscaled, down from the horizon).
    const crown = Math.min(...tiles.map((_, i) => see(...corner(stand(wrap(i * STEP)), 0.5, 0))[1]));
    const heart = (crown + G.H * G.front) / 2;
    // The words where the slide's padding alone puts them (the last layout may have let them down: see below).
    const vb = vis.getBoundingClientRect(), shift = parseFloat(slide.style.getPropertyValue('--text-shift')) || 0;
    const tr = text.getBoundingClientRect();
    const tb = { left: tr.left, right: tr.right, top: tr.top - shift, bottom: tr.bottom - shift, width: tr.width, height: tr.height };
    // Beside the words (a wide screen), the ring's middle stands level with the middle of the words. Under them (a
    // tall screen, where the CSS sets --ring-under, or a window too narrow for the ring to stand beside the words at
    // a good size), the ring and its label take the space below the words, a little below its middle.
    const footer = chrome?.getBoundingClientRect().top ?? innerHeight, capH = label.offsetHeight, t0 = tb.top - vb.top;
    const foot = pad[0] + H - under;
    const words = { right: tb.right - vb.left, bottom: tb.bottom - vb.top + 10 };
    // Beside the words the ring's left edge runs an eighth of its width in under their end (the cards there sink
    // into shade behind the words, below), and the ring takes about four fifths of the height from the words' top
    // margin to the footer, leaving the rest to share out over it and round its label.
    const BLEED = 0.125, right = pad[3] + W, room = right - words.right;
    const kBeside = Math.min(room / ((1 - BLEED) * rw), (foot - pad[0]) / rh, (0.78 * (footer - t0)) / rh);
    const below = Math.max(pad[0], tb.bottom - vb.top + 20);
    const kUnder = Math.min((vis.clientWidth - 2 * pad[1]) / (innerWidth > 760 ? 0.92 : cover) / rw, (foot - below) / rh);
    const under2 = cs.getPropertyValue('--ring-under').trim() === '1' || kUnder > kBeside * 1.15;
    root.classList.toggle('is-under', under2);
    const floorY = under2 ? below : pad[0];
    const level = under2 ? 0 : (tb.top + tb.bottom) / 2 - vb.top;
    G.k = Math.max(1, under2 ? kUnder : kBeside);
    const frontTop = () => G.cy + G.k * (G.H - 1) * G.front; // in the ring's box
    let left, top;
    const place = () => {
      G.cx = -G.k * r.x0; G.cy = -G.k * r.y0;
      const wide = G.k * rw;
      left = under2 ? (vis.clientWidth - wide) / 2 : words.right - BLEED * wide;
      top = level ? level - G.cy - G.k * heart : floorY + Math.max(0, foot - floorY - G.k * rh) * 0.55;
    };
    place();
    // The cards pass under the words only as they recede: the front card stays clear of them, so where they would
    // meet, the ring is drawn a little smaller.
    for (let n = 0; n < 24 && G.k > 1 && !under2; n++) {
      const x = left + G.cx - G.k * (W1 / 2) * G.front, y = top + frontTop();
      if (!(x < words.right + 24 && y < words.bottom)) break;
      G.k *= 0.97;
      place();
    }
    // Then the whole (words, ring and label) is let down to sit centred between the slide's top and the footer: as
    // much room over the higher of ring and words as under the label, which stands two thirds of the way from the
    // front card's foot to the footer. The cards keep at least the words' top margin, and the words' label stays in
    // the top fifth of the screen.
    // (.vis covers the slide beside the words, and the slide's top is the screen's: the footer and the top fifth
    // are taken from the screen, as the slide may still be sliding in.) Where the two limits meet, the ring keeps
    // its margin and the words their place, and their middles part by a little.
    let drop = 0, capTop = top + G.k * rh + 6;
    if (!under2) {
      const sole = top + G.cy + G.k * G.H * G.front;
      const even = 0.75 * ((footer - sole) / 3 - capH / 2 - (Math.min(top, t0) - t0));
      const ringDrop = Math.max(0, even, t0 - top);
      drop = clamp(even, 0, Math.max(0, innerHeight * 0.2 - t0));
      top += ringDrop;
      // (never so far under a short ring that it loses it)
      const base = top + G.k * rh + 4;
      capTop = clamp(sole + ringDrop + (footer - sole - ringDrop) * (2 / 3) - capH / 2, base, Math.max(base, Math.min(footer - capH - 10, base + innerHeight * 0.07)));
    }
    slide.style.setProperty('--text-shift', `${drop.toFixed(1)}px`);
    box = { left, top, width: G.k * rw, height: G.k * rh };
    // Beside the words, whatever of a card stands behind a line of them goes into shade: the ring's mask is cut
    // from the words' own lines, feathered, so the words stay crisp over the cards and the rest of each card keeps
    // its light (and the network behind the words, which the mask never touches, shows as before).
    holes = under2 ? [] : lineBoxes(drop - shift).map((b) => ({
      x0: b.left - vb.left - left - b.h * 0.35, x1: b.right - vb.left - left + b.h * 0.35,
      y0: b.top - vb.top - top - b.h * 0.12, y1: b.bottom - vb.top - top + b.h * 0.12, f: Math.max(6, b.h * 0.3),
    }));
    const m = holes.length ? `url("data:image/svg+xml,${encodeURIComponent(shadeOf(G.k * rw, G.k * rh))}")` : '';
    root.style.webkitMaskImage = root.style.maskImage = m;
    root.style.webkitMaskSize = root.style.maskSize = '100% 100%';
    Object.assign(root.style, { left: `${left.toFixed(1)}px`, top: `${top.toFixed(1)}px`, width: `${box.width.toFixed(1)}px`, height: `${box.height.toFixed(1)}px` });
    const cw = W1 * G.k * G.front;
    tiles.forEach((t) => { t.style.width = `${cw.toFixed(1)}px`; t.style.height = `${(cw / CARD).toFixed(1)}px`; });
    root.style.setProperty('--card', `${cw.toFixed(1)}px`); // the names are set to the cards' size
    root.classList.toggle('is-small', cw < 200); // a narrow card names its film on two short lines
    // The label: centred under the ring, as wide as the room either side of its middle allows.
    const mid = left + box.width / 2, half = Math.min(mid - (under2 ? 0 : pad[3]) + 16, vis.clientWidth - mid - 8, 300);
    vis.style.setProperty('--ring-x', `${mid.toFixed(1)}px`);
    vis.style.setProperty('--ring-half', `${Math.max(120, half).toFixed(1)}px`);
    vis.style.setProperty('--ring-foot', `${capTop.toFixed(1)}px`);
    floor.setAttribute('viewBox', `0 0 ${box.width.toFixed(1)} ${box.height.toFixed(1)}`);
    let d = '';
    for (let j = 0; j <= 96; j++) {
      const a = (j / 96) * 2 * Math.PI, [x, y] = see(G.R * FLOOR * Math.sin(a), 0, G.R * FLOOR * Math.cos(a));
      d += `${j ? 'L' : 'M'}${(G.cx + G.k * x).toFixed(1)} ${(G.cy + G.k * y).toFixed(1)}`;
    }
    track.setAttribute('d', `${d}Z`);
    return true;
  };

  // The ring's angle: card i stands at angle + i·STEP (0 is the front).
  let angle = 0;
  const frontOf = (a) => ((Math.round(-a / STEP) % N) + N) % N;
  let posed = [];
  const pose = () => {
    if (!box) return;
    posed = tiles.map((t, i) => {
      const a = wrap(angle + i * STEP), { m, depth } = matrixOf(a);
      t.style.transform = `matrix3d(${m.map((n) => +n.toFixed(6)).join(',')})`;
      // Only the front card is fully alive; the rest darken and pale with distance round the ring, as if in haze, and
      // only the front one's name can be read.
      // By places from the front, so however many films there are, the next ones rest as dim as ever.
      const q = (Math.abs(a) / STEP) ** 2, near = (1 + Math.cos(a)) / 2;
      const shade = 0.17 + 0.83 * Math.exp(-1.55 * q), sat = 0.3 + 0.7 * Math.exp(-0.85 * q);
      t.style.setProperty('--veil', (1 - shade).toFixed(3));
      t.style.setProperty('--name', Math.exp(-5.5 * q).toFixed(3));
      t.style.filter = sat > 0.995 ? '' : `saturate(${sat.toFixed(3)})`;
      const [nx, ny] = see(G.R * FLOOR * Math.sin(a), 0, G.R * FLOOR * Math.cos(a));
      nodes[i].setAttribute('cx', (G.cx + G.k * nx).toFixed(1));
      nodes[i].setAttribute('cy', (G.cy + G.k * ny).toFixed(1));
      nodes[i].setAttribute('r', (1.6 + 1.2 * near).toFixed(2));
      nodes[i].style.opacity = (0.18 + 0.82 * Math.exp(-2.6 * q)).toFixed(3);
      return { t, i, a, m, depth, shade, sat };
    });
    [...posed].sort((p, q) => p.depth - q.depth).forEach((p, z) => { p.t.style.zIndex = String(z + 1); });
    const f = frontOf(angle);
    tiles.forEach((t, i) => t.classList.toggle('is-front', i === f && Math.abs(wrap(angle + i * STEP)) < STEP * 0.12));
    sync();
  };

  // For slide 2: each card's quad on screen right now (a function from its own u, v to client px), how lit it is, and
  // how far round the ring it stands (0 the front, 1 the back).
  root.faces = () => {
    if (!posed.length) return [];
    const r = root.getBoundingClientRect(), s = root.offsetWidth ? r.width / root.offsetWidth : 1;
    return posed.map((p) => ({
      tile: p.t, shade: p.shade, sat: p.sat, far: (1 - Math.cos(p.a)) / 2, depth: p.depth, aspect: CARD,
      at: (u, v) => { const [x, y] = apply(p.m, u * p.t.offsetWidth, v * p.t.offsetHeight); return [r.left + x * s, r.top + y * s]; },
      through: (x, y) => through((x - r.left) / s, (y - r.top) / s),
    }));
  };

  // ---- The front film plays --------------------------------------------------------------------------------------
  const allowed = () => !still && !open && slide.classList.contains('on') && !document.hidden && !overviewOpen();
  const load = (tile) => {
    const v = tile.querySelector('video');
    if (v.firstElementChild) return;
    // A <source>, so the deck's own media warmer (video[src]) leaves it alone.
    v.append(Object.assign(document.createElement('source'), { src: tile.dataset.preview, type: 'video/mp4' }));
    v.preload = 'auto';
    v.load(); // WebKit only starts on a <source> added later when told to
  };
  // Playing only while it is the film at the front; back to its first frame (the still) once it has faded out.
  const preview = (tile, on) => {
    const v = tile.querySelector('video');
    if (on && allowed()) {
      load(tile);
      v.play().catch(() => {});
      if (tile.dataset.film && !primed.has(tile)) primed.set(tile, Object.assign(new Image(), { src: posterOf(tile) })); // ahead of a click
      return;
    }
    v.pause();
    if (!tile.classList.contains('is-live')) return;
    // Leaving the slide, the frame it shows stays until slide 2 has sampled it, then the still comes back.
    clearTimeout(resting.get(tile));
    resting.set(tile, setTimeout(() => {
      if (!v.paused) return;
      tile.classList.remove('is-live');
      setTimeout(() => { if (v.paused) v.currentTime = 0; }, 350);
    }, slide.classList.contains('on') ? 0 : 1000));
  };
  tiles.forEach((tile) => {
    const v = tile.querySelector('video');
    v.addEventListener('playing', () => { clearTimeout(resting.get(tile)); tile.classList.add('is-live'); });
  });
  let playing = null;
  const opening = () => document.documentElement.classList.contains('dt-intro');
  // The card nearest the front plays (handing over half way through a turn); its neighbours load ahead of their turn.
  const sync = () => {
    const f = frontOf(angle);
    const want = allowed() && !opening() ? tiles[f] : null;
    if (want === playing) return;
    if (playing) preview(playing, false);
    playing = want;
    if (want) {
      preview(want, true);
      [1, -1].forEach((d) => load(tiles[(f + d + N) % N]));
    }
  };

  // ---- Turning ---------------------------------------------------------------------------------------------------
  // A turn eases out of rest (or out of whatever speed a hand left it with) and settles with no jolt at either end:
  // a quintic from (angle, speed) to (target, still). Times in ms, speeds in radians per ms.
  let turn = null, speed = 0, raf = 0, timer = 0, hovering = false, drag = null, press = null, pressing = false;
  const DWELL = 6500, AUTO = 3400; // each film holds the front a good while; the ring turns on slowly
  const goal = () => (turn ? turn.to : angle);
  const nearest = (a) => Math.round(a / STEP) * STEP;
  const turnTo = (to, T, v0 = 0, asked = true) => {
    if (still || T <= 0) { turn = null; angle = to; speed = 0; pose(); return; }
    turn = { from: angle, to, T, V: v0 * T, t0: performance.now(), asked };
    wake();
  };
  const along = (tn, s) => {
    const D = tn.to - tn.from, V = tn.V;
    const c3 = 10 * D - 6 * V, c4 = -15 * D + 8 * V, c5 = 6 * D - 3 * V;
    return [tn.from + s * (V + s * s * (c3 + s * (c4 + s * c5))), (V + s * s * (3 * c3 + s * (4 * c4 + s * 5 * c5))) / tn.T];
  };
  // Bring film i round the short way; further takes a little longer, never a rush.
  const bring = (i) => {
    const target = goal() + wrap(-i * STEP - goal());
    if (Math.abs(target - angle) < 1e-4) return;
    turnTo(target, 1100 + 650 * Math.min(2, Math.abs(target - angle) / STEP), turn ? speed : 0);
    if (!hovering) rest(DWELL * 1.5); // asked for, it holds the front a little longer
  };
  const active = () => slide.classList.contains('on') && !document.hidden && !overviewOpen();
  const held = () => hovering || drag || open || slide.classList.contains('vc-dissolve') || opening();
  const wake = () => { if (!raf && active()) raf = requestAnimationFrame(frame); };
  const frame = (t) => {
    raf = 0;
    if (!active()) return;
    if (turn) {
      const s = clamp((t - turn.t0) / turn.T);
      [angle, speed] = s < 1 ? along(turn, s) : [turn.to, 0];
      if (s >= 1) { turn = null; angle = wrap(angle); if (!timer) rest(); }
    }
    pose();
    if (turn || drag) raf = requestAnimationFrame(frame);
  };
  // Settled: hold the front, then turn on by one, unless something holds it.
  const rest = (ms = DWELL) => {
    clearTimeout(timer);
    timer = 0;
    if (still || !active()) return;
    timer = setTimeout(() => {
      timer = 0;
      if (!active() || still) return;
      if (held() || turn) { rest(1500); return; }
      turnTo(angle - STEP, AUTO, 0, false);
    }, ms);
  };
  // Stopped part way through a turn (a pointer arriving, the slide left part way): settle on the nearest film.
  const settle = (T = 900) => {
    const to = nearest(angle + speed * 250);
    if (Math.abs(to - angle) < 1e-4) { turn = null; speed = 0; return; }
    turnTo(to, T, speed);
  };

  // ---- Hands -----------------------------------------------------------------------------------------------------
  const tileAt = (e) => e.target.closest?.('.vc-tile');
  const perRadian = () => G.k * G.front * G.R; // px the front film moves for a radian of turn
  // A mouse on the ring holds it. Resting on a side film a moment brings that one round; a film sliding under a
  // still pointer doesn't count, only the pointer moving onto one.
  let intent = 0, lastXY = null;
  root.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse') return;
    hovering = true;
    if (turn && !turn.asked) settle(1100);
  });
  root.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return;
    hovering = false;
    clearTimeout(intent);
    if (!turn) rest();
  });
  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || open) return;
    const tile = tileAt(e);
    pressing = true;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, tile, front: !!tile && tile === tiles[frontOf(goal())] && !turn };
  });
  root.addEventListener('pointermove', (e) => {
    if (press && pressing && e.pointerId === press.id) {
      const dx = e.clientX - press.x, dy = e.clientY - press.y;
      if (!drag && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        // Turned by hand: the front film follows the hand.
        drag = { from: angle, x: e.clientX, trail: [] };
        turn = null; speed = 0;
        root.classList.add('is-turning');
        try { root.setPointerCapture(e.pointerId); } catch {}
        clearTimeout(intent);
      }
      if (drag) {
        angle = drag.from + (e.clientX - drag.x) / perRadian();
        drag.trail.push([e.timeStamp, angle]);
        if (drag.trail.length > 8) drag.trail.shift();
        wake();
        return;
      }
    }
    if (e.pointerType !== 'mouse' || drag) return;
    if (lastXY && lastXY[0] === e.clientX && lastXY[1] === e.clientY) return;
    lastXY = [e.clientX, e.clientY];
    clearTimeout(intent);
    const tile = tileAt(e);
    if (!tile || tile === tiles[frontOf(goal())]) return;
    intent = setTimeout(() => { if (hovering && !drag && tile.matches(':hover')) bring(tiles.indexOf(tile)); }, 420);
  });
  // Let go, the ring coasts on with the hand's speed and settles on the film nearest where it would come to rest.
  let dragged = 0;
  const release = (e, fling) => {
    if (!press || e.pointerId !== press.id) return;
    pressing = false;
    if (!drag) return;
    const tr = drag.trail, last = tr[tr.length - 1], first = tr.find((q) => last[0] - q[0] < 100) || last, from = drag.from;
    drag = null; press = null;
    dragged = performance.now();
    root.classList.remove('is-turning');
    const v = fling && last[0] > first[0] ? clamp((last[1] - first[1]) / (last[0] - first[0]), -0.008, 0.008) : 0;
    // A third of the way to the next film is enough to mean it.
    const moved = angle + clamp(v * 320, -2.2 * STEP, 2.2 * STEP) - nearest(from);
    const to = nearest(from) + Math.sign(moved) * Math.min(2, Math.floor(Math.abs(moved) / STEP + 0.7)) * STEP;
    turnTo(to, 900 + 500 * Math.min(1.5, Math.abs(to - angle) / STEP), v);
    if (!hovering) rest(DWELL * 1.5);
  };
  root.addEventListener('pointerup', (e) => release(e, true));
  root.addEventListener('pointercancel', (e) => release(e, false));
  root.addEventListener('dragstart', (e) => e.preventDefault());
  // A trackpad's sideways swipe turns it too, settling on a film once the fingers lift.
  let wheelEnd = 0;
  root.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || open) return;
    e.preventDefault(); // and keeps the browser's own swipe back through history out of it
    turn = null;
    angle -= (e.deltaX * (e.deltaMode === 1 ? 16 : 1)) / perRadian();
    speed = 0;
    wake();
    clearTimeout(wheelEnd);
    wheelEnd = setTimeout(() => { settle(700); if (!hovering) rest(DWELL * 1.5); }, 140);
  }, { passive: false });

  // A click (or a tap) on the ring never turns the slide. On a side film it brings that film round; on the front film
  // it opens it. Enter on a focused film opens it: focusing it already brought it round.
  root.addEventListener('click', (e) => {
    e.stopPropagation();
    const was = press;
    press = null;
    if (performance.now() - dragged < 250) return;
    const tile = tileAt(e);
    if (!tile) return;
    const front = e.detail === 0 ? tile === tiles[frontOf(goal())] : was?.tile === tile ? was.front : tile === tiles[frontOf(goal())] && !turn;
    if (!front) { bring(tiles.indexOf(tile)); return; }
    if (tile.dataset.film) show(tile);
    else window.open(tile.dataset.page, '_blank', 'noopener');
  });
  // Focus from the keyboard brings a film round (a press brings it on the click instead, so a drag can start).
  tiles.forEach((tile, i) => tile.addEventListener('focus', () => { if (!pressing && !open) bring(i); }));

  // On, off, hidden, overview: the ring only moves (and the front film only plays) while slide 1 is on screen.
  // Left part way through a turn, it holds where it is, so slide 2 takes it apart (and puts it back) exactly there.
  const syncMotion = () => {
    if (active() && !slide.classList.contains('vc-dissolve')) {
      if (Math.abs(angle - nearest(angle)) > 1e-4 && !turn && !drag) settle(1200);
      else if (!turn && !timer) rest();
      wake();
    } else {
      clearTimeout(timer);
      timer = 0;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      turn = null; speed = 0;
      if (drag) { drag = null; press = null; pressing = false; root.classList.remove('is-turning'); }
    }
    sync();
  };
  new MutationObserver(syncMotion).observe(slide, { attributes: true, attributeFilter: ['class'] });
  // The opening keeps the ring still; the first turn waits a full hold after the films appear.
  let opened = !opening();
  new MutationObserver(() => {
    if (opened || opening()) return;
    opened = true;
    sync();
    rest();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', syncMotion);
  window.addEventListener('deck-overview', syncMotion);
  window.addEventListener('deck-motion', () => {
    still = window.deckStill();
    if (still) { turn = null; speed = 0; angle = nearest(angle); pose(); }
    syncMotion();
  });

  // ---- The player, built once ------------------------------------------------------------------------------------
  const box2 = document.createElement('div');
  box2.className = 'vc-box';
  box2.setAttribute('role', 'dialog');
  box2.setAttribute('aria-modal', 'true');
  box2.setAttribute('aria-label', 'Prize recipient');
  box2.innerHTML = `<figure class="vc-frame"><img alt=""></figure>
    <div class="vc-meta"><span class="vc-kicker">Arca Gidan Prize · recipient</span><span class="vc-title"></span>
    <a class="vc-page" target="_blank" rel="noopener">Its page on arcagidan.com ↗</a></div>
    <button class="vc-close" type="button" aria-label="Close">×</button>`;
  document.body.appendChild(box2);
  const frame2 = box2.querySelector('.vc-frame');
  const poster = frame2.querySelector('img');
  const title = box2.querySelector('.vc-title');
  const page = box2.querySelector('.vc-page');
  const meta = box2.querySelector('.vc-meta');
  let player = null;
  poster.addEventListener('load', () => poster.classList.add('is-ready'));

  // Largest 16:9 rect that fits the screen, a little above centre.
  // On a short screen it also stays clear of the title under it (and so the player's controls stay clickable).
  const fit = () => {
    const below = meta.getBoundingClientRect().top - 12;
    let w = innerWidth * 0.86, h = w / FILM;
    const tall = Math.min(innerHeight * 0.74, below - 12);
    if (h > tall) { h = tall; w = h * FILM; }
    return { x: (innerWidth - w) / 2, y: Math.min((innerHeight - h) / 2 - innerHeight * 0.04, below - h), w, h };
  };
  // The card is a crop of its still, and the still a full-height crop of its film's frame (data-focus places it there).
  // Laid over the card, the player is that frame scaled to the card's size and clipped to the card's crop, so the full
  // frame opens out of it. On the ring the card is a quad in perspective: the player starts from a 4:5 rect over it.
  const crop = (tile) => {
    const q = root.faces().find((f) => f.tile === tile);
    let r = tile.getBoundingClientRect();
    if (q) {
      const [l, rr, tp, bt] = [q.at(0, 0.5)[0], q.at(1, 0.5)[0], q.at(0.5, 0)[1], q.at(0.5, 1)[1]];
      const h = bt - tp, w = h * CARD;
      r = { left: (l + rr) / 2 - w / 2, top: tp, width: w, height: h };
    }
    const img = tile.querySelector('img'), still = +img.getAttribute('width') / +img.getAttribute('height') || CARD;
    const [fx, fy] = (tile.dataset.focus || '50% 50%').split(' ').map((n) => parseFloat(n) / 100);
    const [ox, oy] = (tile.dataset.crop || '50% 50%').split(' ').map((n) => parseFloat(n) / 100);
    const sw = Math.min(1, still / FILM), sx = (1 - sw) * fx; // the still, in the frame
    const cw = sw * Math.min(1, CARD / still), ch = Math.min(1, still / CARD); // the card, in the frame
    return { r, cw, ch, sw, fx, fy, x0: sx + (sw - cw) * ox, y0: (1 - ch) * oy };
  };
  const over = (tile, to) => {
    const c = crop(tile), s = c.r.width / (c.cw * to.w);
    const insets = [c.y0 * to.h, (1 - c.x0 - c.cw) * to.w, (1 - c.y0 - c.ch) * to.h, c.x0 * to.w].map((n) => `${n.toFixed(2)}px`);
    return {
      transform: `translate(${c.r.left - to.x - c.x0 * to.w * s}px, ${c.r.top - to.y - c.y0 * to.h * s}px) scale(${s})`,
      clipPath: `inset(${insets.join(' ')} round ${(4 / s).toFixed(2)}px)`,
    };
  };
  let at2 = null;

  const show = (tile) => {
    open = tile;
    sync();
    tiles.forEach((t) => preview(t, false));
    title.textContent = `${tile.dataset.title} — ${tile.dataset.artist}`;
    page.href = tile.dataset.page;
    at2 = fit();
    const c = crop(tile);
    Object.assign(frame2.style, {
      left: `${at2.x}px`, top: `${at2.y}px`, width: `${at2.w}px`, height: `${at2.h}px`, transition: 'none', ...over(tile, at2),
      // Until the film's own poster is in, the tile's still holds its place in the frame.
      backgroundImage: `url("${tile.querySelector('img').currentSrc}")`,
      backgroundSize: `${c.sw * 100}% 100%`,
      backgroundPosition: `${c.fx * 100}% 50%`,
    });
    poster.classList.remove('is-ready');
    poster.src = posterOf(tile);
    player = document.createElement('iframe');
    player.title = `${tile.dataset.title} by ${tile.dataset.artist}`;
    player.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
    player.allowFullscreen = true;
    player.addEventListener('load', () => player?.classList.add('is-ready'), { once: true });
    player.src = `${STREAM}/${tile.dataset.film}/iframe?autoplay=${!still}&preload=auto&poster=${encodeURIComponent(posterOf(tile))}`;
    frame2.appendChild(player);
    box2.classList.add('is-on');
    frame2.getBoundingClientRect(); // commit the starting pose before growing
    frame2.style.transition = '';
    frame2.style.transform = 'none';
    frame2.style.clipPath = 'inset(0 round 6px)';
    box2.querySelector('.vc-close').focus({ preventScroll: true });
  };

  const hide = () => {
    if (!open) return;
    const tile = open;
    open = null;
    Object.assign(frame2.style, over(tile, at2));
    box2.classList.remove('is-on');
    const gone = player;
    player = null;
    setTimeout(() => { gone?.remove(); if (!open) poster.removeAttribute('src'); }, 550);
    tile.focus({ preventScroll: true });
    sync();
    if (!hovering) rest();
  };

  // The prize's name under the ring links to its site; following it leaves the slide where it is.
  label.querySelector('a')?.addEventListener('click', (e) => e.stopPropagation());
  box2.addEventListener('click', (e) => { if (!e.target.closest('.vc-frame, .vc-page')) hide(); });
  // While it's open, the deck's keys and swipes wait; Esc closes.
  const DECK_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'PageUp', 'PageDown', 'Home', 'End', 'o', 'O', 'v', 'V', 'Escape']);
  addEventListener('keydown', (e) => {
    if (!open || !DECK_KEYS.has(e.key)) return;
    e.stopPropagation();
    e.preventDefault();
    if (e.key === 'Escape') hide();
  }, true);
  addEventListener('touchend', (e) => { if (open) e.stopPropagation(); }, true);

  const relayout = () => { if (layout()) pose(); };
  window.deckOnResize(() => {
    relayout();
    if (!open) return;
    at2 = fit();
    Object.assign(frame2.style, {
      transition: 'none', transform: 'none', clipPath: 'inset(0 round 6px)', left: `${at2.x}px`, top: `${at2.y}px`, width: `${at2.w}px`, height: `${at2.h}px`,
    });
    requestAnimationFrame(() => { if (open) frame2.style.transition = ''; });
  });
  // Fonts landing change the caption's height; the first layout may come before .vis has a size.
  if (document.fonts) document.fonts.ready.then(relayout);
  // The words change size as their fonts land and as the deck moves the slide's label into them.
  const watch = new ResizeObserver(relayout);
  watch.observe(vis);
  watch.observe(text);
  relayout();
  syncMotion();
})();
