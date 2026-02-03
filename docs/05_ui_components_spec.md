# UI Components Specification

## Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              HEADER                                      │
│  [Logo]  [Project Name]                    [Export] [Import] [Settings] │
├─────────────────────────────────────────────────────────────────────────┤
│                             STEP BAR                                     │
│  [0. Input] → [1. Areas ●] → [2. Groups] → [3. Massing]                 │
├────────────────────┬──────────────────────────┬─────────────────────────┤
│                    │                          │                          │
│    AREA TREE       │      MAIN CANVAS         │      INSPECTOR          │
│    (Left Panel)    │      (Future 3D)         │      (Right Panel)      │
│                    │                          │                          │
│  ┌──────────────┐  │                          │  ┌───────────────────┐  │
│  │ + Add Area   │  │                          │  │ [Details] [Notes] │  │
│  ├──────────────┤  │                          │  ├───────────────────┤  │
│  │ ▼ Flat       │  │    (Step 1: empty)       │  │ Name: ________    │  │
│  │   80㎡ × 40  │  │                          │  │ Area: _____ ㎡    │  │
│  │   ├─ Part A  │  │    (Step 3: 3D view)     │  │ Count: _____      │  │
│  │   ├─ Part B  │  │                          │  │                   │  │
│  │   └─ Part C  │  │                          │  │ Total: 3,200 ㎡   │  │
│  │              │  │                          │  │                   │  │
│  │ ▶ Office     │  │                          │  │ [🔒 Lock Fields]  │  │
│  │   120㎡ × 20 │  │                          │  │                   │  │
│  │              │  │                          │  │ ─────────────────│  │
│  │ ▶ Retail     │  │                          │  │ User Note:        │  │
│  │   50㎡ × 10  │  │                          │  │ _______________   │  │
│  └──────────────┘  │                          │  └───────────────────┘  │
│                    │                          │                          │
├────────────────────┴──────────────────────────┴─────────────────────────┤
│                              AI CHAT BAR                                 │
│  [💬] Ask AI about selected areas...                    [Model: GPT-4o] │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Hierarchy

```
App
├── Header
│   ├── Logo
│   ├── ProjectTitle (editable)
│   └── HeaderActions (Export, Import, Settings)
├── StepBar
│   └── StepItem × 4
├── MainLayout
│   ├── LeftPanel
│   │   ├── AreaToolbar (Add, Cluster actions)
│   │   └── AreaTree
│   │       ├── AreaCluster (optional wrapper)
│   │       │   └── AreaNodeItem
│   │       └── AreaNodeItem
│   │           └── AreaPartitionItem (when expanded)
│   ├── CenterPanel
│   │   └── (Step 3: ThreeCanvas)
│   └── RightPanel
│       ├── InspectorTabs
│       └── InspectorContent
│           ├── DetailsTab
│           └── NotesTab
├── AiChatBar (collapsible)
│   ├── AiInput
│   ├── AiMessages
│   └── AiProposalPreview
└── Modals
    ├── ExportModal
    ├── ImportModal
    ├── SettingsModal
    └── AiSettingsModal
```

---

## Component Specifications

### StepBar

**Purpose:** Navigate between workflow steps

**Props:**
```typescript
interface StepBarProps {
  currentStep: StepId;
  onStepChange: (step: StepId) => void;
  stepStatus: Record<StepId, 'incomplete' | 'active' | 'complete'>;
}
```

**States:**
- Incomplete: gray, clickable
- Active: primary color, current
- Complete: green check, clickable

**Behavior:**
- Click step to navigate
- Shows step names and numbers

---

### AreaTree

**Purpose:** Display and manipulate area hierarchy

**Props:**
```typescript
interface AreaTreeProps {
  nodes: AreaNode[];
  partitions: AreaPartition[];
  clusters: AreaCluster[];
  selectedIds: UUID[];
  expandedIds: UUID[];
  onSelect: (ids: UUID[]) => void;
  onExpand: (id: UUID) => void;
}
```

**Features:**
- Hierarchical display (clusters → nodes → partitions)
- Inline editing (double-click)
- Multi-select (Cmd+Click)
- Keyboard navigation
- Context menu (right-click)
- Drag-and-drop (to groups)

---

### AreaNodeItem

**Purpose:** Display single area node in tree

**Props:**
```typescript
interface AreaNodeItemProps {
  node: AreaNode;
  derived: AreaNodeDerived;
  isSelected: boolean;
  isExpanded: boolean;
  hasPartitions: boolean;
  groupColor?: string;
  onSelect: () => void;
  onExpand: () => void;
  onEdit: (updates: Partial<AreaNode>) => void;
  onDelete: () => void;
}
```

**Display:**
```
▼ Flat                    80㎡ × 40 = 3,200㎡
  [expand arrow] [name] [area] × [count] = [total]
```

**Inline Editing:**
- Double-click field to edit
- Enter to confirm
- Escape to cancel

---

### AreaPartitionItem

**Purpose:** Display partition under node

