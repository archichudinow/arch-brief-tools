# AI Integration Specification

## Core Principle

> AI is a **reasoning assistant**, not a controller.

All AI outputs are **proposals**. User always confirms before application.

---

## Connection Setup

### API Key Management

```typescript
interface AIConfig {
  apiKey: string | null;       // User's OpenAI API key
  model: AIModel;              // Selected model
  tokenLimit: number | null;   // Monthly/session limit
  tokensUsed: number;          // Running total
}
```

**Storage:** `localStorage` (never sent to any backend)

**UI Flow:**
1. User opens AI Settings
2. Pastes API key
3. Clicks "Test Connection"
4. If successful, AI features unlock

---

## Model Selection

| Model | Use Case | Cost Level |
|-------|----------|------------|
| gpt-4o-mini | Simple transforms, rename, split | $ Low |
| gpt-4o | Standard reasoning, breakdowns | $$ Medium |
| gpt-4-turbo | Complex reasoning, full brief | $$$ High |
| o3-mini | Advanced architecture reasoning | $$$$ Very High |

**Default:** gpt-4o-mini for most actions

**User Override:** Per-action or global setting

---

## Context Building

### What We Send to AI

**Always:**
- Selected node(s) data
- Relevant user notes
- Action intent

**Sometimes:**
- Cluster context
- Group context
- Brief excerpt

**Rarely (with confirmation):**
- Full normalized state
- Full brief text

### Context Scoping Rules

```typescript
type ContextLevel = 'minimal' | 'standard' | 'full';

interface ActionContext {
  level: ContextLevel;
  selectedNodes: AreaNode[];
  selectedPartitions: AreaPartition[];
  selectedClusters: AreaCluster[];
  relatedNotes: string[];
  briefExcerpt?: string;
  fullState?: ProjectState; // only for 'full' level
}
```

**Minimal Context:**
- rename, adjust count, simple split
- ~500-1000 tokens

**Standard Context:**
- breakdown proposals, clustering
- ~1000-3000 tokens

**Full Context:**
- re-normalization, architectural reasoning
- ~5000-10000+ tokens
- Requires explicit user confirmation

---

## Command Types

### 1. Breakdown

**User Intent:** "Break this area into more specific types"

**Example:**
> "Break Flat (80㎡ × 40) into 1BHK and 2BHK based on typical mix"

**AI Behavior:**
1. Read node data
2. Apply architectural knowledge
3. Propose replacement nodes

**Output:**
```json
{
  "summary": "Breaking Flat into 1BHK and 2BHK variants",
  "assumptions": [
    "60/40 mix typical for mid-market residential",
    "1BHK at 45sqm, 2BHK at 75sqm"
  ],
  "confidence": "medium",
  "changes": [
    { "type": "delete_node", "nodeId": "flat-uuid" },
    { "type": "create_node", "node": { "name": "1BHK", "areaPerUnit": 45, "count": 24 } },
    { "type": "create_node", "node": { "name": "2BHK", "areaPerUnit": 75, "count": 16 } }
  ]
}
```

---

### 2. Split (Partition)

**User Intent:** "Distribute this across buildings/levels"

**Example:**
> "Split these 40 flats into Tower A (15), Tower B (15), Tower C (10)"

**AI Behavior:**
1. Parse distribution request
2. Validate sum matches count
3. Propose partitions

**Output:**
```json
{
  "summary": "Distributing Flat across three towers",
  "assumptions": [],
  "confidence": "high",
  "changes": [
    { "type": "create_partition", "partition": { "parentNodeId": "flat-uuid", "count": 15, "label": "Tower A" } },
    { "type": "create_partition", "partition": { "parentNodeId": "flat-uuid", "count": 15, "label": "Tower B" } },
    { "type": "create_partition", "partition": { "parentNodeId": "flat-uuid", "count": 10, "label": "Tower C" } }
  ]
}
```

---

### 3. Cluster

**User Intent:** "Group related areas together"

**Example:**
> "Cluster Bedroom, Bathroom, and Closet as Hotel Room Components"

**AI Behavior:**
1. Identify nodes to cluster
2. Suggest cluster name
3. Propose cluster creation

**Output:**
```json
{
  "summary": "Creating cluster for hotel room components",
  "assumptions": [
    "These components are inseparable in planning"
  ],
  "confidence": "high",
  "changes": [
    { "type": "create_cluster", "cluster": { "name": "Hotel Room Components", "memberNodeIds": ["bedroom-uuid", "bathroom-uuid", "closet-uuid"] } }
  ]
}
```

---

### 4. Normalize

**User Intent:** "Fix naming, units, consistency"

**Example:**
> "Normalize all area names to use consistent format"

