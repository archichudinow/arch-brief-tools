/**
 * Formula-Based AI - Type Definitions for POC Testing
 * 
 * These are the exact types we expect from AI responses.
 * Use these for validation in tests.
 */

// ============================================
// FORMULA TYPES (Complete & Validated)
// ============================================

export interface FormulaConfidence {
  level: number;           // 0-1
  factors: string[];       // What influenced confidence
}

export interface FormulaSource {
  type: 'brief' | 'user' | 'ai' | 'standard' | 'typology';
  excerpt?: string;
}

// Formula 1: Ratio
export interface RatioFormula {
  type: 'ratio';
  reference: 'parent' | 'total' | 'sibling_sum' | string;  // string = UUID
  ratio: number;               // 0-1 normalized
  reasoning: string;
  source?: FormulaSource;
  confidence?: FormulaConfidence;
}

// Formula 2: Unit-Based
export interface UnitFormula {
  type: 'unit_based';
  areaPerUnit: number;
  unitCount: number;
  multiplier?: number;
  reasoning: string;
  unitSizeReference?: {
    type: 'standard' | 'typology' | 'brief' | 'calculated';
    value: string;
  };
  confidence?: FormulaConfidence;
}

// Formula 3: Remainder
export interface RemainderFormula {
  type: 'remainder';
  parentRef: 'parent' | 'total' | string;
  excludeSiblings?: string[];
  cap?: number;
  floor?: number;
  reasoning: string;
  confidence?: FormulaConfidence;
}

// Formula 4: Fixed
export interface FixedFormula {
  type: 'fixed';
  value: number;
  count?: number;
  reasoning: string;
  source: FormulaSource;
  locked?: boolean;
}

// Formula 5: Derived
export interface DerivedFormula {
  type: 'derived';
  sourceNodeId: string;
  operation: 'ratio' | 'offset' | 'copy';
  value: number;
  reasoning: string;
  confidence?: FormulaConfidence;
}

// Formula 6: Fallback (for uncertainty)
export interface FallbackFormula {
  type: 'fallback';
  method: 'equal_share' | 'typology_guess' | 'minimum_viable';
  knownFactors: string[];
  missingInfo: string[];
  suggestedRatio?: number;
  minimumArea?: number;
  reasoning: string;
  confidence: FormulaConfidence;  // Required, should be low
  userPrompts?: string[];
}

export type AreaFormula = 
  | RatioFormula 
  | UnitFormula 
  | RemainderFormula 
  | FixedFormula
  | DerivedFormula
  | FallbackFormula;

// ============================================
// SCALE TYPES
// ============================================

export type ProjectScale = 
  | 'interior'      // 10-2,000 m²
  | 'architecture'  // 100-100,000 m²
  | 'landscape'     // 1K-500K m²
  | 'masterplan'    // 10K-5M m²
  | 'urban';        // 100K-100M m²

// ============================================
// AI RESPONSE TYPES
// ============================================

export interface AreaWithFormula {
  name: string;
  formula: AreaFormula;
  groupHint?: string;
  constraints?: AreaConstraint[];
}

export interface AreaConstraint {
  kind: 'minimum' | 'maximum' | 'ratio_to_sibling' | 'ratio_to_parent' | 'equal_to';
  value?: number;
  ratio?: number;
  siblingId?: string;
  targetId?: string;
  reasoning: string;
}

// Intent when creating a program
export interface CreateFormulaProgramIntent {
  type: 'create_formula_program';
  targetTotal: number;
  areas: AreaWithFormula[];
}

// Clarification option when scale mismatch detected
export interface ClarificationOption {
  label: string;
  area: number;
  scale: ProjectScale;
  interpretation?: string;
}

// Full AI Response
export interface FormulaAIResponse {
  message: string;
  detected_scale?: ProjectScale;
  
  // Either intent OR clarification
  intent?: CreateFormulaProgramIntent;
  
  // When clarification needed
  clarification_needed?: boolean;
  expected_scale?: ProjectScale;
  options?: ClarificationOption[];
}

// ============================================
// VALIDATION HELPERS
// ============================================

