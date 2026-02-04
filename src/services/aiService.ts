import { v4 as uuidv4 } from 'uuid';
import type {
  UUID,
  AreaNode,
  Group,
  Proposal,
  ParsedBrief,
  ChatMode,
  AIRole,
  ContextLevel,
  DetectedGroup,
  GroupTotal,
} from '@/types';
import {
  validateAgentResponse,
  validateConsultationResponse,
  validateParsedBrief,
  validateProposal,
  validateEnhancedPrompts,
  validateBriefExtraction,
  validateBriefClassification,
  type BriefExtractionResult,
  type BriefClassificationResult,
} from './aiValidation';
import {
  buildSystemPrompt,
  BRIEF_PARSING_PROMPT,
  BRIEF_EXTRACTION_PROMPT,
  BRIEF_CLASSIFICATION_PROMPT,
  PROMPT_ENHANCER_SYSTEM,
  type PromptConfig,
} from './aiPrompts';

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

export interface AIResponse {
  message: string;
  proposals?: Array<Omit<Proposal, 'id' | 'status'>>;
  reasoning?: string;
  references?: string[];
}

export interface AIServiceConfig {
  mode: ChatMode;
  role?: AIRole;
  contextLevel?: ContextLevel;
}

export interface AIError {
  type: 'api_error' | 'validation_error' | 'parse_error' | 'config_error';
  message: string;
  details?: string;
  rawResponse?: string;
}

// ============================================
// CONTEXT BUILDING
// ============================================

function formatNodeContext(nodes: AreaNode[], level: ContextLevel): string {
  if (nodes.length === 0) return '';
  
  let context = 'Areas:\n';
  nodes.forEach((node) => {
    const total = node.count * node.areaPerUnit;
    context += `- ID: "${node.id}" | Name: "${node.name}" | ${node.count} × ${node.areaPerUnit}m² = ${total}m²`;
    
    // Include notes only for standard/full context
    if (level !== 'minimal' && node.notes && node.notes.length > 0) {
      const notesSummary = node.notes.map(n => `[${n.source}] ${n.content.slice(0, 50)}`).join('; ');
      context += ` | Notes: ${notesSummary}`;
    }
    context += '\n';
  });
  return context;
}

