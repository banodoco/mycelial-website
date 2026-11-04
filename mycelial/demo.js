// Slide 5 demo.
(() => {
  const root = document.querySelector('[data-astrid-demo]');
  if (!root) return;
  const slide = root.closest('.slide');
  const coreSlide = document.querySelector('[data-astrid-core]')?.closest('.slide');
  const link = slide.querySelector('.as-link');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionOff = () => still || window.deckStill?.();
  let entryCtx = null, entryCompletion = null;
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const easeIO = (q) => (q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2);
  // Keep absolute animation timestamps on the same clock across a pause.
  let paused = false;
  let pendingStart = null, pausedVideos = [];
  const motionBlocked = () => document.getElementById('overview')?.classList.contains('on') || window.deckStill?.();
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
  sceneEl.innerHTML = '<span class="as-film" data-bg="../assets/astrid/lantern-valley/guide-strip.webp"></span><span class="as-name">Lantern Valley · Three.js</span><span class="as-kind">14 s</span>';
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
  const guidePoster = root.querySelector('.as-guide-poster');
  const finalPoster = root.querySelector('.as-final-poster');
  // Mobile browsers may wait for play() before decoding their first frame.
  // Request playback at the production gate, rather than waiting for the frame
  // that only that request can produce. A denied or stalled film falls back to
  // its own poster; the tour still gives each stage its full hold.
  const MEDIA_STALL = 8000;
  let primingVideo = null;
  const mediaStates = new Map();
  const mediaState = (v) => {
    if (!mediaStates.has(v)) mediaStates.set(v, { pending: false, failed: false, at: now(), time: v.currentTime });
    return mediaStates.get(v);
  };
  const mediaMayPlay = (v) => running && !paused && !motionBlocked() && !mediaStates.get(v)?.failed && entryCtx?.isCurrent?.()
    && (primingVideo === v || (v === guide ? view.mode === 'guide' : view.mode === 'play'));
  const mediaUnavailable = (v) => {
    const state = mediaState(v);
    if (Math.abs(v.currentTime - state.time) > 0.01) { state.time = v.currentTime; state.at = now(); }
    if (!state.failed && (v.error || now() - state.at > MEDIA_STALL)) { state.failed = true; v.pause(); }
    return state.failed;
  };
  const requestPlay = (v) => {
    const state = mediaState(v);
    if (!mediaMayPlay(v) || state.failed || state.pending || !v.paused || !v.getAttribute('src')) return;
    state.pending = true;
    v.play().then(() => { if (!mediaMayPlay(v)) v.pause(); }).catch((error) => {
      if (mediaStates.get(v) === state && mediaMayPlay(v) && error.name !== 'AbortError') state.failed = true;
    }).finally(() => { state.pending = false; });
  };

  // The preview
  // mode: none | still | play.
  const view = { mode: 'none', i: -1, seq: -1, rate: 1, seekPending: false };
  let pdpr = 1;
  // The preview is redrawn only when what it shows can have changed: a playing film or a new still.
  // every frame, as before; an empty screen, a still, or a film not yet ready once. Its size on screen comes from a
  // ResizeObserver rather than a layout read every frame.
  let picCW = -1, picCH = -1, picKey = '';
  const outgoing = document.createElement('canvas'), og = outgoing.getContext('2d');
  const saved = document.createElement('canvas'), savedG = saved.getContext('2d');
  const PIC_FADE = 450;
  let picFade = null, hasPicFrame = false;
  const clearPicFade = () => { picFade = null; hasPicFrame = false; og?.clearRect(0, 0, outgoing.width, outgoing.height); };
  const fadePic = () => {
    if (motionOff() || !hasPicFrame || !og) return;
    // Capture the complete displayed result, including effects and any interrupted dissolve.
    if (outgoing.width !== pic.width) outgoing.width = pic.width;
    if (outgoing.height !== pic.height) outgoing.height = pic.height;
    og.clearRect(0, 0, outgoing.width, outgoing.height);
    og.drawImage(pic, 0, 0);
    picFade = { at: null };
    picKey = '';
  };
  const sizePic = () => {
    const b = pic.getBoundingClientRect();
    pdpr = Math.min(2, devicePixelRatio || 1);
    const width = Math.max(1, Math.round(b.width * pdpr)), height = Math.max(1, Math.round(b.height * pdpr));
    if (pic.width === width && pic.height === height) return;
    if (hasPicFrame && savedG) {
      if (saved.width !== pic.width) saved.width = pic.width;
      if (saved.height !== pic.height) saved.height = pic.height;
      savedG.clearRect(0, 0, saved.width, saved.height);
      savedG.drawImage(pic, 0, 0);
    }
    if (pic.width !== width) pic.width = width;
    if (pic.height !== height) pic.height = height;
    if (hasPicFrame && savedG && pg) pg.drawImage(saved, 0, 0, pic.width, pic.height);
    picKey = ''; // sizing a canvas clears it
  };
  new ResizeObserver((es) => { for (const e of es) { picCW = e.contentRect.width; picCH = e.contentRect.height; } }).observe(pic);
  const drawPic = (t) => {
    if (!pg) return;
    const cw = picCW < 0 ? pic.clientWidth : picCW, ch = picCH < 0 ? pic.clientHeight : picCH;
    if (Math.abs(cw * pdpr - pic.width) > 1 || Math.abs(ch * pdpr - pic.height) > 1) sizePic();
    const src = view.mode === 'still' ? anchors[view.i] : (view.mode === 'guide' || view.mode === 'guide-hold')
      ? (mediaStates.get(guide)?.failed ? guidePoster : guide) : view.mode === 'play'
        ? (mediaStates.get(videos[0])?.failed ? finalPoster : videos[0]) : null;
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
  // Frame changes cut with the playhead: a dissolve would leave the old frame visible at the new time.
  const showStill = (i) => { picFade = null; view.mode = 'still'; view.i = i; view.seq = -1; videos.forEach((v) => v.pause()); };
  const showGuide = () => {
    if (view.mode !== 'guide') fadePic();
    view.mode = 'guide'; view.i = -1; view.seq = 0; primingVideo = null;
    videos[0].pause();
    guide.playbackRate = 2.5;
    requestPlay(guide);
  };
  const playFrom = (seqT, rate, prepared = false) => { if (view.mode === 'still') picFade = null; else fadePic(); view.mode = 'play'; primingVideo = null; view.seq = seqT; view.rate = rate; view.i = -2; view.seekPending = !prepared; };
  const stepPlay = (dt) => {
    if (view.mode === 'guide') {
      if (mediaUnavailable(guide)) {
        view.seq = Math.min(SPAN, Math.max(0, view.seq, headT) + dt * 2.5);
        headTo(view.seq, true);
        if (view.seq >= SPAN) view.mode = 'guide-hold';
        return;
      }
      if (guide.ended) { headTo(SPAN, true); view.mode = 'guide-hold'; }
      else {
        if (guide.paused && !paused && !guide.seeking) requestPlay(guide);
        if (Number.isFinite(guide.duration) && guide.duration > 0) headTo(clamp(guide.currentTime / guide.duration) * SPAN, true);
      }
      return;
    }
    if (view.mode !== 'play') return;
    const video = videos[0];
    if (mediaUnavailable(video)) {
      view.seq = (Math.max(0, view.seq) + dt * view.rate) % SPAN;
      headTo(view.seq, true); return;
    }
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
    } else requestPlay(video);
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
  // Astrid thinks (the working state) for a second after each message is sent, before she replies.
  const THINK = 1;
  const BEATS = [
    { at: 0.1, ask: 'Make a 14-second Three.js bird flight over Lantern Valley.', reply: 'Lantern Valley is on your timeline: a 14-second live Three.js flight from the mountains down into town.', step: ['Built Lantern Valley', 'Three.js', '14 s live scene'], dur: 1.5 },
    { at: 4.7, ask: 'Can you make me realistic frames for that using Qwen Image 2.1?', reply: 'I made four realistic reference frames through VibeComfy: start, mountains, descent, and town.', step: ['Captured 4 reference frames', 'Qwen Image 2.1', 'VibeComfy'], dur: FRAME_STEP * FRAMES.length },
    { at: 9.6, ask: 'Now animate it with MiniMax H3 using the frames and guide.', reply: 'MiniMax H3 used all four frames and the 14-second motion guide. The finished shot is trimmed to 14 seconds.', step: ['Generated the final shot', 'MiniMax H3', '4 frames + motion guide · 14 s'], dur: 2.8 },
  ];
  // The stack uses the same finished conversation as this demo.
  window.astridDemoBeats = BEATS;
  for (let i = 1; i < BEATS.length; i++) {
    const previous = BEATS[i - 1], typeEnd = previous.at + previous.ask.length / CPS;
    BEATS[i].at = typeEnd + 0.45 + THINK + previous.dur + 0.45; // send + think + act lead-in, as in beatTimes
  }
  let td = -1, wait = 0, rows = [];
  // The chat follows the newest message until the viewer scrolls up; scrolling back to the bottom resumes it.
  let follow = true, followedRange = 0;
  // Phones use a clipped, bottom-justified two-row view. Its overflow can
  // extend above the origin; scrollHeight is not a positive scroll range.
  const chatEnd = () => getComputedStyle(msgs).justifyContent === 'flex-end' ? 0 : Math.max(0, msgs.scrollHeight - msgs.clientHeight);
  const toBottom = () => {
    if (!follow) return;
    followedRange = chatEnd();
    if (Math.abs(msgs.scrollTop - followedRange) > .5) msgs.scrollTop = followedRange;
  };
  // Keep a followed conversation pinned when fonts, the avatar, or the panel
  // size change. ResizeObserver runs after layout and before the next paint.
  const chatLayout = new ResizeObserver(() => { if (running) toBottom(); });
  chatLayout.observe(msgs);
  msgs.addEventListener('scroll', () => {
    if (getComputedStyle(msgs).justifyContent === 'flex-end') { follow = true; toBottom(); return; }
    const range = chatEnd();
    // WebKit can dispatch its layout/anchor scroll before ResizeObserver.
    // A changed scroll range is not a reader choosing to leave the bottom.
    if (follow && range !== followedRange) { toBottom(); return; }
    follow = msgs.scrollTop >= range - 12;
    followedRange = range;
  }, { passive: true });
  const bubble = (cls, html, scroll = true) => {
    const el = document.createElement('div');
    el.className = `${cls} as-in`;
    el.innerHTML = html;
    msgs.appendChild(el);
    chatLayout.observe(el);
    while (msgs.children.length > 40) { chatLayout.unobserve(msgs.firstChild); msgs.firstChild.remove(); }
    if (scroll) toBottom();
    return el;
  };
  const clearAll = () => {
    clearPicFade();
    if (pg) { pg.setTransform(1, 0, 0, 1, 0, 0); pg.clearRect(0, 0, pic.width, pic.height); }
    root.classList.remove('has-frame');
    picKey = '';
    [...msgs.children].forEach((row) => chatLayout.unobserve(row));
    msgs.innerHTML = ''; follow = true;
    typed.textContent = ''; rows = [];
    root.classList.remove('is-typing', 'has-draft', 'is-working', 'is-playing', 'is-resetting');
    anchorEls.forEach((el) => { el.className = 'as-clip as-frame-clip'; el.style.opacity = '0'; kind(el, 'Qwen'); });
    sceneEl.className = 'as-clip as-scene-clip'; sceneEl.style.opacity = '0';
    resultEl.className = 'as-clip as-result-clip'; resultEl.style.opacity = '0';
    primingVideo = null; mediaStates.clear();
    view.mode = 'none'; view.i = -1; view.seq = -1; view.seekPending = false; total = SPAN;
    videos.forEach((v) => v.pause());
    headTo(0, true);
  };
  const beatTimes = (b) => {
    const typeEnd = b.at + b.ask.length / CPS, send = typeEnd + 0.25, reply = send + THINK;
    return { typeEnd, send, reply, act: reply + 0.2, done: reply + 0.2 + b.dur };
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
  // Count only active tour time at each image gate, so an overview pause does
  // not consume the loading allowance. A broken image can fall through at once.
  let imageGate = null, imageGateWait = 0;
  let videoGateSeeking = false, guideGateSeeking = false;
  const gateReady = (event, dt = 0) => {
    if (event.guideEnd) return guide.ended || (mediaUnavailable(guide) && view.mode === 'guide-hold');
    if (event.bi === 0 && event.offset === 0.65) {
      primingVideo = guide;
      guide.playbackRate = 2.5;
      if (!guideGateSeeking && guide.readyState >= 1) {
        try { if (guide.currentTime > 0.01) guide.currentTime = 0; guideGateSeeking = true; } catch { /* retry after metadata */ }
      }
      requestPlay(guide);
      return mediaUnavailable(guide) || (guide.readyState >= 2 && !guide.seeking);
    }
    if (event.bi === 1) {
      const i = FRAMES.findIndex((_, n) => Math.abs(event.offset - (n * FRAME_STEP + 0.32)) < 1e-7);
      if (i >= 0) {
        const img = anchors[i];
        if (imageReady(img)) return true;
        if (img.getAttribute('src') && img.complete) return true;
        if (imageGate !== event) { imageGate = event; imageGateWait = 0; }
        imageGateWait += dt;
        return imageGateWait >= MEDIA_STALL / 1000;
      }
    }
    if (event.bi === 2 && event.offset === 0.55) {
      const v = videos[0];
      primingVideo = v;
      if (!videoGateSeeking && v.readyState >= 1) {
        try { if (v.currentTime > 0.01) v.currentTime = 0; videoGateSeeking = true; } catch { /* retry after metadata */ }
      }
      requestPlay(v);
      return mediaUnavailable(v) || (v.readyState >= 2 && !v.seeking);
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
        bubble('as-msg is-astrid as-thinking', '<i></i><span>Thinking…</span>');
      }
      if (passed(T.reply)) {
        msgs.querySelectorAll('.as-thinking').forEach((el) => { chatLayout.unobserve(el); el.remove(); });
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
      if (!gateReady(event, dt)) { target = event.at; break; }
      advanceBeats(td, event.at);
      td = event.at;
      eventIndex++;
      if (event.at === LOOP) {
        const remaining = target - LOOP;
        clearAll(); td = 0; eventIndex = 0; videoGateSeeking = false; guideGateSeeking = false; imageGate = null; imageGateWait = 0;
        target = remaining;
      }
    }
    // Stop just before a blocked event so it fires when readiness arrives.
    if (eventIndex < events.length && target === events[eventIndex].at && !gateReady(events[eventIndex])) {
      const before = Math.max(td, target - 1e-7);
      advanceBeats(td, before); td = before;
    } else { advanceBeats(td, target); td = target; }
    stepPlay(dt);
    stepHead(dt);
    return true;
  };
  // What each beat does to the editor, a seconds into its work (p: where it was last frame).
  const act = (bi, a, p) => {
    const at = (x) => p < x - 1e-8 && a >= x - 1e-8;
    const touch = (el, on) => el.classList.toggle('is-touched', on);
    if (bi === 0) {
      if (at(0)) { sceneEl.style.opacity = ''; sceneEl.classList.add('is-generating'); touch(sceneEl, true); total = SPAN; headTo(0, true); }
      if (at(0.65)) { sceneEl.classList.remove('is-generating'); sceneEl.classList.add('is-ready', 'is-animated'); showGuide(); headTo(0, true); }
      if (at(1.2)) touch(sceneEl, false);
    }
    if (bi === 1) {
      FRAMES.forEach((frame, i) => {
        const el = anchorEls[i], start = i * FRAME_STEP;
        if (at(start)) { el.style.opacity = ''; el.classList.add('is-generating'); touch(el, true); }
        if (at(start + 0.32)) { el.classList.remove('is-generating'); el.classList.add('is-ready'); headTo(frame.at, true); showStill(i); total = SPAN; }
        if (at(start + 0.5)) touch(el, false);
      });
    }
    if (bi === 2) {
      if (at(0)) { resultEl.style.opacity = ''; resultEl.classList.add('is-generating'); touch(resultEl, true); total = SPAN; }
      if (at(0.55)) { resultEl.classList.remove('is-generating'); resultEl.classList.add('is-ready', 'is-animated'); touch(resultEl, false); headTo(0, true); playFrom(0, 1, true); root.classList.add('is-playing'); }
    }
  };
  const settledState = () => { // everything as it ends, for reduced motion
    clearAll();
    BEATS.forEach((b) => {
      bubble('as-msg is-user', b.ask, false);
      bubble('as-msg is-astrid', b.reply, false);
      bubble('as-step is-done', `<i></i><span>${b.step[0]}</span><code><b>${b.step[1]}</b> ${b.step[2]}</code>`, false);
    });
    msgs.querySelectorAll('.as-in').forEach((el) => el.classList.remove('as-in'));
    toBottom();
    sceneEl.style.opacity = ''; sceneEl.classList.add('is-ready', 'is-animated');
    anchorEls.forEach((el) => { el.style.opacity = ''; el.classList.add('is-ready'); kind(el, 'Qwen'); });
    resultEl.style.opacity = ''; resultEl.classList.add('is-ready', 'is-animated');
    total = SPAN;
    if (still) {
      view.mode = 'play'; view.i = 0; view.seq = 4;
      try { videos[0].currentTime = 4; } catch { /* not loaded */ }
    } else playFrom(4, 1);
    headTo(4, true); stepHead(0);
  };

  // Two Core rings unfold into the live panel frames, with Astrid flying to
  // her avatar. The editor remains mounted and visible throughout the flight.
  let flight = null;
  // The tiny built-in sprite also covers a slow or failed avatar image load.
  const flightSprite = document.createElement('canvas');
  flightSprite.width = 23; flightSprite.height = 20;
  const spriteContext = flightSprite.getContext('2d'), minkArt = window.AstridMink;
  const spriteCells = [];
  if (spriteContext && minkArt) minkArt.POSES.profile.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') spriteCells.push({ x, y, color: minkArt.COLORS[ch], at: (y + (22 - x) * 0.35) / (19 + 22 * 0.35) });
  }));
  // The destination is the exact same pixels as the flying sprite. A local
  // data URL keeps the landing visible even if its tiny image is slow or fails.
  const avatarImage = root.querySelector('.as-avatar img');
  let avatarFallback = '';
  if (spriteContext && spriteCells.length) {
    for (const cell of spriteCells) { spriteContext.fillStyle = cell.color; spriteContext.fillRect(cell.x, cell.y, 1, 1); }
    try { avatarFallback = flightSprite.toDataURL(); } catch { /* The normal image remains the fallback. */ }
  }
  const ensureAvatar = () => {
    if (avatarFallback && (!avatarImage.complete || !avatarImage.naturalWidth) && avatarImage.src !== avatarFallback) avatarImage.src = avatarFallback;
  };
  avatarImage.addEventListener('error', ensureAvatar);
  const stopFlight = () => {
    if (!flight) return;
    cancelAnimationFrame(flight.raf);
    const { done, ctx, back, oldOpacity, avatarImage, oldAvatarOpacity, releaseText, coreArt, oldCoreOpacity, oldCoreTransition } = flight;
    releaseText?.();
    if (back) {
      ctx.present(slide, '', 'dt-rewind');
      coreArt.style.opacity = oldCoreOpacity; coreArt.style.transition = oldCoreTransition;
    }
    ctx.present(coreSlide, '', 'dt-return dt-await');
    root.style.opacity = oldOpacity;
    avatarImage.style.opacity = oldAvatarOpacity;
    flight.canvas.remove(); flight = null; done?.('completed');
  };
  const roundFrame = (b, n) => {
    const rad = Math.min(12, b.width / 2, b.height / 2), pts = [[b.left + b.width / 2, b.top], [b.right - rad, b.top]];
    const arc = (x, y, a) => { for (let i = 1; i <= 8; i++) { const t = a + i * Math.PI / 16; pts.push([x + Math.cos(t) * rad, y + Math.sin(t) * rad]); } };
    arc(b.right - rad, b.top + rad, -Math.PI / 2); pts.push([b.right, b.bottom - rad]);
    arc(b.right - rad, b.bottom - rad, 0); pts.push([b.left + rad, b.bottom]);
    arc(b.left + rad, b.bottom - rad, Math.PI / 2); pts.push([b.left, b.top + rad]);
    arc(b.left + rad, b.top + rad, Math.PI); pts.push([b.left + b.width / 2, b.top]);
    const lengths = [0];
    for (let i = 1; i < pts.length; i++) lengths.push(lengths[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return Array.from({ length: n }, (_, i) => {
      const d = i / n * lengths.at(-1); let j = 1;
      while (lengths[j] < d) j++;
      const q = (d - lengths[j - 1]) / (lengths[j] - lengths[j - 1] || 1);
      return [pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * q, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * q];
    });
  };
  const startFlight = (ctx, back) => {
    stopFlight();
    if (!coreSlide || motionOff() || ctx.direct || (ctx.rest && !back)) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'as-core-flight'; canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '100', pointerEvents: 'none' });
    const g = canvas.getContext('2d'); if (!g) return;
    let done; const completion = new Promise(resolve => { done = resolve; });
    const coreArt = coreSlide.querySelector('[data-astrid-core]');
    const f = flight = { canvas, raf: 0, done, ctx, back, oldOpacity: root.style.opacity, avatarImage, oldAvatarOpacity: avatarImage.style.opacity,
      coreArt, oldCoreOpacity: coreArt.style.opacity, oldCoreTransition: coreArt.style.transition };
    if (!back) avatarImage.style.opacity = '0';
    if (back) {
      ctx.present(slide, 'dt-rewind');
      ctx.present(coreSlide, 'dt-return dt-await');
      coreArt.style.transition = 'none'; coreArt.style.opacity = '0';
      // Do not reveal Core's headline through the still-visible editor.
      f.releaseText = ctx.holdText(() => stopFlight(), 3000);
    }
    else { ctx.present(coreSlide, 'dt-return'); root.style.opacity = '0.22'; }
    document.body.appendChild(canvas);
    ctx.defer(() => { if (flight === f) stopFlight(); });
    f.raf = requestAnimationFrame(() => {
      if (flight !== f || !ctx.isTransitionCurrent()) return stopFlight();
      const core = window.AstridCoreGeometry?.();
      // Slide 5 can still be sliding into place: measure its final viewport
      // coordinates, not the transient transform on this first frame.
      const shift = slide.getBoundingClientRect().top;
      const finalBox = (el) => { const b = el.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top - shift, bottom: b.bottom - shift, width: b.width, height: b.height }; };
      const boxes = [root.querySelector('.as-chat'), root.querySelector('.as-edit')].map(finalBox);
      const avatar = finalBox(avatarImage), avatarCircle = finalBox(root.querySelector('.as-avatar'));
      if (!core || !minkArt || !spriteContext || boxes.some(b => !b.width || !b.height)) return stopFlight();
      const dpr = Math.min(2, devicePixelRatio || 1), w = innerWidth, h = innerHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const frames = boxes.map(b => roundFrame(b, 180));
      const xs = core.outline.map(p => p[0]), ys = core.outline.map(p => p[1]);
      const bounds = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
      const origin = { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
      const target = { x: avatar.left + avatar.width / 2, y: avatar.top + avatar.height / 2 };
      const distance = Math.hypot(target.x - origin.x, target.y - origin.y);
      const rise = innerWidth <= 760 ? clamp(distance * 0.35, 30, 110) : clamp(distance * 0.45, 60, 200);
      const control = { x: (origin.x + target.x) / 2, y: Math.max(slide.querySelector('.split h1').getBoundingClientRect().bottom - shift + 10, Math.min(origin.y, target.y) - rise) };
      const spritePoint = ([x, y]) => [avatar.left + x * 1.44, avatar.top + ((y - 1.5) * 1.345 + 0.5)];
      const outlineTo = minkArt.smooth(minkArt.OUTLINE, 10).map(spritePoint), throatTo = minkArt.smooth(minkArt.THROAT, 10).map(spritePoint);
      // A small, deterministic echo of the original slot and orbit motes.
      const motes = core.slots.flatMap((slot, i) => Array.from({ length: 3 }, (_, j) => {
        const box = boxes[slot.side], v = ((i * 17 + j * 29) % 97) / 97;
        return { x: slot.x, y: slot.y, tx: box.left + box.width * (0.15 + 0.7 * v), ty: box.bottom - box.height * (0.08 + 0.22 * ((v * 3) % 1)), delay: 0.1 + v * 0.25, r: 0.8 + v * 0.8 };
      }));
      core.orbit.forEach((p, i) => {
        const dx = p.x - origin.x, dy = p.y - origin.y, length = Math.hypot(dx, dy) || 1, v = (i * 37 % 97) / 97;
        motes.push({ x: p.x, y: p.y, tx: p.x + dx / length * (40 + 60 * v), ty: p.y + dy / length * (40 + 60 * v) + 30, delay: v * 0.3, r: 0.7 + v * 0.5, away: true });
      });
      let first = null;
      const draw = () => {
        if (flight !== f || !ctx.isTransitionCurrent() || motionOff() || innerWidth !== w || innerHeight !== h) return stopFlight();
        const t = ctx.now();
        if (first === null) first = t;
        const elapsed = Math.min(back ? 2.1 : 1.85, (t - first) / 1000), e = back ? Math.max(0, 1.85 - elapsed) : elapsed;
        const cross = back ? clamp((elapsed - 1.45) / 0.6) : 0;
        const coreMix = cross * cross * (3 - 2 * cross);
        const q = easeIO(clamp((e - 0.05) / 1.15));
        const departure = back ? 1 - clamp((elapsed - 1.45) / 0.35) : 1;
        root.style.opacity = String((0.22 + 0.78 * q) * Math.max(0.001, departure));
        // Once the sprite reaches the avatar, the identical destination pixels
        // sit beneath it as it dissolves. They never occupy separate positions.
        avatarImage.style.opacity = e < 1.25 ? '0' : f.oldAvatarOpacity;
        if (back && cross > 0) {
          if (!f.coreShown) { f.coreShown = true; ctx.present(coreSlide, '', 'dt-await'); }
          coreArt.style.opacity = String(coreMix);
        }
        if (back && elapsed >= 1.8 && f.releaseText) { f.releaseText(); f.releaseText = null; }
        // Fade at either end so the real Core and panel edges remain the only settled pictures.
        const edge = back ? Math.min(1, elapsed / 0.18) * (1 - coreMix) : Math.min(1, elapsed / 0.18, (1.85 - elapsed) / 0.3);
        const alpha = edge * (1 - clamp((e - 1.15) / 0.45));
        g.clearRect(0, 0, w, h); g.lineWidth = core.lineWidth + (1.2 - core.lineWidth) * q; g.strokeStyle = `rgba(240,200,119,${0.8 * alpha})`;
        core.rings.forEach((r, side) => {
          g.beginPath(); frames[side].forEach(([x, y], i) => {
            const [px, py] = r.strand[i];
            const xx = px + (x - px) * q, yy = py + (y - py) * q;
            i ? g.lineTo(xx, yy) : g.moveTo(xx, yy);
          }); g.closePath(); g.stroke();
        });
        for (const p of motes) {
          const m = clamp((e - p.delay) / 0.9); if (m <= 0 || m >= 1) continue;
          const v = p.away ? 1 - Math.pow(1 - m, 3) : easeIO(m); g.fillStyle = `rgba(255,217,145,${(p.away ? 0.45 : 0.7) * Math.sin(Math.PI * m) * edge})`;
          g.beginPath(); g.arc(p.x + (p.tx - p.x) * v, p.y + (p.ty - p.y) * v, p.r, 0, Math.PI * 2); g.fill();
        }
        const jump = clamp((e - 0.4) / 0.85), u = jump * jump * (3 - 2 * jump), v = 1 - u;
        const arcX = 2 * v * u * (control.x - (origin.x + target.x) / 2);
        const arcY = 2 * v * u * (control.y - (origin.y + target.y) / 2);
        const x = v * origin.x + u * target.x + arcX, y = v * origin.y + u * target.y + arcY;
        const fill = clamp((e - 0.05) / 0.35);
        // The real Core's thread becomes the profile from the head down, then
        // follows the same arc to the avatar. At the Core end both bounds match.
        if (fill < 1) {
          for (const [from, to, width, opacity] of [[core.outline, outlineTo, 1.2, 0.9], [core.throat, throatTo, 0.8, 0.45]]) {
            g.lineWidth = width; g.strokeStyle = `rgba(255,217,145,${opacity * (1 - fill) * edge})`; g.beginPath();
            from.forEach(([px, py], i) => { const xx = px + (to[i][0] - px) * u + arcX, yy = py + (to[i][1] - py) * u + arcY; i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }); g.stroke();
          }
          g.fillStyle = `rgba(255,236,200,${(1 - fill) * edge})`; g.beginPath();
          g.arc(core.eye.x + (avatar.left + 16 - core.eye.x) * u + arcX, core.eye.y + (avatar.top + 5 - core.eye.y) * u + arcY, 3 * (1 - u) + u, 0, Math.PI * 2); g.fill();
        }
        if (fill > 0) {
          spriteContext.clearRect(0, 0, 23, 20);
          for (const cell of spriteCells) if (cell.at <= fill) { spriteContext.fillStyle = cell.color; spriteContext.fillRect(cell.x, cell.y, 1, 1); }
          const width = (bounds.right - bounds.left) * (1 - u * u) + avatar.width * u * u;
          const height = (bounds.bottom - bounds.top) * (1 - u * u) + avatar.height * u * u;
          g.save();
          if (u >= 1) {
            g.beginPath(); g.arc(avatarCircle.left + avatarCircle.width / 2, avatarCircle.top + avatarCircle.height / 2, avatarCircle.width / 2, 0, Math.PI * 2); g.clip();
          }
          g.globalAlpha = edge * (1 - clamp((e - 1.25) / 0.35));
          g.imageSmoothingEnabled = false; g.drawImage(flightSprite, x - width / 2, y - height / 2, width, height); g.restore();
        }
        if (elapsed >= (back ? 2.1 : 1.85)) stopFlight(); else f.raf = requestAnimationFrame(draw);
      };
      f.raf = requestAnimationFrame(draw);
    });
    return completion;
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
    // Coming back from slide 6 the finished editor waits, hidden, for the stack to fold back into it (dt-await).
    const busy = stepBeats(slide.classList.contains('dt-await') ? 0 : dt);
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
  const layout = () => { sizePic(); measureTl(); placeHead(); toBottom(); if (slide.classList.contains('on')) softenNet(true, entryCtx); };
  new ResizeObserver((es) => { for (const e of es) if (e.target === tl) { measureTl(e.contentRect.width); placeHead(); } }).observe(tl);
  const start = (ctx) => {
    entryCtx = ctx;
    if (document.getElementById('overview')?.classList.contains('on') || (window.deckStill?.() && !motionOff())) { pendingStart = ctx; return; }
    pendingStart = null;
    bindMediaHandlers(ctx);
    // Also warm direct #5 entry.
    window.warmDeckMedia(slide);
    ensureAvatar();
    running = true;
    layout();
    // Reduced motion uses direct navigation (back is false), but it still
    // needs the same finished conversation on a return from the stack.
    if (motionOff() || (ctx?.from === 5 && (ctx?.back || ctx?.dir < 0))) {
      settledState(); td = beatTimes(BEATS[BEATS.length - 1]).done; eventIndex = events.findIndex((event) => event.at > td); wait = 0;
      entryCompletion?.(ctx, 'completed'); wake(); return;
    }
    clearAll();
    td = 0; wait = 0; eventIndex = 0; videoGateSeeking = false; guideGateSeeking = false; imageGate = null; imageGateWait = 0;
    if (motionOff() || ctx?.rest || ctx?.direct) {
      entryCompletion?.(ctx, 'completed'); wake(); return;
    }
    if (ctx.from === 3) startFlight(ctx, false);
    // The live editor stays mounted while the decorative flight runs.
    wait = 1.8;
    window.deckLater(() => { if (ctx?.isCurrent?.()) entryCompletion?.(ctx, 'completed'); }, 1800, ctx);
    wake();
  };
  const stop = () => {
    clearPicFade();
    running = false;
    clearMediaHandlers();
    paused = false; pendingStart = null; pausedVideos = [];
    if (raf) cancelAnimationFrame(raf);
    if (oneFrame) cancelAnimationFrame(oneFrame);
    raf = 0; oneFrame = 0; requested = false;
    softenNet(false);
    videos.forEach((v) => v.pause());
  };

  const syncMotion = () => {
    if (motionOff() || motionBlocked()) stopFlight();
    if (motionOff() && slide.classList.contains('on')) entryCompletion?.(entryCtx, 'completed');
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
      if (pendingStart !== null) { start(pendingStart); return; }
      if (!paused) { if (!running) { running = true; last = now(); wake(); } return; }
      paused = false;
      last = now();
      pausedVideos.forEach((v) => requestPlay(v));
      pausedVideos = [];
      wake();
    }
  };
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
    link.classList.remove('is-underlined');
    const promise = makeCompletion(ctx, (fn) => { entryCompletion = fn; }, () => {
      if (entryCtx === ctx) { stop(); }
    });
    entryCtx = ctx;
    start(ctx);
    return promise;
  };
  const exit = (ctx) => { stop(); if (ctx.to === 3 && ctx.back) return startFlight(ctx, true); };
  const resize = (ctx) => {
    stopFlight();
    if (!slide.classList.contains('on') || entryCtx !== ctx) return true;
    if (!root.getBoundingClientRect().width || !root.getBoundingClientRect().height) return false;
    layout(); drawPic(now());
    entryCompletion?.(ctx, 'completed');
    if (running && !paused) wake();
    return true;
  };
  const restore = (ctx) => {
    if (ctx.to !== 4) return true;
    if (!root.getBoundingClientRect().width || !root.getBoundingClientRect().height) return false;
    drawPic(now()); softenNet(true, ctx);
    return true;
  };
  window.deckRegisterScene?.([4], { enter, exit, restore, resize });
  // The editor's tour continues after entry. Join entry/network/copy readiness
  // and the slide's own CSS arrival (not its descendants' ongoing animation).
  // Geometry refreshes keep the underline; a new visit starts it afresh.
  const underline = async () => {
    const ctx = entryCtx;
    const current = () => ctx?.isCurrent() && ctx === entryCtx && slide.hasAttribute('data-settled');
    if (!current() || link.classList.contains('is-underlined')) return;
    while (!motionOff()) {
      const arriving = slide.getAnimations().filter((a) => a.playState !== 'finished' && Number.isFinite(a.effect.getComputedTiming().endTime));
      if (!arriving.length) break;
      await Promise.allSettled(arriving.map((a) => a.finished));
      if (!current()) return;
    }
    link.classList.add('is-underlined');
  };
  window.addEventListener('deck-transaction', underline);
  link.addEventListener('click', (e) => e.stopPropagation());
  // Clicks on the demos stay here; they never turn the slide.
  root.addEventListener('click', (e) => { if (e.target.closest('.as-panel')) e.stopPropagation(); });
  clearAll();
})();
