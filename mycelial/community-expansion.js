// Slide 9's expanding three-circle creative world, drawn inside the existing
// flywheel scene. Stateless by design: no own RAF, timers, DOM, or navigation.
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const smooth = (v) => { const x = clamp(v); return x * x * (3 - 2 * x); };
  const lerp = (a, b, u) => a + (b - a) * u;
  const rgba = (c, a) => 'rgba(' + c + ',' + clamp(a).toFixed(4) + ')';
  const GOLD = '240,200,119', LIGHT = '255,217,145';

  const ROLES = Object.freeze(['Artists', 'Model trainers', 'Workflow builders', 'Toolmakers', 'Knowledge sharers']);
  const ROLE_ANGLES = Object.freeze(ROLES.map((_, i) => -Math.PI / 2 + i * TAU / ROLES.length));
  const roleRadius = (scale = 1, tall = false) => (tall ? 13 : 20) * Math.max(.75, scale);
  // EXACTLY on the centreline of the inner ring. The circumference, orb
  // position, live light route and pulse all share these same angles.
  const rolePositions = (ring) => {
    const [cx, cy, rx, ry] = ring;
    return ROLE_ANGLES.map((angle) => ({
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
      angle
    }));
  };

  // The third ring is a genuine enclosing oval, with its horizontal extent
  // governed by the available viewport instead of an arbitrary small halo.
  // Outer rings must remain separate even on a short landscape phone.
  const geometry = (ring, tall = false, viewport = {}) => {
    const [cx, cy, rx, ry] = ring;
    const { width, height, short = false } = viewport;
    const maxX = Number.isFinite(width)
      ? Math.max(rx * 1.55, Math.min(cx - (short ? 24 : 18), width - cx - (short ? 24 : 18)))
      : rx * 3.5;
    const outerX = Math.max(rx * 1.55,
      Math.min(rx * (tall ? 2.06 : short ? 2.42 : 3.40), maxX));
    const top = short ? Math.max(55, height * .15) : tall ? Math.max(76, height * .09) : Math.max(79, height * .10);
    const bottom = short ? height * .58 : tall ? height * .68 : height * .755;
    const maxY = Number.isFinite(height) ? Math.min(cy - top, bottom - cy) : ry * 2.12;
    const outerY = Math.max(ry * 1.14,
      Math.min(ry * (tall ? 2.0 : short ? 1.85 : 2.05), Math.max(ry * 1.16, maxY)));
    const openRx = Math.min(rx * (tall ? 1.46 : short ? 1.55 : 1.72), outerX * .81);
    const openRy = Math.min(ry * (tall ? 1.43 : short ? 1.3 : 1.34), outerY * .79);
    return {
      cx, cy, rx, ry,
      openRx, openRy,
      reachRx: outerX, reachRy: outerY, // retain established test/API names
      outerRx: outerX, outerRy: outerY,
    };
  };

  // One single style of ring label, and one label per ring. Role labels are
  // separate orb captions, not another concentric-circle taxonomy.
  const labelPositions = (ring, tall = false, scale = 1, viewport = {}) => {
    const z = geometry(ring, tall, viewport);
    const { short = false } = viewport;
    const r = roleRadius(scale, tall);
    if (short) return {
      community: [z.cx, z.cy + z.ry + r + 9],
      open: [z.cx - z.openRx * .92, z.cy - z.openRy * .45],
      world: [z.cx + z.outerRx * .74, z.cy - z.outerRy * .70],
    };
    if (tall) return {
      community: [z.cx, z.cy - z.ry - r - 11],
      open: [z.cx, z.cy - z.openRy - 15],
      world: [z.cx, z.cy - z.outerRy - 12],
    };
    return {
      community: [z.cx - z.rx * .61, z.cy - z.ry * .95],
      open: [z.cx - z.openRx * .96, z.cy - z.openRy * .33],
      world: [z.cx + z.outerRx * .73, z.cy - z.outerRy * .69],
    };
  };

  // m=0 on slide 9, 1 on slide 10, 2 on slide 11. Time is the SAME
  // paced deck clock, including the bespoke reverse 9->8 Flowers handoff.
  const visibility = ({ time = 0, morph = 0, motesAt = 2, tall = false, reversingTo8 = false }) => {
    const onNine = 1 - smooth(tall ? morph / .25 : (morph - .08) / .42);
    const grow = reversingTo8
      ? smooth((time - .35) / 2.25)
      : smooth((time - motesAt + 1.25) / 1.45);
    return clamp(onNine * grow);
  };

  const oval = (g, cx, cy, rx, ry) => {
    g.beginPath();
    g.ellipse(cx, cy, Math.max(.1, rx), Math.max(.1, ry), 0, 0, TAU);
  };
  const point = (cx, cy, rx, ry, a) => [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  const spark = (g, x, y, r, a) => {
    g.fillStyle = rgba(LIGHT, a);
    g.beginPath(); g.arc(x, y, Math.max(.15, r), 0, TAU); g.fill();
  };

  // Middle and OUTER rings are now both complete and visibly distinct.
  // The outer one emerges last and expands horizontally across most of the
  // available picture, then folds away before the initiative-card expansion.
  const paint = (g, ring, {
    tall = false, short = false, width, height, scale = 1, time = 0, visibility: amount = 0
  } = {}) => {
    if (!g || amount <= .003) return;
    const z = geometry(ring, tall, { width, height, short });
    const k = Math.max(.4, scale);
    const q = smooth(amount);
    const middleRx = lerp(z.rx * 1.05, z.openRx, q);
    const middleRy = lerp(z.ry * 1.05, z.openRy, q);
    const outerQ = smooth((amount - .20) / .72);
    const outerRx = lerp(z.openRx * 1.03, z.outerRx, outerQ);
    const outerRy = lerp(z.openRy * 1.03, z.outerRy, outerQ);
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // Open-source AI ecosystem: an organic but legible two-strand oval.
    g.lineWidth = Math.max(.8, 1.20 * k);
    g.strokeStyle = rgba(GOLD, .55 * amount);
    oval(g, z.cx, z.cy, middleRx, middleRy); g.stroke();
    g.setLineDash([3 * k, 10 * k]);
    g.lineWidth = Math.max(.55, .7 * k);
    g.strokeStyle = rgba(LIGHT, .23 * amount);
    oval(g, z.cx, z.cy, middleRx + 10 * k, middleRy + 8 * k); g.stroke();
    g.setLineDash([]);

    // Broader creative world: a FULL wide oval, not two ambiguous arcs.
    if (outerQ > .003) {
      g.lineWidth = Math.max(1, 1.32 * k);
      g.strokeStyle = rgba(GOLD, .60 * outerQ);
      oval(g, z.cx, z.cy, outerRx, outerRy); g.stroke();
      g.lineWidth = Math.max(.55, .7 * k);
      g.strokeStyle = rgba(LIGHT, .20 * outerQ);
      oval(g, z.cx, z.cy, outerRx - 8 * k, outerRy - 6 * k); g.stroke();
    }

    // Sparse network seeds between the community and open-source layer.
    // These belong to the wider world, not the five human-scale roles.
    for (let i = 0; i < 17; i++) {
      const a = i * 2.39996323, f = .27 + (i * 7 % 13) / 19;
      const p = point(z.cx, z.cy, lerp(z.rx, middleRx, f), lerp(z.ry, middleRy, f), a);
      spark(g, p[0], p[1], (i % 5 === 0 ? 1.6 : .95) * k, (i % 5 === 0 ? .62 : .28) * amount);
    }
    // Two quiet flows across the middle ring, not a second mechanical wheel.
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 + .24;
      const u = (time * (i % 2 === 0 ? .055 : -.065) + i * .19) % 1;
      const f = (u + 1) % 1;
      const p = point(z.cx, z.cy, lerp(z.rx, middleRx, f), lerp(z.ry, middleRy, f), a);
      spark(g, p[0], p[1], 1.4 * k, .38 * amount);
    }
    // Tiny distant glimmers ON the world boundary. Never obscure labels.
    if (outerQ > .003) for (let i = 0; i < 15; i++) {
      const a = i * TAU / 15 + .31;
      const p = point(z.cx, z.cy, outerRx, outerRy, a);
      spark(g, p[0], p[1], (i % 4 ? .7 : 1.25) * k, (i % 4 ? .22 : .45) * outerQ);
    }
    g.restore();
  };

  const paintRoles = (g, ring, {
    tall = false, scale = 1, time = 0, opacity = 1, impacts = []
  } = {}) => {
    if (!g || opacity <= .003) return;
    const nodes = rolePositions(ring), radius = roleRadius(scale, tall);
    const k = Math.max(.7, scale);
    g.save();
    g.lineCap = 'round';
    // Do NOT connect the nodes with straight polygon chords. The ring itself
    // is the physical connection: the stroke passes beneath all five orbs.
    nodes.forEach(({ x, y }, i) => {
      const hit = clamp(impacts[i] || 0);
      const r = radius * (1 + .025 * Math.sin(time * .6 + i));
      const glow = g.createRadialGradient(x, y, r * .17, x, y, r * 1.65);
      glow.addColorStop(0, rgba(LIGHT, (.14 + .32 * hit) * opacity));
      glow.addColorStop(.62, rgba(GOLD, (.085 + .22 * hit) * opacity));
      glow.addColorStop(1, rgba(GOLD, 0));
      g.fillStyle = glow;
      g.beginPath(); g.arc(x, y, r * 1.65, 0, TAU); g.fill();
      // Opaque central disc masks the ring behind it, visually socketing the
      // role into its circumference rather than floating slightly inside.
      g.fillStyle = rgba('34,25,15', .92 * opacity);
      g.lineWidth = Math.max(1, 1.25 * k);
      g.strokeStyle = rgba(GOLD, (.80 + .20 * hit) * opacity);
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke();
      g.lineWidth = Math.max(.5, .7 * k);
      g.strokeStyle = rgba(LIGHT, (.28 + .65 * hit) * opacity);
      g.beginPath(); g.arc(x, y, r * .7, .2, 2.55); g.stroke();
      spark(g, x, y, Math.max(2.5, 3.7 * k) * (1 + .15 * hit), (.91 + .09 * hit) * opacity);
      if (hit > .003) {
        const burst = r * (1.08 + .35 * (1 - hit));
        g.lineWidth = Math.max(.75, 1.25 * k);
        g.strokeStyle = rgba(LIGHT, .79 * hit * opacity);
        g.beginPath(); g.arc(x, y, burst, 0, TAU); g.stroke();
      }
    });
    g.restore();
  };

  const api = Object.freeze({
    ROLES, ROLE_ANGLES, roleRadius, rolePositions,
    geometry, labelPositions, visibility, paint, paintRoles
  });
  if (typeof window !== 'undefined') window.MycelialCommunityExpansion = api;
})();
