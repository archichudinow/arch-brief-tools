# Unified Instance Model Architecture

## Overview

A simplified, unified approach where every AreaNode can be:
- **Independent** - a unique area with its own values
- **Instance** - linked to a source, auto-updates when source changes
- **Collapsed group** - visual compression of identical instances (quantity > 1)

## Core Principle

**Quantity is display compression, not data structure.**

```
[Room A ×100] ≡ [Room A][Room A]...[Room A] (100 times)
```

Same data, different visualization.

## Data Model

### AreaNode (Unified)

```typescript
interface AreaNode {
  id: UUID;
  name: string;
  
  // Area definition
  areaPerUnit: number;      // Area of single unit in m²
  quantity: number;         // 1 = individual, N = collapsed group
  
  // Instance linking
  instanceOf?: UUID | null; // If set, this is an instance of another node
                            // areaPerUnit inherited from source
  
  // Container behavior  
  children?: UUID[];        // If present, node is a container
                            // areaPerUnit becomes computed (sum of children)
  
  // Existing fields
  parentId?: UUID | null;
  groupId?: UUID | null;
  lockedFields?: string[];
  notes?: Note[];
  
  // Formula reasoning (from AI)
  formulaReasoning?: string | null;
  formulaConfidence?: number | null;
  formulaType?: string | null;
}
```

### Key Behaviors

| Property | Behavior |
|----------|----------|
| `instanceOf: null` | Independent node, `areaPerUnit` is editable |
| `instanceOf: uuid` | Instance node, `areaPerUnit` inherited from source |
| `quantity: 1` | Single visual card |
| `quantity: N` | Collapsed visual card showing "×N" |
| `children: [...]` | Container, `areaPerUnit` = sum of children |

### Computed Area Logic

```typescript
function getNodeArea(node: AreaNode, nodes: Record<UUID, AreaNode>): number {
  // Container: recursively sum children
  if (node.children?.length) {
    return node.children.reduce((sum, childId) => 
      sum + getNodeArea(nodes[childId], nodes), 0);
  }
  
  // Instance: use source's areaPerUnit
  if (node.instanceOf && nodes[node.instanceOf]) {
    return nodes[node.instanceOf].areaPerUnit * node.quantity;
  }
  
  // Independent: use own areaPerUnit
  return node.areaPerUnit * node.quantity;
}

function getEffectiveAreaPerUnit(node: AreaNode, nodes: Record<UUID, AreaNode>): number {
  if (node.instanceOf && nodes[node.instanceOf]) {
    return nodes[node.instanceOf].areaPerUnit;
  }
  return node.areaPerUnit;
}
```

## Operations

### 1. Duplicate as Instance

Creates a linked copy that auto-updates when source changes.

```typescript
function duplicateAsInstance(sourceId: UUID): UUID {
  const source = nodes[sourceId];
  const newNode: AreaNode = {
    id: uuidv4(),
    name: source.name,
    areaPerUnit: source.areaPerUnit, // Copied but overridden by instanceOf
    quantity: source.quantity,
    instanceOf: sourceId,            // KEY: links to source
  };
  return newNode.id;
}
```

**Use case:** "I want 3 copies of this lobby, all update together"

```
Before: [Lobby 200m²]
After:  [Lobby 200m²] [Lobby 200m²] [Lobby 200m²]
        (all linked - change one, all change)
```

### 2. Duplicate as Copy

Creates an independent copy with no link.

```typescript
function duplicateAsCopy(sourceId: UUID): UUID {
  const source = nodes[sourceId];
  const newNode: AreaNode = {
    id: uuidv4(),
    name: `${source.name} (copy)`,
    areaPerUnit: source.areaPerUnit,
    quantity: source.quantity,
    instanceOf: null,                // KEY: no link
  };
  return newNode.id;
}
```

**Use case:** "I want a variant based on this room but with different size"

```
Before: [Room A 30m²]
After:  [Room A 30m²] [Room A (copy) 30m²]
        (independent - can edit copy freely)
```

