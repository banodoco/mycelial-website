// agent — "the Astrid agent, typing an instruction".
//
// Astrid's own terminal, miniaturized: a near-black window with a thin
// chrome bar reading `astrid`, a user line that types at ~48 chars/s (the
// family's typing rate) with a blinking block cursor, then the agent
// answering line by line (each line spins briefly, then settles to ✓ or ·).
// The palette is Astrid's own:
//   panel #24211b · card #2c2822 · hairline #4a4337 · ink #f3eee4 ·
//   muted #aca395 · Astrid orange #ed6b23 (prompt and accents).
// The transcript is the install-and-first-request story in one breath.
//
// LOOP: type, answer, hold the finished state (~2.5 s), fade, clear, repeat.
// Lines that exceed the window scroll up smoothly. Reduced motion parks on
// the finished transcript with a still cursor; no timers run.

import { REDUCE } from './runtime.js';

// The script. `glyph` is the settled mark; `tool` is the muted right-hand
// column (dropped by CSS only on the narrowest phones); `spin` is how long
// that line's spinner runs: the install takes longest, the hand-off is quick.
// The install line is the real one (astrid.haus's macOS/Linux command).
const SCRIPT = [
  { kind: 'user',  prompt: '$', text: 'curl -fsSL https://astrid.haus/install | sh' },
  { kind: 'agent', glyph: '✓', text: 'Astrid is ready', spin: 760 },
  { kind: 'user',  prompt: '›', text: 'make a quiet 28-second light study' },
  { kind: 'agent', glyph: '·', text: 'generating anchor images', tool: 'qwen_image × 3', spin: 620 },
  { kind: 'agent', glyph: '·', text: 'animating the anchors', tool: 'animated_video × 3', spin: 620 },
  { kind: 'agent', glyph: '✓', text: 'timeline ready on astrid.haus', spin: 380 },
];

const CHAR_MS = 21;       // ~48 chars/s: Hivemind's rate (32 ms read as "painfully slow")
const LINE_GAP_MS = 260;  // pause before each new line
const TYPED_HOLD_MS = 240; // beat after a user line is typed, before the answer
const SPIN_MS = 420;      // default spinner beat when a line names no `spin`
const HOLD_MS = 2500;     // the finished state, held
const FADE_MS = 360;      // the window fades before it clears

let bodyEl, feedEl;
let curTxt = null;        // the user line being typed
let curCursor = null;     // its block cursor
let running = false;      // activate/deactivate re-entrancy guard
let token = 0;            // bumped on (de)activate to void a pending chain
let timer = null;

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function cursorEl() {
  return el('span', 'ast-cursor');
}

// Keep the newest line in view. Smooth while motion is allowed.
function follow(instant) {
  const top = bodyEl.scrollHeight;
  if (instant || REDUCE.matches) bodyEl.scrollTop = top;
  else bodyEl.scrollTo({ top, behavior: 'smooth' });
}

// The blank start of a pass.
function clearAll() {
  feedEl.classList.remove('ast-out');
  feedEl.textContent = '';
  bodyEl.scrollTop = 0;
  curTxt = null;
  curCursor = null;
}

function startUser(item) {
  const line = el('div', 'ast-line ast-user on');
  const gutter = el('span', 'ast-gutter', item.prompt);
  curTxt = el('span', 'ast-text');
  curCursor = cursorEl();
  line.append(gutter, curTxt, curCursor);
  feedEl.appendChild(line);
  follow();
}

function typeChar(ch) {
  curTxt.textContent += ch;
  follow();
}

function endUser() {
  if (curCursor) curCursor.remove();
  curCursor = null;
  curTxt = null;
}

function addAgent(item) {
  const line = el('div', 'ast-line ast-agent');
  const glyph = el('span', 'ast-gutter ast-glyph ast-spin');
  const text = el('span', 'ast-text', item.text);
  line.append(glyph, text);
  if (item.tool) line.append(el('span', 'ast-tool', item.tool));
  feedEl.appendChild(line);
  requestAnimationFrame(() => line.classList.add('on'));
  follow();
}

