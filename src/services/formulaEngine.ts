/**
 * Formula Engine - Deterministic evaluation of formula trees
 * 
 * Core principle: Same formulas + same inputs = same outputs, always.
 * AI provides formulas and reasoning; this engine handles all math.
 */

import type { UUID } from '@/types';
import type {
  AreaFormula,
  FormulaAreaNode,
  ConstraintViolation,
  ComputedValue,
  FormulaInput,
  EvaluationAdjustment,
  TreeEvaluationResult,
  EvaluationOptions,
  AIAreaWithFormula,
} from '@/types/formulas';
import {
  MIN_AREA_THRESHOLDS,
  CONFIDENCE_THRESHOLDS,
} from '@/types/formulas';

// ============================================
// ENGINE CONFIGURATION
// ============================================

const DEFAULT_OPTIONS: Required<EvaluationOptions> = {
  autoFixConstraints: true,
  maxIterations: 10,
  roundingTolerance: 1,
  roundingAbsorber: 'largest',
};

// ============================================
// FORMULA DESCRIPTION HELPERS
// ============================================

/**
 * Generate human-readable description of a formula
 */
export function describeFormula(formula: AreaFormula): string {
  switch (formula.type) {
    case 'ratio': {
      // Handle both 'ratio' (0-1) and 'percentage' (0-100) from AI
      const formulaAny = formula as unknown as Record<string, unknown>;
      let ratioValue = formula.ratio || 0;
      
      // Check if AI sent percentage instead of ratio
      if (!ratioValue && typeof formulaAny.percentage === 'number') {
        ratioValue = (formulaAny.percentage as number) / 100;
      }
      
      // Detect if ratio looks like a percentage (> 1)
      if (ratioValue > 1) {
        ratioValue = ratioValue / 100;
      }
      
      const refName = formula.reference === 'parent' ? 'parent' 
        : formula.reference === 'total' ? 'project total'
        : formula.reference === 'sibling_sum' ? 'sibling sum'
        : 'reference';
      
      // Use reasoning if available
      if ('reasoning' in formula && formula.reasoning) {
        return formula.reasoning;
      }
      
      return `${(ratioValue * 100).toFixed(1)}% of ${refName}`;
    }
    
    case 'unit_based': {
      const mult = formula.multiplier && formula.multiplier !== 1 
        ? ` × ${formula.multiplier}` : '';
      // Use reasoning if available
      if ('reasoning' in formula && formula.reasoning) {
        return formula.reasoning;
      }
      return `${formula.areaPerUnit}m² × ${formula.unitCount} units${mult}`;
    }
    
    case 'remainder':
      return `remainder after siblings`;
    
    case 'fixed':
      return formula.count && formula.count > 1 
        ? `fixed: ${formula.value}m² × ${formula.count}`
        : `fixed: ${formula.value}m²`;
    
    case 'derived': {
      const opDesc = formula.operation === 'ratio' 
        ? `${(formula.value * 100).toFixed(1)}% of`
        : formula.operation === 'copy' ? 'copy of' : `offset from`;
      return `${opDesc} source node`;
    }
    
    case 'distributed':
      return `${formula.shareCount}/${formula.totalShares} of pool`;
    
    case 'fallback': {
      const methodDesc = formula.method === 'equal_share' ? 'equal share (best guess)'
        : formula.method === 'typology_guess' ? 'typology estimate'
        : 'minimum viable';
      return `⚠️ ${methodDesc} - ${formula.missingInfo.join(', ')}`;
    }
    
    default:
      return 'unknown formula';
  }
}

// ============================================
// CORE EVALUATION LOGIC
// ============================================

interface EvaluationContext {
  rootTotal: number;
  nodeMap: Map<UUID, FormulaAreaNode>;
  computedMap: Map<UUID, { area: number; areaPerUnit: number; count: number }>;
  options: Required<EvaluationOptions>;
}

/**
 * Evaluate a single formula given context
 */
