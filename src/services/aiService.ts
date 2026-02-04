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
import {
  analyzeInput,
  type InputClassification,
} from './briefAnalyzer';
import {
  GENERATE_PROMPT,
  EXTRACT_TOLERANT_PROMPT,
  RECONCILIATION_PROMPT,
  INVALID_INPUT_RESPONSE,
  buildPrompt,
  formatAreasForReconciliation,
  GROUP_COLORS,
} from './briefStrategies';
import {
  detectNumericIntent,
  executeScaleOperation,
  executeAdjustByPercent,
  type DetectedIntent,
} from './areaOperations';
import {
  validateIntent,
  executeIntent,
  type AIIntent,
} from './intentExecutor';


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
  let totalArea = 0;
  nodes.forEach((node) => {
    const total = node.count * node.areaPerUnit;
    totalArea += total;
    context += `- ID: "${node.id}" | Name: "${node.name}" | ${node.count} × ${node.areaPerUnit}m² = ${total}m²`;
    
    // Include notes only for standard/full context
    if (level !== 'minimal' && node.notes && node.notes.length > 0) {
      const notesSummary = node.notes.map(n => `[${n.source}] ${n.content.slice(0, 50)}`).join('; ');
      context += ` | Notes: ${notesSummary}`;
    }
    context += '\n';
  });
  
  // Add total for math calculations
  context += `\n>>> CURRENT TOTAL: ${totalArea}m² (${nodes.length} areas) <<<\n`;
  
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

// ============================================
// INTENT-BASED RESPONSE PROCESSING
// ============================================

/**
 * Process AI response through intent system
 * Converts ratio-based intents to exact proposals
 */
