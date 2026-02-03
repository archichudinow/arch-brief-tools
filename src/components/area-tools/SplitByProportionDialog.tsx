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

interface SplitByProportionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: AreaNode;
}

interface ProportionSplit {
  name: string;
  percent: string;
}

export function SplitByProportionDialog({ open, onOpenChange, node }: SplitByProportionDialogProps) {
  const splitNodeByProportion = useProjectStore((s) => s.splitNodeByProportion);
  const clearSelection = useUIStore((s) => s.clearSelection);

  const totalArea = node.areaPerUnit * node.count;

  const [splits, setSplits] = useState<ProportionSplit[]>([]);

  // Initialize splits when dialog opens
  useEffect(() => {
    if (open) {
      setSplits([
        { name: `${node.name} A`, percent: '50' },
        { name: `${node.name} B`, percent: '50' },
      ]);
    }
  }, [open, node.name]);

  const addSplit = () => {
    const letter = String.fromCharCode(65 + splits.length);
    setSplits([...splits, { name: `${node.name} ${letter}`, percent: '' }]);
  };

  const removeSplit = (index: number) => {
    if (splits.length <= 2) return;
    setSplits(splits.filter((_, i) => i !== index));
  };

  const updateSplit = (index: number, field: keyof ProportionSplit, value: string) => {
    setSplits(splits.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  // Calculate validation
  const parsedSplits = useMemo(() => {
    return splits.map((split) => {
      const percent = parseFloat(split.percent);
      const area = isNaN(percent) || percent <= 0 ? 0 : (percent / 100) * totalArea;
      return {
        name: split.name.trim(),
        percent: isNaN(percent) || percent <= 0 ? 0 : percent,
        area,
        valid: !isNaN(percent) && percent > 0 && split.name.trim().length > 0,
      };
    });
  }, [splits, totalArea]);

  const percentSum = parsedSplits.reduce((sum, s) => sum + s.percent, 0);
  const validSplits = parsedSplits.filter((s) => s.valid);
  const isValid = validSplits.length >= 2 && Math.abs(percentSum - 100) < 0.1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validSplits.length < 2) {
      toast.error('Need at least 2 valid proportions');
      return;
    }

    if (Math.abs(percentSum - 100) >= 0.1) {
      toast.error('Percentages must sum to 100%');
      return;
    }

    // Build percentages array
    const percentages = validSplits.map((s) => ({
      name: s.name,
      percent: s.percent,
    }));

    const newIds = splitNodeByProportion(node.id, percentages);
    if (newIds.length > 0) {
      toast.success(`Split into ${newIds.length} areas by proportion`);
      clearSelection();
      onOpenChange(false);
    } else {
      toast.error('Failed to split area');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const remaining = 100 - percentSum;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Split "{node.name}" by Proportion</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                Total area: <span className="font-medium">{totalArea.toLocaleString()} m²</span>
              </span>
              <span className={remaining !== 0 ? 'text-destructive' : 'text-green-600'}>
                {remaining > 0
                  ? `${remaining.toFixed(1)}% remaining`
                  : remaining < 0
                    ? `${Math.abs(remaining).toFixed(1)}% over`
                    : '✓ 100%'}
              </span>
            </div>

            <div className="space-y-2">
              {splits.map((split, index) => {
                const parsed = parsedSplits[index];
                return (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      value={split.name}
                      onChange={(e) => updateSplit(index, 'name', e.target.value)}
                      placeholder="Name"
                      className="flex-1"
                    />
                    <div className="relative w-24">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={split.percent}
                        onChange={(e) => updateSplit(index, 'percent', e.target.value)}
                        placeholder="0"
                        className="pr-6"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                    <span className="w-20 text-right text-xs text-muted-foreground tabular-nums">
                      {parsed?.area ? `${Math.round(parsed.area).toLocaleString()} m²` : '—'}
                    </span>
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
                );
              })}
            </div>

            <Button type="button" variant="outline" size="sm" onClick={addSplit}>
              <Plus className="h-4 w-4 mr-2" />
              Add Proportion
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
