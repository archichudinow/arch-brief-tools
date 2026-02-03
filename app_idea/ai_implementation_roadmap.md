# AI Implementation Roadmap

## Overview

Implementation in 3 phases:
1. **Infrastructure** - Chat UI, state management, API integration
2. **Brief Processing** - Parse briefs, generate areas and context
3. **Interactive Chat** - Conversational area manipulation

---

## Phase 1: Infrastructure

### 1.1 Chat Store
```typescript
// src/stores/chatStore.ts
interface ChatState {
  messages: Message[];
  projectContext: string | null;
  pendingProposals: Proposal[];
  isOpen: boolean;
  isLoading: boolean;
  
  // Actions
  sendMessage: (content: string) => Promise<void>;
  acceptProposal: (id: UUID) => void;
  rejectProposal: (id: UUID) => void;
  clearChat: () => void;
  setProjectContext: (context: string) => void;
  toggleOpen: () => void;
}
```

### 1.2 Chat Panel Component
```
src/components/chat/
├── ChatPanel.tsx          # Main slide-out panel
├── ChatMessages.tsx       # Message list with scroll
├── ChatInput.tsx          # Message input with send
├── MessageBubble.tsx      # Individual message display
├── ProposalCard.tsx       # Actionable proposal display
├── ContextBar.tsx         # Shows current context
└── index.ts
```

### 1.3 API Service
```typescript
// src/services/aiService.ts
interface AIService {
  parseBrief: (brief: string) => Promise<BriefParseResult>;
  sendChat: (request: ChatRequest) => Promise<ChatResponse>;
  streamChat: (request: ChatRequest, onChunk: Callback) => Promise<void>;
}
```

### 1.4 Project Store Updates
Add to project meta:
```typescript
interface ProjectMeta {
  // ... existing
  aiContext: string | null;        // Short project context
  originalBrief: string | null;    // Full brief text (optional)
}
```

---

## Phase 2: Brief Processing

### 2.1 Brief Input UI
- Text area for pasting brief
- File upload option (PDF, Word, TXT)
- "Process with AI" button

### 2.2 Brief Processing Flow
```
User Input → AI Parse → Preview Areas → User Review → Apply to State
```

### 2.3 Preview Mode
- Show parsed areas in list
- Each area has Accept/Edit/Reject
- AI suggestions marked differently
- Edit inline before accepting

### 2.4 Context Generation
- AI generates short context summary
- Stored in `project.meta.aiContext`
- Displayed in chat context bar
- Editable by user

### 2.5 Brief Parser Prompt
```
Parse this architectural brief. Extract:

1. AREAS: For each space mentioned:
   - name: Clear descriptive name
   - areaPerUnit: Size in m² (convert from sqft if needed)
   - count: Number of units (default 1)
   - briefNote: Relevant quote from brief

2. PROPOSED: Common areas not mentioned:
   - Circulation (typically 15-20%)
   - MEP/Services
   - Back-of-house spaces
   Mark as "AI Suggested"

3. CONTEXT: 200-word summary containing:
   - Project type
   - Total area
   - Key programs
   - Notable constraints
   - Quality/positioning

Brief:
---
{brief_text}
---

Respond in JSON format.
```

---

## Phase 3: Interactive Chat

### 3.1 Chat Commands

| Command Pattern | Action |
|-----------------|--------|
| "Split [area] into..." | SplitAreaProposal |
| "Merge [areas]" | MergeAreasProposal |
| "Balance [areas] to..." | UpdateAreasProposal |
| "Group [areas] by..." | CreateGroupsProposal |
| "What is..." / "How much..." | Q&A (no proposal) |
| "Add [area type]" | CreateAreasProposal |

### 3.2 Context Injection
Every chat request includes:
1. System prompt (behavior rules)
2. Project context (from brief parse)
3. Selected items (if any)
4. Chat history (last N messages)
5. User message

### 3.3 Proposal Application
When user accepts a proposal:
1. Validate proposal data
2. Apply to project store
3. Create history snapshot
4. Update proposal status
5. Show success toast

### 3.4 Proposal Modification
When user modifies a proposal:
1. Open edit modal with proposal data
2. User adjusts values
3. Re-validate
4. Apply modified version

---

## API Integration

### Option A: Direct OpenAI
```typescript
const openai = new OpenAI({
  apiKey: userApiKey || process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // For client-side
});

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
  response_format: { type: 'json_object' }
});
```

### Option B: Backend Proxy
```
POST /api/chat
Body: { messages, projectContext, selectedItems }
Response: { message, proposals, confidence }
```

Benefits:
- API key security
- Rate limiting
- Usage tracking
- Response caching

---

## UI/UX Details

### Chat Toggle
- Button in header: "AI Assistant"
- Keyboard: Cmd+K
- Badge shows unread/pending

### Chat Panel
- Width: 400px (resizable)
- Position: Right side overlay
- Animation: Slide in from right

### Message Display
- User: Right-aligned, primary bg
- AI: Left-aligned, muted bg
- System: Centered, subtle
- Proposals: Card with actions

### Loading States
- Streaming: Show text as it arrives
- Pending: Typing indicator
- Error: Red banner with retry

---

## Types Summary

```typescript
// Message types
type MessageRole = 'user' | 'assistant' | 'system';

interface Message {
  id: UUID;
  role: MessageRole;
  content: string;
  timestamp: Date;
  proposals?: Proposal[];
}

// Proposal types
type ProposalType = 
  | 'create_areas'
  | 'split_area'
  | 'merge_areas'
  | 'update_areas'
  | 'create_groups'
  | 'assign_to_group';

type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'modified';

interface Proposal {
  id: UUID;
  type: ProposalType;
  status: ProposalStatus;
  data: ProposalData;
  reasoning?: string;
}

// Brief parse result
interface BriefParseResult {
  areas: CreateAreaNodeInput[];
  proposedAreas: CreateAreaNodeInput[];
  projectContext: string;
  confidence: number;
  warnings: string[];
}

// Chat request/response
interface ChatRequest {
  projectContext: string;
  selectedNodes: AreaNodeSummary[];
  selectedGroups: GroupSummary[];
  userMessage: string;
  history: Message[];
}

interface ChatResponse {
  message: string;
  proposals: Proposal[] | null;
  assumptions: string[];
  confidence: number;
}
```

---

## Testing Strategy

### Unit Tests
- Message formatting
- Proposal validation
- Context building

### Integration Tests
- API response handling
- Proposal application
- State consistency

### Manual Testing
- Various brief formats
- Edge cases (empty, huge, multilingual)
- Proposal workflows

---

## Future Enhancements

1. **Voice Input** - Speak commands
2. **Multi-language** - Parse non-English briefs
3. **Templates** - Pre-defined prompts for common tasks
4. **History** - Persist chat across sessions
5. **Collaboration** - Share chat context with team
