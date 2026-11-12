import { CONTENT } from '../../content/content.js';

// The CSS reveal and camera finish share these durations. Paragraph pauses
// retain their own reading rhythm; the flight follows the finished last word.
export const WORD_STAGGER_SECONDS = 0.11;
export const WORD_REVEAL_SECONDS = 3;
// j-manifesto-ink in journey/site.css reaches full opacity at its 30% key.
// The remaining animation settles colour/glow; it must not delay reading.
export const WORD_VISIBLE_FRACTION = 0.30;
export const WORD_VISIBLE_SECONDS = WORD_REVEAL_SECONDS * WORD_VISIBLE_FRACTION;
// THE WAY DOWN is not authored here: a Return is one glide from the pose on
// screen to the landing rest (glide.js), priced by how far the picture
// travels. Only the climb lives in this file.
export const SPIRAL_START_SECONDS = 1.0;
/* THE PHONE PULLS BACK FROM THE FIRST MOMENT, AND TURNS AS IT GOES
   (2026-11 — "the camera movement back isn't apparent ... for the first few
   seconds"; "maybe the zoom should be combined with the rotating"). The
   rise, the tilt overhead and the glide over the cluster shared one 5 s
   quintic, so the camera crept for half a second, then closed on the
   hero (+33% on screen at 2.5 s) as the lens narrowed, and after 5 s only
   zoomed, at 2-7 px/s, with its heading frozen. Now the 16-unit rise leads
   (3.5 s), the tilt, glide and lens follow (5.5 s), each gathering in
   0.6 s; the climb then runs at a near-even rate, and the
   heading orbits through the whole flight, 85 degrees in all: 60 more than
   the 25 degree turn it used to finish during the tilt. */
export const MOBILE_RISE_SECONDS = 3.5;
export const MOBILE_LIFT_SECONDS = 5.5;
const MOBILE_EASE_IN_SECONDS = 0.6;
const MOBILE_CLIMB_LEAD_SECONDS = 2.5;
const MOBILE_SETTLE_FRACTION = 0.12;
const MOBILE_LIFT_HEIGHT = 16;
export const MOBILE_OVERHEAD_TURN = (25 + 60) * Math.PI / 180;
// The title is written the moment the page opens (2026-10-04 — Hannah: it
// should "fade in as soon as I press manifesto ... and then the texts appear
// afterwards").
export const TITLE_SECONDS = 0;
/* THE READING RHYTHM IS THE TEXT'S, NOT THE CAMERA'S (2026-10-04 — Hannah:
   the third and fourth "should come in a bit faster... the end part should
   be sped up... the rhythm of it just feels wrong"). The beats used to be
   spread over the 28 s ascent — 2.4 / 6.8 / 12.5 / 19 / 26 — so the pause
   before each sentence GREW (4.4, 5.7, 6.5, 7.0 s) while the sentences did
   not (26, 27, 20, 25 words): the shortest one waited longest, and the last
   arrived after a seven-second hold. Each pause is now priced by the
   sentence it follows — a breath plus a reading allowance per word — so
   the rhythm is even and a short sentence hands on sooner. */
