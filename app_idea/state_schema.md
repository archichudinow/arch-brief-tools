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

1. Project Meta
2. Raw Inputs
3. Area Layer (Nodes, Clusters, Partitions)
4. Grouping Layer
5. Variant / Massing Layer
6. UI State (non-authoritative)

---

## Core Objects

### AreaNode
Represents a semantic space type.

Fields:
- id
- name
- area_per_unit
- count
- ai_note
- user_note
- locked_fields (optional)

Derived:
- total_area = area_per_unit × count

---

### AreaPartition
Represents a distribution of an AreaNode.

Fields:
- id
- parent_area_node_id
- count
- label
- ai_note
- user_note

Rules:
- partitions sum to parent count
- deleting partition restores count to parent

---

### AreaCluster
Optional early aggregation of AreaNodes.

Fields:
- id
- name
- member_area_node_ids
- ai_note
- user_note

Clusters do NOT affect grouping logic.

---

### Group
Represents planning logic.

Fields:
- id
- name
- members (AreaNode IDs or Partition IDs)
- rules
- ai_note
- user_note

Groups are always flat.

---

## Referential Integrity Rules
- No duplicated ownership
- No nested groups
- Partitions cannot exist without parent
- Groups reference, never copy

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
