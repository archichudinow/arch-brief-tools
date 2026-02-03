import { useProjectStore, useUIStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Pencil, Trash2, Layers } from 'lucide-react';
import { useState } from 'react';
import { CreateGroupDialog } from './CreateGroupDialog';
import { toast } from 'sonner';

export function GroupList() {
  const groups = useProjectStore((s) => s.groups);
  const nodes = useProjectStore((s) => s.nodes);
  const updateGroup = useProjectStore((s) => s.updateGroup);
  const deleteGroup = useProjectStore((s) => s.deleteGroup);
  
  const selectedGroupIds = useUIStore((s) => s.selectedGroupIds);
  const selectGroups = useUIStore((s) => s.selectGroups);

  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const groupList = Object.values(groups);

  // Calculate derived values for a group
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Groups</h2>
          <p className="text-xs text-muted-foreground">
            {groupList.length} group{groupList.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Group
        </Button>
      </div>

      {/* Group List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {groupList.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No groups yet</p>
              <p className="text-xs mt-1">Create groups to organize areas</p>
            </div>
          ) : (
            groupList.map((group) => {
              const stats = getGroupStats(group.id);
              const isSelected = selectedGroupIds.includes(group.id);

              return (
                <div
                  key={group.id}
                  className={`
                    p-3 rounded-md cursor-pointer border transition-colors
                    ${isSelected 
                      ? 'bg-accent border-primary' 
                      : 'bg-card border-transparent hover:border-border'
                    }
                  `}
                  onClick={() => selectGroups([group.id])}
                >
                  <div className="flex items-center gap-2">
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
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    <span>{group.members.length} item{group.members.length !== 1 ? 's' : ''}</span>
                    <span>{stats.totalUnits} units</span>
                    <span className="tabular-nums">{stats.totalArea.toLocaleString()} m²</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      <CreateGroupDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </div>
  );
}
