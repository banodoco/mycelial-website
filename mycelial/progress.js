// Still previews keep the progress navigator useful before a slide has been visited,
// without starting another scene or copying its live canvases and interactive DOM.
window.installDeckProgress = ({ slides, go, current }) => {
  const bar = document.querySelector('.bar');
  const targets = document.createElement('div');
  targets.className = 'progress-targets';
  targets.setAttribute('role', 'group');
  targets.setAttribute('aria-label', 'Choose a slide');
  const preview = document.createElement('button');
  preview.type = 'button';
  preview.id = 'slide-preview';
  preview.className = 'progress-preview';
  preview.hidden = true;
  const picture = document.createElement('img');
  picture.alt = '';
  picture.decoding = 'async';
  const caption = document.createElement('span');
  preview.append(picture, caption);
  document.body.append(preview);
  let shown = -1, armed = -1, closeTimer = null, touch = false;
  const titles = slides.map((slide) => slide.querySelector('.act')?.textContent.trim() || slide.querySelector('h1').textContent.trim());
  const cancelClose = () => clearTimeout(closeTimer);
  const hide = () => {
    cancelClose();
    preview.hidden = true;
    buttons.forEach((button) => button.setAttribute('aria-expanded', 'false'));
    shown = armed = -1;
  };
  const leave = () => {
    cancelClose();
    closeTimer = setTimeout(() => {
      if (document.activeElement === buttons[shown] || preview.contains(document.activeElement)) return;
      hide();
    }, 160);
  };
  const show = (index) => {
    cancelClose();
    if (shown !== index) {
      picture.style.opacity = '0'; // never flash the previous slide while this image loads
      picture.src = `previews/slide-${index + 1}.jpg`;
    }
    shown = index;
    caption.textContent = `${index + 1} / ${slides.length} · ${titles[index]}`;
    preview.setAttribute('aria-label', `Go to slide ${index + 1}: ${titles[index]}`);
    buttons.forEach((button, k) => button.setAttribute('aria-expanded', String(k === index)));
    preview.hidden = false;
    const bounds = buttons[index].getBoundingClientRect();
    const width = preview.getBoundingClientRect().width;
    preview.style.left = `${Math.max(12, Math.min(innerWidth - width - 12, bounds.left + bounds.width / 2 - width / 2))}px`;
    preview.style.bottom = `${innerHeight - bar.getBoundingClientRect().top + 24}px`;
  };
  picture.addEventListener('load', () => { picture.style.opacity = '1'; });
  picture.addEventListener('error', () => { picture.style.opacity = '0'; });
  const jump = (index) => {
    if (document.activeElement === preview) buttons[index].focus();
    hide(); go(index);
  };
  const buttons = slides.map((slide, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'progress-stop';
    button.setAttribute('aria-label', `Slide ${index + 1}: ${titles[index]}`);
    button.setAttribute('aria-controls', preview.id);
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('pointerdown', (event) => { touch = event.pointerType === 'touch'; });
    button.addEventListener('pointerenter', (event) => { if (event.pointerType !== 'touch') { touch = false; show(index); } });
    button.addEventListener('pointerleave', (event) => { if (event.pointerType !== 'touch') leave(); });
    button.addEventListener('focus', () => { if (!touch) show(index); });
    button.addEventListener('click', () => {
      if (touch && armed !== index) { show(index); armed = index; }
      else jump(index);
    });
    button.addEventListener('keydown', (event) => {
      touch = false;
      // Horizontal arrows keep the deck's normal navigation, even after a bar click.
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { hide(); return; }
      if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        const next = Math.max(0, Math.min(slides.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
        buttons.forEach((item, k) => { item.tabIndex = k === next ? 0 : -1; });
        buttons[next].focus(); show(next);
      } else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); hide(); }
      else if ([' ', 'Enter'].includes(event.key)) event.stopPropagation();
    });
    return button;
  });
  targets.append(...buttons);
  bar.append(targets);
  preview.addEventListener('pointerenter', cancelClose);
  preview.addEventListener('pointerleave', (event) => { if (event.pointerType !== 'touch') leave(); });
  preview.addEventListener('focus', cancelClose);
  preview.addEventListener('click', () => { if (shown >= 0) jump(shown); });
  preview.addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { hide(); return; }
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation();
      buttons[shown >= 0 ? shown : current()].focus(); hide();
    } else if ([' ', 'Enter'].includes(event.key)) event.stopPropagation();
  });
  document.addEventListener('keydown', () => { touch = false; }, { capture: true });
  document.addEventListener('pointerdown', (event) => { if (!bar.contains(event.target) && !preview.contains(event.target)) hide(); });
  document.addEventListener('focusin', (event) => { if (!bar.contains(event.target) && !preview.contains(event.target)) hide(); });
  let viewport = `${innerWidth}x${innerHeight}`;
  addEventListener('resize', () => {
    const next = `${innerWidth}x${innerHeight}`;
    if (next === viewport) return;
    viewport = next; hide();
  });
  addEventListener('deck-overview', hide);
  const update = (index) => {
    hide();
    buttons.forEach((button, k) => {
      button.tabIndex = k === index ? 0 : -1;
      if (k === index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  };
  update(current());
  return { update };
};
