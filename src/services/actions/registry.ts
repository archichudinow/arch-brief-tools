/**
 * Action Registry - Extensible pattern for chat actions
 * 
 * Each action is self-contained with:
 * - Pattern matching for classification
 * - Validation logic
 * - Execution logic
 * - Proposal generation
 * 
 * Adding a new action = one file + register()
 */

import type { AreaNode, Group, Proposal } from '@/types';
import type { ExpandDetailLevel } from '../formulaService';

// ============================================
// CORE TYPES
// ============================================

export type SelectionRequirement = 'none' | 'single' | 'multiple' | 'any';

export interface ActionContext {
  /** All nodes in project */
  nodes: Record<string, AreaNode>;
  /** All groups in project */
  groups: Record<string, Group>;
  /** Detail level for create/unfold */
  detailLevel: ExpandDetailLevel;
  /** Original user prompt */
  prompt: string;
  /** Project-level context/notes */
  projectContext?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ActionResult {
  /** Message to show user */
  message: string;
  /** Raw response data (action-specific) */
  data?: unknown;
  /** Warnings (non-fatal issues) */
  warnings?: string[];
  /** If true, needs user clarification before proceeding */
  needsClarification?: boolean;
  /** Clarification options if needed */
  clarificationOptions?: Array<{
    label: string;
    value: unknown;
  }>;
}

export interface AgentAction {
  /** Unique identifier */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Description for help/discovery */
  description: string;
  
  /** Example prompts */
  examples: string[];
  
  /** Regex patterns that trigger this action */
  patterns: RegExp[];
  
  /** Selection requirements */
  selectionRequirement: SelectionRequirement;
  
  /** Priority for pattern matching (higher = checked first) */
  priority?: number;
  
  /**
   * Validate if action can execute with current state
   */
  validate(
    prompt: string,
    selectedNodes: AreaNode[],
    context: ActionContext
  ): ValidationResult;
  
  /**
   * Execute the action
   */
  execute(
    prompt: string,
    selectedNodes: AreaNode[],
    context: ActionContext
  ): Promise<ActionResult>;
  
  /**
   * Convert action result to proposals
   */
  toProposals(
    result: ActionResult,
    selectedNodes: AreaNode[],
    context: ActionContext
  ): Proposal[];
}

// ============================================
// REGISTRY IMPLEMENTATION
// ============================================

class ActionRegistryImpl {
  private actions: Map<string, AgentAction> = new Map();
  
  /**
   * Register a new action
   */
  register(action: AgentAction): void {
    if (this.actions.has(action.id)) {
      console.warn(`[ActionRegistry] Overwriting action: ${action.id}`);
    }
    this.actions.set(action.id, action);
    console.log(`[ActionRegistry] Registered action: ${action.id}`);
  }
  
  /**
   * Get action by ID (for composition)
   */
  get(id: string): AgentAction | undefined {
    return this.actions.get(id);
  }
  
  /**
   * Get all registered actions
   */
  getAll(): AgentAction[] {
    return Array.from(this.actions.values());
  }
  
  /**
   * Classify prompt into best matching action
   */
  classify(
    prompt: string,
    selectedNodes: AreaNode[],
    context: ActionContext
  ): { action: AgentAction; confidence: number } | null {
    const lower = prompt.toLowerCase();
    const hasSelection = selectedNodes.length > 0;
    const selectionCount = selectedNodes.length;
    
    // Sort by priority (higher first)
    const sorted = this.getAll().sort((a, b) => 
      (b.priority ?? 0) - (a.priority ?? 0)
    );
    
    for (const action of sorted) {
      // Check pattern match
      const matches = action.patterns.some(p => p.test(lower));
      if (!matches) continue;
      
      // Check selection requirement
      const selectionOk = this.checkSelection(
        action.selectionRequirement,
        hasSelection,
        selectionCount
      );
      
      if (selectionOk) {
        return { action, confidence: 0.9 };
      }
    }
    
    // Fallback: try to infer from content
    return this.inferAction(prompt, selectedNodes, context);
  }
  
  /**
   * Check if selection meets requirement
   */
  private checkSelection(
    requirement: SelectionRequirement,
    hasSelection: boolean,
    count: number
  ): boolean {
    switch (requirement) {
      case 'none': return true; // Selection optional
      case 'single': return count === 1;
      case 'multiple': return count >= 2;
      case 'any': return hasSelection;
      default: return true;
    }
  }
  
  /**
   * Infer action from content when no pattern matches
   */
  private inferAction(
    prompt: string,
    selectedNodes: AreaNode[],
    _context: ActionContext
  ): { action: AgentAction; confidence: number } | null {
    const lower = prompt.toLowerCase();
    
    // Long text with areas/numbers → likely brief
    const hasManyLines = prompt.split('\n').length > 3;
    const hasAreaPatterns = /\d+\s*(?:m²|sqm|m2)/i.test(prompt);
    if (hasManyLines && hasAreaPatterns) {
      const briefAction = this.get('parse_brief');
      if (briefAction) {
        return { action: briefAction, confidence: 0.7 };
      }
    }
    
    // Has typology keywords → create
    const typologyKeywords = /\b(hotel|office|apartment|residential|commercial|school|hospital|museum|library|retail|restaurant|warehouse|factory|building|facility)\b/i;
    if (typologyKeywords.test(lower)) {
      const createAction = this.get('create');
      if (createAction) {
        return { action: createAction, confidence: 0.6 };
      }
    }
    
    // Has selection + action verb → might be scale/rename
    if (selectedNodes.length > 0) {
      const scaleAction = this.get('scale');
      if (scaleAction && /\b(scale|adjust|increase|decrease|change)\b/i.test(lower)) {
        return { action: scaleAction, confidence: 0.6 };
      }
    }
    
    return null;
  }
  
  /**
   * Get validation error message for selection requirement
   */
  getSelectionError(
    action: AgentAction,
    selectedCount: number
  ): string | null {
    switch (action.selectionRequirement) {
      case 'single':
        if (selectedCount === 0) {
          return `${action.name} requires selecting an area first.`;
        }
        if (selectedCount > 1) {
          return `${action.name} works on one area at a time. Please select a single area.`;
        }
        break;
      case 'multiple':
        if (selectedCount < 2) {
          return `${action.name} requires selecting multiple areas. Please select 2+ areas.`;
        }
        break;
      case 'any':
        if (selectedCount === 0) {
          return `${action.name} requires selecting at least one area.`;
        }
        break;
    }
    return null;
  }
  
  /**
   * Get help text listing all actions
   */
  getHelpText(): string {
    const actions = this.getAll()
      .sort((a, b) => a.name.localeCompare(b.name));
    
    const lines = ['I can help you with these actions:\n'];
    
    for (const action of actions) {
      lines.push(`**${action.name}**: ${action.description}`);
      if (action.examples.length > 0) {
        lines.push(`  → "${action.examples[0]}"`);
      }
    }
    
    return lines.join('\n');
  }
}

// Singleton instance
export const actionRegistry = new ActionRegistryImpl();

// ============================================
// HELPER: Define action from config
// ============================================

export interface ActionConfig {
  id: string;
  name: string;
  description: string;
  examples: string[];
  patterns: RegExp[];
  selectionRequirement: SelectionRequirement;
  priority?: number;
  validate?: AgentAction['validate'];
  execute: AgentAction['execute'];
  toProposals: AgentAction['toProposals'];
}

export function defineAction(config: ActionConfig): AgentAction {
  return {
    ...config,
    validate: config.validate ?? (() => ({ valid: true })),
  };
}
