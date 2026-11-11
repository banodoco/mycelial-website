  /* REST-TIME GPU WARMING (2026-11, hitch pass; ledger P1/P2/P5). Three
     creates a chapter's GPU resources inside the frame that first draws it:
     refreshed program variants, each texture's upload and mipmaps, and —
     the largest — every attribute and index buffer, which only a real draw
     creates. Measured on Connect->Purpose: ~4.5 MB of bufferData in one
     frame of the flight, plus Owned's 2.3 MB on its first approach. The old
     pass (one whole chapter per idle callback from activation + 7.6 s,
     deadline and flight ignored) also put 26 MB of texture uploads inside
     the first hop.

     So the work is cut into small units — a chapter's compile, then ONE
     texture, then one warm draw of at most ~WARM_DRAW_BYTES of geometry the
     GPU does not hold yet — and run in idle slices only while the camera has
     been at rest for WARM_REST_MS. Nearest chapter first, measured from
     where the journey is; a jump places p at its destination on the click
     frame, so after a flight "where it is" is where it went.

     UNITS ARE FOUND, NOT LISTED (2026-11, warmfix). The first version listed
     every chapter's units once, at activation: Purpose came out as ~340
     tiny subtree draws, most of them of geometry already uploaded, and the
     textures and objects that only exist later (photo atlases, rebuilt root
     world) were never in the list. Each unit is now the next thing the GPU
     really lacks — asked of the renderer, at every rest — so a chapter is
     a handful of units, re-scanned after every flight and every
     WARM_RESCAN_MS of rest, and the queue is done when nothing is missing.

     A unit never starts in a nearly spent idle period. A page that never
     goes idle (this is the common case on a phone whose frame fills its
     budget, and always on a software rasteriser) still gets one slice per
     WARM_STARVE_MS of rest, of at most WARM_STARVE_BUDGET_MS — a short
     slice at rest is the lesser hitch. */
  const WARM_REST_MS = 300;
  const WARM_POLL_MS = 150;
  const WARM_STARVE_MS = 500;
  const WARM_STARVE_BUDGET_MS = 6;
  const WARM_SLICE_MIN_MS = 6;
  const WARM_RESCAN_MS = 3000;
  const WARM_DRAW_BYTES = 1 << 20;
  const WARM_DRAW_OBJECTS = 160;
  // A layer no chapter uses (the colony keeps 31 for its own warm draw).
  const WARM_LAYER = 30;
  /* REST WARM TASKS. Extra rest-time preparation registers here and runs in
     the same slices, under the same rules (never mid-flight, one call per
     unit). `chapter` given: runs only while the journey rests AT that
     chapter, after that chapter's own units and the next stop's. `fn(deadline)`
     may return true for "call me again" or a promise to wait on; anything
     else is done. `repeat`: run again at every later rest there (a task
     keyed on the pose, which a resize or a new rest can change). */
  const restWarmTasks = [];
  function registerRestWarmTask(fn, { chapter = null, repeat = false } = {}) {
    if (typeof fn === 'function') restWarmTasks.push({ fn, chapter, repeat, done: false });
    return state;
  }
  /* The Manifesto press, prepared while Purpose rests: flight plan, colony
     GPU buffers, desktop text fit. branch.prewarm answers true when DONE;
     the queue reads true as "call me again" — hence the negation. */
  registerRestWarmTask(
    () => !!manifestoBranch && !manifestoBranch.prewarm({ budgetMs: 8 }),
    { chapter: 'final', repeat: true },
  );
  /** THE ONE "AT REST" PREDICATE: no camera blend or rail/camera
   *  disagreement, the hero growth finished, no Manifesto ascent or descent
   *  under way. The warm queue below and the resolution governor
   *  (organism/performance.js canStep, through `state.atRest`) both ask it. */
  function isAtRest() {
    return !(transition.blend || transition.cameraStateDisagree
      || (sceneApi.intro && sceneApi.intro.complete === false)
      || (manifestoBranch && manifestoBranch.active
        && (manifestoBranch.returning || manifestoBranch.progress < 1)));
  }
  let warmStarted = false;
  let warmProbe = null;
  function warmHiddenChapters() {
    const r = sceneApi.renderer;
    if (warmStarted || !r || typeof r.compileAsync !== 'function') return;
    warmStarted = true;
    const props = r.properties && typeof r.properties.get === 'function' ? r.properties : null;
    const tried = new WeakMap();      // texture -> the version last handed to initTexture
    const drawn = new WeakSet();      // geometry this queue has warm-drawn
    /* Rail position. Owned shares Purpose's: Owned is a branch under
       Purpose and its root world and portraits are drawn on the way IN to
       Purpose (measured: 7 textures, 26 MB with mipmaps, and 1.6 MB of
       buffers inside Connect->Purpose), so from Connect both are the next
       stop, and resting at either covers the other. */
    const RAIL_ORDER = ['mission', 'inspire', 'equip', 'connect', 'final', 'owned'];
    const RAIL_POS = { mission: 0, inspire: 1, equip: 2, connect: 3, final: 4, owned: 4 };
    const pos = (id) => (id in RAIL_POS ? RAIL_POS[id] : Math.max(0, CHAPTER_IDS.indexOf(id)));
    // 0 here, 2 one stop ahead, 3 one stop back, ...; ties in rail order
    const rankOf = (id, here) => Math.abs(pos(id) - here) * 2 + (pos(id) < here ? 1 : 0)
      + Math.max(0, RAIL_ORDER.indexOf(id)) * 0.01;
    // a task for this chapter after the next stop's units; a general one
    // (card media) after both neighbours'
    const TASK_HERE_RANK = 2.5, TASK_ANY_RANK = 4.5;
    const work = new Map();           // chapter id -> its warm state
    for (const id of Object.keys(chapters)) {
      const group = chapters[id] && chapters[id].group;
      if (group) work.set(id, { group, compiled: false, dirty: true, units: 0, draws: 0, drawBytes: 0, textures: 0, textureBytes: 0 });
    }
    let restSince = null;
    let lastSliceAt = performance.now();
    /* A software rasteriser draws a hidden 4 MB chapter in seconds, not
       milliseconds, so the warm DRAWS are skipped there (compile and texture
       units still run) — the same carve-out boot's warm-up always made.
       `?warmdraw=1` keeps them, so the GL harness can measure them. */
    const softwareGl = /swiftshader|llvmpipe|softpipe|software/i.test(sceneApi.rendererName || '')
      && !/[?&]warmdraw=1(?:&|$)/.test(location.search);
    /* CARD MEDIA warming (fonts, posters, preview clips: ~6 MB) rides this
       queue: one job per rest slice, fetched at priority 'low'. Cards fetch
       their own media on demand when built, so never resting costs nothing. */
    startCardWarming({ enqueue: (job) => registerRestWarmTask(() => { job(); return false; }) });

    const busy = () => !isAtRest();
    const lost = () => {
      const gl = typeof r.getContext === 'function' && r.getContext();
      return !!(gl && typeof gl.isContextLost === 'function' && gl.isContextLost());
    };

    /** Depth-first walk that stops once `fn` returns true. */
    const walk = (root, fn) => {
      const stack = [root];
      while (stack.length) {
        const o = stack.pop();
        if (fn(o)) return;
        for (let i = o.children.length - 1; i >= 0; i--) stack.push(o.children[i]);
      }
    };
    const bytesOf = (g) => {
      let bytes = g.index ? g.index.array.byteLength : 0;
      for (const a of Object.values(g.attributes || {})) {
        bytes += ((a && (a.array || (a.data && a.data.array))) || { byteLength: 0 }).byteLength;
      }
      return bytes;
    };
    /* Does the GPU hold this geometry? Three registers a geometry (and
       uploads its attributes) the first time any draw projects it, and
       registers its own dispose listener then; nothing else here listens
       for 'dispose' on geometry. */
    const onGpu = (g) => drawn.has(g) || !!(g._listeners && g._listeners.dispose && g._listeners.dispose.length);
    /** Every texture a material samples: its own slots and its uniforms,
     *  uniform arrays included (Owned's portrait atlases are uniforms). */
    function texturesOf(m, out) {
      for (const v of Object.values(m)) if (v && v.isTexture) out.push(v);
      for (const u of Object.values(m.uniforms || {})) {
        const v = u && u.value;
        if (v && v.isTexture) out.push(v);
        else if (Array.isArray(v)) for (const t of v) if (t && t.isTexture) out.push(t);
      }
      return out;
    }
    /** A texture the GPU lacks at its current version and could take now. */
    function stale(t) {
      if (t.isRenderTargetTexture || t.isVideoTexture || !(t.version > 0)) return false;
      if (!t.image || t.image.complete === false) return false;   // asked again at a later scan
      if (tried.get(t) === t.version) return false;               // tried once per version
      return !props || !(props.has ? props.has(t) : true) || props.get(t).__version !== t.version;
    }
    function staleTexture(group) {
      let found = null;
      walk(group, (o) => {
        for (const m of [].concat(o.material || [])) {
          if (!m) continue;
          for (const t of texturesOf(m, [])) if (stale(t)) { found = t; return true; }
        }
        return false;
      });
      return found;
    }
    /** The next ~WARM_DRAW_BYTES of geometry under `group` the GPU lacks. */
    function drawBatch(group) {
      const batch = [];
      let bytes = 0;
      const seen = new Set();
      walk(group, (o) => {
        const g = o.geometry;
        if (!g || seen.has(g) || onGpu(g)) return false;
        seen.add(g);
        batch.push(o);
        bytes += bytesOf(g);
        return bytes >= WARM_DRAW_BYTES || batch.length >= WARM_DRAW_OBJECTS;
      });
      return batch.length ? { batch, bytes } : null;
    }
    const textureBytes = (t) => ((t.image && t.image.width * t.image.height) || 0) * 4;

    /** One draw of `batch` into a 1x1 target of the composer's own format
     *  and sample count — the hero-gpu.js precedent, minus its full-size
     *  target: no pixel, viewport, scissor or TAA history a frame reads is
     *  touched. The real Scene is rendered, so fog and the program variants
     *  match, through a camera that sees only WARM_LAYER, which the batch
     *  joins for this draw; hidden ancestors and materials are shown and
     *  culling is off, so a buffer is uploaded whether or not this view, or
     *  this moment, would draw it. Everything is restored in `finally`. */
    let warmTarget = null, warmCamera = null;
    function warmDraw(batch) {
      const scene = sceneApi.scene;
      const camera = sceneApi.camera;
      const source = sceneApi.composer && sceneApi.composer.readBuffer;
      if (!scene || !camera || !source || typeof r.render !== 'function' || typeof r.setRenderTarget !== 'function') return;
      if (!warmTarget) { warmTarget = source.clone(); warmTarget.setSize(1, 1); }
      if (!warmCamera) warmCamera = camera.clone(false);
      warmCamera.copy(camera, false);
      warmCamera.layers.set(WARM_LAYER);
      // the batch's own state first: one of them may be another's ancestor
      const objects = batch.map((o) => [o, o.layers.mask, o.visible, o.frustumCulled]);
      const shown = [], materials = [];
      for (const o of batch) {
        o.layers.enable(WARM_LAYER); o.visible = true; o.frustumCulled = false;
        for (let a = o.parent; a && a !== scene; a = a.parent) if (!a.visible) { shown.push(a); a.visible = true; }
        for (const m of [].concat(o.material || [])) if (m && m.visible === false) { materials.push(m); m.visible = true; }
      }
      const previous = r.getRenderTarget();
      try {
        r.setRenderTarget(warmTarget);
        r.render(scene, warmCamera);
      } finally {
        r.setRenderTarget(previous);
        for (const m of materials) m.visible = false;
        for (const a of shown) a.visible = false;
        for (const [o, mask, visible, culled] of objects) { o.layers.mask = mask; o.visible = visible; o.frustumCulled = culled; }
      }
    }

    /** The next unit chapter `ch` really needs, or null once it lacks nothing. */
    function nextUnit(ch) {
      if (!ch.compiled) return { kind: 'compile' };
      if (!ch.dirty) return null;
      const t = staleTexture(ch.group);
      if (t) return { kind: 'texture', t };
      const b = drawBatch(ch.group);
      if (b) return { kind: 'draw', ...b };
      ch.dirty = false;
      return null;
    }
    /** Run it. Returns a promise to wait on, or null. */
    function runUnit(ch, unit) {
      ch.units++;
      if (unit.kind === 'compile') {
        ch.compiled = true;
        // Every hidden material variant, as at boot: reveal, compile, restore.
        const hidden = [];
        ch.group.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
        try { return compileForFrame(sceneApi, ch.group); }
        finally { for (const o of hidden) o.visible = false; }
      }
      if (unit.kind === 'texture') {
        tried.set(unit.t, unit.t.version);
        r.initTexture(unit.t);
        ch.textures++; ch.textureBytes += textureBytes(unit.t);
        report.textures++; report.textureBytes += textureBytes(unit.t);
        return null;
      }
      // marked first: a draw that throws, or is skipped, is not retried
      for (const o of unit.batch) drawn.add(o.geometry);
      if (softwareGl) return null;
      warmDraw(unit.batch);
      ch.draws++; ch.drawBytes += unit.bytes;
      report.draws++; report.drawBytes += unit.bytes;
      return null;
    }

    /* QA READOUT (journey.warmReport()). Counters kept as the queue runs,
       plus a fresh count of what the GPU still lacks per chapter — a walk
       and a few property reads, nothing drawn, uploaded or queued. */
    const report = { slices: 0, units: 0, draws: 0, drawBytes: 0, textures: 0, textureBytes: 0,
      longestUnit: null, lastSkip: null, log: [] };
    const note = (entry) => { report.log.push(entry); if (report.log.length > 40) report.log.shift(); };
    const skip = (why) => { if (report.lastSkip !== why) note({ at: Math.round(performance.now()), skip: why }); report.lastSkip = why; };
    warmProbe = () => {
      const chaptersOut = {};
      for (const [id, ch] of work) {
        let geometries = 0, geometryBytes = 0, textures = 0, texBytes = 0;
        const seen = new Set();
        ch.group.traverse((o) => {
          const g = o.geometry;
          if (g && !seen.has(g)) { seen.add(g); if (!onGpu(g)) { geometries++; geometryBytes += bytesOf(g); } }
          for (const m of [].concat(o.material || [])) {
            if (m) for (const t of texturesOf(m, [])) if (!seen.has(t)) { seen.add(t); if (stale(t)) { textures++; texBytes += textureBytes(t); } }
          }
        });
        chaptersOut[id] = { compiled: ch.compiled, scanned: !ch.dirty, unitsRun: ch.units,
          warmed: { draws: ch.draws, bytes: ch.drawBytes, textures: ch.textures, textureBytes: ch.textureBytes },
          missing: { geometries, bytes: geometryBytes, textures, textureBytes: texBytes } };
      }
      return {
        atRest: isAtRest(), restMs: restSince === null ? 0 : Math.round(performance.now() - restSince),
        warmDraws: !softwareGl,
        slices: report.slices, units: report.units, longestUnit: report.longestUnit,
        warmed: { draws: report.draws, bytes: report.drawBytes, textures: report.textures, textureBytes: report.textureBytes },
        chapters: chaptersOut,
        tasks: restWarmTasks.filter((t) => !t.done).map((t) => t.chapter || 'any'),
        lastSkip: report.lastSkip, log: report.log.slice(),
      };
    };

    /** The most urgent work from `hereId`: a chapter's unit, or a task. */
    function pick(hereId) {
      const here = pos(hereId);
      let best = null;
      for (const [id, ch] of work) {
        if (ch.compiled && !ch.dirty) continue;
        const rank = rankOf(id, here);
        if (best && best.rank <= rank) continue;
        const unit = nextUnit(ch);       // a clean scan drops out here
        if (unit) best = { rank, id, ch, unit };
      }
      for (const task of restWarmTasks) {
        if (task.done || (task.chapter !== null && task.chapter !== hereId)) continue;
        const rank = task.chapter === null ? TASK_ANY_RANK : TASK_HERE_RANK;
        if (!best || rank < best.rank) best = { rank, task };
      }
      return best;
    }

    const idle = typeof window.requestIdleCallback === 'function'
      ? (fn) => window.requestIdleCallback(fn, { timeout: WARM_STARVE_MS })
      : (fn) => requestAnimationFrame(() => setTimeout(() => fn({ didTimeout: true, timeRemaining: () => 0 }), 0));
    const later = (ms) => setTimeout(() => idle(slice), ms);
    const markAllDirty = () => { for (const ch of work.values()) ch.dirty = true; };

    function slice(deadline) {
      if (startupFailed) return;
      const now = performance.now();
      if (busy() || lost()) { if (restSince !== null) skip(lost() ? 'context lost' : 'flight'); restSince = null; later(WARM_POLL_MS); return; }
      if (restSince === null) {
        restSince = now;
        // A new rest: anything created or swapped in since is looked for again.
        markAllDirty();
        for (const t of restWarmTasks) if (t.repeat) t.done = false;
      }
      if (now - restSince < WARM_REST_MS) { skip('settling'); later(WARM_REST_MS - (now - restSince)); return; }
      const hereId = chapterAt(journey.progress).id;
      const starved = deadline.didTimeout || now - lastSliceAt >= WARM_STARVE_MS;
      if (!starved && deadline.timeRemaining() < WARM_SLICE_MIN_MS) { skip('idle period spent'); idle(slice); return; }
      report.slices++;
      lastSliceAt = now;
      let pending = null, ran = 0, next = null;
      const room = () => (starved ? performance.now() - now < WARM_STARVE_BUDGET_MS : deadline.timeRemaining() >= WARM_SLICE_MIN_MS);
      while (!pending && (ran === 0 || room()) && (next = pick(hereId))) {
        const t0 = performance.now();
        let what;
        if (next.task) {
          const task = next.task;
          what = `task:${task.chapter || 'any'}`;
          try {
            const result = task.fn(deadline);
            // "again": keep it and give the slice a breath, not a spin
            if (result === true) pending = new Promise((res) => setTimeout(res, WARM_POLL_MS));
            else if (result && typeof result.then === 'function') { task.done = true; pending = result; }
            else task.done = true;
          } catch (error) { task.done = true; console.warn('[journey-v6] rest warm task failed', error); }
        } else {
          what = `${next.unit.kind}:${next.id}`;
          try { pending = runUnit(next.ch, next.unit); } catch (error) {
            next.ch.compiled = true; next.ch.dirty = false;
            console.warn('[journey-v6] rest-time GPU warming skipped a chapter', error);
          }
        }
        const ms = +(performance.now() - t0).toFixed(1);
        ran++; report.units++;
        if (!report.longestUnit || ms > report.longestUnit.ms) report.longestUnit = { what, ms };
        note({ at: Math.round(t0), here: hereId, what, ms, starved, ...(next.unit && next.unit.bytes ? { bytes: next.unit.bytes } : {}) });
      }
      if (!next && !pending) {
        // Nothing missing from here. Look again after WARM_RESCAN_MS of rest
        // (a photo atlas lands, a remix bakes) or after the next flight.
        skip('nothing missing');
        markAllDirty();
        later(WARM_RESCAN_MS);
        return;
      }
      report.lastSkip = null;
      if (pending) Promise.resolve(pending).catch(() => {}).then(() => idle(slice));
      else idle(slice);
    }
    idle(slice);
  }
