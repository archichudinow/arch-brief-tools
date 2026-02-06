/**
 * Unfold Action - Expand a single area into sub-areas
 * 
 * Triggers: "unfold", "expand", "break down"
 * Selection: Exactly 1 area required
 * Output: SplitAreaProposal with formula-based children
 */

import type { Proposal, AreaNode } from '@/types';
import { 
  expandArea, 
  formulaResponseToProposals,
  type FormulaAIResponse,
} from '../formulaService';
import { getScaleUnfoldGuidance, formatArea } from '../scaleAnalyzer';
import { 
  defineAction, 
  actionRegistry,
  type ActionContext,
  type ActionResult,
  type ValidationResult,
} from './registry';

// ============================================
// UNFOLD ACTION
// ============================================

export const unfoldAction = defineAction({
  id: 'unfold',
  name: 'Unfold Area',
  description: 'Expand a selected area into detailed sub-areas',
  examples: [
    'Unfold this zone into rooms',
    'Expand with focus on guest amenities',
    'Break down into specific spaces',
  ],
  patterns: [
    /\b(unfold|expand|divide|grain|break\s*down|detail|sub-?divide|elaborate)\b/i,
    /\b(split\s*into|more\s*detail|drill\s*down)\b/i,
  ],
  selectionRequirement: 'single',
  priority: 20, // Higher than create - more specific action
  
  validate(
    _prompt: string,
    selectedNodes: AreaNode[],
    _context: ActionContext
  ): ValidationResult {
    if (selectedNodes.length === 0) {
      return {
        valid: false,
        error: 'Unfold requires selecting an area first. Please select one area to expand.',
      };
    }
    
    if (selectedNodes.length > 1) {
      return {
        valid: false,
        error: 'Unfold works on one area at a time. Please select a single area to expand.',
      };
    }
    
    const node = selectedNodes[0];
    const area = node.areaPerUnit * node.count;
    const minSplitArea = 20; // Minimum area to meaningfully split
    
    if (area < minSplitArea) {
      return {
        valid: false,
        error: `"${node.name}" (${area}m²) is too small to unfold. Select a larger area.`,
      };
    }
    
    return { valid: true };
  },
  
  async execute(
    prompt: string,
    selectedNodes: AreaNode[],
    context: ActionContext
  ): Promise<ActionResult> {
    const node = selectedNodes[0];
    const totalArea = node.areaPerUnit * node.count;
    const scaleGuidance = getScaleUnfoldGuidance(totalArea);
    
    console.log(`[UnfoldAction] Expanding "${node.name}" (${formatArea(totalArea)})`);
    console.log(`[UnfoldAction] Scale: ${scaleGuidance.currentScale} → children will be ${scaleGuidance.childrenType}`);
    console.log(`[UnfoldAction] Target child size: ${formatArea(scaleGuidance.childSizeRange.min)} - ${formatArea(scaleGuidance.childSizeRange.max)}`);
    
    const response = await expandArea(node, context.detailLevel, prompt);
    
    // Handle area too small warning
    if (response.warnings?.includes('area_too_small')) {
      return {
        message: response.message,
        warnings: response.warnings,
        data: null,
      };
    }
    
    // Add scale context to message
    const scaleNote = `[${scaleGuidance.currentScale} scale → ${scaleGuidance.childrenType}]`;
    const enhancedMessage = response.message 
      ? `${scaleNote} ${response.message}`
      : scaleNote;
    
    return {
      message: enhancedMessage,
      data: { response, parentNode: node },
      warnings: response.warnings,
    };
  },
  
  toProposals(
    result: ActionResult,
    _selectedNodes: AreaNode[],
    _context: ActionContext
  ): Proposal[] {
    const data = result.data as { response: FormulaAIResponse; parentNode: AreaNode } | null;
    if (!data?.response || !data?.parentNode) return [];
    
    return formulaResponseToProposals(data.response, data.parentNode);
  },
});

// Register on import
actionRegistry.register(unfoldAction);

export default unfoldAction;
