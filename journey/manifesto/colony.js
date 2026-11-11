import * as THREE from 'three';
import { connectedLineIndex } from './connected-lines.js';
import { COLONY_RETIREMENT_GLSL } from './retirement.js';
import { BODY_DISSOLVE_GLSL } from '../lib/body-dissolve.js';
import { aerialPlacements, planAerialReveals, manifestoPose, CAMERA_SECONDS } from './pose.js';
import { groundY, makeRng } from '../chapters/final/world.js';

// Prepared once with Final. Every instance shares the hero's actual buffers;
// only placement, uniform scale, yaw and light vary. No rim-only LOD species.
//
// THE AERIAL VIEW DRAWS A STRIDED SUBSET OF THOSE BUFFERS (2026-10-03 —
// Hannah: the Manifesto "feels laggy"). Measured at 1440x900: every one of
// the 560 bodies drew the hero's FULL strand set — 83.7M vertices a frame —
// and the flight ran at 11-14 fps (8.5 settled) against ~40 at the hero
// rest on the same machine; with the colony hidden it ran at the rest rate.
// From the aerial camera a body is 30-80 px tall, so most of those strands
// land on the same pixels. Each layer therefore draws through its own index
// that keeps every Nth strand / spark / body triangle — still the hero's
// own vertices, colours and shaders, just fewer of them. LOD_STRIDE is the
// knob; 1 restores the full set.
//   Measured per layer type (settled aerial pose, strides swept one at a
//   time): the additive STRAND layers are the whole cost — lines 1 -> 8 took
//   it from 10 to 16 fps, while meshes 1 -> 8 changed nothing. So the opaque
//   bodies keep every triangle (their occlusion stays exact) and only the
//   light-carrying layers thin out.
//   A body's glow is the SUM of its strands, so thinning alone dims the
//   colony: each kept strand / spark carries `stride` times the light
//   (uColonyGain), which keeps the colony's light per pixel where it was.
const LOD_STRIDE = { lines: 8, points: 3, mesh: 1 };

/* TWO TIERS BY SCREEN SIZE (2026-10-04 — Hannah: "lets try" level of detail,
   after measuring the settled aerial view at ~20M triangles, 2M segments and
   0.5M points a frame — about 30 ms of GPU work, the bulk of the Manifesto's
   frame). The bodies never move, and the flight's camera path is known
   (pose.js manifestoPose), so prepare() works out how tall each body ever
   gets on screen and splits them:
     NEAR — any body that reaches NEAR_PX on screen at any moment of the
            climb or the descent keeps the set above, exactly as before;
     FAR  — every other body draws the same layers, thinned again: strands
            by FAR_THIN more (light compensated the same way, so a pixel's
            glow holds), and the opaque shells through a CLUSTERED
            index — their own vertices welded on a grid of FAR_CELL_PX of
            the largest far body's height, which keeps the silhouette and
            occlusion to well under a pixel and drops most triangles.
   The sparks are NOT thinned further: a quarter of them at four times the
   light read as a coarse speckle on the far caps in the side-by-side
   comparison, where thinner strands did not. Same buffers, same
   materials' shaders (no new programs), only new indices. */
const NEAR_PX = 70;
const FAR_THIN = 1;
const FAR_CELL_PX = 1.25;
const BODY_HEIGHT = 3.6;         // a body's height in hero units (stem foot to cap top)

/** An index over a triangle mesh with its vertices welded on a `cell` grid:
 *  every triangle is re-pointed at the FIRST vertex of each corner's cell,
 *  collapsed triangles and duplicates are dropped. No vertex is created or
 *  moved — the index only chooses which existing vertices to draw — so the
 *  shared attributes still serve both tiers. */
function clusteredIndex(source, cell) {
  const position = source.attributes.position;
  const base = source.index ? source.index.array : null;
  const count = base ? base.length : position.count;
  const rep = new Int32Array(position.count).fill(-1);
  const cells = new Map();
  const key = (i) => `${Math.floor(position.getX(i) / cell)},${Math.floor(position.getY(i) / cell)},${Math.floor(position.getZ(i) / cell)}`;
  const at = (i) => {
    if (rep[i] < 0) {
      const k = key(i);
      let r = cells.get(k);
      if (r === undefined) { r = i; cells.set(k, r); }
      rep[i] = r;
    }
    return rep[i];
  };
  const out = new Uint32Array(count);
  const seen = new Set();
  let o = 0;
  for (let t = 0; t + 2 < count; t += 3) {
    const a = at(base ? base[t] : t), b = at(base ? base[t + 1] : t + 1), c = at(base ? base[t + 2] : t + 2);
    if (a === b || b === c || a === c) continue;
    const sorted = [a, b, c].sort((x, y) => x - y).join(',');
    if (seen.has(sorted)) continue;
    seen.add(sorted);
    out[o++] = a; out[o++] = b; out[o++] = c;
  }
  return new THREE.BufferAttribute(out.slice(0, o), 1);
}

/** An index over `source` that keeps every `stride`th primitive (`unit`
 *  indices each: 2 for segments, 1 for points, 3 for triangles). */
function stridedIndex(source, unit, stride) {
  const base = source.index ? source.index.array : null;
  const count = base ? base.length : source.attributes.position.count;
  const prims = Math.floor(count / unit);
  const kept = Math.ceil(prims / stride);
  const out = new Uint32Array(kept * unit);
  let o = 0;
  for (let p = 0; p < prims; p += stride) {
    for (let k = 0; k < unit; k++) {
      const v = p * unit + k;
      out[o++] = base ? base[v] : v;
    }
  }
  return new THREE.BufferAttribute(out.subarray(0, o), 1);
}

/** The registry slot the branch reads (manifesto/branch.js prewarm). */
export const AERIAL_COLONY = Symbol.for('mycelial.manifesto.aerialColony');