// 1.6 + 0.14/word -> 1.2 + 0.125/word (2026-11 — "the pause between
// sentences is too long, maybe half"): the dead gap between one sentence
// being readable and the next one starting halves (about 1.8-2.4 s ->
// 0.9-1.2 s), and the flight shortens with it (37.6 -> 33.3 s).
export const FIRST_LINE_SECONDS = 2.0;
export const LINE_BREATH_SECONDS = 1.2;
export const LINE_SECONDS_PER_WORD = 0.125;
export function lineSecondsFor(wordCounts) {
  const out = [];
  let t = FIRST_LINE_SECONDS;
  wordCounts.forEach((words, i) => {
    if (i > 0) t += LINE_BREATH_SECONDS + LINE_SECONDS_PER_WORD * wordCounts[i - 1];
    out.push(+t.toFixed(2));
  });
  return out;
}
export function revealSecondsFor(wordCounts) {
  const starts = lineSecondsFor(wordCounts);
  return Math.max(0, ...wordCounts.map((words, i) =>
    starts[i] + Math.max(0, words - 1) * WORD_STAGGER_SECONDS + WORD_REVEAL_SECONDS));
}
export const CAMERA_SECONDS = revealSecondsFor(CONTENT.manifesto.lines.map(line => line.trim().split(/\s+/).length));
// Lead the next ink by up to two seconds, once the preceding paragraph is
// fully readable. Ink beats and the camera endpoint stay exactly as authored.
export function mobileReadingSchedule(starts, lastWordBeats) {
  const reveal = starts.slice(), admit = [];
  for (let i = 0; i < starts.length; i++) {
    const previousVisible = i > 0
      ? starts[i - 1] + lastWordBeats[i - 1] * WORD_STAGGER_SECONDS + WORD_VISIBLE_SECONDS : 0;
    admit[i] = i > 0 ? Math.max(previousVisible, starts[i] - 2) : starts[i];
  }
  return { reveal, admit, seconds: CAMERA_SECONDS };
}
export const AERIAL_BODY_COUNT = 560;
export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const smoother = (v) => { v = clamp01(v); return v * v * v * (v * (v * 6 - 15) + 10); };
const mix = (a, b, t) => a + (b - a) * t;
// C2 eases for the phone flight. Velocity gathers along a smoothstep over
// `lead` seconds (no quintic crawl); a swing then peaks a third of the way
// and decays as (1-x)^2 to rest at `seconds`, while a cruise holds an even
// rate and settles over `tail`.
const gather = (t, lead) => {
  const x = t / lead;
  return x < 1 ? lead * x * x * x * (1 - x / 2) : t - lead / 2;
};
function swing(t, lead, seconds) {
  if (!(t > 0)) return 0;
  const x = clamp01(gather(t, lead) / (seconds - lead / 2));
  return Math.min(1, x * x * (6 - 8 * x + 3 * x * x));
}
function cruise(t, lead, tail, seconds) {
  if (!(t > 0)) return 0;
  if (!(t < seconds)) return 1;
  const length = seconds - lead / 2 - tail / 2;
  return Math.min(t <= seconds - tail ? gather(t, lead) : length - gather(seconds - t, tail), length) / length;
}
export const isMobileManifesto = aspect => aspect < 0.9 ||
  (typeof window !== 'undefined' && window.innerWidth > 0 && window.innerWidth <= 720);
const FRAME_SHIFT_IN = 8.5 / 37.58, FRAME_SHIFT_RISE = 5 / 37.58, FRAME_SHIFT_OUT = 19 / 37.58;
/** How much of the 8-unit reading-column shift the climb holds at `seconds`
 *  (0..1; desktop only). */
export function frameShiftAmount(seconds, aspect = 1.6) {
  if (isMobileManifesto(aspect)) return 0;
  const u = seconds / CAMERA_SECONDS;
  return smoother((u - FRAME_SHIFT_IN) / FRAME_SHIFT_RISE)
    * (1 - smoother((u - FRAME_SHIFT_OUT) / (1 - FRAME_SHIFT_OUT)));
}
export function frameShiftAt(seconds, aspect = 1.6, from = { position: { x: -14.72, z: 2.7 } }) {
  if (isMobileManifesto(aspect)) return { x: 0, z: 0 };
  const spiral = spiralAt(seconds);
  const az = Math.atan2(from.position.z, from.position.x) + spiral * Math.PI * 100 / 180;
  // Keep the growing colony on the image's right while the reading column
  // occupies the left. The middle lift otherwise exposes a broad empty
  // strip beyond the colony. Translate eye and target together, preserving
  // the orbit's heading, and relinquish this framing at the settled view.
  // The window is a fraction of the flight (authored as 8.5/5/19 s of a
  // 37.58 s flight) so it keeps its place when the reading rhythm changes.
  const middle = frameShiftAmount(seconds, aspect);
  const distance = 11 * spiral + 8 * middle;
  return { x: -Math.sin(az) * distance, z: Math.cos(az) * distance };
}

