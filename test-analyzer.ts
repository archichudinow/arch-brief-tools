/**
 * Test script for the brief analyzer
 * Run with: npx tsx test-analyzer.ts
 */

import { analyzeInput, getInputTypeDescription, getStrategyDescription, canProceedWithParsing } from './src/services/briefAnalyzer';
import * as fs from 'fs';
import * as path from 'path';

const briefExamplesDir = './brief examples';

// Test cases with expected classifications
const testCases = [
  { file: 'brief_simple.md', expectedType: 'prompt' },
  { file: 'brief_too_simple.md', expectedType: 'garbage' },
  { file: 'brief_simple_clear', expectedType: 'prompt' },
  { file: 'brief_very_dirty.md', expectedType: 'structured' },  // Has table structure + totals despite messy formatting
  { file: 'brief_dirty_but_structured.md', expectedType: 'structured' },  // Name says structured, it has structure
  { file: 'brief_mixed_with_text.md', expectedType: 'dirty' },
  { file: 'brief_not_a_brief _at_all.md', expectedType: 'garbage' },
  { file: 'brief_well_structured.md', expectedType: 'structured' },
  { file: 'brief_asked_gpt_to_clean_structure.md', expectedType: 'structured' },  // Clean structured brief with m² units
];

console.log('=' .repeat(80));
console.log('BRIEF ANALYZER TEST SUITE');
console.log('=' .repeat(80));
console.log();

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const filePath = path.join(briefExamplesDir, testCase.file);
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = analyzeInput(content);
    
    const typeMatch = result.type === testCase.expectedType;
    const status = typeMatch ? '✅ PASS' : '❌ FAIL';
    
    if (typeMatch) passed++; else failed++;
    
    console.log(`${status}: ${testCase.file}`);
    console.log(`  Expected: ${testCase.expectedType} | Got: ${result.type}`);
    console.log(`  Quality: ${result.quality} | Strategy: ${result.strategy}`);
    console.log(`  Description: ${getInputTypeDescription(result.type)}`);
    console.log(`  Can Proceed: ${canProceedWithParsing(result)}`);
    console.log();
    
    // Show signals for debugging
    console.log('  Signals:');
    console.log(`    - Lines: ${result.signals.lineCount}`);
    console.log(`    - Numeric values: ${result.signals.numericCount}`);
    console.log(`    - Has table structure: ${result.signals.hasTableStructure}`);
    console.log(`    - Has totals: ${result.signals.hasTotals}`);
    console.log(`    - Has email markers: ${result.signals.hasEmailMarkers}`);
    console.log(`    - Has imperative verbs: ${result.signals.hasImperativeVerbs}`);
    console.log(`    - Noise ratio: ${(result.signals.noiseRatio * 100).toFixed(1)}%`);
    console.log(`    - Unit type: ${result.signals.unitType}`);
    console.log();
    
    if (result.warnings.length > 0) {
      console.log('  Warnings:');
      result.warnings.forEach(w => console.log(`    ⚠️  ${w}`));
      console.log();
    }
    
    if (result.suggestions.length > 0) {
      console.log('  Suggestions:');
      result.suggestions.forEach(s => console.log(`    💡 ${s}`));
      console.log();
    }
    
    console.log('-'.repeat(80));
    console.log();
    
  } catch (error) {
    console.log(`❌ ERROR: ${testCase.file}`);
    console.log(`  ${error}`);
    console.log();
    failed++;
  }
}

console.log('=' .repeat(80));
console.log(`SUMMARY: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);
console.log('=' .repeat(80));
