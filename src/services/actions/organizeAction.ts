/**
 * Organize Action - Group multiple areas into logical categories
 * 
 * Triggers: "group", "organize", "categorize"
 * Selection: 2+ areas required
 * Output: CreateGroupProposal(s) with area assignments
 */

import type { Proposal, AreaNode } from '@/types';
import { 
  organizeAreas, 
  organizeIntentToProposals,
  type OrganizeAIResponse,
} from '../formulaService';
import { 
  defineAction, 
  actionRegistry,
  type ActionContext,
  type ActionResult,
  type ValidationResult,
} from './registry';

// ============================================
// ORGANIZE ACTION
// ============================================

export const organizeAction = defineAction({
  id: 'organize',
  name: 'Organize Areas',
  description: 'Group selected areas into logical categories',
  examples: [
    'Group these areas by function',
    'Organize by public vs private',
    'Categorize by access level',
  ],
  patterns: [
    /\b(group|organize|cluster|categorize|sort|arrange)\b.*\b(areas?|spaces?|rooms?)\b/i,
    /\b(areas?|spaces?|rooms?)\b.*\b(by|into)\b.*\b(function|type|category|zone|public|private)\b/i,
    /\b(re-?organize|re-?group|re-?cluster)\b/i,
  ],
  selectionRequirement: 'multiple',
  priority: 15,
  
  validate(
    _prompt: string,
    selectedNodes: AreaNode[],
    _context: ActionContext
  ): ValidationResult {
    if (selectedNodes.length < 2) {
      return {
        valid: false,
        error: 'Organize requires selecting multiple areas. Please select 2+ areas to group.',
      };
    }
    
    return { valid: true };
  },
  
  async execute(
    prompt: string,
    selectedNodes: AreaNode[],
    _context: ActionContext
  ): Promise<ActionResult> {
    console.log(`[OrganizeAction] Organizing ${selectedNodes.length} areas`);
    
    const response = await organizeAreas(selectedNodes, prompt);
    
    // Handle insufficient selection warning
    if (response.warnings?.includes('insufficient_selection')) {
      return {
        message: response.message,
        warnings: response.warnings,
        data: null,
      };
    }
    
    return {
      message: response.message,
      data: { response, selectedNodes },
      warnings: response.warnings,
    };
  },
  
  toProposals(
    result: ActionResult,
    _selectedNodes: AreaNode[],
    _context: ActionContext
  ): Proposal[] {
    const data = result.data as { 
      response: OrganizeAIResponse; 
      selectedNodes: AreaNode[];
    } | null;
    
    if (!data?.response || !data?.selectedNodes) return [];
    
    return organizeIntentToProposals(data.response, data.selectedNodes);
  },
});

// Register on import
actionRegistry.register(organizeAction);

export default organizeAction;
