/**
 * Agent Executor - Runs the OpenAI tool-calling loop
 * 
 * Flow:
 * 1. User message → OpenAI with tools
 * 2. OpenAI returns tool_calls (or direct message)
 * 3. Execute each tool, collect results
 * 4. Send results back to OpenAI
 * 5. Repeat until done or max iterations
 * 
 * ARCHITECTURE: Agent delegates to Action Registry
 * - Actions contain all tested business logic
 * - Agent orchestrates which actions to call
 * - This avoids code duplication and ensures consistency
 */

import type { 
  AgentContext, 
  AgentMessage, 
  AgentResponse, 
  AgentState,
  ToolCall,
  ToolResult,
} from './types';
import type { AreaNode, Group, CreateAreasProposal, SplitGroupEqualProposal, CreateGroupsProposal, Proposal } from '@/types';
import { AGENT_TOOLS } from './tools';
import { actionRegistry, type ActionContext } from '../actions/registry';
import { formatArea } from '../scaleAnalyzer';

// ============================================
// CONFIGURATION
// ============================================

const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o';
const MAX_ITERATIONS = 5;

function getApiKey(): string {
  const key = import.meta.env.VITE_OPENAI_API_KEY;
  if (!key) throw new Error('VITE_OPENAI_API_KEY not configured');
  return key;
}

// ============================================
// SYSTEM PROMPT
// ============================================

const AGENT_SYSTEM_PROMPT = `You are an architectural programming assistant that helps users create and manage building area programs.

CAPABILITIES:
- Create new building programs (hotels, offices, residences, etc.)
- Unfold/expand areas into more detailed sub-areas
- Organize areas into groups
- Split groups into multiple sub-groups
- Scale/adjust area sizes
- Parse briefs and documents into structured programs

WORKFLOW:
1. Use get_project_summary or find_area to understand current state
2. Execute requested actions using the appropriate tools
3. Use respond_to_user to give a final summary

CRITICAL: VALIDATE ARCHITECTURAL RELEVANCE
Before creating any program, verify the request is for a real building typology or space:
- VALID: hotel, office, residence, retail, restaurant, spa, parking, warehouse, school, hospital, museum, library, factory, gym, pool, marina, etc.
- INVALID: abstract concepts, random objects, jokes, nonsense words (e.g., "crazy banana", "flying unicorn", "magic carpet")

If the request is NOT a valid architectural/building typology:
1. DO NOT call create_program
2. Use respond_to_user to politely explain: "I can only help with architectural programs and building spaces. '[request]' doesn't appear to be a valid building type or space. Try something like 'create a hotel', 'add parking', or 'design a retail space'."

CRITICAL: CREATE vs SCALE - DIFFERENT PURPOSES
- create_program: ADDS new areas to the project. Use for "create X", "add Y program", "make a Z", "design a W"
- scale_areas: MODIFIES existing selected areas. Use for "resize", "make bigger", "scale to X sqm", "increase by Y%", "decrease by Z%"
- NEVER use scale_areas when user says "create", "add", or "design" - those mean ADD NEW content
- "create car wash of 1000 sqm" = create_program (add new car wash areas)
- "design a spa" = create_program (add new spa areas)
- "scale to 1000 sqm" or "increase by 20%" = scale_areas (modify selected areas)

CRITICAL: PROPOSAL-BASED WORKFLOW
- Tools like create_program, unfold_area, parse_brief create PROPOSALS for user approval
- These proposals are NOT immediately applied to the project
- After creating a proposal, DO NOT try to operate on the areas (they don't exist yet)
- Example: If asked "create a hotel and unfold", just call create_program ONCE - the user will unfold after accepting

CONTEXT AWARENESS:
- Messages may start with [SELECTED GROUP: ...] or [SELECTED AREAS: ...] to indicate what the user has selected
- When a group is selected and user says "split this group" or "divide into 8 groups", use split_group on that group
- When areas are selected and user says "unfold", unfold_area will target those selected areas
- When groups are selected and user says "unfold areas in groups", unfold_area will process all areas in those groups
- If no selection info is provided, tools may operate on all areas or ask for clarification

IMPORTANT RULES:
- When user pastes a BRIEF or TABLE with area data (sqm, m², quantities), use parse_brief with the COMPLETE TEXT - never summarize or truncate
- For simple requests like "create a hotel", use create_program ONCE - do not retry if unfold fails
- When asked to unfold an area, first use find_area to get its ID if not selected
- When asked to split a group into N parts (equal division), use split_group with numberOfGroups
- When asked to "split into functional groups", "reorganize by function", or "create subgroups by type", use regroup_by_function - this analyzes areas and creates category-based groups
- DO NOT call create_program multiple times for the same request
- Always end with respond_to_user to summarize what was done
- If you're unsure what the user wants, ask for clarification via respond_to_user

DETECTING BRIEFS vs PROMPTS:
- BRIEF: Contains tabular data, multiple areas with sqm/m² values, counts like "80 x 30 m²"
- PROMPT: Short request like "create a hotel" or "make 10000 sqm office"
- When in doubt and text > 500 chars with area numbers, treat as BRIEF

SCALE AWARENESS:
- Large areas (100K+ m²) unfold into districts/zones
- Medium areas (10K-100K m²) unfold into building plots
- Buildings (1K-10K m²) unfold into floors/departments  
- Smaller areas unfold into rooms

Always be helpful and provide clear summaries of actions taken.`;

