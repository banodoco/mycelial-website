// page-error.js — announce a NON-FATAL failure on the page's error channel.
//
// main.js feeds `window.__pageErrors` and the ?debug=1 overlay
// (journey/boot/scene-note.js recordError) from window 'error' events, and a
// failure that code catches on purpose never reaches window. That is right
// for control flow — a degraded boot should keep going — and wrong for the
// record: an empty catch on the boot path is how a page can fail to show its
// scene and leave nothing behind. So a caught failure that matters is
// re-announced here, the way journey/failure-guard.js already announces a
// retired subsystem: one reader (main.js's listener), no second reporting
// path, and nothing here changes what the caller does next.
//
// A LEAF with no imports, so organism/hero-spores.js (whose graph must stay
// free of anything heavy) can use it. Safe in a worker or in node, where
// there is no window: the message still goes to the console.

/** Record `message` (and the error, if any) as a page error. Never throws. */
export function reportPageError(message, error) {
  const text = error ? `${message}: ${(error && error.message) || error}` : String(message);
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'
        && typeof ErrorEvent === 'function') {
      window.dispatchEvent(new ErrorEvent('error', { message: text, error }));
      return;
    }
  } catch { /* the channel itself failed: fall through to the console */ }
  try { console.error(text); } catch { /* nothing left to tell */ }
}
