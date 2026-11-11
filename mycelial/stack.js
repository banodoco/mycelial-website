// Version F, slide 6: where it goes. Slide 5's product taken apart into one exploded stack of thin
// floating planes on the right, the text top left, top to bottom: rendering, editing, effects, the agent's
// tools, and the models and runtime at the foundation, rooted by gold mycelium into the network.
// On an upright phone the stack stands under the text, its mirror: flags on the left.
// Each layer has a named flag sticking out to the right on a fine gold leader. Hovering, focusing or
// tapping a flag (or its plane) unfolds it into a small card: what can be customised there, in a line,
// and a few real examples. A guide, a mote of light in the deck's own language, tours the layers on its
// own: it rides the planes' outer edges from flag to flag, and each layer's card opens as it arrives and closes
// as it leaves, so all five are seen without a touch. Hover takes over; leaving hands back to the tour
// after a short pause. The layer being explained lifts a little and its rim glows.
// From slide 5 the product itself becomes the stack: the top planes begin as exact copies of slide 5's
// preview, timeline and chat, the chat folding under into the agent's plane; the planes part, effects and
// runtime come up into place, then the threads, flags and roots draw in. Any other arrival builds from the
// foundation up.
(() => {
  const root = document.querySelector('[data-astrid-stack]');
  if (!root) return;
  const slide = root.closest('.slide');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionOff = () => still || window.deckStill?.();
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, q) => a + (b - a) * q;
  const ease = (k) => 1 - Math.pow(1 - k, 3);
  const easeIO = (q) => (q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2);
  const seep = (k) => 0.5 - 0.5 * Math.cos(Math.PI * k);
  let paused = false, pendingCtx = null, pausedVideos = [];
  const motionBlocked = () => document.hidden || document.getElementById('overview')?.classList.contains('on') || motionOff();
  const now = () => window.deckNow();
  const current = (ctx) => !!ctx && ctx.isCurrent();
  // Canvases are decoration/snapshot aids. A browser refusing one must not
  // prevent the HTML stack and its controls from being created or registered.
  const context2D = (canvas) => { try { return canvas.getContext('2d'); } catch { return null; } };
  const RAD = Math.PI / 180;

  // ---- The scene -----------------------------------------------------------------------------
  // Laid out in scene px (the concept's own frame) and fitted to the screen beside the text. Every plane
  // lies at the same tilt, turned a little about its normal, under one perspective whose origin sits to
  // the right; the planes are stacked down the scene with the same clear air between each pair.
  // On an upright phone the flags run down the stack's left side instead, so there it is the mirror: its
  // perspective seen from the left and every plane turned a little the other way (layout() sets the side).
  const PERSP = 2600, PO = { x: 1900, y: 420 };
  const TILT = 58, GAP = 34, ROOTS = 100, HEADROOM = 18;
  let TURN = 4.5;
  const PL = [ // top to bottom; centre x and flat size in scene px (centre y is stacked in layout); kind: what the plane shows
    { id: 'render', kind: 'preview', cx: 1062, cy: 150, w: 780, h: 340 },
    { id: 'timeline', kind: 'timeline', cx: 1058, cy: 0, w: 780, h: 250 },
    { id: 'effects', kind: 'tools', cx: 1054, cy: 0, w: 780, h: 240 },
    { id: 'agent', kind: 'agent', cx: 1052, cy: 0, w: 780, h: 340 },
    { id: 'models', kind: 'models', cx: 1048, cy: 0, w: 780, h: 230 },
  ];
  // What each layer is for, in a line, and a few real examples (projects named as they name themselves).
  const TAGS = [
    { name: 'Rendering', short: 'Rendering', line: 'What turns the timeline into frames. Swap it and the same edit becomes a new kind of film.',
      ex: [['Remotion', 'video as React code'], ['Three.js', 'live 3D scenes'], ['HyperFrames by HeyGen', 'HTML to video'], ['HTML, CSS &amp; canvas', 'the web’s own tools']],
      foot: 'or plug in a renderer of your own' },
    { name: 'Editing', short: 'Editing', line: 'Ways to shape the cut itself: find the moment, trim it, time it to the music.',
      ex: [['Transcript view', 'edit by editing the words'], ['Beat markers', 'cuts that land on the beat'], ['Shot lists &amp; storyboards', 'plan, then fill in'], ['Captions', 'timed, styled text']],
      foot: 'or build an editing tool of your own' },
    { name: 'Effects', short: 'Effects', line: 'Looks and graphics over the footage, made and shared by the community.',
      ex: [['<code>type-on</code> · <code>text-card</code>', 'self-writing titles'], ['<code>audio-reactive-colour</code>', 'colour on the beat'], ['Shader looks &amp; film grain', 'texture for a whole film'], ['Motion graphics', 'animated type and shapes']],
      foot: 'community-made, or make your own' },
    { name: 'Agent tools', short: 'Agents', line: 'What the agent reaches for when you ask. Each new tool widens what it can do.',
      ex: [['<code>qwen_image</code> → <code>animated_video</code>', 'stills, then motion'], ['Editing tools', 'trim, retime, rearrange'], ['Timeline visualisers', 'show what it finds'], ['Effect tools', 'apply a look, then tune it']],
      foot: 'give the agent new tools' },
    { name: 'Models / runtime', short: 'Models', line: 'Where the work runs: open models, on your own GPU or in the cloud.',
      ex: [['ComfyUI workflows', 'graphs the community shares'], ['Wan2GP', 'video models on modest GPUs'], ['Diffusers', 'Hugging Face’s model library'], ['ai-toolkit', 'train a LoRA on your style']],
      more: 'Wan · LTX-Video · Qwen Image · local GPU or cloud', foot: '…and many more' },
  ];

  const svg = (w, body, o = '') => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"${o}>${body}</svg>`;
  const I = {
    back: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z"/></svg>',
    fx: svg(16, '<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/>'),
    film: svg(16, '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>'),
    check: svg(16, '<path d="M5 12.4 9.6 17 19 7.5"/>', ' stroke-width="2.2"'),
    send: svg(17, '<path d="M12 19V5M5 12l7-7 7 7"/>', ' stroke-width="2.4"'),
    beat: svg(44, '<path d="M2 13c2.2 0 2.6-6 4.6-6s2.2 10 4.4 10 2.4-12 4.6-12 2.2 8 4.4 8H22"/>', ' stroke-width="1.3"'),
    grain: '<svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor"><circle cx="12" cy="4.5" r="1.1"/><circle cx="6" cy="8" r=".9"/><circle cx="17.5" cy="8.5" r="1.2"/><circle cx="11" cy="11" r=".8"/><circle cx="4.5" cy="14" r="1.1"/><circle cx="15" cy="13.5" r=".9"/><circle cx="20" cy="15" r=".8"/><circle cx="9" cy="17" r="1.2"/><circle cx="13.5" cy="19.5" r=".9"/></svg>',
    typeon: svg(40, '<path d="M4 6h11M9.5 6v13M18.5 7.5v11"/>', ' stroke-width="1.4"'),
    card: svg(40, '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M7 10.5h10M7 14h6"/>', ' stroke-width="1.3"'),
    cube: svg(30, '<path d="M12 2.8 20 7.2v9.6L12 21.2 4 16.8V7.2z"/><path d="M4 7.2l8 4.4 8-4.4M12 11.6v9.6"/>', ' stroke-width="1.3"'),
    cloud: svg(30, '<path d="M7.5 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.4 4.3 4.3 0 0 0 7.5 18z"/>', ' stroke-width="1.3"'),
  };
  const SPAN = 14;
  const span = (at, len) => `left:calc(${(at / SPAN) * 100}% + 1px);width:calc(${(len / SPAN) * 100}% - 2px)`;
  const FRAMES = [['start', 0], ['mountains', 6.5], ['descent', 10], ['town', 13]];
  const media = '../assets/astrid/lantern-valley';
  const CONTENT = {
    preview: `<div class="st-screen"><div class="st-pic"><img class="st-poster" data-src="${media}/final-poster.webp" alt=""><video data-src="${media}/final.mp4" data-type='video/mp4; codecs="avc1.64001e"' data-fallback="${media}/final-vp9.webm" data-poster="${media}/final-poster.webp" muted loop playsinline preload="none"></video><span></span></div></div>
      <div class="st-transport"><b class="st-btn">${I.back}</b><b class="st-btn is-play">${I.pause}</b><span class="st-time">0:00 / 0:14</span><span class="st-pill">1280×720 · 30 fps</span></div>`,
    timeline: `<div class="st-th"></div><div class="st-ruler">${[0, 2, 4, 6, 8, 10, 12, 14].map((t) => `<span style="left:${(t / SPAN) * 100}%">0:${String(t).padStart(2, '0')}</span>`).join('')}</div>
      <div class="st-th">${I.film}<span>V3</span><em>Video</em></div><div class="st-lane"><span class="st-clip" style="${span(0, SPAN)}" data-bg="${media}/final-poster.webp"><img data-src="${media}/final-poster.webp" alt=""><b>MiniMax H3</b><i>14 s</i></span><i class="st-head"></i></div>
      <div class="st-th">${I.film}<span>V2</span><em>Frames</em></div><div class="st-lane">${FRAMES.map(([name, at]) => `<span class="st-clip" style="${span(at, 1)}"><img data-src="${media}/${name}-thumb.webp" alt=""><i>Qwen</i></span>`).join('')}</div>
      <div class="st-th">${I.film}<span>V1</span><em>Scene</em></div><div class="st-lane"><span class="st-clip" style="${span(0, SPAN)}" data-bg="${media}/guide-strip.webp"><b>Lantern Valley · Three.js</b><i>14 s</i></span></div>`,
    agent: `<header class="st-chat-head"><span class="st-avatar"><img data-src="../assets/astrid/mink-profile.png" alt=""></span>Astrid</header>
      <div class="st-rows">${(window.astridDemoBeats || []).map((b) => `<div class="st-msg">${b.ask}</div><div class="st-reply">${b.reply}</div><div class="st-step">${I.check}<span>${b.step[0]}</span><code><b>${b.step[1]}</b> ${b.step[2]}</code></div>`).join('')}</div>
      <div class="st-composer"><span class="st-field">Ask Astrid to edit your project…<b>${I.send}</b></span></div>`,
    tools: `<span class="st-tile">${I.typeon}type-on</span><span class="st-tile">${I.card}text-card</span><span class="st-tile">${I.beat}<span>audio-reactive-<br>colour</span></span><span class="st-tile">${I.grain}film grain</span><span class="st-tag">community-made</span>`,
    models: `<span class="st-comfy">ComfyUI workflows</span><span class="st-mod">${I.cube}Wan</span><i class="st-link"></i><span class="st-mod">${I.cube}LTX-Video</span><i class="st-link"></i><span class="st-mod">${I.cube}Qwen Image</span><span class="st-gpu">${I.cloud}local GPU or cloud</span>`,
  };

  // In Chromium the world is laid out at its size on screen (CSS zoom) rather than at the scene's size and scaled down:
  // a plane under the perspective is rasterized at its laid-out size, so scale(k) had each rasterized at up to 1/k its
  // pixels on screen. Every length in the world scales by k, its perspective included, so the picture is the same.
  // WebKit lays a zoomed world out differently on a phone (its smallest type is held up, and the planes shift), so
  // there, and in other engines, the world is still scaled.
  const ZOOM = /\bChrome\//.test(navigator.userAgent);
  const world = document.createElement('div');
  world.className = 'st-world';
  world.style.perspective = `${PERSP}px`;
  world.style.perspectiveOrigin = `${PO.x}px ${PO.y}px`;
  const planes = PL.map((p, i) => {
    p.i = i;
    const el = document.createElement('div');
    el.className = 'st-plane';
    const inner = document.createElement('div'); // the content at its settled size, scaled as one unit to fit the plane
    inner.className = `st-in st-${p.kind}`;
    inner.style.width = `${p.w - 2}px`; inner.style.height = `${p.h - 2}px`;
    inner.innerHTML = CONTENT[p.kind];
    window.deckLoadPictures?.(inner, slide); // a no-op until the slide is the current or the next one
    el.appendChild(inner);
    return el;
  });
  const inners = planes.map((el) => el.firstChild);
  // Ghosts: arriving from slide 5, the rendering, timeline and agent planes first carry exact copies of its panels.
  const SRC = { 0: '.as-player', 1: '.as-timeline', 3: '.as-chat' };
  const ghosts = PL.map((_, i) => { if (!SRC[i]) return null; const el = document.createElement('div'); el.className = 'st-ghost'; return el; });
  [...planes].reverse().forEach((el) => world.appendChild(el)); // snapshot ghosts attach only during their handoff
  // The player's picture rides between slide 5 and the top plane on a layer of its own, the plane's box under the
  // plane's own turn: slide 5's exact frame, eased from its place in slide 5's player to the plane's picture box as
  // the plane morphs, then dissolving where it stands into the plane's own film (and the other way back).
  const carry = document.createElement('div');
  carry.className = 'st-carry';
  const carryPic = document.createElement('div');
  carryPic.className = 'st-carry-pic';
  const carryCv = document.createElement('canvas'), carryG = context2D(carryCv);
  carryPic.append(carryCv, planes[0].querySelector('.st-pic span').cloneNode(true)); // the film's caption, for the way back
  carry.appendChild(carryPic);
  // on: carrying; A: the picture's rect in slide 5's player (px, as its copy is laid out); P: the plane's picture box
  // in the plane's own content (its px); a: the layer's opacity; back: the plane's frame, on its way back to slide 5.
  const cy = { on: false, A: null, nw: 0, nh: 0, P: null, a: 1, back: false };
  const cv = document.createElement('canvas');
  cv.className = 'st-threads';
  const g = context2D(cv);
  // A cropped cache contains only the completed roots/registration artwork.
  // The moving guide and leaders remain live; no extra full-screen canvas.
  const baseCv = document.createElement('canvas'), baseG = context2D(baseCv);
  let threadBox = { x: 0, y: 0, w: 1, h: 1 }, baseReady = false, baseFailed = false, drawFaults = 0;
  const metrics = { frames: 0, baseDraws: 0, cacheHits: 0, frameRecoveries: 0 };
  const reportFault = (phase, error, ctx = activeCtx) => window.deckReportSceneFault?.('stack', phase, error, ctx);
  // The flags (buttons, so keyboard users can reach them) and the cards they unfold into.
  const flags = TAGS.map((t, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'st-flag'; b.tabIndex = -1;
    b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', `st-card-${i}`);
    b.innerHTML = `<i></i><span class="st-long">${t.name}</span><span class="st-short">${t.short}</span>`;
    return b;
  });
  const cards = TAGS.map((t, i) => {
    const c = document.createElement('div');
    c.className = 'st-card'; c.id = `st-card-${i}`; c.setAttribute('role', 'note');
    c.innerHTML = `<b class="st-ch">${t.name}</b><p>${t.line}</p><ul>${t.ex.map(([n, d]) => `<li><b>${n}</b> <span>${d}</span></li>`).join('')}</ul>${t.more ? `<div class="st-more">${t.more}</div>` : ''}<em>${t.foot}</em>`;
    return c;
  });
  // An unseen hit area over the whole picture (flags column, planes, roots): a stray click between the planes
  // would otherwise turn the deck.
  const hit = document.createElement('div');
  hit.className = 'st-hit';
  root.append(hit, world, cv, ...flags, ...cards);
  const video = planes[0].querySelector('video');
  const timeEl = planes[0].querySelector('.st-time');
  const head = planes[1].querySelector('.st-head');

  // ---- Plane state and the projection ----------------------------------------------------------
  const settledOf = (p) => ({ x: p.cx, y: p.cy, w: p.w, h: p.h, rx: TILT, rz: TURN, o: 1, c: 1, g: 0 });
  const st = PL.map(settledOf);
  const shown = PL.map(() => ({}));
  const box = (el, s) => {
    el.style.width = `${s.w.toFixed(1)}px`; el.style.height = `${s.h.toFixed(1)}px`;
    el.style.left = `${(s.x - s.w / 2).toFixed(1)}px`; el.style.top = `${(s.y - s.h / 2).toFixed(1)}px`;
  };
  // Fit content of natural size (nw, nh) inside a (w, h) box without changing its shape: scale as one unit, centred.
  const fit = (el, w, h, nw, nh) => {
    const k = Math.min(w / nw, h / nh);
    el.style.transform = `translate(${((w - k * nw) / 2).toFixed(2)}px, ${((h - k * nh) / 2).toFixed(2)}px) scale(${k.toFixed(5)})`;
  };
  const stretch = (el, w, h, nw, nh) => {
    el.style.transform = `scale(${(w / nw).toFixed(5)}, ${(h / nh).toFixed(5)})`;
  };
  const applyPlanes = () => st.forEach((s, i) => {
    const el = planes[i], was = shown[i], p = PL[i], gh = ghosts[i];
    const moved = was.x !== s.x || was.y !== s.y || was.w !== s.w || was.h !== s.h;
    const resized = was.w !== s.w || was.h !== s.h;
    const turned = was.rx !== s.rx || was.rz !== s.rz;
    // At rest the six-pixel tour lift is a translation, not five re-layouts.
    const ambient = !!amb && !build?.back && !gh?.firstChild;
    if (ambient) {
      if (!was.ambient || resized || was.x !== s.x) box(el, { ...s, y: p.cy });
      const lift = `0 ${(s.y - p.cy).toFixed(3)}px`;
      if (el.style.translate !== lift) el.style.translate = lift;
    } else if (moved || was.ambient) {
      el.style.translate = '';
      box(el, s);
    }
    const stretchChat = i === 3 && !!gh?.firstChild;
    if (resized || was.stretchChat !== stretchChat) {
      if (stretchChat) stretch(inners[i], s.w - 2, s.h - 2, p.w - 2, p.h - 2);
      else fit(inners[i], s.w - 2, s.h - 2, p.w - 2, p.h - 2);
    }
    if (turned) el.style.transform = `rotateX(${s.rx.toFixed(2)}deg) rotateZ(${s.rz.toFixed(2)}deg)`;
    if (was.o !== s.o) el.style.opacity = s.o.toFixed(3);
    if (was.c !== s.c) inners[i].style.opacity = s.c.toFixed(3);
    if (gh && (was.g !== s.g || (s.g > 0 && (moved || turned)))) {
      gh.style.display = s.g > 0 && gh.firstChild ? 'block' : 'none';
      if (s.g > 0 && gh.firstChild) {
        box(gh, s); gh.style.transform = el.style.transform; gh.style.opacity = s.g.toFixed(3);
        if (i === 3) stretch(gh.firstChild, s.w, s.h, gh.dataset.w, gh.dataset.h);
        else fit(gh.firstChild, s.w, s.h, gh.dataset.w, gh.dataset.h);
        const scroll = ghostScrolls[i];
        if (scroll && !scroll.ready) { scroll.sync(); scroll.ready = true; }
      }
    }
    Object.assign(was, s, { ambient, stretchChat });
  });
  const apply = () => { applyPlanes(); placeCarry(); };
  const placeCarry = () => {
    if (!cy.on) return;
    const s = st[0], p = PL[0], q = s.pq ?? 1;
    const kg = Math.min(s.w / cy.nw, s.h / cy.nh), ki = Math.min((s.w - 2) / (p.w - 2), (s.h - 2) / (p.h - 2));
    const A = { x: (s.w - kg * cy.nw) / 2 + kg * cy.A.x, y: (s.h - kg * cy.nh) / 2 + kg * cy.A.y, w: kg * cy.A.w };
    const B = { x: 1 + (s.w - 2 - ki * (p.w - 2)) / 2 + ki * cy.P.x, y: 1 + (s.h - 2 - ki * (p.h - 2)) / 2 + ki * cy.P.y, w: ki * cy.P.w };
    box(carry, s); carry.style.transform = planes[0].style.transform; carry.style.opacity = cy.a.toFixed(3);
    carryPic.style.transform = `translate(${lerp(A.x, B.x, q).toFixed(2)}px, ${lerp(A.y, B.y, q).toFixed(2)}px) scale(${(lerp(A.w, B.w, q) / cy.P.w).toFixed(5)})`;
  };
  const view = { k: 1, ox: 0, oy: 0, mobile: false, right: true, low: false };
  // A point (u, v) from a plane's centre, in its own px, into the scene: exactly what CSS does with
  // rotateX(rx) rotateZ(rz) about the centre under the scene's perspective. project() goes on to the screen.
  const projW = (s, u, v) => {
    const a = s.rz * RAD, b = s.rx * RAD;
    const x1 = u * Math.cos(a) - v * Math.sin(a), y1 = u * Math.sin(a) + v * Math.cos(a);
    const X = s.x + x1, Y = s.y + y1 * Math.cos(b), Z = y1 * Math.sin(b);
    const f = PERSP / (PERSP - Z);
    return { x: PO.x + (X - PO.x) * f, y: PO.y + (Y - PO.y) * f };
  };
  const toS = (p) => ({ x: view.ox + view.k * p.x, y: view.oy + view.k * p.y });
  const toWorld = (r) => ({ x: (r.left + r.width / 2 - view.ox) / view.k, y: (r.top + r.height / 2 - view.oy) / view.k, w: r.width / view.k, h: r.height / view.k });
  // Each plane's far edge sits GAP below the near edge of the one above it.
  const stackUp = () => {
    let near = 0;
    PL.forEach((p, i) => {
      if (i) for (let n = 0; n < 4; n++) p.cy += near + GAP - projW(settledOf(p), 0, -p.h / 2).y;
      near = projW(settledOf(p), 0, p.h / 2).y;
    });
  };

  // ---- Layout ------------------------------------------------------------------------------------
  let dpr = 1, geo = null;
  const CARDW = 300, CARDW_L = 240, FLAG_PITCH = 40;
  let flagY = [];
  // A polyline with its running lengths, and a point a fraction q of the way along it.
  const polyline = (pts) => { const len = [0]; for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, len, total: len.at(-1) }; };
  const along = (w, q) => {
    const d = clamp(q) * w.total; let i = 1;
    while (i < w.pts.length - 1 && w.len[i] < d) i++;
    const a = w.pts[i - 1], b = w.pts[i], f = (d - w.len[i - 1]) / ((w.len[i] - w.len[i - 1]) || 1);
    return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
  };
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const layout = () => {
    const W = innerWidth, H = innerHeight;
    view.mobile = (W <= 760 && (H >= W || H > 500)) || (W <= 1100 && (H > W || H >= 650)); // phones, portrait tablets and compact landscape windows with room for the stack
    // Which side the flags hang on: the right of the stack beside the text, or its left under the text on a phone.
    const right = view.right = !view.mobile, out = right ? 1 : -1;
    PO.x = right ? 1900 : 210; TURN = right ? 4.5 : -4.5;
    world.style.perspectiveOrigin = `${PO.x}px ${PO.y}px`;
    stackUp();
    // The whole picture's extent in scene px: labels, planes and roots.
    const S = PL.map(settledOf);
    const cw = S.map((s) => ({
      nl: projW(s, -s.w / 2 + 3, s.h / 2 - 3), nr: projW(s, s.w / 2 - 3, s.h / 2 - 3), fr: projW(s, s.w / 2 - 3, -s.h / 2 + 3), fl: projW(s, -s.w / 2 + 3, -s.h / 2 + 3),
      lm: projW(s, -s.w / 2, 0), rm: projW(s, s.w / 2, 0),
    }));
    const callXw = right ? Math.max(...cw.map((c) => c.rm.x)) + 40 : Math.min(...cw.map((c) => c.lm.x)) - 40; // the flags' column
    const h1 = slide.querySelector('h1').getBoundingClientRect();
    // On a desktop the cards open in a column beside the flags, right of the stack (the text top left); on a
    // phone, in a slot below the stack and above the footer. On a phone on its side the column is narrower and a card
    // opens over the flags, which keep their places.
    const low = view.low = !view.mobile && H <= 500;
    const cw0 = view.mobile ? W - 32 : low ? CARDW_L : CARDW;
    cards.forEach((c) => { c.style.width = `${cw0}px`; });
    const ch = cards.map((c) => c.offsetHeight);
    const slotH = view.mobile ? Math.max(...ch) : 0;
    const naturalSlotT = view.mobile ? H - 70 - slotH : h1.bottom + 12;
    const slotT = view.mobile ? Math.max(naturalSlotT, h1.bottom + 144) : naturalSlotT;
    const compact = view.mobile && slotT > naturalSlotT;
    // Short browser viewports scroll the existing composition rather than
    // producing a negative scale. Normal phone/desktop geometry is unchanged.
    slide.style.overflowY = compact ? 'auto' : '';
    root.style.height = compact ? `${Math.ceil(slotT + slotH + 80)}px` : '';
    root.style.setProperty('--st-card-top', `${slotT.toFixed(1)}px`);
    root.style.setProperty('--st-card-height', `${slotH.toFixed(1)}px`);
    const Rg = view.mobile ? { l: 16, r: W - 16, t: h1.bottom + 12, b: slotT - 12 }
      : low ? { l: h1.right + 20, r: W - 12 - CARDW_L + 6, t: 14, b: H - 76 } : { l: h1.right + 28, r: W - 48 - CARDW + 6, t: 22, b: H - 66 };
    const box = { l: right ? Math.min(...cw.map((c) => Math.min(c.fl.x, c.nl.x))) - 12 : callXw, r: right ? callXw : Math.max(...cw.map((c) => Math.max(c.fr.x, c.nr.x))) + 12,
      t: Math.min(...cw.map((c) => Math.min(c.fl.y, c.fr.y))) - HEADROOM, b: Math.max(cw[4].nl.y, cw[4].nr.y) + ROOTS };
    // The flags stay readable in screen pixels: include their measured width once in the mobile fit,
    // then centre flags, leaders and planes together rather than pinning labels to the viewport edge.
    const mobileFlagW = view.mobile ? Math.max(...flags.map((f) => f.offsetWidth)) : 0;
    const k = Math.max(0.01, Math.min((Rg.r - Rg.l - mobileFlagW) / (box.r - box.l), (Rg.b - Rg.t) / (box.b - box.t)));
    view.k = k;
    view.ox = (Rg.l + Rg.r + mobileFlagW) / 2 - ((box.l + box.r) / 2) * k;
    view.oy = (Rg.t + Rg.b) / 2 - ((box.t + box.b) / 2) * k;
    if (ZOOM) {
      const kz = +k.toFixed(4);
      world.style.zoom = String(kz);
      world.style.transform = `translate(${(+view.ox.toFixed(1) / kz).toFixed(4)}px, ${(+view.oy.toFixed(1) / kz).toFixed(4)}px)`;
    } else world.style.transform = `translate(${view.ox.toFixed(1)}px, ${view.oy.toFixed(1)}px) scale(${k.toFixed(4)})`;
    dpr = Math.min(2, Math.round(devicePixelRatio || 1) || 1);
    // Settled geometry, in screen px: the corners the threads tie together, the flags' places, the roots.
    const corners = cw.map((c) => Object.fromEntries(Object.entries(c).map(([key, p]) => [key, toS(p)])));
    const callX = toS({ x: callXw, y: 0 }).x;
    flags.forEach((el) => { el.style.left = `${callX.toFixed(1)}px`; });
    cards.forEach((c) => {
      if (view.mobile) { c.style.left = '16px'; c.style.top = `${slotT.toFixed(1)}px`; return; }
      c.style.left = `${(right ? Math.min(W - 8 - cw0, callX - 4) : Math.max(8, callX + 4 - cw0)).toFixed(1)}px`;
    });
    // The guide's ways between the flags: back along a leader, down the plane's outer edge, across to the
    // next plane, along its edge and out to its flag; from the foundation it climbs the far outer thread home.
    const E = right ? { m: 'rm', n: 'nr', f: 'fr' } : { m: 'lm', n: 'nl', f: 'fl' }; // the flags' side: mid, near and far corners
    const A = corners.map((c) => [callX - 3 * out, c[E.m].y]), Ed = corners.map((c) => [c[E.m].x + 8 * k * out, c[E.m].y]);
    const xy = (p) => [p.x, p.y];
    const ways = corners.map((c, i) => polyline(i < corners.length - 1
      ? [A[i], Ed[i], xy(c[E.n]), xy(corners[i + 1][E.f]), Ed[i + 1], A[i + 1]]
      : [A[i], Ed[i], xy(c[E.f]), ...corners.slice(0, i).reverse().map((d) => xy(d[E.f])), Ed[0], A[0]]));
    // Roots: fine threads that wander down from under the foundation, branching now and then.
    const R = rng(7), roots = [], base = corners[4];
    const grow = (x, y, ang, len, depth, delay) => {
      const pts = [[x, y]];
      let a = ang;
      for (let d = 0; d < len; d += 5 * k) {
        a += (R() - 0.5) * 0.45 + (Math.PI / 2 - a) * 0.04;
        x += Math.cos(a) * 5 * k; y += Math.sin(a) * 5 * k;
        pts.push([x, y]);
      }
      roots.push({ pts, depth, delay, w: depth ? 0.6 : 0.9, a: depth ? 0.4 : 0.6, dots: pts.filter((_, n) => n > 3 && R() < 0.06) });
      if (depth < 2) for (let b = 0; b < 2; b++) if (R() < 0.7) {
        const at = Math.floor(pts.length * (0.3 + R() * 0.5)), [bx, by] = pts[at];
        grow(bx, by, a + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.6), len * (0.35 + R() * 0.3), depth + 1, delay + (at / pts.length) * 0.5);
      }
    };
    for (let j = 0; j < 15; j++) {
      const q = (j + 0.5) / 15, x = lerp(base.nl.x, base.nr.x, q) + (R() - 0.5) * 20 * k, y = lerp(base.nl.y, base.nr.y, q) - 4 * k;
      grow(x, y, Math.PI / 2 + (q - 0.5) * 1.5 + (R() - 0.5) * 0.5, (40 + R() * 62) * k, 0, R() * 0.35);
    }
    geo = { corners, callX, roots, ways, anchors: A, base: corners.map((c) => c[E.m].y), ch, H, E, out };
    const pts = corners.flatMap((c) => [c.nl, c.nr, c.fl, c.fr]), flagW = Math.max(...flags.map((f) => f.offsetWidth));
    const hx0 = right ? Math.min(...pts.map((p) => p.x)) - 12 : callX - flagW - 10, hx1 = right ? callX + flagW + 10 : Math.max(...pts.map((p) => p.x)) + 12;
    const hy0 = Math.min(...pts.map((p) => p.y)) - 12, hy1 = Math.max(...pts.map((p) => p.y)) + ROOTS * k;
    Object.assign(hit.style, { left: `${hx0.toFixed(0)}px`, top: `${hy0.toFixed(0)}px`, width: `${(hx1 - hx0).toFixed(0)}px`, height: `${(hy1 - hy0).toFixed(0)}px` });
    // An open card opens where its flag was; the flags above and below it slide apart to make room (an accordion),
    // so every flag stays in reach. Near the foot of the screen the card rides up instead of pushing a flag off.
    geo.place = cards.map((_, j) => {
      const B = geo.base, T = B.slice(), lo = H - 58;
      if (low) return { top: Math.max(12, clamp(B[j] - ch[j] / 2, 12, H - 76 - ch[j])), flags: T }; // never above the top
      let top = clamp(B[j] - 22, 14, H - 72 - ch[j]);
      for (let pass = 0; pass < 2; pass++) {
        const bot = top + ch[j];
        for (let i = j - 1; i >= 0; i--) T[i] = Math.min(B[i], i === j - 1 ? top - 24 : T[i + 1] - FLAG_PITCH);
        for (let i = j + 1; i < B.length; i++) T[i] = Math.max(B[i], i === j + 1 ? bot + 24 : T[i - 1] + FLAG_PITCH);
        const over = T.at(-1) - lo;
        if (over > 0 && j < B.length - 1) top = Math.max(14, top - over); else break;
      }
      T[j] = B[j];
      return { top, flags: T };
    });
    flagY = (openI >= 0 && !view.mobile ? geo.place[openI].flags : geo.base).slice();
    flags.forEach((el, i) => { el.style.top = `${flagY[i].toFixed(1)}px`; });
    if (openI >= 0 && !view.mobile) cards[openI].style.top = `${geo.place[openI].top.toFixed(1)}px`;
    // Include every possible accordion position and glow, not just the open card.
    const art = [...roots.flatMap(r => r.pts), ...pts.map(p => [p.x, p.y]),
      ...geo.place.flatMap(p => p.flags.map(y => [callX, y])), ...geo.base.map(y => [callX, y])];
    const pad = 24, x = Math.floor(Math.min(...art.map(p => p[0])) - pad), y = Math.floor(Math.min(...art.map(p => p[1])) - pad);
    const w = Math.ceil(Math.max(...art.map(p => p[0])) + pad - x), h = Math.ceil(Math.max(...art.map(p => p[1])) + pad - y);
    threadBox = { x, y, w, h };
    Object.assign(cv.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    const pixelW = Math.max(1, Math.ceil(w * dpr)), pixelH = Math.max(1, Math.ceil(h * dpr));
    if (cv.width !== pixelW) cv.width = pixelW;
    if (cv.height !== pixelH) cv.height = pixelH;
    baseReady = false; baseFailed = false; drawFaults = 0;
  };

  // ---- Drawing the threads -----------------------------------------------------------------------
  // sh: how far the registration threads have drawn (top down); lb: the labels' leaders, per plane;
  // rt: the roots' growth.
  const vis = { sh: 1, lb: PL.map(() => 1), rt: 1 };
  // Flags are DOM controls: their reveal must not depend on a canvas draw succeeding.
  const syncFlagVisibility = () => vis.lb.forEach((q, i) => {
    const value = (q * q).toFixed(3);
    if (flags[i].style.getPropertyValue('--in') !== value) flags[i].style.setProperty('--in', value);
  });
  const GOLD = (a) => `rgba(240,200,119,${a.toFixed(3)})`;
  // Each bead's glow is stamped from one sprite (the same radial light, .55 at its heart to nothing at 4r, faded by its
  // alpha), not built as a new gradient for every bead in every frame.
  const glow = document.createElement('canvas');
  glow.width = glow.height = 128;
  {
    const sg = context2D(glow);
    if (sg) {
      const rg = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
      rg.addColorStop(0, 'rgba(255,226,170,0.55)'); rg.addColorStop(1, 'rgba(255,217,145,0)');
      sg.fillStyle = rg; sg.fillRect(0, 0, 128, 128);
    }
  }
  const dot = (g, x, y, r, a) => {
    if (a <= 0.01) return;
    g.globalAlpha = a; g.drawImage(glow, x - r * 4, y - r * 4, r * 8, r * 8); g.globalAlpha = 1;
    g.fillStyle = `rgba(255,236,200,${a.toFixed(3)})`; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  };
  const partial = (g, pts, q) => { // a polyline drawn to fraction q of its points
    if (q <= 0) return;
    const n = (pts.length - 1) * q, m = Math.floor(n);
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i <= m; i++) g.lineTo(pts[i][0], pts[i][1]);
    if (m < pts.length - 1) { const f = n - m, a = pts[m], b = pts[m + 1]; g.lineTo(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f); }
    g.stroke();
  };
  const drawBaseThreads = (g) => {
    metrics.baseDraws++;
    const { corners: C, roots } = geo;
    // Roots under the foundation, and the long threads out to the right.
    if (vis.rt > 0) {
      for (const r of roots) {
        const q = clamp((vis.rt - r.delay) / (1 - r.delay * 0.6));
        if (q <= 0) continue;
        g.lineWidth = r.w; g.strokeStyle = GOLD(r.a * (0.6 + 0.4 * q));
        partial(g, r.pts, ease(q));
        const tip = clamp((q - 0.85) / 0.15);
        if (tip > 0) { const [x, y] = r.pts.at(-1); dot(g, x, y, 1, 0.75 * tip); r.dots.forEach(([dx, dy]) => dot(g, dx, dy, 0.8, 0.5 * tip)); }
      }
    }
    // Registration threads, corner to corner down the stack, drawn from the top: down both near corners and the far
    // one on the flags' side; the other far corner only takes a faint bead.
    if (vis.sh > 0) {
      const RUNS = view.right ? ['nl', 'nr', 'fr'] : ['nr', 'nl', 'fl'], far = RUNS[2], faint = view.right ? 'fl' : 'fr';
      g.lineWidth = 0.8; g.setLineDash([1.6, 3.4]);
      const segs = C.length - 1;
      for (const key of RUNS) {
        g.strokeStyle = GOLD(key === far ? 0.38 : 0.55);
        for (let i = 0; i < segs; i++) {
          const q = clamp(vis.sh * segs - i);
          if (q <= 0) break;
          const a = C[i][key], b = C[i + 1][key];
          g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(lerp(a.x, b.x, q), lerp(a.y, b.y, q)); g.stroke();
        }
      }
      g.setLineDash([]);
      C.forEach((c, i) => { const a = clamp(vis.sh * segs - i + 1); RUNS.forEach((key) => dot(g, c[key].x, c[key].y, 1.9, a * (key === far ? 0.75 : 1))); dot(g, c[faint].x, c[faint].y, 1.4, a * 0.55); });
    }
  };
  const prepareThreadContext = (ctx) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr, 0, 0, dpr, -threadBox.x * dpr, -threadBox.y * dpr);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.setLineDash([]);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  };
  const drawThreads = () => {
    if (!g || !geo) return;
    prepareThreadContext(g);
    if (baseG && !baseFailed && vis.sh === 1 && vis.rt === 1) {
      try {
        if (!baseReady) {
          if (baseCv.width !== cv.width) baseCv.width = cv.width;
          if (baseCv.height !== cv.height) baseCv.height = cv.height;
          prepareThreadContext(baseG); drawBaseThreads(baseG); baseReady = true;
        }
        g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(baseCv, 0, 0);
        g.setTransform(dpr, 0, 0, dpr, -threadBox.x * dpr, -threadBox.y * dpr);
        metrics.cacheHits++;
      } catch (error) {
        baseFailed = true; baseReady = false; reportFault('thread-cache', error);
        prepareThreadContext(g); drawBaseThreads(g); // optional cache, not an availability dependency
      }
    } else { baseReady = false; drawBaseThreads(g); }
    const C = geo.corners, k = view.k;
    // Flag leaders: from each plane's outer edge out to its flag; the layer being explained burns brighter.
    vis.lb.forEach((q, i) => {
      if (q <= 0) return;
      const m = C[i][geo.E.m], x0 = m.x + 8 * k * geo.out, x1 = geo.callX - 3 * geo.out, y1 = flagY[i] ?? m.y, l = lit[i];
      g.lineWidth = 0.8 + 0.5 * l; g.strokeStyle = GOLD((0.5 + 0.4 * l) * q);
      if (Math.abs(y1 - m.y) < 0.5) { g.beginPath(); g.moveTo(x0, m.y); g.lineTo(lerp(x0, x1, ease(q)), m.y); g.stroke(); }
      else { // a gentle S from the plane's edge to where its flag has moved
        const pts = [];
        for (let n = 0; n <= 16; n++) { const u = n / 16, a = 1 - u, cx0 = x0 + (x1 - x0) * 0.55, cx1 = x0 + (x1 - x0) * 0.45;
          pts.push([a * a * a * x0 + 3 * a * a * u * cx0 + 3 * a * u * u * cx1 + u * u * u * x1, a * a * a * m.y + 3 * a * a * u * m.y + 3 * a * u * u * y1 + u * u * u * y1]); }
        partial(g, pts, ease(q));
      }
      dot(g, x0, m.y, 1.5, q * (0.7 + 0.3 * l));
    });
    // The guide: a bead of light with a short tail along its way, breathing while it waits at a flag.
    if (guide.a > 0.01 && guide.pos) {
      const [x, y] = guide.pos;
      if (guide.tail) {
        const [tx, ty] = guide.tail, tl = g.createLinearGradient(tx, ty, x, y);
        tl.addColorStop(0, GOLD(0)); tl.addColorStop(1, GOLD(0.8 * guide.a));
        g.lineWidth = 1.3; g.strokeStyle = tl; g.beginPath(); g.moveTo(tx, ty); g.lineTo(x, y); g.stroke();
      }
      dot(g, x, y, 2.3 + 0.5 * guide.breath, guide.a);
    }
  };
  const draw = () => {
    // Two failed attempts stop decoration until a fresh layout/visit/context.
    // A fault never disables the independent HTML labels, cards or planes.
    if (drawFaults >= 2) return;
    try { drawThreads(); }
    catch (error) { baseReady = false; drawFaults++; reportFault('threads', error); }
  };
  cv.addEventListener('contextrestored', () => {
    baseReady = false; baseFailed = false; drawFaults = 0;
    if (current(activeCtx)) { draw(); wake(); }
  });

  // ---- States ------------------------------------------------------------------------------------
  let snapshotRelease = null;
  const endCarry = () => {
    Object.assign(cy, { on: false, A: null, P: null, nw: 0, nh: 0, a: 1, back: false });
    carry.remove(); carry.style.display = 'none'; carry.classList.remove('is-back');
    carryPic.style.removeProperty('width'); carryPic.style.removeProperty('height');
    carryCv.width = carryCv.height = 1; // detached snapshot no longer needs its backing pixels
    planes[0].classList.remove('is-carrying');
  };
  const ghostCanvases = PL.map(() => []);
  const ghostScrolls = PL.map(() => null);
  const retireGhosts = () => ghosts.forEach((gh, i) => {
    if (!gh) return;
    ghostScrolls[i]?.observer.disconnect(); ghostScrolls[i] = null;
    gh.remove(); gh.replaceChildren(); gh.removeAttribute('style');
    ghostCanvases[i].forEach(c => { c.width = c.height = 1; });
    delete gh.dataset.w; delete gh.dataset.h; delete shown[i].g;
  });
  const clearGhosts = () => {
    const release = snapshotRelease;
    snapshotRelease = null;
    if (release) release(); else retireGhosts();
    endCarry();
  };
  const hideAll = () => {
    clearGhosts();
    st.forEach((s, i) => Object.assign(s, settledOf(PL[i]), { o: 0 }));
    apply();
    // A previous visit can leave the controls visible. Reset synchronously:
    // their normal opacity transition would otherwise show stale flags while
    // the new arrival is trying to hide them.
    flags.forEach((flag) => { flag.style.transition = 'none'; });
    vis.sh = 0; vis.lb = PL.map(() => 0); vis.rt = 0;
    syncFlagVisibility();
    show(-1);
    // Commit the hidden style before re-enabling the reveal's transitions.
    void root.offsetWidth;
    flags.forEach((flag) => { flag.style.transition = ''; });
    draw();
  };
  const settleAll = () => {
    st.forEach((s, i) => Object.assign(s, settledOf(PL[i])));
    apply();
    clearGhosts();
    vis.sh = 1; vis.lb = PL.map(() => 1); vis.rt = 1;
    syncFlagVisibility();
    draw();
  };

  // ---- Arriving ----------------------------------------------------------------------------------
  // build: { t0, from5, src } while the stack is assembling; ambient afterwards.
  let build = null, amb = null, activeCtx = null;
  // From slide 5: a = each copied panel's fold (rendering, timeline, agent); low = effects and the runtime descending into place;
  // carry = slide 5's picture, landed on the top plane, dissolving into the plane's own film.
  // card: the top layer has landed, and its card opens as the words arrive, so the landing is never without one.
  // wide: on a wider screen the headline is read first, so the first card waits until the words are whole.
  // open: every plane is in place, so the tour takes over while the threads, leaders and roots finish.
  const FROM5 = { a: { 0: [0.05, 1.3], 1: [0.12, 1.42], 3: [0.2, 1.62] }, spread: [1.0, 2.1], low: { 2: [1.25, 2.15], 4: [1.5, 2.4] }, fade: [0.25, 0.45, 0.72, 0.56, 0.86],
    carry: [1.3, 1.9], sh: [1.9, 2.9], lb: 2.05, lbGap: 0.1, lbDur: 0.55, rt: [2.0, 3.4], card: 1.2, wide: 2.0, open: 2.4, end: 3.4 };
  const QUICK = { rise: 0.12, dur: 0.75, sh: [0.95, 1.75], lb: 1.05, lbGap: 0.07, lbDur: 0.45, rt: [1.0, 2.25], card: 0.9, wide: 1.6, open: 1.45, end: 2.25 };
  // Landing at rest on a wider screen, the words are drawn in as the stack lands: its first card waits this long (s).
  const REST_WIDE = 1.7, FOLD_SHOW = 0.3, FOLD_FADE = 0.65;
  const wide = () => view.right && !view.low; // a desktop or tablet, not a phone on its side
  const demo = document.querySelector('[data-astrid-demo]');
  const slide5 = demo && demo.closest('.slide');
  const snapFrom5 = (ctx) => {
    clearGhosts();
    const q = (sel) => { const el = demo.querySelector(sel); const r = el && el.getBoundingClientRect(); return r && r.width > 4 && r.height > 4 ? r : null; };
    const at = Object.keys(SRC).map(Number), rects = at.map((i) => q(SRC[i]));
    if (rects.some((r) => !r)) return null;
    // Each panel exactly as it stands: a deep copy styled by slide 5's own rules (its root's classes and
    // custom properties), its canvas pixels copied, its entry animations not replayed.
    at.forEach((i, j) => {
      const src = demo.querySelector(SRC[i]), r = rects[j], gh = ghosts[i];
      const wrap = document.createElement('div');
      wrap.className = demo.className;
      wrap.style.cssText = `position:absolute;left:0;top:0;margin:0;flex:none;transform-origin:0 0;width:${r.width}px;height:${r.height}px`;
      let canvasIndex = 0;
      const clonePanel = (node) => {
        if (node.nodeName === 'CANVAS' || (node.nodeName === 'IMG' && node.complete && node.naturalWidth)) {
          const isImage = node.nodeName === 'IMG';
          const pool = ghostCanvases[i], canvas = pool[canvasIndex] || (pool[canvasIndex] = document.createElement('canvas'));
          canvasIndex++;
          for (const attr of [...canvas.attributes]) if (attr.name !== 'width' && attr.name !== 'height') canvas.removeAttribute(attr.name);
          for (const attr of node.attributes) if (attr.name !== 'width' && attr.name !== 'height') canvas.setAttribute(attr.name, attr.value);
          const width = isImage ? node.naturalWidth : node.width, height = isImage ? node.naturalHeight : node.height;
          if (canvas.width !== width) canvas.width = width;
          if (canvas.height !== height) canvas.height = height;
          if (isImage) {
            const style = getComputedStyle(node);
            canvas.style.width = style.width; canvas.style.height = style.height;
            canvas.style.imageRendering = style.imageRendering;
          } else canvas.dataset.ghostCanvas = '';
          const context = context2D(canvas);
          if (context) { context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(node, 0, 0); }
          return canvas;
        }
        const clone = node.cloneNode(false);
        node.childNodes.forEach((child) => clone.appendChild(clonePanel(child)));
        return clone;
      };
      const c = clonePanel(src);
      c.style.width = `${r.width}px`; c.style.height = `${r.height}px`;
      c.querySelectorAll('.as-in').forEach((n) => n.classList.remove('as-in'));
      wrap.appendChild(c);
      gh.replaceChildren(wrap);
      gh.dataset.w = r.width; gh.dataset.h = r.height;
      world.insertBefore(gh, planes[i].nextSibling);
      const sourceMessages = src.querySelector('.as-msgs'), messages = c.querySelector('.as-msgs');
      if (sourceMessages && messages) {
        // cloneNode copies the finished conversation, but not its viewport.
        // Preserve a reader's position on departure; completed return chats
        // follow the bottom, including font/media layout changes before paint.
        const top = sourceMessages.scrollTop;
        const bottom = getComputedStyle(sourceMessages).justifyContent === 'flex-end' || top + sourceMessages.clientHeight >= sourceMessages.scrollHeight - 1;
        const sync = () => {
          if (gh.style.display !== 'block') return;
          const end = getComputedStyle(messages).justifyContent === 'flex-end' ? 0 : Math.max(0, messages.scrollHeight - messages.clientHeight);
          const target = bottom ? end : top;
          if (Math.abs(messages.scrollTop - target) > .5) messages.scrollTop = target;
        };
        const observer = new ResizeObserver(sync);
        observer.observe(messages);
        [...messages.children].forEach((row) => observer.observe(row));
        ghostScrolls[i] = { observer, sync, ready: false };
      }
    });
    snapshotRelease = ctx.transitionDefer(() => { retireGhosts(); endCarry(); });
    takePicture(demo.querySelector(SRC[0]), rects[0]);
    return { planes: Object.fromEntries(at.map((i, j) => [i, toWorld(rects[j])])) };
  };
  // The player's picture leaves its copy for the carry layer: its rect in the player, placed as slide 5 draws it
  // (demo.js: 16:9, 0.86 of the screen's fit, centred), and its pixels; and the plane's own picture box to land in.
  const takePicture = (src, r) => {
    // An empty editor has no picture to carry. Its cloned panel keeps the empty
    // state until it fades into the stack's completed preview.
    if (!demo.classList.contains('has-frame')) { endCarry(); return; }
    const pic = src.querySelector('.as-pic'), copy = ghosts[0].querySelector('.as-pic'), b = pic && pic.getBoundingClientRect();
    if (!b || !b.width || !pic.width || !copy || !carryG || !copy.getContext('2d')) { endCarry(); return; }
    const w = pic.width, h = pic.height, f = Math.min(w / 16, h / 9) * 0.86, dw = 16 * f, dh = 9 * f;
    const dx = Math.round((w - dw) / 2), dy = Math.round((h - dh) / 2), u = b.width / w;
    Object.assign(cy, { A: { x: b.left - r.left + dx * u, y: b.top - r.top + dy * u, w: dw * u }, nw: r.width, nh: r.height });
    if (carryCv.width !== Math.round(dw)) carryCv.width = Math.round(dw);
    if (carryCv.height !== Math.round(dh)) carryCv.height = Math.round(dh);
    carryG.clearRect(0, 0, carryCv.width, carryCv.height);
    try { carryG.drawImage(pic, dx, dy, dw, dh, 0, 0, carryCv.width, carryCv.height); }
    catch (error) { reportFault('preview-capture', error); endCarry(); return; }
    copy.getContext('2d').clearRect(0, 0, copy.width, copy.height); copy.dataset.carried = '1';
    const pe = planes[0].querySelector('.st-pic'), scr = pe.parentElement, n = (PL[0].w - 2) / (inners[0].offsetWidth || 1); // laid out unscaled
    cy.P = { x: (scr.offsetLeft + pe.offsetLeft - pe.offsetWidth / 2) * n, y: (scr.offsetTop + pe.offsetTop - pe.offsetHeight / 2) * n, w: pe.offsetWidth * n, h: pe.offsetHeight * n };
    carryPic.style.width = `${cy.P.w.toFixed(2)}px`; carryPic.style.height = `${cy.P.h.toFixed(2)}px`;
    Object.assign(cy, { on: true, back: false, a: 1 }); carry.classList.remove('is-back'); carry.style.display = 'block';
    world.appendChild(carry);
  };
  const begin = (from5, layoutReady = false) => {
    if (!layoutReady) layout();
    // A new build owns the planes until its handoff, even if an outgoing
    // visit kept its ambient scene available for a borrowed picture.
    amb = null;
    const t0 = now();
    if (from5) {
      hideAll();
      let src = null;
      try { src = snapFrom5(activeCtx); }
      catch (error) { reportFault('panel-capture', error); clearGhosts(); }
      if (src) {
        build = { t0, from5: true, src, ctx: activeCtx };
        step(t0);
        return;
      }
    }
    build = { t0, from5: false, ctx: activeCtx };
    hideAll();
    step(t0);
  };
  const k01 = (e, [a, b]) => clamp((e - a) / (b - a));
  const stepBuild = (t) => {
    const e = (t - build.t0) / 1000, T0 = build.from5 ? FROM5 : QUICK, first = wide() ? T0.wide : T0.card;
    // Entry controls share one progress stage with their leader lines on phones; folding back runs this clock without them.
    const fwd = !build.back;
    const controlAt = view.mobile ? first + (T0.open - first) * 0.15 : first;
    if (fwd && !amb && openI < 0 && e >= controlAt) { show(0); arrangeFlags(0); }
    if (fwd && !amb && e >= T0.open) { // every plane is in place: the tour takes them over (it lifts the open layer, and paints)
      st.forEach((s, i) => Object.assign(s, settledOf(PL[i])));
      apply(); // publish the DOM endpoint before the ambient branch stops applying build frames
      clearGhosts();
      amb = { t }; tourFrom(0, Math.max(t, build.t0 + first * 1000));
    }
    if (amb) { // only the threads, the leaders and the roots are still drawing
      vis.sh = k01(e, T0.sh); vis.rt = k01(e, T0.rt);
      const stage = view.mobile ? clamp((e - first) / Math.max(0.01, T0.open - first)) : null;
      vis.lb = PL.map((_, i) => view.mobile ? stage : clamp((e - T0.lb - i * T0.lbGap) / T0.lbDur));
    } else if (build.from5) {
      const T = FROM5, src = build.src.planes, sp = easeIO(k01(e, T.spread)), mid = PL[2].cy;
      for (const i of [0, 1, 3]) { // rendering, timeline, agent: from slide 5's panels, tilting into the stack
        const p = PL[i], s = st[i], qa = easeIO(k01(e, T.a[i])), f = src[i];
        if (!i) s.pq = qa; // its picture rides with it (the carry)
        const ty = lerp(mid + (p.cy - mid) * 0.72, p.cy, sp);
        s.x = lerp(f.x, p.cx, qa); s.y = lerp(f.y, ty, qa); s.w = lerp(f.w, p.w, qa); s.h = lerp(f.h, p.h, qa);
        s.rx = TILT * qa; s.rz = TURN * qa - (i === 3 ? Math.sign(TURN) * 16 * Math.sin(Math.PI * qa) : 0);
        // Slide 5's own panel (the ghost) holds while the plane's frame fades in beneath it; then it dissolves
        // away as the plane's content comes in, overlapping only briefly so the two layouts never stack up.
        const [f0, f1, g1, c0, c1] = T.fade;
        s.o = seep(clamp((qa - f0) / (f1 - f0)));
        s.g = 1 - seep(clamp((qa - f1) / (g1 - f1)));
        s.c = seep(clamp((qa - c0) / (c1 - c0)));
        if (i === 3) {
          // Establish the receiving surface before dissolving the snapshot.
          // Its full-size frame never dims or disappears between representations.
          // The same clock reverses cleanly back to slide 5's exact snapshot.
          s.o = seep(clamp(qa / 0.25));
          s.c = seep(clamp((qa - 0.25) / 0.25));
          s.g = 1 - seep(clamp((qa - 0.5) / 0.45));
        }
      }
      for (const i of [2, 4]) { // each new layer emerges from the one above it
        const p = PL[i], s = st[i], q = ease(k01(e, T.low[i]));
        const startY = view.mobile ? PL[i - 1].cy : p.cy + 50;
        Object.assign(s, settledOf(p), { y: lerp(startY, p.cy, q), rx: TILT + 12 * (1 - q), o: seep(q) });
      }
      if (cy.on) { // slide 5's picture dissolves into the plane's own film once the plane has landed (and back)
        cy.a = 1 - seep(k01(e, T.carry));
        if (build.back && build.shown) cy.a = Math.min(cy.a, 1 - seep(clamp((t - build.shownAt) / 600)));
        planes[0].classList.toggle('is-carrying', e < T.carry[0]);
      }
      vis.sh = k01(e, T.sh); vis.rt = k01(e, T.rt);
      const stage = view.mobile ? clamp((e - first) / Math.max(0.01, T0.open - first)) : null;
      vis.lb = PL.map((_, i) => view.mobile ? stage : clamp((e - T.lb - i * T.lbGap) / T.lbDur));
    } else {
      const T = QUICK;
      for (let i = 0; i < 5; i++) { // on phones each layer follows the layer above down
        const p = PL[i], q = ease(clamp((e - (view.mobile ? i : 4 - i) * T.rise) / T.dur));
        const startY = view.mobile ? (i ? PL[i - 1].cy : p.cy - 46) : p.cy + 46;
        Object.assign(st[i], settledOf(p), { y: lerp(startY, p.cy, q), rx: TILT + 10 * (1 - q), o: seep(q) });
      }
      vis.sh = k01(e, T.sh); vis.rt = k01(e, T.rt);
      const stage = view.mobile ? clamp((e - first) / Math.max(0.01, T.open - first)) : null;
      vis.lb = PL.map((_, i) => view.mobile ? stage : clamp((e - T.lb - i * T.lbGap) / T.lbDur));
    }
    syncFlagVisibility();
    if (!amb) { apply(); draw(); }
    if (!build.back && e >= T0.end) {
      const ctx = build.ctx;
      build = null;
      if (amb) { vis.sh = 1; vis.lb = PL.map(() => 1); vis.rt = 1; syncFlagVisibility(); } else { settleAll(); amb = { t }; tourFrom(0, t + 1100); }
      entryFinished = true;
      if (current(ctx)) entryCompletion?.(ctx, 'completed');
    }
  };

  // ---- The tour, and hover ------------------------------------------------------------------------
  // openI: the layer whose card is open. The guide dwells at a flag (that layer's card open), then travels
  // its way to the next; hover, focus or a pin take over, and the tour resumes from there once let go.
  const DWELL = 3.3, MOVE = 1.15, BACK = 2.2, REST = 0.8, RESUME = 2.2;
  let openI = -1;
  const lit = PL.map(() => 0);
  const hold = { hover: -1, focus: -1, pin: -1 };
  const guide = { on: false, i: 0, mode: 'dwell', t0: 0, way: null, a: 0, pos: null, tail: null, breath: 0, paused: false, resumeAt: 0, last: 0 };
  let closing = { i: -1, until: 0 }; // a card that has just closed keeps its flags apart until it has faded
  const show = (i) => {
    if (i === openI) return;
    if (openI >= 0 && i < 0) closing = { i: openI, until: now() + 300 };
    if (openI >= 0) { cards[openI].classList.remove('is-open'); flags[openI].classList.remove('is-on'); flags[openI].setAttribute('aria-expanded', 'false'); planes[openI].classList.remove('is-lit'); }
    openI = i;
    if (i >= 0 && geo && !view.mobile) cards[i].style.top = `${geo.place[i].top.toFixed(1)}px`;
    if (i >= 0) { cards[i].classList.add('is-open'); flags[i].classList.add('is-on'); flags[i].setAttribute('aria-expanded', 'true'); planes[i].classList.add('is-lit'); }
    root.classList.toggle('has-card', i >= 0);
  };
  const held = () => (hold.hover >= 0 ? hold.hover : hold.pin >= 0 ? hold.pin : hold.focus);
  const tourFrom = (i, at) => Object.assign(guide, { on: !still, i, mode: 'dwell', t0: at, way: null, paused: false, resumeAt: 0, pos: geo && geo.anchors[i], tail: null });
  const stepTour = (t) => {
    const dt = Math.min(0.05, (t - (guide.last || t)) / 1000);
    guide.last = t;
    const h = held();
    // The phone has one permanent card slot: retain its content while the guide travels.
    let want = view.mobile ? (openI >= 0 ? openI : guide.i) : -1;
    if (h >= 0) { want = h; guide.paused = true; guide.i = h; guide.resumeAt = 0; guide.pos = geo.anchors[h]; guide.tail = null; }
    else if (guide.paused) {
      if (!guide.resumeAt) guide.resumeAt = t + RESUME * 1000;
      if (t >= guide.resumeAt) { guide.paused = false; Object.assign(guide, { mode: 'go', t0: t, way: geo.ways[guide.i] }); }
    }
    if (guide.on && !guide.paused) {
      const e = (t - guide.t0) / 1000;
      if (guide.mode === 'rest' && e >= REST) Object.assign(guide, { mode: 'dwell', t0: t });
      if (guide.mode === 'dwell') {
        guide.pos = geo.anchors[guide.i]; guide.tail = null;
        if (e >= 0) want = guide.i;
        if (e >= DWELL) Object.assign(guide, { mode: 'go', t0: t, way: geo.ways[guide.i] });
      } else if (guide.mode === 'go') {
        const back = guide.i === PL.length - 1, dur = back ? BACK : MOVE, q = easeIO(clamp(e / dur));
        guide.pos = along(guide.way, q); guide.tail = along(guide.way, q - 26 / guide.way.total);
        if (q >= 1) Object.assign(guide, { i: back ? 0 : guide.i + 1, mode: back ? 'rest' : 'dwell', t0: t, tail: null });
      }
    }
    show(want);
    guide.a += ((guide.on && !guide.paused ? 1 : 0) - guide.a) * (1 - Math.exp(-dt / 0.2));
    guide.breath = guide.mode === 'dwell' ? 0.5 + 0.5 * Math.sin(t / 420) : 0;
    arrangeFlags(dt);
    // The layer being explained lifts a little.
    let moved = false;
    lit.forEach((l, i) => {
      const nl = l + ((i === openI ? 1 : 0) - l) * (1 - Math.exp(-dt / 0.22));
      if (Math.abs(nl - l) > 1e-4) { lit[i] = nl; st[i].y = PL[i].cy - 6 * nl; moved = true; }
    });
    if (moved) apply();
    draw();
  };
  const arrangeFlags = (dt) => { // dt = 0: jump there
    if (!geo) return;
    const j = openI >= 0 ? openI : closing.i >= 0 && now() < closing.until ? closing.i : -1;
    const T = j >= 0 && !view.mobile ? geo.place[j].flags : geo.base;
    flags.forEach((el, i) => {
      const y = dt ? flagY[i] + (T[i] - flagY[i]) * (1 - Math.exp(-dt / 0.16)) : T[i];
      if (Math.abs(y - flagY[i]) > 0.01) { flagY[i] = y; el.style.top = `${y.toFixed(1)}px`; }
    });
  };
  // With reduced motion there is no clock: hover and taps open the cards directly.
  const react = () => {
    if (motionOff()) {
      const h = held();
      show(h >= 0 ? h : view.mobile ? Math.max(0, openI) : -1);
      arrangeFlags(0); draw();
    } else wake();
  };
  let leaving = 0;
  const enter = (i) => { clearTimeout(leaving); hold.hover = i; react(); };
  const leave = () => { clearTimeout(leaving); leaving = setTimeout(() => { hold.hover = -1; react(); }, 260); };
  const pinTo = (i) => { hold.pin = hold.pin === i ? -1 : i; hold.hover = -1; react(); };
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  let shownSec = -1;
  // The playhead moves by transform on its own layer, so a frame neither lays out nor repaints the timeline plane: the
  // same place as left: f%, from its lane's width as last laid out (kept by a ResizeObserver). Until its first step it
  // stands where the stylesheet puts it, as before.
  const lane = head.parentElement;
  let laneW = parseFloat(getComputedStyle(lane).width) || 0, headF = null, headX = '';
  const placeHead = () => {
    if (headF === null) return;
    const x = `translateX(${(laneW * headF / 100).toFixed(3)}px)`;
    if (x !== headX) { headX = x; head.style.transform = x; }
  };
  new ResizeObserver((es) => { for (const e of es) { laneW = e.contentRect.width; placeHead(); } }).observe(lane);
  const stepHead = () => {
    const tt = video.currentTime || 0;
    headF = +((tt / SPAN) * 100).toFixed(3);
    placeHead();
    const sec = Math.floor(tt);
    if (sec !== shownSec) { shownSec = sec; timeEl.textContent = `${fmt(sec)} / ${fmt(SPAN)}`; }
  };

  // ---- Clock ---------------------------------------------------------------------------------------
  let running = false, raf = 0;
  const step = (t) => {
    if (build) stepBuild(t);
    if (amb) stepTour(t);
    stepHead();
  };
  const tick = (ctx) => {
    raf = 0;
    if (!current(ctx) || activeCtx !== ctx || !running || paused) { if (activeCtx === ctx && !current(ctx)) stop(ctx); return; }
    try {
      const t = now();
      if (build && build.back) { if (!unfold(t)) return; } else step(t);
      metrics.frames++;
    } catch (error) { recoverFrame(ctx, error); return; }
    if (current(ctx) && activeCtx === ctx && running && !paused) raf = requestAnimationFrame(() => tick(ctx));
  };
  const wake = () => { const ctx = activeCtx; if (current(ctx) && running && !paused && !raf) raf = requestAnimationFrame(() => tick(ctx)); };
  let playRequest = null, frameRecoveredFor = null;
  const mayPlay = () => current(activeCtx) && slide.classList.contains('on') && running && !paused && !motionBlocked() && !build?.back;
  const play = () => {
    if (!mayPlay() || playRequest || !video.paused || !video.getAttribute('src')) return;
    const request = { ctx: activeCtx }; playRequest = request;
    video.play().then(() => {
      if (playRequest === request && (!mayPlay() || activeCtx !== request.ctx)) video.pause();
    }).catch(error => {
      if (playRequest === request && mayPlay() && error.name !== 'AbortError') reportFault('playback', error);
    }).finally(() => { if (playRequest === request) playRequest = null; });
  };
  const recoverFrame = (ctx, error) => {
    reportFault('frame', error, ctx);
    running = false; raf = 0; video.pause();
    if (!current(ctx) || activeCtx !== ctx) return;
    if (build?.back) { endFold(); return; }
    if (frameRecoveredFor === ctx) return; // at most one recovery per visit
    frameRecoveredFor = ctx; metrics.frameRecoveries++;
    try {
      build = null; amb = null; clearGhosts(); layout(); settleAll(); stepHead();
      flags.forEach(f => { f.tabIndex = 0; });
      if (view.mobile && openI < 0) show(0);
      entryFinished = true; entryCompletion?.(ctx, 'completed');
      amb = { t: now() }; tourFrom(Math.max(0, openI), now());
      running = true; play(); wake();
    } catch (failure) { reportFault('recovery', failure, ctx); }
  };

  // As on slide 5, the network stays visible behind; only where its threads pass behind the text are they softened.
  // Only ever clear a mask this slide set, so a neighbour that set its own (slide 5) keeps it.
  const softenNet = (ctx, on) => {
    if (!on) { window.deckClearNetMask?.(ctx, 'stack'); return; }
    if (!current(ctx)) return;
    const b = slide.querySelector('.split > :first-child').getBoundingClientRect(), W = innerWidth, H = innerHeight, pad = 14;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'><filter id='f'><feGaussianBlur stdDeviation='12'/></filter><rect width='${W}' height='${H}' fill='white'/><rect x='${Math.round(b.left - pad)}' y='${Math.round(b.top - pad)}' width='${Math.round(b.width + 2 * pad)}' height='${Math.round(b.height + 2 * pad)}' rx='18' fill='black' fill-opacity='.75' filter='url(%23f)'/></svg>`;
    const mask = `url("data:image/svg+xml,${svg.replace(/"/g, "'").replace(/</g, '%3C').replace(/>/g, '%3E')}")`;
    window.deckSetNetMask?.(ctx, 'stack', { image: mask, mode: 'luminance', size: '100% 100%' });
  };

  let entryCompletion = null, reverseCompletion = null, entryFinished = false, foldTextRelease = null;
  const releaseFoldText = () => { foldTextRelease?.(); foldTextRelease = null; };
  const makeCompletion = (ctx, setter, cleanup) => {
    let resolve, settled = false;
    const promise = new Promise((done) => { resolve = done; });
    const finish = (owner, result) => {
      if (owner !== ctx || settled) return;
      settled = true; setter(null); resolve(result);
    };
    setter((owner, result) => finish(owner, result));
    ctx.defer(() => { finish(ctx, 'cancelled'); cleanup(); });
    return promise;
  };
  const start = (ctx) => {
    if (!current(ctx) || ctx.to !== 5) return Promise.resolve('cancelled');
    const promise = makeCompletion(ctx, (fn) => { entryCompletion = fn; }, () => stop(ctx, true));
    activeCtx = ctx;
    if (stackFlight?.ctx !== ctx) stackFlight?.release();
    if (!stackFlight) resetStackFlight();
    entryFinished = false;
    if (document.getElementById('overview')?.classList.contains('on') || (window.deckStill?.() && !motionOff())) { pendingCtx = ctx; return promise; }
    launch(ctx);
    return promise;
  };
  const launch = (ctx) => {
    if (!current(ctx) || activeCtx !== ctx) return;
    window.warmDeckMedia?.(slide);
    pendingCtx = null;
    running = true; paused = false; playRequest = null;
    layout();
    slide.classList.remove('st-arrive');
    softenNet(ctx, true);
    flags.forEach((f) => { f.tabIndex = 0; });
    if (motionOff() || ctx.rest || ctx.direct) {
      if (!stackFlight) resetStackFlight();
      settleAll(); stepHead();
      if (view.mobile) show(0);
      entryFinished = true; entryCompletion?.(ctx, 'completed');
      // Landing at rest: the first card is open as it lands (on a wider screen, once the words are in).
      if (!motionOff()) { amb = { t: now() }; tourFrom(0, now() + (wide() ? REST_WIDE * 1000 : 0)); play(); wake(); }
      return;
    }
    // The product moves at once; the slide must not fade in under it.
    slide.classList.add('st-arrive');
    window.deckLater(() => { if (current(ctx)) slide.classList.remove('st-arrive'); }, 900, ctx);
    try { video.currentTime = 2; } catch { /* not loaded */ }
    begin(true, true); play(); wake();
  };
  const stop = (ctx = activeCtx, preserveScene = false) => {
    if (ctx && activeCtx && activeCtx !== ctx) return;
    running = false;
    paused = false; pendingCtx = null; pausedVideos = [];
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    build = null;
    clearGhosts(); // transient editor snapshots must not outlive an interrupted hand-off
    if (!preserveScene) { amb = null; }
    clearTimeout(leaving); Object.assign(hold, { hover: -1, focus: -1, pin: -1 }); guide.on = false; guide.a = 0; guide.last = 0;
    if (!preserveScene) { show(-1); lit.fill(0); }
    flags.forEach((f) => { f.tabIndex = -1; });
    slide.classList.remove('st-arrive');
    softenNet(ctx, false);
    video.pause(); playRequest = null;
    baseReady = false; baseCv.width = baseCv.height = 1;
    if (activeCtx === ctx) activeCtx = null;
  };

  // ---- Going back to slide 5 ------------------------------------------------------------------
  // A step back: the arrival from slide 5 played backwards. The roots draw back in, the threads and the flags go, the
  // effects and the runtime sink away, and the rendering, timeline and agent planes untilt and fold back into exact
  // copies of slide 5's panels; slide 5 fades in beneath them and the stack goes.
  const fold = (ctx) => {
    if (!current(ctx)) return;
    activeCtx = ctx;
    running = true; paused = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    clearTimeout(leaving); Object.assign(hold, { hover: -1, focus: -1, pin: -1 }); guide.on = false; guide.a = 0;
    show(-1); lit.fill(0);
    flags.forEach((f) => { f.tabIndex = -1; });
    ctx.present(slide, 'dt-rewind');
    ctx.present(slide5, 'dt-return dt-await');
    // From the settled stack, the arrival's clock runs back from its end.
    amb = null; // the tour is over: the planes are the build's again
    video.pause(); // its film holds its frame as the plane folds back into slide 5's preview
    const t = now();
    build = { back: true, from5: true, src: null, t0: t, e: FROM5.end - 1e-3, startAt: t, shown: false, ctx };
    wake();
  };
  const unfold = (t) => {
    const b = build;
    if (!b.src) { // slide 5 has drawn its settled editor by now: copy its panels as they stand
      b.src = snapFrom5(b.ctx);
      if (!b.src) { endFold(); return false; }
      if (cy.on && video.readyState >= 2) { // folding back, the plane's own frame rides back (its film holds as it folds)
        carryG?.clearRect(0, 0, carryCv.width, carryCv.height);
        carryG?.drawImage(video, 0, 0, carryCv.width, carryCv.height);
        cy.back = true; carry.classList.add('is-back');
      } else if (cy.on) { endCarry(); delete ghosts[0].querySelector('.as-pic')?.dataset.carried; } // slide 5's picture stays on its copy
    }
    // Just before the copies show, their pictures are taken again: slide 5's preview may only now have caught up.
    if (!b.fresh && b.e <= 1.1) { b.fresh = true; repaintGhosts(); }
    b.e = Math.max(0, FROM5.end - 1e-3 - (t - b.startAt) / 1000);
    // Slide 5 fades in under the copies as they settle onto its panels; once it is whole, the copies go.
    if (!b.shown && b.e <= FOLD_SHOW) { b.shown = true; b.shownAt = t; b.ctx.present(slide5, '', 'dt-await'); }
    if (b.e <= 0 && t - (b.shownAt ?? Infinity) >= FOLD_FADE * 1000) { endFold(); return false; }
    b.t0 = t - b.e * 1000;
    stepBuild(t);
    stepHead();
    if (foldTextRelease && !foldCrossesCopy(b.ctx)) releaseFoldText();
    return true;
  };
  const repaintGhosts = () => Object.keys(SRC).forEach((i) => {
    const from = demo.querySelector(SRC[i])?.querySelectorAll('canvas') || [], to = ghosts[i].querySelectorAll('canvas[data-ghost-canvas]');
    from.forEach((cs, j) => { const c = to[j]; if (!c || c.dataset.carried || c.width !== cs.width || c.height !== cs.height) return; try { const x = c.getContext('2d'); if (!x) return; x.clearRect(0, 0, c.width, c.height); x.drawImage(cs, 0, 0); } catch { /* empty */ } });
  });
  const abortFold = () => {
    if (!build?.back) { releaseFoldText(); return; }
    const ctx = build.ctx;
    build = null;
    clearGhosts();
    ctx.present(slide, '', 'dt-rewind dt-rewound');
    ctx.present(slide5, '', 'dt-return dt-await');
    stop(activeCtx);
    releaseFoldText();
  };
  const endFold = () => {
    if (!build || !build.back) return;
    const ctx = build.ctx;
    build = null;
    clearGhosts(); // slide 5's own panels stand exactly where their copies were
    ctx.present(slide, 'dt-rewound', 'dt-rewind');
    ctx.present(slide5, '', 'dt-return dt-await');
    if (!slide.classList.contains('on')) { stop(); hideAll(); }
    releaseFoldText();
    if (current(ctx)) reverseCompletion?.(ctx, 'completed');
  };

  const syncMotion = () => {
    if (motionBlocked() && build?.back) endFold(); // a reverse never waits behind the overview
    if (motionOff() && slide.classList.contains('on') && activeCtx) {
      const ctx = activeCtx;
      if (raf) cancelAnimationFrame(raf); raf = 0;
      running = true; paused = false; build = null; amb = null;
      clearGhosts(); layout(); softenNet(ctx, true); settleAll(); stepHead();
      flags.forEach((f) => { f.tabIndex = 0; });
      show(view.mobile ? 0 : -1);
      entryFinished = true; entryCompletion?.(ctx, 'completed');
    }
    else if (motionBlocked()) {
      if (!running || paused) return;
      paused = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      pausedVideos = [video].filter((v) => v && !v.paused);
      pausedVideos.forEach((v) => v.pause());
    } else if (slide.classList.contains('on')) {
      if (running && !build && !amb && !paused && motionOff() === false) {
        amb = { t: now() }; tourFrom(0, now() + (wide() ? REST_WIDE * 1000 : 0)); play(); wake();
        return;
      }
      // An entry deferred behind the overview has no scene to resume yet.
      if (pendingCtx) { launch(pendingCtx); return; }
      if (!paused) return;
      paused = false;
      guide.last = 0;
      if (pausedVideos.length) play();
      pausedVideos = [];
      if (!still) wake();
    }
  };
  document.addEventListener('visibilitychange', syncMotion);
  window.addEventListener('deck-overview', syncMotion);
  window.addEventListener('deck-motion', syncMotion);
  const sceneEnter = (ctx) => start(ctx);
  // Capture the agent avatar's projected corners once at handoff, then animate only transforms.
  let stackFlight = null, collapseSource = null;
  const resetStackFlight = () => {
    root.style.transform = ''; root.style.transformOrigin = ''; root.style.opacity = '';
  };
  const avatar = planes[3].querySelector('.st-avatar img');
  const flightGeometry = () => {
    let x = 0, y = 0, el = avatar;
    while (el && el !== planes[3]) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
    const state = st[3], p = PL[3];
    // Match the precision of box(), fit(), and applyPlanes(), which write the CSS transform.
    const w0 = +state.w.toFixed(1), h0 = +state.h.toFixed(1);
    const s = { ...state, x: +(state.x - state.w / 2).toFixed(1) + w0 / 2,
      y: +(state.y - state.h / 2).toFixed(1) + h0 / 2, w: w0, h: h0,
      rx: +state.rx.toFixed(2), rz: +state.rz.toFixed(2) };
    const scale = +Math.min((s.w - 2) / (p.w - 2), (s.h - 2) / (p.h - 2)).toFixed(5);
    x = 1 + (s.w - 2 - scale * (p.w - 2)) / 2 + scale * (x + 1);
    y = 1 + (s.h - 2 - scale * (p.h - 2)) / 2 + scale * (y + 3);
    const w = 30 * scale, h = 26 * scale;
    const k = +view.k.toFixed(4), ox = +view.ox.toFixed(1), oy = +view.oy.toFixed(1);
    const quad = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([a, b]) => {
      const point = projW(s, a - s.w / 2, b - s.h / 2);
      return { x: ox + k * point.x, y: oy + k * point.y };
    });
    const width = Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y);
    const cx = quad.reduce((n, q) => n + q.x, 0) / 4, cy = quad.reduce((n, q) => n + q.y, 0) / 4;
    return { quad, left: cx - width / 2, top: cy - width * 20 / 46, width, height: width * 20 / 23, c: width / 23 };
  };
  // A projective transform maps the sprite's four corners to the projected plane.
  const quadTransform = (q) => {
    const [a, b, c, d] = q, dx1 = b.x - c.x, dx2 = d.x - c.x, dx3 = a.x - b.x + c.x - d.x;
    const dy1 = b.y - c.y, dy2 = d.y - c.y, dy3 = a.y - b.y + c.y - d.y, det = dx1 * dy2 - dx2 * dy1;
    const g = det ? (dx3 * dy2 - dx2 * dy3) / det : 0, h = det ? (dx1 * dy3 - dx3 * dy1) / det : 0;
    return `matrix3d(${(b.x - a.x + g * b.x) / 23},${(b.y - a.y + g * b.y) / 23},0,${g / 23},${(d.x - a.x + h * d.x) / 20},${(d.y - a.y + h * d.y) / 20},0,${h / 20},0,0,1,0,${a.x},${a.y},0,1)`;
  };
  const holdStackFlight = (ctx, rect) => {
    if (!ctx.isCurrent() || ctx.terminal) return null;
    stackFlight?.release();
    resetStackFlight();
    const box = root.getBoundingClientRect();
    if (!box.width || !box.height || !rect?.width) return null;
    const copy = avatar.cloneNode();
    Object.assign(copy.style, { position: 'fixed', left: '0', top: '0', width: '23px', height: '20px', transformOrigin: '0 0', imageRendering: 'pixelated', pointerEvents: 'none', zIndex: '3' });
    document.body.appendChild(copy); avatar.style.visibility = 'hidden';
    const pose = (q) => {
      const u = clamp(q);
      const upright = [{ x: rect.left, y: rect.top }, { x: rect.left + rect.width, y: rect.top },
        { x: rect.left + rect.width, y: rect.top + rect.height }, { x: rect.left, y: rect.top + rect.height }];
      copy.style.transform = quadTransform(rect.quad.map((p, i) => ({ x: lerp(p.x, upright[i].x, u), y: lerp(p.y, upright[i].y, u) })));
      copy.style.clipPath = u >= 1 ? '' : `ellipse(${lerp(23 * 14 / 30, 30, u)}px ${lerp(20 * 14 / 26, 30, u)}px at ${23 * 14 / 30}px ${20 * 10 / 26}px)`;
    };
    const flight = { ctx, copy, hideCopy() { flight.draw(1); }, stand(q) { copy.style.visibility = 'visible'; pose(q); }, draw(q) {
      if (stackFlight !== flight || !ctx.isCurrent() || ctx.terminal) return;
      copy.style.visibility = q < 1 ? 'visible' : 'hidden';
      q = clamp(q);
      root.style.transform = `scale(${Math.max(0.001, 1 - q ** 3)})`;
      root.style.opacity = String(q < 0.98 ? 1 : (1 - q) / 0.02);
      pose(clamp(q * 0.5 / 0.18));
    } };
    stackFlight = flight;
    root.style.transformOrigin = `${(rect.left + rect.width / 2 - box.left) * root.offsetWidth / box.width}px ${(rect.top + rect.height / 2 - box.top) * root.offsetHeight / box.height}px`;
    flight.release = ctx.transitionDefer(() => {
      if (stackFlight !== flight) return;
      stackFlight = null; copy.remove(); avatar.style.visibility = ''; resetStackFlight();
    });
    return flight;
  };
  window.deckStackFlight = { hold: holdStackFlight,
    source: (ctx) => collapseSource?.ctx === ctx ? collapseSource.rect : flightGeometry(),
    collapsed: (ctx) => collapseSource?.ctx === ctx ? collapseSource.completed : Promise.resolve('completed'),
    ready: (ctx) => { if (collapseSource?.ctx === ctx) collapseSource.copy.remove(); },
  };
  // Bound each folding panel's remaining travel by its current and editor rectangles.
  const foldCrossesCopy = (ctx) => {
    const copy = ctx.copyRects();
    return Object.entries(SRC).some(([i, selector]) => {
      const a = planes[i].getBoundingClientRect(), b = demo.querySelector(selector).getBoundingClientRect();
      const swept = { left: Math.min(a.left, b.left), right: Math.max(a.right, b.right), top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom) };
      return copy.some((r) => swept.left < r.right && swept.right > r.left && swept.top < r.bottom && swept.bottom > r.top);
    });
  };
  const sceneExit = (ctx) => {
    if (ctx.from === 5 && ctx.to === 6 && !ctx.direct && !ctx.rest && !motionOff()) {
      activeCtx = ctx;
      stop(ctx, true);
      ctx.present(slide, 'dt-rewind dt-over');
      const rect = flightGeometry(), flight = holdStackFlight(ctx, rect);
      if (!flight) return undefined;
      const copy = flight.copy;
      flight.stand(0);
      let finish, notifyCollapse, frame = 0, started = null, smallFrame = false;
      const completed = new Promise((resolve) => { finish = resolve; });
      const collapsed = new Promise((resolve) => { notifyCollapse = resolve; });
      const settle = (result, arrival = result) => { cancelAnimationFrame(frame); notifyCollapse(arrival); finish(result); };
      collapseSource = { ctx, rect, copy, flight, completed: collapsed, settle };
      const stepCollapse = () => {
        if (!current(ctx)) return;
        if (started === null) started = now();
        const elapsed = now() - started;
        if (elapsed < 180) { flight.stand(easeIO(clamp(elapsed / 180))); frame = requestAnimationFrame(stepCollapse); return; }
        let q = clamp((elapsed - 180) / 500);
        // A delayed frame must still show the stack small before it disappears.
        if (q === 1 && !smallFrame) q = Math.cbrt(0.8);
        flight.draw(q); flight.stand(1);
        if (q < 1) {
          if (1 - q ** 3 <= 0.2 + 1e-9) smallFrame = true;
          frame = requestAnimationFrame(stepCollapse);
        } else settle('completed');
      };
      frame = requestAnimationFrame(stepCollapse);
      ctx.transitionDefer(() => {
        copy.remove(); settle('cancelled');
        flight.release();
        if (collapseSource?.ctx === ctx) collapseSource = null;
      });
      return completed;
    }
    if (ctx.from !== 5 || ctx.to !== 4 || !ctx.back || motionOff() || !entryFinished) {
      activeCtx = ctx;
      stop(ctx);
      // Keep the settled pixels available to Pays' legacy snapshot reader.
      // The controller retires this slide's paint after the outgoing fade.
      return undefined;
    }
    const promise = makeCompletion(ctx, (fn) => { reverseCompletion = fn; }, () => abortFold());
    if (foldCrossesCopy(ctx)) {
      // Fold clock reaches zero, then any remaining editor fade completes.
      foldTextRelease = ctx.holdText(() => endFold(), (FROM5.end + Math.max(0, FOLD_FADE - FOLD_SHOW) + 0.3) * 1000);
    }
    fold(ctx);
    return promise;
  };
  const sceneRestore = (ctx) => {
    if (collapseSource?.ctx === ctx) { collapseSource.settle('completed', 'cancelled'); collapseSource.copy.remove(); collapseSource.flight.release(); collapseSource = null; }
    if (build?.back && build.ctx === ctx) endFold();
    if (ctx.to === 5 && activeCtx === ctx && (build || !entryFinished)) {
      build = null; clearGhosts(); settleAll(); stepHead();
      flags.forEach((f) => { f.tabIndex = 0; });
      if (view.mobile && openI < 0) show(0);
      if (!amb) { amb = { t: now() }; tourFrom(0, now() + (wide() ? REST_WIDE * 1000 : 0)); }
      entryFinished = true; entryCompletion?.(ctx, 'completed');
    }
    if (ctx.to === 5 && activeCtx === ctx) softenNet(ctx, true);
    releaseFoldText();
    return true;
  };
  const sceneResize = (ctx) => {
    if (!stackFlight) resetStackFlight();
    if (slide.classList.contains('on') && activeCtx === ctx) {
      const box = root.getBoundingClientRect();
      if (!box.width || !box.height) return false;
      layout(); softenNet(ctx, true); settleAll(); stepHead();
      if (openI >= 0 && geo && !view.mobile) cards[openI].style.top = `${geo.place[openI].top.toFixed(1)}px`;
      arrangeFlags(0);
      if (running && !paused) wake();
    }
    return true;
  };
  window.deckRegisterScene?.([5], { enter: sceneEnter, exit: sceneExit, restore: sceneRestore, resize: sceneResize });
  // Clicks on the stack stay here; they never turn the slide.
  root.addEventListener('click', (e) => { if (e.target.closest('.st-plane, .st-flag, .st-card, .st-hit')) e.stopPropagation(); });
  // Flags: hover (a mouse) or keyboard focus shows a layer's card; a click or tap pins it (again to let go).
  flags.forEach((f, i) => {
    f.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') enter(i); });
    f.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') leave(); });
    // The focused flag sits under its own card, so the card carries the focus ring.
    f.addEventListener('focus', () => { if (f.matches(':focus-visible')) { hold.focus = i; cards[i].classList.add('is-focus'); react(); } });
    f.addEventListener('blur', () => { cards[i].classList.remove('is-focus'); if (hold.focus === i) { hold.focus = -1; react(); } });
    f.addEventListener('click', () => pinTo(i));
  });
  cards.forEach((c, i) => {
    c.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && openI === i) enter(i); });
    c.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') leave(); });
  });
  // A plane is a bigger target for the same thing: hovering its layer's flag or tapping the plane itself.
  planes.forEach((pl, i) => pl.addEventListener('click', () => pinTo(i)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && hold.pin >= 0 && slide.classList.contains('on')) { hold.pin = -1; react(); } });
  window.deckOverlay?.register({
    isOpen: () => hold.pin >= 0 && slide.classList.contains('on'),
    contains: (target) => root.contains(target) && !!target.closest?.('.st-card, .st-flag, .st-plane'),
    close: () => { hold.pin = -1; react(); },
  });
  // Loading resets the film to paused, so one that arrives after the slide has started (a cold load) plays then.
  const preview = video.closest('.st-pic');
  const mediaReady = () => {
    if (video.readyState >= 2 && !video.error) preview.classList.add('is-video-ready');
    if (motionOff()) stepHead(); else play();
  };
  video.addEventListener('loadeddata', mediaReady);
  video.addEventListener('canplay', mediaReady);
  video.addEventListener('emptied', () => { playRequest = null; preview.classList.remove('is-video-ready'); });
  video.addEventListener('error', () => { playRequest = null; preview.classList.remove('is-video-ready'); });
  if (window.__deckDebug) Object.defineProperty(window.__deckDebug, 'stack', { get: () => ({
    generation: activeCtx?.generation ?? null, running, paused, scheduled: !!raf,
    building: !!build, reverse: !!build?.back, entryFinished, open: openI, drawFaults,
    metrics: { ...metrics }, scale: view.k, threadBox: { ...threadBox },
    canvasPixels: cv.width * cv.height + baseCv.width * baseCv.height,
    ghostPixels: ghostCanvases.flat().reduce((n, c) => n + c.width * c.height, 0) + carryCv.width * carryCv.height,
    flags: flags.map(f => ({ reveal: f.style.getPropertyValue('--in'), opacity: getComputedStyle(f).opacity,
      rect: [f.getBoundingClientRect().x, f.getBoundingClientRect().y] })),
  }) });

  layout();
  hideAll();
})();
