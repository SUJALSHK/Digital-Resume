// Presentation only: this module has no model, retrieval or Supabase imports.
export function initializeChatUI() {
  const panel = document.querySelector('#resumeChat');
  const launcher = document.querySelector('.chat-launcher');
  const closeButton = document.querySelector('.chat-close');
  const scrim = document.querySelector('.chat-scrim');
  const input = document.querySelector('#chatInput');
  const resume = document.querySelector('.resume-pane');
  const header = document.querySelector('.topbar');
  const media = matchMedia('(max-width: 1023px)');
  const notice = document.querySelector('#modelNotice');
  const progress = document.querySelector('#modelProgress');
  const progressBar = progress.querySelector('progress');
  const percentage = document.querySelector('#modelPercentage');
  const historyKey = '__sujalResumeChat';
  const controller = new AbortController();
  const options = { signal: controller.signal };
  let isOpen = false;
  let scrollPosition = 0;
  let locked = false;
  let downloadStarted = false;

  const compactLauncher = () => launcher.classList.add('is-compact');
  const compactTimer = setTimeout(compactLauncher, 6000);
  window.addEventListener('scroll', compactLauncher, { ...options, once: true, passive: true });

  function resizeInput() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(112, Math.max(44, input.scrollHeight))}px`;
    input.style.overflowY = input.scrollHeight > 112 ? 'auto' : 'hidden';
  }
  input.addEventListener('input', resizeInput, options);

  function viewportChanged() {
    const viewport = window.visualViewport;
    if (!viewport || !media.matches || !isOpen) return;
    panel.style.setProperty('--chat-viewport-height', `${viewport.height}px`);
    panel.style.setProperty('--chat-keyboard-offset', `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`);
  }

  function lockScroll() {
    if (locked) return;
    scrollPosition = window.scrollY;
    document.body.style.setProperty('--scroll-lock-top', `${-scrollPosition}px`);
    document.body.classList.add('chat-open');
    locked = true;
  }
  function unlockScroll() {
    if (!locked) return;
    document.body.classList.remove('chat-open');
    document.body.style.removeProperty('--scroll-lock-top');
    const oldBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, scrollPosition);
    document.documentElement.style.scrollBehavior = oldBehavior;
    locked = false;
  }

  function updateLayout() {
    const modal = media.matches && isOpen;
    panel.hidden = media.matches && !isOpen;
    panel.inert = panel.hidden;
    closeButton.hidden = !media.matches;
    launcher.setAttribute('aria-expanded', String(modal));
    scrim.hidden = !modal;
    resume.inert = modal;
    header.inert = modal;
    if (modal) {
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      lockScroll();
      viewportChanged();
    } else {
      panel.removeAttribute('role');
      panel.removeAttribute('aria-modal');
      unlockScroll();
      panel.style.removeProperty('--chat-viewport-height');
      panel.style.removeProperty('--chat-keyboard-offset');
    }
    if (panel.hidden && panel.contains(document.activeElement)) launcher.focus({ preventScroll: true });
    if (!media.matches && document.activeElement === closeButton) input.focus({ preventScroll: true });
    if (modal && !panel.contains(document.activeElement)) closeButton.focus({ preventScroll: true });
  }

  function open() {
    if (!media.matches || isOpen) return;
    compactLauncher();
    isOpen = true;
    // The site has no client router. One same-URL entry makes browser Back
    // close the sheet, without remounting either the chat or the engine.
    if (!history.state?.[historyKey]) history.pushState({ ...history.state, [historyKey]: true }, '', location.href);
    updateLayout();
    closeButton.focus({ preventScroll: true });
  }
  function close(fromHistory = false) {
    if (!isOpen) return;
    isOpen = false;
    input.blur();
    updateLayout();
    if (media.matches) launcher.focus({ preventScroll: true });
    if (!fromHistory && history.state?.[historyKey]) history.back();
  }

  launcher.addEventListener('click', open, options);
  closeButton.addEventListener('click', () => close(), options);
  scrim.addEventListener('click', () => close(), options);
  window.addEventListener('popstate', () => {
    if (history.state?.[historyKey]) {
      isOpen = true;
      updateLayout();
      if (media.matches) closeButton.focus({ preventScroll: true });
    } else close(true);
  }, options);
  media.addEventListener('change', updateLayout, options);
  window.visualViewport?.addEventListener('resize', viewportChanged, options);
  window.visualViewport?.addEventListener('scroll', viewportChanged, options);
  window.addEventListener('resize', viewportChanged, options);
  document.addEventListener('keydown', (event) => {
    if (!media.matches || !isOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      const controls = [...panel.querySelectorAll('a[href], button:not([disabled]), textarea, input, [tabindex="0"]')]
        .filter((element) => element.getClientRects().length && !element.closest('[hidden]'));
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); panel.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    }
  }, options);

  if (!navigator.gpu) notice.textContent = 'On-device AI is unavailable in this browser. You can still ask questions using his resume records.';
  updateLayout();
  window.addEventListener('pagehide', () => clearTimeout(compactTimer), { ...options, once: true });

  return {
    destroy() { controller.abort(); clearTimeout(compactTimer); unlockScroll(); },
    resizeInput,
    beginMessage() {
      document.querySelector('.chat-empty')?.remove();
      document.querySelector('#suggestionList').hidden = true;
    },
    setProgress(value) {
      downloadStarted = true;
      notice.hidden = true;
      progress.hidden = false;
      const number = Math.round(Math.min(1, Math.max(0, Number(value?.progress) || 0)) * 100);
      progressBar.value = number;
      percentage.textContent = `${number}%`;
    },
    finish(modelReady) {
      resizeInput();
      if (!downloadStarted) return;
      progress.hidden = true;
      notice.hidden = false;
      notice.textContent = modelReady ? 'Model ready. Answers stay in your browser.'
        : 'On-device AI could not start. Answers use his resume records.';
      downloadStarted = false;
    },
    showDataStatus(statuses) {
      const dataNotice = document.querySelector('#dataNotice');
      dataNotice.hidden = !statuses.includes('unavailable');
      dataNotice.textContent = dataNotice.hidden ? '' : 'Some resume data could not be loaded. Using saved resume details where available.';
    },
  };
}
