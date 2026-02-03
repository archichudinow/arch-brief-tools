import type { UUID } from './project';

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

export type Proposal =
  | CreateAreasProposal
  | SplitAreaProposal
  | MergeAreasProposal
  | UpdateAreasProposal
  | CreateGroupsProposal
  | AssignToGroupProposal;

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
}

export interface ParsedBrief {
  areas: ParsedBriefArea[];
  projectContext: string;
  suggestedAreas?: ParsedBriefArea[];
  ambiguities?: string[];
}
