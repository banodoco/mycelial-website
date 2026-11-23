// Version E, slide 2: "scattered across thousands of repos and threads" as a
// field you can feel, quietly: it should reward noticing, not demand it.
// We fly slowly forward through an endless field of specialist tools, LoRAs, LUTs,
// workflows, threads and guides: each appears faint at the vanishing point,
// grows as it nears, slides past the edges and comes round again far ahead.
// Whatever approaches nearest the middle carries its name. Pointer motion only
// inspects items; it never steers the field. Scrolling flies you through it,
// forward or back, as far as you like; hovering a dot shows what it is,
// clicking pulls it forward. Every named resource has a recorded source;
// short titles describe the useful technique rather than reproduce repository names.
// Arriving from slide 1, its films come apart into motes of their own colours
// that fly at us and become the field.
(() => {
  const root = document.querySelector('[data-scatter-field]');
  if (!root) return;
  const slide = root.closest('.slide');
  const stage = root.querySelector('.sf-stage');
  const canvas = root.querySelector('.sf-dust');
  const legend = root.querySelector('.sf-legend');
  const card = root.querySelector('.sf-card');
  const labels = [...root.querySelectorAll('.sf-whisper')];
  const ctx = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionOff = () => still || window.deckStill?.();

  // share = each kind's slice of the long-tail dust.
  const TYPES = {
    model: { label: 'Upscalers', color: '#e0ab5e', share: 0.10 },
    lora: { label: 'LoRAs', color: '#c89fb5', share: 0.18 },
    repo: { label: 'Tools & LUTs', color: '#9fc8a6', share: 0.18 },
    workflow: { label: 'Workflows', color: '#9fb5c8', share: 0.24 },
    thread: { label: 'Q&A threads', color: '#c7b9ed', share: 0.16 },
    guide: { label: 'Guides', color: '#d9b98f', share: 0.14 },
  };

  // Short editorial titles for real resources; provenance: docs/slide-2-resources.md.
  // [kind, resource format / community, title, what you can learn or make]
  const ITEMS = [
    ["model", "Upscaler · FlashVSR", "Streaming video super-resolution", "A one-step diffusion upscaler designed to process video as a stream."],
    ["model", "Upscaler · SeedVR2", "Restore detail in low-res footage", "SeedVR2 7B: diffusion-based restoration for images and video."],
    ["model", "Upscaler · ComfyUI", "Tile an H3 upscale through time", "Temporal splitting and overlap controls for the H3 latent upscaler."],
    ["lora", "LoRA · FLUX.2 Klein", "One object, four sprite-sheet views", "fal’s sprite-sheet LoRA makes a 2×2 set of isometric, side and top-down views."],
    ["lora", "LoRA · LTX-2", "A controlled dolly-out camera move", "Lightricks’ camera-control LoRA biases a shot toward pulling back from its subject."],
    ["lora", "LoRA · MOSS", "Remove stripe artefacts with SFT", "Nynxz’s small MOSS SFT Destripe adapter, with downloadable weights."],
    ["lora", "LoRA · Wan", "FlippinRad Motion Morph", "A specialised motion LoRA for dynamic, stylised movement in Wan 2.1 14B."],
    ["lora", "LoRA · LTX 2.3", "ICEdit Insight video editing", "Joyfox’s instruction-based video-editing adapter for LTX 2.3."],
    ["repo", "LUT tool · Kijai", "Build a colour LUT from a reference", "VideoColorGrading generates a 3D LUT from a reference image and source footage."],
    ["repo", "LUT tool · ComfyUI", "Match a shot to a colour palette", "MLUT applies LUTs, swatches and palettes inside a ComfyUI graph."],
    ["repo", "Tool · PixelPipeline", "Clean pixel grids and pack sprites", "Grid restoration, palette reduction, background removal and sprite-sheet packing."],
    ["repo", "Tool · WanVaceAdvanced", "Schedule VACE strength frame by frame", "Control nodes for adjusting how strongly VACE follows its conditioning over time."],
    ["repo", "Tool · Klippbok", "Curate and caption a video dataset", "A dedicated workspace for preparing clips before training a video LoRA."],
    ["repo", "Tool · Flimmer", "Raw footage to a trained video LoRA", "Scene detection, captions, validation, encoding and phased Wan training."],
    ["repo", "Tool · H3 ToneCompensate", "Balance tone between chained clips", "A focused helper for colour continuity in chained H3 video segments."],
    ["workflow", "Workflow · Banodoco", "Wan 2.2 AnimateDiff looping pack", "Brbbbq’s shared graphs combine keyframes, depth maps and VACE animation."],
    ["workflow", "Workflow · ComfyUI", "Edit a still with multiple references", "Wan Humo image-editing graphs use reference-conditioned video to produce a still."],
    ["workflow", "Workflow · H3", "Reference-to-video with pose control", "A shared 448×800 API graph for conditioning video on a reference and pose."],
    ["workflow", "Workflow · Banodoco", "Upscale anchors, then fill between", "A community recipe: upscale key images, interpolate with VACE, colour-match and stitch."],
    ["workflow", "Workflow · Banodoco", "Swap a character, keep the scene", "A shared approach using Qwen Image Edit for a reference, then Wan Animate."],
    ["workflow", "Workflow · Banodoco", "Relight a subject in a new scene", "Separate foreground, edges and background before feeding the shot into VACE."],
    ["workflow", "Workflow · Banodoco", "Guide an eight-second video loop", "A community H3 recipe using a tiny guide video and overlapping end frames."],
    ["workflow", "Workflow · Banodoco", "VACE first, Animate second", "Nathan Shipley’s two-pass approach: VACE followed by a partial-denoise Animate pass."],
    ["workflow", "Workflow · ComfyUI", "One character, layered sprite sheets", "Base animation and separately tintable cosmetic layers, aligned for compositing."],
    ["thread", "Q&A · Banodoco", "Why does a fast face escape its mask?", "A discussion of rapid motion, changing scale and the limits of temporal mask tracking."],
    ["thread", "Q&A · Banodoco", "Why do colours drift between cuts?", "Ablejones explains matching a frame per clip instead of rematching every frame."],
    ["thread", "Q&A · Banodoco", "Pose or depth: which should lead?", "Community notes on balancing motion control against character accuracy."],
    ["thread", "Q&A · LoRA training", "What should go in a training caption?", "PineAmbassador discusses captioning the concepts you want to vary later."],
    ["thread", "Q&A · LoRA training", "Why does identity fade at higher res?", "Spacepxl explains the gap between training resolution and inference resolution."],
    ["thread", "Q&A · Banodoco", "Can an upscale hide a clip join?", "A community comparison of temporal FlashVSR and frame-by-frame upscaling."],
    ["guide", "Video guide · YouTube", "Repair smeared frames with a hold map", "SmallKino’s walkthrough: extend the damaged frames, denoise, then restore the timing."],
    ["guide", "Video guide · YouTube", "Use Wan Humo as an image editor", "A walkthrough of reference-guided image editing with a video model."],
    ["guide", "Guide · Klippbok", "Caption a dataset with intent", "A dedicated captioning guide for preparing video training data."],
    ["guide", "Comparison · WanTests", "Compare distilled VACE samplers", "Side-by-side test results for making a more informed sampling choice."],
    ["guide", "Guide · ComfyUI", "Turn animation into RGBA sprites", "A documented video-to-sprite-sheet pipeline for layered 2D characters."],
    ["guide", "Field notes · Banodoco", "Test the motion before the long render", "Atom.p’s image-shift prototype checks the move before committing to full animation."],
  ];

  // Seeded, so the field has the same shape on every visit.
  let seed = 20261015;
  const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;

  // World units: the camera looks down +z; a body at depth z and offset (x, y)
  // lands x / z focal lengths from the vanishing point.
  const NEAR = 0.32, FAR = 7, SPREAD = 1.8;
  const scatter = (o, z) => {
    const r = SPREAD * Math.sqrt(rnd()) + 0.08, a = rnd() * Math.PI * 2;
    o.x = r * Math.cos(a); o.y = r * Math.sin(a) * 0.8; o.z = z;
    return o;
  };

  const kinds = Object.keys(TYPES);
  // The same verified resource catalogue also labels the filament journey.
  root.filamentItems = ITEMS.map((item) => item.slice());
  const named = ITEMS.map(([type, where, name, detail]) =>
    scatter({ type, where, name, detail, sx: 0, sy: 0, p: 1, a: 0, vis: false, score: 0, rest: 0, rad: 3 },
      NEAR + rnd() * (FAR - NEAR)));
  const dust = kinds.flatMap((type) =>
    Array.from({ length: Math.round(2400 * TYPES[type].share) }, () => scatter({ type }, NEAR + rnd() * (FAR - NEAR))));
  const SIZE = { model: 1.5, repo: 1.15, guide: 1.1 }; // bigger bodies for the bigger things

  const keys = kinds.map((type) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sf-key';
    b.dataset.type = type;
    b.style.setProperty('--c', TYPES[type].color);
    b.textContent = TYPES[type].label;
    legend.appendChild(b);
    return b;
  });
  const more = document.createElement('span');
  more.className = 'sf-more';
  more.textContent = 'and thousands more';
  legend.appendChild(more);

  const fill = (el, item, withDetail) => {
    el.style.setProperty('--c', TYPES[item.type].color);
    el.querySelector('.sf-where').textContent = item.where;
    el.querySelector('.sf-name').textContent = item.name;
    if (withDetail) el.querySelector('.sf-detail').textContent = item.detail;
  };
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  // Measure the same wrapping and fonts as a visible name, once per item/layout.
  // A fixed allowance penalises short windows and short names alike.
  const labelMeasure = document.createElement('div');
  labelMeasure.className = 'sf-whisper';
  labelMeasure.setAttribute('aria-hidden', 'true');
  labelMeasure.style.visibility = 'hidden';
  labelMeasure.innerHTML = '<span class="sf-where"></span><span class="sf-name"></span>';
  root.appendChild(labelMeasure);
  const labelSizes = new Map();
  const labelSize = (item) => {
    if (!labelSizes.has(item)) {
      fill(labelMeasure, item, false);
      labelSizes.set(item, { width: labelMeasure.offsetWidth, height: labelMeasure.offsetHeight });
    }
    return labelSizes.get(item);
  };
  const labelScale = (item) => 0.9 + 0.12 * clamp(item.p / 2);

  let w = 0, h = 0, dpr = 1, F = 1, cx = 0, cy = 0;
  let speed = 1, boost = 0, glide = 0, since = 9, roll = 0, settled = 1;
  // Arriving from slide 1 the vanishing point starts at the collage, holds, then glides home.
  let shift = { x: 0, y: 0, age: 9 };
  let pointer = null, touched = false, hot = null, front = null, f = 0, shown = null, keyHover = null, keyLock = null, lastLit;
  let featured = null, held = 0, live = 0, clock = 0, running = false, last = 0, frameRaf = 0, holdFor = 0, busy = -9, back = false, entryCtx = null, fontHandler = null;
  const FEATURE_HOLD = 2.6, LABEL_FADE = 0.75, READ_WINDOW = FEATURE_HOLD + LABEL_FADE;
  let skipOpeningFeature = false, mutedFeature = false;
  const OPENING_LEAD = 1.5; // seconds cut from a wide screen's silent first beat, so the first name shown arrives that much sooner
  const tags = labels.map((el) => ({ el, item: null, box: null, until: 0 }));
  const clearHighlights = () => {
    pointer = hot = front = shown = featured = null;
    live = held = f = 0; back = false; keyHover = null; lastLit = null;
    tags.forEach((tag) => {
      tag.item = tag.box = null; tag.until = 0;
      tag.el.style.transitionDuration = '120ms';
      tag.el.classList.remove('is-on', 'is-back', 'is-hush');
    });
    card.style.transitionDuration = '120ms';
    card.classList.remove('is-on', 'is-front');
    keys.forEach((key) => key.classList.remove('is-lit'));
    slide.style.cursor = '';
  };

  // Names and cards live in the lower screen: below the headline (floor) and
  // above the legend (ceil), never behind either.
  const text = slide.querySelector('.split > :first-child');
  let floor = 0, ceil = 0, mid = 0, raised = false;
  const measure = () => {
    labelSizes.clear();
    // On a phone held upright, names and cards live between the legend and the words.
    raised = w <= 760 && (h >= w || h > 500);
    const s = stage.getBoundingClientRect(), t = text && text.getBoundingClientRect(), l = legend.getBoundingClientRect();
    if (raised) {
      floor = l.height ? l.bottom - s.top + 18 : 44;
      ceil = t && t.height ? t.top - s.top - 22 : h * 0.55;
      slide.style.setProperty('--sf-top', `${Math.round(ceil + 22)}px`); // where the stage's mask quietens behind the words
      return;
    }
    slide.style.removeProperty('--sf-top');
    floor = t && t.height ? t.bottom - s.top + 12 : h * 0.5;
    ceil = l.height ? l.top - s.top - 10 : h - 40;
    // F's field is centred in the free space between the headline and the legend.
    mid = t && t.height && l.height ? (t.bottom + l.top) / 2 - s.top : h * 0.68;
  };
  const resize = () => {
    const nextW = stage.clientWidth, nextH = stage.clientHeight;
    const nextDpr = Math.min(2, devicePixelRatio || 1);
    const pixelW = Math.round(nextW * nextDpr), pixelH = Math.round(nextH * nextDpr);
    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      if (canvas.width !== pixelW) canvas.width = pixelW;
      if (canvas.height !== pixelH) canvas.height = pixelH;
    }
    w = nextW; h = nextH; dpr = nextDpr;
    measure();
  };
  if (text) new ResizeObserver(measure).observe(text); // fonts landing reflow the headline
  const sceneResize = (ctx) => {
    if (rewind) endRewind(); // its motes were placed for the old screen
    if (!slide.classList.contains('on')) return;
    entryCtx = ctx;
    const oldW = w, oldH = h;
    resize();
    if (oldW && oldH) {
      const sx = w / oldW, sy = h / oldH;
      shift.x *= sx; shift.y *= sy;
      for (const m of motes) { m.sx0 *= sx; m.sy0 *= sy; m.cw *= sx; m.ch *= sy; }
      if (pointer) { pointer.x *= sx; pointer.y *= sy; }
    }
    if (motes.length) {
      motes = [];
      glide = 0; boost = 0; since = 9; settled = 1;
      shift = { x: 0, y: 0, age: 9 };
      collageSlide?.classList.remove('vc-dissolve');
      slide.classList.remove('sf-arrive');
    }
    aim();
    if (!w || !h) return false;
    if (!running) start(false, ctx);
    else if (motionOff()) frame(performance.now(), ctx);
    return true;
  };

  // E: the field opens in the right half beside the text. F: below the text, full width.
  const below = () => document.documentElement.dataset.ver === 'f' || w <= 760;
  const aim = () => {
    if (raised) { cx = w / 2; cy = floor + (ceil - floor) * 0.56; F = Math.min(w * 0.42, h * 0.62) * 0.75; }
    else if (below()) { cx = w / 2; cy = mid || h * 0.68; F = Math.min(w * 0.42, h * 0.62) * 0.75; }
    else { cx = w * 0.7; cy = h * 0.48; F = Math.min(w * 0.5, h) * 0.38; }
    // The glide home is one unhurried curve: it sets off with no jolt (zero
    // speed and acceleration), peaks gently about a second in, and fades out
    // over a long tail, so the heading drifts into place rather than turning.
    const g = shift.age * 1.8;
    const k = shift.k ?? (shift.age < 0 ? 1 : (1 + g + g * g / 2) * Math.exp(-g)); // k: set while gathering back
    cx += shift.x * k; cy += shift.y * k;
    cosR = Math.cos(roll); sinR = Math.sin(roll);
  };

  // Project a body; a is its visibility: it fades in out of the distance and
  // out again just before it would touch the lens.
  const P = { x: 0, y: 0, p: 1, a: 0 };
  let cosR = 1, sinR = 0;
  const place = (o) => {
    const x = o.x * cosR - o.y * sinR, y = o.x * sinR + o.y * cosR;
    const p = 1 / o.z;
    P.x = cx + x * p * F; P.y = cy + y * p * F; P.p = p;
    P.a = clamp((FAR - o.z) / 1.8) * clamp((o.z - NEAR) / 0.35);
    return P;
  };
  // Past the camera, or slid well off the edge: round again, far ahead. Flying
  // backwards, whatever recedes past the far plane comes round close behind us.
  const travel = (o, dz) => {
    o.z -= dz;
    if (rewind && dz < 0) return; // gathering back into slide 1, the field recedes into the distance and is put back after
    // Test this body, never the previous body's shared projection scratchpad.
    const q = place(o);
    if (dz >= 0 && (o.z < NEAR || q.x < -80 || q.x > w + 80 || q.y < -80 || q.y > h + 80)) scatter(o, FAR - rnd() * 0.5);
    else if (o.z > FAR) scatter(o, NEAR + 0.3 + rnd() * 1.2);
  };

  // A label must fit for its reading beat AND fade, not just this frame.
  // With pointer steering removed, its future projection is deterministic.
  const shiftWeight = (age) => {
    if (age < 0) return 1;
    const g = age * 1.8;
    return (1 + g + g * g / 2) * Math.exp(-g);
  };
  const labelBox = (item, seconds = 0) => {
    const t = motionOff() ? 0 : seconds;
    // Bound the glide by its slowest decay; scroll momentum uses its own decay.
    const distance = 0.36 * (t + boost * (1 - Math.exp(-2.2 * t)) / 2.2
      + Math.max(0, glide) * (1 - Math.exp(-0.95 * t)) / 0.95);
    const z = item.z - distance;
    if (z < NEAR + 0.22 || z > FAR - 1.08) return null;
    const p = 1 / z, a = roll + t * 0.025;
    const offset = shiftWeight(shift.age + t) - shiftWeight(shift.age);
    const sx = cx + shift.x * offset + (item.x * Math.cos(a) - item.y * Math.sin(a)) * p * F;
    const sy = cy + shift.y * offset + (item.x * Math.sin(a) + item.y * Math.cos(a)) * p * F;
    const rad = clamp(4.6 * p * (SIZE[item.type] || 1), 0.9, 15) * Math.sqrt(F / 240);
    const scale = labelScale({ p }), size = labelSize(item), width = size.width * scale, height = size.height * scale;
    const leftEdge = below() ? 8 : w * 0.5 + 8;
    if (width > w - leftEdge - 8 || sx - rad < leftEdge || sx + rad > w - 8) return null;
    const x = clamp(sx, leftEdge + width / 2, w - 8 - width / 2), y = sy - rad - 8;
    return { left: x - width / 2, right: x + width / 2, top: y - height,
      bottom: sy + rad, x, y, scale };
  };
  const boxFits = (box) => !!box && box.top >= (below() ? floor + 8 : 8) && box.bottom <= ceil - 8;
  const apart = (a, b) => {
    const gap = clamp(w * 0.02, 18, 28);
    return a.right + gap <= b.left || b.right + gap <= a.left || a.bottom + gap <= b.top || b.bottom + gap <= a.top;
  };
  const canIntroduce = (item) => {
    // Reserve the old label's measured rectangle until its fade is complete.
    // It stays at that rectangle rather than following a recycled/offscreen dot.
    return [0, 0.25, 0.5, 0.75, 1.5, 2.4, READ_WINDOW].every((t) => {
      const box = labelBox(item, t);
      return boxFits(box) && tags.every((tag) => tag.item === item || !tag.box
        || tag.until <= clock + t || apart(box, tag.box));
    });
  };

  const frame = (now, visitCtx = entryCtx) => {
    frameRaf = 0;
    if (!running || visitCtx !== entryCtx || !visitCtx?.isCurrent?.()) return;
    if (!motionOff()) frameRaf = requestAnimationFrame((t) => frame(t, visitCtx));
    const clockNow = window.deckNow?.() ?? now;
    const elapsed = Math.max(0, (clockNow - (last || clockNow)) / 1000);
    const dt = Math.min(0.05, elapsed); // capped integration for camera and motes
    last = clockNow;
    if (!w || !h) return;
    const ease = (rate) => 1 - Math.exp(-rate * dt);

    holdFor -= elapsed;
    const wantSpeed = motionOff() ? 0 : front ? 0.08 : hot ? 0.04 : holdFor > 0 ? 0 : 1;
    speed += (wantSpeed - speed) * ease(2.5);
    boost *= Math.exp(-2.2 * dt); // scroll momentum settles back to the drift
    // The arrival rush: the burst past slide 1's films is quick, then it eases
    // off more slowly, so slowing down and the heading's glide home settle together.
    since += elapsed;
    if (!rewind && since >= 2.5) entryFinish?.(visitCtx, 'completed');
    glide *= Math.exp(-(2.2 - 1.25 * (t => t * t * (3 - 2 * t))(clamp((since - 0.6) / 0.8))) * dt);
    // Gathering back into slide 1 (rewind): the arrival's flight runs backwards, the field rushing away from us.
    if (rewind) { // the vanishing point drifts back to the collage, coming to rest there as the motes land
      rewind.t += elapsed;
      const q = clamp(rewind.t / 1.15);
      shift.k = rewind.k0 + (1 - rewind.k0) * q * q * q * (q * (q * 6 - 15) + 10);
    }
    const vel = rewind ? rewindSpeed() : speed + boost + glide, dz = dt * 0.36 * vel;
    clock += elapsed; shift.age += elapsed;
    roll += dt * 0.025 * speed;
    // Arrival readiness only: the pointer never changes camera coordinates.
    settled = Math.min(1, settled + dt / 2.5);
    const highlightsAllowed = slide.classList.contains('on') && !rewind;
    // Labels and hovering stay in the lower screen, clear of the headline.
    const low = below();
    const clear = (n) => (low ? n.sy > floor + 6 && (!raised || n.sy < ceil) : n.sx > w * 0.5);
    aim();
    const grain = Math.sqrt(F / 240);

    for (const n of named) {
      travel(n, dz);
      const q = place(n);
      n.sx = q.x; n.sy = q.y; n.p = q.p; n.a = q.a; n.vis = q.a > 0.05;
    }
    // Hover: the dot under the pointer, nearer bodies winning ties. Not while
    // still arriving: a pointer resting where it clicked shouldn't brake the flight.
    hot = null;
    if (highlightsAllowed && pointer && settled > 0.7) {
      let best = Infinity;
      for (const n of named) {
        if (!n.vis || !clear(n)) continue;
        const reach = 10 + n.rad;
        const dd = (n.sx - pointer.x) ** 2 + (n.sy - pointer.y) ** 2;
        if (dd < reach * reach && dd - n.p * 60 < best) { best = dd - n.p * 60; hot = n; }
      }
    }
    slide.style.cursor = hot ? 'pointer' : '';

    const lit = highlightsAllowed ? keyHover || keyLock || (hot && hot.type) || null : null;
    if (lit !== lastLit) {
      keys.forEach((k) => k.classList.toggle('is-lit', k.dataset.type === lit));
      lastLit = lit;
    }
    const calm = front ? 0.45 : 1;

    if (!ctx) { if (rewind) stepRewind(); return; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    let paint = null;
    for (const o of dust) {
      travel(o, dz);
      const q = place(o);
      if (q.a <= 0) continue;
      if (o.type !== paint) { paint = o.type; ctx.fillStyle = TYPES[paint].color; ctx.strokeStyle = TYPES[paint].color; }
      const kin = lit ? (o.type === lit ? 1.8 : 0.3) : 1;
      ctx.globalAlpha = clamp((0.09 + 0.6 * clamp(q.p / 1.6)) * q.a * kin * calm);
      const s = clamp(1.7 * q.p, 0.45, 4) * grain;
      // Near motes streak faintly outward: the sense of moving forward.
      const sx = q.x, sy = q.y, streak = Math.min(90, q.p * q.p * Math.abs(vel) * 1.6);
      if (streak > 1.4) {
        const k = streak / Math.hypot(sx - cx, sy - cy || 1);
        ctx.lineWidth = s * 0.7;
        ctx.beginPath(); ctx.moveTo(sx - (sx - cx) * k, sy - (sy - cy) * k); ctx.lineTo(sx, sy); ctx.stroke();
      } else ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
    if (motes.length) {
      const left = [];
      let ink = null;
      for (const m of motes) {
        let go;
        if (rewind) { // the same flight, played backwards: each mote returns along it to its place in its tile
          const t = rewind.A - rewind.t;
          go = clamp((t - m.delay) / 0.9);
          m.z = t > m.delay ? m.z0 - (flown(t) - flown(m.delay)) : m.z0;
        } else {
          m.age += dt;
          go = clamp((m.age - m.delay) / 0.9); // 0: still part of the picture; 1: a star in the field
          if (go > 0) m.z -= dz; // released, it flies with the field
        }
        const q = place(m);
        if (m.z < NEAR || (go >= 1 && (q.x < -60 || q.x > w + 60 || q.y < -60 || q.y > h + 60))) { if (rewind) left.push(m); continue; }
        const e = go * go * (3 - 2 * go);
        const star = clamp(1.7 * q.p, 0.45, 4) * grain;
        const mw = m.cw + (star - m.cw) * e, mh = m.ch + (star - m.ch) * e;
        const x = m.sx0 + (q.x - m.sx0) * e, y = m.sy0 + (q.y - m.sy0) * e;
        const glow = 1 + ((0.09 + 0.6 * clamp(q.p / 1.6)) - 1) * e;
        const alpha = glow * q.a * (rewind ? smooth(clamp(rewind.t / 0.35)) : clamp((5.6 - m.age) / 2));
        if (alpha <= 0.01) { if (rewind) left.push(m); continue; }
        // Filament canvas draws the same motes on paths *toward* the strands.
        // The old starfield's outward flight must not leak through on entry.
        if (!root.filamentSuppressMotes || rewind) {
          ctx.globalAlpha = alpha;
          const tint = m.inks[Math.round(e * INK_STEPS)];
          if (tint !== ink) { ink = tint; ctx.fillStyle = ink; }
          ctx.fillRect(x - mw / 2, y - mh / 2, mw, mh);
        }
        left.push(m);
      }
      motes = left;
      ctx.globalAlpha = 1;
    }
    if (rewind) stepRewind();
    named.sort((a, b) => b.z - a.z);
    ctx.lineWidth = 1;
    for (const n of named) {
      if (!n.vis) continue;
      const kin = lit ? (n.type === lit ? 1.6 : 0.3) : 1;
      n.rad = clamp(4.6 * n.p * (SIZE[n.type] || 1), 0.9, 15) * grain;
      const glow = clamp(n.p / 2.5);
      ctx.fillStyle = TYPES[n.type].color;
      ctx.globalAlpha = (0.05 + 0.1 * glow) * n.a * kin * calm;
      ctx.beginPath(); ctx.arc(n.sx, n.sy, n.rad * 2.6, 0, 7); ctx.fill();
      ctx.globalAlpha = clamp((0.25 + 0.75 * glow) * n.a * kin * calm);
      ctx.beginPath(); ctx.arc(n.sx, n.sy, n.rad, 0, 7); ctx.fill();
      if (n === hot || n === front || (n === featured && live > 0.5)) {
        ctx.globalAlpha = (n === hot || n === front ? 0.9 : 0.5 * live) * n.a;
        ctx.strokeStyle = TYPES[n.type].color;
        ctx.beginPath(); ctx.arc(n.sx, n.sy, n.rad + 5, 0, 7); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // The name belongs to whichever body is approaching nearest the middle.
    // It holds a moment before handing over, so the label never flickers, and
    // gives way after a couple of seconds so the names keep turning over at
    // an even, unhurried beat.
    const quiet = highlightsAllowed && !hot && !front && clock - busy > 0.5 && (!motes.length || since >= 1.1);
    if (featured && quiet) held += elapsed;
    const tired = held > (mutedFeature ? FEATURE_HOLD - OPENING_LEAD : FEATURE_HOLD);
    let best = null, bestScore = 0;
    // The camera still glides from slide 1 when the first name appears. Choose
    // names around the usable text area's stable centre, not that moving origin.
    const focusX = low ? w / 2 : cx, focusY = low ? (floor + ceil) / 2 : cy;
    for (const n of named) {
      n.score = 0;
      if (!highlightsAllowed || !quiet || !n.vis || n.a < 0.6 || n.z > 3.2
        || !clear(n) || (n.rest > clock && n !== featured)) continue;
      const box = labelBox(n);
      const returning = n === featured && !mutedFeature && !tags.some((tag) => tag.item === n && tag.el.classList.contains('is-on'));
      if (!boxFits(box) || ((n !== featured || returning) && !canIntroduce(n))) continue;
      const dx = (n.sx - focusX) / (F * 0.55), dy = ((box.top + box.y) / 2 - focusY) / (F * 0.55);
      n.score = n.p * Math.exp(-(dx * dx + dy * dy));
      if (n.score > bestScore && !(tired && n === featured)) { bestScore = n.score; best = n; }
    }
    const keep = featured && !tired && boxFits(labelBox(featured)) && (!quiet || mutedFeature || featured.score > 0);
    const freeTag = tags.find((tag) => !tag.box || tag.until <= clock);
    if (quiet && !keep && best !== featured && (best || featured) && (!best || freeTag)) {
      if (featured) featured.rest = clock + 14; // let others have a turn
      featured = best; held = 0;
      // Desktop's first automatic beat is intentionally silent. Start with the
      // second item; no resource is removed and mobile keeps its first beat.
      mutedFeature = !!featured && skipOpeningFeature;
      if (featured) skipOpeningFeature = false;
      if (featured) {
        tags.splice(tags.indexOf(freeTag), 1); tags.unshift(freeTag);
        tags[0].box = null; tags[0].until = 0;
      }
      if (featured) { fill(tags[0].el, featured, false); tags[0].item = featured; }
    }
    // Let the first name surface just after the initial dissolve, while its remaining motes drift away. A pointer on
    // a dot (or a card in front) quietens the name at once; once it lets go, the name waits a moment (so passing over
    // dots never flickers it), then comes back slowly, wherever its dot has drifted to on its way, or the name of
    // whichever dot has taken its place meanwhile.
    if (hot || front) busy = clock;
    if (!quiet && clock - busy < 0.05) back = true; // put out by the pointer, not by the arrival
    const liveTarget = quiet && featured && !mutedFeature ? 1 : 0;
    live = motionOff() ? liveTarget : live + (liveTarget - live) * ease(3);
    tags.forEach((tag, i) => {
      const it = tag.item;
      const on = i === 0 && quiet && !mutedFeature && it === featured && !!it && it.vis && boxFits(labelBox(it));
      if (on && back && !tag.el.classList.contains('is-on')) { tag.el.classList.add('is-back'); back = false; held = Math.min(held, 0.6); } // and has its turn again
      if (!on || clock - busy > 2) tag.el.classList.remove('is-back');
      tag.el.classList.toggle('is-hush', !on && (!!hot || !!front));
      tag.el.classList.toggle('is-on', on);
      if (!on) {
        if (tag.until <= clock && tag.item !== featured) { tag.item = null; tag.box = null; }
        return; // fading labels retain their last position and measured space
      }
      const box = labelBox(it);
      tag.box = box; tag.until = clock + LABEL_FADE;
      tag.el.style.transform = `translate(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px) translate(-50%, -100%) scale(${box.scale.toFixed(3)})`;
    });

    // The card: beside a hovered dot, or drawn to the centre when clicked.
    f = motionOff() ? (front ? 1 : 0) : f + ((front ? 1 : 0) - f) * ease(6);
    const target = highlightsAllowed ? front || (f > 0.02 ? shown : hot) : null;
    if (target !== shown) { if (target) fill(card, target, true); shown = target; }
    card.classList.toggle('is-on', !!target);
    card.classList.toggle('is-front', !!front);
    if (target) {
      const e = f * f * (3 - 2 * f);
      const flip = target.sx > (low ? w * 0.6 : w * 0.78);
      const gap = target.rad + 12;
      const bx = target.sx + (flip ? -gap : gap), by = target.sy;
      const x = bx + (cx - bx) * e, scale = 0.92 + 0.2 * e, half = (card.offsetHeight * scale) / 2;
      let y = by + (cy - by) * e;
      if (low) y = Math.max(floor + half, Math.min(y, (raised ? ceil : h - 8) - half)); // the card never goes behind the text
      const px = (flip ? -100 : 0) + (flip ? 50 : -50) * e;
      card.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${px.toFixed(1)}%, -50%) scale(${scale.toFixed(3)})`;
    }
  };
  const scheduleFrame = () => {
    if (!running || frameRaf) return;
    if (still) last = window.deckNow?.() ?? performance.now();
    const ctx = entryCtx;
    frameRaf = requestAnimationFrame((t) => frame(t, ctx));
  };

  // Slide 1's films come apart: each tile is sampled into a grid of motes in
  // its own colours, placed in the world exactly where the camera sees the
  // tile now, then released (edges first) to fly at us and thin into stars.
  const collage = document.querySelector('[data-collage]');
  const collageSlide = collage && collage.closest('.slide');
  const samplers = new Map();
  let motes = [];
  // The ring's centre, in the stage's px.
  const middle = (base) => {
    const boxes = [...collage.querySelectorAll('.vc-tile')].map((t) => t.getBoundingClientRect()).filter((r) => r.width);
    return boxes.length ? {
      x: (Math.min(...boxes.map((r) => r.left)) + Math.max(...boxes.map((r) => r.right))) / 2 - base.left,
      y: (Math.min(...boxes.map((r) => r.top)) + Math.max(...boxes.map((r) => r.bottom))) / 2 - base.top,
    } : { x: cx, y: cy };
  };
  const dissolve = (ctx) => {
    collageSlide.classList.add('vc-dissolve'); // both slides hold still while they cross
    slide.classList.add('sf-arrive');
    const clear = () => { collageSlide.classList.remove('vc-dissolve'); slide.classList.remove('sf-arrive'); };
    const cancel = ctx.transitionLater(clear, 900);
    ctx.transitionDefer(() => { cancel(); clear(); });
    resize(); aim();
    const base = stage.getBoundingClientRect();
    // The collage's centre, which the picture bursts outward from.
    const mid = middle(base);
    // We fly into the collage: for a moment the field opens from its centre.
    shift = { x: 0, y: 0, age: 9 };
    aim();
    shift = { x: mid.x - cx, y: mid.y - cy, age: -0.6 };
    aim();
    motes = tileMotes(base);
    // The same sampled artwork pixels become the entrance material of the
    // filament field instead of flying out into the old perspective starfield.
    // The original motes stay available for the slide 2 -> 1 reversal.
    const fieldBox=root.getBoundingClientRect();
    const stride=Math.max(1,Math.ceil(motes.length/1350));
    root.filamentArtwork=motes.filter((m,i)=>i%stride===0).map((m,i)=>({
      id:i,x:m.sx0+base.left-fieldBox.left,y:m.sy0+base.top-fieldBox.top,
      color:m.inks[0],size:Math.min(5,Math.max(1.1,m.cw*.65)),delay:m.delay,
    }));
    root.filamentSuppressMotes=!!window.FilamentField;
  };
  // A mote leaves the picture in its own colour and arrives in the field as a star of the same hue, lighter and softer
  // like the field's own kinds, so a dark film still comes apart into light rather than into the black.
  const INK_STEPS = 6;
  const inkCache = new Map();
  const unsampled = Array(INK_STEPS + 1).fill(TYPES.model.color);
  const inksOf = (r, g, b) => {
    const key = (r << 16) | (g << 8) | b;
    if (inkCache.has(key)) return inkCache.get(key);
    const hi = Math.max(r, g, b) / 255, lo = Math.min(r, g, b) / 255, l = (hi + lo) / 2, c = hi - lo;
    const sat = c ? c / (1 - Math.abs(2 * l - 1)) : 0;
    const L = 0.7, k = c ? ((1 - Math.abs(2 * L - 1)) * Math.min(sat, 0.42)) / c : 0; // the star: same hue, softer, lighter
    const star = [r, g, b].map((v) => (L + (v / 255 - l) * k) * 255);
    const inks = Array.from({ length: INK_STEPS + 1 }, (_, i) => {
      const t = i / INK_STEPS;
      return `rgb(${[r, g, b].map((v, j) => Math.round(v + (star[j] - v) * t)).join(',')})`;
    });
    inkCache.set(key, inks);
    return inks;
  };
  // Each film, sampled into a grid of motes in its own colours, placed in the world where the camera sees it now. On
  // slide 1's ring (collage.js faces()) each film is a quad in perspective, dimmed and paled with its distance round
  // the ring and partly hidden by the films nearer the front: its motes start exactly as it looks there, and the
  // further round it stood, the deeper they sit, so the back of the ring stays on longest as stars.
  const BG = [13, 10, 7]; // the deck's ground, which the ring's veil dims toward
  const inside = (pts, x, y) => {
    let sign = 0;
    for (let k = 0; k < pts.length; k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[(k + 1) % pts.length];
      const c = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
      if (c && sign && Math.sign(c) !== sign) return false;
      sign = sign || Math.sign(c);
    }
    return true;
  };
  const facesOf = () => (collage.faces ? collage.faces() : [...collage.querySelectorAll('.vc-tile')].map((tile) => {
    const r = tile.getBoundingClientRect();
    return { tile, shade: 1, sat: 1, far: 0, depth: 0, aspect: r.width / r.height, at: (u, v) => [r.left + u * r.width, r.top + v * r.height] };
  }));
  // A card's picture as it shows on the card (its crop to the card's shape), drawn into a grid of cols × rows.
  const cropOf = (pic, w, h, aspect) => {
    const [ox, oy] = getComputedStyle(pic).objectPosition.split(' ').map((n) => parseFloat(n) / 100);
    let sw = w, sh = h, sx = 0, sy = 0;
    if (sw / sh > aspect) { sw = sh * aspect; sx = (w - sw) * ox; } else { sh = sw / aspect; sy = (h - sh) * oy; }
    return [sx, sy, sw, sh];
  };
  const grab = (pic, w, h, aspect, cols, rows) => {
    const key = `${cols}x${rows}`;
    let sctx = samplers.get(key);
    if (sctx === undefined) {
      const sampler = document.createElement('canvas');
      sampler.width = cols; sampler.height = rows;
      sctx = sampler.getContext('2d', { willReadFrequently: true });
      samplers.set(key, sctx);
    }
    if (!sctx) return null;
    sctx.clearRect(0, 0, cols, rows);
    try { sctx.drawImage(pic, ...cropOf(pic, w, h, aspect), 0, 0, cols, rows); return sctx.getImageData(0, 0, cols, rows).data; } catch { return null; }
  };
  // Reading a picture back from the GPU is slow, and slower still while the turn to slide 2 is under way, so each
  // card's still is read once, ahead of time, in a moment of quiet while slide 1 is up (STILL px square); the
  // dissolve then reads only a film that is playing. (Once the ring has arrived and settled, so its arrival never drops a frame.)
  const STILL = 64, stills = new Map();
  const readStills = () => {
    if (!collage.faces || !collageSlide.classList.contains('on')) return;
    const todo = collage.faces().filter((f) => {
      const img = f.tile.querySelector('img');
      return img.complete && img.naturalWidth && stills.get(f.tile)?.src !== img.currentSrc + getComputedStyle(img).objectPosition + f.aspect;
    });
    if (!todo.length) return;
    const f = todo[0], img = f.tile.querySelector('img');
    const data = grab(img, img.naturalWidth, img.naturalHeight, f.aspect, STILL, STILL);
    if (data) stills.set(f.tile, { src: img.currentSrc + getComputedStyle(img).objectPosition + f.aspect, data: new Uint8ClampedArray(data) });
    if (todo.length > 1) whenIdle(readStills);
  };
  const whenIdle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 400));
  // The cached still, averaged down to cols × rows.
  const fromStill = (still, cols, rows) => {
    const out = new Uint8ClampedArray(cols * rows * 4), d = still.data;
    for (let j = 0; j < rows; j++) {
      const y0 = Math.floor((j * STILL) / rows), y1 = Math.max(y0 + 1, Math.floor(((j + 1) * STILL) / rows));
      for (let i = 0; i < cols; i++) {
        const x0 = Math.floor((i * STILL) / cols), x1 = Math.max(x0 + 1, Math.floor(((i + 1) * STILL) / cols));
        let r = 0, g = 0, b = 0, n = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const k = (y * STILL + x) * 4; r += d[k]; g += d[k + 1]; b += d[k + 2]; n++; }
        const o = (j * cols + i) * 4;
        out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
      }
    }
    return out;
  };
  const bounds = (q) => [Math.min(...q.map((p) => p[0])), Math.min(...q.map((p) => p[1])), Math.max(...q.map((p) => p[0])), Math.max(...q.map((p) => p[1]))];
  const tileMotes = (base) => {
    const motes = [];
    const faces = facesOf().map((f) => { const quad = [f.at(0, 0), f.at(1, 0), f.at(1, 1), f.at(0, 1)]; return { ...f, quad, box: bounds(quad) }; });
    for (const f of faces) {
      const { tile, quad } = f, v = tile.querySelector('video'), img = tile.querySelector('img');
      const across = (Math.hypot(quad[1][0] - quad[0][0], quad[1][1] - quad[0][1]) + Math.hypot(quad[2][0] - quad[3][0], quad[2][1] - quad[3][1])) / 2;
      const down = (Math.hypot(quad[3][0] - quad[0][0], quad[3][1] - quad[0][1]) + Math.hypot(quad[2][0] - quad[1][0], quad[2][1] - quad[1][1])) / 2;
      if (!(across > 1) || !(down > 1)) continue;
      const cols = Math.max(4, Math.round(across / 8)), rows = Math.max(4, Math.round(down / 8));
      // The nearer cards that overlap this one at all, each tested by its bounds before its outline.
      const nearer = faces.filter((g) => g.depth > f.depth && g.box[0] < f.box[2] && g.box[2] > f.box[0] && g.box[1] < f.box[3] && g.box[3] > f.box[1]);
      const hidden = (x, y) => nearer.some((g) => x >= g.box[0] && x <= g.box[2] && y >= g.box[1] && y <= g.box[3] && inside(g.quad, x, y));
      let px = null;
      // What the tile shows: its preview while one plays over it, otherwise its still (both same-origin).
      const live = tile.classList.contains('is-live') && v && v.readyState >= 2 && v.videoWidth;
      const still = !live && stills.get(tile);
      if (still && still.src === img.currentSrc + getComputedStyle(img).objectPosition + f.aspect) px = fromStill(still, cols, rows);
      else if (live) px = grab(v, v.videoWidth, v.videoHeight, f.aspect, cols, rows);
      else if (img && img.complete && img.naturalWidth) px = grab(img, img.naturalWidth, img.naturalHeight, f.aspect, cols, rows);
      // The film as the ring shows it: paled toward its own grey, then dimmed toward the ground (and faded where it
      // passes under the words).
      const look = (r, g, b, shade) => {
        const grey = 0.3 * r + 0.59 * g + 0.11 * b;
        return [r, g, b].map((c, n) => (grey + (c - grey) * f.sat) * shade + BG[n] * (1 - shade));
      };
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const k = (j * cols + i) * 4;
          const [x, y] = f.at((i + 0.5) / cols, (j + 0.5) / rows);
          if (hidden(x, y)) continue; // behind a nearer film
          const [xa, ya] = f.at(i / cols, (j + 0.5) / rows), [xb, yb] = f.at((i + 1) / cols, (j + 0.5) / rows);
          const [xc, yc] = f.at((i + 0.5) / cols, j / rows), [xd, yd] = f.at((i + 0.5) / cols, (j + 1) / rows);
          const sx0 = x - base.left, sy0 = y - base.top, cw = Math.hypot(xb - xa, yb - ya), ch = Math.hypot(xd - xc, yd - yc);
          // Most motes sit close, so they stream past us; a few sit deep and stay on as stars.
          const z = (1.2 + Math.pow(rnd(), 2) * 3) * (1 + 0.9 * f.far);
          const xr = ((sx0 - cx) / F) * z, yr = ((sy0 - cy) / F) * z;
          const shade = f.shade * (f.through ? f.through(x, y) : 1);
          const ink = px ? look(px[k], px[k + 1], px[k + 2], shade).map((c) => Math.round(c) | 7) : null; // a little coarse, so colours repeat
          motes.push({
            x: xr * cosR + yr * sinR, y: -xr * sinR + yr * cosR, z, sx0, sy0, cw: cw + 0.6, ch: ch + 0.6, age: 0,
            inks: ink ? inksOf(...ink) : unsampled,
            delay: 0.05 + Math.hypot(i / cols - 0.5, j / rows - 0.5) * 0.5 + rnd() * 0.3,
          });
        }
      }
    }
    motes.sort((a, b) => (a.inks[0] < b.inks[0] ? -1 : a.inks[0] > b.inks[0] ? 1 : 0)); // draw colour by colour
    return motes;
  };

  // A step back to slide 1: the field gathers back into the collage's tiles. The 1→2 flight is played backwards: the
  // field rushes away from us, its vanishing point drifting back to the collage, and each tile's motes return along
  // their own paths into its grid; then the collage fades in over them and the field goes.
  let rewind = null;
  const smooth = (k) => k * k * (3 - 2 * k);
  // How far the arrival's flight had carried a mote t seconds in (its speed 1 + the arrival's glide of 3.5, easing off).
  const flown = (t) => 0.36 * (t + (3.5 / 2.2) * (1 - Math.exp(-2.2 * t)));
  const rewindSpeed = () => {
    const r = rewind, back = -(1 + 3.5 * Math.exp(-2.2 * Math.max(0, r.A - r.t)));
    return r.v0 + (back - r.v0) * smooth(clamp(r.t / 0.35)); // from the drift it had, without a jolt
  };
  const regather = (ctx) => {
    entryCtx = ctx;
    if (frameRaf) cancelAnimationFrame(frameRaf);
    frameRaf = 0; running = true; last = window.deckNow?.() ?? performance.now();
    collageSlide.classList.add('vc-dissolve'); // the collage holds still, hidden, at full size
    ctx.present(collageSlide, 'dt-return dt-await');
    ctx.present(slide, 'dt-rewind');
    resize();
    const k0 = shift.k ?? (shift.age < 0 ? 1 : (1 + shift.age * 1.8 + (shift.age * 1.8) ** 2 / 2) * Math.exp(-shift.age * 1.8));
    const base = stage.getBoundingClientRect(), mid = middle(base);
    shift = { x: 0, y: 0, k: 0 };
    aim();
    // Each mote is placed where the camera will see its tile once the vanishing point is back at the collage.
    shift = { x: mid.x - cx, y: mid.y - cy, k: 1 };
    aim();
    motes = tileMotes(base);
    motes.forEach((m) => { m.z0 = m.z; });
    const A = Math.max(...motes.map((m) => m.delay + 0.9)), landed = A - Math.min(...motes.map((m) => m.delay));
    shift.k = k0; // where the vanishing point is now (home, unless it is still drifting there)
    aim();
    rewind = { ctx, t: 0, k0, A, landed, v0: speed + boost + glide, kept: [...named, ...dust].map((o) => [o, o.x, o.y, o.z]), shown: false };
    pointer = null; front = null; boost = 0; glide = 0; since = 9;
    scheduleFrame();
  };
  const stepRewind = () => {
    const r = rewind;
    if (!r) return;
    if (!r.shown && r.t >= r.landed) { // back in their tiles: the collage fades in over them, and the field goes
      r.shown = true;
      r.ctx.present(collageSlide, '', 'dt-await');
      r.ctx.present(slide, 'dt-rewound', 'dt-rewind');
    }
    if (r.t >= r.landed + 0.7) endRewind();
  };
  const endRewind = () => {
    if (!rewind) return;
    const r = rewind;
    rewind = null;
    collageSlide.classList.remove('vc-dissolve');
    r.ctx.present(collageSlide, '', 'dt-return dt-await');
    r.ctx.present(slide, 'dt-rewound', 'dt-rewind');
    for (const [o, x, y, z] of r.kept) { o.x = x; o.y = y; o.z = z; }
    motes = [];
    shift = { x: 0, y: 0, age: 9 };
    stop();
    reverseFinish?.(r.ctx, 'completed');
  };

  // Coming back from slide 3, the field holds still while the tools fly back to their dots, then drifts on.
  root.hold = (s) => { speed = 0; holdFor = s; };

  // Where the field's dots and some of its dust are on screen right now, for
  // the next slide to pick up (slide 3 in F flies them into its chart).
  root.snapshot = () => {
    const b = stage.getBoundingClientRect();
    const on = (x, y) => x > 0 && x < w && y > 0 && y < h;
    const dots = named.filter((n) => n.vis && n.a > 0.3 && on(n.sx, n.sy))
      .map((n) => ({ x: n.sx + b.left, y: n.sy + b.top, p: n.p, r: n.rad, color: TYPES[n.type].color }));
    const specks = [];
    for (let i = 0; i < 260; i++) {
      const o = dust[Math.floor(rnd() * dust.length)];
      const q = place(o);
      if (q.a > 0.2 && on(q.x, q.y)) specks.push({ x: q.x + b.left, y: q.y + b.top, color: TYPES[o.type].color });
    }
    return { named: dots, dust: specks };
  };

  const start = (arriving, ctx = window.deckNav) => {
    if (running || !slide.classList.contains('on') || document.getElementById('overview')?.classList.contains('on')) return;
    entryCtx = ctx;
    resize();
    running = true; last = window.deckNow?.() ?? performance.now();
    if (fontHandler) document.fonts?.removeEventListener?.('loadingdone', fontHandler);
    fontHandler = () => { if (ctx?.isCurrent?.() && ctx === entryCtx) { labelSizes.clear(); scheduleFrame(); } };
    document.fonts?.addEventListener?.('loadingdone', fontHandler);
    if (arriving && !motionOff() && !ctx?.direct) { glide = 3.5; boost = 0; since = 0; settled = 0; } // arriving, we fly in past slide 1's collage
    else { glide = 0; boost = 0; since = 9; settled = 1; shift = { x: 0, y: 0, age: 9 }; motes = []; aim(); }
    if (motionOff() || ctx?.rest || ctx?.direct) { frame(performance.now(), ctx); entryFinish?.(ctx, 'completed'); }
    else scheduleFrame();
  };
  const stop = () => { if (rewind) { endRewind(); return; } running = false; pointer = null; if (frameRaf) cancelAnimationFrame(frameRaf); frameRaf = 0; if (fontHandler) document.fonts?.removeEventListener?.('loadingdone', fontHandler); fontHandler = null; };
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
    const promise = completion(ctx, (fn) => { entryFinish = fn; }, () => stop());
    if (running) stop();
    clearHighlights(); busy = clock - 1;
    skipOpeningFeature = stage.clientWidth > 760 && !motionOff(); mutedFeature = false;
    tags.forEach((tag) => { tag.el.style.transitionDuration = ''; });
    card.style.transitionDuration = '';
    if (ctx.from === 0 && !motionOff() && !ctx.rest && !ctx.direct) dissolve(ctx);
    start(!ctx.rest, ctx);
    window.FilamentField?.enter(ctx.from === 0 && !ctx.direct && !ctx.rest ? 'enter-collage' :
      ctx.from === 2 && !ctx.direct && !ctx.rest ? 'enter-gap' : 'rest', ctx);
    return promise;
  };
  const sceneExit = (ctx) => {
    if (ctx.to === 0) root.filamentSuppressMotes = false; // give the sampled pixels back to the gallery
    window.FilamentField?.exit(ctx);
    clearHighlights(); // dismiss immediately, before the reverse picture handoff
    if (ctx.to === 0 && ctx.back && !motionOff()) {
      const promise = completion(ctx, (fn) => { reverseFinish = fn; }, () => endRewind());
      regather(ctx);
      return promise;
    }
    // The chart measures its flight endpoints before the network runs. Keep the
    // field presented during that layout so its outgoing fade starts on time.
    if (ctx.to === 2 && !ctx.direct && !ctx.rest && !motionOff()) ctx.present(slide, 'dt-leaving');
    stop();
  };
  const sceneRestore = (ctx) => {
    if (rewind) endRewind();
    if (ctx.to !== 1) return true;
    window.FilamentField?.restore(ctx);
    if (motes.length || slide.classList.contains('sf-arrive')) {
      motes = []; glide = 0; boost = 0; since = 9; settled = 1;
      shift = { x: 0, y: 0, age: 9 };
    }
    collageSlide?.classList.remove('vc-dissolve');
    slide.classList.remove('sf-arrive');
    aim();
    return true;
  };
  window.deckRegisterScene?.([1], { enter: sceneEnter, exit: sceneExit, restore: sceneRestore, resize: sceneResize });
  if (collageSlide) {
    new MutationObserver(() => { if (collageSlide.classList.contains('on')) setTimeout(() => whenIdle(readStills), 6500); })
      .observe(collageSlide, { attributes: true, attributeFilter: ['class'] });
    addEventListener('load', () => setTimeout(() => whenIdle(readStills), 6500), { once: true });
  }
  const syncMotion = () => {
    if (slide.classList.contains('on')) window.FilamentField?.restore({ to:1, rest:true, direct:true });
    if (motionOff() && slide.classList.contains('on')) { skipOpeningFeature = mutedFeature = false; stop(); start(false); }
    else if (document.getElementById('overview')?.classList.contains('on')) stop();
    else if (slide.classList.contains('on')) { running = false; start(false); }
  };
  window.addEventListener('deck-overview', syncMotion);
  window.addEventListener('deck-motion', syncMotion);

  // Mouse and pen inspect; on touch a tap is the hover. The field is the slide's
  // backdrop, so it listens on the slide itself.
  const locate = (e) => {
    const r = stage.getBoundingClientRect();
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  slide.addEventListener('pointermove', (e) => {
    if (window.FilamentField?.ready()) return;
    if (e.pointerType === 'touch' || !slide.classList.contains('on') || rewind) return;
    locate(e); if (motionOff()) scheduleFrame();
  });
  slide.addEventListener('pointerdown', (e) => { if (window.FilamentField?.ready()) return; touched = e.pointerType === 'touch'; if (touched) { locate(e); if (motionOff()) scheduleFrame(); } });
  slide.addEventListener('pointerleave', () => { pointer = null; if (motionOff()) scheduleFrame(); });
  // Scroll to fly: down goes forward, up goes back, with momentum. If the
  // slide itself has to scroll (a short window), scrolling stays scrolling.
  slide.addEventListener('wheel', (e) => {
    if (window.FilamentField?.ready()) return; // Let the main deck's wheel navigation work.
    if (slide.scrollHeight > slide.clientHeight + 1) return;
    e.preventDefault();
    const lines = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? h : 1;
    boost = clamp(boost + e.deltaY * lines * 0.006, -8, 12);
  }, { passive: false });
  legend.addEventListener('pointerover', (e) => { keyHover = e.target.closest('.sf-key')?.dataset.type || null; if (motionOff()) scheduleFrame(); });
  legend.addEventListener('pointerleave', () => { keyHover = null; if (motionOff()) scheduleFrame(); });

  // Clicks on a dot, a key or an open card stay here; anywhere else the deck
  // turns the slide as usual.
  slide.addEventListener('click', (e) => {
    if (window.FilamentField?.ready()) return; // Hidden starfield cannot capture a deck click.
    const key = e.target.closest('.sf-key');
    if (key) {
      e.stopPropagation();
      keyLock = keyLock === key.dataset.type ? null : key.dataset.type;
      keys.forEach((k) => k.classList.toggle('is-on', k.dataset.type === keyLock));
      if (motionOff()) scheduleFrame();
      return;
    }
    let pick = hot;
    if (!pick && touched && pointer) { // a tap lands before the next frame has looked
      let best = 28 * 28;
      for (const n of named) {
        if (!n.vis || (below() ? n.sy < floor + 6 || (raised && n.sy > ceil) : n.sx < w * 0.5)) continue;
        const dd = (n.sx - pointer.x) ** 2 + (n.sy - pointer.y) ** 2;
        if (dd < best) { best = dd; pick = n; }
      }
    }
    if (!pick && !front) return;
    e.stopPropagation();
    front = pick && pick !== front ? pick : null;
    if (motionOff()) scheduleFrame();
  });
  const clearFront = () => { front = null; if (motionOff()) scheduleFrame(); };
  window.deckOverlay?.register({
    isOpen: () => !!front,
    contains: (target) => slide.querySelector('.sf-card')?.contains(target) || false,
    close: clearFront,
  });

  resize();
  fontHandler = null;
  if (slide.classList.contains('on')) start(!window.deckNav?.rest, window.deckNav);
})();

// The new filament scene shares the original collage handoff and gap.js snapshot.
/* Mycelial slide 2 — the capabilities remain; access progressively frays.
 * A deterministic Canvas2D filament scene. Works alongside the existing artwork
 * motes, and exports a snapshot with the contract expected by gap.js.
 * Visual attrition is illustrative, never an empirical conversion claim.
 */
(() => {
  'use strict';
  const root = document.querySelector('[data-scatter-field]');
  if (!root) return;
  const slide = root.closest('.slide');
  const originalCanvas = root.querySelector('.sf-dust');
  const originalSnapshot = root.snapshot?.bind(root);
  const canvas = document.createElement('canvas');
  canvas.className = 'ff-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  root.append(canvas);
  const g = canvas.getContext('2d');
  if (!g) return;
  const hits = document.createElement('div');
  hits.className = 'ff-hits';
  const note = document.createElement('div');
  note.className = 'ff-note';
  note.setAttribute('role', 'status');
  note.setAttribute('aria-live', 'polite');
  note.innerHTML = '<span class="ff-note-kind"></span><b class="ff-note-name"></b><span class="ff-note-detail"></span>';
  root.append(hits, note);

  const fallback = [
    ['model','Upscaler','Restore intricate detail in footage','Video super-resolution with open image and video upscalers.'],
    ['lora','Motion','Direct a particular camera movement','Fine-tune motion using open LoRAs and control techniques.'],
    ['workflow','Workflow','Keep a character consistent','Use references and multiple generation steps across shots.'],
    ['repo','Tool','Replace elements of a scene','Masks, conditioning and frame-aware editing tools.'],
    ['guide','Guide','Control the look of an image','Learn advanced prompting, compositing and colour methods.'],
    ['thread','Discussion','Solve difficult temporal artifacts','Community workarounds for flicker, joins and consistency.'],
  ];
  const catalogue = (Array.isArray(root.filamentItems) && root.filamentItems.length ? root.filamentItems : fallback)
    .map((r,i) => ({ id:i, type:r[0], where:r[1], name:r[2], detail:r[3] }));
  const colors = { model:'#f2c77e', lora:'#dbb2ca', repo:'#a9d7b2', workflow:'#a9c8e5', thread:'#c8bbeb', guide:'#e6c9a2' };
  const gates = [
    ['DISCOVER','Find the right model, tool or workflow across scattered repositories and discussions.'],
    ['SET UP','Resolve dependencies, hardware, model downloads and installation conflicts.'],
    ['CONFIGURE','Learn the right settings, prompting and control techniques for a useful result.'],
    ['CREATE','Turn connected capabilities into a finished creative work.']
  ];
  const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
  const ease=t=>t*t*(3-2*t);
  const hash=n=>{let z=(n+0x6D2B79F5)|0;z=Math.imul(z^(z>>>15),z|1);z^=z+Math.imul(z^(z>>>7),z|61);return ((z^(z>>>14))>>>0)/4294967296;};
  const hexRgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  const alpha=(hex,a)=>`rgba(${hexRgb(hex).join(',')},${clamp(a).toFixed(3)})`;
  const point=(a,b,t)=>a+(b-a)*t;
  const N=42;
  let w=0,h=0,dpr=1,geom=[],sources=[],artwork=[],raf=0,last=0,elapsed=0,clock=0,mode='inactive',start=0;
  let visit=null, hovered=-1, pinned=-1, highlightAt=0, pointerLeave=0, pulseId=0, pulses=[], launchAt=0, shadow=0;
  // Every dot keeps its own resource identity until it is replaced.
  const assignments=Array.from({length:N},(_,i)=>(i*13)%catalogue.length);
  const reborn=Array(N).fill(-100);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionOff=()=>reduced || window.deckStill?.() || document.hidden;
  const owned=()=>slide.classList.contains('on') && !document.getElementById('overview')?.classList.contains('on');
  const now=()=>window.deckNow?.() ?? performance.now();
  const canvasArea=()=>({ left:root.getBoundingClientRect().left, top:root.getBoundingClientRect().top });
  const stopIndex=(i)=>{const x=hash(i*17+6);return x<.29?0:x<.56?1:x<.78?2:x<.93?3:4;};
  const activeItem=i=>catalogue[assignments[i]];
  // Four evenly spaced checkpoints, with Create nearest the endpoint.
  const gateX=()=>[.345,.51,.675,.84].map(x=>w*x);
  const stops=()=>gateX();
  const layout=()=>{
    const box=root.getBoundingClientRect(),nw=box.width,nh=box.height;
    if(nw<1||nh<1)return;
    w=nw;h=nh;dpr=Math.min(2,devicePixelRatio||1);
    const bw=Math.max(1,Math.round(w*dpr)),bh=Math.max(1,Math.round(h*dpr));
    if(canvas.width!==bw)canvas.width=bw;if(canvas.height!==bh)canvas.height=bh;
    canvas.style.width=w+'px';canvas.style.height=h+'px';
    g.setTransform(dpr,0,0,dpr,0,0);
    const narrow=w<700,top=narrow?h*.50:h*.47,bottom=narrow?h*.835:h*.85;
    geom=Array.from({length:N},(_,i)=>{
      const u=(i+.5)/N;
      const y=top+u*(bottom-top); // evenly spaced left-hand dots
      const x0=w*(narrow?.08:.11)+(hash(i*33+2)-.5)*Math.min(w*.012,12);
      const xf=w*(narrow?.95:.925);
      const end=stopIndex(i);
      const nodes=Array.from({length:6},(_,k)=>{
        const x=k===0?x0:k===5?xf:gateX()[k-1];
        return{x,y:y+(k===0?0:(hash(i*37+k*63)-.5)*Math.min(30,h*.05))};
      });
      return {id:i,nodes,y,x0,xf,end,seed:hash(i*541+31),color:colors[activeItem(i).type]||'#d3b180'};
    });
    if(!hits.children.length){
      for(let i=0;i<N;i++){
        const b=document.createElement('button'); b.type='button';b.className='ff-hit';
        b.dataset.id=String(i);b.setAttribute('aria-label','Inspect creative capability');
        b.addEventListener('pointerenter',()=>inspect(i,false));
        b.addEventListener('focus',()=>inspect(i,false));
        b.addEventListener('pointerleave',()=>release(i));
        b.addEventListener('blur',()=>release(i));
        b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();inspect(i,true);});
        b.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter')e.stopPropagation();});
        hits.append(b);
      }
    }
    Array.from(hits.children).forEach((b,i)=>{
      b.style.left=geom[i].x0+'px';b.style.top=geom[i].y+'px';
      b.setAttribute('aria-label',`Inspect ${activeItem(i).name}`);
    });
    draw();
  };
  const cubic=(a,b,t)=>{
    const mid=(a.x+b.x)/2,delta=Math.abs(b.x-a.x)*.06;
    const c1={x:mid-delta,y:a.y+(b.y-a.y)*.18};
    const c2={x:mid+delta,y:b.y-(b.y-a.y)*.18};
    const q=1-t;
    return{x:q*q*q*a.x+3*q*q*t*c1.x+3*q*t*t*c2.x+t*t*t*b.x,
      y:q*q*q*a.y+3*q*q*t*c1.y+3*q*t*t*c2.y+t*t*t*b.y};
  };
  const position=(strand,t)=>{
    const k=clamp(t)*5,idx=Math.min(4,Math.floor(k));
    return cubic(strand.nodes[idx],strand.nodes[idx+1],k-idx);
  };
  function displayText(i){
    const item=activeItem(i);
    note.querySelector('.ff-note-kind').textContent=item.where;
    note.querySelector('.ff-note-name').textContent=item.name;
    note.querySelector('.ff-note-detail').textContent=item.detail;
    // Hover details belong to the selected dot, below the main headline.
    note.style.left=clamp(geom[i].x0+25,w*.11,w*.26)+'px';
    note.style.top=clamp(geom[i].y-87,h*.37,h*.70)+'px';
    note.classList.add('is-on');
    hits.children[i]?.setAttribute('aria-label',`Selected: ${item.name}`);
  }
  const inspect=(i,lock)=>{
    if(!owned()||mode!=='rest')return;
    if(i!==hovered&&i!==pinned)highlightAt=clock;
    hovered=i;if(lock)pinned=i;
    displayText(i);
    pulses.push({id:i,at:clock-0.08,duration:2.9,inspection:true});
    pulses=pulses.slice(-12);
    wake();
  };
  const release=i=>{
    if(pinned===i)return;
    if(hovered===i)hovered=-1;
    if(hovered<0&&pinned<0)note.classList.remove('is-on');
  };
  // Visual dots are only ~6px apart. 28px buttons overlap and later
  // siblings steal clicks. Resolve the nearest actual dot on one pointer
  // surface; keep the labelled buttons as independent keyboard targets.
  const nearest=(event)=>{
    if(!owned()||mode!=='rest')return -1;
    const rect=canvasArea();
    const x=event.clientX-rect.left,y=event.clientY-rect.top;
    let best=-1,distance=(event.pointerType==='touch'?27:15)**2;
    geom.forEach((strand,i)=>{
      const dx=x-strand.x0,dy=y-strand.y;
      const d=dx*dx+dy*dy;
      if(d<distance){distance=d;best=i;}
    });
    return best;
  };
  hits.addEventListener('pointermove',e=>{
    if(e.pointerType==='touch')return;
    const selected=nearest(e);
    if(selected===hovered)return;
    if(hovered>=0)release(hovered);
    if(selected>=0)inspect(selected,false);
  });
  hits.addEventListener('pointerleave',()=>{
    if(hovered>=0)release(hovered);
  });
  hits.addEventListener('click',e=>{
    const selected=nearest(e);
    if(selected<0)return; // blank space still turns the deck
    e.preventDefault();e.stopPropagation();
    if(pinned===selected){pinned=-1;hovered=-1;note.classList.remove('is-on');}
    else inspect(selected,true);
  });
  // Click empty space or Escape to return to the quiet field.
  slide.addEventListener('pointerdown',e=>{
    if(!e.target.closest('.ff-hit')&&pinned>=0){pinned=-1;hovered=-1;note.classList.remove('is-on');}
  });
  slide.addEventListener('keydown',e=>{if(e.key==='Escape'){pinned=-1;hovered=-1;note.classList.remove('is-on');}});
  const frameColor=(color,a)=>{g.strokeStyle=alpha(color,a);};
  const drawLine=(strand,segment,opacity,build,thin=0)=>{
    const a=strand.nodes[segment],b=strand.nodes[segment+1];
    if(opacity<.002||build<=0)return;
    const len=18;g.beginPath();g.moveTo(a.x,a.y);
    for(let j=1;j<=len;j++){
      const p=cubic(a,b,j/len*build);g.lineTo(p.x,p.y);
    }
    frameColor(strand.color,opacity);
    g.lineWidth=thin?0.7:1.08;g.stroke();
  };
  const dot=(x,y,r,c,a,glow=true)=>{
    if(a<.004)return;
    if(glow){const rr=Math.max(8,r*4);const grad=g.createRadialGradient(x,y,0,x,y,rr);
      grad.addColorStop(0,alpha(c,a*.19));grad.addColorStop(1,alpha(c,0));g.fillStyle=grad;g.fillRect(x-rr,y-rr,rr*2,rr*2);}
    g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fillStyle=alpha(c,a);g.fill();
  };
  const buildAt=(t)=>clamp(t);
  // Never highlight beyond a strand's actual stopping point.
  const terminal=strand=>strand.end===4?.85:Math.max(.03,(strand.end+1)/5-.025);
  const latest=()=>Math.max(0,(now()-start)/1000);
  const draw=()=>{
    if(!w||!h)return;
    const narrow=w<700;
    g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
    const since=latest();
    let build=1,opacity=1,dusting=0;
    if(mode==='enter-collage'){
      build=ease(clamp((since-.35)/1.55));opacity=clamp((since-.35)/.8);
      dusting=clamp((since-.72)/.75);
    }else if(mode==='enter-gap'){
      build=ease(clamp((since-.15)/1.0));opacity=clamp(since/.6);dusting=1;
    }else if(mode==='exit-gap'){
      build=1;opacity=1-ease(clamp(since/1.05));dusting=1;
    }else if(mode==='exit-collage'){
      build=1-ease(clamp(since/.85));opacity=1-ease(clamp(since/1.1));dusting=clamp(1-since/.6);
    }else if(mode==='inactive') { g.clearRect(0,0,w,h);root.classList.remove('ff-active');return; }
    if(mode!=='exit-collage'&&mode!=='exit-gap'&&mode!=='enter-collage')dusting=1;
    // One renderer owns moving artwork pixels during the entrance.
    if(originalCanvas)originalCanvas.style.opacity=mode==='enter-collage'&&artwork.length?'0':String(1-dusting);
    root.classList.toggle('ff-active',mode!=='inactive');

    const gatesX=stops(),yTop=narrow?h*.475:h*.46,yBottom=narrow?h*.86:h*.88;
    // A subdued, architectural frame that belongs to the same family as the deck's network artwork.
    g.save();g.lineWidth=.7;
    gatesX.forEach((x,j)=>{
      const fade=opacity*(.25+j*.03);
      const grad=g.createLinearGradient(x,yTop,x,yBottom);
      grad.addColorStop(0,alpha('#d5a368',0));grad.addColorStop(.20,alpha('#d5a368',fade));
      grad.addColorStop(.80,alpha('#d5a368',fade*.8));grad.addColorStop(1,alpha('#d5a368',0));
      g.strokeStyle=grad;g.beginPath();g.moveTo(x,yTop);g.lineTo(x,yBottom);g.stroke();
      // All four evenly spaced labels share a baseline beneath the threads.
      const baseline=yBottom+(narrow?22:25);
      g.fillStyle=alpha(j===3?'#f0c98d':'#d6ba90',opacity*.94);
      g.font=`${narrow?10:12}px "DM Sans",Arial,sans-serif`;
      g.textAlign='center';g.letterSpacing='1.4px';
      g.fillText(gates[j][0],x,baseline);
      g.fillStyle=alpha('#9b8262',opacity*.65);
      g.font='10px "EB Garamond",Georgia,serif';g.letterSpacing='0px';
      g.fillText(String(j+1).padStart(2,'0'),x,baseline-17);
    });
    g.restore();

    // The gallery's real sampled pixels fold into the filament field.
    if(mode==='enter-collage'&&artwork.length){
      g.save();
      for(const mote of artwork){
        const t=clamp((since-.07-mote.delay*.8)/1.26);
        if(t<=0||t>=1)continue;
        const k=ease(t),strand=geom[mote.id%N];
        const dest=position(strand,.035+.33*hash(mote.id*53+3));
        const turn=Math.sin(Math.PI*k);
        const x=point(mote.x,dest.x,k)+(hash(mote.id*97)-.5)*42*turn;
        const y=point(mote.y,dest.y,k)-23*turn;
        const a=clamp(t/.11)*clamp((1-t)/.27)*(.72+.2*hash(mote.id*9));
        const size=point(mote.size,1.1,k);
        g.globalAlpha=a;g.fillStyle=mote.color;
        g.fillRect(x-size*.5,y-size*.5,size,size);
      }
      g.restore();
    }
    geom.forEach((strand,i)=>{
      const hot=i===hovered||i===pinned;
      const atten=hot?1:((hovered>=0||pinned>=0)?.24:1);
      const twinkle=1+.085*Math.sin(clock*.65+i*1.1);
      const origin=strand.nodes[0];
      if(build<.999&&!artwork.length){
        // Fallback when the gallery did not provide any sampled image pixels.
        const src=sources[i%sources.length]||{x:w*.5,y:h*.52};
        const k=ease(clamp((since-.16)/.9));
        const x=point(src.x,origin.x,k),y=point(src.y,origin.y,k);
        dot(x,y,1.5+2*k,strand.color,opacity*(.45+.4*k),true);
      }
      for(let j=0;j<5;j++){
        const stage=clamp(build*5-j);
        let a=(j===0?.35:j===1?.26:j===2?.20:j===3?.14:.09)*opacity*atten*twinkle;
        if(j>strand.end)a*=.095;
        if(hot)a*=.32; // bright focus is painted only behind the pulse head
        drawLine(strand,j,a,stage);
      }
      if(build>.4){
        const travelling=pulses.some(p=>!p.inspection&&p.id===i&&clock-p.at>=0&&clock-p.at<p.duration);
        const a=opacity*clamp((build-.4)/.5)*(hot?1:.76)*atten*(travelling ? 0.2 : clamp((clock-reborn[i])/.65));
        dot(origin.x,origin.y,hot?4.0:2.35,strand.color,a,true);
      }
      if(hot&&build>.9){
        // Highlight is drawn only as far as this journey has travelled.
        const head=terminal(strand)*ease(clamp((clock-highlightAt)/2.7));
        for(let j=0;j<5;j++){
          const partial=clamp(head*5-j);
          if(partial>0)drawLine(strand,j,.88*opacity,partial);
        }
      }
    });
    // Passing motes: the survivor is brighter; most die at a predetermined gate.
    if(mode==='rest'||mode==='exit-gap'){
      pulses=pulses.filter(p=>clock-p.at<p.duration+.2);
      for(const p of pulses){
        const thread=geom[p.id];if(!thread)continue;
        const time=clamp((clock-p.at)/p.duration);
        const success=thread.end===4;
        const travel=terminal(thread);
        const along=travel*ease(clamp(time/(success?.82:1))),pnt=position(thread,along);
        const fadeAt=success?.82:.76;
        const dissipate=time>fadeAt?1-ease((time-fadeAt)/(1-fadeAt)):1;
        const a=(p.inspection?.97:.82)*dissipate*opacity;
        dot(pnt.x,pnt.y,p.inspection?4.3:2.8,thread.color,a,true);
        if(success&&time>=.82){
          // An earned burst at Create; blocked journeys only dissolve.
          const burst=clamp((time-.82)/.18),peak=1-ease(burst),origin=position(thread,travel);
          dot(origin.x,origin.y,6+14*ease(burst),'#ffdfa1',opacity*peak*.58,true);
          g.strokeStyle=alpha('#ffdfa1',opacity*peak*.66);
          g.lineWidth=1.1;g.beginPath();g.arc(origin.x,origin.y,4+29*ease(burst),0,Math.PI*2);g.stroke();
          for(let j=0;j<13;j++){
            const angle=(j/13+hash(p.id*71)*.11)*Math.PI*2;
            const rad=(5+32*ease(burst))*(.75+.5*hash(p.id*31+j*53));
            dot(origin.x+Math.cos(angle)*rad,origin.y+Math.sin(angle)*rad,
              .85+hash(j*31+p.id)*.7,thread.color,opacity*peak*.88,false);
          }
        }
        if(time>.77&&!success){
          for(let j=0;j<4;j++){
            const dx=(hash(p.id*13+j*31)-.5)*36*(time-.74)*4;
            const dy=(hash(p.id*41+j*11)-.5)*34*(time-.74)*4;
            dot(pnt.x+dx,pnt.y+dy,1.1,thread.color,a*.31,false);
          }
        }
      }
    }

  };
  const update=()=>{
    raf=0;const t=now(),dt=clamp((t-(last||t))/1000,0,.06);last=t;
    if(mode==='inactive')return;
    clock+=dt;
    if(mode==='rest'&&!motionOff()&&owned()){
      if(clock>=launchAt){
        let id=Math.floor(hash(++pulseId*617+77)*N);
        // Periodic illustrative success, not an empirical conversion funnel.
        if(pulseId%8===0){
          const successes=geom.filter(s=>s.end===4);
          if(successes.length)id=successes[Math.floor(hash(pulseId*37)*successes.length)].id;
        }
        pulses.push({id,at:clock,duration:2.2+hash(pulseId*77)*1.6,inspection:false});
        launchAt=clock+.37+hash(pulseId*37)*.45;

      }
      for(const p of pulses){
        if(p.inspection||p.replaced||clock-p.at<p.duration||p.id===hovered||p.id===pinned)continue;
        p.replaced=true;
        assignments[p.id]=(assignments[p.id]+17)%catalogue.length;
        reborn[p.id]=clock;
        hits.children[p.id]?.setAttribute('aria-label',`Inspect ${activeItem(p.id).name}`);
        geom[p.id].color=colors[activeItem(p.id).type]||'#d3b180';
      }
    }
    if(mode==='enter-collage'&&latest()>2.35)mode='rest';
    if(mode==='enter-gap'&&latest()>1.25)mode='rest';
    if(mode==='exit-gap'&&latest()>1.3)mode='inactive';
    if(mode==='exit-collage'&&latest()>1.35)mode='inactive';
    draw();
    if(mode!=='inactive'&&!document.hidden&&!document.getElementById('overview')?.classList.contains('on'))raf=requestAnimationFrame(update);
  };
  const wake=()=>{
    if(raf)return;
    last=now();raf=requestAnimationFrame(update);
  };
  const begin=(m,ctx)=>{
    visit=ctx;mode=motionOff()||ctx?.rest||ctx?.direct?'rest':m;
    artwork=m==='enter-collage'&&Array.isArray(root.filamentArtwork)?root.filamentArtwork:[];
    start=now();last=start;clock=0;pulseId=0;pulses=[];launchAt=.4;
    hovered=-1;pinned=-1;note.classList.remove('is-on');
    layout();
    if(m==='enter-collage'&&originalSnapshot){
      const snap=originalSnapshot();
      sources=(snap.named||[]).concat(snap.dust||[]).map(p=>{
        const rect=canvasArea();return{x:p.x-rect.left,y:p.y-rect.top};
      });
    }else sources=[];
    if(mode==='rest'&&originalCanvas)originalCanvas.style.opacity='0';
    draw();wake();
  };
  const leave=(ctx)=>{
    if(mode==='inactive')return;
    if(raf)cancelAnimationFrame(raf);raf=0;
    mode=ctx?.to===0?'exit-collage':ctx?.to===2?'exit-gap':'inactive';
    artwork=[];start=now();pulses=[];hovered=pinned=-1;note.classList.remove('is-on');
    if(mode==='inactive'&&originalCanvas)originalCanvas.style.opacity='1';
    draw();wake();
  };
  const restore=ctx=>{
    if(ctx?.to===1){begin('rest',ctx);} else{
      artwork=[];
      if(raf)cancelAnimationFrame(raf);raf=0;mode='inactive';
      if(originalCanvas)originalCanvas.style.opacity='1';
      note.classList.remove('is-on');
    }
  };
  const snapshot=()=>{
    if(!w||!h)layout();
    const rect=canvasArea();
    const named=geom.map((s,i)=>{
      const k=i%3===0?.18:i%3===1?.02:.4;
      const p=position(s,k);
      return{x:p.x+rect.left,y:p.y+rect.top,p:1+hash(i*11)*2,r:i%3===1?4:2.5,color:s.color};
    });
    const dust=Array.from({length:260},(_,i)=>{
      const s=geom[i%N],t=hash(i*137+10),p=position(s,t);
      return{x:p.x+rect.left+(hash(i*47)-.5)*8,y:p.y+rect.top+(hash(i*49)-.5)*8,color:s.color};
    });
    return{named,dust};
  };
  // Preserve the original scene's material-into-chart public contract.
  root.snapshot = snapshot; // Late handoffs still inherit the filament geometry.
  const observer=new ResizeObserver(()=>{layout();if(mode!=='inactive')wake();});
  observer.observe(root);
  addEventListener('deck-motion',()=>{if(owned())begin('rest',visit);});
  addEventListener('deck-overview',()=>{if(document.getElementById('overview')?.classList.contains('on')){
    if(raf)cancelAnimationFrame(raf);raf=0;
  }else if(owned()&&mode!=='inactive')wake();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;}else if(mode!=='inactive')wake();});
  window.FilamentField={enter:begin,exit:leave,restore,snapshot,ready:()=>mode!=='inactive'};
  layout();
  if (slide.classList.contains('on')) begin('rest', window.deckNav || { rest:true, direct:true });
})();
