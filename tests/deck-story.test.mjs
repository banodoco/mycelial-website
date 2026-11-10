// Dependency-free regression checks; full visual/browser checks remain separate.
// Run: node --test tests/deck-story.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source = readFileSync(new URL('../mycelial/deck-overlay.js', import.meta.url), 'utf8');
const deckHtml = readFileSync(new URL('../mycelial/index.html', import.meta.url), 'utf8');

class Element {
  constructor(tag = 'div', classes = '') {
    this.tagName = tag.toUpperCase(); this.children = []; this.style = {}; this.attrs = {};
    this.listeners = new Map(); this.hidden = false; this.isConnected = true; this.innerHTML = ''; this.textContent = '';
    this.className = classes; this.rect = { left: 0, top: 0, width: 100, height: 30 }; this.animations = [];
    this.classList = {
      contains: name => this.className.split(' ').includes(name),
      add: (...names) => { this.className = [...new Set([...this.className.split(' '), ...names])].join(' ').trim(); },
      remove: (...names) => { this.className = this.className.split(' ').filter(name => !names.includes(name)).join(' '); },
    };
  }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  getAttribute(key) { return this.attrs[key]; }
  removeAttribute(key) { delete this.attrs[key]; }
  append(...nodes) { nodes.forEach(node => { node.parentElement = this; this.children.push(node); }); }
  appendChild(node) { this.append(node); return node; }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(fn); }
  emit(type, extra = {}) { const event = { target: this, stopPropagation() {}, preventDefault() {}, ...extra }; (this.listeners.get(type) || []).forEach(fn => fn(event)); }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  matches(selector) { if (selector.startsWith(':')) return false; return selector.split('.').slice(1).every(name => this.classList.contains(name)); }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector); }
  querySelectorAll(selector) {
    if (selector === '.story-links a') return [];
    return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getBoundingClientRect() { const r = this.rect; return { ...r, right: r.left + r.width, bottom: r.top + r.height }; }
  get offsetWidth() { return this.rect.width; }
  get offsetHeight() { return this.rect.height; }
  animate(frames, options) { const animation = { frames, options, cancelled: false, cancel() { this.cancelled = true; } }; this.animations.push(animation); return animation; }
}
function fixture({ reduced = false, selectors = ['.ac-host', '.as-host', '.st-host', '.pa-host'] } = {}) {
  const hosts = new Map(selectors.map(selector => {
    const host = new Element('section', `slide ${selector.slice(1)}`), heading = new Element('h1'), body = new Element('div', 'body');
    heading.innerHTML = 'Old'; body.textContent = 'Old body'; host.append(heading, body); host.heading = heading; host.body = body;
    host.querySelector = selector => selector === 'h1' ? heading : selector === '.body' ? body : null;
    return [selector, host];
  }));
  const styles = new Map(), listeners = new Map(), timers = new Map(), observers = [];
  let now = 0, nextId = 1;
  const schedule = (fn, ms, ctx) => { const id = nextId++; timers.set(id, { fn, at: now + ms, ctx }); return id; };
  const window = {
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
    deckNow: () => now, deckStill: () => reduced,
    deckNav: { to: 4, direct: false, rest: false, back: false, isCurrent: () => true, isTransitionCurrent: () => false },
    deckLater: schedule, deckCancelLater: id => timers.delete(id),
  };
  const context = vm.createContext({
    console, window, matchMedia: () => ({ matches: reduced }), setTimeout: schedule, clearTimeout: id => timers.delete(id),
    ResizeObserver: class { constructor(fn) { this.fn = fn; } observe() {} },
    MutationObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} takeRecords() { return []; } },
    document: {
      querySelector: selector => hosts.get(selector) || null, getElementById: id => styles.get(id),
      createElement: tag => new Element(tag), head: { appendChild: style => styles.set(style.id, style) },
    },
  });
  const run = () => vm.runInContext(source, context); run();
  // Process nested timers at their actual deadline, not at the end of a large tick.
  const tick = milliseconds => {
    const end = now + milliseconds;
    for (;;) {
      const entry = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      const [id, timer] = entry; now = timer.at; timers.delete(id);
      if (!timer.ctx || timer.ctx.isCurrent()) timer.fn();
    }
    now = end;
  };
  const dispatch = (type, extra = {}) => {
    const event = { prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...extra };
    (listeners.get(type) || []).forEach(fn => fn(event)); return event;
  };
  return { hosts, styles, context, window, observers, timers, run, tick, dispatch };
}
function demo(options) {
  const f = fixture(options), slide = new Element('section', 'slide as-host on'), root = new Element('div', 'as');
  root.rect = { left: 0, top: 0, width: 1000, height: 560 }; slide.append(root);
  const msgs = new Element('div', 'as-msgs'); msgs.rect = { left: 0, top: 20, width: 300, height: 420 };
  const timeline = new Element('div', 'as-tl'); root.append(msgs, timeline);
  const targets = [0, 1, 2].map(index => {
    const lane = new Element('div', 'as-lane'), target = new Element('div', index === 1 ? 'as-frame-clip' : 'as-clip');
    lane.rect = { left: 340, top: 400 + index * 40, width: 600, height: 32 }; target.rect = { ...lane.rect };
    lane.append(target); timeline.append(lane); return target;
  });
  const notes = f.window.createAstridDemoNotes(root, targets);
  const addRows = count => {
    for (let i = msgs.children.length; i < count; i++) {
      const row = new Element('div', 'as-step'); row.rect = { left: 12, top: 70 + i * 70, width: 275, height: 46 }; msgs.append(row);
    }
    f.observers.forEach(observer => observer.fn());
  };
  const pin = (index, location) => root.querySelectorAll('.as-note-pin').find(pin => pin.getAttribute('data-note') === String(index + 1) && pin.getAttribute('data-location') === location);
  return { ...f, slide, root, msgs, targets, notes, addRows, pin, card: root.querySelector('.as-note-card') };
}

