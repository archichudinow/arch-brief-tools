# rules.md
# Functional & Urban Program Rules

Rules apply per functional group.
They guide stacking, building separation, and placement logic.
Rules constrain algorithms but do not generate geometry.

---

## Building Distribution Rules
- `single_building_only`
- `multiple_buildings_allowed`
- `standalone_building_preferred`
- `shared_building_allowed`
- `max_building_count: N`

---

## Podium & Tower Rules
- `podium_required`
- `podium_allowed`
- `podium_only`
- `tower_allowed`
- `tower_required`
- `tower_only`
- `max_tower_count: N`

---

## Vertical Placement Rules
- `must_be_ground_floor`
- `ground_floor_preferred`
- `upper_floors_only`
- `podium_only`
- `tower_only`
- `no_basement`
- `basement_allowed`

---

## Splitting & Continuity Rules
- `splittable_across_levels`
- `splittable_across_buildings`
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
- `front_loaded_area`
- `top_loaded_area`
- `core_area_ratio` (advisory)

---

## Adjacency & Urban Logic Rules
- `must_be_below: [group]`
- `must_be_above: [group]`
- `must_share_podium_with: [group]`
- `avoid_adjacency_with: [group]`
- `prefer_street_frontage`
- `prefer_direct_ground_access`
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

## Public / Private Rules
- `public_access_required`
- `controlled_access`
- `private_only`
- `public_below_private`

---

## Variant Control Rules
- `include_in_all_variants`
- `optional_program`
- `allow_program_relocation`
- `lock_building_assignment`
- `lock_vertical_position`

---

## AI Guidance Rules (Non-Deterministic)
- `ai_reasoning_required`
- `ai_explain_urban_tradeoffs`
- `ai_suggest_podium_tower_split`
- `ai_suggest_multi_building_options`

---

## Notes
- Conflicting rules must be flagged, not resolved silently.
- Deterministic solvers always override AI suggestions.
- All rules must be exportable as structured data (JSON / Excel).
