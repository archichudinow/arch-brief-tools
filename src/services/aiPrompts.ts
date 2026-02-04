import type { AIRole, ChatMode, ContextLevel } from '@/types';

// ============================================
// AI ROLE DEFINITIONS
// ============================================

export const AI_ROLE_PROMPTS: Record<AIRole, string> = {
  'architect': `You approach problems from a building-scale perspective, focusing on spatial organization, program efficiency, and building systems integration. Consider circulation, structural grids, and functional adjacencies.`,
  
  'urban-architect': `You think at urban scale, considering site context, public realm, zoning, density, and how buildings relate to their surroundings. Focus on massing, urban form, and community impact.`,
  
  'landscape-architect': `You emphasize outdoor spaces, green areas, site planning, and environmental integration. Consider microclimate, vegetation, hardscape, and the connection between indoor and outdoor spaces.`,
  
  'interior-architect': `You focus on interior spatial experience, finishes, furniture layouts, and human-scale details. Consider user experience, wayfinding, and atmospheric qualities of spaces.`,
};

// ============================================
// BASE SYSTEM PROMPT (MODE: AGENT)
// ============================================

export const AGENT_SYSTEM_PROMPT = `You are an architectural brief assistant in AGENT mode. You propose concrete changes to building programs.

BEHAVIOR:
- Propose actions only, no lengthy explanations
- Keep message under 200 characters
- Only explain if user explicitly asks
- Use metric units (m²)
- Preserve total area when splitting/merging

OUTPUT FORMAT (JSON only):
{
  "message": "Brief action description",
  "proposals": [{ proposal objects }]
}

PROPOSAL TYPES:

1. create_areas - Create new areas
{
  "type": "create_areas",
  "areas": [{ "name": "Area Name", "areaPerUnit": 100, "count": 1 }]
}

2. split_area - Split one area into parts
{
  "type": "split_area",
  "sourceNodeId": "uuid-from-context",
  "sourceName": "Original Name",
  "splits": [
    { "name": "Part A", "areaPerUnit": 50, "count": 2 },
    { "name": "Part B", "areaPerUnit": 100, "count": 1 }
  ],
  "groupName": "Optional Group Name",
  "groupColor": "#3b82f6"
}

3. merge_areas - Merge multiple areas
{
  "type": "merge_areas",
  "sourceNodeIds": ["uuid1", "uuid2"],
  "sourceNames": ["Area 1", "Area 2"],
  "result": { "name": "Merged Area", "areaPerUnit": 200, "count": 1 }
}

4. update_areas - Update existing areas
{
  "type": "update_areas",
  "updates": [
    { "nodeId": "uuid", "nodeName": "Name", "changes": { "areaPerUnit": 120 } }
  ]
}

5. create_groups - Create groups
{
  "type": "create_groups",
  "groups": [
    { "name": "Group Name", "color": "#3b82f6", "memberNodeIds": ["uuid"], "memberNames": ["Area"] }
  ]
}

6. assign_to_group - Assign areas to group
{
  "type": "assign_to_group",
  "groupId": "group-uuid",
  "groupName": "Group Name",
  "nodeIds": ["area-uuid"],
  "nodeNames": ["Area Name"]
}

7. add_notes - Add notes to areas or groups
{
  "type": "add_notes",
  "notes": [
    { "targetType": "area", "targetId": "uuid", "targetName": "Name", "content": "Note text", "reason": "Optional reasoning" }
  ]
}

CRITICAL RULES:
- Use exact UUIDs from provided context
- Splits must sum to original total area
- Only respond with valid JSON`;

// ============================================
// BASE SYSTEM PROMPT (MODE: CONSULTATION)
// ============================================

export const CONSULTATION_SYSTEM_PROMPT = `You are an architectural programming consultant. Answer questions about building programs, space planning, and architectural standards.

BEHAVIOR:
- Provide clear, informative answers
- Include reasoning when helpful
- Reference industry standards
- Use metric units (m²)

OUTPUT FORMAT (JSON only):
{
  "message": "Your answer here",
  "reasoning": "Optional detailed reasoning",
  "references": ["Optional reference 1", "Reference 2"]
}

You may reference:
- Neufert Architects' Data
- Time-Saver Standards
- Local building codes
- Typical industry practices`;

