import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { UUID } from '@/types';

// ============================================
// STATE INTERFACE
// ============================================

type PanelType = 'inspector' | 'history' | null;
type InspectorTab = 'details' | 'notes';

/** Board view mode */
export type BoardViewMode = 'areas' | 'levels';

/** Detail level for AI program generation */
export type DetailLevel = 'abstract' | 'standard' | 'detailed';

/** Expand depth for recursive unfold (1-3) */
export type ExpandDepth = 1 | 2 | 3;

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
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  
  // Board interaction mode
  isAddingComment: boolean;
  boardViewMode: BoardViewMode;  // areas or levels view
  
  // Container navigation
  openContainerId: UUID | null;  // null = root level, shows top-level nodes
  containerPath: UUID[];         // breadcrumb trail [grandparent, parent, current]
  
  // AI settings
  detailLevel: DetailLevel;
  expandDepth: ExpandDepth;
  
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
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  
  // Actions - Board interaction
  setAddingComment: (adding: boolean) => void;
  setBoardViewMode: (mode: BoardViewMode) => void;
  
  // Actions - Container navigation
  openContainer: (id: UUID, path?: UUID[]) => void;  // enter container, optionally with full path
  closeContainer: () => void;                         // go up one level
  goToRoot: () => void;                               // return to root level
  navigateToPath: (index: number) => void;            // navigate to specific breadcrumb
  
  // Actions - AI settings
  setDetailLevel: (level: DetailLevel) => void;
  setExpandDepth: (depth: ExpandDepth) => void;
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
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
    isAddingComment: false,
    boardViewMode: 'areas' as BoardViewMode,
    openContainerId: null,
    containerPath: [],
    detailLevel: 'standard',
    expandDepth: 2,

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

    toggleLeftPanel: () => {
      set((state) => {
        state.leftPanelCollapsed = !state.leftPanelCollapsed;
      });
    },

    toggleRightPanel: () => {
      set((state) => {
        state.rightPanelCollapsed = !state.rightPanelCollapsed;
      });
    },

    // Board interaction actions
    setAddingComment: (adding) => {
      set((state) => {
        state.isAddingComment = adding;
      });
    },

    setBoardViewMode: (mode) => {
      set((state) => {
        state.boardViewMode = mode;
        // Clear selection when switching views
        state.selectedNodeIds = [];
        state.selectedGroupIds = [];
      });
    },

    // Container navigation actions
    openContainer: (id, path) => {
      set((state) => {
        state.openContainerId = id;
        if (path) {
          state.containerPath = path;
        } else {
          // Append to existing path
          state.containerPath = [...state.containerPath, id];
        }
        // Clear selection when navigating
        state.selectedNodeIds = [];
        state.selectedGroupIds = [];
      });
    },

    closeContainer: () => {
      set((state) => {
        if (state.containerPath.length > 1) {
          // Go up one level
          state.containerPath = state.containerPath.slice(0, -1);
          state.openContainerId = state.containerPath[state.containerPath.length - 1];
        } else {
          // Return to root
          state.containerPath = [];
          state.openContainerId = null;
        }
        // Clear selection when navigating
        state.selectedNodeIds = [];
        state.selectedGroupIds = [];
      });
    },

    goToRoot: () => {
      set((state) => {
        state.openContainerId = null;
        state.containerPath = [];
        // Clear selection when navigating
        state.selectedNodeIds = [];
        state.selectedGroupIds = [];
      });
    },

    navigateToPath: (index) => {
      set((state) => {
        if (index < 0) {
          // Navigate to root
          state.openContainerId = null;
          state.containerPath = [];
        } else if (index < state.containerPath.length) {
          // Navigate to specific point in path
          state.containerPath = state.containerPath.slice(0, index + 1);
          state.openContainerId = state.containerPath[index];
        }
        // Clear selection when navigating
        state.selectedNodeIds = [];
        state.selectedGroupIds = [];
      });
    },

    // AI settings actions
    setDetailLevel: (level) => {
      set((state) => {
        state.detailLevel = level;
      });
    },

    setExpandDepth: (depth) => {
      set((state) => {
        state.expandDepth = depth;
      });
    },
  }))
);
