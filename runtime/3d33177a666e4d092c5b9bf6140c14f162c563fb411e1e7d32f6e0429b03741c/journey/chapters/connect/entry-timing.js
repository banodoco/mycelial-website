// Connect's navigation-only light sequence keeps the same tempo and order.
// Advance the conducted light clock by half a second, not the network's
// camera-readiness/visibility gate and not the visitor-owned scroll schedule.
export const CONNECT_ENTRY_DURATION_S = 3.2;
export const CONNECT_LIGHT_LEAD_S = 0.5;
const smoother = (u) => u * u * u * (u * (u * 6 - 15) + 10);

export function connectEntryLightProgress(f) {
  // The first placement tick must stay dark; the shift is spent only once
  // the real, camera-ready entry clock begins moving.
  if (f <= 0) return 0;
  if (f >= 1) return 1;
  // frame-application hands us smootherstep(elapsed/duration). Undo it to
  // shift actual seconds, then return to the same eased progress domain.
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (smoother(m) < f) lo = m; else hi = m;
  }
  return smoother(Math.min(1, (lo + hi) / 2 + CONNECT_LIGHT_LEAD_S / CONNECT_ENTRY_DURATION_S));
}
