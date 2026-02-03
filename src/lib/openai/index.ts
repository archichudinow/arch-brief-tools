import { openai, isOpenAIConfigured } from './client';
import {
  BRIEF_PARSE_SYSTEM_PROMPT,
  BRIEF_PARSE_USER_PROMPT,
  BRIEF_REFINE_SYSTEM_PROMPT,
  BRIEF_REFINE_USER_PROMPT,
  type BriefParseResult,
} from './prompts';
import {
  GROUPING_SYSTEM_PROMPT,
  GROUPING_USER_PROMPT,
  REGROUP_SYSTEM_PROMPT,
  REGROUP_USER_PROMPT,
  type GroupingProposalResult,
} from './grouping-prompts';
import type { ProgramItem, FunctionalGroup } from '@/types';

/**
 * Parse an architectural brief into normalized program items
 */
export async function parseBrief(briefText: string): Promise<BriefParseResult> {
  if (!isOpenAIConfigured() || !openai) {
    throw new Error('OpenAI API key not configured. Add VITE_OPENAI_API_KEY to .env.local');
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: BRIEF_PARSE_SYSTEM_PROMPT },
      { role: 'user', content: BRIEF_PARSE_USER_PROMPT(briefText) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  try {
    const parsed = JSON.parse(content) as BriefParseResult;
    
    // Process programs with defaults
    parsed.programs = parsed.programs.map((p, i) => ({
      ...p,
      id: p.id || `program-${i + 1}`,
      quantity: p.quantity ?? 1,
      totalArea: p.totalArea ?? (p.area * (p.quantity ?? 1)),
      source: 'ai' as const,
      aiNotes: p.aiNotes || '',
    }));
    
    parsed.assumptions = parsed.assumptions.map((a, i) => ({
      ...a,
      id: a.id || `assumption-${i + 1}`,
      accepted: false,
    }));
    
    parsed.rawExtraction = content;
    
    return parsed;
  } catch {
    throw new Error('Failed to parse AI response as JSON');
  }
}

/**
 * Refine programs via chat - add, modify, or remove rooms based on user message
 */
export async function refineBrief(
  currentPrograms: ProgramItem[],
  userMessage: string,
  attachedProgramIds?: string[]
): Promise<BriefParseResult> {
  if (!isOpenAIConfigured() || !openai) {
    throw new Error('OpenAI API key not configured. Add VITE_OPENAI_API_KEY to .env.local');
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: BRIEF_REFINE_SYSTEM_PROMPT },
      { role: 'user', content: BRIEF_REFINE_USER_PROMPT(currentPrograms, userMessage, attachedProgramIds) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  try {
    const parsed = JSON.parse(content) as BriefParseResult;
    
    // Process programs - preserve existing IDs where possible
    parsed.programs = parsed.programs.map((p, i) => ({
      ...p,
      id: p.id || `program-${Date.now()}-${i + 1}`,
      quantity: p.quantity ?? 1,
      totalArea: p.totalArea ?? (p.area * (p.quantity ?? 1)),
      source: p.source || ('user' as const),
      aiNotes: p.aiNotes || '',
    }));
    
    parsed.assumptions = parsed.assumptions?.map((a, i) => ({
      ...a,
      id: a.id || `assumption-${i + 1}`,
      accepted: false,
    })) ?? [];
    
    parsed.rawExtraction = '';
    
    return parsed;
  } catch {
    throw new Error('Failed to parse AI refinement response as JSON');
  }
}

/**
 * Propose initial grouping of programs into functional clusters
 */
export async function proposeGrouping(programs: ProgramItem[]): Promise<GroupingProposalResult> {
  if (!isOpenAIConfigured() || !openai) {
    throw new Error('OpenAI API key not configured. Add VITE_OPENAI_API_KEY to .env.local');
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: GROUPING_SYSTEM_PROMPT },
      { role: 'user', content: GROUPING_USER_PROMPT(programs) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  try {
    const parsed = JSON.parse(content) as GroupingProposalResult;
    
    // Ensure all groups have required fields
    parsed.groups = parsed.groups.map((g, i) => ({
      ...g,
      id: g.id || `cluster-${i + 1}`,
      programIds: g.programIds || [],
      aiNotes: g.aiNotes || '',
      preferredPlacement: g.preferredPlacement || {
        ground: false,
        podium: true,
        tower: true,
        standalone: false,
      },
      splittable: g.splittable || {
        acrossLevels: true,
        acrossBuildings: false,
      },
      derivedFromBrief: g.derivedFromBrief ?? true,
    }));
    
    return parsed;
  } catch {
    throw new Error('Failed to parse AI grouping response as JSON');
  }
}

/**
 * Regroup programs via chat - modify clusters based on user feedback
 * Supports abort signal for cancellation
 */
export async function regroupPrograms(
  currentGroups: FunctionalGroup[],
  programs: ProgramItem[],
  userMessage: string,
  attachedProgramIds?: string[],
  attachedGroupIds?: string[],
  signal?: AbortSignal
): Promise<GroupingProposalResult> {
  if (!isOpenAIConfigured() || !openai) {
    throw new Error('OpenAI API key not configured. Add VITE_OPENAI_API_KEY to .env.local');
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: REGROUP_SYSTEM_PROMPT },
      { role: 'user', content: REGROUP_USER_PROMPT(currentGroups, programs, userMessage, attachedProgramIds, attachedGroupIds) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
  }, { signal });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  try {
    const parsed = JSON.parse(content) as GroupingProposalResult;
    
    // Process groups with defaults
    parsed.groups = parsed.groups.map((g, i) => ({
      ...g,
      id: g.id || `cluster-${Date.now()}-${i + 1}`,
      programIds: g.programIds || [],
      aiNotes: g.aiNotes || '',
      preferredPlacement: g.preferredPlacement || {
        ground: false,
        podium: true,
        tower: true,
        standalone: false,
      },
      splittable: g.splittable || {
        acrossLevels: true,
        acrossBuildings: false,
      },
      derivedFromBrief: false, // User-modified
    }));
    
    // VALIDATION: Check for empty groups that should have programs
    // This catches the common AI mistake of creating new groups without assigning programs
    const emptyGroups = parsed.groups.filter(g => g.programIds.length === 0);
    if (emptyGroups.length > 0) {
      console.warn(`AI returned ${emptyGroups.length} empty groups - this is likely a mistake`);
      // Log which groups are empty for debugging
      emptyGroups.forEach(g => console.warn(`  Empty group: "${g.name}"`));
    }
    
    // Process newPrograms if AI created any (for "per group" items when splitting)
    if (parsed.newPrograms && parsed.newPrograms.length > 0) {
      parsed.newPrograms = parsed.newPrograms.map((p, i) => ({
        ...p,
        id: p.id || `program-new-${Date.now()}-${i + 1}`,
        quantity: p.quantity ?? 1,
        totalArea: p.totalArea ?? (p.area * (p.quantity ?? 1)),
        source: 'ai' as const,
        aiNotes: p.aiNotes || '',
      }));
      console.log(`AI created ${parsed.newPrograms.length} new program(s) for group split`);
    }
    
    // SAFEGUARD: Check for unassigned programs and handle them
    const allProgramIds = programs.map(p => p.id);
    const newProgramIds = parsed.newPrograms?.map(p => p.id) ?? [];
    const allIds = [...allProgramIds, ...newProgramIds];
    const assignedIds = new Set(parsed.groups.flatMap(g => g.programIds));
    const unassignedIds = allIds.filter(id => !assignedIds.has(id));
    
    // If we have both empty groups AND unassigned programs, try to redistribute
    if (unassignedIds.length > 0 && emptyGroups.length > 0) {
      console.warn(`Attempting to redistribute ${unassignedIds.length} unassigned programs into ${emptyGroups.length} empty groups`);
      
      // Find the original group these programs came from
      const originalGroupForProgram = new Map<string, FunctionalGroup>();
      for (const group of currentGroups) {
        for (const progId of group.programIds) {
          originalGroupForProgram.set(progId, group);
        }
      }
      
      // Try to distribute unassigned programs into empty groups that seem related
      const remainingUnassigned = [...unassignedIds];
      for (const emptyGroup of emptyGroups) {
        if (remainingUnassigned.length === 0) break;
        
        // Find programs that might belong to this empty group based on name similarity
        const groupNameLower = emptyGroup.name.toLowerCase();
        const matchingPrograms = remainingUnassigned.filter(id => {
          const prog = programs.find(p => p.id === id);
          if (!prog) return false;
          const origGroup = originalGroupForProgram.get(id);
          // Match if the empty group name contains words from original group or program
          return (origGroup && groupNameLower.includes(origGroup.name.toLowerCase().split(' ')[0])) ||
                 groupNameLower.includes(prog.name.toLowerCase().split(' ')[0]) ||
                 prog.name.toLowerCase().includes(groupNameLower.split(' ')[0]);
        });
        
        if (matchingPrograms.length > 0) {
          // Distribute matching programs
          const perGroup = Math.ceil(matchingPrograms.length / emptyGroups.length);
          const toAssign = matchingPrograms.slice(0, perGroup);
          emptyGroup.programIds = toAssign;
          toAssign.forEach(id => {
            const idx = remainingUnassigned.indexOf(id);
            if (idx > -1) remainingUnassigned.splice(idx, 1);
          });
        }
      }
      
      // Update unassignedIds with what's left
      unassignedIds.length = 0;
      unassignedIds.push(...remainingUnassigned);
    }
    
    if (unassignedIds.length > 0) {
      console.warn(`AI left ${unassignedIds.length} programs unassigned, adding to fallback group`);
      // Find existing "Other" or "Miscellaneous" group, or create new
      let miscGroup = parsed.groups.find(g => 
        g.name.toLowerCase().includes('other') || 
        g.name.toLowerCase().includes('misc') ||
        g.name.toLowerCase().includes('unassigned')
      );
      
      if (miscGroup) {
        miscGroup.programIds = [...miscGroup.programIds, ...unassignedIds];
      } else {
        parsed.groups.push({
          id: `cluster-misc-${Date.now()}`,
          name: 'Other Programs',
          color: '#6b7280',
          programIds: unassignedIds,
          classification: 'private' as const,
          aiNotes: 'Programs that need to be manually assigned to appropriate groups.',
          preferredPlacement: { ground: false, podium: true, tower: true, standalone: false },
          splittable: { acrossLevels: true, acrossBuildings: true },
          derivedFromBrief: false,
        });
      }
    }
    
    return parsed;
  } catch {
    throw new Error('Failed to parse AI regroup response as JSON');
  }
}

export { isOpenAIConfigured } from './client';
