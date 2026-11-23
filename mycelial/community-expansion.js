// Expanding reach around slide 9's existing live community flywheel.
// Stateless canvas paint: flywheel.js keeps sole ownership of animation time,
// geometry, canvas, labels, navigation and reverse handoffs.
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const smooth = (u) => { const v = clamp(u); return v * v * (3 - 2 * v); };
  const lerp = (a, b, u) => a + (b - a) * u;
  const rgba = (rgb, a) => 'rgba(' + rgb + ',' + clamp(a).toFixed(4) + ')';
  const GOLD = '240,200,119', LIGHT = '255,217,145';
  const ROLES = Object.freeze(['Artists', 'Model trainers', 'Workflow builders', 'Toolmakers', 'Knowledge sharers']);
  const ROLE_ANGLES = Object.freeze(ROLES.map((_, i) => -Math.PI / 2 + i * TAU / ROLES.length));
  const roleRadius = (scale = 1, tall = false) => (tall ? 13 : 20) * Math.max(.75, scale);
  const rolePositions = (ring, tall = false) => {
    // The centre of each role-orb is ON the actual fitted inner ellipse.
    const [cx, cy, rx, ry] = ring;
    return ROLE_ANGLES.map(angle => ({
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
      angle,
    }));
  };

  // All three circles derive from the existing fitted stage-9 wheel, not a
  // competing responsive layout. The final oval uses the space *available*
  // between the count at the top and the incoming slide headline below.
  const geometry = (ring, tall = false, viewport = null) => {
    const [cx, cy, rx, ry] = ring;
    const maxHorizontal = viewport
      ? Math.max(rx * 1.85, Math.min(
          viewport.width * (tall ? .455 : .465),
          cx - (tall ? 12 : 24),
          viewport.width - cx - (tall ? 12 : 24)
        ))
      : rx * (tall ? 2.4 : 4.6);
    const spaceAbove = viewport ? cy - (viewport.top ?? 0) - 10 : ry * 2.4;
    const spaceBelow = viewport ? (viewport.bottom ?? viewport.height) - cy - 12 : ry * 2.4;
    const availableVertical = Math.max(ry * 1.35, Math.min(spaceAbove, spaceBelow));
    const reachRx = Math.max(rx * 1.85, Math.min(rx * (tall ? 2.7 : 4.8), maxHorizontal));
    const reachRy = Math.max(ry * 1.32, Math.min(ry * (tall ? 2.10 : 2.45), availableVertical));
    const openRx = Math.min(reachRx * .67, rx * (tall ? 1.50 : 1.75));
    const openRy = Math.min(reachRy * .72, ry * (tall ? 1.40 : 1.50));
    return {cx, cy, rx, ry, openRx, openRy, reachRx, reachRy};
  };
  const labelPositions = (ring, tall = false, scale = 1, viewport = null) => {
    const z = geometry(ring, tall, viewport);
    // Three labels, same visual treatment. Place them on clear sections of
    // their own perimeters, offset from the five community participants.
    if (tall) return {
      community: [z.cx, z.cy + z.ry + roleRadius(scale, tall) + 13 * scale],
      open: [z.cx - z.openRx * .78, z.cy - z.openRy * .72],
      world: [z.cx + z.reachRx * .44, z.cy - z.reachRy * .84],
    };
    return {
      community: [z.cx, z.cy + z.ry + roleRadius(scale, tall) +
        (viewport?.short ? 30 : 16 * scale)],
      open: [z.cx - z.openRx * .78, z.cy - z.openRy * .74],
      world: [z.cx + z.reachRx * .56, z.cy - z.reachRy * .82],
    };
  };

  // The same slide-progress variable as the original wheel drives 9->10 and
  // 10->9. During the dedicated 9->8 rewind, the wheel's clock is rewound
  // from 2.6 s, so use a reverse envelope starting at 1 to avoid a pop.
  const visibility = ({ time = 0, morph = 0, motesAt = 2.0, tall = false, reversingTo8 = false }) => {
    const nine = 1 - smooth(tall ? morph / 0.25 : (morph - 0.08) / 0.42);
    const introduction = reversingTo8
      ? smooth((time - 0.35) / 2.25)
      : smooth((time - motesAt + 1.25) / 1.45);
    return clamp(nine * introduction);
  };

  const path = (g, pts) => {
    g.beginPath();
    pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  };
  const oval = (g, cx, cy, rx, ry, start = 0, end = TAU) => {
    g.beginPath();
    g.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, start, end);
  };
  const point = (cx, cy, rx, ry, a) => [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  const spark = (g, x, y, r, a) => {
    g.fillStyle = rgba(LIGHT, a);
    g.beginPath(); g.arc(x, y, Math.max(0.15, r), 0, TAU); g.fill();
  };

  const arrow = (g, a, b, k, alpha) => {
    if (alpha < 0.005) return;
    const [x0, y0] = a, [x1, y1] = b;
    const c1x = lerp(x0, x1, 0.35), c2x = lerp(x0, x1, 0.8);
    g.lineWidth = Math.max(0.65, 0.95 * k);
    g.strokeStyle = rgba(GOLD, 0.42 * alpha);
    g.beginPath();
    g.moveTo(x0, y0);
    g.bezierCurveTo(c1x, y0, c2x, y1, x1, y1);
    g.stroke();
    const dir = Math.atan2(y1 - y0, x1 - c2x);
    const sz = Math.max(3, 5 * k);
    const left = [x1 - sz * Math.cos(dir - 0.55), y1 - sz * Math.sin(dir - 0.55)];
    const right = [x1 - sz * Math.cos(dir + 0.55), y1 - sz * Math.sin(dir + 0.55)];
    path(g, [left, [x1, y1], right]); g.stroke();
  };

  const paint = (g, ring, {
    tall = false, scale = 1, time = 0, visibility: amount = 0, viewport = null,
  } = {}) => {
    if (!g || amount <= .003) return;
    const z = geometry(ring, tall, viewport), k = Math.max(.35, scale);
    // The open-source ring grows first. The broad world appears later, and
    // stays a complete oval rather than disconnected side fragments.
    const middle = smooth((amount - .04) / .74);
    const world = smooth((amount - .28) / .72);
    const mx = lerp(z.rx * 1.05, z.openRx, middle);
    const my = lerp(z.ry * 1.05, z.openRy, middle);
    const wx = lerp(mx * 1.08, z.reachRx, world);
    const wy = lerp(my * 1.08, z.reachRy, world);
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';

    // Middle: porous open-source ecosystem, similar material to inner wheel
    // but perceptibly larger and less intense.
    if (middle > .003) {
      g.lineWidth = Math.max(.9, 1.05 * k);
      g.strokeStyle = rgba(GOLD, .60 * middle);
      oval(g, z.cx, z.cy, mx, my); g.stroke();
      g.setLineDash([2.6 * k, 8 * k]);
      g.strokeStyle = rgba(LIGHT, .25 * middle);
      oval(g, z.cx, z.cy, mx + 9 * k, my + 8 * k); g.stroke();
      g.setLineDash([]);

      // Sparse luminous points between the existing community and its wider
      // open-source peers. No random frame-to-frame positions or clutter.
      for (let i = 0; i < 22; i++) {
        const a = (i * 2.399963229728653) % TAU;
        const f = .24 + ((i * 7) % 13) / 17;
        const x = z.cx + Math.cos(a) * lerp(z.rx * 1.08, mx, f);
        const y = z.cy + Math.sin(a) * lerp(z.ry * 1.08, my, f);
        spark(g, x, y, (i % 6 === 0 ? 1.7 : 1.0) * k,
          (i % 5 === 0 ? .56 : .30) * middle);
      }
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + .35;
        const f = ((time * (i % 3 === 0 ? -.10 : .08)) + i * .21) % 1;
        const u = (f + 1) % 1;
        const x = z.cx + Math.cos(a) * lerp(z.rx, mx, u);
        const y = z.cy + Math.sin(a) * lerp(z.ry, my, u);
        spark(g, x, y, 1.5 * k, .55 * middle);
      }
    }

    // Outer: ONE uninterrupted, clearly visible, horizontally broad ellipse.
    // Use the same warm gold as the other rings rather than a new motif.
    if (world > .003) {
      g.lineWidth = Math.max(1.0, 1.23 * k);
      g.strokeStyle = rgba(GOLD, .57 * world);
      oval(g, z.cx, z.cy, wx, wy); g.stroke();
      g.lineWidth = Math.max(.5, .7 * k);
      g.strokeStyle = rgba(LIGHT, .18 * world);
      oval(g, z.cx, z.cy, wx - 5 * k, wy - 4 * k); g.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i + .25) * TAU / 12;
        const [x, y] = point(z.cx, z.cy, wx, wy, a);
        spark(g, x, y, (i % 3 === 0 ? 1.65 : 1.0) * k, .39 * world);
      }
    }
    g.restore();
  };

  // One complete circuit in nine seconds, five equally spaced encounters.
  // Both geometry and hit events use the same phase, including frame skips.
  const ORBIT_PERIOD = 9;
  const orbitAngle = (time, start = 0) =>
    -Math.PI / 2 + TAU * Math.max(0, time - start) / ORBIT_PERIOD;
  const orbitHits = (previous, next, start = 0) => {
    if (next < start || next <= previous) return [];
    const found = previous < start ? [0] : [];
    const first = Math.floor((Math.max(previous, start) - start) * ROLES.length / ORBIT_PERIOD) + 1;
    const last = Math.floor((next - start) * ROLES.length / ORBIT_PERIOD);
    for (let beat = first; beat <= last; beat++) found.push(beat % ROLES.length);
    return found;
  };

  // The passing light and the orb are one animated system. Each orb's pulse
  // starts from the precise arrival of a travelling ring mote, not a timer.
  // impacts[i] is 1 on impact and decays toward zero over ~350ms.
  const paintRoles = (g, ring, {
    tall = false, scale = 1, time = 0, opacity = 1, impacts = [],
  } = {}) => {
    if (!g || opacity <= .003) return;
    const nodes = rolePositions(ring, tall), radius = roleRadius(scale, tall);
    const k = Math.max(.7, scale);
    g.save(); g.lineCap = 'round';
    nodes.forEach(({x, y}, i) => {
      const impact = clamp(impacts[i] || 0);
      const progress = 1 - impact;
      const r = radius * (1 + .015 * Math.sin(time * .95 + i));
      const haloR = r * (1.48 + .35 * progress);
      const aura = g.createRadialGradient(x, y, r * .2, x, y, haloR);
      aura.addColorStop(0, rgba(LIGHT, (.19 + .28 * impact) * opacity));
      aura.addColorStop(.57, rgba(GOLD, (.09 + .18 * impact) * opacity));
      aura.addColorStop(1, rgba(GOLD, 0));
      g.fillStyle = aura;
      g.beginPath(); g.arc(x, y, haloR, 0, TAU); g.fill();
      g.fillStyle = rgba('35,26,15', .90 * opacity);
      g.strokeStyle = rgba(LIGHT, (.67 + .33 * impact) * opacity);
      g.lineWidth = Math.max(1, (1.05 + .75 * impact) * k);
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke();
      g.strokeStyle = rgba(LIGHT, .22 * opacity);
      g.lineWidth = Math.max(.5, .7 * k);
      g.beginPath(); g.arc(x, y, r * .69, .1, 2.5); g.stroke();
      g.fillStyle = rgba(LIGHT, (.88 + .12 * impact) * opacity);
      g.beginPath(); g.arc(x, y, Math.max(2.5, 3.6 * k) * (1 + .28 * impact), 0, TAU); g.fill();
      if (impact > .003) {
        // Impact expands outward and fades; no scale snap or flashing text.
        g.lineWidth = Math.max(.6, .95 * k);
        g.strokeStyle = rgba(LIGHT, .65 * impact * opacity);
        g.beginPath(); g.arc(x, y, r * (1 + .5 * progress), 0, TAU); g.stroke();
      }
    });
    g.restore();
  };
  const api = Object.freeze({ ROLES, ROLE_ANGLES, ORBIT_PERIOD, roleRadius, rolePositions, orbitAngle, orbitHits, geometry, labelPositions, visibility, paint, paintRoles });
  if (typeof window !== 'undefined') window.MycelialCommunityExpansion = api;
})();
