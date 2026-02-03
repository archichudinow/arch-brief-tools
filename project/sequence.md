# user_usage_sequence.md
# User Flow: From Brief to Outputs

This document describes how a user interacts with the tool
from first opening the app to exporting final outputs.

The flow is sequential but flexible:
- AI proposes
- user can accept, adjust, or skip
- deterministic logic validates all results

---

## Step 0 — App Entry
User opens the web app.

User sees:
- short description of tool purpose
- option to start a new project or load a saved one

No AI interaction yet.

---

## Step 1 — Brief Input
User provides:
- text brief (paste or upload)
- Excel file (optional)
- site parameters (optional at this stage)

User actions:
- can proceed with incomplete data
- can skip Excel or text if only one exists

AI action:
- AI reads input but does not yet generate proposals

---

## Step 2 — AI Brief Reading & Extraction
AI parses the brief.

AI returns:
- extracted site data
- extracted program areas
- detected rules and constraints
- list of missing or unclear inputs
- proposed assumptions (clearly marked)

User actions:
- review extracted data
- accept AI assumptions
- edit values manually
- request AI to re-read after edits
- skip assumptions and continue with manual input

At this step, **no geometry is generated**.

---

## Step 3 — Program Normalization Review
User sees:
- normalized program table
- net / gross clarification
- total area checks

AI action:
- explains normalization decisions
- flags inconsistencies or conflicts

User actions:
- confirm or edit program areas
- lock values before moving forward
- skip AI explanation if satisfied

Once confirmed, program data becomes **frozen input**.

---

## Step 4 — Functional Grouping Proposal (AI)
AI proposes:
- functional groups
- public / private classification
- preferred placement (ground / podium / tower / separate building)
- splittability across levels or buildings
- urban logic explanation

User actions:
- accept AI grouping fully
- modify individual group rules
- delete AI proposal and define rules manually
- skip AI proposal entirely

AI proposals are **advisory only**.

---

## Step 5 — Rule Assignment & Adjustment
User interacts with:
- rule toggles per functional group
- building / podium / tower permissions
- splitting and continuity controls

AI action (optional):
- explains tradeoffs of rule combinations
- warns about potential conflicts

User actions:
- lock rules
- leave rules flexible
- proceed even with unresolved warnings

Rules are saved as **constraints for variant generation**.

---

## Step 6 — Parametric Constraints Setup
User defines numeric constraints:
- site area
- footprint range
- height limits
- floor-to-floor heights
- level count ranges
- building count limits

AI action:
- validates numeric consistency
- suggests typical values if missing (optional)

User actions:
- accept defaults
- override values
- skip AI suggestions

At this point, the project is **fully specified**.

---

## Step 7 — Variant Generation
User triggers variant generation.

Algorithmic action:
- generate multiple valid variants
- evaluate footprint, height, area balance
- discard invalid options
- score variants

AI action:
- optional explanation of differences between variants

User sees:
- list of variants
- key metrics per variant
- warnings if constraints are tight

---

## Step 8 — Visualization & Exploration
User explores variants via:
- section diagrams (primary)
- building stacks (multi-building scenarios)
- color-coded functional groups

User actions:
- switch variants
- adjust parameters and regenerate
- lock a preferred variant

No AI is required at this stage.

---

## Step 9 — Output Selection
User selects one or more variants for export.

User chooses output types:
- Excel (.xlsx)
- JSON
- GLB geometry
- 2D abstract room shapes

---

## Step 10 — Export Outputs
System generates outputs.

Outputs include:
- Excel file with numeric breakdowns
  - per program
  - per level
  - per building
  - color-filled cells matching program groups
- GLB model with proportional geometry
- JSON describing rules, constraints, and stacking logic

AI action:
- optional written summary of the selected variant

---

## End State
User leaves with:
- validated feasibility options
- clear program distribution logic
- shareable numeric and geometric outputs
- ability to re-enter and iterate later

---

## Guiding Experience Principles
- AI never blocks progress
- user can skip AI at any step
- every output is explainable
- every decision is reversible
