# AI Command Language (ACL)

## Purpose
Define a **controlled interaction layer** between user, AI, and state.

Avoid free-form AI mutation.

---

## Command Structure

Each AI request resolves into:
- intent
- scope
- proposed changes
- explanation

AI NEVER applies changes directly.

---

## Example Commands

### Breakdown
"Break Flat (40 units) into 1BHK and 2BHK using brief context"

Intent:
- transform area node
Scope:
- selected AreaNode
Output:
- proposed variants + counts

---

### Split
"Split these flats into 5 / 5 / 20 units"

Intent:
- partition
Scope:
- selected AreaNode
Output:
- partitions only

---

### Merge
"Merge these rooms into one abstract area"

Intent:
- abstraction
Scope:
- selected nodes
Output:
- new AreaNode proposal

---

### Normalize
"Fix naming and unit consistency"

Intent:
- normalize
Scope:
- selected nodes or whole area layer

---

## AI Response Format

AI must return:
1. Summary
2. Assumptions
3. Proposed state diff
4. Confidence level

If confidence is low → no auto-proposal.

---

## Context Control

AI is only given:
- explicit scope
- relevant notes
- optional brief excerpt

No global context unless requested.

---

## Model Selection Guidance

- Simple transforms → cheap / fast models
- Reasoning / architecture → advanced models
- User can override per action

---

## Failure Rules

If AI:
- hallucinates data
- violates constraints
- breaks schema

System:
- rejects proposal
- preserves state

---

## Goal
AI behaves like a **junior architect**:
- proposes
- explains
- waits for approval
