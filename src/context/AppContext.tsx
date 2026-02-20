import { createContext, useContext, useReducer, type ReactNode, type Dispatch } from 'react';
import type { ProviderSettings, DocTypeKey } from '../providers/types';

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
  | { type: 'SET_EXAMPLE_COUNT'; payload: number };

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
    // Auto-open settings on first launch when no settings are persisted
    settingsOpen: persisted === null,
    exampleCount: persisted?.exampleCount ?? 3,
  };
}

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
      return { ...state, settingsOpen: true };

    case 'CLOSE_SETTINGS':
      return { ...state, settingsOpen: false };

    case 'SAVE_SETTINGS': {
      const newExampleCount = state.exampleCount;
      // Persist to localStorage directly inside the reducer
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
      // If settings exist, persist the updated example count alongside them
      if (state.settings) {
        persistSettings(state.settings, newCount);
      }
      return newState;
    }

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
