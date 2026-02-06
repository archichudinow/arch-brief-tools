/**
 * Brief Parsing Strategies
 * Different prompts and handlers for each input type
 */

// ============================================
// GENERATE MODE - For simple prompts (abstract level)
// ============================================

export const GENERATE_ABSTRACT_PROMPT = `You are an architectural programmer. Generate HIGH-LEVEL ZONES for a building program.

USER REQUEST:
{userInput}

CRITICAL INSTRUCTION:
Generate ONLY 4-8 major functional ZONES, NOT individual rooms.
Each zone will be further broken down in subsequent steps.

EXAMPLES OF CORRECT ZONE NAMING:
✓ "Guest Room Wing" (not "Standard Room", "Suite", "Bathroom")
✓ "Back-of-House Facilities" (not "Kitchen", "Storage", "Loading Dock")
✓ "Public Amenities Zone" (not "Restaurant", "Bar", "Lounge")
✓ "Outdoor Recreation Area" (not "Pool", "Tennis Court", "Garden")
✓ "Parking & Arrival" (not "Parking Space x50")

WRONG (TOO DETAILED):
✗ "Reception Lobby", "Conference Room", "Private Office", "Restroom"

TYPOLOGY ZONE STANDARDS:
- Hotel: Guest Rooms Wing (60-70%), Public/Lobby Zone (10-15%), F&B Zone (10-15%), Back-of-House (10-15%), Outdoor Amenities (varies)
- Office: Work Zone (60-70%), Meeting Zone (15-20%), Support Zone (15-20%)
- Residential: Units Zone (65-75%), Common Zone (15-25%), Services Zone (10-15%)

OUTPUT FORMAT (JSON only):
{
  "interpretation": "How I understood the request",
  "buildingType": "hotel | office | residential | retail | cultural | mixed",
  "targetArea": 10000,
  "areas": [
    { "name": "Guest Room Wing", "percentage": 55, "groupHint": "Accommodation", "aiNote": "All guest accommodations - to be detailed" },
    { "name": "Public Lobby & Arrival Zone", "percentage": 10, "groupHint": "Public", "aiNote": "Entry experience - to be detailed" },
    { "name": "Food & Beverage Zone", "percentage": 12, "groupHint": "F&B", "aiNote": "All restaurants/bars - to be detailed" },
    { "name": "Back-of-House Facilities", "percentage": 13, "groupHint": "BOH", "aiNote": "Service areas - to be detailed" },
    { "name": "Outdoor Amenities Area", "percentage": 10, "groupHint": "Outdoor", "aiNote": "Pool, gardens, terraces - to be detailed" }
  ],
  "detectedGroups": [],
  "assumptions": ["Generated high-level zones for recursive detailing"],
  "projectContext": "5-star hotel in Dubai with premium amenities"
}

REMEMBER:
- Generate 4-8 ZONES only, not individual rooms
- Percentages sum to 100
- Each zone must be broad enough to contain multiple sub-spaces
`;

// ============================================
// GENERATE MODE - For simple prompts (detailed level)
// ============================================

export const GENERATE_PROMPT = `You are an architectural programmer. Generate a building program based on user requirements.

USER REQUEST:
{userInput}

INSTRUCTIONS:
1. Understand the building type, scale, and user intent
2. Apply standard space ratios for this typology
3. Generate a complete program with logical groups and areas
4. Include circulation, services, and support spaces
5. Output PERCENTAGES, not m² values - code will calculate exact areas

TYPOLOGY STANDARDS (as percentage of total):
- Office: Workstations 50-60%, Meeting 10-15%, Circulation 15-20%, Support 10-15%
- Residential: Units 60-70%, Common 15-20%, Circulation 10-15%, Services 5-10%
- Retail: Sales floor 65-75%, Back-of-house 20-30%, Circulation 5-10%
- Hotel: Guest rooms 60-70%, F&B 10-15%, Lobby/public 5-10%, BOH 10-15%
- Cultural: Public/exhibit 50-60%, Support 15-25%, Circulation 15-20%
- Educational: Classrooms 40-50%, Labs/workshops 15-20%, Circulation 20-30%, Admin 10%

CRITICAL: Output percentages that sum to 100. Code will multiply by target to get exact m².

OUTPUT FORMAT (JSON only):
{
  "interpretation": "How I understood the request",
  "buildingType": "office | residential | retail | hotel | cultural | educational | mixed",
  "targetArea": 5000,
  "areas": [
    { "name": "Open Workstations", "percentage": 45, "groupHint": "Work Areas", "aiNote": "Based on ~8m² per workstation" },
    { "name": "Private Offices", "percentage": 10, "groupHint": "Work Areas", "aiNote": "For managers/directors" },
    { "name": "Meeting Rooms", "percentage": 12, "groupHint": "Work Areas", "aiNote": "Mix of sizes" },
    { "name": "Reception & Lobby", "percentage": 5, "groupHint": "Public", "aiNote": "First impression space" },
    { "name": "Break Room & Pantry", "percentage": 6, "groupHint": "Amenities" },
    { "name": "Restrooms", "percentage": 4, "groupHint": "Services" },
    { "name": "Storage & MEP", "percentage": 6, "groupHint": "Services" },
    { "name": "Circulation", "percentage": 12, "groupHint": "Circulation" }
  ],
  "detectedGroups": [
    { "name": "Work Areas", "color": "#3b82f6", "areaNames": ["Open Workstations", "Private Offices", "Meeting Rooms"] },
    { "name": "Amenities", "color": "#22c55e", "areaNames": ["Break Room & Pantry"] },
    { "name": "Services", "color": "#f59e0b", "areaNames": ["Restrooms", "Storage & MEP"] }
  ],
  "assumptions": [
    "Assumed standard office layout",
    "Used 8m² per workstation (open plan)"
  ],
  "projectContext": "Office for approximately N people with standard amenities",
  "suggestions": [
    "Consider adding focus rooms if budget allows"
  ]
}

REMEMBER: percentages must sum to 100. The code will calculate: areaPerUnit = (percentage / 100) × targetArea
`;

