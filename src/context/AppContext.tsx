import { createContext, useContext, useReducer, type ReactNode, type Dispatch } from 'react';
import type { ProviderSettings, DocTypeKey } from '../providers/types';

// ---------------------------------------------------------------------------
// Canvas / Edit types
// ---------------------------------------------------------------------------

export type EditDelta = {
  start: number;    // char offset start in outputText
  end: number;      // char offset end (exclusive) — what was removed
  removed: string;  // text that was replaced
  inserted: string; // text that replaced it
};

export type SelectionState = {
  start: number;
  end: number;
  text: string;
};

export type EditMode = 'selection' | 'document' | null;

export type SessionEntry = {
  id: string;
  docType: DocTypeKey;
  inputText: string;
  outputText: string;
  createdAt: number;
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type AppState = {
  settings: ProviderSettings | null;
  docType: DocTypeKey;
  inputText: string;
  outputText: string;
  isStreaming: boolean;
  statusMessage: string | null;
  settingsOpen: boolean;
  exampleCount: number;
  // Canvas / editable state
  selection: SelectionState | null;
  editInstruction: string;
  isEditStreaming: boolean;
  pendingEditText: string | null;  // accumulates streamed edit proposal
  editMode: EditMode;              // 'selection' | 'document' — active when streaming/staged
  editHistory: EditDelta[];        // undo stack (max 20)
  editFuture: EditDelta[];         // redo stack
  editTruncated: boolean;          // true when last streamed edit hit max_tokens
  // Session history
  sessionHistory: SessionEntry[];
  historyOpen: boolean;
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type AppAction =
  | { type: 'SET_DOC_TYPE'; payload: DocTypeKey }
  | { type: 'SET_INPUT_TEXT'; payload: string }
  | { type: 'SET_OUTPUT_TEXT'; payload: string }
  | { type: 'SET_STREAMING'; payload: boolean }
  | { type: 'SET_STATUS'; payload: string | null }
  | { type: 'OPEN_SETTINGS' }
  | { type: 'CLOSE_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; payload: ProviderSettings }
  | { type: 'SET_EXAMPLE_COUNT'; payload: number }
  // Canvas actions
  | { type: 'SET_SELECTION'; payload: SelectionState | null }
  | { type: 'SET_EDIT_INSTRUCTION'; payload: string }
  | { type: 'SET_EDIT_STREAMING'; payload: boolean }
  | { type: 'SET_PENDING_EDIT'; payload: string | null }
  | { type: 'SET_EDIT_MODE'; payload: EditMode }
  | { type: 'APPLY_EDIT'; payload: EditDelta }
  | { type: 'UNDO_EDIT' }
  | { type: 'REDO_EDIT' }
  | { type: 'SET_EDIT_TRUNCATED'; payload: boolean }
  | { type: 'CLEAR_CANVAS_STATE' }
  // Session history actions
  | { type: 'PUSH_SESSION_ENTRY'; payload: { docType: DocTypeKey; inputText: string; outputText: string } }
  | { type: 'RESTORE_SESSION_ENTRY'; payload: SessionEntry }
  | { type: 'CLEAR_SESSION_HISTORY' }
  | { type: 'TOGGLE_HISTORY' };

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'pnd-doc-settings';

interface PersistedSettings {
  provider: ProviderSettings;
  exampleCount: number;
}

function loadPersistedSettings(): PersistedSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'provider' in parsed &&
      'exampleCount' in parsed
    ) {
      const data = parsed as PersistedSettings;
      if (
        typeof data.provider === 'object' &&
        data.provider !== null &&
        typeof data.exampleCount === 'number'
      ) {
        return data;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function persistSettings(settings: ProviderSettings, exampleCount: number): void {
  const data: PersistedSettings = { provider: settings, exampleCount };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

function createInitialState(): AppState {
  const persisted = loadPersistedSettings();

  return {
    settings: persisted?.provider ?? null,
    docType: 'pervichniy',
    inputText: '',
    outputText: '',
    isStreaming: false,
    statusMessage: null,
    settingsOpen: persisted === null,
    exampleCount: persisted?.exampleCount ?? 3,
    // Canvas
    selection: null,
    editInstruction: '',
    isEditStreaming: false,
    pendingEditText: null,
    editMode: null,
    editHistory: [],
    editFuture: [],
    editTruncated: false,
    sessionHistory: [],
    historyOpen: false,
  };
}

const MAX_HISTORY = 20;
const SESSION_HISTORY_LIMIT = 15;

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_DOC_TYPE':
      return { ...state, docType: action.payload };

    case 'SET_INPUT_TEXT':
      return { ...state, inputText: action.payload };

    case 'SET_OUTPUT_TEXT':
      return { ...state, outputText: action.payload };

    case 'SET_STREAMING':
      return { ...state, isStreaming: action.payload };

    case 'SET_STATUS':
      return { ...state, statusMessage: action.payload };

    case 'OPEN_SETTINGS':
      return { ...state, settingsOpen: true, historyOpen: false };

    case 'CLOSE_SETTINGS':
      return { ...state, settingsOpen: false };

    case 'SAVE_SETTINGS': {
      const newExampleCount = state.exampleCount;
      persistSettings(action.payload, newExampleCount);
      return {
        ...state,
        settings: action.payload,
        settingsOpen: false,
      };
    }

    case 'SET_EXAMPLE_COUNT': {
      const newCount = action.payload;
      const newState = { ...state, exampleCount: newCount };
      if (state.settings) {
        persistSettings(state.settings, newCount);
      }
      return newState;
    }

    // --- Canvas actions ---

    case 'SET_SELECTION':
      return { ...state, selection: action.payload };

    case 'SET_EDIT_INSTRUCTION':
      return { ...state, editInstruction: action.payload };

    case 'SET_EDIT_STREAMING':
      return { ...state, isEditStreaming: action.payload };

    case 'SET_PENDING_EDIT':
      return { ...state, pendingEditText: action.payload };

    case 'SET_EDIT_MODE':
      return { ...state, editMode: action.payload };

    case 'SET_EDIT_TRUNCATED':
      return { ...state, editTruncated: action.payload };

    case 'APPLY_EDIT': {
      const { start, end, removed, inserted } = action.payload;
      const before = state.outputText.slice(0, start);
      const after = state.outputText.slice(end);
      const newText = before + inserted + after;
      const delta: EditDelta = { start, end, removed, inserted };
      const newHistory = [...state.editHistory, delta].slice(-MAX_HISTORY);
      return {
        ...state,
        outputText: newText,
        editHistory: newHistory,
        editFuture: [],        // new edit clears redo stack
        selection: null,
        editInstruction: '',
        pendingEditText: null,
        editMode: null,
        isEditStreaming: false,
        editTruncated: false,
      };
    }

    case 'UNDO_EDIT': {
      if (state.editHistory.length === 0) return state;
      const delta = state.editHistory[state.editHistory.length - 1];
      // Reverse: what was inserted is now at [start, start+inserted.length), restore removed
      const before = state.outputText.slice(0, delta.start);
      const after = state.outputText.slice(delta.start + delta.inserted.length);
      const newText = before + delta.removed + after;
      return {
        ...state,
        outputText: newText,
        editHistory: state.editHistory.slice(0, -1),
        editFuture: [...state.editFuture, delta],
      };
    }

    case 'REDO_EDIT': {
      if (state.editFuture.length === 0) return state;
      const delta = state.editFuture[state.editFuture.length - 1];
      // Re-apply: what was removed is at [start, start+removed.length), restore inserted
      const before = state.outputText.slice(0, delta.start);
      const after = state.outputText.slice(delta.start + delta.removed.length);
      const newText = before + delta.inserted + after;
      return {
        ...state,
        outputText: newText,
        editHistory: [...state.editHistory, delta],
        editFuture: state.editFuture.slice(0, -1),
      };
    }

    case 'CLEAR_CANVAS_STATE':
      return {
        ...state,
        selection: null,
        editInstruction: '',
        isEditStreaming: false,
        pendingEditText: null,
        editMode: null,
        editHistory: [],
        editFuture: [],
        editTruncated: false,
      };

    case 'PUSH_SESSION_ENTRY': {
      const entry: SessionEntry = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        docType: action.payload.docType,
        inputText: action.payload.inputText,
        outputText: action.payload.outputText,
      };
      return {
        ...state,
        sessionHistory: [entry, ...state.sessionHistory].slice(0, SESSION_HISTORY_LIMIT),
      };
    }

    case 'RESTORE_SESSION_ENTRY':
      return {
        ...state,
        docType: action.payload.docType,
        inputText: action.payload.inputText,
        outputText: action.payload.outputText,
        historyOpen: false,
        // Reset all canvas state — the restored document starts fresh
        selection: null,
        editInstruction: '',
        isEditStreaming: false,
        pendingEditText: null,
        editMode: null,
        editHistory: [],
        editFuture: [],
        editTruncated: false,
      };

    case 'CLEAR_SESSION_HISTORY':
      return { ...state, sessionHistory: [] };

    case 'TOGGLE_HISTORY':
      return { ...state, historyOpen: !state.historyOpen };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AppStateContext = createContext<AppState | null>(null);
const AppDispatchContext = createContext<Dispatch<AppAction> | null>(null);

// ---------------------------------------------------------------------------
// Provider component
// ---------------------------------------------------------------------------

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAppState(): [AppState, Dispatch<AppAction>] {
  const state = useContext(AppStateContext);
  const dispatch = useContext(AppDispatchContext);

  if (state === null || dispatch === null) {
    throw new Error('useAppState must be used within an AppProvider');
  }

  return [state, dispatch];
}
