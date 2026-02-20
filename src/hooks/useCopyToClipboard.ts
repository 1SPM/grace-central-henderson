/**
 * Custom hook for clipboard copy operations.
 *
 * Eliminates duplicated clipboard logic across components by providing
 * a consistent copy-to-clipboard pattern with auto-reset feedback state.
 */

import { useState, useCallback, useRef } from 'react';
import { createLogger } from '../utils/logger';

const log = createLogger('clipboard');

const COPY_FEEDBACK_MS = 2000;

/**
 * Hook for copying text to clipboard with visual feedback state.
 *
 * Supports two patterns:
 * - Boolean mode: `const { isCopied, copy } = useCopyToClipboard()`
 * - ID mode: `const { copiedId, copy } = useCopyToClipboard()`
 *   where `copy(text, 'some-id')` tracks which item was copied.
 */
export function useCopyToClipboard(resetMs: number = COPY_FEEDBACK_MS) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const copy = useCallback(async (text: string, id: string = '__default__'): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);

      // Clear any pending reset timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      setCopiedId(id);
      timerRef.current = setTimeout(() => setCopiedId(null), resetMs);
      return true;
    } catch (err) {
      log.error('Failed to copy to clipboard', err);
      return false;
    }
  }, [resetMs]);

  return {
    /** The ID of the most recently copied item, or null */
    copiedId,
    /** Whether any copy is in the feedback window */
    isCopied: copiedId !== null,
    /** Copy text to clipboard. Optionally pass an ID to track which item was copied. */
    copy,
  };
}
