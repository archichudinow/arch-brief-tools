# AI Chat Interface

## Chat Message Types

### User Messages
```typescript
interface UserMessage {
  id: UUID;
  role: 'user';
  content: string;
  timestamp: Date;
  context: {
    selectedNodeIds: UUID[];
    selectedGroupIds: UUID[];
  };
}
```

### AI Messages
```typescript
interface AIMessage {
  id: UUID;
  role: 'assistant';
  content: string;           // Markdown text response
  timestamp: Date;
  proposals?: Proposal[];    // Actionable proposals
  status: 'streaming' | 'complete' | 'error';
}
```

### System Messages
```typescript
interface SystemMessage {
  id: UUID;
  role: 'system';
  content: string;
  type: 'info' | 'warning' | 'success' | 'error';
}
```

---

## Proposal Types

### CreateAreasProposal
```typescript
interface CreateAreasProposal {
  type: 'create_areas';
  areas: Array<{
    name: string;
    areaPerUnit: number;
    count: number;
    briefNote?: string;
    aiNote?: string;
  }>;
  status: 'pending' | 'accepted' | 'rejected' | 'modified';
}
```

### SplitAreaProposal
```typescript
interface SplitAreaProposal {
  type: 'split_area';
  sourceNodeId: UUID;
  sourceName: string;
  splits: Array<{
    name: string;
    areaPerUnit: number;
    count: number;
  }>;
  status: 'pending' | 'accepted' | 'rejected' | 'modified';
}
```

### MergeAreasProposal
```typescript
interface MergeAreasProposal {
  type: 'merge_areas';
  sourceNodeIds: UUID[];
  result: {
    name: string;
    areaPerUnit: number;
    count: number;
  };
  status: 'pending' | 'accepted' | 'rejected' | 'modified';
}
```

### UpdateAreasProposal
```typescript
interface UpdateAreasProposal {
  type: 'update_areas';
  updates: Array<{
    nodeId: UUID;
    changes: Partial<{
      name: string;
      areaPerUnit: number;
      count: number;
    }>;
  }>;
  status: 'pending' | 'accepted' | 'rejected' | 'modified';
}
```

### CreateGroupsProposal
```typescript
interface CreateGroupsProposal {
  type: 'create_groups';
  groups: Array<{
    name: string;
    color: string;
    memberNodeIds: UUID[];
  }>;
  status: 'pending' | 'accepted' | 'rejected' | 'modified';
}
```

### AssignToGroupProposal
```typescript
interface AssignToGroupProposal {
  type: 'assign_to_group';
  assignments: Array<{
    groupId: UUID;
    nodeIds: UUID[];
  }>;
  status: 'pending' | 'accepted' | 'rejected' | 'modified';
}
```

---

## Chat Store State

```typescript
interface ChatState {
  // Messages
  messages: Array<UserMessage | AIMessage | SystemMessage>;
  
  // Active proposals awaiting user action
  pendingProposals: Proposal[];
  
  // Project context (generated from brief)
  projectContext: string | null;
  
  // UI state
  isOpen: boolean;
  isLoading: boolean;
  
  // Actions
  sendMessage: (content: string) => Promise<void>;
  acceptProposal: (proposalId: UUID) => void;
  rejectProposal: (proposalId: UUID) => void;
  modifyProposal: (proposalId: UUID, changes: Partial<Proposal>) => void;
  clearChat: () => void;
  setProjectContext: (context: string) => void;
}
```

---

## Request Building

### buildChatRequest
```typescript
function buildChatRequest(
  userMessage: string,
  projectContext: string,
  selectedNodes: AreaNode[],
  selectedGroups: Group[]
): ChatRequest {
  return {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: `Project Context: ${projectContext}` },
      ...formatSelectionContext(selectedNodes, selectedGroups),
      { role: 'user', content: userMessage }
    ],
    response_format: { type: 'json_object' }
  };
}
```

### formatSelectionContext
```typescript
function formatSelectionContext(
  nodes: AreaNode[],
  groups: Group[]
): string {
  if (nodes.length === 0 && groups.length === 0) {
    return 'No items selected.';
  }
  
  let context = '';
  
  if (nodes.length > 0) {
    context += 'Selected Areas:\n';
    nodes.forEach(node => {
      context += `- ${node.name}: ${node.count} × ${node.areaPerUnit}m² = ${node.count * node.areaPerUnit}m²\n`;
    });
  }
  
  if (groups.length > 0) {
    context += 'Selected Groups:\n';
    groups.forEach(group => {
      context += `- ${group.name} (${group.members.length} areas)\n`;
    });
  }
  
  return context;
}
```

---

## System Prompts

### Base System Prompt
```
You are an architectural brief assistant. You help users organize and structure building program areas.

Your capabilities:
1. Parse briefs to extract areas (names, sizes, counts)
2. Propose area breakdowns and splits
3. Suggest missing areas typical for the program type
4. Help balance and proportion area distributions
5. Answer questions about architectural programming

Rules:
- Always preserve total area when splitting/merging
- Provide reasoning for proposals
- Flag assumptions clearly
- Use metric units (m²)
- Be concise but complete

Response Format:
Always respond with valid JSON containing:
{
  "message": "Human-readable explanation",
  "proposals": [...] or null,
  "assumptions": [...],
  "confidence": 0.0-1.0
}
```

### Brief Parsing Prompt
```
Parse the following architectural brief and extract all areas.

For each area, identify:
- name: Clear, descriptive name
- areaPerUnit: Size in m² per unit (convert if needed)
- count: Number of units (default 1)
- briefNote: Relevant excerpt from brief

Also:
1. Identify areas that should be added (circulation, services, etc.)
2. Generate a 200-word project context summary
3. Flag any ambiguities or missing information

Brief:
{brief_text}
```

---

## UI Components

### ChatPanel
- Slide-out panel (right side)
- Toggle via header button or keyboard shortcut
- Resizable width

### MessageBubble
- User messages: right-aligned, primary color
- AI messages: left-aligned, muted background
- System messages: centered, subtle

### ProposalCard
- Displayed inline in AI messages
- Shows proposed changes visually
- Action buttons: Accept, Modify, Reject
- Expandable details

### ContextBar
- Shows what's being sent to AI
- Selected items summary
- Token estimate
- "Edit context" option

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open chat panel |
| `Escape` | Close chat panel |
| `Enter` | Send message |
| `Shift + Enter` | New line in message |

---

## Streaming Response

### Implementation
```typescript
async function streamChatResponse(
  request: ChatRequest,
  onChunk: (text: string) => void,
  onProposal: (proposal: Proposal) => void,
  onComplete: () => void
) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify(request),
    headers: { 'Content-Type': 'application/json' }
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    onChunk(chunk);
  }
  
  onComplete();
}
```

### Buffering
- Buffer partial JSON until complete
- Parse proposals when full JSON received
- Display text progressively

---

## Error States

### Network Error
- Show retry button
- Preserve user message
- Display error message

### Rate Limit
- Show cooldown timer
- Queue message for retry

### Invalid Response
- Show raw response for debugging
- Allow manual retry
- Log for analysis
