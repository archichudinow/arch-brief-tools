import { useState } from 'react';
import { useProjectStore } from '@/stores';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GROUP_COLORS } from '@/types';
import { toast } from 'sonner';

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
  const createGroup = useProjectStore((s) => s.createGroup);
  const groups = useProjectStore((s) => s.groups);

  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(GROUP_COLORS[0]);

  // Get next available color
  const usedColors = new Set(Object.values(groups).map(g => g.color));
  const nextAvailableColor = GROUP_COLORS.find(c => !usedColors.has(c)) ?? GROUP_COLORS[0];

  const resetForm = () => {
    setName('');
    setSelectedColor(nextAvailableColor);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    createGroup({ name: name.trim(), color: selectedColor });
    toast.success(`Group "${name}" created`);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Group</DialogTitle>
            <DialogDescription>
              Groups organize areas for program management and AI analysis.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Group Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Residential, Office, Retail..."
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {GROUP_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`
                      w-8 h-8 rounded-full transition-all
                      ${selectedColor === color 
                        ? 'ring-2 ring-offset-2 ring-primary scale-110' 
                        : 'hover:scale-105'
                      }
                    `}
                    style={{ backgroundColor: color }}
                    onClick={() => setSelectedColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Create Group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
