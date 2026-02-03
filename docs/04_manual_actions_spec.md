# Manual Actions Specification

## Philosophy

> Every action the AI can perform, the user must be able to do manually.

We build manual tools first. AI uses the same action system.

---

## Area Node Actions

### `createAreaNode`

**Trigger:** Click "Add Area" button

**Input:**
```typescript
{
  name: string;
  areaPerUnit: number;
  count: number;
  userNote?: string;
}
```

**Behavior:**
1. Validate inputs (name required, numbers positive)
2. Create snapshot
3. Generate UUID
4. Add to `areaLayer.nodes`
5. Select new node

**UI Feedback:** Node appears in tree, is selected

---

### `updateAreaNode`

**Trigger:** Edit field in tree or inspector

**Input:**
```typescript
{
  nodeId: UUID;
  updates: Partial<{
    name: string;
    areaPerUnit: number;
    count: number;
    userNote: string;
    lockedFields: AreaNodeField[];
  }>;
}
```

**Behavior:**
1. Validate node exists
2. Check locked fields (prevent if locked)
3. If count changes, validate against partitions
4. Create snapshot
5. Apply updates
6. Recompute derived values

**UI Feedback:** Field updates inline

---

### `deleteAreaNode`

**Trigger:** Click delete button or press Delete key

**Input:**
```typescript
{
  nodeId: UUID;
}
```

**Behavior:**
1. Confirm if node has partitions
2. Create snapshot
3. Delete all partitions of this node
4. Remove from any clusters
5. Remove from any groups (members with this nodeId)
6. Delete node

**UI Feedback:** Node removed from tree

---

### `duplicateAreaNode`

**Trigger:** Click duplicate button

**Input:**
```typescript
{
  nodeId: UUID;
}
```

**Behavior:**
1. Create snapshot
2. Deep copy node (new ID)
3. Append " (copy)" to name
4. Do NOT copy partitions
5. Add to nodes
6. Select new node

**UI Feedback:** New node appears below original

---

## Partition Actions

### `createPartitions`

**Trigger:** Click "Split" button on node

**Input:**
```typescript
{
  nodeId: UUID;
  partitions: Array<{
    count: number;
    label?: string;
  }>;
}
```

**Behavior:**
1. Validate sum ≤ node.count
2. Create snapshot
3. Generate UUIDs for each partition
4. Add to `areaLayer.partitions`
5. Expand node in tree

**UI Feedback:** Partitions appear nested under node

---

### `updatePartition`

**Trigger:** Edit partition in tree or inspector

**Input:**
```typescript
{
  partitionId: UUID;
  updates: Partial<{
    count: number;
    label: string;
    userNote: string;
  }>;
}
```

**Behavior:**
1. Validate partition exists
2. If count changes, validate against parent
3. Create snapshot
4. Apply updates

**UI Feedback:** Partition updates inline

---

### `deletePartition`

**Trigger:** Click delete on partition

**Input:**
```typescript
{
  partitionId: UUID;
}
```

**Behavior:**
1. Create snapshot
2. Remove from any groups
3. Delete partition

**UI Feedback:** Partition removed

---

### `mergePartitions`

**Trigger:** Select multiple partitions, click "Merge"

**Input:**
```typescript
{
  partitionIds: UUID[];
}
```

**Behavior:**
1. Verify all belong to same parent
2. Create snapshot
3. Delete all selected partitions
4. (Units return to unpartitioned pool)

**UI Feedback:** Partitions removed, node shows full count

---

## Cluster Actions

### `createCluster`

**Trigger:** Select multiple nodes, click "Cluster"

**Input:**
```typescript
{
  name: string;
  nodeIds: UUID[];
}
```

**Behavior:**
1. Verify nodes not already in clusters
2. Create snapshot
3. Generate UUID
4. Add to `areaLayer.clusters`

**UI Feedback:** Nodes visually grouped in tree

---

### `updateCluster`

**Trigger:** Edit cluster name or add/remove nodes

**Input:**
```typescript
{
  clusterId: UUID;
  updates: Partial<{
    name: string;
    memberNodeIds: UUID[];
    userNote: string;
  }>;
}
```

