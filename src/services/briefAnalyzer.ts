/**
 * Brief Analyzer - Input Classification & Preprocessing
 * Analyzes incoming text to determine parsing strategy
 */

// ============================================
// TYPES
// ============================================

export interface BriefSignals {
  lineCount: number;
  wordCount: number;
  numericCount: number;
  hasTableStructure: boolean;
  hasTotals: boolean;
  hasSubtotals: boolean;
  hasSectionHeaders: boolean;
  hasListMarkers: boolean;
  hasEmailMarkers: boolean;
  hasImperativeVerbs: boolean;
  noiseRatio: number;
  unitType: 'metric' | 'imperial' | 'mixed' | 'none';
  averageLineLength: number;
  spaceIndicatorCount: number;
}

export type InputType = 'prompt' | 'dirty' | 'structured' | 'garbage';
export type QualityLevel = 'low' | 'medium' | 'high';
export type ParsingStrategy = 'extract_tolerant' | 'extract_strict' | 'redirect_to_agent' | 'reject';

export interface InputClassification {
  type: InputType;
  confidence: number;
  signals: BriefSignals;
  quality: QualityLevel;
  strategy: ParsingStrategy;
  warnings: string[];
  suggestions: string[];
  cleanedText: string;
}

// ============================================
// DETECTION PATTERNS
// ============================================

const PATTERNS = {
  // Numbers with optional units
  numeric: /\b\d{1,6}(?:[.,]\d+)?\s*(?:m²|sqm|sq\.?\s*m|sqft|sq\.?\s*ft|sf)?\b/gi,
  
  // Numbers that are clearly areas (have units)
  areasWithUnits: /\b\d{1,6}(?:[.,]\d+)?\s*(?:m²|sqm|sq\.?\s*m|sqft|sq\.?\s*ft|sf)\b/gi,
  
  // Table-like structure
  tableStructure: /^.+[\t].+$|^.+\s{3,}\d/gm,
  
  // Section headers
  sectionHeaders: /^(?:[A-Z][A-Za-z\s&,]+:?\s*$)|^[-─═]{3,}|^#+\s/gm,
  
  // Totals
  totals: /\b(?:total|grand\s*total|program\s*total|gfa|gia|nla|gross\s*(?:floor\s*)?area|net\s*area)\b/gi,
  
  // Subtotals
  subtotals: /\b(?:subtotal|sub-total|sub\s*total|section\s*total)\b/gi,
  
  // Email markers
  emailMarkers: /(?:^from:|^to:|^subject:|^cc:|^sent:|^date:|\bregards,|\bthanks,|\bbest,|\bcheers,|^dear\s|^hi\s|^hello\s)/gim,
  
  // List markers
  listMarkers: /^[\s]*[-•●○◦▪▸►]\s|^\s*\d+[\.\)]\s|^\s*[a-z][\.\)]\s/gim,
  
  // Imperative verbs (generation prompts)
  imperativeVerbs: /\b(?:create|make|generate|design|build|develop|prepare|draft|propose|suggest)\b/gi,
  
  // Units - note: \b word boundary doesn't work with ² unicode character
  metricUnits: /(?:m²|sqm|sq\.?\s*m(?:eters?)?(?=\s|$|,|\.))/gi,
  imperialUnits: /(?:sqft|sq\.?\s*f(?:ee)?t|sf)(?=\s|$|,|\.)/gi,
  
  // Noise phrases
  noiseIndicators: /(?:please|kindly|would\s+you|could\s+you|let\s+me\s+know|attached|find\s+below|as\s+discussed|following\s+up)/gi,
  
  // Architectural space indicators
  spaceIndicators: /\b(?:room|office|lobby|reception|meeting|conference|toilet|wc|bathroom|kitchen|storage|corridor|circulation|parking|entrance|gallery|studio|workshop|lab|classroom|auditorium|restaurant|cafe|retail|shop)\b/gi,
};

// ============================================
// ANALYSIS FUNCTIONS
// ============================================

