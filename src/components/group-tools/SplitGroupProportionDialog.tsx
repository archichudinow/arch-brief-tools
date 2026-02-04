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
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface SplitGroupProportionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Group;
}

interface ProportionItem {
  name: string;
  percent: number;
}

export function SplitGroupProportionDialog({ open, onOpenChange, group }: SplitGroupProportionDialogProps) {
  const splitGroupByProportion = useProjectStore((s) => s.splitGroupByProportion);
  const nodes = useProjectStore((s) => s.nodes);
  const selectGroups = useUIStore((s) => s.selectGroups);

  const [proportions, setProportions] = useState<ProportionItem[]>([
    { name: `${group.name} A`, percent: 10 },
    { name: `${group.name} B`, percent: 30 },
    { name: `${group.name} C`, percent: 60 },
  ]);

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

  const totalPercent = proportions.reduce((sum, p) => sum + p.percent, 0);

  // Calculate how units will be distributed for each proportion
  const previewDistribution = useMemo(() => {
    if (proportions.length < 2 || totalPercent === 0) return [];

    const fractions = proportions.map(p => p.percent / totalPercent);
    
    return proportions.map((prop, groupIdx) => {
      const fraction = fractions[groupIdx];
      const areas = memberNodes.map(node => {
        const allocated = Math.round(node.count * fraction);
        return {
          name: node.name,
          count: allocated,
          areaPerUnit: node.areaPerUnit,
        };
      });
      
      const groupArea = areas.reduce((sum, a) => sum + a.count * a.areaPerUnit, 0);
      
      return {
        name: prop.name,
        percent: prop.percent,
        areas,
        totalArea: groupArea,
      };
    });
  }, [proportions, totalPercent, memberNodes]);

  const addProportion = () => {
    const letter = String.fromCharCode(65 + proportions.length);
    setProportions([...proportions, { name: `${group.name} ${letter}`, percent: 0 }]);
  };

  const removeProportion = (index: number) => {
    if (proportions.length <= 2) return;
    setProportions(proportions.filter((_, i) => i !== index));
  };

  const updateProportion = (index: number, field: keyof ProportionItem, value: string | number) => {
    setProportions(proportions.map((p, i) => 
      i === index ? { ...p, [field]: value } : p
    ));
  };

  const distributeEvenly = () => {
    const evenPercent = Math.floor(100 / proportions.length);
    const remainder = 100 - evenPercent * proportions.length;
    setProportions(proportions.map((p, i) => ({
      ...p,
      percent: i === proportions.length - 1 ? evenPercent + remainder : evenPercent
    })));
  };

  const isValid = proportions.length >= 2 && 
    proportions.every(p => p.name.trim().length > 0 && p.percent > 0) &&
    totalUnits >= proportions.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) {
      toast.error('Each group needs a name and percentage > 0');
      return;
    }

    const newIds = splitGroupByProportion(group.id, proportions);
    if (newIds.length > 0) {
      toast.success(`Split into ${newIds.length} groups`);
      selectGroups(newIds);
      onOpenChange(false);
      resetForm();
    } else {
      toast.error('Failed to split group');
    }
  };

  const resetForm = () => {
    setProportions([
      { name: `${group.name} A`, percent: 10 },
      { name: `${group.name} B`, percent: 30 },
      { name: `${group.name} C`, percent: 60 },
    ]);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Split "{group.name}" by Proportion</DialogTitle>
            <DialogDescription>
              Creates copies of this group with area counts scaled to each proportion.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Group stats */}
            <div className="text-sm text-muted-foreground flex justify-between">
              <span>Areas: <span className="font-medium">{memberNodes.length}</span></span>
              <span>Units: <span className="font-medium">{totalUnits}</span></span>
              <span>Total: <span className="font-medium">{totalArea.toLocaleString()} m²</span></span>
            </div>

            {/* Proportions list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Groups & Proportions</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={distributeEvenly}
                >
                  Distribute Evenly
                </Button>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {proportions.map((prop, i) => {
                  const preview = previewDistribution[i];
                  
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={prop.name}
                        onChange={(e) => updateProportion(i, 'name', e.target.value)}
                        placeholder="Group name"
                        className="flex-1"
                      />
                      <div className="flex items-center gap-1 w-20">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={prop.percent}
                          onChange={(e) => updateProportion(i, 'percent', parseInt(e.target.value) || 0)}
                          className="w-14 text-right"
                        />
                        <span className="text-muted-foreground text-sm">%</span>
                      </div>
                      <span className="text-xs text-muted-foreground w-16 text-right tabular-nums">
                        {preview ? `~${preview.totalArea.toLocaleString()}m²` : '-'}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeProportion(i)}
                        disabled={proportions.length <= 2}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={addProportion}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Group
              </Button>
            </div>

            {/* Total & warning */}
            <div className={`text-xs ${totalPercent === 100 ? 'text-muted-foreground' : 'text-yellow-600'}`}>
              Total: {totalPercent}% {totalPercent !== 100 && '(will be normalized to 100%)'}
            </div>

            {/* Preview table */}
            {previewDistribution.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Preview: Unit distribution</Label>
                <div className="max-h-32 overflow-y-auto border rounded-md">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-1.5 font-medium">Area</th>
                        {previewDistribution.map((g, i) => (
                          <th key={i} className="text-right p-1.5 font-medium truncate max-w-[60px]" title={g.name}>
                            {Math.round(g.percent / totalPercent * 100)}%
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {memberNodes.map((node, i) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="p-1.5 truncate max-w-[100px]" title={node.name}>{node.name}</td>
                          {previewDistribution.map((g, j) => (
                            <td key={j} className="p-1.5 text-right tabular-nums">
                              {g.areas[i]?.count || 0}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid}>
              Split into {proportions.length} Groups
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
