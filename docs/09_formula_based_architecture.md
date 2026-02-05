# Formula-Based AI Architecture

## Overview

This document proposes a new approach where **AI only authors formulas and reasoning** at each node in the hierarchical area tree, while a **deterministic system executes all math** and enforces constraints.

By storing formulas and context in every parent and child node, the final areas are:
- **Numerically stable** - No floating point drift or rounding accumulation
- **Fully traceable** - Every value links back to its formula and inputs
- **Explainable** - Users can see WHY any value exists
- **Consistent** - Parent-child relationships always sum correctly
- **Scale-aware** - System detects and validates project scale

---

## Scale Awareness

### Project Scales
Different area sizes require different breakdown approaches:

| Scale | Area Range | Typical Breakdown |
|-------|------------|-------------------|
| **Interior** | 10 - 2,000 m² | Rooms, zones, furniture layouts |
| **Architecture** | 100 - 100,000 m² | Floors, departments, functional zones |
| **Landscape** | 1,000 - 500,000 m² | Buildings, outdoor zones, parking |
| **Masterplan** | 10,000 - 5,000,000 m² | Building plots, streets, public spaces |
| **Urban** | 100,000 - 100,000,000 m² | Neighborhoods, districts, infrastructure |

### Scale Mismatch Detection
When user inputs "500,000,000 sqm hotel", the system:

1. **Detects mismatch**: Hotel max ~150,000 m², input is 3,333× larger
2. **Triggers clarification** instead of blindly proceeding
3. **Offers interpretations**:

```typescript
{
  needsClarification: true,
  severity: 'error',
  question: 'The area 500M m² seems unusual for "hotel". What did you mean?',
  options: [
    { label: 'Did you mean a hotel of 50K m² (typical large hotel)?', area: 50000, scale: 'architecture' },
    { label: 'Did you mean a masterplan of 500M m² with hotels?', area: 500000000, scale: 'urban' },
    { label: 'Did you mean a hotel resort of 500K m² (with grounds)?', area: 500000, scale: 'landscape' },
    { label: 'Keep 500M m² as specified', area: 500000000, scale: 'urban' }
  ]
}
```

### Typology Size Ranges
Known building types have expected size ranges:

| Typology | Min | Typical | Max | Description |
|----------|-----|---------|-----|-------------|
| Hotel (standard) | 3,000 | 15,000 | 50,000 | 50-300 rooms |
| Hotel (large) | 20,000 | 50,000 | 150,000 | 300+ rooms |
| Hotel (resort) | 30,000 | 100,000 | 500,000 | Includes grounds |
| Office building | 2,000 | 10,000 | 50,000 | Standard office |
| Office tower | 20,000 | 50,000 | 200,000 | High-rise |
| Shopping mall | 10,000 | 50,000 | 300,000 | Shopping center |
| Hospital | 10,000 | 50,000 | 200,000 | Medical facility |

### Scale-Appropriate Breakdowns
The scale determines what level of detail is appropriate:

**❌ Wrong**: Masterplan (500,000 m²) → "Guest Room A (35m²), Guest Room B (35m²), Bathroom (8m²)"  
**✅ Right**: Masterplan (500,000 m²) → "Hotel Zone (50,000m²), Retail District (30,000m²), Parks (80,000m²)"

**❌ Wrong**: Interior (200 m²) → "North District, South District, Infrastructure Corridor"  
**✅ Right**: Interior (200 m²) → "Living Room (40m²), Bedroom (25m²), Kitchen (15m²)"

---

## Core Concept: Formula-First Architecture

### Current Approach (Intent-Based)
```
User Input → AI (outputs values/ratios) → Validation → Execution
```

**Problem**: Values appear "magic" - hard to trace why 3,500m² became 3,512m²

### New Approach (Formula-Based)
```
User Input → Scale Check → AI (outputs formulas + reasoning) → Formula Evaluation → Traceable Results
```

**Benefit**: Every number has an explanation: "3,512m² = parent(15,000m²) × 23.4% + rounding adjustment"

---

## Formula Types

