/* FLIGHT RECORDER (?diag=1). A classic script that index.html injects as its
   very first script, and only when the URL carries `diag` (no request, no
   global, no listener otherwise). It lives at the root, outside the runtime
   snapshot, so it records every `?rt=` build the same way.

   It is written to survive the page dying. Every event lands in a small ring
   in localStorage as it happens (batched to the end of the task, and written
   at once before the risky phases: the runtime choice, each WebGL context,
   every performance mark the site makes, intro start/end), and a heartbeat
   key is rewritten every 500 ms with the longest frame gap since the last
   one. A tab that crashes or is killed while unresponsive never writes its
   `end` key, so the NEXT `?diag=1` load can say "did not finish cleanly:
   last heartbeat at T, last event ..., longest task ...".

   It reads the page only from outside: window.sceneApi, window.journey,
   classes on <html>/<body>, performance entries, the canvases. Every probe
   is wrapped, feature-checked and time-boxed (a probe that took > 4 ms makes
   the next one skip), so it runs against any retained snapshot.

   `?diag=quiet` records without the panel. Nothing here changes what the
   page does; the only hooks are pass-through wrappers on getContext,
   performance.mark/measure, console.error/warn and (for the first minute)
   the WebGL draw calls, which it counts. */
(() => {
  'use strict';
  if (window.__diag) return;
  const now = () => performance.now();
  const params = new URLSearchParams(location.search);
  const QUIET = params.get('diag') === 'quiet';
  const PREFIX = 'mdiag:';
  const INDEX_KEY = PREFIX + 'index';
  const MAX_EVENTS = 400;
  const MAX_SESSIONS = 6;
  const FAST_PROBE_UNTIL = 20000, PROBE_UNTIL = 60000, SLOW_PROBE_UNTIL = 180000;
  const DRAW_COUNT_UNTIL = 60000;
  const VERDICTS_AT = [8000, 15000, 30000, 60000];
  const LUMA = params.get('luma') !== '0';   // ?luma=0: no canvas readback at all

  let store = null;
  try { store = window.localStorage; store.getItem(INDEX_KEY); } catch { store = null; }
  const read = (key) => { try { const v = store && store.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } };
  const remove = (key) => { try { if (store) store.removeItem(key); } catch {} };

  const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  const keyOf = (part) => PREFIX + id + ':' + part;
  const startedWall = Date.now() - Math.round(now());

  /* ---------- the previous sessions, read before this one is written ---------- */
  let index = read(INDEX_KEY);
  if (!Array.isArray(index)) index = [];
  const loadSession = (sid) => ({
    id: sid,
    meta: read(PREFIX + sid + ':meta'),
    events: read(PREFIX + sid + ':ev') || [],
    heartbeat: read(PREFIX + sid + ':hb'),
    end: read(PREFIX + sid + ':end'),
    resources: read(PREFIX + sid + ':res'),
  });
  const previous = index.slice(-(MAX_SESSIONS - 1)).reverse().map(loadSession).filter(s => s.meta);
  // Retire the oldest so this session fits in the ring.
  const keep = index.slice(-(MAX_SESSIONS - 1));
  for (const old of index.slice(0, Math.max(0, index.length - keep.length))) {
    for (const part of ['meta', 'ev', 'hb', 'end', 'res']) remove(PREFIX + old + ':' + part);
  }
  index = keep.concat(id);

  /* ---------- storage ---------- */
  let storageFailed = false;
  function write(key, value) {
    if (!store || storageFailed) return false;
    const text = JSON.stringify(value);
    for (let attempt = 0; attempt < 3; attempt++) {
      try { store.setItem(key, text); return true; } catch {
        // Quota: give up the oldest previous session and try again.
        const oldest = index.length > 1 ? index.shift() : null;
        if (!oldest) break;
        for (const part of ['meta', 'ev', 'hb', 'end', 'res']) remove(PREFIX + oldest + ':' + part);
        try { store.setItem(INDEX_KEY, JSON.stringify(index)); } catch {}
      }
    }
    storageFailed = true;
    return false;
  }

  const events = [];
  let dirty = false, flushTimer = 0;
  function flush() {
    flushTimer = 0;
    if (!dirty) return;
    dirty = false;
    write(keyOf('ev'), events);
  }
  const round = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(v * 10) / 10 : v);
  let lastEvent = null;
  const listeners = [];
  /** Record one event: { t: ms since navigation start, k: kind, ...data }. */
  function log(k, data, { urgent = false } = {}) {
    const entry = Object.assign({ t: Math.round(now()), k }, data);
    events.push(entry);
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
    lastEvent = entry;
    dirty = true;
    if (urgent) flush();
    else if (!flushTimer) flushTimer = setTimeout(flush, 0);
    for (const fn of listeners) { try { fn(entry); } catch {} }
    return entry;
  }

  /* ---------- environment ---------- */
  const meta = {
    id, format: 'mycelial-diag/1', startedAt: new Date(startedWall).toISOString(),
    url: location.pathname + location.search,
    rt: params.get('rt'), build: null, override: null,
    ua: navigator.userAgent,
    platform: navigator.userAgentData ? navigator.userAgentData.platform : navigator.platform,
    deviceMemory: navigator.deviceMemory ?? null,
    cores: navigator.hardwareConcurrency ?? null,
    dpr: window.devicePixelRatio,
    screen: [screen.width, screen.height, screen.availWidth, screen.availHeight],
    viewport: [window.innerWidth, window.innerHeight],
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    visibility: document.visibilityState,
    navigation: null, gpu: null, maxTexture: null, jsHeapLimitMB: null,
    verdicts: [],
  };
  try { meta.navigation = performance.getEntriesByType('navigation')[0]?.type || null; } catch {}
  try { if (performance.memory) meta.jsHeapLimitMB = Math.round(performance.memory.jsHeapSizeLimit / 1048576); } catch {}
  try { meta.connection = navigator.connection ? navigator.connection.effectiveType : null; } catch {}
  const saveMeta = () => write(keyOf('meta'), meta);
  try { store && store.setItem(INDEX_KEY, JSON.stringify(index)); } catch { storageFailed = true; }
  saveMeta();
  log('start', { url: meta.url, mem: meta.deviceMemory, cores: meta.cores, dpr: meta.dpr, vp: meta.viewport.join('x') }, { urgent: true });

  /* ---------- the runtime choice (runtime-release.js sets these next) ---------- */
  let runtimeBase;
  try {
    Object.defineProperty(window, '__runtimeBase', {
      configurable: true, enumerable: true,
      get() { return runtimeBase; },
      set(value) {
        runtimeBase = value;
        const m = /runtime\/([0-9a-f]{64})\//.exec(String(value));
        meta.build = m ? m[1] : String(value);
        const o = window.__runtimeOverride;
        meta.override = o ? { requested: o.requested, hash: o.hash, live: o.live, problem: o.problem } : null;
        saveMeta();
        log('runtime', { build: m ? m[1].slice(0, 12) : String(value), rt: meta.rt, override: o ? (o.problem || (o.live ? 'live' : 'older')) : null }, { urgent: true });
      },
    });
  } catch {}

  /* ---------- errors, console, visibility, page end ---------- */
  const firstFrame = (stack) => {
    if (typeof stack !== 'string') return null;
    const line = stack.split('\n').map(s => s.trim()).find(s => /:\d+:\d+\)?$/.test(s));
    return line ? line.slice(0, 200) : null;
  };
  const shortUrl = (url) => String(url || '').replace(location.origin, '').replace(/runtime\/([0-9a-f]{8})[0-9a-f]{56}\//, 'runtime/$1/').slice(0, 160);
  const counts = { errors: 0, rejections: 0, consoleErrors: 0, lost: 0, restored: 0, longTasks: 0, longTaskMs: 0, loafs: 0 };
  let longest = null;   // the longest task or animation frame seen
  addEventListener('error', (e) => {
    const target = e.target;
    if (target && target !== window && (target.src || target.href)) {
      counts.errors++;
      log('load-error', { tag: target.tagName, src: shortUrl(target.src || target.href) }, { urgent: true });
      return;
    }
    counts.errors++;
    log('error', { msg: String(e.message || '').slice(0, 300), at: e.filename ? shortUrl(e.filename) + ':' + e.lineno + ':' + e.colno : null, frame: firstFrame(e.error && e.error.stack) }, { urgent: true });
  }, true);
  addEventListener('unhandledrejection', (e) => {
    counts.rejections++;
    const r = e.reason;
    log('rejection', { msg: String((r && r.message) || r).slice(0, 300), frame: firstFrame(r && r.stack) }, { urgent: true });
  }, true);
  for (const level of ['error', 'warn']) {
    const original = console[level];
    if (typeof original !== 'function') continue;
    let n = 0;
    console[level] = function (...args) {
      try {
        if (level === 'error') counts.consoleErrors++;
        if (n++ < 60) log('console-' + level, { msg: args.map(a => (a && a.message) || (typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })())).join(' ').slice(0, 300) });
      } catch {}
      return original.apply(this, args);
    };
  }
  let hiddenSince = document.visibilityState === 'hidden' ? now() : null;
  document.addEventListener('visibilitychange', () => {
    log('visibility', { state: document.visibilityState }, { urgent: true });
    hiddenSince = document.visibilityState === 'hidden' ? now() : null;
    lastFrame = null;
  }, true);
  addEventListener('pagehide', (e) => {
    flush();
    write(keyOf('end'), { t: Math.round(now()), wall: Date.now(), kind: 'pagehide', persisted: !!e.persisted });
    writeResources();
  }, true);
  addEventListener('pageshow', (e) => {
    if (e.persisted) { remove(keyOf('end')); log('pageshow-bfcache', {}, { urgent: true }); }
  }, true);

  /* ---------- performance marks and measures (synchronous breadcrumbs) ---------- */
  const milestones = [];
  const MILESTONE_MARKS = new Set(['hero-entry-start', 'hero-spores-live', 'journey-prepare-start', 'hero-gpu-ready',
    'hero-intro-start', 'journey-gpu-ready', 'journey-interactive', 'journey-fallback']);
  const marks = {};
  for (const kind of ['mark', 'measure']) {
    const original = performance[kind];
    if (typeof original !== 'function') continue;
    performance[kind] = function (...args) {
      const result = original.apply(this, args);
      try {
        const name = String(args[0]);
        if (kind === 'mark') {
          if (!(name in marks)) marks[name] = Math.round(result && result.startTime != null ? result.startTime : now());
          if (MILESTONE_MARKS.has(name)) milestones.push(name);
          log('mark', { name }, { urgent: true });
        } else {
          log('measure', { name, dur: round(result && result.duration) }, { urgent: true });
        }
      } catch {}
      return result;
    };
  }

  /* ---------- long tasks and long animation frames ---------- */
  const supported = (PerformanceObserver && PerformanceObserver.supportedEntryTypes) || [];
  const observe = (type, fn) => {
    if (!supported.includes(type)) return false;
    try { new PerformanceObserver((list) => { for (const e of list.getEntries()) fn(e); }).observe({ type, buffered: true }); return true; } catch { return false; }
  };
  const noteLongest = (kind, e, extra) => {
    if (!longest || e.duration > longest.dur) longest = Object.assign({ kind, t: Math.round(e.startTime), dur: Math.round(e.duration) }, extra);
  };
  meta.observers = {
    longtask: observe('longtask', (e) => {
      counts.longTasks++; counts.longTaskMs += e.duration;
      const attr = e.attribution && e.attribution[0];
      const extra = attr ? { container: attr.containerType || null, name: attr.name || null } : {};
      noteLongest('longtask', e, extra);
      if (e.duration >= 100) log('longtask', Object.assign({ at: Math.round(e.startTime), dur: Math.round(e.duration) }, extra));
    }),
    loaf: observe('long-animation-frame', (e) => {
      counts.loafs++;
      const scripts = (e.scripts || []).slice().sort((a, b) => b.duration - a.duration).slice(0, 2).map(s => ({
        dur: Math.round(s.duration), src: shortUrl(s.sourceURL), fn: (s.sourceFunctionName || '').slice(0, 60),
        invoker: String(s.invoker || '').slice(0, 80), pos: s.sourceCharPosition,
      }));
      noteLongest('loaf', e, { block: Math.round(e.blockingDuration || 0), script: scripts[0] || null });
      if (e.duration >= 150) log('loaf', { at: Math.round(e.startTime), dur: Math.round(e.duration), block: Math.round(e.blockingDuration || 0), render: Math.round((e.startTime + e.duration) - (e.renderStart || e.startTime + e.duration)), scripts });
    }),
    resource: false,
  };

  /* ---------- resources (kept apart from the ring; written every 5 s) ---------- */
  const resources = [];
  const resourceSummary = { count: 0, failed: 0, bytes: 0, slowest: null };
  meta.observers.resource = observe('resource', (e) => {
    resourceSummary.count++;
    resourceSummary.bytes += e.transferSize || 0;
    const status = e.responseStatus || 0;
    if (status >= 400) resourceSummary.failed++;
    if (!resourceSummary.slowest || e.duration > resourceSummary.slowest.dur) resourceSummary.slowest = { name: shortUrl(e.name), dur: Math.round(e.duration) };
    if (resources.length < 320 && /\.(m?js|css|ttf|otf|woff2?|bin|jpe?g|png|webp|avif|json|mp4|webm)(\?|$)/.test(e.name)) {
      resources.push([shortUrl(e.name), Math.round(e.startTime), Math.round(e.duration), e.transferSize || 0, status || null, e.initiatorType]);
    }
    if (status >= 400) log('resource-failed', { name: shortUrl(e.name), status }, { urgent: true });
  });
  function writeResources() { write(keyOf('res'), { summary: resourceSummary, list: resources }); }

  /* ---------- canvases and WebGL contexts ---------- */
  const contexts = [];   // { ref: WeakRef(gl), canvas: WeakRef(canvas), type, n }
  let webglCount = 0, twoDCount = 0, mainGl = null, mainCanvas = null;
  const liveContexts = () => {
    let live = 0;
    for (const c of contexts) {
      const gl = c.ref.deref ? c.ref.deref() : c.ref;
      if (gl && !(gl.isContextLost && gl.isContextLost())) live++;
    }
    return live;
  };
  const seenLoss = new WeakSet();
  const onLoss = (e) => {
    if (seenLoss.has(e)) return;
    seenLoss.add(e);
    const lost = e.type === 'webglcontextlost';
    if (lost) counts.lost++; else counts.restored++;
    const c = e.target;
    log(lost ? 'context-lost' : 'context-restored', {
      canvas: c && c.width != null ? c.width + 'x' + c.height : null, id: c && c.id || null,
      main: c === mainCanvas, live: liveContexts(), msg: e.statusMessage || null,
    }, { urgent: true });
  };
  document.addEventListener('webglcontextlost', onLoss, true);
  document.addEventListener('webglcontextrestored', onLoss, true);

  let drawCalls = 0, drawWrapped = [];
  function countDraws(gl) {
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) {
      const original = gl[name];
      if (typeof original !== 'function') continue;
      gl[name] = function () { drawCalls++; return original.apply(this, arguments); };
      drawWrapped.push([gl, name]);
    }
  }
  function adoptMain(gl, canvas) {
    if (gl === mainGl) return;
    for (const [g, name] of drawWrapped) { try { delete g[name]; } catch {} }
    drawWrapped = [];
    mainGl = gl; mainCanvas = canvas;
    if (now() < DRAW_COUNT_UNTIL) countDraws(gl);
  }
  const proto = window.HTMLCanvasElement && HTMLCanvasElement.prototype;
  const originalGetContext = proto && proto.getContext;
  if (originalGetContext) {
    proto.getContext = function (type) {
      const webgl = /webgl/i.test(String(type));
      const known = webgl && contexts.some(c => (c.canvas.deref ? c.canvas.deref() : c.canvas) === this);
      if (webgl && !known) log('context-request', { type, canvas: this.width + 'x' + this.height, n: webglCount + 1, live: liveContexts() }, { urgent: true });
      const gl = originalGetContext.apply(this, arguments);
      try {
        if (gl && webgl && !known) {
          webglCount++;
          contexts.push({ ref: typeof WeakRef === 'function' ? new WeakRef(gl) : gl, canvas: typeof WeakRef === 'function' ? new WeakRef(this) : this, type });
          this.addEventListener('webglcontextlost', onLoss, true);
          this.addEventListener('webglcontextrestored', onLoss, true);
          let attrs = null;
          try { const a = gl.getContextAttributes(); attrs = a && { aa: a.antialias, alpha: a.alpha, depth: a.depth, stencil: a.stencil, pdb: a.preserveDrawingBuffer, pp: a.powerPreference, fail: a.failIfMajorPerformanceCaveat }; } catch {}
          const entry = { type, canvas: this.width + 'x' + this.height, n: webglCount, live: liveContexts(), attrs };
          if (!meta.gpu) {
            try {
              const ext = gl.getExtension('WEBGL_debug_renderer_info');
              meta.gpu = ext ? { renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL), vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) }
                : { renderer: gl.getParameter(gl.RENDERER), vendor: gl.getParameter(gl.VENDOR) };
              meta.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
              entry.gpu = meta.gpu.renderer; entry.maxTexture = meta.maxTexture;
              saveMeta();
            } catch {}
          }
          // The scene's canvas: the first WebGL context made on this thread
          // (the prelude draws in a worker); probes correct it from sceneApi.
          if (!mainGl) { adoptMain(gl, this); entry.main = true; }
          log('context', entry, { urgent: true });
        } else if (gl && !webgl && /2d/.test(String(type))) {
          twoDCount++;
          if (twoDCount <= 12) log('context-2d', { canvas: this.width + 'x' + this.height, n: twoDCount });
        } else if (!gl && webgl) {
          log('context-failed', { type, canvas: this.width + 'x' + this.height, live: liveContexts() }, { urgent: true });
        }
      } catch {}
      return gl;
    };
  }
  if (proto && typeof proto.transferControlToOffscreen === 'function') {
    const original = proto.transferControlToOffscreen;
    proto.transferControlToOffscreen = function () {
      log('offscreen-transfer', { canvas: this.width + 'x' + this.height, id: this.id || null, cls: this.className || null }, { urgent: true });
      return original.apply(this, arguments);
    };
  }

  /* ---------- frames: per-second statistics and the heartbeat's gap ---------- */
  let lastFrame = null, sec = null, gapSinceBeat = 0, frameTotal = 0;
  const newSecond = (t) => ({ start: t, frames: 0, max: 0, g50: 0, g100: 0, g250: 0, g1000: 0, draws: 0, drawFrames: 0 });
  const recentDraws = [];
  function frame() {
    const t = now();
    if (lastFrame !== null && hiddenSince === null) {
      const gap = t - lastFrame;
      if (!sec) sec = newSecond(t);
      sec.frames++;
      if (gap > sec.max) sec.max = gap;
      if (gap > gapSinceBeat) gapSinceBeat = gap;
      if (gap > 50) sec.g50++;
      if (gap > 100) sec.g100++;
      if (gap > 250) sec.g250++;
      if (gap > 1000) sec.g1000++;
      if (drawWrapped.length) { sec.draws += drawCalls; sec.drawFrames++; recentDraws.push(drawCalls); if (recentDraws.length > 8) recentDraws.shift(); }
      const span = t < PROBE_UNTIL ? 1000 : 10000;
      if (t - sec.start >= span) {
        const mem = memoryMB();
        log('frames', { fr: sec.frames, span: Math.round(t - sec.start), max: Math.round(sec.max), g50: sec.g50, g100: sec.g100, g250: sec.g250, g1000: sec.g1000,
          draws: sec.drawFrames ? Math.round(sec.draws / sec.drawFrames) : undefined, mem });
        sec = newSecond(t);
      }
    }
    drawCalls = 0;
    frameTotal++;
    lastFrame = t;
    if (drawWrapped.length && t > DRAW_COUNT_UNTIL) {
      for (const [gl, name] of drawWrapped) { try { delete gl[name]; } catch {} }
      drawWrapped = [];
      log('draw-count-off', {});
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  function memoryMB() {
    try { const m = performance.memory; return m ? [Math.round(m.usedJSHeapSize / 1048576), Math.round(m.totalJSHeapSize / 1048576)] : undefined; } catch { return undefined; }
  }

  /* ---------- heartbeat ---------- */
  let phase = 'html';
  const setPhase = (p) => { phase = p; };
  listeners.push((e) => { if (e.k === 'mark') setPhase(e.name); else if (e.k === 'context') setPhase('webgl context ' + e.n); else if (e.k === 'runtime') setPhase('runtime chosen'); });
  function beat() {
    write(keyOf('hb'), {
      t: Math.round(now()), wall: Date.now(), maxGap: Math.round(gapSinceBeat), frames: frameTotal, phase,
      last: lastEvent ? { t: lastEvent.t, k: lastEvent.k, name: lastEvent.name || lastEvent.msg || undefined } : null,
      longest, mem: memoryMB(), live: liveContexts(), counts,
    });
    if (gapSinceBeat > 1000) log('heartbeat-gap', { gap: Math.round(gapSinceBeat) }, { urgent: true });
    gapSinceBeat = 0;
  }
  setInterval(beat, 500);
  setInterval(writeResources, 5000);

  /* ---------- state probes ---------- */
  const fixed = (v, n = 2) => (typeof v === 'number' && isFinite(v) ? +v.toFixed(n) : null);
  const top = new WeakMap();   // scene child -> short id
  let topList = '';
  let chapterOf = null;        // short id -> chapter id, once window.journey exists
  let introWas = null;
  let probeSlow = false, probeSkips = 0, warmAskedAt = -Infinity, grownAt = null;
  const visibleDrawables = (root, limit = 4000) => {
    // Drawables reachable through visible ancestors, with a visible material
    // that is not fully transparent. Hidden subtrees cost nothing to skip.
    let n = 0, seen = 0;
    const stack = [root];
    while (stack.length && seen < limit) {
      const o = stack.pop(); seen++;
      if (!o.visible) continue;
      if (o.geometry && o.material) {
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (m && m.visible !== false && !(m.transparent && m.opacity <= 0.01)) {
          const range = o.geometry.drawRange;
          if (!range || range.count > 0) n++;
        }
      }
      for (let i = 0; i < o.children.length; i++) stack.push(o.children[i]);
    }
    return n;
  };
  const uniformValue = (renderer, material, name) => {
    try {
      const props = renderer && renderer.properties && renderer.properties.get(material);
      const u = (props && props.uniforms && props.uniforms[name]) || (material.uniforms && material.uniforms[name]);
      return u ? u.value : undefined;
    } catch { return undefined; }
  };
  function probe() {
    const p = { };
    const s = window.sceneApi;
    const j = window.journey;
    p.j = j ? 1 : 0;
    if (j) {
      try { p.ch = j.chapter; } catch {}
      try { if ('atRest' in j) p.rest = j.atRest ? 1 : 0; } catch {}
      try {
        // warmReport() walks every chapter: at most every 2 s, and timed.
        const due = typeof j.warmReport === 'function' && now() - warmAskedAt >= 2000;
        const w0 = now();
        const w = due ? j.warmReport() : null;
        if (due) { warmAskedAt = now(); p.warmMs = round(warmAskedAt - w0); }
        if (w) {
          let pending = 0, done = 0;
          for (const c of Object.values(w.chapters || {})) { const m = c.missing || {}; if (c.compiled && !m.geometries && !m.textures) done++; else pending++; }
          p.warm = { slices: w.slices, units: w.units, draws: w.warmed && w.warmed.draws, tex: w.warmed && w.warmed.textures, done, pending,
            skip: w.lastSkip || null, longest: w.longestUnit ? JSON.stringify(w.longestUnit).slice(0, 80) : null, wd: w.warmDraws ? 1 : 0, rest: w.restMs };
        }
      } catch {}
    }
    if (s) {
      try {
        const r = s.renderer;
        const gl = r && typeof r.getContext === 'function' ? r.getContext() : null;
        if (gl && gl !== mainGl) { adoptMain(gl, r.domElement); log('main-context', { canvas: r.domElement.width + 'x' + r.domElement.height }); }
      } catch {}
      try {
        const intro = s.intro;
        if (intro) {
          p.intro = [intro.started ? 1 : 0, intro.complete ? 1 : 0, fixed(intro.growthProgress)];
          if (grownAt === null && intro.started && Number(intro.growthProgress) > 0.6) grownAt = now();
          const state = intro.complete ? 'complete' : intro.started ? 'running' : 'waiting';
          if (state !== introWas) { introWas = state; log('intro', { state }, { urgent: true }); }
        }
      } catch {}
      try { const c = s.camera; p.cam = [fixed(c.position.x), fixed(c.position.y), fixed(c.position.z), fixed(c.aspect, 3), fixed(c.fov, 1)]; } catch {}
      try {
        const info = s.renderer && s.renderer.info;
        if (info) p.ri = [info.render && info.render.calls, info.render && info.render.triangles, info.memory && info.memory.geometries, info.memory && info.memory.textures, info.programs ? info.programs.length : null];
      } catch {}
      try { const m = s.groups && s.groups.mushroom; if (m) p.mush = [m.visible ? 1 : 0, visibleDrawables(m, 600)]; } catch {}
      try {
        // The hero floor's stroke-in: uProg (shared) and the web's draw window.
        const g = s.groups && s.groups.ground;
        if (g) {
          let found = null;
          const stack = [g];
          while (stack.length && !found) {
            const o = stack.pop();
            if (o.material && !Array.isArray(o.material) && (o.material.userData && o.material.userData.uWin)) found = o;
            else for (const c of o.children) stack.push(c);
          }
          const win = found && found.material.userData.uWin.value;
          p.ground = [g.visible ? 1 : 0, found ? fixed(uniformValue(s.renderer, found.material, 'uProg'), 3) : null, win ? fixed(win.x, 3) : null, win ? fixed(win.y, 3) : null];
        }
      } catch {}
      try {
        // Top-level scene children: which are visible, and how much they draw.
        const kids = s.scene.children;
        const names = [];
        const vis = [];
        for (let i = 0; i < kids.length; i++) {
          const k = kids[i];
          if (!top.has(k)) top.set(k, (k.name || k.type || 'obj').slice(0, 14) + '#' + i);
          const tag = top.get(k);
          names.push(tag);
          if (k.visible) vis.push(tag);
        }
        const list = names.join(' ');
        if (list !== topList) { topList = list; log('scene-children', { list }); }
        p.top = vis.join(' ');
        // What the non-hero top-level groups (the chapters) draw right now.
        const hero = new Set();
        for (const g of Object.values(s.groups || {})) {
          let o = g;
          while (o && o.parent && o.parent !== s.scene) o = o.parent;
          if (o) hero.add(o);
        }
        const topd = {};
        for (const k of kids) if (k.visible && !hero.has(k) && k.children.length) { const n = visibleDrawables(k); if (n) topd[top.get(k)] = n; }
        p.topd = topd;
      } catch {}
      try {
        const canvas = mainCanvas || (s.renderer && s.renderer.domElement);
        if (canvas) p.cv = [canvas.style.width || null, canvas.style.height || null, canvas.width, canvas.height];
      } catch {}
    }
    if (j && j.chapters) {
      try {
        if (!chapterOf && s && s.scene) {
          chapterOf = {};
          for (const [cid, ch] of Object.entries(j.chapters)) if (ch && ch.group && top.has(ch.group)) chapterOf[top.get(ch.group)] = cid;
          log('chapter-map', { map: chapterOf });
        }
        const visible = {};
        for (const [cid, ch] of Object.entries(j.chapters)) {
          const g = ch && ch.group;
          if (g && g.visible) visible[cid] = visibleDrawables(g);
        }
        p.chv = visible;
      } catch {}
    }
    try { p.body = document.body ? document.body.className : null; } catch {}
    if (latestLuma) p.lum = latestLuma;
    p.dc = drawWrapped.length ? (recentDraws.length ? Math.max(...recentDraws) : 0) : undefined;
    p.mem = memoryMB();
    return p;
  }
  /* The "ground lines at load" complaint: while the journey rests at (or is
     still entering) the Intro, which chapter groups draw anything? */
  const flaggedChapters = new Set();
  const preJourney = [];
  function flagChapter(cid, n, p, pre) {
    if (flaggedChapters.has(cid)) return;
    flaggedChapters.add(cid);
    log('chapter-visible-at-intro', { chapter: cid, drawables: n, seenAt: p.t, before: pre ? 'journey not yet published' : undefined, intro: p.intro, rest: p.rest }, { urgent: true });
  }
  let groundFlagged = false;
  function checkChapters(p) {
    if (p.j && p.ch !== 'mission') return;
    // The hero floor strokes itself in as the growth's uProg (0..1, then a
    // glide to the parked 2) crosses the web's draw window uWin. Fully inside
    // it while the growth has not started and the scene is drawing: the web
    // is on the floor before the mushroom has begun to grow.
    const gr = p.ground;
    if (!groundFlagged && p.intro && !p.intro[0] && gr && gr[0] && gr[1] != null && gr[3] != null && gr[1] >= gr[3] && p.dc !== 0) {
      groundFlagged = true;
      log('chapter-visible-at-intro', { chapter: 'hero-ground (drawn before the growth started)', drawables: null, seenAt: p.t, uProg: gr[1], win: [gr[2], gr[3]], intro: p.intro }, { urgent: true });
    }
    if (!p.j) {
      // window.journey appears at activation; until then the chapter groups
      // are known only as scene children, named once the map exists.
      if (p.topd && Object.keys(p.topd).length) preJourney.push({ t: p.t, topd: p.topd, intro: p.intro });
      if (preJourney.length > 80) preJourney.shift();
      return;
    }
    if (chapterOf && preJourney.length) {
      for (const q of preJourney.splice(0)) for (const [tag, n] of Object.entries(q.topd)) if (chapterOf[tag]) flagChapter(chapterOf[tag], n, q, true);
    }
    if (p.chv) for (const [cid, n] of Object.entries(p.chv)) if (n > 0) flagChapter(cid, n, p, false);
  }
  let probeCount = 0;
  function runProbe() {
    const t0 = now();
    if (probeSlow) { probeSlow = false; probeSkips++; scheduleProbe(); return; }
    let p;
    try { p = probe(); } catch (err) { p = { err: String(err && err.message).slice(0, 120) }; }
    const took = now() - t0;
    p.took = round(took);
    p.t = Math.round(t0);
    if (took > 4) probeSlow = true;
    probeCount++;
    log('probe', p);
    try { checkChapters(p); } catch {}
    lastProbe = p;
    scheduleProbe();
  }
  let lastProbe = null;
  function scheduleProbe() {
    const t = now();
    if (t > SLOW_PROBE_UNTIL) return;
    setTimeout(runProbe, t < FAST_PROBE_UNTIL ? 500 : t < PROBE_UNTIL ? 2000 : 10000);
  }
  scheduleProbe();

  /* ---------- centre luminance of the WebGL canvas ----------
     A few thin strips through the middle of the drawing buffer, read from a
     frame callback registered from a timer, so it runs after the scene's own
     callback in that frame, and only when the scene drew in it (the draw
     counter says so): with preserveDrawingBuffer false the buffer is only
     defined until that frame is composited. The read is ASYNCHRONOUS (WebGL2
     pixel-pack buffer + fence, polled from timers): a synchronous readPixels
     or a drawImage of the canvas makes the main thread wait for everything
     the GPU has queued, which measured seconds on a software rasteriser and
     would add exactly the stall being hunted. Bindings are restored. */
  let latestLuma = null, lumaPending = false, lumaPbo = null;
  const lumaSamples = [];
  function finishLuma(gl, fence, bytes, startedAt, cpuMs, polls) {
    if (gl !== mainGl || (gl.isContextLost && gl.isContextLost())) { lumaPending = false; return; }
    const status = gl.clientWaitSync(fence, 0, 0);
    if (status === gl.TIMEOUT_EXPIRED && polls < 300) { setTimeout(() => finishLuma(gl, fence, bytes, startedAt, cpuMs, polls + 1), 50); return; }
    gl.deleteSync(fence);
    lumaPending = false;
    if (status === gl.TIMEOUT_EXPIRED || status === gl.WAIT_FAILED) { latestLuma = ['timeout']; return; }
    const t0 = now();
    const d = new Uint8Array(bytes);
    const previousPbo = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, lumaPbo);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, d);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, previousPbo);
    let sum = 0, max = 0, bright = 0, opaque = 0;
    for (let i = 0; i < d.length; i += 4) {
      const yv = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      sum += yv; if (yv > max) max = yv; if (yv > 90) bright++; if (d[i + 3] > 0) opaque++;
    }
    const n = d.length / 4;
    latestLuma = [Math.round(sum / n), Math.round(max), Math.round(bright * 1000 / n) / 10];
    // [t, mean, max, bright %, any alpha, main-thread ms, GPU latency ms]
    lumaSamples.push([Math.round(startedAt), ...latestLuma, opaque ? 1 : 0, round(cpuMs + now() - t0), Math.round(now() - startedAt)]);
    if (lumaSamples.length > 40) lumaSamples.shift();
  }
  function sampleLuma(tries = 0) {
    lumaPending = true;
    requestAnimationFrame(() => {
      const gl = mainGl;
      const gl2 = gl && typeof WebGL2RenderingContext === 'function' && gl instanceof WebGL2RenderingContext;
      if (!gl2 || !drawWrapped.length || (gl.isContextLost && gl.isContextLost())) { lumaPending = false; if (gl && !gl2) latestLuma = ['webgl1']; return; }
      if (drawCalls === 0) {
        // the scene did not draw this frame: its buffer is not ours to judge
        if (tries < 10) setTimeout(() => sampleLuma(tries + 1), 0); else { lumaPending = false; latestLuma = ['no-draw']; }
        return;
      }
      const t0 = now();
      try {
        const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
        if (!w || !h) { lumaPending = false; return; }
        const x0 = Math.round(w * 0.2), sw = Math.round(w * 0.6), y0 = Math.round(h * 0.15), sh = Math.round(h * 0.7);
        const strips = [[x0, Math.round(h * 0.35), sw, 2], [x0, Math.round(h * 0.55), sw, 2], [x0, Math.round(h * 0.75), sw, 2], [Math.round(w * 0.5), y0, 2, sh]];
        const bytes = strips.reduce((sum, r) => sum + r[2] * r[3] * 4, 0);
        const bound = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
        const previousPbo = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);
        if (!lumaPbo) lumaPbo = gl.createBuffer();
        if (bound) gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, lumaPbo);
        gl.bufferData(gl.PIXEL_PACK_BUFFER, bytes, gl.STREAM_READ);
        let offset = 0;
        for (const [x, y, sw2, sh2] of strips) { gl.readPixels(x, y, sw2, sh2, gl.RGBA, gl.UNSIGNED_BYTE, offset); offset += sw2 * sh2 * 4; }
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, previousPbo);
        if (bound) gl.bindFramebuffer(gl.READ_FRAMEBUFFER, bound);
        const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const cpuMs = now() - t0;
        setTimeout(() => finishLuma(gl, fence, bytes, t0, cpuMs, 0), 50);
      } catch (err) { lumaPending = false; latestLuma = ['error', String(err && err.message).slice(0, 60)]; }
    });
  }
  const lumaTimer = setInterval(() => {
    if (now() > DRAW_COUNT_UNTIL) clearInterval(lumaTimer);
    else if (LUMA && hiddenSince === null && !lumaPending) sampleLuma();
  }, 2000);

  /* ---------- verdicts ---------- */
  function verdict(at) {
    const s = window.sceneApi;
    const p = lastProbe || {};
    const evidence = [];
    const bodyClass = document.body ? document.body.className : '';
    const failureNote = document.getElementById('runtime-load-failure');
    const statusNotes = [...document.querySelectorAll('body > [role=status]')].filter(el => el.style.display !== 'none' && el.id !== 'runtime-override-badge').map(el => el.textContent.trim().slice(0, 80));
    let v = 'UNKNOWN';
    if (failureNote) { v = 'HERO-MISSING'; evidence.push('runtime load failure note shown'); }
    if ('journey-fallback' in marks) evidence.push('journey-fallback mark');
    if (statusNotes.length) evidence.push('note: ' + statusNotes.join(' | '));
    if (counts.lost) evidence.push(counts.lost + ' context loss(es)');
    evidence.push('marks: ' + (Object.keys(marks).filter(m => MILESTONE_MARKS.has(m)).join(',') || 'none'));
    evidence.push('body: ' + bodyClass);
    if (!s) {
      evidence.push('no window.sceneApi (scene not created)');
      if (at >= 30000 && v === 'UNKNOWN') v = 'HERO-MISSING';
    } else {
      const intro = s.intro || {};
      const started = !!intro.started, progress = Number(intro.growthProgress);
      evidence.push('intro ' + (intro.complete ? 'complete' : started ? 'running ' + fixed(progress) : 'not started'));
      const mush = p.mush;
      if (mush) evidence.push('mushroom visible=' + mush[0] + ' drawables=' + mush[1]);
      if (p.dc !== undefined) evidence.push('draws/frame ' + p.dc);
      // Only samples taken after the growth passed 60% can say anything.
      const fresh = grownAt === null ? [] : lumaSamples.filter(x => x[0] >= grownAt);
      if (fresh.length) evidence.push('centre luma since growth (mean/max/bright%) ' + fresh.slice(-3).map(x => x.slice(1, 4).join('/')).join(' '));
      else if (latestLuma) evidence.push('centre luma (stale/' + latestLuma.join('/') + ')');
      const lit = fresh.some(x => x[2] >= 120);
      const darkRepeated = fresh.length >= 3 && fresh.slice(-3).every(x => x[2] > 0 && x[2] < 70);
      const blackRepeated = fresh.length >= 3 && fresh.slice(-3).every(x => x[2] === 0);
      if (blackRepeated) evidence.push('canvas sample black x3 (inconclusive alone)');
      if (started && progress > 0.6) {
        if ((mush && (!mush[0] || mush[1] === 0)) || (p.dc === 0 && drawWrapped.length) || darkRepeated || (counts.lost > counts.restored)) v = 'HERO-MISSING';
        else if (mush && mush[0] && mush[1] > 0) {
          v = lit ? 'HERO-OK' : 'HERO-OK?';
          if (!lit) evidence.push('structure says drawn; no bright canvas sample yet');
        }
      } else if (v === 'UNKNOWN') {
        evidence.push(started ? 'growth still early' : 'growth not released yet');
      }
    }
    if ('journey-fallback' in marks || failureNote) v = 'HERO-MISSING';
    const entry = { at: at / 1000, v, evidence: evidence.join('; ') };
    meta.verdicts.push(entry);
    saveMeta();
    log('verdict', { at: at / 1000, v, evidence: entry.evidence.slice(0, 500) }, { urgent: true });
  }
  // A verdict waits for the document to finish parsing (a page blocked
  // before then fires every timer at once with nothing yet to judge).
  const verdictWhenParsed = (at) => {
    if (document.readyState === 'loading') { setTimeout(() => verdictWhenParsed(at), 1000); return; }
    try { verdict(at); } catch {}
  };
  for (const at of VERDICTS_AT) setTimeout(() => verdictWhenParsed(at), Math.max(0, at - now()));

  /* ---------- body / html class changes ---------- */
  const watchClasses = (el, label) => {
    let last = el.className;
    log('class', { el: label, v: String(last).slice(0, 200) });
    new MutationObserver(() => {
      const v = el.className;
      if (v === last) return;
      const before = new Set(String(last).split(/\s+/)), after = new Set(String(v).split(/\s+/));
      last = v;
      const add = [...after].filter(c => c && !before.has(c)), del = [...before].filter(c => c && !after.has(c));
      log('class', { el: label, add: add.join(' ') || undefined, del: del.join(' ') || undefined }, { urgent: add.includes('scene-intro-live') || add.includes('scene-static') });
    }).observe(el, { attributes: true, attributeFilter: ['class'] });
  };
  watchClasses(document.documentElement, 'html');
  const onBody = () => { if (document.body) watchClasses(document.body, 'body'); };
  if (document.body) onBody(); else document.addEventListener('DOMContentLoaded', onBody, { once: true });
  document.addEventListener('DOMContentLoaded', () => log('dom-ready', { build: meta.build ? meta.build.slice(0, 12) : null }, { urgent: true }), { once: true });
  addEventListener('load', () => { log('load', {}, { urgent: true }); writeResources(); }, { once: true });

  /* ---------- previous-session analysis ---------- */
  function analyse(session) {
    const ev = session.events || [];
    const hb = session.heartbeat;
    const last = ev[ev.length - 1] || null;
    const started = session.meta && Date.parse(session.meta.startedAt);
    const clean = !!(session.end && session.end.kind === 'pagehide');
    const lastBeatWall = hb ? hb.wall : null;
    let worstGap = null, longestTask = hb && hb.longest || null;
    for (const e of ev) {
      if ((e.k === 'heartbeat-gap') && (!worstGap || e.gap > worstGap.gap)) worstGap = { t: e.t, gap: e.gap };
      if ((e.k === 'longtask' || e.k === 'loaf') && (!longestTask || e.dur > longestTask.dur)) longestTask = { kind: e.k, t: e.at, dur: e.dur, script: e.scripts && e.scripts[0] };
    }
    const verdicts = (session.meta && session.meta.verdicts) || [];
    const flagged = ev.filter(e => e.k === 'chapter-visible-at-intro').map(e => e.chapter);
    const errors = ev.filter(e => /error|rejection|context-lost|context-failed|resource-failed/.test(e.k)).slice(-5);
    return {
      id: session.id, build: session.meta && session.meta.build ? session.meta.build.slice(0, 12) : null,
      startedAt: session.meta && session.meta.startedAt,
      finished: clean ? 'clean (page was left normally)' : 'DID NOT FINISH CLEANLY (no unload: crash, kill or still open elsewhere)',
      clean,
      lastEvent: last ? { t: last.t, k: last.k, name: last.name || last.msg || last.state || undefined } : null,
      lastHeartbeat: hb ? { t: hb.t, phase: hb.phase, maxGap: hb.maxGap, frames: hb.frames, mem: hb.mem, live: hb.live } : null,
      silenceBeforeThisLoadS: lastBeatWall ? Math.round((startedWall - lastBeatWall) / 100) / 10 : null,
      endT: session.end ? session.end.t : null,
      ranForS: hb && started ? Math.round(hb.t / 100) / 10 : null,
      worstHeartbeatGap: worstGap, longestTask,
      verdicts: verdicts.map(v => v.at + 's ' + v.v), chapterFlags: flagged, errors,
    };
  }
  const previousAnalysis = previous.map(analyse);
  if (previousAnalysis[0]) {
    const a = previousAnalysis[0];
    log('previous-session', { id: a.id, clean: a.clean, lastT: a.lastHeartbeat && a.lastHeartbeat.t, phase: a.lastHeartbeat && a.lastHeartbeat.phase });
  }

  /* ---------- report ---------- */
  function report() {
    flush();
    return {
      format: 'mycelial-diag-report/1', generatedAt: new Date().toISOString(),
      current: { id, meta, counts, longest, marks, events, heartbeat: read(keyOf('hb')), resources: { summary: resourceSummary, list: resources }, luma: lumaSamples, probeSkips, probes: probeCount, analysis: null },
      previous: previous.slice(0, 5).map((s, i) => Object.assign({ analysis: previousAnalysis[i] }, s)),
    };
  }
  window.__diag = { report, log, id };

  /* ---------- panel ---------- */
  if (QUIET) return;
  const fmtS = (ms) => (ms == null ? '?' : (ms / 1000).toFixed(1) + 's');
  function panel() {
    const root = document.createElement('div');
    root.id = 'diag-panel';
    root.style.cssText = 'all:initial;position:fixed;right:8px;bottom:8px;z-index:2147483646;width:min(400px,calc(100vw - 16px));max-height:32vh;display:flex;flex-direction:column;'
      + 'background:rgba(8,8,8,.86);color:#ddd;font:11px/1.35 ui-monospace,Menlo,Consolas,monospace;border:1px solid #555;border-radius:4px;box-sizing:border-box';
    const head = document.createElement('div');
    head.style.cssText = 'display:flex;gap:6px;align-items:center;padding:4px 6px;border-bottom:1px solid #444;flex:none';
    const title = document.createElement('span');
    title.style.cssText = 'flex:1;color:#fff;font-weight:600';
    title.textContent = 'diag ' + id + ' · build ' + (meta.build ? meta.build.slice(0, 8) : '?');
    const button = (label, fn) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      b.style.cssText = 'all:initial;font:inherit;color:#000;background:#ddd;border-radius:3px;padding:1px 6px;cursor:pointer';
      b.addEventListener('click', fn);
      head.appendChild(b);
      return b;
    };
    head.appendChild(title);
    const body = document.createElement('div');
    body.style.cssText = 'overflow:auto;padding:4px 6px;flex:1;white-space:pre-wrap;word-break:break-word';
    const copy = button('Copy report', async () => {
      const text = JSON.stringify(report());
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch {}
      if (!ok) {
        try {
          const area = document.createElement('textarea');
          area.value = text; area.style.cssText = 'position:fixed;left:-9999px;top:0';
          document.body.appendChild(area); area.select(); ok = document.execCommand('copy'); area.remove();
        } catch {}
      }
      copy.textContent = ok ? 'Copied ' + Math.round(text.length / 1024) + ' KB' : 'Copy failed: use Download';
      setTimeout(() => { copy.textContent = 'Copy report'; }, 4000);
    });
    button('Download', () => {
      const blob = new Blob([JSON.stringify(report(), null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'mycelial-diag-' + id + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    });
    let open = true;
    const toggle = button('–', () => { open = !open; body.style.display = open ? '' : 'none'; toggle.textContent = open ? '–' : '+'; });
    root.append(head, body);
    const line = (text, color) => {
      const el = document.createElement('div');
      el.textContent = text;
      if (color) el.style.color = color;
      body.appendChild(el);
      if (body.childNodes.length > 160) body.removeChild(body.childNodes[1]);
      body.scrollTop = body.scrollHeight;
      return el;
    };
    const prev = previousAnalysis[0];
    if (prev && !prev.clean) {
      const lt = prev.longestTask;
      const box = line('PREVIOUS SESSION DID NOT FINISH (' + prev.id + ', build ' + prev.build + '): last event ' + (prev.lastEvent ? fmtS(prev.lastEvent.t) + ' ' + prev.lastEvent.k + (prev.lastEvent.name ? ' ' + prev.lastEvent.name : '') : '?')
        + '; last heartbeat ' + (prev.lastHeartbeat ? fmtS(prev.lastHeartbeat.t) + ' during "' + prev.lastHeartbeat.phase + '"' : '?')
        + (prev.silenceBeforeThisLoadS != null ? ', then nothing for ' + prev.silenceBeforeThisLoadS + ' s before this load' : '')
        + '; longest task ' + (lt ? lt.dur + ' ms at ' + fmtS(lt.t) : 'none')
        + '; memory ' + (prev.lastHeartbeat && prev.lastHeartbeat.mem ? prev.lastHeartbeat.mem[0] + ' MB JS heap' : '?')
        + (prev.verdicts.length ? '; verdicts ' + prev.verdicts.join(', ') : '') + '. Press Copy report.', '#ff8a80');
      box.style.cssText += ';font-weight:700;border:1px solid #ff5252;padding:3px;margin-bottom:4px';
    } else if (prev) {
      line('previous session ' + prev.id + ' (build ' + prev.build + ') finished cleanly; worst heartbeat gap ' + (prev.worstHeartbeatGap ? prev.worstHeartbeatGap.gap + ' ms' : 'none')
        + (prev.verdicts.length ? '; ' + prev.verdicts.join(', ') : '') + (prev.chapterFlags.length ? '; chapters at intro: ' + prev.chapterFlags.join(',') : ''), '#9e9e9e');
    }
    line('env: ' + (meta.deviceMemory ?? '?') + ' GB · ' + (meta.cores ?? '?') + ' cores · dpr ' + meta.dpr + ' · ' + meta.viewport.join('x') + (meta.rt ? ' · rt=' + meta.rt : ''), '#9e9e9e');
    for (const e of events) show(e);
    function show(e) {
      const t = fmtS(e.t) + ' ';
      if (e.k === 'mark') line(t + 'mark ' + e.name);
      else if (e.k === 'runtime') line(t + 'build ' + e.build + (e.override ? ' (' + e.override + ')' : ''));
      else if (e.k === 'context') line(t + 'WebGL #' + e.n + ' ' + e.canvas + (e.gpu ? ' · ' + e.gpu : '') + ' · live ' + e.live);
      else if (e.k === 'intro') line(t + 'intro ' + e.state);
      else if (e.k === 'verdict') line(t + 'VERDICT @' + e.at + 's ' + e.v + ' — ' + e.evidence.slice(0, 220), e.v === 'HERO-OK' ? '#a5d6a7' : e.v === 'HERO-MISSING' ? '#ff8a80' : '#ffe082');
      else if (e.k === 'chapter-visible-at-intro') line(t + 'FLAG ' + e.chapter + (e.drawables != null ? ' draws ' + e.drawables + ' objects at the Intro' : ' (uProg ' + e.uProg + ')') + (e.before ? ' [' + e.before + ', seen ' + fmtS(e.seenAt) + ']' : ''), '#ff8a80');
      else if (/error|rejection|context-lost|context-failed|resource-failed/.test(e.k)) line(t + e.k + ' ' + (e.msg || e.src || e.name || e.canvas || ''), '#ff8a80');
      else if ((e.k === 'longtask' || e.k === 'loaf') && e.dur > 250) line(t + e.k + ' ' + e.dur + ' ms' + (e.scripts && e.scripts[0] ? ' ' + e.scripts[0].src + ' ' + e.scripts[0].fn : ''), '#ffcc80');
      else if (e.k === 'heartbeat-gap') line(t + 'main thread blocked ~' + e.gap + ' ms', '#ffcc80');
      else if (e.k === 'context-restored' || e.k === 'visibility') line(t + e.k + ' ' + (e.state || ''));
    }
    listeners.push(show);
    title.textContent = 'diag ' + id + ' · build ' + (meta.build ? meta.build.slice(0, 8) : '?');
    listeners.push((e) => { if (e.k === 'runtime') title.textContent = 'diag ' + id + ' · build ' + e.build.slice(0, 8); });
    document.body.appendChild(root);
  }
  if (document.body) panel(); else document.addEventListener('DOMContentLoaded', panel, { once: true });
})();
