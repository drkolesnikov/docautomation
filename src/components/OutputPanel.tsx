import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppState } from '../context/AppContext';
import { copyToClipboard } from '../utils/clipboard';
import { getSelectionOffsets } from '../utils/contentEditableUtils';
import TokenBudget from './TokenBudget';
import EditBar from './EditBar';

interface OutputPanelProps {
  onRegenerate: () => void;
  totalTokens: number;
  maxTokens: number;
  isOverBudget: boolean;
}

export default function OutputPanel({
  onRegenerate,
  totalTokens,
  maxTokens,
  isOverBudget,
}: OutputPanelProps) {
  const [state, dispatch] = useAppState();
  const { outputText, isStreaming, isEditStreaming, editHistory, editFuture } = state;
  const [copyFlash, setCopyFlash] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  // Tracks the last text we synced FROM state TO DOM, to avoid re-applying user edits
  const lastSyncedRef = useRef('');

  const hasOutput = outputText.length > 0;
  const isAnyStreaming = isStreaming || isEditStreaming;
  const canUndo = editHistory.length > 0;
  const canRedo = editFuture.length > 0;
  // Canvas is "active" when streaming an edit or when a staged proposal is waiting —
  // in both cases the canvas takes over the full panel height.
  const isStaged = !isEditStreaming && state.pendingEditText !== null;
  const isCanvasActive = isEditStreaming || isStaged;

  // ── Sync state → DOM ────────────────────────────────────────────────────
  // Only update the DOM when outputText changed from outside (streaming,
  // applied edits, undo/redo) — not when the user typed directly.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (outputText === lastSyncedRef.current) return;
    // Normalize: innerText on a div returns \r\n on some OSes
    const domText = el.innerText.replace(/\r\n/g, '\n');
    if (domText !== outputText) {
      el.innerText = outputText;
    }
    lastSyncedRef.current = outputText;
  }, [outputText]);

  // ── User typing in contenteditable → sync to state ──────────────────────
  const handleInput = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const text = el.innerText.replace(/\r\n/g, '\n');
    lastSyncedRef.current = text;
    dispatch({ type: 'SET_OUTPUT_TEXT', payload: text });
  }, [dispatch]);

  // ── Selection tracking ────────────────────────────────────────────────
  // Update stored selection on mouseup/keyup within the contenteditable.
  // We intentionally do NOT auto-clear on click-away — user dismisses via ✕.
  const handleSelectionChange = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const offsets = getSelectionOffsets(el);
    if (offsets !== null) {
      dispatch({ type: 'SET_SELECTION', payload: offsets });
    }
  }, [dispatch]);

  // ── Copy ─────────────────────────────────────────────────────────────────
  const handleCopy = async () => {
    const success = await copyToClipboard(outputText);
    if (success) {
      setCopyFlash(true);
      setTimeout(() => setCopyFlash(false), 2000);
    }
  };

  // ── Undo / Redo ──────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    dispatch({ type: 'UNDO_EDIT' });
  }, [dispatch]);

  const handleRedo = useCallback(() => {
    dispatch({ type: 'REDO_EDIT' });
  }, [dispatch]);

  // ── Keyboard shortcuts (Ctrl/Cmd + Z / Y) ───────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'z' && !e.shiftKey) {
        if (canUndo) {
          e.preventDefault();
          handleUndo();
        }
      } else if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        if (canRedo) {
          e.preventDefault();
          handleRedo();
        }
      }
    },
    [canUndo, canRedo, handleUndo, handleRedo]
  );

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* ── Output area — hidden when canvas takes over ────────────────── */}
      {!isCanvasActive && (
        <div className="relative flex-1 min-h-[200px]">
          <div
            ref={contentRef}
            contentEditable={!isAnyStreaming}
            suppressContentEditableWarning
            onInput={handleInput}
            onMouseUp={handleSelectionChange}
            onKeyUp={handleSelectionChange}
            onKeyDown={handleKeyDown}
            className={[
              'h-full min-h-[200px] w-full rounded border p-3 text-sm leading-relaxed',
              'focus:outline-none whitespace-pre-wrap break-words overflow-y-auto',
              isAnyStreaming
                ? 'border-gray-200 bg-gray-50 cursor-default select-none'
                : 'border-gray-300 bg-white focus:border-blue-500',
            ].join(' ')}
          />
          {!hasOutput && (
            <span className="pointer-events-none absolute left-0 top-0 select-none p-3 text-sm text-gray-400">
              Здесь появится готовый документ.
            </span>
          )}
        </div>
      )}

      {/* ── Canvas edit bar — flex-1 when active to fill full panel ──────── */}
      {!isStreaming && (
        <div className={isCanvasActive ? 'flex-1 min-h-0' : ''}>
          <EditBar outputText={outputText} />
        </div>
      )}

      {/* ── Controls ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!hasOutput || isAnyStreaming}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {copyFlash ? 'Скопировано!' : 'Копировать'}
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isAnyStreaming}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Заново
          </button>
          {/* Undo */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo || isAnyStreaming}
            title="Отменить правку (Ctrl+Z)"
            className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ↩
          </button>
          {/* Redo */}
          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo || isAnyStreaming}
            title="Повторить правку (Ctrl+Y)"
            className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ↪
          </button>
        </div>

        <TokenBudget
          totalTokens={totalTokens}
          maxTokens={maxTokens}
          isOverBudget={isOverBudget}
        />
      </div>
    </div>
  );
}