function analyzeSignals(text: string): BriefSignals {
  const lines = text.trim().split('\n').filter(l => l.trim());
  const words = text.trim().split(/\s+/);
  
  // Count numerics
  const numericMatches = text.match(PATTERNS.numeric) || [];
  
  // Detect structure
  const hasTableStructure = PATTERNS.tableStructure.test(text);
  const hasTotals = PATTERNS.totals.test(text);
  const hasSubtotals = PATTERNS.subtotals.test(text);
  const hasSectionHeaders = (text.match(PATTERNS.sectionHeaders) || []).length >= 2;
  const hasListMarkers = PATTERNS.listMarkers.test(text);
  const hasEmailMarkers = PATTERNS.emailMarkers.test(text);
  const hasImperativeVerbs = PATTERNS.imperativeVerbs.test(text);
  
  // Unit detection
  const hasMetric = PATTERNS.metricUnits.test(text);
  const hasImperial = PATTERNS.imperialUnits.test(text);
  const unitType: BriefSignals['unitType'] = 
    hasMetric && hasImperial ? 'mixed' :
    hasMetric ? 'metric' :
    hasImperial ? 'imperial' : 'none';
  
  // Noise ratio
  const noiseMatches = text.match(PATTERNS.noiseIndicators) || [];
  const spaceMatches = text.match(PATTERNS.spaceIndicators) || [];
  const noiseRatio = spaceMatches.length > 0 
    ? noiseMatches.length / (noiseMatches.length + spaceMatches.length)
    : noiseMatches.length > 3 ? 0.8 : 0.3;
  
  // Average line length
  const averageLineLength = lines.length > 0
    ? lines.reduce((sum, l) => sum + l.length, 0) / lines.length
    : 0;
  
  return {
    lineCount: lines.length,
    wordCount: words.length,
    numericCount: numericMatches.length,
    hasTableStructure,
    hasTotals,
    hasSubtotals,
    hasSectionHeaders,
    hasListMarkers,
    hasEmailMarkers,
    hasImperativeVerbs,
    noiseRatio,
    unitType,
    averageLineLength,
    spaceIndicatorCount: spaceMatches.length,
  };
}

function determineInputType(signals: BriefSignals): { type: InputType; confidence: number } {
  // PROMPT: Short, imperative, few numbers
  if (
    signals.lineCount <= 5 &&
    signals.numericCount <= 3 &&
    signals.hasImperativeVerbs &&
    !signals.hasTableStructure
  ) {
    return { type: 'prompt', confidence: 0.9 };
  }
  
  // Also prompt if very short with target area
  if (
    signals.lineCount <= 3 &&
    signals.wordCount <= 50 &&
    signals.numericCount >= 1 &&
    signals.hasImperativeVerbs
  ) {
    return { type: 'prompt', confidence: 0.85 };
  }
  
  // STRUCTURED: Clear structure with totals
  if (
    signals.hasTableStructure &&
    signals.hasTotals &&
    signals.numericCount >= 5 &&
    signals.noiseRatio < 0.3
  ) {
    return { type: 'structured', confidence: 0.9 };
  }
  
  // STRUCTURED: Section headers with multiple numbers
  if (
    signals.hasSectionHeaders &&
    signals.numericCount >= 8 &&
    signals.noiseRatio < 0.3 &&
    (signals.hasTotals || signals.hasSubtotals)
  ) {
    return { type: 'structured', confidence: 0.8 };
  }
  
  // GARBAGE: No real content
  if (
    signals.numericCount === 0 &&
    !signals.hasImperativeVerbs &&
    signals.wordCount < 10
  ) {
    return { type: 'garbage', confidence: 0.9 };
  }
  
  // GARBAGE: Too much noise, no structure
  if (
    signals.noiseRatio > 0.7 &&
    signals.numericCount < 3 &&
    !signals.hasSectionHeaders
  ) {
    return { type: 'garbage', confidence: 0.7 };
  }
  
  // GARBAGE: Has some numbers but no architectural content
  if (
    signals.numericCount <= 5 &&
    signals.spaceIndicatorCount < 2 &&
    !signals.hasTableStructure &&
    !signals.hasTotals &&
    signals.noiseRatio > 0.2
  ) {
    return { type: 'garbage', confidence: 0.65 };
  }
  
  // DIRTY: Has numbers but messy
  if (signals.numericCount > 0) {
    const confidence = signals.hasEmailMarkers ? 0.7 : 0.8;
    return { type: 'dirty', confidence };
  }
  
  // Default to dirty with low confidence
  return { type: 'dirty', confidence: 0.5 };
}

