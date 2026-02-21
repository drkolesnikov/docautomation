import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { useAppState } from '../context/AppContext';
import type { EditDelta } from '../context/AppContext';
import { useEditStreaming } from '../hooks/useEditStreaming';

interface EditBarProps {
  outputText: string;
}

export default function EditBar({ outputText }: EditBarProps) {
  const [state, dispatch] = useAppState();
  const { selection, editInstruction, isEditStreaming, pendingEditText, editMode } = state;
  const { editFragment, editDocument, stopEdit } = useEditStreaming();
  const instructionRef = useRef<HTMLInputElement>(null);
  const streamPreviewRef = useRef<HTMLDivElement>(null);

  // Local editable copy of the proposed text — initialized once streaming ends,
  // then the user can freely edit it before accepting.
  const [editedText, setEditedText] = useState('');
  const prevIsEditStreamingRef = useRef(isEditStreaming);

  // Initialize editable copy the moment streaming finishes
  useEffect(() => {
    const wasStreaming = prevIsEditStreamingRef.current;
    prevIsEditStreamingRef.current = isEditStreaming;
    if (wasStreaming && !isEditStreaming && pendingEditText !== null) {
      setEditedText(pendingEditText);
    }
  }, [isEditStreaming, pendingEditText]);

  // Reset when staging is cleared (Reject or Accept)
  useEffect(() => {
    if (pendingEditText === null) {
      setEditedText('');
    }
  }, [pendingEditText]);

  // Auto-scroll streaming preview to bottom as tokens arrive
  useEffect(() => {
    if (streamPreviewRef.current && isEditStreaming) {
      streamPreviewRef.current.scrollTop = streamPreviewRef.current.scrollHeight;
    }
  }, [pendingEditText, isEditStreaming]);

  const isStaged = !isEditStreaming && pendingEditText !== null;
  const hasOutput = outputText.trim().length > 0;

  if (!hasOutput) return null;

  // ── Streaming in progress ────────────────────────────────────────────────
  if (isEditStreaming) {
    return (
      <div className="flex h-full flex-col rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.07] p-4">
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-sm shadow-indigo-400/60 animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-sm shadow-indigo-400/60 animate-bounce [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-sm shadow-indigo-400/60 animate-bounce [animation-delay:300ms]" />
            </span>
            <span className="text-xs font-semibold text-indigo-300">Генерация правки…</span>
          </div>
          <button
            type="button"
            onClick={stopEdit}
            className="rounded-lg border border-indigo-400/25 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-indigo-300 hover:bg-white/[0.1] transition-all duration-150"
          >
            ■ Стоп
          </button>
        </div>
        <div
          ref={streamPreviewRef}
          className="flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/[0.08] bg-white/[0.04] p-3.5 text-sm leading-relaxed text-white/80"
        >
          {pendingEditText ?? ''}
        </div>
      </div>
    );
  }

  // ── Staged: review and optionally edit before Accept/Reject ─────────────
  if (isStaged) {
    const handleAccept = () => {
      let delta: EditDelta;
      if (editMode === 'selection' && selection !== null) {
        delta = {
          start: selection.start,
          end: selection.end,
          removed: selection.text,
          inserted: editedText,
        };
      } else {
        delta = {
          start: 0,
          end: outputText.length,
          removed: outputText,
          inserted: editedText,
        };
      }
      dispatch({ type: 'APPLY_EDIT', payload: delta });
    };

    const handleReject = () => {
      dispatch({ type: 'SET_PENDING_EDIT', payload: null });
      dispatch({ type: 'SET_EDIT_MODE', payload: null });
    };

    // ── Fragment edit: side-by-side Before / After ──────────────────────
    if (editMode === 'selection' && selection !== null) {
      return (
        <div className="flex h-full flex-col">
          <p className="mb-3 shrink-0 text-[11px] font-semibold uppercase tracking-widest text-white/35">
            Правка фрагмента —{' '}
            <span className="normal-case font-normal text-indigo-400/80 tracking-normal">
              отредактируйте вариант «Стало» перед применением
            </span>
          </p>

          <div className="grid flex-1 min-h-0 grid-cols-2 gap-3 mb-3">
            {/* Before */}
            <div className="flex min-h-0 flex-col">
              <p className="mb-1.5 shrink-0 text-[11px] font-semibold uppercase tracking-widest text-rose-400/80">Было</p>
              <div className="flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl border border-rose-400/15 border-l-[3px] border-l-rose-400/40 bg-rose-400/[0.06] px-3.5 py-3 text-sm leading-relaxed text-white/60">
                {selection.text}
              </div>
            </div>

            {/* After — editable */}
            <div className="flex min-h-0 flex-col">
              <p className="mb-1.5 shrink-0 text-[11px] font-semibold uppercase tracking-widest text-emerald-400/80">
                Стало{' '}
                <span className="normal-case font-normal text-white/30 tracking-normal">(редактируемо)</span>
              </p>
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="flex-1 resize-none rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-3.5 py-3 text-sm leading-relaxed text-white/90 focus:border-indigo-400/60 focus:bg-white/[0.09] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-150"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={handleAccept}
              disabled={!editedText.trim()}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-200"
            >
              ✓ Принять
            </button>
            <button
              type="button"
              onClick={handleReject}
              className="rounded-xl border border-white/10 bg-white/[0.07] px-4 py-1.5 text-sm font-medium text-white/60 hover:bg-white/[0.12] hover:text-white/90 transition-all duration-150"
            >
              ✕ Отклонить
            </button>
          </div>
        </div>
      );
    }

    // ── Whole-doc edit: full-height editable textarea ───────────────────
    return (
      <div className="flex h-full flex-col">
        <p className="mb-3 shrink-0 text-[11px] font-semibold uppercase tracking-widest text-white/35">
          Предложенная версия —{' '}
          <span className="normal-case font-normal text-indigo-400/80 tracking-normal">
            отредактируйте перед применением
          </span>
        </p>

        <textarea
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          className="flex-1 resize-none rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3.5 py-3 text-sm leading-relaxed text-white/90 focus:border-indigo-400/60 focus:bg-white/[0.09] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-150 mb-3"
          spellCheck={false}
        />

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={handleAccept}
            disabled={!editedText.trim()}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-200"
          >
            ✓ Принять и заменить документ
          </button>
          <button
            type="button"
            onClick={handleReject}
            className="rounded-xl border border-white/10 bg-white/[0.07] px-4 py-1.5 text-sm font-medium text-white/60 hover:bg-white/[0.12] hover:text-white/90 transition-all duration-150"
          >
            ✕ Отклонить
          </button>
        </div>
      </div>
    );
  }

  // ── Idle ─────────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    const instruction = editInstruction.trim();
    if (!instruction) return;
    if (selection !== null) {
      void editFragment(outputText, selection.text, instruction);
    } else {
      void editDocument(outputText, instruction);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (selection !== null) {
    const preview =
      selection.text.length > 60
        ? selection.text.slice(0, 60).replace(/\n/g, ' ') + '…'
        : selection.text.replace(/\n/g, ' ');

    return (
      <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.07] p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-xs text-indigo-300/80">
            <span className="font-semibold">Выделено ({selection.text.length} симв.):</span>{' '}
            <span className="italic opacity-70">«{preview}»</span>
          </p>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_SELECTION', payload: null })}
            className="rounded-md px-1.5 py-0.5 text-xs text-indigo-400/60 hover:text-indigo-300 hover:bg-indigo-400/10 transition-all duration-150"
            title="Снять выделение"
          >
            ✕
          </button>
        </div>
        <div className="flex gap-2">
          <input
            ref={instructionRef}
            type="text"
            value={editInstruction}
            onChange={(e) => dispatch({ type: 'SET_EDIT_INSTRUCTION', payload: e.target.value })}
            onKeyDown={handleKeyDown}
            placeholder="Инструкция для выделенного фрагмента…"
            className="flex-1 rounded-xl border border-indigo-400/20 bg-white/[0.06] px-3.5 py-2 text-sm text-white/90 placeholder:text-indigo-300/30 focus:border-indigo-400/60 focus:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-150"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!editInstruction.trim()}
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-200"
          >
            Применить →
          </button>
        </div>
      </div>
    );
  }

  // Doc mode (no selection)
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={editInstruction}
          onChange={(e) => dispatch({ type: 'SET_EDIT_INSTRUCTION', payload: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder="Инструкция для всего документа…"
          className="flex-1 rounded-xl border border-white/[0.1] bg-white/[0.06] px-3.5 py-2 text-sm text-white/90 placeholder:text-white/25 focus:border-indigo-400/60 focus:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-150"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!editInstruction.trim()}
          className="rounded-xl border border-white/10 bg-white/[0.07] px-3.5 py-2 text-sm font-medium text-white/60 hover:bg-white/[0.12] hover:text-white/90 disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-150"
        >
          Улучшить →
        </button>
      </div>
    </div>
  );
}
