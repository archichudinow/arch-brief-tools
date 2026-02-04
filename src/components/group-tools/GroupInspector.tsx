import { useState } from 'react';
import { useProjectStore, useUIStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, X, Layers, Split, Percent, Merge } from 'lucide-react';
import { GROUP_COLORS } from '@/types';
import { toast } from 'sonner';
import { SplitGroupEqualDialog } from './SplitGroupEqualDialog';
import { SplitGroupProportionDialog } from './SplitGroupProportionDialog';
import { MergeGroupAreasDialog } from './MergeGroupAreasDialog';

export function GroupInspector() {
  const groups = useProjectStore((s) => s.groups);
  const nodes = useProjectStore((s) => s.nodes);
  const updateGroup = useProjectStore((s) => s.updateGroup);
  const deleteGroup = useProjectStore((s) => s.deleteGroup);
  const removeFromGroup = useProjectStore((s) => s.removeFromGroup);

  const selectedGroupIds = useUIStore((s) => s.selectedGroupIds);
  const selectGroups = useUIStore((s) => s.selectGroups);

  // Dialog states
  const [showSplitEqualDialog, setShowSplitEqualDialog] = useState(false);
  const [showSplitProportionDialog, setShowSplitProportionDialog] = useState(false);
  const [showMergeAreasDialog, setShowMergeAreasDialog] = useState(false);

  // No selection
  if (selectedGroupIds.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4">
        <Layers className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-sm">Select a group to inspect</p>
      </div>
    );
  }

  // Multi-select not supported for now
  if (selectedGroupIds.length > 1) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4">
        <p className="text-sm">{selectedGroupIds.length} groups selected</p>
      </div>
    );
  }

  const selectedGroup = groups[selectedGroupIds[0]];
  if (!selectedGroup) return null;

  // Calculate stats
  let totalArea = 0;
  let totalUnits = 0;

  for (const nodeId of selectedGroup.members) {
    const node = nodes[nodeId];
    if (node) {
      totalArea += node.areaPerUnit * node.count;
      totalUnits += node.count;
    }
  }

  // Get member details
  type MemberDetail = {
    id: string;
    name: string;
    units: number;
    area: number;
  };

  const memberDetails: MemberDetail[] = selectedGroup.members
    .map((nodeId): MemberDetail | null => {
      const node = nodes[nodeId];
      if (!node) return null;
      return {
        id: nodeId,
        name: node.name,
        units: node.count,
        area: node.areaPerUnit * node.count,
      };
    })
    .filter((m): m is MemberDetail => m !== null);

  const handleRemoveMember = (nodeId: string) => {
    removeFromGroup(selectedGroup.id, [nodeId]);
    toast.success('Removed from group');
  };

  const handleDelete = () => {
    if (confirm(`Delete group "${selectedGroup.name}"?`)) {
      deleteGroup(selectedGroup.id);
      selectGroups([]);
      toast.success('Group deleted');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold">Group Inspector</h2>
      </div>

      <Tabs defaultValue="details" className="flex-1 flex flex-col">
        <TabsList className="mx-3 mt-2">
          <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
          <TabsTrigger value="members" className="flex-1">Members</TabsTrigger>
          <TabsTrigger value="notes" className="flex-1">Notes</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="details" className="p-4 space-y-4 mt-0">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">Name</Label>
              <Input
                id="name"
                value={selectedGroup.name}
                onChange={(e) => updateGroup(selectedGroup.id, { name: e.target.value })}
              />
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <Label className="text-xs">Color</Label>
              <div className="flex flex-wrap gap-2">
                {GROUP_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`
                      w-6 h-6 rounded-full transition-all
                      ${selectedGroup.color === color 
                        ? 'ring-2 ring-offset-2 ring-primary scale-110' 
                        : 'hover:scale-105'
                      }
                    `}
                    style={{ backgroundColor: color }}
                    onClick={() => updateGroup(selectedGroup.id, { color })}
                  />
                ))}
              </div>
            </div>

            <Separator />

            {/* Summary */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Members</span>
                <span className="font-medium">{selectedGroup.members.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Units</span>
                <span className="font-medium tabular-nums">{totalUnits}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Area</span>
                <span className="font-medium tabular-nums">{totalArea.toLocaleString()} m²</span>
              </div>
            </div>

            <Separator />

            {/* Group Actions */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Group Actions</Label>
              
              {/* Split actions - only show if group has 2+ members */}
              {memberDetails.length >= 2 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setShowSplitEqualDialog(true)}
                  >
                    <Split className="h-4 w-4 mr-2" />
                    Split into Equal Groups
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setShowSplitProportionDialog(true)}
                  >
                    <Percent className="h-4 w-4 mr-2" />
                    Split by Proportion
                  </Button>
                </>
              )}

              {/* Merge action - only show if group has 1+ members */}
              {memberDetails.length >= 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setShowMergeAreasDialog(true)}
                >
                  <Merge className="h-4 w-4 mr-2" />
                  Merge All Areas
                </Button>
              )}
            </div>

            <Separator />

            {/* Danger Zone */}
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Group
            </Button>
          </TabsContent>

          <TabsContent value="members" className="p-4 space-y-2 mt-0">
            {memberDetails.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                <p>No members assigned</p>
                <p className="text-xs mt-1">Assign areas from the Areas panel</p>
              </div>
            ) : (
              memberDetails.map((member) => (
                <div
                  key={member.id}
                  className="flex items-start gap-2 p-2 rounded-md bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.units} units · {member.area.toLocaleString()} m²
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => handleRemoveMember(member.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="notes" className="p-4 space-y-4 mt-0">
            <div className="space-y-1.5">
              <Label htmlFor="userNote" className="text-xs">Your Notes</Label>
              <Textarea
                id="userNote"
                value={selectedGroup.userNote || ''}
                onChange={(e) => updateGroup(selectedGroup.id, { userNote: e.target.value || undefined })}
                placeholder="Add notes about this group..."
                rows={4}
              />
            </div>

            {selectedGroup.aiNote && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">AI Note</Label>
                <div className="p-3 bg-muted rounded-md text-sm">
                  {selectedGroup.aiNote}
                </div>
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Dialogs */}
      <SplitGroupEqualDialog
        open={showSplitEqualDialog}
        onOpenChange={setShowSplitEqualDialog}
        group={selectedGroup}
      />
      <SplitGroupProportionDialog
        open={showSplitProportionDialog}
        onOpenChange={setShowSplitProportionDialog}
        group={selectedGroup}
      />
      <MergeGroupAreasDialog
        open={showMergeAreasDialog}
        onOpenChange={setShowMergeAreasDialog}
        group={selectedGroup}
      />
    </div>
  );
}
