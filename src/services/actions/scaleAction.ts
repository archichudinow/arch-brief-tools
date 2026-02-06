/**
 * Scale Action - Scale or adjust area values
 * 
 * Triggers: "scale to X", "+10%", "increase by 20%"
 * Selection: Any (selected or all)
 * Output: UpdateAreasProposal with new values
 * 
 * This is a DETERMINISTIC action - no AI needed, pure math.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Proposal, AreaNode, UpdateAreasProposal } from '@/types';
import { 
  detectNumericIntent,
  executeScaleOperation,
  executeAdjustByPercent,
  type ScaleOperation,
  type AdjustByPercentOperation,
} from '../areaOperations';
import { formatArea } from '../scaleAnalyzer';
import { 
  defineAction, 
  actionRegistry,
  type ActionContext,
  type ActionResult,
  type ValidationResult,
} from './registry';

// ============================================
// SCALE ACTION
// ============================================

export const scaleAction = defineAction({
  id: 'scale',
  name: 'Scale Areas',
  description: 'Scale areas to a target total or adjust by percentage',
  examples: [
    'Scale to 5000 sqm',
    'Increase by 10%',
    '+15%',
    'Reduce by 20%',
  ],
  patterns: [
    /\b(scale|adjust|set|change|make)\s+(?:total\s+)?(?:to\s+)?\d/i,
    /\b(target|total)\s+(?:of\s+)?\d/i,
    /\b(increase|raise|grow|add|decrease|reduce|cut|lower)\s+(?:by\s+)?\d+\s*%/i,
    /^[+-]?\d+\s*%$/i, // Just "+10%" or "-5%"
  ],
  selectionRequirement: 'none', // Can work on all or selected
  priority: 30, // High priority - specific numeric commands
  
  validate(
    prompt: string,
    selectedNodes: AreaNode[],
    context: ActionContext
  ): ValidationResult {
    const intent = detectNumericIntent(prompt);
    
    if (intent.type === 'other') {
      return {
        valid: false,
        error: 'Could not understand the scale/adjust command. Try "scale to 5000" or "+10%"',
      };
    }
    
    // Need something to scale
    const allNodes = Object.values(context.nodes);
    const targetNodes = selectedNodes.length > 0 ? selectedNodes : allNodes;
    
    if (targetNodes.length === 0) {
      return {
        valid: false,
        error: 'No areas to scale. Create a program first.',
      };
    }
    
    return { valid: true };
  },
  
  async execute(
    prompt: string,
    selectedNodes: AreaNode[],
    context: ActionContext
  ): Promise<ActionResult> {
    const intent = detectNumericIntent(prompt);
    const allNodes = Object.values(context.nodes);
    const targetNodes = selectedNodes.length > 0 ? selectedNodes : allNodes;
    const scope = selectedNodes.length > 0 ? 'selected' : 'all';
    
    console.log(`[ScaleAction] ${intent.type} on ${targetNodes.length} areas (${scope})`);
    
    // Calculate current total
    const currentTotal = targetNodes.reduce(
      (sum, n) => sum + n.areaPerUnit * n.count, 
      0
    );
    
    let updates: Array<{ nodeId: string; newAreaPerUnit: number }>;
    let message: string;
    
    if (intent.type === 'scale_to_target' && intent.targetValue) {
      const operation: ScaleOperation = {
        op: 'scale_to_target',
        targetArea: intent.targetValue,
        scope,
        method: 'proportional',
        nodeIds: scope === 'selected' ? targetNodes.map(n => n.id) : undefined,
      };
      
      updates = executeScaleOperation(operation, targetNodes);
      
      const change = intent.targetValue - currentTotal;
      const changePercent = ((change / currentTotal) * 100).toFixed(1);
      const changeSign = change >= 0 ? '+' : '';
      
      message = `Scaled ${targetNodes.length} area${targetNodes.length > 1 ? 's' : ''} from ${formatArea(currentTotal)} to ${formatArea(intent.targetValue)} (${changeSign}${changePercent}%)`;
      
    } else if (intent.type === 'adjust_percent' && intent.percent !== undefined) {
      const operation: AdjustByPercentOperation = {
        op: 'adjust_by_percent',
        percent: intent.percent,
        scope,
        nodeIds: scope === 'selected' ? targetNodes.map(n => n.id) : undefined,
      };
      
      updates = executeAdjustByPercent(operation, targetNodes);
      
      const newTotal = updates.reduce((sum, u) => {
        const node = targetNodes.find(n => n.id === u.nodeId);
        return sum + u.newAreaPerUnit * (node?.count || 1);
      }, 0);
      
      const sign = intent.percent >= 0 ? '+' : '';
      message = `Adjusted ${targetNodes.length} area${targetNodes.length > 1 ? 's' : ''} by ${sign}${intent.percent}%: ${formatArea(currentTotal)} → ${formatArea(newTotal)}`;
      
    } else {
      return {
        message: 'Could not determine scale operation. Try "scale to 5000" or "+10%"',
        warnings: ['parse_error'],
        data: null,
      };
    }
    
    return {
      message,
      data: { updates, targetNodes },
    };
  },
  
  toProposals(
    result: ActionResult,
    _selectedNodes: AreaNode[],
    _context: ActionContext
  ): Proposal[] {
    const data = result.data as {
      updates: Array<{ nodeId: string; newAreaPerUnit: number }>;
      targetNodes: AreaNode[];
    } | null;
    
    if (!data?.updates || data.updates.length === 0) {
      return [];
    }
    
    // Create update proposals for each changed area
    const proposal: UpdateAreasProposal = {
      id: uuidv4(),
      type: 'update_areas',
      status: 'pending',
      updates: data.updates.map(u => {
        const node = data.targetNodes.find(n => n.id === u.nodeId);
        return {
          nodeId: u.nodeId,
          nodeName: node?.name || 'Unknown',
          changes: {
            areaPerUnit: u.newAreaPerUnit,
          },
        };
      }),
    };
    
    return [proposal];
  },
});

// Register on import
actionRegistry.register(scaleAction);

export default scaleAction;
