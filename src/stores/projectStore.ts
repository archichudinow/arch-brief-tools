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
  Note,
} from '@/types';
import { GROUP_COLORS } from '@/types';
import { useHistoryStore } from './historyStore';

// ============================================
// STATE INTERFACE
// ============================================

// Board layout types for persistence
export interface BoardComment {
  id: string;
  x: number;
  y: number;
  text: string;
}

export interface BoardLayout {
  groupPositions: Record<string, { x: number; y: number }>;
  groupSizeOverrides: Record<string, { width?: number; height?: number }>;
  areaOffsets: Record<string, { x: number; y: number }>;
  comments: BoardComment[];
}

interface ProjectState {
  // Meta
  meta: ProjectMeta;
  rawInputs: RawInputs;
  
  // Area Layer
  nodes: Record<UUID, AreaNode>;
  
  // Grouping Layer
  groups: Record<UUID, Group>;
  
  // Board Layout (positions, sizes, comments)
  boardLayout: BoardLayout;
  
  // Actions - Meta
  setProjectName: (name: string) => void;
  setCurrentStep: (step: StepId) => void;
  
  // Actions - Area Nodes
  createNode: (input: CreateAreaNodeInput) => UUID;
  updateNode: (id: UUID, input: UpdateAreaNodeInput) => void;
  deleteNode: (id: UUID) => void;
  duplicateNode: (id: UUID) => UUID | null;
  mergeNodes: (nodeIds: UUID[], newName: string) => UUID | null;
  
  // Instance Operations
  duplicateAsInstance: (id: UUID) => UUID | null;  // Creates linked copy
  duplicateAsCopy: (id: UUID) => UUID | null;      // Creates independent copy
  unlinkInstance: (id: UUID) => void;              // Breaks instance link
  
  // Quantity/Collapse Operations
  collapseNodes: (nodeIds: UUID[]) => UUID | null;      // Merge identical into one with sum quantity
  expandNode: (id: UUID) => UUID[];                      // Split into individual nodes
  splitQuantity: (id: UUID, quantities: number[]) => UUID[];  // Split quantity into groups
  mergeQuantities: (nodeIds: UUID[]) => UUID | null;          // Merge same-type groups
  collapseToArea: (id: UUID) => UUID | null;                  // Convert to totalArea × 1, break links
  
  // Container Operations
  convertToContainer: (nodeId: UUID) => void;            // Make node a container (children = [])
  addChildToContainer: (containerId: UUID, input: CreateAreaNodeInput) => UUID | null;  // Create area inside container
  moveToContainer: (nodeId: UUID, containerId: UUID | null) => void;  // Move node into container (null = root)
  unwrapContainer: (containerId: UUID) => UUID[];        // Move children to parent level, delete container
  collapseContainer: (containerId: UUID) => void;        // Collapse container: consume children, become simple area
  getContainerChildren: (containerId: UUID) => AreaNode[];  // Get direct children of container
  getTopLevelNodes: () => AreaNode[];                    // Get nodes not inside any container
  findParentContainer: (nodeId: UUID) => UUID | null;    // Find which container holds this node
  
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
  
  // Group Split/Merge Actions
  splitGroupEqual: (groupId: UUID, parts: number, nameSuffix?: string) => UUID[];
  splitGroupByProportion: (groupId: UUID, proportions: Array<{ name: string; percent: number }>) => UUID[];
  mergeGroupAreas: (groupId: UUID, newAreaName?: string) => UUID | null;
  
  // Actions - Notes
  addNoteToArea: (areaId: UUID, note: { source: 'brief' | 'ai' | 'user'; content: string; reason?: string }) => UUID | null;
  addNoteToGroup: (groupId: UUID, note: { source: 'brief' | 'ai' | 'user'; content: string; reason?: string }) => UUID | null;
  updateNote: (targetType: 'area' | 'group', targetId: UUID, noteId: UUID, content: string) => void;
  deleteNote: (targetType: 'area' | 'group', targetId: UUID, noteId: UUID) => void;
  