function parseAndProcessIntentResponse(
  responseText: string,
  existingNodes: AreaNode[],
  existingGroups: Group[]
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

  const output = parsed as Record<string, unknown>;
  const message = (output.message as string) || 'AI proposal';

  // Check if this is an intent-based response
  if (output.intent && typeof output.intent === 'object') {
    console.log('Processing intent-based response:', output.intent);
    
    const intent = output.intent as AIIntent;
    
    // Validate intent
    const validation = validateIntent(intent, existingNodes, existingGroups);
    if (!validation.valid) {
      console.warn('Intent validation failed:', validation.errors);
      return {
        success: false,
        error: {
          type: 'validation_error',
          message: `Invalid intent: ${validation.errors.join(', ')}`,
          rawResponse: responseText,
        },
      };
    }
    
    // Log warnings
    if (validation.warnings.length > 0) {
      console.warn('Intent warnings:', validation.warnings);
    }
    
    // Execute intent to produce proposals
    try {
      const result = executeIntent(intent, existingNodes, existingGroups);
      
      console.log('Intent executed, proposals:', result.proposals);
      
      // Validate produced proposals
      const validatedProposals: Array<Omit<Proposal, 'id' | 'status'>> = [];
      for (const proposal of result.proposals) {
        const proposalValidation = validateProposal(proposal);
        if (proposalValidation.success) {
          validatedProposals.push(proposalValidation.data!);
        } else {
          console.warn('Produced proposal failed validation:', proposalValidation.error);
        }
      }
      
      return {
        success: true,
        data: {
          message: result.message || message,
          proposals: validatedProposals.length > 0 ? validatedProposals : undefined,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'validation_error',
          message: error instanceof Error ? error.message : 'Intent execution failed',
          rawResponse: responseText,
        },
      };
    }
  }
  
  // Fallback: Try legacy format with proposals array
  console.log('Processing legacy proposal format...');
  return parseAndValidateAgentResponse(responseText);
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

/**
 * Process raw AI response through intent system (for external use)
 * Called after sendChatMessage to convert intents to proposals
 */
export function processIntentResponse(
  rawResponse: string,
  existingNodes: AreaNode[],
  existingGroups: Group[]
): AIResponse {
  const result = parseAndProcessIntentResponse(rawResponse, existingNodes, existingGroups);
  
  if (!result.success) {
    console.error('Intent processing failed:', result.error);
    return {
      message: result.error.message + (result.error.details ? `: ${result.error.details}` : ''),
    };
  }
  
  return result.data;
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
  mode: ChatMode = 'agent',
  context?: { nodes: AreaNode[]; groups: Group[] }
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
  // For agent mode with context, use intent processing (two-phase architecture)
  let result: { success: true; data: AIResponse } | { success: false; error: AIError };
  
  if (mode === 'agent' && context) {
    // NEW: Two-phase processing - extract intent, execute with code
    result = parseAndProcessIntentResponse(content, context.nodes, context.groups);
  } else if (mode === 'agent') {
    // Legacy: direct proposal processing (no context for intent)
    result = parseAndValidateAgentResponse(content);
  } else {
    result = parseAndValidateConsultationResponse(content);
  }
  
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
// DETERMINISTIC OPERATIONS - Code handles math
// ============================================

export interface DeterministicResult {
  handled: boolean;
  intent?: DetectedIntent;
  response?: AIResponse;
}

/**
 * Try to handle the request with deterministic code (no LLM for math).
 * Returns { handled: true, response } if handled, { handled: false } otherwise.
 */
export function tryDeterministicOperation(
  userMessage: string,
  selectedNodes: AreaNode[],
  selectedGroups: Group[],
  allNodes: Record<UUID, AreaNode>
): DeterministicResult {
  const intent = detectNumericIntent(userMessage);
  
  console.log('Intent detection:', intent);
  
  // Only handle high-confidence numeric operations
  if (intent.confidence < 0.8) {
    return { handled: false, intent };
  }
  
  // Get nodes to operate on
  const groupMemberNodes: AreaNode[] = selectedGroups.flatMap((group) =>
    group.members.map((id) => allNodes[id]).filter(Boolean)
  );
  const nodesToOperate = [
    ...selectedNodes,
    ...groupMemberNodes.filter((n) => !selectedNodes.some((s) => s.id === n.id)),
  ];
  
  // If nothing selected, operate on all
  const targetNodes = nodesToOperate.length > 0 
    ? nodesToOperate 
    : Object.values(allNodes);
  
  if (targetNodes.length === 0) {
    return { handled: false, intent };
  }
  
  const currentTotal = targetNodes.reduce(
    (sum, n) => sum + n.areaPerUnit * n.count, 
    0
  );
  
  // Handle SCALE TO TARGET
  if (intent.type === 'scale_to_target' && intent.targetValue) {
    console.log(`Deterministic: Scaling from ${currentTotal}m² to ${intent.targetValue}m²`);
    
    const updates = executeScaleOperation(
      {
        op: 'scale_to_target',
        targetArea: intent.targetValue,
        scope: nodesToOperate.length > 0 ? 'selected' : 'all',
        method: 'proportional',
        nodeIds: targetNodes.map(n => n.id),
      },
      targetNodes
    );
    
    if (updates.length === 0) {
      return { handled: false, intent };
    }
    
    // Build proposal - use explicit typing for discriminated union
    const proposal = {
      type: 'update_areas' as const,
      updates: updates.map(u => {
        const node = targetNodes.find(n => n.id === u.nodeId)!;
        return {
          nodeId: u.nodeId,
          nodeName: node.name,
          changes: { areaPerUnit: u.newAreaPerUnit },
        };
      }),
    };
    
    // Calculate new total for message
    const newTotal = updates.reduce((sum, u) => {
      const node = targetNodes.find(n => n.id === u.nodeId)!;
      return sum + u.newAreaPerUnit * node.count;
    }, 0);
    
    return {
      handled: true,
      intent,
      response: {
        message: `Scaled ${targetNodes.length} areas from ${currentTotal}m² to ${newTotal}m² (target: ${intent.targetValue}m²)`,
        proposals: [proposal],
      },
    };
  }
  
  // Handle ADJUST BY PERCENT
  if (intent.type === 'adjust_percent' && intent.percent !== undefined) {
    console.log(`Deterministic: Adjusting by ${intent.percent}%`);
    
    const updates = executeAdjustByPercent(
      {
        op: 'adjust_by_percent',
        percent: intent.percent,
        scope: nodesToOperate.length > 0 ? 'selected' : 'all',
        nodeIds: targetNodes.map(n => n.id),
      },
      targetNodes
    );
    
    if (updates.length === 0) {
      return { handled: false, intent };
    }
    
    // Build proposal - use explicit typing for discriminated union
    const proposal = {
      type: 'update_areas' as const,
      updates: updates.map(u => {
        const node = targetNodes.find(n => n.id === u.nodeId)!;
        return {
          nodeId: u.nodeId,
          nodeName: node.name,
          changes: { areaPerUnit: u.newAreaPerUnit },
        };
      }),
    };
    
    // Calculate new total for message
    const newTotal = updates.reduce((sum, u) => {
      const node = targetNodes.find(n => n.id === u.nodeId)!;
      return sum + u.newAreaPerUnit * node.count;
    }, 0);
    
    const direction = intent.percent > 0 ? 'Increased' : 'Decreased';
    
    return {
      handled: true,
      intent,
      response: {
        message: `${direction} ${targetNodes.length} areas by ${Math.abs(intent.percent)}%: ${currentTotal}m² → ${newTotal}m²`,
        proposals: [proposal],
      },
    };
  }
  
  return { handled: false, intent };
}

// ============================================
// TWO-PASS BRIEF PARSING
// ============================================

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
    // Use comment from extraction as briefNote (architectural context from the brief)
    const briefNote = row.comment || undefined;
    return {
      name: row.text,
      areaPerUnit: row.value,
      count: row.multiplier || 1,
      briefNote,
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
    netTotal: extraction.netTotal || briefTotal,
    grossTotal: extraction.grossTotal || null,
    netToGrossFactor: extraction.netToGrossFactor || null,
    parsedTotal: parsedIndoorTotal,
    groupTotals: groupTotals.length > 0 ? groupTotals : undefined,
    projectContext: classification.projectContext || extraction.projectDescription || '',
    suggestedAreas: [],
    ambiguities: ambiguities.length > 0 ? ambiguities : undefined,
    skipCirculationAddition: (extraction.netToGrossFactor && extraction.netToGrossFactor > 1) || false,
  };
}

export async function parseBrief(briefText: string): Promise<ParsedBrief & { inputClassification?: InputClassification }> {
  const apiKey = getApiKey();
  
  // Step 1: Analyze input to determine strategy
  const classification = analyzeInput(briefText);
  console.log('Input analysis:', {
    type: classification.type,
    quality: classification.quality,
    strategy: classification.strategy,
    confidence: classification.confidence,
  });
  
  // Step 2: Handle based on strategy
  switch (classification.strategy) {
    case 'reject':
      console.log('Input rejected - invalid content');
      return {
        ...INVALID_INPUT_RESPONSE,
        inputClassification: classification,
      };
    
    case 'generate':
      console.log('Using GENERATE strategy for prompt input');
      return {
        ...(await parseWithGenerateStrategy(classification.cleanedText, apiKey)),
        inputClassification: classification,
      };
    
    case 'extract_tolerant':
      console.log('Using EXTRACT_TOLERANT strategy for dirty brief');
      return {
        ...(await parseWithTolerantStrategy(classification.cleanedText, apiKey, classification)),
        inputClassification: classification,
      };
    
    case 'extract_strict':
    default:
      console.log('Using EXTRACT_STRICT strategy for structured brief');
      return {
        ...(await parseWithStrictStrategy(classification.cleanedText, apiKey)),
        inputClassification: classification,
      };
  }
}

// ============================================
// STRATEGY: GENERATE (for prompts)
// ============================================

async function parseWithGenerateStrategy(promptText: string, apiKey: string): Promise<ParsedBrief> {
  console.log('Starting generate mode parsing...');
  
  const prompt = buildPrompt(GENERATE_PROMPT, { userInput: promptText });
  
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7, // Higher for creativity
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw {
      type: 'api_error',
      message: error.error?.message || `Generate failed: ${response.status}`,
    } as AIError;
  }
  
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  console.log('Generate response:', content);
  
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw { type: 'parse_error', message: 'Invalid JSON in generate response' } as AIError;
  }
  
  // Get target area from response
  const targetArea = (parsed.targetArea as number) || 0;
  
  // Handle both percentage-based (new) and area-based (legacy) responses
  const rawAreas = (parsed.areas as Array<{
    name: string;
    percentage?: number;
    areaPerUnit?: number;
    count?: number;
    groupHint?: string;
    aiNote?: string;
  }>) || [];
  
  const detectedGroups = (parsed.detectedGroups as Array<{ name: string; color: string; areaNames: string[] }>) || [];
  
  let formattedAreas: Array<{
    name: string;
    areaPerUnit: number;
    count: number;
    groupHint?: string;
    aiNote?: string;
  }>;
  
  // Check if response uses percentages (new format) or absolute areas (legacy)
  const usesPercentages = rawAreas.length > 0 && rawAreas[0].percentage !== undefined;
  
  if (usesPercentages && targetArea > 0) {
    // NEW: Convert percentages to exact areas using deterministic math
    console.log('Converting percentages to exact areas...');
    
    const totalPercent = rawAreas.reduce((sum, a) => sum + (a.percentage || 0), 0);
    
    // Convert each area
    const convertedAreas = rawAreas.map(a => {
      const normalizedPercent = totalPercent > 0 
        ? ((a.percentage || 0) / totalPercent) * 100 
        : 100 / rawAreas.length;
      const exactArea = Math.round((normalizedPercent / 100) * targetArea);
      
      return {
        name: a.name,
        areaPerUnit: exactArea,
        count: 1,
        groupHint: a.groupHint,
        aiNote: a.aiNote ? `${a.aiNote} (${a.percentage}%)` : `${a.percentage}% of program`,
      };
    });
    
    // Fix rounding errors by adjusting largest area
    const currentTotal = convertedAreas.reduce((sum, a) => sum + a.areaPerUnit, 0);
    const roundingError = targetArea - currentTotal;
    
    if (roundingError !== 0 && convertedAreas.length > 0) {
      const largestIndex = convertedAreas.reduce(
        (maxIdx, area, idx, arr) => 
          area.areaPerUnit > arr[maxIdx].areaPerUnit ? idx : maxIdx,
        0
      );
      convertedAreas[largestIndex].areaPerUnit += roundingError;
    }
    
    formattedAreas = convertedAreas;
    
    // Verify total
    const verifiedTotal = formattedAreas.reduce((sum, a) => sum + a.areaPerUnit * a.count, 0);
    console.log(`Target: ${targetArea}m², Actual: ${verifiedTotal}m², Match: ${verifiedTotal === targetArea}`);
  } else {
    // LEGACY: Use absolute areas as provided
    console.log('Using legacy absolute areas format...');
    formattedAreas = rawAreas.map(a => ({
      name: a.name,
      areaPerUnit: a.areaPerUnit || 0,
      count: a.count || 1,
      groupHint: a.groupHint,
      aiNote: a.aiNote,
    }));
  }
  
  const parsedTotal = formattedAreas.reduce((sum, a) => sum + a.areaPerUnit * a.count, 0);
  
  return {
    areas: formattedAreas,
    detectedGroups: detectedGroups.length > 0 ? detectedGroups.map((g, i) => ({
      name: g.name,
      color: g.color || GROUP_COLORS[i % GROUP_COLORS.length],
      areaNames: g.areaNames,
    })) : undefined,
    hasGroupStructure: detectedGroups.length > 0,
    briefTotal: targetArea || null,
    parsedTotal,
    projectContext: (parsed.projectContext as string) || (parsed.interpretation as string) || '',
    suggestedAreas: [],
    ambiguities: [
      ...(parsed.assumptions as string[] || []).map(a => `Assumption: ${a}`),
      ...(parsed.suggestions as string[] || []).map(s => `Suggestion: ${s}`),
    ],
  };
}