function evaluateFormula(
  formula: AreaFormula,
  node: FormulaAreaNode,
  ctx: EvaluationContext
): { areaPerUnit: number; count: number; totalArea: number; inputs: FormulaInput[] } {
  const inputs: FormulaInput[] = [];
  let totalArea = 0;
  let count = 1;
  let areaPerUnit = 0;

  switch (formula.type) {
    case 'ratio': {
      const refValue = resolveReference(formula.reference, node, ctx, inputs);
      totalArea = refValue * formula.ratio;
      count = 1;
      areaPerUnit = Math.round(totalArea);
      break;
    }

    case 'unit_based': {
      count = formula.unitCount;
      areaPerUnit = formula.areaPerUnit;
      const mult = formula.multiplier ?? 1;
      totalArea = areaPerUnit * count * mult;
      inputs.push({ name: 'areaPerUnit', value: areaPerUnit });
      inputs.push({ name: 'unitCount', value: count });
      if (mult !== 1) inputs.push({ name: 'multiplier', value: mult });
      break;
    }

    case 'remainder': {
      const parentTotal = resolveReference(formula.parentRef, node, ctx, inputs);
      
      // Sum siblings
      let siblingsSum = 0;
      const siblings = getSiblings(node, ctx);
      for (const sibling of siblings) {
        if (formula.excludeSiblings && !formula.excludeSiblings.includes(sibling.id)) {
          continue; // Skip if not in exclude list
        }
        const siblingComputed = ctx.computedMap.get(sibling.id);
        if (siblingComputed) {
          siblingsSum += siblingComputed.area;
          inputs.push({ 
            name: `sibling[${sibling.name}]`, 
            value: siblingComputed.area,
            sourceId: sibling.id 
          });
        }
      }
      
      totalArea = Math.max(0, parentTotal - siblingsSum);
      
      // Apply floor/cap
      if (formula.floor !== undefined && totalArea < formula.floor) {
        totalArea = formula.floor;
      }
      if (formula.cap !== undefined && totalArea > formula.cap) {
        totalArea = formula.cap;
      }
      
      count = 1;
      areaPerUnit = Math.round(totalArea);
      break;
    }

    case 'fixed': {
      areaPerUnit = formula.value;
      count = formula.count ?? 1;
      totalArea = areaPerUnit * count;
      inputs.push({ name: 'fixedValue', value: formula.value });
      break;
    }

    case 'derived': {
      const sourceComputed = ctx.computedMap.get(formula.sourceNodeId);
      if (!sourceComputed) {
        throw new Error(`Derived formula references non-computed node: ${formula.sourceNodeId}`);
      }
      
      inputs.push({ 
        name: 'sourceArea', 
        value: sourceComputed.area,
        sourceId: formula.sourceNodeId 
      });
      
      switch (formula.operation) {
        case 'ratio':
          totalArea = sourceComputed.area * formula.value;
          break;
        case 'offset':
          totalArea = sourceComputed.area + formula.value;
          break;
        case 'copy':
          totalArea = sourceComputed.area;
          break;
      }
      
      count = 1;
      areaPerUnit = Math.round(totalArea);
      break;
    }

    case 'distributed': {
      const poolTotal = resolveReference(formula.poolRef, node, ctx, inputs);
      const shareRatio = formula.shareCount / formula.totalShares;
      totalArea = poolTotal * shareRatio;
      count = 1;
      areaPerUnit = Math.round(totalArea);
      inputs.push({ name: 'shareRatio', value: shareRatio });
      break;
    }

    case 'fallback': {
      // Fallback formula - best effort when AI lacks information
      inputs.push({ name: 'method', value: 0, sourceFormula: formula.method });
      inputs.push({ name: 'confidence', value: formula.confidence.level });
      
      switch (formula.method) {
        case 'equal_share': {
          // Distribute equally among siblings with fallback formulas
          const siblings = getSiblings(node, ctx);
          const fallbackSiblings = siblings.filter(s => s.formula.type === 'fallback');
          const shareCount = fallbackSiblings.length + 1; // +1 for this node
          
          // Get available pool (parent - non-fallback siblings)
          const parentTotal = node.parentId 
            ? (ctx.computedMap.get(node.parentId)?.area ?? ctx.rootTotal)
            : ctx.rootTotal;
          
          let allocatedToOthers = 0;
          for (const sib of siblings) {
            if (sib.formula.type !== 'fallback') {
              allocatedToOthers += ctx.computedMap.get(sib.id)?.area ?? 0;
            }
          }
          
          const availablePool = Math.max(0, parentTotal - allocatedToOthers);
          totalArea = availablePool / shareCount;
          
          // Apply suggested ratio if provided
          if (formula.suggestedRatio !== undefined) {
            totalArea = parentTotal * formula.suggestedRatio;
          }
          
          inputs.push({ name: 'availablePool', value: availablePool });
          inputs.push({ name: 'shareCount', value: shareCount });
          break;
        }
        
        case 'typology_guess': {
          // Use suggested ratio based on typology guessing
          const refTotal = ctx.rootTotal;
          const ratio = formula.suggestedRatio ?? 0.05; // Default 5% if no ratio
          totalArea = refTotal * ratio;
          inputs.push({ name: 'guessedRatio', value: ratio });
          break;
        }
        
        case 'minimum_viable': {
          // Just use the minimum area
          totalArea = formula.minimumArea ?? MIN_AREA_THRESHOLDS.FUNCTIONAL_ROOM;
          inputs.push({ name: 'minimumArea', value: totalArea });
          break;
        }
      }
      
      // Enforce absolute minimum
      totalArea = Math.max(totalArea, MIN_AREA_THRESHOLDS.ABSOLUTE_MIN);
      count = 1;
      areaPerUnit = Math.round(totalArea);
      break;
    }
  }

  return { areaPerUnit, count, totalArea: areaPerUnit * count, inputs };
}