test('canonical headings preserve copy, external links and brace', () => {
  const f = fixture();
  const intro = f.hosts.get('.as-host').heading.innerHTML;
  assert.match(intro, /<strong class="story-era">Today,<\/strong> an extendible agent-powered video editor\./);
  assert.match(intro, /<strong class="story-era">Soon,<\/strong> a fully-adaptable multimodal creative suite\./);
  assert.match(intro, /href="https:\/\/astrid\.haus\/" target="_blank"/);
  assert.match(intro, /href="https:\/\/astrid\.haus\/vision" target="_blank"/);
  assert.equal((intro.match(/rel="noopener noreferrer"/g) || []).length, 2);
  assert.match(intro, /<em class="story-astrid">Astrid<\/em>/);
  assert.doesNotMatch(intro, /<a[^>]*>[^<]*Astrid/);
  assert.match(intro, /story-brace/); assert.match(intro, /story-bridge/); assert.match(intro, /All powered by/); assert.match(intro, /Open Models/);
  assert.match(deckHtml, /<div class="num">05<span class="act">Introducing<\/span><\/div>/);
  assert.match(f.hosts.get('.st-host').heading.innerHTML, /^<span class="story-title">Astrid is <em>everyone’s to shape\.<\/em><\/span>/);
  assert.match(f.hosts.get('.pa-host').heading.innerHTML, /Builders grow the ecosystem; creators sustain it\./);
  for (const host of f.hosts.values()) { assert.equal(host.querySelector('h1'), host.heading); assert.equal(host.body.hidden, true); }
});
test('story initialization is idempotent and optional on other pages', () => {
  const f = fixture(), heading = f.hosts.get('.as-host').heading, style = f.styles.get('deck-intro-story'); f.run();
  assert.equal(f.hosts.get('.as-host').heading, heading); assert.equal(f.styles.get('deck-intro-story'), style); assert.equal(f.styles.size, 1);
  const absent = fixture({ selectors: [] }); assert.equal(absent.styles.size, 0); assert.equal(typeof absent.window.deckOverlay.register, 'function');
});
test('compact header uses content-sized tracks and keeps Meet Astrid on one line', () => {
  const css = fixture().styles.get('deck-intro-story').textContent;
  assert.match(css, /grid-template-columns: max-content max-content/);
  assert.match(css, /--story-column-gap: clamp\(24px, 2\.8vw, 40px\)/);
  assert.match(css, /\.story-roadmap-grid \{[^}]*column-gap: var\(--story-column-gap\)/);
  assert.match(css, /grid-template-columns: max-content 18px max-content/);
  assert.match(css, /justify-content: start/);
  assert.match(css, /\.as-host\.story-refined \.story-title\s*\{[^}]*white-space: nowrap/);
  assert.match(css, /\.as-host\.story-refined \.story-astrid\s*\{\s*display: inline/);
  assert.doesNotMatch(css, /minmax\(0, \.20fr\)|minmax\(0, 1fr\) 18px 108px/);
  for (const value of ['var(--as-copy-alpha, 1)', 'max-width: 760px', 'max-height: 500px', 'prefers-reduced-motion: reduce']) assert.ok(css.includes(value));
  assert.match(css, /\.story-roadmap-lines\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.story-roadmap-lines > span\s*\{[^}]*white-space: normal; text-align: center/);
  assert.match(css, /\.story-brace\s*\{ display: none; \}/);
  assert.match(css, /\.story-bridge\s*\{[^}]*display: block;/);
  assert.match(css, /\.story-powered\s*\{[^}]*text-align: center;/);
  assert.match(css, /\.story-links\s*\{ justify-content: center;/);
});
test('card appears first, chat marker at 500 ms, editor 850 ms after chat', () => {
  const f = demo(); f.addRows(1); f.targets[0].classList.add('is-ready'); f.notes.update();
  assert.equal(f.pin(0, 'chat').hidden, true); assert.equal(f.pin(0, 'editor').hidden, true);
  f.tick(499); assert.equal(f.pin(0, 'chat').hidden, true);
  f.tick(1); assert.equal(f.pin(0, 'chat').hidden, false); assert.equal(f.pin(0, 'editor').hidden, true);
  f.tick(849); assert.equal(f.pin(0, 'editor').hidden, true);
  f.tick(1); assert.equal(f.pin(0, 'editor').hidden, false);
  for (const location of ['chat', 'editor']) assert.equal(f.pin(0, location).children[0].animations.length, 1);
  f.notes.update(); f.notes.update(); assert.equal(f.pin(0, 'editor').children[0].animations.length, 1);
});
test('editor marker still waits for its actual output after both delays', () => {
  const f = demo(); f.addRows(1); f.tick(1350); assert.equal(f.pin(0, 'editor').hidden, true);
  f.targets[0].classList.add('is-ready'); f.notes.update(); assert.equal(f.pin(0, 'editor').hidden, false);
});
test('all three pairs share their respective tooltip content', () => {
  const f = demo(); f.addRows(3); f.targets.forEach(target => target.classList.add('is-ready')); f.notes.update(); f.tick(1350);
  assert.equal(f.root.querySelectorAll('.as-note-pin').length, 6);
  for (let i = 0; i < 3; i++) {
    f.pin(i, 'chat').emit('focus'); const content = f.card.children.map(el => el.textContent).join(' ');
    assert.equal(f.notes.isOpen(), true); f.pin(i, 'editor').emit('focus');
    assert.equal(f.card.children.map(el => el.textContent).join(' '), content);
    assert.equal(f.pin(i, 'editor').getAttribute('aria-expanded'), 'true');
  }
});
test('reset before chat cancels both reveals and replay waits again', () => {
  const f = demo(); f.addRows(1); f.targets[0].classList.add('is-ready'); f.notes.reset();
  f.tick(2000); assert.equal(f.pin(0, 'editor').hidden, true); assert.equal(f.pin(0, 'chat').hidden, true); assert.equal(f.timers.size, 0);
  f.notes.update(); assert.equal(f.pin(0, 'chat').hidden, true); f.tick(500); assert.equal(f.pin(0, 'chat').hidden, false);
  f.tick(850); assert.equal(f.pin(0, 'editor').hidden, false);
});
test('reset after chat also cancels the pending editor reveal', () => {
  const f = demo(); f.addRows(1); f.targets[0].classList.add('is-ready'); f.tick(500);
  assert.equal(f.pin(0, 'chat').hidden, false); assert.equal(f.timers.size, 1);
  f.notes.reset(); f.tick(2000);
  assert.equal(f.pin(0, 'chat').hidden, true); assert.equal(f.pin(0, 'editor').hidden, true); assert.equal(f.timers.size, 0);
});
test('leaving before either delay cannot reveal a pending marker', () => {
  for (const elapsed of [0, 500]) {
    const f = demo(); f.addRows(1); f.targets[0].classList.add('is-ready'); f.tick(elapsed);
    f.slide.classList.remove('on'); f.tick(2000);
    assert.equal(f.pin(0, 'editor').hidden, true); assert.equal(f.timers.size, 0);
    if (elapsed === 0) assert.equal(f.pin(0, 'chat').hidden, true);
  }
});
test('expired visit callbacks cannot reveal notes even if the slide remains visible', () => {
  const f = demo(); f.addRows(1); f.targets[0].classList.add('is-ready');
  f.window.deckNav.isCurrent = () => false; f.tick(2000);
  assert.equal(f.pin(0, 'chat').hidden, true); assert.equal(f.pin(0, 'editor').hidden, true);
});
test('repeated update does not restart the initial delay', () => {
  const f = demo(); f.addRows(1); f.targets[0].classList.add('is-ready');
  f.tick(400); f.notes.update(); f.tick(100); assert.equal(f.pin(0, 'chat').hidden, false);
  f.notes.update(); f.tick(850); assert.equal(f.pin(0, 'editor').hidden, false);
});
test('a stale timer cannot affect a new replay generation', () => {
  const f = demo(); f.addRows(1); const oldCallback = [...f.timers.values()][0].fn;
  f.notes.reset(); f.notes.update(); oldCallback();
  assert.equal(f.pin(0, 'chat').hidden, true); assert.equal(f.pin(0, 'editor').hidden, true);
});
test('chat pins track scroll visibility and close an offscreen tooltip', () => {
  const f = demo(); f.addRows(1); f.tick(500); f.pin(0, 'chat').emit('focus'); assert.equal(f.notes.isOpen(), true);
  f.msgs.children[0].rect.top = -100; f.msgs.emit('scroll'); assert.equal(f.pin(0, 'chat').hidden, true); assert.equal(f.notes.isOpen(), false);
  f.msgs.children[0].rect.top = 80; f.msgs.emit('scroll'); assert.equal(f.pin(0, 'chat').hidden, false);
  assert.equal(f.pin(0, 'chat').children[0].animations.length, 1);
});
test('reduced motion shows both sets without delays or pulses', () => {
  const f = demo({ reduced: true }); f.targets.forEach(target => target.classList.add('is-ready')); f.addRows(3); f.notes.update();
  for (const pin of f.root.querySelectorAll('.as-note-pin')) { assert.equal(pin.hidden, false); assert.equal(pin.children[0].animations.length, 0); }
  assert.equal(f.timers.size, 0);
});
test('switching animations off clears either timer and reveals the ready pair', () => {
  for (const elapsed of [0, 500]) {
    const f = demo(); f.addRows(1); f.targets[0].classList.add('is-ready'); f.tick(elapsed);
    f.window.deckStill = () => true; f.dispatch('deck-motion');
    assert.equal(f.pin(0, 'chat').hidden, false); assert.equal(f.pin(0, 'editor').hidden, false); assert.equal(f.timers.size, 0);
  }
});
test('Escape and outside click dismiss notes; arrows still navigate', () => {
  const f = demo(); f.addRows(1); f.tick(500); f.pin(0, 'chat').emit('click');
  const inside = f.dispatch('click', { target: f.card }); assert.equal(inside.prevented, false); assert.equal(f.notes.isOpen(), true);
  const escape = f.dispatch('keydown', { key: 'Escape' }); assert.equal(escape.prevented, true); assert.equal(f.notes.isOpen(), false);
  f.pin(0, 'chat').emit('click'); const arrow = f.dispatch('keydown', { key: 'ArrowRight' }); assert.equal(arrow.prevented, false); assert.equal(f.notes.isOpen(), false);
  f.pin(0, 'chat').emit('click'); f.dispatch('click', { target: new Element() }); assert.equal(f.notes.isOpen(), false);
});
test('approved pacing only accelerates forward, unsettled slides 7 and 8', () => {
  const f = fixture(), ctx = f.window.deckNav; ctx.isTransitionCurrent = () => true;
  ctx.to = 6; assert.equal(f.window.deckStoryPacing.rate(), 1.45); ctx.to = 7; assert.equal(f.window.deckStoryPacing.rate(), 1.3);
  ctx.back = true; assert.equal(f.window.deckStoryPacing.rate(), 1); ctx.back = false; ctx.isTransitionCurrent = () => false; assert.equal(f.window.deckStoryPacing.rate(), 1);
});
