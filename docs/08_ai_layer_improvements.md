# AI Layer Improvements - Frontend Approach

## ✅ Implemented Features

### 1. Input Classification (`briefAnalyzer.ts`)
- **Real-time analysis** of input text before parsing
- Detects input type: `prompt` | `dirty` | `structured` | `garbage`
- Assesses quality: `low` | `medium` | `high`
- Provides warnings and suggestions
- Preprocessing: cleans whitespace, removes email noise, normalizes units

### 2. Strategy-Based Parsing (`briefStrategies.ts`, `aiService.ts`)
- **GENERATE mode**: For simple prompts like "Create an office for 50 people"
  - AI generates complete program with typology knowledge
  - Higher temperature (0.7) for creativity
- **EXTRACT_TOLERANT mode**: For dirty/messy briefs
  - Extracts what it can, infers missing values
  - Includes confidence scores per area
- **EXTRACT_STRICT mode**: For structured briefs (existing two-pass)
  - Validates against stated totals
  - Reconciliation pass if discrepancies found
- **REJECT mode**: For garbage input
  - Returns helpful error message

### 3. Reconciliation Pass
- When parsed total differs from stated total by >5%
- AI analyzes what might be missing/duplicated
- Can auto-add high-confidence items (e.g., circulation)

### 4. UI Feedback (`BriefInput.tsx`)
- Shows input classification in real-time
- Displays quality badge and strategy description
- Shows warnings before parsing
- Dynamic button text based on strategy

---

## Current State Analysis

### What We Have
1. **Two-pass parsing**: Extract rows → Classify as space/subtotal/total
2. **Zod validation**: Schema validation for responses
3. **Basic totals validation**: Compare parsed vs stated totals
4. **Indoor/outdoor separation**: Filter outdoor spaces

### What's Missing

| Gap | Impact | Priority |
|-----|--------|----------|
| No input classification | All briefs treated same | 🔴 High |
| No quality assessment | Can't warn user early | 🔴 High |
| No preprocessing | Dirty text goes straight to AI | 🔴 High |
| No reverse-engineering from totals | Misses validation opportunity | 🟡 Medium |
| No generation mode | Can't handle "create office" prompts | 🔴 High |
| No iterative refinement | One-shot parsing | 🟡 Medium |
| No few-shot examples in prompts | AI lacks context | 🟡 Medium |

---

## Proposed Architecture: Multi-Stage Parsing Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INPUT ANALYSIS                               │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────┐    │
│  │ Classify    │ → │ Assess      │ → │ Select Strategy         │    │
│  │ Input Type  │   │ Quality     │   │ & Preprocess            │    │
│  └─────────────┘   └─────────────┘   └─────────────────────────┘    │
│        │                 │                      │                   │
│   PROMPT | DIRTY | STRUCTURED          LOW | MEDIUM | HIGH          │
└────────────────────────────────────────────────────────────────────-┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  GENERATE MODE  │ │  EXTRACT MODE   │ │  STRICT MODE    │
│                 │ │  (Tolerant)     │ │  (Validated)    │
│ • Understand    │ │ • Clean text    │ │ • Two-pass      │
│   intent        │ │ • Extract with  │ │   extraction    │
│ • Apply         │ │   inference     │ │ • Validate vs   │
│   typology      │ │ • Fill gaps     │ │   totals        │
│ • Generate      │ │ • Flag unknowns │ │ • Reconcile     │
│   program       │ │                 │ │   discrepancies │
└─────────────────┘ └─────────────────┘ └─────────────────┘
              │               │               │
              └───────────────┼───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     VALIDATION & RECONCILIATION                     │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────┐    │
│  │ Math Check  │ → │ Totals      │ → │ Confidence              │    │
│  │ (sums)      │   │ Reconcile   │   │ Assessment              │    │
│  └─────────────┘   └─────────────┘   └─────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        OUTPUT PACKAGE                               │
│  • Parsed areas                                                     │
│  • Detected groups                                                  │
│  • Confidence score                                                 │
│  • Warnings / ambiguities                                           │
│  • Suggested improvements (if quality low)                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Stage 1: Input Classification

