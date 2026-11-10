// Story copy is applied before scene registration so bounds, masks and links
// all refer to the canonical headings. Demo notes share the scene's visit clock.
(() => {
  const stories = [
    { selector: '.ac-host', html: 'We’re building that place: <em>an agent-powered creative workspace</em> where anyone can unlock their creative potential with <span class="ac-nw">open-source AI.</span>' },
    { selector: '.as-host', html: '<span class="story-intro"><span class="story-title">Meet <em class="story-astrid">Astrid</em></span><span class="story-links"><a class="as-link" href="https://astrid.haus/" target="_blank" rel="noopener noreferrer">App</a><span class="story-divider" aria-hidden="true">|</span><a href="https://astrid.haus/vision" target="_blank" rel="noopener noreferrer">Vision</a></span></span> <span class="story-roadmap-grid"><span class="story-roadmap-lines"><span>Today, an extendible agent-powered video editor.</span><span>Soon, a fully-adaptable multimodal creative suite.</span></span><svg class="story-brace" viewBox="0 0 20 76" fill="none" aria-hidden="true"><path d="M3 2C12 2 12 9 12 17V28C12 35 15 38 19 38C15 38 12 41 12 48V59C12 67 12 74 3 74" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg><span class="story-powered">All powered by <span>Open Models</span></span></span>' },
    { selector: '.st-host', html: '<span class="story-title">And Astrid is <em>everyone’s to shape.</em></span> <span class="story-lead">As you create, you and your agent <em>extend every layer</em> — from your workspace to its tools and models.</span> <span class="story-note">What you share becomes part of a community-built creative platform<span class="story-detail">, ready for others to use and build on</span>.</span>' },
    { selector: '.pa-host', html: '<span class="story-lead">Nerds run Astrid locally and extend it. Everyone else pays to create with <em>that same growing platform</em> through an accessible hosted version.</span><span class="story-note">Builders grow the ecosystem; creators sustain it.</span>' },
  ];
  const hosts = stories.map(story => ({ ...story, host: document.querySelector(story.selector) }));
  if (!hosts.some(({ host }) => host)) return;
  if (!document.getElementById('deck-intro-story')) {
    const style = document.createElement('style');
    style.id = 'deck-intro-story';
    style.textContent = `
      html[data-ver="f"] .story-refined h1 { font-weight: 400; }
      html[data-ver="f"] .story-refined .body[hidden] { display: none !important; }
      .story-refined .story-title, .story-refined .story-lead, .story-refined .story-note { display: block; }
      html[data-ver="f"] .ac-host.story-refined h1 {
        max-width: 20em; font-size: clamp(1.9rem, 3.5vw, 3.5rem); line-height: 1.11; text-wrap: balance;
      }
      html[data-ver="f"] .as-host.story-refined { padding-inline: max(24px, 7vw); text-align: left; }
      html[data-ver="f"] .as-host.story-refined > .split { width: 100%; }
      html[data-ver="f"] .as-host.story-refined .as-copy { width: min(1180px, 100%); }
      html[data-ver="f"] .as-host.story-refined h1 {
        /* Keep the introduction, roadmap and brace together; surplus space stays right. */
        display: grid; grid-template-columns: max-content max-content;
        column-gap: clamp(24px, 2.8vw, 40px); align-items: center; justify-content: start;
        width: 100%; max-width: none; margin: 0; text-wrap: initial;
      }
      .story-intro { display: block; min-width: 0; }
      html[data-ver="f"] .as-host.story-refined .story-title {
        font-size: clamp(2.4rem, min(4.3vw, 7vh), 3.6rem); line-height: 1.04; letter-spacing: -.025em; white-space: nowrap;
      }
      html[data-ver="f"] .as-host.story-refined .story-astrid {
        display: inline; font-style: italic;
        background-image: linear-gradient(175deg, rgb(255 216 158 / var(--as-copy-alpha, 1)), rgb(235 145 71 / var(--as-copy-alpha, 1)));
      }
      .as-host[data-settled] .story-astrid { animation: story-name-glow 1.8s ease-in-out .15s both; }
      @keyframes story-name-glow { 0%, 100% { filter: none; } 45% { filter: drop-shadow(0 0 8px #ed984f45) brightness(1.12); } }
      .story-links { display: flex; align-items: center; gap: .65em; margin-top: 13px;
        font: 400 clamp(1rem, 1.3vw, 1.2rem)/1.3 "EB Garamond", Georgia, serif; letter-spacing: .01em;
        color: rgb(184 169 143 / var(--as-copy-alpha, 1)); }
      .story-links a { display: inline-block; color: inherit; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: .2em; }
      .story-links a:hover { color: rgb(244 202 141 / var(--as-copy-alpha, 1)); }
      .story-links a:focus-visible { outline: 1px solid #e0ab5e; outline-offset: 5px; border-radius: 2px; }
      .story-links .as-link::after { display: none; }
      .story-divider { opacity: .4; }
      .story-roadmap-grid { display: grid; grid-template-columns: max-content 18px max-content; align-items: center; justify-content: start; gap: 12px; min-width: 0; }
      .story-roadmap-lines { display: grid; gap: .8em; min-width: 0;
        font: 400 clamp(1.05rem, 1.75vw, 1.65rem)/1.24 "Cormorant Garamond", Georgia, serif; letter-spacing: -.015em; }
      .story-roadmap-lines > span { display: block; white-space: nowrap; }
      .story-brace { width: 18px; height: 76px; color: rgb(224 171 94 / var(--as-copy-alpha, 1)); opacity: .65; }
      .story-powered { font: 400 clamp(.9rem, 1.1vw, 1.05rem)/1.35 "EB Garamond", Georgia, serif;
        color: rgb(184 169 143 / var(--as-copy-alpha, 1)); letter-spacing: 0; }
      .story-powered > span { display: block; color: rgb(236 197 126 / var(--as-copy-alpha, 1)); }
      html[data-ver="f"] .as-host.story-refined .as { margin-top: clamp(20px, 3vh, 30px); }
      html[data-ver="f"] .st-host.story-refined > .split { grid-template-columns: minmax(0, 36vw); }
      html[data-ver="f"] .st-host.story-refined h1 { max-width: none; text-wrap: initial; }
      html[data-ver="f"] .st-host.story-refined .story-title {
        font-size: clamp(2.3rem, 3.8vw, 3.8rem); line-height: 1.06; letter-spacing: -.015em; text-wrap: balance;
      }
      html[data-ver="f"] .st-host.story-refined .story-title em { display: block; }
      html[data-ver="f"] .st-host.story-refined .story-lead {
        margin-top: clamp(18px, 2.7vh, 28px); font-size: clamp(1.3rem, 2vw, 1.8rem); line-height: 1.25; letter-spacing: 0; text-wrap: pretty;
      }
      html[data-ver="f"] .st-host.story-refined .story-note, html[data-ver="f"] .pa-host.story-refined .story-note {
        margin-top: clamp(14px, 2.3vh, 23px); font: 400 clamp(1rem, 1.35vw, 1.25rem)/1.45 "EB Garamond", Georgia, serif;
        color: var(--soft); letter-spacing: 0; text-wrap: pretty;
      }
      html[data-ver="f"] .pa-host.story-refined h1 { font-size: clamp(1.75rem, 2.65vw, 2.9rem); max-width: 13em; }
      /* Both sets of controls are outside the demo's aria-hidden visual panels. */
      .as-notes { position: absolute; inset: 0; z-index: 5; pointer-events: none; }
      .as-note-pin { position: absolute; display: grid; place-items: center; width: 36px; height: 36px; padding: 0; border: 0;
        background: transparent; color: #f7deb1; font: 500 11px/1 "DM Sans", system-ui, sans-serif; cursor: help;
        pointer-events: auto; touch-action: manipulation; transform: translate(-50%, -50%); }
      .as-note-pin span { display: grid; place-items: center; width: 21px; height: 21px; border-radius: 50%;
        border: 1px solid #b89561; background: #33291f; box-shadow: 0 1px 8px #0007; }
      .as-note-pin:hover span, .as-note-pin[aria-expanded="true"] span { background: #51402b; border-color: #efd3a2; }
      .as-note-pin:focus-visible { outline: 1px solid #efd3a2; outline-offset: -3px; border-radius: 50%; }
      .as-note-card { position: absolute; width: min(290px, calc(100% - 16px)); padding: 14px 16px;
        border: 1px solid #92754c; border-radius: 9px; background: #28221b; box-shadow: 0 12px 30px #0007;
        pointer-events: auto; color: #d2c4ae; font: 400 12px/1.5 "DM Sans", system-ui, sans-serif; text-align: left; }
      .as-note-card strong { display: block; margin-bottom: 5px; color: #f1d39d; font-weight: 500; font-size: 13px; }
      .as-note-card p { margin: 0; }
      .as-note-pin[hidden], .as-note-card[hidden] { display: none !important; }
      .as-host.has-demo-notes .as-scene-clip .as-name { left: 30px; }
      .as-host.has-demo-notes .as-step { padding-right: 34px; }
      @media (pointer: coarse) { .as-note-pin { width: 44px; height: 44px; } }
      @media (max-width: 1100px) and (min-width: 761px) {
        .story-roadmap-grid { grid-template-columns: max-content 15px max-content; gap: 10px; }
        .story-roadmap-lines { font-size: 1.65vw; }
        .story-brace { width: 15px; }
        .story-powered { font-size: .9rem; }
      }
      @media (max-width: 760px) and (orientation: portrait), (max-width: 760px) and (min-height: 501px) {
        html[data-ver="f"] .as-host.story-refined { padding-inline: 24px; }
        html[data-ver="f"] .as-host.story-refined h1 { grid-template-columns: minmax(0, 1fr); gap: 18px; }
        html[data-ver="f"] .as-host.story-refined .story-title { font-size: clamp(2.2rem, 9.8vw, 3rem); }
        html[data-ver="f"] .as-host.story-refined .story-astrid { display: inline; }
        .story-links { margin-top: 9px; font-size: 1rem; }
        .story-roadmap-grid { grid-template-columns: minmax(0, max-content) 14px; column-gap: 7px; row-gap: 6px; }
        .story-roadmap-lines { font-size: clamp(.76rem, 3.65vw, 1.3rem); gap: .65em; letter-spacing: -.02em; }
        .story-brace { width: 14px; height: 52px; }
        .story-powered { grid-column: 1 / -1; text-align: right; font-size: .84rem; }
        .story-powered > span { display: inline; }
        html[data-ver="f"] .as-host.story-refined .as { margin-top: 18px; }
        html[data-ver="f"] .ac-host.story-refined h1 { font-size: clamp(1.65rem, 6.7vw, 2rem); }
        html[data-ver="f"] .pa-host.story-refined h1 { font-size: clamp(1.45rem, 6.2vw, 2rem); max-width: 23ch; }
        html[data-ver="f"] .pa-host.story-refined .story-note { font-size: .95rem; margin-top: 12px; }
        .as-note-card { padding: 11px 13px; font-size: 11.5px; }
        .as-note-pin span { width: 19px; height: 19px; font-size: 10px; }
      }
      @media (max-width: 760px) and (orientation: portrait), (max-width: 760px) and (min-height: 501px),
             (max-width: 1100px) and (orientation: portrait), (max-width: 1100px) and (min-height: 650px) {
        html[data-ver="f"] .st-host.story-refined > .split { grid-template-columns: minmax(0, 1fr); }
        html[data-ver="f"] .st-host.story-refined h1 { max-width: 34rem; }
        html[data-ver="f"] .st-host.story-refined .story-title { max-width: 24ch; font-size: clamp(1.85rem, 7.4vw, 2.5rem); }
        html[data-ver="f"] .st-host.story-refined .story-lead { margin-top: 14px; font-size: clamp(1.15rem, 4.8vw, 1.4rem); line-height: 1.2; }
        html[data-ver="f"] .st-host.story-refined .story-note { margin-top: 12px; font-size: 1rem; line-height: 1.3; }
      }
      @media (max-width: 760px) and (orientation: portrait) and (max-height: 740px) {
        html[data-ver="f"] .as-host.story-refined h1 { gap: 12px; }
        html[data-ver="f"] .as-host.story-refined .story-title { font-size: 2rem; }
        .story-links { margin-top: 7px; }
        html[data-ver="f"] .as-host.story-refined .as { margin-top: 14px; }
        html[data-ver="f"] .st-host.story-refined .story-title { font-size: 1.7rem; }
        html[data-ver="f"] .st-host.story-refined .story-lead { margin-top: 10px; font-size: 1.05rem; }
        html[data-ver="f"] .st-host.story-refined .story-note { margin-top: 8px; font-size: .95rem; }
        html[data-ver="f"] .st-host.story-refined .story-detail { display: none; }
      }
      @media (max-height: 500px) and (orientation: landscape) {
        html[data-ver="f"] .as-host.story-refined { padding-top: 34px; }
        html[data-ver="f"] .as-host.story-refined .story-title { font-size: clamp(1.8rem, 3.8vw, 2.8rem); }
        .story-links { margin-top: 7px; font-size: .9rem; }
        .story-roadmap-grid { grid-template-columns: max-content 14px max-content; gap: 8px; }
        .story-roadmap-lines { font-size: 1.6vw; }
        .story-brace { width: 14px; height: 52px; }
        .story-powered { font-size: .8rem; }
        html[data-ver="f"] .as-host.story-refined .as { margin-top: 12px; }
        html[data-ver="f"] .st-host.story-refined .story-title { font-size: clamp(1.8rem, 3.4vw, 2.5rem); }
        html[data-ver="f"] .st-host.story-refined .story-lead { margin-top: 12px; font-size: 1.05rem; }
        html[data-ver="f"] .st-host.story-refined .story-note { margin-top: 10px; font-size: .9rem; }
      }
      @media (prefers-reduced-motion: reduce) { .as-host[data-settled] .story-astrid { animation: none; } }
      html.deck-motion-off .as-host[data-settled] .story-astrid { animation: none; }
    `;
    document.head.appendChild(style);
  }
  for (const { host, html } of hosts) {
    if (!host || host.classList.contains('story-refined')) continue;
    const heading = host.querySelector('h1');
    if (!heading) continue;
    heading.innerHTML = html;
    heading.querySelectorAll('.story-links a').forEach(link => link.addEventListener('click', event => event.stopPropagation()));
    const fallback = host.querySelector('.body');
    if (fallback) { fallback.textContent = ''; fallback.hidden = true; }
    host.classList.add('story-refined');
  }
})();

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
  window.addEventListener('click', event => {
    const entry = active();
    if (!entry || contains(entry, event)) return;
    close(entry, 'outside', event); event.preventDefault(); event.stopPropagation();
  }, true);
  window.addEventListener('keydown', event => {
    const entry = active();
    if (!entry) return;
    if (event.key === 'Escape') { close(entry, 'escape', event); event.preventDefault(); event.stopPropagation(); }
    else if (navigationKeys.has(event.key)) close(entry, 'navigation', event);
  }, true);
  let touch = null;
  window.addEventListener('touchstart', event => {
    const point = event.touches[0];
    touch = point ? { x: point.clientX, y: point.clientY,
      interactive: !!event.target.closest?.('button, a, [role="button"], .fw-card, .fw-full, .fw-ask, .vc, .vc-box, .vc-note, .st-card, .st-flag, .as-note-card') } : null;
  }, { capture: true, passive: true });
  window.addEventListener('touchend', event => {
    if (!touch) return;
    const point = event.changedTouches[0], start = touch; touch = null;
    if (!point || start.interactive) return;
    const dx = point.clientX - start.x, dy = point.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > 1.5 * Math.abs(dy)) close(active(), 'navigation', event);
  }, { capture: true, passive: true });
})();

