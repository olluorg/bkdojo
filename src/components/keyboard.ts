import type { KeyboardEvent } from 'react';

/**
 * Returns an `onKeyDown` handler that fires `submit` on Cmd/Ctrl+Enter — the
 * conventional "send" shortcut for a multi-line input. Used by the answer cards
 * so a typing-heavy daily session doesn't require reaching for the mouse.
 */
export function onCmdEnter(submit: () => void) {
  return (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };
}

/** Platform-appropriate label for the submit shortcut. */
export const SUBMIT_HINT =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
    ? '⌘ + Enter'
    : 'Ctrl + Enter';
