import type { UUID, Timestamp } from './project';
import type { AreaNode } from './areas';
import type { Group } from './groups';

// ============================================
// HISTORY STATE
// ============================================

export interface HistoryState {
  snapshots: StateSnapshot[];
  currentIndex: number;
}

export interface StateSnapshot {
  id: UUID;
  timestamp: Timestamp;
  label: string;
  actionType: ActionType;
  // The actual state data
  data: SnapshotData;
}

export interface SnapshotData {
  nodes: Record<UUID, AreaNode>;
  groups: Record<UUID, Group>;
}

export type ActionType =
  | 'initial'
  | 'create_node'
  | 'update_node'
  | 'delete_node'
  | 'duplicate_node'
  | 'duplicate_instance'
  | 'duplicate_copy'
  | 'unlink_instance'
  | 'collapse_nodes'
  | 'collapse_to_area'
  | 'expand_node'
  | 'split_quantity'
  | 'merge_quantities'
  | 'merge_nodes'
  | 'split_node'
  | 'split_by_quantity'
  | 'split_by_equal'
  | 'split_by_area'
  | 'split_by_proportion'
  | 'split_group_equal'
  | 'split_group_proportion'
  | 'merge_to_single'
  | 'merge_group_areas'
  | 'create_group'
  | 'update_group'
  | 'delete_group'
  | 'assign_to_group'
  | 'remove_from_group'
  | 'ai_apply'
  | 'import'
  | 'batch'
  | 'parse-brief'
  | 'ai-create-areas'
  | 'ai-split'
  | 'ai-split-quantity'
  | 'ai-merge'
  | 'ai-update'
  | 'ai-create-groups'
  | 'ai-assign'
  | 'ai-add-notes'
  | 'ai-split-group'
  | 'ai-split-group-prop'
  | 'ai-merge-group';
