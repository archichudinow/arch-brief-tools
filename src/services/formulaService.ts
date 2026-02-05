/**
 * Formula Service - AI integration for formula-based area generation
 * 
 * Handles:
 * - Generating formulas from briefs
 * - Expanding areas recursively (unfold)
 * - Scale detection and clarification
 * - Converting formulas to proposals
 */

import { v4 as uuidv4 } from 'uuid';
import type { UUID, AreaNode, Proposal, CreateAreasProposal, SplitAreaProposal } from '@/types';
import type { AreaFormula, ProjectScale } from '@/types/formulas';
import { MIN_AREA_THRESHOLDS } from '@/types/formulas';
import { describeFormula } from './formulaEngine';
import { analyzeScale, formatArea } from './scaleAnalyzer';
import { FORMULA_SYSTEM_PROMPT } from './aiPrompts';

// ============================================
// AI RESPONSE TYPES
// ============================================

export interface FormulaAreaSpec {
  name: string;
  formula: AreaFormula;
  groupHint?: string;
}

export interface CreateFormulaProgramIntent {
  type: 'create_formula_program';
  targetTotal: number;
  areas: FormulaAreaSpec[];
}

export interface ExpandAreaIntent {
  type: 'expand_area';
  parentId?: UUID;
  parentName: string;
  parentArea: number;
  children: FormulaAreaSpec[];
}

export interface ClarificationOption {
  label: string;
  area: number;
  scale: ProjectScale;
  interpretation?: string;
}

export interface FormulaAIResponse {
  message: string;
  detected_scale?: ProjectScale;
  
  // Normal operation
  intent?: CreateFormulaProgramIntent | ExpandAreaIntent;
  
  // Scale mismatch - needs clarification
  clarification_needed?: boolean;
  expected_scale?: ProjectScale;
  options?: ClarificationOption[];
  
  // Warnings (e.g., area too small to split)
  warnings?: string[];
}

// ============================================
// SERVICE CONFIGURATION
// ============================================

const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o';

function getApiKey(): string {
  const key = import.meta.env.VITE_OPENAI_API_KEY;
  if (!key) throw new Error('VITE_OPENAI_API_KEY not configured');
  return key;
}

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Generate initial program from brief with optional recursive unfold
 * 
 * @param briefText - The brief/prompt text
 * @param totalArea - Optional explicit total area
 * @param depth - Unfold depth (1 = no unfold, 2 = one level, 3 = two levels)
 */
