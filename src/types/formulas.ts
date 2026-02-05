/**
 * Formula Types - Declarative area specifications
 * 
 * AI outputs formulas with reasoning, code evaluates them deterministically.
 * Every computed value is traceable back to its formula and inputs.
 */

import type { UUID, Timestamp } from './project';

// ============================================
// GLOBAL CONSTANTS
// ============================================

/**
 * Minimum area thresholds - areas below these are considered "atomic"
 * and cannot be meaningfully split further
 */
export const MIN_AREA_THRESHOLDS = {
  /** Absolute minimum for any space (closet/alcove) */
  ABSOLUTE_MIN: 2,
  /** Minimum for a functional room */
  FUNCTIONAL_ROOM: 6,
  /** Minimum for office/workspace */
  WORKSPACE: 8,
  /** Minimum for meeting space */
  MEETING: 10,
  /** Default minimum when splitting */
  SPLIT_DEFAULT: 5,
} as const;

/**
 * Confidence thresholds for AI formulas
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Below this, formula is considered a guess */
  LOW: 0.4,
  /** Above this, formula is considered reliable */
  HIGH: 0.75,
  /** Minimum acceptable for auto-execution */
  AUTO_EXECUTE: 0.6,
} as const;

// ============================================
// SCALE & TYPOLOGY DEFINITIONS
// ============================================

/**
 * Project scales - determines appropriate level of detail and typical ranges
 */
export type ProjectScale = 
  | 'interior'      // Rooms, zones within a building (10s-100s m²)
  | 'architecture'  // Single building (100s-50,000 m²)
  | 'landscape'     // Site with outdoor + building(s) (1,000s-200,000 m²)
  | 'masterplan'    // District, multiple buildings (10,000s-2,000,000 m²)
  | 'urban';        // City area, neighborhoods (100,000s-10,000,000+ m²)

/**
 * Scale definitions with typical size ranges
 */
export const SCALE_RANGES: Record<ProjectScale, { min: number; max: number; typical: string; unitBreakdown: string }> = {
  interior: {
    min: 10,
    max: 2_000,
    typical: '50-500 m²',
    unitBreakdown: 'rooms, zones, furniture layouts',
  },
  architecture: {
    min: 100,
    max: 100_000,
    typical: '500-20,000 m²',
    unitBreakdown: 'floors, departments, functional zones',
  },
  landscape: {
    min: 1_000,
    max: 500_000,
    typical: '2,000-50,000 m²',
    unitBreakdown: 'buildings, outdoor zones, parking, landscape areas',
  },
  masterplan: {
    min: 10_000,
    max: 5_000_000,
    typical: '50,000-500,000 m²',
    unitBreakdown: 'building plots, streets, public spaces, districts',
  },
  urban: {
    min: 100_000,
    max: 100_000_000,
    typical: '500,000-5,000,000 m²',
    unitBreakdown: 'neighborhoods, zones, infrastructure corridors',
  },
} as const;

/**
 * Building typology size ranges (for architecture scale)
 * Used to detect scale mismatches
 */
