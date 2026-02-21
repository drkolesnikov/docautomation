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
      <div className="flex h-full flex-col rounded-xl border border-indigo-200/80 bg-gradient-to-b from-indigo-50/80 to-indigo-50/40 p-3.5">
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:300ms]" />
            </span>
            <span className="text-xs font-semibold text-indigo-700">Генерация правки…</span>
          </div>
          <button
            type="button"
            onClick={stopEdit}
            className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-700 shadow-sm hover:bg-indigo-50 transition-all duration-150"
          >
            ■ Стоп
          </button>
        </div>
        <div
          ref={streamPreviewRef}
          className="flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl border border-indigo-100/80 bg-white/80 p-3.5 text-sm leading-relaxed text-slate-700 shadow-inner"
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
          <p className="mb-3 shrink-0 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Правка фрагмента —{' '}
            <span className="normal-case font-normal text-indigo-500 tracking-normal">
              отредактируйте вариант «Стало» перед применением
            </span>
          </p>

          <div className="grid flex-1 min-h-0 grid-cols-2 gap-3 mb-3">
            {/* Before */}
            <div className="flex min-h-0 flex-col">
              <p className="mb-1.5 shrink-0 text-[11px] font-semibold uppercase tracking-widest text-rose-400">Было</p>
              <div className="flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl border border-rose-100 border-l-[3px] border-l-rose-300 bg-rose-50/60 px-3.5 py-3 text-sm leading-relaxed text-slate-600">
                {selection.text}
              </div>
            </div>

            {/* After — editable */}
            <div className="flex min-h-0 flex-col">
              <p className="mb-1.5 shrink-0 text-[11px] font-semibold uppercase tracking-widest text-emerald-500">
                Стало{' '}
                <span className="normal-case font-normal text-slate-400 tracking-normal">(редактируемо)</span>
              </p>
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="flex-1 resize-none rounded-xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-3 text-sm leading-relaxed text-slate-800 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all duration-150"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={handleAccept}
              disabled={!editedText.trim()}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-1.5 text-sm font-semibold text-white shadow-md shadow-emerald-200/60 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              ✓ Принять
            </button>
            <button
              type="button"
              onClick={handleReject}
              className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all duration-150"
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
        <p className="mb-3 shrink-0 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Предложенная версия —{' '}
          <span className="normal-case font-normal text-indigo-500 tracking-normal">
            отредактируйте перед применением
          </span>
        </p>

        <textarea
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          className="flex-1 resize-none rounded-xl border border-emerald-200 bg-emerald-50/50 px-3.5 py-3 text-sm leading-relaxed text-slate-800 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all duration-150 mb-3"
          spellCheck={false}
        />

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={handleAccept}
            disabled={!editedText.trim()}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-1.5 text-sm font-semibold text-white shadow-md shadow-emerald-200/60 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            ✓ Принять и заменить документ
          </button>
          <button
            type="button"
            onClick={handleReject}
            className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all duration-150"
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
      <div className="rounded-xl border border-indigo-200/80 bg-gradient-to-b from-indigo-50/80 to-indigo-50/30 p-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-xs text-indigo-700">
            <span className="font-semibold">Выделено ({selection.text.length} симв.):</span>{' '}
            <span className="italic opacity-80">«{preview}»</span>
          </p>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_SELECTION', payload: null })}
            className="rounded-md px-1.5 py-0.5 text-xs text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100 transition-all duration-150"
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
            className="flex-1 rounded-xl border border-indigo-200 bg-white/80 px-3.5 py-2 text-sm placeholder:text-indigo-300 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 transition-all duration-150"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!editInstruction.trim()}
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3.5 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-200/60 hover:from-indigo-600 hover:to-violet-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            Применить →
          </button>
        </div>
      </div>
    );
  }

  // Doc mode (no selection)
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
      <div className="flex gap-2">
        <input
          type="text"
          value={editInstruction}
          onChange={(e) => dispatch({ type: 'SET_EDIT_INSTRUCTION', payload: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder="Инструкция для всего документа…"
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all duration-150"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!editInstruction.trim()}
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
        >
          Улучшить →
        </button>
      </div>
    </div>
  );
}