// ============================================
// EXTRACT TOLERANT - For dirty briefs
// ============================================

export const EXTRACT_TOLERANT_PROMPT = `Extract building spaces from this brief. The text may be messy or incomplete.

BRIEF TEXT:
{userInput}

INSTRUCTIONS:
1. Find ALL mentions of spaces/rooms with areas or counts
2. If area is missing but count is given, estimate area from typology
3. If count is missing, default to 1
4. Flag anything uncertain with low confidence
5. Look for any totals mentioned (even informally like "about 1000m2 total")

HANDLING AMBIGUITY:
- "about 20 offices" → count: 20, confidence: 0.7
- "15m2 each" → areaPerUnit: 15, confidence: 0.9
- "some storage" → estimate based on program, confidence: 0.4
- "offices, meeting rooms, and a café" → extract each, infer sizes

WHEN VALUES ARE UNCLEAR:
- "large lobby" → 100-200 m² depending on program size
- "small meeting room" → 15-25 m²
- "standard office" → 12-15 m²
- "open workspace for 30 people" → 30 × 8-10 m² = 240-300 m²

OUTPUT FORMAT (JSON only):
{
  "areas": [
    { 
      "name": "Offices", 
      "areaPerUnit": 15, 
      "count": 20,
      "confidence": 0.8,
      "source": "about 20 offices, maybe 15m2 each",
      "inferred": false
    },
    {
      "name": "Storage",
      "areaPerUnit": 30,
      "count": 1,
      "confidence": 0.4,
      "source": "some storage",
      "inferred": true,
      "inferenceReason": "Estimated at ~5% of office area"
    }
  ],
  "detectedGroups": [
    { "name": "Work Areas", "color": "#3b82f6", "areaNames": ["Offices", "Workstations"] }
  ],
  "statedTotals": [
    { "text": "about 500m2 total", "value": 500 }
  ],
  "parsedTotal": 485,
  "lowConfidenceItems": [
    { "name": "Storage", "reason": "Size not specified" }
  ],
  "ambiguities": [
    "Storage size estimated - please verify",
    "Meeting room count unclear - assumed 2"
  ],
  "projectContext": "Small office with basic amenities"
}
`;

// ============================================
// RECONCILIATION - When totals don't match
// ============================================

export const RECONCILIATION_PROMPT = `The parsed brief has a discrepancy between stated and calculated totals.

PARSED AREAS:
{parsedAreas}

STATED TOTALS:
- Net Total (NVO/NLA): {netTotal} m²
- Gross Total (GFA/GIA): {grossTotal} m²
- Net-to-Gross Factor: {netToGrossFactor}

CALCULATED TOTAL: {parsedTotal} m²
DISCREPANCY FROM NET: {netDiscrepancy} m² ({netDirection})
DISCREPANCY FROM GROSS: {grossDiscrepancy} m² ({grossDirection})

IMPORTANT - UNDERSTAND THE TOTALS:
1. NET (NVO/NLA) = Usable floor area (what we're parsing)
2. GROSS (GFA/GIA) = Net + Circulation + Walls + MEP
3. If Net-to-Gross Factor is stated (e.g., 1.45), the client already calculated circulation
4. DO NOT add circulation if a net-to-gross factor is provided

TASK: Identify what might be missing from the PARSED areas.

COMMON CAUSES (prioritize based on context):
1. If parsed << net: Items not being extracted correctly (check each section)
2. If parsed ≈ net: Likely all items extracted - gross difference is the factor
3. If parsed > net: Possible double-counting of subtotals as items
4. Outdoor areas may be in a separate section

SECTION VALIDATION:
- Check subtotals match stated section totals
- Flag any section where parsed != stated

OUTPUT FORMAT (JSON only):
{
  "analysis": "The parsed total is X short/over the NET total",
  "calculatedSum": 4247,
  "statedNetTotal": 4257,
  "statedGrossTotal": 6173,
  "netToGrossFactor": 1.45,
  "differenceFromNet": -10,
  "differenceFromGross": -1926,
  "sectionValidation": [
    { "section": "Client Facilities", "parsed": 3128, "stated": 3128, "match": true },
    { "section": "General Facilities", "parsed": 368, "stated": 368, "match": true }
  ],
  "likelyCauses": [
    {
      "cause": "Gross total includes circulation via factor",
      "probability": 0.95,
      "reasoning": "Net-to-Gross Factor 1.45 accounts for 1926m² (45% of 4257)"
    }
  ],
  "suggestions": [],
  "skipCirculationAddition": true,
  "adjustedTotal": 4247,
  "remainingDiscrepancy": 10,
  "note": "Do NOT add circulation - client's factor already accounts for it"
}
`;