export const TYPOLOGY_SIZE_RANGES: Record<string, { 
  min: number; 
  max: number; 
  typical: number;
  description: string;
}> = {
  // Residential
  'apartment': { min: 30, max: 300, typical: 80, description: 'Single apartment unit' },
  'house': { min: 80, max: 800, typical: 200, description: 'Single family house' },
  'apartment_building': { min: 500, max: 20_000, typical: 3_000, description: 'Multi-unit residential' },
  'residential_tower': { min: 5_000, max: 50_000, typical: 15_000, description: 'High-rise residential' },
  
  // Hospitality
  'hotel_boutique': { min: 500, max: 5_000, typical: 2_000, description: 'Boutique hotel (10-50 rooms)' },
  'hotel': { min: 3_000, max: 50_000, typical: 15_000, description: 'Standard hotel (50-300 rooms)' },
  'hotel_large': { min: 20_000, max: 150_000, typical: 50_000, description: 'Large hotel/resort (300+ rooms)' },
  'hotel_resort': { min: 30_000, max: 500_000, typical: 100_000, description: 'Resort complex (includes grounds)' },
  
  // Commercial
  'retail_shop': { min: 50, max: 500, typical: 150, description: 'Single retail unit' },
  'retail_building': { min: 1_000, max: 20_000, typical: 5_000, description: 'Retail building/mall floor' },
  'shopping_mall': { min: 10_000, max: 300_000, typical: 50_000, description: 'Shopping center' },
  
  // Office
  'office_small': { min: 100, max: 1_000, typical: 300, description: 'Small office suite' },
  'office_floor': { min: 500, max: 3_000, typical: 1_500, description: 'Office floor plate' },
  'office_building': { min: 2_000, max: 50_000, typical: 10_000, description: 'Office building' },
  'office_tower': { min: 20_000, max: 200_000, typical: 50_000, description: 'Office tower' },
  
  // Institutional
  'school': { min: 2_000, max: 20_000, typical: 8_000, description: 'Primary/secondary school' },
  'university_building': { min: 5_000, max: 50_000, typical: 15_000, description: 'University building' },
  'hospital': { min: 10_000, max: 200_000, typical: 50_000, description: 'Hospital' },
  'clinic': { min: 500, max: 5_000, typical: 2_000, description: 'Medical clinic' },
  
  // Cultural
  'museum': { min: 2_000, max: 100_000, typical: 15_000, description: 'Museum' },
  'theater': { min: 1_000, max: 20_000, typical: 5_000, description: 'Theater/performance venue' },
  'library': { min: 500, max: 30_000, typical: 5_000, description: 'Library' },
  
  // Industrial
  'warehouse': { min: 1_000, max: 100_000, typical: 10_000, description: 'Warehouse' },
  'factory': { min: 2_000, max: 200_000, typical: 20_000, description: 'Manufacturing facility' },
  
  // Mixed
  'mixed_use': { min: 5_000, max: 200_000, typical: 30_000, description: 'Mixed-use building' },
} as const;

/**
 * Result of scale analysis
 */
export interface ScaleAnalysis {
  /** Detected or inferred scale */
  detectedScale: ProjectScale;
  /** Confidence in scale detection */
  confidence: number;
  /** Is the size within expected range for detected typology? */
  sizeWithinRange: boolean;
  /** If size is out of range, what might the user have meant? */
  possibleInterpretations?: ScaleInterpretation[];
  /** Warnings about the input */
  warnings: string[];
}

export interface ScaleInterpretation {
  /** What the user might have meant */
  interpretation: string;
  /** Suggested corrected area */
  suggestedArea?: number;
  /** Scale this would fall under */
  scale: ProjectScale;
  /** How to phrase in a clarification question */
  clarificationPrompt: string;
}

// ============================================
// BASE FORMULA TYPES
// ============================================

/**
 * Reference target for ratio/remainder formulas
 */
export type FormulaReference = 
  | 'parent'      // Parent node's total area
  | 'total'       // Root total (entire project)
  | 'sibling_sum' // Sum of all siblings
  | UUID;         // Specific node by ID

/**
 * Confidence level for AI-generated formulas
 */
export interface FormulaConfidence {
  level: number;           // 0-1, how certain AI is
  factors: string[];       // What influenced confidence
}

/**
 * Source tracking for traceability
 */
export interface FormulaSource {
  type: 'brief' | 'user' | 'ai' | 'standard' | 'typology';
  excerpt?: string;        // Relevant text from source
  reference?: string;      // Standard/typology name if applicable
}

// ============================================
// FORMULA VARIANTS
// ============================================

/**
 * Ratio Formula - Area as percentage of a reference
 * Example: "Lobby = 5% of total building area"
 */
export interface RatioFormula {
  type: 'ratio';
  reference: FormulaReference;
  ratio: number;               // 0-1 (will be normalized by engine)
  reasoning: string;           // AI's explanation for this ratio
  source?: FormulaSource;
  confidence?: FormulaConfidence;
}

/**
 * Unit-Based Formula - Area = unit size × count × multiplier
 * Example: "200 guest rooms at 35m² each"
 */
