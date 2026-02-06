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
import { formatArea, getScaleUnfoldGuidance } from './scaleAnalyzer';
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
 * Helper to extract percentage from formula (handles both 'ratio' and 'percentage' AI responses)
 */
function getFormulaPercentage(formula: AreaFormula): number {
  if (formula.type !== 'ratio') return 0;
  const formulaAny = formula as unknown as Record<string, unknown>;
  
  // Check for 'percentage' property first (AI might return 0-100)
  if (typeof formulaAny.percentage === 'number') {
    return formulaAny.percentage as number;
  }
  
  // Check for 'ratio' property (should be 0-1)
  if (typeof formula.ratio === 'number') {
    return formula.ratio > 1 ? formula.ratio : formula.ratio * 100;
  }
  
  return 0;
}

/**
 * Helper to set percentage on a formula
 */
function setFormulaPercentage(formula: AreaFormula, percentage: number): void {
  if (formula.type !== 'ratio') return;
  const formulaAny = formula as unknown as Record<string, unknown>;
  formulaAny.percentage = percentage;
  // Also update ratio for compatibility
  formula.ratio = percentage / 100;
}

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
  detailLevel: ExpandDetailLevel | number = 'typical'
): Promise<FormulaAIResponse> {
  // Convert legacy numeric depth to detail level
  const level: ExpandDetailLevel = typeof detailLevel === 'number' 
    ? (detailLevel <= 1 ? 'abstract' : detailLevel >= 3 ? 'detailed' : 'typical')
    : detailLevel;
  
  console.log(`[generateFormulaProgram] Starting with level=${level}, totalArea=${totalArea}`);
  
  const systemPrompt = buildSystemPrompt('create');
  
  // Detail level specific guidance for generation
  // CREATE always uses BLOBS (ratio formulas) - no counts
  // Quantities/counts are only applied during UNFOLD
  const levelGuidance = {
    abstract: `Generate 4-6 ABSTRACT ZONES as area blobs.
Use zone names like: "Guest Accommodation Wing", "Public & Lobby Zone", "F&B Zone", "Back-of-House".
These zones will be expanded later into specific areas with quantities.`,
    typical: `Generate 6-10 FUNCTIONAL AREA BLOBS with real names.
Examples: "Guest Rooms", "Lobby", "Restaurant", "Kitchen", "Meeting Rooms", "Parking".
Do NOT use counts or quantities yet - just area blobs that can be unfolded later.`,
    detailed: `Generate 12-20 SPECIFIC AREA BLOBS - be comprehensive.
Include all unique spaces mentioned (e.g., sky garage, pool, spa, restaurant, etc.)
Do NOT use counts - generate each as a single area blob.
These can be unfolded into rooms with quantities later.`
  };
  
  let userPrompt = briefText;
  
  if (totalArea) {
    userPrompt = `*** HARD CONSTRAINT: Total area is EXACTLY ${formatArea(totalArea)} ***

Your formulas MUST sum to exactly this total using ratio formulas (percentages).
Do NOT use unit_based formulas - only use ratio with percentage.

Brief: ${briefText}`;
  }
  
  // Add detail level instruction
  userPrompt += `\n\n*** DETAIL LEVEL: ${level.toUpperCase()} ***
${levelGuidance[level]}

CRITICAL RULES:
1. NEVER include circulation, corridors, vertical circulation, MEP, or core areas
2. ONLY use ratio formulas with percentages - NO unit_based formulas
3. All percentages MUST sum to exactly 100%
4. EVERY area MUST have a groupHint to organize related areas together

OUTPUT FORMAT (groupHint is REQUIRED):
{ "name": "Area Name", "formula": { "type": "ratio", "percentage": 25, "reasoning": "..." }, "groupHint": "Category Name" }

Example groupHints for a carwash: "Wash Operations", "Customer Services", "Staff & Admin", "Utilities"
Example groupHints for a hotel: "Guest Rooms", "Public Areas", "F&B", "Back of House", "Administration"`;
  
  const response = await callFormulaAI(systemPrompt, userPrompt);
  
  // Filter out circulation/corridor areas for create intent
  // CREATE always uses blobs (ratio) - no counts conversion
  if (response.intent?.type === 'create_formula_program' && response.intent.areas) {
    const circulationPatterns = /\b(circulation|corridor|vertical\s*circulation|core|mep|lift\s*lobby|stair|elevator|shaft|duct|riser)\b/i;
    
    // Filter out circulation areas
    response.intent.areas = response.intent.areas.filter(area => {
      if (circulationPatterns.test(area.name)) {
        console.log(`[generateFormulaProgram] Filtered out circulation area: "${area.name}"`);
        return false;
      }
      return true;
    });
    
    // Clean embedded counts from names (e.g., "Queen Room ×60" → "Queen Room")
    // but keep as blob - don't convert to unit_based
    response.intent.areas.forEach(area => {
      const countMatch = area.name.match(/^(.+?)\s*[×x]\s*\d+$/i);
      if (countMatch) {
        const cleanName = countMatch[1].trim();
        console.log(`[generateFormulaProgram] Cleaned name: "${area.name}" → "${cleanName}" (keeping as blob)`);
        area.name = cleanName;
        // Keep ratio formula - don't convert to unit_based for Create
      }
    });
  }
  
  console.log(`[generateFormulaProgram] Returning response with ${response.intent?.type === 'create_formula_program' ? response.intent.areas?.length || 0 : 0} areas`);
  return response;
}

