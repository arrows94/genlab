import type { Action } from 'svelte/action';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard behaviour shared by all dialogs (`use:dialog` on the dialog box):
 * focus moves in when it opens, Tab stays inside, Escape calls `onescape`
 * (dialogs with their own window handler leave it out), and focus returns to
 * where it was when the dialog closes.
 */
export const dialog: Action<HTMLElement, { onescape?: () => void } | undefined> = (node, params) => {
  let onescape = params?.onescape;
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const focusables = () => [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);

  // After the first render, so autofocus inside the dialog (e.g. an OK button) wins.
  queueMicrotask(() => {
    if (node.contains(document.activeElement)) return;
    if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');
    node.focus({ preventScroll: true });
  });

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && onescape) {
      e.preventDefault();
      e.stopPropagation();
      onescape();
      return;
    }
    if (e.key !== 'Tab') return;
    const list = focusables();
    if (list.length === 0) {
      e.preventDefault();
      return;
    }
    const first = list[0]!;
    const last = list[list.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === node)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }
  node.addEventListener('keydown', onKey);

  return {
    update(next) {
      onescape = next?.onescape;
    },
    destroy() {
      node.removeEventListener('keydown', onKey);
      // Back to the button that opened the dialog, if it is still on the page.
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    },
  };
};
