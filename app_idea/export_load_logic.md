# Export & Load Logic – Persistent Project State

## Purpose
Allow the user to:
- export the project at any step
- refresh or close the app
- reload the project
- continue work **without re-invoking AI**

AI is optional, never required for restoration.

---

## Core Principle

> The **project state is authoritative**, not the AI.

All AI outputs must be:
- embedded into state
- traceable
- reproducible without re-querying models

---

## Export Granularity

Export is available at **every step**.

Export formats:
- Project JSON (authoritative)
- Step-specific artifacts (Excel, GLB)
- Optional AI logs (non-authoritative)

---

## Project JSON (Primary Artifact)

The exported project JSON must contain:

### 1. Schema Version
Used for migration.

```json
{
  "schema_version": "1.0.0"
}



2. Project Meta
{
  "project": {
    "id": "uuid",
    "name": "Mixed Use Feasibility",
    "created_at": "...",
    "last_modified": "...",
    "current_step": 2
  }
}

3. Raw Inputs (Frozen)

AI-readable but never re-parsed automatically.

{
  "raw_inputs": {
    "brief_text": "...",
    "uploaded_excel": "base64 or reference"
  }
}

4. Area Layer (Authoritative)

Includes:

AreaNodes

Partitions

Clusters

Notes

Locks

This is the single source of truth for Step 1.

5. Grouping Layer (If Exists)

Includes:

Groups

Membership references

Group rules

Notes

6. Variant / Massing Layer (If Exists)

Includes:

selected variant

param inputs

derived metrics

references to area/group IDs

Geometry is never stored, only references.

7. History (Optional)
{
  "history": {
    "snapshots": [...],
    "branches": [...]
  }
}


Can be trimmed for lightweight export.

Load Logic
On Load

Validate schema version

Restore state exactly

Restore UI step

Recompute derived values

DO NOT call AI

Derived Values

Values such as:

total areas

partition sums

group totals

are recomputed deterministically.

Step Awareness

Each step reads from state:

Step	Required State
Step 1 – Area Tools	Area Layer
Step 2 – Grouping	Area + Grouping
Step 3 – Massing	Area + Groups + Params

User may:

go backward

skip AI steps

modify earlier data

Re-entering AI Workflow

AI is invoked ONLY when:

user explicitly asks

user confirms scope & cost

AI never re-runs automatically on load.

Partial Exports

Each step can export:

normalized Excel

grouped Excel

abstract GLB

These are derived, not required for reload.

Failure Safety

If project JSON is corrupted:

app loads raw inputs

warns user

offers AI re-run manually

Design Intent

This enables:

offline-first workflows

long-running projects

safe experimentation

trust in the tool

Non-Goals

No auto-sync to AI

No hidden re-parsing

No irreversible AI steps