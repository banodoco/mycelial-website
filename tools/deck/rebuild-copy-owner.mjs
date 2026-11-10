import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const base = 'a8747a10eb41a41255b8d69376f1499aa95fc1b0';
const path='mycelial/dot-transitions.js', htmlPath='mycelial/index.html';
let source=readFileSync(path,'utf8'), html=readFileSync(htmlPath,'utf8');
const blob=s=>createHash('sha1').update(`blob ${Buffer.byteLength(s)}\0`).update(s).digest('hex');
if(blob(source)!=='bd3d09afa93b4b5b871daf61746b49ced97e00db' || blob(html)!=='bceeac7a321ed58645c7908e0493458b9f5ed483') throw Error('Source moved from reviewed baseline');
function replace(before,after){if(source.split(before).length!==2)throw Error('Expected one match: '+before.slice(0,110));source=source.replace(before,after);}
function section(s,start,end){const a=s.indexOf(start),b=s.indexOf(end,a+start.length);if(a<0||b<=a)throw Error('Missing section '+start);return s.slice(a,b);}
const unchanged = ['  const paintCopy =','  const textOf =','  const copyExtra =','  const gentleTiming ='].map((start,i)=>[start,['  const copyStates =','  const place = (p)','  const textTweens =','  const reveal ='][i],section(source,start,['  const copyStates =','  const place = (p)','  const textTweens =','  const reveal ='][i])]);
replace(section(source,'  const cancelOverlay =','  // Keep the real copy'),`  const cancelOverlay = (slide, state) => {
    if (copyStates.get(slide) !== state || !['hidden', 'revealing', 'gathering'].includes(state.phase)) return;
    if (state.timer) window.deckCancelLater(state.timer);
    state.timer = null;
    state.phase = 'interrupted';
    state.resolve?.('cancelled');
    // Revoke the writer without inventing a visible endpoint. The next owner
    // gathers from this exact mask (including radius zero). Terminal recovery
    // explicitly reconciles all slides, rather than using cancellation to show.
    traceCopy('interrupt', slide, state.context);
  };
`);
replace(section(source,'  const copyStates =','  const reach ='),`  const copyStates = new WeakMap();
  const ownsCopy = (slide, state, transient = false) => !!state &&
    copyStates.get(slide) === state && state.context?.isCurrent() &&
    (!transient || (state.context.isTransitionCurrent() &&
      ['hidden', 'revealing', 'gathering'].includes(state.phase)));
  const claimCopy = (slide, context, phase) => {
    if (!context?.isTransitionCurrent() ||
        (slide !== slides[context.from] && slide !== slides[context.to])) return null;
    const old = copyStates.get(slide);
    if (old?.timer) window.deckCancelLater(old.timer);
    old?.resolve?.('cancelled');
    let resolve;
    const state = { slide, context, phase, timer: null,
      done: new Promise(r => { resolve = r; }), resolve: null };
    state.resolve = resolve;
    copyStates.set(slide, state);
    context.transitionDefer(() => cancelOverlay(slide, state));
    return state;
  };
  // Only this endpoint operation may discard a reveal and publish shown/retired.
  // Transient callbacks must supply their state; terminal reconciliation supplies
  // the current navigation. A registry entry is never a visibility decision.
  const endCopy = (slide, hidden, context, expected = null) => {
    if (!slide || !context?.isCurrent() ||
        hidden === (slide === slides[context.to]) ||
        (expected && !ownsCopy(slide, expected))) return false;
    const old = copyStates.get(slide);
    if (old?.timer) window.deckCancelLater(old.timer);
    const state = { context, slide, phase: hidden ? 'retired' : 'shown' };
    copyStates.set(slide, state); // revoke all old writers before changing paint
    put.x = NaN;
    let complete = true;
    textOf(slide).forEach(el => {
      try {
        if (!stationaryCopy(el)) el.style.transform = '';
        paintCopy(el, null, 0, hidden);
      } catch (error) { complete = false; console.error('Deck copy restoration failed', error); }
    });
    if (!complete) state.phase = 'failed';
    old?.resolve?.(complete && !hidden ? 'completed' : 'cancelled');
    traceCopy(hidden ? 'retire' : 'show', slide, context);
    return complete;
  };
  const copy = {
    hide(slide, context, at = anchorOf(slide), deadline = 0) {
      if (slide !== slides[context?.to] || !context?.isTransitionCurrent()) return null;
      const old = copyStates.get(slide);
      const reuse = old?.context === context && ['hidden', 'revealing'].includes(old.phase);
      const state = reuse ? old : claimCopy(slide, context, 'hidden');
      if (!state) return null;
      if (state.timer) window.deckCancelLater(state.timer);
      state.timer = null;
      if (!reuse) clearOverlays(slide);
      if (deadline) state.timer = window.deckLater(() => {
        if (!ownsCopy(slide, state, true)) return;
        // Failure recovery belongs to the existing terminal transaction. It
        // stops writers, reconciles scenes and copy, then declares settlement.
        window.deckTransaction('recover', context);
      }, deadline, context);
      textOf(slide).forEach(el => paintCopy(el, at, 0, !at, context.geometry?.box(el)));
      traceCopy('hide', slide, context);
      return state;
    },
    gather(slide, context) { return claimCopy(slide, context, 'gathering'); },
    pending(slide, context) {
      const state = copyStates.get(slide);
      return state?.context === context && ['hidden', 'revealing'].includes(state.phase);
    },
    completion(slide) { return copyStates.get(slide)?.done || Promise.resolve('completed'); },
    show(slide, context = window.deckNav, expected = null) { return endCopy(slide, false, context, expected); },
    retire(slide, context = window.deckNav, expected = null) { return endCopy(slide, true, context, expected); },
    reconcile(context) {
      if (!context?.isCurrent()) return false;
      let complete = true;
      slides.forEach(slide => { if (!endCopy(slide, slide !== slides[context.to], context)) complete = false; });
      // Orphaned surfaces can be disposed, never promoted to selected copy.
      for (const el of [...overlays.keys()]) if (!el.closest('.slide')) removeOverlay(el);
      return complete;
    },
    paint(el, at, r, bounds, state) {
      const slide = el.closest('.slide');
      if (!ownsCopy(slide, state, true)) return false;
      paintCopy(el, at, r, false, bounds);
      return true;
    },
    get liveCloneCount() {
      let count = 0;
      for (const [el, surface] of overlays) if (surface !== el) count++;
      return count;
    },
  };
`);
replace(`    if (context.terminal) return [];
    // All slides now use the network-owned reveal/gather, including Astrid.`,`    if (!context.isTransitionCurrent()) return [];
    // All slides use the same owner and their existing rendering paths.`);