/** How much of its climb the camera has made, 0 at the press and 1 at the
 *  top: most of the height in the first ten seconds, the rest eased in over
 *  the whole flight. Exported because the navigation's dot rides it — the
 *  dot reaches the Manifesto as the camera reaches the top (2026-10-04,
 *  Hannah: it should "not reach the end until we've reached the actual top
 *  of the manifesto journey"). */
export function ascentAt(seconds, aspect = 1.6) {
  if (isMobileManifesto(aspect)) return mobileClimbAt(seconds);
  return 0.60 * smoother(seconds / 10) + 0.40 * smoother(seconds / CAMERA_SECONDS);
}

// The climb's height above the rest, desktop and phone.
function desktopHeightAbove(fromY, seconds, aspect) {
  const height = Math.max(70, 76 / Math.max(0.38, aspect));
  return 8 * smoother(seconds / 3.0) + (height - fromY - 8) * ascentAt(seconds, aspect);
}
const mobileClimbAt = seconds => cruise(seconds, MOBILE_CLIMB_LEAD_SECONDS,
  MOBILE_SETTLE_FRACTION * CAMERA_SECONDS, CAMERA_SECONDS);
const mobileRiseAt = seconds => swing(seconds, MOBILE_EASE_IN_SECONDS, MOBILE_RISE_SECONDS);
const mobileTiltAt = seconds => swing(seconds, MOBILE_EASE_IN_SECONDS, MOBILE_LIFT_SECONDS);
// The orbit gathers with the rise and turns at an even rate to the settle.
const mobileTurnAt = seconds => cruise(seconds, MOBILE_EASE_IN_SECONDS,
  MOBILE_SETTLE_FRACTION * CAMERA_SECONDS, CAMERA_SECONDS);
function mobileHeightAbove(fromY, seconds) {
  return MOBILE_LIFT_HEIGHT * mobileRiseAt(seconds)
    + (38 - fromY - MOBILE_LIFT_HEIGHT) * mobileClimbAt(seconds);
}
/** Frame the mushrooms themselves, not the observer's position outside the
 * cutaway. Weight the nearby caps by projected plan area; distant hint tiers
 * must not pull the shot away from the established Purpose cluster. The hero
 * at the origin is one full-size cap. Compute once when the branch opens. */
export function mobileFieldCenter(seats, fallback) {
  const near = seats?.filter(body => body.tier <= 3);
  if (!near?.length) return { x: fallback.x, z: fallback.z };
  let weight = 1, x = 0, z = 0;
  for (const body of near) {
    const w = body.s * body.s;
    x += body.x * w; z += body.z * w; weight += w;
  }
  return { x: x / weight, z: z / weight };
}

/** Phones rise above the mushroom cluster and tilt overhead, then keep climbing on the
 * reading clock. A tiny residual horizontal direction (0.00057 degrees from
 * vertical) preserves the departure heading through lookAt and return blends;
 * exact vertical would make the camera's world-up basis singular. */
function mobilePose(from, seconds) {
  const tilt = mobileTiltAt(seconds);
  const dx = from.target.x - from.position.x, dz = from.target.z - from.position.z;
  const horizontal = Math.hypot(dx, dz);
  const dy = from.target.y - from.position.y;
  const pitch = mix(Math.atan2(dy, horizontal), -Math.PI / 2 + 1e-5, tilt);
  const y = from.position.y + mobileHeightAbove(from.position.y, seconds);
  const centre = from.fieldCenter || from.target;
  const x = mix(from.position.x, centre.x, tilt);
  const z = mix(from.position.z, centre.z, tilt);
  const distance = mix(Math.hypot(horizontal, dy), y - 0.4, tilt);
  const reach = Math.cos(pitch) * distance;
  // The heading turn brings the near ring into the lower-left quadrant and
  // keeps turning overhead, so the pull-back always reads as motion.
  const heading = (horizontal > 1e-9 ? Math.atan2(dz, dx) : -Math.PI / 2)
    + MOBILE_OVERHEAD_TURN * mobileTurnAt(seconds);
  const hx = Math.cos(heading), hz = Math.sin(heading);
  return {
    position: { x, y, z },
    target: seconds <= 0 ? { ...from.target } : {
      x: x + hx * reach,
      y: y + Math.sin(pitch) * distance,
      z: z + hz * reach,
    },
    fov: mix(from.fov, 46, tilt),
    roll: (from.roll || 0) * (1 - tilt),
    field: smoother((seconds - MOBILE_LIFT_SECONDS) / 4.5),
    atmosphere: smoother(seconds / 8),
  };
}