function formatGroupContext(
  groups: Group[],
  allNodes: Record<UUID, AreaNode>,
  level: ContextLevel
): string {
  if (groups.length === 0) return '';
  
  let context = 'Groups:\n';
  groups.forEach((group) => {
    const memberNodes = group.members
      .map((id) => allNodes[id])
      .filter(Boolean);
    const totalArea = memberNodes.reduce(
      (sum, n) => sum + n.count * n.areaPerUnit,
      0
    );
    context += `- ID: "${group.id}" | Name: "${group.name}" | ${group.members.length} areas, ${totalArea}m² total\n`;
    
    if (level !== 'minimal') {
      memberNodes.forEach((node) => {
        context += `  • ID: "${node.id}" | ${node.name}: ${node.count * node.areaPerUnit}m²\n`;
      });
    }
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
  summary += `- Combined Area: ${totalArea.toFixed(1)}m²\n`;
  
  return summary;
}

// ============================================
// CONTEXT LEVEL SELECTION
// ============================================

function determineContextLevel(
  userMessage: string,
  hasSelection: boolean
): ContextLevel {
  const fullContextKeywords = ['all', 'entire', 'whole', 'program', 'organize', 'group all'];
  const minimalKeywords = ['rename', 'change name', 'adjust'];
  
  const lowerMessage = userMessage.toLowerCase();
  
  if (fullContextKeywords.some(k => lowerMessage.includes(k))) {
    return 'full';
  }
  if (minimalKeywords.some(k => lowerMessage.includes(k)) && hasSelection) {
    return 'minimal';
  }
  return 'standard';
}

// ============================================
// REQUEST BUILDING
// ============================================

export function buildChatRequest(
  userMessage: string,
  projectContext: string | null,
  selectedNodes: AreaNode[],
  selectedGroups: Group[],
  allNodes: Record<UUID, AreaNode>,
  allGroups: Record<UUID, Group>,
  config: AIServiceConfig = { mode: 'agent' }
): ChatRequest {
  const hasSelection = selectedNodes.length > 0 || selectedGroups.length > 0;
  const contextLevel = config.contextLevel || determineContextLevel(userMessage, hasSelection);
  
  // Build system prompt
  const promptConfig: PromptConfig = {
    mode: config.mode,
    role: config.role,
    contextLevel,
    includeFewShot: config.mode === 'agent',
  };
  
  const messages: ChatRequestMessage[] = [
    { role: 'system', content: buildSystemPrompt(promptConfig) },
  ];
  
  // Add project context if available
  if (projectContext) {
    messages.push({
      role: 'system',
      content: `Project Context: ${projectContext}`,
    });
  }
  
  // Add project summary for full context
  if (contextLevel === 'full') {
    messages.push({
      role: 'system',
      content: formatProjectSummary(allNodes, allGroups),
    });
  }
  
  // Determine which nodes/groups to include
  let nodesToInclude: AreaNode[];
  let groupsToInclude: Group[];
  
  // When groups are selected, also include their member nodes
  const groupMemberNodes: AreaNode[] = selectedGroups.flatMap((group) =>
    group.members.map((id) => allNodes[id]).filter(Boolean)
  );
  const combinedSelectedNodes = [
    ...selectedNodes,
    ...groupMemberNodes.filter((n) => !selectedNodes.some((s) => s.id === n.id)),
  ];
  
  switch (contextLevel) {
    case 'minimal':
      nodesToInclude = combinedSelectedNodes;
      groupsToInclude = selectedGroups;
      break;
    case 'standard':
      nodesToInclude = hasSelection ? combinedSelectedNodes : Object.values(allNodes).slice(0, 20);
      groupsToInclude = hasSelection ? selectedGroups : Object.values(allGroups).slice(0, 10);
      break;
    case 'full':
      nodesToInclude = Object.values(allNodes);
      groupsToInclude = Object.values(allGroups);
      break;
  }
  
  // Build context content
  const selectionContext = [
    formatNodeContext(nodesToInclude, contextLevel),
    formatGroupContext(groupsToInclude, allNodes, contextLevel),
  ]
    .filter(Boolean)
    .join('\n');
  
  if (selectionContext) {
    const label = hasSelection ? 'Selected Items' : 'Project Areas';
    messages.push({
      role: 'system',
      content: `${label}:\n${selectionContext}`,
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
      { role: 'user', content: BRIEF_PARSING_PROMPT + briefText },
    ],
    response_format: { type: 'json_object' },
  };
}

// ============================================
// RESPONSE PARSING WITH VALIDATION
// ============================================

function parseAndValidateAgentResponse(
  responseText: string
): { success: true; data: AIResponse } | { success: false; error: AIError } {
  let parsed: unknown;
  
  try {
    parsed = JSON.parse(responseText);
  } catch {
    return {
      success: false,
      error: {
        type: 'parse_error',
        message: 'Invalid JSON response from AI',
        rawResponse: responseText,
      },
    };
  }
  
  const validation = validateAgentResponse(parsed);
  
  if (!validation.success) {
    return {
      success: false,
      error: {
        type: 'validation_error',
        message: 'AI response failed validation',
        details: validation.error,
        rawResponse: responseText,
      },
    };
  }
  
  // Validate each proposal individually
  const validatedProposals: Array<Omit<Proposal, 'id' | 'status'>> = [];
  if (validation.data!.proposals) {
    for (const proposal of validation.data!.proposals) {
      const proposalValidation = validateProposal(proposal);
      if (proposalValidation.success) {
        validatedProposals.push(proposalValidation.data!);
      } else {
        console.warn('Invalid proposal filtered out:', proposalValidation.error);
      }
    }
  }
  
  return {
    success: true,
    data: {
      message: validation.data!.message,
      proposals: validatedProposals.length > 0 ? validatedProposals : undefined,
    },
  };
}

function parseAndValidateConsultationResponse(
  responseText: string
): { success: true; data: AIResponse } | { success: false; error: AIError } {
  let parsed: unknown;
  
  try {
    parsed = JSON.parse(responseText);
  } catch {
    return {
      success: false,
      error: {
        type: 'parse_error',
        message: 'Invalid JSON response from AI',
        rawResponse: responseText,
      },
    };
  }
  
  const validation = validateConsultationResponse(parsed);
  
  if (!validation.success) {
    return {
      success: false,
      error: {
        type: 'validation_error',
        message: 'AI response failed validation',
        details: validation.error,
        rawResponse: responseText,
      },
    };
  }
  
  return {
    success: true,
    data: {
      message: validation.data!.message,
      reasoning: validation.data!.reasoning,
      references: validation.data!.references,
    },
  };
}

function parseAndValidateBriefResponse(
  responseText: string
): { success: true; data: ParsedBrief } | { success: false; error: AIError } {
  let parsed: unknown;
  
  try {
    parsed = JSON.parse(responseText);
  } catch {
    return {
      success: false,
      error: {
        type: 'parse_error',
        message: 'Invalid JSON response from AI',
        rawResponse: responseText,
      },
    };
  }
  
  const validation = validateParsedBrief(parsed);
  
  if (!validation.success) {
    return {
      success: false,
      error: {
        type: 'validation_error',
        message: 'Brief parsing failed validation',
        details: validation.error,
        rawResponse: responseText,
      },
    };
  }
  
  return {
    success: true,
    data: {
      areas: validation.data!.areas,
      projectContext: validation.data!.projectContext,
      suggestedAreas: validation.data!.suggestedAreas,
      ambiguities: validation.data!.ambiguities,
    },
  };
}

// ============================================
// PROPOSAL HELPERS
// ============================================

export function addIdsToProposals(
  proposals: Array<Omit<Proposal, 'id' | 'status'>>
): Proposal[] {
  return proposals.map((p) => ({
    ...p,
    id: uuidv4(),
    status: 'pending' as const,
  })) as Proposal[];
}

// ============================================
// API SERVICE
// ============================================

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

function getApiKey(): string {
  const key = import.meta.env.VITE_OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI API key not configured. Add VITE_OPENAI_API_KEY to .env.local');
  }
  return key;
}

export async function sendChatMessage(
  request: ChatRequest,
  mode: ChatMode = 'agent'
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
    throw {
      type: 'api_error',
      message: error.error?.message || `API error: ${response.status}`,
    } as AIError;
  }
  
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  console.log('AI Response raw:', content);
  
  // Parse and validate based on mode
  const result = mode === 'agent'
    ? parseAndValidateAgentResponse(content)
    : parseAndValidateConsultationResponse(content);
  
  if (!result.success) {
    console.error('AI response validation failed:', result.error);
    // Return a safe fallback response
    return {
      message: result.error.message + (result.error.details ? `: ${result.error.details}` : ''),
    };
  }
  
  return result.data;
}

// ============================================
// TWO-PASS BRIEF PARSING
// ============================================

const GROUP_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

async function extractBriefRows(briefText: string, apiKey: string): Promise<BriefExtractionResult> {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: BRIEF_EXTRACTION_PROMPT + briefText },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1, // Very low for precise extraction
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw {
      type: 'api_error',
      message: error.error?.message || `Extraction failed: ${response.status}`,
    } as AIError;
  }
  
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  console.log('Pass 1 - Extraction:', content);
  
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw { type: 'parse_error', message: 'Invalid JSON in extraction' } as AIError;
  }
  
  const validation = validateBriefExtraction(parsed);
  if (!validation.success) {
    throw { type: 'validation_error', message: validation.error } as AIError;
  }
  
  return validation.data!;
}

