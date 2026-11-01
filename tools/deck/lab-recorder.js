// Injected before deck scripts. DOM samples use the deck's own turn/queue state.
(() => {
  const lab = window.__lab = { buf: [], inputs: [], longtasks: [], shifts: [], costs: [], gaps: [] };
  const eventTypes = ['pointerdown', 'pointerup', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'keydown', 'keyup', 'click'];
  for (const type of eventTypes) addEventListener(type, e => lab.inputs.push({ t: performance.now(), type, key: e.key || null, x: e.changedTouches?.[0]?.clientX ?? e.clientX ?? null, y: e.changedTouches?.[0]?.clientY ?? e.clientY ?? null, target: e.target?.closest?.('#prevBtn,#nextBtn')?.id || e.target?.id || e.target?.className?.toString?.().slice(0, 80) || e.target?.tagName }), true);
  for (const [type, key] of [['longtask', 'longtasks'], ['layout-shift', 'shifts']]) {
    try { new PerformanceObserver(list => list.getEntries().forEach(e => {
      if (type !== 'layout-shift' || !e.hadRecentInput) lab[key].push({ t: e.startTime, value: type === 'longtask' ? e.duration : e.value });
    })).observe({ type, buffered: true }); } catch { /* unavailable */ }
  }
  const selector = e => e.tagName.toLowerCase() + (e.id ? `#${e.id}` : [...e.classList].slice(0, 3).map(c => `.${c}`).join(''));
  function visible(el, mask = false) {
    if (!el) return false;
    const r = el.getBoundingClientRect(); let l = Math.max(0, r.left), t = Math.max(0, r.top), right = Math.min(innerWidth, r.right), bottom = Math.min(innerHeight, r.bottom), opacity = 1;
    for (let p = el; p; p = p.parentElement) {
      const s = getComputedStyle(p); opacity *= Number(s.opacity);
      if (s.display === 'none' || s.visibility !== 'visible' || s.contentVisibility === 'hidden' || s.clipPath === 'inset(100%)' || (mask && s.maskImage !== 'none')) return false;
      if (/(hidden|clip|scroll|auto)/.test(s.overflow + s.overflowX + s.overflowY)) {
        const b = p.getBoundingClientRect(); l = Math.max(l, b.left); t = Math.max(t, b.top); right = Math.min(right, b.right); bottom = Math.min(bottom, b.bottom);
      }
    }
    return opacity > .02 && right > l && bottom > t;
  }
  let slides = [], candidates = [], flags = [], cards = [], headlines = [], prevActive = -2, frame = 0, lastFrame = 0, lastOpacity = '', stable = 0, stride = 2;
  function rebuild() {
    slides = [...document.querySelectorAll('section.slide')];
    const sel = 'video,canvas,img,picture,[class*=panel],.as-chat-head,.as-transport,.as-timeline,.as-screen,.st-flag,.st-card,h1';
    candidates = slides.map(s => [...s.querySelectorAll(sel)]);
    flags = [...document.querySelectorAll('.st-flag')]; cards = [...document.querySelectorAll('.st-card')];
    headlines = [slides[8]?.querySelector('h1'), slides[9]?.querySelector('h1')];
  }
  function tick(t) {
    if (lastFrame) lab.gaps.push({ t, value: t - lastFrame }); lastFrame = t;
    if (++frame % stride) { requestAnimationFrame(tick); return; }
    const start = performance.now();
    try {
      if (!slides.length) rebuild();
      const active = slides.findIndex(s => s.classList.contains('on'));
      if (active !== prevActive) { rebuild(); prevActive = active; }
      const styles = slides.map(s => { const c = getComputedStyle(s); let hash = 2166136261; for (const ch of s.className) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619); return { opacity: +Number(c.opacity).toFixed(3), visibility: c.visibility, classesHash: hash >>> 0 }; });
      const ghosts = [];
      slides.forEach((s, i) => {
        if (i === active || !visible(s)) return;
        for (const el of candidates[i]) if (visible(el)) ghosts.push({ slide: i + 1, selector: selector(el) });
      });
      const signature = styles.map(s => `${s.opacity}/${s.visibility}`).join(','); stable = signature === lastOpacity ? stable + 1 : 0; lastOpacity = signature;
      const busy = typeof turn !== 'undefined' && !!turn;
      const queued = typeof pendingTurns !== 'undefined' ? pendingTurns.length : null;
      const moving = document.getAnimations().some(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity);
      lab.buf.push({ t, active: active + 1, busy, queued, stable, moving, slides: styles, ghosts,
        flags: flags.filter(x => visible(x)).length, flagsTotal: flags.length, cards: cards.filter(x => visible(x)).length,
        text: headlines.map(h => visible(h, true)) });
    } catch (e) { lab.error = String(e); }
    lab.costs.push(performance.now() - start);
    if (lab.costs.length >= 16) { const recent = lab.costs.slice(-16), mean = recent.reduce((a, b) => a + b, 0) / recent.length; if (mean > 8) stride = 4; else if (mean < 3) stride = 2; }
    lab.sampleStride = stride;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  lab.settle = async (timeout = 10000) => {
    const start = performance.now();
    while (performance.now() - start < timeout) {
      await new Promise(r => setTimeout(r, 50));
      const s = lab.buf[lab.buf.length - 1];
      if (s && s.t >= start && !s.busy && s.queued === 0 && s.stable >= 4 && !s.moving) return { timedOut: false, ms: performance.now() - start, sample: s };
    }
    return { timedOut: true, ms: performance.now() - start, sample: lab.buf[lab.buf.length - 1] || null };
  };
})();