/** Desktop retains its authored lift and counterclockwise orbit. */
export const spiralAt = seconds => smoother((seconds - SPIRAL_START_SECONDS) / (CAMERA_SECONDS - SPIRAL_START_SECONDS));
export function manifestoPose(from, seconds, aspect = 1.6) {
  if (isMobileManifesto(aspect)) return mobilePose(from, seconds);
  const lift = smoother(seconds / 3.0);
  const spiral = spiralAt(seconds);
  const az = Math.atan2(from.position.z, from.position.x) + spiral * Math.PI * 100 / 180;
  const r = mix(Math.hypot(from.position.x, from.position.z), 60, spiral);
  const { x: shiftX, z: shiftZ } = frameShiftAt(seconds, aspect, from);
  return {
    position: {
      x: (!(spiral > 0) ? from.position.x : Math.cos(az) * r) + shiftX,
      y: from.position.y + desktopHeightAbove(from.position.y, seconds, aspect),
      z: (!(spiral > 0) ? from.position.z : Math.sin(az) * r) + shiftZ,
    },
    target: {
      x: mix(from.target.x, -3 - Math.sin(az) * 21, spiral) + shiftX,
      y: mix(mix(from.target.y, 3.15, lift), 0.4, spiral),
      z: mix(from.target.z, -1 + Math.cos(az) * 21, spiral) + shiftZ,
    },
    fov: mix(from.fov, 46, lift),
    roll: (from.roll || 0) * (1 - lift),
    field: smoother((seconds - SPIRAL_START_SECONDS) / 4.5),
    atmosphere: smoother(seconds / 8),
  };
}

