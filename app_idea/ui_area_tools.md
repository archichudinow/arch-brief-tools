# UI – Area Tools Interaction

## General Layout
Area Tools live inside **Step 1 (Normalization)** and **Step 2 (Grouping)**.

Main UI zones:
- Steps bar (top)
- Area Tree (left)
- Inspector / Notes (right)
- AI Chat (bottom or side)
- 3D / Diagram Preview (optional, contextual)

---

## Area Tree (Primary Workspace)

Tree supports:
- Area Nodes
- Optional Clusters
- Optional Partitions (expandable)

Visual nesting is allowed.
Data nesting is restricted by rules.

Example:
Flat (80 sqm × 40)
  ├─ Part A – 5 units
  ├─ Part B – 15 units
  └─ Part C – 20 units

---

## Core Interactions

### Area Nodes
User can:
- edit name, area, count
- delete / duplicate
- lock values
- add notes
- send node to AI chat

---

### Partitions
User can:
- split count numerically
- rename partitions
- drag partitions into groups
- merge partitions back

No geometry is created.

---

### Clusters
User can:
- manually cluster selected nodes
- ask AI to cluster based on notes
- dissolve cluster back to nodes

Clusters are visually collapsible.

---

## AI Chat Integration

User can:
- drag nodes / clusters into chat
- ask AI to:
  - break down areas
  - normalize names
  - propose variants
  - explain assumptions

AI responses:
- propose state changes
- require user confirmation before apply

Undo / redo always available.

---

## Grouping Transition

User may:
- proceed with fine-grain areas
- OR proceed with coarse areas (e.g. Office = 10,000 sqm)

No forced granularity.

---

## Export Points

Step 1 exports:
- Normalized Excel
- JSON state
- Abstract GLB (un-grouped)

Step 2 exports:
- Grouped GLB
- Group-aware Excel
- Group logic JSON
