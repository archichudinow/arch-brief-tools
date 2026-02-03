# Testing Checklist

## Manual Testing Protocol

> Before AI integration, all manual features must work perfectly.

Each feature should be tested independently and in combination.

---

## Phase 1: Core Area Tools

### 1.1 Area Node Creation

**Test Cases:**

| # | Action | Expected Result | Pass |
|---|--------|-----------------|------|
| 1 | Click "Add Area" | Modal/inline form appears | ☐ |
| 2 | Enter name "Flat", area 80, count 40 | Validation passes | ☐ |
| 3 | Click "Create" | Node appears in tree | ☐ |
| 4 | Check total | Shows 3,200 ㎡ | ☐ |
| 5 | Create with empty name | Shows validation error | ☐ |
| 6 | Create with negative area | Shows validation error | ☐ |
| 7 | Create with zero count | Should allow (edge case) | ☐ |

---

### 1.2 Area Node Editing

**Test Cases:**

| # | Action | Expected Result | Pass |
|---|--------|-----------------|------|
| 1 | Double-click node name | Name becomes editable | ☐ |
| 2 | Change name, press Enter | Name updates | ☐ |
| 3 | Press Escape while editing | Reverts to original | ☐ |
| 4 | Click outside while editing | Saves change | ☐ |
| 5 | Edit area value | Total recalculates | ☐ |
| 6 | Edit count value | Total recalculates | ☐ |
| 7 | Edit in inspector | Tree updates | ☐ |
| 8 | Edit in tree | Inspector updates | ☐ |

---

### 1.3 Area Node Deletion

**Test Cases:**

| # | Action | Expected Result | Pass |
|---|--------|-----------------|------|
| 1 | Select node, click Delete | Node removed | ☐ |
| 2 | Delete node with partitions | Confirmation shown | ☐ |
| 3 | Confirm deletion | Node + partitions removed | ☐ |
| 4 | Cancel deletion | Node remains | ☐ |
| 5 | Delete in cluster | Node removed from cluster | ☐ |
| 6 | Delete in group | Removed from group members | ☐ |

---

### 1.4 Partitioning

**Test Cases:**

| # | Action | Expected Result | Pass |
|---|--------|-----------------|------|
| 1 | Click "Split" on node (count=40) | Partition dialog opens | ☐ |
| 2 | Enter partitions: 15, 15, 10 | Sum shown (40/40) | ☐ |
| 3 | Click Create | 3 partitions appear under node | ☐ |
| 4 | Try partition sum > count | Validation error | ☐ |
| 5 | Edit partition count | Parent total unchanged | ☐ |
| 6 | Delete one partition | Partition removed | ☐ |
| 7 | Add label to partition | Label shows in tree | ☐ |
| 8 | Merge all partitions | Partitions removed, count restored | ☐ |

---

### 1.5 Clustering

**Test Cases:**

| # | Action | Expected Result | Pass |
|---|--------|-----------------|------|
| 1 | Select 3 nodes (Cmd+Click) | All 3 selected | ☐ |
| 2 | Click "Cluster" | Cluster dialog opens | ☐ |
| 3 | Enter name "Hotel Room" | Valid input | ☐ |
| 4 | Create cluster | Nodes visually grouped | ☐ |
| 5 | Cluster shows total area | Sum of member areas | ☐ |
| 6 | Try cluster node already in cluster | Error/prevented | ☐ |
| 7 | Dissolve cluster | Nodes become independent | ☐ |
| 8 | Rename cluster | Name updates | ☐ |

---

### 1.6 Undo/Redo

**Test Cases:**

| # | Action | Expected Result | Pass |
|---|--------|-----------------|------|
| 1 | Create node, press Cmd+Z | Node removed | ☐ |
| 2 | Press Cmd+Shift+Z | Node restored | ☐ |
| 3 | Make 5 changes, undo 3 | Correct state | ☐ |
| 4 | Undo at start of history | Button disabled | ☐ |
| 5 | Redo at end of history | Button disabled | ☐ |
| 6 | Undo partition creation | Partitions removed | ☐ |
| 7 | Undo cluster creation | Cluster dissolved | ☐ |
| 8 | Make change after undo | Redo history cleared | ☐ |

---

### 1.7 Export/Import

**Test Cases:**