async function classifyBriefRows(
  extractedRows: BriefExtractionResult,
  apiKey: string
): Promise<BriefClassificationResult> {
  // Format rows for classification
  const rowsForClassification = extractedRows.rows.map((row, i) => ({
    index: i,
    text: row.text,
    value: row.value,
    multiplier: row.multiplier,
    totalArea: row.value * (row.multiplier || 1),
    section: row.section,
    lineType: row.lineType,
  }));
  
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: BRIEF_CLASSIFICATION_PROMPT + JSON.stringify(rowsForClassification, null, 2) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw {
      type: 'api_error',
      message: error.error?.message || `Classification failed: ${response.status}`,
    } as AIError;
  }
  
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  console.log('Pass 2 - Classification:', content);
  
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw { type: 'parse_error', message: 'Invalid JSON in classification' } as AIError;
  }
  
  const validation = validateBriefClassification(parsed);
  if (!validation.success) {
    throw { type: 'validation_error', message: validation.error } as AIError;
  }
  
  return validation.data!;
}

function buildParsedBrief(
  extraction: BriefExtractionResult,
  classification: BriefClassificationResult
): ParsedBrief {
  // Get all spaces, separating indoor from outdoor
  const allSpaceClassifications = classification.classified.filter(c => c.classification === 'space');
  
  // Filter out outdoor spaces for the main area list
  const indoorSpaceClassifications = allSpaceClassifications.filter(c => {
    const row = extraction.rows[c.index];
    return !row.isOutdoor;
  });
  
  const spaces = indoorSpaceClassifications.map(c => {
    const row = extraction.rows[c.index];
    // Use parentSection if available, otherwise section
    const groupHint = row.parentSection || row.section || undefined;
    return {
      name: row.text,
      areaPerUnit: row.value,
      count: row.multiplier || 1,
      briefNote: `${row.text}: ${row.multiplier > 1 ? `${row.multiplier} × ` : ''}${row.value}m²`,
      groupHint,
    };
  });
  
  // Build detected groups from classification with proper hierarchy
  const classificationGroups = classification.groups || [];
  
  // Filter groups that have spaces (not just parent groups)
  const groupsWithSpaces = classificationGroups.filter(g => g.itemIndices.length > 0);
  
  const detectedGroups: DetectedGroup[] = groupsWithSpaces.map((g, i) => {
    // Only include indoor spaces in the group
    const indoorIndices = g.itemIndices.filter(idx => {
      const row = extraction.rows[idx];
      const isSpace = classification.classified.find(c => c.index === idx)?.classification === 'space';
      return isSpace && !row?.isOutdoor;
    });
    
    return {
      name: g.name,
      color: g.color || GROUP_COLORS[i % GROUP_COLORS.length],
      areaNames: indoorIndices
        .map(idx => extraction.rows[idx]?.text)
        .filter(Boolean),
    };
  }).filter(g => g.areaNames.length > 0); // Only include groups with areas
  
  // Calculate indoor totals
  const parsedIndoorTotal = spaces.reduce((sum, s) => sum + s.areaPerUnit * s.count, 0);
  
  // Build group totals based on subtotals and group hierarchy
  const groupTotals: GroupTotal[] = [];
  
  // Create a map of section -> parsed total
  const sectionTotals = new Map<string, number>();
  
  // Calculate totals per section from parsed spaces
  spaces.forEach(s => {
    if (s.groupHint) {
      const current = sectionTotals.get(s.groupHint) || 0;
      sectionTotals.set(s.groupHint, current + s.areaPerUnit * s.count);
    }
  });
  
  // Match subtotals to their sections using the group's subtotalIndex
  classificationGroups.forEach(g => {
    if (g.subtotalIndex !== null && g.subtotalIndex !== undefined) {
      const subtotalRow = extraction.rows[g.subtotalIndex];
      if (subtotalRow) {
        const statedTotal = subtotalRow.value * (subtotalRow.multiplier || 1);
        
        // Calculate parsed total for this group (indoor only)
        const indoorIndices = g.itemIndices.filter(idx => {
          const row = extraction.rows[idx];
          return !row?.isOutdoor;
        });
        
        const parsedGroupTotal = indoorIndices.reduce((sum, idx) => {
          const row = extraction.rows[idx];
          return sum + (row?.value || 0) * (row?.multiplier || 1);
        }, 0);
        
        // Only add if there's a meaningful stated total
        if (statedTotal > 0) {
          groupTotals.push({
            groupName: g.name,
            statedTotal,
            parsedTotal: parsedGroupTotal,
          });
        }
      }
    }
  });
  
  // Build ambiguities from discrepancies
  const ambiguities: string[] = [];
  
  groupTotals.forEach(gt => {
    const diff = Math.abs(gt.statedTotal - gt.parsedTotal);
    if (diff > gt.statedTotal * 0.02) { // More than 2% difference
      ambiguities.push(
        `${gt.groupName}: parsed ${gt.parsedTotal}m² vs stated ${gt.statedTotal}m² (diff: ${diff}m²)`
      );
    }
  });
  
  // Use indoor total from classification/extraction
  const briefTotal = classification.indoorTotal || extraction.indoorTotal || null;
  if (briefTotal && Math.abs(parsedIndoorTotal - briefTotal) > briefTotal * 0.02) {
    ambiguities.push(
      `Program total: parsed ${parsedIndoorTotal}m² vs stated ${briefTotal}m² (diff: ${Math.abs(parsedIndoorTotal - briefTotal)}m²)`
    );
  }
  
  // Track outdoor spaces separately
  const outdoorSpaces = allSpaceClassifications
    .filter(c => extraction.rows[c.index]?.isOutdoor)
    .map(c => extraction.rows[c.index]?.text);
  
  if (outdoorSpaces.length > 0) {
    const outdoorTotal = allSpaceClassifications
      .filter(c => extraction.rows[c.index]?.isOutdoor)
      .reduce((sum, c) => {
        const row = extraction.rows[c.index];
        return sum + (row?.value || 0) * (row?.multiplier || 1);
      }, 0);
    
    console.log(`Outdoor spaces excluded (${outdoorTotal}m²): ${outdoorSpaces.join(', ')}`);
  }
  
  // Add low-confidence classifications
  classification.classified
    .filter(c => c.classification === 'space' && c.confidence < 0.7)
    .forEach(c => {
      const row = extraction.rows[c.index];
      ambiguities.push(`Low confidence (${(c.confidence * 100).toFixed(0)}%): "${row.text}" - ${c.reason}`);
    });
  
  return {
    areas: spaces,
    detectedGroups: detectedGroups.length > 0 ? detectedGroups : undefined,
    hasGroupStructure: detectedGroups.length > 0,
    briefTotal,
    parsedTotal: parsedIndoorTotal,
    groupTotals: groupTotals.length > 0 ? groupTotals : undefined,
    projectContext: classification.projectContext || extraction.projectDescription || '',
    suggestedAreas: [], // Two-pass doesn't suggest
    ambiguities: ambiguities.length > 0 ? ambiguities : undefined,
  };
}