/**
 * Resolve a formula reference to a numeric value
 */
function resolveReference(
  ref: 'parent' | 'total' | 'sibling_sum' | UUID,
  node: FormulaAreaNode,
  ctx: EvaluationContext,
  inputs: FormulaInput[]
): number {
  if (ref === 'total') {
    inputs.push({ name: 'projectTotal', value: ctx.rootTotal });
    return ctx.rootTotal;
  }
  
  if (ref === 'parent') {
    if (!node.parentId) {
      // No parent means this is root level - use total
      inputs.push({ name: 'projectTotal (as parent)', value: ctx.rootTotal });
      return ctx.rootTotal;
    }
    const parentComputed = ctx.computedMap.get(node.parentId);
    if (parentComputed) {
      inputs.push({ name: 'parent.area', value: parentComputed.area, sourceId: node.parentId });
      return parentComputed.area;
    }
    // Parent not yet computed - use root total as fallback
    inputs.push({ name: 'projectTotal (parent pending)', value: ctx.rootTotal });
    return ctx.rootTotal;
  }
  
  if (ref === 'sibling_sum') {
    const siblings = getSiblings(node, ctx);
    let sum = 0;
    for (const sibling of siblings) {
      const siblingComputed = ctx.computedMap.get(sibling.id);
      if (siblingComputed) {
        sum += siblingComputed.area;
      }
    }
    inputs.push({ name: 'siblingSum', value: sum });
    return sum;
  }
  
  // UUID reference
  const refComputed = ctx.computedMap.get(ref);
  if (refComputed) {
    const refNode = ctx.nodeMap.get(ref);
    inputs.push({ 
      name: `ref[${refNode?.name ?? ref}]`, 
      value: refComputed.area,
      sourceId: ref 
    });
    return refComputed.area;
  }
  
  throw new Error(`Reference not found or not yet computed: ${ref}`);
}

/**
 * Get sibling nodes (same parent)
 */
function getSiblings(node: FormulaAreaNode, ctx: EvaluationContext): FormulaAreaNode[] {
  const siblings: FormulaAreaNode[] = [];
  for (const [id, n] of ctx.nodeMap) {
    if (id !== node.id && n.parentId === node.parentId) {
      siblings.push(n);
    }
  }
  return siblings;
}

// ============================================
// CONSTRAINT CHECKING
// ============================================

/**
 * Check all constraints and return violations
 */
function checkConstraints(
  node: FormulaAreaNode,
  computed: { area: number },
  ctx: EvaluationContext
): ConstraintViolation[] {
  if (!node.constraints) return [];
  
  const violations: ConstraintViolation[] = [];
  
  for (const constraint of node.constraints) {
    switch (constraint.kind) {
      case 'minimum':
        if (computed.area < constraint.value) {
          violations.push({
            constraint,
            nodeId: node.id,
            nodeName: node.name,
            expected: constraint.value,
            actual: computed.area,
            severity: 'error',
            autoFixable: true,
          });
        }
        break;
        
      case 'maximum':
        if (computed.area > constraint.value) {
          violations.push({
            constraint,
            nodeId: node.id,
            nodeName: node.name,
            expected: constraint.value,
            actual: computed.area,
            severity: 'error',
            autoFixable: true,
          });
        }
        break;
        
      case 'ratio_to_sibling': {
        const siblingComputed = ctx.computedMap.get(constraint.siblingId);
        if (siblingComputed) {
          const expectedRatio = computed.area / siblingComputed.area;
          const tolerance = constraint.tolerance ?? 0.05;
          if (Math.abs(expectedRatio - constraint.ratio) > tolerance) {
            violations.push({
              constraint,
              nodeId: node.id,
              nodeName: node.name,
              expected: siblingComputed.area * constraint.ratio,
              actual: computed.area,
              severity: 'warning',
              autoFixable: true,
            });
          }
        }
        break;
      }
      
      case 'ratio_to_parent': {
        if (node.parentId) {
          const parentComputed = ctx.computedMap.get(node.parentId);
          if (parentComputed) {
            const expectedRatio = computed.area / parentComputed.area;
            const tolerance = constraint.tolerance ?? 0.05;
            if (Math.abs(expectedRatio - constraint.ratio) > tolerance) {
              violations.push({
                constraint,
                nodeId: node.id,
                nodeName: node.name,
                expected: parentComputed.area * constraint.ratio,
                actual: computed.area,
                severity: 'warning',
                autoFixable: true,
              });
            }
          }
        }
        break;
      }
      
      case 'equal_to': {
        const targetComputed = ctx.computedMap.get(constraint.targetId);
        if (targetComputed && computed.area !== targetComputed.area) {
          violations.push({
            constraint,
            nodeId: node.id,
            nodeName: node.name,
            expected: targetComputed.area,
            actual: computed.area,
            severity: 'error',
            autoFixable: true,
          });
        }
        break;
      }
    }
  }
  
  return violations;
}

