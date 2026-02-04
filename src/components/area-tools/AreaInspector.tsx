import { useState } from 'react';
import { useProjectStore, useUIStore } from '@/stores';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Trash2,
  Copy,
  SplitSquareVertical,
  Lock,
  Unlock,
  Merge,
  Grid2X2,
  Percent,
  Ruler,
  FolderPlus,
} from 'lucide-react';
import { SplitDialog } from './SplitDialog';
import { SplitEqualDialog } from './SplitEqualDialog';
import { SplitByAreasDialog } from './SplitByAreasDialog';
import { SplitByProportionDialog } from './SplitByProportionDialog';
import { NotesCard } from './NotesCard';
import { toast } from 'sonner';
import type { NoteSource } from '@/types';

export function AreaInspector() {
  const nodes = useProjectStore((s) => s.nodes);
  const groups = useProjectStore((s) => s.groups);
  const updateNode = useProjectStore((s) => s.updateNode);
  const deleteNode = useProjectStore((s) => s.deleteNode);
  const duplicateNode = useProjectStore((s) => s.duplicateNode);
  const getNodeDerived = useProjectStore((s) => s.getNodeDerived);
  const mergeNodes = useProjectStore((s) => s.mergeNodes);
  const assignToGroup = useProjectStore((s) => s.assignToGroup);
  const mergeToSingleUnit = useProjectStore((s) => s.mergeToSingleUnit);
  const addNoteToArea = useProjectStore((s) => s.addNoteToArea);
  const updateNote = useProjectStore((s) => s.updateNote);
  const deleteNote = useProjectStore((s) => s.deleteNote);

  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const inspectorTab = useUIStore((s) => s.inspectorTab);
  const setInspectorTab = useUIStore((s) => s.setInspectorTab);
  const clearSelection = useUIStore((s) => s.clearSelection);

  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [showSplitEqualDialog, setShowSplitEqualDialog] = useState(false);
  const [showSplitAreasDialog, setShowSplitAreasDialog] = useState(false);
  const [showSplitProportionDialog, setShowSplitProportionDialog] = useState(false);

  const availableGroups = Object.values(groups);

  // Handle multi-select scenario
  if (selectedNodeIds.length > 1) {
    const selectedNodes = selectedNodeIds.map(id => nodes[id]).filter(Boolean);
    const totalCount = selectedNodes.reduce((sum, n) => sum + n.count, 0);
    const totalArea = selectedNodes.reduce((sum, n) => sum + (n.areaPerUnit * n.count), 0);

    const handleMergeNodes = () => {
      const name = prompt('Name for merged area:', selectedNodes.map(n => n.name).join(' + '));
      if (!name) return;
      const newId = mergeNodes(selectedNodeIds, name);
      if (newId) {
        clearSelection();
        toast.success('Areas merged');
      }
    };

    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-border">
          <h2 className="text-sm font-semibold">Multi-Select</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Selected</Label>
              <p className="text-sm font-medium">{selectedNodeIds.length} areas</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Total Units</Label>
                <p className="text-sm font-medium tabular-nums">{totalCount}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Total Area</Label>
                <p className="text-sm font-medium tabular-nums">{totalArea.toLocaleString()} m²</p>
              </div>
            </div>

            <Separator />

            {/* Merge */}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleMergeNodes}
            >
              <Merge className="h-4 w-4 mr-2" />
              Merge into One Area
            </Button>

            {/* Group Assignment */}
            {availableGroups.length > 0 && (
              <>
                <Separator />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      <FolderPlus className="h-4 w-4 mr-2" />
                      Assign to Group
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {availableGroups.map((group) => (
                      <DropdownMenuItem
                        key={group.id}
                        onClick={() => {
                          assignToGroup(group.id, selectedNodeIds);
                          toast.success(`Assigned ${selectedNodeIds.length} areas to ${group.name}`);
                        }}
                      >
                        <div
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: group.color }}
                        />
                        {group.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Determine what's selected
  const selectedNode = selectedNodeIds.length === 1 ? nodes[selectedNodeIds[0]] : null;

  if (!selectedNode) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-border">
          <h2 className="text-sm font-semibold">Inspector</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Select an area to inspect
        </div>
      </div>
    );
  }

  // Node inspector
  const derived = getNodeDerived(selectedNode.id);

  const handleDelete = () => {
    deleteNode(selectedNode.id);
    clearSelection();
    toast.success('Area deleted');
  };

  const handleDuplicate = () => {
    const newId = duplicateNode(selectedNode.id);
    if (newId) {
      toast.success('Area duplicated');
    }
  };

  const handleMergeToSingle = () => {
    if (selectedNode.count === 1) return;
    const totalArea = selectedNode.areaPerUnit * selectedNode.count;
    if (confirm(`Merge ${selectedNode.count} units into single ${totalArea.toLocaleString()}m² area?`)) {
      mergeToSingleUnit(selectedNode.id);
      toast.success('Merged into single unit');
    }
  };

  const toggleLock = (field: 'name' | 'areaPerUnit' | 'count') => {
    const current = selectedNode.lockedFields || [];
    const newLocked = current.includes(field)
      ? current.filter((f) => f !== field)
      : [...current, field];
    updateNode(selectedNode.id, { lockedFields: newLocked });
  };

  const isLocked = (field: 'name' | 'areaPerUnit' | 'count') => {
    return (selectedNode.lockedFields || []).includes(field);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border">
        <h2 className="text-sm font-semibold">Inspector</h2>
      </div>

      <Tabs
        value={inspectorTab}
        onValueChange={(v) => setInspectorTab(v as 'details' | 'notes')}
        className="flex-1 flex flex-col"
      >
        <TabsList className="mx-3 mt-2">
          <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
          <TabsTrigger value="notes" className="flex-1">Notes</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="details" className="p-4 space-y-4 mt-0">
            {/* Name */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="name" className="text-xs">Name</Label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => toggleLock('name')}
                >
                  {isLocked('name') ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    <Unlock className="h-3 w-3 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <Input
                id="name"
                value={selectedNode.name}
                onChange={(e) => updateNode(selectedNode.id, { name: e.target.value })}
                disabled={isLocked('name')}
              />
            </div>

            {/* Area per Unit */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="areaPerUnit" className="text-xs">Area per Unit (m²)</Label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => toggleLock('areaPerUnit')}
                >
                  {isLocked('areaPerUnit') ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    <Unlock className="h-3 w-3 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <Input
                id="areaPerUnit"
                type="number"
                step="0.1"
                min="0"
                value={selectedNode.areaPerUnit}
                onChange={(e) => {
                  const num = parseFloat(e.target.value);
                  if (!isNaN(num) && num > 0) {
                    updateNode(selectedNode.id, { areaPerUnit: num });
                  }
                }}
                disabled={isLocked('areaPerUnit')}
              />
            </div>

            {/* Count */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="count" className="text-xs">Count</Label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => toggleLock('count')}
                >
                  {isLocked('count') ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    <Unlock className="h-3 w-3 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <Input
                id="count"
                type="number"
                min="1"
                value={selectedNode.count}
                onChange={(e) => {
                  const num = parseInt(e.target.value, 10);
                  if (!isNaN(num) && num >= 1) {
                    updateNode(selectedNode.id, { count: num });
                  }
                }}
                disabled={isLocked('count')}
              />
            </div>

            <Separator />

            {/* Summary */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Area</span>
                <span className="font-medium tabular-nums">
                  {derived?.totalArea.toLocaleString()} m²
                </span>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="space-y-2">
              {/* Merge to Single Unit - only shown if count > 1 */}
              {selectedNode.count > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleMergeToSingle}
                >
                  <Merge className="h-4 w-4 mr-2" />
                  Merge to Single Unit ({(selectedNode.areaPerUnit * selectedNode.count).toLocaleString()}m²)
                </Button>
              )}

              {/* Split by Quantity - only if count >= 2 */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowSplitDialog(true)}
                disabled={selectedNode.count < 2}
                title={selectedNode.count < 2 ? 'Need at least 2 units to split by quantity' : undefined}
              >
                <SplitSquareVertical className="h-4 w-4 mr-2" />
                Split by Quantity
              </Button>

              {/* Split by Equal Parts */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowSplitEqualDialog(true)}
              >
                <Grid2X2 className="h-4 w-4 mr-2" />
                Split by Equal Parts
              </Button>

              {/* Split by Areas */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowSplitAreasDialog(true)}
              >
                <Ruler className="h-4 w-4 mr-2" />
                Split by Areas
              </Button>

              {/* Split by Proportion */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowSplitProportionDialog(true)}
              >
                <Percent className="h-4 w-4 mr-2" />
                Split by Proportion
              </Button>

              <Separator />

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleDuplicate}
              >
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </Button>

              {/* Group Assignment for Single Node */}
              {availableGroups.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      <FolderPlus className="h-4 w-4 mr-2" />
                      Assign to Group
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {availableGroups.map((group) => (
                      <DropdownMenuItem
                        key={group.id}
                        onClick={() => {
                          assignToGroup(group.id, [selectedNode.id]);
                          toast.success(`Assigned to ${group.name}`);
                        }}
                      >
                        <div
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: group.color }}
                        />
                        {group.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="notes" className="p-4 mt-0">
            <NotesCard
              notes={selectedNode.notes || []}
              onAddNote={(source: NoteSource, content: string) => {
                addNoteToArea(selectedNode.id, { source, content });
                toast.success('Note added');
              }}
              onUpdateNote={(noteId: string, content: string) => {
                updateNote('area', selectedNode.id, noteId, content);
                toast.success('Note updated');
              }}
              onDeleteNote={(noteId: string) => {
                deleteNote('area', selectedNode.id, noteId);
                toast.success('Note deleted');
              }}
            />
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Split by Quantity Dialog */}
      {selectedNode && (
        <SplitDialog
          open={showSplitDialog}
          onOpenChange={setShowSplitDialog}
          node={selectedNode}
        />
      )}

      {/* Split by Equal Parts Dialog */}
      {selectedNode && (
        <SplitEqualDialog
          open={showSplitEqualDialog}
          onOpenChange={setShowSplitEqualDialog}
          node={selectedNode}
        />
      )}

      {/* Split by Areas Dialog */}
      {selectedNode && (
        <SplitByAreasDialog
          open={showSplitAreasDialog}
          onOpenChange={setShowSplitAreasDialog}
          node={selectedNode}
        />
      )}

      {/* Split by Proportion Dialog */}
      {selectedNode && (
        <SplitByProportionDialog
          open={showSplitProportionDialog}
          onOpenChange={setShowSplitProportionDialog}
          node={selectedNode}
        />
      )}
    </div>
  );
}