function assessQuality(signals: BriefSignals, type: InputType): QualityLevel {
  if (type === 'prompt' || type === 'garbage') {
    return 'low'; // Different meaning for prompts, but doesn't matter
  }
  
  let score = 0;
  
  // Structure points
  if (signals.hasTableStructure) score += 25;
  if (signals.hasSectionHeaders) score += 15;
  if (signals.hasTotals) score += 20;
  if (signals.hasSubtotals) score += 10;
  
  // Cleanliness points
  if (signals.noiseRatio < 0.2) score += 15;
  else if (signals.noiseRatio < 0.4) score += 5;
  
  // Unit consistency
  if (signals.unitType === 'metric' || signals.unitType === 'imperial') score += 10;
  if (signals.unitType === 'mixed') score -= 5;
  
  // Sufficient data
  if (signals.numericCount >= 10) score += 5;
  
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function selectStrategy(type: InputType, quality: QualityLevel): ParsingStrategy {
  if (type === 'garbage') return 'reject';
  if (type === 'prompt') return 'redirect_to_agent';
  if (type === 'structured' && quality !== 'low') return 'extract_strict';
  return 'extract_tolerant';
}

function generateWarnings(signals: BriefSignals, type: InputType): string[] {
  const warnings: string[] = [];
  
  if (type === 'garbage') {
    warnings.push('This text does not appear to contain a building program');
    return warnings;
  }
  
  if (type === 'prompt') {
    warnings.push('This looks like a generation request, not a brief to parse');
    return warnings;
  }
  
  if (signals.hasEmailMarkers) {
    warnings.push('Email content detected - may contain non-program text');
  }
  
  if (signals.noiseRatio > 0.4) {
    warnings.push('High amount of non-program content detected');
  }
  
  if (signals.unitType === 'mixed') {
    warnings.push('Mixed units (m² and sqft) - will convert to m²');
  }
  
  if (signals.unitType === 'none') {
    warnings.push('No area units found - numbers may be counts or areas');
  }
  
  if (!signals.hasTotals && type === 'structured') {
    warnings.push('No program total found - cannot validate parsing');
  }
  
  if (signals.numericCount > 50) {
    warnings.push('Large program detected - parsing may take longer');
  }
  
  return warnings;
}

function generateSuggestions(signals: BriefSignals, type: InputType, quality: QualityLevel): string[] {
  const suggestions: string[] = [];
  
  if (type === 'garbage') {
    suggestions.push('Please provide a building program with spaces and areas');
    suggestions.push('Example: "Lobby 100m², Offices 500m², Meeting Rooms 80m²"');
    return suggestions;
  }
  
  if (type === 'prompt') {
    suggestions.push('Switch to Agent Chat mode to generate a building program');
    suggestions.push('The Agent can create detailed programs from prompts like this');
    return suggestions;
  }
  
  if (quality === 'low') {
    if (!signals.hasTotals) {
      suggestions.push('Add a total GFA to help validate the parsed areas');
    }
    if (signals.noiseRatio > 0.5) {
      suggestions.push('Remove non-program text (emails, notes) for better accuracy');
    }
    if (!signals.hasSectionHeaders && signals.numericCount > 10) {
      suggestions.push('Group spaces under section headers for better organization');
    }
  }
  
  if (signals.unitType === 'none') {
    suggestions.push('Adding units (m²) helps distinguish areas from counts');
  }
  
  return suggestions;
}

// ============================================
// PREPROCESSING FUNCTIONS
// ============================================

function cleanWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim();
}