// ============================================
// MAIN EVALUATION FUNCTION
// ============================================

/**
 * Check if an area is too small to be meaningfully split
 */
export function canSplitArea(
  totalArea: number,
  targetParts: number,
  minPerPart: number = MIN_AREA_THRESHOLDS.SPLIT_DEFAULT
): { canSplit: boolean; reason?: string; maxParts?: number } {
  if (totalArea < MIN_AREA_THRESHOLDS.ABSOLUTE_MIN * 2) {
    return { 
      canSplit: false, 
      reason: `Area (${totalArea}m²) is below absolute minimum for splitting`,
      maxParts: 1
    };
  }
  
  const minTotalNeeded = targetParts * minPerPart;
  if (totalArea < minTotalNeeded) {
    const maxParts = Math.floor(totalArea / minPerPart);
    return {
      canSplit: maxParts >= 2,
      reason: maxParts >= 2 
        ? `Can only split into ${maxParts} parts (minimum ${minPerPart}m² each)`
        : `Area too small to split meaningfully`,
      maxParts: Math.max(1, maxParts)
    };
  }
  
  return { canSplit: true, maxParts: Math.floor(totalArea / minPerPart) };
}

/**
 * Get the minimum viable area for a space type
 */
export function getMinimumArea(spaceType?: string): number {
  if (!spaceType) return MIN_AREA_THRESHOLDS.FUNCTIONAL_ROOM;
  
  const type = spaceType.toLowerCase();
  
  if (type.includes('closet') || type.includes('storage') || type.includes('alcove')) {
    return MIN_AREA_THRESHOLDS.ABSOLUTE_MIN;
  }
  if (type.includes('office') || type.includes('workspace') || type.includes('desk')) {
    return MIN_AREA_THRESHOLDS.WORKSPACE;
  }
  if (type.includes('meeting') || type.includes('conference') || type.includes('huddle')) {
    return MIN_AREA_THRESHOLDS.MEETING;
  }
  
  return MIN_AREA_THRESHOLDS.FUNCTIONAL_ROOM;
}

/**
 * Build evaluation order (topological sort)
 * Fixed/unit formulas first, then ratios, then remainders, fallbacks last
 */
function buildEvaluationOrder(nodes: FormulaAreaNode[]): FormulaAreaNode[] {
  // Priority: fixed > unit_based > derived > ratio > distributed > remainder > fallback
  const priority: Record<AreaFormula['type'], number> = {
    fixed: 0,
    unit_based: 1,
    derived: 2,
    ratio: 3,
    distributed: 4,
    remainder: 5,
    fallback: 6,  // Fallback evaluated last so it can see what's left
  };
  
  return [...nodes].sort((a, b) => {
    const pa = priority[a.formula.type] ?? 99;
    const pb = priority[b.formula.type] ?? 99;
    return pa - pb;
  });
}

/**
 * Evaluate all formulas in the tree
 */