### 1. Ratio Formula
Expresses area as percentage of a reference (parent, total, or sibling sum).

```typescript
interface RatioFormula {
  type: 'ratio';
  reference: 'parent' | 'total' | 'sibling_sum' | UUID;
  ratio: number;           // 0-1 (normalized by engine)
  reasoning: string;       // AI's explanation
  source?: string;         // What brief text or context led to this
  confidence?: number;     // 0-1, how certain AI is
}

// Example: "Lobby = 5% of total building area"
{
  type: 'ratio',
  reference: 'total',
  ratio: 0.05,
  reasoning: "Hotel lobbies typically 4-6% of GFA; used 5% as middle ground",
  source: "user requested 'typical hotel lobby'",
  confidence: 0.85
}
```

### 2. Unit-Based Formula  
Expresses area through unit × count × multiplier pattern.

```typescript
interface UnitFormula {
  type: 'unit_based';
  areaPerUnit: number;      // Base unit size
  unitCount: number;        // Number of units
  multiplier?: number;      // Optional adjustment (default 1.0)
  reasoning: string;
  source?: string;
  confidence?: number;
  reference?: {             // Optional: derive unit size from reference
    type: 'standard' | 'typology' | 'brief';
    value: string;          // e.g., "hotel_standard_room" or "35m² from brief"
  };
}

// Example: "200 guest rooms at 35m² each"
{
  type: 'unit_based',
  areaPerUnit: 35,
  unitCount: 200,
  reasoning: "Standard hotel room 30-40m², brief specified 35m²",
  source: "brief: 'rooms should be 35 sqm each'",
  confidence: 0.95,
  reference: { type: 'brief', value: '35m²' }
}
```

### 3. Remainder Formula
Area = what's left after subtracting siblings from parent.

```typescript
interface RemainderFormula {
  type: 'remainder';
  parentRef: UUID | 'parent';
  excludeSiblings: UUID[];   // Siblings to subtract
  cap?: number;              // Optional maximum
  floor?: number;            // Optional minimum
  reasoning: string;
  confidence?: number;
}

// Example: "Circulation = remaining after all program areas"
{
  type: 'remainder',
  parentRef: 'parent',
  excludeSiblings: ['rooms', 'lobby', 'restaurant', 'boh'],
  floor: 500,  // At least 500m² circulation
  reasoning: "Circulation absorbs remaining area after primary functions",
  confidence: 0.7
}
```

### 4. Constraint Formula
Defines relationships between areas (useful for validation/auto-adjustment).

```typescript
interface ConstraintFormula {
  type: 'constraint';
  constraint: 
    | { kind: 'ratio_to_sibling'; siblingId: UUID; ratio: number }
    | { kind: 'minimum'; value: number }
    | { kind: 'maximum'; value: number }
    | { kind: 'equal_to'; targetId: UUID }
    | { kind: 'sum_to_parent' };  // Special: this node + siblings = parent
  reasoning: string;
  priority?: number;         // For conflict resolution
}

// Example: "Kitchen must be at least 25% of restaurant area"
{
  type: 'constraint',
  constraint: { kind: 'ratio_to_sibling', siblingId: 'restaurant_id', ratio: 0.25 },
  reasoning: "Kitchen typically 20-30% of F&B front-of-house",
  priority: 1
}
```

### 5. Fixed Formula
An explicitly set value (user override or from brief).

```typescript
interface FixedFormula {
  type: 'fixed';
  value: number;
  reasoning: string;
  source: 'user' | 'brief' | 'standard';
  locked?: boolean;          // Prevent AI from modifying
}

// Example: "Parking must be exactly 2000m² per zoning"
{
  type: 'fixed',
  value: 2000,
  reasoning: "Zoning requires minimum 2000m² parking",
  source: 'brief',
  locked: true
}
```

### 6. Fallback Formula (Edge Case Handling)
Used when AI lacks sufficient information to generate a confident formula.
**This makes uncertainty EXPLICIT rather than hiding it.**

