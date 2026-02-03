# constraints.md
# Parametric & Urban Constraints (Algorithmic)

Constraints are global, numeric, and deterministic.
They apply across all buildings, towers, and variants.

---

## Site Constraints
- `site_area`
- `buildable_area_ratio`
- `site_shape_type` (abstract)
- `max_building_coverage_area`

---

## Footprint Constraints
- `min_footprint_ratio`
- `max_footprint_ratio`
- `absolute_max_footprint_area`
- `min_footprint_area`
- `tower_plate_ratio_max`
- `podium_footprint_ratio_max`

---

## Height Constraints
- `min_total_height`
- `max_total_height`
- `height_range_allowed`
- `max_height_strict`
- `tower_height_limit`
- `podium_height_limit`

---

## Building Count Constraints
- `min_building_count`
- `max_building_count`
- `max_tower_count`
- `max_podium_count`

---

## Level Constraints
- `min_levels`
- `max_levels`
- `preferred_levels`
- `level_count_range`
- `tower_level_range`
- `podium_level_range`

---

## Floor-to-Floor Constraints
- `min_floor_height`
- `max_floor_height`
- `default_floor_height`
- `floor_height_variance_allowed`

---

## Program Allocation Constraints
- `total_program_area`
- `area_tolerance_percentage`
- `min_area_per_building`
- `max_area_per_building`
- `min_area_per_level`
- `max_area_per_level`

---

## Urban Massing Constraints
- `stepback_start_level`
- `stepback_ratio`
- `tower_to_podium_area_ratio`
- `max_slenderness_ratio` (advisory)

---

## Variant Generation Constraints
- `max_variants_generated`
- `discard_invalid_variants`
- `score_variants_by_efficiency`
- `score_variants_by_compactness`
- `score_variants_by_height_balance`

---

## Validation Rules
- sum(program_areas) ≤ sum(buildable_areas)
- footprint_area ≤ site_area * max_footprint_ratio
- total_height ≤ max_total_height
- building_count ≤ max_building_count
- violations must be flagged, not auto-corrected

---

## Output Constraints
- all numeric values must be exportable to Excel
- per-variant totals and subtotals required
- color mapping must match functional groups

---

## Notes
- Constraints override rules and AI suggestions.
- All variants must fully comply before visualization.

