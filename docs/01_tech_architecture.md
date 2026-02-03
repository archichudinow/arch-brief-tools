# Technical Architecture

## Project Structure

```
arch-brief-tools/
├── public/
├── src/
│   ├── app/                    # App entry, providers, layout
│   ├── components/
│   │   ├── ui/                 # shadcn components
│   │   ├── steps/              # Step-specific components
│   │   │   ├── StepBar.tsx
│   │   │   ├── Step0Input/
│   │   │   ├── Step1Areas/
│   │   │   ├── Step2Groups/
│   │   │   └── Step3Massing/
│   │   ├── area-tools/         # Area manipulation components
│   │   │   ├── AreaTree.tsx
│   │   │   ├── AreaNode.tsx
│   │   │   ├── AreaPartition.tsx
│   │   │   ├── AreaCluster.tsx
│   │   │   └── AreaInspector.tsx
│   │   ├── ai/                 # AI chat & integration
│   │   │   ├── AiChat.tsx
│   │   │   ├── AiProposal.tsx
│   │   │   └── AiSettings.tsx
│   │   └── shared/             # Reusable components
│   ├── stores/                 # Zustand stores
│   │   ├── projectStore.ts     # Main project state
│   │   ├── historyStore.ts     # Undo/redo/branching
│   │   ├── uiStore.ts          # UI state (selections, panels)
│   │   └── aiStore.ts          # AI connection & settings
│   ├── types/                  # TypeScript definitions
│   │   ├── project.ts
│   │   ├── areas.ts
│   │   ├── groups.ts
│   │   └── ai.ts
│   ├── lib/                    # Utilities
│   │   ├── serialize.ts        # Export/import logic
│   │   ├── validators.ts       # Schema validation
│   │   ├── derivations.ts      # Computed values
│   │   └── ai-commands.ts      # AI command parsing
│   ├── hooks/                  # Custom hooks
│   │   ├── useAreaActions.ts
│   │   ├── useHistory.ts
│   │   └── useAiChat.ts
│   └── styles/
├── docs/                       # Documentation
├── app_idea/                   # Original concept docs
└── package.json
```

---

## State Architecture

### Zustand Store Design

```
┌────────────────────────────────────────────────────────────────┐
│                       PROJECT STORE                            │
├────────────────────────────────────────────────────────────────┤
│  meta: { id, name, createdAt, modifiedAt, currentStep }        │
│  rawInputs: { briefText, uploadedFiles }                       │
│  areaLayer: { nodes, partitions, clusters }                    │
│  groupingLayer: { groups }                                     │
│  massingLayer: { variants, selectedVariant }                   │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                       HISTORY STORE                            │
├────────────────────────────────────────────────────────────────┤
│  snapshots: StateSnapshot[]                                    │
│  currentIndex: number                                          │
│  branches: Branch[]                                            │
│  activeBranch: string                                          │
├────────────────────────────────────────────────────────────────┤
│  actions: undo(), redo(), branch(), restore()                  │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                         UI STORE                               │
├────────────────────────────────────────────────────────────────┤
│  selectedNodeIds: string[]                                     │
│  expandedNodeIds: string[]                                     │
│  activePanel: 'inspector' | 'ai' | 'history'                   │
│  inspectorTab: 'details' | 'notes' | 'ai'                      │
└────────────────────────────────────────────────────────────────┘
```

---

## Action Flow

### Manual User Action

```
User clicks "Split Partition"
         │
         ▼
┌─────────────────────┐
│  Action Handler     │
│  (useAreaActions)   │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Validate Action    │
│  (check constraints)│
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Create Snapshot    │
│  (historyStore)     │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Apply Changes      │
│  (projectStore)     │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Recompute Derived  │
│  (totals, sums)     │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Update UI          │
│  (React re-render)  │
└─────────────────────┘
```

### AI-Assisted Action

```
User sends request to AI Chat
         │
         ▼
┌─────────────────────┐
│  Build Context      │
│  (selected nodes,   │
│   relevant notes)   │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Call OpenAI API    │
│  (with streaming)   │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Parse Response     │
│  (extract proposal) │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Show Proposal UI   │
│  (diff preview)     │
└─────────────────────┘
         │
    User confirms?
    ┌────┴────┐
   Yes        No
    │          │
    ▼          ▼
 Apply      Discard
 Changes    Proposal
```

---

## Component Patterns

### Controlled State Pattern
All form inputs are controlled by Zustand state. No local component state for data.

### Action Composition
Actions are composable functions that:
1. Validate preconditions
2. Snapshot current state
3. Mutate state
4. Return success/failure

### Derived Values
Computed values (totals, sums, validation status) are calculated on-the-fly, never stored.

---

## File Formats

### Project JSON (.archbrief.json)
```json
{
  "schema_version": "1.0.0",
  "meta": { ... },
  "rawInputs": { ... },
  "areaLayer": { ... },
  "groupingLayer": { ... },
  "history": { ... }
}
```

### Export Formats
- **JSON** – Full project state (authoritative)
- **Excel** – Area summary tables (derived)
- **GLB** – 3D massing (derived, future)

---

## Performance Considerations

1. **Shallow State Copies** – Use Immer or careful immutable updates
2. **Selective Subscriptions** – Components subscribe to specific state slices
3. **Debounced Saves** – Auto-save with debounce
4. **Lazy 3D Loading** – React Three Fiber only loaded when needed
5. **Snapshot Pruning** – Limit history depth for memory
