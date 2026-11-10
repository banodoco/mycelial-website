// Intro story and shared overlay behaviour. This script runs before scene
// registration: copy, masks and responsive scene geometry see the same nodes.
(() => {
  const stories = [
    {
      selector: '.ac-host',
      html: 'We’re building that place: <em>an agent-powered creative workspace</em> where anyone can create with the power of <span class="ac-nw">open-source AI.</span>',
    },
    {
      selector: '.as-host',
      html: '<span class="story-title">Meet <a class="as-link" href="https://astrid.haus/" target="_blank" rel="noopener"><em>Astrid.</em></a></span> <span class="story-description"><span class="story-lead">Start with an idea, and create alongside an agent that puts the open AI community’s models, tools and knowledge to work — <em>in an editor you control.</em></span> <span class="story-note"><span class="story-video">We start with video.</span><span class="story-detail"> Astrid finds and combines the right models and workflows, bringing the results onto a timeline you can shape yourself.</span></span></span>',
    },
    {
      selector: '.st-host',
      html: '<span class="story-title">And Astrid is <em>yours to shape.</em></span> <span class="story-lead">As you create, you and your agent <em>extend every layer</em> — from the editor to the tools and models underneath.</span> <span class="story-note">What you build can become part of a community-built creative platform<span class="story-detail">, ready for others to use and build upon</span>.</span>',
    },
  ];
  const hosts = stories.map((story) => ({ ...story, host: document.querySelector(story.selector) }));
  if (!hosts.some(({ host }) => host)) return;
  if (!document.getElementById('deck-intro-story')) {
    const style = document.createElement('style');
    style.id = 'deck-intro-story';
    style.textContent = `
      /* Scoped to slides 4–6. The original scenes and their lifetimes are untouched. */
      html[data-ver="f"] .story-refined h1 { font-weight: 400; }
      html[data-ver="f"] .story-refined .body[hidden] { display: none !important; }
      html[data-ver="f"] .ac-host.story-refined h1 {
        max-width: 20em; font-size: clamp(1.9rem, 3.5vw, 3.5rem);
        line-height: 1.11; text-wrap: balance;
      }
      html[data-ver="f"] .as-host.story-refined {
        padding-inline: max(24px, 7vw); text-align: left;
      }
      html[data-ver="f"] .as-host.story-refined > .split { width: 100%; }
      html[data-ver="f"] .as-host.story-refined .as-copy { width: min(1180px, 100%); }
      html[data-ver="f"] .as-host.story-refined h1 {
        display: grid; grid-template-columns: minmax(0, .38fr) minmax(0, .62fr);
        column-gap: clamp(28px, 4vw, 60px); align-items: start;
        width: 100%; max-width: none; margin: 0; text-wrap: initial;
      }
      .story-refined .story-title, .story-refined .story-description,
      .story-refined .story-lead, .story-refined .story-note { display: block; }
      html[data-ver="f"] .as-host.story-refined .story-title {
        font-size: clamp(3.5rem, min(6vw, 10.5vh), 5.5rem);
        line-height: 1.03; letter-spacing: -.025em; white-space: nowrap;
      }
      html[data-ver="f"] .as-host.story-refined .story-description { padding-top: .15rem; }
      html[data-ver="f"] .as-host.story-refined .story-lead {
        font-size: clamp(1.4rem, min(2.1vw, 4.25vh), 2.1rem);
        line-height: 1.18; letter-spacing: -.008em; text-wrap: pretty;
      }
      html[data-ver="f"] .as-host.story-refined .story-note {
        margin-top: clamp(12px, 2vh, 20px);
        font: 400 clamp(1rem, min(1.35vw, 2.5vh), 1.25rem)/1.42 "EB Garamond", Georgia, serif;
        color: rgb(184 169 143 / var(--as-copy-alpha, 1));
        letter-spacing: 0; text-wrap: pretty;
      }
      html[data-ver="f"] .as-host.story-refined .as { margin-top: clamp(22px, 3.5vh, 34px); }
      html[data-ver="f"] .st-host.story-refined > .split { grid-template-columns: minmax(0, 36vw); }
      html[data-ver="f"] .st-host.story-refined h1 { max-width: none; text-wrap: initial; }
      html[data-ver="f"] .st-host.story-refined .story-title {
        max-width: none; font-size: clamp(2.4rem, 4.1vw, 4rem);
        line-height: 1.06; letter-spacing: -.015em; text-wrap: balance;
      }
      html[data-ver="f"] .st-host.story-refined .story-title em { display: block; }
      html[data-ver="f"] .st-host.story-refined .story-lead {
        margin-top: clamp(18px, 2.7vh, 28px);
        font-size: clamp(1.3rem, 2vw, 1.8rem); line-height: 1.25;
        letter-spacing: 0; text-wrap: pretty;
      }
      html[data-ver="f"] .st-host.story-refined .story-note {
        margin-top: clamp(14px, 2.3vh, 23px);
        font: 400 clamp(1rem, 1.35vw, 1.25rem)/1.45 "EB Garamond", Georgia, serif;
        color: var(--soft); letter-spacing: 0; text-wrap: pretty;
      }
      /* Keep the demo readable on phones; the optional explanation yields to the picture. */
      @media (max-width: 760px) and (orientation: portrait), (max-width: 760px) and (min-height: 501px) {
        html[data-ver="f"] .as-host.story-refined { padding-inline: 24px; }
        html[data-ver="f"] .as-host.story-refined h1 { grid-template-columns: minmax(0, 1fr); row-gap: 14px; }
        html[data-ver="f"] .as-host.story-refined .story-title { font-size: clamp(2.6rem, 11vw, 3.4rem); }
        html[data-ver="f"] .as-host.story-refined .story-description { padding-top: 0; }
        html[data-ver="f"] .as-host.story-refined .story-lead { font-size: clamp(1.2rem, 5.2vw, 1.5rem); line-height: 1.2; }
        html[data-ver="f"] .as-host.story-refined .story-note { margin-top: 10px; font-size: 1rem; }
        html[data-ver="f"] .as-host.story-refined .story-detail { display: none; }
        html[data-ver="f"] .as-host.story-refined .as { margin-top: 20px; }
        html[data-ver="f"] .ac-host.story-refined h1 { font-size: clamp(1.65rem, 6.7vw, 2rem); }
      }
      /* Match the stack scene's upright layout breakpoints so it measures all of the copy. */
      @media (max-width: 760px) and (orientation: portrait), (max-width: 760px) and (min-height: 501px),
             (max-width: 1100px) and (orientation: portrait), (max-width: 1100px) and (min-height: 650px) {
        html[data-ver="f"] .st-host.story-refined > .split { grid-template-columns: minmax(0, 1fr); }
        html[data-ver="f"] .st-host.story-refined h1 { max-width: 34rem; }
        html[data-ver="f"] .st-host.story-refined .story-title { max-width: 22ch; font-size: clamp(1.9rem, 7.8vw, 2.5rem); }
        html[data-ver="f"] .st-host.story-refined .story-lead { margin-top: 14px; font-size: clamp(1.15rem, 4.8vw, 1.4rem); line-height: 1.2; }
        html[data-ver="f"] .st-host.story-refined .story-note { margin-top: 12px; font-size: 1rem; line-height: 1.3; }
      }
      @media (max-width: 760px) and (orientation: portrait) and (max-height: 740px) {
        html[data-ver="f"] .as-host.story-refined h1 { row-gap: 10px; }
        html[data-ver="f"] .as-host.story-refined .story-title { font-size: 2.2rem; }
        html[data-ver="f"] .as-host.story-refined .story-lead { font-size: 1.1rem; }
        html[data-ver="f"] .as-host.story-refined .story-note { margin-top: 8px; }
        html[data-ver="f"] .as-host.story-refined .as { margin-top: 16px; }
        html[data-ver="f"] .st-host.story-refined .story-title { font-size: 1.75rem; }
        html[data-ver="f"] .st-host.story-refined .story-lead { margin-top: 10px; font-size: 1.05rem; }
        html[data-ver="f"] .st-host.story-refined .story-note { margin-top: 8px; font-size: .95rem; }
        html[data-ver="f"] .st-host.story-refined .story-detail { display: none; }
      }
      /* Short landscape windows need air for the editor, not oversized type. */
      @media (max-height: 500px) and (orientation: landscape) {
        html[data-ver="f"] .as-host.story-refined { padding-top: 34px; }
        html[data-ver="f"] .as-host.story-refined .story-title { font-size: clamp(2rem, 5vw, 3.2rem); }
        html[data-ver="f"] .as-host.story-refined .story-lead { font-size: clamp(1rem, 2.1vw, 1.35rem); line-height: 1.15; }
        html[data-ver="f"] .as-host.story-refined .story-note { margin-top: 8px; font-size: .9rem; }
        html[data-ver="f"] .as-host.story-refined .story-detail { display: none; }
        html[data-ver="f"] .as-host.story-refined .as { margin-top: 16px; }
        html[data-ver="f"] .st-host.story-refined .story-title { font-size: clamp(1.8rem, 3.6vw, 2.5rem); }
        html[data-ver="f"] .st-host.story-refined .story-lead { margin-top: 12px; font-size: 1.05rem; }
        html[data-ver="f"] .st-host.story-refined .story-note { margin-top: 10px; font-size: .9rem; }
      }
    `;
    document.head.appendChild(style);
  }
  for (const { host, html } of hosts) {
    if (!host || host.classList.contains('story-refined')) continue;
    const heading = host.querySelector('h1');
    if (!heading) continue;
    // Preserve the canonical h1 and copy-column elements; scene setup retains them.
    // Keeping the complete story inside h1 also keeps Stack's mobile text bounds correct.
    heading.innerHTML = html;
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

  window.addEventListener('click', (event) => {
    const entry = active();
    if (!entry || contains(entry, event)) return;
    close(entry, 'outside', event);
    event.preventDefault();
    event.stopPropagation();
  }, true);

  window.addEventListener('keydown', (event) => {
    const entry = active();
    if (!entry) return;
    if (event.key === 'Escape') {
      close(entry, 'escape', event);
      event.preventDefault();
      event.stopPropagation();
    } else if (navigationKeys.has(event.key)) {
      close(entry, 'navigation', event); // Let the deck receive the same key and navigate.
    }
  }, true);

  let touch = null;
  window.addEventListener('touchstart', (event) => {
    const point = event.touches[0];
    touch = point ? { x: point.clientX, y: point.clientY,
      interactive: !!event.target.closest?.('button, a, [role="button"], .fw-card, .fw-full, .fw-ask, .vc, .vc-box, .vc-note, .st-card, .st-flag') } : null;
  }, { capture: true, passive: true });
  window.addEventListener('touchend', (event) => {
    if (!touch) return;
    const point = event.changedTouches[0], start = touch;
    touch = null;
    if (!point || start.interactive) return;
    const dx = point.clientX - start.x, dy = point.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > 1.5 * Math.abs(dy)) close(active(), 'navigation', event); // Same threshold as deck swipe; do not consume it.
  }, { capture: true, passive: true });
})();