function removeEmailNoise(text: string): string {
  const lines = text.split('\n');
  const cleanedLines: string[] = [];
  let inSignature = false;
  
  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();
    
    // Skip email headers
    if (/^(from|to|cc|bcc|subject|sent|date):/i.test(line)) continue;
    
    // Detect signature start
    if (/^(regards|thanks|best|cheers|sincerely|thank you),?\s*$/i.test(trimmed)) {
      inSignature = true;
      continue;
    }
    
    // Skip signature content
    if (inSignature) continue;
    
    // Skip common email phrases
    if (/^(dear|hi|hello|hey)\s+/i.test(trimmed)) continue;
    if (/^(please find|as discussed|following up|attached)/i.test(trimmed)) continue;
    
    cleanedLines.push(line);
  }
  
  return cleanedLines.join('\n').trim();
}

function normalizeUnits(text: string): string {
  // Convert sqft to m² (1 sqft ≈ 0.0929 m²)
  let result = text.replace(
    /(\d+(?:[.,]\d+)?)\s*(?:sqft|sq\.?\s*ft|sf)\b/gi,
    (_, num) => {
      const value = parseFloat(num.replace(',', ''));
      const sqm = Math.round(value * 0.0929);
      return `${sqm} m²`;
    }
  );
  
  // Normalize m² variants
  result = result.replace(/\b(sqm|sq\.?\s*m(?:eters?)?)\b/gi, 'm²');
  
  // Normalize thousands separators
  result = result.replace(/(\d),(\d{3})\b/g, '$1$2');
  
  return result;
}

function preprocessText(text: string, type: InputType, signals: BriefSignals): string {
  let cleaned = text;
  
  // Always clean whitespace
  cleaned = cleanWhitespace(cleaned);
  
  // Remove email noise for dirty briefs
  if (type === 'dirty' && signals.hasEmailMarkers) {
    cleaned = removeEmailNoise(cleaned);
  }
  
  // Normalize units
  if (signals.unitType === 'imperial' || signals.unitType === 'mixed') {
    cleaned = normalizeUnits(cleaned);
  }
  
  return cleaned;
}

// ============================================
// MAIN EXPORT
// ============================================

export function analyzeInput(text: string): InputClassification {
  const trimmed = text.trim();
  
  if (!trimmed) {
    return {
      type: 'garbage',
      confidence: 1.0,
      signals: analyzeSignals(''),
      quality: 'low',
      strategy: 'reject',
      warnings: ['No input provided'],
      suggestions: ['Please enter a building program or describe what you want to create'],
      cleanedText: '',
    };
  }
  
  const signals = analyzeSignals(trimmed);
  const { type, confidence } = determineInputType(signals);
  const quality = assessQuality(signals, type);
  const strategy = selectStrategy(type, quality);
  const warnings = generateWarnings(signals, type);
  const suggestions = generateSuggestions(signals, type, quality);
  const cleanedText = preprocessText(trimmed, type, signals);
  
  return {
    type,
    confidence,
    signals,
    quality,
    strategy,
    warnings,
    suggestions,
    cleanedText,
  };
}

// Convenience function to check if we can proceed
export function canProceedWithParsing(classification: InputClassification): boolean {
  return classification.strategy !== 'reject';
}

// Get user-friendly type description
export function getInputTypeDescription(type: InputType): string {
  switch (type) {
    case 'prompt': return 'Generation Request';
    case 'dirty': return 'Unstructured Brief';
    case 'structured': return 'Structured Brief';
    case 'garbage': return 'Invalid Input';
  }
}

// Get strategy description
export function getStrategyDescription(strategy: ParsingStrategy): string {
  switch (strategy) {
    case 'extract_tolerant': return 'AI will extract spaces and infer missing values';
    case 'extract_strict': return 'AI will extract and validate against stated totals';
    case 'redirect_to_agent': return 'This looks like a generation request - use Agent Chat instead';
    case 'reject': return 'Cannot parse this input';
  }
}
