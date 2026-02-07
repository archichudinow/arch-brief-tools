import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useChatStore, useProjectStore, useHistoryStore, useUIStore } from '@/stores';
import type { Proposal } from '@/types';
import { Check, X, Scissors, GitMerge, Plus, Pencil, FolderPlus, FolderInput, StickyNote, Copy, Percent, Combine, Link } from 'lucide-react';

interface ProposalCardProps {
  proposal: Proposal;
}

export function ProposalCard({ proposal }: ProposalCardProps) {
  const acceptProposal = useChatStore((s) => s.acceptProposal);
  const rejectProposal = useChatStore((s) => s.rejectProposal);
  
  // Project actions
  const createNode = useProjectStore((s) => s.createNode);
  const updateNode = useProjectStore((s) => s.updateNode);
  const deleteNode = useProjectStore((s) => s.deleteNode);
  const createGroup = useProjectStore((s) => s.createGroup);
  const assignToGroup = useProjectStore((s) => s.assignToGroup);
  const addNoteToArea = useProjectStore((s) => s.addNoteToArea);
  const addNoteToGroup = useProjectStore((s) => s.addNoteToGroup);
  const splitGroupEqual = useProjectStore((s) => s.splitGroupEqual);
  const splitGroupByProportion = useProjectStore((s) => s.splitGroupByProportion);
  const mergeGroupAreas = useProjectStore((s) => s.mergeGroupAreas);
  const splitNodeByQuantity = useProjectStore((s) => s.splitNodeByQuantity);
  const deleteGroup = useProjectStore((s) => s.deleteGroup);
  const nodes = useProjectStore((s) => s.nodes);
  const groups = useProjectStore((s) => s.groups);
  const addChildToContainer = useProjectStore((s) => s.addChildToContainer);
  
  const snapshot = useHistoryStore((s) => s.snapshot);
  const openContainerId = useUIStore((s) => s.openContainerId);
  
  const handleAccept = () => {
    console.log('Accept clicked for proposal:', proposal);
    console.log('Proposal type:', proposal.type);
    
    const accepted = acceptProposal(proposal.id);
    console.log('Accepted proposal returned:', accepted);
    
    if (!accepted) {
      console.log('No accepted proposal returned!');
      return;
    }
    
    console.log('Applying proposal type:', accepted.type);
    
    // Apply proposal based on type
    switch (accepted.type) {
      case 'create_areas': {
        console.log('Creating areas:', accepted.areas);
        console.log('Areas with groupHints:', accepted.areas.map(a => ({ name: a.name, groupHint: a.groupHint })));
        snapshot('ai-create-areas', `AI: Create ${accepted.areas.length} areas`, { nodes, groups });
        
        // Track created nodes by their groupHint for auto-grouping
        const nodesByGroup: Record<string, string[]> = {};
        
        accepted.areas.forEach((area) => {
          // Add to container if we're inside one, otherwise add to root
          const createInput = {
            name: area.name,
            areaPerUnit: area.areaPerUnit,
            count: area.count,
            userNote: area.briefNote,
            // Pass formula reasoning for traceability
            formulaReasoning: area.formulaReasoning,
            formulaConfidence: area.formulaConfidence,
            formulaType: area.formulaType,
          };
          const nodeId = openContainerId 
            ? addChildToContainer(openContainerId, createInput) 
            : createNode(createInput);
          
          if (!nodeId) return; // Skip if container add failed
          
          // Collect nodes by groupHint
          if (area.groupHint) {
            if (!nodesByGroup[area.groupHint]) {
              nodesByGroup[area.groupHint] = [];
            }
            nodesByGroup[area.groupHint].push(nodeId);
          }
        });
        
        console.log('Nodes by group:', nodesByGroup);
        
        // Auto-create groups and assign nodes - only at root level, not inside containers
        // When inside a container, the container itself provides the organization
        if (!openContainerId) {
          Object.entries(nodesByGroup).forEach(([groupName, nodeIds]) => {
            if (nodeIds.length > 0) {
              console.log(`Creating group "${groupName}" with ${nodeIds.length} nodes:`, nodeIds);
              const groupId = createGroup({ name: groupName });
              assignToGroup(groupId, nodeIds);
            } else {
              console.warn(`Skipping empty group "${groupName}"`);
            }
          });
        }
        break;
      }
        
      case 'split_area': {
        console.log('Splitting area:', accepted.sourceName, 'into', accepted.splits);
        const label = accepted.groupName 
          ? `AI: Split ${accepted.sourceName} into ${accepted.groupName}`
          : `AI: Split ${accepted.sourceName}`;
        snapshot('ai-split', label, { nodes, groups });
        
        // Find the source node's group BEFORE deleting it
        let sourceGroupId: string | null = null;
        let sourceGroupColor: string | null = null;
        for (const [groupId, group] of Object.entries(groups)) {
          if (group.members.includes(accepted.sourceNodeId)) {
            sourceGroupId = groupId;
            sourceGroupColor = group.color;
            break;
          }
        }
        
        // Delete source and create splits, collecting new IDs
        deleteNode(accepted.sourceNodeId);
        const newNodeIds: string[] = [];
        accepted.splits.forEach((split) => {
          console.log('Creating split:', split);
          const createInput = {
            name: split.name,
            areaPerUnit: split.areaPerUnit,
            count: split.count,
            // Pass formula reasoning for traceability
            formulaReasoning: split.formulaReasoning,
            formulaConfidence: split.formulaConfidence,
            formulaType: split.formulaType,
          };
          // Add to container if we're inside one, otherwise add to root
          const newId = openContainerId 
            ? addChildToContainer(openContainerId, createInput) 
            : createNode(createInput);
          if (newId) newNodeIds.push(newId);
        });
        
        // If source was in a group, add new nodes to that same group (inherit color)
        // Skip group operations when inside a container
        if (!openContainerId) {
          if (sourceGroupId) {
            console.log('Assigning splits to existing group:', sourceGroupId);
            assignToGroup(sourceGroupId, newNodeIds);
          }
          // Otherwise, if groupName provided, create new group
          else if (accepted.groupName) {
            console.log('Creating new group:', accepted.groupName, 'with nodes:', newNodeIds);
            const groupId = createGroup({ 
              name: accepted.groupName, 
              color: accepted.groupColor || sourceGroupColor || '#3b82f6' 
            });
            assignToGroup(groupId, newNodeIds);
          }
        }
        break;
      }
        
      case 'merge_areas': {
        snapshot('ai-merge', `AI: Merge to ${accepted.result.name}`, { nodes, groups });
        accepted.sourceNodeIds.forEach((id) => deleteNode(id));
        const mergeInput = {
          name: accepted.result.name,
          areaPerUnit: accepted.result.areaPerUnit,
          count: accepted.result.count,
        };
        // Add to container if we're inside one, otherwise add to root
        if (openContainerId) {
          addChildToContainer(openContainerId, mergeInput);
        } else {
          createNode(mergeInput);
        }
        break;
      }
      
      case 'split_by_quantity': {
        snapshot('ai-split-quantity', `AI: Split ${accepted.sourceName} by quantity (linked)`, { nodes, groups });
        // This uses splitNodeByQuantity which creates linked instances automatically
        const newIds = splitNodeByQuantity(accepted.sourceNodeId, accepted.quantities);
        console.log('Created linked instances:', newIds);
        break;
      }
        
      case 'update_areas':
        snapshot('ai-update', `AI: Update ${accepted.updates.length} areas`, { nodes, groups });
        accepted.updates.forEach((update) => {
          updateNode(update.nodeId, update.changes);
        });
        break;
        
      case 'create_groups':
        // Skip group creation when inside a container - container provides organization
        if (openContainerId) {
          console.log('Skipping group creation - inside container');
          break;
        }
        snapshot('ai-create-groups', `AI: Create ${accepted.groups.length} groups`, { nodes, groups });
        accepted.groups.forEach((g) => {
          // Only create group if it has members
          if (g.memberNodeIds.length > 0) {
            console.log(`Creating group "${g.name}" with ${g.memberNodeIds.length} members`);
            const groupId = createGroup({ name: g.name, color: g.color });
            assignToGroup(groupId, g.memberNodeIds);
          } else {
            console.warn(`Skipping empty group "${g.name}" - no members`);
          }
        });
        break;
        
      case 'assign_to_group':
        // Skip group assignment when inside a container
        if (openContainerId) {
          console.log('Skipping group assignment - inside container');
          break;
        }
        snapshot('ai-assign', `AI: Assign to ${accepted.groupName}`, { nodes, groups });
        assignToGroup(accepted.groupId, accepted.nodeIds);
        break;
        
      case 'add_notes':
        snapshot('ai-add-notes', `AI: Add ${accepted.notes.length} notes`, { nodes, groups });
        accepted.notes.forEach((note) => {
          if (note.targetType === 'area') {
            addNoteToArea(note.targetId, {
              source: 'ai',
              content: note.content,
              reason: note.reason,
            });
          } else {
            addNoteToGroup(note.targetId, {
              source: 'ai',
              content: note.content,
              reason: note.reason,
            });
          }
        });
        break;
        
      case 'split_group_equal':
        snapshot('ai-split-group', `AI: Split ${accepted.groupName} into ${accepted.parts} parts`, { nodes, groups });
        splitGroupEqual(accepted.groupId, accepted.parts, accepted.nameSuffix);
        break;
        
      case 'split_group_proportion':
        snapshot('ai-split-group-prop', `AI: Split ${accepted.groupName} by proportion`, { nodes, groups });
        splitGroupByProportion(accepted.groupId, accepted.proportions);
        break;
        
      case 'merge_group_areas':
        snapshot('ai-merge-group', `AI: Merge areas in ${accepted.groupName}`, { nodes, groups });
        mergeGroupAreas(accepted.groupId, accepted.newAreaName);
        break;
        
      default:
        console.warn(`Unknown proposal type: ${(accepted as { type: string }).type} - skipping`);
        break;
    }
    
    // Cleanup: delete any groups that became empty after operations
    const freshGroups = useProjectStore.getState().groups;
    Object.entries(freshGroups).forEach(([groupId, group]) => {
      if (group.members.length === 0) {
        console.log('Cleaning up empty group:', groupId, group.name);
        deleteGroup(groupId);
      }
    });
  };
  
  const handleReject = () => {
    rejectProposal(proposal.id);
  };
  
  if (proposal.status !== 'pending') {
    return (
      <Card className="opacity-60">
        <CardHeader className="py-2 px-3">
          <div className="flex items-center justify-between">
            <ProposalTitle proposal={proposal} />
            <Badge variant={proposal.status === 'accepted' ? 'default' : 'secondary'}>
              {proposal.status}
            </Badge>
          </div>
        </CardHeader>
      </Card>
    );
  }
  
  return (
    <Card className="border-primary/30">
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ProposalIcon type={proposal.type} />
          <ProposalTitle proposal={proposal} />
        </CardTitle>
      </CardHeader>
      <CardContent className="py-0 px-3">
        <ProposalDetails proposal={proposal} />
      </CardContent>
      <CardFooter className="py-2 px-3 gap-2">
        <Button size="sm" onClick={handleAccept} className="flex-1">
          <Check className="w-4 h-4 mr-1" />
          Accept
        </Button>
        <Button size="sm" variant="outline" onClick={handleReject} className="flex-1">
          <X className="w-4 h-4 mr-1" />
          Reject
        </Button>
      </CardFooter>
    </Card>
  );
}

