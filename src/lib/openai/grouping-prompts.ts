import type { FunctionalGroup, ProgramItem } from '@/types';

export interface GroupingProposalResult {
  groups: FunctionalGroup[];
  reasoning?: string;
  response?: string;
  newPrograms?: ProgramItem[];
}

/**
 * SIMPLIFIED: AI groups programs and explains logic in natural language notes.
 * No complex cluster types or bindings - just clear explanations.
 */
export const GROUPING_SYSTEM_PROMPT = `You are an architectural program analyst. Group rooms/spaces logically and explain your reasoning in clear notes.

For EACH group, write "aiNotes" explaining:
- Why these programs belong together
- Placement logic (ground floor, per floor, tower, etc.)
- Relationships with other groups
- Any repetition or distribution rules

Keep notes concise but complete. Example:
"Core services that must appear on every floor. Includes toilets, storage, and utility rooms. Should be centrally located for equal access from residential units."

OUTPUT FORMAT (JSON):
{
  "groups": [
    {
      "id": "group-1",
      "name": "Residential Units",
      "color": "#3b82f6",
      "programIds": ["prog-1", "prog-2", "prog-3"],
      "classification": "private",
      "aiNotes": "Living spaces for residents. 8 units total, distributed across upper floors. Each unit contains bedroom, bathroom, and shared living room. Should be above the public/service floors."
    },
    {
      "id": "group-2", 
      "name": "Per-Floor Services",
      "color": "#a855f7",
      "programIds": ["prog-10", "prog-11"],
      "classification": "semi-public",
      "aiNotes": "Support spaces that repeat on each floor. Includes lockers, sink room, storage. Centrally located for access from all units on the floor."
    }
  ],
  "reasoning": "Brief overview of the grouping strategy..."
}

COLOR PALETTE:
- Public: #22c55e (green)
- Semi-public: #eab308 (yellow)
- Private residential: #3b82f6 (blue)
- Private office: #6366f1 (indigo)
- Service/support: #a855f7 (purple)
- Technical/parking: #6b7280 (gray)
- Medical/care: #ec4899 (pink)
- Reception/anchor: #f97316 (orange)`;

export const GROUPING_USER_PROMPT = (programs: ProgramItem[]) => `
Group these programs logically. Read each program's aiNotes carefully - they contain placement rules from the brief.

PROGRAMS:
${programs.map(p => `- ${p.id}: ${p.name}
    ${p.quantity}× ${p.area}sqm = ${p.totalArea}sqm total
    Category: ${p.category || 'uncategorized'}
    AI Notes: ${p.aiNotes || 'none'}`).join('\n\n')}

Create logical groups and write clear aiNotes for each explaining:
- Why these belong together
- Placement and repetition logic
- Relationships with other groups

Return valid JSON only.`;

/**
 * Prompt for regrouping based on user feedback
 */
export const REGROUP_SYSTEM_PROMPT = `You are an architectural program analyst. The user wants to adjust the program groupings.

You will receive:
1. Current groups (with their aiNotes and programIds)
2. All programs (with their aiNotes and quantity)
3. User's request for changes

CRITICAL RULES FOR SPLITTING/REDISTRIBUTION:
1. When SPLITTING a group into N smaller groups:
   - You MUST put the actual program IDs into each new group's "programIds" array
   - REDISTRIBUTE programs across the new groups, don't leave them empty!
   - If original group has programs ["prog-1", "prog-2", "prog-3", "prog-4"], splitting into 2 means:
     - Group A gets ["prog-1", "prog-2"]
     - Group B gets ["prog-3", "prog-4"]
   - NEVER create groups with empty programIds arrays!

2. EVERY original program ID must appear in exactly ONE group's programIds array
   - Don't lose any programs - they must all be assigned
   - Don't duplicate program IDs across groups

3. For "per group" items that need new instances, return them in "newPrograms" array

COMPLETE EXAMPLE - Splitting a residential group with 4 bedrooms into 2 clusters:

INPUT:
- Group "Residential" has programIds: ["bed-1", "bed-2", "bed-3", "bed-4", "living-1"]

OUTPUT:
{
  "groups": [
    {
      "id": "cluster-1",
      "name": "Residential Cluster A",
      "color": "#3b82f6",
      "programIds": ["bed-1", "bed-2"],
      "classification": "private",
      "aiNotes": "First residential cluster with 2 bedrooms"
    },
    {
      "id": "cluster-2", 
      "name": "Residential Cluster B",
      "color": "#60a5fa",
      "programIds": ["bed-3", "bed-4"],
      "classification": "private",
      "aiNotes": "Second residential cluster with 2 bedrooms"
    },
    {
      "id": "shared-services",
      "name": "Shared Services",
      "color": "#a855f7",
      "programIds": ["living-1"],
      "classification": "semi-public",
      "aiNotes": "Shared facilities serving both clusters"
    }
  ],
  "newPrograms": [],
  "response": "I've split residential into 2 clusters with 2 bedrooms each. The living room is now in a shared services group."
}

NOTICE: Each group has ACTUAL program IDs in programIds, not empty arrays!`;

export const REGROUP_USER_PROMPT = (
  groups: FunctionalGroup[],
  programs: ProgramItem[],
  userMessage: string,
  attachedProgramIds?: string[],
  attachedGroupIds?: string[]
) => {
  const attachedPrograms = attachedProgramIds 
    ? programs.filter(p => attachedProgramIds.includes(p.id))
    : [];
  const attachedGroups = attachedGroupIds
    ? groups.filter(g => attachedGroupIds.includes(g.id))
    : [];

  return `
CURRENT GROUPS:
${groups.map(g => {
  const groupPrograms = programs.filter(p => g.programIds.includes(p.id));
  return `- ${g.name} (${g.classification})
    Program IDs: [${g.programIds.join(', ')}]
    Programs: ${groupPrograms.map(p => `${p.name} (qty:${p.quantity}, ${p.area}sqm each)`).join(', ')}
    AI Notes: ${g.aiNotes}`;
}).join('\n\n')}

ALL PROGRAMS (${programs.length} total):
${programs.map(p => `- ${p.id}: ${p.name}
    Quantity: ${p.quantity}, Area: ${p.area}sqm each, Total: ${p.totalArea}sqm
    AI Notes: ${p.aiNotes || 'none'}
    User Notes: ${p.userNotes || 'none'}`).join('\n')}

${attachedPrograms.length > 0 ? `
USER SELECTED THESE PROGRAMS:
${attachedPrograms.map(p => `- ${p.id}: ${p.name} (qty:${p.quantity})`).join('\n')}
` : ''}

${attachedGroups.length > 0 ? `
USER SELECTED THESE GROUPS:
${attachedGroups.map(g => `- ${g.name}: ${g.aiNotes}`).join('\n')}
` : ''}

USER REQUEST:
${userMessage}

CRITICAL REMINDERS:
1. Every group MUST have programIds array with ACTUAL program IDs from the list above
2. NEVER create groups with empty programIds: [] - that means you forgot to assign programs!
3. When splitting: distribute the original programIds across the new groups
4. All ${programs.length} original program IDs must appear in exactly one group
5. If any programs don't fit the new structure, keep them in their original group or create a "Shared" group

Return JSON with groups (each with populated programIds!), newPrograms (if any), and response.`;
};
