# Arch Brief Tools – Project Overview

## What Is This?

**Arch Brief Tools** is a specialized application for architects and planners to:
- Parse and normalize architectural briefs
- Structure area programs (residential, commercial, mixed-use)
- Explore feasibility through grouping and distribution
- Eventually generate abstract 3D massing studies
- Use AI as an optional reasoning assistant (never as controller)

---

## Core Philosophy

### 1. State Is Authoritative
The project state is the single source of truth. AI enhances but never owns the data.

### 2. Non-Destructive Exploration
All operations are reversible. Branching allows parallel exploration of design strategies.

### 3. Semantic First, Geometry Later
Work with **area meanings** (types, counts, distributions) before committing to physical forms.

### 4. Manual First, AI Second
Every action AI can perform, the user can do manually. We build manual tools first, then expose them to AI.

---

## Application Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 0: Input                                                      │
│  - Paste brief text                                                 │
│  - Upload Excel                                                     │
│  - Start from scratch                                               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Normalization (Area Tools)                                 │
│  - Create/edit Area Nodes                                           │
│  - Split into partitions                                            │
│  - Create clusters (optional)                                       │
│  - AI can propose breakdowns                                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: Grouping                                                   │
│  - Create Groups (Residential, Office, Retail, etc.)                │
│  - Assign Area Nodes or Partitions to Groups                        │
│  - Define distribution rules                                        │
│  - AI can suggest groupings                                         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: Massing / Variants (Future)                                │
│  - Define building parameters                                       │
│  - Generate abstract 3D massing                                     │
│  - Compare variants                                                 │
│  - Export GLB                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| UI Framework | React 18+ | Component architecture |
| UI Components | shadcn/ui | Consistent design system |
| State Management | Zustand | Simple, powerful state |
| 3D Rendering | React Three Fiber | Future massing visualization |
| AI Integration | OpenAI API | Reasoning & transformation |
| Styling | Tailwind CSS | Utility-first CSS |

---

## Development Phases

### Phase 1: Core Manual Tools ✨ (Current)
- Project state management
- Area Node CRUD
- Partitioning
- Clustering
- Undo/Redo
- Export/Import JSON

### Phase 2: Grouping & Distribution
- Group creation
- Partition assignment
- Group rules
- Summary views

### Phase 3: AI Integration
- OpenAI connection
- Command parsing
- Proposal preview
- Token awareness

### Phase 4: 3D Massing (React Three Fiber)
- Abstract block generation
- Variant comparison
- GLB export

---

## Key Design Decisions

1. **No Backend Required** – All state is local/client-side, exportable as JSON
2. **API Key Optional** – Users bring their own OpenAI key
3. **Offline-First** – Core functionality works without internet
4. **Deterministic State** – Derived values are computed, not stored
5. **Snapshot-Based Undo** – Full state copies, not command replay

---

## Success Criteria

- User can create a complete area program manually
- User can save, reload, and continue work
- User can undo/redo any action
- User can explore branches without losing work
- AI suggestions are always previewed before applying
- Export produces valid, re-loadable project files
