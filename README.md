# Project: AI-Assisted Architectural Program → Volume Tool

## Goal
Build a web-based architectural tool that converts messy briefs (text or Excel) into:
- normalized program data
- AI-assisted functional grouping & stacking logic
- algorithmically valid volumetric / sectional variants
- abstract 2D room geometry with correct areas

The tool supports **early-stage feasibility, massing logic, and program stacking**, not detailed design.

---

## Tech Stack
- Frontend: React 18
- Visualization: Three.js
- AI: OpenAI API (keys via `.env.local`)
- Geometry & logic: deterministic TypeScript modules (non-AI)

---

## Core Principles
- AI **suggests and explains**, never enforces geometry
- Algorithms **guarantee correctness** (areas, heights, footprints)
- Human can override AI suggestions via UI toggles
- Output is **abstract, proportional, and architectural**, not detailed plans

---

## High-Level Workflow (Sequential Steps)

### 1. Input
- Text brief and/or Excel program table
- Site parameters (area, max height, footprint range)

### 2. Program Normalization (AI)
- Parse messy input
- Normalize units, names, areas
- Output clean structured JSON

### 3. Functional Grouping Proposal (AI)
AI proposes:
- functional groups
- preferred vertical placement (GF / podium / upper)
- splittability across levels
- architectural reasoning (access, privacy, visibility)

### 4. Rule Assignment (Human + AI)
Each group has adjustable rules:
- must be on ground / upper only
- splittable or not
- max contiguous levels
- stacking priority

### 5. Parametric Constraints (Algorithmic)
Pure numeric inputs:
- site area
- max footprint %
- max height
- floor-to-floor height
- optional level count range

### 6. Variant Generation (Algorithmic)
Generate multiple valid stacking variants:
- low-rise vs high-rise
- podium + tower logic
- footprint / height compliance
- area balance per level

### 7. Visualization
Primary view: **Section**
- horizontal bars = levels
- bar height = floor height
- bar width = footprint
- color = functional group
- stacked bars = levels

### 8. Output
- Abstract 2D room shapes with correct areas
- GLB model (program-based geometry)
- JSON describing program split & stacking logic

---

## AI Responsibilities (OpenAI)
- Text/Excel → normalized program data
- Architectural reasoning & explanations
- Functional grouping suggestions

AI must NOT:
- generate geometry
- invent areas
- override numeric constraints

---

## Deterministic Responsibilities
- Area allocation
- Footprint & height validation
- Level stacking logic
- Variant generation
- Geometry sizing

---

## Intended Users
- Architects (early design phase)
- Feasibility & competition workflows
- Rapid program-to-volume exploration

---

## Non-Goals (Out of Scope)
- Detailed room layouts
- Circulation & cores
- Code compliance
- Construction detailing