// ============================================
// STRATEGY: TOLERANT (for dirty briefs)
// ============================================

async function parseWithTolerantStrategy(
  briefText: string, 
  apiKey: string,
  inputClassification: InputClassification
): Promise<ParsedBrief> {
  console.log('Starting tolerant extraction...');
  
  // Include warnings in the prompt context
  const contextNote = inputClassification.warnings.length > 0
    ? `\n\nNOTE: This brief has some quality issues:\n${inputClassification.warnings.map(w => `- ${w}`).join('\n')}\n`
    : '';
  
  const prompt = buildPrompt(EXTRACT_TOLERANT_PROMPT, { userInput: briefText + contextNote });
  
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Medium for some inference
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw {
      type: 'api_error',
      message: error.error?.message || `Tolerant extraction failed: ${response.status}`,
    } as AIError;
  }
  
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  console.log('Tolerant extraction response:', content);
  
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw { type: 'parse_error', message: 'Invalid JSON in tolerant response' } as AIError;
  }
  
  // Map to ParsedBrief format
  const areas = (parsed.areas as Array<{
    name: string;
    areaPerUnit: number;
    count: number;
    confidence: number;
    source?: string;
    inferred?: boolean;
    inferenceReason?: string;
  }>) || [];
  
  const detectedGroups = (parsed.detectedGroups as Array<{ name: string; color: string; areaNames: string[] }>) || [];
  const statedTotals = (parsed.statedTotals as Array<{ text: string; value: number }>) || [];
  const ambiguities = (parsed.ambiguities as string[]) || [];
  const lowConfidenceItems = (parsed.lowConfidenceItems as Array<{ name: string; reason: string }>) || [];
  
  const formattedAreas = areas.map(a => ({
    name: a.name,
    areaPerUnit: a.areaPerUnit,
    count: a.count || 1,
    briefNote: a.source,
    aiNote: a.inferred ? `[Inferred] ${a.inferenceReason || 'Estimated from typology'}` : undefined,
  }));
  
  const parsedTotal = formattedAreas.reduce((sum, a) => sum + a.areaPerUnit * a.count, 0);
  const briefTotal = statedTotals.length > 0 ? statedTotals[0].value : null;
  
  // Add low confidence items to ambiguities
  const allAmbiguities = [
    ...ambiguities,
    ...lowConfidenceItems.map(item => `Low confidence: ${item.name} - ${item.reason}`),
    ...inputClassification.suggestions,
  ];
  
  return {
    areas: formattedAreas,
    detectedGroups: detectedGroups.length > 0 ? detectedGroups.map((g, i) => ({
      name: g.name,
      color: g.color || GROUP_COLORS[i % GROUP_COLORS.length],
      areaNames: g.areaNames,
    })) : undefined,
    hasGroupStructure: detectedGroups.length > 0,
    briefTotal,
    parsedTotal,
    projectContext: (parsed.projectContext as string) || '',
    suggestedAreas: [],
    ambiguities: allAmbiguities.length > 0 ? allAmbiguities : undefined,
  };
}

