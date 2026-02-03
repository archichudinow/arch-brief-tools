import { v4 as uuidv4 } from 'uuid';
import type {
  UUID,
  AreaNode,
  Group,
  Proposal,
  AIResponse,
  ParsedBrief,
} from '@/types';

// ============================================
// SYSTEM PROMPTS
// ============================================

const BASE_SYSTEM_PROMPT = `You are an architectural brief assistant. You help users organize and structure building program areas.

Your capabilities:
1. Parse briefs to extract areas (names, sizes, counts)
2. Propose area breakdowns and splits
3. Suggest missing areas typical for the program type
4. Help balance and proportion area distributions
5. Answer questions about architectural programming

Rules:
- Always preserve total area when splitting/merging
- Provide reasoning for proposals
- Flag assumptions clearly
- Use metric units (m²)
- Be concise but complete

PROPOSAL TYPES (use EXACTLY these formats):

1. split_area - Split one area into multiple parts:
{
  "type": "split_area",
  "sourceNodeId": "the-uuid-of-area-to-split",
  "sourceName": "Original Area Name",
  "splits": [
    { "name": "Part 1 Name", "areaPerUnit": 100, "count": 1 },
    { "name": "Part 2 Name", "areaPerUnit": 150, "count": 2 }
  ],
  "groupName": "Optional Group Name",  // OPTIONAL: if user wants splits grouped, add this
  "groupColor": "#3b82f6"               // OPTIONAL: color for the group
}
NOTE: If user asks to split AND group the results, use groupName/groupColor fields instead of separate create_groups proposal!

2. create_areas - Create new areas:
{
  "type": "create_areas",
  "areas": [
    { "name": "Area Name", "areaPerUnit": 100, "count": 1 }
  ]
}

3. update_areas - Update existing areas:
{
  "type": "update_areas",
  "updates": [
    { "nodeId": "uuid", "nodeName": "Name", "changes": { "areaPerUnit": 120 } }
  ]
}

4. merge_areas - Merge multiple areas:
{
  "type": "merge_areas",
  "sourceNodeIds": ["uuid1", "uuid2"],
  "sourceNames": ["Area 1", "Area 2"],
  "result": { "name": "Merged Area", "areaPerUnit": 200, "count": 1 }
}

5. create_groups - Create groups:
{
  "type": "create_groups",
  "groups": [
    { "name": "Group Name", "color": "#3b82f6", "memberNodeIds": [], "memberNames": [] }
  ]
}

6. assign_to_group - Assign areas to a group:
{
  "type": "assign_to_group",
  "groupId": "group-uuid",
  "groupName": "Group Name",
  "nodeIds": ["area-uuid-1"],
  "nodeNames": ["Area Name"]
}

Response Format:
Always respond with valid JSON:
{
  "message": "Human-readable explanation of what you're proposing",
  "proposals": [{ ... }] or null if just answering a question,
  "assumptions": ["list of assumptions made"],
  "confidence": 0.0-1.0
}

IMPORTANT: When splitting, use the sourceNodeId from the context provided. The split parts should sum to the original total area.`;

const BRIEF_PARSING_PROMPT = `Parse the following architectural brief and extract ALL areas/rooms/spaces mentioned.

Be thorough - scan the entire text carefully for any mention of:
- Named rooms/spaces (offices, lobbies, bathrooms, storage, etc.)
- Area sizes (in m², sqm, sqft, square meters, square feet)
- Quantities/counts (e.g., "4 meeting rooms", "3x offices")
- Implicit spaces (if brief mentions 50 employees, they need workstations)

For each area found, extract:
- name: Clear, descriptive name (e.g., "Meeting Room", "Executive Office", "Open Office")
- areaPerUnit: Size in m² per unit. Convert from sqft if needed (1 sqft = 0.0929 m²). If not specified, estimate based on typical sizes.
- count: Number of units (default 1)
- briefNote: The exact quote or reference from the brief

Also provide:
1. suggestedAreas: Additional spaces that should be added based on building type (circulation, mechanical, storage, restrooms, etc.)
2. projectContext: A 150-200 word summary describing the project type, scale, and key requirements
3. ambiguities: List any unclear items or assumptions made

IMPORTANT: Extract EVERY distinct area mentioned, even if sizes aren't specified. Make reasonable estimates for missing sizes based on typical architectural standards.

Respond with valid JSON:
{
  "areas": [{ "name": string, "areaPerUnit": number, "count": number, "briefNote": string }],
  "suggestedAreas": [{ "name": string, "areaPerUnit": number, "count": number, "aiNote": string }],
  "projectContext": "summary text",
  "ambiguities": ["list of unclear items"]
}

Brief to parse:
`;

// ============================================
// TYPES
// ============================================

interface ChatRequestMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatRequestMessage[];
  response_format?: { type: 'json_object' };
}

// ============================================
// CONTEXT BUILDING
// ============================================

function formatNodeContext(nodes: AreaNode[]): string {
  if (nodes.length === 0) return '';
  
  let context = 'Selected Areas (use these IDs in proposals):\n';
  nodes.forEach((node) => {
    const total = node.count * node.areaPerUnit;
    context += `- ID: "${node.id}" | Name: "${node.name}" | ${node.count} × ${node.areaPerUnit}m² = ${total}m² total\n`;
  });
  return context;
}

