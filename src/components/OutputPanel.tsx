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

  // On mobile, text selection via touch fires `selectionchange` on document
  // rather than `mouseup` on the element, so we need a document-level listener.
  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [handleSelectionChange]);

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

  const btnCls = 'rounded-lg border border-white/10 bg-white/[0.07] px-3 py-2 text-sm font-medium text-white/60 hover:bg-white/[0.12] hover:text-white/90 disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-150';

  return (
    <div className="flex flex-col gap-4 md:h-full">
      {/* ── Output area — hidden when canvas takes over ────────────────── */}
      {!isCanvasActive && (
        <div className="relative min-h-[260px] md:flex-1">
          <div
            ref={contentRef}
            contentEditable={!isAnyStreaming}
            suppressContentEditableWarning
            onInput={handleInput}
            onMouseUp={handleSelectionChange}
            onKeyUp={handleSelectionChange}
            onKeyDown={handleKeyDown}
            className={[
              'h-full min-h-[260px] w-full rounded-xl border px-3.5 py-3 text-sm leading-relaxed',
              'focus:outline-none focus:ring-2 whitespace-pre-wrap break-words overflow-y-auto transition-all duration-150',
              isAnyStreaming
                ? 'border-white/[0.06] bg-white/[0.03] cursor-default select-none text-white/70'
                : 'border-white/[0.1] bg-white/[0.06] text-white/90 focus:border-indigo-400/60 focus:bg-white/[0.09] focus:ring-indigo-500/20',
            ].join(' ')}
          />
          {!hasOutput && (
            <span className="pointer-events-none absolute left-0 top-0 select-none px-3.5 py-3 text-sm text-white/20">
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
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!hasOutput || isAnyStreaming}
            className={[
              'rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-150 disabled:opacity-25 disabled:cursor-not-allowed',
              copyFlash
                ? 'border-emerald-400/30 bg-emerald-400/[0.15] text-emerald-300'
                : 'border-white/10 bg-white/[0.07] text-white/60 hover:bg-white/[0.12] hover:text-white/90',
            ].join(' ')}
          >
            {copyFlash ? '✓ Скопировано' : 'Копировать'}
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isAnyStreaming}
            className={btnCls}
          >
            Заново
          </button>
          {/* Undo */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo || isAnyStreaming}
            title="Отменить правку (Ctrl+Z)"
            className={btnCls}
          >
            ↩
          </button>
          {/* Redo */}
          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo || isAnyStreaming}
            title="Повторить правку (Ctrl+Y)"
            className={btnCls}
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