export async function parseBrief(briefText: string): Promise<ParsedBrief> {
  const apiKey = getApiKey();
  
  console.log('Starting two-pass brief parsing...');
  
  try {
    // Pass 1: Extract all rows
    const extraction = await extractBriefRows(briefText, apiKey);
    console.log(`Pass 1 complete: ${extraction.rows.length} rows extracted`);
    
    // Pass 2: Classify rows
    const classification = await classifyBriefRows(extraction, apiKey);
    const spaceCount = classification.classified.filter(c => c.classification === 'space').length;
    console.log(`Pass 2 complete: ${spaceCount} spaces identified`);
    
    // Build final result
    const result = buildParsedBrief(extraction, classification);
    console.log(`Parsing complete: ${result.areas.length} areas, ${result.parsedTotal}m² total`);
    
    return result;
  } catch (error) {
    console.error('Two-pass parsing failed, falling back to single-pass:', error);
    
    // Fallback to single-pass
    return parseBriefSinglePass(briefText, apiKey);
  }
}

// Fallback single-pass parsing
async function parseBriefSinglePass(briefText: string, apiKey: string): Promise<ParsedBrief> {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: BRIEF_PARSING_PROMPT + briefText },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw {
      type: 'api_error',
      message: error.error?.message || `API error: ${response.status}`,
    } as AIError;
  }
  
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  console.log('Single-pass brief parsing response:', content);
  
  const result = parseAndValidateBriefResponse(content);
  
  if (!result.success) {
    throw result.error;
  }
  
  return result.data;
}

