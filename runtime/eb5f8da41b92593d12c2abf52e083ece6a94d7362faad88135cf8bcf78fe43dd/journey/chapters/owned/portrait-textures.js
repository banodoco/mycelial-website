/* A RETIRED ATLAS GIVES ITS CANVAS BACK NOW, NOT AT SOME LATER GC
   (2026-11-11 — mobile stability). Every remix bakes three fresh canvases
   (portrait-atlas.js: 2048x512 bust + 2048x512 photo + 4096x1024 hover, ~24 MB
   of backing store) and the texture keeps its canvas as `image`. dispose()
   frees the GPU copy only; the backing store waits for the collector, and
   WebKit (every iPhone browser) both accounts canvas memory against a fixed
   page budget and reclaims it lazily, so a visitor remixing a few times in a
   row stacks up dead sheets. Shrinking the canvas to 0x0 frees its pixels at
   once. Only a retired texture reaches this — never a protected or wired one
   — and each atlas owns its canvas alone (one createElement per bake). */
function releaseCanvas(image) {
  if (image && typeof image.getContext === 'function' && image.width > 0) {
    image.width = 0;
    image.height = 0;
  }
}

/** Owns disposal policy for atlas textures connected to portrait uniforms. */
export function createPortraitTextureOwner({ uniforms, permanent }) {
  const protectedTextures = new Set(permanent);

  function isWired(texture) {
    return texture === uniforms.uMapA.value
      || texture === uniforms.uMapP.value
      || texture === uniforms.uMapA2.value
      || texture === uniforms.uMapP2.value
      || texture === uniforms.uMapH.value
      || texture === uniforms.uMapH2.value;
  }

  // R04 — this owner constructs no textures itself (see
  // docs/code-health/evidence/2026-08-21-elegance-run-01/r04/
  // CHARACTERIZATION.md); it is a disposal POLICY over textures the caller
  // constructs. Today's one caller (portraits.js's four internal mutators)
  // already guards every retire() call site with its own `disposed` flag
  // before this file is reached — never calls dispose() below, so this is
  // new, unwired capability, not a change to any current call's outcome.
  // `disposed` is defense in depth: the same class of hazard C04 found
  // unguarded in portraits.tickSwap() (a call that reaches a torn-down
  // owner through a path its own guard doesn't cover) has nowhere to land
  // here once a caller does start calling dispose(). retire()'s own
  // double-call behavior (no de-dup on an owner that was never disposed)
  // is left exactly as characterized — see CHARACTERIZATION.md's note on
  // tools/test-portrait-textures.mjs T5, a pinned assertion of that exact
  // current behavior this order does not disturb.
  let disposed = false;

  return {
    retire(texture) {
      if (disposed) return;
      if (!texture || protectedTextures.has(texture) || isWired(texture)) return;
      texture.dispose();
      releaseCanvas(texture.image);
    },
    /** Idempotent. Permanently seals the owner: every retire() call after
     *  this is a no-op, including one arriving from an in-flight async
     *  continuation that resolves after the caller believes it torn down. */
    dispose() {
      disposed = true;
    },
  };
}
