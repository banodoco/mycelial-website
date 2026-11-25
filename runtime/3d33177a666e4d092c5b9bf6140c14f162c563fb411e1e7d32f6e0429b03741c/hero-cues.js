/* THE HERO'S TWO QUIET CUES. Neither is a destination of its own; each
   calls into a control the page already has. They appear with the hero copy,
   seconds before the journey is live, so a press during loading has to
   answer at once: a cue that looks available and does nothing is a broken
   promise (2026-10-19, owner: "how come those buttons don't work during the
   loading phase?").

   EXPLORE does what a scroll does at the hero: the five marks wave and the
   screen reader hears the same hint. Once the journey is live that is
   journey.cueNavigation(), the function the scroll model calls as
   onScrollAttempt. Before then the cue plays the same wave on whichever
   navigator is on screen: the live rail's own rail.cueNavigation() once the
   handoff has built it, or the first-paint shell before that (index.html
   .j-rail-preboot, which carries the rail's classes, marks and --i stagger,
   so site.css's j-rail-wave applies to it unchanged). The hint goes through
   a live region of our own, because the journey's does not exist yet.
   Nothing is held for later, so the journey never replays the press as a
   second wave. A shell wave still running when the live rail replaces the
   shell continues on the live rail from the same point.

   OVERVIEW opens the rail's site-map panel through rail.openMenu(), the
   function the menu button's own click handler calls. It passes itself as
   the trigger, which is what that parameter is for: Escape returns focus
   here, where the visitor was, not to the ring in the corner. The panel
   needs only the rail, which journey/boot/handoff.js builds as soon as the
   journey module arrives, before chapters, the growth and GPU preparation;
   main.js passes it to railReady(). Its links queue a chapter through the
   entry queue until the journey is live, like every other early press.
   The rail cannot come sooner without moving it ahead of the scene, which
   the handoff waits for. A press before the rail exists waits where it was
   made: aria-busy, the arrow breathing (mycelial.css .is-pending), and the
   panel opens the moment the rail does, with no second press. If the
   journey never starts, the wait is dropped.

   PAGE lifetime: installed once, never removed. */

// The journey's own hint (journey/journey.js cueNavigation); keep in step.
const NAVIGATION_HINT = 'Use the navigation buttons to move between sections.';
// rail.js cueNavigation(): the class stays 980ms (0.68s wave plus the 65ms
// stagger across five marks) and a second cue inside 1s is ignored.
const WAVE_MS = 980;
const WAVE_COOLDOWN_MS = 1000;
const WAVE_ANIMATION = 'j-rail-navigation-wave';

