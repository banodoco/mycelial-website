// Intro story and shared overlay behaviour. This script runs before scene
// registration: copy, masks and responsive scene geometry see the same nodes.
(() => {
  const stories = [
    {
      selector: '.ac-host',
      html: 'We’re building that place: <em>an agent-powered creative workspace</em> where anyone can unlock their creative potential with <span class="ac-nw">open-source AI.</span>',
    },
    {
      selector: '.as-host',
      html: '<span class="story-intro"><span class="story-title">Meet <a class="as-link" href="https://astrid.haus/" target="_blank" rel="noopener"><em>Astrid.</em></a></span> <span class="story-note"><span>Today, a video editor.</span> <span class="story-roadmap">Next, a fully adaptable creative suite.</span></span></span> <span class="story-description"><span class="story-lead">Start with an idea. Create alongside an agent that puts the open AI community’s models, tools and knowledge to work — <em>in an editor you control.</em></span></span>',
    },
    {
      selector: '.st-host',
      html: '<span class="story-title">And Astrid is <em>yours to shape.</em></span> <span class="story-lead">As you create, you and your agent <em>extend every layer</em> — from your workspace to its tools and models.</span> <span class="story-note">What you share becomes part of a community-built creative platform<span class="story-detail">, ready for others to use and build on</span>.</span>',
    },
    {
      selector: '.pa-host',
      html: 'Nerds run Astrid locally and extend it. Everyone else pays to create with <em>that same growing platform</em> through an accessible hosted version.',
    },
  ];
  const hosts = stories.map((story) => ({ ...story, host: document.querySelector(story.selector) }));
  if (!hosts.some(({ host }) => host)) return;
  if (!document.getElementById('deck-intro-story')) {
    const style = document.createElement('style');
    style.id = 'deck-intro-story';
    style.textContent = `
      /* Scoped story typography; canonical headings remain owned by their scenes. */
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

      /* A narrower two-line introduction leaves more room for the idea and demo. */
      html[data-ver="f"] .as-host.story-refined h1 {
        grid-template-columns: minmax(0, .25fr) minmax(0, .75fr);
        column-gap: clamp(24px, 3.5vw, 50px); align-items: center;
      }
      .story-intro { display: block; min-width: 0; }
      html[data-ver="f"] .as-host.story-refined .story-title {
        font-size: clamp(2.8rem, min(5vw, 7.2vh), 4.4rem);
        line-height: .96; letter-spacing: -.025em; white-space: normal;
      }
      html[data-ver="f"] .as-host.story-refined .story-title .as-link { display: block; width: fit-content; }
      html[data-ver="f"] .as-host.story-refined .story-description { padding-block: .1rem; }
      html[data-ver="f"] .as-host.story-refined .story-lead {
        max-width: 39ch; font-size: clamp(1.4rem, min(2.2vw, 4.2vh), 2.15rem);
        line-height: 1.2; letter-spacing: -.008em; text-wrap: pretty;
      }
      html[data-ver="f"] .as-host.story-refined .story-note {
        margin-top: clamp(12px, 1.8vh, 18px);
        font: 400 clamp(.95rem, min(1.2vw, 2.2vh), 1.15rem)/1.35 "EB Garamond", Georgia, serif;
        color: rgb(184 169 143 / var(--as-copy-alpha, 1)); letter-spacing: 0; text-wrap: pretty;
      }
      .as-host.story-refined .story-note > span { display: block; }
      .as-host.story-refined .story-roadmap { margin-top: .16em; }
      html[data-ver="f"] .as-host.story-refined .as { margin-top: clamp(18px, 2.8vh, 28px); }
      /* Controls sit outside the decorative aria-hidden panels. */
      .as-notes { position: absolute; inset: 0; z-index: 5; pointer-events: none; }
      .as-note-pin {
        position: absolute; display: grid; place-items: center; width: 36px; height: 36px;
        padding: 0; border: 0; background: transparent; color: #f7deb1;
        font: 500 11px/1 "DM Sans", system-ui, sans-serif; cursor: help;
        pointer-events: auto; touch-action: manipulation; transform: translate(-50%, -50%);
      }
      .as-note-pin span {
        display: grid; place-items: center; width: 21px; height: 21px;
        border-radius: 50%; border: 1px solid #b89561; background: #33291f;
        box-shadow: 0 1px 8px #0007;
      }
      .as-note-pin:hover span, .as-note-pin[aria-expanded="true"] span { background: #51402b; border-color: #efd3a2; }
      .as-note-pin:focus-visible { outline: 1px solid #efd3a2; outline-offset: -3px; border-radius: 50%; }
      .as-note-card {
        position: absolute; width: min(290px, calc(100% - 16px)); padding: 14px 16px;
        border: 1px solid #92754c; border-radius: 9px; background: #28221b;
        box-shadow: 0 12px 30px #0007; pointer-events: auto;
        color: #d2c4ae; font: 400 12px/1.5 "DM Sans", system-ui, sans-serif; text-align: left;
      }
      .as-note-card strong { display: block; margin-bottom: 5px; color: #f1d39d; font-weight: 500; font-size: 13px; }
      .as-note-card p { margin: 0; }
      .as-note-pin[hidden], .as-note-card[hidden] { display: none !important; }
      .as-host.has-demo-notes .as-scene-clip .as-name { left: 30px; }
      @media (pointer: coarse) { .as-note-pin { width: 44px; height: 44px; } }
      @media (max-width: 760px) and (orientation: portrait), (max-width: 760px) and (min-height: 501px) {
        html[data-ver="f"] .as-host.story-refined h1 { grid-template-columns: minmax(85px, .3fr) minmax(0, .7fr); column-gap: 18px; row-gap: 0; align-items: start; }
        html[data-ver="f"] .as-host.story-refined .story-title { font-size: clamp(2.1rem, 8.7vw, 3rem); }
        html[data-ver="f"] .as-host.story-refined .story-lead { font-size: clamp(1rem, 4.4vw, 1.4rem); line-height: 1.23; }
        html[data-ver="f"] .as-host.story-refined .story-note { margin-top: 10px; font-size: .88rem; line-height: 1.25; }
        html[data-ver="f"] .as-host.story-refined .as { margin-top: 18px; }
        .as-note-card { padding: 11px 13px; font-size: 11.5px; }
        .as-note-pin span { width: 19px; height: 19px; font-size: 10px; }
      }
      @media (max-width: 760px) and (orientation: portrait) and (max-height: 740px) {
        html[data-ver="f"] .as-host.story-refined .story-title { font-size: 2rem; }
        html[data-ver="f"] .as-host.story-refined .story-lead { font-size: 1rem; }
        html[data-ver="f"] .as-host.story-refined .story-note { margin-top: 8px; font-size: .82rem; }
        html[data-ver="f"] .as-host.story-refined .as { margin-top: 14px; }
      }
      @media (max-height: 500px) and (orientation: landscape) {
        html[data-ver="f"] .as-host.story-refined { padding-top: 34px; }
        html[data-ver="f"] .as-host.story-refined h1 { grid-template-columns: minmax(0, .25fr) minmax(0, .75fr); }
        html[data-ver="f"] .as-host.story-refined .story-title { font-size: clamp(1.8rem, 3.9vw, 2.8rem); }
        html[data-ver="f"] .as-host.story-refined .story-lead { font-size: clamp(1rem, 2.1vw, 1.35rem); line-height: 1.15; }
        html[data-ver="f"] .as-host.story-refined .story-note { margin-top: 7px; font-size: .8rem; }
        html[data-ver="f"] .as-host.story-refined .as { margin-top: 12px; }
      }
      /* Keep slide 7's longer connected story readable beside its diagram. */
      html[data-ver="f"] .pa-host.story-refined h1 { font-size: clamp(1.75rem, 2.65vw, 2.9rem); max-width: 13em; }
      @media (max-width: 760px) and (orientation: portrait) {
        html[data-ver="f"] .pa-host.story-refined h1 { font-size: clamp(1.5rem, 6.5vw, 2.1rem); max-width: 22ch; }
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
      interactive: !!event.target.closest?.('button, a, [role="button"], .fw-card, .fw-full, .fw-ask, .vc, .vc-box, .vc-note, .st-card, .st-flag, .as-note-card') } : null;
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

// Accelerate forward arrivals to slides 7–8 on the shared animation clock.
(function deckStoryPacing(){
  if(typeof window.deckNow!=='function'||window.deckStoryPacing)return;
  const nativeNow=window.deckNow;
  let previous=nativeNow(),elapsed=previous;
  const rate=()=>{
    const ctx=window.deckNav;
    if(!ctx||ctx.direct||ctx.rest||ctx.back||window.deckStill?.()||!ctx.isTransitionCurrent())return 1;
    return ctx.to===6?1.45:ctx.to===7?1.3:1;
  };
  window.deckStoryPacing={rate};
  window.deckNow=()=>{
    const now=nativeNow();
    elapsed+=Math.max(0,now-previous)*rate();
    previous=now;return elapsed;
  };
})();

// Timeline markers sit above the demo's decorative aria-hidden content.
window.createAstridDemoNotes = function createAstridDemoNotes(root,targets){
  const slide=root.closest('.slide');
  const definitions=[
    {title:'Build with extensions',text:'Your agent uses extensions such as Three.js to turn your request into a scene on the timeline.',x:0,y:1},
    {title:'Put open models to work',text:'Your agent works out how to use open models on your machine. Here, Qwen turns the scene into reference images.',x:.5,y:.5},
    {title:'Bring it all together',text:'Your agent combines the scenes, images and motion guides on your timeline into finished creative work. You can keep editing every part.',x:1,y:0},
  ];
  const layer=document.createElement('div');layer.className='as-notes';
  const card=document.createElement('div');card.id='astrid-demo-note';card.className='as-note-card';card.hidden=true;card.setAttribute('role','tooltip');
  const title=document.createElement('strong'),description=document.createElement('p');card.append(title,description);
  let active=-1,pinned=false,hideTimer=0,enabled=false;
  const bounds=(value,low,high)=>Math.max(low,Math.min(high,value));
  const positionCard=()=>{
    if(active<0)return;
    const host=root.getBoundingClientRect(),anchor=pins[active].getBoundingClientRect();
    const width=card.offsetWidth,height=card.offsetHeight;
    card.style.left=`${bounds(anchor.left-host.left+anchor.width/2-width/2,8,host.width-width-8)}px`;
    card.style.top=`${bounds(anchor.top-host.top-height-8,8,host.height-height-8)}px`;
  };
  const close=()=>{
    clearTimeout(hideTimer);hideTimer=0;
    if(active>=0)pins[active].setAttribute('aria-expanded','false');
    active=-1;pinned=false;card.hidden=true;
  };
  const show=(index)=>{
    if(pins[index].hidden)return;
    clearTimeout(hideTimer);
    if(active!==index){close();pinned=false;}
    active=index;title.textContent=`${index+1}. ${definitions[index].title}`;
    description.textContent=definitions[index].text;
    card.hidden=false;pins[index].setAttribute('aria-expanded','true');positionCard();
  };
  const scheduleClose=()=>{
    clearTimeout(hideTimer);
    hideTimer=setTimeout(()=>{
      if(!pinned&&active>=0&&!pins[active].matches(':focus-visible')&&!card.matches(':hover'))close();
    },140);
  };
  const pins=definitions.map((definition,index)=>{
    const button=document.createElement('button');button.type='button';button.className='as-note-pin';button.hidden=true;
    button.setAttribute('aria-label',`${index+1}: ${definition.title}`);
    button.setAttribute('aria-controls',card.id);button.setAttribute('aria-describedby',card.id);button.setAttribute('aria-expanded','false');
    const number=document.createElement('span');number.textContent=String(index+1);button.appendChild(number);
    button.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')show(index);});
    button.addEventListener('pointerleave',scheduleClose);
    button.addEventListener('focus',()=>show(index));
    button.addEventListener('blur',scheduleClose);
    button.addEventListener('click',event=>{event.stopPropagation();if(active===index&&pinned)close();else{show(index);pinned=true;}});
    layer.appendChild(button);return button;
  });
  card.addEventListener('pointerenter',()=>clearTimeout(hideTimer));
  card.addEventListener('pointerleave',scheduleClose);
  card.addEventListener('click',event=>event.stopPropagation());
  layer.appendChild(card);root.appendChild(layer);root.setAttribute('role','group');slide.classList.add('has-demo-notes');
  window.deckOverlay.register({isOpen:()=>active>=0,contains:target=>layer.contains(target),close});
  const place=()=>{
    const host=root.getBoundingClientRect();
    targets.forEach((target,index)=>{
      const visible=enabled&&slide.classList.contains('on')&&!root.classList.contains('is-resetting')&&target.classList.contains('is-ready')&&target.style.opacity!=='0';
      pins[index].hidden=!visible;
      if(!visible){if(active===index)close();return;}
      const box=target.getBoundingClientRect(),point=definitions[index],inset=12;
      const x=point.x===.5?box.width/2:point.x?box.width-inset:inset;
      const y=point.y===.5?box.height/2:point.y?box.height-inset:inset;
      pins[index].style.left=`${bounds(box.left-host.left+x,inset,host.width-inset)}px`;
      pins[index].style.top=`${bounds(box.top-host.top+y,inset,host.height-inset)}px`;
    });
    positionCard();
  };
  const observer=new ResizeObserver(place);observer.observe(root);observer.observe(root.querySelector('.as-tl'));
  return {update(){enabled=true;place();},reset(){enabled=false;close();pins.forEach(pin=>{pin.hidden=true;});},isOpen:()=>active>=0};
};
