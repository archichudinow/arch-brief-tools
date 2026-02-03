import { useState } from 'react';
import { useProjectStore, useUIStore } from '@/stores';
import type { AreaNode } from '@/types';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';

interface AreaNodeItemProps {
  node: AreaNode;
}

export function AreaNodeItem({ node }: AreaNodeItemProps) {
  const getNodeDerived = useProjectStore((s) => s.getNodeDerived);
  const updateNode = useProjectStore((s) => s.updateNode);

  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const selectNodes = useUIStore((s) => s.selectNodes);

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const derived = getNodeDerived(node.id);
  const isSelected = selectedNodeIds.includes(node.id);

  const handleClick = (e: React.MouseEvent) => {
    const append = e.metaKey || e.ctrlKey;
    selectNodes([node.id], append);
  };

  const handleDoubleClick = (field: string, value: string | number) => {
    setEditingField(field);
    setEditValue(String(value));
  };

  const handleEditSubmit = () => {
    if (!editingField) return;

    const updates: Record<string, unknown> = {};
    if (editingField === 'name') {
      updates.name = editValue;
    } else if (editingField === 'areaPerUnit') {
      const num = parseFloat(editValue);
      if (!isNaN(num) && num > 0) updates.areaPerUnit = num;
    } else if (editingField === 'count') {
      const num = parseInt(editValue, 10);
      if (!isNaN(num) && num >= 0) updates.count = num;
    }

    if (Object.keys(updates).length > 0) {
      updateNode(node.id, updates);
    }
    setEditingField(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditSubmit();
    } else if (e.key === 'Escape') {
      setEditingField(null);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors group',
        isSelected
          ? 'bg-primary/10 text-primary'
          : 'hover:bg-muted'
      )}
    >
      {/* Drag Handle (future) */}
      <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-50" />

      {/* Name */}
      {editingField === 'name' ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleEditSubmit}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 px-1 py-0.5 text-sm bg-background border border-input rounded"
          autoFocus
        />
      ) : (
        <span
          onDoubleClick={() => handleDoubleClick('name', node.name)}
          className="flex-1 min-w-0 text-sm font-medium truncate"
        >
          {node.name}
        </span>
      )}

      {/* Area per Unit */}
      {editingField === 'areaPerUnit' ? (
        <input
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleEditSubmit}
          onKeyDown={handleKeyDown}
          className="w-16 px-1 py-0.5 text-sm bg-background border border-input rounded text-right"
          autoFocus
        />
      ) : (
        <span
          onDoubleClick={() => handleDoubleClick('areaPerUnit', node.areaPerUnit)}
          className="text-sm text-muted-foreground tabular-nums"
        >
          {node.areaPerUnit}m²
        </span>
      )}

      <span className="text-muted-foreground text-sm">×</span>

      {/* Count */}
      {editingField === 'count' ? (
        <input
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleEditSubmit}
          onKeyDown={handleKeyDown}
          className="w-12 px-1 py-0.5 text-sm bg-background border border-input rounded text-right"
          autoFocus
        />
      ) : (
        <span
          onDoubleClick={() => handleDoubleClick('count', node.count)}
          className="text-sm tabular-nums"
        >
          {node.count}
        </span>
      )}

      <span className="text-muted-foreground text-sm">=</span>

      {/* Total */}
      <span className="text-sm font-medium tabular-nums w-20 text-right">
        {derived?.totalArea.toLocaleString()} m²
      </span>
    </div>
  );
}
