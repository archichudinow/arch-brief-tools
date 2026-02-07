import { useState } from 'react';
import { useLevelsStore } from '@/stores';
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

interface CreateLevelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestedOrder?: number;
}

export function CreateLevelDialog({ open, onOpenChange, suggestedOrder = 0 }: CreateLevelDialogProps) {
  const createLevel = useLevelsStore((s) => s.createLevel);
  const levels = useLevelsStore((s) => s.levels);

  const [name, setName] = useState('');
  const [order, setOrder] = useState(suggestedOrder.toString());
  const [height, setHeight] = useState('3.5');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setName('');
    setOrder(suggestedOrder.toString());
    setHeight('3.5');
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    const orderNum = parseInt(order, 10);
    if (isNaN(orderNum)) {
      newErrors.order = 'Invalid order number';
    }

    // Check for duplicate order
    const existingOrders = Object.values(levels).map(l => l.order);
    if (existingOrders.includes(orderNum)) {
      newErrors.order = 'A level already exists at this position';
    }

    const heightNum = parseFloat(height);
    if (isNaN(heightNum) || heightNum <= 0) {
      newErrors.height = 'Must be greater than 0';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    createLevel({
      name: name.trim(),
      order: orderNum,
      height: heightNum,
    });

    resetForm();
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Building Level</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Level Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Ground Floor, Level 1, Basement"
                autoFocus
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="order">Level Order</Label>
                <Input
                  id="order"
                  type="number"
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  0 = ground, negative = basement
                </p>
                {errors.order && (
                  <p className="text-xs text-destructive">{errors.order}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="height">Floor Height (m)</Label>
                <Input
                  id="height"
                  type="number"
                  step="0.1"
                  min="0"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="3.5"
                />
                {errors.height && (
                  <p className="text-xs text-destructive">{errors.height}</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Level</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
