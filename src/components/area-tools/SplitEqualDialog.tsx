import { useState, useMemo } from 'react';
import { useProjectStore, useUIStore } from '@/stores';
import type { AreaNode } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface SplitEqualDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: AreaNode;
}

export function SplitEqualDialog({ open, onOpenChange, node }: SplitEqualDialogProps) {
  const splitNodeByEqual = useProjectStore((s) => s.splitNodeByEqual);
  const clearSelection = useUIStore((s) => s.clearSelection);

  const [parts, setParts] = useState('2');

  const totalArea = node.areaPerUnit * node.count;
  const numParts = parseInt(parts, 10);

  const previewSplits = useMemo(() => {
    if (isNaN(numParts) || numParts < 2) return [];

    // Round each area to nearest 1 m² for clean numbers
    const areaEachRaw = totalArea / numParts;
    const areaEachRounded = Math.round(areaEachRaw);

    // Calculate how much we lose/gain from rounding, put difference on last item
    const roundedTotal = areaEachRounded * numParts;
    const diff = totalArea - roundedTotal;

    return Array.from({ length: numParts }, (_, i) => ({
      name: `${node.name} ${String.fromCharCode(65 + i)}`,
      area: i === numParts - 1 ? areaEachRounded + diff : areaEachRounded,
    }));
  }, [numParts, totalArea, node.name]);

  const isValid = numParts >= 2 && numParts <= 26; // Max 26 parts (A-Z)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) {
      toast.error('Enter a number between 2 and 26');
      return;
    }

    const newIds = splitNodeByEqual(node.id, numParts);
    if (newIds.length > 0) {
      toast.success(`Split into ${newIds.length} equal parts`);
      clearSelection();
      onOpenChange(false);
      setParts('2');
    } else {
      toast.error('Failed to split area');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setParts('2');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Split "{node.name}" into Equal Parts</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="text-sm text-muted-foreground">
              Total area: <span className="font-medium">{totalArea.toLocaleString()} m²</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="parts">Number of Equal Parts</Label>
              <Input
                id="parts"
                type="number"
                min="2"
                max="26"
                value={parts}
                onChange={(e) => setParts(e.target.value)}
                placeholder="2"
              />
            </div>

            {previewSplits.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Preview</Label>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {previewSplits.map((split, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center text-sm py-1.5 px-2 bg-muted rounded"
                    >
                      <span>{split.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {split.area.toLocaleString()} m²
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid}>
              Split into {numParts || 0} Parts
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