**AI Behavior:**
1. Analyze all nodes
2. Identify inconsistencies
3. Propose renames/adjustments

**Output:**
```json
{
  "summary": "Normalizing naming conventions",
  "assumptions": [
    "Using Title Case for area names",
    "Removing abbreviations"
  ],
  "confidence": "high",
  "changes": [
    { "type": "update_node", "nodeId": "uuid1", "updates": { "name": "One Bedroom Apartment" } },
    { "type": "update_node", "nodeId": "uuid2", "updates": { "name": "Two Bedroom Apartment" } }
  ]
}
```

---

### 5. Suggest Grouping

**User Intent:** "Help me organize these into logical groups"

**Example:**
> "Suggest how to group these areas for a mixed-use building"

**AI Behavior:**
1. Analyze all area types
2. Apply architectural program knowledge
3. Propose groups and assignments

**Output:**
```json
{
  "summary": "Suggested grouping for mixed-use program",
  "assumptions": [
    "Residential on upper floors",
    "Retail at ground level",
    "Office in podium"
  ],
  "confidence": "medium",
  "changes": [
    { "type": "create_group", "group": { "name": "Residential", "color": "#3b82f6" } },
    { "type": "create_group", "group": { "name": "Retail", "color": "#ef4444" } },
    { "type": "assign_to_group", "groupId": "res-uuid", "members": [...] }
  ]
}
```

---

## AI Request Format

### System Prompt (Template)

```
You are an architectural programming assistant. You help organize and structure building briefs.

RULES:
1. Only propose changes within the given scope
2. Never invent numeric data without stating assumptions
3. Always provide confidence level
4. Keep explanations concise
5. Output valid JSON matching the schema

USER CONTEXT:
{selectedNodesJson}
{userNotes}
{briefExcerpt}

AVAILABLE ACTIONS:
- create_node
- update_node
- delete_node
- create_partition
- create_cluster

OUTPUT FORMAT:
{
  "summary": "string",
  "assumptions": ["string"],
  "confidence": "high" | "medium" | "low",
  "changes": [...]
}
```

### User Message Template

```
ACTION: {actionType}
REQUEST: {userMessage}
SCOPE: {selectedNodeNames}

Respond with the JSON proposal only.
```

---

## Response Handling

### Streaming

- Use OpenAI streaming API
- Display partial response in chat
- Parse complete JSON when stream ends

### Validation

```typescript
function validateAIResponse(response: unknown): AIProposal | null {
  // 1. Check JSON structure
  // 2. Validate change types
  // 3. Verify referenced IDs exist
  // 4. Check numeric constraints
  return validProposal || null;
}
```

### Error Handling

| Error | User Message | Recovery |
|-------|--------------|----------|
| Invalid API key | "API key invalid" | Prompt to update |
| Rate limit | "Too many requests" | Wait and retry |
| Parse error | "Couldn't understand AI response" | Show raw, allow retry |
| Context too large | "Request too large" | Reduce scope |

---

## Token Estimation

```typescript
function estimateTokens(context: ActionContext): number {
  // Rough estimate: 4 chars = 1 token
  const contextJson = JSON.stringify(context);
  const basePromptTokens = 500; // System prompt
  const contextTokens = Math.ceil(contextJson.length / 4);
  const responseBuffer = 1000; // Expected response
  
  return basePromptTokens + contextTokens + responseBuffer;
}
```

**Display to User:**
```
Estimated cost: ~2,500 tokens ($0.005)
[Proceed] [Cancel]
```

---

## Proposal UI

### Proposal Preview

```
┌─────────────────────────────────────────────┐
│ AI PROPOSAL                                 │
├─────────────────────────────────────────────┤
│ Summary: Breaking Flat into apartment types │
│                                             │
│ Assumptions:                                │
│ • 60/40 mix typical for mid-market          │
│ • 1BHK at 45sqm, 2BHK at 75sqm              │
│                                             │
│ Confidence: ██████░░░░ Medium               │
│                                             │
│ Changes:                                    │
│ ─ Delete: Flat (80㎡ × 40)                  │
│ + Create: 1BHK (45㎡ × 24)                  │
│ + Create: 2BHK (75㎡ × 16)                  │
│                                             │
│ Area change: 3,200㎡ → 2,280㎡ (-920㎡)     │
│                                             │
│          [Apply Changes]  [Reject]          │
└─────────────────────────────────────────────┘
```

### After Application

- Changes applied as single atomic action
- History snapshot labeled "AI: {summary}"
- Undo reverts entire proposal

---

## Security Considerations

1. **API Key Client-Only** – Never sent to any server except OpenAI
2. **No Project Data to Backend** – All processing is local + OpenAI
3. **User Consent** – Large context requires explicit approval
4. **Audit Trail** – AI actions are marked in history