// Keep the previously approved forward-arrival pacing, not the ambient/media speed.
(function deckStoryPacing() {
  if (typeof window.deckNow !== 'function' || window.deckStoryPacing) return;
  const nativeNow = window.deckNow;
  let previous = nativeNow(), elapsed = previous;
  const rate = () => {
    const ctx = window.deckNav;
    if (!ctx || ctx.direct || ctx.rest || ctx.back || window.deckStill?.() || !ctx.isTransitionCurrent()) return 1;
    return ctx.to === 6 ? 1.45 : ctx.to === 7 ? 1.3 : 1;
  };
  window.deckStoryPacing = { rate };
  window.deckNow = () => { const now = nativeNow(); elapsed += Math.max(0, now - previous) * rate(); previous = now; return elapsed; };
})();

// Let each card arrive before its chat marker pulses; the matching timeline
// marker follows 850 ms later, and never before its output exists.
window.createAstridDemoNotes = function createAstridDemoNotes(root, targets) {
  const slide = root.closest('.slide'), msgs = root.querySelector('.as-msgs');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const quiet = () => reduced.matches || window.deckStill?.();
  const CHAT_MARKER_DELAY = 500, EDITOR_MARKER_DELAY = 850;
  const definitions = [
    { title: 'Build with extensions', text: 'Your agent uses extensions such as Three.js to turn your request into a scene on the timeline.', x: 0, y: 1 },
    { title: 'Put open models to work', text: 'Your agent works out how to use open models on your machine. Here, Qwen turns the scene into reference images.', x: .5, y: .5 },
    { title: 'Bring it all together', text: 'Your agent combines the scenes, images and motion guides on your timeline into finished creative work. You can keep editing every part.', x: 1, y: 0 },
  ];
  const layer = document.createElement('div'); layer.className = 'as-notes';
  const card = document.createElement('div'); card.id = 'astrid-demo-note'; card.className = 'as-note-card'; card.hidden = true; card.setAttribute('role', 'tooltip');
  const title = document.createElement('strong'), description = document.createElement('p'); card.append(title, description);
  let active = null, pinned = false, hideTimer = 0, enabled = false, generation = 0;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const isHere = () => slide.classList.contains('on') && !root.classList.contains('is-resetting');
  const positionCard = () => {
    if (!active) return;
    const host = root.getBoundingClientRect(), anchor = active.button.getBoundingClientRect();
    card.style.left = `${clamp(anchor.left - host.left + anchor.width / 2 - card.offsetWidth / 2, 8, host.width - card.offsetWidth - 8)}px`;
    card.style.top = `${clamp(anchor.top - host.top - card.offsetHeight - 8, 8, host.height - card.offsetHeight - 8)}px`;
  };
  const close = () => {
    clearTimeout(hideTimer); hideTimer = 0;
    if (active) { active.button.setAttribute('aria-expanded', 'false'); active.button.removeAttribute('aria-describedby'); }
    active = null; pinned = false; card.hidden = true;
  };
  const show = pin => {
    if (pin.button.hidden) return;
    clearTimeout(hideTimer);
    if (active !== pin) close();
    active = pin; title.textContent = `${pin.index + 1}. ${definitions[pin.index].title}`;
    description.textContent = definitions[pin.index].text; card.hidden = false;
    pin.button.setAttribute('aria-expanded', 'true'); pin.button.setAttribute('aria-describedby', card.id); positionCard();
  };
  const scheduleClose = () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!pinned && active && !active.button.matches(':focus-visible') && !card.matches(':hover')) close();
    }, 140);
  };
  const makePin = (index, location) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = `as-note-pin as-note-${location}`; button.hidden = true;
    button.setAttribute('data-note', String(index + 1)); button.setAttribute('data-location', location);
    button.setAttribute('aria-label', `${index + 1}: ${definitions[index].title} (${location === 'chat' ? 'chat' : 'timeline'})`);
    button.setAttribute('aria-controls', card.id); button.setAttribute('aria-expanded', 'false');
    const number = document.createElement('span'); number.textContent = String(index + 1); button.appendChild(number);
    const pin = { button, number, index, location, revealed: false, animation: null };
    button.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') show(pin); });
    button.addEventListener('pointerleave', scheduleClose); button.addEventListener('focus', () => show(pin)); button.addEventListener('blur', scheduleClose);
    button.addEventListener('click', event => { event.stopPropagation(); if (active === pin && pinned) close(); else { show(pin); pinned = true; } });
    layer.appendChild(button); return pin;
  };
  const groups = definitions.map((_, index) => ({ chat: makePin(index, 'chat'), editor: makePin(index, 'editor'), row: null, started: false, chatDue: false, due: false, chatTimer: null, editorTimer: null }));
  const reveal = (pin, visible) => {
    pin.button.hidden = !visible;
    if (!visible) { if (active === pin) close(); return; }
    if (pin.revealed) return;
    pin.revealed = true;
    if (!quiet() && typeof pin.number.animate === 'function') pin.animation = pin.number.animate([
      { opacity: 0, transform: 'scale(.6)', boxShadow: '0 0 0 0 rgba(240,198,126,0)' },
      { opacity: 1, transform: 'scale(1.16)', boxShadow: '0 0 0 7px rgba(240,198,126,.24)', offset: .4 },
      { opacity: 1, transform: 'scale(1)', boxShadow: '0 0 0 13px rgba(240,198,126,0)' },
    ], { duration: 850, easing: 'cubic-bezier(.2,.7,.2,1)' });
  };
  const positionPin = (pin, x, y, host) => {
    pin.button.style.left = `${clamp(x - host.left, 12, host.width - 12)}px`;
    pin.button.style.top = `${clamp(y - host.top, 12, host.height - 12)}px`;
  };
  const place = () => {
    const host = root.getBoundingClientRect(), chatBox = msgs.getBoundingClientRect();
    const visible = enabled && isHere() && host.width > 0 && host.height > 0;
    groups.forEach((group, index) => {
      const row = group.row?.isConnected ? group.row.getBoundingClientRect() : null;
      const chatVisible = !!(visible && group.chatDue && row && row.height > 0 && row.top >= chatBox.top - 1 && row.bottom <= chatBox.bottom + 1);
      if (chatVisible) positionPin(group.chat, row.right - 16, row.top + row.height / 2, host);
      reveal(group.chat, chatVisible);
      // The image-row explanation appears as soon as that row starts producing
      // frames, and stays in its centre rather than jumping between thumbnails.
      const target = targets[index];
      const ready = index === 1 ? !!target.parentElement.querySelector('.as-frame-clip.is-ready') : target.classList.contains('is-ready') && target.style.opacity !== '0';
      const editorVisible = visible && group.started && group.due && ready;
      if (editorVisible) {
        const box = (index === 1 ? target.parentElement : target).getBoundingClientRect(), point = definitions[index];
        positionPin(group.editor, box.left + (point.x === .5 ? box.width / 2 : point.x ? box.width - 12 : 12), box.top + (point.y === .5 ? box.height / 2 : point.y ? box.height - 12 : 12), host);
      }
      reveal(group.editor, editorVisible);
    });
    positionCard();
  };
  const sync = () => {
    if (!isHere()) return;
    const rows = [...msgs.querySelectorAll('.as-step')];
    if (!rows.length) { place(); return; }
    enabled = true;
    groups.forEach((group, index) => {
      group.row = rows[index] || null;
      if (!group.row || group.started) return;
      group.started = true;
      if (quiet()) { group.chatDue = group.due = true; return; }
      const visit = generation, ctx = window.deckNav;
      const current = () => generation === visit && enabled && isHere() && ctx?.isCurrent();
      group.chatTimer = window.deckLater(() => {
        group.chatTimer = null;
        if (!current()) return;
        group.chatDue = true; place();
        // Schedule from the chat reveal, not the row insertion, so a late
        // callback cannot collapse both pulses into the same frame.
        group.editorTimer = window.deckLater(() => {
          group.editorTimer = null;
          if (!current()) return;
          group.due = true; place();
        }, EDITOR_MARKER_DELAY, ctx);
      }, CHAT_MARKER_DELAY, ctx);
    });
    place();
  };
  card.addEventListener('pointerenter', () => clearTimeout(hideTimer)); card.addEventListener('pointerleave', scheduleClose);
  card.addEventListener('click', event => event.stopPropagation()); layer.appendChild(card); root.appendChild(layer);
  root.setAttribute('role', 'group'); slide.classList.add('has-demo-notes');
  window.deckOverlay.register({ isOpen: () => active !== null, contains: target => layer.contains(target), close });
  const observer = new ResizeObserver(place); observer.observe(root); observer.observe(msgs); observer.observe(root.querySelector('.as-tl'));
  // Only new top-level rows are observed, not the animated text or our controls.
  const chatObserver = new MutationObserver(sync); chatObserver.observe(msgs, { childList: true });
  msgs.addEventListener('scroll', place, { passive: true });
  window.addEventListener('deck-motion', () => {
    if (!quiet()) return;
    groups.forEach(group => {
      if (group.started) group.chatDue = group.due = true;
      window.deckCancelLater(group.chatTimer); group.chatTimer = null;
      window.deckCancelLater(group.editorTimer); group.editorTimer = null;
      [group.chat, group.editor].forEach(pin => pin.animation?.cancel());
    });
    place();
  });
  return {
    update() { enabled = true; sync(); },
    reset() {
      generation++; enabled = false; close();
      // Discard queued old-row notifications when a visit or tour is retired.
      chatObserver.takeRecords();
      groups.forEach(group => {
        window.deckCancelLater(group.chatTimer); group.chatTimer = null;
        window.deckCancelLater(group.editorTimer); group.editorTimer = null;
        group.row = null; group.started = false; group.chatDue = false; group.due = false;
        [group.chat, group.editor].forEach(pin => { pin.button.hidden = true; pin.revealed = false; pin.animation?.cancel(); pin.animation = null; });
      });
    },
    isOpen: () => active !== null,
  };
};
