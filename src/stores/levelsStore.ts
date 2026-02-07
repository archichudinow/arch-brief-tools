import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuidv4 } from 'uuid';
import type {
  UUID,
  Level,
  GroupSection,
  CreateLevelInput,
  UpdateLevelInput,
  CreateGroupSectionInput,
  UpdateGroupSectionInput,
  GroupSectionDerived,
  LevelsBoardOption,
} from '@/types';
import { useProjectStore } from './projectStore';
import { useHistoryStore } from './historyStore';

// ============================================
// HELPER
// ============================================

function now(): string {
  return new Date().toISOString();
}

// ============================================
// STATE INTERFACE
// ============================================

interface LevelsState {
  // Options - multiple level board variations
  options: Record<UUID, LevelsBoardOption>;
  activeOptionId: UUID | null;
  
  // Data (synced with active option)
  levels: Record<UUID, Level>;
  sections: Record<UUID, GroupSection>;
  
  // UI State
  selectedLevelId: UUID | null;
  selectedSectionIds: UUID[];
  
  // Actions - Options
  createOption: (name?: string) => UUID;
  duplicateOption: (optionId: UUID, newName?: string) => UUID | null;
  deleteOption: (optionId: UUID) => void;
  setActiveOption: (optionId: UUID) => void;
  renameOption: (optionId: UUID, name: string) => void;
  getOptions: () => LevelsBoardOption[];
  
  // Actions - Levels
  createLevel: (input: CreateLevelInput) => UUID;
  updateLevel: (id: UUID, input: UpdateLevelInput) => void;
  deleteLevel: (id: UUID) => void;
  reorderLevels: (orderedIds: UUID[]) => void;
  
  // Actions - Sections
  createSection: (input: CreateGroupSectionInput) => UUID | null;
  updateSection: (id: UUID, input: UpdateGroupSectionInput) => void;
  deleteSection: (id: UUID) => void;
  splitSection: (sectionId: UUID, splits: Array<{ levelStart: number; levelEnd: number; areaAllocation: number }>) => UUID[];
  mergeSections: (sectionIds: UUID[]) => UUID | null;
  
  // Actions - Selection
  selectLevel: (id: UUID | null) => void;
  selectSection: (id: UUID, multiSelect?: boolean) => void;
  clearSectionSelection: () => void;
  
  // Actions - Auto-populate
  autoPopulateSections: () => void;  // Create sections from existing groups
  syncSectionsToCurrentAreas: () => void;  // Update section allocations to match current group areas
  
  // Derived
  getSectionDerived: (id: UUID) => GroupSectionDerived | null;
  getLevelSections: (levelOrder: number) => GroupSection[];
  getGroupSections: (groupId: UUID) => GroupSection[];
  getSortedLevels: () => Level[];
  getUnallocatedGroupArea: (groupId: UUID) => number;
  
  // Actions - Clear
  clearAll: () => void;
}

// ============================================
// DEFAULT LEVELS
// ============================================

const DEFAULT_LEVEL_HEIGHT = 3.5; // meters

// ============================================
// STORE
// ============================================

