/**
 * Intent Executor - Two-Phase Architecture
 * 
 * Phase 1: LLM outputs INTENT (ratios, names, structure) - no calculations
 * Phase 2: CODE executes MATH (exact m², validation, rounding correction)
 * 
 * This guarantees numeric accuracy while preserving LLM's semantic understanding.
 */

import type { 
  Proposal, 
  UUID, 
  AreaNode, 
  Group,
  CreateAreasProposal,
  SplitAreaProposal,
  MergeAreasProposal,
  UpdateAreasProposal,
} from '@/types';

// Helper type for proposals without id/status (what LLM/executor produces)
type ProposalBase<T extends Proposal> = Omit<T, 'id' | 'status'>;

// ============================================
// INTENT TYPES (What LLM outputs)
// ============================================

/**
 * Area with flexible sizing options
 * LLM can specify: totalArea (preferred), fixedArea, or ratio
 */
export interface AreaIntent {
  name: string;
  /** Total area for this category in m² - PREFERRED method */
  totalArea?: number;
  /** Ratio of total (0-1) OR percentage (1-100) - fallback method */
  ratio?: number;
  /** Fixed area in m² (legacy, same as totalArea) */
  fixedArea?: number;
  /** Group assignment */
  groupHint?: string;
  /** Count/multiplier */
  count?: number;
  /** Optional note */
  note?: string;
}

/**
 * Intent to create a new program from scratch
 */
export interface CreateProgramIntent {
  type: 'create_program';
  /** Target total in m² */
  targetTotal: number;
  /** Areas with ratios (code calculates exact values) */
  areas: AreaIntent[];
  /** Message to show user */
  message?: string;
}

/**
 * Intent to split an existing area
 */
export interface SplitAreaIntent {
  type: 'split_area';
  /** UUID of area to split (must exist in context) */
  sourceNodeId: UUID;
  /** Name of source (for display) */
  sourceName: string;
  /** Split parts with ratios (code calculates from source area) */
  splits: AreaIntent[];
  /** Optional group name for the splits */
  groupName?: string;
  groupColor?: string;
  message?: string;
}

/**
 * Intent to split by quantity (count) - results remain linked instances
 * Use this when splitting "Room A × 10" into "Room A × 3" + "Room A × 7"
 * The physical room type stays the same, just distributed differently
 */
export interface SplitByQuantityIntent {
  type: 'split_by_quantity';
  /** UUID of area to split (must exist and have count >= 2) */
  sourceNodeId: UUID;
  /** Name of source (for display) */
  sourceName: string;
  /** Array of quantities to split into (must sum to source count) */
  quantities: number[];
  /** Optional new names for each split (defaults to "name (1)", "name (2)", etc) */
  names?: string[];
  message?: string;
}

/**
 * Intent to merge areas
 */
export interface MergeAreasIntent {
  type: 'merge_areas';
  sourceNodeIds: UUID[];
  sourceNames: string[];
  resultName: string;
  message?: string;
}

/**
 * Intent to redistribute existing areas to a new total
 */
export interface RedistributeIntent {
  type: 'redistribute';
  /** Target total for selected/all areas */
  targetTotal: number;
  /** Node IDs to adjust (empty = all) */
  nodeIds?: UUID[];
  /** Maintain current proportions or rebalance */
  method: 'proportional' | 'equal';
  message?: string;
}

/**
 * Intent to adjust areas by percentage
 */
export interface AdjustPercentIntent {
  type: 'adjust_percent';
  /** Percentage change (+10 = increase 10%, -20 = decrease 20%) */
  percent: number;
  /** Node IDs to adjust (empty = all) */
  nodeIds?: UUID[];
  message?: string;
}

/**
 * Pass-through for operations that don't need math (notes, groups, etc.)
 */
export interface PassThroughIntent {
  type: 'passthrough';
  /** Original proposals from LLM (already validated) */
  proposals: Array<Omit<Proposal, 'id' | 'status'>>;
  message?: string;
}

export type AIIntent = 
  | CreateProgramIntent 
  | SplitAreaIntent 
  | SplitByQuantityIntent
  | MergeAreasIntent
  | RedistributeIntent 
  | AdjustPercentIntent
  | PassThroughIntent;

// ============================================
// INTENT VALIDATION
// ============================================

export interface IntentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate intent has required fields and references valid IDs
 */
