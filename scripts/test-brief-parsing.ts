/**
 * Test script for brief parsing modes
 * 
 * Run with: npx tsx scripts/test-brief-parsing.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Load brief examples
const briefDir = path.join(__dirname, '..', 'brief examples');

async function testBriefParsing() {
  const briefFiles = fs.readdirSync(briefDir).filter(f => f.endsWith('.md'));
  
  console.log('=== Brief Parsing Test ===\n');
  console.log(`Found ${briefFiles.length} brief files\n`);
  
  for (const file of briefFiles.slice(0, 3)) { // Test first 3
    console.log(`\n--- ${file} ---`);
    const content = fs.readFileSync(path.join(briefDir, file), 'utf-8');
    console.log(`Length: ${content.length} chars`);
    console.log(`First 200 chars: ${content.slice(0, 200)}...`);
    
    // Check for area patterns
    const areaPatterns = content.match(/(\d+)\s*(?:sqm|m²|m2)/gi);
    console.log(`Area mentions found: ${areaPatterns?.length || 0}`);
    
    // Check for item counts
    const countPatterns = content.match(/(\d+)\s*[×x]/gi);
    console.log(`Count patterns found: ${countPatterns?.length || 0}`);
  }
}

testBriefParsing().catch(console.error);
