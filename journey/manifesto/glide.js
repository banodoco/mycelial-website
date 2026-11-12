/* THE WAY DOWN IS ONE GLIDE (2026-11 — "the transition from the manifesto
   to purpose is still very janky ... make it smooth like the others").

   Every other move on the site is one blend: a captured start, a rest to
   land on, one clock, one quintic ease, every channel on that one phase.
   The Return used to replay the climb backwards instead — the climb's
   height inverted through `descentU`, with the orbit, the reading-column
   shift and a screen-space pin each on a clock of its own, and the phone on
   a curve of its own. Measured in the browser from the top of the climb, the
   phone's picture slid up to 15 px a frame (at 640 wide) with the view
   turning at 131 deg/s, in three separate surges; desktop's swept in a
   single surge, but the hero still reversed on screen twice (see
   docs/polish/manifesto-return-v3-report.md).

   A glide is described by what a viewer sees, not by where the camera is:

     yaw, pitch, roll   the view's heading, tilt and bank (scalars, so a view
                        looking straight down has no singular heading: turning
                        there is simply the picture rotating about its centre)
     sx, sy             where the ANCHOR (normally the hero's cap) sits on
                        screen, in normalised device coordinates
     scale              log(depth x tan(fov/2)): the anchor's apparent size
     fov                the lens
     look               log of the look-target distance (for readers of
                        controls.target; it does not change the picture)

   Each channel runs from the pose on screen to the landing on ONE quintic
   phase, so the anchor travels a straight line on screen, its size changes
   monotonically, the heading turns one way, and the lens moves with them.
   The camera's position follows from those channels exactly (glidePose), so
   it is never interpolated on its own. A press mid-climb carries the
   presented velocity of every channel into the glide through the quintic's
   tangent term, which is zero again (with its acceleration) at the landing.

   Nothing here knows about phones or desktops: both run the same law from
   wherever the camera is — a plain Return, a Return pressed during the
   climb's first seconds, a second press, or a new destination chosen
   mid-descent. */
export const GLIDE_HERO = Object.freeze({ x: 0, y: 2, z: 0 });   // the hero's cap
const smoother = v => { v = Math.max(0, Math.min(1, v)); return v * v * v * (v * (v * 6 - 15) + 10); };
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const GLIDE_KEYS = Object.freeze(['yaw', 'pitch', 'roll', 'sx', 'sy', 'scale', 'fov', 'look']);
const ANGLES = new Set(['yaw', 'roll']);

/** The view of a pose: forward `f` and image up `U`. A pose is either a
 *  presented camera ({forward, up}) or an authored rest ({target, roll}),
 *  whose bank is the site's world-up roll (journey/camera-roll.js). */
export function viewOf(pose) {
  if (pose.forward && pose.up) return { f: pose.forward, U: pose.up };
  const d = { x: pose.target.x - pose.position.x, y: pose.target.y - pose.position.y, z: pose.target.z - pose.position.z };
  const n = Math.hypot(d.x, d.y, d.z);
  const f = { x: d.x / n, y: d.y / n, z: d.z / n };
  const h = Math.hypot(f.x, f.z) || 1e-12;
  const r0 = { x: -f.z / h, y: 0, z: f.x / h };
  const u0 = { x: -f.y * r0.z, y: f.x * r0.z - f.z * r0.x, z: f.y * r0.x };
  const c = Math.cos(pose.roll || 0), s = Math.sin(pose.roll || 0);
  return { f, U: { x: u0.x * c + r0.x * s, y: u0.y * c, z: u0.z * c + r0.z * s } };
}

/** The channels a viewer sees (see the head of this file). */
export function glideChannels(pose, aspect, anchor = GLIDE_HERO) {
  const { f, U } = viewOf(pose);
  const h = Math.hypot(f.x, f.z);
  const pitch = Math.atan2(f.y, h);
  // exactly overhead, the picture's up names the heading
  const yaw = h > 1e-9 ? Math.atan2(f.z, f.x) : f.y < 0 ? Math.atan2(U.z, U.x) : Math.atan2(-U.z, -U.x);
  const r0 = { x: -Math.sin(yaw), y: 0, z: Math.cos(yaw) };
  const sp = Math.sin(pitch), cp = Math.cos(pitch);
  const u0 = { x: -sp * Math.cos(yaw), y: cp, z: -sp * Math.sin(yaw) };
  const roll = Math.atan2(dot(U, r0), dot(U, u0));
  const R = { x: f.y * U.z - f.z * U.y, y: f.z * U.x - f.x * U.z, z: f.x * U.y - f.y * U.x };
  const d = { x: anchor.x - pose.position.x, y: anchor.y - pose.position.y, z: anchor.z - pose.position.z };
  const T = Math.tan(pose.fov * Math.PI / 360), z = dot(d, f);
  const look = pose.target
    ? Math.hypot(pose.target.x - pose.position.x, pose.target.y - pose.position.y, pose.target.z - pose.position.z) : z;
  return { yaw, pitch, roll, sx: dot(d, R) / (z * T * aspect), sy: dot(d, U) / (z * T),
    scale: Math.log(z * T), fov: pose.fov, look: Math.log(look), depth: z };
}

