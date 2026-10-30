// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { initializeProjectCarousel, CAROUSEL_TIMING } from '../project-carousel.js';

const html = readFileSync(resolve('index.html'), 'utf8');
const section = html.match(/<section class="resume-section project-carousel"[\s\S]*?<\/section>/)[0];
const { interval, duration } = CAROUSEL_TIMING;
let carousel, motion;
const root = () => document.querySelector('[data-carousel]');
const track = () => document.querySelector('.project-list');
const pointer = (type, props = {}) => Object.assign(new Event(type, { bubbles: true }), { pointerType: 'mouse', isPrimary: true, pointerId: 1, ...props });

function setup({ reducedMotion = false } = {}) {
  document.body.innerHTML = section;
  track().innerHTML = ['Alpha', 'Beta', 'Gamma', 'Delta']
    .map((title) => `<div class="project-card"><h3>${title}</h3><a href="https://example.com/${title}">Live site</a></div>`).join('');
  motion = new EventTarget();
  motion.matches = reducedMotion;
  vi.stubGlobal('matchMedia', vi.fn(() => motion));
  carousel = initializeProjectCarousel();
}
const tick = (ms = interval) => vi.advanceTimersByTime(ms);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  carousel?.destroy();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('project carousel', () => {
  it('advances every 1000ms and loops back to the first project without a visible jump', () => {
    setup();
    expect(interval).toBe(1000);
    const indices = [];
    for (let i = 0; i < 4; i += 1) { tick(); indices.push(carousel.index); }
    // Index 4 is the clone of the first project; it snaps back once the slide ends.
    expect(indices).toEqual([1, 2, 3, 4]);
    tick(duration + 30);
    expect(carousel.index).toBe(0);
    expect(track().classList.contains('no-transition')).toBe(false);
    tick(interval - duration - 30);
    expect(carousel.index).toBe(1);
    expect(document.querySelector('.carousel-dots [aria-current]').getAttribute('aria-label')).toContain('Beta');
  });

  it('renders hidden, untabbable clones and labelled slides', () => {
    setup();
    const clones = track().querySelectorAll('.is-clone');
    expect(clones).toHaveLength(4);
    clones.forEach((clone) => {
      expect(clone.getAttribute('aria-hidden')).toBe('true');
      expect(clone.querySelector('a').getAttribute('tabindex')).toBe('-1');
    });
    expect(track().children[0].getAttribute('aria-roledescription')).toBe('slide');
    expect(track().children[0].getAttribute('aria-label')).toBe('1 of 4');
    expect(document.querySelectorAll('.carousel-dots button')).toHaveLength(4);
  });

  it('pauses on mouse hover and resumes when the pointer leaves', () => {
    setup();
    root().dispatchEvent(pointer('pointerenter'));
    tick(interval * 3);
    expect(carousel.index).toBe(0);
    expect(track().getAttribute('aria-live')).toBe('polite');
    root().dispatchEvent(pointer('pointerleave'));
    tick();
    expect(carousel.index).toBe(1);
    expect(track().getAttribute('aria-live')).toBe('off');
  });

  it('pauses while focus is inside the carousel and while the tab is hidden', () => {
    setup();
    document.querySelector('.carousel-next').focus();
    tick(interval * 2);
    expect(carousel.index).toBe(0);
    document.querySelector('.carousel-next').blur();
    tick();
    expect(carousel.index).toBe(1);

    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    tick(interval * 3);
    expect(carousel.index).toBe(1);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    tick();
    expect(carousel.index).toBe(2);
  });

  it('wraps backwards from the first project and ignores clicks mid-transition', () => {
    setup();
    document.querySelector('.carousel-prev').click();
    expect(carousel.index).toBe(3);
    document.querySelector('.carousel-next').click();
    expect(carousel.index).toBe(3);
    tick(duration + 30);
    document.querySelector('.carousel-next').click();
    tick(duration + 30);
    expect(carousel.index).toBe(0);
  });

  it('does not rotate under reduced motion until the visitor presses play', () => {
    setup({ reducedMotion: true });
    const toggle = document.querySelector('.carousel-toggle');
    tick(interval * 3);
    expect(carousel.index).toBe(0);
    expect(toggle.getAttribute('aria-label')).toBe('Start automatic project rotation');
    toggle.click();
    tick();
    expect(carousel.index).toBe(1);
    toggle.click();
    expect(toggle.getAttribute('aria-label')).toBe('Start automatic project rotation');
    tick(interval * 3);
    expect(carousel.index).toBe(1);
  });

  it('follows a horizontal touch swipe and suppresses the click that ends it', () => {
    setup();
    const viewport = document.querySelector('.carousel-viewport');
    viewport.dispatchEvent(pointer('pointerdown', { pointerType: 'touch', clientX: 300, clientY: 100 }));
    viewport.dispatchEvent(pointer('pointermove', { pointerType: 'touch', clientX: 260, clientY: 102 }));
    expect(track().classList.contains('is-dragging')).toBe(true);
    viewport.dispatchEvent(pointer('pointermove', { pointerType: 'touch', clientX: 200, clientY: 102 }));
    viewport.dispatchEvent(pointer('pointerup', { pointerType: 'touch', clientX: 200, clientY: 102 }));
    expect(carousel.index).toBe(1);
    expect(track().style.getPropertyValue('--drag')).toBe('0px');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    track().querySelector('a').dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
  });

  it('cleans up timers and listeners on destroy', () => {
    setup();
    carousel.next();
    carousel.destroy();
    expect(vi.getTimerCount()).toBe(0);
    document.querySelector('.carousel-next').click();
    tick(interval * 2);
    expect(carousel.index).toBe(1);
  });
});
