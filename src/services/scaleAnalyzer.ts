/**
 * Scale Analyzer - Detects project scale and validates typology/size combinations
 * 
 * Prevents nonsensical inputs like "500,000,000 sqm hotel" by:
 * 1. Detecting the appropriate scale based on area
 * 2. Validating against known typology ranges
 * 3. Offering clarification options when there's a mismatch
 */

import {
  type ProjectScale,
  type ScaleAnalysis,
  type ScaleInterpretation,
  SCALE_RANGES,
  TYPOLOGY_SIZE_RANGES,
} from '@/types/formulas';

// ============================================
// SCALE DETECTION
// ============================================

/**
 * Detect the appropriate project scale based on total area
 */
export function detectScale(totalArea: number): ProjectScale {
  if (totalArea <= SCALE_RANGES.interior.max) {
    return 'interior';
  }
  if (totalArea <= SCALE_RANGES.architecture.max) {
    return 'architecture';
  }
  if (totalArea <= SCALE_RANGES.landscape.max) {
    return 'landscape';
  }
  if (totalArea <= SCALE_RANGES.masterplan.max) {
    return 'masterplan';
  }
  return 'urban';
}

/**
 * Get a human-readable description of a scale
 */
export function describeScale(scale: ProjectScale): string {
  const info = SCALE_RANGES[scale];
  return `${scale} scale (${info.typical}, breakdown: ${info.unitBreakdown})`;
}

// ============================================
// TYPOLOGY MATCHING
// ============================================

/**
 * Common aliases for building types
 */
const TYPOLOGY_ALIASES: Record<string, string> = {
  // Hotels
  'hotel': 'hotel',
  'motel': 'hotel_boutique',
  'inn': 'hotel_boutique',
  'resort': 'hotel_resort',
  'hostel': 'hotel_boutique',
  'lodge': 'hotel_boutique',
  
  // Residential
  'apartment': 'apartment',
  'flat': 'apartment',
  'condo': 'apartment',
  'house': 'house',
  'villa': 'house',
  'residential': 'apartment_building',
  'housing': 'apartment_building',
  'tower': 'residential_tower',
  
  // Office
  'office': 'office_building',
  'coworking': 'office_floor',
  'workplace': 'office_building',
  'headquarters': 'office_building',
  'hq': 'office_building',
  
  // Retail
  'shop': 'retail_shop',
  'store': 'retail_shop',
  'retail': 'retail_building',
  'mall': 'shopping_mall',
  'shopping': 'shopping_mall',
  
  // Hospitality/F&B
  'restaurant': 'retail_shop',
  'cafe': 'retail_shop',
  'bar': 'retail_shop',
  
  // Institutional
  'school': 'school',
  'university': 'university_building',
  'college': 'university_building',
  'hospital': 'hospital',
  'clinic': 'clinic',
  'medical': 'clinic',
  'museum': 'museum',
  'gallery': 'museum',
  'library': 'library',
  'theater': 'theater',
  'theatre': 'theater',
  'cinema': 'theater',
  
  // Industrial
  'warehouse': 'warehouse',
  'factory': 'factory',
  'industrial': 'factory',
  'manufacturing': 'factory',
  
  // Mixed
  'mixed': 'mixed_use',
  'mixed-use': 'mixed_use',
};

/**
 * Try to match a building type string to a known typology
 */
export function matchTypology(buildingType: string): string | null {
  const normalized = buildingType.toLowerCase().trim();
  
  // Direct match
  if (TYPOLOGY_SIZE_RANGES[normalized]) {
    return normalized;
  }
  
  // Alias match
  if (TYPOLOGY_ALIASES[normalized]) {
    return TYPOLOGY_ALIASES[normalized];
  }
  
  // Partial match - find first word that matches
  const words = normalized.split(/[\s_-]+/);
  for (const word of words) {
    if (TYPOLOGY_ALIASES[word]) {
      return TYPOLOGY_ALIASES[word];
    }
    if (TYPOLOGY_SIZE_RANGES[word]) {
      return word;
    }
  }
  
  return null;
}

// ============================================
// SIZE VALIDATION
// ============================================

/**
 * Common magnitude errors (likely typos)
 */
