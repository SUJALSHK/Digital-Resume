// Infinite project carousel. The track holds the real slides followed by hidden
// clones of every slide; after sliding into the clones it snaps back by one set
// without a transition, which is visually identical.
export const CAROUSEL_TIMING = { interval: 1000, duration: 450, swipeThreshold: 48 };

const icons = {
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12" /></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5L8 5.5Z" /></svg>',
};

export function initializeProjectCarousel(root = document.querySelector('[data-carousel]'), timing = CAROUSEL_TIMING) {
  const track = root?.querySelector('.project-list');
  if (!track) return null;
  const viewport = root.querySelector('.carousel-viewport');
  const toggle = root.querySelector('.carousel-toggle');
  const prevButton = root.querySelector('.carousel-prev');
  const nextButton = root.querySelector('.carousel-next');
  const dotList = root.querySelector('.carousel-dots');
  const slides = [...track.children];
  const count = slides.length;
  const controller = new AbortController();
  const { signal } = controller;
  const reasons = new Set();
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let index = 0, animating = false, timer, settleTimer, intersection, drag = null, suppressClick = false;

  slides.forEach((slide, i) => {
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `${i + 1} of ${count}`);
  });
  slides.forEach((slide) => {
    const clone = slide.cloneNode(true);
    clone.classList.add('is-clone');
    clone.removeAttribute('aria-label');
    // A clone can rest in view beside the last slide, so it stays clickable but
    // is hidden from assistive technology and the tab order.
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('a, button').forEach((control) => control.setAttribute('tabindex', '-1'));
    track.append(clone);
  });
  dotList.innerHTML = slides.map((slide, i) => `<button type="button" aria-label="Show project ${i + 1}: ${slide.querySelector('h3')?.textContent ?? ''}"></button>`).join('');
  const dots = [...dotList.children];

  function render() {
    track.style.setProperty('--index', index);
    dots.forEach((dot, i) => {
      if (i === ((index % count) + count) % count) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  }

  function jumpTo(target) {
    track.classList.add('no-transition');
    index = target;
    render();
    void track.offsetWidth;
    track.classList.remove('no-transition');
  }

  function settle() {
    animating = false;
    if (index >= count) jumpTo(index - count);
  }

  function goTo(target) {
    if (animating || target === index) return;
    animating = true;
    index = target;
    render();
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, timing.duration + 30);
    schedule();
  }

  const next = () => goTo(index + 1);
  function prev() {
    if (animating) return;
    if (index === 0) jumpTo(count);
    goTo(index - 1);
  }

  function schedule() {
    clearTimeout(timer);
    if (!reasons.size) timer = setTimeout(next, timing.interval);
  }

  function updateState() {
    const rotating = reasons.size === 0;
    track.setAttribute('aria-live', rotating ? 'off' : 'polite');
    const userPaused = reasons.has('user') || reasons.has('motion');
    toggle.innerHTML = userPaused ? icons.play : icons.pause;
    toggle.setAttribute('aria-label', userPaused ? 'Start automatic project rotation' : 'Pause automatic project rotation');
    root.dataset.rotating = String(rotating);
    schedule();
  }

  function pause(reason) {
    if (reasons.has(reason)) return;
    reasons.add(reason);
    updateState();
  }

  function resume(reason) {
    if (!reasons.delete(reason)) return;
    updateState();
  }

  toggle.addEventListener('click', () => {
    if (reasons.has('user') || reasons.has('motion')) {
      reasons.delete('motion');
      reasons.delete('user');
      updateState();
    } else pause('user');
  }, { signal });
  prevButton.addEventListener('click', prev, { signal });
  nextButton.addEventListener('click', next, { signal });
  dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i), { signal }));

  root.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') pause('hover'); }, { signal });
  root.addEventListener('pointerleave', (event) => { if (event.pointerType === 'mouse') resume('hover'); }, { signal });

  // Keyboard focus pauses rotation, except on the rotation control itself so its
  // Start action can take effect. A focused slide outside the viewport is shown.
  root.addEventListener('focusin', (event) => {
    let keyboard = true;
    try { keyboard = event.target.matches(':focus-visible'); } catch { /* Older engines. */ }
    if (!keyboard || event.target === toggle) return resume('focus');
    pause('focus');
    const slide = slides.findIndex((item) => item.contains(event.target));
    if (slide === -1) return;
    const bounds = viewport.getBoundingClientRect(), card = slides[slide].getBoundingClientRect();
    if (card.left < bounds.left - 1 || card.right > bounds.right + 1) {
      animating = false;
      goTo(slide);
    }
  }, { signal });
  root.addEventListener('focusout', (event) => {
    if (!root.contains(event.relatedTarget)) resume('focus');
  }, { signal });
  // Focus can scroll an overflow container; the transform is the only offset.
  viewport.addEventListener('scroll', () => { viewport.scrollLeft = 0; }, { signal });

  viewport.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' || !event.isPrimary) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, active: false };
  }, { signal });
  viewport.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.active) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { drag = null; return; }
      if (Math.abs(dx) < 10 || animating) return;
      drag.active = true;
      pause('drag');
      track.classList.add('is-dragging');
      viewport.setPointerCapture?.(event.pointerId);
    }
    drag.dx = dx;
    track.style.setProperty('--drag', `${dx}px`);
  }, { signal });
  function endDrag() {
    if (!drag) return;
    const { active, dx } = drag;
    drag = null;
    if (!active) return;
    suppressClick = true;
    track.classList.remove('is-dragging');
    track.style.setProperty('--drag', '0px');
    if (dx <= -timing.swipeThreshold) next();
    else if (dx >= timing.swipeThreshold) prev();
    resume('drag');
    setTimeout(() => { suppressClick = false; }, 0);
  }
  viewport.addEventListener('pointerup', endDrag, { signal });
  viewport.addEventListener('pointercancel', endDrag, { signal });
  viewport.addEventListener('click', (event) => {
    if (suppressClick) event.preventDefault();
  }, { capture: true, signal });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause('hidden');
    else resume('hidden');
  }, { signal });
  if (motion) {
    if (motion.matches) reasons.add('motion');
    motion.addEventListener?.('change', (event) => {
      if (event.matches) pause('motion');
      else resume('motion');
    }, { signal });
  }
  if ('IntersectionObserver' in window) {
    intersection = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return pause('offscreen');
      // Slides outside the viewport are clipped, so lazy images would load mid-slide.
      track.querySelectorAll('img[loading="lazy"]').forEach((image) => { image.loading = 'eager'; });
      resume('offscreen');
    }, { rootMargin: '200px 0px' });
    intersection.observe(root);
  }
  if (document.hidden) reasons.add('hidden');

  render();
  updateState();

  return {
    next, prev, goTo,
    get index() { return index; },
    get paused() { return reasons.size > 0; },
    destroy() {
      controller.abort();
      intersection?.disconnect();
      clearTimeout(timer);
      clearTimeout(settleTimer);
    },
  };
}
