import { useState, useRef, useMemo } from 'react';
import { GripHorizontal, Inbox } from 'lucide-react';
import type { GroupLayout } from './useGridLayout';
import { AreaCard } from './AreaCard';
import { GRID_SIZE, snapToGrid, GROUP_PADDING, GROUP_HEADER_HEIGHT, UNUSED_AREAS_GROUP_ID } from './useGridLayout';

interface GroupContainerProps {
  group: GroupLayout;
  selectedNodeIds: string[];
  isGroupSelected?: boolean;
  onSelectNode: (id: string, append: boolean, rangeSelect?: boolean) => void;
  onSelectGroup?: (groupId: string, append: boolean) => void;
  onDragGroup: (groupId: string, deltaX: number, deltaY: number, initialX?: number, initialY?: number) => void;
  onResizeGroup: (groupId: string, width: number, height: number) => void;
  onDragAreaStart?: (areaId: string) => void;
  onDragArea?: (areaId: string, deltaX: number, deltaY: number) => void;
  onDropArea?: (areaId: string, x: number, y: number, groupId: string | null) => void;
  onOpenContainer?: (containerId: string) => void;
  isNodeContainer?: (nodeId: string) => boolean;
  areaOffsets?: Record<string, { x: number; y: number }>;
  offsetX?: number;
  offsetY?: number;
  scale?: number;
  /** When true, offsetX/Y are absolute positions, not offsets from layout */
  useAbsolutePosition?: boolean;
}

