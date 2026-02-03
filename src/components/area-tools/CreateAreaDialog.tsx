import { useState } from 'react';
import { useProjectStore } from '@/stores';
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

interface CreateAreaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAreaDialog({ open, onOpenChange }: CreateAreaDialogProps) {
  const createNode = useProjectStore((s) => s.createNode);

  const [name, setName] = useState('');
  const [areaPerUnit, setAreaPerUnit] = useState('');
  const [count, setCount] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setName('');
    setAreaPerUnit('');
    setCount('');
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    const areaNum = parseFloat(areaPerUnit);
    if (isNaN(areaNum) || areaNum <= 0) {
      newErrors.areaPerUnit = 'Must be greater than 0';
    }

    const countNum = parseInt(count, 10);
    if (isNaN(countNum) || countNum < 1) {
      newErrors.count = 'Must be at least 1';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    createNode({
      name: name.trim(),
      areaPerUnit: areaNum,
      count: countNum,
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
          <DialogTitle>Create Area</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Flat, Office, Retail"
                autoFocus
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="areaPerUnit">Area per Unit (m²)</Label>
                <Input
                  id="areaPerUnit"
                  type="number"
                  step="0.1"
                  min="0"
                  value={areaPerUnit}
                  onChange={(e) => setAreaPerUnit(e.target.value)}
                  placeholder="80"
                />
                {errors.areaPerUnit && (
                  <p className="text-xs text-destructive">{errors.areaPerUnit}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="count">Count</Label>
                <Input
                  id="count"
                  type="number"
                  min="0"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  placeholder="40"
                />
                {errors.count && (
                  <p className="text-xs text-destructive">{errors.count}</p>
                )}
              </div>
            </div>

            {areaPerUnit && count && !errors.areaPerUnit && !errors.count && (
              <div className="p-3 bg-muted rounded-md">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Area:</span>
                  <span className="font-medium">
                    {(parseFloat(areaPerUnit) * parseInt(count, 10)).toLocaleString()} m²
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
