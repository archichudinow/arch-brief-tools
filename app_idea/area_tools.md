# Area Tools – Core Concept

## Purpose
Area Tools define the **lowest-grain manipulable objects** in the system.
They enable flexible architectural reasoning without committing to geometry or instances.

The system operates on **area semantics**, not individual rooms.

---

## Core Abstraction

### Area Node
An Area Node represents a *type* of space, not a single instance.

Examples:
- Flat
- Office Unit
- Retail Unit
- Hotel Room
- Core / Service Area

Each Area Node contains:
- name
- area_per_unit
- count
- total_area (derived)
- ai_note (reasoning / assumptions)
- user_note (optional override)

Area Nodes are the **atomic planning elements**.

---

## Partitions (Non-destructive Splits)

Area Nodes can be **partitioned** to allow distribution across groups, levels, or buildings.

Key rules:
- Partitions split `count`, not meaning
- Parent Area Node always remains
- All partitions must sum to parent count

Example:
Flat (40 units)
→ Partition A: 5 units
→ Partition B: 15 units
→ Partition C: 20 units

Partitions are **views**, not new semantics.

---

## Clusters (Optional Early Aggregation)

Clusters bundle Area Nodes that are **intrinsically inseparable**.

Examples:
- Bedroom + Bathroom
- Hotel Room components
- Retail Unit (sales + storage)

Clusters:
- exist before functional grouping
- reduce noise in large briefs
- improve AI reasoning

Clusters do NOT imply planning logic.

---

## Groups (Later Stage)

Groups represent **functional planning logic**:
- Residential
- Office
- Retail
- Podium / Tower
- Building A / Building B

Groups reference:
- Area Nodes
- or Partitions

Groups are always flat (no nesting).

---

## Design Intent
Area Tools allow:
- working at multiple abstraction levels
- postponing decisions
- reversible operations
- architectural reasoning without geometry

They support:
- buildings
- campuses
- urban-scale projects

---

## Non-Goals
- No room adjacency
- No circulation
- No instance-level geometry
- No code compliance