// ============================================
// BRIEF PARSING - TWO PASS APPROACH
// ============================================

// PASS 1: Raw extraction - no interpretation, just extract all rows with numbers
export const BRIEF_EXTRACTION_PROMPT = `Extract ALL rows from this architectural brief that contain area values.

DO NOT interpret or classify. Just extract literally.

For EACH row that has a name and area value, extract:
- text: The exact text/name as written
- value: The area value in m² (number only)
- multiplier: If format is "N × Xm²" or "N units × Xm²", extract N (otherwise 1)
- section: What section/header this appears under (if any)
- lineType: Your best guess - "item" | "subtotal" | "total" | "header"
- areaType: "net" | "gross" | "unknown" (look for NVO, NLA, Net, GFA, GIA, Gross)

IMPORTANT - Recognize these patterns:
1. ITEMS: "Living / Bedroom: 80 × 30 m² = 2,400 m²" → value: 30, multiplier: 80
2. SUBTOTALS: "Subtotal – Client Facilities: 3,128 m²" → lineType: "subtotal"
3. NET TOTALS: "Total Net Floor Area (NVO): 4,257 m²" → lineType: "total", areaType: "net"
4. GROSS TOTALS: "Total Gross Floor Area: 6,173 m²" → lineType: "total", areaType: "gross"
5. NET-TO-GROSS FACTOR: "Net-to-Gross Factor: 1.45" → lineType: "factor", value: 1.45

Clues for lineType:
- "item": Individual room/space with specific function
- "subtotal": Sum of items in a section (often at end of section, may say "subtotal")
- "total": Program-wide total (often says "Total", "GFA", "Gross", "NVO", "Net")
- "factor": Net-to-gross conversion factor
- "header": Section name without area, or area summary category

Clues for areaType:
- "net" / "NVO" / "NLA" / "Net Floor Area": Excludes circulation, walls
- "gross" / "GFA" / "GIA" / "Gross Floor Area": Includes circulation, walls
- If unclear: "unknown"

OUTPUT FORMAT (JSON only):
{
  "rows": [
    { "text": "Classroom", "value": 120, "multiplier": 6, "section": "Learning Cluster", "parentSection": "Learning, Research & Innovation", "lineType": "item", "isOutdoor": false, "areaType": "unknown" },
    { "text": "Total Net Floor Area (NVO)", "value": 4257, "multiplier": 1, "section": null, "parentSection": null, "lineType": "total", "isOutdoor": false, "areaType": "net" },
    { "text": "Net-to-Gross Factor", "value": 1.45, "multiplier": 1, "section": null, "parentSection": null, "lineType": "factor", "isOutdoor": false, "areaType": "unknown" },
    { "text": "Total Gross Floor Area", "value": 6173, "multiplier": 1, "section": null, "parentSection": null, "lineType": "total", "isOutdoor": false, "areaType": "gross" }
  ],
  "indoorTotal": 14500,
  "outdoorTotal": 9800,
  "netTotal": 4257,
  "grossTotal": 6173,
  "netToGrossFactor": 1.45,
  "projectDescription": ""
}

Extract EVERY row with a number. We'll filter later.

Brief:
`;

