import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';

export type ProtocolType = 'GOOSE' | 'SV' | 'REPORT';
export type DirectionFilter = 'incoming' | 'outgoing' | 'both';
export type ResolutionFilter = 'resolved' | 'unresolved' | 'all';
export type NeighborDepth = 1 | 2 | 'all';

export interface SelectedEntity {
  type: 'ied' | 'ln' | 'dataset' | 'control' | 'edge' | 'subnetwork' | 'none';
  id: string;
  label?: string;
}

export interface UiState {
  selectedEntity: SelectedEntity;
  focusIedId: string | null;
  /** 'all' = show all IEDs; string[] = only these IED names in graph and navigator */
  iedFilter: 'all' | string[];
  protocolFilter: Record<ProtocolType, boolean>;
  directionFilter: DirectionFilter;
  resolutionFilter: ResolutionFilter;
  neighborDepth: NeighborDepth;
  hideIsolated: boolean;
  searchQuery: string;
  fitToken: number;
}

export type UiAction =
  | { type: 'set-selected'; payload: SelectedEntity }
  | { type: 'set-focus'; payload: string | null }
  | { type: 'set-ied-filter'; payload: 'all' | string[] }
  | { type: 'toggle-protocol'; payload: ProtocolType }
  | { type: 'set-direction'; payload: DirectionFilter }
  | { type: 'set-resolution'; payload: ResolutionFilter }
  | { type: 'set-neighbor-depth'; payload: NeighborDepth }
  | { type: 'set-hide-isolated'; payload: boolean }
  | { type: 'set-search'; payload: string }
  | { type: 'request-fit' }
  | { type: 'reset-for-file'; payload?: { defaultFocusIed?: string | null } };

const initialState: UiState = {
  selectedEntity: { type: 'none', id: 'none' },
  focusIedId: null,
  iedFilter: 'all',
  protocolFilter: {
    GOOSE: true,
    SV: true,
    REPORT: true,
  },
  directionFilter: 'both',
  resolutionFilter: 'all',
  neighborDepth: 1,
  hideIsolated: true,
  searchQuery: '',
  fitToken: 0,
};

function reducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'set-selected':
      return { ...state, selectedEntity: action.payload };
    case 'set-focus':
      return { ...state, focusIedId: action.payload };
    case 'set-ied-filter':
      return { ...state, iedFilter: action.payload };
    case 'toggle-protocol':
      return {
        ...state,
        protocolFilter: {
          ...state.protocolFilter,
          [action.payload]: !state.protocolFilter[action.payload],
        },
      };
    case 'set-direction':
      return { ...state, directionFilter: action.payload };
    case 'set-resolution':
      return { ...state, resolutionFilter: action.payload };
    case 'set-neighbor-depth':
      return { ...state, neighborDepth: action.payload };
    case 'set-hide-isolated':
      return { ...state, hideIsolated: action.payload };
    case 'set-search':
      return { ...state, searchQuery: action.payload };
    case 'request-fit':
      return { ...state, fitToken: state.fitToken + 1 };
    case 'reset-for-file':
      return {
        ...initialState,
        iedFilter: 'all',
        focusIedId: action.payload?.defaultFocusIed ?? null,
        selectedEntity: action.payload?.defaultFocusIed
          ? { type: 'ied', id: `ied:${action.payload.defaultFocusIed}` }
          : initialState.selectedEntity,
        fitToken: state.fitToken + 1,
      };
    default:
      return state;
  }
}

const UiStoreContext = createContext<{ state: UiState; dispatch: Dispatch<UiAction> } | null>(null);

export function UiStoreProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <UiStoreContext.Provider value={value}>{children}</UiStoreContext.Provider>;
}

export function useUiStore(): { state: UiState; dispatch: Dispatch<UiAction> } {
  const ctx = useContext(UiStoreContext);
  if (!ctx) {
    throw new Error('useUiStore must be used within UiStoreProvider');
  }
  return ctx;
}
