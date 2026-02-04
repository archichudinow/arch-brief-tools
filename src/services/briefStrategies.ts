/**
 * Brief Parsing Strategies
 * Different prompts and handlers for each input type
 */

// ============================================
// GENERATE MODE - For simple prompts
// ============================================

export const GENERATE_PROMPT = `You are an architectural programmer. Generate a building program based on user requirements.

USER REQUEST:
{userInput}

INSTRUCTIONS:
1. Understand the building type, scale, and user intent
2. Apply standard space ratios for this typology
3. Generate a complete program with logical groups and areas
4. Include circulation, services, and support spaces
5. Use metric units (m²)

TYPOLOGY STANDARDS (adjust to scale):
- Office: 8-12 m² per workstation, 15-20% circulation, meeting rooms 10-15% of work area
- Residential: 30-50 m² per unit, 10-15% common circulation
- Retail: 70-80% sales floor, 20-30% back-of-house
- Hotel: 25-35 m² per room, F&B 15-20%, lobby 5-8%, BOH 15-20%
- Cultural: 50-60% public/exhibit, 20-25% support, 15-20% circulation
- Educational: 2-3 m² per student in classrooms, 30-40% circulation/common

OUTPUT FORMAT (JSON only):
{
  "interpretation": "How I understood the request",
  "buildingType": "office | residential | retail | hotel | cultural | educational | mixed",
  "targetArea": 1234,
  "assumptions": [
    "Assumed X because...",
    "Used Y standard for..."
  ],
  "areas": [
    { "name": "Open Workstations", "areaPerUnit": 250, "count": 1, "aiNote": "50 positions × 5m² direct + circulation" }
  ],
  "detectedGroups": [
    { "name": "Work Areas", "color": "#3b82f6", "areaNames": ["Open Workstations", "Private Offices"] }
  ],
  "parsedTotal": 1234,
  "breakdown": {
    "primaryFunction": { "percentage": 60, "area": 740 },
    "support": { "percentage": 20, "area": 247 },
    "circulation": { "percentage": 20, "area": 247 }
  },
  "projectContext": "Office for 50 people with standard amenities",
  "suggestions": [
    "Consider adding X if budget allows",
    "Y is optional but recommended"
  ]
}
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