function ProposalIcon({ type }: { type: Proposal['type'] }) {
  const icons: Record<Proposal['type'], React.ComponentType<{ className?: string }>> = {
    create_areas: Plus,
    split_area: Scissors,
    split_by_quantity: Link,
    merge_areas: GitMerge,
    update_areas: Pencil,
    create_groups: FolderPlus,
    assign_to_group: FolderInput,
    add_notes: StickyNote,
    split_group_equal: Copy,
    split_group_proportion: Percent,
    merge_group_areas: Combine,
  };
  const Icon = icons[type];
  if (!Icon) return null;
  return <Icon className="w-4 h-4 text-primary" />;
}

function ProposalTitle({ proposal }: { proposal: Proposal }) {
  switch (proposal.type) {
    case 'create_areas':
      return <span>Create {proposal.areas?.length || 0} area{(proposal.areas?.length || 0) > 1 ? 's' : ''}</span>;
    case 'split_area':
      return <span>Split "{proposal.sourceName || 'area'}" into {proposal.splits?.length || 0} parts</span>;
    case 'split_by_quantity':
      return <span>Split "{proposal.sourceName || 'area'}" by quantity (×{proposal.quantities?.join(' + ×')})</span>;
    case 'merge_areas':
      return <span>Merge {proposal.sourceNames?.length || 0} areas into "{proposal.result?.name || 'merged'}"</span>;
    case 'update_areas':
      return <span>Update {proposal.updates?.length || 0} area{(proposal.updates?.length || 0) > 1 ? 's' : ''}</span>;
    case 'create_groups':
      return <span>Create {proposal.groups?.length || 0} group{(proposal.groups?.length || 0) > 1 ? 's' : ''}</span>;
    case 'assign_to_group':
      return <span>Assign {proposal.nodeNames?.length || 0} areas to "{proposal.groupName || 'group'}"</span>;
    case 'add_notes':
      return <span>Add {proposal.notes?.length || 0} note{(proposal.notes?.length || 0) > 1 ? 's' : ''}</span>;
    case 'split_group_equal':
      return <span>Split "{proposal.groupName || 'group'}" into {proposal.parts || 0} equal parts</span>;
    case 'split_group_proportion':
      return <span>Split "{proposal.groupName || 'group'}" by proportion</span>;
    case 'merge_group_areas':
      return <span>Merge all areas in "{proposal.groupName || 'group'}"</span>;
    default:
      return <span>⚠️ Unsupported operation</span>;
  }
}