function suggestMagnitudeCorrections(area: number, typology: string): number[] {
  const range = TYPOLOGY_SIZE_RANGES[typology];
  if (!range) return [];
  
  const suggestions: number[] = [];
  
  // Try dividing by powers of 10
  for (const divisor of [10, 100, 1000, 10000, 100000, 1000000]) {
    const corrected = area / divisor;
    if (corrected >= range.min && corrected <= range.max) {
      suggestions.push(corrected);
    }
  }
  
  // Also suggest the typical size
  if (!suggestions.includes(range.typical)) {
    suggestions.push(range.typical);
  }
  
  return suggestions;
}

/**
 * Generate scale-appropriate alternatives when size doesn't match typology
 */
function generateAlternativeInterpretations(
  area: number,
  typologyKey: string | null,
  buildingType: string
): ScaleInterpretation[] {
  const interpretations: ScaleInterpretation[] = [];
  const detectedScale = detectScale(area);
  
  // If we have a matched typology, suggest size corrections
  if (typologyKey) {
    const range = TYPOLOGY_SIZE_RANGES[typologyKey];
    const corrections = suggestMagnitudeCorrections(area, typologyKey);
    
    for (const correctedArea of corrections.slice(0, 2)) {
      interpretations.push({
        interpretation: `${buildingType} of ${formatArea(correctedArea)}`,
        suggestedArea: correctedArea,
        scale: detectScale(correctedArea),
        clarificationPrompt: `Did you mean a ${range.description} of ${formatArea(correctedArea)}?`,
      });
    }
  }
  
  // Suggest scale-appropriate alternatives based on detected scale
  switch (detectedScale) {
    case 'masterplan':
    case 'urban':
      interpretations.push({
        interpretation: `Masterplan/district containing ${buildingType} facilities`,
        suggestedArea: area,
        scale: detectedScale,
        clarificationPrompt: `Did you mean a masterplan/district of ${formatArea(area)} that includes ${buildingType} facilities?`,
      });
      
      // Also suggest campus/complex interpretation
      interpretations.push({
        interpretation: `${buildingType} campus or complex`,
        suggestedArea: area,
        scale: 'landscape',
        clarificationPrompt: `Did you mean a ${buildingType} campus/complex of ${formatArea(area)} including outdoor areas?`,
      });
      break;
      
    case 'landscape':
      interpretations.push({
        interpretation: `Site with ${buildingType} and outdoor areas`,
        suggestedArea: area,
        scale: 'landscape',
        clarificationPrompt: `Is this a site of ${formatArea(area)} with ${buildingType} building(s) plus outdoor areas?`,
      });
      break;
  }
  
  return interpretations;
}

// ============================================
// MAIN ANALYSIS FUNCTION
// ============================================

/**
 * Analyze a project input for scale appropriateness
 */
export function analyzeScale(
  totalArea: number,
  buildingType?: string,
  _additionalContext?: string  // Reserved for future use
): ScaleAnalysis {
  const warnings: string[] = [];
  const detectedScale = detectScale(totalArea);
  let confidence = 0.8;
  let sizeWithinRange = true;
  let possibleInterpretations: ScaleInterpretation[] | undefined;
  
  // Match typology if building type provided
  const typologyKey = buildingType ? matchTypology(buildingType) : null;
  
  if (buildingType && typologyKey) {
    const range = TYPOLOGY_SIZE_RANGES[typologyKey];
    
    // Check if size is within expected range
    if (totalArea < range.min) {
      sizeWithinRange = false;
      warnings.push(`${formatArea(totalArea)} is unusually small for ${range.description} (typical: ${formatArea(range.min)}-${formatArea(range.max)})`);
      confidence = 0.5;
    } else if (totalArea > range.max) {
      sizeWithinRange = false;
      
      // Calculate how far off we are
      const ratio = totalArea / range.max;
      
      if (ratio > 100) {
        // Way too large - likely a typo or different scale entirely
        warnings.push(`⚠️ ${formatArea(totalArea)} is ${ratio.toFixed(0)}x larger than typical ${range.description} max (${formatArea(range.max)})`);
        warnings.push(`This appears to be a scale mismatch - clarification needed`);
        confidence = 0.2;
      } else if (ratio > 10) {
        warnings.push(`${formatArea(totalArea)} is much larger than typical ${range.description} - may be a campus/complex or typo`);
        confidence = 0.4;
      } else {
        warnings.push(`${formatArea(totalArea)} is larger than typical ${range.description} (max: ${formatArea(range.max)})`);
        confidence = 0.6;
      }
      
      // Generate alternative interpretations
      possibleInterpretations = generateAlternativeInterpretations(totalArea, typologyKey, buildingType);
    }
  } else if (buildingType) {
    // Couldn't match typology - warn but continue
    warnings.push(`Unknown building type "${buildingType}" - using general scale detection`);
    confidence = 0.6;
  }
  
  // Warn about extremely large areas regardless of typology
  if (totalArea > 10_000_000) {
    warnings.push(`Very large area (${formatArea(totalArea)}) - ensure this is intentional`);
    if (!possibleInterpretations) {
      possibleInterpretations = [];
    }
  }
  
  // Add scale description to help user understand
  if (warnings.length === 0) {
    // No issues - add informational note about detected scale
    const scaleInfo = SCALE_RANGES[detectedScale];
    warnings.push(`ℹ️ Working at ${detectedScale} scale: ${scaleInfo.unitBreakdown}`);
  }
  
  return {
    detectedScale,
    confidence,
    sizeWithinRange,
    possibleInterpretations: possibleInterpretations?.length ? possibleInterpretations : undefined,
    warnings,
  };
}