// ============================================
// GARBAGE/INVALID INPUT RESPONSE
// ============================================

export const INVALID_INPUT_RESPONSE = {
  areas: [],
  detectedGroups: [],
  parsedTotal: 0,
  projectContext: '',
  ambiguities: [
    'The input does not appear to contain a valid building program',
    'Please provide space names with areas (e.g., "Lobby 100m², Offices 500m²")',
    'Or describe what you want to create (e.g., "Create an office for 50 people")'
  ],
};

// ============================================
// REDIRECT TO AGENT RESPONSE (for generation prompts)
// ============================================

export const REDIRECT_TO_AGENT_RESPONSE = {
  areas: [],
  detectedGroups: [],
  parsedTotal: 0,
  projectContext: '',
  isRedirectToAgent: true,
  ambiguities: [
    'This looks like a generation request rather than a brief to parse',
    'Please use the Agent Chat to generate building programs from prompts',
    'The Brief Parser is designed to extract areas from existing briefs/documents',
    'Switch to Agent Chat mode and enter your request there'
  ],
};

// ============================================
// UNFOLD AREA PROMPT - For recursive detail expansion
// ============================================

export const UNFOLD_AREA_PROMPT = `You are an architectural programmer. Analyze this area and decide if it should be broken down into more specific sub-areas.

PARENT AREA:
Name: {areaName}
Area: {areaSize} m²
Context: {projectContext}
Current depth: {currentDepth}

INSTRUCTIONS:
1. Determine if this area is TERMINAL (no further breakdown needed) or should UNFOLD into sub-areas
2. An area is TERMINAL if:
   - It's a single-purpose room (toilet, closet, individual office, hotel room)
   - It's naturally large but specific (football field, concert hall, warehouse floor)
   - It's already at maximum practical detail
   - Area is < 20m² and is a single room type
3. An area should UNFOLD if:
   - It's abstract/categorical (e.g., "Indoor Facilities", "Support Areas", "Amenities")
   - It's large (> 200m²) AND represents multiple spaces
   - Breaking it down would add clarity to the program

SIZING GUIDELINES for unfold:
- Sub-areas should sum to approximately the parent area
- Use percentages that sum to 100%
- Typical sub-area count: 3-8 for unfold

TERMINAL AREA EXAMPLES (do NOT unfold):
- "Football Field" (2000m²) - specific sports venue
- "Hotel Room" (30m²) - individual unit
- "Restroom" (15m²) - single function
- "Storage Room" (20m²) - utility space
- "Parking Space" (12.5m²) - single unit
- "Conference Hall" (500m²) - large but singular purpose

UNFOLD EXAMPLES (SHOULD unfold):
- "Indoor Facilities" (5000m²) → Gym, Changing Rooms, Equipment Storage, etc.
- "Support Areas" (1500m²) → Admin Office, Storage, Maintenance, Staff Room
- "F&B Areas" (800m²) → Restaurant, Café, Kitchen, Storage
- "Amenities" (600m²) → Gym, Lounge, Game Room

OUTPUT FORMAT (JSON only):
{
  "decision": "terminal" | "unfold",
  "reasoning": "Why this decision was made",
  "subAreas": [
    // Only if decision is "unfold"
    { "name": "Sub Area Name", "percentage": 40, "aiNote": "Brief explanation" }
  ]
}`;

// ============================================
// HELPER FUNCTIONS
// ============================================

export function formatAreasForReconciliation(areas: Array<{ name: string; areaPerUnit: number; count: number }>): string {
  return areas.map(a => {
    const total = a.areaPerUnit * a.count;
    return `- ${a.name}: ${a.count > 1 ? `${a.count} × ` : ''}${a.areaPerUnit} m² = ${total} m²`;
  }).join('\n');
}

export function buildPrompt(
  template: string, 
  values: Record<string, string | number>
): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

// Confidence threshold for auto-accept vs user review
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85,    // Auto-accept
  MEDIUM: 0.6,   // Accept with note
  LOW: 0.4,      // Flag for review
};

// Default colors for groups
export const GROUP_COLORS = [
  '#3b82f6', // blue
  '#f97316', // orange
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#ef4444', // red
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#6366f1', // indigo
];
