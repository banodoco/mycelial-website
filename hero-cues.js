/* THE HERO'S TWO QUIET CUES (prototype, 2026-10-18). Neither is a
   destination of its own; each calls into a control the page already has.

   EXPLORE does what a scroll does at the hero: journey.cueNavigation(), the
   same function the scroll model calls as onScrollAttempt, so the five marks
   wave and the screen reader hears the same hint. Its arrow is aimed at the
   navigator's centre from wherever the button sits.

   OVERVIEW opens the rail's site-map panel through rail.openMenu(), the
   function the menu button's own click handler calls. It passes itself as
   the trigger, which is what that parameter is for: Escape returns focus
   here, where the visitor was, not to the ring in the corner.

   A press that arrives before the journey is live is held and replayed on
   activation, the way journey/boot/handoff.js holds a first scroll.
   'journey-interactive' is the mark activateJourney() sets right after
   window.journey exists. PAGE lifetime: installed once, never removed. */

const LIVE_MARK = 'journey-interactive';

function whenLive(run) {
  if (window.journey) { run(); return; }
  new PerformanceObserver((list, observer) => {
    if (!list.getEntriesByName(LIVE_MARK).length) return;
    observer.disconnect();
    run();
  }).observe({ type: 'mark', buffered: true });
}

// Viewport position from layout, not from the painted box: on phones the
// hero rides a growth-lift translate during the intro, and the aim is for
// where the button settles.
function layoutCentre(node) {
  let x = node.offsetWidth / 2;
  let y = node.offsetHeight / 2;
  for (let n = node; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
  return { x, y };
}

export function attachHeroCues(root) {
  if (!root) return;
  const explore = root.querySelector('.hero-cue-explore');
  const overview = root.querySelector('.hero-cue-overview');
  const held = new Set();
  const hold = (name, run) => {
    if (held.has(name)) return;
    held.add(name);
    whenLive(() => { held.delete(name); run(); });
  };

  explore?.addEventListener('click', () => {
    hold('explore', () => window.journey.cueNavigation());
  });

  overview?.addEventListener('click', (e) => {
    // detail is 0 for Enter/Space: keyboard entry lands on the panel's Close
    // control, pointer entry on its heading, exactly as the menu button does.
    const keyboard = e.detail === 0;
    hold('overview', () => window.journey.ui.rail.openMenu(overview, { keyboard }));
  });

  /* The navigator's hero seat is the same calc the rail positions itself
     with (journey/site.css), read through a probe so the aim never depends
     on the rail's entrance or chapter transforms. */
  const arrow = explore?.querySelector('.hero-cue-arrow');
  if (!arrow) return;
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