export function GroupContainer({
  group,
  selectedNodeIds,
  isGroupSelected = false,
  onSelectNode,
  onSelectGroup,
  onDragGroup,
  onResizeGroup,
  onDragAreaStart,
  onDragArea,
  onDropArea,
  onOpenContainer,
  isNodeContainer,
  areaOffsets = {},
  offsetX = 0,
  offsetY = 0,
  scale = 1,
  useAbsolutePosition = false,
}: GroupContainerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<'right' | 'bottom' | 'corner' | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const sizeStartRef = useRef({ width: 0, height: 0 });
  
  // Check if this is the special "Unused Areas" group
  const isUnusedGroup = group.id === UNUSED_AREAS_GROUP_ID;

  // Calculate minimum size based on children positions and sizes
  const minSize = useMemo(() => {
    if (group.children.length === 0) {
      return { width: 150, height: 100 };
    }

    let maxRight = 0;
    let maxBottom = 0;

    for (const child of group.children) {
      const offset = areaOffsets[child.id] || { x: 0, y: 0 };
      const right = child.x + offset.x + child.width;
      const bottom = child.y + offset.y + child.height;
      maxRight = Math.max(maxRight, right);
      maxBottom = Math.max(maxBottom, bottom);
    }

    // Add padding to account for group chrome
    return {
      width: Math.max(150, maxRight + GROUP_PADDING),
      height: Math.max(100, maxBottom + GROUP_PADDING + GROUP_HEADER_HEIGHT),
    };
  }, [group.children, areaOffsets]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only handle left mouse button - let middle button through for panning
    if (e.button !== 0) return;
    // Only start drag on the header grip
    if (!(e.target as HTMLElement).closest('[data-grip]')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    
    // Calculate initial position (layout position or absolute)
    const initialX = useAbsolutePosition ? offsetX : group.x + offsetX;
    const initialY = useAbsolutePosition ? offsetY : group.y + offsetY;
    let isFirstMove = true;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - dragStartRef.current.x) / scale;
      const deltaY = (moveEvent.clientY - dragStartRef.current.y) / scale;
      // Pass initial position on first move so it can be stored
      if (isFirstMove) {
        onDragGroup(group.id, deltaX, deltaY, initialX, initialY);
        isFirstMove = false;
      } else {
        onDragGroup(group.id, deltaX, deltaY);
      }
      dragStartRef.current = { x: moveEvent.clientX, y: moveEvent.clientY };
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeStart = (e: React.MouseEvent, direction: 'right' | 'bottom' | 'corner') => {
    // Only handle left mouse button
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(direction);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    sizeStartRef.current = { width: group.width, height: group.height };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - dragStartRef.current.x) / scale;
      const deltaY = (moveEvent.clientY - dragStartRef.current.y) / scale;
      
      let newWidth = sizeStartRef.current.width;
      let newHeight = sizeStartRef.current.height;

      if (direction === 'right' || direction === 'corner') {
        newWidth = snapToGrid(Math.max(minSize.width, sizeStartRef.current.width + deltaX));
      }
      if (direction === 'bottom' || direction === 'corner') {
        newHeight = snapToGrid(Math.max(minSize.height, sizeStartRef.current.height + deltaY));
      }

      onResizeGroup(group.id, newWidth, newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Apply position: either absolute or offset from layout position
  const adjustedX = useAbsolutePosition ? offsetX : group.x + offsetX;
  const adjustedY = useAbsolutePosition ? offsetY : group.y + offsetY;

  // Handle click on group to select it
  const handleGroupClick = (e: React.MouseEvent) => {
    // Only handle clicks on the group itself, not on area cards
    if ((e.target as HTMLElement).closest('[data-area-card]')) return;
    e.stopPropagation();
    onSelectGroup?.(group.id, e.ctrlKey || e.metaKey);
  };

  return (
    <div
      data-group-container
      className={`
        absolute rounded-lg
        ${isUnusedGroup ? 'border border-dashed' : 'border'}
        ${!isUnusedGroup ? 'hover:ring-2 hover:ring-primary/50' : ''}
        ${isGroupSelected && !isUnusedGroup ? 'ring-2 ring-primary shadow-lg z-10' : 'shadow-sm'}
        ${isDragging ? 'shadow-xl z-50 cursor-grabbing' : 'transition-shadow'}
        ${isResizing ? 'z-50' : ''}
      `}
      style={{
        left: adjustedX,
        top: adjustedY,
        width: group.width,
        height: group.height,
        borderColor: isGroupSelected && !isUnusedGroup ? 'hsl(var(--primary))' : group.color,
        backgroundColor: isUnusedGroup ? `${group.color}05` : `${group.color}08`,
      }}
      onMouseDown={handleMouseDown}
      onClick={handleGroupClick}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 rounded-t-md cursor-grab"
        style={{ 
          height: GROUP_HEADER_HEIGHT,
          backgroundColor: isUnusedGroup ? `${group.color}15` : `${group.color}25`,
          borderBottom: isUnusedGroup ? `1px dashed ${group.color}40` : undefined,
        }}
        data-grip
      >
        {isUnusedGroup ? (
          <Inbox
            className="w-4 h-4 shrink-0"
            style={{ color: group.color }}
            data-grip
          />
        ) : (
          <GripHorizontal
            className="w-4 h-4 shrink-0"
            style={{ color: group.color }}
            data-grip
          />
        )}
        <span
          className={`text-sm font-medium truncate ${isUnusedGroup ? 'italic' : ''}`}
          style={{ color: group.color }}
        >
          {group.name}
        </span>
        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
          {group.totalArea > 0 ? `${group.totalArea.toLocaleString()}m²` : 'Empty'}
        </span>
      </div>

      {/* Dotted pattern background - helps with area placement */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          top: GROUP_HEADER_HEIGHT,
          left: GROUP_PADDING,
          right: GROUP_PADDING,
          bottom: GROUP_PADDING,
          backgroundImage: `radial-gradient(circle, ${group.color}30 1px, transparent 1px)`,
          backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
          backgroundPosition: '0 0',
        }}
      />

      {/* Children (area cards) - positioned relative to container */}
      {group.children.map((rect) => {
        const areaOffset = areaOffsets[rect.id] || { x: 0, y: 0 };
        const isContainer = isNodeContainer?.(rect.id) ?? false;
        return (
          <AreaCard
            key={rect.id}
            rect={{
              ...rect,
              // Cards are already positioned relative to group content area
              x: rect.x,
              y: rect.y,
            }}
            isSelected={selectedNodeIds.includes(rect.id)}
            isContainer={isContainer}
            onSelect={onSelectNode}
            onDoubleClick={onOpenContainer}
            onDragStart={onDragAreaStart}
            onDrag={onDragArea}
            onDrop={onDropArea}
            groupId={group.id}
            offsetX={areaOffset.x}
            offsetY={areaOffset.y}
            scale={scale}
          />
        );
      })}

      {/* Resize handle - right */}
      <div
        className="absolute top-10 right-0 w-2 cursor-ew-resize hover:bg-primary/20 transition-colors"
        style={{ bottom: 8 }}
        onMouseDown={(e) => handleResizeStart(e, 'right')}
      />

      {/* Resize handle - bottom */}
      <div
        className="absolute bottom-0 left-0 h-2 cursor-ns-resize hover:bg-primary/20 transition-colors"
        style={{ right: 8 }}
        onMouseDown={(e) => handleResizeStart(e, 'bottom')}
      />

      {/* Resize handle - corner */}
      <div
        className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize hover:bg-primary/30 transition-colors rounded-tl"
        style={{ backgroundColor: `${group.color}30` }}
        onMouseDown={(e) => handleResizeStart(e, 'corner')}
      />
    </div>
  );
}