**Behavior:**
1. Validate cluster exists
2. Validate new members not in other clusters
3. Create snapshot
4. Apply updates

**UI Feedback:** Cluster updates

---

### `dissolveCluster`

**Trigger:** Click "Dissolve" on cluster

**Input:**
```typescript
{
  clusterId: UUID;
}
```

**Behavior:**
1. Create snapshot
2. Delete cluster (nodes remain independent)

**UI Feedback:** Cluster wrapper removed, nodes remain

---

## Group Actions

### `createGroup`

**Trigger:** Click "Add Group" button

**Input:**
```typescript
{
  name: string;
  color: string;
}
```

**Behavior:**
1. Create snapshot
2. Generate UUID
3. Add to `groupingLayer.groups`

**UI Feedback:** Group appears in group list

---

### `assignToGroup`

**Trigger:** Drag node/partition to group

**Input:**
```typescript
{
  groupId: UUID;
  members: Array<{
    type: 'node' | 'partition';
    id: UUID;
  }>;
}
```

**Behavior:**
1. Validate members not already in other groups
2. Create snapshot
3. Add to group.members

**UI Feedback:** Item shows group color, appears in group list

---

### `removeFromGroup`

**Trigger:** Drag item out of group, or click remove

**Input:**
```typescript
{
  groupId: UUID;
  memberIds: UUID[];
}
```

**Behavior:**
1. Create snapshot
2. Remove from group.members

**UI Feedback:** Item shows no group, removed from group list

---

### `deleteGroup`

**Trigger:** Click delete on group

**Input:**
```typescript
{
  groupId: UUID;
}
```

**Behavior:**
1. Confirm (group has members?)
2. Create snapshot
3. Delete group (members become unassigned)

**UI Feedback:** Group removed, items show unassigned

---

## History Actions

### `undo`

**Trigger:** Cmd+Z or click Undo button

**Behavior:**
1. If currentIndex > 0, decrement
2. Restore state from previous snapshot

**UI Feedback:** State reverts, undo button may disable

---

### `redo`

**Trigger:** Cmd+Shift+Z or click Redo button

**Behavior:**
1. If currentIndex < snapshots.length - 1, increment
2. Restore state from next snapshot

**UI Feedback:** State restores, redo button may disable

---

### `createBranch`

**Trigger:** Click "Branch" in history panel

**Input:**
```typescript
{
  name: string;
}
```

**Behavior:**
1. Create new branch from current snapshot
2. Switch to new branch

**UI Feedback:** Branch appears in history, becomes active

---

### `restoreSnapshot`

**Trigger:** Click snapshot in history panel

**Input:**
```typescript
{
  snapshotId: UUID;
}
```

**Behavior:**
1. Restore state from snapshot
2. Update currentIndex

**UI Feedback:** State restores

---

## Export/Import Actions

### `exportProject`

**Trigger:** Click "Export" button

**Options:**
```typescript
{
  includeHistory: boolean;
  format: 'json' | 'excel';
}
```

**Behavior:**
1. Serialize current state
2. Optionally include history
3. Trigger file download

**UI Feedback:** File downloads

---

### `importProject`

**Trigger:** Click "Import" or drag file

**Behavior:**
1. Parse uploaded file
2. Validate schema version
3. Migrate if needed
4. Replace state
5. Create snapshot labeled "Import"

**UI Feedback:** State replaced, notification shown

---

## Selection Actions

### `selectNode(s)`

**Trigger:** Click node, Cmd+Click for multi

**Behavior:**
1. Update `uiStore.selectedNodeIds`
2. Clear other selections if not multi

**UI Feedback:** Node(s) highlighted

---

### `expandNode`

**Trigger:** Click expand arrow on node with partitions

**Behavior:**
1. Toggle in `uiStore.expandedNodeIds`

**UI Feedback:** Partitions shown/hidden

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Cmd+Z | Undo |
| Cmd+Shift+Z | Redo |
| Delete/Backspace | Delete selected |
| Cmd+D | Duplicate selected |
| Cmd+S | Export project |
| Cmd+O | Import project |
| Escape | Clear selection |
| Cmd+A | Select all nodes |
