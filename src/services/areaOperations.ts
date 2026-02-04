/**
 * Area Operations - Deterministic execution layer
 * 
 * LLM outputs INTENT (ratios, operations), CODE executes MATH
 * This guarantees accuracy for numeric operations.
 */

import type { AreaNode, UUID } from '@/types';

// ============================================
// OPERATION TYPES
// ============================================

export interface RatioBasedArea {
  name: string;
  percentage: number;  // 0-100, LLM's output
  groupHint?: string;
  aiNote?: string;
}

export interface ProgramProposal {
  interpretation: string;
  buildingType: string;
  targetArea: number;
  areas: RatioBasedArea[];
  detectedGroups?: Array<{
    name: string;
    color: string;
    areaNames: string[];
  }>;
  assumptions?: string[];
  suggestions?: string[];
  projectContext?: string;
}

export interface ScaleOperation {
  op: 'scale_to_target';
  targetArea: number;
  scope: 'selected' | 'all';
  method: 'proportional' | 'distribute_delta';
  nodeIds?: UUID[];  // If scope is 'selected'
}

export interface AdjustByPercentOperation {
  op: 'adjust_by_percent';
  percent: number;  // e.g., +10 or -20
  scope: 'selected' | 'all';
  nodeIds?: UUID[];
}

export interface DistributeAreaOperation {
  op: 'distribute_area';
  totalArea: number;
  distribution: Array<{
    nodeId: UUID;
    percentage: number;
  }>;
}

export type AreaOperation = 
  | ScaleOperation 
  | AdjustByPercentOperation 
  | DistributeAreaOperation;

// ============================================
// RATIO TO AREA CONVERSION
// ============================================

export interface ConvertedArea {
  name: string;
  areaPerUnit: number;
  count: number;
  groupHint?: string;
  aiNote?: string;
}

/**
 * Convert percentage-based program to exact m² values
 * Guarantees total equals target exactly
 */
export function convertRatiosToAreas(
  proposal: ProgramProposal
): ConvertedArea[] {
  const { areas, targetArea } = proposal;
  
  // Normalize percentages to ensure they sum to 100
  const totalPercent = areas.reduce((sum, a) => sum + a.percentage, 0);
  
  if (totalPercent === 0) {
    console.warn('No percentages provided, distributing equally');
    const equalPercent = 100 / areas.length;
    areas.forEach(a => a.percentage = equalPercent);
  }
  
  // Convert each area
  const converted: ConvertedArea[] = areas.map(area => {
    const normalizedPercent = (area.percentage / totalPercent) * 100;
    const exactArea = (normalizedPercent / 100) * targetArea;
    
    return {
      name: area.name,
      areaPerUnit: Math.round(exactArea),  // Round to whole m²
      count: 1,
      groupHint: area.groupHint,
      aiNote: area.aiNote ? `${area.aiNote} (${area.percentage}%)` : `${area.percentage}% of program`,
    };
  });
  
  // Correct rounding errors by adjusting largest area
  const currentTotal = converted.reduce((sum, a) => sum + a.areaPerUnit, 0);
  const roundingError = targetArea - currentTotal;
  
  if (roundingError !== 0) {
    // Find largest area to absorb rounding error
    const largestIndex = converted.reduce(
      (maxIdx, area, idx, arr) => 
        area.areaPerUnit > arr[maxIdx].areaPerUnit ? idx : maxIdx,
      0
    );
    converted[largestIndex].areaPerUnit += roundingError;
  }
  
  return converted;
}

// ============================================
// SCALE OPERATIONS
// ============================================

/**
 * Scale areas to hit exact target
 * Returns the updates to apply (not new nodes)
 */
export function executeScaleOperation(
  operation: ScaleOperation,
  nodes: AreaNode[]
): Array<{ nodeId: UUID; newAreaPerUnit: number }> {
  const nodesToScale = operation.scope === 'selected' && operation.nodeIds
    ? nodes.filter(n => operation.nodeIds!.includes(n.id))
    : nodes;
  
  if (nodesToScale.length === 0) {
    return [];
  }
  
  const currentTotal = nodesToScale.reduce(
    (sum, n) => sum + n.areaPerUnit * n.count, 
    0
  );
  
  if (currentTotal === 0) {
    console.warn('Cannot scale: current total is 0');
    return [];
  }
  
  const targetTotal = operation.targetArea;
  
  if (operation.method === 'proportional') {
    // Scale each area proportionally
    const factor = targetTotal / currentTotal;
    
    const updates = nodesToScale.map(n => ({
      nodeId: n.id,
      newAreaPerUnit: Math.round(n.areaPerUnit * factor),
    }));
    
    // Fix rounding errors
    const newTotal = updates.reduce((sum, u) => {
      const node = nodesToScale.find(n => n.id === u.nodeId)!;
      return sum + u.newAreaPerUnit * node.count;
    }, 0);
    
    const error = targetTotal - newTotal;
    if (error !== 0 && updates.length > 0) {
      // Find node with count=1 for cleaner adjustment, or largest
      const adjustIndex = updates.findIndex(u => {
        const node = nodesToScale.find(n => n.id === u.nodeId);
        return node?.count === 1;
      });
      const idx = adjustIndex >= 0 ? adjustIndex : 0;
      updates[idx].newAreaPerUnit += error;
    }
    
    return updates;
  } else {
    // Distribute delta evenly
    const delta = targetTotal - currentTotal;
    const deltaPerArea = Math.round(delta / nodesToScale.length);
    const remainder = delta - (deltaPerArea * nodesToScale.length);
    
    return nodesToScale.map((n, i) => ({
      nodeId: n.id,
      newAreaPerUnit: n.areaPerUnit + deltaPerArea + (i === 0 ? remainder : 0),
    }));
  }
}