export async function generateFormulaProgram(
  briefText: string,
  totalArea?: number,
  depth: number = 1
): Promise<FormulaAIResponse> {
  console.log(`[generateFormulaProgram] Starting with depth=${depth}, totalArea=${totalArea}`);
  
  const systemPrompt = buildSystemPrompt('create');
  
  let userPrompt = briefText;
  if (totalArea) {
    userPrompt = `*** HARD CONSTRAINT: Total area is EXACTLY ${formatArea(totalArea)} ***

Your formulas MUST sum to exactly this total. If using unit_based formulas (e.g., rooms), 
calculate the unit count to fit within the budget. Do NOT exceed this total.

If you use 'remainder' type for one area, all other formulas must leave positive remainder.

Brief: ${briefText}`;
  }
  
  // Add depth instruction to prompt - ask for abstract zones when we'll unfold
  if (depth > 1) {
    userPrompt += `\n\n*** CRITICAL INSTRUCTION ***
Generate ONLY HIGH-LEVEL ZONES (5-8 major functional zones), NOT individual rooms or detailed spaces.
You MUST use abstract zone names that can be further subdivided.

CORRECT zone names (use these patterns):
- "Guest Accommodation Wing" (NOT "Standard Room", "Suite", "Bathroom")
- "Food & Beverage Zone" (NOT "Restaurant", "Kitchen", "Bar")
- "Back-of-House Facilities" (NOT "Laundry Room", "Storage", "Staff Locker")
- "Outdoor Amenities Area" (NOT "Pool", "Tennis Court", "Garden")
- "Parking & Vehicle Zone" (NOT "Parking Space", "Loading Dock")
- "Public & Lobby Zone" (NOT "Reception Desk", "Waiting Area")

Each zone MUST have "Zone", "Wing", "Area", "Facilities", or "Block" in its name.`;
  }
  
  const initialResponse = await callFormulaAI(systemPrompt, userPrompt);
  
  // If depth is 1 or no areas generated, return as-is
  if (depth <= 1 || !initialResponse.intent || initialResponse.intent.type !== 'create_formula_program') {
    console.log(`[generateFormulaProgram] Returning initial response (depth=${depth}, hasIntent=${!!initialResponse.intent})`);
    return initialResponse;
  }
  
  // Recursive unfold for depth > 1
  const targetTotal = initialResponse.intent.targetTotal;
  const initialAreas = initialResponse.intent.areas;
  
  console.log(`[unfold] Starting recursive unfold: ${initialAreas.length} initial zones, depth=${depth}`);
  console.log(`[unfold] Initial zones:`, initialAreas.map(a => a.name));
  
  const unfoldedAreas: FormulaAreaSpec[] = [];
  // Track which zones were successfully expanded (for group creation)
  const expandedZones: string[] = [];
  
  for (const area of initialAreas) {
    const areaSize = evaluateSingleFormula(area.formula, targetTotal);
    
    // For depth > 1, unfold ALL zones that are > 100m² (they should all be large zones)
    const shouldUnfold = areaSize > 100;
    
    if (!shouldUnfold) {
      console.log(`[unfold] "${area.name}" (${areaSize}m²) → too small, keeping as terminal area`);
      // Keep as standalone area (no group for small terminal areas)
      unfoldedAreas.push(area);
      continue;
    }
    
    console.log(`[unfold] "${area.name}" (${areaSize}m²) → calling expandArea...`);
    
    // Create a mock node for expandArea
    const mockNode: AreaNode = {
      id: 'temp-' + area.name,
      name: area.name,
      areaPerUnit: areaSize,
      count: 1,
      notes: [],
      lockedFields: [],
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      createdBy: 'ai',
    };
    
    try {
      // Unfold this area - pass remaining depth
      const expandResponse = await expandArea(mockNode, depth - 1, briefText);
      
      const hasChildren = expandResponse.intent?.type === 'expand_area' && 
                         expandResponse.intent.children && 
                         expandResponse.intent.children.length > 0;
      
      console.log(`[unfold] expandArea response for "${area.name}":`, {
        hasIntent: !!expandResponse.intent,
        intentType: expandResponse.intent?.type,
        childrenCount: hasChildren ? expandResponse.intent!.children!.length : 0,
        warnings: expandResponse.warnings,
      });
      
      if (hasChildren) {
        // SUCCESS: Add children with groupHint pointing to parent zone
        const children = expandResponse.intent!.children!;
        expandedZones.push(area.name);
        
        // STEP 1: Compute all child sizes and track which are scalable
        const childData: Array<{ name: string; size: number; isScalable: boolean; formula: AreaFormula }> = [];
        
        for (const child of children) {
          const childSize = evaluateSingleFormula(child.formula, areaSize);
          const isScalable = child.formula.type === 'ratio' || child.formula.type === 'fallback';
          childData.push({ 
            name: child.name, 
            size: childSize, 
            isScalable,
            formula: child.formula 
          });
        }
        
        // STEP 2: Normalize to ensure children sum to parent
        const rawTotal = childData.reduce((sum, c) => sum + c.size, 0);
        const tolerance = 0.02; // 2%
        const deviation = Math.abs(rawTotal - areaSize) / areaSize;
        
        if (deviation > tolerance) {
          const scalableTotal = childData.filter(c => c.isScalable).reduce((sum, c) => sum + c.size, 0);
          const fixedTotal = rawTotal - scalableTotal;
          
          if (scalableTotal > 0) {
            const targetScalable = areaSize - fixedTotal;
            const scaleFactor = targetScalable / scalableTotal;
            
            console.log(`[unfold]   Normalizing children: raw=${rawTotal}, target=${areaSize}, scaling ratio areas by ${scaleFactor.toFixed(3)}`);
            
            for (const child of childData) {
              if (child.isScalable) {
                child.size = Math.round(child.size * scaleFactor);
              }
            }
          }
        }
        
        // STEP 3: Add normalized children
        for (const child of childData) {
          unfoldedAreas.push({
            name: child.name,
            // Convert to fixed formula with computed actual area
            formula: {
              type: 'fixed',
              value: child.size,
              reasoning: `${child.size}m² (computed from parent "${area.name}" ${areaSize}m²)`,
              source: { type: 'calculated', value: `Child of ${area.name}` },
            } as AreaFormula,
            groupHint: area.name, // Parent zone becomes the group
          });
        }
        
        const normalizedTotal = childData.reduce((sum, c) => sum + c.size, 0);
        console.log(`[unfold]   ✓ expanded into ${children.length} sub-areas (total: ${normalizedTotal}m²), groupHint="${area.name}"`);
      } else {
        // FAILED: Keep original zone as a single area (no groupHint = standalone)
        console.log(`[unfold]   ✗ no children returned, keeping "${area.name}" as standalone area`);
        unfoldedAreas.push({
          ...area,
          // No groupHint - will be a standalone area not in any group
        });
      }
    } catch (err) {
      console.error(`[unfold] Error expanding "${area.name}":`, err);
      // On error, keep original as standalone
      unfoldedAreas.push(area);
    }
    
    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log(`[unfold] Complete: ${initialAreas.length} zones → ${unfoldedAreas.length} areas`);
  
  // Summary of groupHints
  const groupSummary: Record<string, string[]> = {};
  const ungrouped: string[] = [];
  for (const area of unfoldedAreas) {
    if (area.groupHint) {
      if (!groupSummary[area.groupHint]) {
        groupSummary[area.groupHint] = [];
      }
      groupSummary[area.groupHint].push(area.name);
    } else {
      ungrouped.push(area.name);
    }
  }
  console.log(`[unfold] Group summary:`, groupSummary);
  if (ungrouped.length > 0) {
    console.log(`[unfold] Ungrouped areas:`, ungrouped);
  }
  
  // Return modified response
  return {
    ...initialResponse,
    message: `${initialResponse.message}\n\n📊 *Expanded ${initialAreas.length} zones into ${unfoldedAreas.length} detailed areas (depth ${depth}).*`,
    intent: {
      ...initialResponse.intent,
      areas: unfoldedAreas,
    },
  };
}

/**
 * Evaluate a single formula to get area size
 * Handles both 'ratio' (0-1) and 'percentage' (0-100) from AI
 */
function evaluateSingleFormula(formula: AreaFormula, totalArea: number): number {
  switch (formula.type) {
    case 'fixed':
      return formula.value || 0;
    case 'ratio': {
      // AI might return 'percentage' (0-100) instead of 'ratio' (0-1)
      const formulaAny = formula as Record<string, unknown>;
      let ratioValue = formula.ratio || 0;
      
      // Check if AI sent percentage instead of ratio
      if (!ratioValue && typeof formulaAny.percentage === 'number') {
        ratioValue = formulaAny.percentage / 100;
      }
      
      // Detect if ratio looks like a percentage (> 1)
      if (ratioValue > 1) {
        ratioValue = ratioValue / 100;
      }
      
      return Math.round(ratioValue * totalArea);
    }
    case 'unit_based':
      return (formula.areaPerUnit || 0) * (formula.unitCount || 1) * (formula.multiplier || 1);
    default:
      return 100; // Fallback
  }
}

/**
 * Expand a specific area into sub-areas
 * 
 * @param parentNode - Area to expand
 * @param depth - How many levels to expand (1-3)
 * @param context - Additional context from user
 */
export async function expandArea(
  parentNode: AreaNode,
  depth: number = 1,
  context?: string
): Promise<FormulaAIResponse> {
  const parentArea = parentNode.areaPerUnit * parentNode.count;
  
  console.log(`[expandArea] Expanding "${parentNode.name}" (${parentArea}m²) with depth=${depth}`);
  
  // Check if area is too small to meaningfully split (need at least 10m² to split into 2 parts)
  const minSplitArea = MIN_AREA_THRESHOLDS.SPLIT_DEFAULT * 2;
  if (parentArea < minSplitArea) {
    console.log(`[expandArea] Area too small (${parentArea} < ${minSplitArea})`);
    return {
      message: `"${parentNode.name}" (${formatArea(parentArea)}) is too small to split meaningfully. Minimum splittable area is ~${minSplitArea} m².`,
      warnings: ['area_too_small'],
    };
  }
  
  const systemPrompt = buildSystemPrompt('expand', depth);
  
  let userPrompt = `Expand/breakdown "${parentNode.name}" (${formatArea(parentArea)}) into detailed sub-areas.

Generate 4-8 specific rooms/spaces within this zone. Use the FULL parent area (${formatArea(parentArea)}).

Example output for "Guest Room Wing" (5,000 m²):
{
  "message": "Breaking down Guest Room Wing into specific room types...",
  "intent": {
    "type": "expand_area",
    "parentName": "Guest Room Wing",
    "parentArea": 5000,
    "children": [
      { "name": "Standard Rooms", "formula": { "type": "ratio", "percentage": 50 } },
      { "name": "Suites", "formula": { "type": "ratio", "percentage": 25 } },
      { "name": "Presidential Suite", "formula": { "type": "fixed", "value": 200 } },
      { "name": "Room Corridors", "formula": { "type": "ratio", "percentage": 15 } },
      { "name": "Housekeeping Stations", "formula": { "type": "ratio", "percentage": 5 } }
    ]
  }
}`;
  
  if (parentNode.userNote) {
    userPrompt += `\n\nNotes from brief: ${parentNode.userNote}`;
  }
  
  if (context) {
    userPrompt += `\n\nProject context: ${context}`;
  }
  
  // Scale analysis to guide AI
  const scaleAnalysis = analyzeScale(parentArea);
  if (scaleAnalysis.detectedScale) {
    userPrompt += `\n\nDetected scale: ${scaleAnalysis.detectedScale}`;
  }
  
  const response = await callFormulaAI(systemPrompt, userPrompt);
  
  console.log(`[expandArea] Response for "${parentNode.name}":`, JSON.stringify(response, null, 2));
  
  return response;
}

/**
 * Process clarification choice and continue
 */
export async function resolveClarification(
  originalBrief: string,
  selectedOption: ClarificationOption
): Promise<FormulaAIResponse> {
  const systemPrompt = buildSystemPrompt('create');
  
  const userPrompt = `Original request: ${originalBrief}

User confirmed: ${selectedOption.label}
Corrected area: ${formatArea(selectedOption.area)}
Scale: ${selectedOption.scale}

Proceed with generating the formula program.`;

  return callFormulaAI(systemPrompt, userPrompt);
}

// ============================================
// PROMPT BUILDING
// ============================================

function buildSystemPrompt(mode: 'create' | 'expand', depth?: number): string {
  let prompt = FORMULA_SYSTEM_PROMPT;
  
  if (mode === 'expand' && depth) {
    prompt += `\n\n=== EXPAND MODE ===
You are breaking down an existing zone/area into specific sub-spaces.

CRITICAL RULES:
1. Output MUST have "intent" with "type": "expand_area"
2. "children" array MUST contain 4-8 specific areas
3. Each child MUST have "name" and "formula"
4. Formulas should be "ratio" (percentages) that sum to ~100%
5. Use real, specific room names (NOT zones)

REQUIRED OUTPUT FORMAT:
{
  "message": "Breaking down [zone name] into specific areas...",
  "intent": {
    "type": "expand_area",
    "parentName": "[zone name]",
    "parentArea": [number],
    "children": [
      { "name": "Specific Room Type", "formula": { "type": "ratio", "percentage": 40 } },
      { "name": "Another Room", "formula": { "type": "ratio", "percentage": 30 } },
      { "name": "Support Space", "formula": { "type": "ratio", "percentage": 15 } },
      { "name": "Circulation", "formula": { "type": "ratio", "percentage": 15 } }
    ]
  }
}`;
  }
  
  return prompt;
}

// ============================================
// AI CALL
// ============================================

async function callFormulaAI(
  systemPrompt: string,
  userPrompt: string
): Promise<FormulaAIResponse> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'AI request failed');
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('No response content from AI');
  }

  try {
    return JSON.parse(content) as FormulaAIResponse;
  } catch {
    throw new Error('Failed to parse AI response as JSON');
  }
}

