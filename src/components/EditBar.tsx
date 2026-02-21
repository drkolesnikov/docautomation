import { useRef, type KeyboardEvent } from 'react';
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

  const isStaged = !isEditStreaming && pendingEditText !== null;
  const hasOutput = outputText.trim().length > 0;

  if (!hasOutput) return null;

  // ── Streaming in progress ───────────────────────────────────────────────
  if (isEditStreaming) {
    return (
      <div className="rounded border border-blue-200 bg-blue-50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-blue-700">Генерация правки…</span>
          <button
            type="button"
            onClick={stopEdit}
            className="rounded border border-blue-300 bg-white px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 transition-colors"
          >
            ■ Стоп
          </button>
        </div>
        {pendingEditText !== null && pendingEditText.length > 0 && (
          <div className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded border border-blue-100 bg-white p-2 text-sm leading-relaxed text-gray-700">
            {pendingEditText}
          </div>
        )}
      </div>
    );
  }

  // ── Staged: propose before Accept/Reject ────────────────────────────────
  if (isStaged) {
    const handleAccept = () => {
      if (pendingEditText === null) return;

      let delta: EditDelta;
      if (editMode === 'selection' && selection !== null) {
        delta = {
          start: selection.start,
          end: selection.end,
          removed: selection.text,
          inserted: pendingEditText,
        };
      } else {
        // Whole-document replace
        delta = {
          start: 0,
          end: outputText.length,
          removed: outputText,
          inserted: pendingEditText,
        };
      }
      dispatch({ type: 'APPLY_EDIT', payload: delta });
    };

    const handleReject = () => {
      dispatch({ type: 'SET_PENDING_EDIT', payload: null });
      dispatch({ type: 'SET_EDIT_MODE', payload: null });
    };

    return (
      <div className="rounded border border-amber-200 bg-amber-50 p-3">
        <p className="mb-2 text-xs font-medium text-amber-800">
          {editMode === 'selection'
            ? 'Предложенная правка фрагмента:'
            : 'Предложенная версия документа:'}
        </p>

        {editMode === 'selection' && selection !== null && (
          <div className="mb-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="mb-1 font-medium text-red-600">Было:</p>
              <div className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded border border-red-100 bg-red-50 p-2 leading-relaxed text-gray-700 line-through opacity-70">
                {selection.text}
              </div>
            </div>
            <div>
              <p className="mb-1 font-medium text-green-600">Стало:</p>
              <div className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded border border-green-100 bg-green-50 p-2 leading-relaxed text-gray-700">
                {pendingEditText}
              </div>
            </div>
          </div>
        )}

        {editMode === 'document' && (
          <div className="mb-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded border border-amber-100 bg-white p-2 text-sm leading-relaxed text-gray-700">
            {pendingEditText}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAccept}
            className="rounded border border-green-400 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-800 hover:bg-green-100 transition-colors"
          >
            ✓ Принять
          </button>
          <button
            type="button"
            onClick={handleReject}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
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
    // Selection mode
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
            className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
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