### Input Types

| Type | Detection Signals | Example |
|------|-------------------|---------|
| **PROMPT** | <5 lines, few/no numbers, imperative verbs | "Create an office for 50 people" |
| **DIRTY** | Has numbers but mixed with prose, email-like | "We need about 20 offices, maybe 15m2..." |
| **STRUCTURED** | Table-like, clear headers, totals present | Formatted program table |
| **GARBAGE** | No discernible program content | Random text, wrong language |

### Detection Algorithm (Client-Side)

```typescript
interface InputClassification {
  type: 'prompt' | 'dirty' | 'structured' | 'garbage';
  confidence: number;
  signals: {
    lineCount: number;
    numericCount: number;
    hasTableStructure: boolean;
    hasTotals: boolean;
    hasHeaders: boolean;
    noiseRatio: number;
    hasImperativeVerbs: boolean;
  };
  quality: 'low' | 'medium' | 'high';
  warnings: string[];
}

function classifyInput(text: string): InputClassification {
  const lines = text.trim().split('\n');
  const numbers = text.match(/\d+(?:[.,]\d+)?\s*(?:m²|sqm|sqft)?/g) || [];
  
  // Table detection: multiple tabs or aligned columns
  const hasTableStructure = lines.some(l => /\t/.test(l) || /\s{3,}/.test(l));
  
  // Totals detection
  const hasTotals = /\b(total|subtotal|gfa|gia|nla|sum)\b/i.test(text);
  
  // Header detection
  const hasHeaders = lines.some(l => /^[A-Z][A-Za-z\s&]+:?\s*$/.test(l.trim()));
  
  // Imperative verbs (generation prompts)
  const hasImperativeVerbs = /\b(create|make|generate|design|build|develop)\b/i.test(text);
  
  // Classification logic
  if (lines.length <= 3 && numbers.length <= 2 && hasImperativeVerbs) {
    return { type: 'prompt', ... };
  }
  
  if (hasTableStructure && hasTotals && numbers.length > 5) {
    return { type: 'structured', ... };
  }
  
  if (numbers.length > 0) {
    return { type: 'dirty', ... };
  }
  
  return { type: 'garbage', ... };
}
```

---

## Stage 2: Quality Assessment

### Quality Signals

| Signal | Low | Medium | High |
|--------|-----|--------|------|
| Structure clarity | No structure | Some headers | Clear hierarchy |
| Number consistency | Mixed formats | Mostly consistent | Consistent units |
| Totals present | No | Partial | Full with subtotals |
| Noise content | >50% | 20-50% | <20% |
| Completeness | Missing key info | Some gaps | Complete |

### User Feedback for Low Quality

```typescript
interface QualityAssessment {
  score: number;  // 0-100
  level: 'low' | 'medium' | 'high';
  canProceed: boolean;
  warnings: string[];
  suggestions: string[];
}

// Example low-quality response
{
  score: 25,
  level: 'low',
  canProceed: true,  // Can try, but warn user
  warnings: [
    "Brief appears to be mixed with email text",
    "No clear totals found for validation",
    "Units are inconsistent (m² and sqft mixed)"
  ],
  suggestions: [
    "Consider cleaning up the brief before parsing",
    "Add a total GFA for validation",
    "Use consistent units throughout"
  ]
}
```

---

## Stage 3: Strategy Selection & Preprocessing

### Strategy Matrix

| Input Type | Quality | Strategy | Preprocessing |
|------------|---------|----------|---------------|
| PROMPT | any | GENERATE | None |
| DIRTY | low | EXTRACT_TOLERANT | Clean + Infer |
| DIRTY | medium | EXTRACT_TOLERANT | Clean |
| STRUCTURED | medium | EXTRACT_STRICT | Normalize |
| STRUCTURED | high | EXTRACT_STRICT | Minimal |
| GARBAGE | any | REJECT | None |

