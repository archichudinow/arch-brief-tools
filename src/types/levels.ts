import type { UUID, Timestamp } from './project';

// ============================================
// LEVEL - Represents a building floor/level
// ============================================

export interface Level {
  id: UUID;
  name: string;           // e.g., "Ground Floor", "Level 1", "Basement"
  order: number;          // Vertical position (0 = ground, negative = basement)
  height: number;         // Default floor height in meters (for visualization)
  color?: string;         // Optional color override
  createdAt: Timestamp;
  modifiedAt: Timestamp;
}

// ============================================
// GROUP SECTION - A portion of a group allocated to level(s)
// ============================================

export interface GroupSection {
  id: UUID;
  groupId: UUID;          // Reference to the parent Group
  name?: string;          // Optional override name (defaults to group name)
  
  // Level allocation - which levels this section spans
  levelStart: number;     // Starting level order (inclusive)
  levelEnd: number;       // Ending level order (inclusive), same as start for single level
  
  // Area allocation
  areaAllocation: number; // Total area allocated to this section (from group's total)
  
  // Visual positioning within the level row
  orderInLevel?: number;  // Horizontal position among sections in same level
  xPosition?: number;     // X position as fraction of available width (0-1), null = auto-flow
  
  createdAt: Timestamp;
  modifiedAt: Timestamp;
}

// Derived values for GroupSection
export interface GroupSectionDerived {
  groupName: string;
  groupColor: string;
  levelCount: number;     // How many levels this section spans
  groupTotalArea: number; // Total area of the parent group
  percentOfGroup: number; // What percent of group this section represents
}

// ============================================
// LEVELS BOARD STATE
// ============================================

export interface LevelsBoardState {
  levels: Record<UUID, Level>;
  sections: Record<UUID, GroupSection>;
}

// ============================================
// LEVELS BOARD OPTION - A named variation/scenario
// ============================================

export interface LevelsBoardOption {
  id: UUID;
  name: string;           // e.g., "Option A", "High-rise variant"
  levels: Record<UUID, Level>;
  sections: Record<UUID, GroupSection>;
  createdAt: Timestamp;
  modifiedAt: Timestamp;
}

// ============================================
// CREATION INPUTS
// ============================================

export interface CreateLevelInput {
  name: string;
  order: number;
  height?: number;
  color?: string;
}

export interface UpdateLevelInput {
  name?: string;
  order?: number;
  height?: number;
  color?: string;
}

export interface CreateGroupSectionInput {
  groupId: UUID;
  levelStart: number;
  levelEnd?: number;      // Defaults to levelStart (single level)
  areaAllocation: number;
  name?: string;
}

export interface UpdateGroupSectionInput {
  levelStart?: number;
  levelEnd?: number;
  areaAllocation?: number;
  name?: string;
  orderInLevel?: number;
  xPosition?: number | null;  // null to reset to auto-flow
}