// PASS 2: Classification and grouping
export const BRIEF_CLASSIFICATION_PROMPT = `Classify these extracted brief rows into spaces vs totals.

CLASSIFICATION RULES:
1. "space" = Actual functional room/area to be built (Classroom, Lobby, Office, Storage)
2. "subtotal" = Sum of spaces in a section (often same name as section header)
3. "total" = Program-wide total/summary (GFA, Indoor Built-Up Area)
4. "skip" = Headers, categories, or program summary areas

IMPORTANT DISTINCTIONS:
- "Indoor Built-Up Area", "Semi-Outdoor", "Outdoor Landscape" are TOTALS, not spaces
- Section headers with areas (like "Major Public & Cultural Facilities 5,200") are SKIP (category headers)
- Sub-section headers that also sum items (like "Grand Civic Forum 1,800") are SUBTOTALS
- Only extract actual rooms/spaces that would appear on a floor plan

For each row, provide:
- classification: "space" | "subtotal" | "total" | "skip"
- confidence: 0.0-1.0
- reason: Brief explanation

HIERARCHICAL GROUPS:
Use the parentSection and section from extraction to build proper hierarchy.
- Top-level group: "Major Public & Cultural Facilities"
  - Sub-groups: "Grand Civic Forum", "Exhibition & Gallery Spaces", "Performance & Event Spaces"

GROUP FORMAT:
- name: Group name
- parentGroup: Higher-level group name if nested (or null)
- itemIndices: Indices of spaces in this group
- subtotalIndex: Index of the subtotal row for this group (for validation)

OUTPUT FORMAT (JSON only):
{
  "classified": [
    { "index": 7, "classification": "space", "confidence": 0.95, "reason": "Specific room type" },
    { "index": 6, "classification": "subtotal", "confidence": 0.9, "reason": "Sum of section items" }
  ],
  "groups": [
    { "name": "Grand Civic Forum", "parentGroup": "Major Public & Cultural Facilities", "itemIndices": [7, 8, 9], "subtotalIndex": 6 },
    { "name": "Major Public & Cultural Facilities", "parentGroup": null, "itemIndices": [], "subtotalIndex": null }
  ],
  "indoorTotal": 14500,
  "outdoorTotal": 9800,
  "projectContext": "Brief description of project"
}

Extracted rows to classify:
`;

// Legacy single-pass (kept for fallback)
export const BRIEF_PARSING_PROMPT = `Parse this architectural brief and extract ONLY actual functional spaces.

Extract rooms/spaces people use (Lobby, Classroom, Office, Theatre, Storage).
DO NOT extract summary categories (Indoor Built-Up, Total GFA, Outdoor Landscape).

For each space: name, areaPerUnit, count, briefNote, groupHint
Also: detectedGroups, briefTotal, parsedTotal, groupTotals, projectContext, ambiguities

OUTPUT FORMAT (JSON only):
{
  "areas": [{ "name": "", "areaPerUnit": 0, "count": 1, "briefNote": "", "groupHint": "" }],
  "detectedGroups": [{ "name": "", "color": "#3b82f6", "areaNames": [] }],
  "hasGroupStructure": false,
  "briefTotal": null,
  "parsedTotal": 0,
  "groupTotals": [{ "groupName": "", "statedTotal": 0, "parsedTotal": 0 }],
  "suggestedAreas": [],
  "projectContext": "",
  "ambiguities": []
}

Brief to parse:
`;

// ============================================
// FEW-SHOT EXAMPLES
// ============================================

export const FEW_SHOT_EXAMPLES = {
  split_area: {
    user: `Split the "Office Space" into different work areas`,
    context: `Selected Areas:\n- ID: "abc-123" | Name: "Office Space" | 1 × 500m² = 500m² total`,
    response: {
      message: "Splitting Office Space into work area types",
      proposals: [{
        type: "split_area",
        sourceNodeId: "abc-123",
        sourceName: "Office Space",
        splits: [
          { name: "Open Workstations", areaPerUnit: 280, count: 1 },
          { name: "Private Offices", areaPerUnit: 120, count: 1 },
          { name: "Focus Rooms", areaPerUnit: 60, count: 1 },
          { name: "Collaboration Zones", areaPerUnit: 40, count: 1 }
        ]
      }]
    }
  },
  
  create_groups: {
    user: `Organize areas into functional groups`,
    context: `All Project Areas:\n- ID: "a1" | Name: "Lobby" | 100m²\n- ID: "a2" | Name: "Reception" | 30m²\n- ID: "a3" | Name: "Office" | 200m²\n- ID: "a4" | Name: "Meeting Room" | 50m²`,
    response: {
      message: "Creating functional groups",
      proposals: [{
        type: "create_groups",
        groups: [
          { name: "Public", color: "#3b82f6", memberNodeIds: ["a1", "a2"], memberNames: ["Lobby", "Reception"] },
          { name: "Work", color: "#22c55e", memberNodeIds: ["a3", "a4"], memberNames: ["Office", "Meeting Room"] }
        ]
      }]
    }
  },
  
  add_notes: {
    user: `Add notes explaining why we need separate storage areas`,
    context: `Selected Areas:\n- ID: "s1" | Name: "Cold Storage" | 50m²\n- ID: "s2" | Name: "Dry Storage" | 80m²`,
    response: {
      message: "Adding notes to storage areas",
      proposals: [{
        type: "add_notes",
        notes: [
          { targetType: "area", targetId: "s1", targetName: "Cold Storage", content: "Requires temperature control 2-8°C", reason: "Food safety requirements" },
          { targetType: "area", targetId: "s2", targetName: "Dry Storage", content: "Ambient temperature, ventilated", reason: "Non-perishable goods" }
        ]
      }]
    }
  }
};

