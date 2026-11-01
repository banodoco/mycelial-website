// Shared dismissal for scene details that stay open after their trigger.
(() => {
  const entries = [];
  const navigationKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'PageUp', 'PageDown', 'Home', 'End']);
  const active = () => {
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      try { if (entry.isOpen()) return entry; } catch (error) { console.error('Deck overlay state failed', error); }
    }
    return null;
  };
  const close = (entry = active(), reason = 'outside', event = null) => {
    if (!entry) return;
    try { entry.close(reason, event); } catch (error) { console.error('Deck overlay close failed', error); }
  };
  const contains = (entry, event) => {
    try { return !!entry.contains(event.target, event); } catch (error) { console.error('Deck overlay containment failed', error); return false; }
  };

  window.deckOverlay = {
    register(entry) {
      if (!entry || typeof entry.isOpen !== 'function' || typeof entry.contains !== 'function' || typeof entry.close !== 'function') {
        throw new TypeError('A deck overlay needs isOpen, contains, and close functions');
      }
      entries.push(entry);
      return () => { const i = entries.indexOf(entry); if (i >= 0) entries.splice(i, 1); };
    },
  };

  window.addEventListener('click', (event) => {
    const entry = active();
    if (!entry || contains(entry, event)) return;
    close(entry, 'outside', event);
    event.preventDefault();
    event.stopPropagation();
  }, true);

  window.addEventListener('keydown', (event) => {
    const entry = active();
    if (!entry) return;
    if (event.key === 'Escape') {
      close(entry, 'escape', event);
      event.preventDefault();
      event.stopPropagation();
    } else if (navigationKeys.has(event.key)) {
      close(entry, 'navigation', event); // Let the deck receive the same key and navigate.
    }
  }, true);

  let touch = null;
  window.addEventListener('touchstart', (event) => {
    const point = event.touches[0];
    touch = point ? { x: point.clientX, y: point.clientY,
      interactive: !!event.target.closest?.('button, a, [role="button"], .fw-card, .fw-full, .fw-ask, .vc, .vc-box, .vc-note, .st-card, .st-flag') } : null;
  }, { capture: true, passive: true });
  window.addEventListener('touchend', (event) => {
    if (!touch) return;
    const point = event.changedTouches[0], start = touch;
    touch = null;
    if (!point || start.interactive) return;
    const dx = point.clientX - start.x, dy = point.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > 1.5 * Math.abs(dy)) close(active(), 'navigation', event); // Same threshold as deck swipe; do not consume it.
  }, { capture: true, passive: true });
})();
