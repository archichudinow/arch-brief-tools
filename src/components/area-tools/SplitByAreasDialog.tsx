import { useState, useMemo, useEffect } from 'react';
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
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface SplitByAreasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: AreaNode;
}

interface AreaSplit {
  name: string;
  area: string;
}

export function SplitByAreasDialog({ open, onOpenChange, node }: SplitByAreasDialogProps) {
  const splitNodeByAreas = useProjectStore((s) => s.splitNodeByAreas);
  const clearSelection = useUIStore((s) => s.clearSelection);

  const totalArea = node.areaPerUnit * node.count;

  const [splits, setSplits] = useState<AreaSplit[]>([]);

  // Initialize splits when dialog opens
  useEffect(() => {
    if (open) {
      const halfArea = Math.floor(totalArea / 2);
      const restArea = totalArea - halfArea;
      setSplits([
        { name: `${node.name} A`, area: halfArea.toString() },
        { name: `${node.name} B`, area: restArea.toString() },
      ]);
    }
  }, [open, node.name, totalArea]);

  const addSplit = () => {
    const letter = String.fromCharCode(65 + splits.length);
    setSplits([...splits, { name: `${node.name} ${letter}`, area: '' }]);
  };

  const removeSplit = (index: number) => {
    if (splits.length <= 2) return;
    setSplits(splits.filter((_, i) => i !== index));
  };

  const updateSplit = (index: number, field: keyof AreaSplit, value: string) => {
    setSplits(splits.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  // Calculate validation
  const parsedSplits = useMemo(() => {
    return splits.map((split) => {
      const area = parseFloat(split.area);
      return {
        name: split.name.trim(),
        area: isNaN(area) || area <= 0 ? 0 : area,
        valid: !isNaN(area) && area > 0 && split.name.trim().length > 0,
      };
    });
  }, [splits]);

  const areaSum = parsedSplits.reduce((sum, s) => sum + s.area, 0);
  const validSplits = parsedSplits.filter((s) => s.valid);
  const isValid = validSplits.length >= 2 && Math.abs(areaSum - totalArea) < 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validSplits.length < 2) {
      toast.error('Need at least 2 valid areas');
      return;
    }

    if (Math.abs(areaSum - totalArea) >= 1) {
      toast.error(`Areas must sum to ${totalArea.toLocaleString()} m²`);
      return;
    }

    // Build areas array (adjusting to ensure exact total)
    let areas = validSplits.map((s) => ({ name: s.name, area: s.area }));

    // Adjust to ensure exact total
    const currentSum = areas.reduce((sum, a) => sum + a.area, 0);
    if (Math.abs(currentSum - totalArea) > 0.01) {
      const diff = totalArea - currentSum;
      // Add difference to the largest area
      const maxIdx = areas.reduce(
        (maxI, a, i, arr) => (a.area > arr[maxI].area ? i : maxI),
        0
      );
      areas[maxIdx].area += diff;
    }

    const newIds = splitNodeByAreas(node.id, areas);
    if (newIds.length > 0) {
      toast.success(`Split into ${newIds.length} areas`);
      clearSelection();
      onOpenChange(false);
    } else {
      toast.error('Failed to split area');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const remaining = totalArea - areaSum;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Split "{node.name}" by Specific Areas</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                Total area: <span className="font-medium">{totalArea.toLocaleString()} m²</span>
              </span>
              <span className={remaining !== 0 ? 'text-destructive' : 'text-green-600'}>
                {remaining > 0
                  ? `${remaining.toLocaleString()} m² remaining`
                  : remaining < 0
                    ? `${Math.abs(remaining).toLocaleString()} m² over`
                    : '✓ Balanced'}
              </span>
            </div>

            <div className="space-y-2">
              {splits.map((split, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    value={split.name}
                    onChange={(e) => updateSplit(index, 'name', e.target.value)}
                    placeholder="Name"
                    className="flex-1"
                  />
                  <div className="relative w-32">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={split.area}
                      onChange={(e) => updateSplit(index, 'area', e.target.value)}
                      placeholder="0"
                      className="pr-8"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      m²
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => removeSplit(index)}
                    disabled={splits.length <= 2}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" size="sm" onClick={addSplit}>
              <Plus className="h-4 w-4 mr-2" />
              Add Area
            </Button>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid}>
              Split into {validSplits.length} Areas
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
