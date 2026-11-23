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

  // Both circles follow the *actual fitted* flywheel ellipse, not a parallel
  // viewport layout. They can extend beyond the mobile screen and disappear
  // naturally into its edges; the central community always stays legible.
  const geometry = (ring, tall = false) => {
    const [cx, cy, rx, ry] = ring;
    return {
      cx, cy, rx, ry,
      openRx: rx * (tall ? 1.55 : 1.73),
      openRy: ry * (tall ? 1.45 : 1.34),
      reachRx: rx * (tall ? 1.92 : 2.12),
      reachRy: ry * (tall ? 1.77 : 1.56),
    };
  };
  const labelPositions = (ring, tall = false, scale = 1) => {
    const z = geometry(ring, tall);
    return {
      community: [z.cx, z.cy - z.ry - 16 * scale],
      open: [z.cx - z.openRx * (tall ? 0.67 : 0.72), z.cy - z.openRy * 0.86],
      ai: [z.cx + z.reachRx * 0.76, z.cy - z.reachRy * 0.70],
      creative: [z.cx + z.reachRx * 0.76, z.cy + z.reachRy * 0.72],
    };
  };

  // The same slide-progress variable as the original wheel drives 9->10 and
  // 10->9. During the dedicated 9->8 rewind, the wheel's clock is rewound
  // from 2.6 s, so use a reverse envelope starting at 1 to avoid a pop.
  const visibility = ({ time = 0, morph = 0, motesAt = 2.0, tall = false, reversingTo8 = false }) => {
    const nine = 1 - smooth(tall ? morph / 0.25 : (morph - 0.08) / 0.42);
    const introduction = reversingTo8
      ? smooth((time - 0.35) / 2.25)
      : smooth((time - motesAt + 0.30) / 1.55);
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

  const paint = (g, ring, { tall = false, scale = 1, time = 0, visibility: amount = 0 } = {}) => {
    if (!g || amount <= 0.003) return;
    const z = geometry(ring, tall), k = Math.max(0.35, scale);
    const q = smooth(amount), rx = lerp(z.rx * 1.07, z.openRx, q),
      ry = lerp(z.ry * 1.08, z.openRy, q);
    const beyond = smooth((amount - 0.27) / 0.64);
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';

    // A porous double orbit, thin enough to read as a larger community rather
    // than a hard enclosure or a second mechanical flywheel.
    g.lineWidth = Math.max(0.55, 0.85 * k);
    g.strokeStyle = rgba(GOLD, 0.28 * amount);
    oval(g, z.cx, z.cy, rx, ry); g.stroke();
    g.setLineDash([2.3 * k, 9 * k]);
    g.strokeStyle = rgba(LIGHT, 0.18 * amount);
    oval(g, z.cx, z.cy, rx + 11 * k, ry + 7 * k); g.stroke();
    g.setLineDash([]);

    // Deterministic, unevenly spaced nodes between the old wheel and the new
    // orbit. No random calls during paint: direct visits and reversals are stable.
    for (let i = 0; i < 38; i++) {
      const angle = (i * 2.399963229728653) % TAU;
      const f = 0.24 + ((i * 11) % 17) / 22;
      const x = z.cx + Math.cos(angle) * lerp(z.rx * 1.05, rx, f);
      const y = z.cy + Math.sin(angle) * lerp(z.ry * 1.05, ry, f);
      const strength = i % 7 === 0 ? 0.7 : i % 3 === 0 ? 0.43 : 0.24;
      spark(g, x, y, (i % 8 === 0 ? 1.9 : 1.1) * k, strength * amount);
      if (i % 6 === 0) {
        const inner = point(z.cx, z.cy, z.rx * 0.98, z.ry * 0.98, angle);
        g.lineWidth = Math.max(0.5, 0.6 * k);
        g.strokeStyle = rgba(GOLD, 0.13 * amount);
        path(g, [inner, [x, y]]); g.stroke();
      }
    }

    // Fine points moving out to the broader open-source ring, and occasional
    // inward returns: two-way participation, not merely a broadcast.
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * TAU + 0.14;
      const u = ((time * (i % 3 === 0 ? -0.13 : 0.10)) + i * 0.173) % 1;
      const f = (u + 1) % 1;
      const a = point(z.cx, z.cy, lerp(z.rx, rx, f), lerp(z.ry, ry, f), angle);
      spark(g, a[0], a[1], 1.65 * k, 0.52 * amount);
    }

    // The wider AI and creative worlds are TWO different destinations, not
    // further nested communities. Separate arc fragments and outward arrows.
    if (beyond > 0.003) {
      g.lineWidth = Math.max(0.55, 0.7 * k);
      g.strokeStyle = rgba(GOLD, 0.17 * beyond);
      oval(g, z.cx, z.cy, z.reachRx, z.reachRy, -1.03, -0.11); g.stroke();
      oval(g, z.cx, z.cy, z.reachRx * 1.01, z.reachRy * 1.01, 0.11, 0.99); g.stroke();

      for (const angle of [-0.66, 0.66]) {
        const from = point(z.cx, z.cy, rx, ry, angle);
        const to = point(z.cx, z.cy, z.reachRx, z.reachRy, angle);
        arrow(g, from, to, k, beyond);
        for (let i = 0; i < 5; i++) {
          const p = point(z.cx, z.cy,
            lerp(rx, z.reachRx, 0.4 + i / 9), lerp(ry, z.reachRy, 0.4 + i / 9),
            angle + (i - 2) * 0.14);
          spark(g, p[0], p[1], (i === 2 ? 1.75 : 1.05) * k,
            (0.30 + (i % 2) * 0.22) * beyond);
        }
        const moving = (time * 0.14 + (angle > 0 ? 0.37 : 0)) % 1;
        const p = point(z.cx, z.cy, lerp(rx, z.reachRx, moving), lerp(ry, z.reachRy, moving), angle);
        spark(g, p[0], p[1], 2.0 * k, 0.7 * beyond);
      }
    }
    g.restore();
  };

  const api = Object.freeze({ geometry, labelPositions, visibility, paint });
  if (typeof window !== 'undefined') window.MycelialCommunityExpansion = api;
})();