```typescript
interface FallbackFormula {
  type: 'fallback';
  method: 'equal_share' | 'typology_guess' | 'minimum_viable';
  knownFactors: string[];      // What we do know
  missingInfo: string[];       // What's missing
  suggestedRatio?: number;     // Best guess ratio (0-1)
  minimumArea?: number;        // For minimum_viable method
  reasoning: string;
  confidence: FormulaConfidence;  // Should be low (<0.5)
  userPrompts?: string[];      // Questions to ask user
}

// Example: "Storage needs unclear"
{
  type: 'fallback',
  method: 'typology_guess',
  knownFactors: ["brief mentions storage", "commercial building type"],
  missingInfo: ["size requirement", "what will be stored"],
  suggestedRatio: 0.03,
  reasoning: "Storage typically 2-5% for commercial; using 3% as middle ground",
  confidence: { level: 0.4, factors: ["no specific data", "generic estimate"] },
  userPrompts: ["What needs to be stored?", "Any minimum area requirements?"]
}
```

**Fallback Methods:**
| Method | When to Use | Behavior |
|--------|-------------|----------|
| `equal_share` | Multiple unknown areas | Divides remaining space equally |
| `typology_guess` | Some typology knowledge exists | Uses `suggestedRatio` based on general standards |
| `minimum_viable` | Truly unknown requirements | Allocates `minimumArea` only |

---

## Edge Cases & Minimum Thresholds

### Minimum Area Thresholds
Areas below these sizes trigger warnings:

```typescript
const MIN_AREA_THRESHOLDS = {
  ABSOLUTE_MIN: 2,        // Closet/alcove
  FUNCTIONAL_ROOM: 6,     // Basic room
  WORKSPACE: 8,           // Office/desk
  MEETING: 10,            // Meeting space
  SPLIT_DEFAULT: 5,       // Min per part when splitting
};
```

### "Too Small to Split" Handling
```typescript
canSplitArea(totalArea: 20, targetParts: 5)
// Returns: { canSplit: false, reason: "Can only split into 4 parts (minimum 5m² each)" }

canSplitArea(totalArea: 100, targetParts: 10)
// Returns: { canSplit: true, maxParts: 20 }
```

### Low Confidence Handling
```typescript
const CONFIDENCE_THRESHOLDS = {
  LOW: 0.4,           // Below this = warning
  HIGH: 0.75,         // Above this = reliable
  AUTO_EXECUTE: 0.6,  // Minimum for auto-apply
};
```

When confidence is below `LOW`:
- Formula is flagged with ⚠️ warning
- User prompted to review
- `userPrompts` from fallback formula shown

---

## Node Structure with Formulas

```typescript
interface FormulaAreaNode {
  id: UUID;
  name: string;
  
  // Formula that defines this area
  formula: AreaFormula;
  
  // Computed values (by deterministic engine)
  computed: {
    areaPerUnit: number;
    count: number;
    totalArea: number;
    
    // Traceability
    evaluatedAt: Timestamp;
    inputs: FormulaInput[];      // What values went into calculation
    adjustments: Adjustment[];   // Any rounding/constraint adjustments
  };
  
  // Hierarchy
  parentId?: UUID;
  childIds: UUID[];
  
  // Optional constraints
  constraints?: ConstraintFormula[];
  
  // Metadata
  notes: Note[];
  lockedFields: AreaNodeField[];
  createdBy: 'user' | 'ai';
}

interface FormulaInput {
  name: string;           // e.g., "parent.totalArea"
  value: number;          // e.g., 15000
  sourceId?: UUID;        // Which node it came from
}

interface Adjustment {
  type: 'rounding' | 'constraint' | 'minimum' | 'maximum';
  originalValue: number;
  adjustedValue: number;
  reason: string;
}
```

---

## Formula Evaluation Engine

The engine is **purely deterministic** - same formulas + same inputs = same outputs.