export function validateIntent(
  intent: AIIntent,
  existingNodes: AreaNode[],
  _existingGroups: Group[]  // Reserved for future group validation
): IntentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeIds = new Set(existingNodes.map(n => n.id));

  switch (intent.type) {
    case 'create_program':
      if (!intent.targetTotal || intent.targetTotal <= 0) {
        errors.push('targetTotal must be positive');
      }
      if (!intent.areas || intent.areas.length === 0) {
        errors.push('areas array cannot be empty');
      }
      // Check that ratios or fixedAreas are provided
      const hasAllocation = intent.areas.every(a => 
        a.ratio !== undefined || a.fixedArea !== undefined
      );
      if (!hasAllocation) {
        warnings.push('Some areas have no ratio or fixedArea - will distribute equally');
      }
      break;

    case 'split_area':
      if (!intent.sourceNodeId) {
        errors.push('sourceNodeId is required');
      } else if (!nodeIds.has(intent.sourceNodeId)) {
        errors.push(`sourceNodeId "${intent.sourceNodeId}" does not exist`);
      }
      if (!intent.splits || intent.splits.length === 0) {
        errors.push('splits array cannot be empty');
      }
      break;

    case 'split_by_quantity': {
      if (!intent.sourceNodeId) {
        errors.push('sourceNodeId is required');
      } else if (!nodeIds.has(intent.sourceNodeId)) {
        errors.push(`sourceNodeId "${intent.sourceNodeId}" does not exist`);
      } else {
        const node = existingNodes.find(n => n.id === intent.sourceNodeId);
        if (node) {
          if (node.count < 2) {
            errors.push('source node must have count >= 2 for quantity split');
          }
          const total = intent.quantities.reduce((a, b) => a + b, 0);
          if (total !== node.count) {
            errors.push(`quantities sum (${total}) must equal source count (${node.count})`);
          }
          if (intent.quantities.some(q => q < 1)) {
            errors.push('all quantities must be >= 1');
          }
        }
      }
      if (!intent.quantities || intent.quantities.length < 2) {
        errors.push('quantities array must have at least 2 elements');
      }
      break;
    }

    case 'merge_areas':
      if (!intent.sourceNodeIds || intent.sourceNodeIds.length < 2) {
        errors.push('merge requires at least 2 sourceNodeIds');
      }
      for (const id of intent.sourceNodeIds || []) {
        if (!nodeIds.has(id)) {
          errors.push(`sourceNodeId "${id}" does not exist`);
        }
      }
      break;

    case 'redistribute':
      if (!intent.targetTotal || intent.targetTotal <= 0) {
        errors.push('targetTotal must be positive');
      }
      for (const id of intent.nodeIds || []) {
        if (!nodeIds.has(id)) {
          errors.push(`nodeId "${id}" does not exist`);
        }
      }
      break;

    case 'adjust_percent':
      if (intent.percent === undefined) {
        errors.push('percent is required');
      }
      for (const id of intent.nodeIds || []) {
        if (!nodeIds.has(id)) {
          errors.push(`nodeId "${id}" does not exist`);
        }
      }
      break;

    case 'passthrough':
      // Already validated proposals
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================
// RATIO NORMALIZATION
// ============================================

/**
 * Normalize ratios to sum to 1.0
 * Handles: percentages (1-100), ratios (0-1), missing values
 */
function normalizeRatios(areas: AreaIntent[]): number[] {
  const ratios = areas.map(a => {
    if (a.fixedArea !== undefined) return 0; // Skip fixed areas
    if (a.ratio === undefined) return 1; // Equal distribution
    // Auto-detect if it's percentage (>1) or ratio (0-1)
    return a.ratio > 1 ? a.ratio / 100 : a.ratio;
  });

  const totalRatio = ratios.reduce((sum, r) => sum + r, 0);
  if (totalRatio === 0) {
    // All fixed areas or no ratios - distribute equally
    const count = ratios.length;
    return ratios.map(() => 1 / count);
  }

  return ratios.map(r => r / totalRatio);
}

/**
 * Calculate exact m² for each area, ensuring total matches target
 * 
 * Priority: totalArea > fixedArea > ratio
 * - totalArea: LLM specifies exact total for this category
 * - fixedArea: Legacy, same as totalArea  
 * - ratio: Percentage of remaining space after fixed allocations
 */
function calculateExactAreas(
  areas: AreaIntent[],
  targetTotal: number
): Array<{ name: string; areaPerUnit: number; count: number; groupHint?: string; note?: string }> {
  
  // Step 1: Calculate areas with explicit totals (totalArea or fixedArea)
  const explicitTotal = areas
    .filter(a => a.totalArea !== undefined || a.fixedArea !== undefined)
    .reduce((sum, a) => sum + (a.totalArea ?? a.fixedArea ?? 0), 0);
  
  const remainingTotal = targetTotal - explicitTotal;
  
  // Log warning but continue - we'll scale if needed
  if (remainingTotal < 0) {
    console.warn(`Explicit areas (${explicitTotal}m²) exceed target (${targetTotal}m²). Will scale down.`);
  }

  // Step 2: Normalize ratios for areas without explicit totals
  const ratioAreas = areas.filter(a => a.totalArea === undefined && a.fixedArea === undefined);
  const normalizedRatios = normalizeRatios(ratioAreas);
  
  // Step 3: Calculate each area
  let ratioIndex = 0;
  const calculated = areas.map(a => {
    const count = Math.max(1, a.count || 1);
    let categoryTotal: number;
    
    if (a.totalArea !== undefined) {
      // Explicit total area - use directly
      categoryTotal = a.totalArea;
    } else if (a.fixedArea !== undefined) {
      // Fixed area (legacy) - use directly
      categoryTotal = a.fixedArea;
    } else {
      // Ratio-based - calculate from remaining
      const ratio = normalizedRatios[ratioIndex++];
      categoryTotal = ratio * Math.max(0, remainingTotal);
    }
    
    // Calculate per-unit area, minimum 1m²
    const areaPerUnit = Math.max(1, Math.round(categoryTotal / count));
    
    return {
      name: a.name,
      areaPerUnit,
      count,
      groupHint: a.groupHint,
      note: a.note,
    };
  });

  // Step 4: Check actual total and scale if needed
  const currentTotal = calculated.reduce((sum, a) => sum + a.areaPerUnit * a.count, 0);
  const error = targetTotal - currentTotal;
  
  // If error is significant (>1%), scale all areas proportionally
  if (Math.abs(error) > targetTotal * 0.01 && currentTotal > 0) {
    const scaleFactor = targetTotal / currentTotal;
    console.log(`Scaling areas by ${(scaleFactor * 100).toFixed(1)}% to match target`);
    
    calculated.forEach(a => {
      a.areaPerUnit = Math.max(1, Math.round(a.areaPerUnit * scaleFactor));
    });
  }
  
  // Step 5: Fix remaining rounding errors
  const finalTotal = calculated.reduce((sum, a) => sum + a.areaPerUnit * a.count, 0);
  const roundingError = targetTotal - finalTotal;
  
  if (roundingError !== 0 && calculated.length > 0) {
    // Find largest single-count area for adjustment
    const adjustableIndex = calculated.reduce((bestIdx, area, idx) => {
      const isBetter = area.count === 1 && 
        (bestIdx === -1 || area.areaPerUnit > calculated[bestIdx].areaPerUnit);
      return isBetter ? idx : bestIdx;
    }, -1);
    
    const targetIdx = adjustableIndex >= 0 ? adjustableIndex : 0;
    const newValue = calculated[targetIdx].areaPerUnit + roundingError;
    calculated[targetIdx].areaPerUnit = Math.max(1, newValue);
  }

  return calculated;
}

// ============================================
// INTENT -> PROPOSALS CONVERSION
// ============================================

/**
 * Execute intent and produce validated proposals
 * This is where all math happens - LLM never calculates
 */
export function executeIntent(
  intent: AIIntent,
  existingNodes: AreaNode[],
  _existingGroups: Group[]
): { proposals: Array<Omit<Proposal, 'id' | 'status'>>; message: string } {
  switch (intent.type) {
    case 'create_program': {
      const calculated = calculateExactAreas(intent.areas, intent.targetTotal);
      const total = calculated.reduce((sum, a) => sum + a.areaPerUnit * a.count, 0);
      
      const proposal: ProposalBase<CreateAreasProposal> = {
        type: 'create_areas',
        areas: calculated.map(a => ({
          name: a.name,
          areaPerUnit: a.areaPerUnit,
          count: a.count,
          groupHint: a.groupHint,
          briefNote: a.note,
        })),
      };
      
      return {
        proposals: [proposal],
        message: intent.message || `Creating program: ${calculated.length} areas, ${total}m² total`,
      };
    }

    case 'split_area': {
      const sourceNode = existingNodes.find(n => n.id === intent.sourceNodeId);
      if (!sourceNode) {
        throw new Error(`Source node ${intent.sourceNodeId} not found`);
      }
      
      const sourceTotal = sourceNode.areaPerUnit * sourceNode.count;
      const calculated = calculateExactAreas(intent.splits, sourceTotal);
      
      const proposal: ProposalBase<SplitAreaProposal> = {
        type: 'split_area',
        sourceNodeId: intent.sourceNodeId,
        sourceName: intent.sourceName,
        splits: calculated.map(a => ({
          name: a.name,
          areaPerUnit: a.areaPerUnit,
          count: a.count,
        })),
        groupName: intent.groupName,
        groupColor: intent.groupColor,
      };
      
      return {
        proposals: [proposal],
        message: intent.message || `Split ${intent.sourceName} into ${calculated.length} parts`,
      };
    }

    case 'split_by_quantity': {
      const sourceNode = existingNodes.find(n => n.id === intent.sourceNodeId);
      if (!sourceNode) {
        throw new Error(`Source node ${intent.sourceNodeId} not found`);
      }
      
      // Generate names for each split
      const names = intent.names || intent.quantities.map((_, i) => 
        i === 0 ? sourceNode.name : `${sourceNode.name} (${i + 1})`
      );
      
      // Import the new proposal type
      const proposal: ProposalBase<import('@/types').SplitByQuantityProposal> = {
        type: 'split_by_quantity',
        sourceNodeId: intent.sourceNodeId,
        sourceName: intent.sourceName,
        quantities: intent.quantities,
        names,
      };
      
      return {
        proposals: [proposal],
        message: intent.message || `Split ${intent.sourceName} by quantity: ×${intent.quantities.join(' + ×')} (linked instances)`,
      };
    }

    case 'merge_areas': {
      const sourceNodes = existingNodes.filter(n => intent.sourceNodeIds.includes(n.id));
      const mergedTotal = sourceNodes.reduce((sum, n) => sum + n.areaPerUnit * n.count, 0);
      
      const proposal: ProposalBase<MergeAreasProposal> = {
        type: 'merge_areas',
        sourceNodeIds: intent.sourceNodeIds,
        sourceNames: intent.sourceNames,
        result: {
          name: intent.resultName,
          areaPerUnit: mergedTotal,
          count: 1,
        },
      };
      
      return {
        proposals: [proposal],
        message: intent.message || `Merge ${intent.sourceNames.join(', ')} into ${intent.resultName}`,
      };
    }

    case 'redistribute': {
      const nodesToAdjust = intent.nodeIds?.length 
        ? existingNodes.filter(n => intent.nodeIds!.includes(n.id))
        : existingNodes;
      
      const currentTotal = nodesToAdjust.reduce((sum, n) => sum + n.areaPerUnit * n.count, 0);
      const factor = intent.targetTotal / currentTotal;
      
      const updates = nodesToAdjust.map(n => {
        const newArea = intent.method === 'proportional'
          ? Math.round(n.areaPerUnit * factor)
          : Math.round(intent.targetTotal / nodesToAdjust.length / n.count);
        
        return {
          nodeId: n.id,
          nodeName: n.name,
          changes: { areaPerUnit: newArea },
        };
      });

      // Fix rounding
      const newTotal = updates.reduce((sum, u) => {
        const node = nodesToAdjust.find(n => n.id === u.nodeId)!;
        return sum + u.changes.areaPerUnit! * node.count;
      }, 0);
      const error = intent.targetTotal - newTotal;
      if (error !== 0 && updates.length > 0) {
        updates[0].changes.areaPerUnit! += error;
      }
      
      const proposal: ProposalBase<UpdateAreasProposal> = {
        type: 'update_areas',
        updates,
      };
      
      return {
        proposals: [proposal],
        message: intent.message || `Redistribute to ${intent.targetTotal}m²`,
      };
    }

    case 'adjust_percent': {
      const nodesToAdjust = intent.nodeIds?.length 
        ? existingNodes.filter(n => intent.nodeIds!.includes(n.id))
        : existingNodes;
      
      const factor = 1 + intent.percent / 100;
      const updates = nodesToAdjust.map(n => ({
        nodeId: n.id,
        nodeName: n.name,
        changes: { areaPerUnit: Math.round(n.areaPerUnit * factor) },
      }));
      
      const direction = intent.percent >= 0 ? 'increase' : 'decrease';
      
      const proposal: ProposalBase<UpdateAreasProposal> = {
        type: 'update_areas',
        updates,
      };
      
      return {
        proposals: [proposal],
        message: intent.message || `${direction} by ${Math.abs(intent.percent)}%`,
      };
    }

    case 'passthrough':
      return {
        proposals: intent.proposals,
        message: intent.message || 'AI proposal',
      };
  }
}

// ============================================
// INTENT PARSING FROM LLM OUTPUT
// ============================================

/**
 * Parse LLM's intent output into typed intent
 * Handles both new intent format and legacy proposal format
 */
export function parseIntentFromLLM(
  llmOutput: unknown,
  _existingNodes: AreaNode[]  // Reserved for future validation
): AIIntent | null {
  if (!llmOutput || typeof llmOutput !== 'object') {
    return null;
  }

  const output = llmOutput as Record<string, unknown>;

  // Check for intent-based format first
  if (output.intent && typeof output.intent === 'object') {
    const intentData = output.intent as Record<string, unknown>;
    // Validate intent has required 'type' field
    if (typeof intentData.type === 'string') {
      return intentData as unknown as AIIntent;
    }
    return null;
  }

  // Check for direct intent type
  if (output.type && typeof output.type === 'string') {
    const intentTypes = ['create_program', 'split_area', 'merge_areas', 'redistribute', 'adjust_percent'];
    if (intentTypes.includes(output.type)) {
      return output as unknown as AIIntent;
    }
  }

  // Legacy: Convert old proposal format to intent
  if (output.proposals && Array.isArray(output.proposals)) {
    const proposals = output.proposals as Array<Record<string, unknown>>;
    
    // Check if it's a create_areas with areas - convert to create_program intent
    const createAreasProposal = proposals.find(p => p.type === 'create_areas');
    if (createAreasProposal && Array.isArray(createAreasProposal.areas)) {
      const areas = createAreasProposal.areas as Array<Record<string, unknown>>;
      
      // Calculate total from areas (legacy format has exact values)
      const total = areas.reduce((sum, a) => {
        const areaPerUnit = typeof a.areaPerUnit === 'number' ? a.areaPerUnit : 0;
        const count = typeof a.count === 'number' ? a.count : 1;
        return sum + areaPerUnit * count;
      }, 0);

      // If areas don't have ratios, pass through as-is
      const hasRatios = areas.some(a => a.ratio !== undefined || a.percentage !== undefined);
      if (!hasRatios) {
        // Legacy format with calculated values - pass through
        return {
          type: 'passthrough',
          proposals: proposals as Array<Omit<Proposal, 'id' | 'status'>>,
          message: output.message as string | undefined,
        };
      }

      // Convert to intent format
      return {
        type: 'create_program',
        targetTotal: total,
        areas: areas.map(a => ({
          name: a.name as string,
          ratio: (a.ratio as number) || (a.percentage as number),
          fixedArea: a.fixedArea as number | undefined,
          groupHint: a.groupHint as string | undefined,
          count: (a.count as number) || 1,
          note: a.briefNote as string | undefined,
        })),
        message: output.message as string | undefined,
      };
    }

    // Other proposal types - pass through
    return {
      type: 'passthrough',
      proposals: proposals as Array<Omit<Proposal, 'id' | 'status'>>,
      message: output.message as string | undefined,
    };
  }

  return null;
}

// ============================================
// HIGH-LEVEL API
// ============================================

/**
 * Process LLM output through intent system
 * Returns validated proposals ready for UI
 */
export function processLLMOutput(
  llmOutput: unknown,
  existingNodes: AreaNode[],
  existingGroups: Group[]
): { 
  success: boolean; 
  proposals?: Array<Omit<Proposal, 'id' | 'status'>>;
  message?: string;
  error?: string;
} {
  try {
    const intent = parseIntentFromLLM(llmOutput, existingNodes);
    
    if (!intent) {
      return { 
        success: false, 
        error: 'Could not parse intent from LLM output' 
      };
    }

    // Validate intent
    const validation = validateIntent(intent, existingNodes, existingGroups);
    if (!validation.valid) {
      return { 
        success: false, 
        error: `Invalid intent: ${validation.errors.join(', ')}` 
      };
    }

    // Log warnings
    if (validation.warnings.length > 0) {
      console.warn('Intent warnings:', validation.warnings);
    }

    // Execute intent to produce proposals
    const result = executeIntent(intent, existingNodes, existingGroups);
    
    return {
      success: true,
      proposals: result.proposals,
      message: result.message,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error processing intent',
    };
  }
}