export function evaluateFormulaTree(
  nodes: FormulaAreaNode[],
  rootTotal: number,
  options: EvaluationOptions = {}
): TreeEvaluationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const nodeMap = new Map<UUID, FormulaAreaNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }
  
  const ctx: EvaluationContext = {
    rootTotal,
    nodeMap,
    computedMap: new Map(),
    options: opts,
  };
  
  const computedValues: Record<UUID, ComputedValue> = {};
  const allViolations: ConstraintViolation[] = [];
  const warnings: string[] = [];
  
  // Evaluate in priority order
  const orderedNodes = buildEvaluationOrder(nodes);
  
  for (const node of orderedNodes) {
    try {
      const result = evaluateFormula(node.formula, node, ctx);
      const adjustments: EvaluationAdjustment[] = [];
      
      // Store intermediate result for dependencies
      ctx.computedMap.set(node.id, {
        area: result.totalArea,
        areaPerUnit: result.areaPerUnit,
        count: result.count,
      });
      
      // Check constraints
      const violations = checkConstraints(node, { area: result.totalArea }, ctx);
      
      // Auto-fix if enabled
      let finalArea = result.totalArea;
      let finalAreaPerUnit = result.areaPerUnit;
      
      if (opts.autoFixConstraints) {
        for (const v of violations) {
          if (v.autoFixable) {
            const oldValue = finalArea;
            finalArea = v.expected;
            finalAreaPerUnit = Math.round(finalArea / result.count);
            
            adjustments.push({
              type: v.constraint.kind === 'minimum' ? 'constraint_min' : 
                    v.constraint.kind === 'maximum' ? 'constraint_max' : 'constraint_ratio',
              originalValue: oldValue,
              adjustedValue: finalArea,
              reason: `Adjusted to satisfy ${v.constraint.kind} constraint`,
              constraintRef: v.constraint,
            });
            
            // Update computed map with fixed value
            ctx.computedMap.set(node.id, {
              area: finalArea,
              areaPerUnit: finalAreaPerUnit,
              count: result.count,
            });
          } else {
            allViolations.push(v);
          }
        }
      } else {
        allViolations.push(...violations);
      }
      
      // Build computed value
      computedValues[node.id] = {
        areaPerUnit: finalAreaPerUnit,
        count: result.count,
        totalArea: finalAreaPerUnit * result.count,
        evaluatedAt: new Date().toISOString(),
        inputs: result.inputs,
        adjustments,
        formula: node.formula,
        formulaDescription: describeFormula(node.formula),
      };
      
      // Add warnings for low confidence or fallback formulas
      const confidence = 'confidence' in node.formula ? node.formula.confidence?.level : undefined;
      if (confidence !== undefined && confidence < CONFIDENCE_THRESHOLDS.LOW) {
        warnings.push(`⚠️ "${node.name}" has very low confidence (${(confidence * 100).toFixed(0)}%) - consider reviewing`);
      }
      if (node.formula.type === 'fallback') {
        const fb = node.formula;
        warnings.push(`ℹ️ "${node.name}" uses best-guess formula due to: ${fb.missingInfo.join(', ')}`);
        if (fb.userPrompts && fb.userPrompts.length > 0) {
          warnings.push(`💡 To improve "${node.name}": ${fb.userPrompts[0]}`);
        }
      }
      
      // Warn if computed area is below minimum threshold
      if (finalAreaPerUnit < MIN_AREA_THRESHOLDS.FUNCTIONAL_ROOM) {
        warnings.push(`⚠️ "${node.name}" is very small (${finalAreaPerUnit}m²) - may not be viable`);
      }
      
    } catch (error) {
      warnings.push(`Failed to evaluate ${node.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Calculate total
  const totalArea = Object.values(computedValues).reduce((sum, cv) => sum + cv.totalArea, 0);
  
  // Apply rounding correction to match rootTotal
  const roundingError = rootTotal - totalArea;
  if (Math.abs(roundingError) > opts.roundingTolerance && Object.keys(computedValues).length > 0) {
    // Find absorber node
    let absorberId: UUID | null = null;
    
    if (opts.roundingAbsorber === 'largest') {
      let maxArea = 0;
      for (const [id, cv] of Object.entries(computedValues)) {
        if (cv.totalArea > maxArea && cv.count === 1) {
          maxArea = cv.totalArea;
          absorberId = id;
        }
      }
    } else if (opts.roundingAbsorber === 'remainder') {
      for (const [id, node] of nodeMap) {
        if (node.formula.type === 'remainder') {
          absorberId = id;
          break;
        }
      }
    } else {
      absorberId = opts.roundingAbsorber;
    }
    
    if (absorberId && computedValues[absorberId]) {
      const cv = computedValues[absorberId];
      cv.adjustments.push({
        type: 'rounding',
        originalValue: cv.areaPerUnit,
        adjustedValue: cv.areaPerUnit + roundingError,
        reason: `Absorbed ${roundingError}m² rounding error to match target total`,
      });
      cv.areaPerUnit += roundingError;
      cv.totalArea = cv.areaPerUnit * cv.count;
    }
  }
  
  // Validate hierarchy (if nodes have parent-child relationships)
  const hierarchyErrors: Array<{
    parentId: UUID;
    parentTotal: number;
    childrenSum: number;
    difference: number;
  }> = [];
  
  for (const node of nodes) {
    if (node.childIds.length > 0) {
      const parentTotal = computedValues[node.id]?.totalArea ?? 0;
      let childrenSum = 0;
      for (const childId of node.childIds) {
        childrenSum += computedValues[childId]?.totalArea ?? 0;
      }
      if (Math.abs(parentTotal - childrenSum) > opts.roundingTolerance) {
        hierarchyErrors.push({
          parentId: node.id,
          parentTotal,
          childrenSum,
          difference: parentTotal - childrenSum,
        });
      }
    }
  }
  
  return {
    success: allViolations.filter(v => v.severity === 'error').length === 0 && hierarchyErrors.length === 0,
    computedValues,
    totalArea: Object.values(computedValues).reduce((sum, cv) => sum + cv.totalArea, 0),
    violations: allViolations,
    warnings,
    hierarchyValid: hierarchyErrors.length === 0,
    hierarchyErrors,
  };
}

// ============================================
// CONVERSION FROM AI OUTPUT
// ============================================

/**
 * Convert AI-provided formula areas to FormulaAreaNodes
 */
export function convertAIAreasToNodes(
  areas: AIAreaWithFormula[]
): FormulaAreaNode[] {
  const now = new Date().toISOString();
  
  return areas.map((area, index) => ({
    id: `temp-${index}-${Date.now()}` as UUID,
    name: area.name,
    formula: area.formula,
    constraints: area.constraints,
    groupHint: area.groupHint,
    parentId: undefined,
    childIds: [],
    createdAt: now,
    modifiedAt: now,
    createdBy: 'ai' as const,
  }));
}

/**
 * Execute a formula-based program creation intent
 */
export function executeFormulaProgram(
  areas: AIAreaWithFormula[],
  targetTotal: number,
  options?: EvaluationOptions
): { 
  nodes: Array<{ name: string; areaPerUnit: number; count: number; groupHint?: string; briefNote?: string }>;
  result: TreeEvaluationResult;
} {
  const formulaNodes = convertAIAreasToNodes(areas);
  const result = evaluateFormulaTree(formulaNodes, targetTotal, options);
  
  // Convert to standard node format
  const nodes = formulaNodes.map(node => {
    const computed = result.computedValues[node.id];
    return {
      name: node.name,
      areaPerUnit: computed?.areaPerUnit ?? 0,
      count: computed?.count ?? 1,
      groupHint: node.groupHint,
      briefNote: computed 
        ? `${computed.formulaDescription} | ${node.formula.reasoning}`
        : node.formula.reasoning,
    };
  });
  
  return { nodes, result };
}

// ============================================
// SIMULATION / PREVIEW
// ============================================

/**
 * Preview what would happen if a formula changed
 */
export function simulateFormulaChange(
  nodeId: UUID,
  newFormula: AreaFormula,
  existingNodes: FormulaAreaNode[],
  rootTotal: number,
  options?: EvaluationOptions
): { 
  preview: TreeEvaluationResult;
  changes: Array<{ nodeId: UUID; nodeName: string; oldArea: number; newArea: number }>;
} {
  // Evaluate current state
  const currentResult = evaluateFormulaTree(existingNodes, rootTotal, options);
  
  // Create modified nodes
  const modifiedNodes = existingNodes.map(node => 
    node.id === nodeId 
      ? { ...node, formula: newFormula }
      : node
  );
  
  // Evaluate new state
  const preview = evaluateFormulaTree(modifiedNodes, rootTotal, options);
  
  // Calculate changes
  const changes: Array<{ nodeId: UUID; nodeName: string; oldArea: number; newArea: number }> = [];
  
  for (const node of existingNodes) {
    const oldArea = currentResult.computedValues[node.id]?.totalArea ?? 0;
    const newArea = preview.computedValues[node.id]?.totalArea ?? 0;
    
    if (oldArea !== newArea) {
      changes.push({
        nodeId: node.id,
        nodeName: node.name,
        oldArea,
        newArea,
      });
    }
  }
  
  return { preview, changes };
}
