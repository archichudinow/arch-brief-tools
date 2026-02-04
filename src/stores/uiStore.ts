import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { UUID } from '@/types';

// ============================================
// STATE INTERFACE
// ============================================

type PanelType = 'inspector' | 'history' | null;
type InspectorTab = 'details' | 'notes';

/** Detail level for AI program generation */
export type DetailLevel = 'abstract' | 'standard' | 'detailed';

interface UIState {
  // Selection
  selectedNodeIds: UUID[];
  selectedGroupIds: UUID[];
  
  // Expansion (tree view)
  expandedNodeIds: UUID[];
  
  // Panels
  activePanel: PanelType;
  inspectorTab: InspectorTab;
  showAiChat: boolean;
  
  // Board interaction mode
  isAddingComment: boolean;
  
  // AI settings
  detailLevel: DetailLevel;
  
  // Actions - Selection
  selectNodes: (ids: UUID[], append?: boolean) => void;
  selectGroups: (ids: UUID[], append?: boolean) => void;
  clearSelection: () => void;
  
  // Actions - Expansion
  toggleNodeExpanded: (id: UUID) => void;
  expandAll: () => void;
  collapseAll: () => void;
  
  // Actions - Panels
  setActivePanel: (panel: PanelType) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  toggleAiChat: () => void;
  
  // Actions - Board interaction
  setAddingComment: (adding: boolean) => void;
  
  // Actions - AI settings
  setDetailLevel: (level: DetailLevel) => void;
}

// ============================================
// STORE
// ============================================

export const useUIStore = create<UIState>()(
  immer((set) => ({
    // Initial state
    selectedNodeIds: [],
    selectedGroupIds: [],
    expandedNodeIds: [],
    activePanel: 'inspector',
    inspectorTab: 'details',
    showAiChat: false,
    isAddingComment: false,
    detailLevel: 'standard',

    // Selection actions
    selectNodes: (ids, append = false) => {
      set((state) => {
        if (append) {
          // Toggle selection
          for (const id of ids) {
            const index = state.selectedNodeIds.indexOf(id);
            if (index >= 0) {
              state.selectedNodeIds.splice(index, 1);
            } else {
              state.selectedNodeIds.push(id);
            }
          }
        } else {
          state.selectedNodeIds = ids;
          state.selectedGroupIds = [];
        }
      });
    },

    selectGroups: (ids, append = false) => {
      set((state) => {
        if (append) {
          for (const id of ids) {
            const index = state.selectedGroupIds.indexOf(id);
            if (index >= 0) {
              state.selectedGroupIds.splice(index, 1);
            } else {
              state.selectedGroupIds.push(id);
            }
          }
        } else {
          state.selectedNodeIds = [];
          state.selectedGroupIds = ids;
        }
      });
    },

    clearSelection: () => {
      set((state) => {
        state.selectedNodeIds = [];
        state.selectedGroupIds = [];
      });
    },

    // Expansion actions
    toggleNodeExpanded: (id) => {
      set((state) => {
        const index = state.expandedNodeIds.indexOf(id);
        if (index >= 0) {
          state.expandedNodeIds.splice(index, 1);
        } else {
          state.expandedNodeIds.push(id);
        }
      });
    },

    expandAll: () => {
      set((state) => {
        state.expandedNodeIds = [];
      });
    },

    collapseAll: () => {
      set((state) => {
        state.expandedNodeIds = [];
      });
    },

    // Panel actions
    setActivePanel: (panel) => {
      set((state) => {
        state.activePanel = panel;
      });
    },

    setInspectorTab: (tab) => {
      set((state) => {
        state.inspectorTab = tab;
      });
    },

    toggleAiChat: () => {
      set((state) => {
        state.showAiChat = !state.showAiChat;
      });
    },

    // Board interaction actions
    setAddingComment: (adding) => {
      set((state) => {
        state.isAddingComment = adding;
      });
    },

    // AI settings actions
    setDetailLevel: (level) => {
      set((state) => {
        state.detailLevel = level;
      });
    },
  }))
);