  // Actions - Board Layout
  setGroupPosition: (groupId: string, x: number, y: number) => void;
  setGroupSizeOverride: (groupId: string, size: { width?: number; height?: number }) => void;
  clearGroupSizeOverride: (groupId: string) => void;
  setAreaOffset: (areaId: string, x: number, y: number) => void;
  setAreaOffsets: (offsets: Record<string, { x: number; y: number }>) => void;
  clearAreaOffset: (areaId: string) => void;
  clearAreaOffsets: (areaIds: string[]) => void;
  addComment: (x: number, y: number, text?: string) => string;
  updateComment: (id: string, text: string) => void;
  deleteComment: (id: string) => void;
  moveComment: (id: string, x: number, y: number) => void;
  
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

// Shift a hex color's hue by a given amount (0-360)
function shiftHue(hexColor: string, shift: number): string {
  // Convert hex to RGB
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  // Convert RGB to HSL
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  // Shift hue
  h = (h + shift / 360) % 1;
  if (h < 0) h += 1;

  // Convert HSL back to RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  let r2: number, g2: number, b2: number;
  if (s === 0) {
    r2 = g2 = b2 = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r2 = hue2rgb(p, q, h + 1/3);
    g2 = hue2rgb(p, q, h);
    b2 = hue2rgb(p, q, h - 1/3);
  }

  // Convert back to hex
  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`;
}

function createInitialState(): Pick<ProjectState, 'meta' | 'rawInputs' | 'nodes' | 'groups' | 'boardLayout'> {
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
    boardLayout: {
      groupPositions: {},
      groupSizeOverrides: {},
      areaOffsets: {},
      comments: [],
    },
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
      
      // Build notes array from input notes
      const notes: Note[] = [];
      if (input.briefNote) {
        notes.push({
          id: uuidv4(),
          source: 'brief',
          content: input.briefNote,
          createdAt: timestamp,
          modifiedAt: timestamp,
        });
      }
      if (input.aiNote) {
        notes.push({
          id: uuidv4(),
          source: 'ai',
          content: input.aiNote,
          createdAt: timestamp,
          modifiedAt: timestamp,
        });
      }
      if (input.userNote) {
        notes.push({
          id: uuidv4(),
          source: 'user',
          content: input.userNote,
          createdAt: timestamp,
          modifiedAt: timestamp,
        });
      }
      
      set((state) => {
        state.nodes[id] = {
          id,
          name: input.name,
          areaPerUnit: input.areaPerUnit,
          count: input.count,
          notes, // Populated notes array
          // Formula-based reasoning (if provided)
          formulaReasoning: input.formulaReasoning || null,
          formulaConfidence: input.formulaConfidence || null,
          formulaType: input.formulaType || null,
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
      const state = get();
      const node = state.nodes[id];
      if (!node) return;

      console.debug('[updateNode] Called for:', node.name, 'id:', id, 'input:', input);

      // Check locked fields
      const updates = { ...input };
      for (const field of node.lockedFields) {
        delete updates[field as keyof UpdateAreaNodeInput];
      }

      // If this is an instance and we're updating areaPerUnit, 
      // redirect the update to the source node (which updates all instances)
      if (node.instanceOf && updates.areaPerUnit !== undefined) {
        const sourceNode = state.nodes[node.instanceOf];
        if (sourceNode) {
          console.debug('[updateNode] Instance detected! Redirecting areaPerUnit update to source:', sourceNode.name, 'sourceId:', node.instanceOf);
          console.debug('[updateNode] Old source areaPerUnit:', sourceNode.areaPerUnit, '-> New:', updates.areaPerUnit);
          
          // Update source instead - this propagates to all instances
          set((state) => {
            const source = state.nodes[node.instanceOf!];
            if (source && updates.areaPerUnit !== undefined && updates.areaPerUnit > 0) {
              source.areaPerUnit = updates.areaPerUnit;
              source.modifiedAt = now();
              console.debug('[updateNode] Source updated successfully. New areaPerUnit:', source.areaPerUnit);
            }
            // Still update other fields on this node (like count, name)
            const thisNode = state.nodes[id];
            if (thisNode) {
              if (updates.name !== undefined) thisNode.name = updates.name;
              if (updates.count !== undefined && updates.count >= 1) thisNode.count = updates.count;
              if (updates.userNote !== undefined) thisNode.userNote = updates.userNote;
              if (updates.lockedFields !== undefined) thisNode.lockedFields = updates.lockedFields;
              if (updates.instanceOf !== undefined) thisNode.instanceOf = updates.instanceOf;
              thisNode.modifiedAt = now();
            }
            state.meta.modifiedAt = now();
          });

          const newState = get();
          useHistoryStore.getState().snapshot('update_node', `Updated "${sourceNode.name}" (via instance)`, {
            nodes: newState.nodes,
            groups: newState.groups,
          });
          return;
        }
      }

      set((state) => {
        const node = state.nodes[id];
        if (!node) return;

        if (updates.name !== undefined) node.name = updates.name;
        if (updates.areaPerUnit !== undefined && updates.areaPerUnit > 0) node.areaPerUnit = updates.areaPerUnit;
        if (updates.count !== undefined && updates.count >= 1) node.count = updates.count;
        if (updates.userNote !== undefined) node.userNote = updates.userNote;
        if (updates.lockedFields !== undefined) node.lockedFields = updates.lockedFields;
        if (updates.instanceOf !== undefined) node.instanceOf = updates.instanceOf;
        
        node.modifiedAt = now();
        state.meta.modifiedAt = now();
      });

      const newState = get();
      useHistoryStore.getState().snapshot('update_node', `Updated "${node.name}"`, {
        nodes: newState.nodes,
        groups: newState.groups,
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
    // INSTANCE OPERATIONS
    // ==========================================

    // Creates a linked copy - inherits areaPerUnit from source
    duplicateAsInstance: (id) => {
      const node = get().nodes[id];
      if (!node) return null;

      const newId = uuidv4();
      const timestamp = now();
      
      // Source is either node's own source (if already instance) or the node itself
      const sourceId = node.instanceOf ?? id;
      
      // Find which group the original belongs to
      const state = get();
      const originalGroupId = Object.keys(state.groups).find(gid => 
        state.groups[gid].members.includes(id)
      );

      set((state) => {
        // If original doesn't have instanceOf yet, add self-reference to join the family
        if (!node.instanceOf) {
          const original = state.nodes[id];
          if (original) {
            original.instanceOf = id; // Self-reference indicates it's the source of truth
            original.modifiedAt = timestamp;
          }
        }
        
        state.nodes[newId] = {
          ...node,
          id: newId,
          name: node.name, // Keep same name for instances
          instanceOf: sourceId,
          createdAt: timestamp,
          modifiedAt: timestamp,
        };
        
        // Add to same group as original
        if (originalGroupId && state.groups[originalGroupId]) {
          state.groups[originalGroupId].members.push(newId);
        }
        state.meta.modifiedAt = timestamp;
      });

      const newState = get();
      useHistoryStore.getState().snapshot('duplicate_instance', `Created instance of "${node.name}"`, {
        nodes: newState.nodes,
        groups: newState.groups,
      });

      return newId;
    },

    // Creates an independent copy - no link
    duplicateAsCopy: (id) => {
      const node = get().nodes[id];
      if (!node) return null;

      const newId = uuidv4();
      const timestamp = now();
      
      // Get effective area (from source if instance)
      const state = get();
      const sourceNode = node.instanceOf ? state.nodes[node.instanceOf] : null;
      const effectiveArea = sourceNode ? sourceNode.areaPerUnit : node.areaPerUnit;
      
      // Find which group the original belongs to
      const originalGroupId = Object.keys(state.groups).find(gid => 
        state.groups[gid].members.includes(id)
      );

      set((state) => {
        state.nodes[newId] = {
          ...node,
          id: newId,
          name: `${node.name} (copy)`,
          areaPerUnit: effectiveArea, // Copy the effective area
          instanceOf: null,           // No link
          createdAt: timestamp,
          modifiedAt: timestamp,
        };
        
        // Add to same group as original
        if (originalGroupId && state.groups[originalGroupId]) {
          state.groups[originalGroupId].members.push(newId);
        }
        state.meta.modifiedAt = timestamp;
      });

      const newState = get();
      useHistoryStore.getState().snapshot('duplicate_copy', `Copied "${node.name}"`, {
        nodes: newState.nodes,
        groups: newState.groups,
      });

      return newId;
    },

    // Breaks instance link - makes independent with current effective area
    unlinkInstance: (id) => {
      const node = get().nodes[id];
      if (!node || !node.instanceOf) return;

      const state = get();
      const sourceNode = state.nodes[node.instanceOf];
      const effectiveArea = sourceNode ? sourceNode.areaPerUnit : node.areaPerUnit;
      const timestamp = now();

      set((state) => {
        state.nodes[id].areaPerUnit = effectiveArea;
        state.nodes[id].instanceOf = null;
        state.nodes[id].modifiedAt = timestamp;
        state.meta.modifiedAt = timestamp;
      });

      const newState = get();
      useHistoryStore.getState().snapshot('unlink_instance', `Unlinked "${node.name}" from source`, {
        nodes: newState.nodes,
        groups: newState.groups,
      });
    },

    // ==========================================
    // QUANTITY/COLLAPSE OPERATIONS
    // ==========================================

    // Collapse identical nodes into one with sum quantity
    collapseNodes: (nodeIds) => {
      if (nodeIds.length < 2) return null;
      
      const state = get();
      const nodes = nodeIds.map(id => state.nodes[id]).filter(Boolean);
      if (nodes.length < 2) return null;
      
      // All must have same instanceOf (or be instances of first node, or all independent with same area)
      const firstNode = nodes[0];
      const sourceId = firstNode.instanceOf ?? firstNode.id;
      
      // Verify all are compatible (same type)
      const allCompatible = nodes.every(n => {
        if (n.instanceOf) return n.instanceOf === sourceId || n.instanceOf === firstNode.id;
        return n.id === sourceId || 
               (n.areaPerUnit === firstNode.areaPerUnit && !firstNode.instanceOf);
      });
      
      if (!allCompatible) {
        console.warn('Cannot collapse nodes of different types');
        return null;
      }
      
      const totalQuantity = nodes.reduce((sum, n) => sum + n.count, 0);
      const newId = uuidv4();
      const timestamp = now();
      
      // Find which group any of the original nodes belong to (use first found)
      const originalGroupId = Object.keys(state.groups).find(gid => 
        nodeIds.some(nid => state.groups[gid].members.includes(nid))
      );

      set((state) => {
        // Create collapsed node
        state.nodes[newId] = {
          ...firstNode,
          id: newId,
          count: totalQuantity,
          instanceOf: firstNode.instanceOf ?? null,
          createdAt: timestamp,
          modifiedAt: timestamp,
        };
        
        // Remove originals from groups and delete them
        for (const id of nodeIds) {
          for (const group of Object.values(state.groups)) {
            group.members = group.members.filter(mid => mid !== id);
          }
          delete state.nodes[id];
        }
        
        // Add new node to same group
        if (originalGroupId && state.groups[originalGroupId]) {
          state.groups[originalGroupId].members.push(newId);
        }
        
        state.meta.modifiedAt = timestamp;
      });

      const newState = get();
      useHistoryStore.getState().snapshot('collapse_nodes', `Collapsed ${nodeIds.length} nodes into "${firstNode.name} ×${totalQuantity}"`, {
        nodes: newState.nodes,
        groups: newState.groups,
      });

      return newId;
    },

    // Expand collapsed node into individual nodes
    expandNode: (id) => {
      const state = get();
      const node = state.nodes[id];
      if (!node || node.count <= 1) return [id];

      const newIds: UUID[] = [];
      const timestamp = now();
      
      // Check if this node is part of an instance family
      const hasInstanceFamily = !!node.instanceOf;
      // Check if this node is the source of truth for a family
      const isSourceOfTruth = node.instanceOf === id;
      const existingSourceId = node.instanceOf;
      
      // Find all other nodes that point to this source (if we are the source)
      const otherFamilyMembers = isSourceOfTruth 
        ? Object.values(state.nodes).filter(n => n.instanceOf === id && n.id !== id)
        : [];
      
      // Find which group the original belongs to
      const originalGroupId = Object.keys(state.groups).find(gid => 
        state.groups[gid].members.includes(id)
      );

      set((state) => {
        // Generate all new IDs first
        for (let i = 0; i < node.count; i++) {
          newIds.push(uuidv4());
        }
        
        // Determine the source ID for the expanded nodes:
        // 1. If this was the source, first expanded node becomes new source
        // 2. If this was an instance, keep pointing to the existing source
        // 3. If this had no family, first expanded node becomes new source (creates new family)
        const newSourceId = hasInstanceFamily 
          ? (isSourceOfTruth ? newIds[0] : existingSourceId)
          : newIds[0]; // Create new family with first as source
        
        // Create individual nodes as instances
        for (let i = 0; i < node.count; i++) {
          const newId = newIds[i];
          state.nodes[newId] = {
            ...node,
            id: newId,
            count: 1,
            // First node becomes source (self-ref), others point to it
            instanceOf: (i === 0 && (isSourceOfTruth || !hasInstanceFamily)) ? newId : newSourceId,
            createdAt: timestamp,
            modifiedAt: timestamp,
          };
        }
        
        // If we were the source, update all other family members to point to new source
        if (isSourceOfTruth && newSourceId) {
          for (const member of otherFamilyMembers) {
            const memberNode = state.nodes[member.id];
            if (memberNode) {
              memberNode.instanceOf = newSourceId;
              memberNode.modifiedAt = timestamp;
            }
          }
        }
        
        // Remove original from groups and add new nodes to same group
        for (const group of Object.values(state.groups)) {
          group.members = group.members.filter(mid => mid !== id);
        }
        if (originalGroupId && state.groups[originalGroupId]) {
          state.groups[originalGroupId].members.push(...newIds);
        }
        
        // Delete original collapsed node
        delete state.nodes[id];
        state.meta.modifiedAt = timestamp;
      });

      const newState = get();
      useHistoryStore.getState().snapshot('expand_node', `Expanded "${node.name}" into ${node.count} individual nodes`, {
        nodes: newState.nodes,
        groups: newState.groups,
      });

      return newIds;
    },

    // Split quantity into specified groups (e.g., 100 → [60, 40])
    splitQuantity: (id, quantities) => {
      const state = get();
      const node = state.nodes[id];
      if (!node) return [];
      
      const total = quantities.reduce((a, b) => a + b, 0);
      if (total !== node.count) {
        console.warn(`Quantities sum (${total}) must equal node count (${node.count})`);
        return [];
      }
      
      if (quantities.some(q => q < 1)) {
        console.warn('All quantities must be >= 1');
        return [];
      }

      const newIds: UUID[] = [];
      const timestamp = now();
      
      // Check if this node is part of an instance family
      const hasInstanceFamily = !!node.instanceOf;
      const isSourceOfTruth = node.instanceOf === id;
      const existingSourceId = node.instanceOf;
      
      // Find all other nodes that point to this source (if we are the source)
      const otherFamilyMembers = isSourceOfTruth 
        ? Object.values(state.nodes).filter(n => n.instanceOf === id && n.id !== id)
        : [];
      
      // Find which group the original belongs to
      const originalGroupId = Object.keys(state.groups).find(gid => 
        state.groups[gid].members.includes(id)
      );

      set((state) => {
        // Generate all IDs first
        quantities.forEach(() => newIds.push(uuidv4()));
        
        // Determine the source ID for split nodes
        const newSourceId = hasInstanceFamily 
          ? (isSourceOfTruth ? newIds[0] : existingSourceId)
          : newIds[0]; // Create new family with first as source
        
        quantities.forEach((qty, i) => {
          const newId = newIds[i];
          state.nodes[newId] = {
            ...node,
            id: newId,
            name: i === 0 ? node.name : `${node.name} (${i + 1})`,
            count: qty,
            // First node becomes source (self-ref), others point to it
            instanceOf: (i === 0 && (isSourceOfTruth || !hasInstanceFamily)) ? newId : newSourceId,
            createdAt: timestamp,
            modifiedAt: timestamp,
          };
        });
        
        // If we were the source, update all other family members to point to new source
        if (isSourceOfTruth && newSourceId) {
          for (const member of otherFamilyMembers) {
            const memberNode = state.nodes[member.id];
            if (memberNode) {
              memberNode.instanceOf = newSourceId;
              memberNode.modifiedAt = timestamp;
            }
          }
        }
        
        // Remove original from groups and add new nodes to same group
        for (const group of Object.values(state.groups)) {
          group.members = group.members.filter(mid => mid !== id);
        }
        if (originalGroupId && state.groups[originalGroupId]) {
          state.groups[originalGroupId].members.push(...newIds);
        }
        
        delete state.nodes[id];
        state.meta.modifiedAt = timestamp;
      });

      const newState = get();
      useHistoryStore.getState().snapshot('split_quantity', `Split "${node.name}" into ${quantities.length} groups`, {
        nodes: newState.nodes,
        groups: newState.groups,
      });

      return newIds;
    },

    // Merge groups of same type (sums quantities)
    mergeQuantities: (nodeIds) => {
      if (nodeIds.length < 2) return null;
      
      const state = get();
      const nodes = nodeIds.map(id => state.nodes[id]).filter(Boolean);
      if (nodes.length < 2) return null;
      
      // Verify all reference same source
      const sourceIds = new Set(nodes.map(n => n.instanceOf ?? n.id));
      if (sourceIds.size > 1) {
        // Check if they're independent with same areaPerUnit
        const areas = new Set(nodes.map(n => n.areaPerUnit));
        if (areas.size > 1 || nodes.some(n => n.instanceOf)) {
          console.warn('Can only merge nodes of same type');
          return null;
        }
      }
      
      const totalQty = nodes.reduce((sum, n) => sum + n.count, 0);
      const newId = uuidv4();
      const timestamp = now();
      
      // Find which group any of the original nodes belong to (use first found)
      const originalGroupId = Object.keys(state.groups).find(gid => 
        nodeIds.some(nid => state.groups[gid].members.includes(nid))
      );

      set((state) => {
        state.nodes[newId] = {
          ...nodes[0],
          id: newId,
          count: totalQty,
          createdAt: timestamp,
          modifiedAt: timestamp,
        };
        
        // Remove originals from groups and delete them
        for (const id of nodeIds) {
          for (const group of Object.values(state.groups)) {
            group.members = group.members.filter(mid => mid !== id);
          }
          delete state.nodes[id];
        }
        
        // Add new node to same group
        if (originalGroupId && state.groups[originalGroupId]) {
          state.groups[originalGroupId].members.push(newId);
        }
        
        state.meta.modifiedAt = timestamp;
      });

      const newState = get();
      useHistoryStore.getState().snapshot('merge_quantities', `Merged ${nodeIds.length} groups into "${nodes[0].name} ×${totalQty}"`, {
        nodes: newState.nodes,
        groups: newState.groups,
      });

      return newId;
    },

    // Collapse to single area: converts to totalArea × 1, breaks all instance links
    collapseToArea: (id) => {
      const state = get();
      const node = state.nodes[id];
      if (!node) return null;

      // Get effective area per unit (from source if instance)
      const sourceNode = node.instanceOf ? state.nodes[node.instanceOf] : null;
      const effectiveAreaPerUnit = sourceNode ? sourceNode.areaPerUnit : node.areaPerUnit;
      const totalArea = effectiveAreaPerUnit * node.count;

      const timestamp = now();

      set((state) => {
        const n = state.nodes[id];
        if (!n) return;

        // Convert to total area as single unit
        n.areaPerUnit = Math.round(totalArea);
        n.count = 1;
        
        // Break instance link
        n.instanceOf = null;
        
        // Copy reasoning from source if it was an instance
        if (sourceNode) {
          n.formulaReasoning = sourceNode.formulaReasoning ?? n.formulaReasoning;
          n.formulaConfidence = sourceNode.formulaConfidence ?? n.formulaConfidence;
          n.formulaType = sourceNode.formulaType ?? n.formulaType;
        }
        
        n.modifiedAt = timestamp;
        state.meta.modifiedAt = timestamp;
      });

      const newState = get();
      useHistoryStore.getState().snapshot('collapse_to_area', `Collapsed "${node.name}" to ${totalArea.toLocaleString()}m²`, {
        nodes: newState.nodes,
        groups: newState.groups,
      });

      return id;
    },

    // ==========================================
    // CONTAINER OPERATIONS
    // ==========================================

    // Convert a node to a container (moves original area inside as first child)
    convertToContainer: (nodeId) => {
      const node = get().nodes[nodeId];
      if (!node) return;
      
      // Already a container
      if (Array.isArray(node.children)) return;
      
      const timestamp = now();
      const childId = uuidv4();
      
      // Store original values before converting
      const originalArea = node.areaPerUnit;
      const originalCount = node.count;
      const originalName = node.name;
      
      set((state) => {
        const n = state.nodes[nodeId];
        if (!n) return;
        
        // Create child node with the original area values
        state.nodes[childId] = {
          id: childId,
          name: `${originalName} Area`, // e.g., "Apartment Area"
          areaPerUnit: originalArea,
          count: originalCount,
          notes: [],
          formulaReasoning: n.formulaReasoning,
          formulaConfidence: n.formulaConfidence,
          formulaType: n.formulaType,
          lockedFields: [],
          createdAt: timestamp,
          modifiedAt: timestamp,
          createdBy: 'user',
        };
        
        // Convert parent to container
        n.children = [childId];
        // Reset areaPerUnit since it will now be computed from children
        n.areaPerUnit = 0;
        n.count = 1; // Container always count=1
        n.modifiedAt = timestamp;
        state.meta.modifiedAt = timestamp;
      });
      
      const newState = get();
      useHistoryStore.getState().snapshot('convert_to_container', `Converted "${node.name}" to container (moved ${originalArea * originalCount}m² inside)`, {
        nodes: newState.nodes,
        groups: newState.groups,
      });
    },

    // Create a new area node inside a container
    addChildToContainer: (containerId, input) => {
      const state = get();
      const container = state.nodes[containerId];
      
      // Must be a valid container
      if (!container || !Array.isArray(container.children)) {
        console.warn('[addChildToContainer] Not a valid container:', containerId);
        return null;
      }
      
      // Validate input
      if (input.count < 1 || input.areaPerUnit <= 0) {
        return null;
      }
      
      const id = uuidv4();
      const timestamp = now();
      
      // Build notes array from input
      const notes: Note[] = [];
      if (input.briefNote) {
        notes.push({
          id: uuidv4(),
          source: 'brief',
          content: input.briefNote,
          createdAt: timestamp,
          modifiedAt: timestamp,
        });
      }
      if (input.aiNote) {
        notes.push({
          id: uuidv4(),
          source: 'ai',
          content: input.aiNote,
          createdAt: timestamp,
          modifiedAt: timestamp,
        });
      }
      if (input.userNote) {
        notes.push({
          id: uuidv4(),
          source: 'user',
          content: input.userNote,
          createdAt: timestamp,
          modifiedAt: timestamp,
        });
      }
      
      set((state) => {
        // Create the child node
        state.nodes[id] = {
          id,
          name: input.name,
          areaPerUnit: input.areaPerUnit,
          count: input.count,
          notes,
          formulaReasoning: input.formulaReasoning || null,
          formulaConfidence: input.formulaConfidence || null,
          formulaType: input.formulaType || null,
          lockedFields: [],
          createdAt: timestamp,
          modifiedAt: timestamp,
          createdBy: 'user',
        };
        
        // Add to container's children
        const c = state.nodes[containerId];
        if (c && c.children) {
          c.children.push(id);
          c.modifiedAt = timestamp;
        }
        
        state.meta.modifiedAt = timestamp;
      });
      
      const newState = get();
      useHistoryStore.getState().snapshot('add_child_to_container', `Added "${input.name}" to "${container.name}"`, {
        nodes: newState.nodes,
        groups: newState.groups,
      });
      
      return id;
    },

    // Move a node into a container (or to root if containerId is null)
    moveToContainer: (nodeId, containerId) => {
      const state = get();
      const node = state.nodes[nodeId];
      if (!node) return;
      
      // Can't move a node into itself
      if (nodeId === containerId) return;
      
      // Validate target container (if not moving to root)
      if (containerId) {
        const targetContainer = state.nodes[containerId];
        if (!targetContainer || !Array.isArray(targetContainer.children)) {
          console.warn('[moveToContainer] Target is not a valid container:', containerId);
          return;
        }
        
        // Can't move container into its own descendant (would create cycle)
        const isDescendant = (checkId: UUID, ancestorId: UUID): boolean => {
          const checkNode = state.nodes[checkId];
          if (!checkNode?.children) return false;
          if (checkNode.children.includes(ancestorId)) return true;
          return checkNode.children.some(childId => isDescendant(childId, ancestorId));
        };
        if (node.children && isDescendant(nodeId, containerId)) {
          console.warn('[moveToContainer] Cannot move container into its own descendant');
          return;
        }
      }
      
      const timestamp = now();
      
      // Find current parent container
      const currentParentId = Object.keys(state.nodes).find(id => {
        const n = state.nodes[id];
        return n.children?.includes(nodeId);
      });
      
      set((state) => {
        // Remove from current parent (if any)
        if (currentParentId) {
          const parent = state.nodes[currentParentId];
          if (parent?.children) {
            parent.children = parent.children.filter(id => id !== nodeId);
            parent.modifiedAt = timestamp;
          }
        }
        
        // Add to new container (if not moving to root)
        if (containerId) {
          const newParent = state.nodes[containerId];
          if (newParent?.children) {
            newParent.children.push(nodeId);
            newParent.modifiedAt = timestamp;
          }
        }
        
        state.meta.modifiedAt = timestamp;
      });
      
      const newState = get();
      const actionLabel = containerId 
        ? `Moved "${node.name}" into "${state.nodes[containerId]?.name}"`
        : `Moved "${node.name}" to root level`;
      useHistoryStore.getState().snapshot('move_to_container', actionLabel, {
        nodes: newState.nodes,
        groups: newState.groups,
      });
    },

    // Unwrap container: move all children to parent level, delete the container
    unwrapContainer: (containerId) => {
      const state = get();
      const container = state.nodes[containerId];
      if (!container || !Array.isArray(container.children)) {
        return [];
      }
      
      const childIds = [...container.children];
      const timestamp = now();
      
      // Find parent of this container
      const parentContainerId = Object.keys(state.nodes).find(id => {
        const n = state.nodes[id];
        return n.children?.includes(containerId);
      });
      
      set((state) => {
        // Move children to parent container (or root)
        if (parentContainerId) {
          const parent = state.nodes[parentContainerId];
          if (parent?.children) {
            // Remove this container from parent
            parent.children = parent.children.filter(id => id !== containerId);
            // Add all grandchildren to parent
            parent.children.push(...childIds);
            parent.modifiedAt = timestamp;
          }
        }
        // If no parent, children become top-level (no action needed since they're already nodes)
        
        // Remove container from any groups
        for (const group of Object.values(state.groups)) {
          group.members = group.members.filter(mid => mid !== containerId);
        }
        
        // Delete the container itself
        delete state.nodes[containerId];
        state.meta.modifiedAt = timestamp;
      });
      
      const newState = get();
      useHistoryStore.getState().snapshot('unwrap_container', `Unwrapped "${container.name}" (${childIds.length} children)`, {
        nodes: newState.nodes,
        groups: newState.groups,
      });
      
      return childIds;
    },

    // Collapse container: consume all children's areas and become a simple area node
    collapseContainer: (containerId) => {
      const state = get();
      const container = state.nodes[containerId];
      if (!container || !Array.isArray(container.children) || container.children.length === 0) {
        return;
      }
      
      // Get the total area from all children (recursively via getNodeDerived)
      const derived = state.getNodeDerived(containerId);
      const totalArea = derived?.totalArea ?? 0;
      const childCount = container.children.length;
      const timestamp = now();
      
      // Helper to recursively collect all descendant node IDs
      const collectDescendants = (nodeId: UUID): UUID[] => {
        const node = state.nodes[nodeId];
        if (!node) return [];
        const ids = [nodeId];
        if (node.children) {
          for (const childId of node.children) {
            ids.push(...collectDescendants(childId));
          }
        }
        return ids;
      };
      
      // Collect all descendant IDs (including nested containers)
      const allDescendantIds = container.children.flatMap(childId => collectDescendants(childId));
      
      set((state) => {
        // Delete all descendants
        for (const descendantId of allDescendantIds) {
          // Remove from any groups
          for (const group of Object.values(state.groups)) {
            group.members = group.members.filter(mid => mid !== descendantId);
          }
          delete state.nodes[descendantId];
        }
        
        // Update the container to be a simple area
        const containerNode = state.nodes[containerId];
        containerNode.areaPerUnit = totalArea;
        containerNode.count = 1;
        containerNode.children = undefined; // No longer a container
        containerNode.modifiedAt = timestamp;
        
        state.meta.modifiedAt = timestamp;
      });
      
      const newState = get();
      useHistoryStore.getState().snapshot('collapse_container', `Collapsed "${container.name}" (${childCount} children → ${totalArea.toLocaleString()}m²)`, {
        nodes: newState.nodes,
        groups: newState.groups,
      });
    },

    // Get direct children of a container
    getContainerChildren: (containerId) => {
      const state = get();
      const container = state.nodes[containerId];
      if (!container?.children) return [];
      
      return container.children
        .map(id => state.nodes[id])
        .filter(Boolean);
    },

    // Get all nodes NOT inside any container (top-level nodes)
    getTopLevelNodes: () => {
      const state = get();
      const childNodeIds = new Set<UUID>();
      
      // Collect all node IDs that are children of some container
      for (const node of Object.values(state.nodes)) {
        if (node.children) {
          node.children.forEach(id => childNodeIds.add(id));
        }
      }
      
      // Return nodes that are not children of any container
      return Object.values(state.nodes).filter(node => !childNodeIds.has(node.id));
    },

    // Find which container holds this node (if any)
    findParentContainer: (nodeId) => {
      const state = get();
      for (const [id, node] of Object.entries(state.nodes)) {
        if (node.children?.includes(nodeId)) {
          return id as UUID;
        }
      }
      return null;
    },

    // ==========================================
    // SPLIT BY QUANTITY ACTION
    // ==========================================

    splitNodeByQuantity: (nodeId, quantities) => {
      const state = get();
      const node = state.nodes[nodeId];
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
      
      // Check if this node is part of an instance family
      const hasInstanceFamily = !!node.instanceOf;
      // Check if this node is the source of truth for a family
      const isSourceOfTruth = node.instanceOf === nodeId;
      const existingSourceId = node.instanceOf;
      
      // Find all other nodes that point to this source (if we are the source)
      const otherFamilyMembers = isSourceOfTruth 
        ? Object.values(state.nodes).filter(n => n.instanceOf === nodeId && n.id !== nodeId)
        : [];
      
      // Find which group the original belongs to
      const originalGroupId = Object.keys(state.groups).find(gid => 
        state.groups[gid].members.includes(nodeId)
      );

      set((state) => {
        // Generate all IDs first
        for (let i = 0; i < quantities.length; i++) {
          ids.push(uuidv4());
        }
        
        // Determine the source ID for split nodes (same logic as expandNode)
        const newSourceId = hasInstanceFamily 
          ? (isSourceOfTruth ? ids[0] : existingSourceId)
          : ids[0]; // Create new family with first as source
        
        // Create new nodes for each quantity as linked instances
        for (let i = 0; i < quantities.length; i++) {
          const id = ids[i];
          state.nodes[id] = {
            ...node,
            id,
            name: `${node.name} (${i + 1})`,
            count: quantities[i],
            // First node becomes source (self-ref), others point to it
            instanceOf: (i === 0 && (isSourceOfTruth || !hasInstanceFamily)) ? id : newSourceId,
            createdAt: timestamp,
            modifiedAt: timestamp,
          };
        }
        
        // If we were the source, update all other family members to point to new source
        if (isSourceOfTruth && newSourceId) {
          for (const member of otherFamilyMembers) {
            const memberNode = state.nodes[member.id];
            if (memberNode) {
              memberNode.instanceOf = newSourceId;
              memberNode.modifiedAt = timestamp;
            }
          }
        }

        // Remove original node from groups and add new nodes to same group
        for (const group of Object.values(state.groups)) {
          group.members = group.members.filter(id => id !== nodeId);
        }
        if (originalGroupId && state.groups[originalGroupId]) {
          state.groups[originalGroupId].members.push(...ids);
        }

        // Delete original node
        delete state.nodes[nodeId];
        state.meta.modifiedAt = timestamp;
      });

      const newState = get();
      useHistoryStore.getState().snapshot('split_by_quantity', `Split "${node.name}" by quantity into ${quantities.length} areas`, {
        nodes: newState.nodes,
        groups: newState.groups,
      });

      return ids;
    },

    // ==========================================
    // SPLIT BY EQUAL PARTS ACTION
    // ==========================================

    splitNodeByEqual: (nodeId, parts) => {
      const state = get();
      const node = state.nodes[nodeId];
      if (!node) return [];
      if (parts < 2) return [];

      const totalArea = node.areaPerUnit * node.count;
      const areaEachRaw = totalArea / parts;
      const areaEachRounded = Math.round(areaEachRaw);
      const roundedTotal = areaEachRounded * parts;
      const diff = totalArea - roundedTotal;

      const ids: UUID[] = [];
      const timestamp = now();
      
      // Find which group the original belongs to
      const originalGroupId = Object.keys(state.groups).find(gid => 
        state.groups[gid].members.includes(nodeId)
      );

      set((state) => {
        for (let i = 0; i < parts; i++) {
          const id = uuidv4();
          ids.push(id);
          state.nodes[id] = {
            id,
            name: `${node.name} ${String.fromCharCode(65 + i)}`,
            areaPerUnit: i === parts - 1 ? areaEachRounded + diff : areaEachRounded,
            count: 1,
            notes: [],
            lockedFields: [],
            createdAt: timestamp,
            modifiedAt: timestamp,
            createdBy: 'user',
          };
        }

        // Remove original node from groups and add new nodes to same group
        for (const group of Object.values(state.groups)) {
          group.members = group.members.filter(id => id !== nodeId);
        }
        if (originalGroupId && state.groups[originalGroupId]) {
          state.groups[originalGroupId].members.push(...ids);
        }

        delete state.nodes[nodeId];
        state.meta.modifiedAt = timestamp;
      });

      const newState = get();
      useHistoryStore.getState().snapshot('split_by_equal', `Split "${node.name}" into ${parts} equal parts`, {
        nodes: newState.nodes,
        groups: newState.groups,
      });

      return ids;
    },

    // ==========================================
    // SPLIT BY AREAS ACTION
    // ==========================================

    splitNodeByAreas: (nodeId, areas) => {
      const state = get();
      const node = state.nodes[nodeId];
      if (!node) return [];
      if (areas.length < 2) return [];

      const totalArea = node.areaPerUnit * node.count;
      const areaSum = areas.reduce((sum, a) => sum + a.area, 0);
      
      // Validate total area matches (with small tolerance)
      if (Math.abs(areaSum - totalArea) > 1) return [];

      const ids: UUID[] = [];
      const timestamp = now();
      
      // Find which group the original belongs to
      const originalGroupId = Object.keys(state.groups).find(gid => 
        state.groups[gid].members.includes(nodeId)
      );

      set((state) => {
        for (const split of areas) {
          const id = uuidv4();
          ids.push(id);
          state.nodes[id] = {
            id,
            name: split.name,
            areaPerUnit: split.area,
            count: 1,
            notes: [],
            lockedFields: [],
            createdAt: timestamp,
            modifiedAt: timestamp,
            createdBy: 'user',
          };
        }

        // Remove original node from groups and add new nodes to same group
        for (const group of Object.values(state.groups)) {
          group.members = group.members.filter(id => id !== nodeId);
        }
        if (originalGroupId && state.groups[originalGroupId]) {
          state.groups[originalGroupId].members.push(...ids);
        }

        delete state.nodes[nodeId];
        state.meta.modifiedAt = timestamp;
      });

      const newState = get();
      useHistoryStore.getState().snapshot('split_by_area', `Split "${node.name}" into ${areas.length} areas`, {
        nodes: newState.nodes,
        groups: newState.groups,
      });

      return ids;
    },

    // ==========================================
    // SPLIT BY PROPORTION ACTION
    // ==========================================

    splitNodeByProportion: (nodeId, percentages) => {
      const state = get();
      const node = state.nodes[nodeId];
      if (!node) return [];
      if (percentages.length < 2) return [];

      const totalPercent = percentages.reduce((sum, p) => sum + p.percent, 0);
      
      // Validate percentages sum to ~100
      if (Math.abs(totalPercent - 100) > 0.1) return [];

      const totalArea = node.areaPerUnit * node.count;
      const ids: UUID[] = [];
      const timestamp = now();
      
      // Find which group the original belongs to
      const originalGroupId = Object.keys(state.groups).find(gid => 
        state.groups[gid].members.includes(nodeId)
      );

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
            notes: [],
            lockedFields: [],
            createdAt: timestamp,
            modifiedAt: timestamp,
            createdBy: 'user',
          };
        }

        // Remove original node from groups and add new nodes to same group
        for (const group of Object.values(state.groups)) {
          group.members = group.members.filter(id => id !== nodeId);
        }
        if (originalGroupId && state.groups[originalGroupId]) {
          state.groups[originalGroupId].members.push(...ids);
        }

        delete state.nodes[nodeId];
        state.meta.modifiedAt = timestamp;
      });

      const newState = get();
      useHistoryStore.getState().snapshot('split_by_proportion', `Split "${node.name}" by proportion into ${percentages.length} areas`, {
        nodes: newState.nodes,
        groups: newState.groups,
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

      const state = get();
      // Get all nodes
      const nodesToMerge = nodeIds.map(id => state.nodes[id]).filter(Boolean);
      if (nodesToMerge.length !== nodeIds.length) return null;

      // Calculate totals
      const totalCount = nodesToMerge.reduce((sum, n) => sum + n.count, 0);
      const totalArea = nodesToMerge.reduce((sum, n) => sum + (n.areaPerUnit * n.count), 0);
      const avgAreaPerUnit = totalArea / totalCount;

      const newId = uuidv4();
      const timestamp = now();
      
      // Find which group any of the original nodes belong to (use first found)
      const originalGroupId = Object.keys(state.groups).find(gid => 
        nodeIds.some(nid => state.groups[gid].members.includes(nid))
      );

      set((state) => {
        // Create merged node
        state.nodes[newId] = {
          id: newId,
          name: newName,
          areaPerUnit: avgAreaPerUnit,
          count: totalCount,
          notes: [{
            id: uuidv4(),
            source: 'user',
            content: `Merged from: ${nodesToMerge.map(n => n.name).join(', ')}`,
            createdAt: timestamp,
            modifiedAt: timestamp,
          }],
          lockedFields: [],
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
        
        // Add new node to same group
        if (originalGroupId && state.groups[originalGroupId]) {
          state.groups[originalGroupId].members.push(newId);
        }

        state.meta.modifiedAt = timestamp;
      });

      const newState = get();
      useHistoryStore.getState().snapshot('merge_nodes', `Merged ${nodeIds.length} areas into "${newName}"`, {
        nodes: newState.nodes,
        groups: newState.groups,
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
          notes: [], // New notes array
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
    // GROUP SPLIT/MERGE ACTIONS
    // ==========================================

    /**
     * Split a group into N equal parts.
     * Creates N copies of the group, each with the same areas but counts divided by N.
     * Example: Living/bedroom 80×30m² split into 8 → 8 groups each with Living/bedroom 10×30m²
     * Example: Reception area 1×10m² split into 8 → 8 groups each with Reception area 1×1.25m²
     */
    splitGroupEqual: (groupId, parts, nameSuffix = 'Unit') => {
      const group = get().groups[groupId];
      if (!group || parts < 2) return [];

      const memberNodes = group.members.map(id => get().nodes[id]).filter(Boolean);
      if (memberNodes.length === 0) return [];

      const timestamp = now();
      const baseColor = group.color;
      const newGroupIds: string[] = [];

      // For each area, determine how to split it:
      // - If count >= parts: split the count (distribute units)
      // - If count < parts: split the area itself (divide areaPerUnit)
      interface SplitInfo {
        splitByCount: boolean;
        countDistribution: number[];  // Used when splitting by count
        areaPerUnit: number;          // Used when splitting by area
      }
      
      const splitInfos: Record<string, SplitInfo> = {};
      
      for (const node of memberNodes) {
        if (node.count >= parts) {
          // Split by count - distribute units across groups
          const baseCount = Math.floor(node.count / parts);
          const remainder = node.count % parts;
          splitInfos[node.id] = {
            splitByCount: true,
            countDistribution: Array.from({ length: parts }, (_, i) => 
              baseCount + (i < remainder ? 1 : 0)
            ),
            areaPerUnit: node.areaPerUnit,
          };
        } else {
          // Split by area - each group gets count=1 with divided area
          const dividedArea = node.areaPerUnit / parts;
          splitInfos[node.id] = {
            splitByCount: false,
            countDistribution: Array.from({ length: parts }, () => 1),
            areaPerUnit: dividedArea,
          };
        }
      }

      set((state) => {
        // Create N new groups with split areas
        for (let i = 0; i < parts; i++) {
          const newGroupId = uuidv4();
          newGroupIds.push(newGroupId);

          // Shift hue for visual distinction
          const hueShift = (i * 360 / parts) % 360;
          const newColor = shiftHue(baseColor, hueShift);

          const newMemberIds: string[] = [];

          // For each original area, create a copy with split count or area
          for (const node of memberNodes) {
            const info = splitInfos[node.id];
            const splitCount = info.countDistribution[i];
            
            // Skip if this split has 0 count (only happens for count-based splits)
            if (splitCount <= 0) continue;

            const newNodeId = uuidv4();
            newMemberIds.push(newNodeId);

            state.nodes[newNodeId] = {
              id: newNodeId,
              name: node.name, // Keep same name
              areaPerUnit: info.splitByCount ? node.areaPerUnit : info.areaPerUnit,
              count: splitCount,
              notes: node.notes ? [...node.notes] : [], // Copy notes
              lockedFields: [],
              createdAt: timestamp,
              modifiedAt: timestamp,
              createdBy: 'user',
            };
          }

          // Create the new group
          state.groups[newGroupId] = {
            id: newGroupId,
            name: `${group.name} - ${nameSuffix} ${i + 1}`,
            color: newColor,
            members: newMemberIds,
            notes: group.notes ? [...group.notes] : [],
            createdAt: timestamp,
            modifiedAt: timestamp,
          };
        }

        // Delete original nodes
        for (const node of memberNodes) {
          delete state.nodes[node.id];
        }

        // Delete original group
        delete state.groups[groupId];

        state.meta.modifiedAt = timestamp;
      });

      const finalState = get();
      useHistoryStore.getState().snapshot('split_group_equal', `Split "${group.name}" into ${parts} equal groups`, {
        nodes: finalState.nodes,
        groups: finalState.groups,
      });

      return newGroupIds;
    },

    /**
     * Split a group by proportions.
     * Creates copies of the group where each copy has area counts scaled to the proportion.
     * Example: Living/bedroom 80×30m² with (10%, 30%, 60%) → 8, 24, 48 units
     */
    splitGroupByProportion: (groupId, proportions) => {
      const group = get().groups[groupId];
      if (!group || proportions.length < 2) return [];

      const memberNodes = group.members.map(id => get().nodes[id]).filter(Boolean);
      if (memberNodes.length === 0) return [];

      // Normalize proportions to fractions
      const totalPercent = proportions.reduce((sum, p) => sum + p.percent, 0);
      const fractions = proportions.map(p => p.percent / totalPercent);

      const timestamp = now();
      const baseColor = group.color;
      const newGroupIds: string[] = [];

      // For each area, calculate count distribution by proportion
      const countDistributions: Record<string, number[]> = {};
      for (const node of memberNodes) {
        const distribution: number[] = [];
        let remaining = node.count;

        // Allocate counts, ensuring we use all units
        for (let i = 0; i < fractions.length; i++) {
          if (i === fractions.length - 1) {
            // Last group gets whatever remains
            distribution.push(remaining);
          } else {
            const allocated = Math.round(node.count * fractions[i]);
            distribution.push(Math.min(allocated, remaining));
            remaining -= distribution[i];
          }
        }

        countDistributions[node.id] = distribution;
      }

      set((state) => {
        // Create groups for each proportion
        for (let i = 0; i < proportions.length; i++) {
          const newGroupId = uuidv4();
          newGroupIds.push(newGroupId);

          // Shift hue for visual distinction
          const hueShift = (i * 360 / proportions.length) % 360;
          const newColor = shiftHue(baseColor, hueShift);

          const newMemberIds: string[] = [];

          // For each original area, create a copy with proportional count
          for (const node of memberNodes) {
            const splitCount = countDistributions[node.id][i];
            
            // Skip if this split has 0 count
            if (splitCount <= 0) continue;

            const newNodeId = uuidv4();
            newMemberIds.push(newNodeId);

            state.nodes[newNodeId] = {
              id: newNodeId,
              name: node.name,
              areaPerUnit: node.areaPerUnit,
              count: splitCount,
              notes: node.notes ? [...node.notes] : [],
              lockedFields: [],
              createdAt: timestamp,
              modifiedAt: timestamp,
              createdBy: 'user',
            };
          }

          // Create the new group
          state.groups[newGroupId] = {
            id: newGroupId,
            name: proportions[i].name,
            color: newColor,
            members: newMemberIds,
            notes: group.notes ? [...group.notes] : [],
            createdAt: timestamp,
            modifiedAt: timestamp,
          };
        }

        // Delete original nodes
        for (const node of memberNodes) {
          delete state.nodes[node.id];
        }

        // Delete original group
        delete state.groups[groupId];

        state.meta.modifiedAt = timestamp;
      });

      const finalState = get();
      useHistoryStore.getState().snapshot('split_group_proportion', `Split "${group.name}" by proportion`, {
        nodes: finalState.nodes,
        groups: finalState.groups,
      });

      return newGroupIds;
    },

    mergeGroupAreas: (groupId, newAreaName) => {
      const group = get().groups[groupId];
      if (!group) return null;

      const memberNodes = group.members.map(id => get().nodes[id]).filter(Boolean);
      if (memberNodes.length === 0) return null;

      // Calculate merged values
      const totalCount = memberNodes.reduce((sum, n) => sum + n.count, 0);
      const totalArea = memberNodes.reduce((sum, n) => sum + n.areaPerUnit * n.count, 0);
      const avgAreaPerUnit = totalArea / totalCount;
      const mergedName = newAreaName || group.name;

      // Collect all notes from member nodes
      const allNotes = memberNodes.flatMap(n => n.notes || []);

      const newId = uuidv4();
      const timestamp = now();

      set((state) => {
        // Create merged node
        state.nodes[newId] = {
          id: newId,
          name: mergedName,
          areaPerUnit: avgAreaPerUnit,
          count: totalCount,
          notes: [
            {
              id: uuidv4(),
              source: 'user',
              content: `Merged from group "${group.name}": ${memberNodes.map(n => `${n.name} (${n.count}×${n.areaPerUnit}m²)`).join(', ')}`,
              createdAt: timestamp,
              modifiedAt: timestamp,
            },
            ...allNotes
          ],
          lockedFields: [],
          createdAt: timestamp,
          modifiedAt: timestamp,
          createdBy: 'user',
        };

        // Delete original nodes
        for (const node of memberNodes) {
          delete state.nodes[node.id];
        }

        // Delete the group
        delete state.groups[groupId];

        state.meta.modifiedAt = timestamp;
      });

      const finalState = get();
      useHistoryStore.getState().snapshot('merge_group_areas', `Merged group "${group.name}" into single area`, {
        nodes: finalState.nodes,
        groups: finalState.groups,
      });

      return newId;
    },

    // ==========================================
    // NOTE ACTIONS
    // ==========================================

    addNoteToArea: (areaId, note) => {
      const area = get().nodes[areaId];
      if (!area) return null;

      const id = uuidv4();
      const timestamp = now();

      set((state) => {
        const node = state.nodes[areaId];
        if (!node) return;
        if (!node.notes) node.notes = [];
        node.notes.push({
          id,
          source: note.source,
          content: note.content,
          reason: note.reason,
          createdAt: timestamp,
          modifiedAt: timestamp,
        });
        node.modifiedAt = timestamp;
        state.meta.modifiedAt = timestamp;
      });

      return id;
    },

    addNoteToGroup: (groupId, note) => {
      const group = get().groups[groupId];
      if (!group) return null;

      const id = uuidv4();
      const timestamp = now();

      set((state) => {
        const g = state.groups[groupId];
        if (!g) return;
        if (!g.notes) g.notes = [];
        g.notes.push({
          id,
          source: note.source,
          content: note.content,
          reason: note.reason,
          createdAt: timestamp,
          modifiedAt: timestamp,
        });
        g.modifiedAt = timestamp;
        state.meta.modifiedAt = timestamp;
      });

      return id;
    },

    updateNote: (targetType, targetId, noteId, content) => {
      const timestamp = now();

      set((state) => {
        const target = targetType === 'area' 
          ? state.nodes[targetId] 
          : state.groups[targetId];
        if (!target || !target.notes) return;

        const note = target.notes.find(n => n.id === noteId);
        if (note) {
          note.content = content;
          note.modifiedAt = timestamp;
        }
        target.modifiedAt = timestamp;
        state.meta.modifiedAt = timestamp;
      });
    },

    deleteNote: (targetType, targetId, noteId) => {
      const timestamp = now();

      set((state) => {
        const target = targetType === 'area' 
          ? state.nodes[targetId] 
          : state.groups[targetId];
        if (!target || !target.notes) return;

        target.notes = target.notes.filter(n => n.id !== noteId);
        target.modifiedAt = timestamp;
        state.meta.modifiedAt = timestamp;
      });
    },

    // ==========================================
    // BOARD LAYOUT ACTIONS
    // ==========================================

    setGroupPosition: (groupId, x, y) => {
      set((state) => {
        state.boardLayout.groupPositions[groupId] = { x, y };
      });
    },

    setGroupSizeOverride: (groupId, size) => {
      set((state) => {
        state.boardLayout.groupSizeOverrides[groupId] = size;
      });
    },

    clearGroupSizeOverride: (groupId) => {
      set((state) => {
        delete state.boardLayout.groupSizeOverrides[groupId];
      });
    },

    setAreaOffset: (areaId, x, y) => {
      set((state) => {
        state.boardLayout.areaOffsets[areaId] = { x, y };
      });
    },

    setAreaOffsets: (offsets) => {
      set((state) => {
        for (const [id, offset] of Object.entries(offsets)) {
          state.boardLayout.areaOffsets[id] = offset;
        }
      });
    },

    clearAreaOffset: (areaId) => {
      set((state) => {
        delete state.boardLayout.areaOffsets[areaId];
      });
    },

    clearAreaOffsets: (areaIds) => {
      set((state) => {
        for (const id of areaIds) {
          delete state.boardLayout.areaOffsets[id];
        }
      });
    },

    addComment: (x, y, text = '') => {
      const id = uuidv4();
      set((state) => {
        state.boardLayout.comments.push({ id, x, y, text });
      });
      return id;
    },

    updateComment: (id, text) => {
      set((state) => {
        const comment = state.boardLayout.comments.find((c) => c.id === id);
        if (comment) {
          comment.text = text;
        }
      });
    },

    deleteComment: (id) => {
      set((state) => {
        const index = state.boardLayout.comments.findIndex((c) => c.id === id);
        if (index >= 0) {
          state.boardLayout.comments.splice(index, 1);
        }
      });
    },

    moveComment: (id, x, y) => {
      set((state) => {
        const comment = state.boardLayout.comments.find((c) => c.id === id);
        if (comment) {
          comment.x = x;
          comment.y = y;
        }
      });
    },

    // ==========================================
    // DERIVED VALUES
    // ==========================================

    getNodeDerived: (id) => {
      const state = get();
      const node = state.nodes[id];
      if (!node) return null;

      // Check if this node is part of an instance family
      // instanceOf is set on ALL family members (including the source via self-reference)
      const hasInstanceOf = !!node.instanceOf;
      
      // The source node is the one where id === instanceOf (self-reference)
      const sourceId = node.instanceOf;
      const isSourceOfTruth = hasInstanceOf && node.id === node.instanceOf;
      const sourceNode = sourceId ? state.nodes[sourceId] : null;
      
      // Count all family members (nodes with same instanceOf)
      const familyMembers = hasInstanceOf 
        ? Object.values(state.nodes).filter(n => n.instanceOf === sourceId)
        : [];
      const instanceCount = familyMembers.length;
      
      // hasInstanceLink = part of a family (2+ members)
      const hasInstanceLink = instanceCount >= 2;
      
      // Effective area per unit: always from the source node (where id === instanceOf)
      const effectiveAreaPerUnit = sourceNode ? sourceNode.areaPerUnit : node.areaPerUnit;
      
      if (hasInstanceLink) {
        console.debug('[getNodeDerived] Instance family:', node.name, 
          '| familySize:', instanceCount,
          '| sourceId:', sourceId,
          '| isSourceOfTruth:', isSourceOfTruth,
          '| effectiveAreaPerUnit:', effectiveAreaPerUnit);
      }
      
      // Check if container (has children)
      const isContainer = !!(node.children && node.children.length > 0);
      
      // Total area: sum of children if container, else areaPerUnit × count
      let totalArea: number;
      if (isContainer) {
        totalArea = node.children!.reduce((sum, childId) => {
          const childDerived = get().getNodeDerived(childId);
          return sum + (childDerived?.totalArea ?? 0);
        }, 0);
      } else {
        totalArea = effectiveAreaPerUnit * node.count;
      }

      // Effective reasoning/confidence: from source if instance, else own
      const effectiveReasoning = sourceNode?.formulaReasoning ?? node.formulaReasoning;
      const effectiveConfidence = sourceNode?.formulaConfidence ?? node.formulaConfidence;
      const effectiveFormulaType = sourceNode?.formulaType ?? node.formulaType;

      return {
        totalArea,
        effectiveAreaPerUnit,
        isInstance: hasInstanceOf && !isSourceOfTruth, // Points to another node
        isSource: isSourceOfTruth,                      // Is the source of truth (self-reference)
        hasInstanceLink,                                // Part of instance family
        instanceCount: hasInstanceLink ? instanceCount : undefined,
        isContainer,
        instanceSourceId: sourceId ?? undefined,
        instanceSource: sourceNode?.name,
        effectiveReasoning,
        effectiveConfidence,
        effectiveFormulaType,
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
        schema_version: '1.1.0',
        meta: state.meta,
        rawInputs: state.rawInputs,
        areaLayer: {
          nodes: state.nodes,
        },
        groupingLayer: {
          groups: state.groups,
        },
        boardLayout: state.boardLayout,
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
          // Import board layout if available (v1.1.0+)
          state.boardLayout = data.boardLayout || {
            groupPositions: {},
            groupSizeOverrides: {},
            areaOffsets: {},
            comments: [],
          };
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
        state.boardLayout = initial.boardLayout;
      });

      useHistoryStore.getState().reset();
    },
  }))
);