/** The camera that shows channels `c`: the anchor lands exactly at (sx, sy)
 *  at the depth its scale names. */
export function glidePose(c, aspect, anchor = GLIDE_HERO) {
  const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
  const f = { x: cp * cy, y: sp, z: cp * sy };
  const r0 = { x: -sy, y: 0, z: cy }, u0 = { x: -sp * cy, y: cp, z: -sp * sy };
  const cr = Math.cos(c.roll), sr = Math.sin(c.roll);
  const U = { x: u0.x * cr + r0.x * sr, y: u0.y * cr + r0.y * sr, z: u0.z * cr + r0.z * sr };
  const R = { x: r0.x * cr - u0.x * sr, y: r0.y * cr - u0.y * sr, z: r0.z * cr - u0.z * sr };
  const T = Math.tan(c.fov * Math.PI / 360), z = Math.exp(c.scale) / T;
  const a = c.sx * z * T * aspect, b = c.sy * z * T;
  const position = { x: anchor.x - z * f.x - a * R.x - b * U.x,
    y: anchor.y - z * f.y - a * R.y - b * U.y, z: anchor.z - z * f.z - a * R.z - b * U.z };
  const L = Math.exp(c.look);
  return { position, target: { x: position.x + f.x * L, y: position.y + f.y * L, z: position.z + f.z * L },
    up: U, forward: f, fov: c.fov, roll: c.roll, viewAngles: { yaw: c.yaw, pitch: c.pitch } };
}

/** Per-second channel velocity between two presented frames. */
export function glideVelocity(before, now, seconds, aspect, anchor = GLIDE_HERO) {
  if (!before || !(seconds > 0)) return null;
  const a = glideChannels(before, aspect, anchor), b = glideChannels(now, aspect, anchor);
  const v = {};
  for (const k of GLIDE_KEYS) v[k] = (ANGLES.has(k) ? wrapAngle(b[k] - a[k]) : b[k] - a[k]) / seconds;
  return v;
}

/** The anchor the viewer follows: the hero's cap when it stands in front of
 *  the camera at both ends and on screen at the landing (every Return to
 *  Purpose), else the landing's own look target (it is the centre of the
 *  frame there, and in front of any camera above the field). */
export function glideAnchor(from, to, aspect) {
  const a = glideChannels(from, aspect, GLIDE_HERO), b = glideChannels(to, aspect, GLIDE_HERO);
  const shown = c => c.depth > 0.5 && Math.abs(c.sx) < 1 && Math.abs(c.sy) < 1;
  if (a.depth > 0.5 && shown(b)) return GLIDE_HERO;
  return { x: to.target.x, y: to.target.y, z: to.target.z };
}

/* HOW LONG A GLIDE TAKES is priced by how far the PICTURE travels, not the
   camera (round 2's caution: world units were capped while the picture slid
   100 px in 9 frames). The screen distance is the mean travel of a fixed 9x7
   grid of screen points cast onto the ground, summed along the glide, in
   half-widths of the frame (pixels at the same width on a phone and a
   desktop), and never less than the anchor's own path. A quintic's peak rate is 1.875x its mean, so
   GLIDE_SECONDS_PER_TRAVEL sets the peak screen speed; it was tuned against
   the ordinary Connect -> Purpose hop (report section 3). Bounded like the
   other hops (navigation-timing.js: never under 2.6 s). */