function formatGroupContext(groups: Group[], allNodes: Record<UUID, AreaNode>): string {
  if (groups.length === 0) return '';
  
  let context = 'Selected Groups (use these IDs in proposals):\n';
  groups.forEach((group) => {
    const memberNodes = group.members
      .map((id) => allNodes[id])
      .filter(Boolean);
    const totalArea = memberNodes.reduce(
      (sum, n) => sum + n.count * n.areaPerUnit,
      0
    );
    context += `- ID: "${group.id}" | Name: "${group.name}" | ${group.members.length} areas, ${totalArea}m² total\n`;
    memberNodes.forEach((node) => {
      context += `  • ID: "${node.id}" | ${node.name}: ${node.count * node.areaPerUnit}m²\n`;
    });
  });
  return context;
}

function formatProjectSummary(
  nodes: Record<UUID, AreaNode>,
  groups: Record<UUID, Group>
): string {
  const nodeList = Object.values(nodes);
  const groupList = Object.values(groups);
  const totalArea = nodeList.reduce((sum, n) => sum + n.count * n.areaPerUnit, 0);
  
  let summary = `Project Summary:\n`;
  summary += `- Total Areas: ${nodeList.length}\n`;
  summary += `- Total Groups: ${groupList.length}\n`;
  summary += `- Combined Area: ${totalArea.toFixed(1)}m²\n\n`;
  
  if (groupList.length > 0) {
    summary += 'Groups:\n';
    groupList.forEach((g) => {
      const groupArea = g.members
        .map((id) => nodes[id])
        .filter(Boolean)
        .reduce((sum, n) => sum + n.count * n.areaPerUnit, 0);
      summary += `- ${g.name}: ${groupArea.toFixed(1)}m² (${g.members.length} areas)\n`;
    });
  }
  
  return summary;
}

// ============================================
// REQUEST BUILDING
// ============================================

export function buildChatRequest(
  userMessage: string,
  projectContext: string | null,
  selectedNodes: AreaNode[],
  selectedGroups: Group[],
  allNodes: Record<UUID, AreaNode>
): ChatRequest {
  const messages: ChatRequestMessage[] = [
    { role: 'system', content: BASE_SYSTEM_PROMPT },
  ];
  
  if (projectContext) {
    messages.push({
      role: 'system',
      content: `Project Context: ${projectContext}`,
    });
  }
  
  const selectionContext = [
    formatNodeContext(selectedNodes),
    formatGroupContext(selectedGroups, allNodes),
  ]
    .filter(Boolean)
    .join('\n');
  
  if (selectionContext) {
    messages.push({
      role: 'system',
      content: `Current Selection:\n${selectionContext}`,
    });
  }
  
  messages.push({ role: 'user', content: userMessage });
  
  return {
    messages,
    response_format: { type: 'json_object' },
  };
}

export function buildBriefParsingRequest(briefText: string): ChatRequest {
  return {
    messages: [
      { role: 'system', content: BASE_SYSTEM_PROMPT },
      { role: 'user', content: BRIEF_PARSING_PROMPT + briefText },
    ],
    response_format: { type: 'json_object' },
  };
}

// ============================================
// RESPONSE PARSING
// ============================================

export function parseAIResponse(responseText: string): AIResponse {
  try {
    const parsed = JSON.parse(responseText);
    return {
      message: parsed.message || '',
      proposals: parsed.proposals || undefined,
      assumptions: parsed.assumptions || undefined,
      confidence: parsed.confidence || undefined,
    };
  } catch {
    // If not JSON, treat as plain message
    return {
      message: responseText,
    };
  }
}

export function parseBriefResponse(responseText: string): ParsedBrief {
  try {
    const parsed = JSON.parse(responseText);
    return {
      areas: parsed.areas || [],
      projectContext: parsed.projectContext || '',
      suggestedAreas: parsed.suggestedAreas || undefined,
      ambiguities: parsed.ambiguities || undefined,
    };
  } catch {
    throw new Error('Failed to parse brief response');
  }
}

// ============================================
// PROPOSAL HELPERS
// ============================================

export function addIdsToProposals(
  proposals: Array<Omit<Proposal, 'id' | 'status'>>
): Proposal[] {
  console.log('addIdsToProposals input:', proposals);
  const result = proposals.map((p) => {
    const withId = {
      ...p,
      id: uuidv4(),
      status: 'pending' as const,
    };
    console.log('Proposal with ID:', withId);
    return withId;
  }) as Proposal[];
  console.log('addIdsToProposals output:', result);
  return result;
}

// ============================================
// API SERVICE - Real OpenAI Integration
// ============================================

export interface AIServiceConfig {
  apiKey?: string;
  endpoint?: string;
  model?: string;
}

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

function getApiKey(): string {
  const key = import.meta.env.VITE_OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI API key not configured. Add VITE_OPENAI_API_KEY to .env.local');
  }
  return key;
}

// Real OpenAI API call
export async function sendChatMessage(
  request: ChatRequest
): Promise<AIResponse> {
  const apiKey = getApiKey();
  
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: request.messages,
      response_format: request.response_format,
      temperature: 0.3,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }
  
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  console.log('AI Response raw:', content);
  
  const parsed = parseAIResponse(content);
  console.log('AI Response parsed:', parsed);
  
  return parsed;
}

export async function parseBrief(briefText: string): Promise<ParsedBrief> {
  const apiKey = getApiKey();
  
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: BASE_SYSTEM_PROMPT },
        { role: 'user', content: BRIEF_PARSING_PROMPT + briefText },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }
  
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  console.log('Brief parsing response:', content);
  
  return parseBriefResponse(content);
}

// ============================================
// PROJECT CONTEXT GENERATION
// ============================================

export function generateProjectSummary(
  nodes: Record<UUID, AreaNode>,
  groups: Record<UUID, Group>,
  projectContext: string | null
): string {
  const summary = formatProjectSummary(nodes, groups);
  if (projectContext) {
    return `${projectContext}\n\n${summary}`;
  }
  return summary;
}