replace(`    if (state) state.phase = 'revealing';`,`    if (!state) return [];
    state.phase = 'revealing';`);
replace(`      copy.paint(el, origin, 0, bounds);`,`      copy.paint(el, origin, 0, bounds, state);`);
replace(`        copy.paint(el, origin, k * far, context.geometry?.box(el));`,`        copy.paint(el, origin, k * far, context.geometry?.box(el), state);`);
replace(`        copy.show(s);`,`        copy.show(s, context, state);`);
replace(`    const old = copyStates.get(s);
    if (old?.timer) window.deckCancelLater(old.timer);
    old?.resolve?.('cancelled');
    const state = { context, phase: 'gathering' };
    copyStates.set(s, state);
    context.transitionDefer(() => cancelOverlay(s, state));`,`    const state = copy.gather(s, context);
    if (!state) return tw;`);
replace(`      copy.paint(el, centre, far, bounds);`,`      copy.paint(el, centre, far, bounds, state);`);
replace(`copy.paint(el, centre, (1 - k) * far, context.geometry?.box(el));`,`copy.paint(el, centre, (1 - k) * far, context.geometry?.box(el), state);`);
replace(`!s.classList.contains('on')) copy.retire(s);`,`!s.classList.contains('on')) copy.retire(s, context, state);`);
replace(section(source,'  const finishNetwork =','  let anchor ='),`  const finishNetwork = (context) => {
    if (context.isCurrent()) {
      // Network completion reports its milestone only. The controller's terminal
      // transaction owns settlement; no resource collection can show/hide text.
      traceCopy('finish', slides[context.to], context);
      if (visit?.context === context) visit.resolve('completed');
    }
  };
`);
replace(`    slides.forEach((sl) => sl === targetSlide ? copy.show(sl) : copy.retire(sl));`,`    copy.reconcile(context);`);
replace(`        if (!prev.classList.contains('on')) copy.retire(prev);`,`        // Cancellation stops this turn; copy ownership transfers without repainting.`);
replace(`        copy.retire(prev);`,`        copy.retire(prev, context);`);
replace(`      }, 700));`,`      }, 700, context));`);
replace(`    const source = slides[context.from];
    if (source && source !== destination) attempt(() => copy.retire(source));
    let complete = false;
    attempt(() => { complete = copy.show(destination); });`,`    let complete = false;
    attempt(() => { complete = copy.reconcile(context); });`);
const legacy=`  /* Settled copy is always fully visible, even if a reveal was interrupted. */
  .slide.on[data-settled] > .split > :first-child,
  .slide.fw-raise.on[data-settled] > .split,
  .slide.on[data-settled] > .fw-stat { mask-image: none !important; -webkit-mask-image: none !important; visibility: visible !important; }
  .slide.on[data-settled]:not(.fw-raise) > .split > :first-child,
  .slide.fw-raise.on[data-settled]:not(:has(.fw-ask.is-open)) > .split > :first-child,
  .slide.fw-raise.on[data-settled] > .split,
  .slide.on[data-settled] > .fw-stat { opacity: 1 !important; }
`;
if(html.split(legacy).length!==2)throw Error('Legacy CSS differs');
html=html.replace(legacy,`  /* Text endpoints are owned by deckCopy, not inferred from data-settled.
     Keep the independent question-card emphasis rules below. */
`);
for(const [start,end,before] of unchanged)if(section(source,start,end)!==before)throw Error('Unexpected renderer/geometry/timing change '+start);
new Function(source);
writeFileSync(path,source);writeFileSync(htmlPath,html);
console.log(JSON.stringify({baseline:base,files:[path,htmlPath],rendererGeometryTimingPreserved:true}));
