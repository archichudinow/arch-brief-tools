import type { UUID } from './project';

// ============================================
// CHAT MODES & AI ROLES
// ============================================

// Agent mode: AI takes actions, proposes changes
// Consultation mode: AI answers questions, provides reasoning
export type ChatMode = 'agent' | 'consultation';

// AI can respond from different professional perspectives
export type AIRole = 
  | 'architect'
  | 'urban-architect'
  | 'landscape-architect'
  | 'interior-architect';

// Context level controls how much data is sent to AI
export type ContextLevel = 'minimal' | 'standard' | 'full';

// ============================================
// MESSAGE TYPES
// ============================================

export interface UserMessage {
  id: UUID;
  role: 'user';
  content: string;
  timestamp: string;
  context: {
    selectedNodeIds: UUID[];
    selectedGroupIds: UUID[];
  };
}

export interface AIMessage {
  id: UUID;
  role: 'assistant';
  content: string;
  timestamp: string;
  proposals?: Proposal[];
  status: 'streaming' | 'complete' | 'error';
}

export interface SystemMessage {
  id: UUID;
  role: 'system';
  content: string;
  timestamp: string;
  type: 'info' | 'warning' | 'success' | 'error';
}

export type ChatMessage = UserMessage | AIMessage | SystemMessage;

// ============================================
// TREE EXPLORATION STATE (Formula-based workflow)
// ============================================

/** Scale clarification when AI detects potential mismatch */
export interface ScaleClarificationOption {
  label: string;
  area: number;
  scale: 'interior' | 'architecture' | 'landscape' | 'masterplan' | 'urban';
  interpretation?: string;
}

/** State when clarification is needed */
export interface ClarificationPending {
  type: 'clarification';
  originalInput: string;
  message: string;
  options: ScaleClarificationOption[];
}

/** Expansion request for an area */
export interface ExpandAreaRequest {
  nodeId: UUID;
  nodeName: string;
  nodeArea: number;
  depth: number;  // 1-3 levels
  context?: string;
}

// ============================================
// PROPOSAL TYPES
// ============================================

export interface CreateAreasProposal {
  id: UUID;
  type: 'create_areas';
  areas: Array<{
    name: string;
    areaPerUnit: number;
    count: number;
    briefNote?: string;
    aiNote?: string;
    groupHint?: string;  // Suggested group name for auto-grouping
    formulaReasoning?: string;  // Formula-based: why this size
    formulaConfidence?: number; // 0-1 confidence
    formulaType?: string;       // ratio, unit_based, remainder, etc.
    expandable?: boolean;       // Can this area be expanded further
  }>;
  status: ProposalStatus;
}

export interface SplitAreaProposal {
  id: UUID;
  type: 'split_area';
  sourceNodeId: UUID;
  sourceName: string;
  splits: Array<{
    name: string;
    areaPerUnit: number;
    count: number;
    formulaReasoning?: string;  // Formula-based: why this size
    formulaConfidence?: number; // 0-1 confidence
    formulaType?: string;       // ratio, unit_based, remainder, etc.
    expandable?: boolean;       // Can this area be expanded further
  }>;
  // Optional: if provided, create a group with this name and assign all splits to it
  groupName?: string;
  groupColor?: string;
  status: ProposalStatus;
}

export interface MergeAreasProposal {
  id: UUID;
  type: 'merge_areas';
  sourceNodeIds: UUID[];
  sourceNames: string[];
  result: {
    name: string;
    areaPerUnit: number;
    count: number;
  };
  status: ProposalStatus;
}

/**
 * Split an area by quantity - resulting areas stay linked as instances
 * Use when splitting "Room A × 10" into "Room A × 3" + "Room A × 7"
 * The room type stays the same, just distributed differently
 */
export interface SplitByQuantityProposal {
  id: UUID;
  type: 'split_by_quantity';
  sourceNodeId: UUID;
  sourceName: string;
  quantities: number[];  // e.g., [3, 7] from count=10
  names?: string[];      // Optional custom names for each split
  status: ProposalStatus;
}

export interface UpdateAreasProposal {
  id: UUID;
  type: 'update_areas';
  updates: Array<{
    nodeId: UUID;
    nodeName: string;
    changes: Partial<{
      name: string;
      areaPerUnit: number;
      count: number;
    }>;
  }>;
  status: ProposalStatus;
}

export interface CreateGroupsProposal {
  id: UUID;
  type: 'create_groups';
  groups: Array<{
    name: string;
    color: string;
    memberNodeIds: UUID[];
    memberNames: string[];
  }>;
  status: ProposalStatus;
}

export interface AssignToGroupProposal {
  id: UUID;
  type: 'assign_to_group';
  groupId: UUID;
  groupName: string;
  nodeIds: UUID[];
  nodeNames: string[];
  status: ProposalStatus;
}

export interface AddNotesProposal {
  id: UUID;
  type: 'add_notes';
  notes: Array<{
    targetType: 'area' | 'group';
    targetId: UUID;
    targetName: string;
    content: string;
    reason?: string;
  }>;
  status: ProposalStatus;
}

// ============================================
// GROUP MANIPULATION PROPOSALS
// ============================================

export interface SplitGroupEqualProposal {
  id: UUID;
  type: 'split_group_equal';
  groupId: UUID;
  groupName: string;
  parts: number;
  nameSuffix?: string;
  status: ProposalStatus;
}

export interface SplitGroupProportionProposal {
  id: UUID;
  type: 'split_group_proportion';
  groupId: UUID;
  groupName: string;
  proportions: Array<{
    name: string;
    percent: number;
  }>;
  status: ProposalStatus;
}

export interface MergeGroupAreasProposal {
  id: UUID;
  type: 'merge_group_areas';
  groupId: UUID;
  groupName: string;
  newAreaName?: string;
  status: ProposalStatus;
}

export type Proposal =
  | CreateAreasProposal
  | SplitAreaProposal
  | SplitByQuantityProposal
  | MergeAreasProposal
  | UpdateAreasProposal
  | CreateGroupsProposal
  | AssignToGroupProposal
  | AddNotesProposal
  | SplitGroupEqualProposal
  | SplitGroupProportionProposal
  | MergeGroupAreasProposal;

export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'modified';
export type ProposalType = Proposal['type'];

// ============================================
// AI RESPONSE FORMAT
// ============================================

export interface AIResponse {
  message: string;
  proposals?: Array<Omit<Proposal, 'id' | 'status'>>;
  assumptions?: string[];
  confidence?: number;
}

// ============================================
// BRIEF PARSING
// ============================================

export interface ParsedBriefArea {
  name: string;
  areaPerUnit: number;
  count: number;
  briefNote?: string;
  aiNote?: string;
  groupHint?: string;
}

export interface DetectedGroup {
  name: string;
  color: string;
  areaNames: string[];
}

export interface GroupTotal {
  groupName: string;
  statedTotal: number;
  parsedTotal: number;
}

export interface ParsedBrief {
  areas: ParsedBriefArea[];
  detectedGroups?: DetectedGroup[];
  hasGroupStructure?: boolean;
  briefTotal?: number | null;         // Legacy - use netTotal/grossTotal
  netTotal?: number | null;           // NVO/NLA - excludes circulation
  grossTotal?: number | null;         // GFA/GIA - includes circulation
  netToGrossFactor?: number | null;   // Client's stated factor (e.g., 1.45)
  parsedTotal?: number;
  groupTotals?: GroupTotal[];
  projectContext: string;
  suggestedAreas?: ParsedBriefArea[];
  ambiguities?: string[];
  skipCirculationAddition?: boolean;  // True if factor already accounts for circulation
}
