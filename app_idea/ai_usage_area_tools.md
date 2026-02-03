# AI Usage – Area Tool Strategy

## Core Principle
AI is used for **reasoning and transformation**, not storage or geometry.

The system uses a **compressed project context** for all AI decisions.

---

## Two-Phase AI Interaction

### Phase 1: Brief Processing
- User pastes text brief
- AI parses and extracts areas
- AI generates **project context summary** (~200-500 tokens)
- AI proposes additional areas if missing
- User reviews and confirms

### Phase 2: Interactive Chat
- User sends questions or commands
- Context includes: project summary + selected items
- AI responds with answers or proposals
- User accepts/modifies/rejects proposals

---

## Project Context Summary

Generated during brief processing. Stored in `project.meta.aiContext`.

Contains:
- Project type (hotel, office, residential, mixed-use, etc.)
- Total program area
- Key constraints mentioned
- Primary program components
- Notable requirements

Example:
```
"Mixed-use development, 45,000m² total. Hotel (200 rooms) + 
Office (Grade A, 15,000m²) + Retail podium (5,000m²). 
Green building certification required. Urban site, 
height restriction 120m. Premium positioning."
```

This context is sent with every AI request.

---

## Context Scoping Rules

### Minimal Context (Fast/Cheap)
Use for:
- Rename suggestions
- Unit adjustments
- Simple Q&A

Context sent:
- Project context summary
- Selected node(s) summary

Models: Fast/cheap GPT variants

---

### Standard Context
Use for:
- Area breakdowns
- Split proposals
- Grouping suggestions

Context sent:
- Project context summary
- Selected nodes with details
- Related group info

Models: Standard GPT

---

### Full Context (Expensive)
Use for:
- Brief re-parsing
- Full program analysis
- Cross-program optimization

Context sent:
- Project context summary
- Full area state
- All groups
- Original brief excerpt

Models: Advanced reasoning models
User confirmation required.

---

## Token Awareness & UX

System should:
- estimate token usage before sending
- display cost level (low / medium / high)
- allow cancel during streaming
- show partial results

User may:
- choose model tier
- paste personal OpenAI API key
- set monthly / session token limits

---

## AI Roles

AI acts as:
- Architect (reasoning)
- Editor (normalization)
- Advisor (options)

AI never:
- enforces decisions
- mutates state silently
- invents numeric data

All changes require user confirmation.

---

## Failure Handling

If AI response:
- is unclear
- incomplete
- irrelevant

System:
- discards changes
- preserves state
- prompts user for clarification

No auto-apply on ambiguity.

---

## Long-Term Goal
AI becomes a **collaborative design assistant**,
not a black-box generator.

Reasoning is visible.
Decisions are reversible.
Context is controlled.
