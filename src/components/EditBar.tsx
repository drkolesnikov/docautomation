import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { useAppState } from '../context/AppContext';
import type { EditDelta } from '../context/AppContext';
import { useEditStreaming } from '../hooks/useEditStreaming';

interface EditBarProps {
  outputText: string;
}

export default function EditBar({ outputText }: EditBarProps) {
  const [state, dispatch] = useAppState();
  const { selection, editInstruction, isEditStreaming, pendingEditText, editMode, editTruncated } = state;
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
      <div className="flex h-full flex-col rounded border border-blue-200 bg-blue-50 p-3">
        <div className="mb-2 flex shrink-0 items-center justify-between">
          <span className="text-xs font-medium text-blue-700">Генерация правки…</span>
          <button
            type="button"
            onClick={stopEdit}
            className="rounded border border-blue-300 bg-white px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 transition-colors"
          >
            ■ Стоп
          </button>
        </div>
        <div
          ref={streamPreviewRef}
          className="flex-1 overflow-y-auto whitespace-pre-wrap rounded border border-blue-100 bg-white p-3 text-sm leading-relaxed text-gray-700"
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
          <p className="mb-2 shrink-0 text-xs font-medium text-gray-500">
            Правка фрагмента —{' '}
            <span className="font-normal text-indigo-600">
              отредактируйте вариант «Стало» перед применением
            </span>
          </p>

          <div className="grid flex-1 min-h-0 grid-cols-2 gap-3 mb-3">
            {/* Before */}
            <div className="flex min-h-0 flex-col">
              <p className="mb-1 shrink-0 text-xs font-semibold text-red-500">Было</p>
              <div className="flex-1 overflow-y-auto whitespace-pre-wrap rounded border border-gray-200 border-l-4 border-l-red-300 bg-red-50 p-3 text-sm leading-relaxed text-gray-700">
                {selection.text}
              </div>
            </div>

            {/* After — editable */}
            <div className="flex min-h-0 flex-col">
              <p className="mb-1 shrink-0 text-xs font-semibold text-green-600">
                Стало{' '}
                <span className="font-normal text-gray-400">(редактируемо)</span>
              </p>
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="flex-1 resize-none rounded border border-green-300 bg-green-50 p-3 text-sm leading-relaxed text-gray-800 focus:border-indigo-400 focus:outline-none"
                spellCheck={false}
              />
            </div>
          </div>

          {editTruncated && (
            <p className="mb-2 shrink-0 rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
              ⚠ Правка может быть неполной — модель достигла лимита токенов. Отредактируйте «Стало» вручную перед применением.
            </p>
          )}
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={handleAccept}
              disabled={!editedText.trim()}
              className="rounded border border-green-500 bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ✓ Принять
            </button>
            <button
              type="button"
              onClick={handleReject}
              className="rounded border border-gray-300 bg-white px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
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
        <p className="mb-2 shrink-0 text-xs font-medium text-gray-500">
          Предложенная версия документа —{' '}
          <span className="font-normal text-indigo-600">
            отредактируйте перед применением
          </span>
        </p>

        <textarea
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          className="flex-1 resize-none rounded border border-green-300 bg-green-50 p-3 text-sm leading-relaxed text-gray-800 focus:border-indigo-400 focus:outline-none mb-3"
          spellCheck={false}
        />

        {editTruncated && (
          <p className="mb-2 shrink-0 rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
            ⚠ Документ может быть неполным — модель достигла лимита токенов. Проверьте и дополните текст перед применением.
          </p>
        )}
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={handleAccept}
            disabled={!editedText.trim()}
            className="rounded border border-green-500 bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ✓ Принять и заменить документ
          </button>
          <button
            type="button"
            onClick={handleReject}
            className="rounded border border-gray-300 bg-white px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
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
      <div className="rounded border border-indigo-200 bg-indigo-50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs text-indigo-700">
            <span className="font-medium">Выделено ({selection.text.length} симв.):</span>{' '}
            <span className="italic">«{preview}»</span>
          </p>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_SELECTION', payload: null })}
            className="text-xs text-indigo-400 hover:text-indigo-700 transition-colors"
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
            className="flex-1 rounded border border-indigo-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!editInstruction.trim()}
            className="rounded border border-indigo-400 bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Применить →
          </button>
        </div>
      </div>
    );
  }

  // Doc mode (no selection)
  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={editInstruction}
          onChange={(e) => dispatch({ type: 'SET_EDIT_INSTRUCTION', payload: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder="Инструкция для всего документа…"
          className="flex-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!editInstruction.trim()}
          className="rounded border border-gray-400 bg-white px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Улучшить →
        </button>
      </div>
    </div>
  );
}
