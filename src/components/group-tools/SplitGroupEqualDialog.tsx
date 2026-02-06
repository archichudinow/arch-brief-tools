import { useState, useMemo } from 'react';
import { useProjectStore, useUIStore } from '@/stores';
import type { Group } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface SplitGroupEqualDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Group;
}

export function SplitGroupEqualDialog({ open, onOpenChange, group }: SplitGroupEqualDialogProps) {
  const splitGroupEqual = useProjectStore((s) => s.splitGroupEqual);
  const nodes = useProjectStore((s) => s.nodes);
  const selectGroups = useUIStore((s) => s.selectGroups);

  const [parts, setParts] = useState('8');
  const [nameSuffix, setNameSuffix] = useState('Unit');

  // Calculate group stats
  const memberNodes = useMemo(() => 
    group.members.map(id => nodes[id]).filter(Boolean),
    [group.members, nodes]
  );

  const totalArea = useMemo(() => 
    memberNodes.reduce((sum, n) => sum + n.areaPerUnit * n.count, 0),
    [memberNodes]
  );

  const totalUnits = useMemo(() => 
    memberNodes.reduce((sum, n) => sum + n.count, 0),
    [memberNodes]
  );

  const numParts = parseInt(parts, 10);

  // Preview: show how each area type will be split
  const previewAreas = useMemo(() => {
    if (isNaN(numParts) || numParts < 2) return [];

    return memberNodes.map(node => {
      // Match store logic: if count >= parts, split by count; otherwise split by area
      const splitByCount = node.count >= numParts;
      
      if (splitByCount) {
        const baseCount = Math.floor(node.count / numParts);
        const remainder = node.count % numParts;
        return {
          name: node.name,
          originalCount: node.count,
          areaPerUnit: node.areaPerUnit,
          splitByCount: true,
          // First 'remainder' groups get baseCount+1, rest get baseCount
          splitCounts: Array.from({ length: numParts }, (_, i) => 
            baseCount + (i < remainder ? 1 : 0)
          ),
          splitAreaPerUnit: node.areaPerUnit, // unchanged
        };
      } else {
        // Split by area - each group gets count=1 with divided areaPerUnit
        const dividedArea = node.areaPerUnit / numParts;
        return {
          name: node.name,
          originalCount: node.count,
          areaPerUnit: node.areaPerUnit,
          splitByCount: false,
          splitCounts: Array.from({ length: numParts }, () => 1),
          splitAreaPerUnit: dividedArea,
        };
      }
    });
  }, [numParts, memberNodes]);

  const areaPerGroup = useMemo(() => 
    numParts > 0 ? Math.round(totalArea / numParts) : 0,
    [totalArea, numParts]
  );

  // Valid if numParts >= 2 and nameSuffix provided
  // (We can always split: either by count if count >= parts, or by area if count < parts)
  const isValid = numParts >= 2 && nameSuffix.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) {
      toast.error('Please provide a valid number of groups and name suffix');
      return;
    }

    const newIds = splitGroupEqual(group.id, numParts, nameSuffix.trim());
    if (newIds.length > 0) {
      toast.success(`Split into ${newIds.length} groups`);
      selectGroups(newIds);
      onOpenChange(false);
      setParts('8');
      setNameSuffix('Unit');
    } else {
      toast.error('Failed to split group');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setParts('8');
      setNameSuffix('Unit');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Split "{group.name}" into Equal Groups</DialogTitle>
            <DialogDescription>
              Creates {numParts || '?'} copies of this group, dividing area counts equally.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Group stats */}
            <div className="text-sm text-muted-foreground flex justify-between">
              <span>Areas: <span className="font-medium">{memberNodes.length}</span></span>
              <span>Units: <span className="font-medium">{totalUnits}</span></span>
              <span>Total: <span className="font-medium">{totalArea.toLocaleString()} m²</span></span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="parts">Number of Groups</Label>
                <Input
                  id="parts"
                  type="number"
                  min="2"
                  value={parts}
                  onChange={(e) => setParts(e.target.value)}
                  placeholder="8"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suffix">Group Name Suffix</Label>
                <Input
                  id="suffix"
                  value={nameSuffix}
                  onChange={(e) => setNameSuffix(e.target.value)}
                  placeholder="Unit"
                />
              </div>
            </div>

            {/* Preview */}
            {previewAreas.length > 0 && numParts >= 2 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs text-muted-foreground">Preview: How areas will be split</Label>
                  <span className="text-xs text-muted-foreground">~{areaPerGroup.toLocaleString()} m²/group</span>
                </div>
                <div className="max-h-48 overflow-y-auto border rounded-md">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium">Area</th>
                        <th className="text-right p-2 font-medium">Total</th>
                        <th className="text-right p-2 font-medium">Per Group</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewAreas.map((area, i) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="p-2 truncate max-w-[150px]" title={area.name}>{area.name}</td>
                          <td className="p-2 text-right tabular-nums">{area.originalCount}×{area.areaPerUnit}m²</td>
                          <td className="p-2 text-right tabular-nums text-primary">
                            {area.splitByCount ? (
                              // Split by count - showing count distribution
                              <>
                                {area.splitCounts[0]}× each
                                {area.splitCounts[0] !== area.splitCounts[numParts - 1] && (
                                  <span className="text-muted-foreground"> (some {area.splitCounts[numParts - 1]}×)</span>
                                )}
                              </>
                            ) : (
                              // Split by area - showing divided area
                              <span className="text-amber-600 dark:text-amber-400">
                                1×{area.splitAreaPerUnit.toFixed(1)}m²
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previewAreas.some(a => !a.splitByCount) && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚡ Areas with count &lt; {numParts} will have their m² divided instead
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Result: {numParts} groups named "{group.name} - {nameSuffix} 1" through "{group.name} - {nameSuffix} {numParts}"
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid}>
              Split into {numParts} Groups
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
