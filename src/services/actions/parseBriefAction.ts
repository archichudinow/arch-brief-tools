/**
 * Parse Brief Action - Extract area program from long-form brief text
 * 
 * Triggers: Long text with areas, "parse:", table-like content
 * Selection: None required
 * Output: CreateAreasProposal with extracted areas
 * 
 * This uses the multi-pass extraction system for precise number extraction
 */

import { v4 as uuidv4 } from 'uuid';
import type { Proposal, AreaNode, CreateAreasProposal, ParsedBrief } from '@/types';
import { parseBrief } from '../aiService';
import { analyzeInput } from '../briefAnalyzer';
import { 
  defineAction, 
  actionRegistry,
  type ActionContext,
  type ActionResult,
  type ValidationResult,
} from './registry';

/**
 * Convert ParsedBrief to CreateAreasProposal
 */
function parsedBriefToProposals(parsed: ParsedBrief): Proposal[] {
  if (!parsed.areas || parsed.areas.length === 0) {
    return [];
  }
  
  const proposal: CreateAreasProposal = {
    id: uuidv4(),
    type: 'create_areas',
    status: 'pending',
    areas: parsed.areas.map(area => ({
      name: area.name,
      areaPerUnit: area.areaPerUnit,
      count: area.count,
      briefNote: area.briefNote,   // Notes from the brief (requirements, adjacencies, etc.)
      groupHint: area.groupHint,   // Suggested group from brief structure
      formulaReasoning: `Extracted from brief: ${area.count > 1 ? `${area.count} × ${area.areaPerUnit}m²` : `${area.areaPerUnit}m²`}`,
      formulaType: area.count > 1 ? 'unit_based' : 'fixed',
      formulaConfidence: 0.9, // High confidence since extracted from explicit data
    })),
    detectedGroups: parsed.detectedGroups,
  };
  
  return [proposal];
}

// ============================================
// PARSE BRIEF ACTION
// ============================================

export const parseBriefAction = defineAction({
  id: 'parse_brief',
  name: 'Parse Brief',
  description: 'Extract area program from long-form brief text with tables/lists',
  examples: [
    'Create from brief: Guest rooms 200 x 35sqm...',
    'Generate from this list: Lobby 500m², Restaurant 300m²...',
    'Read from file: [paste your brief text]',
    'Parse this: Area specifications...',
  ],
  patterns: [
    // Direct parse/extract commands
    /^parse\s*(?:this\s*)?(?:brief)?:/i,
    /^extract\s*(?:areas?\s*)?(?:from)?:/i,
    /^brief\s*:\s*/i,
    // "create/generate/read from file/brief/list/excel/table" patterns
    /\b(?:please\s+)?(?:create|generate|read|import|load)\s+(?:(?:areas?|program)\s+)?from\s+(?:this\s+)?(?:file|brief|list|excel|table|text|doc(?:ument)?|spreadsheet)/i,
    // "from file/brief:" at the start
    /^from\s+(?:file|brief|list|excel|table|text):/i,
    // Auto-detect tabular/list brief data with multiple areas
    /(?:\d+\s*[×x]\s*\d+|\d+\s*m²|\d+\s*sqm).{10,}(?:\d+\s*[×x]\s*\d+|\d+\s*m²|\d+\s*sqm)/is,
  ],
  selectionRequirement: 'none',
  priority: 25, // Higher than create - more specific trigger
  
  validate(
    prompt: string,
    _selectedNodes: AreaNode[],
    _context: ActionContext
  ): ValidationResult {
    const lower = prompt.toLowerCase();
    
    // Check if it explicitly uses a parse trigger pattern
    const hasExplicitTrigger = 
      lower.startsWith('parse') ||
      lower.startsWith('extract') ||
      lower.startsWith('brief:') ||
      lower.startsWith('from file') ||
      lower.startsWith('from brief') ||
      /(?:create|generate|read|import|load)\s+.*from\s+(?:file|brief|list|excel|table|text)/i.test(lower);
    
    // Analyze the input to see if it looks like a brief
    const analysis = analyzeInput(prompt);
    
    // Accept if it has brief-like characteristics
    if (analysis.type === 'garbage' && !hasExplicitTrigger) {
      return {
        valid: false,
        error: 'This text doesn\'t look like a brief. Try "create" with a simple prompt instead.',
      };
    }
    
    // Warn if it looks more like a prompt (but allow explicit triggers)
    if (analysis.type === 'prompt' && !hasExplicitTrigger) {
      return {
        valid: true, // Still allow it
      };
    }
    
    return { valid: true };
  },
  
  async execute(
    prompt: string,
    _selectedNodes: AreaNode[],
    _context: ActionContext
  ): Promise<ActionResult> {
    // Remove various "parse/create from" prefixes
    let cleanedPrompt = prompt
      // Direct parse commands
      .replace(/^parse\s*(?:this\s*)?(?:brief)?:\s*/i, '')
      .replace(/^extract\s*(?:areas?\s*)?(?:from)?:\s*/i, '')
      .replace(/^brief\s*:\s*/i, '')
      // "create/generate/read from file/brief/..." patterns
      .replace(/^(?:please\s+)?(?:create|generate|read|import|load)\s+(?:(?:areas?|program)\s+)?from\s+(?:this\s+)?(?:file|brief|list|excel|table|text|doc(?:ument)?|spreadsheet)\s*[:.]?\s*/i, '')
      // "from file:" at the start
      .replace(/^from\s+(?:file|brief|list|excel|table|text)\s*:\s*/i, '')
      .trim();
    
    console.log(`[ParseBriefAction] Parsing brief (${cleanedPrompt.length} chars)`);
    
    // Use the proper multi-pass brief extraction (not formula generation)
    const parsed = await parseBrief(cleanedPrompt);
    
    // Handle redirect to agent (input was a prompt, not a brief)
    if (parsed.isRedirectToAgent) {
      return {
        message: 'This looks like a generation request rather than a brief to parse. Try "create" action instead.',
        data: null,
        warnings: ['Input redirected - use create action for prompts'],
      };
    }
    
    // Build result message
    let message = `Extracted ${parsed.areas.length} areas from brief`;
    if (parsed.parsedTotal) {
      message += ` (${parsed.parsedTotal.toLocaleString()} m² total)`;
    }
    if (parsed.detectedGroups && parsed.detectedGroups.length > 0) {
      message += `\nDetected ${parsed.detectedGroups.length} groups: ${parsed.detectedGroups.map(g => g.name).join(', ')}`;
    }
    if (parsed.ambiguities && parsed.ambiguities.length > 0) {
      message += '\n\n⚠️ Ambiguities: ' + parsed.ambiguities.join('; ');
    }
    
    return {
      message,
      data: { parsed },
    };
  },
  
  toProposals(
    result: ActionResult,
    _selectedNodes: AreaNode[],
    _context: ActionContext
  ): Proposal[] {
    const data = result.data as { parsed: ParsedBrief } | null;
    if (!data?.parsed) return [];
    
    return parsedBriefToProposals(data.parsed);
  },
});

// Register on import
actionRegistry.register(parseBriefAction);

export default parseBriefAction;