/**
 * Expand a specific area into sub-areas (single level, no recursion)
 * 
 * @param parentNode - Area to expand
 * @param detailLevel - Level of detail: 'abstract' (3-5 zones), 'typical' (4-8 areas), 'detailed' (8-15 specific areas)
 * @param context - Additional context from user
 */
export type ExpandDetailLevel = 'abstract' | 'typical' | 'detailed';

export async function expandArea(
  parentNode: AreaNode,
  detailLevel: ExpandDetailLevel | number = 'typical',
  context?: string
): Promise<FormulaAIResponse> {
  const parentArea = parentNode.areaPerUnit * parentNode.count;
  
  // Convert legacy numeric depth to detail level
  const level: ExpandDetailLevel = typeof detailLevel === 'number' 
    ? (detailLevel <= 1 ? 'abstract' : detailLevel >= 3 ? 'detailed' : 'typical')
    : detailLevel;
  
  console.log(`[expandArea] Expanding "${parentNode.name}" (${parentArea}m²) with level=${level}`);
  
  // Check if area is too small to meaningfully split
  const minSplitArea = MIN_AREA_THRESHOLDS.SPLIT_DEFAULT * 2;
  if (parentArea < minSplitArea) {
    console.log(`[expandArea] Area too small (${parentArea} < ${minSplitArea})`);
    return {
      message: `"${parentNode.name}" (${formatArea(parentArea)}) is too small to split meaningfully. Minimum splittable area is ~${minSplitArea} m².`,
      warnings: ['area_too_small'],
    };
  }
  
  const systemPrompt = buildExpandSystemPrompt(level);
  
  // Get scale-aware unfold guidance
  const scaleGuidance = getScaleUnfoldGuidance(parentArea);
  
  // Detail level adjusts HOW MANY items, scale determines WHAT TYPE of items
  const countGuidance = {
    abstract: '3-5',
    typical: '5-8',
    detailed: '8-12'
  };
  
  // At interior scale, use unit_based for repeatable rooms
  // At larger scales, use ratio formulas (blobs)
  const useUnitBased = scaleGuidance.currentScale === 'interior' && (level === 'typical' || level === 'detailed');
  
  let userPrompt = `Expand "${parentNode.name}" (${formatArea(parentArea)}) into sub-areas.

=== SCALE-AWARE UNFOLDING ===
Current scale: ${scaleGuidance.currentScale.toUpperCase()} (${formatArea(parentArea)})
Children should be: ${scaleGuidance.childrenType}
Target child size: ${formatArea(scaleGuidance.childSizeRange.min)} - ${formatArea(scaleGuidance.childSizeRange.max)}
${scaleGuidance.nextScale ? `Next unfold would produce: ${scaleGuidance.nextScale} scale items` : 'This is the finest grain level - produces atomic rooms/spaces'}

=== CONSTRAINTS ===
Generate ${countGuidance[level]} ${scaleGuidance.childrenType}.
Examples at this scale: ${scaleGuidance.examples.join(', ')}

CRITICAL: Do NOT jump to fine detail (individual rooms, apartments) from large-scale areas.
- 157,000 m² → districts/zones (10,000-50,000 m² each), NOT 800 apartments
- 50,000 m² → building plots/complexes (5,000-20,000 m² each)
- 10,000 m² → buildings/outdoor zones (500-3,000 m² each)
- 3,000 m² → floors/departments (100-500 m² each)
- 500 m² → individual rooms (10-100 m² each)

=== OUTPUT FORMAT ===
${useUnitBased ? `For REPEATABLE SPACES at interior scale: Use unit_based formula
{ "type": "unit_based", "areaPerUnit": 35, "unitCount": 10, "reasoning": "10 hotel rooms at 35m² each" }

For UNIQUE SPACES: Use ratio formula` : `Use ratio formulas with percentages that sum to 100%
{ "type": "ratio", "percentage": 25, "reasoning": "Main building plot" }`}

NEVER include circulation, corridors, vertical core, MEP spaces, or lift lobbies.

PARENT AREA: ${formatArea(parentArea)} (total budget)`;
  
  if (parentNode.userNote) {
    userPrompt += `\n\nNotes from brief: ${parentNode.userNote}`;
  }
  
  if (context) {
    userPrompt += `\n\nUser context: ${context}`;
  }
  
  const response = await callFormulaAI(systemPrompt, userPrompt);
  
  // Filter out circulation/corridor areas and parse embedded counts
  if (response.intent?.type === 'expand_area' && response.intent.children) {
    // Filter out circulation-type areas
    const circulationPatterns = /\b(circulation|corridor|vertical\s*circulation|core|mep|lift\s*lobby|stair|elevator|shaft|duct|riser)\b/i;
    response.intent.children = response.intent.children.filter(child => {
      if (circulationPatterns.test(child.name)) {
        console.log(`[expandArea] Filtered out circulation area: "${child.name}"`);
        return false;
      }
      return true;
    });
    
    // Parse embedded counts from names like "Queen Room ×60" or "Queen Room x60"
    // Only convert to unit_based on typical/detailed levels
    response.intent.children.forEach(child => {
      const countMatch = child.name.match(/^(.+?)\s*[×x]\s*(\d+)$/i);
      if (countMatch) {
        const cleanName = countMatch[1].trim();
        const embeddedCount = parseInt(countMatch[2], 10);
        
        console.log(`[expandArea] Parsed count from name: "${child.name}" → "${cleanName}" × ${embeddedCount}`);
        
        // Update name to clean version
        child.name = cleanName;
        
        // Only convert to unit_based on typical/detailed levels
        if (useUnitBased && child.formula.type === 'ratio') {
          const percentage = getFormulaPercentage(child.formula);
          const totalAreaForChild = (parentArea * percentage) / 100;
          const areaPerUnit = Math.round(totalAreaForChild / embeddedCount);
          
          // Convert to unit_based formula
          child.formula = {
            type: 'unit_based',
            areaPerUnit,
            unitCount: embeddedCount,
            reasoning: `${embeddedCount} ${cleanName} at ${areaPerUnit}m² each`,
          } as AreaFormula;
        }
      }
    });
    
    const children = response.intent.children;
    
    // Only normalize if we still have ratio-based areas
    const ratioChildren = children.filter(c => c.formula.type === 'ratio');
    if (ratioChildren.length > 0) {
      const totalPercentage = ratioChildren.reduce((sum, c) => {
        return sum + getFormulaPercentage(c.formula);
      }, 0);
      
      // If percentages don't sum to 100 and we have ratio formulas, normalize them
      if (totalPercentage > 0 && Math.abs(totalPercentage - 100) > 1) {
        console.log(`[expandArea] Normalizing percentages: ${totalPercentage}% → 100%`);
        const scaleFactor = 100 / totalPercentage;
        ratioChildren.forEach(c => {
          const currentPct = getFormulaPercentage(c.formula);
          setFormulaPercentage(c.formula, Math.round(currentPct * scaleFactor * 10) / 10);
        });
      }
    }
  }
  
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
4. Formulas should be "ratio" (percentages) that sum to EXACTLY 100%
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

function buildExpandSystemPrompt(level: ExpandDetailLevel): string {
  let prompt = FORMULA_SYSTEM_PROMPT;
  
  const itemCount = {
    abstract: '4-6',
    typical: '6-10',
    detailed: '12-20'
  };
  
  const useUnitBased = level === 'typical' || level === 'detailed';
  
  prompt += `\n\n=== EXPAND/UNFOLD MODE (${level.toUpperCase()}) ===
You are breaking down an existing zone/area into sub-spaces.

CRITICAL RULES:
1. Output MUST have "intent" with "type": "expand_area"
2. "children" array MUST contain ${itemCount[level]} areas
3. Each child MUST have "name" and "formula"
4. NEVER include circulation, corridors, vertical circulation, MEP, or core areas - we think at concept level only
${useUnitBased ? `
FORMULA TYPES TO USE (TYPICAL/DETAILED LEVELS):
- For REPEATABLE ROOMS (hotel rooms, offices, apartments): Use "unit_based" formula
  Example: { "type": "unit_based", "areaPerUnit": 35, "unitCount": 60, "reasoning": "60 queen rooms at 35m² each" }
- For UNIQUE SPACES (lobby, restaurant, spa): Use "ratio" formula with percentage
  Example: { "type": "ratio", "percentage": 15, "reasoning": "Main lobby and reception" }` : `
FORMULA TYPE (ABSTRACT LEVEL):
- Use ONLY "ratio" formulas with percentages that sum to EXACTLY 100%
- Do NOT use unit_based formulas at this level
  Example: { "type": "ratio", "percentage": 40, "reasoning": "Guest accommodation zone" }`}

DETAIL LEVEL: ${level.toUpperCase()}
${level === 'abstract' ? '- Generate broad functional ZONES as blobs - no counts' : ''}
${level === 'typical' ? '- Generate functional AREA TYPES - USE unit_based FOR REPEATABLE ROOMS' : ''}
${level === 'detailed' ? '- Generate at least 12 SPECIFIC ROOMS - MUST use unit_based for any room that repeats' : ''}

OUTPUT FORMAT:
{
  "message": "Breaking down [zone] into ${level} sub-areas...",
  "intent": {
    "type": "expand_area",
    "parentName": "[zone name]",
    "parentArea": [parent area in m²],
    "children": [
${useUnitBased ? `      { "name": "Standard Room", "formula": { "type": "unit_based", "areaPerUnit": 32, "unitCount": 50, "reasoning": "50 standard rooms" } },
      { "name": "Lobby", "formula": { "type": "ratio", "percentage": 10, "reasoning": "Main lobby area" } }` : `      { "name": "Guest Wing", "formula": { "type": "ratio", "percentage": 50, "reasoning": "Main accommodation zone" } },
      { "name": "Public Zone", "formula": { "type": "ratio", "percentage": 30, "reasoning": "Lobby, F&B, amenities" } }`}
    ]
  }
}`;
  
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
 * Extended area spec that accepts both AI formats:
 * - Old format: { name, formula, groupHint }
 * - New format: { name, totalArea, count?, groupHint }
 */
interface AIAreaSpec {
  name: string;
  formula?: AreaFormula;
  totalArea?: number;
  count?: number;
  groupHint?: string;
}

/**
 * Normalize AI area spec to FormulaAreaSpec
 * Handles both old formula format and new totalArea format
 */
function normalizeAreaSpec(spec: AIAreaSpec, _targetTotal: number): FormulaAreaSpec {
  // If already has formula, return as-is
  if (spec.formula) {
    return {
      name: spec.name,
      formula: spec.formula,
      groupHint: spec.groupHint,
    };
  }
  
  // Convert totalArea format to fixed formula
  const totalAreaValue = spec.totalArea || 0;
  const count = spec.count || 1;
  const areaPerUnit = Math.round(totalAreaValue / count);
  
  return {
    name: spec.name,
    formula: {
      type: 'fixed',
      value: areaPerUnit,
      count: count,
      reasoning: `${totalAreaValue}m² total${count > 1 ? ` (${count} × ${areaPerUnit}m²)` : ''}`,
      source: { type: 'ai' },
    },
    groupHint: spec.groupHint,
  };
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
  areas: FormulaAreaSpec[] | AIAreaSpec[],
  totalArea: number
): EvaluatedArea[] {
  // Normalize all areas to FormulaAreaSpec format
  const normalizedAreas = (areas as AIAreaSpec[]).map(spec => normalizeAreaSpec(spec, totalArea));
  
  const results: Map<string, EvaluatedArea> = new Map();
  let remainderName: string | null = null;
  const derivedAreas: Array<{ spec: FormulaAreaSpec; index: number }> = [];
  
  // PASS 1: Evaluate independent formulas (fixed, unit_based, ratio, fallback)
  for (let i = 0; i < normalizedAreas.length; i++) {
    const area = normalizedAreas[i];
    const formula = area.formula;
    
    let totalAreaComputed = 0;
    let areaPerUnit = 0;
    let count = 1;
    let skip = false;
    
    switch (formula.type) {
      case 'ratio': {
        // AI might return 'percentage' (0-100) instead of 'ratio' (0-1)
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
    const remainderSpec = normalizedAreas.find(a => a.name === remainderName)!;
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

// ============================================
// AGENT PROMPT CLASSIFICATION
// ============================================

export type AgentIntentType = 'create' | 'unfold' | 'organize' | 'unsupported';

export interface AgentIntentClassification {
  type: AgentIntentType;
  confidence: number;
  details?: string;
}

/**
 * Classify user prompt into one of the supported agent actions:
 * - create: Generate a new program with groups/areas for a typology
 * - unfold: Expand a single selected area into sub-areas
 * - organize: Group/cluster multiple areas into logical groups
 * - unsupported: Prompt doesn't match any supported action
 */
export function classifyAgentIntent(
  prompt: string,
  hasSelectedAreas: boolean,
  selectedCount: number
): AgentIntentClassification {
  const lower = prompt.toLowerCase();
  
  // CREATE patterns: generate a new program
  const createPatterns = [
    /\b(create|generate|make|design|plan)\b.*\b(program|brief|layout|building|hotel|office|apartment|residential|commercial|school|hospital|museum|library|retail|restaurant|warehouse|factory)\b/i,
    /\b(program|brief)\b.*\b(for|of)\b/i,
    /\b\d[\d,]*\s*(?:sqm|m²|m2|square)/i, // Has area specification
  ];
  
  // UNFOLD patterns: expand/divide a single area
  const unfoldPatterns = [
    /\b(unfold|expand|divide|grain|break\s*down|detail|sub-?divide|elaborate|split\s*into)\b/i,
  ];
  
  // ORGANIZE patterns: group/cluster multiple areas
  const organizePatterns = [
    /\b(group|organize|cluster|categorize|sort|arrange)\b.*\b(areas?|spaces?|rooms?)\b/i,
    /\b(areas?|spaces?|rooms?)\b.*\b(by|into)\b.*\b(function|type|category|zone|public|private)\b/i,
    /\b(re-?organize|re-?group|re-?cluster)\b/i,
  ];
  
  // Check UNFOLD first (needs selection)
  if (unfoldPatterns.some(p => p.test(lower))) {
    if (!hasSelectedAreas) {
      return {
        type: 'unsupported',
        confidence: 0.9,
        details: 'Unfold requires selecting an area first. Please select one area to expand.'
      };
    }
    if (selectedCount > 1) {
      return {
        type: 'unsupported',
        confidence: 0.9,
        details: 'Unfold works on one area at a time. Please select a single area to expand.'
      };
    }
    return { type: 'unfold', confidence: 0.95 };
  }
  
  // Check ORGANIZE (works best with multiple selections)
  if (organizePatterns.some(p => p.test(lower))) {
    if (!hasSelectedAreas || selectedCount < 2) {
      return {
        type: 'unsupported',
        confidence: 0.9,
        details: 'Organize requires selecting multiple areas. Please select 2+ areas to group.'
      };
    }
    return { type: 'organize', confidence: 0.9 };
  }
  
  // Check CREATE (no selection needed)
  if (createPatterns.some(p => p.test(lower))) {
    return { type: 'create', confidence: 0.9 };
  }
  
  // Fallback: if has typology keywords without action, assume create
  const typologyKeywords = /\b(hotel|office|apartment|residential|commercial|school|hospital|museum|library|retail|restaurant|warehouse|factory|building|facility|center|centre)\b/i;
  if (typologyKeywords.test(lower)) {
    return { type: 'create', confidence: 0.7 };
  }
  
  return {
    type: 'unsupported',
    confidence: 0.8,
    details: 'I can help you **Create** a program, **Unfold** an area, or **Organize** areas into groups. Try:\n• "Create a hotel program of 5000 sqm"\n• Select an area and say "unfold with focus on..."\n• Select multiple areas and say "organize by function"'
  };
}

// ============================================
// ORGANIZE AREAS INTO GROUPS
// ============================================

export interface OrganizeAreasIntent {
  type: 'organize_areas';
  groups: Array<{
    name: string;
    reasoning: string;
    areaIds: string[];
  }>;
}

export interface OrganizeAIResponse {
  message: string;
  intent?: OrganizeAreasIntent;
  warnings?: string[];
}

/**
 * Organize multiple areas into logical groups based on user criteria
 */
export async function organizeAreas(
  areas: AreaNode[],
  criteria?: string
): Promise<OrganizeAIResponse> {
  if (areas.length < 2) {
    return {
      message: 'Please select at least 2 areas to organize into groups.',
      warnings: ['insufficient_selection'],
    };
  }
  
  const systemPrompt = `You are an architectural programming assistant. Your task is to organize areas into logical groups.

RULES:
- Never include circulation, core, MEP, lifts, or staircases
- Focus on creative architectural organization, not technical considerations
- Group by logical relationships: function, privacy level, access patterns, or user-specified criteria
- Each area must belong to exactly one group
- Provide clear reasoning for each group

OUTPUT FORMAT (JSON only):
{
  "message": "Brief description of the organization strategy",
  "intent": {
    "type": "organize_areas",
    "groups": [
      {
        "name": "Group Name",
        "reasoning": "Why these areas belong together",
        "areaIds": ["id1", "id2"]
      }
    ]
  }
}`;

  const areaList = areas.map(a => `- ID: "${a.id}" | Name: "${a.name}" | ${formatArea(a.areaPerUnit * a.count)}`).join('\n');
  
  let userPrompt = `Organize these areas into groups:\n\n${areaList}`;
  
  if (criteria) {
    userPrompt += `\n\nOrganization criteria: ${criteria}`;
  } else {
    userPrompt += `\n\nOrganize by logical function and relationship.`;
  }
  
  try {
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
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('Empty response from AI');
    }
    
    const parsed = JSON.parse(content) as OrganizeAIResponse;
    return parsed;
    
  } catch (error) {
    console.error('[organizeAreas] Error:', error);
    return {
      message: 'Failed to organize areas. Please try again.',
      warnings: ['api_error'],
    };
  }
}

/**
 * Convert organize intent to proposals
 * Creates a single CreateGroupsProposal with all the groups
 */
export function organizeIntentToProposals(
  response: OrganizeAIResponse,
  originalAreas: AreaNode[]
): Proposal[] {
  if (!response.intent || response.intent.type !== 'organize_areas') {
    return [];
  }
  
  // Build groups array for CreateGroupsProposal
  const groupsData: Array<{
    name: string;
    color: string;
    memberNodeIds: string[];
    memberNames: string[];
  }> = [];
  
  // Color palette for groups
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  
  for (let i = 0; i < response.intent.groups.length; i++) {
    const group = response.intent.groups[i];
    
    // Find the actual area nodes for this group
    const groupAreas = group.areaIds
      .map(id => originalAreas.find(a => a.id === id))
      .filter((a): a is AreaNode => a !== undefined);
    
    if (groupAreas.length === 0) continue;
    
    groupsData.push({
      name: group.name,
      color: colors[i % colors.length],
      memberNodeIds: groupAreas.map(a => a.id!),
      memberNames: groupAreas.map(a => a.name),
    });
  }
  
  if (groupsData.length === 0) {
    return [];
  }
  
  // Return a single CreateGroupsProposal
  return [{
    id: uuidv4(),
    type: 'create_groups',
    status: 'pending',
    groups: groupsData,
  }];
}