// ============================================
// STRATEGY: STRICT (existing two-pass)
// ============================================

async function parseWithStrictStrategy(briefText: string, apiKey: string): Promise<ParsedBrief> {
  console.log('Starting strict two-pass parsing...');
  
  try {
    // Pass 1: Extract all rows
    const extraction = await extractBriefRows(briefText, apiKey);
    console.log(`Pass 1 complete: ${extraction.rows.length} rows extracted`);
    
    // Pass 2: Classify rows
    const classificationResult = await classifyBriefRows(extraction, apiKey);
    const spaceCount = classificationResult.classified.filter(c => c.classification === 'space').length;
    console.log(`Pass 2 complete: ${spaceCount} spaces identified`);
    
    // Build result
    const result = buildParsedBrief(extraction, classificationResult);
    console.log(`Parsing complete: ${result.areas.length} areas, ${result.parsedTotal}m² total`);
    
    // Pass 3 (optional): Reconciliation if totals don't match
    if (result.briefTotal && result.parsedTotal) {
      const discrepancy = Math.abs(result.briefTotal - result.parsedTotal);
      const tolerance = result.briefTotal * 0.05; // 5% tolerance
      
      if (discrepancy > tolerance) {
        console.log(`Discrepancy detected: ${discrepancy}m². Attempting reconciliation...`);
        const reconciled = await attemptReconciliation(result, apiKey);
        if (reconciled) {
          return reconciled;
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error('Strict parsing failed, falling back to tolerant:', error);
    
    // Fallback to tolerant parsing
    const fallbackClassification = analyzeInput(briefText);
    fallbackClassification.strategy = 'extract_tolerant';
    return parseWithTolerantStrategy(briefText, apiKey, fallbackClassification);
  }
}

// ============================================
// RECONCILIATION PASS
// ============================================

async function attemptReconciliation(
  result: ParsedBrief, 
  apiKey: string
): Promise<ParsedBrief | null> {
  try {
    const areasText = formatAreasForReconciliation(result.areas);
    
    // Use net/gross totals if available, fallback to briefTotal
    const netTotal = result.netTotal || result.briefTotal || 0;
    const grossTotal = result.grossTotal || 0;
    const netToGrossFactor = result.netToGrossFactor || 0;
    const parsedTotal = result.parsedTotal || 0;
    
    const netDiscrepancy = netTotal - parsedTotal;
    const grossDiscrepancy = grossTotal - parsedTotal;
    const netDirection = netDiscrepancy > 0 ? 'under (missing areas)' : 'over (possible duplicates)';
    const grossDirection = grossDiscrepancy > 0 ? 'under (missing areas)' : 'over (possible duplicates)';
    
    const prompt = buildPrompt(RECONCILIATION_PROMPT, {
      parsedAreas: areasText,
      netTotal: netTotal,
      grossTotal: grossTotal || 'Not stated',
      netToGrossFactor: netToGrossFactor || 'Not stated',
      parsedTotal: parsedTotal,
      netDiscrepancy: Math.abs(netDiscrepancy),
      netDirection,
      grossDiscrepancy: Math.abs(grossDiscrepancy),
      grossDirection,
    });
    
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });
    
    if (!response.ok) {
      console.error('Reconciliation request failed');
      return null;
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('Reconciliation response:', content);
    
    const parsed = JSON.parse(content) as {
      analysis: string;
      sectionValidation?: Array<{ section: string; parsed: number; stated: number; match: boolean }>;
      suggestions: Array<{
        action: 'add' | 'remove' | 'modify';
        name: string;
        areaPerUnit: number;
        count?: number;
        reason: string;
        confidence: number;
      }>;
      skipCirculationAddition?: boolean;
      adjustedTotal: number;
      remainingDiscrepancy: number;
      note?: string;
    };
    
    // Check if we should skip adding circulation
    const shouldSkipCirculation = parsed.skipCirculationAddition || netToGrossFactor > 1;
    
    // Only apply high-confidence suggestions, but skip circulation if factor is stated
    let highConfidenceSuggestions = parsed.suggestions.filter(s => s.confidence >= 0.7);
    
    if (shouldSkipCirculation) {
      // Filter out any circulation additions
      highConfidenceSuggestions = highConfidenceSuggestions.filter(
        s => !(s.action === 'add' && s.name.toLowerCase().includes('circulation'))
      );
    }
    
    // Build section validation messages
    const sectionMismatches: string[] = [];
    if (parsed.sectionValidation) {
      for (const sv of parsed.sectionValidation) {
        if (!sv.match) {
          sectionMismatches.push(`• ${sv.section}: parsed ${sv.parsed}m² vs stated ${sv.stated}m² (diff: ${Math.abs(sv.stated - sv.parsed)}m²)`);
        }
      }
    }
    
    if (highConfidenceSuggestions.length === 0) {
      // No confident suggestions (or only circulation which we skipped)
      return {
        ...result,
        skipCirculationAddition: shouldSkipCirculation,
        ambiguities: [
          ...(result.ambiguities || []),
          `Reconciliation: ${parsed.analysis}`,
          ...(shouldSkipCirculation && netToGrossFactor > 1 
            ? [`✓ Net-to-Gross factor ${netToGrossFactor} accounts for ${Math.round((netToGrossFactor - 1) * 100)}% circulation`]
            : []),
          ...sectionMismatches,
          ...(parsed.note ? [`Note: ${parsed.note}`] : []),
        ],
      };
    }
    
    // Apply suggestions
    const newAreas = [...result.areas];
    const appliedChanges: string[] = [];
    
    for (const suggestion of highConfidenceSuggestions) {
      if (suggestion.action === 'add') {
        newAreas.push({
          name: suggestion.name,
          areaPerUnit: suggestion.areaPerUnit,
          count: suggestion.count || 1,
          aiNote: `[Auto-added] ${suggestion.reason}`,
        });
        appliedChanges.push(`Added: ${suggestion.name} (${suggestion.areaPerUnit}m²) - ${suggestion.reason}`);
      }
      // Could also handle 'remove' and 'modify' actions
    }
    
    const newTotal = newAreas.reduce((sum, a) => sum + a.areaPerUnit * a.count, 0);
    
    return {
      ...result,
      areas: newAreas,
      parsedTotal: newTotal,
      skipCirculationAddition: shouldSkipCirculation,
      suggestedAreas: [],
      ambiguities: [
        ...(result.ambiguities || []),
        ...appliedChanges,
        ...(shouldSkipCirculation && netToGrossFactor > 1 
          ? [`✓ Net-to-Gross factor ${netToGrossFactor} accounts for ${Math.round((netToGrossFactor - 1) * 100)}% circulation`]
          : []),
        ...sectionMismatches,
        ...(parsed.remainingDiscrepancy > 0 ? [`Remaining discrepancy: ${parsed.remainingDiscrepancy}m²`] : []),
        ...(parsed.note ? [`Note: ${parsed.note}`] : []),
      ],
    };
    
  } catch (error) {
    console.error('Reconciliation failed:', error);
    return null;
  }
}

// ============================================
// PROMPT ENHANCER
// ============================================

export interface EnhancedPrompt {
  title: string;
  prompt: string;
  actionSummary: string; // Human-readable action description with **highlighted** verbs
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