**Props:**
```typescript
interface AreaPartitionItemProps {
  partition: AreaPartition;
  parentNode: AreaNode;
  isSelected: boolean;
  groupColor?: string;
  onSelect: () => void;
  onEdit: (updates: Partial<AreaPartition>) => void;
  onDelete: () => void;
}
```

**Display:**
```
  ├─ Tower A: 15 units                    1,200㎡
     [label]: [count] units               [derived total]
```

---

### AreaInspector

**Purpose:** Detailed view and editing of selected item

**Tabs:**
- **Details:** All editable fields
- **Notes:** User notes, AI notes (read-only)

**Details Tab Content:**
```
┌─────────────────────────────────┐
│ Name                            │
│ [________________]              │
│                                 │
│ Area per Unit (㎡)              │
│ [________] [🔒]                 │
│                                 │
│ Count (units)                   │
│ [________] [🔒]                 │
│                                 │
│ ───────────────────────────── │
│ Total Area: 3,200 ㎡            │
│                                 │
│ Partitioned: 40 / 40 units      │
│ [████████████████] 100%         │
│                                 │
│ ───────────────────────────── │
│ [Split into Partitions]         │
│ [Duplicate]  [Delete]           │
└─────────────────────────────────┘
```

---

### AiChatBar

**Purpose:** Interact with AI assistant

**States:**
- Collapsed: Single input line
- Expanded: Full chat history + input

**Features:**
- Drag nodes into input area
- Show selected context
- Stream responses
- Proposal preview inline

**Display (Expanded):**
```
┌─────────────────────────────────────────────────────────────┐
│ ▼ AI Assistant                              [Model: GPT-4o] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [User] Break down the Flat node into 1BHK and 2BHK         │
│                                                             │
│ [AI] Based on the brief context, I suggest:                │
│      • 1BHK: 45㎡ × 20 units                                │
│      • 2BHK: 75㎡ × 20 units                                │
│                                                             │
│      ┌─────────────────────────────────┐                    │
│      │ PROPOSED CHANGES                │                    │
│      │ - Delete: Flat                  │                    │
│      │ + Create: 1BHK (45㎡ × 20)      │                    │
│      │ + Create: 2BHK (75㎡ × 20)      │                    │
│      │                                 │                    │
│      │ [Apply Changes] [Reject]        │                    │
│      └─────────────────────────────────┘                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Context: [Flat ×] [_______________________] [Send]          │
└─────────────────────────────────────────────────────────────┘
```

---

### ExportModal

**Purpose:** Configure and trigger export

**Options:**
```
┌─────────────────────────────────────┐
│ Export Project                       │
├─────────────────────────────────────┤
│                                     │
│ Format:                             │
│ ○ Project JSON (.archbrief.json)    │
│ ○ Area Summary (Excel)              │
│                                     │
│ Options:                            │
│ ☑ Include history                   │
│ ☐ Include AI logs                   │
│                                     │
│              [Cancel] [Export]      │
└─────────────────────────────────────┘
```

---

### HistoryPanel

**Purpose:** Browse and restore from history

**Display:**
```
┌─────────────────────────────────────┐
│ History                    [Branch] │
├─────────────────────────────────────┤
│ main ▾                              │
│                                     │
│ ● Now                               │
│ │                                   │
│ ○ Updated Flat count        2:34 PM │
│ │                                   │
│ ○ Split Flat into parts     2:33 PM │
│ │                                   │
│ ○ Created Office            2:30 PM │
│ │                                   │
│ ○ Created Flat              2:28 PM │
│ │                                   │
│ ○ Project created           2:25 PM │
│                                     │
└─────────────────────────────────────┘
```

---

## shadcn/ui Components to Use

| Component | Usage |
|-----------|-------|
| Button | All buttons |
| Input | Text/number fields |
| Label | Form labels |
| Tabs | Inspector tabs |
| Dialog | Modals |
| DropdownMenu | Context menus |
| Tooltip | Hover hints |
| Badge | Status indicators |
| Separator | Visual dividers |
| ScrollArea | Scrollable panels |
| Collapsible | Expandable sections |
| Slider | Partition distribution |
| Switch | Toggle options |
| Select | Model selection |
| Textarea | Notes fields |
| Toast | Notifications |

---

## Responsive Considerations

**Desktop (1280px+):**
- Three-column layout
- Full sidebar widths

**Tablet (768px - 1279px):**
- Two-column layout
- Collapsible inspector
- Bottom AI bar

**Mobile (< 768px):**
- Single column
- Tabbed navigation between panels
- Drawer for inspector/AI

---

## Theming

Use shadcn defaults with customization:

**Colors:**
- Primary: Architectural blue (#2563eb)
- Success: Green for complete steps
- Warning: Orange for validation issues
- Muted: Gray for inactive/disabled

**Typography:**
- System fonts (Inter via shadcn)
- Monospace for numbers

**Spacing:**
- Consistent 8px grid
- Comfortable padding (16-24px)