// Viewport position from layout, not from the painted box: on phones the
// hero rides a growth-lift translate during the intro, and the aim is for
// where the button settles.
function layoutCentre(node) {
  let x = node.offsetWidth / 2;
  let y = node.offsetHeight / 2;
  for (let n = node; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
  return { x, y };
}

/** Wires both cues. Returns the page's two calls into them:
 *  railReady(rail) when the handoff has built the live rail, and
 *  unavailable() when the journey will not start. */
export function attachHeroCues(root) {
  const none = { railReady() {}, unavailable() {} };
  if (!root) return none;
  const explore = root.querySelector('.hero-cue-explore');
  const overview = root.querySelector('.hero-cue-overview');
  let rail = null;
  let failed = false;

  const liveRail = () => window.journey?.ui?.rail || rail;

  /* ---- the hint, until the journey's own live region exists ---- */
  const region = document.createElement('div');
  region.className = 'j-live';
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  document.body.append(region);
  let hintTimer = null;
  const announce = (message) => {
    clearTimeout(hintTimer);
    region.textContent = '';
    hintTimer = setTimeout(() => { region.textContent = message; }, 60);
  };

  /* ---- Explore ---- */
  let shellWave = null;   // { shell, startedAt, timer } while the shell waves
  let lastShellWaveAt = -Infinity;
  const endShellWave = () => {
    if (!shellWave) return;
    clearTimeout(shellWave.timer);
    shellWave.shell.classList.remove('j-rail-wave');
    shellWave = null;
  };
  const waveShell = () => {
    const shell = document.querySelector('.j-rail-preboot');
    if (!shell) return false;
    const now = performance.now();
    if (now - lastShellWaveAt < WAVE_COOLDOWN_MS) return false;
    lastShellWaveAt = now;
    endShellWave();
    void shell.offsetWidth;
    shell.classList.add('j-rail-wave');
    shellWave = { shell, startedAt: now, timer: setTimeout(endShellWave, WAVE_MS) };
    return true;
  };
  // The handoff removes the shell in the same task that hands us the rail.
  // Carry an unfinished wave across: same class, animations seeked to the
  // elapsed time, removed when the shell's would have been.
  const carryShellWave = (live) => {
    if (!shellWave || !live.root) return;
    const elapsed = performance.now() - shellWave.startedAt;
    endShellWave();
    if (elapsed >= WAVE_MS || live.root.classList.contains('j-rail-wave')) return;
    live.root.classList.add('j-rail-wave');
    for (const animation of live.root.getAnimations({ subtree: true })) {
      if (animation.animationName === WAVE_ANIMATION) animation.currentTime = elapsed;
    }
    setTimeout(() => live.root.classList.remove('j-rail-wave'), WAVE_MS - elapsed);
  };

  explore?.addEventListener('click', () => {
    if (window.journey) { window.journey.cueNavigation(); return; }
    const fired = rail ? rail.cueNavigation() : waveShell();
    if (fired) announce(NAVIGATION_HINT);
  });

  /* ---- Overview ---- */
  let pending = null;     // { keyboard } while a press waits for the rail
  const clearPending = () => {
    pending = null;
    overview?.classList.remove('is-pending');
    overview?.removeAttribute('aria-busy');
  };
  const openOverview = (target, keyboard) => {
    target.openMenu(overview, { keyboard });
  };

  overview?.addEventListener('click', (e) => {
    // detail is 0 for Enter/Space: keyboard entry lands on the panel's Close
    // control, pointer entry on its heading, exactly as the menu button does.
    const keyboard = e.detail === 0;
    const target = liveRail();
    if (target) { clearPending(); openOverview(target, keyboard); return; }
    if (failed) return;
    pending = { keyboard };
    overview.classList.add('is-pending');
    overview.setAttribute('aria-busy', 'true');
  });

  const unavailable = () => {
    failed = true;
    clearPending();
    endShellWave();
  };
  // handoff.js marks a journey that failed to start; main.js reports a scene
  // that never existed (no handoff, so no rail) through unavailable().
  new PerformanceObserver((list, observer) => {
    if (!list.getEntriesByName('journey-fallback').length) return;
    observer.disconnect();
    unavailable();
  }).observe({ type: 'mark', buffered: true });

  /* ---- Explore's aim ----
     The navigator's hero seat is the same calc the rail positions itself
     with (journey/site.css), read through a probe so the aim never depends
     on the rail's entrance or chapter transforms. */
  const arrow = explore?.querySelector('.hero-cue-arrow');
  if (arrow) {
    const aim = () => {
      const probe = document.createElement('span');
      probe.style.cssText = 'position:fixed;visibility:hidden;left:50%;height:0;'
        + 'bottom:calc(var(--nav-centre-bottom) + var(--nav-hero-lift));';
      document.body.append(probe);
      const seat = probe.getBoundingClientRect();
      probe.remove();
      // An SVG has no offset chain: take the button's, then the arrow's place
      // inside it (both paint under the same translate, so it cancels).
      const from = layoutCentre(explore);
      const a = arrow.getBoundingClientRect();
      const b = explore.getBoundingClientRect();
      from.x += a.left + a.width / 2 - (b.left + b.width / 2);
      from.y += a.top + a.height / 2 - (b.top + b.height / 2);
      const deg = Math.atan2(seat.top - from.y, seat.left - from.x) * 180 / Math.PI;
      // Never shallower than a diagonal. From a desktop's left column the true
      // bearing is nearly level, and a level arrow reads as "next", not as
      // "down there".
      explore.style.setProperty('--cue-aim', `${Math.min(135, Math.max(45, deg)).toFixed(1)}deg`);
    };
    aim();
    // The hero box changes with every viewport change and every reflow of the
    // copy, which are exactly the moments the bearing can change.
    new ResizeObserver(aim).observe(root.closest('.hero') || root);
  }

  return {
    railReady(live) {
      if (!live || rail) return;
      rail = live;
      carryShellWave(live);
      if (!pending) return;
      const { keyboard } = pending;
      clearPending();
      openOverview(live, keyboard);
    },
    unavailable,
  };
}
