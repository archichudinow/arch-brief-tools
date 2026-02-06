/**
 * Create Action - Generate a new area program from prompt/brief
 * 
 * Triggers: "create hotel", "generate program", area specifications
 * Selection: None required
 * Output: CreateAreasProposal with formula-based areas
 */

import type { Proposal } from '@/types';
import { 
  generateFormulaProgram, 
  formulaResponseToProposals,
  type FormulaAIResponse,
} from '../formulaService';
import { 
  defineAction, 
  actionRegistry,
  type ActionContext,
  type ActionResult,
  type ValidationResult,
} from './registry';
import type { AreaNode } from '@/types';

// ============================================
// CREATE ACTION
// ============================================

export const createAction = defineAction({
  id: 'create',
  name: 'Create Program',
  description: 'Generate a new area program for a building typology',
  examples: [
    'Create a 5000 sqm hotel',
    'Generate program for 200-room resort',
    'Design a mixed-use building with office and retail',
  ],
  patterns: [
    /\b(create|generate|make|design|plan)\b.*\b(program|brief|layout|building|hotel|office|apartment|residential|commercial|school|hospital|museum|library|retail|restaurant|warehouse|factory)\b/i,
    /\b(program|brief)\b.*\b(for|of)\b/i,
  ],
  selectionRequirement: 'none',
  priority: 10,
  
  validate(
    prompt: string,
    _selectedNodes: AreaNode[],
    _context: ActionContext
  ): ValidationResult {
    // Check for some indication of what to create
    const hasTypology = /\b(hotel|office|apartment|residential|commercial|school|hospital|museum|library|retail|restaurant|warehouse|factory|building|facility|center|centre)\b/i.test(prompt);
    const hasArea = /\d[\d,]*\s*(?:sqm|m²|m2|square)/i.test(prompt);
    
    if (!hasTypology && !hasArea && prompt.length < 20) {
      return {
        valid: false,
        error: 'Please specify what to create (e.g., "Create a 5000 sqm hotel")',
      };
    }
    
    return { valid: true };
  },
  
  async execute(
    prompt: string,
    _selectedNodes: AreaNode[],
    context: ActionContext
  ): Promise<ActionResult> {
    // Extract total area from prompt
    const areaMatch = prompt.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:sqm|m²|m2|square\s*met(?:er|re)s?)\b/i);
    const extractedArea = areaMatch 
      ? parseFloat(areaMatch[1].replace(/,/g, '')) 
      : undefined;
    
    console.log(`[CreateAction] Generating program with level=${context.detailLevel}, area=${extractedArea}`);
    
    const response = await generateFormulaProgram(
      prompt, 
      extractedArea, 
      context.detailLevel
    );
    
    // Handle clarification needed (scale ambiguity)
    if (response.clarification_needed && response.options) {
      return {
        message: response.message,
        needsClarification: true,
        clarificationOptions: response.options.map(opt => ({
          label: opt.label,
          value: opt,
        })),
        data: { response, originalPrompt: prompt },
      };
    }
    
    return {
      message: response.message,
      data: { response },
      warnings: response.warnings,
    };
  },
  
  toProposals(
    result: ActionResult,
    _selectedNodes: AreaNode[],
    _context: ActionContext
  ): Proposal[] {
    if (result.needsClarification) {
      return [];
    }
    
    const data = result.data as { response: FormulaAIResponse };
    if (!data?.response) return [];
    
    return formulaResponseToProposals(data.response);
  },
});

// Register on import
actionRegistry.register(createAction);

export default createAction;
