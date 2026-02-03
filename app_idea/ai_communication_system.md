# AI Communication System

## Overview

The AI system operates in two modes:
1. **Brief Processing** - Initial parsing and area generation from text briefs
2. **Interactive Chat** - Conversational interface for area manipulation

---

## Phase 1: Brief Processing

### Input
User pastes or uploads a text brief describing the project requirements.

### AI Tasks

#### 1. Parse Brief into Areas
- Extract area names, sizes, counts from brief text
- Create AreaNode entries for each identified space
- Handle various formats (tables, lists, paragraphs)

#### 2. Generate Brief Notes
For each created area:
- Extract relevant brief excerpt as `briefNote`
- This is the source context from the original document

#### 3. Add AI Notes (Optional)
- AI may add interpretive notes as `aiNote`
- Architectural suggestions, code references, typical ratios
- Flagged as AI-generated content

#### 4. Propose Missing Areas
- Identify areas commonly associated with the program type
- Suggest areas not explicitly in brief (e.g., circulation, MEP, back-of-house)
- Mark proposals as "AI Suggested" with reasoning

#### 5. Generate Project Context Summary
- Create a **short context string** (~200-500 tokens)
- Used for all subsequent AI decisions
- Contains: project type, scale, key constraints, program mix
- Stored in `project.meta.aiContext`

### Output Structure
```typescript
interface BriefProcessingResult {
  areas: CreateAreaNodeInput[];      // Parsed areas
  proposedAreas: CreateAreaNodeInput[]; // AI suggestions
  projectContext: string;            // Short context for future use
  confidence: number;                // 0-1 parsing confidence
  warnings: string[];                // Ambiguities, missing info
}
```

### User Flow
1. Paste brief text
2. AI processes and returns parsed areas + proposals
3. User reviews in preview mode
4. User accepts/modifies/rejects each area
5. Confirmed areas are created in state

---

## Phase 2: Interactive Chat

### Context Payload

Every chat message includes:
```typescript
interface ChatContext {
  projectContext: string;           // From brief processing
  selectedNodes?: AreaNode[];       // Currently selected areas
  selectedGroups?: Group[];         // Currently selected groups
  userMessage: string;              // User's question/request
}
```

### Chat Capabilities

#### 1. Q&A Mode
User asks questions, AI responds with information.

Examples:
- "What's a typical lobby size for a 200-room hotel?"
- "Is 15% circulation reasonable for this office?"
- "What areas am I missing for a hospital emergency department?"

Response: Text answer only, no state changes.

#### 2. Split Proposals
User requests area breakdown suggestions.

**Example Request:**
```
"Please propose split for this office area"
Selected: Office (5000 m²)
```

**AI Response:**
```typescript
interface SplitProposal {
  sourceNodeId: UUID;
  proposedAreas: Array<{
    name: string;
    areaPerUnit: number;
    count: number;
    reasoning?: string;
  }>;
  totalArea: number;  // Must match source
  assumptions: string[];
}
```

**UI Response:**
- Display proposals in chat
- "Apply" button to create areas
- User can modify before applying

#### 3. Structured Split Requests
User provides constraints for the split.

**Example Request:**
```
"Split 10000m² hotel into:
- 1 area spa
- 2 area restaurant  
- 3 rooms of 40m² and 60m²"
```

**AI Response:**
```typescript
{
  proposedAreas: [
    { name: "Spa", areaPerUnit: 800, count: 1 },
    { name: "Restaurant A", areaPerUnit: 400, count: 1 },
    { name: "Restaurant B", areaPerUnit: 350, count: 1 },
    { name: "Room Type A", areaPerUnit: 40, count: 85 },
    { name: "Room Type B", areaPerUnit: 60, count: 56 }
  ],
  assumptions: [
    "Spa sized at 8% of total (typical range 5-10%)",
    "Restaurants sized for hotel capacity",
    "Remaining area distributed between room types"
  ],
  remainingArea: 0  // Or leftover for circulation
}
```

#### 4. Merge Proposals
User sends multiple areas, asks for consolidation.

**Example Request:**
```
"Merge these meeting rooms into logical clusters"
Selected: [Meeting Room A, Meeting Room B, Conference Room, Boardroom]
```

**AI Response:**
```typescript
interface MergeProposal {
  groups: Array<{
    name: string;
    memberNodeIds: UUID[];
    reasoning: string;
  }>;
}
```

#### 5. Balance/Proportion Requests
User asks AI to adjust proportions.

**Example Request:**
```
"Balance these residential units to 60% 1BHK, 40% 2BHK"
Selected: [1BHK Flats (50 units), 2BHK Flats (50 units)]
```

**AI Response:**
Propose count adjustments maintaining total area or total units.

#### 6. Assign to Groups
User asks AI to organize areas into groups.

**Example Request:**
```
"Organize these areas into logical groups"
Selected: [Multiple areas]
```

**AI Response:**
```typescript
interface GroupingProposal {
  groups: Array<{
    name: string;
    color: string;
    memberNodeIds: UUID[];
    reasoning: string;
  }>;
}
```

---

## Response Protocol

### All AI Responses Include:
```typescript
interface AIResponse {
  type: 'answer' | 'proposal' | 'error';
  message: string;                    // Human-readable explanation
  proposals?: StateChangeProposal[];  // Actionable changes
  confidence: number;                 // 0-1
  assumptions: string[];              // What AI assumed
  warnings?: string[];                // Concerns or alternatives
}
```

### State Change Proposals
```typescript
interface StateChangeProposal {
  action: 'create' | 'update' | 'delete' | 'split' | 'merge' | 'assign';
  target: 'node' | 'group';
  data: any;  // Action-specific payload
  preview: string;  // Human-readable description
}
```

---

## UI Components

### Chat Panel
- Slide-out or docked panel
- Message history with context
- Action buttons on proposals
- Streaming response display

### Proposal Cards
- Show proposed changes visually
- Accept / Modify / Reject buttons
- Preview state diff before applying

### Context Indicator
- Show what context is being sent
- Token estimate
- Cost indicator (low/medium/high)

---

## Token Optimization

### Context Compression
- Project context: max 500 tokens
- Selected nodes: summarized (name, area, count only)
- Brief excerpts: relevant sections only

### Model Selection
| Task Type | Model Tier | Max Tokens |
|-----------|------------|------------|
| Q&A | Fast/Cheap | 1000 |
| Simple Split | Standard | 2000 |
| Complex Analysis | Advanced | 4000 |
| Full Brief Parse | Advanced | 8000 |

---

## State Management

### AI Never Mutates State Directly
1. AI generates proposals
2. User reviews proposals
3. User confirms (Accept/Modify/Reject)
4. App applies confirmed changes
5. History snapshot created

### Proposal Lifecycle
```
AI Response → Proposal Created → User Review → Apply/Discard → State Updated
```

---

## Error Handling

### Ambiguous Requests
- AI asks clarifying questions
- Provides multiple interpretation options

### Insufficient Context
- AI requests additional information
- Suggests what data would help

### Confidence Thresholds
- High (>0.8): Show proposals directly
- Medium (0.5-0.8): Show with warnings
- Low (<0.5): Ask for clarification first

---

## Security & Privacy

- Brief content processed via API
- No persistent storage of briefs on server
- User can use own API key
- Token usage tracked and displayed