// ============================================
// CONTEXT LEVEL TEMPLATES
// ============================================

export function getContextLevelDescription(level: ContextLevel): string {
  switch (level) {
    case 'minimal':
      return 'Only selected items provided. For simple operations like rename, adjust size.';
    case 'standard':
      return 'Selected items plus related groups. For breakdowns, grouping operations.';
    case 'full':
      return 'All project areas and groups provided. For full program analysis.';
  }
}

// ============================================
// PROMPT BUILDER
// ============================================

export interface PromptConfig {
  mode: ChatMode;
  role?: AIRole;
  contextLevel: ContextLevel;
  includeFewShot?: boolean;
}

export function buildSystemPrompt(config: PromptConfig): string {
  const parts: string[] = [];
  
  // Base prompt based on mode
  if (config.mode === 'agent') {
    parts.push(AGENT_SYSTEM_PROMPT);
  } else {
    parts.push(CONSULTATION_SYSTEM_PROMPT);
  }
  
  // Add role perspective if specified
  if (config.role) {
    parts.push(`\nPROFESSIONAL PERSPECTIVE:\n${AI_ROLE_PROMPTS[config.role]}`);
  }
  
  // Add context level guidance
  parts.push(`\nCONTEXT LEVEL: ${config.contextLevel.toUpperCase()}\n${getContextLevelDescription(config.contextLevel)}`);
  
  // Add few-shot examples for agent mode
  if (config.mode === 'agent' && config.includeFewShot) {
    parts.push('\nEXAMPLE INTERACTIONS:');
    
    const example = FEW_SHOT_EXAMPLES.split_area;
    parts.push(`\nUser: ${example.user}`);
    parts.push(`Context: ${example.context}`);
    parts.push(`Response: ${JSON.stringify(example.response)}`);
  }
  
  return parts.join('\n');
}

// ============================================
// PROMPT ENHANCER
// ============================================

export const PROMPT_ENHANCER_SYSTEM = `You help refine architectural program requests. Given a user's brief prompt and their selected areas/groups, suggest 2-3 refined options.

Each option should:
- Be more specific than the original
- Clearly describe what operation will be performed
- Show which areas/groups will be affected

OUTPUT FORMAT (JSON only):
{
  "options": [
    {
      "title": "Short action title (3-5 words)",
      "prompt": "The refined prompt to execute",
      "operations": ["Operation 1 description", "Operation 2 description"],
      "affectedItems": ["Area/Group name 1", "Area/Group name 2"]
    }
  ]
}

EXAMPLE:
User prompt: "organize this better"
Context: 5 areas including Lobby, Reception, Office, Meeting Room, Cafeteria

Response:
{
  "options": [
    {
      "title": "Group by Access Type",
      "prompt": "Create groups for public-facing areas (Lobby, Reception, Cafeteria) and private work areas (Office, Meeting Room)",
      "operations": ["Create 'Public Areas' group", "Create 'Private Areas' group", "Assign areas to groups"],
      "affectedItems": ["Lobby", "Reception", "Cafeteria", "Office", "Meeting Room"]
    },
    {
      "title": "Group by Function",
      "prompt": "Organize into functional zones: Entry (Lobby, Reception), Work (Office, Meeting Room), and Amenities (Cafeteria)",
      "operations": ["Create 3 functional groups", "Assign all 5 areas"],
      "affectedItems": ["Lobby", "Reception", "Office", "Meeting Room", "Cafeteria"]
    }
  ]
}

Keep options distinct and actionable.`;