export const useLevelsStore = create<LevelsState>()(
  immer((set, get) => ({
    // Initial state
    options: {},
    activeOptionId: null,
    levels: {},
    sections: {},
    selectedLevelId: null,
    selectedSectionIds: [],

    // ==========================================
    // OPTION ACTIONS
    // ==========================================

    createOption: (name) => {
      const id = uuidv4();
      const timestamp = now();
      const optionName = name || `Option ${Object.keys(get().options).length + 1}`;
      
      set((state) => {
        state.options[id] = {
          id,
          name: optionName,
          levels: {},
          sections: {},
          createdAt: timestamp,
          modifiedAt: timestamp,
        };
        
        // If no active option, make this one active
        if (!state.activeOptionId) {
          state.activeOptionId = id;
          state.levels = {};
          state.sections = {};
        }
      });
      
      return id;
    },

    duplicateOption: (optionId, newName) => {
      const sourceOption = get().options[optionId];
      if (!sourceOption) return null;
      
      const id = uuidv4();
      const timestamp = now();
      const optionName = newName || `${sourceOption.name} (copy)`;
      
      // Deep copy levels and sections with new IDs
      const newLevels: Record<UUID, Level> = {};
      const newSections: Record<UUID, GroupSection> = {};
      const levelIdMap: Record<UUID, UUID> = {};
      
      // Copy levels with new IDs
      for (const [oldId, level] of Object.entries(sourceOption.levels)) {
        const newId = uuidv4();
        levelIdMap[oldId] = newId;
        newLevels[newId] = {
          ...level,
          id: newId,
          createdAt: timestamp,
          modifiedAt: timestamp,
        };
      }
      
      // Copy sections with new IDs (level references stay the same since they use order, not id)
      for (const section of Object.values(sourceOption.sections)) {
        const newId = uuidv4();
        newSections[newId] = {
          ...section,
          id: newId,
          createdAt: timestamp,
          modifiedAt: timestamp,
        };
      }
      
      set((state) => {
        state.options[id] = {
          id,
          name: optionName,
          levels: newLevels,
          sections: newSections,
          createdAt: timestamp,
          modifiedAt: timestamp,
        };
      });
      
      return id;
    },

    deleteOption: (optionId) => {
      const state = get();
      if (!state.options[optionId]) return;
      
      set((state) => {
        delete state.options[optionId];
        
        // If deleting active option, switch to another or set null
        if (state.activeOptionId === optionId) {
          const remainingIds = Object.keys(state.options);
          if (remainingIds.length > 0) {
            const newActiveId = remainingIds[0];
            state.activeOptionId = newActiveId;
            state.levels = { ...state.options[newActiveId].levels };
            state.sections = { ...state.options[newActiveId].sections };
          } else {
            state.activeOptionId = null;
            state.levels = {};
            state.sections = {};
          }
        }
      });
    },

    setActiveOption: (optionId) => {
      const state = get();
      if (!state.options[optionId]) return;
      
      // Save current state to current option before switching
      set((state) => {
        if (state.activeOptionId && state.options[state.activeOptionId]) {
          state.options[state.activeOptionId].levels = { ...state.levels };
          state.options[state.activeOptionId].sections = { ...state.sections };
          state.options[state.activeOptionId].modifiedAt = now();
        }
        
        // Switch to new option
        state.activeOptionId = optionId;
        state.levels = { ...state.options[optionId].levels };
        state.sections = { ...state.options[optionId].sections };
        state.selectedLevelId = null;
        state.selectedSectionIds = [];
      });
    },

    renameOption: (optionId, name) => {
      set((state) => {
        if (state.options[optionId]) {
          state.options[optionId].name = name;
          state.options[optionId].modifiedAt = now();
        }
      });
    },

    getOptions: () => {
      return Object.values(get().options).sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    },

    // ==========================================
    // LEVEL ACTIONS
    // ==========================================

    createLevel: (input) => {
      const id = uuidv4();
      const timestamp = now();
      
      set((state) => {
        state.levels[id] = {
          id,
          name: input.name,
          order: input.order,
          height: input.height ?? DEFAULT_LEVEL_HEIGHT,
          color: input.color,
          createdAt: timestamp,
          modifiedAt: timestamp,
        };
        // Sync to active option
        if (state.activeOptionId && state.options[state.activeOptionId]) {
          state.options[state.activeOptionId].levels = { ...state.levels };
          state.options[state.activeOptionId].modifiedAt = timestamp;
        }
      });
      
      useHistoryStore.getState().snapshot('create_level', `Create level: ${input.name}`, {
        nodes: useProjectStore.getState().nodes,
        groups: useProjectStore.getState().groups,
      });
      
      return id;
    },

    updateLevel: (id, input) => {
      const timestamp = now();
      
      set((state) => {
        const level = state.levels[id];
        if (!level) return;
        
        if (input.name !== undefined) level.name = input.name;
        if (input.order !== undefined) level.order = input.order;
        if (input.height !== undefined) level.height = input.height;
        if (input.color !== undefined) level.color = input.color;
        level.modifiedAt = timestamp;
        // Sync to active option
        if (state.activeOptionId && state.options[state.activeOptionId]) {
          state.options[state.activeOptionId].levels = { ...state.levels };
          state.options[state.activeOptionId].modifiedAt = timestamp;
        }
      });
    },

    deleteLevel: (id) => {
      const state = get();
      const level = state.levels[id];
      if (!level) return;
      const timestamp = now();
      
      set((state) => {
        // Delete sections that start on this level
        for (const [sectionId, section] of Object.entries(state.sections)) {
          if (section.levelStart === level.order || section.levelEnd === level.order) {
            delete state.sections[sectionId];
          }
        }
        delete state.levels[id];
        // Sync to active option
        if (state.activeOptionId && state.options[state.activeOptionId]) {
          state.options[state.activeOptionId].levels = { ...state.levels };
          state.options[state.activeOptionId].sections = { ...state.sections };
          state.options[state.activeOptionId].modifiedAt = timestamp;
        }
      });
      
      useHistoryStore.getState().snapshot('delete_level', `Delete level: ${level.name}`, {
        nodes: useProjectStore.getState().nodes,
        groups: useProjectStore.getState().groups,
      });
    },

    reorderLevels: (orderedIds) => {
      const timestamp = now();
      
      set((state) => {
        orderedIds.forEach((id, index) => {
          if (state.levels[id]) {
            state.levels[id].order = index;
            state.levels[id].modifiedAt = timestamp;
          }
        });
        // Sync to active option
        if (state.activeOptionId && state.options[state.activeOptionId]) {
          state.options[state.activeOptionId].levels = { ...state.levels };
          state.options[state.activeOptionId].modifiedAt = timestamp;
        }
      });
    },

    // ==========================================
    // SECTION ACTIONS
    // ==========================================

    createSection: (input) => {
      const projectState = useProjectStore.getState();
      const group = projectState.groups[input.groupId];
      if (!group) return null;
      
      const id = uuidv4();
      const timestamp = now();
      
      set((state) => {
        state.sections[id] = {
          id,
          groupId: input.groupId,
          name: input.name,
          levelStart: input.levelStart,
          levelEnd: input.levelEnd ?? input.levelStart,
          areaAllocation: input.areaAllocation,
          createdAt: timestamp,
          modifiedAt: timestamp,
        };
        // Sync to active option
        if (state.activeOptionId && state.options[state.activeOptionId]) {
          state.options[state.activeOptionId].sections = { ...state.sections };
          state.options[state.activeOptionId].modifiedAt = timestamp;
        }
      });
      
      return id;
    },

    updateSection: (id, input) => {
      const timestamp = now();
      
      set((state) => {
        const section = state.sections[id];
        if (!section) return;
        
        if (input.levelStart !== undefined) section.levelStart = input.levelStart;
        if (input.levelEnd !== undefined) section.levelEnd = input.levelEnd;
        if (input.areaAllocation !== undefined) section.areaAllocation = input.areaAllocation;
        if (input.name !== undefined) section.name = input.name;
        if (input.orderInLevel !== undefined) section.orderInLevel = input.orderInLevel;
        if (input.xPosition !== undefined) section.xPosition = input.xPosition ?? undefined;
        section.modifiedAt = timestamp;
        // Sync to active option
        if (state.activeOptionId && state.options[state.activeOptionId]) {
          state.options[state.activeOptionId].sections = { ...state.sections };
          state.options[state.activeOptionId].modifiedAt = timestamp;
        }
      });
    },

    deleteSection: (id) => {
      const timestamp = now();
      set((state) => {
        delete state.sections[id];
        // Sync to active option
        if (state.activeOptionId && state.options[state.activeOptionId]) {
          state.options[state.activeOptionId].sections = { ...state.sections };
          state.options[state.activeOptionId].modifiedAt = timestamp;
        }
      });
    },

    splitSection: (sectionId, splits) => {
      const state = get();
      const originalSection = state.sections[sectionId];
      if (!originalSection) return [];
      
      const newIds: UUID[] = [];
      const timestamp = now();
      
      set((state) => {
        // Delete original section
        delete state.sections[sectionId];
        
        // Create new sections from splits
        for (const split of splits) {
          const newId = uuidv4();
          state.sections[newId] = {
            id: newId,
            groupId: originalSection.groupId,
            name: originalSection.name,
            levelStart: split.levelStart,
            levelEnd: split.levelEnd,
            areaAllocation: split.areaAllocation,
            createdAt: timestamp,
            modifiedAt: timestamp,
          };
          newIds.push(newId);
        }
        // Sync to active option
        if (state.activeOptionId && state.options[state.activeOptionId]) {
          state.options[state.activeOptionId].sections = { ...state.sections };
          state.options[state.activeOptionId].modifiedAt = timestamp;
        }
      });
      
      useHistoryStore.getState().snapshot('split_section', `Split section into ${splits.length} parts`, {
        nodes: useProjectStore.getState().nodes,
        groups: useProjectStore.getState().groups,
      });
      
      return newIds;
    },

    mergeSections: (sectionIds) => {
      const state = get();
      if (sectionIds.length < 2) return null;
      
      const sections = sectionIds.map(id => state.sections[id]).filter(Boolean);
      if (sections.length < 2) return null;
      
      // Verify all sections belong to same group
      const groupId = sections[0].groupId;
      if (!sections.every(s => s.groupId === groupId)) return null;
      
      // Calculate merged values
      const totalArea = sections.reduce((sum, s) => sum + s.areaAllocation, 0);
      const minLevel = Math.min(...sections.map(s => s.levelStart));
      const maxLevel = Math.max(...sections.map(s => s.levelEnd));
      
      const newId = uuidv4();
      const timestamp = now();
      
      set((state) => {
        // Delete original sections
        for (const id of sectionIds) {
          delete state.sections[id];
        }
        
        // Create merged section
        state.sections[newId] = {
          id: newId,
          groupId,
          levelStart: minLevel,
          levelEnd: maxLevel,
          areaAllocation: totalArea,
          createdAt: timestamp,
          modifiedAt: timestamp,
        };
        
        // Sync to active option
        if (state.activeOptionId && state.options[state.activeOptionId]) {
          state.options[state.activeOptionId].sections = { ...state.sections };
          state.options[state.activeOptionId].modifiedAt = timestamp;
        }
      });
      
      useHistoryStore.getState().snapshot('merge_sections', `Merged ${sectionIds.length} sections`, {
        nodes: useProjectStore.getState().nodes,
        groups: useProjectStore.getState().groups,
      });
      
      return newId;
    },

    // ==========================================
    // SELECTION ACTIONS
    // ==========================================

    selectLevel: (id) => {
      set((state) => {
        state.selectedLevelId = id;
      });
    },

    selectSection: (id, multiSelect = false) => {
      set((state) => {
        if (multiSelect) {
          const index = state.selectedSectionIds.indexOf(id);
          if (index >= 0) {
            state.selectedSectionIds.splice(index, 1);
          } else {
            state.selectedSectionIds.push(id);
          }
        } else {
          state.selectedSectionIds = [id];
        }
      });
    },

    clearSectionSelection: () => {
      set((state) => {
        state.selectedSectionIds = [];
      });
    },

    // ==========================================
    // AUTO-POPULATE
    // ==========================================

    autoPopulateSections: () => {
      const state = get();
      const projectState = useProjectStore.getState();
      const groups = projectState.groups;
      const sortedLevels = state.getSortedLevels();
      
      if (sortedLevels.length === 0) return;
      
      // Default to first (ground) level
      const defaultLevel = sortedLevels.find(l => l.order === 0) || sortedLevels[0];
      const timestamp = now();
      
      set((state) => {
        for (const group of Object.values(groups)) {
          // Check if group already has sections
          const existingSections = Object.values(state.sections).filter(
            s => s.groupId === group.id
          );
          if (existingSections.length > 0) continue;
          
          // Calculate group's total area
          const groupNodes = group.members.map(id => projectState.nodes[id]).filter(Boolean);
          const totalArea = groupNodes.reduce((sum, node) => {
            const derived = projectState.getNodeDerived(node.id);
            return sum + (derived?.totalArea ?? 0);
          }, 0);
          
          if (totalArea <= 0) continue;
          
          // Create a section for the whole group on default level
          const sectionId = uuidv4();
          state.sections[sectionId] = {
            id: sectionId,
            groupId: group.id,
            levelStart: defaultLevel.order,
            levelEnd: defaultLevel.order,
            areaAllocation: totalArea,
            createdAt: timestamp,
            modifiedAt: timestamp,
          };
        }
        
        // Sync to active option
        if (state.activeOptionId && state.options[state.activeOptionId]) {
          state.options[state.activeOptionId].sections = { ...state.sections };
          state.options[state.activeOptionId].modifiedAt = timestamp;
        }
      });
    },

    syncSectionsToCurrentAreas: () => {
      const state = get();
      const projectState = useProjectStore.getState();
      const timestamp = now();
      
      // Group sections by groupId
      const sectionsByGroup: Record<string, typeof state.sections[string][]> = {};
      for (const section of Object.values(state.sections)) {
        if (!sectionsByGroup[section.groupId]) {
          sectionsByGroup[section.groupId] = [];
        }
        sectionsByGroup[section.groupId].push(section);
      }
      
      set((state) => {
        for (const [groupId, groupSections] of Object.entries(sectionsByGroup)) {
          const group = projectState.groups[groupId];
          if (!group) continue;
          
          // Calculate current group total area
          const groupNodes = group.members.map(id => projectState.nodes[id]).filter(Boolean);
          const currentTotal = groupNodes.reduce((sum, node) => {
            const derived = projectState.getNodeDerived(node.id);
            return sum + (derived?.totalArea ?? 0);
          }, 0);
          
          if (currentTotal <= 0) continue;
          
          // Calculate previous total from sections
          const previousTotal = groupSections.reduce((sum, s) => sum + s.areaAllocation, 0);
          if (previousTotal <= 0) continue;
          
          // Update each section proportionally
          const ratio = currentTotal / previousTotal;
          for (const section of groupSections) {
            if (state.sections[section.id]) {
              state.sections[section.id].areaAllocation = Math.round(section.areaAllocation * ratio);
              state.sections[section.id].modifiedAt = timestamp;
            }
          }
        }
        
        // Sync to active option
        if (state.activeOptionId && state.options[state.activeOptionId]) {
          state.options[state.activeOptionId].sections = { ...state.sections };
          state.options[state.activeOptionId].modifiedAt = timestamp;
        }
      });
    },

    // ==========================================
    // DERIVED VALUES
    // ==========================================

    getSectionDerived: (id) => {
      const state = get();
      const section = state.sections[id];
      if (!section) return null;
      
      const projectState = useProjectStore.getState();
      const group = projectState.groups[section.groupId];
      if (!group) return null;
      
      // Calculate group's total area
      const groupNodes = group.members.map(id => projectState.nodes[id]).filter(Boolean);
      const groupTotalArea = groupNodes.reduce((sum, node) => {
        const derived = projectState.getNodeDerived(node.id);
        return sum + (derived?.totalArea ?? 0);
      }, 0);
      
      return {
        groupName: group.name,
        groupColor: group.color,
        levelCount: section.levelEnd - section.levelStart + 1,
        groupTotalArea,
        percentOfGroup: groupTotalArea > 0 ? (section.areaAllocation / groupTotalArea) * 100 : 0,
      };
    },

    getLevelSections: (levelOrder) => {
      const state = get();
      return Object.values(state.sections).filter(
        s => s.levelStart <= levelOrder && s.levelEnd >= levelOrder
      );
    },

    getGroupSections: (groupId) => {
      const state = get();
      return Object.values(state.sections).filter(s => s.groupId === groupId);
    },

    getSortedLevels: () => {
      const state = get();
      return Object.values(state.levels).sort((a, b) => b.order - a.order); // Top to bottom
    },

    getUnallocatedGroupArea: (groupId) => {
      const state = get();
      const projectState = useProjectStore.getState();
      const group = projectState.groups[groupId];
      if (!group) return 0;
      
      // Calculate group's total area
      const groupNodes = group.members.map(id => projectState.nodes[id]).filter(Boolean);
      const groupTotalArea = groupNodes.reduce((sum, node) => {
        const derived = projectState.getNodeDerived(node.id);
        return sum + (derived?.totalArea ?? 0);
      }, 0);
      
      // Calculate already allocated area
      const allocatedArea = Object.values(state.sections)
        .filter(s => s.groupId === groupId)
        .reduce((sum, s) => sum + s.areaAllocation, 0);
      
      return Math.max(0, groupTotalArea - allocatedArea);
    },

    // ==========================================
    // CLEAR
    // ==========================================

    clearAll: () => {
      const timestamp = now();
      set((state) => {
        state.levels = {};
        state.sections = {};
        state.selectedLevelId = null;
        state.selectedSectionIds = [];
        
        // Sync to active option
        if (state.activeOptionId && state.options[state.activeOptionId]) {
          state.options[state.activeOptionId].levels = {};
          state.options[state.activeOptionId].sections = {};
          state.options[state.activeOptionId].modifiedAt = timestamp;
        }
      });
    },
  }))
);

// Register store globally for cross-store access (avoids circular imports)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__levelsStore = useLevelsStore;