// The newest agent line: its spinner settles into the mark.
function settleAgent(item) {
  const glyph = feedEl.lastElementChild?.querySelector('.ast-glyph');
  if (!glyph) return;
  glyph.classList.remove('ast-spin');
  glyph.textContent = item.glyph;
  follow();
}

// The idle prompt the window ends on, cursor waiting for the next request.
function addIdlePrompt() {
  const line = el('div', 'ast-line ast-user on');
  curCursor = cursorEl();
  line.append(el('span', 'ast-gutter', '›'), curCursor);
  feedEl.appendChild(line);
  follow();
}

// The finished transcript, parked as a still (REDUCE and build()).
function settle() {
  clearAll();
  for (const item of SCRIPT) {
    if (item.kind === 'user') {
      const line = el('div', 'ast-line ast-user on');
      line.append(el('span', 'ast-gutter', item.prompt), el('span', 'ast-text', item.text));
      feedEl.appendChild(line);
    } else {
      const line = el('div', 'ast-line ast-agent on');
      line.append(el('span', 'ast-gutter ast-glyph', item.glyph), el('span', 'ast-text', item.text));
      if (item.tool) line.append(el('span', 'ast-tool', item.tool));
      feedEl.appendChild(line);
    }
  }
  addIdlePrompt();
  follow(true);
}

/* One pass = [delay, step] pairs. Each step is a single pending timeout;
   `token` voids the chain on deactivate so nothing resumes after the card
   is gone. */
function buildScript() {
  const steps = [[0, clearAll]];
  for (const item of SCRIPT) {
    if (item.kind === 'user') {
      steps.push([LINE_GAP_MS, () => startUser(item)]);
      for (const ch of item.text) steps.push([CHAR_MS, () => typeChar(ch)]);
      steps.push([TYPED_HOLD_MS, endUser]);
    } else {
      steps.push([LINE_GAP_MS, () => addAgent(item)]);
      steps.push([item.spin ?? SPIN_MS, () => settleAgent(item)]);
    }
  }
  steps.push([LINE_GAP_MS, addIdlePrompt]);
  steps.push([HOLD_MS, () => feedEl.classList.add('ast-out')]);
  steps.push([FADE_MS, () => {}]);
  return steps;
}

function play(steps, i = 0) {
  if (!running) return;
  if (i >= steps.length) { play(buildScript(), 0); return; }
  const t = token;
  const [ms, fn] = steps[i];
  timer = setTimeout(() => {
    if (t !== token) return;
    fn();
    play(steps, i + 1);
  }, ms);
}

export default {
  build(stage, node) {
    stage.classList.add('ast');

    // the window chrome: three small dots and the one word
    const chrome = el('div', 'ast-chrome');
    chrome.setAttribute('aria-hidden', 'true');   // decoration: the description above is the meaning
    const dots = el('span', 'ast-dots');
    for (let i = 0; i < 3; i++) dots.appendChild(el('span', 'ast-dot'));
    chrome.append(dots, el('span', 'ast-title', 'astrid'));

    bodyEl = el('div', 'ast-body');
    bodyEl.setAttribute('aria-hidden', 'true');
    feedEl = el('div', 'ast-feed');
    bodyEl.appendChild(feedEl);

    // the ending — the shared foot band, href and label from the content
    const link = node.card.link;
    const door = document.createElement('a');
    door.className = 'ast-door card-door card-cta';
    door.href = link.href;
    door.target = '_blank';
    door.rel = 'noopener noreferrer';
    door.tabIndex = -1;   // ui.js promotes controls to tabbable on pin
    door.textContent = `${link.label.toUpperCase()} →`;

    stage.append(chrome, bodyEl, door);
    settle();   // parked on the finished transcript
  },

  activate() {
    if (REDUCE.matches) { settle(); return; }   // park on the finished state
    if (running) return;                        // already animating
    running = true;
    token++;
    clearAll();
    play(buildScript(), 0);
  },

  deactivate() {
    running = false;
    token++;
    if (timer) { clearTimeout(timer); timer = null; }
    if (!REDUCE.matches) clearAll();            // reset for the next reveal
  },
};