export function createAerialColony(sceneApi, seats, time = { value: 0 }) {
  const random = makeRng(0x41e21a);
  const bodies = aerialPlacements(seats, random, groundY);
  const group = new THREE.Group();
  group.name = 'manifesto-aerial-colony';
  group.visible = false;
  const gate = { value: 0 }, retiring = { value: 0 }, retirementStart = { value: 1 };
  const clock = { value: 0 }, portrait = { value: 0 };
  // the ring's own seats: 1 while aloft, easing to 0 through a Return while
  // Final's original ring comes back underneath them (see setSeatLight)
  const seatLight = { value: 1 }, seatRetiring = { value: 0 }, seatRetirementStart = { value: 1 };
  // Per-body arrival windows in BODY order (the links read them that way);
  // the instanced attributes below are written in ARRIVAL order instead.
  const plan = new Float32Array(bodies.length * 2);
  const fogNear = { value: 30 }, fogFar = { value: 150 };
  const poseBase = new Float32Array(bodies.flatMap(b => [b.x, b.gy, b.z, b.s]));
  const toneBase = new Float32Array(bodies.flatMap(b => [b.yaw, b.tone]));
  // Each tier owns its instance attributes; prepare() fills them.
  const tierOf = (name, thin) => ({
    name, thin, layers: [], starts: new Float32Array(0), drawn: -1,
    bodyIds: new Int32Array(0), activeIds: new Int32Array(bodies.length).fill(-1),
    poses: new THREE.InstancedBufferAttribute(poseBase.slice(), 4),
    tones: new THREE.InstancedBufferAttribute(toneBase.slice(), 2),
    arrivals: new THREE.InstancedBufferAttribute(new Float32Array(bodies.length * 2), 2),
  });
  const tiers = [tierOf('near', 1), tierOf('far', FAR_THIN)];
  const specimenBounds = new THREE.Sphere(new THREE.Vector3(), -1);
  const layerBounds = new THREE.Sphere();
  const viewFrustum = new THREE.Frustum(), viewMatrix = new THREE.Matrix4();
  const viewProjection = new THREE.Matrix4(), worldBody = new THREE.Sphere();
  let cullView = false;
  let purposeMode = false;
  // the welding grid, in hero units: FAR_CELL_PX of the tallest a far body
  // can be (NEAR_PX) — so a weld never spans more than ~1 px on screen
  const farCell = BODY_HEIGHT * FAR_CELL_PX / NEAR_PX;
  // ONLY ARRIVED BODIES ARE DRAWN. A body before its window is already dark
  // (colonyArrival() = 0 discards every fragment) but still paid its full
  // vertex cost. prepare() sorts the instances by arrival start, so the
  // bodies that can be lit form a prefix. set() then submits only the
  // conservative in-view subset of that prefix, on phones and desktop.
  const seatRetirementGLSL = COLONY_RETIREMENT_GLSL.replaceAll('uColonyRetiring', 'uColonySeatRetiring')
    .replaceAll('uColonyRetirementStart', 'uColonySeatRetirementStart').replaceAll('colonyPresence', 'colonySeatPresence');
  const header = `${COLONY_RETIREMENT_GLSL}
${seatRetirementGLSL}

    attribute vec4 aColonyPose;
    attribute vec2 aColonyTone;
    attribute vec2 aColonyReveal;
    uniform float uColonySeconds;
    uniform float uColonyPortrait;
    uniform mat4 uColonyFrame;
    uniform float uColonyGate;
    uniform float uColonyGain;
    uniform float uColonySeatLight;
    varying float vColonyLight;
    varying float vColonyFade;
    float colonyArrival() {
      return aColonyReveal.x < 0. ? 1. : smoothstep(aColonyReveal.x, aColonyReveal.x + aColonyReveal.y, uColonySeconds);
    }
    mat4 colonyMatrix() {
      float c = cos(aColonyTone.x), s = sin(aColonyTone.x), k = aColonyPose.w * mix(0.88, 1., colonyArrival());
      return mat4(vec4(c*k,0.,-s*k,0.),vec4(0.,k,0.,0.),vec4(s*k,0.,c*k,0.),vec4(aColonyPose.xyz,1.)) * uColonyFrame;
    }
  `;
  const connectedCaps = new WeakMap();
  function addLayer(source, frame) {
    for (const tier of tiers) addTierLayer(source, frame, tier);
  }
  function addTierLayer(source, frame, tier) {
    const src = source.material;
    if (!src || !(src.isMeshBasicMaterial || src.uniforms?.uProg || src.userData?.uWin)) return;
    if (!source.geometry.boundingSphere) source.geometry.computeBoundingSphere();
    specimenBounds.union(layerBounds.copy(source.geometry.boundingSphere).applyMatrix4(frame));
    const geometry = new THREE.InstancedBufferGeometry();
    // Attribute references are shared, never copied per body; only the
    // (strided) index is this layer's own — see LOD_STRIDE.
    for (const [key, attribute] of Object.entries(source.geometry.attributes)) geometry.setAttribute(key, attribute);
    const [unit, stride] = source.isLineSegments ? [2, LOD_STRIDE.lines * tier.thin]
      : source.isPoints ? [1, LOD_STRIDE.points] : [3, LOD_STRIDE.mesh];
    // Only the cap surface has two independent neighbouring directions.
    // Its graph must remain connected; striding its short edges made a
    // field of dotted caps during the desktop ascent.
    const tang = source.geometry.attributes.tang?.array;
    const tang2 = source.geometry.attributes.tang2?.array;
    const connectedCap = unit === 2 && tang && tang2 && tang.some((v, i) => v !== tang2[i]);
    let capIndex = null;
    if (connectedCap) {
      let indices = connectedCaps.get(source.geometry);
      if (!indices) connectedCaps.set(source.geometry, indices = new Map());
      if (!indices.has(stride)) indices.set(stride, connectedLineIndex(source.geometry, stride));
      capIndex = indices.get(stride);
    }
    if (capIndex) geometry.setIndex(capIndex.index);
    else if (unit === 3 && tier.name === 'far') {
      // the frame's scale carries hero units into this geometry's own
      geometry.setIndex(clusteredIndex(source.geometry, farCell / Math.max(1e-6, frame.getMaxScaleOnAxis())));
    } else {
      geometry.setIndex(stride > 1 ? stridedIndex(source.geometry, unit, stride) : source.geometry.index);
    }
    tier.layers.push(geometry);
    geometry.setAttribute('aColonyPose', tier.poses); geometry.setAttribute('aColonyTone', tier.tones);
    geometry.setAttribute('aColonyReveal', tier.arrivals);
    geometry.instanceCount = 0;   // set() draws each tier's arrived prefix
    const material = src.clone();
    /* intro.js's shellsRestore() state, PINNED, not inherited (as Final's
       cloneShellMat does). The colony is cloned at boot, while the hero's
       stem shell may still carry the growth's clip plane — and clone()
       shares the Plane itself, so every colony stem was sliced at whatever
       height the growth last left it (measured: 0.02, i.e. nearly the whole
       stem gone). Worse, clipping is applied only inside a real draw, so the
       boot warm-up compiled the UNclipped program and the clipped one linked
       on the first Manifesto frame: a shader compile mid-flight (2026-10-04,
       Hannah: "random lag when I move ... from Purpose into Manifesto"). */
    if (src.isMeshBasicMaterial) { material.opacity = 1; material.transparent = false; material.clippingPlanes = null; }
    // light compensation for the thinning (1 for the unthinned opaque bodies)
    const own = { uniforms: { uColonyFrame: { value: frame }, uColonyGate: gate, uColonyRetiring: retiring, uColonyRetirementStart: retirementStart, uColonySeconds: clock, uColonyPortrait: portrait,
      uColonyGain: { value: capIndex ? capIndex.gain : stride }, uColonySeatLight: seatLight, uColonySeatRetiring: seatRetiring, uColonySeatRetirementStart: seatRetirementStart } };
    function vertex(shader) {
      return (src.isMeshBasicMaterial ? 'varying vec3 vBodyDissolvePosition;\n' : '') + header + shader
        .replace(/\bmodelViewMatrix\b/g, '(modelViewMatrix * colonyMatrix())')
        .replace(/\bmodelMatrix\b/g, '(modelMatrix * colonyMatrix())')
        .replace('#include <project_vertex>', 'vec4 mvPosition = modelViewMatrix * colonyMatrix() * vec4(transformed,1.); gl_Position = projectionMatrix * mvPosition;')
        .replace('void main() {', `void main() {
          ${src.isMeshBasicMaterial ? 'vBodyDissolvePosition = (uColonyFrame * vec4(position, 1.0)).xyz + vec3(aColonyTone.x * 13.0);' : ''}
          vec4 centre = projectionMatrix * modelViewMatrix * vec4(aColonyPose.xyz,1.);
          vec2 screen = centre.xy / max(0.001, centre.w);
          float quiet = mix(smoothstep(-0.20,0.15,screen.x), smoothstep(0.05,0.4,screen.y), uColonyPortrait);
          // The ring's own seats (reveal window < 0) are the epilogue's
          // existing mushrooms, which Final hides the moment the branch
          // opens (ring.setAerial). They must not ride the colony's fade-in
          // gate, or they go dark through the first seconds of the flight —
          // and the last seconds of the Return — and pop back on landing.
          vColonyFade = aColonyReveal.x < 0. ? colonySeatPresence(uColonySeatLight, aColonyPose.xz) : colonyPresence(uColonyGate, aColonyPose.xz) * colonyArrival();
          vColonyLight = uColonyGain * aColonyTone.y * vColonyFade * mix(0.60,1.,quiet);`)
        .replace('float sz = psize', 'float sz = aColonyPose.w * psize')
        .replace('vFade = mix(1.0, 1.0 - exp(-gap), uFadeOn);', 'vFade = mix(1.0, max(0.20, 1.0 - exp(-gap)), uFadeOn);');
    }
    // Use the same stable body-space breakup as Purpose. Screen-coordinate
    // noise slid over the bodies during camera movement; this pattern stays
    // attached and reverses exactly on the existing arrival/return clock.
    const dissolve = src.isMeshBasicMaterial ? ' dissolveBody(vColonyFade);' : '';
    function fragment(shader) {
      return (src.isMeshBasicMaterial ? BODY_DISSOLVE_GLSL : '') + 'varying float vColonyLight;\nvarying float vColonyFade;\n' + shader.replace(/void main\(\)\s*\{/, `void main() { if(vColonyLight < 0.001) discard;${dissolve}`)
        .replace(/gl_FragColor = vec4\(vColor/g, 'gl_FragColor = vec4(vColor * vColonyLight')
        .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.rgb *= vColonyLight;');
    }
    if (material.isShaderMaterial) {
      for (const key of Object.keys(src.uniforms)) material.uniforms[key] = src.uniforms[key];
      Object.assign(material.uniforms, own.uniforms, { uProg: { value: 2 }, fogNear, fogFar });
      material.vertexShader = vertex(src.vertexShader);
      material.fragmentShader = fragment(src.fragmentShader);
    } else {
      material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, own.uniforms);
        shader.vertexShader = vertex(shader.vertexShader);
        shader.fragmentShader = fragment(shader.fragmentShader);
      };
      material.customProgramCacheKey = () => 'manifesto-colony-body-dissolve-v3';
    }
    const object = source.isPoints ? new THREE.Points(geometry, material)
      : source.isMesh ? new THREE.Mesh(geometry, material) : new THREE.LineSegments(geometry, material);
    object.frustumCulled = false;
    group.add(object);
  }
  function walk(root, parent) {
    root.updateMatrix();
    const frame = parent.clone().multiply(root.matrix);
    if (root.geometry) addLayer(root, frame);
    else for (const child of root.children) {
      if (child.geometry || child === sceneApi.groups.mushroom) walk(child, frame);
    }
  }
  walk(sceneApi.groups.stem, new THREE.Matrix4());
  walk(sceneApi.groups.mushroom.parent, new THREE.Matrix4());
  // Bound every actual shell, strand and spark layer together. A generous
  // margin also covers animated tissue; crossing a screen edge never clips
  // a cap merely because its foot is already outside the frame.
  const bodyBounds = bodies.map(b => {
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw), p = specimenBounds.center;
    return new THREE.Sphere(new THREE.Vector3(
      b.x + b.s*(c*p.x+s*p.z), b.gy+b.s*p.y, b.z+b.s*(-s*p.x+c*p.z)),
    specimenBounds.radius*b.s*1.15 + .5);
  });

  function writeBody(tier, src, dst) {
    tier.arrivals.array[dst*2] = plan[src*2]; tier.arrivals.array[dst*2+1] = plan[src*2+1];
    for (let k = 0; k < 4; k++) tier.poses.array[dst*4+k] = poseBase[src*4+k];
    tier.tones.array[dst*2] = toneBase[src*2]; tier.tones.array[dst*2+1] = toneBase[src*2+1];
  }

  function updateViewFrustum() {
    const camera = sceneApi.camera;
    camera.updateMatrixWorld();
    group.updateWorldMatrix(true, false);
    // Twelve percent beyond the visible image is kept as an edge guard.
    viewProjection.copy(camera.projectionMatrix);
    viewProjection.elements[0] /= 1.12;
    viewProjection.elements[5] /= 1.12;
    viewMatrix.multiplyMatrices(viewProjection, camera.matrixWorldInverse);
    viewFrustum.setFromProjectionMatrix(viewMatrix);
  }

  // A whole-attribute rewrite (prepare) must not inherit a partial range a
  // cull queued and the renderer has not yet consumed.
  function uploadWhole(attribute) {
    attribute.clearUpdateRanges();
    attribute.needsUpdate = true;
  }
  function cullBodies(seconds) {
    for (const tier of tiers) {
      let count = 0, firstChanged = -1;
      for (let i = 0; i < tier.bodyIds.length && tier.starts[i] <= seconds; i++) {
        const src = tier.bodyIds[i];
        // New tissue cannot contribute before its global arrival gate.
        // Spores retain their independent, full-trajectory bounds.
        if (plan[src*2] >= 0 && gate.value <= .001) continue;
        worldBody.copy(bodyBounds[src]).applyMatrix4(group.matrixWorld);
        if (!viewFrustum.intersectsSphere(worldBody)) continue;
        if (tier.activeIds[count] !== src) {
          tier.activeIds[count] = src;
          writeBody(tier, src, count);
          if (firstChanged < 0) firstChanged = count;
        }
        count++;
      }
      if (firstChanged >= 0) {
        // Upload only the slots from the first change on (a body entering
        // the frame shifts the compacted tail; the head is unchanged).
        for (const attribute of [tier.arrivals, tier.poses, tier.tones]) {
          attribute.addUpdateRange(firstChanged * attribute.itemSize, (count - firstChanged) * attribute.itemSize);
          attribute.needsUpdate = true;
        }
      }
      if (tier.drawn !== count) {
        tier.drawn = count;
        for (const geometry of tier.layers) geometry.instanceCount = count;
      }
    }
  }

  // Ground strands and complete spore trajectories have their own bounds:
  // a cap outside the frame can still send a visible runner or airborne spore
  // into it. Keep source attributes immutable; the draw index is written ONCE
  // per prepared flight, batches in arrival order (2026-11 — the stutter
  // toward the top: re-compacting it whenever the in-view set changed
  // re-uploaded the whole ground index mid-flight). A frame draws the one
  // contiguous run of that order that spans its arrived, in-view batches.
  function indexedBatches(geometry, batches) {
    const count = geometry.attributes.position.count;
    const index = new THREE.BufferAttribute(Uint32Array.from({ length: count }, (_, i) => i), 1);
    geometry.setIndex(index);
    return { geometry, batches, index, order: Int32Array.from(batches, (_, i) => i),
      ends: new Uint32Array(batches.length), arrived: 0 };
  }
  /** The batch order for one flight, from its prepared starts. */
  function orderBatches(state, starts, intoIndex) {
    const order = Int32Array.from(state.batches, (_, i) => i).sort((a, b) => starts[a] - starts[b]);
    const ends = new Uint32Array(order.length);
    let o = 0;
    for (let k = 0; k < order.length; k++) {
      const batch = state.batches[order[k]];
      for (let j = 0; j < batch.count; j++) intoIndex[o++] = batch.first + j;
      ends[k] = o;
    }
    return { order, ends };
  }
  function cullBatches(state, seconds, enabled) {
    // arrivals only ever advance through the flight; a Return replays it
    let arrived = state.arrived;
    while (arrived > 0 && seconds <= state.batches[state.order[arrived - 1]].start) arrived--;
    while (arrived < state.order.length && seconds > state.batches[state.order[arrived]].start) arrived++;
    state.arrived = arrived;
    let first = -1, last = -1;
    if (enabled) for (let k = 0; k < arrived; k++) {
      worldBody.copy(state.batches[state.order[k]].bounds).applyMatrix4(group.matrixWorld);
      if (!viewFrustum.intersectsSphere(worldBody)) continue;
      if (first < 0) first = k;
      last = k;
    }
    const start = first > 0 ? state.ends[first - 1] : 0;
    const count = first < 0 ? 0 : state.ends[last] - start;
    state.geometry.setDrawRange(start, count);
    state.object.visible = count > 0;
  }

  /* THE GROUND MAT GROWS BY PATCH, AND LIGHTS AS IT GROWS (2026-10-04 —
     Hannah: "when the ground network appears, it should just light up
     temporarily"; "more like a general feeling of different ground networks
     happening from orbit"). It used to join every body to its two nearest
     predecessors at 2.5% light — one even lattice nobody could see. Now
     each patch is its own web (every body joins its nearest elder in the
     patch), each patch's first body sends a runner to the nearest earlier
     node (another patch, a loner, the epilogue's seats or the hero), and
     some patches send a second. Every strand is drawn FROM the end that
     arrived first TO the one that arrives later: its tip travels across the
     ground, hot, and leaves a glow that settles to the mat's resting light
     — so a new body is reached by a running light that then dims. */
  const points = [], colors = [], owners = [], paths = [];
  const bodyIndex = new Map(bodies.map((body,i) => [body,i]));
  const nodes = [{ x: 0, z: 0 }, ...seats, ...bodies.filter(b => b.tier === undefined).toSorted((a,b) => Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))];
  const firstNew = seats.length + 1;
  const seenPatch = new Set();
  function strand(a, b, strands, bendScale) {
    const length = Math.hypot(b.x-a.x, b.z-a.z);
    // a strand meanders in proportion to the ground it crosses
    const bendK = Math.max(0.12, length / 6) * 0.55 * bendScale;
    for (let k = 0; k < strands; k++) {
      const phase = random() * Math.PI * 2, bend = (0.35 + random() * 0.7) * bendK;
      let previous = null, previousT = 0;
      for (let j = 0; j <= 20; j++) {
        const t = j / 20, wave = Math.sin(t*Math.PI) * Math.sin(t*7+phase) * bend;
        const x = a.x + (b.x-a.x)*t + wave, z = a.z+(b.z-a.z)*t + wave*0.7;
        const p = [x, groundY(x,z)+0.035, z];
        if (previous) {
          points.push(...previous,...p); colors.push(0.32,0.22,0.10,0.32,0.22,0.10);
          const ia = bodyIndex.get(a) ?? -1, ib = bodyIndex.get(b) ?? -1;
          owners.push(ia,ib,ia,ib);
          paths.push(previousT, length, t, length);
        }
        previous = p; previousT = t;
      }
    }
  }
  for (let i = firstNew; i < nodes.length; i++) {
    const b = nodes[i];
    let near = null, dNear = Infinity, n0 = null, n1 = null, d0 = Infinity, d1 = Infinity;
    for (let j = 0; j < i; j++) {
      const q = nodes[j], d = Math.hypot(q.x-b.x,q.z-b.z);
      if (d <= 0.1) continue;
      if (b.patch >= 0 && q.patch === b.patch && d < dNear) { near = q; dNear = d; }
      if (d < d0) { n1 = n0; d1 = d0; n0 = q; d0 = d; }
      else if (d < d1) { n1 = q; d1 = d; }
    }
    if (near) strand(near, b, 2, 0.6);
    if (!near || !seenPatch.has(b.patch)) {
      // the patch's (or loner's) runner back into the wider mat
      // (only to ground it could plausibly have grown across: a runner
      // longer than that read from orbit as a straight wire over the dark)
      if (n0 && d0 < 18) strand(n0, b, 3, 1);
      if (n1 && d1 < 14 && b.patch >= 0 && random() < 0.45) strand(n1, b, 2, 1);
    }
    if (b.patch >= 0) seenPatch.add(b.patch);
  }
  const ground = new THREE.BufferGeometry();
  ground.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  ground.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const links = new THREE.BufferAttribute(new Float32Array(owners.length * 2), 4);
  ground.setAttribute('aColonyLink', links);
  ground.setAttribute('aColonyOwners', new THREE.Float32BufferAttribute(owners.flatMap(i => i < 0 ? [0, 0] : [bodies[i].x, bodies[i].z]), 4));
  ground.setAttribute('aColonyPath', new THREE.Float32BufferAttribute(paths, 2));
  const groundBatches = [];
  const batchBox = new THREE.Box3(), batchPoint = new THREE.Vector3();
  for (let first = 0; first < points.length / 3; first += 40) {
    batchBox.makeEmpty();
    for (let k = first; k < first + 40; k++) {
      batchBox.expandByPoint(batchPoint.fromArray(points, k * 3));
    }
    const bounds = batchBox.getBoundingSphere(new THREE.Sphere());
    bounds.radius += .5;
    groundBatches.push({ first, count: 40, bounds, start: 0 });
  }
  const groundDraw = indexedBatches(ground, groundBatches);
  const groundMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  groundMat.onBeforeCompile = shader => {
    shader.uniforms.uColonySeconds = clock;
    shader.uniforms.uColonyRetiring = retiring;
    shader.uniforms.uColonyRetirementStart = retirementStart;
    shader.uniforms.uColonyGate = gate;
    shader.vertexShader = `${COLONY_RETIREMENT_GLSL}
 attribute vec4 aColonyOwners; uniform float uColonyGate; attribute vec4 aColonyLink; attribute vec2 aColonyPath; uniform float uColonySeconds; varying float vColonyLink;
      float linkStart(vec2 window) { return window.x < 0. ? -1e3 : window.x; }
` + shader.vertexShader
      .replace('void main() {', `void main() {
        float sa = linkStart(aColonyLink.xy), sb = linkStart(aColonyLink.zw);
        // distance along the strand from the end that was there first
        float along = sb >= sa ? aColonyPath.x : 1. - aColonyPath.x;
        float travel = 0.9 + aColonyPath.y * 0.07;
        // the tip sets out a little before the later body, and reaches it
        // as that body rises
        float passed = uColonySeconds - (max(sa, sb) - 0.5 * travel) - along * travel;
        float grown = smoothstep(0., 0.2, passed);
        float flash = passed > 0. ? exp(-passed / 1.3) : 0.;
        vColonyLink = grown * (1. + 4. * flash) * min(colonyPresence(uColonyGate, aColonyOwners.xy), colonyPresence(uColonyGate, aColonyOwners.zw));`);
    shader.fragmentShader = 'varying float vColonyLink;\n' + shader.fragmentShader
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.rgb *= vColonyLink;');
  };
  groundMat.customProgramCacheKey = () => 'manifesto-links-v2';
  groundDraw.object = new THREE.LineSegments(ground, groundMat);
  group.add(groundDraw.object);

  /* THE PATCHES THAT ARE SHEDDING (2026-10-04 — Hannah: "some of the random
     ones should be giving off spores as well... the spores flying through
     the sky being a part of it"; then "is that realistic now? In terms of
     how they actually spread?"). Shed the way a gilled mushroom sheds:
       - most spores DROP from under the cap at their terminal speed (a
         straight, steady fall), carried a little downwind as they go, and
         SETTLE — the faint glowing print round the foot of a shedding body;
       - a minority are caught in the cap's own small updraft, lift a
         little, and are taken by the wind across the colony, slowly rising.
     Neighbours shed together (a patch is wet or dry as one). Every spore
     belongs to its body: gated on that body's arrival window and on the
     colony's gate, it can neither precede its mushroom nor outlive it.
     Sprites keep one pixel band at any depth, so no plume is thicker for
     being nearer the camera. */
  const SPORE_FALL = 40, SPORE_LOFT = 14;
  const shedders = [];
  bodies.forEach((b, i) => { if (b.emits) shedders.push(i); });
  const sporeCount = shedders.length * (SPORE_FALL + SPORE_LOFT);
  const sporePos = new Float32Array(sporeCount * 3), sporeData = new Float32Array(sporeCount * 4);
  const sporeBody = new Float32Array(sporeCount * 2);
  const sporeOwner = new Int32Array(sporeCount);
  const sporeGate = new THREE.BufferAttribute(new Float32Array(sporeCount * 2), 2);
  let si = 0;
  for (const i of shedders) {
    const b = bodies[i];
    for (let k = 0; k < SPORE_FALL + SPORE_LOFT; k++, si++) {
      // the body's foot; the shader finds the gills from its scale
      sporePos[si*3] = b.x; sporePos[si*3+1] = b.gy; sporePos[si*3+2] = b.z;
      const loft = k >= SPORE_FALL;
      sporeData[si*4] = random() * 1000;                                   // seed
      sporeData[si*4+1] = loft ? 70 + random() * 50 : 22 + random() * 14; // period
      sporeData[si*4+2] = random();                                        // phase
      sporeData[si*4+3] = loft ? 1 : 0;                                    // cohort
      sporeBody[si*2] = b.s; sporeBody[si*2+1] = b.yaw;
      sporeOwner[si] = i;
    }
  }
  const sporeGeo = new THREE.BufferGeometry();
  sporeGeo.setAttribute('position', new THREE.BufferAttribute(sporePos, 3));
  sporeGeo.setAttribute('aSpore', new THREE.BufferAttribute(sporeData, 4));
  sporeGeo.setAttribute('aSporeBody', new THREE.BufferAttribute(sporeBody, 2));
  sporeGeo.setAttribute('aSporeGate', sporeGate);
  const sporeBatches = shedders.map((owner, i) => {
    const b = bodies[owner], radius = 2.35 * b.s;
    // Full shader envelope, including updraft, 26-unit wind carry, lateral
    // oscillation and settled spores. Never use the owner's cap bound here.
    batchBox.min.set(b.x-radius-1.5, b.gy-.1, b.z-radius-1.5);
    batchBox.max.set(b.x+26+radius+1.5, b.gy+6.12*b.s+3.8, b.z+4.5+radius+1.5);
    return { first: i*(SPORE_FALL+SPORE_LOFT), count: SPORE_FALL+SPORE_LOFT,
      bounds: batchBox.getBoundingSphere(new THREE.Sphere()), owner, start: 0 };
  });
  const sporeDraw = indexedBatches(sporeGeo, sporeBatches);
  const sporeMat = new THREE.ShaderMaterial({
    uniforms: { uTime: time, uColonySeconds: clock, uColonyGate: gate, uColonyRetiring: retiring, uColonyRetirementStart: retirementStart, fogNear, fogFar },
    vertexShader: /* glsl */ `${COLONY_RETIREMENT_GLSL}
      attribute vec4 aSpore;       // seed, period, phase, cohort (0 drop, 1 lofted)
      attribute vec2 aSporeBody;   // the owner's scale, yaw
      attribute vec2 aSporeGate;   // the owner's arrival window
      uniform float uTime, uColonySeconds, uColonyGate, fogNear, fogFar;
      varying float vAlpha;
      varying vec3 vColor;
      float hash(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        // in once the body is up; gone before it goes
        float owner = smoothstep(aSporeGate.x + 0.6 * aSporeGate.y, aSporeGate.x + aSporeGate.y + 1.2, uColonySeconds);
        float t = fract(uTime / aSpore.y + aSpore.z);
        float h1 = hash(aSpore.x * 12.9898), h2 = hash(aSpore.x * 78.233 + 1.), h3 = hash(aSpore.x * 45.164 + 2.);
        float s = aSporeBody.x;
        vec3 wind = normalize(vec3(1.0, 0.0, 0.17));   // the field's one breeze, level
        vec3 side = vec3(-wind.z, 0., wind.x);
        // released from the gills: under the cap, anywhere between stem and margin
        float ang = h2 * 6.2832, rr = 2.35 * s * (0.18 + 0.72 * sqrt(h1));
        vec3 p = position + vec3(cos(ang) * rr, 3.15 * s * 0.80, sin(ang) * rr);
        float fall = p.y - position.y;
        float life;
        float glow = 1.0;
        if (aSpore.w < 0.5) {
          // terminal fall (linear: a spore is at terminal speed within a
          // millimetre), drifting downwind as it drops, then lying in the print
          float tf = 0.30;
          float k = clamp(t / tf, 0., 1.);
          p.y -= fall * k;
          p += wind * (0.25 + 1.6 * h3) * s * 3.0 * k + side * (h1 - 0.5) * 1.2 * s * k;
          p.y = max(p.y, position.y + 0.03);
          float settled = step(tf, t);
          glow = mix(1.0, 0.45, settled);
          life = smoothstep(0., 0.04, t) * (1. - smoothstep(0.55, 1., t));
        } else {
          // the cap's own small updraft, then the wind's
          float lift = smoothstep(0., 0.12, t);
          p.y += (0.4 + 0.8 * h1) * s * 3.0 * lift;
          float carry = smoothstep(0.06, 1., t);
          p += wind * (12. + 14. * h3) * carry + vec3(0., (1.2 + 2.0 * h2) * carry, 0.);
          p += (side * sin(uTime * 0.07 + aSpore.x) + vec3(0., 0.4 * cos(uTime * 0.05 + aSpore.x * 1.7), 0.)) * 1.4 * carry;
          life = smoothstep(0., 0.06, t) * (1. - smoothstep(0.65, 1., t));
          glow = 0.7;
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        float depth = -mv.z;
        float fogF = clamp((fogFar - depth) / max(1., fogFar - fogNear), 0., 1.);
        float tw = 0.8 + 0.2 * sin(uTime * 1.4 + aSpore.x * 7.);
        vAlpha = life * glow * owner * colonyPresence(uColonyGate, position.xz) * fogF * tw * 0.9;
        vColor = mix(vec3(1.0, 0.70, 0.36), vec3(1.0, 0.86, 0.60), h2);
        // one apparent size at any depth: a fixed pixel band
        gl_PointSize = clamp(0.22 * 300. / max(depth, 1.), 1.6, 2.6) * mix(1., 0.8, 1. - glow);
        gl_Position = projectionMatrix * mv;
        if (vAlpha < 0.002) gl_Position = vec4(2., 2., 2., 1.);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.;
        float a = pow(max(0., 1. - d * d), 1.5);
        gl_FragColor = vec4(vColor * a * vAlpha, 1.);
      }
    `,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const sporePts = new THREE.Points(sporeGeo, sporeMat);
  sporePts.frustumCulled = false;
  sporeDraw.object = sporePts;
  group.add(sporePts);
  // Its programs are warmed with the rest of Final's hidden subtree (this
  // group lives inside Final's) — see warmHiddenChapters in journey.js.

  /** Which bodies ever stand NEAR_PX tall on screen, over the whole flight
   *  (the descent replays the same poses, so the climb covers both ways).
   *  The camera path is sampled every quarter second; a body counts only
   *  from its arrival (the ring's own seats from the start) and only while
   *  it is inside the frame. Body-by-body, so the job below can slice it. */
  function nearFrames(from, aspect) {
    const frames = [];
    for (let t = 0; t <= CAMERA_SECONDS; t += 0.25) {
      const pose = manifestoPose(from, t, aspect);
      const { position: p, target: q } = pose;
      const n = Math.hypot(q.x-p.x, q.y-p.y, q.z-p.z);
      const fx = (q.x-p.x)/n, fy = (q.y-p.y)/n, fz = (q.z-p.z)/n;
      const h = Math.hypot(fx, fz), rx = -fz/h, rz = fx/h;
      frames.push({ t, p, fx, fy, fz, rx, rz, ux: -fy*rz, uy: fx*rz-fz*rx, uz: fy*rx,
        tangent: Math.tan(pose.fov * Math.PI / 360) });
    }
    return frames;
  }
  function isNearBody(b, arrival, frames, aspect, halfH) {
    const height = b.s * BODY_HEIGHT;
    const arrives = arrival < 0 ? 0 : arrival;
    for (const f of frames) {
      if (f.t + 0.25 < arrives) continue;
      const x = b.x-f.p.x, y = b.gy+height/2-f.p.y, z = b.z-f.p.z;
      const depth = x*f.fx + y*f.fy + z*f.fz;
      // a body the camera is inside or right beside is as near as it gets
      if (depth <= height) return true;
      const nx = (x*f.rx + z*f.rz) / (depth*f.tangent*aspect);
      const ny = (x*f.ux + y*f.uy + z*f.uz) / (depth*f.tangent);
      if (Math.abs(nx) > 1.1 || Math.abs(ny) > 1.1) continue;
      if (height / (depth*f.tangent) * halfH >= NEAR_PX) return true;
    }
    return false;
  }

  /* THE FLIGHT IS PREPARED AHEAD, AND ONCE (2026-11 — the hitch as the
     Manifesto camera takes off). Everything prepare() derives is a pure
     function of the opening pose, the aspect and the window height, and it
     used to run in full on the press itself (26-49 ms on a server CPU, a
     multiple of that on a phone), then re-upload ~0.85 MB of unchanged
     links and gates on every open. It is now a resumable job, keyed by
     those inputs: prewarm() advances it in budgeted slices while Purpose is
     at rest; prepare() finishes whatever is left (all of it, if nothing
     was warmed — exactly the old cost) and, when the key is unchanged,
     reinstates the stored result without touching the shared buffers.
     The job works in scratch arrays and commits them in one step, because
     a phone's Purpose draws through the same plan and tiers meanwhile. */
  const keyOf = (from, aspect) => [from.position.x, from.position.y, from.position.z,
    from.target.x, from.target.y, from.target.z, from.fov, from.roll || 0,
    from.fieldCenter?.x ?? 0, from.fieldCenter?.z ?? 0, aspect]
    .map(v => (+v).toFixed(4)).join(',') + `|${typeof window !== 'undefined' ? window.innerHeight : 900}`;
  let job = null, prepared = null;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  function newJob(from, aspect, key) {
    return { key, from, aspect, stage: 0, i: 0, warmups: 0, plan: new Float32Array(bodies.length * 2),
      near: null, frames: null, halfH: (typeof window !== 'undefined' ? window.innerHeight : 900) / 2,
      links: null, gates: null, groundIndex: null, sporeIndex: null, result: null };
  }
  // Each stage does a bounded unit and returns true when it is complete.
  const STAGES = [
    // planAerialReveals is one indivisible call (pose.js) and, cold, the
    // largest unit. Ahead of the press it is first run over a few bodies at
    // a time, one call a slice, until the engine has compiled it: the full
    // call then costs what a warm one does (measured ~15 ms cold -> ~2 ms).
    (j, until) => {
      if (until === Infinity || j.warmups >= 6) return true;
      planAerialReveals(bodies.slice(0, 40), j.from, j.aspect, new Float32Array(80));
      j.warmups++;
      return false;
    },
    (j) => { planAerialReveals(bodies, j.from, j.aspect, j.plan); return true; },
    (j, until) => {
      j.links ||= new Float32Array(links.array.length);
      for (; j.i < owners.length; j.i++) {
        const owner = owners[j.i];
        j.links[j.i*2] = owner < 0 ? -1 : j.plan[owner*2];
        j.links[j.i*2+1] = owner < 0 ? 1 : j.plan[owner*2+1];
        if ((j.i & 4095) === 4095 && now() > until) { j.i++; return false; }
      }
      j.i = 0;
      return true;
    },
    (j) => {
      j.gates = new Float32Array(sporeGate.array.length);
      for (let k = 0; k < sporeCount; k++) {
        const owner = sporeOwner[k];
        j.gates[k*2] = j.plan[owner*2]; j.gates[k*2+1] = j.plan[owner*2+1];
      }
      j.groundStarts = groundBatches.map(batch => {
        const first = batch.first, ia = owners[first*2], ib = owners[first*2+1];
        const sa = ia < 0 || j.plan[ia*2] < 0 ? -1e3 : j.plan[ia*2];
        const sb = ib < 0 || j.plan[ib*2] < 0 ? -1e3 : j.plan[ib*2];
        return Math.max(sa, sb) - .5 * (.9 + paths[first*2+1] * .07);
      });
      j.sporeStarts = sporeBatches.map(batch => j.plan[batch.owner*2] + .6*j.plan[batch.owner*2+1]);
      j.groundIndex = new Uint32Array(groundDraw.index.array.length);
      j.sporeIndex = new Uint32Array(sporeDraw.index.array.length);
      j.groundOrder = orderBatches(groundDraw, j.groundStarts, j.groundIndex);
      j.sporeOrder = orderBatches(sporeDraw, j.sporeStarts, j.sporeIndex);
      return true;
    },
    (j, until) => {
      j.frames ||= nearFrames(j.from, j.aspect);
      j.near ||= new Uint8Array(bodies.length);
      for (; j.i < bodies.length; j.i++) {
        j.near[j.i] = isNearBody(bodies[j.i], j.plan[j.i*2], j.frames, j.aspect, j.halfH) ? 1 : 0;
        if ((j.i & 15) === 15 && now() > until) { j.i++; return false; }
      }
      j.i = 0;
      return true;
    },
    (j) => {
      const order = bodies.map((_, i) => i).filter(i => j.plan[i*2] <= CAMERA_SECONDS)
        .sort((a, b) => j.plan[a*2] - j.plan[b*2]);
      // each body's tier, from the tallest it gets on screen on this flight
      j.tiers = tiers.map(tier => Int32Array.from(order.filter(i => !!j.near[i] === (tier.name === 'near'))));
      return true;
    },
    // commit: the shared draw data, in one step
    (j) => {
      links.array.set(j.links); uploadWhole(links);
      sporeGate.array.set(j.gates); uploadWhole(sporeGate);
      groundDraw.index.array.set(j.groundIndex); uploadWhole(groundDraw.index);
      sporeDraw.index.array.set(j.sporeIndex); uploadWhole(sporeDraw.index);
      prepared = { key: j.key, plan: j.plan, tiers: j.tiers,
        ground: { starts: j.groundStarts, ...j.groundOrder }, spores: { starts: j.sporeStarts, ...j.sporeOrder } };
      return true;
    },
  ];
  function runJob(j, until) {
    while (j.stage < STAGES.length) {
      if (!STAGES[j.stage](j, until)) return false;
      j.stage++;
      if (now() > until) return j.stage >= STAGES.length;
    }
    return true;
  }
  function applyBatches(state, stored) {
    stored.starts.forEach((start, i) => { state.batches[i].start = start; });
    state.order = stored.order; state.ends = stored.ends; state.arrived = 0;
  }
  /** The colony's buffers, first-sight uploads included, sent to the GPU
   *  ahead of the flight: one draw of the real scene (so every program
   *  variant matches the frame's) through a camera that sees only the
   *  colony's layer, into the composer's own buffer (overwritten by the
   *  next frame), scissored to one pixel, with every instance count and
   *  draw range at zero — the bindings upload, nothing is drawn. */
  const WARM_LAYER = 31;
  let warmCamera = null, warmed = false, warmReport = null;
  group.traverse(o => { if (o !== group) o.layers.enable(WARM_LAYER); });
  function warmDraw() {
    const r = sceneApi.renderer, scene = sceneApi.scene, camera = sceneApi.camera;
    if (!r || typeof r.render !== 'function' || !scene || !camera) return false;
    warmCamera ||= camera.clone();
    warmCamera.copy(camera);
    warmCamera.layers.set(WARM_LAYER);
    const objects = group.children;
    const saved = objects.map(o => [o.visible, o.geometry.instanceCount, o.geometry.drawRange.start, o.geometry.drawRange.count, o.frustumCulled]);
    const groupVisible = group.visible;
    const previous = r.getRenderTarget(), scissorTest = r.getScissorTest(), autoClear = r.autoClear;
    const scissor = r.getScissor(new THREE.Vector4());
    try {
      group.visible = true;
      for (const o of objects) {
        // every buffer, whether or not this view frames it
        o.visible = true; o.frustumCulled = false;
        if (o.geometry.isInstancedBufferGeometry) o.geometry.instanceCount = 0;
        else o.geometry.setDrawRange(0, 0);
      }
      r.setRenderTarget(sceneApi.composer?.readBuffer || null);
      r.autoClear = false;
      r.setScissorTest(true);
      r.setScissor(0, 0, 1, 1);
      const before = r.info?.memory?.geometries;
      r.render(scene, warmCamera);
      warmReport = { geometries: before === undefined ? null : r.info.memory.geometries - before, at: now() };
      return true;
    } finally {
      r.setScissor(scissor); r.setScissorTest(scissorTest); r.autoClear = autoClear;
      r.setRenderTarget(previous);
      group.visible = groupVisible;
      objects.forEach((o, i) => {
        const [visible, instances, start, count, culled] = saved[i];
        o.visible = visible; o.frustumCulled = culled;
        if (o.geometry.isInstancedBufferGeometry) o.geometry.instanceCount = instances;
        else o.geometry.setDrawRange(start, count);
      });
    }
  }

  const api = {
    group,
    // the placements, for layers that dress the same field (sky.js plumes)
    bodies,
    /** Advance the flight's preparation for this opening pose by about
     *  `budgetMs`, then (in a later call) upload its buffers. Idempotent and
     *  abandonable: a different pose restarts it, and prepare() completes
     *  whatever is left. Returns true once nothing is left to do. */
    prewarm(from, aspect, budgetMs = 8) {
      const key = keyOf(from, aspect);
      if (prepared?.key === key) {
        if (!warmed) warmed = warmDraw();
        return true;
      }
      if (!job || job.key !== key) job = newJob(from, aspect, key);
      if (runJob(job, now() + budgetMs)) { job = null; warmed = false; }
      return false;
    },
    prepare(from, aspect) {
      purposeMode = false;
      cullView = !!sceneApi.camera;
      const key = keyOf(from, aspect);
      if (prepared?.key !== key) {
        if (!job || job.key !== key) job = newJob(from, aspect, key);
        runJob(job, Infinity);
        job = null;
      }
      // the flight's own frames upload whatever changed from here on
      warmed = true;
      plan.set(prepared.plan);
      applyBatches(groundDraw, prepared.ground);
      applyBatches(sporeDraw, prepared.spores);
      tiers.forEach((tier, t) => {
        const mine = prepared.tiers[t];
        tier.starts = Float32Array.from(mine, src => plan[src*2]);
        tier.bodyIds = mine;
        tier.activeIds.fill(-1);
        mine.forEach((src, dst) => writeBody(tier, src, dst));
        uploadWhole(tier.arrivals); uploadWhole(tier.poses); uploadWhole(tier.tones);
        tier.drawn = -1;
      });
      portrait.value = aspect < 0.9 ? 1 : 0;
    },
    /** Purpose reuses only its existing background seats, never the extra
     * Manifesto field. Same hero buffers, same materials, visible instances
     * only. prepare() restores the full branch schedule on Manifesto entry. */
    setPurpose(amount, pull, near, far) {
      retiring.value = 0; seatRetiring.value = 0;
      if (amount <= .001 && !purposeMode) return;
      if (!purposeMode) {
        purposeMode = true;
        const ids = [];
        bodies.forEach((b, i) => {
          if (!(b.tier >= 4)) return;
          plan[i*2] = b.reveal; plan[i*2+1] = .14;
          ids.push(i);
        });
        ids.sort((a, b) => plan[a*2] - plan[b*2]);
        for (const tier of tiers) {
          // Background caps are small; use the same detailed line/point
          // geometry with subpixel shell welding, not sparse rim proxies.
          const mine = tier.name === 'far' ? ids : [];
          tier.bodyIds = Int32Array.from(mine);
          tier.starts = Float32Array.from(mine.map(i => plan[i*2]));
          tier.activeIds.fill(-1); tier.drawn = -1;
        }
      }
      group.visible = amount > .001;
      gate.value = amount; seatLight.value = 0;
      clock.value = pull; portrait.value = 1;
      fogNear.value = near; fogFar.value = far;
      updateViewFrustum(); cullBodies(pull);
      groundDraw.object.visible = false; sporeDraw.object.visible = false;
    },
    /** QA: how many bodies each tier holds on the prepared flight. */
    get lod() { return { near: tiers[0].starts.length, far: tiers[1].starts.length }; },
    get drawn() { return { near: tiers[0].drawn, far: tiers[1].drawn }; },
    /** QA: the last warm draw (geometries newly seen by the renderer). */
    get warm() { return { prepared: prepared?.key || null, warmed, report: warmReport }; },
    setSeatLight(v, retreat = false) {
      const next = Math.max(0, Math.min(1, v));
      if (retreat && !seatRetiring.value) seatRetirementStart.value = Math.max(next, seatLight.value);
      seatRetiring.value = Math.max(0, Math.min(1, Number(retreat)));
      seatLight.value = next;
    },
    set(progress, near, far, seconds, retreat = false) {
      if (retreat && !retiring.value) retirementStart.value = Math.max(progress, gate.value);
      retiring.value = retreat ? 1 : 0;
      /* The ring's own seats stand in for Final's ring from the branch's
         first frame (Final hides its ring lines the moment it opens), so
         the colony is drawn whenever they are lit — not only once the
         arrivals' gate opens a second later. Waiting for the gate left the
         ring dimmed for that second and then switched the copies on at full
         light: the jolt on pressing Manifesto (2026-10-04). Unarrived
         bodies cost nothing here — they are past the drawn prefix. */
      group.visible = progress > 0 || seatLight.value > 0.001;
      gate.value = progress;
      clock.value = seconds;
      if (cullView) {
        updateViewFrustum();
        cullBodies(seconds);
        cullBatches(groundDraw, seconds, progress > 0);
        cullBatches(sporeDraw, seconds, progress > 0);
      }
      else for (const tier of tiers) {
        let count = 0;
        while (count < tier.starts.length && tier.starts[count] <= seconds) count++;
        if (count !== tier.drawn) {
          tier.drawn = count;
          for (const geometry of tier.layers) geometry.instanceCount = count;
        }
      }
      groundMat.opacity = 0.07;
      fogNear.value = near; fogFar.value = far;
    },
  };
  // The live colony, for the Manifesto branch's ahead-of-press warm-up: the
  // branch reaches Final only through its setManifesto field contract, and
  // importing this module would pull three into the branch's own graph.
  globalThis[AERIAL_COLONY] = api;
  return api;
}
