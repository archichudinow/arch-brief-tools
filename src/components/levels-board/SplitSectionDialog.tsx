import { useState, useMemo } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface SplitSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: string;
}

interface SplitPart {
  id: string;
  levelStart: number;
  levelEnd: number;
  areaAllocation: number;
}

export function SplitSectionDialog({ open, onOpenChange, sectionId }: SplitSectionDialogProps) {
  const sections = useLevelsStore((s) => s.sections);
  const levels = useLevelsStore((s) => s.levels);
  const getSortedLevels = useLevelsStore((s) => s.getSortedLevels);
  const splitSection = useLevelsStore((s) => s.splitSection);
  const clearSectionSelection = useLevelsStore((s) => s.clearSectionSelection);
  
  const section = sections[sectionId];
  const sortedLevels = useMemo(() => getSortedLevels(), [levels]);
  
  // Initialize with two equal parts
  const initialArea = section?.areaAllocation || 0;
  const [parts, setParts] = useState<SplitPart[]>([
    { id: '1', levelStart: section?.levelStart || 0, levelEnd: section?.levelEnd || 0, areaAllocation: Math.floor(initialArea / 2) },
    { id: '2', levelStart: section?.levelStart || 0, levelEnd: section?.levelEnd || 0, areaAllocation: Math.ceil(initialArea / 2) },
  ]);
  
  if (!section) return null;
  
  const totalAllocated = parts.reduce((sum, p) => sum + p.areaAllocation, 0);
  const remaining = section.areaAllocation - totalAllocated;
  
  const handleAddPart = () => {
    const newPart: SplitPart = {
      id: Date.now().toString(),
      levelStart: section.levelStart,
      levelEnd: section.levelEnd,
      areaAllocation: 0,
    };
    setParts([...parts, newPart]);
  };
  
  const handleRemovePart = (id: string) => {
    if (parts.length <= 2) {
      toast.error('Need at least 2 parts to split');
      return;
    }
    setParts(parts.filter(p => p.id !== id));
  };
  
  const handleUpdatePart = (id: string, field: keyof SplitPart, value: number) => {
    setParts(parts.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };
  
  const handleDistributeEvenly = () => {
    const count = parts.length;
    const baseArea = Math.floor(section.areaAllocation / count);
    const remainder = section.areaAllocation % count;
    
    setParts(parts.map((p, i) => ({
      ...p,
      areaAllocation: baseArea + (i < remainder ? 1 : 0),
    })));
  };
  
  const handleSubmit = () => {
    // Validate
    if (parts.length < 2) {
      toast.error('Need at least 2 parts');
      return;
    }
    
    if (Math.abs(remaining) > 0.01) {
      toast.error(`Total allocation must equal ${section.areaAllocation.toLocaleString()}m² (${remaining > 0 ? `${remaining.toLocaleString()}m² unallocated` : `${Math.abs(remaining).toLocaleString()}m² over-allocated`})`);
      return;
    }
    
    // Execute split
    const splits = parts.map(p => ({
      levelStart: p.levelStart,
      levelEnd: p.levelEnd,
      areaAllocation: p.areaAllocation,
    }));
    
    splitSection(sectionId, splits);
    clearSectionSelection();
    toast.success(`Split into ${parts.length} sections`);
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Split Section</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Original section info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-sm font-medium">Original Section</div>
            <div className="text-xs text-muted-foreground mt-1">
              Total Area: {section.areaAllocation.toLocaleString()}m² · 
              Levels: {section.levelStart === section.levelEnd 
                ? `L${section.levelStart}` 
                : `L${section.levelStart} to L${section.levelEnd}`
              }
            </div>
          </div>
          
          {/* Split parts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Split Parts</Label>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleDistributeEvenly}
                >
                  Distribute Evenly
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleAddPart}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Part
                </Button>
              </div>
            </div>
            
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {parts.map((part, index) => (
                  <div 
                    key={part.id}
                    className="flex items-center gap-2 p-2 border rounded-md bg-card"
                  >
                    <span className="text-xs text-muted-foreground w-6">
                      #{index + 1}
                    </span>
                    
                    {/* Level selection */}
                    <div className="flex items-center gap-1">
                      <Label className="text-xs w-6">L:</Label>
                      <select
                        className="h-8 w-16 text-xs border rounded px-1"
                        value={part.levelStart}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          handleUpdatePart(part.id, 'levelStart', val);
                          if (val > part.levelEnd) {
                            handleUpdatePart(part.id, 'levelEnd', val);
                          }
                        }}
                      >
                        {sortedLevels.map(l => (
                          <option key={l.id} value={l.order}>
                            {l.order >= 0 ? `L${l.order}` : `B${Math.abs(l.order)}`}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-muted-foreground">to</span>
                      <select
                        className="h-8 w-16 text-xs border rounded px-1"
                        value={part.levelEnd}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          handleUpdatePart(part.id, 'levelEnd', val);
                          if (val < part.levelStart) {
                            handleUpdatePart(part.id, 'levelStart', val);
                          }
                        }}
                      >
                        {sortedLevels.map(l => (
                          <option key={l.id} value={l.order}>
                            {l.order >= 0 ? `L${l.order}` : `B${Math.abs(l.order)}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Area input */}
                    <div className="flex items-center gap-1 flex-1">
                      <Label className="text-xs">Area:</Label>
                      <Input
                        type="number"
                        min="0"
                        className="h-8 text-xs"
                        value={part.areaAllocation}
                        onChange={(e) => handleUpdatePart(
                          part.id, 
                          'areaAllocation', 
                          parseInt(e.target.value) || 0
                        )}
                      />
                      <span className="text-xs text-muted-foreground">m²</span>
                    </div>
                    
                    {/* Remove button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleRemovePart(part.id)}
                      disabled={parts.length <= 2}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          
          {/* Allocation summary */}
          <div className={`p-3 rounded-lg ${Math.abs(remaining) < 0.01 ? 'bg-green-500/10' : 'bg-amber-500/10'}`}>
            <div className="flex justify-between text-sm">
              <span>Allocated:</span>
              <span className="font-medium">{totalAllocated.toLocaleString()}m²</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Original:</span>
              <span className="font-medium">{section.areaAllocation.toLocaleString()}m²</span>
            </div>
            {Math.abs(remaining) > 0.01 && (
              <div className={`flex justify-between text-sm mt-1 ${remaining > 0 ? 'text-amber-600' : 'text-destructive'}`}>
                <span>{remaining > 0 ? 'Remaining:' : 'Over:'}</span>
                <span className="font-medium">{Math.abs(remaining).toLocaleString()}m²</span>
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={Math.abs(remaining) > 0.01}
          >
            Split Section
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
