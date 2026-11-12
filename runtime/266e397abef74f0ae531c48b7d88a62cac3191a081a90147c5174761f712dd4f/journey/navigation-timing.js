/* Button-led camera pacing. All ordinary directions share a calm baseline:
 * the selected path's authored duration runs at 45% speed, with at least 2.6s
 * to travel and hand over its content. This prevents short paths (including
 * Ownership and reverse journeys) from becoming abrupt 1–2 second hops.
 *
 * Keep the few already-long, deliberately paced routes at their reviewed
 * tempo. Their geometry has extra travel time baked in; multiplying that
 * again would turn them into unnecessarily long flights. The Intro/Purpose
 * wrap retains its full orbit. Manifesto owns its separate reading clock.
 */
export const DEFAULT_NAVIGATION_SPEED = 0.45;
export const MIN_NAVIGATION_SECONDS = 2.6;

export const NAVIGATION_SPEED = Object.freeze({
  'final|mission': 0.75,
  'connect|equip': 0.70,
  // The one long continuous arc round the specimen: 1.2 s authored / 0.36 =
  // 3.33 s on the quintic keeps peak speed ~13.5 u/s (as the old 2.67 s
  // cubic had) with no launch kick. Symmetric on the way back.
  'inspire|mission': 0.36,
});

export const NAVIGATION_DIRECTION_SPEED = Object.freeze({
  'inspire>connect': 0.48,
  'connect>final': 0.42,
  'final>connect': 0.49,
});

function routeKey(fromId, toId) {
  return [fromId, toId].sort().join('|');
}

export function navigationSpeed(fromId, toId) {
  return NAVIGATION_DIRECTION_SPEED[`${fromId}>${toId}`]
    || NAVIGATION_SPEED[routeKey(fromId, toId)]
    || DEFAULT_NAVIGATION_SPEED;
}

/** Price the selected path once, never compound the intermediate legs. */
export function navigationDurationSeconds(baseDuration, fromId, toId) {
  if (!(baseDuration > 0) || !Number.isFinite(baseDuration)) {
    throw new TypeError(`baseDuration must be a positive finite number; got ${baseDuration}`);
  }
  return Math.max(MIN_NAVIGATION_SECONDS, baseDuration / navigationSpeed(fromId, toId));
}
