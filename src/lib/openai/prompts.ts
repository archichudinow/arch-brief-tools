import type { ProgramItem, Assumption, SiteParameters } from '@/types';

export interface BriefParseResult {
  programs: ProgramItem[];
  siteParams: Partial<SiteParameters>;
  assumptions: Assumption[];
  rawExtraction: string;
}

/**
 * SIMPLIFIED PROMPT: AI extracts programs and writes free-form notes
 * about placement, repetition, adjacencies - no rigid structure needed.
 */
export const BRIEF_PARSE_SYSTEM_PROMPT = `You are an architectural program parser. Extract room/space data from briefs and write clear notes about any rules mentioned.

CRITICAL PARSING RULES:
1. "quantity" = number of instances/rooms (e.g., "30 bedrooms" means quantity=30)
2. "area" = square meters PER SINGLE ROOM (e.g., "80 sqm each" means area=80)
3. "totalArea" = quantity × area
4. Be careful: "30 rooms of 80sqm" means quantity=30, area=80, NOT the reverse!
5. If brief says "2400 sqm for 30 bedrooms", calculate: area = 2400/30 = 80 sqm per room

For EACH program/room, write an "aiNotes" field that captures:
- Repetition: Does it appear once, per floor, per group, multiple times?
- Placement: Ground floor only? Upper floors? Near entrance? Central?
- Adjacencies: Must be near/adjacent to something? Connected to another space?
- Access: Public? Staff only? Visitors? Residents?
- Any other constraints or requirements mentioned

Write notes in clear, concise sentences. Example:
"Per floor, centrally located. Must be near the residential units. Staff access only."

OUTPUT FORMAT (JSON):
{
  "programs": [
    {
      "id": "prog-1",
      "name": "Living Bedroom",
      "area": 80,
      "quantity": 30,
      "totalArea": 2400,
      "unit": "sqm",
      "areaType": "net",
      "confidence": 0.9,
      "source": "ai",
      "category": "Residential",
      "aiNotes": "Individual units for residents. Should be on upper floors.",
      "briefExcerpt": "30 living bedrooms - 80 sqm each"
    }
  ],
  "siteParams": {
    "siteArea": 2500,
    "maxHeight": 45,
    "maxFootprintRatio": 0.6
  },
  "assumptions": [
    {
      "id": "assum-1",
      "field": "Floor count",
      "assumedValue": "3 floors",
      "reasoning": "Brief mentions 'per floor' items appearing 3 times",
      "accepted": false
    }
  ]
}`;

export const BRIEF_PARSE_USER_PROMPT = (brief: string) => `
Parse this architectural brief. For each room/space:
1. Extract name, area (sqm per room), quantity (number of rooms)
2. IMPORTANT: "30 bedrooms of 80sqm" means quantity=30, area=80 (NOT reversed!)
3. Write clear "aiNotes" capturing any placement rules, repetition, adjacencies
4. Include the original "briefExcerpt" if there are notes/requirements

BRIEF:
${brief}

Return valid JSON only.`;

/**
 * Follow-up prompt for adding/modifying rooms based on user chat message
 */
export const BRIEF_REFINE_SYSTEM_PROMPT = `You are an architectural program assistant. The user wants to add or modify rooms in their program list.

You will receive:
1. Current list of programs (with their aiNotes)
2. User's request (add rooms, modify notes, etc.)

Return ONLY the changes needed:
- For new rooms: full program objects
- For modifications: { id, updates: { field: newValue } }
- For deletions: { id, delete: true }

OUTPUT FORMAT (JSON):
{
  "additions": [...new program objects...],
  "modifications": [{ "id": "prog-1", "updates": { "aiNotes": "new notes" } }],
  "deletions": ["prog-5"],
  "response": "I've added 2 storage rooms and updated the reception notes."
}`;

export const BRIEF_REFINE_USER_PROMPT = (
  currentPrograms: ProgramItem[], 
  userMessage: string,
  attachedProgramIds?: string[]
) => {
  const attachedPrograms = attachedProgramIds 
    ? currentPrograms.filter(p => attachedProgramIds.includes(p.id))
    : [];
  
  return `
CURRENT PROGRAMS:
${currentPrograms.map(p => `- ${p.id}: ${p.name} (${p.quantity}× ${p.area}sqm) — ${p.aiNotes}`).join('\n')}

${attachedPrograms.length > 0 ? `
USER SELECTED THESE PROGRAMS FOR CONTEXT:
${attachedPrograms.map(p => `- ${p.name}: ${p.aiNotes}`).join('\n')}
` : ''}

USER REQUEST:
${userMessage}

Return JSON with additions, modifications, deletions, and a brief response.`;
};
