// Slide 5 demo.
(() => {
  const root = document.querySelector('[data-astrid-demo]');
  const M = window.AstridMink;
  if (!root || !M) return;
  const slide = root.closest('.slide');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionOff = () => still || window.deckStill?.();
  let entryCtx = null, reverseCtx = null, entryCompletion = null, reverseCompletion = null;
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const ease = (k) => 1 - Math.pow(1 - k, 3);
  const easeIO = (q) => (q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2);
  // Keep absolute animation timestamps on the same clock across a pause.
  let paused = false;
  let pendingStart = null, pausedVideos = [];
  const motionBlocked = () => document.hidden || document.getElementById('overview')?.classList.contains('on') || window.deckStill?.();
  const now = () => window.deckNow?.() ?? performance.now();

  const msgs = root.querySelector('.as-msgs');
  const typed = root.querySelector('.as-typed');
  const videos = [...root.querySelectorAll('.as-media video')];
  let mediaCleanups = [];
  const clearMediaHandlers = () => { mediaCleanups.forEach(([el, type, fn]) => el.removeEventListener(type, fn)); mediaCleanups = []; };
  const bindMediaHandlers = (ctx) => {
    clearMediaHandlers();
    const bind = (el, type, fn) => {
      const scoped = () => { if (ctx?.isCurrent?.() && ctx === entryCtx) fn(); };
      el.addEventListener(type, scoped); mediaCleanups.push([el, type, scoped]);
    };
    videos.forEach((v) => bind(v, 'seeked', () => drawPic(now())));
    videos.forEach((v) => bind(v, 'loadeddata', () => { if (motionOff() && slide.classList.contains('on')) drawPic(now()); }));
    videos.forEach((v) => bind(v, 'error', () => drawPic(now())));
    anchors.forEach((img) => bind(img, 'load', () => { if (motionOff() && slide.classList.contains('on')) drawPic(now()); }));
  };
  const pic = root.querySelector('.as-pic'), pg = pic.getContext('2d');
  const tl = root.querySelector('.as-tl');
  const timeEl = root.querySelector('.as-time');
  const minkCv = root.querySelector('.as-mink'), mg = minkCv.getContext('2d');

  // The timeline
  const SPAN = 14;
  const ICON = {
    film: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/></svg>',
    image: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg>',
  };
  const TRACKS = [
    { id: 'V3', name: 'Video', icon: 'film', h: 40 },
    { id: 'V2', name: 'Frames', icon: 'image', h: 44 },
    { id: 'V1', name: 'Scene', icon: 'film', h: 40 },
  ];
  const FRAMES = [
    { name: 'Start', file: 'start-thumb.webp', at: 0, len: 1 },
    { name: 'Mountains', file: 'mountains-thumb.webp', at: 6.5, len: 1 },
    { name: 'Descent', file: 'descent-thumb.webp', at: 10, len: 1 },
    { name: 'Town', file: 'town-thumb.webp', at: 13, len: 1 },
  ];
  const lanes = {};
  {
    const fmt = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    let rulerHtml = '';
    for (let t = 0; t <= SPAN; t++) rulerHtml += t % 2 ? `<i style="left:${(t / SPAN) * 100}%"></i>` : `<span style="left:${(t / SPAN) * 100}%">${fmt(t)}</span>`;
    tl.innerHTML = `<div class="as-ruler-h"></div><div class="as-ruler">${rulerHtml}</div>`
      + TRACKS.map((tr) => `<div class="as-th" style="height:${tr.h}px">${ICON[tr.icon]}<span>${tr.id}</span><em>${tr.name}</em></div><div class="as-lane" data-track="${tr.id}" style="height:${tr.h}px"></div>`).join('')
      + '<i class="as-playhead"></i>';
    tl.querySelectorAll('.as-lane').forEach((el) => { lanes[el.dataset.track] = el; });
  }
  const playhead = tl.querySelector('.as-playhead');
  const place = (el, at, len) => { el.style.left = `calc(${(at / SPAN) * 100}% + 1px)`; el.style.width = `calc(${(len / SPAN) * 100}% - 2px)`; };
  const sceneEl = document.createElement('div');
  sceneEl.className = 'as-clip as-scene-clip is-ready';
  place(sceneEl, 0, SPAN);
  sceneEl.innerHTML = '<img class="as-still" data-src="../assets/astrid/lantern-valley/motion-guide.webp" alt=""><span class="as-film" data-bg="../assets/astrid/lantern-valley/motion-guide.webp"></span><span class="as-name">Lantern Valley · Three.js</span><span class="as-kind">14 s</span>';
  lanes.V1.appendChild(sceneEl);
  const anchorEls = FRAMES.map((frame) => {
    const el = document.createElement('div');
    el.className = 'as-clip as-frame-clip is-ready';
    place(el, frame.at, frame.len);
    el.title = `${frame.name} frame · ${frame.at} s`;
    el.innerHTML = `<img class="as-still" data-src="../assets/astrid/lantern-valley/${frame.file}" alt=""><span class="as-film" data-bg="../assets/astrid/lantern-valley/${frame.file}"></span><span class="as-kind">${frame.name}</span>`;
    lanes.V1.appendChild(el);
    return el;
  });
  anchorEls.forEach((el) => lanes.V2.appendChild(el));
  const resultEl = document.createElement('div');
  resultEl.className = 'as-clip as-result-clip is-ready is-animated';
  place(resultEl, 0, SPAN);
  resultEl.innerHTML = '<img class="as-still" data-src="../assets/astrid/lantern-valley/final-poster.webp" alt=""><span class="as-film" data-bg="../assets/astrid/lantern-valley/final-poster.webp"></span><span class="as-name">MiniMax H3</span><span class="as-kind">14 s</span>';
  lanes.V3.appendChild(resultEl);
  window.deckLoadPictures?.(slide); // the pictures built above, if the slide was warmed before this script ran
  const kind = (el, k) => { el.querySelector('.as-kind').textContent = k; };
  const anchors = [...root.querySelectorAll('.as-media .as-frame-media')];
  const guide = root.querySelector('.as-media .as-guide-media');

  // The mink
  // Poses: profile, glint (her eye flash), facing, focus (eyes lit). She is drawn
  // cell by cell at a whole number of CSS pixels per art pixel, never smoothed.
  const HEAD = 3; // spare rows above her for the hop and the float
  let cell = 4, dpr = 1;
  const mink = { pose: 'profile', lift: 0, glint: 0, seq: null, hover: null };
  const paint = (pose, lift, glint) => {
    const P = M.POSES[pose], w = P[0].length, h = P.length, u = cell * dpr;
    mg.clearRect(0, 0, minkCv.width, minkCv.height);
    const fill = (rows, only) => {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const ch = rows[y][x];
        if (ch === '.' || (only && ch === P[y][x])) continue;
        mg.fillStyle = M.COLORS[ch];
        mg.fillRect(x * u, (y + HEAD - lift) * u, u, u);
      }
    };
    fill(P);
    if (glint > 0 && pose === 'profile') { mg.globalAlpha = glint; fill(M.POSES.glint, true); mg.globalAlpha = 1; }
  };
  const sizeMink = () => {
    dpr = Math.min(2, Math.round(devicePixelRatio || 1) || 1);
    cell = innerWidth <= 760 ? 2 : innerHeight >= 860 ? 4 : innerHeight >= 660 ? 3 : 2;
    root.style.setProperty('--as-cell', `${cell}px`);
    minkCv.width = 23 * cell * dpr; minkCv.height = (20 + HEAD) * cell * dpr;
    minkCv.style.width = `${23 * cell}px`; minkCv.style.height = `${(20 + HEAD) * cell}px`;
    minkCv.style.transform = `translateX(-${Math.round(23 * cell / 2)}px)`;
    paint(mink.pose, mink.lift, mink.glint);
  };
  const TURN = [[0, 'facing'], [500, 'focus'], [1900, 'facing'], [2400, 'profile']];
  const turn = () => { if (!mink.seq) { mink.seq = { t0: now() }; wake(); } };
  const stepMink = (t) => {
    let { pose, lift } = mink;
    let glint = 0;
    if (mink.seq) {
      const e = Math.max(0, t - mink.seq.t0), cur = TURN.filter(([at]) => e >= at).pop();
      pose = cur[1];
      const since = e - cur[0];
      lift = pose === 'facing' ? (since < 130 ? 1 : 0) : pose === 'focus' ? ((since % 1100) < 550 ? 1 : 2) : 0;
      if (e >= 2400) mink.seq = null;
    }
    if (mink.hover !== null) { // the glint: up and back over 2.6 s
      const e = Math.max(0, t - mink.hover) / 2600;
      glint = e >= 1 ? 0 : Math.sin(Math.PI * e) ** 2;
      if (e >= 1) mink.hover = null;
    }
    if (pose !== mink.pose || lift !== mink.lift || Math.abs(glint - mink.glint) > 0.01) {
      Object.assign(mink, { pose, lift, glint });
      paint(pose, lift, glint);
    }
    return !!(mink.seq || mink.hover !== null);
  };
  minkCv.addEventListener('pointerenter', () => { if (still || mink.seq || mink.pose !== 'profile') return; mink.hover = now(); wake(); });
  minkCv.addEventListener('click', (e) => { e.stopPropagation(); if (!still) turn(); });

  // The preview
  // mode: none | still | play.
  const view = { mode: 'none', i: -1, seq: -1, rate: 1, seekPending: false };
  let pdpr = 1;
  // The preview is redrawn only when what it shows can have changed: a playing film or a new still.
  // every frame, as before; an empty screen, a still, or a film not yet ready once. Its size on screen comes from a
  // ResizeObserver rather than a layout read every frame.
  let picCW = -1, picCH = -1, picKey = '';
  const outgoing = document.createElement('canvas'), og = outgoing.getContext('2d');
  const PIC_FADE = 450;
  let picFade = null, hasPicFrame = false;
  const clearPicFade = () => { picFade = null; hasPicFrame = false; outgoing.width = outgoing.height = 1; };
  const fadePic = () => {
    if (motionOff() || !hasPicFrame) return;
    // Capture the complete displayed result, including effects and any interrupted dissolve.
    outgoing.width = pic.width; outgoing.height = pic.height;
    og.drawImage(pic, 0, 0);
    picFade = { at: null };
    picKey = '';
  };
  const sizePic = () => {
    const b = pic.getBoundingClientRect();
    pdpr = Math.min(2, devicePixelRatio || 1);
    const saved = document.createElement('canvas');
    if (hasPicFrame) { saved.width = pic.width; saved.height = pic.height; saved.getContext('2d').drawImage(pic, 0, 0); }
    pic.width = Math.max(1, Math.round(b.width * pdpr)); pic.height = Math.max(1, Math.round(b.height * pdpr));
    if (hasPicFrame) pg.drawImage(saved, 0, 0, pic.width, pic.height);
    picKey = ''; // sizing a canvas clears it
  };
  new ResizeObserver((es) => { for (const e of es) { picCW = e.contentRect.width; picCH = e.contentRect.height; } }).observe(pic);
  const drawPic = (t) => {
    const cw = picCW < 0 ? pic.clientWidth : picCW, ch = picCH < 0 ? pic.clientHeight : picCH;
    if (Math.abs(cw * pdpr - pic.width) > 1 || Math.abs(ch * pdpr - pic.height) > 1) sizePic();
    const src = view.mode === 'still' ? anchors[view.i] : view.mode === 'guide' ? guide : view.mode === 'play' ? videos[0] : null;
    const ready = !!src && (src.tagName === 'VIDEO' ? src.readyState >= 2 && !src.seeking : src.complete && src.naturalWidth > 0);
    root.classList.toggle('has-frame', ready || hasPicFrame);
    const key = picFade || ((view.mode === 'play' || view.mode === 'guide') && ready) ? '' : `${view.mode}|${view.i}|${ready}`;
    if (key && key === picKey) return; // the same picture as last frame
    picKey = key;
    const w = pic.width, h = pic.height;
    pg.setTransform(1, 0, 0, 1, 0, 0);
    if (!ready) return; // Retain the last produced frame while media is unavailable.
    pg.clearRect(0, 0, w, h);
    const s = Math.min(w / 16, h / 9) * 0.86, dw = 16 * s, dh = 9 * s, dx = Math.round((w - dw) / 2), dy = Math.round((h - dh) / 2);
    pg.drawImage(src, dx, dy, dw, dh);
    if (picFade) {
      if (picFade.at === null) picFade.at = t;
      const q = clamp((t - picFade.at) / PIC_FADE);
      if (q < 1) { pg.save(); pg.globalAlpha = 1 - easeIO(q); pg.drawImage(outgoing, 0, 0, w, h); pg.restore(); }
      else picFade = null;
    }
    hasPicFrame = true;
  };
  const showStill = (i) => { if (view.mode !== 'still' || view.i !== i) fadePic(); view.mode = 'still'; view.i = i; view.seq = -1; videos.forEach((v) => v.pause()); };
  // A play request can settle after this visit has stopped or the overview has opened.
  // Only the current, unpaused guide view may keep the shared element playing.
  const guideMayPlay = () => running && !paused && !motionBlocked() && entryCtx?.isCurrent?.() && view.mode === 'guide';
  const playGuide = () => {
    if (!guideMayPlay()) return;
    guide.play().then(() => { if (!guideMayPlay()) guide.pause(); }).catch(() => {});
  };
  const showGuide = () => {
    if (view.mode !== 'guide') fadePic();
    view.mode = 'guide'; view.i = -1; view.seq = 0;
    videos[0].pause();
    guide.playbackRate = 2.5;
    playGuide();
  };
  const playFrom = (seqT, rate, prepared = false) => { fadePic(); view.mode = 'play'; view.seq = seqT; view.rate = rate; view.i = -2; view.seekPending = !prepared; };
  const stepPlay = () => {
    if (view.mode === 'guide') {
      if (guide.ended) headTo(SPAN, true);
      else {
        if (guide.paused && !paused && guide.readyState >= 2 && !guide.seeking) playGuide();
        if (Number.isFinite(guide.duration) && guide.duration > 0) headTo(clamp(guide.currentTime / guide.duration) * SPAN, true);
      }
      return;
    }
    if (view.mode !== 'play') return;
    const video = videos[0];
    if (video.readyState < 1) { headTo(view.seq, true); return; }
    if (view.i !== 0) {
      view.i = 0;
      video.playbackRate = view.rate;
    }
    if (view.seekPending) {
      try { video.currentTime = view.seq; } catch { /* not loaded */ }
      view.seekPending = false;
    }
    if (video.readyState < 2 || video.seeking) { headTo(view.seq, true); return; }
    if (!video.paused) {
      view.seq = video.currentTime;
      if (view.seq >= SPAN) { view.seq = 0; view.seekPending = true; video.pause(); }
    } else video.play().catch(() => {});
    headTo(view.seq, true);
  };

  // The playhead and the clock read-outs
  let headT = 0, headGoal = 0, total = 0;
  const headTo = (t, now_) => { headGoal = t; if (now_) headT = t; };
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  // The playhead moves by transform on its own layer, so a frame neither lays out nor repaints the editor under it: the
  // same place as left: calc(var(--as-hcol) + (100% - var(--as-hcol) - 8px) * f), from the timeline's width and header
  // column as last laid out (kept by a ResizeObserver). The clock's text is only replaced when its reading changes.
  // Until its first step it stands where the stylesheet puts it, as before.
  let tlW = 0, tlL = 0, hcol = 0, headF = null, headX = '', clock = '';
  const measureTl = (w) => { tlW = w ?? parseFloat(getComputedStyle(tl).width); tlL = tl.getBoundingClientRect().left - 1; hcol = parseFloat(getComputedStyle(tl).getPropertyValue('--as-hcol')) || 0; };
  const placeHead = () => {
    if (headF === null) return;
    // Whole device pixels, as the line was snapped when laid out (a layer at a fraction would be resampled, softer).
    const d = devicePixelRatio || 1, at = hcol + (tlW - hcol - 8) * headF;
    const x = `translateX(${((Math.round((tlL + at) * d) - Math.round(tlL * d)) / d).toFixed(4)}px)`;
    if (x !== headX) { headX = x; playhead.style.transform = x; }
  };
  const stepHead = (dt) => {
    headT += (headGoal - headT) * (1 - Math.exp(-dt / 0.12));
    headF = +(headT / SPAN).toFixed(4);
    placeHead();
    const c = `${fmt(headT)} / ${fmt(total)}`;
    if (c !== clock) { clock = c; timeEl.textContent = c; }
  };

  const CPS = 30, FINISHED_HOLD = 10;
  // The three beats replay the source tour prompts in order; later starts follow the prior act's done beat.
  // Each Qwen frame holds about a second in the preview before the next one is generated.
  const FRAME_STEP = 1.1;
  const BEATS = [
    { at: 0.1, ask: 'Make a 14-second bird flight over Lantern Valley into town.', reply: 'Lantern Valley is on your timeline: a 14-second live Three.js flight from the mountains down into town.', step: ['Built Lantern Valley', 'Three.js', '14 s live scene'], dur: 1.5 },
    { at: 4.7, ask: 'Can you make me realistic frames for that using Qwen Image 2.1?', reply: 'I made four realistic reference frames through WaveSpeed: start, mountains, descent, and town.', step: ['Captured 4 reference frames', 'Qwen Image 2.1', 'WaveSpeed'], dur: FRAME_STEP * FRAMES.length },
    { at: 9.6, ask: 'Now animate it with MiniMax H3 using the frames and guide.', reply: 'MiniMax H3 used all four frames and the 14-second motion guide. The finished shot is trimmed to 14 seconds.', step: ['Generated the final shot', 'MiniMax H3', '4 frames + motion guide · 14 s'], dur: 2.8 },
  ];
  for (let i = 1; i < BEATS.length; i++) {
    const previous = BEATS[i - 1], typeEnd = previous.at + previous.ask.length / CPS;
    BEATS[i].at = typeEnd + 0.95 + previous.dur + 0.45;
  }
  let td = -1, wait = 0, rows = [];
  const bubble = (cls, html) => {
    const el = document.createElement('div');
    el.className = `${cls} as-in`;
    el.innerHTML = html;
    msgs.appendChild(el);
    while (msgs.children.length > 9) msgs.firstChild.remove();
    return el;
  };
  const clearAll = () => {
    clearPicFade();
    pg.setTransform(1, 0, 0, 1, 0, 0);
    pg.clearRect(0, 0, pic.width, pic.height);
    root.classList.remove('has-frame');
    picKey = '';
    msgs.innerHTML = '';
    typed.textContent = ''; rows = [];
    root.classList.remove('is-typing', 'has-draft', 'is-working', 'is-playing', 'is-resetting');
    anchorEls.forEach((el) => { el.className = 'as-clip as-frame-clip'; el.style.opacity = '0'; kind(el, 'Qwen'); });
    sceneEl.className = 'as-clip as-scene-clip'; sceneEl.style.opacity = '0';
    resultEl.className = 'as-clip as-result-clip'; resultEl.style.opacity = '0';
    view.mode = 'none'; view.i = -1; view.seq = -1; view.seekPending = false; total = SPAN;
    videos.forEach((v) => v.pause());
    headTo(0, true);
  };
  const beatTimes = (b) => {
    const typeEnd = b.at + b.ask.length / CPS;
    return { typeEnd, send: typeEnd + 0.25, reply: typeEnd + 0.75, act: typeEnd + 0.95, done: typeEnd + 0.95 + b.dur };
  };
  // Let the completed result keep playing for ten seconds, then use the existing one-second reset fade.
  const RESET = beatTimes(BEATS[BEATS.length - 1]).done + FINISHED_HOLD, LOOP = RESET + 1;
  // Every event is visited in order, even after a long frame. A production gate
  // consumes no further story time until the corresponding media is decodable.
  const events = [];
  BEATS.forEach((b, bi) => {
    const T = beatTimes(b);
    [b.at, T.send, T.reply, T.act].forEach((at) => events.push({ at }));
    events.push({ at: T.done, guideEnd: bi === 0 });
    const offsets = bi === 0 ? [0.65, 1.2] : bi === 1
      ? FRAMES.flatMap((_, i) => [i * FRAME_STEP, i * FRAME_STEP + 0.32, i * FRAME_STEP + 0.5]) : [0.55];
    offsets.forEach((offset) => events.push({ at: T.act + offset, bi, offset }));
  });
  events.push({ at: RESET }, { at: LOOP });
  events.sort((a, b) => a.at - b.at);
  const imageReady = (img) => img.complete && img.naturalWidth > 0;
  let videoGateSeeking = false, guideGateSeeking = false;
  const gateReady = (event) => {
    if (event.guideEnd) return guide.ended;
    if (event.bi === 0 && event.offset === 0.65) {
      if (guide.readyState < 1) return false;
      if (!guideGateSeeking) {
        try { guide.currentTime = 0; guideGateSeeking = true; } catch { return false; }
      }
      return guide.readyState >= 2 && !guide.seeking;
    }
    if (event.bi === 1) {
      const i = FRAMES.findIndex((_, n) => Math.abs(event.offset - (n * FRAME_STEP + 0.32)) < 1e-7);
      if (i >= 0) return imageReady(anchors[i]);
    }
    if (event.bi === 2 && event.offset === 0.55) {
      const v = videos[0];
      if (v.readyState < 1) return false;
      if (!videoGateSeeking) {
        try { v.currentTime = 0; videoGateSeeking = true; } catch { return false; }
      }
      return v.readyState >= 2 && !v.seeking;
    }
    return true;
  };
  let eventIndex = 0;
  const advanceBeats = (was, next) => {
    const passed = (c) => was < c && next >= c;
    BEATS.forEach((b, bi) => {
      const T = beatTimes(b);
      if (next >= b.at && next < T.send) {
        root.classList.add('is-typing');
        const n = Math.min(b.ask.length, Math.floor((next - b.at) * CPS));
        if (typed.textContent.length !== n) typed.textContent = b.ask.slice(0, n);
        root.classList.toggle('has-draft', n > 0);
      }
      if (passed(T.send)) {
        typed.textContent = '';
        root.classList.remove('is-typing', 'has-draft');
        root.classList.add('is-working');
        bubble('as-msg is-user', b.ask + (b.att ? `<br><span class="as-att">${b.att}</span>` : ''));
      }
      if (passed(T.reply)) {
        bubble('as-msg is-astrid', b.reply);
        rows[bi] = bubble('as-step is-active', `<i></i><span>${b.step[0]}</span><code><b>${b.step[1]}</b> ${b.step[2]}</code>`);
      }
      if (next >= T.act && was < T.done + 0.5) act(bi, next - T.act, was - T.act);
      if (passed(T.done) && rows[bi]) { rows[bi].classList.remove('is-active'); rows[bi].classList.add('is-done'); root.classList.remove('is-working'); }
    });
    if (passed(RESET)) root.classList.add('is-resetting');
  };
  const stepBeats = (dt) => {
    if (td < 0) return false;
    if (wait > 0) { const used = Math.min(wait, dt); wait -= used; dt -= used; }
    let target = td + dt;
    while (eventIndex < events.length && events[eventIndex].at <= target) {
      const event = events[eventIndex];
      if (!gateReady(event)) { target = event.at; break; }
      advanceBeats(td, event.at);
      td = event.at;
      eventIndex++;
      if (event.at === LOOP) {
        const remaining = target - LOOP;
        clearAll(); td = 0; eventIndex = 0; videoGateSeeking = false; guideGateSeeking = false;
        target = remaining;
      }
    }
    // Stop just before a blocked event so it fires when readiness arrives.
    if (eventIndex < events.length && target === events[eventIndex].at && !gateReady(events[eventIndex])) {
      const before = Math.max(td, target - 1e-7);
      advanceBeats(td, before); td = before;
    } else { advanceBeats(td, target); td = target; }
    stepPlay();
    stepHead(dt);
    return true;
  };
  // What each beat does to the editor, a seconds into its work (p: where it was last frame).
  const act = (bi, a, p) => {
    const at = (x) => p < x - 1e-8 && a >= x - 1e-8;
    const touch = (el, on) => el.classList.toggle('is-touched', on);
    if (bi === 0) {
      if (at(0)) { sceneEl.style.opacity = ''; sceneEl.classList.add('is-generating'); touch(sceneEl, true); total = SPAN; headTo(0, true); }
      if (at(0.65)) { sceneEl.classList.remove('is-generating'); sceneEl.classList.add('is-ready'); showGuide(); headTo(0, true); }
      if (at(1.2)) touch(sceneEl, false);
    }
    if (bi === 1) {
      FRAMES.forEach((frame, i) => {
        const el = anchorEls[i], start = i * FRAME_STEP;
        if (at(start)) { el.style.opacity = ''; el.classList.add('is-generating'); touch(el, true); headTo(frame.at + 0.5); }
        if (at(start + 0.32)) { el.classList.remove('is-generating'); el.classList.add('is-ready'); showStill(i); total = SPAN; }
        if (at(start + 0.5)) touch(el, false);
      });
    }
    if (bi === 2) {
      if (at(0)) { resultEl.style.opacity = ''; resultEl.classList.add('is-generating'); touch(resultEl, true); total = SPAN; headTo(0); }
      if (at(0.55)) { resultEl.classList.remove('is-generating'); resultEl.classList.add('is-ready', 'is-animated'); touch(resultEl, false); playFrom(0, 1, true); root.classList.add('is-playing'); }
    }
  };
  const settledState = () => { // everything as it ends, for reduced motion
    clearAll();
    BEATS.forEach((b) => {
      bubble('as-msg is-user', b.ask);
      bubble('as-msg is-astrid', b.reply);
      bubble('as-step is-done', `<i></i><span>${b.step[0]}</span><code><b>${b.step[1]}</b> ${b.step[2]}</code>`);
    });
    msgs.querySelectorAll('.as-in').forEach((el) => el.classList.remove('as-in'));
    sceneEl.style.opacity = ''; sceneEl.classList.add('is-ready');
    anchorEls.forEach((el) => { el.style.opacity = ''; el.classList.add('is-ready'); kind(el, 'Qwen'); });
    resultEl.style.opacity = ''; resultEl.classList.add('is-ready', 'is-animated');
    total = SPAN;
    if (still) {
      view.mode = 'play'; view.i = 0; view.seq = 4;
      try { videos[0].currentTime = 4; } catch { /* not loaded */ }
    } else playFrom(4, 1);
    headTo(4, true); stepHead(0);
  };

  // From slide 4
  const sky = document.createElement('canvas');
  sky.className = 'as-flight';
  sky.setAttribute('aria-hidden', 'true');
  document.body.appendChild(sky);
  const sg = sky.getContext('2d');
  let morph = null;
  // Type as the panels resolve, so the first message lands during the mink's turn.
  const MORPH = { rings: [0.05, 1.15], fly: [0, 1.1], outline: [0.1, 0.9], pixels: [0.85, 0.45], resolve: 1.05, handoff: 1.35, end: 1.75 };
  // A rounded rectangle as n points spaced evenly round it, clockwise from the top centre.
  const roundRect = (b, rad, n) => {
    const { left: l, top: t, right: r, bottom: bt } = b, pts = [];
    const arc = (cx, cy, a0) => { for (let i = 1; i <= 8; i++) { const a = a0 + (i / 8) * (Math.PI / 2); pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); } };
    const mx = (l + r) / 2;
    pts.push([mx, t], [r - rad, t]); arc(r - rad, t + rad, -Math.PI / 2);
    pts.push([r, bt - rad]); arc(r - rad, bt - rad, 0);
    pts.push([l + rad, bt]); arc(l + rad, bt - rad, Math.PI / 2);
    pts.push([l, t + rad]); arc(l + rad, t + rad, Math.PI);
    pts.push([mx, t]);
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = len[len.length - 1], out = [];
    for (let k = 0, j = 1; k < n; k++) {
      const d = (k / n) * total;
      while (len[j] < d) j++;
      const f = (d - len[j - 1]) / ((len[j] - len[j - 1]) || 1);
      out.push([pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * f, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * f]);
    }
    return out;
  };
  // The sky is allocated ahead, while slide 4 or 5 is up (allocating it in the press frame added to a full garbage
  // collection there), cleared back to its first state as a morph begins, and let go once both slides are left.
  const skySize = () => [Math.round(innerWidth * Math.min(2, devicePixelRatio || 1)), Math.round(innerHeight * Math.min(2, devicePixelRatio || 1))];
  const freeSky = () => { sky.width = 0; sky.height = 0; };
  const startMorph = (snap, back = false, ctx = back ? reverseCtx : entryCtx) => {
    const d = Math.min(2, devicePixelRatio || 1);
    const [sw, sh] = skySize();
    if (sky.width === sw && sky.height === sh && sg.reset) sg.reset(); else { sky.width = sw; sky.height = sh; }
    sky.style.display = 'block';
    if (!back) root.classList.add('is-morphing', 'is-minkless'); // (folding back, the editor is whole as it begins)
    sizeMink();
    const chat = root.querySelector('.as-chat').getBoundingClientRect(), edit = root.querySelector('.as-edit').getBoundingClientRect();
    const mr = minkCv.getBoundingClientRect();
    const origin = { x: mr.left, y: mr.top + HEAD * cell };
    const ox = snap.left, oy = snap.top;
    const N = 180;
    const frames = [roundRect(chat, 12, N), roundRect(edit, 12, N)];
    const rings = snap.rings.map((r, side) => ({ ...r, cx: r.x + ox, cy: r.y + oy, target: frames[side],
      strands: r.strands.map((st) => st.map(([x, y]) => [x + ox, y + oy])) }));
    // Where the mink's outline (in the 16 x 16 icon's units) lies over her pixels (the 23 x 20 profile).
    const sprite = ([fx, fy]) => [origin.x + fx * 1.44 * cell, origin.y + ((fy - 1.5) * 1.345 + 0.5) * cell];
    const outlineTo = M.smooth(M.OUTLINE, 10).map(sprite), throatTo = M.smooth(M.THROAT, 10).map(sprite);
    const P = M.POSES.profile, cells = [];
    P.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') cells.push({ x, y, ch, at: 0 }); }));
    cells.forEach((c) => { c.at = (c.y + (22 - c.x) * 0.35) / (19 + 22 * 0.35); }); // from the head down the neck
    const motes = [];
    const rnd = Math.random;
    snap.slots.forEach((sl) => {
      const box = sl.side ? edit : chat;
      for (let i = 0; i < 5; i++) motes.push({ x: sl.x + ox + (rnd() - 0.5) * 30 * snap.k, y: sl.y + oy + (rnd() - 0.5) * 30 * snap.k,
        tx: box.left + box.width * (0.15 + 0.7 * rnd()), ty: box.bottom - box.height * (0.05 + 0.3 * rnd()), d: 0.1 + rnd() * 0.3, r: 1 + rnd() * 1.2 });
    });
    snap.orbit.forEach((o) => {
      const dx = o.x - snap.W / 2, dy = o.y - snap.H * 0.4, n = Math.hypot(dx, dy) || 1;
      motes.push({ x: o.x + ox, y: o.y + oy, tx: o.x + ox + (dx / n) * (40 + rnd() * 60), ty: o.y + oy + (dy / n) * (40 + rnd() * 60) + 30, d: rnd() * 0.3, r: 0.8 + rnd() * 0.6, away: true });
    });
    const fit = (src, dst) => { const s = Math.min(dst.width / src.w, dst.height / src.h); return { s, x: dst.left + dst.width / 2, y: dst.top + dst.height / 2 }; };
    morph = {
      t0: now(), d, snap, rings, cells, origin, outlineTo, throatTo, motes, ctx,
      outline: snap.outline.map(([x, y]) => [x + ox, y + oy]), throat: snap.throat.map(([x, y]) => [x + ox, y + oy]),
      eyeFrom: { x: snap.eye.x + ox, y: snap.eye.y + oy }, eyeTo: { x: origin.x + 16 * cell, y: origin.y + 5 * cell },
      fly: [
        { img: snap.layers.agent, from: { x: rings[0].cx, y: rings[0].cy }, src: { w: rings[0].r * 2, h: rings[0].r * 2 }, to: fit({ w: rings[0].r * 2, h: rings[0].r * 2 }, chat) },
        { img: snap.layers.face, from: { x: rings[1].cx, y: rings[1].cy }, src: { w: rings[1].r * 2, h: rings[1].r * 2 }, to: fit({ w: rings[1].r * 2, h: rings[1].r * 2 }, edit) },
      ],
      steps: { resolve: false, handoff: false },
    };
    window.AstridCore.hide();
  };
  const lerp = (a, b, q) => a + (b - a) * q;
  const drawMorph = (t) => {
    const m = morph, e = Math.max(0, t - m.t0) / 1000, d = m.d;
    sg.setTransform(d, 0, 0, d, 0, 0);
    sg.clearRect(0, 0, sky.width / d, sky.height / d);
    sg.lineCap = 'round'; sg.lineJoin = 'round';
    const k01 = ([a, b]) => clamp((e - a) / b);
    const qf = easeIO(k01(MORPH.fly));
    for (const f of m.fly) {
      const s = lerp(1, f.to.s * 0.82, qf), x = lerp(f.from.x, f.to.x, qf), y = lerp(f.from.y, f.to.y, qf);
      const a = 1 - smoothstep(clamp((e - 0.45) / 0.65));
      if (a <= 0) continue;
      sg.save();
      sg.globalAlpha = a;
      sg.translate(x, y); sg.scale(s, s); sg.translate(-f.from.x, -f.from.y);
      sg.drawImage(f.img, m.snap.left, m.snap.top, m.snap.W, m.snap.H);
      sg.restore();
    }
    const qo = 1 - clamp(e / 0.3);
    if (qo > 0) { sg.globalAlpha = qo; sg.drawImage(m.snap.layers.outer, m.snap.left, m.snap.top, m.snap.W, m.snap.H); sg.globalAlpha = 1; }
    for (const p of m.motes) {
      const q = clamp((e - p.d) / 0.9);
      if (q <= 0 || q >= 1) continue;
      const qq = p.away ? ease(q) : easeIO(q);
      const x = lerp(p.x, p.tx, qq), y = lerp(p.y, p.ty, qq), a = Math.sin(Math.PI * q) * (p.away ? 0.55 : 0.85);
      sg.fillStyle = `rgba(255,217,145,${a.toFixed(3)})`;
      sg.beginPath(); sg.arc(x, y, p.r, 0, Math.PI * 2); sg.fill();
    }
    const qr = easeIO(k01(MORPH.rings));
    const fa = 1 - clamp((e - MORPH.resolve - 0.1) / 0.45);
    if (fa > 0) {
      m.rings.forEach((r) => {
        r.strands.forEach((st, si) => {
          const spread = 1 - qr;
          sg.lineWidth = lerp(r.width[si] * m.snap.lw, 1, qr);
          sg.strokeStyle = `rgba(240,200,119,${(lerp(r.alpha[si], si ? 0 : 0.55, qr) * fa).toFixed(3)})`;
          sg.beginPath();
          st.forEach(([x, y], i) => {
            const [tx, ty] = r.target[i];
            const px = lerp(x, tx, qr), py = lerp(y, ty, qr);
            if (spread <= 0 && si) return;
            i ? sg.lineTo(px, py) : sg.moveTo(px, py);
          });
          sg.closePath(); sg.stroke();
        });
      });
    }
    const qm = easeIO(k01(MORPH.outline));
    const oa = 1 - clamp((e - MORPH.pixels[0] - 0.15) / 0.35);
    if (!m.steps.handoff) {
      if (oa > 0) {
        for (const [src, dst, w, a] of [[m.outline, m.outlineTo, 1.2, 0.9], [m.throat, m.throatTo, 0.8, 0.45]]) {
          sg.lineWidth = w;
          sg.strokeStyle = `rgba(255,217,145,${(a * oa).toFixed(3)})`;
          sg.beginPath();
          src.forEach(([x, y], i) => { const px = lerp(x, dst[i][0], qm), py = lerp(y, dst[i][1], qm); i ? sg.lineTo(px, py) : sg.moveTo(px, py); });
          sg.stroke();
        }
        const ex = lerp(m.eyeFrom.x, m.eyeTo.x, qm), ey = lerp(m.eyeFrom.y, m.eyeTo.y, qm);
        sg.fillStyle = `rgba(255,236,200,${oa.toFixed(3)})`;
        sg.beginPath(); sg.arc(ex, ey, 3, 0, Math.PI * 2); sg.fill();
      }
      const qp = (e - MORPH.pixels[0]) / MORPH.pixels[1];
      if (qp > 0) {
        sg.setTransform(1, 0, 0, 1, 0, 0);
        const u = cell * d, x0 = Math.round(m.origin.x * d), y0 = Math.round(m.origin.y * d);
        for (const c of m.cells) {
          if (c.at > qp) continue;
          sg.fillStyle = M.COLORS[c.ch];
          sg.fillRect(x0 + c.x * u, y0 + c.y * u, u, u);
        }
      }
    }
    if (!m.steps.resolve && e >= MORPH.resolve) { m.steps.resolve = true; root.classList.remove('is-morphing'); }
    if (!m.steps.handoff && e >= MORPH.handoff) { m.steps.handoff = true; root.classList.remove('is-minkless'); }
    if (e >= MORPH.end) { endMorph(); return false; }
    return true;
  };
  const smoothstep = (k) => k * k * (3 - 2 * k);
  const endMorph = () => {
    const completed = morph;
    morph = null;
    if (completed && !completed.back) entryCompletion?.(completed.ctx, 'completed');
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.clearRect(0, 0, sky.width, sky.height);
    sky.style.display = 'none';
    window.AstridCore?.release?.();
    root.classList.remove('is-morphing', 'is-minkless');
  };

  // Clock
  let running = false, raf = 0, oneFrame = 0, last = 0, ticking = false, requested = false;
  const tick = (ctx) => {
    raf = 0;
    if (!running || paused || ctx !== entryCtx || !ctx?.isCurrent?.()) return;
    const t = now();
    ticking = true;
    const dt = Math.max(0, (t - (last || t)) / 1000);
    last = t;
    const morphing = morph ? (morph.back ? unmorph(t) : drawMorph(t)) : false;
    if (!running) { ticking = false; return; } // the fold back into slide 4 has just landed and stopped the demo
    // Coming back from slide 6 the finished editor waits, hidden, for the stack to fold back into it (dt-await).
    const busy = morphing | stepBeats(slide.classList.contains('dt-await') || morph?.back ? 0 : dt) | stepMink(t);
    drawPic(t);
    ticking = false;
    if (busy || requested) { requested = false; raf = requestAnimationFrame(() => tick(ctx)); }
  };
  const wake = () => { if (!running || paused) return; if (ticking) { requested = true; return; } if (!raf) { last = now(); const ctx = entryCtx; raf = requestAnimationFrame(() => tick(ctx)); } };
  const net = document.querySelector('.dt-net');
  const softenNet = (on, ctx = entryCtx) => {
    if (!net) return;
    if (!on) { window.deckClearNetMask?.(ctx, 'demo'); return; }
    const b = slide.querySelector('.split').getBoundingClientRect(), W = innerWidth, H = innerHeight, pad = 14;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'><filter id='f'><feGaussianBlur stdDeviation='12'/></filter><rect width='${W}' height='${H}' fill='white'/><rect x='${Math.round(b.left - pad)}' y='${Math.round(b.top - pad)}' width='${Math.round(b.width + 2 * pad)}' height='${Math.round(b.height + 2 * pad)}' rx='18' fill='black' fill-opacity='.75' filter='url(%23f)'/></svg>`;
    const value = `url("data:image/svg+xml,${svg.replace(/"/g, "'").replace(/</g, '%3C').replace(/>/g, '%3E')}")`;
    window.deckSetNetMask?.(ctx, 'demo', { image: value, mode: 'luminance', size: '100% 100%' });
  };
  const layout = () => { sizeMink(); sizePic(); measureTl(); placeHead(); if (slide.classList.contains('on')) softenNet(true, entryCtx); };
  new ResizeObserver((es) => { for (const e of es) if (e.target === tl) { measureTl(e.contentRect.width); placeHead(); } }).observe(tl);
  const start = (fromCore, ctx) => {
    entryCtx = ctx;
    if (document.hidden || document.getElementById('overview')?.classList.contains('on') || (window.deckStill?.() && !motionOff())) { pendingStart = fromCore; return; }
    pendingStart = null;
    bindMediaHandlers(ctx);
    slide.removeAttribute('data-as-rewind');
    root.classList.remove('as-unmorph', 'is-morphing', 'is-minkless'); // folded away on the way back to slide 4
    // Also warm direct #5 entry.
    window.warmDeckMedia(slide);
    running = true;
    layout();
    if (ctx?.from === 5 && ctx?.back) {
      settledState(); td = beatTimes(BEATS[BEATS.length - 1]).done; eventIndex = events.findIndex((event) => event.at > td); wait = 0;
      entryCompletion?.(ctx, 'completed'); wake(); return;
    }
    clearAll();
    td = 0; wait = 0; eventIndex = 0; videoGateSeeking = false; guideGateSeeking = false;
    if (motionOff() || ctx?.rest || ctx?.direct) {
      paint('profile', 0, 0); entryCompletion?.(ctx, 'completed'); wake(); return;
    }
    const snap = fromCore && window.AstridCore && window.AstridCore.snapshot();
    if (snap) startMorph(snap);
    else window.deckLater(() => { if (ctx?.isCurrent?.()) entryCompletion?.(ctx, 'completed'); }, 1800, ctx); // deliberate entry stage when no Core picture is available
    wake();
  };
  const stop = () => {
    slide.removeAttribute('data-as-rewind');
    clearPicFade();
    running = false;
    clearMediaHandlers();
    paused = false; pendingStart = null; pausedVideos = [];
    if (raf) cancelAnimationFrame(raf);
    if (oneFrame) cancelAnimationFrame(oneFrame);
    raf = 0; oneFrame = 0; requested = false;
    if (morph?.back) endUnmorph();
    if (morph) endMorph();
    softenNet(false);
    mink.seq = null; mink.hover = null;
    Object.assign(mink, { pose: 'profile', lift: 0, glint: 0 });
    videos.forEach((v) => v.pause());
  };
  window.AstridDemo = { turn, root };

  // ---- Going back to slide 4 ------------------------------------------------------------------
  // A step back: the morph from slide 4 played backwards. The panels fade as their frames fold back into the two
  // rings, the chat and editor layers shrink back into them, the mink dissolves from the neck up as her outline
  // rises back into the lens's, and the community's motes come home; then slide 4's own picture stands in its place.
  const fold = (ctx) => {
    reverseCtx = ctx;
    const snap = window.AstridCore && window.AstridCore.snapshot(); // slide 4 has settled before this runs
    if (!snap) return false;
    startMorph(snap, true, reverseCtx); // the same paths, measured from the editor as it stands (it hides slide 4's picture)
    morph.back = { e: MORPH.end - 1e-3, last: 0, shown: false };
    morph.steps = { resolve: true, handoff: true };
    ctx.present(slide, 'dt-rewind');
    ctx.present(coreSlide, 'dt-return dt-await');
    if (raf) cancelAnimationFrame(raf);
    raf = 0; last = now();
    wake();
    return true;
  };
  const unmorph = (t) => {
    const b = morph.back;
    b.e = Math.max(0, b.e - Math.max(0, (t - (b.last || t)) / 1000));
    b.last = t;
    const e = b.e;
    morph.steps = { resolve: e >= MORPH.resolve, handoff: e >= MORPH.handoff };
    if (e < MORPH.resolve + 0.5) root.classList.add('as-unmorph'); // the panels fade as their frames come back (as they faded in)
    root.classList.toggle('is-morphing', e < MORPH.resolve);
    root.classList.toggle('is-minkless', e < MORPH.handoff);
    if (!b.shown && e <= 0.7) { b.shown = true; reverseCtx.present(coreSlide, '', 'dt-await'); } // its labels come back as it forms
    morph.t0 = t - e * 1000;
    drawMorph(t);
    if (e <= 0) { endUnmorph(); reverseCompletion?.(reverseCtx, 'completed'); stop(); return false; }
    return true;
  };
  const endUnmorph = () => {
    if (!morph?.back) return;
    slide.removeAttribute('data-as-rewind');
    window.AstridCore?.show(); // the very picture the flight layer has just drawn
    endMorph(); // the sky is kept while slide 4 or 5 is up: the next turn between them flies on it
    root.classList.add('is-minkless'); // the editor and its mink stay folded away as slide 5 fades (until it next starts)
    reverseCtx.present(slide, 'dt-rewound', 'dt-rewind');
    reverseCtx.present(coreSlide, '', 'dt-return dt-await');
  };

  const coreHost = document.querySelector('[data-astrid-core]');
  const coreSlide = coreHost && coreHost.closest('.slide');
  const syncMotion = () => {
    if (motionOff() && slide.classList.contains('on') && morph && !morph.back) { endMorph(); entryCompletion?.(entryCtx, 'completed'); }
    if (motionBlocked() && morph?.back) { endUnmorph(); reverseCompletion?.(reverseCtx, 'completed'); stop(); return; } // a reverse never waits behind the overview
    if (motionBlocked()) {
      if (!running || paused) return;
      paused = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      pausedVideos = videos.filter((v) => !v.paused);
      // Also cancel a play request that has not yet changed the element's paused state.
      videos.forEach((v) => v.pause());
    } else if (slide.classList.contains('on')) {
      // An entry deferred behind the overview has no scene to resume yet.
      if (pendingStart !== null) { start(pendingStart, entryCtx); return; }
      if (!paused) { if (!running) { running = true; last = now(); wake(); } return; }
      paused = false;
      last = now();
      pausedVideos.forEach((v) => { if (v === guide) playGuide(); else v.play().catch(() => {}); });
      pausedVideos = [];
      wake();
    }
  };
  document.addEventListener('visibilitychange', syncMotion);
  window.addEventListener('deck-overview', syncMotion);
  window.addEventListener('deck-motion', syncMotion);
  const makeCompletion = (ctx, setter, cleanup) => {
    let resolve, settled = false;
    const promise = new Promise((done) => { resolve = done; });
    const finish = (owner, result) => {
      if (owner !== ctx || settled) return;
      settled = true;
      setter(null);
      resolve(result);
    };
    setter((owner, result) => finish(owner, result));
    ctx.defer(() => { finish(ctx, 'cancelled'); cleanup(); });
    return promise;
  };
  const enter = (ctx) => {
    const promise = makeCompletion(ctx, (fn) => { entryCompletion = fn; }, () => {
      if (entryCtx === ctx) { stop(); freeSky(); }
    });
    entryCtx = ctx;
    start(ctx.from === 3, ctx);
    return promise;
  };
  const exit = (ctx) => {
    if (ctx.from !== 4 || ctx.to !== 3 || !ctx.back || motionOff()) return undefined;
    const promise = makeCompletion(ctx, (fn) => { reverseCompletion = fn; }, () => {
      if (reverseCtx === ctx) {
        if (morph?.back) endUnmorph();
        stop(); freeSky();
      }
    });
    reverseCtx = ctx;
    slide.setAttribute('data-as-rewind', '');
    queueMicrotask(() => {
      if (reverseCtx !== ctx || !ctx.isCurrent() || !reverseCompletion) return;
      entryCtx = ctx; running = true; paused = false;
      if (!fold(ctx)) { slide.removeAttribute('data-as-rewind'); reverseCompletion?.(ctx, 'completed'); stop(); }
    });
    return promise;
  };
  const resize = (ctx) => {
    if (morph?.back && reverseCtx === ctx) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      endUnmorph(); reverseCompletion?.(ctx, 'completed'); stop();
    } else if (reverseCtx === ctx && reverseCompletion) {
      slide.removeAttribute('data-as-rewind'); reverseCompletion(ctx, 'completed'); stop();
    } else if (slide.classList.contains('on') && entryCtx === ctx) {
      if (morph) endMorph();
      layout(); drawPic(now());
      entryCompletion?.(ctx, 'completed');
      if (running && !paused) wake();
    }
  };
  window.deckRegisterScene?.([4], { enter, exit, resize });
  // Clicks on the demos stay here; they never turn the slide.
  root.addEventListener('click', (e) => { if (e.target.closest('.as-panel, .as-mink, .as-try')) e.stopPropagation(); }); // the link opens its tab and the slide stays
  clearAll();
})();