// Seeded placement, prepared at construction rather than during flight.
//
// A COLONY GROWS IN PATCHES (2026-10-04 — Hannah, from orbit: the outskirts
// look "less organic... less alive"; "the ordering of them should be a bit
// more chaotic... clumps of them"; "some of the outlines in mushrooms feel
// way larger"). The field used to be one rejection pass with a single wide
// keep-out (3.2 + 1.8*(s+s') ~ 6 u), which is a Poisson-disc sampler: every
// body equally far from every other, an even sheet. And it sized them
// 0.46-1.01 (median 0.73) against the epilogue's own far bodies at 0.13-0.59
// (median ~0.31) — two and a half times larger, with even its seats floored
// to 0.45 — so the colony read as a different, coarser species.
// It now grows the way a mycelium fruits: patches — tufts, fairy-ring arcs
// and loose drifts — around a seeded set of centres, with bare ground
// between them and a few loners; bodies keep only a cap-to-cap clearance, so
// a tuft can crowd. Sizes follow the field: mostly small, a few elders at a
// tuft's heart. The count stays 560: 720 measured 9.8 fps settled against
// 14.3 (1440x900), and patches fill the frame with bare ground, not bodies.
// Each patch carries whether it is shedding (`emits`), so
// whole clumps breathe spores and others stand still (colony.js).
export const AERIAL_SCALE_MIN = 0.2;
export const AERIAL_SCALE_MAX = 0.72;
const CAP_REACH = 2.35;             // anatomy CAP_R: a body's cap radius per unit scale
export function aerialPlacements(seats, random, groundY) {
  const bodies = seats.filter(s => s.tier >= 4).map(s => ({ ...s,
    yaw: random() * Math.PI * 2, tone: 0.38 + random() * 0.30, patch: -1, emits: false }));
  const occupied = [{ x: 0, z: 0, s: 1 }, ...seats];
  // The clearance test only ever needs NEARBY bodies, so occupancy lives in
  // a coarse grid.
  const CELL = 6;
  const grid = new Map();
  let maxS = 0;
  const key = (cx, cz) => cx * 4096 + cz;
  const occupy = (q) => {
    const k = key(Math.floor(q.x / CELL), Math.floor(q.z / CELL));
    (grid.get(k) || grid.set(k, []).get(k)).push(q);
    if (q.s > maxS) maxS = q.s;
  };
  occupied.forEach(occupy);
  // cap to cap, plus a hair; the field's seats and the hero keep a wider moat
  const clear = (q, s) => (q.tier !== undefined || q.patch === undefined ? 1.6 : 0.25) + CAP_REACH * 0.92 * (s + q.s);
  const collides = (x, z, s) => {
    const reach = Math.ceil((1.6 + CAP_REACH * (s + maxS)) / CELL);
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let i = -reach; i <= reach; i++) for (let j = -reach; j <= reach; j++) {
      const cell = grid.get(key(cx + i, cz + j));
      if (cell && cell.some(q => Math.hypot(x - q.x, z - q.z) < clear(q, s))) return true;
    }
    return false;
  };
  const clampS = (v) => Math.max(AERIAL_SCALE_MIN, Math.min(AERIAL_SCALE_MAX, v));
  // mostly small, a long thin tail of large: the field's own shape
  const fieldScale = () => clampS(0.22 + Math.pow(random(), 2.2) * 0.42);
  const place = (x, z, s, patch, tone, emits) => {
    const r = Math.hypot(x, z);
    if (r < 8.5 || r > 116 || collides(x, z, s)) return false;
    const body = { x, z, gy: groundY(x, z), s, yaw: random() * Math.PI * 2, tone, patch, emits };
    bodies.push(body); occupy(body);
    return true;
  };
  const centres = [];
  let patch = 0;
  for (let tries = 0; tries < 6000 && bodies.length < AERIAL_BODY_COUNT; tries++) {
    // a few loners between the patches
    if (random() < 0.14) {
      const r = 9 + Math.pow(random(), 0.5) * 104, a = random() * Math.PI * 2;
      place(Math.cos(a) * r, Math.sin(a) * r, fieldScale(), -1, 0.30 + random() * 0.36, random() < 0.12);
      continue;
    }
    // patch centres keep the old gentle bias toward the perimeter, and
    // their own elbow room so bare ground survives between them
    const r = 10 + Math.pow(random(), 0.5) * 100, a = random() * Math.PI * 2;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    if (centres.some(c => Math.hypot(c.x - cx, c.z - cz) < 7 + 0.5 * c.size)) continue;
    const kind = random();
    const tone = 0.36 + random() * 0.34;             // a patch shares its light
    const emits = random() < 0.36;                   // ...and whether it is shedding
    const shed = () => emits && random() < 0.6;
    let size;
    if (kind < 0.28) {
      // a fairy-ring arc: one generation of bodies on the mat's growing edge
      const R = 2.4 + random() * 3.4, span = Math.PI * (0.7 + random() * 1.3), a0 = random() * Math.PI * 2;
      const n = 4 + Math.floor(random() * 6);
      const s0 = clampS(0.22 + random() * 0.14);
      for (let k = 0; k < n; k++) {
        const t = a0 + span * (k + 0.5 * random()) / n, rr = R * (0.92 + random() * 0.16);
        place(cx + Math.cos(t) * rr, cz + Math.sin(t) * rr, clampS(s0 * (0.8 + random() * 0.45)), patch, tone * (0.85 + random() * 0.3), shed());
      }
      size = R;
    } else if (kind < 0.78) {
      // a tuft: an elder at the heart (sometimes), younger bodies crowding it
      const sigma = 0.9 + random() * 1.5, n = 2 + Math.floor(random() * 6);
      if (random() < 0.55) place(cx, cz, clampS(0.42 + random() * 0.28), patch, tone * 1.1, shed());
      for (let k = 0; k < n * 3; k++) {
        const g = Math.sqrt(-2 * Math.log(1 - random() * 0.999)) * sigma, t = random() * Math.PI * 2;
        place(cx + Math.cos(t) * g, cz + Math.sin(t) * g, clampS(0.2 + Math.pow(random(), 1.6) * 0.24), patch, tone * (0.8 + random() * 0.35), shed());
      }
      size = sigma * 2;
    } else {
      // a loose drift of a few bodies
      const sigma = 3 + random() * 3, n = 2 + Math.floor(random() * 4);
      for (let k = 0; k < n * 2; k++) {
        const g = Math.sqrt(-2 * Math.log(1 - random() * 0.999)) * sigma, t = random() * Math.PI * 2;
        place(cx + Math.cos(t) * g, cz + Math.sin(t) * g, fieldScale(), patch, tone * (0.8 + random() * 0.4), shed());
      }
      size = sigma * 2;
    }
    centres.push({ x: cx, z: cz, size });
    patch++;
  }
  return bodies.slice(0, seats.filter(s => s.tier >= 4).length + AERIAL_BODY_COUNT);
}

