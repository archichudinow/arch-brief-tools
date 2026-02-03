import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { AppState, StepId, ProgramItem, Assumption, SiteParameters, FunctionalGroup } from '@/types';

// Initial state
const initialState: AppState = {
  project: {
    projectId: crypto.randomUUID(),
    projectName: 'Untitled Project',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    appVersion: '0.1.0',
  },
  progress: {
    lastCompletedStep: null,
    activeStep: 'input',
    lockedSteps: [],
  },
  input: {
    raw: {
      textBrief: '',
      excelFile: null,
      excelData: null,
    },
    site: {},
  },
  normalized: null,
  groups: [],
  rules: [],
  constraints: null,
  variants: [],
  selectedVariantId: null,
};

// Action types
type Action =
  | { type: 'SET_STEP'; payload: StepId }
  | { type: 'COMPLETE_STEP'; payload: StepId }
  | { type: 'SET_TEXT_BRIEF'; payload: string }
  | { type: 'SET_SITE_PARAMS'; payload: Partial<AppState['input']['site']> }
  | { type: 'SET_PROJECT_NAME'; payload: string }
  | { type: 'SET_NORMALIZED_PROGRAM'; payload: { programs: ProgramItem[]; assumptions: Assumption[]; siteParams?: Partial<SiteParameters> } }
  | { type: 'UPDATE_PROGRAM_ITEM'; payload: { id: string; updates: Partial<ProgramItem> } }
  | { type: 'ADD_PROGRAM_ITEM'; payload: Partial<ProgramItem> }
  | { type: 'DELETE_PROGRAM_ITEM'; payload: string }
  | { type: 'TOGGLE_ASSUMPTION'; payload: string }
  | { type: 'LOCK_NORMALIZED'; payload: boolean }
  | { type: 'SET_GROUPS'; payload: FunctionalGroup[] }
  | { type: 'UPDATE_GROUP'; payload: { id: string; updates: Partial<FunctionalGroup> } }
  | { type: 'DELETE_GROUP'; payload: string }
  | { type: 'RESET_PROJECT' };

