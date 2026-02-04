import type { UUID, Timestamp } from './project';
import type { Note } from './notes';

// ============================================
// AREA NODE
// ============================================

export interface AreaNode {
  id: UUID;
  name: string;
  areaPerUnit: number; // square meters
  count: number;
  // Notes - array of typed note cards
  notes: Note[];
  // Legacy notes (for migration) - deprecated, use notes array
  aiNote?: string | null;
  userNote?: string | null;
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
  totalArea: number; // areaPerUnit × count
}

// ============================================
// CREATION INPUTS (for actions)
// ============================================

export interface CreateAreaNodeInput {
  name: string;
  areaPerUnit: number;
  count: number;
  userNote?: string;
}

export interface UpdateAreaNodeInput {
  name?: string;
  areaPerUnit?: number;
  count?: number;
  userNote?: string;
  lockedFields?: AreaNodeField[];
}