### 3. Collapse (Visual Grouping)

Merge identical instances into one card with quantity.

```typescript
function collapseNodes(nodeIds: UUID[]): UUID {
  // All must have same instanceOf (or all be independent with same source)
  const nodes = nodeIds.map(id => getNode(id));
  const sourceId = nodes[0].instanceOf ?? nodes[0].id;
  
  const totalQuantity = nodes.reduce((sum, n) => sum + n.quantity, 0);
  
  // Create collapsed node
  const collapsed: AreaNode = {
    id: uuidv4(),
    name: nodes[0].name,
    areaPerUnit: nodes[0].areaPerUnit,
    quantity: totalQuantity,
    instanceOf: nodes[0].instanceOf,
  };
  
  // Delete originals
  nodeIds.forEach(id => deleteNode(id));
  
  return collapsed.id;
}
```

**Use case:** "Show me 100 rooms as one card"

```
Before: [Room][Room][Room]...[Room] (100 cards)
After:  [Room ×100: 3000m²]
```

### 4. Expand (Visual Ungrouping)

Split collapsed node back into individual cards.

```typescript
function expandNode(nodeId: UUID): UUID[] {
  const node = getNode(nodeId);
  if (node.quantity <= 1) return [nodeId];
  
  const newIds: UUID[] = [];
  for (let i = 0; i < node.quantity; i++) {
    const individual: AreaNode = {
      id: uuidv4(),
      name: node.name,
      areaPerUnit: node.areaPerUnit,
      quantity: 1,
      instanceOf: node.instanceOf,
    };
    newIds.push(individual.id);
  }
  
  // Delete original collapsed node
  deleteNode(nodeId);
  
  return newIds;
}
```

**Use case:** "I want to see all 100 rooms individually"

```
Before: [Room ×100: 3000m²]
After:  [Room][Room][Room]...[Room] (100 cards)
```

### 5. Split Quantity

Divide a collapsed group into smaller groups.

```typescript
function splitQuantity(nodeId: UUID, quantities: number[]): UUID[] {
  const node = getNode(nodeId);
  const total = quantities.reduce((a, b) => a + b, 0);
  
  if (total !== node.quantity) {
    throw new Error('Quantities must sum to original');
  }
  
  const newIds: UUID[] = [];
  quantities.forEach((qty, i) => {
    const split: AreaNode = {
      id: uuidv4(),
      name: i === 0 ? node.name : `${node.name} (${i + 1})`,
      areaPerUnit: node.areaPerUnit,
      quantity: qty,
      instanceOf: node.instanceOf,
    };
    newIds.push(split.id);
  });
  
  deleteNode(nodeId);
  return newIds;
}
```

**Use case:** "Split 100 rooms into 5 floors of 20"

```
Before: [Rooms ×100: 3000m²]
After:  [Rooms Floor 1 ×20] [Rooms Floor 2 ×20] ... [Rooms Floor 5 ×20]
        (all still linked to same Room type)
```

### 6. Merge Quantities

Combine groups of same type.

```typescript
function mergeQuantities(nodeIds: UUID[]): UUID {
  const nodes = nodeIds.map(id => getNode(id));
  
  // Verify all reference same source
  const sourceIds = new Set(nodes.map(n => n.instanceOf ?? n.id));
  if (sourceIds.size > 1) {
    throw new Error('Can only merge instances of same type');
  }
  
  const totalQty = nodes.reduce((sum, n) => sum + n.quantity, 0);
  
  const merged: AreaNode = {
    id: uuidv4(),
    name: nodes[0].name,
    areaPerUnit: nodes[0].areaPerUnit,
    quantity: totalQty,
    instanceOf: nodes[0].instanceOf,
  };
  
  nodeIds.forEach(id => deleteNode(id));
  return merged.id;
}
```

### 7. Unlink Instance

Convert instance to independent copy (break link).

