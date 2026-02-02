# Project: AI-Assisted Architectural Program → Volume Tool

## Goal
Build a web-based architectural tool that converts messy briefs (text or Excel) into:
- normalized program data
- AI-assisted functional grouping & stacking logic
- algorithmically valid volumetric / sectional variants
- abstract 2D room geometry with correct areas
- structured numeric outputs suitable for Excel review

The tool supports **early-stage feasibility, urban massing logic, and program stacking**, not detailed architectural design.

---

## Tech Stack
- Frontend: React 18
- Visualization: Three.js
- AI: OpenAI API (keys via `.env.local`)
- Geometry & logic: deterministic TypeScript modules (non-AI)
- Data export: JSON, Excel (.xlsx)

---

## Core Principles
- AI **suggests and explains**, never enforces geometry
- Algorithms **guarantee correctness** (areas, heights, footprints)
- Human can override AI suggestions via UI toggles
- Output is **abstract, proportional, and architectural**
- Tool supports **single-building and multi-building urban scenarios**

---

## High-Level Workflow (Sequential Steps)

### 1. Input
- Text brief and/or Excel program table
- Site parameters (area, max height, footprint range)
- Optional urban context hints (single building, multiple buildings, podium + towers)

---

### 2. Program Normalization (AI)
- Parse messy input
- Normalize units, names, areas
- Detect net vs gross ambiguity
- Output clean structured JSON

---

### 3. Functional Grouping Proposal (AI)
AI proposes:
- functional groups
- public / semi-public / private classification
- preferred placement (ground / podium / tower / separate building)
- splittability across levels or buildings
- architectural reasoning (access, visibility, privacy, urban logic)

Supports scenarios where:
- programs exist in separate buildings
- programs share a podium
- multiple towers rise from a common base

---

### 4. Rule Assignment (Human + AI)
Each functional group can be adjusted via UI:
- ground-only / upper-only / flexible
- splittable across levels or buildings
- max contiguous levels
- allowed to form separate mass
- allowed in podium / tower / standalone building

---

### 5. Parametric Constraints (Algorithmic)
Pure numeric inputs:
- site area
- max footprint %
- max height
- floor-to-floor height
- optional level count range
- optional max building count

---

### 6. Variant Generation (Algorithmic)
Generate multiple valid urban massing variants:
- single compact building
- podium + one or more towers
- multiple independent buildings
- low-rise vs high-rise distributions

Each variant validates:
- footprint compliance
- height compliance
- area balance per level and per building

---

### 7. Visualization
Primary view: **Section**
- horizontal bars = levels
- bar height = floor height
- bar width = footprint
- color = functional group
- stacked bars = levels
- multiple stacks = multiple buildings or towers

Optional secondary view:
- abstract plan blocks per building footprint

---

### 8. Output
- Abstract 2D room shapes with correct areas
- GLB model (program-based geometry)
- JSON describing program split, stacking, and buildings
- Excel file (.xlsx) including:
  - numeric area breakdown per program, level, and building
  - totals and subtotals
  - color-filled cells matching functional groups
  - variant comparison sheets

---

## AI Responsibilities (OpenAI)
- Text/Excel → normalized program data
- Architectural reasoning & urban logic explanations
- Functional grouping and stacking suggestions

AI must NOT:
- generate geometry
- invent numeric values silently
- override constraints or validation results

---

## Deterministic Responsibilities
- Area allocation
- Footprint & height validation
- Level and building stacking logic
- Variant generation
- Geometry sizing
- Excel data generation

---

## Intended Users
- Architects (early design & urban feasibility)
- Competition and concept-stage workflows
- Rapid program-to-volume and stacking exploration

---

## Non-Goals (Out of Scope)
- Detailed room layouts
- Circulation, cores, or structure
- Code compliance checking
- Construction or documentation drawings