export const GLIDE_MIN_SECONDS = 2.6;
export const GLIDE_MAX_SECONDS = 6;
export const GLIDE_SECONDS_PER_TRAVEL = 1.6;
function screenGround(pose, aspect) {
  const { f, U } = viewOf(pose);
  const R = { x: f.y * U.z - f.z * U.y, y: f.z * U.x - f.x * U.z, z: f.x * U.y - f.y * U.x };
  const T = Math.tan(pose.fov * Math.PI / 360), out = [];
  for (let i = 0; i < 9; i++) for (let j = 0; j < 7; j++) {
    const nx = -0.9 + 1.8 * i / 8, ny = -0.9 + 1.8 * j / 6;
    const d = { x: f.x + R.x * nx * T * aspect + U.x * ny * T, y: f.y + R.y * nx * T * aspect + U.y * ny * T,
      z: f.z + R.z * nx * T * aspect + U.z * ny * T };
    const n = Math.hypot(d.x, d.y, d.z);
    let t = 300 / n;
    if (d.y < 0) t = Math.min(t, -pose.position.y / d.y);
    if (!(t > 0)) t = 300 / n;
    out.push({ p: { x: pose.position.x + d.x * t, y: pose.position.y + d.y * t, z: pose.position.z + d.z * t }, nx, ny });
  }
  return out;
}
function projected(pose, aspect, p) {
  const { f, U } = viewOf(pose);
  const R = { x: f.y * U.z - f.z * U.y, y: f.z * U.x - f.x * U.z, z: f.x * U.y - f.y * U.x };
  const d = { x: p.x - pose.position.x, y: p.y - pose.position.y, z: p.z - pose.position.z };
  const z = dot(d, f), T = Math.tan(pose.fov * Math.PI / 360);
  return z > 1e-6 ? { nx: dot(d, R) / (z * T * aspect), ny: dot(d, U) / (z * T) } : null;
}
export function glideTravel(a, b, aspect, anchor, steps = 24) {
  let travel = 0, previous = glidePose(a, aspect, anchor);
  for (let i = 1; i <= steps; i++) {
    const w = i / steps, c = {};
    for (const k of GLIDE_KEYS) c[k] = a[k] + (b[k] - a[k]) * w;
    const pose = glidePose(c, aspect, anchor);
    let sum = 0, n = 0;
    for (const g of screenGround(previous, aspect)) {
      const q = projected(pose, aspect, g.p);
      if (!q) continue;
      sum += Math.hypot(q.nx - g.nx, (q.ny - g.ny) / aspect); n++;
    }
    travel += n ? sum / n : 0;
    previous = pose;
  }
  // ...and never less than the anchor's own straight line on screen
  return Math.max(travel, Math.hypot(b.sx - a.sx, (b.sy - a.sy) / aspect));
}
/* ...and by how far the VIEW turns: a quintic's peak turn rate is 1.875x
   its mean, held under GLIDE_MAX_TURN (the round-2 heading bound). `turn`
   is the combined heading, tilt and bank change, in radians. */
export const GLIDE_MAX_TURN = 60 * Math.PI / 180;
export const glideTurn = (a, b) => Math.hypot(b.yaw - a.yaw, b.pitch - a.pitch, b.roll - a.roll);
export function glideSeconds(travel, turn = 0, min = GLIDE_MIN_SECONDS) {
  return Math.max(min, Math.min(GLIDE_MAX_SECONDS,
    Math.max(GLIDE_SECONDS_PER_TRAVEL * travel, 1.875 * turn / GLIDE_MAX_TURN)));
}

/** One glide from the pose on screen (`from`, with its per-second channel
 *  `velocity`, or none) to the landing rest `to`. */
export function createGlide(from, to, aspect, { velocity = null, seconds = null, min = GLIDE_MIN_SECONDS, anchor = null } = {}) {
  anchor ||= glideAnchor(from, to, aspect);
  const a = glideChannels(from, aspect, anchor), b = glideChannels(to, aspect, anchor);
  for (const k of ANGLES) b[k] = a[k] + wrapAngle(b[k] - a[k]);
  const travel = glideTravel(a, b, aspect, anchor);
  const turn = glideTurn(a, b);
  return { a, b, aspect, anchor, to, travel, turn, velocity, seconds: seconds ?? glideSeconds(travel, turn, min) };
}

/** The pose at glide time fraction `k` (0..1). At k = 1 it is the landing's
 *  channels; the branch then hands over the landing's exact authored pose. */
export function sampleGlide(glide, k) {
  k = Math.max(0, Math.min(1, k));
  const w = smoother(k), h = k - 6 * k ** 3 + 8 * k ** 4 - 3 * k ** 5;
  const v = glide.velocity, c = {};
  for (const key of GLIDE_KEYS) c[key] = glide.a[key] + (glide.b[key] - glide.a[key]) * w + (v?.[key] || 0) * glide.seconds * h;
  return glidePose(c, glide.aspect, glide.anchor);
}
export const glidePhase = k => smoother(k);