// The reveal window is tied to the camera's actual projected frame, not a
// synchronous world-space ring. Planning runs once per entry; the GPU samples
// these fixed windows from the same clock as the reversible camera pose.
export function aerialRevealAt(seconds, start, duration) {
  if (start < 0) return 1;
  const t = clamp01((seconds - start) / duration);
  return t * t * (3 - 2 * t);
}
export function manifestoViewFrame(pose, aspect) {
  const { position: p, target: q } = pose;
  const n = Math.hypot(q.x-p.x, q.y-p.y, q.z-p.z);
  const fx = (q.x-p.x)/n, fy = (q.y-p.y)/n, fz = (q.z-p.z)/n;
  const h = Math.hypot(fx, fz), rx = -fz/h, rz = fx/h;
  const ux = -fy*rz, uy = fx*rz-fz*rx, uz = fy*rx;
  const c = Math.cos(pose.roll || 0), s = Math.sin(pose.roll || 0);
  return { p, fx, fy, fz, rx: rx*c-ux*s, ry: -uy*s, rz: rz*c-uz*s,
    ux: ux*c+rx*s, uy: uy*c, uz: uz*c+rz*s,
    tangent: Math.tan(pose.fov*Math.PI/360), aspect };
}
// A conservative body bound, rather than its centre: caps crossing a frame
// edge must remain admitted. Runtime culling uses the actual tissue bounds.
export function aerialBodyInView(body, frame) {
  const x = body.x-frame.p.x, y = body.gy+body.s*1.8-frame.p.y, z = body.z-frame.p.z;
  const depth = x*frame.fx+y*frame.fy+z*frame.fz;
  const radius = body.s*4 + 1;
  const tx = frame.tangent*frame.aspect*1.12, ty = frame.tangent*1.12;
  return depth + radius > 0
    && Math.abs(x*frame.rx+y*frame.ry+z*frame.rz) <= depth*tx+radius*Math.hypot(1, tx)
    && Math.abs(x*frame.ux+y*frame.uy+z*frame.uz) <= depth*ty+radius*Math.hypot(1, ty);
}
/** planAerialReveals as a RESUMABLE job (2026-11, warm queue): the same
 *  arithmetic in the same order, cut into steps — the camera frames, the
 *  phone's view union, then the bodies in runs — so a rest-time prewarm can
 *  stop between them. `step(stop)` returns true once `output` is complete;
 *  `stop()` is asked between runs. The carried state (frames, view union,
 *  edgeLoad, i) is exactly what the one-call loop carried, so the output is
 *  bit-identical however it is sliced (tools/test-manifesto-motion.mjs). */
