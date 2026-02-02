# constraints.md
# Parametric Constraints (Algorithmic)

Constraints are pure numeric inputs.
They are deterministic, non-AI, and globally applied to all variants.

---

## Site Constraints
- `site_area`
- `site_shape_type` (abstract: rectangular / irregular)
- `buildable_area_ratio`

---

## Footprint Constraints
- `min_footprint_ratio`
- `max_footprint_ratio`
- `absolute_max_footprint_area`
- `min_footprint_area`

---

## Height Constraints
- `min_total_height`
- `max_total_height`
- `height_range_allowed`
- `max_height_strict` (boolean)

---

## Level Constraints
- `min_levels`
- `max_levels`
- `preferred_levels`
- `level_count_range`

---

## Floor-to-Floor Constraints
- `min_floor_height`
- `max_floor_height`
- `default_floor_height`
- `floor_height_variance_allowed`

---

## Program Allocation Constraints
- `total_program_area`
- `min_area_per_level`
- `max_area_per_level`
- `area_tolerance_percentage`

---

## Setback & Massing Constraints
- `stepback_start_level`
- `stepback_ratio`
- `tower_plate_ratio`
- `podium_levels_max`

---

## Variant Generation Constraints
- `max_variants_generated`
- `discard_invalid_variants`
- `score_variants_by_efficiency`
- `prefer_compact_mass`

---

## Validation Rules
- footprint * levels ≥ total_program_area
- total_height ≤ max_total_height
- footprint_area ≤ site_area * max_footprint_ratio
- violations must be flagged, not auto-corrected

---

## Notes
- Constraints are evaluated before visualization.
- All generated variants must fully comply.
- Constraints override AI suggestions and user preferences.
