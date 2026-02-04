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

interface MergeGroupAreasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Group;
}

export function MergeGroupAreasDialog({ open, onOpenChange, group }: MergeGroupAreasDialogProps) {
  const mergeGroupAreas = useProjectStore((s) => s.mergeGroupAreas);
  const nodes = useProjectStore((s) => s.nodes);
  const selectGroups = useUIStore((s) => s.selectGroups);
  const selectNodes = useUIStore((s) => s.selectNodes);

  const [newName, setNewName] = useState(group.name);

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

  const avgAreaPerUnit = totalUnits > 0 ? totalArea / totalUnits : 0;

  const isValid = newName.trim().length > 0 && memberNodes.length >= 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) {
      toast.error('Enter a name for the merged area');
      return;
    }

    const newId = mergeGroupAreas(group.id, newName.trim());
    if (newId) {
      toast.success(`Merged ${memberNodes.length} areas into "${newName.trim()}"`);
      selectGroups([]);
      selectNodes([newId]);
      onOpenChange(false);
    } else {
      toast.error('Failed to merge areas');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setNewName(group.name);
    } else {
      setNewName(group.name);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Merge All Areas in "{group.name}"</DialogTitle>
            <DialogDescription>
              This will combine all {memberNodes.length} areas into a single area and remove the group.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Current areas */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Areas to merge</Label>
              <div className="max-h-32 overflow-y-auto space-y-1 text-sm">
                {memberNodes.map((node) => (
                  <div key={node.id} className="flex justify-between p-2 rounded bg-muted/50">
                    <span className="truncate">{node.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {node.count}× {node.areaPerUnit}m²
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Result preview */}
            <div className="p-3 rounded-md bg-primary/10 border border-primary/20 space-y-2">
              <Label className="text-xs font-medium">Result</Label>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total units</span>
                  <span className="font-medium tabular-nums">{totalUnits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg area per unit</span>
                  <span className="font-medium tabular-nums">{avgAreaPerUnit.toFixed(1)} m²</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total area</span>
                  <span className="font-medium tabular-nums">{totalArea.toLocaleString()} m²</span>
                </div>
              </div>
            </div>

            {/* New name */}
            <div className="space-y-2">
              <Label htmlFor="newName">Name for Merged Area</Label>
              <Input
                id="newName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter name..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid} variant="destructive">
              Merge {memberNodes.length} Areas
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
