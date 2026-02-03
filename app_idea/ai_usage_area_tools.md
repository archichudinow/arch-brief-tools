# AI Usage – Area Tool Strategy

## Core Principle
AI is used for **reasoning and transformation**, not storage or geometry.

The system avoids sending full project context unless required.

---

## Context Scoping Rules

### Small Actions (Cheap / Fast Models)
Use minimal context:
- rename area
- adjust count
- split partitions
- simple breakdowns

Context sent:
- selected node(s)
- brief excerpt
- local notes only

Models:
- fast / low-cost GPT variants

---

### Medium Actions
Examples:
- breaking down large abstract areas
- clustering rooms
- proposing variants for one program

Context:
- selected nodes
- related clusters
- relevant brief sections

Models:
- standard GPT model

---

### Heavy Actions (Expensive / Explicit)
Examples:
- full brief reinterpretation
- re-normalization
- architectural reasoning across programs

Context:
- full normalized state
- brief
- group summaries

Models:
- advanced reasoning models

User must confirm before execution.

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