function ProposalDetails({ proposal }: { proposal: Proposal }) {
  switch (proposal.type) {
    case 'create_areas':
      if (!proposal.areas?.length) return null;
      return (
        <ul className="text-xs text-muted-foreground space-y-1.5">
          {proposal.areas.map((area, i) => (
            <li key={i} className="border-l-2 border-primary/20 pl-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{area.name}</span>
                <span>{(area.count * area.areaPerUnit).toLocaleString()} m²</span>
              </div>
              {area.formulaReasoning && (
                <p className="text-[10px] text-muted-foreground/80 mt-0.5 italic">
                  {area.formulaReasoning}
                </p>
              )}
              {area.aiNote && !area.formulaReasoning && (
                <p className="text-[10px] text-muted-foreground/80 mt-0.5 italic">
                  {area.aiNote}
                </p>
              )}
            </li>
          ))}
        </ul>
      );
      
    case 'split_area':
      if (!proposal.splits?.length) return null;
      return (
        <ul className="text-xs text-muted-foreground space-y-1.5">
          {proposal.splits.map((split, i) => (
            <li key={i} className="border-l-2 border-primary/20 pl-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{split.name}</span>
                <span>{(split.count * split.areaPerUnit).toLocaleString()} m²</span>
              </div>
              {split.formulaReasoning && (
                <p className="text-[10px] text-muted-foreground/80 mt-0.5 italic">
                  {split.formulaReasoning}
                </p>
              )}
            </li>
          ))}
        </ul>
      );
      
    case 'merge_areas':
      if (!proposal.result) return null;
      return (
        <p className="text-xs text-muted-foreground">
          Result: {proposal.result.count} × {proposal.result.areaPerUnit}m² = 
          {(proposal.result.count * proposal.result.areaPerUnit).toFixed(1)}m²
        </p>
      );
      
    case 'update_areas':
      if (!proposal.updates?.length) return null;
      return (
        <ul className="text-xs text-muted-foreground space-y-1">
          {proposal.updates.map((update, i) => (
            <li key={i}>
              • {update.nodeName}: 
              {update.changes.name && ` name → "${update.changes.name}"`}
              {update.changes.areaPerUnit && ` area → ${update.changes.areaPerUnit}m²`}
              {update.changes.count && ` count → ${update.changes.count}`}
            </li>
          ))}
        </ul>
      );
      
    case 'create_groups':
      if (!proposal.groups?.length) return null;
      return (
        <ul className="text-xs text-muted-foreground space-y-1">
          {proposal.groups.map((group, i) => (
            <li key={i} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: group.color }}
              />
              {group.name} ({group.memberNames?.length || 0} areas)
            </li>
          ))}
        </ul>
      );
      
    case 'assign_to_group':
      return (
        <p className="text-xs text-muted-foreground">
          Areas: {proposal.nodeNames?.join(', ') || 'None'}
        </p>
      );
      
    case 'add_notes':
      if (!proposal.notes?.length) return null;
      return (
        <ul className="text-xs text-muted-foreground space-y-1">
          {proposal.notes.map((note, i) => (
            <li key={i}>
              • {note.targetName}: "{note.content.slice(0, 50)}{note.content.length > 50 ? '...' : ''}"
            </li>
          ))}
        </ul>
      );
      
    case 'split_group_equal':
      return (
        <p className="text-xs text-muted-foreground">
          Duplicate group structure {proposal.parts} times, dividing area counts equally
        </p>
      );
      
    case 'split_group_proportion':
      if (!proposal.proportions?.length) return null;
      return (
        <ul className="text-xs text-muted-foreground space-y-1">
          {proposal.proportions.map((prop, i) => (
            <li key={i}>• {prop.name}: {prop.percent}%</li>
          ))}
        </ul>
      );
      
    case 'merge_group_areas':
      return (
        <p className="text-xs text-muted-foreground">
          Combine all areas into: "{proposal.newAreaName || proposal.groupName}"
        </p>
      );
      
    case 'split_by_quantity':
      return (
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="flex items-center gap-1">
            <Link className="h-3 w-3 text-blue-500" />
            <span>Results will be linked instances</span>
          </p>
          <ul className="space-y-0.5">
            {proposal.quantities?.map((qty, i) => (
              <li key={i} className="border-l-2 border-blue-300 pl-2">
                {proposal.names?.[i] || `${proposal.sourceName} (${i + 1})`}: ×{qty}
              </li>
            ))}
          </ul>
        </div>
      );
      
    default:
      return (
        <p className="text-xs text-muted-foreground">
          ⚠️ This feature is not yet supported. Try a different approach.
        </p>
      );
  }
}
