/* REST CADENCE — how often the composer draws when nobody is watching it move
   (2026-11-11 — mobile stability: "something running after I click around a
   bunch ... the phone heats up").

   Before this, the frame loop drew the full pipeline (4x MSAA scene, bloom,
   TAA, grade, output — four full-screen passes after the resolve) on every
   animation frame for the life of the page: at rest, while the visitor reads,
   and under the menu panel that covers 92% of a phone screen. A phone GPU
   held at that load for minutes is a phone that heats, throttles and, with
   memory tight, has its tab killed.

   The decision is pure (this file) and the gate is in ./animation.js. The
   loop, the shared clock and every animator still run every frame (see the
   long note at animation.js's render gate for why the loop itself must never
   stop); only the composer pass is skipped, and the canvas keeps showing the
   last finished frame, exactly as the existing hold does.

     every = 1   full rate. Any flight, any input in the last IDLE_MS, any
                 fine-pointer device, the capture freeze, or a reduced
                 condition this file cannot see.
     every = 2   a touch device that has been AT REST with no input for
                 IDLE_MS: half rate. The scene at rest is a slow ambient sway
                 and drift; at 30 fps it is the same picture, for half the GPU.
     every = 0   a touch device whose menu panel covers the scene: hold the
                 last frame. The strip the panel leaves is under the 62% scrim.

   Any input returns to full rate on the same frame (input() is called from
   capture-phase listeners, before any handler that could start a flight).
   NOT applied on fine-pointer (desktop) devices: the brief was the phone, and
   a desktop at rest has a fan and a power cord. */

export const IDLE_MS = 8000;
export const COVER_POLL_MS = 250;

/**
 * @param {object} io
 * @param {function(): number}  io.now         ms clock (performance.now)
 * @param {function(): boolean} io.coarse      touch-primary device right now
 * @param {function(): boolean} io.atRest      the journey is landed (no flight)
 * @param {function(): boolean} io.covered     an overlay covers the scene
 * @param {function(): boolean} [io.frozen]    capture freeze: never throttle
 * @returns {{ frame(): number, input(): void }}
 */
export function createRestCadence({ now, coarse, atRest, covered, frozen = () => false }) {
  let lastBusy = now();
  let coverAt = -Infinity, cover = false;
  return {
    /** The cadence for this frame: 1, 2, or 0 (hold). */
    frame() {
      const t = now();
      if (frozen() || !coarse()) { lastBusy = t; return 1; }
      if (t - coverAt >= COVER_POLL_MS) { coverAt = t; cover = !!covered(); }
      if (!atRest()) { lastBusy = t; return 1; }
      if (cover) return 0;
      return t - lastBusy >= IDLE_MS ? 2 : 1;
    },
    /** A visitor touched, typed or scrolled: full rate from this frame on. */
    input() { lastBusy = now(); coverAt = -Infinity; },
  };
}
