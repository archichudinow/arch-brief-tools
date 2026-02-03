# Current Development Status

## Last Updated
2026-02-03

## Current Phase
**Smart Clustering Complete** — Enhanced brief parsing with placement rules

---

## Completed
- [x] Project brief documentation (project/ folder)
- [x] AI context folder structure (.ai/)
- [x] Vite + React + TypeScript setup
- [x] Tailwind CSS v4 configuration
- [x] Path aliases (@/ → src/)
- [x] Core types defined (src/types/index.ts)
- [x] App state management (Context + Reducer)
- [x] Main layout (StepTimeline + PreviewPanel)
- [x] Step 1 Input UI (text brief, site params, Excel upload)
- [x] OpenAI client integration
- [x] **ENHANCED: Brief parsing with placement rules extraction**
  - Repetition rules (per_floor, per_group, etc.)
  - Adjacency rules (must_be_adjacent, etc.)
  - Vertical placement rules (ground_floor required, etc.)
- [x] Step 2 Normalize UI (program table with qty, area, placement rules)
- [x] R3F + Three.js 3D preview (section view with colored bars)
- [x] xlsx package - Excel upload parsing & export
- [x] **ENHANCED: Step 3 Smart Clustering**
  - Cluster types (functional, per_floor, anchor, satellite, unit_based)
  - Instance rules (single, per_floor, per_parent, fixed_count)
  - Cluster bindings (must_be_with, same_floor, etc.)

---

## Architecture Changes (2026-02-03)

### ProgramItem now includes PlacementRules
- repetition: once | per_floor | per_group | per_n_groups | quantity | central_per_floor | distributed
- adjacencies: array of {type, targetName, confidence}
- vertical: groundFloor/upperFloors/basement = required | preferred | forbidden

### FunctionalGroup is now a Smart Cluster
- clusterType: functional | per_floor | anchor | satellite | distributed | unit_based
- instanceRule: single | per_floor | per_parent | fixed_count
- bindings: relationships to other clusters
- derivedFromBrief: whether cluster came from brief parsing

---

## Next Steps

### 4. Step 4 — Rules (Next)
- [ ] Functional rules configuration based on clusters
- [ ] Urban program rules
- [ ] Rule validation display

### 5-7. Remaining steps
- Constraints, Variants, Outputs

---

## Key Files
- src/types/index.ts - All TypeScript interfaces
- src/lib/openai/prompts.ts - Brief parsing with placement rules
- src/lib/openai/grouping-prompts.ts - Smart clustering
- src/components/steps/NormalizeStep.tsx - Table with qty/placement
- src/components/steps/GroupingStep.tsx - Cluster UI with bindings

