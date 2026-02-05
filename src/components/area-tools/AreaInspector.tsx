import { useState } from 'react';
import { useProjectStore, useUIStore } from '@/stores';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
  DropdownMenuSeparator,
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
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Link,
  Unlink,
  Layers,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Scissors,
  Hash,
} from 'lucide-react';
import { SplitDialog } from './SplitDialog';
import { SplitEqualDialog } from './SplitEqualDialog';
import { SplitByAreasDialog } from './SplitByAreasDialog';
import { SplitByProportionDialog } from './SplitByProportionDialog';
import { NotesCard } from './NotesCard';
import { toast } from 'sonner';
import type { NoteSource } from '@/types';

// ============================================
// MULTI-SELECT VIEW
// ============================================

function MultiSelectInspector({
  selectedNodeIds,
  nodes,
  groups,
  collapseNodes,
  mergeQuantities,
  mergeNodes,
  assignToGroup,
  clearSelection,
}: {
  selectedNodeIds: string[];
  nodes: Record<string, any>;
  groups: Record<string, any>;
  collapseNodes: (ids: string[]) => string | null;
  mergeQuantities: (ids: string[]) => string | null;
  mergeNodes: (ids: string[], name: string) => string | null;
  assignToGroup: (groupId: string, nodeIds: string[]) => void;
  clearSelection: () => void;
}) {
  const selectedNodes = selectedNodeIds.map(id => nodes[id]).filter(Boolean);
  const totalCount = selectedNodes.reduce((sum, n) => sum + n.count, 0);
  const totalArea = selectedNodes.reduce((sum, n) => sum + (n.areaPerUnit * n.count), 0);
  const availableGroups = Object.values(groups);
  
  // Check if all selected are same type (can be collapsed/merged)
  const firstInstanceOf = selectedNodes[0]?.instanceOf ?? selectedNodes[0]?.id;
  const allSameType = selectedNodes.every(n => {
    if (n.instanceOf) return n.instanceOf === firstInstanceOf || n.instanceOf === selectedNodes[0].id;
    return n.id === firstInstanceOf || 
           (n.areaPerUnit === selectedNodes[0].areaPerUnit && !selectedNodes[0].instanceOf);
  });

  const handleMergeNodes = () => {
    const name = prompt('Name for merged area:', selectedNodes.map(n => n.name).join(' + '));
    if (!name) return;
    const newId = mergeNodes(selectedNodeIds, name);
    if (newId) {
      clearSelection();
      toast.success('Areas merged');
    }
  };

  const handleCollapseNodes = () => {
    const newId = collapseNodes(selectedNodeIds);
    if (newId) {
      clearSelection();
      toast.success(`Collapsed into ×${totalCount}`);
    }
  };

  const handleMergeQuantities = () => {
    const newId = mergeQuantities(selectedNodeIds);
    if (newId) {
      clearSelection();
      toast.success(`Merged quantities: ×${totalCount}`);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border bg-muted/30">
        <h2 className="text-sm font-semibold">{selectedNodeIds.length} Areas Selected</h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Summary Card */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Units</span>
              <span className="font-semibold tabular-nums">{totalCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Area</span>
              <span className="font-semibold tabular-nums">{totalArea.toLocaleString()} m²</span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Actions</Label>
            
            {allSameType && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={handleCollapseNodes}
                >
                  <Layers className="h-4 w-4 mr-2" />
                  Collapse to ×{totalCount}
                  <span className="ml-auto text-xs text-muted-foreground">Same type</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={handleMergeQuantities}
                >
                  <Hash className="h-4 w-4 mr-2" />
                  Sum Quantities (×{totalCount})
                </Button>
              </>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={handleMergeNodes}
            >
              <Merge className="h-4 w-4 mr-2" />
              Merge into One Area
            </Button>

            {availableGroups.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Assign to Group
                    <ChevronDown className="h-3 w-3 ml-auto" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {availableGroups.map((group: any) => (
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
            )}
          </div>
        </div>
        </ScrollArea>
      </div>
    );
}

// ============================================
// MAIN INSPECTOR COMPONENT
// ============================================

export function AreaInspector() {
  const nodes = useProjectStore((s) => s.nodes);
  const groups = useProjectStore((s) => s.groups);
  const updateNode = useProjectStore((s) => s.updateNode);
  const deleteNode = useProjectStore((s) => s.deleteNode);
  const duplicateAsInstance = useProjectStore((s) => s.duplicateAsInstance);
  const duplicateAsCopy = useProjectStore((s) => s.duplicateAsCopy);
  const unlinkInstance = useProjectStore((s) => s.unlinkInstance);
  const expandNode = useProjectStore((s) => s.expandNode);
  const collapseNodes = useProjectStore((s) => s.collapseNodes);
  const collapseToArea = useProjectStore((s) => s.collapseToArea);
  const mergeQuantities = useProjectStore((s) => s.mergeQuantities);
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
  const [splitSectionOpen, setSplitSectionOpen] = useState(false);

  const availableGroups = Object.values(groups);

  // Handle multi-select scenario
  if (selectedNodeIds.length > 1) {
    return (
      <MultiSelectInspector
        selectedNodeIds={selectedNodeIds}
        nodes={nodes}
        groups={groups}
        collapseNodes={collapseNodes}
        mergeQuantities={mergeQuantities}
        mergeNodes={mergeNodes}
        assignToGroup={assignToGroup}
        clearSelection={clearSelection}
      />
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
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground text-sm px-4">
            <div className="text-2xl mb-2">📋</div>
            Select an area to inspect
          </div>
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

  const handleDuplicateAsInstance = () => {
    const newId = duplicateAsInstance(selectedNode.id);
    if (newId) {
      toast.success('Instance created (linked)');
    }
  };

  const handleDuplicateAsCopy = () => {
    const newId = duplicateAsCopy(selectedNode.id);
    if (newId) {
      toast.success('Independent copy created');
    }
  };

  const handleUnlinkInstance = () => {
    unlinkInstance(selectedNode.id);
    toast.success('Instance unlinked');
  };

  const handleExpandNode = () => {
    if (selectedNode.count <= 1) return;
    const newIds = expandNode(selectedNode.id);
    clearSelection();
    toast.success(`Expanded into ${newIds.length} linked nodes`);
  };

  const handleCollapseToArea = () => {
    const totalArea = (derived?.effectiveAreaPerUnit ?? selectedNode.areaPerUnit) * selectedNode.count;
    collapseToArea(selectedNode.id);
    toast.success(`Collapsed to ${totalArea.toLocaleString()}m² (unlinked)`);
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
      {/* Header */}
      <div className="p-3 border-b border-border">
        <h2 className="text-sm font-semibold truncate" title={selectedNode.name}>
          {selectedNode.name}
        </h2>
        <p className="text-xs text-muted-foreground">
          {derived?.totalArea.toLocaleString()} m² total
          {selectedNode.count > 1 && ` (×${selectedNode.count})`}
        </p>
      </div>

      <Tabs
        value={inspectorTab}
        onValueChange={(v) => setInspectorTab(v as 'details' | 'notes')}
        className="flex-1 flex flex-col"
      >
        <TabsList className="mx-3 mt-2 grid grid-cols-2">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="notes">
            Notes
            {selectedNode.notes?.length > 0 && (
              <span className="ml-1 text-xs bg-primary/20 px-1.5 rounded-full">
                {selectedNode.notes.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="details" className="p-3 space-y-3 mt-0">
            
            {/* Properties Section */}
            <div className="space-y-3">
              {/* Name */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="name" className="text-xs text-muted-foreground">Name</Label>
                  <button
                    className="p-1 rounded hover:bg-muted"
                    onClick={() => toggleLock('name')}
                    title={isLocked('name') ? 'Unlock' : 'Lock'}
                  >
                    {isLocked('name') ? (
                      <Lock className="h-3 w-3 text-amber-500" />
                    ) : (
                      <Unlock className="h-3 w-3 text-muted-foreground/50" />
                    )}
                  </button>
                </div>
                <Input
                  id="name"
                  value={selectedNode.name}
                  onChange={(e) => updateNode(selectedNode.id, { name: e.target.value })}
                  disabled={isLocked('name')}
                  className="h-8"
                />
              </div>

              {/* Area per Unit */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="areaPerUnit" className="text-xs text-muted-foreground">
                    Area per Unit
                    {derived?.hasInstanceLink && (
                      <span className="text-blue-500 ml-1 text-[10px]">(linked)</span>
                    )}
                  </Label>
                  <button
                    className="p-1 rounded hover:bg-muted"
                    onClick={() => toggleLock('areaPerUnit')}
                    title={isLocked('areaPerUnit') ? 'Unlock' : 'Lock'}
                  >
                    {isLocked('areaPerUnit') ? (
                      <Lock className="h-3 w-3 text-amber-500" />
                    ) : (
                      <Unlock className="h-3 w-3 text-muted-foreground/50" />
                    )}
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="areaPerUnit"
                    type="number"
                    step="0.1"
                    min="0"
                    value={derived?.effectiveAreaPerUnit ?? selectedNode.areaPerUnit}
                    onChange={(e) => {
                      const num = parseFloat(e.target.value);
                      if (!isNaN(num) && num > 0) {
                        updateNode(selectedNode.id, { areaPerUnit: num });
                      }
                    }}
                    disabled={isLocked('areaPerUnit')}
                    className="h-8 pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">m²</span>
                </div>
              </div>

              {/* Count */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="count" className="text-xs text-muted-foreground">Count</Label>
                  <button
                    className="p-1 rounded hover:bg-muted"
                    onClick={() => toggleLock('count')}
                    title={isLocked('count') ? 'Unlock' : 'Lock'}
                  >
                    {isLocked('count') ? (
                      <Lock className="h-3 w-3 text-amber-500" />
                    ) : (
                      <Unlock className="h-3 w-3 text-muted-foreground/50" />
                    )}
                  </button>
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
                  className="h-8"
                />
              </div>
            </div>

            {/* Instance Link Card */}
            {derived?.hasInstanceLink && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <Link className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Linked Instances</span>
                  {derived.instanceCount !== undefined && derived.instanceCount > 0 && (
                    <span className="text-[10px] text-blue-500 ml-auto bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded-full">
                      {derived.instanceCount} linked
                    </span>
                  )}
                </div>
                <div className="text-xs space-y-1 text-blue-600 dark:text-blue-400">
                  <div className="flex justify-between">
                    <span>Type:</span>
                    <span className="font-medium">{derived.instanceSource}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shared area:</span>
                    <span className="font-medium">{derived.effectiveAreaPerUnit.toLocaleString()} m²</span>
                  </div>
                </div>
              </div>
            )}

            {/* AI Reasoning */}
            {derived?.effectiveReasoning && (
              <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                  <span className="text-xs font-medium text-purple-700 dark:text-purple-300">AI Reasoning</span>
                  {derived.effectiveConfidence != null && (
                    <span className={`ml-auto text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${
                      derived.effectiveConfidence >= 0.8 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                        : derived.effectiveConfidence >= 0.6 
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' 
                          : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                    }`}>
                      {derived.effectiveConfidence >= 0.8 ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <AlertCircle className="h-3 w-3" />
                      )}
                      {Math.round(derived.effectiveConfidence * 100)}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-purple-600 dark:text-purple-400 leading-relaxed">
                  {derived.effectiveReasoning}
                </p>
                {derived.effectiveFormulaType && (
                  <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-800">
                    <span className="text-[10px] font-mono bg-purple-100 dark:bg-purple-900 px-1.5 py-0.5 rounded text-purple-600 dark:text-purple-400">
                      {derived.effectiveFormulaType}
                    </span>
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Actions */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Actions</Label>
              
              {/* Split Actions - Collapsible */}
              <Collapsible open={splitSectionOpen} onOpenChange={setSplitSectionOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                  >
                    <Scissors className="h-4 w-4 mr-2" />
                    Split Area
                    {splitSectionOpen ? (
                      <ChevronDown className="h-3 w-3 ml-auto" />
                    ) : (
                      <ChevronRight className="h-3 w-3 ml-auto" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-6 pt-1.5 space-y-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-7 text-xs"
                    onClick={() => setShowSplitDialog(true)}
                    disabled={selectedNode.count < 2}
                    title={selectedNode.count < 2 ? 'Need at least 2 units' : undefined}
                  >
                    <SplitSquareVertical className="h-3.5 w-3.5 mr-2" />
                    By Quantity
                    {selectedNode.count >= 2 && (
                      <span className="ml-auto text-muted-foreground">×{selectedNode.count}</span>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-7 text-xs"
                    onClick={() => setShowSplitEqualDialog(true)}
                  >
                    <Grid2X2 className="h-3.5 w-3.5 mr-2" />
                    By Equal Parts
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-7 text-xs"
                    onClick={() => setShowSplitAreasDialog(true)}
                  >
                    <Ruler className="h-3.5 w-3.5 mr-2" />
                    By Specific Areas
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-7 text-xs"
                    onClick={() => setShowSplitProportionDialog(true)}
                  >
                    <Percent className="h-3.5 w-3.5 mr-2" />
                    By Proportion
                  </Button>
                </CollapsibleContent>
              </Collapsible>

              {/* Duplicate Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                    <ChevronDown className="h-3 w-3 ml-auto" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={handleDuplicateAsInstance}>
                    <Link className="h-4 w-4 mr-2 text-blue-500" />
                    <div>
                      <div>As Instance</div>
                      <div className="text-[10px] text-muted-foreground">Shares area value</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDuplicateAsCopy}>
                    <Copy className="h-4 w-4 mr-2" />
                    <div>
                      <div>As Copy</div>
                      <div className="text-[10px] text-muted-foreground">Independent</div>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* More Actions - shown conditionally */}
              {(selectedNode.count > 1 || derived?.isInstance || derived?.hasInstanceLink) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <MoreHorizontal className="h-4 w-4 mr-2" />
                      More Actions
                      <ChevronDown className="h-3 w-3 ml-auto" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {selectedNode.count > 1 && (
                      <>
                        <DropdownMenuItem onClick={handleExpandNode}>
                          <Layers className="h-4 w-4 mr-2" />
                          <div>
                            <div>Expand to {selectedNode.count} Nodes</div>
                            <div className="text-[10px] text-muted-foreground">Creates linked instances</div>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleMergeToSingle}>
                          <Merge className="h-4 w-4 mr-2" />
                          <div>
                            <div>Merge to Single</div>
                            <div className="text-[10px] text-muted-foreground">{derived?.totalArea.toLocaleString()}m² × 1</div>
                          </div>
                        </DropdownMenuItem>
                      </>
                    )}
                    {derived?.isInstance && (
                      <DropdownMenuItem onClick={handleUnlinkInstance}>
                        <Unlink className="h-4 w-4 mr-2 text-amber-500" />
                        <div>
                          <div>Unlink Instance</div>
                          <div className="text-[10px] text-muted-foreground">Break the link</div>
                        </div>
                      </DropdownMenuItem>
                    )}
                    {(selectedNode.count > 1 || derived?.hasInstanceLink) && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleCollapseToArea}>
                          <Hash className="h-4 w-4 mr-2" />
                          <div>
                            <div>Collapse to Area</div>
                            <div className="text-[10px] text-muted-foreground">{derived?.totalArea.toLocaleString()}m² total, unlinked</div>
                          </div>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Group Assignment */}
              {availableGroups.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <FolderPlus className="h-4 w-4 mr-2" />
                      Assign to Group
                      <ChevronDown className="h-3 w-3 ml-auto" />
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

              <Separator className="my-2" />

              {/* Delete */}
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Area
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="notes" className="p-3 mt-0">
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

      {/* Dialogs */}
      {selectedNode && (
        <>
          <SplitDialog
            open={showSplitDialog}
            onOpenChange={setShowSplitDialog}
            node={selectedNode}
          />
          <SplitEqualDialog
            open={showSplitEqualDialog}
            onOpenChange={setShowSplitEqualDialog}
            node={selectedNode}
          />
          <SplitByAreasDialog
            open={showSplitAreasDialog}
            onOpenChange={setShowSplitAreasDialog}
            node={selectedNode}
          />
          <SplitByProportionDialog
            open={showSplitProportionDialog}
            onOpenChange={setShowSplitProportionDialog}
            node={selectedNode}
          />
        </>
      )}
    </div>
  );
}
