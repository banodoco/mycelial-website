import { settledPurposeMarks } from '../layout/rail-geometry.js';

/* THE MANUSCRIPT RUNS THE LENGTH OF THE LEFT SIDE (2026-11-12, owner
   feedback: the desktop text read too small). The desktop composition is
   now a band, not a box above the navigation:
     top     a clear gap under the fixed logo, so the logo reads as the
             page's header (10% of the viewport when no logo is measured),
     bottom  10% of the viewport above its foot,
     width   the reading measure (58vw, as before).
   This deliberately overrides the earlier rule that reserved the height
   above the navigation's marks (`reserve = max(128, ...)`): the marks no
   longer push the text up or make it smaller. Only a verse line that sits
   level with them and would run into them is narrowed, so it wraps under
   its hanging indent; every other line keeps the full measure. The largest
   size whose complete manuscript fits the band is used, up to MAX_FIT_PX.
   Still true from before: everything is laid out from the start (unshown
   stanzas included), nothing ever scrolls on desktop, no minimum font is
   imposed, and the marks are read from their SETTLED geometry, never the
   animated row, so the manuscript cannot shrink or rewrap after ink. */
// Past about this the manuscript stops reading as body text and becomes
// display type; a very large screen keeps some dark under it instead.
export const MAX_FIT_PX = 32;
const BAND_FRACTION = 0.10;   // the band's foot margin, and its top fallback
const MARK_GAP = 32;          // clear air between a line and a mark, on every side
const MEASURE_VW = 0.58;

/** Fit the complete desktop manuscript, including paragraphs not yet inked.
 * Layout reads happen only when the viewport, header or loaded font changes.
 * No minimum font is imposed: a short desktop must still never scroll. */
export function createManifestoFit(root, panel, lines, paragraphs) {
  let key = '';
  // the size the last search settled on, and the inputs it was found for
  let settled = null;
  const written = {};
  // write a custom property only when it changes: a write here would make
  // the reads below lay the page out a second time
  const write = (name, value) => {
    if (written[name] === value) return;
    written[name] = value;
    root.style.setProperty(name, value);
  };
  const verses = [...(lines.querySelectorAll?.('.j-manifesto-verse') || [])];
  // A phone reads the manuscript in its own scroller: everything a desktop
  // fit wrote (held verse widths, the band and the size) is taken back, so
  // a desktop window narrowed to a phone width lays out as a fresh phone
  // load, and widening it again searches afresh.
  function release() {
    for (const verse of verses) if (verse.style.maxWidth) verse.style.maxWidth = '';
    for (const name of [...Object.keys(written), '--manifesto-fit-size']) root.style.removeProperty?.(name);
    for (const name of Object.keys(written)) delete written[name];
    key = '';
    settled = null;
  }
  // A loaded face can change the manuscript's metrics at an unchanged box,
  // so it is part of the key; a press with nothing changed then costs one
  // layout read instead of the twelve-step search (2026-11, take-off hitch).
  let fonts = 0;
  document.fonts?.addEventListener?.('loadingdone', () => { fonts++; });
  return function fit(force = false) {
    if (window.innerWidth <= 720) { if (key) release(); return; }
    if (root.hidden) return;
    const w = window.innerWidth, h = window.innerHeight;
    // The logo only ever moves sideways on desktop, so its foot is stable.
    const logo = document.querySelector?.('.ui .logo')?.getBoundingClientRect();
    const top = Math.round(logo && logo.bottom > 0 ? logo.bottom + Math.max(16, h * 0.025) : h * BAND_FRACTION);
    const foot = Math.round(h * BAND_FRACTION);
    const left = panel.getBoundingClientRect().left;
    write('--manifesto-desktop-top', `${top}px`);
    write('--manifesto-desktop-reserve', `${foot}px`);
    write('--manifesto-desktop-width', `${Math.floor(w * MEASURE_VW - left)}px`);
    const next = `${w}x${h}|${top}|${left}|${fonts}|${!!root.classList.contains?.('is-font-pending')}`;
    if (!force && next === key) return;
    key = next;
    // The settled marks, as one zone a line must not run into.
    const marks = settledPurposeMarks(w, h);
    const zone = {
      left: Math.min(...marks.map(mark => mark.x - mark.radius)) - MARK_GAP,
      top: Math.min(...marks.map(mark => mark.y - mark.radius)) - MARK_GAP,
      bottom: Math.max(...marks.map(mark => mark.y + mark.radius)) + MARK_GAP,
    };
    const holdWidth = `${Math.max(0, Math.floor(zone.left - left))}px`;
    const level = verse => {
      const rect = verse.getBoundingClientRect();
      return rect.bottom > zone.top && rect.top < zone.bottom && rect.right > zone.left;
    };
    const panelStyle = getComputedStyle(panel);
    const available = Math.max(1, parseFloat(panelStyle.maxHeight)
      - parseFloat(panelStyle.paddingTop) - parseFloat(panelStyle.paddingBottom));
    // Lay a size out and judge it. A verse line level with the zone is held
    // short of it, so it wraps; holding one can only push the lines after it
    // down, so each round reads every verse in ONE layout and then writes
    // the newly level ones, and a round with nothing new ends it (usually
    // two layouts a probe, at most three). The judgement reads in that same
    // clean layout: the whole height fits, no line still runs into the zone,
    // and only an unbreakable overflow fails the width check (a wrapped line
    // is taller, not wider). Whether a line is held depends on where it
    // lands, so fitting is not strictly monotonic in size: the search's
    // answer is verified below, not assumed.
    const layout = size => {
      root.style.setProperty('--manifesto-fit-size', `${size}px`);
      for (const verse of verses) if (verse.style.maxWidth) verse.style.maxWidth = '';
      const held = new Set();
      let clear = true;
      if (zone.left > left) {
        for (let round = 0; round < 3; round++) {
          const fresh = verses.filter(verse => !held.has(verse) && level(verse));
          if (!fresh.length) break;
          for (const verse of fresh) { held.add(verse); verse.style.maxWidth = holdWidth; }
        }
        clear = verses.every(verse => held.has(verse) || !level(verse));
      }
      const style = getComputedStyle(lines);
      const used = paragraphs.reduce((height, p) => height + p.getBoundingClientRect().height, 0)
        + (paragraphs.length - 1) * (parseFloat(style.rowGap) || 0)
        + (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
      return clear && used <= available - 1 && paragraphs.every(p => p.scrollWidth <= lines.clientWidth + 1);
    };
    // A refit with nothing changed (a forced font event, a re-press) keeps
    // the size it settled on, so two fits never disagree about the wraps.
    let size = settled && settled.key === next && layout(settled.size) ? settled.size : null;
    if (size === null) {
      let low = .25, high = MAX_FIT_PX;
      if (layout(high)) low = high;
      else for (let i = 0; i < 12; i++) {
        const mid = (low + high) / 2;
        if (layout(mid)) low = mid; else high = mid;
      }
      // Verify the answer with the same judgement, stepping down a little
      // (a bounded number of times) if the rounded size lands a line on
      // the zone or the band's foot.
      size = Math.floor(low * 100) / 100;
      for (let i = 0; i < 40 && size > .25 && !layout(size); i++) size = Math.max(.25, Math.round((size - .05) * 100) / 100);
      settled = { key: next, size };
    }
    lines.style.setProperty('--lift', '0px');
    lines.classList.remove('is-lifted');
  };
}