// ============================================
// CLARIFICATION GENERATION
// ============================================

export interface ScaleClarificationRequest {
  /** Whether clarification is needed */
  needsClarification: boolean;
  /** Severity: 'info' | 'warning' | 'error' */
  severity: 'info' | 'warning' | 'error';
  /** Main question to ask user */
  question?: string;
  /** Options for user to choose from */
  options?: Array<{
    label: string;
    value: { area: number; scale: ProjectScale; interpretation: string };
  }>;
  /** Analysis details */
  analysis: ScaleAnalysis;
}

/**
 * Generate a clarification request if needed
 */
export function generateScaleClarification(
  totalArea: number,
  buildingType?: string
): ScaleClarificationRequest {
  const analysis = analyzeScale(totalArea, buildingType);
  
  // No issues - no clarification needed
  if (analysis.sizeWithinRange && analysis.confidence >= 0.7) {
    return {
      needsClarification: false,
      severity: 'info',
      analysis,
    };
  }
  
  // Minor issues - warning but can proceed
  if (analysis.confidence >= 0.5 && !analysis.possibleInterpretations?.length) {
    return {
      needsClarification: false,
      severity: 'warning',
      analysis,
    };
  }
  
  // Significant mismatch - need clarification
  const options = analysis.possibleInterpretations?.map(interp => ({
    label: interp.clarificationPrompt,
    value: {
      area: interp.suggestedArea ?? totalArea,
      scale: interp.scale,
      interpretation: interp.interpretation,
    },
  })) ?? [];
  
  // Add "keep as-is" option
  options.push({
    label: `Keep ${formatArea(totalArea)} as specified (I know what I'm doing)`,
    value: {
      area: totalArea,
      scale: analysis.detectedScale,
      interpretation: buildingType ?? 'custom',
    },
  });
  
  return {
    needsClarification: true,
    severity: analysis.confidence < 0.3 ? 'error' : 'warning',
    question: buildingType 
      ? `The area ${formatArea(totalArea)} seems unusual for "${buildingType}". What did you mean?`
      : `The area ${formatArea(totalArea)} is very large. Please confirm the project type:`,
    options,
    analysis,
  };
}

// ============================================
// HELPERS
// ============================================

/**
 * Format area for display
 */
export function formatArea(area: number): string {
  if (area >= 1_000_000) {
    return `${(area / 1_000_000).toFixed(1)}M m²`;
  }
  if (area >= 1_000) {
    return `${(area / 1_000).toFixed(1)}K m²`;
  }
  return `${Math.round(area)} m²`;
}

// ============================================
// SCALE HIERARCHY FOR UNFOLDING
// ============================================

/**
 * Scale hierarchy - defines progression from large to small
 */
const SCALE_HIERARCHY: ProjectScale[] = ['urban', 'masterplan', 'landscape', 'architecture', 'interior'];

/**
 * Get the next scale down in hierarchy
 */
export function getNextScaleDown(currentScale: ProjectScale): ProjectScale | null {
  const idx = SCALE_HIERARCHY.indexOf(currentScale);
  if (idx === -1 || idx === SCALE_HIERARCHY.length - 1) return null;
  return SCALE_HIERARCHY[idx + 1];
}

