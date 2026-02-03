import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { useProjectStore, useUIStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Layers,
  ChevronDown,
  ChevronRight,
  GripVertical,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { CreateAreaDialog } from '@/components/area-tools/CreateAreaDialog';
import { CreateGroupDialog } from '@/components/group-tools/CreateGroupDialog';
import { toast } from 'sonner';

export function AreaGroupPanel() {
  const nodes = useProjectStore((s) => s.nodes);
  const groups = useProjectStore((s) => s.groups);
  const getTotalArea = useProjectStore((s) => s.getTotalArea);
  const assignToGroup = useProjectStore((s) => s.assignToGroup);
  const removeFromGroup = useProjectStore((s) => s.removeFromGroup);
  const updateGroup = useProjectStore((s) => s.updateGroup);
  const deleteGroup = useProjectStore((s) => s.deleteGroup);

  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const selectNodes = useUIStore((s) => s.selectNodes);
  const selectedGroupIds = useUIStore((s) => s.selectedGroupIds);
  const selectGroups = useUIStore((s) => s.selectGroups);

  const [showCreateAreaDialog, setShowCreateAreaDialog] = useState(false);
  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const totalArea = getTotalArea();
  const nodeList = Object.values(nodes);
  const groupList = Object.values(groups);

  // Get node IDs that are assigned to any group
  const assignedNodeIds = new Set<string>();
  for (const group of groupList) {
    for (const nodeId of group.members) {
      assignedNodeIds.add(nodeId);
    }
  }

  // Unassigned nodes (available for dragging into groups)
  const unassignedNodes = nodeList.filter((n) => !assignedNodeIds.has(n.id));

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const getGroupStats = (groupId: string) => {
    const group = groups[groupId];
    if (!group) return { totalArea: 0, totalUnits: 0 };

    let totalArea = 0;
    let totalUnits = 0;

    for (const nodeId of group.members) {
      const node = nodes[nodeId];
      if (node) {
        totalArea += node.areaPerUnit * node.count;
        totalUnits += node.count;
      }
    }

    return { totalArea, totalUnits };
  };

  const handleDragEnd = (result: DropResult) => {
    const { draggableId, source, destination } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    const nodeId = draggableId;

    // Moving from unassigned to a group
    if (source.droppableId === 'unassigned' && destination.droppableId.startsWith('group-')) {
      const groupId = destination.droppableId.replace('group-', '');
      assignToGroup(groupId, [nodeId]);
      // Auto-expand the group
      setExpandedGroups((prev) => new Set(prev).add(groupId));
      toast.success(`Added to ${groups[groupId]?.name}`);
      return;
    }

    // Moving from one group to another
    if (source.droppableId.startsWith('group-') && destination.droppableId.startsWith('group-')) {
      const sourceGroupId = source.droppableId.replace('group-', '');
      const destGroupId = destination.droppableId.replace('group-', '');
      removeFromGroup(sourceGroupId, [nodeId]);
      assignToGroup(destGroupId, [nodeId]);
      setExpandedGroups((prev) => new Set(prev).add(destGroupId));
      toast.success(`Moved to ${groups[destGroupId]?.name}`);
      return;
    }

    // Moving from group back to unassigned
    if (source.droppableId.startsWith('group-') && destination.droppableId === 'unassigned') {
      const sourceGroupId = source.droppableId.replace('group-', '');
      removeFromGroup(sourceGroupId, [nodeId]);
      toast.success('Removed from group');
      return;
    }
  };

  const handleRenameGroup = (groupId: string, currentName: string) => {
    const newName = prompt('New group name:', currentName);
    if (!newName || newName === currentName) return;
    updateGroup(groupId, { name: newName });
    toast.success('Group renamed');
  };

  const handleDeleteGroup = (groupId: string) => {
    const group = groups[groupId];
    if (!group) return;
    if (confirm(`Delete group "${group.name}"? Areas will be unassigned but not deleted.`)) {
      deleteGroup(groupId);
      if (selectedGroupIds.includes(groupId)) {
        selectGroups([]);
      }
      toast.success('Group deleted');
    }
  };

  const handleRemoveFromGroup = (groupId: string, nodeId: string) => {
    removeFromGroup(groupId, [nodeId]);
    toast.success('Removed from group');
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="h-full flex">
        {/* Areas Column */}
        <div className="w-1/2 border-r border-border flex flex-col">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Areas</h2>
              <p className="text-xs text-muted-foreground">
                {unassignedNodes.length} unassigned
              </p>
            </div>
            <Button size="sm" onClick={() => setShowCreateAreaDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          <Droppable droppableId="unassigned">
            {(provided, snapshot) => (
              <ScrollArea className="flex-1">
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`p-2 space-y-1 min-h-full ${
                    snapshot.isDraggingOver ? 'bg-muted/50' : ''
                  }`}
                >
                  {unassignedNodes.length === 0 && nodeList.length > 0 ? (
                    <div className="text-center py-4 text-xs text-muted-foreground">
                      All areas are assigned to groups
                    </div>
                  ) : unassignedNodes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No areas yet</p>
                      <p className="text-xs mt-1">Click "Add" to create your first area</p>
                    </div>
                  ) : (
                    unassignedNodes.map((node, index) => (
                      <Draggable key={node.id} draggableId={node.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`
                              flex items-center gap-1 p-2 rounded-md border cursor-grab transition-colors select-none
                              ${snapshot.isDragging ? 'opacity-70 shadow-lg cursor-grabbing' : ''}
                              ${selectedNodeIds.includes(node.id)
                                ? 'bg-accent border-primary'
                                : 'bg-card border-transparent hover:border-border'
                              }
                            `}
                            onClick={() => selectNodes([node.id])}
                          >
                            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{node.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {node.count} × {node.areaPerUnit.toLocaleString()} m²
                              </p>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))
                  )}
                  {provided.placeholder}
                </div>
              </ScrollArea>
            )}
          </Droppable>

          <div className="p-3 border-t border-border bg-muted/30">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {nodeList.length} total
              </span>
              <span className="font-medium tabular-nums">
                {totalArea.toLocaleString()} m²
              </span>
            </div>
          </div>
        </div>

        {/* Groups Column */}
        <div className="w-1/2 flex flex-col">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Groups</h2>
              <p className="text-xs text-muted-foreground">
                {groupList.length} group{groupList.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Button size="sm" onClick={() => setShowCreateGroupDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {groupList.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No groups yet</p>
                  <p className="text-xs mt-1">Drag areas here to create groups</p>
                </div>
              ) : (
                groupList.map((group) => {
                  const stats = getGroupStats(group.id);
                  const isSelected = selectedGroupIds.includes(group.id);
                  const isExpanded = expandedGroups.has(group.id);
                  const memberNodes = group.members
                    .map((id) => nodes[id])
                    .filter(Boolean);

                  return (
                    <Droppable key={group.id} droppableId={`group-${group.id}`}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`
                            rounded-lg border transition-colors
                            ${snapshot.isDraggingOver
                              ? 'border-primary bg-primary/5'
                              : isSelected
                                ? 'border-primary bg-accent'
                                : 'border-border bg-card hover:border-muted-foreground/30'
                            }
                          `}
                        >
                          <Collapsible open={isExpanded} onOpenChange={() => toggleGroupExpanded(group.id)}>
                            <div
                              className="p-2 cursor-pointer"
                              onClick={() => selectGroups([group.id])}
                            >
                              <div className="flex items-center gap-2">
                                <CollapsibleTrigger
                                  asChild
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Button variant="ghost" size="icon" className="h-5 w-5">
                                    {isExpanded ? (
                                      <ChevronDown className="h-3 w-3" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3" />
                                    )}
                                  </Button>
                                </CollapsibleTrigger>
                                <div
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: group.color }}
                                />
                                <span className="font-medium text-sm flex-1 truncate">
                                  {group.name}
                                </span>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-6 w-6">
                                      <MoreHorizontal className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleRenameGroup(group.id, group.name)}>
                                      <Pencil className="h-3 w-3 mr-2" />
                                      Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteGroup(group.id)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-3 w-3 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <div className="flex gap-3 mt-1 ml-7 text-xs text-muted-foreground">
                                <span>{group.members.length} area{group.members.length !== 1 ? 's' : ''}</span>
                                <span className="tabular-nums">{stats.totalArea.toLocaleString()} m²</span>
                              </div>
                            </div>

                            <CollapsibleContent>
                              <div className="px-2 pb-2 space-y-1">
                                {memberNodes.map((node, index) => (
                                  <Draggable
                                    key={node.id}
                                    draggableId={node.id}
                                    index={index}
                                  >
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={`
                                          flex items-center gap-1 p-1.5 rounded bg-muted/50 text-sm cursor-grab select-none
                                          ${snapshot.isDragging ? 'opacity-70 shadow-lg cursor-grabbing' : ''}
                                        `}
                                      >
                                        <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
                                        <span className="flex-1 truncate text-xs">{node.name}</span>
                                        <span className="text-xs text-muted-foreground tabular-nums">
                                          {(node.areaPerUnit * node.count).toLocaleString()} m²
                                        </span>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveFromGroup(group.id, node.id);
                                          }}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {memberNodes.length === 0 && (
                                  <div className="text-xs text-muted-foreground text-center py-2">
                                    Drop areas here
                                  </div>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <CreateAreaDialog open={showCreateAreaDialog} onOpenChange={setShowCreateAreaDialog} />
      <CreateGroupDialog open={showCreateGroupDialog} onOpenChange={setShowCreateGroupDialog} />
    </DragDropContext>
  );
}