// ============================================
// CONVERSION TO PROPOSALS
// ============================================

/**
 * Convert formula AI response to standard proposals
 */
export function formulaResponseToProposals(
  response: FormulaAIResponse,
  parentNode?: AreaNode
): Proposal[] {
  if (!response.intent) return [];
  
  if (response.intent.type === 'create_formula_program') {
    return createProgramToProposals(response.intent);
  }
  
  if (response.intent.type === 'expand_area' && parentNode) {
    return expandIntentToProposals(response.intent, parentNode);
  }
  
  return [];
}

// ============================================
// SIMPLE FORMULA EVALUATION
// ============================================

interface EvaluatedArea {
  name: string;
  area: number;        // Total area (areaPerUnit * count)
  areaPerUnit: number; // Area per single unit
  count: number;       // Number of units
  formula: AreaFormula;
  groupHint?: string;
}

/**
 * Simple formula evaluation without full tree structure
 * Handles the common cases from AI output
 * 
 * Evaluation order:
 * 1. Fixed, unit_based, ratio formulas (independent)
 * 2. Derived formulas (depend on other areas)
 * 3. Remainder formula (absorbs leftover)
 */
function evaluateFormulas(
  areas: FormulaAreaSpec[],
  totalArea: number
): EvaluatedArea[] {
  const results: Map<string, EvaluatedArea> = new Map();
  let remainderName: string | null = null;
  const derivedAreas: Array<{ spec: FormulaAreaSpec; index: number }> = [];
  
  // PASS 1: Evaluate independent formulas (fixed, unit_based, ratio, fallback)
  for (let i = 0; i < areas.length; i++) {
    const area = areas[i];
    const formula = area.formula;
    
    let totalAreaComputed = 0;
    let areaPerUnit = 0;
    let count = 1;
    let skip = false;
    
    switch (formula.type) {
      case 'ratio': {
        // AI might return 'percentage' (0-100) instead of 'ratio' (0-1)
        const formulaAny = formula as Record<string, unknown>;
        let ratioValue = formula.ratio || 0;
        
        // Check if AI sent percentage instead of ratio
        if (!ratioValue && typeof formulaAny.percentage === 'number') {
          ratioValue = (formulaAny.percentage as number) / 100;
        }
        
        // Detect if ratio looks like a percentage (> 1)
        if (ratioValue > 1) {
          ratioValue = ratioValue / 100;
        }
        
        totalAreaComputed = totalArea * ratioValue;
        areaPerUnit = Math.round(totalAreaComputed);
        count = 1;
        break;
      }
        
      case 'unit_based':
        // IMPORTANT: Preserve unit count and area per unit!
        areaPerUnit = formula.areaPerUnit;
        count = formula.unitCount;
        const mult = formula.multiplier || 1;
        totalAreaComputed = areaPerUnit * count * mult;
        // If multiplier present, adjust areaPerUnit to include it
        if (mult !== 1) {
          areaPerUnit = Math.round(areaPerUnit * mult);
        }
        break;
        
      case 'fixed':
        // Preserve count from fixed formula
        areaPerUnit = formula.value;
        count = formula.count || 1;
        totalAreaComputed = areaPerUnit * count;
        break;
        
      case 'remainder':
        // Mark for later calculation  
        remainderName = area.name;
        skip = true;
        break;
        
      case 'fallback':
        // Use suggested ratio or equal share
        totalAreaComputed = formula.suggestedRatio 
          ? totalArea * formula.suggestedRatio
          : totalArea / areas.length;
        areaPerUnit = Math.round(totalAreaComputed);
        count = 1;
        break;
        
      case 'derived':
        // Mark for second pass
        derivedAreas.push({ spec: area, index: i });
        skip = true;
        break;
        
      default:
        // Unknown formula type - use equal share
        totalAreaComputed = totalArea / areas.length;
        areaPerUnit = Math.round(totalAreaComputed);
        count = 1;
    }
    
    if (!skip) {
      results.set(area.name, {
        name: area.name,
        area: totalAreaComputed,
        areaPerUnit,
        count,
        formula: formula,
        groupHint: area.groupHint,
      });
    }
  }
  
  // PASS 2: Evaluate derived formulas (based on other computed areas)
  for (const { spec } of derivedAreas) {
    const formula = spec.formula;
    let computed = 0;
    
    if (formula.type === 'derived') {
      // Try to find source by name in the sourceNodeId field (AI might put name there)
      // Or look for a common reference like "Restaurant" -> "Kitchen is 25% of Restaurant"
      let sourceArea = 0;
      
      // Check if sourceNodeId looks like a UUID or a name
      const sourceRef = formula.sourceNodeId;
      
      // Try to find by name match
      for (const [name, result] of results) {
        // Check for partial match (e.g., "Restaurant" matches "Restaurant & Bar")
        if (sourceRef && name.toLowerCase().includes(sourceRef.toLowerCase())) {
          sourceArea = result.area;
          break;
        }
        // Also check if sourceRef contains the name
        if (sourceRef && sourceRef.toLowerCase().includes(name.toLowerCase())) {
          sourceArea = result.area;
          break;
        }
      }
      
      // If no match found, look for common patterns based on area name
      if (sourceArea === 0) {
        const areaNameLower = spec.name.toLowerCase();
        
        // Kitchen typically derives from Restaurant/F&B
        if (areaNameLower.includes('kitchen')) {
          for (const [name, result] of results) {
            if (name.toLowerCase().includes('restaurant') || 
                name.toLowerCase().includes('f&b') ||
                name.toLowerCase().includes('dining')) {
              sourceArea = result.area;
              break;
            }
          }
        }
        
        // If still no match, use total as fallback but warn
        if (sourceArea === 0) {
          console.warn(`Could not find source node for derived formula: ${spec.name}, using 5% of total`);
          sourceArea = totalArea;
          // Use a reasonable fallback ratio
          computed = totalArea * 0.05;
        }
      }
      
      if (sourceArea > 0 && formula.operation === 'ratio') {
        computed = sourceArea * formula.value;
      } else if (formula.operation === 'offset') {
        computed = sourceArea + formula.value;
      } else if (formula.operation === 'copy') {
        computed = sourceArea;
      }
    }
    
    results.set(spec.name, {
      name: spec.name,
      area: computed,
      areaPerUnit: Math.round(computed),
      count: 1,
      formula: spec.formula,
      groupHint: spec.groupHint,
    });
  }
  
  // PASS 3: Calculate remainder
  if (remainderName) {
    const remainderSpec = areas.find(a => a.name === remainderName)!;
    const remainderFormula = remainderSpec.formula;
    
    // Sum all computed areas
    let usedArea = 0;
    for (const result of results.values()) {
      usedArea += result.area;
    }
    
    let remainderArea = totalArea - usedArea;
    
    // Apply cap if specified (always apply cap)
    if (remainderFormula.type === 'remainder') {
      if (remainderFormula.cap && remainderArea > remainderFormula.cap) {
        remainderArea = remainderFormula.cap;
      }
      // Only apply floor if it won't cause total to exceed target
      // This prevents overshoot when other areas already sum to more than target - floor
      if (remainderFormula.floor && remainderArea < remainderFormula.floor) {
        const wouldOvershoot = usedArea + remainderFormula.floor > totalArea;
        if (!wouldOvershoot) {
          remainderArea = remainderFormula.floor;
        } else {
          console.warn(`[evaluateFormulas] Not applying floor ${remainderFormula.floor} for "${remainderName}" as it would cause overshoot (used: ${usedArea}, target: ${totalArea})`);
        }
      }
    }
    
    results.set(remainderName, {
      name: remainderName,
      area: Math.max(0, remainderArea),
      areaPerUnit: Math.round(Math.max(0, remainderArea)),
      count: 1,
      formula: remainderFormula,
      groupHint: remainderSpec.groupHint,
    });
  }
  
  // PASS 4: Post-normalization - ensure total matches target
  // Calculate actual total vs target
  let actualTotal = 0;
  for (const result of results.values()) {
    actualTotal += result.area;
  }
  
  const tolerance = 0.02; // 2% tolerance
  const deviation = Math.abs(actualTotal - totalArea) / totalArea;
  
  if (deviation > tolerance) {
    console.log(`[evaluateFormulas] Post-normalizing: actual=${actualTotal}, target=${totalArea}, deviation=${(deviation * 100).toFixed(1)}%`);
    
    // Find scalable areas (ratio-based, not fixed, not unit-based with explicit counts)
    const scalableAreas: string[] = [];
    let scalableTotal = 0;
    
    for (const [name, result] of results) {
      const formula = result.formula;
      // Only scale ratio and fallback formulas - preserve fixed, unit_based, and remainder
      if (formula.type === 'ratio' || formula.type === 'fallback') {
        scalableAreas.push(name);
        scalableTotal += result.area;
      }
    }
    
    if (scalableAreas.length > 0 && scalableTotal > 0) {
      // Calculate how much we need to adjust scalable areas
      const nonScalableTotal = actualTotal - scalableTotal;
      const targetScalable = totalArea - nonScalableTotal;
      const scaleFactor = targetScalable / scalableTotal;
      
      console.log(`[evaluateFormulas] Scaling ${scalableAreas.length} ratio areas by ${scaleFactor.toFixed(3)}`);
      
      for (const name of scalableAreas) {
        const result = results.get(name)!;
        const newArea = result.area * scaleFactor;
        result.area = newArea;
        result.areaPerUnit = Math.round(newArea);
      }
    }
  }
  
  // Return in original order
  return areas.map(a => results.get(a.name)!).filter(Boolean);
}