export function aerialRevealJob(bodies, from, aspect, output) {
  const clockScale = CAMERA_SECONDS / 28;
  const phone = isMobileManifesto(aspect);
  let frames = null, phoneFrames = phone ? null : undefined, i = 0;
  const edgeLoad = new Uint16Array(4 * 7);
  function cameraFrames() {
    frames = [];
    for (let seconds = 2.5 * clockScale; seconds <= CAMERA_SECONDS - clockScale; seconds += 0.25 * clockScale) {
      const pose = manifestoPose(from, seconds, aspect);
      const { position: p, target: q } = pose;
      const n = Math.hypot(q.x-p.x,q.y-p.y,q.z-p.z);
      const fx = (q.x-p.x)/n, fy = (q.y-p.y)/n, fz = (q.z-p.z)/n;
      const h = Math.hypot(fx,fz), rx = -fz/h, rz = fx/h;
      frames.push({ seconds, p, fx, fy, fz, rx, rz,
        ux: -fy*rz, uy: fx*rz-fz*rx, uz: fy*rx,
        tangent: Math.tan(pose.fov*Math.PI/360) });
    }
  }
  // Prepare the union of the actual phone views, including both endpoints.
  // The same path is replayed on return. Distance from the field's origin
  // cannot say whether a mushroom ever enters this narrow camera frame.
  // (resumable too: ~150 poses, the largest step left on a phone)
  let views = null, viewT = 0;
  function phoneViews(stop) {
    views ||= [];
    for (; viewT < CAMERA_SECONDS; viewT += .25) {
      views.push(manifestoViewFrame(manifestoPose(from, viewT, aspect), aspect));
      if ((views.length & 31) === 0 && stop()) { viewT += .25; return false; }
    }
    views.push(manifestoViewFrame(manifestoPose(from, CAMERA_SECONDS, aspect), aspect));
    phoneFrames = views;
    return true;
  }
  function body(i) {
    const b = bodies[i];
    if (b.tier >= 4) { output[i*2] = -1; output[i*2+1] = 1; return; }
    if (phoneFrames && !phoneFrames.some(frame => aerialBodyInView(b, frame))) {
      output[i*2] = CAMERA_SECONDS + 1; output[i*2+1] = 1; return;
    }
    const hash = Math.sin(b.x*12.9898 + b.z*78.233) * 43758.5453;
    const jitter = hash - Math.floor(hash);
    const desired = Math.min(25.5, 1.8 + Math.hypot(b.x,b.z)*(phone ? 0.45 : 0.15) + jitter*4.8) * clockScale;
    let best = Infinity, start = desired, chosen = -1;
    for (const f of frames) {
      const x = b.x-f.p.x, y = b.gy+b.s*3.2-f.p.y, z = b.z-f.p.z;
      const depth = x*f.fx+y*f.fy+z*f.fz;
      if (depth <= 0) continue;
      const nx = (x*f.rx+z*f.rz)/(depth*f.tangent*aspect);
      const ny = (x*f.ux+y*f.uy+z*f.uz)/(depth*f.tangent);
      const edge = Math.max(Math.abs(nx),Math.abs(ny));
      if (edge > 1.02) continue;
      const reading = phone ? ny < 0.30 : nx < -0.05;
      const side = Math.abs(nx) > Math.abs(ny) ? (nx > 0 ? 0 : 1) : (ny > 0 ? 2 : 3);
      const bucket = Math.min(6, Math.floor(f.seconds/(CAMERA_SECONDS/7)))*4 + side;
      // Prefer arrivals just inside the frame, with a loose placement-seeded
      // cadence; the reading column is the last choice for an arrival.
      const score = Math.abs(f.seconds-desired)/clockScale*0.16 + Math.abs(edge-0.82)*3 + (reading ? 0.2 : 0) + edgeLoad[bucket]*0.18;
      if (score < best) { best = score; start = f.seconds; chosen = bucket; }
    }
    if (chosen >= 0) edgeLoad[chosen]++;
    const duration = (1.3 + jitter*1.5) * clockScale;
    output[i*2] = Math.min(CAMERA_SECONDS-duration, Math.max(2.5 * clockScale, start + jitter*0.55 * clockScale));
    output[i*2+1] = duration;
  }
  return {
    output,
    step(stop = () => false) {
      if (!frames) { cameraFrames(); if (stop()) return false; }
      if (phoneFrames === null) { if (!phoneViews(stop) || stop()) return false; }
      for (; i < bodies.length; i++) {
        body(i);
        if ((i & 31) === 31 && i + 1 < bodies.length && stop()) { i++; return false; }
      }
      return true;
    },
  };
}
export function planAerialReveals(bodies, from, aspect, output) {
  aerialRevealJob(bodies, from, aspect, output).step();
  return output;
}