```typescript
class FormulaEngine {
  /**
   * Evaluate all formulas in the tree, top-down
   * Returns computed values + any constraint violations
   */
  evaluateTree(
    nodes: FormulaAreaNode[],
    rootTotal: number
  ): EvaluationResult {
    // 1. Build dependency graph
    // 2. Topological sort (parents before children)
    // 3. Evaluate each formula with resolved inputs
    // 4. Apply constraints and record adjustments
    // 5. Verify parent-child sums
    // 6. Return results with full trace
  }
  
  /**
   * Check if modifying a node would violate constraints
   */
  simulateChange(
    nodeId: UUID,
    newFormula: AreaFormula,
    tree: FormulaAreaNode[]
  ): { valid: boolean; violations: ConstraintViolation[]; preview: ComputedValues }
}
```

### Evaluation Rules

1. **Fixed formulas** evaluate first (anchors)
2. **Ratio formulas** resolve against their reference
3. **Remainder formulas** calculate after siblings
4. **Constraints** are checked and auto-adjusted if possible
5. **Rounding** is applied at the end, absorbed by remainder/largest area

---

## AI Prompt Changes

Instead of outputting area values, AI outputs formulas:

```typescript
const FORMULA_SYSTEM_PROMPT = `You are an architectural programmer. Output FORMULAS and REASONING - never raw area values.

BEHAVIOR:
- Describe HOW to calculate each area, not the calculated values
- Explain your reasoning for every ratio/formula
- Reference typology standards when applicable
- Flag uncertainty with confidence scores

FORMULA TYPES:
1. ratio - Percentage of parent/total: { type: "ratio", reference: "parent", ratio: 0.35, reasoning: "..." }
2. unit_based - Count × size: { type: "unit_based", areaPerUnit: 35, unitCount: 200, reasoning: "..." }
3. remainder - What's left: { type: "remainder", parentRef: "parent", reasoning: "..." }
4. fixed - Explicit value: { type: "fixed", value: 2000, reasoning: "...", source: "brief" }

OUTPUT FORMAT:
{
  "message": "Brief description",
  "intent": {
    "type": "create_program",
    "targetTotal": 15000,
    "areas": [
      {
        "name": "Guest Rooms",
        "formula": {
          "type": "unit_based",
          "areaPerUnit": 35,
          "unitCount": 200,
          "reasoning": "200 rooms at 35m² each (typical 3-star hotel standard)",
          "confidence": 0.9
        },
        "groupHint": "Rooms"
      },
      {
        "name": "Lobby",
        "formula": {
          "type": "ratio",
          "reference": "total",
          "ratio": 0.035,
          "reasoning": "Hotel lobby typically 3-4% of GFA for mid-scale property",
          "confidence": 0.8
        },
        "groupHint": "Public"
      },
      {
        "name": "Back of House",
        "formula": {
          "type": "remainder",
          "parentRef": "total",
          "reasoning": "BOH absorbs remaining area after guest-facing functions",
          "confidence": 0.7
        },
        "groupHint": "BOH",
        "constraints": [
          { "kind": "minimum", "value": 800, "reasoning": "Minimum viable BOH" }
        ]
      }
    ]
  }
}
`;
```

---

## Benefits

### 1. Full Traceability
Every area shows its formula and inputs:
```
Guest Rooms: 7,000m²
├─ Formula: unit_based (35m² × 200)
├─ Reasoning: "200 rooms at 35m² per brief specification"
├─ Source: "brief line 12: 'each room approximately 35 sqm'"
└─ Confidence: 95%
```

### 2. Constraint Enforcement
```
Kitchen: 300m² → 375m² (auto-adjusted)
├─ Original: ratio formula gave 300m²
├─ Constraint: "≥25% of Restaurant (1,500m²)"
├─ Adjustment: Increased to meet minimum
└─ Absorbed from: Back of House
```

### 3. What-If Analysis
Change one formula, see cascading effects before applying:
```typescript
const preview = engine.simulateChange(kitchenId, newFormula, tree);
// Shows: Kitchen +75m² → BOH -75m² → Total still 15,000m²
```