// ============================================
// TOOL EXECUTORS - Delegate to Action Registry
// ============================================

type ToolExecutor = (
  args: Record<string, unknown>,
  context: AgentContext,
  state: AgentState
) => Promise<ToolResult>;

/**
 * Convert AgentContext to ActionContext
 */
function toActionContext(context: AgentContext, prompt: string): ActionContext {
  return {
    nodes: context.nodes,
    groups: context.groups,
    detailLevel: context.detailLevel,
    prompt,
    projectContext: context.projectContext,
  };
}

/**
 * Get selected nodes from context, including areas from selected groups
 */
function getSelectedNodes(context: AgentContext): AreaNode[] {
  // First check direct node selection
  const directlySelected = context.selectedNodeIds
    .map(id => context.nodes[id])
    .filter(Boolean);
  
  if (directlySelected.length > 0) {
    return directlySelected;
  }
  
  // If no nodes selected but groups are selected, get areas from those groups
  if (context.selectedGroupIds.length > 0) {
    const nodesFromGroups: AreaNode[] = [];
    for (const groupId of context.selectedGroupIds) {
      const group = context.groups[groupId];
      if (group) {
        for (const memberId of group.members) {
          const node = context.nodes[memberId];
          if (node && !nodesFromGroups.some(n => n.id === node.id)) {
            nodesFromGroups.push(node);
          }
        }
      }
    }
    return nodesFromGroups;
  }
  
  return [];
}