// ============================================
// PROMPT ENHANCER
// ============================================

export interface EnhancedPrompt {
  title: string;
  prompt: string;
  operations: string[];
  affectedItems: string[];
}

export async function enhancePrompt(
  userPrompt: string,
  selectedNodes: AreaNode[],
  selectedGroups: Group[],
  allNodes: Record<UUID, AreaNode>,
  allGroups: Record<UUID, Group>
): Promise<EnhancedPrompt[]> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  
  if (!apiKey) {
    throw {
      type: 'config_error',
      message: 'OpenAI API key not configured',
    } as AIError;
  }
  
  // Build context about selected/available items
  const contextParts: string[] = [];
  
  // Include group member nodes when groups are selected
  const groupMemberNodes: AreaNode[] = selectedGroups.flatMap((group) =>
    group.members.map((id) => allNodes[id]).filter(Boolean)
  );
  const combinedNodes = [
    ...selectedNodes,
    ...groupMemberNodes.filter((n) => !selectedNodes.some((s) => s.id === n.id)),
  ];
  
  if (combinedNodes.length > 0) {
    contextParts.push('Selected Areas:');
    combinedNodes.forEach((n) => {
      contextParts.push(`- ${n.name} (${n.count * n.areaPerUnit}m²)`);
    });
  }
  
  if (selectedGroups.length > 0) {
    contextParts.push('\nSelected Groups:');
    selectedGroups.forEach((g) => {
      const members = g.members.map(id => allNodes[id]?.name).filter(Boolean);
      contextParts.push(`- ${g.name}: ${members.join(', ')}`);
    });
  }
  
  // Add project overview if nothing selected
  if (combinedNodes.length === 0 && selectedGroups.length === 0) {
    const allNodeList = Object.values(allNodes);
    const allGroupList = Object.values(allGroups);
    contextParts.push(`Project has ${allNodeList.length} areas and ${allGroupList.length} groups.`);
    if (allNodeList.length > 0) {
      contextParts.push('Areas: ' + allNodeList.slice(0, 10).map(n => n.name).join(', '));
    }
  }
  
  const contextString = contextParts.join('\n');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: PROMPT_ENHANCER_SYSTEM },
        { role: 'user', content: `User prompt: "${userPrompt}"\n\nContext:\n${contextString}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw {
      type: 'api_error',
      message: error.error?.message || `API error: ${response.status}`,
    } as AIError;
  }
  
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw {
      type: 'parse_error',
      message: 'Invalid JSON from prompt enhancer',
    } as AIError;
  }
  
  const validation = validateEnhancedPrompts(parsed);
  if (!validation.success) {
    throw {
      type: 'validation_error',
      message: 'Invalid enhanced prompts format',
      details: validation.error,
    } as AIError;
  }
  
  return validation.data!.options;
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
