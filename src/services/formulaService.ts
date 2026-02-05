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
 * Generate initial program from brief
 */
export async function generateFormulaProgram(
  briefText: string,
  totalArea?: number
): Promise<FormulaAIResponse> {
  const systemPrompt = buildSystemPrompt('create');
  
  let userPrompt = briefText;
  if (totalArea) {
    userPrompt = `Total area: ${formatArea(totalArea)}\n\n${briefText}`;
  }
  
  return callFormulaAI(systemPrompt, userPrompt);
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
  
  // Check if area is too small to meaningfully split (need at least 10m² to split into 2 parts)
  const minSplitArea = MIN_AREA_THRESHOLDS.SPLIT_DEFAULT * 2;
  if (parentArea < minSplitArea) {
    return {
      message: `"${parentNode.name}" (${formatArea(parentArea)}) is too small to split meaningfully. Minimum splittable area is ~${minSplitArea} m².`,
      warnings: ['area_too_small'],
    };
  }
  
  const systemPrompt = buildSystemPrompt('expand', depth);
  
  let userPrompt = `Expand/breakdown "${parentNode.name}" (${formatArea(parentArea)}) into sub-areas.`;
  
  if (parentNode.userNote) {
    userPrompt += `\n\nNotes from brief: ${parentNode.userNote}`;
  }
  
  if (context) {
    userPrompt += `\n\nAdditional context: ${context}`;
  }
  
  // Scale analysis to guide AI
  const scaleAnalysis = analyzeScale(parentArea);
  if (scaleAnalysis.detectedScale) {
    userPrompt += `\n\nDetected scale: ${scaleAnalysis.detectedScale}`;
  }
  
  return callFormulaAI(systemPrompt, userPrompt);
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
    prompt += `\n\nEXPAND MODE:
You are breaking down an existing area into sub-areas.
- Depth requested: ${depth} level(s)
- Output should be an "expand_area" intent
- Each sub-area needs a formula relative to the parent
- If depth > 1, include nested children recursively

Output format for expand:
{
  "message": "Breaking down [area name]...",
  "detected_scale": "...",
  "intent": {
    "type": "expand_area",
    "parentName": "...",
    "parentArea": <number>,
    "children": [
      { "name": "...", "formula": {...}, "groupHint": "..." }
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
      case 'ratio':
        totalAreaComputed = totalArea * formula.ratio;
        areaPerUnit = Math.round(totalAreaComputed);
        count = 1;
        break;
        
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
    
    // Apply floor/cap if specified
    if (remainderFormula.type === 'remainder') {
      if (remainderFormula.floor && remainderArea < remainderFormula.floor) {
        remainderArea = remainderFormula.floor;
      }
      if (remainderFormula.cap && remainderArea > remainderFormula.cap) {
        remainderArea = remainderFormula.cap;
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
  
  const createProposal: CreateAreasProposal = {
    id: uuidv4(),
    type: 'create_areas',
    status: 'pending',
    areas: evaluated.map(e => ({
      name: e.name,
      areaPerUnit: Math.round(e.areaPerUnit),  // Use per-unit area, not total
      count: e.count,                           // Preserve unit count from formula
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
