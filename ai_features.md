# ai_features.md

## Purpose
Define a minimal, structured set of AI interaction patterns used by the app to:
- improve response quality
- reduce prompt ambiguity
- enable scalable feature development
- avoid overloading AI with unnecessary context

This document describes **what the AI should be good at**, not how it is implemented.

---

## 1. Context Creation Actions

AI can create and manage compact contexts that persist across actions.

### Context Types
- **Brief Context**
  - Parsed from raw brief text
  - Close to source, lightly normalized
- **Specification Context**
  - Parsed from files or structured inputs
  - Used to validate or adjust program logic
- **Typology / Reference Context**
  - Domain-based (e.g. “Dutch Offices”, “Dubai Hotels”)
  - Used for inference when data is missing

### Example Usage
- “Read brief and create program”
- “Read specifications and adjust program”
- “Apply new client specification to existing groups”

---

## 2. Generation Actions

AI generates structured outputs using:
- brief context
- specification context
- typology context
- direct user prompt

### Generation Targets
- Program (list of areas / rooms)
- Groups (abstract functional clusters)
- Areas (lowest-grain manipulable nodes)

### Example Usage
- “Generate office program of 10,000 sqm”
- “Generate hotel functional groups”
- “Generate outdoor areas based on existing program”

AI may **suggest sizes** when not explicitly defined, with reasoning.

---

## 3. Adjustment Actions

AI modifies existing structures without regenerating everything.

### Supported Operations
- Increase / Decrease
- Rebalance
- Variate
- Unfold (abstract → detailed)
- Merge (detailed → abstract)

### Example Usage
- “Unfold this area into a group”
- “Merge all service areas per group into one”
- “Rebalance residential vs commercial areas”

---

## 4. Iterative (For-Loop) Actions

AI applies logic repeatedly across nodes.

### Example Usage
- “For each group, propose service areas”
- “For each room, add functional notes”
- “For each residential unit, suggest size variants”

---

## 5. Filter & Cleanup Actions

AI helps reduce or reorganize complexity.

### Operations
- Filter by type
- Remove unused nodes
- Merge similar nodes
- Flag inconsistencies

### Example Usage
- “Filter out storage areas”
- “Merge similar technical rooms”
- “Remove redundant groups”

---

## 6. AI Roles (Perspective Control)

AI can respond using one or more professional lenses.

### Roles
- Urban Architect
- Architect
- Landscape Architect
- Interior Architect

Roles affect:
- reasoning
- vocabulary
- grouping logic
- scale of thinking

Roles can be combined.

---

## 7. Prompt Enhancement Feature

Before executing an action:
- AI proposes **2 short enhanced versions** of the user prompt
- Optimized for:
  - app terminology
  - architectural clarity
  - minimal ambiguity

User can:
- use original prompt
- select one enhanced version

Enhanced prompts are short and system-aware.

---

## 8. Context Injection Feature

AI can selectively include additional context when needed.

### Use Cases
- brief updated mid-process
- new client requirements
- exploration of typical solutions
- switching project typology

Context injection is **explicit**, not automatic.

---

## Core Principle

AI operates on **structured state**, not raw files.
Only relevant context is sent per action.
AI assists, suggests, and explains — it does not enforce geometry or numeric constraints.

