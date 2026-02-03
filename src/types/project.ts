// ============================================
// IDENTIFIERS
// ============================================

export type UUID = string;
export type Timestamp = string; // ISO 8601

// ============================================
// PROJECT META
// ============================================

export interface ProjectMeta {
  id: UUID;
  name: string;
  createdAt: Timestamp;
  modifiedAt: Timestamp;
  currentStep: StepId;
}

export type StepId = 0 | 1 | 2 | 3;
// 0 = Input
// 1 = Area Tools (Normalization)
// 2 = Grouping
// 3 = Massing

export const STEP_NAMES: Record<StepId, string> = {
  0: 'Input',
  1: 'Areas',
  2: 'Groups',
  3: 'Massing',
};

// ============================================
// RAW INPUTS
// ============================================

export interface RawInputs {
  briefText: string | null;
  uploadedFiles: UploadedFile[];
}

export interface UploadedFile {
  id: UUID;
  name: string;
  type: 'excel' | 'csv' | 'pdf' | 'other';
  content: string; // base64 or extracted text
  uploadedAt: Timestamp;
}

// ============================================
// SERIALIZATION
// ============================================

export interface SerializedProject {
  schema_version: string;
  meta: ProjectMeta;
  rawInputs: RawInputs;
  areaLayer: AreaLayer;
  groupingLayer: GroupingLayer;
}

// Forward declarations for area types
export interface AreaLayer {
  nodes: Record<UUID, AreaNode>;
}

export interface GroupingLayer {
  groups: Record<UUID, Group>;
}

// Import actual types from areas.ts
import type { AreaNode } from './areas';
import type { Group } from './groups';
