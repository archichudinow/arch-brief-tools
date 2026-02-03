# AI Command Language (ACL)

## Purpose
Define a **controlled interaction layer** between user, AI, and state.

AI proposes changes. User confirms before application.

---

## Command Categories

### 1. Parse Brief
"Parse this brief and create areas"

Input:
- Raw brief text

Output:
- Parsed areas with names, sizes, counts
- Brief notes attached to each area
- AI suggestions for missing areas
- Project context summary

---

### 2. Split Area
"Split this office into functional areas"

Input:
- Selected area node
- Optional constraints (e.g., "into 3 areas")

Output:
- Proposed child areas
- Total matches original
- Reasoning provided

---

### 3. Structured Split
"Split 10000m² hotel into:
- spa
- 2 restaurants
- rooms of 40m² and 60m²"

Input:
- Selected area node
- User-defined structure

Output:
- Areas matching structure
- AI fills in sizes/counts
- Assumptions listed

---

### 4. Merge Areas
"Merge these meeting rooms"

Input:
- Selected area nodes

Output:
- Single combined area
- Name suggestion
- Total area preserved

---

### 5. Balance Proportions
"Balance to 60% 1BHK, 40% 2BHK"

Input:
- Selected area nodes
- Target proportions

Output:
- Adjusted counts
- Area/units preserved per mode

---

### 6. Propose Grouping
"Organize these areas into groups"

Input:
- Selected area nodes

Output:
- Proposed groups
- Member assignments
- Group names/colors

---

### 7. Q&A (No State Change)
"What's typical lobby size for 200-room hotel?"

Input:
- Question text
- Project context

Output:
- Text answer only
- No proposals

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
