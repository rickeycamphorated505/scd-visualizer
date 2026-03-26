import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import type { ValidationFilters, ValidationIssue } from '../validation/types';

interface ValidationState {
  issues: ValidationIssue[];
  selectedIssueId: string | null;
  filters: ValidationFilters;
  validationSubView: 'list' | 'matrix';
}

export type ValidationAction =
  | { type: 'set-issues'; payload: ValidationIssue[] }
  | { type: 'select-issue'; payload: string | null }
  | { type: 'set-filter'; payload: Partial<ValidationFilters> }
  | { type: 'set-validation-sub-view'; payload: 'list' | 'matrix' }
  | { type: 'reset' };

const initialState: ValidationState = {
  issues: [],
  selectedIssueId: null,
  filters: {
    severity: 'all',
    category: 'all',
    protocol: 'all',
    status: 'all',
    query: '',
  },
  validationSubView: 'matrix',
};

function reducer(state: ValidationState, action: ValidationAction): ValidationState {
  switch (action.type) {
    case 'set-issues':
      return { ...state, issues: action.payload, selectedIssueId: action.payload[0]?.id || null };
    case 'select-issue':
      return { ...state, selectedIssueId: action.payload };
    case 'set-filter':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    case 'set-validation-sub-view':
      return { ...state, validationSubView: action.payload };
    case 'reset':
      return initialState;
    default:
      return state;
  }
}

const ValidationContext = createContext<{ state: ValidationState; dispatch: Dispatch<ValidationAction> } | null>(null);

export function ValidationProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <ValidationContext.Provider value={value}>{children}</ValidationContext.Provider>;
}

export function useValidationStore(): { state: ValidationState; dispatch: Dispatch<ValidationAction> } {
  const ctx = useContext(ValidationContext);
  if (!ctx) {
    throw new Error('useValidationStore must be used within ValidationProvider');
  }
  return ctx;
}
