# rules_assignment.md
# Functional Group Rule Assignment

Each functional group can be assigned a set of rules.
Rules are adjustable by user and may be initially proposed by AI.

---

## Vertical Placement Rules
- `must_be_ground_floor`
- `ground_floor_preferred`
- `upper_floors_only`
- `podium_only`
- `no_basement`
- `basement_allowed`

---

## Splitting & Continuity Rules
- `splittable_across_levels`
- `must_be_contiguous`
- `single_level_only`
- `max_contiguous_levels: N`
- `min_levels: N`
- `max_levels: N`

---

## Area Distribution Rules
- `min_area_per_level`
- `max_area_per_level`
- `even_area_distribution`
- `front_loaded_area` (larger area at lower levels)
- `top_loaded_area` (larger area at upper levels)

---

## Adjacency & Stacking Rules
- `must_be_below: [group]`
- `must_be_above: [group]`
- `avoid_adjacency_with: [group]`
- `prefer_direct_access_from_ground`
- `buffer_required_above`

---

## Height & Scale Rules
- `min_floor_height`
- `max_floor_height`
- `double_height_allowed`
- `double_height_preferred`
- `double_height_required`

---

## Footprint Behavior Rules
- `full_footprint_preferred`
- `reduced_footprint_allowed`
- `stepback_required_above_level: N`
- `tower_plate_allowed`
- `tower_plate_preferred`

---

## Public / Private Logic
- `public_access_required`
- `controlled_access`
- `private_only`
- `public_below_private`

---

## Variant Control Rules
- `include_in_all_variants`
- `optional_program`
- `allow_program_swap`
- `lock_position`

---

## AI Guidance Rules (Non-Deterministic)
- `ai_reasoning_required`
- `ai_explain_tradeoffs`
- `ai_suggest_alternatives`

---

## Notes
- Rules constrain but do not generate geometry.
- Conflicting rules must be flagged, not resolved silently.
- Deterministic solvers must always override AI suggestions when constraints are violated.