export function isValidFormula(formula: unknown): formula is AreaFormula {
  if (!formula || typeof formula !== 'object') return false;
  const f = formula as Record<string, unknown>;
  
  if (!f.type || typeof f.type !== 'string') return false;
  if (!f.reasoning || typeof f.reasoning !== 'string') return false;
  
  switch (f.type) {
    case 'ratio':
      return typeof f.ratio === 'number' && f.ratio >= 0 && f.ratio <= 1;
    case 'unit_based':
      return typeof f.areaPerUnit === 'number' && typeof f.unitCount === 'number';
    case 'remainder':
      return typeof f.parentRef === 'string';
    case 'fixed':
      return typeof f.value === 'number' && f.source !== undefined;
    case 'derived':
      return typeof f.sourceNodeId === 'string' && typeof f.operation === 'string';
    case 'fallback':
      return typeof f.method === 'string' && Array.isArray(f.missingInfo);
    default:
      return false;
  }
}

export function isValidResponse(response: unknown): response is FormulaAIResponse {
  if (!response || typeof response !== 'object') return false;
  const r = response as Record<string, unknown>;
  
  // Must have message
  if (typeof r.message !== 'string') return false;
  
  // Must have either intent or clarification
  if (!r.intent && !r.clarification_needed) return false;
  
  // If has intent, validate it
  if (r.intent) {
    const intent = r.intent as Record<string, unknown>;
    if (intent.type !== 'create_formula_program') return false;
    if (typeof intent.targetTotal !== 'number') return false;
    if (!Array.isArray(intent.areas)) return false;
    
    // Validate each area
    for (const area of intent.areas as unknown[]) {
      if (!area || typeof area !== 'object') return false;
      const a = area as Record<string, unknown>;
      if (typeof a.name !== 'string') return false;
      if (!isValidFormula(a.formula)) return false;
    }
  }
  
  // If clarification, must have options
  if (r.clarification_needed && !Array.isArray(r.options)) return false;
  
  return true;
}

// ============================================
// SCALE VALIDATION
// ============================================

export const SCALE_RANGES: Record<ProjectScale, { min: number; max: number }> = {
  interior: { min: 10, max: 2_000 },
  architecture: { min: 100, max: 100_000 },
  landscape: { min: 1_000, max: 500_000 },
  masterplan: { min: 10_000, max: 5_000_000 },
  urban: { min: 100_000, max: 100_000_000 },
};

export function detectExpectedScale(area: number): ProjectScale {
  if (area <= SCALE_RANGES.interior.max) return 'interior';
  if (area <= SCALE_RANGES.architecture.max) return 'architecture';
  if (area <= SCALE_RANGES.landscape.max) return 'landscape';
  if (area <= SCALE_RANGES.masterplan.max) return 'masterplan';
  return 'urban';
}

export function isScaleAppropriate(area: number, declaredScale: ProjectScale): boolean {
  const range = SCALE_RANGES[declaredScale];
  return area >= range.min && area <= range.max;
}

// ============================================
// TYPOLOGY VALIDATION
// ============================================

export const TYPOLOGY_RANGES: Record<string, { min: number; max: number; typical: number }> = {
  'hotel': { min: 3_000, max: 50_000, typical: 15_000 },
  'hotel_resort': { min: 30_000, max: 500_000, typical: 100_000 },
  'office': { min: 2_000, max: 50_000, typical: 10_000 },
  'office_tower': { min: 20_000, max: 200_000, typical: 50_000 },
  'apartment': { min: 30, max: 300, typical: 80 },
  'apartment_building': { min: 500, max: 20_000, typical: 3_000 },
  'shopping_mall': { min: 10_000, max: 300_000, typical: 50_000 },
  'hospital': { min: 10_000, max: 200_000, typical: 50_000 },
  'school': { min: 2_000, max: 20_000, typical: 8_000 },
};

export function isSizeReasonableForTypology(
  area: number, 
  typology: string
): { reasonable: boolean; ratio?: number; message?: string } {
  const key = typology.toLowerCase().replace(/[^a-z_]/g, '_');
  const range = TYPOLOGY_RANGES[key];
  
  if (!range) {
    return { reasonable: true, message: 'Unknown typology' };
  }
  
  if (area > range.max) {
    const ratio = area / range.max;
    return { 
      reasonable: ratio < 3,  // Up to 3x might be a large example
      ratio,
      message: ratio > 10 
        ? `Area is ${ratio.toFixed(0)}x larger than typical max - likely scale mismatch`
        : `Area is ${ratio.toFixed(1)}x larger than typical max`
    };
  }
  
  if (area < range.min) {
    return { reasonable: false, message: `Area is smaller than typical minimum (${range.min} m²)` };
  }
  
  return { reasonable: true };
}
