import type { UUID, Timestamp } from './project';

// ============================================
// GROUP
// ============================================

export interface Group {
  id: UUID;
  name: string;
  color: string; // hex color for UI
  // Members are AreaNode IDs
  members: UUID[];
  // Notes
  aiNote: string | null;
  userNote: string | null;
  // Metadata
  createdAt: Timestamp;
  modifiedAt: Timestamp;
}

// Derived (computed, not stored)
export interface GroupDerived {
  totalArea: number;
  totalUnits: number;
}

// ============================================
// CREATION INPUTS
// ============================================

export interface CreateGroupInput {
  name: string;
  color?: string;
}

export interface UpdateGroupInput {
  name?: string;
  color?: string;
  userNote?: string;
}

// ============================================
// DEFAULT GROUP COLORS
// ============================================

export const GROUP_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];