### Preprocessing Functions

```typescript
// 1. Clean whitespace and normalize
function cleanWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 2. Remove email/noise content
function removeNoise(text: string): string {
  // Remove email headers
  text = text.replace(/^(From|To|Cc|Subject|Sent|Date):.*$/gm, '');
  // Remove signatures
  text = text.replace(/^(Regards|Thanks|Best|Cheers),?\n[\s\S]*$/gm, '');
  // Remove common filler
  text = text.replace(/\b(please|kindly|would you|could you)\b/gi, '');
  return text.trim();
}

// 3. Normalize units
function normalizeUnits(text: string): string {
  // Convert sqft to m²
  text = text.replace(/(\d+(?:[.,]\d+)?)\s*(?:sqft|sq\.?\s*ft|sf)\b/gi, (_, n) => {
    const sqm = Math.round(parseFloat(n.replace(',', '')) * 0.0929);
    return `${sqm} m²`;
  });
  // Normalize m² variants
  text = text.replace(/\b(sqm|sq\.?\s*m(?:eters?)?)\b/gi, 'm²');
  return text;
}

// 4. Extract table structure
function normalizeTable(text: string): string {
  // Convert tabs to consistent delimiter
  // Align columns if possible
  // ...
}
```

---

## Stage 4: Parsing Strategies

### Strategy A: GENERATE Mode

For: "Create an office program for 50 people with meeting rooms"

```typescript
const GENERATE_PROMPT = `You are an architectural programmer. Generate a building program based on user requirements.

USER REQUEST: {userInput}

INSTRUCTIONS:
1. Understand the building type and scale
2. Apply standard space ratios for this typology
3. Generate a complete program with groups and areas
4. Include circulation, services, and support spaces
5. Provide reasoning for key decisions

TYPOLOGY KNOWLEDGE:
- Office: 8-12 m² per workstation, 15-20% circulation, meeting rooms 10-15% of work area
- Residential: 30-50 m² per unit typical, 10-15% circulation
- Retail: 70-80% sales floor, 20-30% back-of-house
- Hotel: 25-35 m² per room, plus F&B, lobby, back-of-house

OUTPUT FORMAT (JSON):
{
  "interpretation": "How I understood the request",
  "assumptions": ["List of assumptions made"],
  "areas": [
    { "name": "Area Name", "areaPerUnit": 100, "count": 1, "aiNote": "Reasoning" }
  ],
  "detectedGroups": [
    { "name": "Group Name", "color": "#hex", "areaNames": ["Area1", "Area2"] }
  ],
  "totalArea": 1234,
  "breakdown": {
    "primarySpaces": 60,
    "support": 20,
    "circulation": 20
  },
  "projectContext": "Brief description",
  "suggestions": ["Optional improvement suggestions"]
}
`;
```

### Strategy B: EXTRACT_TOLERANT Mode

For: Dirty briefs with mixed text

```typescript
const EXTRACT_TOLERANT_PROMPT = `Extract building spaces from this messy brief. 

BRIEF TEXT:
{cleanedInput}

INSTRUCTIONS:
1. Find all mentions of spaces/rooms with areas
2. If area is missing, estimate based on typology
3. If count is unclear, default to 1
4. Flag anything uncertain
5. Look for any totals to validate against

HANDLING AMBIGUITY:
- "about 20 offices" → count: 20, confidence: medium
- "15m2 each" → areaPerUnit: 15, confidence: high
- "some storage" → estimate based on program size, confidence: low

