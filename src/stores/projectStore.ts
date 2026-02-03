import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuidv4 } from 'uuid';
import type {
  UUID,
  ProjectMeta,
  RawInputs,
  StepId,
  AreaNode,
  Group,
  CreateAreaNodeInput,
  UpdateAreaNodeInput,
  CreateGroupInput,
  UpdateGroupInput,
  AreaNodeDerived,
} from '@/types';
import { GROUP_COLORS } from '@/types';
import { useHistoryStore } from './historyStore';

// ============================================
// STATE INTERFACE
// ============================================

interface ProjectState {
  // Meta
  meta: ProjectMeta;
  rawInputs: RawInputs;
  
  // Area Layer
  nodes: Record<UUID, AreaNode>;
  
  // Grouping Layer
  groups: Record<UUID, Group>;
  
  // Actions - Meta
  setProjectName: (name: string) => void;
  setCurrentStep: (step: StepId) => void;
  
  // Actions - Area Nodes
  createNode: (input: CreateAreaNodeInput) => UUID;
  updateNode: (id: UUID, input: UpdateAreaNodeInput) => void;
  deleteNode: (id: UUID) => void;
  duplicateNode: (id: UUID) => UUID | null;
  mergeNodes: (nodeIds: UUID[], newName: string) => UUID | null;
  
  // Split Actions
  splitNodeByQuantity: (nodeId: UUID, quantities: number[]) => UUID[];
  splitNodeByEqual: (nodeId: UUID, parts: number) => UUID[];
  splitNodeByAreas: (nodeId: UUID, areas: Array<{ name: string; area: number }>) => UUID[];
  splitNodeByProportion: (nodeId: UUID, percentages: Array<{ name: string; percent: number }>) => UUID[];
  mergeToSingleUnit: (nodeId: UUID) => void;
  
  // Actions - Groups
  createGroup: (input: CreateGroupInput) => UUID;
  updateGroup: (id: UUID, input: UpdateGroupInput) => void;
  deleteGroup: (id: UUID) => void;
  assignToGroup: (groupId: UUID, nodeIds: UUID[]) => void;
  removeFromGroup: (groupId: UUID, nodeIds: UUID[]) => void;
  
  // Derived Values
  getNodeDerived: (id: UUID) => AreaNodeDerived | null;
  getUngroupedNodes: () => AreaNode[];
  getTotalArea: () => number;
  
