# Implementation Roadmap

## Phase 1: Foundation & Core Area Tools

### 1.1 Project Setup
- [x] Initialize concept documentation
- [ ] Create React + Vite project
- [ ] Configure Tailwind CSS
- [ ] Install and configure shadcn/ui
- [ ] Set up Zustand stores (empty structure)
- [ ] Create basic app layout

**Deliverable:** Running app with empty shell

---

### 1.2 Project Store & Types
- [ ] Define TypeScript types (areas.ts, project.ts)
- [ ] Implement projectStore with initial state
- [ ] Create serialization helpers (toJSON, fromJSON)
- [ ] Implement derived value calculations
- [ ] Add schema validation

**Deliverable:** Working state management with type safety

---

### 1.3 Area Node CRUD
- [ ] Create AreaTree component (left panel)
- [ ] Create AreaNode component with inline editing
- [ ] Implement create area node action
- [ ] Implement update area node action
- [ ] Implement delete area node action
- [ ] Create AreaInspector component (right panel)
- [ ] Add user notes field

**Deliverable:** User can create, edit, delete area nodes

---

### 1.4 Partitioning
- [ ] Add "Split into Partitions" action
- [ ] Create AreaPartition component (nested under node)
- [ ] Implement partition count editing
- [ ] Implement merge partitions back to node
- [ ] Add partition labels
- [ ] Show partition sum validation

**Deliverable:** User can split nodes into partitions

---

### 1.5 Clustering (Optional)
- [ ] Add "Create Cluster" action (multi-select)
- [ ] Create AreaCluster component (visual wrapper)
- [ ] Implement dissolve cluster action
- [ ] Show cluster totals

**Deliverable:** User can group related nodes into clusters

---

### 1.6 Undo/Redo System
- [ ] Implement historyStore
- [ ] Create snapshot on each action
- [ ] Implement undo action
- [ ] Implement redo action
- [ ] Add keyboard shortcuts (Cmd+Z, Cmd+Shift+Z)
- [ ] Show undo/redo in UI (buttons)

**Deliverable:** User can undo/redo any action

---

### 1.7 Export/Import
- [ ] Implement project JSON export
- [ ] Implement project JSON import
- [ ] Add file download trigger
- [ ] Add file upload dialog
- [ ] Validate imported schema
- [ ] Handle version migration (future-proofing)

**Deliverable:** User can save/load projects

---

## Phase 2: Grouping & Distribution

### 2.1 Group Management
- [ ] Create GroupList component
- [ ] Implement create group action
- [ ] Implement update group action
- [ ] Implement delete group action
- [ ] Add group colors

**Deliverable:** User can create and manage groups

---

### 2.2 Group Assignment
- [ ] Implement drag-and-drop nodes to groups
- [ ] Implement drag-and-drop partitions to groups
- [ ] Show group membership in AreaTree
- [ ] Prevent duplicate assignments
- [ ] Show unassigned areas warning

**Deliverable:** User can assign areas to groups

---

### 2.3 Group Summary View
- [ ] Create GroupSummary component
- [ ] Show totals per group
- [ ] Show breakdown (nodes, partitions)
- [ ] Export grouped Excel

**Deliverable:** User sees group totals and can export

---

### 2.4 Step Navigation
- [ ] Create StepBar component
- [ ] Implement step state in store
- [ ] Allow backward navigation
- [ ] Show step completion status
- [ ] Gate forward progress (optional)

**Deliverable:** User can navigate between steps

---

## Phase 3: AI Integration

### 3.1 AI Configuration
- [ ] Create AISettings component
- [ ] Implement apiKey storage (localStorage)
- [ ] Add model selection
- [ ] Test API connection
- [ ] Show token usage stats

**Deliverable:** User can configure OpenAI connection

---

### 3.2 AI Chat Panel
- [ ] Create AiChat component
- [ ] Implement message history (session)
- [ ] Add node/cluster drag-to-chat
- [ ] Build context from selection
- [ ] Stream AI responses

**Deliverable:** User can chat with AI about areas

---

### 3.3 AI Command Parsing
- [ ] Define command types (breakdown, split, merge, normalize)
- [ ] Parse AI response into structured changes
- [ ] Create AIProposal type
- [ ] Show proposal preview

**Deliverable:** AI responses are structured

---

### 3.4 AI Proposal Application
- [ ] Create AiProposal component (diff view)
- [ ] Show before/after comparison
- [ ] Implement apply proposal action
- [ ] Implement reject proposal action
- [ ] Add proposal to history as single action

**Deliverable:** User can preview and apply AI suggestions

---

### 3.5 Token Awareness
- [ ] Estimate tokens before sending
- [ ] Show cost level indicator
- [ ] Allow cancellation during streaming
- [ ] Track session token usage

**Deliverable:** User is aware of AI costs

---

## Phase 4: Branching & Advanced History

### 4.1 Branch System
- [ ] Extend historyStore with branches
- [ ] Implement create branch action
- [ ] Implement switch branch action
- [ ] Show branch indicator in UI

**Deliverable:** User can create exploration branches

---

### 4.2 History Panel
- [ ] Create HistoryPanel component
- [ ] Show snapshot timeline
- [ ] Show branch tree (if multiple)
- [ ] Allow restore from any snapshot
- [ ] Allow labeling snapshots

**Deliverable:** User can explore full history

---

## Phase 5: 3D Massing (React Three Fiber)

### 5.1 3D Setup
- [ ] Add React Three Fiber dependencies
- [ ] Create lazy-loaded 3D viewport
- [ ] Implement basic camera controls
- [ ] Add lighting

**Deliverable:** 3D canvas renders in app

---

### 5.2 Abstract Massing
- [ ] Generate boxes from group totals
- [ ] Apply group colors
- [ ] Show floor levels
- [ ] Add floor labels

**Deliverable:** Abstract 3D representation of areas

---

### 5.3 Massing Parameters
- [ ] Create parameter inputs (floor height, site area)
- [ ] Update geometry from parameters
- [ ] Show FAR / coverage calculations

**Deliverable:** User can adjust massing parameters

---

### 5.4 GLB Export
- [ ] Implement GLB export
- [ ] Include metadata in export
- [ ] Download trigger

**Deliverable:** User can export 3D model

---

## Testing Milestones

| Milestone | Phase | Test Focus |
|-----------|-------|------------|
| M1 | 1.3 | Create 10 area nodes, edit values, delete some |
| M2 | 1.4 | Split node into 3 partitions, verify totals |
| M3 | 1.6 | Undo 5 actions, redo 3, verify state |
| M4 | 1.7 | Export, refresh page, import, verify identical |
| M5 | 2.2 | Assign all areas to groups, no duplicates |
| M6 | 3.4 | AI proposes breakdown, apply, undo, still works |

---

## Definition of Done (Per Task)

1. Feature works as specified
2. TypeScript compiles without errors
3. Manual testing passed
4. State is serializable
5. Undo/redo works for the action
6. No console errors