/**
 * Extract reasoning from a formula
 */
function getFormulaReasoning(formula: AreaFormula): string {
  // The AI provides reasoning in the formula itself
  if ('reasoning' in formula && formula.reasoning) {
    return formula.reasoning;
  }
  // Fallback to description
  return describeFormula(formula);
}

/**
 * Extract confidence from a formula
 */
function getFormulaConfidence(formula: AreaFormula): number | undefined {
  if ('confidence' in formula && formula.confidence) {
    return formula.confidence.level;
  }
  return undefined;
}

function createProgramToProposals(
  intent: CreateFormulaProgramIntent
): Proposal[] {
  // Evaluate all formulas
  const evaluated = evaluateFormulas(intent.areas, intent.targetTotal);
  
  console.log('[createProgramToProposals] Evaluated areas:', evaluated.map(e => ({
    name: e.name,
    areaPerUnit: e.areaPerUnit,
    groupHint: e.groupHint,
  })));
  
  const createProposal: CreateAreasProposal = {
    id: uuidv4(),
    type: 'create_areas',
    status: 'pending',
    areas: evaluated.map(e => ({
      name: e.name,
      areaPerUnit: isNaN(e.areaPerUnit) ? 100 : Math.round(e.areaPerUnit),  // Safeguard NaN
      count: e.count || 1,
      aiNote: describeFormula(e.formula),
      groupHint: e.groupHint,
      // Formula-based reasoning for traceability
      formulaReasoning: getFormulaReasoning(e.formula),
      formulaConfidence: getFormulaConfidence(e.formula),
      formulaType: e.formula.type,
    })),
  };
  
  return [createProposal];
}