  // Serialization
  exportProject: () => string;
  importProject: (json: string) => boolean;
  resetProject: () => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function now(): string {
  return new Date().toISOString();
}

function createInitialState(): Pick<ProjectState, 'meta' | 'rawInputs' | 'nodes' | 'groups'> {
  return {
    meta: {
      id: uuidv4(),
      name: 'Untitled Project',
      createdAt: now(),
      modifiedAt: now(),
      currentStep: 1,
    },
    rawInputs: {
      briefText: null,
      uploadedFiles: [],
    },
    nodes: {},
    groups: {},
  };
}

// ============================================
// STORE
// ============================================

export const useProjectStore = create<ProjectState>()(
  immer((set, get) => ({
    ...createInitialState(),

    // ==========================================
    // META ACTIONS
    // ==========================================

    setProjectName: (name) => {
      set((state) => {
        state.meta.name = name;
        state.meta.modifiedAt = now();
      });
    },

    setCurrentStep: (step) => {
      set((state) => {
        state.meta.currentStep = step;
      });
    },

    // ==========================================
    // AREA NODE ACTIONS
    // ==========================================

    createNode: (input) => {
      // Validate: count must be >= 1 and areaPerUnit must be > 0
      if (input.count < 1 || input.areaPerUnit <= 0) {
        return '' as UUID; // Return empty - invalid input
      }

      const id = uuidv4();
      const timestamp = now();
      
      set((state) => {
        state.nodes[id] = {
          id,
          name: input.name,
          areaPerUnit: input.areaPerUnit,
          count: input.count,
          aiNote: null,
          userNote: input.userNote ?? null,
          lockedFields: [],
          createdAt: timestamp,
          modifiedAt: timestamp,
          createdBy: 'user',
        };
        state.meta.modifiedAt = timestamp;
      });

      // Snapshot after state change
      const state = get();
      useHistoryStore.getState().snapshot('create_node', `Created "${input.name}"`, {
        nodes: state.nodes,
        groups: state.groups,
      });

      return id;
    },

    updateNode: (id, input) => {
      const node = get().nodes[id];
      if (!node) return;

      // Check locked fields
      const updates = { ...input };
      for (const field of node.lockedFields) {
        delete updates[field as keyof UpdateAreaNodeInput];
      }

      set((state) => {
        const node = state.nodes[id];
        if (!node) return;

        if (updates.name !== undefined) node.name = updates.name;
        if (updates.areaPerUnit !== undefined && updates.areaPerUnit > 0) node.areaPerUnit = updates.areaPerUnit;
        if (updates.count !== undefined && updates.count >= 1) node.count = updates.count;
        if (updates.userNote !== undefined) node.userNote = updates.userNote;
        if (updates.lockedFields !== undefined) node.lockedFields = updates.lockedFields;
        
        node.modifiedAt = now();
        state.meta.modifiedAt = now();
      });

      const state = get();
      useHistoryStore.getState().snapshot('update_node', `Updated "${node.name}"`, {
        nodes: state.nodes,
        groups: state.groups,
      });
    },

    deleteNode: (id) => {
      const node = get().nodes[id];
      if (!node) return;

      set((state) => {
        // Remove from groups
        for (const group of Object.values(state.groups)) {
          group.members = group.members.filter(nodeId => nodeId !== id);
        }

        // Delete node
        delete state.nodes[id];
        state.meta.modifiedAt = now();
      });

      const state = get();
      useHistoryStore.getState().snapshot('delete_node', `Deleted "${node.name}"`, {
        nodes: state.nodes,
        groups: state.groups,
      });
    },

    duplicateNode: (id) => {
      const node = get().nodes[id];
      if (!node) return null;

      const newId = uuidv4();
      const timestamp = now();

      set((state) => {
        state.nodes[newId] = {
          ...node,
          id: newId,
          name: `${node.name} (copy)`,
          createdAt: timestamp,
          modifiedAt: timestamp,
        };
        state.meta.modifiedAt = timestamp;
      });

      const state = get();
      useHistoryStore.getState().snapshot('duplicate_node', `Duplicated "${node.name}"`, {
        nodes: state.nodes,
        groups: state.groups,
      });

      return newId;
    },

    // ==========================================
    // SPLIT BY QUANTITY ACTION
    // ==========================================

    splitNodeByQuantity: (nodeId, quantities) => {
      const node = get().nodes[nodeId];
      if (!node) return [];
      
      // Validate: must have at least 2 quantities
      if (quantities.length < 2) return [];
      
      // Validate: sum must equal node.count
      const total = quantities.reduce((sum, q) => sum + q, 0);
      if (total !== node.count) return [];
      
      // Validate: all quantities must be >= 1
      if (quantities.some(q => q < 1)) return [];

      const ids: UUID[] = [];
      const timestamp = now();

      set((state) => {
        // Create new nodes for each quantity
        for (let i = 0; i < quantities.length; i++) {
          const id = uuidv4();
          ids.push(id);
          state.nodes[id] = {
            id,
            name: `${node.name} (${i + 1})`,
            areaPerUnit: node.areaPerUnit,
            count: quantities[i],
            aiNote: null,
            userNote: null,
            lockedFields: [],
            createdAt: timestamp,
            modifiedAt: timestamp,
            createdBy: 'user',
          };
        }

        // Remove original node from groups
        for (const group of Object.values(state.groups)) {
          group.members = group.members.filter(id => id !== nodeId);
        }

        // Delete original node
        delete state.nodes[nodeId];
        state.meta.modifiedAt = timestamp;
      });

      const state = get();
      useHistoryStore.getState().snapshot('split_by_quantity', `Split "${node.name}" by quantity into ${quantities.length} areas`, {
        nodes: state.nodes,
        groups: state.groups,
      });

      return ids;
    },

    // ==========================================
    // SPLIT BY EQUAL PARTS ACTION
    // ==========================================

    splitNodeByEqual: (nodeId, parts) => {
      const node = get().nodes[nodeId];
      if (!node) return [];
      if (parts < 2) return [];

      const totalArea = node.areaPerUnit * node.count;
      const areaEachRaw = totalArea / parts;
      const areaEachRounded = Math.round(areaEachRaw);
      const roundedTotal = areaEachRounded * parts;
      const diff = totalArea - roundedTotal;

      const ids: UUID[] = [];
      const timestamp = now();

      set((state) => {
        for (let i = 0; i < parts; i++) {
          const id = uuidv4();
          ids.push(id);
          state.nodes[id] = {
            id,
            name: `${node.name} ${String.fromCharCode(65 + i)}`,
            areaPerUnit: i === parts - 1 ? areaEachRounded + diff : areaEachRounded,
            count: 1,
            aiNote: null,
            userNote: null,
            lockedFields: [],
            createdAt: timestamp,
            modifiedAt: timestamp,
            createdBy: 'user',
          };
        }

        // Remove original node from groups
        for (const group of Object.values(state.groups)) {
          group.members = group.members.filter(id => id !== nodeId);
        }

        delete state.nodes[nodeId];
        state.meta.modifiedAt = timestamp;
      });

      const state = get();
      useHistoryStore.getState().snapshot('split_by_equal', `Split "${node.name}" into ${parts} equal parts`, {
        nodes: state.nodes,
        groups: state.groups,
      });

      return ids;
    },

    // ==========================================
    // SPLIT BY AREAS ACTION
    // ==========================================

    splitNodeByAreas: (nodeId, areas) => {
      const node = get().nodes[nodeId];
      if (!node) return [];
      if (areas.length < 2) return [];

      const totalArea = node.areaPerUnit * node.count;
      const areaSum = areas.reduce((sum, a) => sum + a.area, 0);
      
      // Validate total area matches (with small tolerance)
      if (Math.abs(areaSum - totalArea) > 1) return [];

      const ids: UUID[] = [];
      const timestamp = now();

      set((state) => {
        for (const split of areas) {
          const id = uuidv4();
          ids.push(id);
          state.nodes[id] = {
            id,
            name: split.name,
            areaPerUnit: split.area,
            count: 1,
            aiNote: null,
            userNote: null,
            lockedFields: [],
            createdAt: timestamp,
            modifiedAt: timestamp,
            createdBy: 'user',
          };
        }

        // Remove original node from groups
        for (const group of Object.values(state.groups)) {
          group.members = group.members.filter(id => id !== nodeId);
        }

        delete state.nodes[nodeId];
        state.meta.modifiedAt = timestamp;
      });

      const state = get();
      useHistoryStore.getState().snapshot('split_by_area', `Split "${node.name}" into ${areas.length} areas`, {
        nodes: state.nodes,
        groups: state.groups,
      });

      return ids;
    },

    // ==========================================
    // SPLIT BY PROPORTION ACTION
    // ==========================================

    splitNodeByProportion: (nodeId, percentages) => {
      const node = get().nodes[nodeId];
      if (!node) return [];
      if (percentages.length < 2) return [];

      const totalPercent = percentages.reduce((sum, p) => sum + p.percent, 0);
      
      // Validate percentages sum to ~100
      if (Math.abs(totalPercent - 100) > 0.1) return [];

      const totalArea = node.areaPerUnit * node.count;
      const ids: UUID[] = [];
      const timestamp = now();

      set((state) => {
        for (const split of percentages) {
          const id = uuidv4();
          ids.push(id);
          const area = (split.percent / 100) * totalArea;
          state.nodes[id] = {
            id,
            name: split.name,
            areaPerUnit: Math.round(area),
            count: 1,
            aiNote: null,
            userNote: null,
            lockedFields: [],
            createdAt: timestamp,
            modifiedAt: timestamp,
            createdBy: 'user',
          };
        }

        // Remove original node from groups
        for (const group of Object.values(state.groups)) {
          group.members = group.members.filter(id => id !== nodeId);
        }

        delete state.nodes[nodeId];
        state.meta.modifiedAt = timestamp;
      });

      const state = get();
      useHistoryStore.getState().snapshot('split_by_proportion', `Split "${node.name}" by proportion into ${percentages.length} areas`, {
        nodes: state.nodes,
        groups: state.groups,
      });

      return ids;
    },

    // ==========================================
    // MERGE TO SINGLE UNIT ACTION
    // ==========================================

    mergeToSingleUnit: (nodeId) => {
      const node = get().nodes[nodeId];
      if (!node || node.count === 1) return;

      const originalCount = node.count;
      const totalArea = node.areaPerUnit * node.count;

      set((state) => {
        const n = state.nodes[nodeId];
        if (n) {
          n.areaPerUnit = totalArea; // Total area becomes the single unit's area
          n.count = 1;
          n.modifiedAt = now();
        }
        state.meta.modifiedAt = now();
      });

      const state = get();
      useHistoryStore.getState().snapshot('merge_to_single', `Merged ${originalCount} units into single ${totalArea}m² area`, {
        nodes: state.nodes,
        groups: state.groups,
      });
    },

    mergeNodes: (nodeIds, newName) => {
      if (nodeIds.length < 2) return null;

      // Get all nodes
      const nodesToMerge = nodeIds.map(id => get().nodes[id]).filter(Boolean);
      if (nodesToMerge.length !== nodeIds.length) return null;

      // Calculate totals
      const totalCount = nodesToMerge.reduce((sum, n) => sum + n.count, 0);
      const totalArea = nodesToMerge.reduce((sum, n) => sum + (n.areaPerUnit * n.count), 0);
      const avgAreaPerUnit = totalArea / totalCount;

      const newId = uuidv4();
      const timestamp = now();

      set((state) => {
        // Create merged node
        state.nodes[newId] = {
          id: newId,
          name: newName,
          areaPerUnit: avgAreaPerUnit,
          count: totalCount,
          lockedFields: [],
          aiNote: null,
          userNote: `Merged from: ${nodesToMerge.map(n => n.name).join(', ')}`,
          createdAt: timestamp,
          modifiedAt: timestamp,
          createdBy: 'user',
        };

        // Delete original nodes
        for (const nodeId of nodeIds) {
          // Remove from groups
          for (const group of Object.values(state.groups)) {
            group.members = group.members.filter(id => id !== nodeId);
          }
          delete state.nodes[nodeId];
        }

        state.meta.modifiedAt = timestamp;
      });

      const state = get();
      useHistoryStore.getState().snapshot('merge_nodes', `Merged ${nodeIds.length} areas into "${newName}"`, {
        nodes: state.nodes,
        groups: state.groups,
      });

      return newId;
    },

    // ==========================================
    // GROUP ACTIONS
    // ==========================================

    createGroup: (input) => {
      const id = uuidv4();
      const timestamp = now();
      const colorIndex = Object.keys(get().groups).length % GROUP_COLORS.length;

      set((state) => {
        state.groups[id] = {
          id,
          name: input.name,
          color: input.color ?? GROUP_COLORS[colorIndex],
          members: [],
          aiNote: null,
          userNote: null,
          createdAt: timestamp,
          modifiedAt: timestamp,
        };
        state.meta.modifiedAt = timestamp;
      });

      const state = get();
      useHistoryStore.getState().snapshot('create_group', `Created group "${input.name}"`, {
        nodes: state.nodes,
        groups: state.groups,
      });

      return id;
    },

    updateGroup: (id, input) => {
      const group = get().groups[id];
      if (!group) return;

      set((state) => {
        const g = state.groups[id];
        if (!g) return;

        if (input.name !== undefined) g.name = input.name;
        if (input.color !== undefined) g.color = input.color;
        if (input.userNote !== undefined) g.userNote = input.userNote;
        
        g.modifiedAt = now();
        state.meta.modifiedAt = now();
      });

      const state = get();
      useHistoryStore.getState().snapshot('update_group', `Updated group "${group.name}"`, {
        nodes: state.nodes,
        groups: state.groups,
      });
    },

    deleteGroup: (id) => {
      const group = get().groups[id];
      if (!group) return;

      set((state) => {
        delete state.groups[id];
        state.meta.modifiedAt = now();
      });

      const state = get();
      useHistoryStore.getState().snapshot('delete_group', `Deleted group "${group.name}"`, {
        nodes: state.nodes,
        groups: state.groups,
      });
    },

    assignToGroup: (groupId, nodeIds) => {
      const group = get().groups[groupId];
      if (!group) return;

      set((state) => {
        for (const nodeId of nodeIds) {
          // Remove from any other group first
          for (const g of Object.values(state.groups)) {
            g.members = g.members.filter(id => id !== nodeId);
          }
          // Add to target group
          if (!state.groups[groupId].members.includes(nodeId)) {
            state.groups[groupId].members.push(nodeId);
          }
        }
        state.meta.modifiedAt = now();
      });

      const state = get();
      useHistoryStore.getState().snapshot('assign_to_group', `Assigned to "${group.name}"`, {
        nodes: state.nodes,
        groups: state.groups,
      });
    },

    removeFromGroup: (groupId, nodeIds) => {
      const group = get().groups[groupId];
      if (!group) return;

      set((state) => {
        const g = state.groups[groupId];
        if (!g) return;
        g.members = g.members.filter(id => !nodeIds.includes(id));
        state.meta.modifiedAt = now();
      });

      const state = get();
      useHistoryStore.getState().snapshot('remove_from_group', `Removed from "${group.name}"`, {
        nodes: state.nodes,
        groups: state.groups,
      });
    },

    // ==========================================
    // DERIVED VALUES
    // ==========================================

    getNodeDerived: (id) => {
      const node = get().nodes[id];
      if (!node) return null;

      return {
        totalArea: node.areaPerUnit * node.count,
      };
    },

    getUngroupedNodes: () => {
      const groupedNodeIds = new Set<UUID>();
      for (const group of Object.values(get().groups)) {
        for (const nodeId of group.members) {
          groupedNodeIds.add(nodeId);
        }
      }
      return Object.values(get().nodes).filter(n => !groupedNodeIds.has(n.id));
    },

    getTotalArea: () => {
      return Object.values(get().nodes).reduce((sum, node) => sum + node.areaPerUnit * node.count, 0);
    },

    // ==========================================
    // SERIALIZATION
    // ==========================================

    exportProject: () => {
      const state = get();
      const data = {
        schema_version: '1.0.0',
        meta: state.meta,
        rawInputs: state.rawInputs,
        areaLayer: {
          nodes: state.nodes,
        },
        groupingLayer: {
          groups: state.groups,
        },
      };
      return JSON.stringify(data, null, 2);
    },

    importProject: (json) => {
      try {
        const data = JSON.parse(json);
        
        // Basic validation
        if (!data.schema_version || !data.meta || !data.areaLayer) {
          return false;
        }

        set((state) => {
          state.meta = data.meta;
          state.rawInputs = data.rawInputs || { briefText: null, uploadedFiles: [] };
          state.nodes = data.areaLayer.nodes || {};
          state.groups = data.groupingLayer?.groups || {};
        });

        const newState = get();
        useHistoryStore.getState().snapshot('import', 'Imported project', {
          nodes: newState.nodes,
          groups: newState.groups,
        });

        return true;
      } catch {
        return false;
      }
    },

    resetProject: () => {
      const initial = createInitialState();
      set((state) => {
        state.meta = initial.meta;
        state.rawInputs = initial.rawInputs;
        state.nodes = initial.nodes;
        state.groups = initial.groups;
      });

      useHistoryStore.getState().reset();
    },
  }))
);