/**
 * Adjust areas by percentage (+/- X%)
 */
export function executeAdjustByPercent(
  operation: AdjustByPercentOperation,
  nodes: AreaNode[]
): Array<{ nodeId: UUID; newAreaPerUnit: number }> {
  const nodesToAdjust = operation.scope === 'selected' && operation.nodeIds
    ? nodes.filter(n => operation.nodeIds!.includes(n.id))
    : nodes;
  
  const factor = 1 + (operation.percent / 100);
  
  return nodesToAdjust.map(n => ({
    nodeId: n.id,
    newAreaPerUnit: Math.round(n.areaPerUnit * factor),
  }));
}

/**
 * Distribute a total area among nodes by percentage
 */
export function executeDistributeArea(
  operation: DistributeAreaOperation,
  _nodes: AreaNode[]  // Kept for API consistency, distribution uses nodeIds
): Array<{ nodeId: UUID; newAreaPerUnit: number }> {
  const { totalArea, distribution } = operation;
  
  // Normalize percentages
  const totalPercent = distribution.reduce((sum, d) => sum + d.percentage, 0);
  
  const updates = distribution.map(d => {
    const normalizedPercent = (d.percentage / totalPercent) * 100;
    return {
      nodeId: d.nodeId,
      newAreaPerUnit: Math.round((normalizedPercent / 100) * totalArea),
    };
  });
  
  // Fix rounding errors
  const currentTotal = updates.reduce((sum, u) => sum + u.newAreaPerUnit, 0);
  const error = totalArea - currentTotal;
  if (error !== 0 && updates.length > 0) {
    updates[0].newAreaPerUnit += error;
  }
  
  return updates;
}

// ============================================
// INTENT DETECTION
// ============================================

export interface DetectedIntent {
  type: 'scale_to_target' | 'adjust_percent' | 'generate_program' | 'other';
  targetValue?: number;
  percent?: number;
  confidence: number;
}

/**
 * Detect if user is asking for a numeric operation we can handle deterministically
 */
export function detectNumericIntent(userMessage: string): DetectedIntent {
  const lower = userMessage.toLowerCase();
  
  // Pattern: "scale to X", "adjust to X m²", "make total X", "target X"
  const scalePatterns = [
    /(?:scale|adjust|set|change|make)\s+(?:total\s+)?(?:to\s+)?(\d+(?:[.,]\d+)?)\s*(?:m²|sqm|square\s*met(?:er|re)s?)?/i,
    /(?:target|total)\s+(?:of\s+)?(\d+(?:[.,]\d+)?)\s*(?:m²|sqm)?/i,
    /(\d+(?:[.,]\d+)?)\s*(?:m²|sqm)\s+(?:total|target)/i,
  ];
  
  for (const pattern of scalePatterns) {
    const match = lower.match(pattern);
    if (match) {
      const value = parseFloat(match[1].replace(',', ''));
      return {
        type: 'scale_to_target',
        targetValue: value,
        confidence: 0.9,
      };
    }
  }
  
  // Pattern: "increase by X%", "reduce by X%", "+X%", "-X%"
  const percentPatterns = [
    /(?:increase|raise|grow|add)\s+(?:by\s+)?(\d+(?:[.,]\d+)?)\s*%/i,
    /(?:decrease|reduce|cut|lower)\s+(?:by\s+)?(\d+(?:[.,]\d+)?)\s*%/i,
    /([+-]?\d+(?:[.,]\d+)?)\s*%/,
  ];
  
  for (const pattern of percentPatterns) {
    const match = lower.match(pattern);
    if (match) {
      let value = parseFloat(match[1].replace(',', ''));
      // Check if it's a decrease pattern
      if (/decrease|reduce|cut|lower/.test(lower) || match[1].startsWith('-')) {
        value = -Math.abs(value);
      }
      return {
        type: 'adjust_percent',
        percent: value,
        confidence: 0.85,
      };
    }
  }
  
  // Pattern: generate program
  const generatePatterns = [
    /(?:create|generate|make|design)\s+(?:a\s+)?(?:new\s+)?(?:\w+\s+)?(?:program|building|project)/i,
    /(?:program|building)\s+(?:for|with)\s+(\d+)/i,
  ];
  
  for (const pattern of generatePatterns) {
    if (pattern.test(lower)) {
      return {
        type: 'generate_program',
        confidence: 0.8,
      };
    }
  }
  
  return {
    type: 'other',
    confidence: 0.5,
  };
}

// ============================================
// HELPER: Verify total
// ============================================

export function verifyTotal(areas: ConvertedArea[], expectedTotal: number): {
  actual: number;
  expected: number;
  isExact: boolean;
  difference: number;
} {
  const actual = areas.reduce((sum, a) => sum + a.areaPerUnit * a.count, 0);
  return {
    actual,
    expected: expectedTotal,
    isExact: actual === expectedTotal,
    difference: actual - expectedTotal,
  };
}
