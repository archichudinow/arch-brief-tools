# State Schema – Project Data Model

## Purpose
Define a **stable, serializable project state** that supports:
- undo / redo
- branching
- partial AI updates
- export / import at any step

State must be deterministic and diff-friendly.

---

## High-Level State Layers

1. Project Meta (including AI context)
2. Raw Inputs (original brief)
3. Area Layer (Nodes only, no clusters)
4. Grouping Layer
5. Variant / Massing Layer
6. UI State (non-authoritative)
7. Chat State (messages, proposals)

---

## Project Meta

```typescript
interface ProjectMeta {
  id: UUID;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  currentStep: number;              // 0=Input, 1=Areas, 2=Groups, 3=Massing
  
  // AI Context
  aiContext: string | null;         // Short project summary for AI
  originalBrief: string | null;     // Full brief text (optional)
}
```

The `aiContext` is generated during brief processing and used for all AI interactions.
Typically 200-500 tokens summarizing project type, scale, and key constraints.

---

## Core Objects

### AreaNode
Represents a semantic space type.

Fields:
- id: UUID
- name: string
- areaPerUnit: number (m²)
- count: number
- briefNote?: string          // Excerpt from original brief
- aiNote?: string             // AI-generated note
- userNote?: string           // User-added note
- lockedFields?: string[]     // Fields locked from AI modification

Derived:
- totalArea = areaPerUnit × count

---

### Group
Represents planning/program grouping.

Fields:
- id: UUID
- name: string
- color: string
- members: UUID[]             // Array of AreaNode IDs
- aiNote?: string
- userNote?: string

Groups are always flat. No nested groups.

---

## Chat State (Separate Store)

```typescript
interface ChatState {
  messages: Message[];
  pendingProposals: Proposal[];
  isOpen: boolean;
  isLoading: boolean;
}

interface Message {
  id: UUID;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  proposals?: Proposal[];
}

interface Proposal {
  id: UUID;
  type: ProposalType;
  status: 'pending' | 'accepted' | 'rejected';
  data: ProposalData;
}
```

Chat state is ephemeral (not persisted with project by default).

---

## Referential Integrity Rules
- No duplicated ownership (node can be in max 1 group)
- No nested groups
- Groups reference node IDs, never copy data

---

## Serialization
State must be:
- JSON serializable
- order-independent
- versioned

Supports:
- save
- load
- diff
- merge
