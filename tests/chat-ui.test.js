// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { initializeChatUI } from '../chat-ui.js';

const html = readFileSync(resolve('index.html'), 'utf8');
let ui, media, viewport;
const panel = () => document.querySelector('#resumeChat');
const launcher = () => document.querySelector('.chat-launcher');
const close = () => document.querySelector('.chat-close');
function resize(mobile) {
  media.matches = mobile;
  media.dispatchEvent(new Event('change'));
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = html.split('<body id="top">')[1].split('</body>')[0];
  media = new EventTarget();
  media.matches = true;
  vi.stubGlobal('matchMedia', vi.fn(() => media));
  viewport = new EventTarget();
  viewport.height = 844;
  viewport.offsetTop = 0;
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 480 });
  Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{ width: 100, height: 44 }]);
  history.replaceState({}, '', '/');
  vi.spyOn(history, 'back').mockImplementation(() => {
    history.replaceState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  ui = initializeChatUI();
});
afterEach(() => {
  ui?.destroy();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('one responsive chat component', () => {
  it.each([
    { saved: null, systemDark: true, expected: 'dark' },
    { saved: 'light', systemDark: true, expected: 'light' },
    { saved: 'invalid', systemDark: false, expected: 'light' },
  ])('applies saved/system theme preferences: $expected', ({ saved, systemDark, expected }) => {
    const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    new Function('document', 'localStorage', 'matchMedia', bootstrap)(document, { getItem: () => saved }, () => ({ matches: systemDark }));
    expect(document.documentElement.dataset.theme).toBe(expected);
  });

  it('still boots when browser storage is blocked', () => {
    const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    expect(() => new Function('document', 'localStorage', 'matchMedia', bootstrap)(document,
      { getItem: () => { throw new Error('SecurityError'); } }, () => ({ matches: true }))).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('starts hidden on mobile and opens an accessible sheet without network calls', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(panel().hidden).toBe(true);
    launcher().click();
    expect(panel().hidden).toBe(false);
    expect(panel().getAttribute('role')).toBe('dialog');
    expect(panel().getAttribute('aria-modal')).toBe('true');
    expect(launcher().getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('.resume-pane').inert).toBe(true);
    expect(document.activeElement).toBe(close());
    expect(fetch).not.toHaveBeenCalled();
    expect(document.querySelector('#modelNotice').textContent).toContain('resume records');
  });

  it.each(['button', 'scrim', 'Escape', 'Back'])('closes with %s and restores focus and scroll', (method) => {
    launcher().click();
    expect(document.body.style.getPropertyValue('--scroll-lock-top')).toBe('-480px');
    if (method === 'button') close().click();
    if (method === 'scrim') document.querySelector('.chat-scrim').click();
    if (method === 'Escape') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    if (method === 'Back') history.back();
    expect(panel().hidden).toBe(true);
    expect(panel().inert).toBe(true);
    expect(document.activeElement).toBe(launcher());
    expect(document.body.classList.contains('chat-open')).toBe(false);
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 480);
    expect(document.querySelector('.resume-pane').inert).toBe(false);
  });

  it('traps keyboard focus at both ends of the sheet', () => {
    launcher().click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(document.querySelector('.assistant-input button'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(close());
  });

  it('preserves nodes, messages and drafts through close/reopen and breakpoint changes', () => {
    launcher().click();
    const original = panel();
    document.querySelector('.chat-window').append(document.createTextNode('Sujal is a student.'));
    document.querySelector('#chatInput').value = 'draft';
    close().click();
    launcher().click();
    expect(panel()).toBe(original);
    resize(false);
    expect(panel().hidden).toBe(false);
    expect(panel().hasAttribute('aria-modal')).toBe(false);
    expect(document.body.classList.contains('chat-open')).toBe(false);
    resize(true);
    expect(panel().getAttribute('role')).toBe('dialog');
    expect(document.querySelectorAll('#resumeChat')).toHaveLength(1);
    expect(document.querySelectorAll('#chatInput')).toHaveLength(1);
    expect(document.querySelector('.chat-window').textContent).toContain('Sujal is a student.');
    expect(document.querySelector('#chatInput').value).toBe('draft');
  });

  it('keeps a previously closed mobile chat closed after desktop resizing', () => {
    resize(false);
    expect(panel().hidden).toBe(false);
    resize(true);
    expect(panel().hidden).toBe(true);
  });

  it('resizes the sheet above a visual keyboard', () => {
    launcher().click();
    viewport.height = 420;
    viewport.dispatchEvent(new Event('resize'));
    expect(panel().style.getPropertyValue('--chat-viewport-height')).toBe('420px');
    expect(panel().style.getPropertyValue('--chat-keyboard-offset')).toBe('424px');
    expect(panel().dataset.compact).toBe('true');
  });

  it('collapses the launcher label on scroll, open or six seconds', () => {
    vi.advanceTimersByTime(6000);
    expect(launcher().classList.contains('is-compact')).toBe(true);
    launcher().classList.remove('is-compact');
    window.dispatchEvent(new Event('scroll'));
    expect(launcher().classList.contains('is-compact')).toBe(true);
    launcher().classList.remove('is-compact');
    launcher().click();
    expect(launcher().classList.contains('is-compact')).toBe(true);
  });

  it('caps textarea height at four lines', () => {
    const input = document.querySelector('#chatInput');
    Object.defineProperty(input, 'scrollHeight', { configurable: true, value: 240 });
    input.dispatchEvent(new Event('input'));
    expect(input.style.height).toBe('112px');
    expect(input.style.overflowY).toBe('auto');
  });

  it('hides initial suggestions after the first message and shows calm data errors', () => {
    ui.beginMessage();
    expect(document.querySelector('#suggestionList').hidden).toBe(true);
    expect(document.querySelector('.chat-empty')).toBeNull();
    ui.showDataStatus(['available', 'unavailable']);
    expect(document.querySelector('#dataNotice').hidden).toBe(false);
    ui.showDataStatus(['available']);
    expect(document.querySelector('#dataNotice').hidden).toBe(true);
  });

  it('presents download progress and a failed-model fallback notice', () => {
    ui.setProgress({ progress: .43 });
    expect(document.querySelector('progress').value).toBe(43);
    expect(document.querySelector('#modelPercentage').textContent).toBe('43%');
    ui.finish(false);
    expect(document.querySelector('#modelProgress').hidden).toBe(true);
    expect(document.querySelector('#modelNotice').textContent).toContain('resume records');
  });
});