export interface UnitFormula {
  type: 'unit_based';
  areaPerUnit: number;         // Base unit size in m²
  unitCount: number;           // Number of units
  multiplier?: number;         // Optional adjustment factor (default 1.0)
  reasoning: string;
  source?: FormulaSource;
  confidence?: FormulaConfidence;
  unitSizeReference?: {
    type: 'standard' | 'typology' | 'brief' | 'calculated';
    value: string;             // e.g., "hotel_standard_room" or "35m² from brief"
  };
}

/**
 * Remainder Formula - Area = parent - sum(siblings)
 * Example: "Circulation = remaining after all program areas"
 */
export interface RemainderFormula {
  type: 'remainder';
  parentRef: FormulaReference;
  excludeSiblings?: UUID[];    // Specific siblings to subtract (default: all)
  cap?: number;                // Maximum area allowed
  floor?: number;              // Minimum area required
  reasoning: string;
  confidence?: FormulaConfidence;
}

/**
 * Fixed Formula - Explicit value (from brief or user)
 * Example: "Parking must be exactly 2000m² per zoning"
 */
export interface FixedFormula {
  type: 'fixed';
  value: number;               // Fixed area in m²
  count?: number;              // Unit count (default 1)
  reasoning: string;
  source: FormulaSource;
  locked?: boolean;            // Prevent AI from modifying
}

/**
 * Derived Formula - Calculated from another node's value
 * Example: "Kitchen = 25% of Restaurant area"
 */
export interface DerivedFormula {
  type: 'derived';
  sourceNodeId: UUID;          // Node to derive from
  operation: 'ratio' | 'offset' | 'copy';
  value: number;               // Ratio (0-1) or offset in m²
  reasoning: string;
  confidence?: FormulaConfidence;
}

/**
 * Distributed Formula - Fair share of remaining space
 * Example: "Divide remaining equally among meeting rooms"
 */
export interface DistributedFormula {
  type: 'distributed';
  poolRef: FormulaReference;   // What to distribute
  shareCount: number;          // This node's share count
  totalShares: number;         // Total shares in pool
  reasoning: string;
  confidence?: FormulaConfidence;
}

/**
 * Fallback Formula - Best-guess when AI lacks sufficient information
 * Used when:
 * - Brief is vague or incomplete
 * - No typology data available
 * - Area type is unfamiliar
 * 
 * This makes uncertainty EXPLICIT rather than hidden in fake confidence
 */
export interface FallbackFormula {
  type: 'fallback';
  method: 'equal_share' | 'typology_guess' | 'minimum_viable';
  /** What we know (even if incomplete) */
  knownFactors: string[];
  /** What's missing that forced the fallback */
  missingInfo: string[];
  /** Best-effort ratio (will be normalized with siblings) */
  suggestedRatio?: number;
  /** Minimum area if method is 'minimum_viable' */
  minimumArea?: number;
  reasoning: string;
  /** Fallback formulas should have low confidence */
  confidence: FormulaConfidence;
  /** Suggestions for user to provide more info */
  userPrompts?: string[];
}

/**
 * Union of all formula types
 */
export type AreaFormula = 
  | RatioFormula 
  | UnitFormula 
  | RemainderFormula 
  | FixedFormula
  | DerivedFormula
  | DistributedFormula
  | FallbackFormula;

// ============================================
// CONSTRAINTS
// ============================================

/**
 * Constraint that must be satisfied
 */
export type AreaConstraint = 
  | { kind: 'minimum'; value: number; reasoning: string }
  | { kind: 'maximum'; value: number; reasoning: string }
  | { kind: 'ratio_to_sibling'; siblingId: UUID; ratio: number; tolerance?: number; reasoning: string }
  | { kind: 'ratio_to_parent'; ratio: number; tolerance?: number; reasoning: string }
  | { kind: 'equal_to'; targetId: UUID; reasoning: string }
  | { kind: 'sum_with_siblings_equals_parent'; reasoning: string };

export interface ConstraintViolation {
  constraint: AreaConstraint;
  nodeId: UUID;
  nodeName: string;
  expected: number;
  actual: number;
  severity: 'error' | 'warning';
  autoFixable: boolean;
}