const toolExecutors: Record<string, ToolExecutor> = {
  /**
   * Create new building program - delegates to createAction
   */
  async create_program(args, context, state) {
    // Check if we already have a create_areas proposal pending - prevent duplicates
    const existingCreateProposal = state.proposals.find(p => p.type === 'create_areas');
    if (existingCreateProposal) {
      return {
        toolCallId: '',
        success: true,
        message: 'A create proposal is already pending. User needs to accept it before creating more.',
        result: { alreadyPending: true },
      };
    }
    
    const description = args.description as string;
    const action = actionRegistry.get('create');
    
    if (!action) {
      return {
        toolCallId: '',
        success: false,
        error: 'Create action not available',
      };
    }
    
    const actionContext = toActionContext(context, description);
    const selectedNodes = getSelectedNodes(context);
    
    console.log(`[Agent:create_program] Delegating to createAction: "${description}"`);
    
    const result = await action.execute(description, selectedNodes, actionContext);
    const proposals = action.toProposals(result, selectedNodes, actionContext);
    state.proposals.push(...proposals);
    
    return {
      toolCallId: '',
      success: !result.warnings?.length,
      result: { message: result.message },
      proposals,
      message: result.message,
    };
  },
  
  /**
   * Unfold/expand area into sub-areas - delegates to unfoldAction
   * Supports: specific area by ID/name, selected areas, or all areas in selected groups
   */
  async unfold_area(args, context, state) {
    const action = actionRegistry.get('unfold');
    if (!action) {
      return {
        toolCallId: '',
        success: false,
        error: 'Unfold action not available',
      };
    }
    
    // Check if project has no areas but has pending create proposals
    const hasNoAreas = Object.keys(context.nodes).length === 0;
    const hasPendingCreate = state.proposals.some(p => p.type === 'create_areas');
    
    if (hasNoAreas && hasPendingCreate) {
      return {
        toolCallId: '',
        success: true,
        message: 'Create proposal is pending. User needs to accept it first, then can unfold the created areas.',
        result: { waitingForAccept: true },
      };
    }
    
    // Determine target areas to unfold
    let targetNodes: AreaNode[] = [];
    
    // Priority 1: Specific area by ID or name
    if (args.areaId) {
      const node = context.nodes[args.areaId as string];
      if (node) targetNodes = [node];
    } else if (args.areaName) {
      const searchName = (args.areaName as string).toLowerCase();
      const node = Object.values(context.nodes).find(
        n => n.name.toLowerCase().includes(searchName)
      );
      if (node) targetNodes = [node];
    }
    
    // Priority 2: Selected areas
    if (targetNodes.length === 0 && context.selectedNodeIds.length > 0) {
      targetNodes = context.selectedNodeIds
        .map(id => context.nodes[id])
        .filter(Boolean);
    }
    
    // Priority 3: All areas in selected groups
    if (targetNodes.length === 0 && context.selectedGroupIds.length > 0) {
      for (const groupId of context.selectedGroupIds) {
        const group = context.groups[groupId];
        if (group) {
          for (const memberId of group.members) {
            const node = context.nodes[memberId];
            if (node && !targetNodes.some(n => n.id === node.id)) {
              targetNodes.push(node);
            }
          }
        }
      }
    }
    
    if (targetNodes.length === 0) {
      return {
        toolCallId: '',
        success: false,
        error: 'Could not find area(s) to unfold. Please specify areaId/areaName, select areas, or select groups containing areas.',
      };
    }
    
    // Build prompt with optional focus
    const focus = args.focus as string | undefined;
    const prompt = focus ? `expand with focus: ${focus}` : 'expand';
    const actionContext = toActionContext(context, prompt);
    
    // Unfold each target area and collect proposals
    const allProposals: Proposal[] = [];
    const results: string[] = [];
    let successCount = 0;
    
    for (const targetNode of targetNodes) {
      const totalArea = targetNode.areaPerUnit * targetNode.count;
      console.log(`[Agent:unfold_area] Unfolding: "${targetNode.name}" (${formatArea(totalArea)})`);
      
      const result = await action.execute(prompt, [targetNode], actionContext);
      
      if (result.warnings?.includes('area_too_small')) {
        results.push(`${targetNode.name}: too small to unfold`);
        continue;
      }
      
      const proposals = action.toProposals(result, [targetNode], actionContext);
      allProposals.push(...proposals);
      successCount++;
      const createProposal = proposals[0] as CreateAreasProposal | undefined;
      results.push(`${targetNode.name}: expanded into ${createProposal?.areas?.length || '?'} sub-areas`);
    }
    
    state.proposals.push(...allProposals);
    
    const message = targetNodes.length === 1
      ? results[0]
      : `Unfolded ${successCount}/${targetNodes.length} areas:\n${results.map(r => `• ${r}`).join('\n')}`;
    
    return {
      toolCallId: '',
      success: successCount > 0,
      result: { 
        unfoldedCount: successCount,
        totalAreas: targetNodes.length,
      },
      proposals: allProposals,
      message,
    };
  },
  
  /**
   * Organize areas into groups - delegates to organizeAction
   */
  async organize_areas(args, context, state) {
    const action = actionRegistry.get('organize');
    
    if (!action) {
      return {
        toolCallId: '',
        success: false,
        error: 'Organize action not available',
      };
    }
    
    // Build prompt from args
    const strategy = (args.strategy as string) || 'functional';
    const customGrouping = args.customGrouping as string | undefined;
    const prompt = customGrouping 
      ? `organize: ${customGrouping}` 
      : `organize by ${strategy}`;
    
    const actionContext = toActionContext(context, prompt);
    const selectedNodes = getSelectedNodes(context);
    
    // If no selection, use all nodes
    const targetNodes = selectedNodes.length > 0 
      ? selectedNodes 
      : Object.values(context.nodes);
    
    console.log(`[Agent:organize_areas] Delegating to organizeAction: ${targetNodes.length} areas, strategy=${strategy}`);
    
    const result = await action.execute(prompt, targetNodes, actionContext);
    const proposals = action.toProposals(result, targetNodes, actionContext);
    state.proposals.push(...proposals);
    
    return {
      toolCallId: '',
      success: !result.warnings?.includes('insufficient_selection'),
      result: { strategy },
      proposals,
      message: result.message,
    };
  },
  
  /**
   * Split a group into N equal sub-groups
   * Uses the existing SplitGroupEqualProposal type
   */
  async split_group(args, context, state) {
    const numberOfGroups = args.numberOfGroups as number;
    const namingPattern = (args.namingPattern as string) || undefined;
    
    // Find the target group
    let targetGroup: Group | undefined;
    
    if (args.groupId) {
      targetGroup = context.groups[args.groupId as string];
    } else if (args.groupName) {
      const searchName = (args.groupName as string).toLowerCase();
      targetGroup = Object.values(context.groups).find(
        g => g.name.toLowerCase().includes(searchName)
      );
    } else if (context.selectedGroupIds.length > 0) {
      targetGroup = context.groups[context.selectedGroupIds[0]];
    }
    
    if (!targetGroup) {
      return {
        toolCallId: '',
        success: false,
        error: 'Could not find group to split. Please specify groupId, groupName, or select a group.',
      };
    }
    
    // Get areas in this group to validate
    const memberIds = targetGroup.members || [];
    
    if (memberIds.length === 0) {
      return {
        toolCallId: '',
        success: false,
        error: `Group "${targetGroup.name}" has no areas to split.`,
      };
    }
    
    // Calculate total units to determine splitting mode
    const nodes = memberIds.map(id => context.nodes[id]).filter(Boolean);
    const totalUnits = nodes.reduce((sum, n) => sum + n.count, 0);
    
    // Use the existing SplitGroupEqualProposal type
    const proposal: SplitGroupEqualProposal = {
      id: `split-${Date.now()}`,
      type: 'split_group_equal',
      status: 'pending',
      groupId: targetGroup.id,
      groupName: targetGroup.name,
      parts: numberOfGroups,
      nameSuffix: namingPattern,
    };
    
    state.proposals.push(proposal);
    
    // Determine split mode for description
    const splitByCount = totalUnits >= numberOfGroups;
    
    const totalArea = nodes.reduce((sum, n) => sum + n.areaPerUnit * n.count, 0);
    const areaPerGroup = Math.round(totalArea / numberOfGroups);
    
    let description: string;
    if (splitByCount) {
      const unitsPerGroup = Math.floor(totalUnits / numberOfGroups);
      description = `Will split "${targetGroup.name}" (${totalUnits} units) into ${numberOfGroups} groups (~${unitsPerGroup} units each, ~${areaPerGroup}m² each)`;
    } else {
      description = `Will split "${targetGroup.name}" into ${numberOfGroups} groups (~${areaPerGroup}m² each) by dividing area sizes`;
    }
    
    return {
      toolCallId: '',
      success: true,
      result: { 
        sourceGroup: targetGroup.name,
        newGroupCount: numberOfGroups,
        totalUnits,
        splitByCount,
        areaPerGroup,
      },
      proposals: [proposal],
      message: description,
    };
  },
  
  /**
   * Reorganize a group's areas into functional subgroups
   * Creates new groups based on area functions/types
   */
  async regroup_by_function(args, context, state) {
    // Find the target group
    let targetGroup: Group | undefined;
    
    if (args.groupId) {
      targetGroup = context.groups[args.groupId as string];
    } else if (args.groupName) {
      const searchName = (args.groupName as string).toLowerCase();
      targetGroup = Object.values(context.groups).find(
        g => g.name.toLowerCase().includes(searchName)
      );
    } else if (context.selectedGroupIds.length > 0) {
      targetGroup = context.groups[context.selectedGroupIds[0]];
    }
    
    if (!targetGroup) {
      return {
        toolCallId: '',
        success: false,
        error: 'Could not find group to reorganize. Please specify groupId, groupName, or select a group.',
      };
    }
    
    // Get areas in this group
    const memberIds = targetGroup.members || [];
    
    if (memberIds.length === 0) {
      return {
        toolCallId: '',
        success: false,
        error: `Group "${targetGroup.name}" has no areas to reorganize.`,
      };
    }
    
    const nodes = memberIds.map(id => context.nodes[id]).filter(Boolean);
    
    // If user suggested categories, use them; otherwise, analyze areas
    const suggestedCategories = args.suggestedCategories as string[] | undefined;
    
    // Categorize areas by analyzing their names
    const categoryMap = new Map<string, typeof nodes>();
    
    const functionKeywords: Record<string, string[]> = {
      'Toilets & Sanitary': ['toilet', 'wc', 'restroom', 'bathroom', 'sanitary', 'lavatory', 'washroom'],
      'Storage': ['storage', 'store', 'warehouse', 'stockroom', 'inventory', 'archive'],
      'Circulation': ['corridor', 'circulation', 'hallway', 'lobby', 'foyer', 'entrance', 'passage', 'stairs', 'lift', 'elevator'],
      'Mechanical & Services': ['mechanical', 'electrical', 'plant', 'hvac', 'utility', 'service', 'maintenance', 'janitor', 'boe', 'mep'],
      'Administration': ['office', 'admin', 'management', 'reception', 'secretary', 'hr', 'accounting'],
      'Staff Facilities': ['staff', 'employee', 'locker', 'changing', 'break room', 'canteen', 'cafeteria'],
      'Meeting & Conference': ['meeting', 'conference', 'boardroom', 'seminar', 'training'],
      'Parking': ['parking', 'garage', 'car park', 'vehicle'],
    };
    
    // If categories suggested, use those as the keys
    if (suggestedCategories && suggestedCategories.length > 0) {
      suggestedCategories.forEach(cat => categoryMap.set(cat, []));
      categoryMap.set('Other', []);
    }
    
    // Helper to get all text content from node (name + notes)
    const getNodeTextContent = (node: typeof nodes[0]): string => {
      const parts: string[] = [node.name];
      
      // Add legacy userNote
      if (node.userNote) {
        parts.push(node.userNote);
      }
      
      // Add aiNote
      if (node.aiNote) {
        parts.push(node.aiNote);
      }
      
      // Add notes array content
      if (node.notes && node.notes.length > 0) {
        for (const note of node.notes) {
          if (note.content) {
            parts.push(note.content);
          }
        }
      }
      
      // Add formula reasoning if present
      if (node.formulaReasoning) {
        parts.push(node.formulaReasoning);
      }
      
      return parts.join(' ').toLowerCase();
    };
    
    // Categorize each area
    for (const node of nodes) {
      const textContent = getNodeTextContent(node);
      let assigned = false;
      
      if (suggestedCategories && suggestedCategories.length > 0) {
        // Try to match to suggested categories using full text content
        for (const cat of suggestedCategories) {
          const catLower = cat.toLowerCase();
          if (textContent.includes(catLower) || catLower.includes(node.name.toLowerCase().split(' ')[0])) {
            const arr = categoryMap.get(cat) || [];
            arr.push(node);
            categoryMap.set(cat, arr);
            assigned = true;
            break;
          }
        }
        if (!assigned) {
          const arr = categoryMap.get('Other') || [];
          arr.push(node);
          categoryMap.set('Other', arr);
        }
      } else {
        // Auto-categorize using keywords against full text content (name + notes)
        for (const [category, keywords] of Object.entries(functionKeywords)) {
          if (keywords.some(kw => textContent.includes(kw))) {
            const arr = categoryMap.get(category) || [];
            arr.push(node);
            categoryMap.set(category, arr);
            assigned = true;
            break;
          }
        }
        if (!assigned) {
          // Use first word of area name as category
          const firstWord = node.name.split(' ')[0];
          const cat = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
          const arr = categoryMap.get(cat) || [];
          arr.push(node);
          categoryMap.set(cat, arr);
        }
      }
    }
    
    // Remove empty categories
    for (const [key, value] of categoryMap.entries()) {
      if (value.length === 0) {
        categoryMap.delete(key);
      }
    }
    
    // If we only have 1 category, not useful
    if (categoryMap.size <= 1) {
      return {
        toolCallId: '',
        success: false,
        error: `Could not identify distinct functional categories in "${targetGroup.name}". The areas may already be too specific or homogeneous.`,
      };
    }
    
    // Generate colors for new groups
    const colors = [
      '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', 
      '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
    ];
    let colorIndex = 0;
    
    // Create proposal for creating new groups
    const categoryGroups: { name: string; color: string; memberNodeIds: string[]; memberNames: string[] }[] = [];
    
    for (const [category, categoryNodes] of categoryMap.entries()) {
      if (categoryNodes.length > 0) {
        categoryGroups.push({
          name: category,
          color: colors[colorIndex % colors.length],
          memberNodeIds: categoryNodes.map(n => n.id),
          memberNames: categoryNodes.map(n => n.name),
        });
        colorIndex++;
      }
    }
    
    // Create the proposal (using create_groups type)
    const proposal: CreateGroupsProposal = {
      id: `regroup-${Date.now()}`,
      type: 'create_groups',
      status: 'pending',
      groups: categoryGroups,
    };
    
    state.proposals.push(proposal);
    
    // Build description
    const categoryDescriptions = categoryGroups.map(g => 
      `"${g.name}" (${g.memberNodeIds.length} areas)`
    ).join(', ');
    
    const description = `Will reorganize "${targetGroup.name}" into ${categoryGroups.length} functional groups: ${categoryDescriptions}. Original group will be replaced.`;
    
    return {
      toolCallId: '',
      success: true,
      result: { 
        sourceGroup: targetGroup.name,
        newGroupCount: categoryGroups.length,
        categories: categoryGroups.map(g => ({ name: g.name, areaCount: g.memberNodeIds.length })),
      },
      proposals: [proposal],
      message: description,
    };
  },
  
  /**
   * Scale/adjust area sizes - delegates to scaleAction
   */
  async scale_areas(args, context, state) {
    const action = actionRegistry.get('scale');
    
    if (!action) {
      return {
        toolCallId: '',
        success: false,
        error: 'Scale action not available',
      };
    }
    
    // Build prompt from args
    const operation = args.operation as string;
    const value = args.value as number;
    const unit = (args.unit as string) || 'percent';
    
    let prompt: string;
    if (operation === 'set') {
      prompt = `scale to ${value} sqm`;
    } else if (operation === 'increase') {
      prompt = unit === 'percent' ? `+${value}%` : `+${value} sqm`;
    } else if (operation === 'decrease') {
      prompt = unit === 'percent' ? `-${value}%` : `-${value} sqm`;
    } else {
      prompt = `${operation} ${value} ${unit}`;
    }
    
    const actionContext = toActionContext(context, prompt);
    const selectedNodes = getSelectedNodes(context);
    
    // If specific targets provided, find them
    const targetAreaIds = args.targetAreaIds as string[] | undefined;
    const targetNodes = targetAreaIds 
      ? targetAreaIds.map(id => context.nodes[id]).filter(Boolean)
      : selectedNodes.length > 0 
        ? selectedNodes 
        : Object.values(context.nodes);
    
    console.log(`[Agent:scale_areas] Delegating to scaleAction: ${targetNodes.length} areas, ${prompt}`);
    
    const result = await action.execute(prompt, targetNodes, actionContext);
    const proposals = action.toProposals(result, targetNodes, actionContext);
    state.proposals.push(...proposals);
    
    return {
      toolCallId: '',
      success: !result.warnings?.includes('parse_error'),
      result: { operation, value, unit },
      proposals,
      message: result.message,
    };
  },
  
  /**
   * Parse brief text - delegates to parseBriefAction
   */
  async parse_brief(args, context, state) {
    // Check if we already have a create_areas proposal pending - prevent duplicates
    const existingCreateProposal = state.proposals.find(p => p.type === 'create_areas');
    if (existingCreateProposal) {
      return {
        toolCallId: '',
        success: true,
        message: 'A create proposal is already pending. User needs to accept it before parsing more.',
        result: { alreadyPending: true },
      };
    }
    
    const briefText = args.briefText as string;
    const action = actionRegistry.get('parse_brief');
    
    if (!action) {
      return {
        toolCallId: '',
        success: false,
        error: 'Parse brief action not available',
      };
    }
    
    const actionContext = toActionContext(context, briefText);
    
    console.log(`[Agent:parse_brief] Delegating to parseBriefAction: ${briefText.length} chars`);
    
    const result = await action.execute(briefText, [], actionContext);
    const proposals = action.toProposals(result, [], actionContext);
    state.proposals.push(...proposals);
    
    // Extract stats from proposals
    const createProposal = proposals.find(p => p.type === 'create_areas') as CreateAreasProposal | undefined;
    const areasExtracted = createProposal?.areas?.length || 0;
    const groupsDetected = createProposal?.detectedGroups?.length || 0;
    
    return {
      toolCallId: '',
      success: true,
      result: { areasExtracted, groupsDetected },
      proposals,
      message: result.message,
    };
  },
  
  /**
   * Get project summary - utility tool (no action needed)
   */
  async get_project_summary(_args, context, _state) {
    const nodes = Object.values(context.nodes);
    const groups = Object.values(context.groups);
    
    const totalArea = nodes.reduce((sum, n) => sum + n.areaPerUnit * n.count, 0);
    const rootNodes = nodes.filter(n => !nodes.some(p => p.children?.includes(n.id)));
    
    const summary = {
      totalArea: formatArea(totalArea),
      areaCount: nodes.length,
      groupCount: groups.length,
      topLevel: rootNodes.slice(0, 10).map(n => ({
        name: n.name,
        area: formatArea(n.areaPerUnit * n.count),
        id: n.id,
      })),
      groups: groups.map(g => ({
        name: g.name,
        color: g.color,
        memberCount: g.members?.length || 0,
      })),
    };
    
    return {
      toolCallId: '',
      success: true,
      result: summary,
      message: `Project has ${nodes.length} areas (${formatArea(totalArea)} total) in ${groups.length} groups. Top-level: ${rootNodes.slice(0, 5).map(n => n.name).join(', ')}`,
    };
  },
  
  /**
   * Find area by name - utility tool (no action needed)
   */
  async find_area(args, context, _state) {
    const query = (args.query as string).toLowerCase();
    const nodes = Object.values(context.nodes);
    
    const matches = nodes
      .filter(n => n.name.toLowerCase().includes(query))
      .slice(0, 5)
      .map(n => ({
        id: n.id,
        name: n.name,
        area: formatArea(n.areaPerUnit * n.count),
      }));
    
    if (matches.length === 0) {
      return {
        toolCallId: '',
        success: false,
        error: `No areas found matching "${query}"`,
      };
    }
    
    return {
      toolCallId: '',
      success: true,
      result: matches,
      message: `Found ${matches.length} areas: ${matches.map(m => `${m.name} (${m.area})`).join(', ')}`,
    };
  },
  
  /**
   * Respond to user - ends agent loop
   */
  async respond_to_user(args, _context, state) {
    const message = args.message as string;
    state.done = true;
    state.finalMessage = message;
    
    return {
      toolCallId: '',
      success: true,
      result: { done: true },
      message,
    };
  },
};

