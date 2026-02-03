# Application Architecture

## High-Level Structure

```
┌─────────────────────────────────────────────────────────┐
│                    APP SHELL                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │              TOP NAV - STEP TIMELINE            │   │
│  │  [Input][Normalize][Grouping][Rules][...][Out]  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌────────────────────────┐  ┌──────────────────────┐  │
│  │                        │  │                      │  │
│  │   MAIN CONTENT AREA    │  │   3D PREVIEW PANEL   │  │
│  │   (Scrollable)         │  │   (Fixed/Collapsible)│  │
│  │                        │  │                      │  │
│  │   - Step content       │  │   - Section view     │  │
│  │   - AI outputs         │  │   - Building stacks  │  │
│  │   - User inputs        │  │   - Mass blocks      │  │
│  │   - Validation         │  │                      │  │
│  │   - Local actions      │  │   R3F Canvas         │  │
│  │                        │  │                      │  │
│  └────────────────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

```
User Input (Text/Excel)
       │
       ▼
┌─────────────┐
│  AI Parse   │ ◄── OpenAI API
│  & Extract  │
└─────────────┘
       │
       ▼
┌─────────────┐
│  Normalize  │ ◄── AI + User Review
│  Program    │
└─────────────┘
       │
       ▼
┌─────────────┐
│  Functional │ ◄── AI Proposal + User Override
│  Grouping   │
└─────────────┘
       │
       ▼
┌─────────────┐
│  Rule       │ ◄── User Toggles (AI advisory)
│  Assignment │
└─────────────┘
       │
       ▼
┌─────────────┐
│  Parametric │ ◄── User Input (Numeric)
│ Constraints │
└─────────────┘
       │
       ▼
┌─────────────────────┐
│  Variant Generation │ ◄── Deterministic Algorithm
│  (Algorithmic)      │
└─────────────────────┘
       │
       ▼
┌─────────────┐
│   Outputs   │ ──► Excel, GLB, JSON
└─────────────┘
```

## Module Responsibilities

### AI Modules (OpenAI)
- Parse text/Excel briefs
- Normalize program data
- Propose functional groupings
- Explain architectural reasoning
- Flag missing data & propose assumptions

### Deterministic Modules (TypeScript)
- Area allocation algorithms
- Footprint & height validation
- Level and building stacking logic
- Variant generation engine
- Geometry sizing
- Excel/GLB data generation

## State Architecture

```typescript
interface AppState {
  // Project metadata
  project: ProjectMetadata;
  
  // Current step
  currentStep: StepId;
  completedSteps: StepId[];
  
  // Step-specific data
  input: InputState;
  normalized: NormalizedProgramState;
  grouping: GroupingState;
  rules: RulesState;
  constraints: ConstraintsState;
  variants: VariantsState;
  
  // UI state
  ui: UIState;
}
```

## Key Design Patterns

1. **Step-based navigation** - Linear but flexible, can jump back
2. **AI as advisor** - All AI output is skippable/overridable
3. **Progressive enhancement** - Preview updates as data becomes available
4. **Cascade updates** - Changes propagate forward, invalidate downstream
5. **Export at any step** - Partial outputs always available
