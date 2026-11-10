// Exercises production copy functions, not a second implementation of them.
// Installed in the repository: node --test tests/deck-copy-surfaces.test.mjs
// Override DECK_NETWORK_SOURCE for a negative control against a prior revision.
// This is a DOM/state regression suite, not a physical-phone rendering claim.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const network = readFileSync(process.env.DECK_NETWORK_SOURCE || new URL('../mycelial/dot-transitions.js', import.meta.url), 'utf8');
function section(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Missing extraction boundary: ${start}`);
  return source.slice(a, b);
}
class Element {
  constructor(classes = '', parent = null, rect = { left: 24, top: 170, width: 342, height: 140 }) {
    this.classes = new Set(classes.split(/\s+/).filter(Boolean));
    this.parent = parent; this.children = []; this.rect = rect; this.listeners = new Map();
    this.props = {}; this.writes = [];
    const aliases = { 'mask-image': 'maskImage', '-webkit-mask-image': 'webkitMaskImage' };
    this.style = new Proxy({
      removeProperty: name => { const key = aliases[name] || name; const old = this.props[key] || ''; delete this.props[key]; this.writes.push([key, '']); return old; },
      setProperty: (name, value) => { this.props[name] = String(value); },
      getPropertyValue: name => this.props[aliases[name] || name] || '',
    }, {
      get: (methods, key) => key in methods ? methods[key] : this.props[key] || '',
      set: (_, key, value) => { this.props[key] = String(value); this.writes.push([key, value]); return true; },
    });
    this.classList = {
      contains: name => this.classes.has(name), add: name => this.classes.add(name), remove: name => this.classes.delete(name),
      toggle: (name, force) => { const on = force ?? !this.classes.has(name); on ? this.classes.add(name) : this.classes.delete(name); return on; },
    };
    if (parent) parent.children.push(this);
  }
  matches(selector) { return selector.split(',').some(s => s.trim().split('.').filter(Boolean).every(c => this.classes.has(c))); }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) || null; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const simple = selector.replace(':scope > ', '');
    return this.children.flatMap(child => [...(child.matches(simple) ? [child] : []), ...child.querySelectorAll(simple)]);
  }
  hasAttribute(name) { return name === 'data-settled' && !!this.settled; }
  remove() { this.removed = true; }
  getBoundingClientRect() {
    let x = this.rect.left, y = this.rect.top;
    for (let node = this; node; node = node.parent) {
      const m = /translate\(\s*([+-]?[\d.]+)px,\s*([+-]?[\d.]+)px\)/.exec(node.style.transform);
      if (m) { x += +m[1]; y += +m[2]; }
    }
    return { left: x, top: y, width: this.rect.width, height: this.rect.height, right: x + this.rect.width, bottom: y + this.rect.height };
  }
}
function fixture(source = network, debug = false) {
  const masks = new WeakMap(), overlays = new Map(), timers = new Map();
  let clones = 0, timerId = 0;
  const textOf = slide => slide.roots;
  const sandbox = {
    console, masks, overlays, slides: [], visit: null, current: null, anchor: null, turning: null, opening: null, hyphae: [], textTweens: new Set(), zones: [], SOFT: 150, put: { x: NaN, y: NaN }, trail: { x: 1.17, y: -.41 }, textOf,
    clamp: (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v)),
    anchorOf: slide => ({ x: slide.rect.left, y: slide.rect.top - 13 }), stopText() {},
    overlayFor(el) {
      if (!overlays.has(el)) { clones++; overlays.set(el, new Element('', null, el.rect)); }
      return overlays.get(el);
    },
    window: {
      __deckDebug: debug ? {} : undefined, deckArrived() {},
      deckCancelLater: id => timers.delete(id),
      deckLater: (fn, ms, ctx) => { const id = ++timerId; timers.set(id, { fn, ms, ctx }); return id; },
    },
  };
  const code = [
    section(source, '  const stableCopy =', '  const lines ='),
    source.includes('  const copyTrace =') ? section(source, '  const copyTrace =', '  const removeOverlay =') : 'const traceCopy = () => {}; const copyTrace = null;',
    section(source, '  const removeOverlay =', '  // Keep the real copy'),
    section(source, '  const paintCopy =', '  // These forward arrivals'),
    '',
  ];
  // The excerpts end just after this loop; the full source has the outer idle block.
  const idleStart = source.indexOf('      textOf(current).forEach((el) => {');
  const idleEnd = source.indexOf('      });', idleStart) + '      });'.length;
  code[4] = `const moveIdle = current => {${source.slice(idleStart, idleEnd)}};`;
  code.push(section(source, '  const finishNetwork =', '  let anchor ='));
  code.push(section(source, '  const resize = (context)', '  // First navigation starts'));
  Object.assign(sandbox, { endOpening() {}, keepGround() {}, anchorOf() {return {x: 20,y: 20}}, size() {return false}, active() {return false}, wake() {}, nameRest() {}, safeZone() {}, chromeEls() {}, chromeKey: {}, draw() {}, lastSlide() {}, crown() {} });
  let settlements = 0;
  sandbox.settle = (_, __, ctx) => { settlements++; sandbox.slides.forEach((slide, i) => i === ctx.to ? sandbox.api.copy.show(slide) : sandbox.api.copy.retire(slide)); };
  const context = vm.createContext(sandbox);
  vm.runInContext(code.join('\n') + '\nthis.api = {copy, cancelOverlay, moveIdle, masks, copyStates, finishNetwork, resize, copyTrace};', context);
  return { ...context.api, timers, overlays, sandbox, get settlements() { return settlements; }, get clones() { return clones; } };
}
function makeSlide(n = 9, width = 390, height = 844, ordinary = false) {
  const slide = new Element(`slide on ${ordinary ? '' : 'fw-host'} ${n === 11 ? 'fw-raise' : ''}`, null,
    { left: 0, top: 0, width, height });
  const split = new Element('split', slide, { left: 24, top: n === 10 ? 52 : 200, width: width - 48, height: 180 });
  const column = new Element('copy-column', split, { ...split.rect });
  const heading = new Element('heading', column, { ...split.rect });
  const label = new Element('num', column, { ...split.rect, height: 16 });
  const controls = new Element('fw-asks', split, { ...split.rect, top: split.rect.top + 190, height: 70 });
  slide.roots = [n === 11 ? split : column];
  const stat = n === 9 ? new Element('fw-stat', slide, { left: 0, top: 24, width, height: 28 }) : null;
  if (stat) slide.roots.push(stat);
  return { slide, split, column, heading, label, controls, stat, root: slide.roots[0] };
}
function visit() {
  const disposers = [];
  const ctx = { live: true, terminal: false, transitionDefer: fn => { disposers.push(fn); return fn; },
    isCurrent() { return this.live; }, isTransitionCurrent() { return this.live && !this.terminal; },
    close() { this.terminal = true; disposers.forEach(fn => fn()); },
  };
  return ctx;
}
const origin = { x: 24, y: 80 };
const clean = el => !el.classList.contains('dt-copy-hidden') && el.style.maskImage === '' && el.style.webkitMaskImage === '';

for (const number of [9, 10, 11]) {
  test(`slide ${number}: live masks participate in the existing cleanup registry`, () => {
    const f = fixture(), s = makeSlide(number), ctx = visit(); f.sandbox.slides.push(s.slide);
    f.copy.hide(s.slide, ctx, origin);
    for (const root of s.slide.roots) assert.equal(f.overlays.get(root), root);
    assert.equal(f.copy.liveCloneCount, 0); assert.equal(f.clones, 0);
    f.copy.show(s.slide);
    assert.equal(f.overlays.size, 0);
    s.slide.roots.forEach(root => { assert.ok(clean(root)); assert.equal(root.removed, undefined); });
  });
  test(`slide ${number}: viewport recovery sees a remaining live mask without a running tween`, () => {
    const f = fixture(), s = makeSlide(number), ctx = visit(); f.sandbox.slides.push(s.slide); ctx.to = 0;
    f.copy.hide(s.slide, ctx, origin); f.copy.paint(s.root, origin, 190);
    s.root.rect.width -= 28; s.root.rect.height += 40;
    f.resize(ctx);
    assert.equal(f.settlements, 1); assert.equal(f.overlays.size, 0);
    s.slide.roots.forEach(root => { assert.ok(clean(root)); assert.equal(root.removed, undefined); });
  });
}
test('completion cleans masks left by superseded wheel visits, not only the most recent source', () => {
  const f = fixture(), all = [9,10,11].map(n => makeSlide(n)), ctx = visit();
  f.sandbox.slides.push(...all.map(s=>s.slide)); ctx.to = 2;
  all.forEach((s,i)=>{ s.slide.classList.toggle('on',i===2); s.slide.roots.forEach(root=>f.copy.paint(root,origin,100)); });
  f.copy.show(all[2].slide); f.finishNetwork(ctx);
  assert.equal(f.overlays.size,0);
  for (let i=0;i<all.length;i++) for (const root of all[i].slide.roots) {
    assert.equal(root.style.maskImage,''); assert.equal(root.style.webkitMaskImage,'');
    assert.equal(root.classList.contains('dt-copy-hidden'),i!==2); assert.equal(root.removed,undefined);
  }
});
test('orphaned canonical surface releases its mask without deleting its real node', () => {
  const f=fixture(), s=makeSlide(10), ctx=visit(); ctx.to=0; f.sandbox.slides.push(s.slide);
  f.copy.paint(s.root,origin,50); s.root.parent=null;
  f.finishNetwork(ctx);
  assert.equal(f.overlays.size,0); assert.equal(s.root.style.maskImage,''); assert.equal(s.root.removed,undefined);
});
test('stale completion and cleanup cannot repaint the selected new visit', () => {
  const f=fixture(), s=makeSlide(11), old=visit(), fresh=visit(); f.sandbox.slides.push(s.slide); old.to=fresh.to=0;
  f.copy.hide(s.slide,old,origin); const next=f.copy.hide(s.slide,fresh,origin);
  f.copy.paint(s.root,origin,230); const mask=s.root.style.maskImage;
  old.live=false; old.close(); f.finishNetwork(old);
  assert.equal(s.root.style.maskImage,mask); assert.equal(f.overlays.get(s.root),s.root);
  f.copy.show(s.slide); fresh.close(); assert.ok(clean(s.root)); assert.equal(f.overlays.size,0);
});
test('repeated forward/reverse visits retain node identity and leave no paint resources', () => {
  const f=fixture(), all=[9,10,11].map(n=>makeSlide(n)); f.sandbox.slides.push(...all.map(s=>s.slide));
  for(let round=0;round<30;round++)for(const i of [0,1,2,1,0]){
    all.forEach((s,j)=>s.slide.classList.toggle('on',i===j));
    const s=all[i], ctx=visit(); ctx.to=i; ctx.generation=round*5+i;
    f.copy.hide(s.slide,ctx,origin,900);
    for(const r of [0,75,250,900])s.slide.roots.forEach(root=>f.copy.paint(root,origin,r));
    f.copy.show(s.slide); ctx.close(); f.finishNetwork(ctx);
    assert.equal(f.overlays.size,0); s.slide.roots.forEach(root=>{assert.ok(clean(root));assert.equal(root.removed,undefined)});
    assert.equal(s.column.children[0],s.heading); assert.equal(s.split.children[1],s.controls);
    assert.equal(s.root.style.transform,'');
  }
});
test('earlier-slide clones still retire and count independently from live wheel masks', () => {
  const f=fixture(), early=makeSlide(4,1280,800,true), wheel=makeSlide(11);
  f.copy.paint(early.root,origin,80); const clone=f.overlays.get(early.root);
  f.copy.paint(wheel.root,origin,80); assert.equal(f.copy.liveCloneCount,1);
  f.copy.show(early.slide); assert.equal(clone.removed,true); assert.equal(early.root.removed,undefined);
  f.copy.show(wheel.slide); assert.equal(f.overlays.size,0); assert.equal(wheel.root.removed,undefined);
});
test('direct/reduced endpoints and active cancellation keep their previous behavior', () => {
  const f=fixture();
  for(const n of [9,10,11]){
    const s=makeSlide(n), ctx=visit(); f.copy.hide(s.slide,ctx,origin); f.copy.paint(s.root,origin,80); ctx.close();
    s.slide.roots.forEach(root=>assert.ok(clean(root))); assert.equal(f.overlays.size,0);
    f.copy.retire(s.slide); f.copy.show(s.slide); s.slide.roots.forEach(root=>assert.ok(clean(root)));
  }
});
test('optional diagnostics are bounded, read-only records with no extra timers', () => {
  const f=fixture(network,true), s=makeSlide(10), ctx=visit(); f.sandbox.slides.push(s.slide);
  ctx.to=0; ctx.generation=11; f.sandbox.window.deckNav=ctx;
  for(let i=0;i<150;i++){f.copy.hide(s.slide,ctx,origin);f.copy.show(s.slide)}
  assert.equal(f.copyTrace.length,96); assert.equal(f.copyTrace.at(-1).operation,'show');
  assert.equal(f.copyTrace.at(-1).surfaces,0); assert.equal(f.copyTrace.at(-1).generation,11);
  assert.equal(f.timers.size,0); assert.equal(fixture().copyTrace,null);
});

test('rollback transition timing, reveal geometry and slide 11 roots stay unchanged', () => {
  assert.equal(createHash('sha256').update(section(network, '  const turn =', '  // Selection is output')).digest('hex'), '2c1751217cb2293dd3bcf84603351c409bf79cae470f9913b29fd90e8b12953b');
  assert.equal(createHash('sha256').update(section(network, '  const reveal =', '  let current =')).digest('hex'), '6979581bb24c497da0735d392143b77579a9c0ddbbc38687d6016c2df8428413');
  assert.equal(createHash('sha256').update(section(network, '  const textOf =', '  const place = (p)')).digest('hex'), '09188a673d65a59b6fb7c657a56f9ce2a61619b5be9a18746a749649811dcba0');
  assert.equal(createHash('sha256').update(section(network, '  const copyExtra =', '  const textTweens =')).digest('hex'), '3c7effaf0a5d40f096a2cf4ae6e3505846c6e842a0b90f9c5bb71528ada1d18e');
});
