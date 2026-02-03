# Undo, Redo & Branching Strategy

## Purpose
Enable exploratory design without fear.
All actions must be reversible.

---

## Core Concept

The system uses **state snapshots**, not command replay.

Each confirmed action produces a new state node.

---

## History Model

State Graph (not linear):

- root
  - state A
    - state B
      - state C
    - state D (branch)

User can:
- undo
- redo
- branch
- rename branches

---

## Action Types

### Local Actions
- edit area
- split partition
- rename
- drag & drop

→ instant snapshot

---

### AI Actions
- always previewed
- require user confirmation
- applied as single atomic state

---

## Branching Use Cases

- compare grouping strategies
- test different breakdown assumptions
- explore podium vs tower logic later

Branches share history until divergence.

---

## UI Implications

- History panel (optional)
- Branch labels
- Restore from any snapshot
- Non-destructive exploration

---

## Performance Note
Snapshots store:
- full logical state
- not geometry buffers

Geometry is always derived.

---

## Design Principle
Undo is not a feature.
It is **foundational trust**.
