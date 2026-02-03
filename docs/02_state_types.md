# State Types – TypeScript Definitions

## Core Types

```typescript
// ============================================
// IDENTIFIERS
// ============================================

type UUID = string;
type Timestamp = string; // ISO 8601

// ============================================
// PROJECT META
// ============================================

interface ProjectMeta {
  id: UUID;
  name: string;
  createdAt: Timestamp;
  modifiedAt: Timestamp;
  currentStep: StepId;
}

type StepId = 0 | 1 | 2 | 3;
// 0 = Input
// 1 = Area Tools (Normalization)
// 2 = Grouping
// 3 = Massing

// ============================================
// RAW INPUTS
// ============================================

interface RawInputs {
  briefText: string | null;
  uploadedFiles: UploadedFile[];
}

interface UploadedFile {
  id: UUID;
  name: string;
  type: 'excel' | 'csv' | 'pdf' | 'other';
  content: string; // base64 or extracted text
  uploadedAt: Timestamp;
}

// ============================================
// AREA LAYER
// ============================================

interface AreaLayer {
  nodes: Record<UUID, AreaNode>;
  partitions: Record<UUID, AreaPartition>;
  clusters: Record<UUID, AreaCluster>;
}

interface AreaNode {
  id: UUID;
  name: string;
  areaPerUnit: number; // square meters (or user unit)
  count: number;
  // Notes
  aiNote: string | null;
  userNote: string | null;
  // Locks
  lockedFields: AreaNodeField[];
  // Metadata
  createdAt: Timestamp;
  modifiedAt: Timestamp;
  createdBy: 'user' | 'ai';
}

type AreaNodeField = 'name' | 'areaPerUnit' | 'count';

// Derived (computed, not stored)
interface AreaNodeDerived {
  totalArea: number; // areaPerUnit × count
  partitionCount: number; // number of partitions
  partitionedUnits: number; // sum of partition counts
  unpartitionedUnits: number; // count - partitionedUnits
  isFullyPartitioned: boolean;
}

interface AreaPartition {
  id: UUID;
  parentNodeId: UUID; // reference to AreaNode
  count: number;
  label: string | null; // e.g., "Tower A", "Level 1-5"
  // Notes
  aiNote: string | null;
  userNote: string | null;
  // Metadata
  createdAt: Timestamp;
  modifiedAt: Timestamp;
}

interface AreaCluster {
  id: UUID;
  name: string;
  memberNodeIds: UUID[]; // references to AreaNodes
  // Notes
  aiNote: string | null;
  userNote: string | null;
  // Metadata
  createdAt: Timestamp;
  modifiedAt: Timestamp;
  createdBy: 'user' | 'ai';
}

// Derived (computed, not stored)
interface AreaClusterDerived {
  totalArea: number; // sum of member node total areas
  totalUnits: number; // sum of member node counts
  memberNodes: AreaNode[];
}

// ============================================
// GROUPING LAYER
// ============================================

interface GroupingLayer {
  groups: Record<UUID, Group>;
}

interface Group {
  id: UUID;
  name: string;
  color: string; // hex color for UI
  // Members can be AreaNodes OR Partitions
  members: GroupMember[];
  // Rules (future)
  rules: GroupRule[];
  // Notes
  aiNote: string | null;
  userNote: string | null;
  // Metadata
  createdAt: Timestamp;
  modifiedAt: Timestamp;
}

interface GroupMember {
  type: 'node' | 'partition';
  id: UUID; // AreaNode or AreaPartition ID
}

interface GroupRule {
  type: 'floorPlate' | 'levelRange' | 'efficiency' | 'custom';
  params: Record<string, unknown>;
}

// Derived (computed, not stored)
interface GroupDerived {
  totalArea: number;
  totalUnits: number;
  memberDetails: Array<{
    node: AreaNode;
    partition: AreaPartition | null;
    area: number;
    units: number;
  }>;
}

// ============================================
// MASSING LAYER (Future)
// ============================================

interface MassingLayer {
  variants: Record<UUID, MassingVariant>;
  selectedVariantId: UUID | null;
  parameters: MassingParameters;
}

interface MassingVariant {
  id: UUID;
  name: string;
  groupAssignments: Record<UUID, BuildingAssignment>; // GroupID → Assignment
  // Computed geometry reference (not stored)
  createdAt: Timestamp;
  modifiedAt: Timestamp;
}

interface BuildingAssignment {
  buildingId: string;
  levelStart: number;
  levelEnd: number;
}

interface MassingParameters {
  siteArea: number;
  maxHeight: number;
  floorToFloorHeight: number;
  podiumLevels: number;
  // ... more params
}

// ============================================
// HISTORY & BRANCHING
// ============================================

interface HistoryState {
  snapshots: StateSnapshot[];
  currentIndex: number;
  branches: Branch[];
  activeBranchId: UUID;
}

interface StateSnapshot {
  id: UUID;
  branchId: UUID;
  parentId: UUID | null;
  timestamp: Timestamp;
  label: string | null; // optional user label
  actionType: ActionType;
  // The actual state (deep copy of project state)
  state: ProjectState;
}

type ActionType =
  | 'create_node'
  | 'update_node'
  | 'delete_node'
  | 'create_partition'
  | 'update_partition'
  | 'delete_partition'
  | 'create_cluster'
  | 'update_cluster'
  | 'delete_cluster'
  | 'create_group'
  | 'update_group'
  | 'delete_group'
  | 'ai_apply'
  | 'import'
  | 'batch';

interface Branch {
  id: UUID;
  name: string;
  createdAt: Timestamp;
  rootSnapshotId: UUID;
  headSnapshotId: UUID;
}

// ============================================
// FULL PROJECT STATE
// ============================================

interface ProjectState {
  meta: ProjectMeta;
  rawInputs: RawInputs;
  areaLayer: AreaLayer;
  groupingLayer: GroupingLayer;
  massingLayer: MassingLayer;
}

// Serialized format with schema version
interface SerializedProject {
  schema_version: string;
  project: ProjectState;
  history?: HistoryState; // optional for export
}

// ============================================
// UI STATE (Non-Authoritative)
// ============================================

interface UIState {
  // Selection
  selectedNodeIds: UUID[];
  selectedPartitionIds: UUID[];
  selectedClusterIds: UUID[];
  selectedGroupIds: UUID[];
  // Expansion (tree view)
  expandedNodeIds: UUID[];
  expandedClusterIds: UUID[];
  // Panels
  activePanel: 'inspector' | 'ai' | 'history' | null;
  inspectorTab: 'details' | 'notes';
  // Modals
  activeModal: ModalType | null;
  // Drag state
  dragState: DragState | null;
}

type ModalType =
  | 'export'
  | 'import'
  | 'settings'
  | 'ai-settings'
  | 'new-project';

interface DragState {
  type: 'node' | 'partition' | 'cluster';
  ids: UUID[];
  overTarget: DropTarget | null;
}

interface DropTarget {
  type: 'group' | 'cluster' | 'trash';
  id: UUID | null;
}

// ============================================
// AI TYPES
// ============================================

interface AIState {
  apiKey: string | null;
  model: AIModel;
  isConnected: boolean;
  tokenLimit: number | null;
  tokensUsed: number;
}

type AIModel = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo' | 'o3-mini';

interface AIProposal {
  id: UUID;
  requestId: UUID;
  summary: string;
  assumptions: string[];
  confidence: 'high' | 'medium' | 'low';
  changes: AIChange[];
  status: 'pending' | 'applied' | 'rejected';
}

type AIChange =
  | { type: 'create_node'; node: Omit<AreaNode, 'id'> }
  | { type: 'update_node'; nodeId: UUID; updates: Partial<AreaNode> }
  | { type: 'delete_node'; nodeId: UUID }
  | { type: 'create_partition'; partition: Omit<AreaPartition, 'id'> }
  | { type: 'create_cluster'; cluster: Omit<AreaCluster, 'id'> };
```

---

## Validation Rules

```typescript
// Partition counts must sum to parent node count (or less)
function validatePartitions(node: AreaNode, partitions: AreaPartition[]): boolean {
  const sum = partitions.reduce((acc, p) => acc + p.count, 0);
  return sum <= node.count;
}

// No duplicate membership in groups
function validateGroupMembership(groups: Group[]): boolean {
  const seen = new Set<string>();
  for (const group of groups) {
    for (const member of group.members) {
      const key = `${member.type}:${member.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
    }
  }
  return true;
}

// Clusters cannot contain nodes that are in other clusters
function validateClusterMembership(clusters: AreaCluster[]): boolean {
  const seen = new Set<UUID>();
  for (const cluster of clusters) {
    for (const nodeId of cluster.memberNodeIds) {
      if (seen.has(nodeId)) return false;
      seen.add(nodeId);
    }
  }
  return true;
}
```
