# User Workflow

## Step Sequence

```
Step 0: App Entry
    │
    ▼
Step 1: Brief Input ──────────────────────────────► Export: Raw JSON
    │
    ▼
Step 2: AI Brief Reading & Normalization ─────────► Export: Normalized Excel/JSON
    │
    ▼
Step 3: Functional Grouping Proposal (AI) ────────► Preview: Abstract stacking
    │
    ▼
Step 4: Rule Assignment & Adjustment ─────────────► Export: Rules JSON, Abstract GLB
    │
    ▼
Step 5: Parametric Constraints Setup ─────────────► Preview: Constraint-based section
    │
    ▼
Step 6: Variant Generation ───────────────────────► Export: Variant comparison Excel
    │
    ▼
Step 7: Visualization & Selection
    │
    ▼
Step 8: Output Export ────────────────────────────► Export: Excel, GLB, Project JSON
```

## Per-Step Breakdown

### Step 0 — App Entry
- See tool description
- Start new project OR load saved project
- No AI interaction

### Step 1 — Brief Input
**User provides:**
- Text brief (paste or upload)
- Excel file (optional)
- Site parameters (optional)

**Actions available:**
- Proceed with incomplete data
- Skip Excel or text if only one exists

**AI:** Reads but does not generate yet

---

### Step 2 — AI Brief Reading & Extraction
**AI returns:**
- Extracted site data
- Extracted program areas
- Detected rules and constraints
- Missing/unclear inputs list
- Proposed assumptions (marked)

**User actions:**
- Review extracted data
- Accept AI assumptions
- Edit values manually
- Request AI re-read
- Skip assumptions, continue manually

**No geometry generated yet**

---

### Step 3 — Program Normalization Review
**User sees:**
- Normalized program table
- Net/gross clarification
- Total area checks

**AI explains:**
- Normalization decisions
- Flags inconsistencies

**User actions:**
- Confirm or edit program areas
- Lock values before moving forward

**After confirmation:** Program data becomes **frozen input**

---

### Step 4 — Functional Grouping Proposal (AI)
**AI proposes:**
- Functional groups
- Public/private classification
- Preferred placement
- Splittability
- Urban logic explanation

**User actions:**
- Accept AI grouping fully
- Modify individual groups
- Delete AI proposal, define manually
- Skip AI entirely

**AI proposals are advisory only**

---

### Step 5 — Rule Assignment & Adjustment
**User interacts with:**
- Rule toggles per functional group
- Building/podium/tower permissions
- Splitting and continuity controls

**AI (optional):**
- Explains tradeoffs
- Warns about conflicts

**User actions:**
- Lock rules
- Leave rules flexible
- Proceed with unresolved warnings

**Rules saved as constraints for variant generation**

---

### Step 6 — Parametric Constraints Setup
**User defines:**
- Site area
- Footprint range
- Height limits
- Floor-to-floor heights
- Level count ranges
- Building count limits

**AI (optional):**
- Validates consistency
- Suggests typical values

**After this step:** Project is **fully specified**

---

### Step 7 — Variant Generation
**Algorithm:**
- Generates multiple valid variants
- Evaluates footprint, height, area balance
- Discards invalid options
- Scores variants

**User sees:**
- List of variants
- Key metrics per variant
- Warnings if constraints are tight

---

### Step 8 — Visualization & Exploration
**User explores via:**
- Section diagrams (primary)
- Building stacks
- Color-coded groups

**User actions:**
- Switch variants
- Adjust parameters, regenerate
- Lock preferred variant

**No AI required**

---

### Step 9 — Output Export
**User selects outputs:**
- Excel (.xlsx) with color-filled sheets
- GLB geometry
- JSON summary
- Project export (.app-project.json)

**Optional:** AI-generated written summary

---

## Guiding Principles
1. AI never blocks progress
2. User can skip AI at any step
3. Every output is explainable
4. Every decision is reversible
5. Always exportable at any step