OUTPUT FORMAT (JSON):
{
  "areas": [
    { 
      "name": "Office", 
      "areaPerUnit": 15, 
      "count": 20, 
      "confidence": 0.8,
      "source": "about 20 offices, maybe 15m2 each",
      "inferred": false
    },
    {
      "name": "Storage",
      "areaPerUnit": 40,
      "count": 1,
      "confidence": 0.5,
      "source": "some storage",
      "inferred": true,
      "inferenceReason": "Estimated at 5% of office area"
    }
  ],
  "detectedGroups": [],
  "statedTotals": [],  // Any totals found in text
  "parsedTotal": 340,
  "ambiguities": [
    "Storage size not specified - estimated",
    "Meeting room count unclear"
  ],
  "projectContext": ""
}
`;
```

### Strategy C: EXTRACT_STRICT Mode (Current Two-Pass)

For: Well-structured briefs

Keep current two-pass but add:
1. **Math validation pass**: Verify subtotals sum to items
2. **Reconciliation pass**: If totals don't match, try to identify missing/duplicate items

---

## Stage 5: Validation & Reconciliation

### Math Validation

```typescript
interface ValidationResult {
  isValid: boolean;
  parsedTotal: number;
  statedTotal: number | null;
  discrepancy: number | null;
  groupValidation: GroupValidation[];
  issues: ValidationIssue[];
}

interface GroupValidation {
  groupName: string;
  parsedTotal: number;
  statedTotal: number | null;
  isValid: boolean;
  itemCount: number;
}

interface ValidationIssue {
  type: 'missing_items' | 'duplicate' | 'math_error' | 'total_mismatch';
  severity: 'error' | 'warning';
  message: string;
  suggestion?: string;
}
```

### Reconciliation Strategy

When parsed total ≠ stated total:

```
┌─────────────────────────────────────────────────────────────────┐
│                    RECONCILIATION FLOW                          │
│                                                                 │
│  Discrepancy Detected: Parsed 12,500 ≠ Stated 14,500            │
│  Missing: 2,000 m²                                              │
│                                                                 │
│  Step 1: Check for common omissions                             │
│  ├── Circulation not listed? (~15-20% of program)               │
│  ├── Services/MEP not listed? (~5-10%)                          │
│  └── Outdoor spaces included in total?                          │
│                                                                 │
│  Step 2: Check group subtotals                                  │
│  ├── Do subtotals sum to total?                                 │
│  └── Any groups missing items?                                  │
│                                                                 │
│  Step 3: Suggest resolution                                     │
│  ├── "Add Circulation: 2,000 m² (14% of program)"               │
│  ├── "Check if outdoor 700m² should be included"                │
│  └── "Group X subtotal suggests 1 missing item"                 │
└─────────────────────────────────────────────────────────────────┘
```

```typescript
const RECONCILIATION_PROMPT = `The parsed brief has a discrepancy.

PARSED AREAS:
{parsedAreas}

STATED TOTAL: {statedTotal} m²
PARSED TOTAL: {parsedTotal} m²
DISCREPANCY: {discrepancy} m² ({direction})

TASK: Identify what might be missing or duplicated.

COMMON CAUSES:
1. Circulation not listed (typically 15-20% of GFA)
2. Services/MEP areas omitted
3. Outdoor spaces counted or not counted
4. Subtotals double-counted as items
5. Typographical errors in numbers

Analyze and suggest corrections.

OUTPUT FORMAT (JSON):
{
  "analysis": "What I found",
  "likelyCause": "Most probable reason",
  "suggestions": [
    { 
      "action": "add" | "remove" | "modify",
      "item": "Area name",
      "value": 2000,
      "reason": "Why this makes sense",
      "confidence": 0.8
    }
  ],
  "adjustedTotal": 14500,
  "remainingDiscrepancy": 0
}
`;
```

---

## Stage 6: Output Package

### Final Response Structure

