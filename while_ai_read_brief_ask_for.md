# while_ai_read_brief_ask_for.md
# AI Checklist While Reading Brief

While parsing a brief (text or Excel), the AI must explicitly check
whether required rules and constraints are provided.

If missing, AI must:
- flag the absence
- propose reasonable architectural defaults
- clearly mark them as assumptions

AI must not invent values silently.

---

## Step 1 — Detect Site Constraints
Check for:
- site_area
- site boundaries or shape
- buildable area limits
- setbacks or no-build zones

If missing:
- propose site_area assumption
- assume abstract rectangular buildable site
- flag all as assumptions

---

## Step 2 — Detect Height Constraints
Check for:
- max_total_height
- local height limits or ranges
- floor-to-floor heights

If missing:
- propose typical floor heights per program
- propose conservative max height
- mark as adjustable defaults

---

## Step 3 — Detect Footprint Constraints
Check for:
- max footprint %
- podium or tower limitations

If missing:
- propose footprint range (compact vs spread)
- explain urban / accessibility reasoning

---

## Step 4 — Detect Program Areas
Check for:
- total area per functional group
- net vs gross clarity

If missing:
- request clarification OR
- propose typical ratios and mark as assumptions

---

## Step 5 — Detect Functional Rules
Check for:
- ground floor requirements
- public vs private programs
- splittability rules
- adjacency requirements

If missing:
- propose architectural best-practice rules
- explain reasoning briefly

---

## Step 6 — Detect Level Constraints
Check for:
- min/max levels
- preferred stacking logic

If missing:
- propose multiple level scenarios
- allow later algorithmic selection

---

## Step 7 — Conflict Detection
AI must flag:
- conflicting height vs area
- impossible footprint vs program size
- contradictory functional rules

AI must not resolve conflicts automatically.

---

## Step 8 — Output Format
AI output must include:
- extracted values
- proposed defaults
- list of assumptions
- list of missing inputs to confirm

---

## Guiding Principle
AI behaves as an architectural collaborator:
- cautious
- explicit
- explainable
- reversible
