import type { UUID, Timestamp } from './project';
import type { Note } from './notes';

// ============================================
// AREA NODE
// ============================================

export interface AreaNode {
  id: UUID;
  name: string;
  areaPerUnit: number; // square meters per unit
  count: number;       // quantity (1 = individual, N = collapsed group)
  
  // Instance linking
  instanceOf?: UUID | null;  // If set, inherits areaPerUnit from source node
                             // null/undefined = independent node
  
  // Container behavior (optional - for tree structure)
  children?: UUID[];         // If present, node is a container
                             // totalArea computed from children, not areaPerUnit
  
  // Notes - array of typed note cards
  notes: Note[];
  // Legacy notes (for migration) - deprecated, use notes array
  aiNote?: string | null;
  userNote?: string | null;
  // Formula-based reasoning (traceable)
  formulaReasoning?: string | null;  // WHY this size (e.g., "35% of parent - typical for hotel rooms")
  formulaConfidence?: number | null; // 0-1 confidence level
  formulaType?: string | null;       // ratio, unit_based, remainder, etc.
  // Locks
  lockedFields: AreaNodeField[];
  // Metadata
  createdAt: Timestamp;
  modifiedAt: Timestamp;
  createdBy: 'user' | 'ai';
}

export type AreaNodeField = 'name' | 'areaPerUnit' | 'count';

// Derived (computed, not stored)
export interface AreaNodeDerived {
  totalArea: number;           // areaPerUnit × count (or sum of children)
  effectiveAreaPerUnit: number; // If instance, from source; else own areaPerUnit
  isInstance: boolean;          // Has instanceOf link (points to another node)
  isSource: boolean;            // Other nodes point to this one
  hasInstanceLink: boolean;     // Part of instance family (source or instance)
  instanceCount?: number;       // Number of instances pointing to this source (only on sources)
  isContainer: boolean;         // Has children
  instanceSourceId?: string;    // ID of source node (self if source, else source node)
  instanceSource?: string;      // Name of source node
  // Effective values (from source if instance, else own)
  effectiveReasoning?: string | null;
  effectiveConfidence?: number | null;
  effectiveFormulaType?: string | null;
}

// ============================================
// CREATION INPUTS (for actions)
// ============================================

export interface CreateAreaNodeInput {
  name: string;
  areaPerUnit: number;
  count: number;
  userNote?: string;
  briefNote?: string;  // Note extracted from brief (comments/requirements)
  aiNote?: string;     // Note from AI generation
  // Instance linking
  instanceOf?: UUID;   // Link to source node (inherits areaPerUnit)
  // Formula-based reasoning
  formulaReasoning?: string;  // WHY this size
  formulaConfidence?: number; // 0-1 confidence
  formulaType?: string;       // ratio, unit_based, remainder, etc.
}

export interface UpdateAreaNodeInput {
  name?: string;
  areaPerUnit?: number;
  count?: number;
  userNote?: string;
  lockedFields?: AreaNodeField[];
  instanceOf?: UUID | null;  // Can link/unlink instance
}