```typescript
function unlinkInstance(nodeId: UUID): void {
  const node = getNode(nodeId);
  if (!node.instanceOf) return;
  
  // Get current effective area
  const effectiveArea = getEffectiveAreaPerUnit(node, nodes);
  
  updateNode(nodeId, {
    areaPerUnit: effectiveArea,
    instanceOf: null,
  });
}
```

**Use case:** "This room should no longer follow the template"

## Visual Representation

### Board View

```
┌─────────────────────────────────────────────────────────┐
│ Project Total: 10,000m²                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │ Guest Rooms ×100 │  │ Lobby            │            │
│  │ 3,000m² (30×100) │  │ 200m²            │            │
│  │ 🔗 Room Type A   │  │                  │            │
│  └──────────────────┘  └──────────────────┘            │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │ Suites ×20       │  │ Restaurant       │            │
│  │ 1,000m² (50×20)  │  │ 300m²            │            │
│  │ 🔗 Suite Type A  │  │                  │            │
│  └──────────────────┘  └──────────────────┘            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Expanded View (after clicking "Guest Rooms ×100")

```
┌──────────────────────────────────────────────────────────────┐
│ Guest Rooms (expanded)                          [Collapse]   │
├──────────────────────────────────────────────────────────────┤
│ [Room][Room][Room][Room][Room][Room][Room][Room][Room][Room] │
│ [Room][Room][Room][Room][Room][Room][Room][Room][Room][Room] │
│ [Room][Room][Room][Room][Room][Room][Room][Room][Room][Room] │
│ ... (100 cards)                                              │
└──────────────────────────────────────────────────────────────┘
```

### Inspector Panel (Instance Group Selected)

```
┌────────────────────────────────────┐
│ Inspector: Guest Rooms ×100        │
├────────────────────────────────────┤
│ Type: Room Type A  [Edit Type]     │
│ Area: 30m² per unit                │
│ Quantity: 100      [Split]         │
│ ─────────────────────────          │
│ Total: 3,000m²                     │
│ ─────────────────────────          │
│ 🔗 Linked to: Room Type A          │
│    [Unlink] [Go to Source]         │
│ ─────────────────────────          │
│ [Expand All] [Duplicate]           │
└────────────────────────────────────┘
```

## AI Integration

### Formula Output

AI can output `unit_based` formulas that naturally map to instances:

```json
{
  "name": "Guest Rooms",
  "formula": {
    "type": "unit_based",
    "areaPerUnit": 30,
    "unitCount": 100,
    "reasoning": "100 rooms at 30m² - compact urban hotel standard"
  }
}
```

This creates:
- `AreaNode` with `areaPerUnit: 30`, `quantity: 100`
- Can later be split, expanded, or linked as template

### Template Detection

AI can suggest creating types when it sees patterns:

```
User: "100 standard rooms, 20 suites, 10 premium suites"

AI Response:
- Create "Standard Room" type (30m²)
- Create "Suite" type (50m²)  
- Create "Premium Suite" type (75m²)
- Instance groups referencing each type
```

## Migration Strategy

Existing data model already has `count` (now `quantity`). Changes needed:

1. Rename `count` → `quantity` (semantic clarity)
2. Add `instanceOf?: UUID | null`
3. Add `children?: UUID[]` (for container nodes)
4. Update `getNodeDerived` to handle instance linking
5. Add new store operations (collapse, expand, etc.)
6. Update UI for visual collapse/expand

## Benefits

1. **Simplicity** - One type covers all cases
2. **Flexibility** - Any node can become instance or independent
3. **Natural for residential** - "100 rooms of Type A" is intuitive
4. **Reversible** - Collapse/expand, link/unlink all reversible
5. **AI-friendly** - unit_based formulas map directly

## UI/UX Considerations

1. **Instance indicator** - Show 🔗 icon on linked nodes
2. **Quantity badge** - Show "×N" on collapsed groups
3. **Context menu** - Duplicate as Instance / Duplicate as Copy
4. **Bulk operations** - Select multiple → Collapse / Expand
5. **Type editor** - Panel to view/edit all instance sources
