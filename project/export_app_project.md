# export_app_project.md
# Project Export & Re-Import Specification

The application must support exporting the full project state
so users can reopen, review, and continue work from any step.

The exported project is a **source-of-truth snapshot**, not just an output.

---

## Export Purpose
- allow long-running architectural exploration
- enable pause / resume workflows
- support team sharing and review
- guarantee reproducibility of variants and outputs

---

## Export Format
- primary format: JSON (`.app-project.json`)
- optional packaged format: ZIP
  - project JSON
  - generated outputs (Excel, GLB)
  - preview images

---

## Stored Project State (Required)

### 1. Project Metadata
- project_name
- project_id
- creation_date
- last_modified
- app_version

---

### 2. User Progress State
- last_completed_step
- active_step
- locked_steps (if any)

Allows reopening the project at **any step**.

---

### 3. Original Inputs
- raw_text_brief
- original_excel_file (base64 or reference)
- manual user inputs

No data is overwritten or discarded.

---

### 4. Normalized Program Data
- normalized program JSON
- unit assumptions
- net/gross flags
- confidence scores (if available)

---

### 5. AI Outputs & Assumptions
- extracted constraints
- proposed rules
- missing data flags
- AI assumptions (explicitly marked)
- AI explanations (optional)

AI outputs are stored as **advisory layers**, not authoritative data.

---

### 6. User-Adjusted Rules
- per-group rule assignments
- locked vs flexible rules
- overrides of AI proposals

---

### 7. Parametric Constraints
- site constraints
- footprint constraints
- height constraints
- building count constraints
- variant generation limits

---

### 8. Variant Generation State
- generated variants (IDs only or full data)
- discarded variants with reasons
- variant scores
- user-selected variant(s)

---

### 9. Visualization State (Optional)
- active variant
- camera position
- section orientation
- color mappings

Purely UI-level, not required for regeneration.

---

### 10. Output Artifacts (Optional)
- exported Excel files
- exported GLB models
- exported JSON summaries

These can be regenerated if missing.

---

## Re-Import Behavior

When importing a project file:
- app restores all stored state
- user resumes at last active step
- user may navigate to any previous step
- downstream steps are marked as “needs regeneration” if inputs change

---

## Versioning & Compatibility
- app_version must be stored
- on version mismatch:
  - attempt automatic migration
  - warn user of potential incompatibilities

---

## Guiding Principles
- no irreversible actions
- AI output never blocks edits
- deterministic steps must be reproducible
- project file is human-readable where possible
