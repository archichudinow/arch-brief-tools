# ui.md
# Sequential UI Layout & Interaction Model

The UI is designed as a **guided, step-based experience**
with full transparency, reversibility, and continuous visual feedback.

The user always knows:
- where they are
- what is AI-generated
- what is editable
- what can be exported at each step

---

## Global Layout Structure

### Top Navigation — Step Timeline
A horizontal step bar fixed at the top.

- Each step is a tab
- Steps are ordered left → right
- Completed steps are marked
- Current step is highlighted
- Future steps are clickable (with warnings if dependencies exist)

Example:
[ Input ] — [ Normalize ] — [ Grouping ] — [ Rules ] — [ Constraints ] — [ Variants ] — [ Outputs ]

---

### Main Content Area (Scrollable)
Each step opens as a **long, scrollable page**.

Structure per step:
1. Step header (goal + status)
2. AI output panel (if applicable)
3. User input / controls
4. Validation & warnings
5. Local actions (save, regenerate, export)
6. Embedded Three.js preview (when relevant)

---

### Persistent Right Panel — 3D / Section Preview
A fixed or collapsible right-side panel.

- Three.js canvas
- Shows best-available preview for current step
- Updates progressively as data becomes available
- Can switch between:
  - section view
  - stacked buildings
  - simple mass blocks

Early steps show placeholders or diagrams.

---

## Step-by-Step UI Breakdown

---

## Step 1 — Input

### Content
- Text area for brief input
- Excel upload
- Site parameter fields (optional)

### AI Interaction
- “Read Brief with AI” button

### Exports Available
- raw input Excel (if uploaded)
- raw project JSON snapshot

---

## Step 2 — Normalize

### Content
- Normalized program table
- Unit & net/gross indicators
- Highlighted assumptions

### AI Interaction
- AI explanation panel (collapsible)
- “Re-read Brief” button

### User Actions
- Edit normalized values
- Accept or reject assumptions
- Lock normalized data

### Exports Available
- normalized Excel (.xlsx)
- normalized program JSON

---

## Step 3 — Grouping

### Content
- Functional groups list
- Public / private tags
- Building / podium / tower suggestions

### AI Interaction
- AI proposal card per group
- “Why?” expandable reasoning

### User Actions
- Accept AI grouping
- Override per group
- Create custom groups

### Preview
- Abstract stacking diagram
- Color-coded group blocks

---

## Step 4 — Rules

### Content
- Rule toggles per group
- Building distribution controls
- Splitting and adjacency settings

### AI Interaction
- Conflict warnings
- Tradeoff explanations (optional)

### Preview
- Updated stacking diagram
- Multiple building indicators

### Exports Available
- rules JSON
- intermediate GLB (abstract)

---

## Step 5 — Constraints

### Content
- Numeric sliders and inputs
- Site / height / footprint sections
- Validation indicators

### AI Interaction
- Suggested defaults (optional)
- Consistency warnings

### Preview
- Section bars reflecting constraints

---

## Step 6 — Variants

### Content
- Variant list with key metrics
- Filters (height, compactness, building count)
- Variant score comparison

### User Actions
- Select variant
- Lock variant
- Regenerate with new params

### Preview
- Detailed section view
- Multi-building stacks
- Hover tooltips with numbers

### Exports Available
- variant comparison Excel
- variant JSON set

---

## Step 7 — Outputs

### Content
- Selected variant summary
- Program distribution tables
- Final validation status

### Exports Available
- Excel (.xlsx) with color-filled sheets
- GLB geometry
- Project export (.app-project.json)
- Summary JSON

### AI Interaction
- Optional AI-generated written summary

---

## Navigation & Flow Rules

- User may jump back to any previous step
- Forward steps warn if regeneration is required
- Locked steps prevent accidental overwrite
- Changes cascade forward only

---

## Visual Language

- AI-generated content is visually tagged
- User-edited values are highlighted
- Validated values are marked
- Conflicts are never hidden

---

## Design Principles

- No modal dead-ends
- Everything scrolls
- No forced AI steps
- Always exportable
- Architect-readable before visually impressive