```typescript
interface BriefParsingResult {
  // Core data
  areas: ParsedArea[];
  detectedGroups: DetectedGroup[];
  
  // Metadata
  inputType: 'prompt' | 'dirty' | 'structured';
  strategy: 'generate' | 'extract_tolerant' | 'extract_strict';
  
  // Validation
  validation: {
    parsedTotal: number;
    statedTotal: number | null;
    isReconciled: boolean;
    groupTotals: GroupTotal[];
  };
  
  // Quality
  confidence: {
    overall: number;        // 0-1
    perArea: Map<string, number>;
  };
  
  // User feedback
  warnings: string[];       // Things to review
  ambiguities: string[];    // Unclear items
  suggestions: string[];    // How to improve
  
  // Context
  projectContext: string;
  interpretation?: string;  // For GENERATE mode
  assumptions?: string[];   // For GENERATE mode
}
```

---

## Implementation Priority

### Phase 1: Input Classification ✅ DONE
- [x] Add `analyzeInput()` function in `briefAnalyzer.ts`
- [x] Show quality warnings before parsing in `BriefInput.tsx`
- [x] Route to appropriate strategy in `aiService.ts`

### Phase 2: Generate Mode ✅ DONE
- [x] Create GENERATE_PROMPT with typology knowledge
- [x] Handle simple prompts without numbers
- [x] Add interpretation and assumptions feedback

### Phase 3: Preprocessing ✅ DONE
- [x] Clean noise from dirty briefs (email headers, signatures)
- [x] Normalize units (sqft → m²)
- [x] Clean whitespace and formatting

### Phase 4: Tolerant Extraction ✅ DONE
- [x] Create EXTRACT_TOLERANT_PROMPT with inference
- [x] Add confidence scores per area
- [x] Handle missing values gracefully with inferred flag

### Phase 5: Reconciliation ✅ DONE
- [x] Add math validation (5% tolerance)
- [x] Implement RECONCILIATION_PROMPT
- [x] Auto-apply high-confidence suggestions

### Phase 6: Iterative Refinement (Future)
- [ ] Allow user to correct and re-parse
- [ ] Learn from corrections (session-level)
- [ ] Few-shot examples from successful parses

---

## Prompt Engineering Best Practices

### 1. Use Structured Output
```
OUTPUT FORMAT (JSON only):
{
  "field1": "description",
  ...
}
```

### 2. Provide Examples
```
EXAMPLE INPUT:
"Office 50m², Meeting Room 30m², Total 80m²"

EXAMPLE OUTPUT:
{
  "areas": [
    { "name": "Office", "areaPerUnit": 50, "count": 1 },
    { "name": "Meeting Room", "areaPerUnit": 30, "count": 1 }
  ],
  "statedTotal": 80,
  "parsedTotal": 80
}
```

### 3. Chain-of-Thought for Complex Tasks
```
REASONING STEPS:
1. First, identify all numeric values
2. Then, match numbers to space names
3. Next, determine if numbers are counts or areas
4. Finally, validate against any totals
```

### 4. Temperature Settings
| Task | Temperature | Reason |
|------|-------------|--------|
| Extraction | 0.1 | Precision needed |
| Classification | 0.2 | Some interpretation |
| Generation | 0.7 | Creativity useful |
| Reconciliation | 0.3 | Analytical |

---

## Token Budget

| Stage | Est. Tokens | Cost (GPT-4o) |
|-------|-------------|---------------|
| Classification | 500 input, 200 output | ~$0.002 |
| Extraction | 2000 input, 1500 output | ~$0.02 |
| Classification | 2000 input, 1000 output | ~$0.015 |
| Reconciliation | 1500 input, 500 output | ~$0.01 |
| **Total** | ~8,700 tokens | ~$0.05/brief |

For a structured brief, 2-3 API calls. For dirty brief, 3-4 calls.

---

## Next Steps

1. **Create** `briefAnalyzer.ts` - Input classification & preprocessing
2. **Create** `briefStrategies.ts` - Strategy-specific prompts and handlers
3. **Update** `aiService.ts` - Route through new pipeline
4. **Update** `BriefInput.tsx` - Show quality feedback to user
