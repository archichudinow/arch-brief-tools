import { useState } from 'react';
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
import { Plus, Trash2, SplitSquareVertical } from 'lucide-react';
import { toast } from 'sonner';

interface SplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: AreaNode;
}

interface SplitDraft {
  count: string;
}

export function SplitDialog({ open, onOpenChange, node }: SplitDialogProps) {
  const splitNodeByQuantity = useProjectStore((s) => s.splitNodeByQuantity);
  const selectNodes = useUIStore((s) => s.selectNodes);

  const [drafts, setDrafts] = useState<SplitDraft[]>([
    { count: '' },
    { count: '' },
  ]);

  const resetForm = () => {
    setDrafts([
      { count: '' },
      { count: '' },
    ]);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const addDraft = () => {
    setDrafts([...drafts, { count: '' }]);
  };

  const removeDraft = (index: number) => {
    if (drafts.length <= 2) return; // Keep minimum 2 drafts
    setDrafts(drafts.filter((_, i) => i !== index));
  };

  const updateDraft = (index: number, value: string) => {
    setDrafts(
      drafts.map((d, i) => (i === index ? { count: value } : d))
    );
  };

  const draftSum = drafts.reduce((sum, d) => {
    const num = parseInt(d.count, 10);
    return sum + (isNaN(num) ? 0 : num);
  }, 0);

  const quantities = drafts
    .map((d) => parseInt(d.count, 10))
    .filter((n) => !isNaN(n) && n >= 1);

  // Require at least 2 splits and sum must equal node.count exactly
  const isValid = quantities.length >= 2 && draftSum === node.count;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (quantities.length < 2) {
      toast.error('Need at least 2 split groups');
      return;
    }

    if (draftSum !== node.count) {
      toast.error(`Quantities must sum to exactly ${node.count}`);
      return;
    }

    const newIds = splitNodeByQuantity(node.id, quantities);
    if (newIds.length > 0) {
      // Select the first new node
      selectNodes([newIds[0]]);
      toast.success(`Split into ${newIds.length} areas`);
      handleOpenChange(false);
    } else {
      toast.error('Failed to split area');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SplitSquareVertical className="h-5 w-5" />
            Split by Quantity "{node.name}"
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Info */}
            <div className="p-3 bg-muted rounded-md text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total units:</span>
                <span className="font-medium tabular-nums">{node.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unit area:</span>
                <span className="font-medium tabular-nums">{node.areaPerUnit} m²</span>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                Split this area into multiple new areas. Each new area will have the same unit size ({node.areaPerUnit} m²) but different quantities.
              </p>
            </div>

            {/* Split Drafts */}
            <div className="space-y-2">
              <Label className="text-xs">Quantity per split</Label>
              {drafts.map((draft, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-8 text-sm text-muted-foreground text-right">
                    {index + 1}.
                  </div>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Count"
                    value={draft.count}
                    onChange={(e) => updateDraft(index, e.target.value)}
                    className="flex-1"
                  />
                  {drafts.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDraft(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addDraft}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Split
              </Button>
            </div>

            {/* Sum */}
            <div className="flex justify-between text-sm p-3 bg-muted rounded-md">
              <span className="text-muted-foreground">Sum:</span>
              <span
                className={`font-medium tabular-nums ${
                  draftSum !== node.count ? 'text-destructive' : 'text-green-600'
                }`}
              >
                {draftSum} / {node.count}
                {draftSum === node.count && ' ✓'}
              </span>
            </div>

            {draftSum !== node.count && draftSum > 0 && (
              <p className="text-xs text-muted-foreground">
                {draftSum < node.count 
                  ? `${node.count - draftSum} more units needed`
                  : `${draftSum - node.count} units over the limit`
                }
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid}>
              Split Area
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