| # | Action | Expected Result | Pass |
|---|--------|-----------------|------|
| 1 | Click Export | File downloads | ☐ |
| 2 | Open exported JSON | Valid JSON structure | ☐ |
| 3 | Refresh page | State lost (expected) | ☐ |
| 4 | Import the exported file | State restored exactly | ☐ |
| 5 | All nodes present | ✓ | ☐ |
| 6 | All partitions present | ✓ | ☐ |
| 7 | All clusters present | ✓ | ☐ |
| 8 | Totals correct | ✓ | ☐ |
| 9 | Import invalid JSON | Error message shown | ☐ |
| 10 | Import empty file | Error message shown | ☐ |

---

## Phase 2: Grouping

### 2.1 Group Management

| # | Action | Expected Result | Pass |
|---|--------|-----------------|------|
| 1 | Create group "Residential" | Group appears in list | ☐ |
| 2 | Set group color | Color shows in UI | ☐ |
| 3 | Rename group | Name updates | ☐ |
| 4 | Delete empty group | Group removed | ☐ |
| 5 | Delete group with members | Confirmation shown | ☐ |

---

### 2.2 Group Assignment

| # | Action | Expected Result | Pass |
|---|--------|-----------------|------|
| 1 | Drag node to group | Node shows group color | ☐ |
| 2 | Drag partition to group | Partition assigned | ☐ |
| 3 | Drag to another group | Moves (removes from first) | ☐ |
| 4 | Remove from group | Becomes unassigned | ☐ |
| 5 | Group totals update | Correct sums | ☐ |

---

## Phase 3: AI Integration

### 3.1 Connection

| # | Action | Expected Result | Pass |
|---|--------|-----------------|------|
| 1 | Open AI settings | API key field shown | ☐ |
| 2 | Enter invalid key | Test fails | ☐ |
| 3 | Enter valid key | Test succeeds | ☐ |
| 4 | Key persists after refresh | Stored in localStorage | ☐ |

---

### 3.2 AI Chat

| # | Action | Expected Result | Pass |
|---|--------|-----------------|------|
| 1 | Type message without selection | Context is empty/global | ☐ |
| 2 | Select node, type message | Context includes node | ☐ |
| 3 | Drag node to chat | Node added to context | ☐ |
| 4 | Send message | Response streams in | ☐ |
| 5 | Cancel during stream | Stream stops | ☐ |

---

### 3.3 AI Proposals

| # | Action | Expected Result | Pass |
|---|--------|-----------------|------|
| 1 | Ask AI to break down node | Proposal shown | ☐ |
| 2 | Review proposal changes | Diff is clear | ☐ |
| 3 | Click "Apply" | Changes applied | ☐ |
| 4 | Undo after apply | All AI changes reverted | ☐ |
| 5 | Click "Reject" | No changes made | ☐ |

---

## Edge Cases & Stress Tests

### Data Limits

| # | Scenario | Expected | Pass |
|---|----------|----------|------|
| 1 | Create 100 nodes | App responsive | ☐ |
| 2 | Create 50 partitions per node | Tree renders | ☐ |
| 3 | Export large project | File < 1MB | ☐ |
| 4 | Import large project | Loads < 2s | ☐ |
| 5 | 50 undo operations | Works correctly | ☐ |

---

### Concurrent Operations

| # | Scenario | Expected | Pass |
|---|----------|----------|------|
| 1 | Edit while AI streaming | No conflicts | ☐ |
| 2 | Undo during AI response | Handled gracefully | ☐ |
| 3 | Export during edit | Consistent state | ☐ |

---

## Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | Latest | ☐ |
| Firefox | Latest | ☐ |
| Safari | Latest | ☐ |
| Edge | Latest | ☐ |

---

## Sample Test Scenario

### "Mixed-Use Building Brief"

**Setup:**
1. Create: "Flat" - 80㎡ × 40 units
2. Create: "Office" - 120㎡ × 20 units
3. Create: "Retail" - 50㎡ × 10 units
4. Create: "Parking" - 25㎡ × 100 units

**Test Flow:**
1. Split "Flat" into Tower A (20), Tower B (20)
2. Create cluster "Commercial" with Office + Retail
3. Create groups: "Residential", "Commercial", "Services"
4. Assign partitions to Residential
5. Assign cluster to Commercial
6. Assign Parking to Services
7. Export project
8. Refresh and import
9. Verify all assignments intact
10. Undo 5 times
11. Verify consistent state

**Expected Totals:**
- Flat: 3,200 ㎡
- Office: 2,400 ㎡
- Retail: 500 ㎡
- Parking: 2,500 ㎡
- **Total: 8,600 ㎡**

---

## Bug Report Template

```markdown
## Bug Report

**Feature:** [e.g., Partitioning]
**Severity:** [Critical / High / Medium / Low]

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Behavior:**


**Actual Behavior:**


**Browser/OS:**


**Screenshot:**

```