// Reducer
function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STEP':
      return {
        ...state,
        progress: {
          ...state.progress,
          activeStep: action.payload,
        },
        project: {
          ...state.project,
          modifiedAt: new Date().toISOString(),
        },
      };
    case 'COMPLETE_STEP': {
      const stepOrder: StepId[] = ['input', 'normalize', 'grouping', 'rules', 'constraints', 'variants', 'outputs'];
      const currentIndex = state.progress.lastCompletedStep 
        ? stepOrder.indexOf(state.progress.lastCompletedStep)
        : -1;
      const newIndex = stepOrder.indexOf(action.payload);
      return {
        ...state,
        progress: {
          ...state.progress,
          lastCompletedStep: newIndex > currentIndex ? action.payload : state.progress.lastCompletedStep,
        },
        project: {
          ...state.project,
          modifiedAt: new Date().toISOString(),
        },
      };
    }
    case 'SET_TEXT_BRIEF':
      return {
        ...state,
        input: {
          ...state.input,
          raw: {
            ...state.input.raw,
            textBrief: action.payload,
          },
        },
        project: {
          ...state.project,
          modifiedAt: new Date().toISOString(),
        },
      };
    case 'SET_SITE_PARAMS':
      return {
        ...state,
        input: {
          ...state.input,
          site: {
            ...state.input.site,
            ...action.payload,
          },
        },
        project: {
          ...state.project,
          modifiedAt: new Date().toISOString(),
        },
      };
    case 'SET_PROJECT_NAME':
      return {
        ...state,
        project: {
          ...state.project,
          projectName: action.payload,
          modifiedAt: new Date().toISOString(),
        },
      };
    case 'SET_NORMALIZED_PROGRAM': {
      // Use totalArea (area × quantity) for proper calculation
      const totalArea = action.payload.programs.reduce((sum, p) => sum + (p.totalArea || p.area * (p.quantity || 1)), 0);
      return {
        ...state,
        normalized: {
          items: action.payload.programs,
          assumptions: action.payload.assumptions,
          totalArea,
          locked: false,
        },
        input: {
          ...state.input,
          site: {
            ...state.input.site,
            ...action.payload.siteParams,
          },
        },
        project: {
          ...state.project,
          modifiedAt: new Date().toISOString(),
        },
      };
    }
    case 'UPDATE_PROGRAM_ITEM': {
      if (!state.normalized) return state;
      return {
        ...state,
        normalized: {
          ...state.normalized,
          items: state.normalized.items.map(item =>
            item.id === action.payload.id
              ? { ...item, ...action.payload.updates, source: 'user' as const }
              : item
          ),
          // Recalculate total using totalArea (area × quantity)
          totalArea: state.normalized.items.reduce((sum, item) => {
            if (item.id === action.payload.id) {
              const updates = action.payload.updates;
              const newArea = updates.area ?? item.area;
              const newQty = updates.quantity ?? item.quantity;
              return sum + (newArea * newQty);
            }
            return sum + item.totalArea;
          }, 0),
        },
        project: {
          ...state.project,
          modifiedAt: new Date().toISOString(),
        },
      };
    }
    case 'ADD_PROGRAM_ITEM': {
      if (!state.normalized) return state;
      const newItem: ProgramItem = {
        id: `program-${Date.now()}`,
        name: action.payload.name || 'New Room',
        area: action.payload.area || 50,
        quantity: action.payload.quantity || 1,
        totalArea: (action.payload.area || 50) * (action.payload.quantity || 1),
        unit: action.payload.unit || 'sqm',
        areaType: action.payload.areaType || 'net',
        confidence: 1,
        source: 'user',
        aiNotes: action.payload.aiNotes || '',
        userNotes: action.payload.userNotes || '',
        ...action.payload,
      };
      const newItems = [...state.normalized.items, newItem];
      return {
        ...state,
        normalized: {
          ...state.normalized,
          items: newItems,
          totalArea: newItems.reduce((sum, item) => sum + item.totalArea, 0),
        },
        project: {
          ...state.project,
          modifiedAt: new Date().toISOString(),
        },
      };
    }
    case 'DELETE_PROGRAM_ITEM': {
      if (!state.normalized) return state;
      const newItems = state.normalized.items.filter(item => item.id !== action.payload);
      return {
        ...state,
        normalized: {
          ...state.normalized,
          items: newItems,
          totalArea: newItems.reduce((sum, item) => sum + item.totalArea, 0),
        },
        project: {
          ...state.project,
          modifiedAt: new Date().toISOString(),
        },
      };
    }
    case 'TOGGLE_ASSUMPTION': {
      if (!state.normalized) return state;
      return {
        ...state,
        normalized: {
          ...state.normalized,
          assumptions: state.normalized.assumptions.map(a =>
            a.id === action.payload ? { ...a, accepted: !a.accepted } : a
          ),
        },
        project: {
          ...state.project,
          modifiedAt: new Date().toISOString(),
        },
      };
    }
    case 'LOCK_NORMALIZED': {
      if (!state.normalized) return state;
      return {
        ...state,
        normalized: {
          ...state.normalized,
          locked: action.payload,
        },
        project: {
          ...state.project,
          modifiedAt: new Date().toISOString(),
        },
      };
    }
    case 'SET_GROUPS': {
      return {
        ...state,
        groups: action.payload,
        project: {
          ...state.project,
          modifiedAt: new Date().toISOString(),
        },
      };
    }
    case 'UPDATE_GROUP': {
      return {
        ...state,
        groups: state.groups.map(g =>
          g.id === action.payload.id ? { ...g, ...action.payload.updates } : g
        ),
        project: {
          ...state.project,
          modifiedAt: new Date().toISOString(),
        },
      };
    }
    case 'DELETE_GROUP': {
      return {
        ...state,
        groups: state.groups.filter(g => g.id !== action.payload),
        project: {
          ...state.project,
          modifiedAt: new Date().toISOString(),
        },
      };
    }
    case 'RESET_PROJECT':
      return {
        ...initialState,
        project: {
          ...initialState.project,
          projectId: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
        },
      };
    default:
      return state;
  }
}

// Context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextType | null>(null);

// Provider
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// Hook
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