### 4. Hierarchical Consistency
Parent always equals sum of children:
```
Hotel (15,000m²)
├─ Guest Rooms (7,000m²)
├─ Public Areas (2,500m²)
│   ├─ Lobby (525m²)
│   ├─ Restaurant (1,500m²)
│   └─ Fitness (475m²)
├─ Back of House (3,500m²)
└─ Services (2,000m²)
```

### 5. Explainable AI
Users can see exactly why AI chose specific values:
```
AI suggested 35m² per room because:
- Brief mentioned "standard rooms"
- 3-star hotel typology: 30-40m² typical
- No specific size given → used midpoint
- Confidence: 80%
```

---

## Migration Path

### Phase 1: Add Formula Support (Non-Breaking)
- Add `formula` field to AreaNode (optional)
- Store formulas alongside computed values
- Display reasoning in UI

### Phase 2: Formula Evaluator
- Build deterministic formula engine
- Add preview/simulation capability
- Validate constraints on edit

### Phase 3: AI Migration
- Update prompts to output formulas
- Map intent system to formula system
- Maintain backward compatibility for legacy intents

### Phase 4: UI Enhancements
- Show formula explanations in area inspector
- Add "trace" view for any value
- Enable constraint visualization
- Add scale clarification dialogs

---

## Implementation Files

```
src/
├── types/
│   ├── formulas.ts          # Formula types, scale definitions, thresholds ✅
│   └── chat.ts              # Updated with expansion types ✅
├── services/
│   ├── formulaEngine.ts     # Deterministic evaluator ✅
│   ├── scaleAnalyzer.ts     # Scale detection & clarification ✅
│   ├── formulaService.ts    # AI integration for formulas ✅
│   └── aiPrompts.ts         # Updated prompts with scale awareness ✅
└── components/
    └── chat/
        ├── ExpandDepthSelector.tsx  # Tree exploration depth (1-3 levels) ✅
        ├── ClarificationCard.tsx    # Scale mismatch resolution UI ✅
        └── ChatPanel.tsx            # Updated workflow (no more detail levels) ✅
```

---

## New UI Workflow

### Removed: Detail Level Selector
The old approach had users choose "Abstract/Standard/Detailed" upfront. This is removed.

### New: Progressive Tree Exploration
1. **Initial Generation**: User describes project, AI generates top-level formula program
2. **Explore Depth**: User can set depth (1-3 levels) for how deep to expand
3. **Selective Expansion**: User selects specific areas and types "expand" or "break down"
4. **Recursive Unfold**: Each expansion uses formulas relative to the parent area

### Interaction Flow
```
User: "15,000 sqm hotel with 200 rooms"
   ↓
AI generates top-level areas:
  - Guest Rooms (unit_based: 35m² × 200)
  - Lobby (ratio: 10% of total)
  - Restaurants (ratio: 15% of total)
  - BOH (remainder)
   ↓
User selects "Restaurants" → types "expand"
   ↓
AI generates sub-areas FOR "Restaurants":
  - Main Restaurant (ratio: 50%)
  - Café (ratio: 25%)
  - Kitchen (ratio: 25%)
   ↓
User continues drilling down as needed...
```

### Scale Clarification
When size seems wrong (e.g., "500M sqm hotel"), the UI shows a ClarificationCard with options:
- "Did you mean 50K m² (typical hotel)?"
- "Keep as masterplan of 500M m²?"
- "Hotel resort of 500K m²?"

---

## Next Steps

1. ~~**Implement `types/formulas.ts`**~~ ✅ - Formula interfaces, scale types, thresholds
2. ~~**Build `formulaEngine.ts`**~~ ✅ - Deterministic evaluation, fallback handling
3. ~~**Build `scaleAnalyzer.ts`**~~ ✅ - Scale detection, typology validation
4. ~~**Update AI prompts**~~ ✅ - Scale awareness, clarification format
5. ~~**Add UI components**~~ ✅ - ExpandDepthSelector, ClarificationCard
6. ~~**Integration**~~ ✅ - Wire up formulaService to ChatPanel
7. **Testing** - Manual testing with real AI calls
8. **Polish** - Improve formula reasoning display in ProposalCard