// ============================================
// OPENAI API CALL
// ============================================

interface OpenAIResponse {
  choices: Array<{
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: 'stop' | 'tool_calls' | 'length';
  }>;
}

async function callOpenAI(messages: AgentMessage[]): Promise<OpenAIResponse> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: AGENT_TOOLS,
      tool_choice: 'auto',
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

// ============================================
// EXECUTE TOOL
// ============================================

async function executeTool(
  toolCall: ToolCall,
  context: AgentContext,
  state: AgentState
): Promise<ToolResult> {
  const { name, arguments: argsJson } = toolCall.function;
  
  console.log(`[Agent] Executing tool: ${name}`);
  
  const executor = toolExecutors[name];
  if (!executor) {
    return {
      toolCallId: toolCall.id,
      success: false,
      error: `Unknown tool: ${name}`,
    };
  }
  
  try {
    const args = JSON.parse(argsJson);
    const result = await executor(args, context, state);
    result.toolCallId = toolCall.id;
    return result;
  } catch (error) {
    console.error(`[Agent] Tool ${name} error:`, error);
    return {
      toolCallId: toolCall.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// MAIN AGENT FUNCTION
// ============================================

/**
 * Build context-aware user message that includes selection info
 */
function buildUserMessage(message: string, context: AgentContext): string {
  const parts: string[] = [];
  
  // Add selection context
  if (context.selectedGroupIds.length > 0) {
    const selectedGroups = context.selectedGroupIds
      .map(id => context.groups[id])
      .filter(Boolean);
    
    if (selectedGroups.length > 0) {
      const groupInfo = selectedGroups.map(g => {
        const memberNodes = g.members
          ?.map(id => context.nodes[id])
          .filter(Boolean) || [];
        const totalArea = memberNodes.reduce((sum, n) => sum + n.areaPerUnit * n.count, 0);
        return `"${g.name}" (${memberNodes.length} areas, ${formatArea(totalArea)})`;
      });
      parts.push(`[SELECTED GROUP: ${groupInfo.join(', ')}]`);
    }
  }
  
  if (context.selectedNodeIds.length > 0) {
    const selectedNodes = context.selectedNodeIds
      .map(id => context.nodes[id])
      .filter(Boolean);
    
    if (selectedNodes.length > 0) {
      const nodeInfo = selectedNodes.slice(0, 5).map(n => 
        `"${n.name}" (${formatArea(n.areaPerUnit * n.count)})`
      );
      const suffix = selectedNodes.length > 5 ? ` and ${selectedNodes.length - 5} more` : '';
      parts.push(`[SELECTED AREAS: ${nodeInfo.join(', ')}${suffix}]`);
    }
  }
  
  parts.push(message);
  return parts.join('\n\n');
}

export async function runAgent(
  userMessage: string,
  context: AgentContext
): Promise<AgentResponse> {
  // Build context-aware message
  const contextualMessage = buildUserMessage(userMessage, context);
  
  const state: AgentState = {
    messages: [
      { role: 'system', content: AGENT_SYSTEM_PROMPT },
      { role: 'user', content: contextualMessage },
    ],
    proposals: [],
    iteration: 0,
    maxIterations: MAX_ITERATIONS,
    done: false,
  };
  
  const toolCallLog: AgentResponse['toolCalls'] = [];
  
  console.log(`[Agent] Starting agent with message: "${userMessage.slice(0, 100)}..."`);
  
  while (!state.done && state.iteration < state.maxIterations) {
    state.iteration++;
    console.log(`[Agent] Iteration ${state.iteration}`);
    
    // Call OpenAI
    const response = await callOpenAI(state.messages);
    const choice = response.choices[0];
    
    if (!choice) {
      throw new Error('No response from OpenAI');
    }
    
    const assistantMessage = choice.message;
    
    // Add assistant message to history
    state.messages.push({
      role: 'assistant',
      content: assistantMessage.content,
      tool_calls: assistantMessage.tool_calls,
    });
    
    // If no tool calls, we're done
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      state.done = true;
      state.finalMessage = assistantMessage.content || 'Done.';
      break;
    }
    
    // Execute all tool calls
    for (const toolCall of assistantMessage.tool_calls) {
      const result = await executeTool(toolCall, context, state);
      
      // Log tool call
      try {
        const args = JSON.parse(toolCall.function.arguments);
        toolCallLog.push({
          tool: toolCall.function.name,
          args,
          result: result.message || (result.success ? 'Success' : result.error || 'Failed'),
        });
      } catch {
        toolCallLog.push({
          tool: toolCall.function.name,
          args: {},
          result: result.message || 'Executed',
        });
      }
      
      // Add tool result to messages
      state.messages.push({
        role: 'tool',
        content: JSON.stringify({
          success: result.success,
          message: result.message,
          error: result.error,
          result: result.result,
        }),
        tool_call_id: toolCall.id,
      });
    }
  }
  
  // Build final response
  return {
    message: state.finalMessage || 'Agent completed without explicit response.',
    proposals: state.proposals,
    toolCalls: toolCallLog,
    iterations: state.iteration,
  };
}

/**
 * Check if agent mode should be used for a message
 * Returns true for complex/multi-step requests
 */
export function shouldUseAgent(message: string): boolean {
  const lower = message.toLowerCase();
  
  // Multi-step indicators
  const multiStepPatterns = [
    /\b(and|then|also|after that)\b.*\b(unfold|expand|create|organize|scale)/i,
    /\b(create|generate)\b.*\b(and|then)\b.*\b(unfold|expand|detail)/i,
    /\b(unfold|expand)\b.*\b(and|then)\b/i,
    /\b(all|every|each)\b.*\b(area|zone|room)/i,
  ];
  
  for (const pattern of multiStepPatterns) {
    if (pattern.test(lower)) {
      return true;
    }
  }
  
  return false;
}