/**
 * Get appropriate unfold guidance based on area scale
 * Returns what TYPE of children should be produced, not how many
 */
export function getScaleUnfoldGuidance(area: number): {
  currentScale: ProjectScale;
  nextScale: ProjectScale | null;
  childrenType: string;
  childSizeRange: { min: number; max: number; typical: number };
  examples: string[];
  constraint: string;
} {
  const currentScale = detectScale(area);
  const nextScale = getNextScaleDown(currentScale);
  
  // Define what children should look like at each scale
  const guidance: Record<ProjectScale, {
    childrenType: string;
    childSizeRange: { min: number; max: number; typical: number };
    examples: string[];
  }> = {
    urban: {
      childrenType: 'districts or major zones',
      childSizeRange: { min: 50_000, max: 500_000, typical: 150_000 },
      examples: ['Residential District', 'Commercial Zone', 'Green Corridor', 'Mixed-Use Hub', 'Infrastructure Zone'],
    },
    masterplan: {
      childrenType: 'building plots, streets, or public spaces',
      childSizeRange: { min: 5_000, max: 100_000, typical: 20_000 },
      examples: ['Office Complex Plot', 'Residential Block', 'Central Plaza', 'Green Park', 'Retail Promenade'],
    },
    landscape: {
      childrenType: 'buildings or major outdoor areas',
      childSizeRange: { min: 500, max: 20_000, typical: 5_000 },
      examples: ['Main Building', 'Parking Structure', 'Gardens', 'Service Building', 'Entrance Plaza'],
    },
    architecture: {
      childrenType: 'floors, departments, or functional zones',
      childSizeRange: { min: 50, max: 5_000, typical: 500 },
      examples: ['Lobby Zone', 'Guest Floors', 'Back of House', 'Restaurant Wing', 'Meeting Level'],
    },
    interior: {
      childrenType: 'rooms or specific spaces',
      childSizeRange: { min: 5, max: 200, typical: 30 },
      examples: ['Reception', 'Waiting Area', 'Meeting Room', 'Storage', 'Restrooms'],
    },
  };
  
  const currentGuidance = guidance[currentScale];
  
  // Calculate constraint based on area
  const maxChildren = Math.floor(area / currentGuidance.childSizeRange.min);
  const minChildren = Math.max(2, Math.ceil(area / currentGuidance.childSizeRange.max));
  
  return {
    currentScale,
    nextScale,
    childrenType: currentGuidance.childrenType,
    childSizeRange: currentGuidance.childSizeRange,
    examples: currentGuidance.examples,
    constraint: `Generate ${minChildren}-${Math.min(maxChildren, 10)} ${currentGuidance.childrenType}. Each should be ${formatArea(currentGuidance.childSizeRange.min)}-${formatArea(currentGuidance.childSizeRange.max)}.`,
  };
}

/**
 * Get scale-appropriate breakdown suggestions
 */
export function getScaleBreakdownSuggestions(scale: ProjectScale): string[] {
  switch (scale) {
    case 'interior':
      return ['rooms', 'zones', 'furniture areas', 'circulation'];
    case 'architecture':
      return ['floors', 'departments', 'functional zones', 'circulation', 'services'];
    case 'landscape':
      return ['buildings', 'outdoor zones', 'parking', 'landscape areas', 'infrastructure'];
    case 'masterplan':
      return ['building plots', 'streets', 'public spaces', 'green areas', 'infrastructure corridors'];
    case 'urban':
      return ['neighborhoods', 'districts', 'major infrastructure', 'green corridors', 'development zones'];
  }
}

/**
 * Validate that a requested split makes sense for the scale
 */
export function validateSplitForScale(
  area: number,
  requestedParts: number,
  scale: ProjectScale
): { valid: boolean; warning?: string; maxParts?: number } {
  const scaleInfo = SCALE_RANGES[scale];
  const minPartSize = scaleInfo.min;
  const maxParts = Math.floor(area / minPartSize);
  
  if (requestedParts > maxParts) {
    return {
      valid: false,
      warning: `At ${scale} scale, ${formatArea(area)} can only be split into ${maxParts} parts (minimum ${formatArea(minPartSize)} each)`,
      maxParts,
    };
  }
  
  return { valid: true, maxParts };
}