function expandIntentToProposals(
  intent: ExpandAreaIntent,
  parentNode: AreaNode
): Proposal[] {
  const parentArea = parentNode.areaPerUnit * parentNode.count;
  
  // Evaluate formulas relative to parent
  const evaluated = evaluateFormulas(intent.children, parentArea);
  
  const splitProposal: SplitAreaProposal = {
    id: uuidv4(),
    type: 'split_area',
    status: 'pending',
    sourceNodeId: parentNode.id!,
    sourceName: parentNode.name,
    groupName: parentNode.name, // Group by parent name
    splits: evaluated.map(e => ({
      name: e.name,
      areaPerUnit: Math.round(e.areaPerUnit),  // Use per-unit area, not total
      count: e.count,                           // Preserve unit count from formula
      // Formula-based reasoning for traceability
      formulaReasoning: getFormulaReasoning(e.formula),
      formulaConfidence: getFormulaConfidence(e.formula),
      formulaType: e.formula.type,
    })),
  };
  
  return [splitProposal];
}

// ============================================
// UTILITY TYPES FOR UI
// ============================================

export interface ExpansionState {
  nodeId: UUID;
  isExpanding: boolean;
  depth: number;
  error?: string;
}

export interface ClarificationState {
  isActive: boolean;
  originalBrief?: string;
  options?: ClarificationOption[];
  message?: string;
}