// ============================================
// EVALUATION RESULTS
// ============================================

/**
 * Input that went into a formula evaluation
 */
export interface FormulaInput {
  name: string;              // e.g., "parent.totalArea", "total", "sibling[lobby].area"
  value: number;
  sourceId?: UUID;           // Which node it came from
  sourceFormula?: string;    // Brief description of source's formula
}

/**
 * Adjustment made during evaluation
 */
export interface EvaluationAdjustment {
  type: 'rounding' | 'constraint_min' | 'constraint_max' | 'constraint_ratio' | 'distribution_balance';
  originalValue: number;
  adjustedValue: number;
  reason: string;
  constraintRef?: AreaConstraint;
}

/**
 * Full trace of how a value was computed
 */
export interface ComputedValue {
  areaPerUnit: number;
  count: number;
  totalArea: number;
  
  // Traceability
  evaluatedAt: Timestamp;
  inputs: FormulaInput[];
  adjustments: EvaluationAdjustment[];
  
  // Formula that produced this
  formula: AreaFormula;
  formulaDescription: string;  // Human-readable: "35m² × 200 rooms"
}

/**
 * Result of evaluating entire formula tree
 */
export interface TreeEvaluationResult {
  success: boolean;
  computedValues: Record<UUID, ComputedValue>;
  totalArea: number;
  violations: ConstraintViolation[];
  warnings: string[];
  
  // Hierarchy validation
  hierarchyValid: boolean;
  hierarchyErrors: Array<{
    parentId: UUID;
    parentTotal: number;
    childrenSum: number;
    difference: number;
  }>;
}

// ============================================
// FORMULA NODE (Enhanced AreaNode)
// ============================================

/**
 * Area node with formula-based definition
 * Extends the existing AreaNode concept with formulas
 */
export interface FormulaAreaNode {
  id: UUID;
  name: string;
  
  // The formula that defines this area
  formula: AreaFormula;
  
  // Optional constraints
  constraints?: AreaConstraint[];
  
  // Hierarchy (for tree structure)
  parentId?: UUID;
  childIds: UUID[];
  
  // Grouping hint (for auto-grouping)
  groupHint?: string;
  
  // Metadata
  createdAt: Timestamp;
  modifiedAt: Timestamp;
  createdBy: 'user' | 'ai';
  
  // Computed values (populated by engine)
  computed?: ComputedValue;
}

// ============================================
// AI OUTPUT TYPES (What LLM produces)
// ============================================

/**
 * Area definition from AI (formula + metadata)
 */
export interface AIAreaWithFormula {
  name: string;
  formula: AreaFormula;
  groupHint?: string;
  constraints?: AreaConstraint[];
}

/**
 * Intent to create a program using formulas
 */
export interface CreateFormulaProgram {
  type: 'create_formula_program';
  targetTotal: number;
  areas: AIAreaWithFormula[];
  message?: string;
}

/**
 * Intent to split an area using formulas
 */
export interface SplitWithFormulas {
  type: 'split_with_formulas';
  sourceNodeId: UUID;
  sourceName: string;
  splits: AIAreaWithFormula[];
  groupName?: string;
  groupColor?: string;
  message?: string;
}

/**
 * Union of formula-based intents
 */
export type FormulaIntent = 
  | CreateFormulaProgram 
  | SplitWithFormulas;

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Options for formula evaluation
 */
export interface EvaluationOptions {
  /** Whether to auto-fix constraint violations */
  autoFixConstraints?: boolean;
  
  /** Maximum iterations for constraint solving */
  maxIterations?: number;
  
  /** Tolerance for rounding (default: 1m²) */
  roundingTolerance?: number;
  
  /** Which node absorbs rounding errors */
  roundingAbsorber?: 'largest' | 'remainder' | UUID;
}

/**
 * Summary of formula-based program
 */
export interface FormulaProgramSummary {
  totalArea: number;
  areaCount: number;
  formulaTypes: Record<AreaFormula['type'], number>;
  averageConfidence: number;
  constraintCount: number;
  violationCount: number;
}
