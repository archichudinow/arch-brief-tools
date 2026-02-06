import { useMemo, useState, useRef } from 'react';
import { useTheme } from 'next-themes';
import type { LayoutRect } from './useGridLayout';
import { lightenColor, darkenColor } from './useGridLayout';

interface AreaCardProps {
  rect: LayoutRect;
  isSelected: boolean;
  isDragging?: boolean;
  onSelect: (id: string, append: boolean, rangeSelect?: boolean) => void;
  onDragStart?: (id: string) => void;
  onDrag?: (id: string, deltaX: number, deltaY: number) => void;
  onDrop?: (id: string, x: number, y: number, currentGroupId: string | null) => void;
  groupId?: string | null;
  offsetX?: number;
  offsetY?: number;
  scale?: number;
}

// ============================================
// COMPONENT
// ============================================

export function AreaCard({ 
  rect, 
  isSelected, 
  isDragging: isDraggingProp, 
  onSelect,
  onDragStart,
  onDrag,
  onDrop,
  groupId,
  offsetX = 0,
  offsetY = 0,
  scale = 1,
}: AreaCardProps) {
  const { id, x, y, width, height, area, name, count, areaPerUnit, groupColor, groupId: rectGroupId } = rect;
  // Use prop groupId if provided, otherwise fall back to rect.groupId
  const effectiveGroupId = groupId !== undefined ? groupId : rectGroupId;
  const [isDragging, setIsDragging] = useState(false);
  const hasDraggedRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  // Calculate styles - adapt to dark/light mode
  const bgColor = useMemo(() => {
    if (groupColor) {
      return isDarkMode ? darkenColor(groupColor, 0.6) : lightenColor(groupColor, 0.7);
    }
    return 'hsl(var(--muted))';
  }, [groupColor, isDarkMode]);

  const borderColor = useMemo(() => {
    if (isSelected) return 'hsl(var(--primary))';
    if (groupColor) return groupColor;
    return 'hsl(var(--border))';
  }, [groupColor, isSelected]);

  const handleClick = (e: React.MouseEvent) => {
    // Only handle click if we didn't just finish dragging
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    e.stopPropagation();
    // Shift = range selection (select all between), Ctrl/Cmd = append to selection
    const rangeSelect = e.shiftKey;
    const append = e.ctrlKey || e.metaKey;
    onSelect(id, append, rangeSelect);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only handle left mouse button - let middle button through for panning
    if (e.button !== 0) return;
    // Only drag if onDrag is provided
    if (!onDrag) return;
    if ((e.target as HTMLElement).closest('button')) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    
    // Notify parent that drag is starting - to store initial position
    onDragStart?.(id);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - dragStartRef.current.x) / scale;
      const deltaY = (moveEvent.clientY - dragStartRef.current.y) / scale;
      
      // Mark as dragged if moved more than 3px
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        hasDraggedRef.current = true;
      }
      
      onDrag(id, deltaX, deltaY);
      dragStartRef.current = { x: moveEvent.clientX, y: moveEvent.clientY };
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      
      // Only trigger drop if we actually dragged
      if (onDrop && hasDraggedRef.current) {
        onDrop(id, upEvent.clientX, upEvent.clientY, effectiveGroupId);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Apply position with offset
  const finalX = x + offsetX;
  const finalY = y + offsetY;
  const draggable = !!onDrag;
  
  // Only show labels for areas >= 10 sqm
  const showLabels = area >= 10;
  // Show full name for areas >= 10 sqm, abbreviation for smaller
  const showNameLabel = area >= 10;
  const showAbbreviation = area < 10;
  // Get first 2 letters for small areas
  const abbreviation = name.slice(0, 2).toUpperCase();

  // Simple color-filled card
  return (
    <div
      ref={cardRef}
      data-area-card
      className={`
        absolute rounded
        hover:ring-2 hover:ring-primary/50
        ${isSelected ? 'ring-2 ring-primary shadow-lg z-10' : ''}
        ${isDragging || isDraggingProp ? 'opacity-90 shadow-xl z-50' : 'transition-all duration-150'}
        ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
      `}
      style={{
        left: finalX,
        top: finalY,
        width,
        height,
        backgroundColor: bgColor,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor,
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      title={`${name}\n${count} × ${areaPerUnit.toLocaleString()}m² = ${area.toLocaleString()}m²`}
    >
      {/* Area name label - top left corner for large areas */}
      {showNameLabel && (
        <div 
          className="absolute top-0.5 left-1 text-left select-none pointer-events-none truncate"
          style={{ color: borderColor, maxWidth: width - 8 }}
        >
          <div className="text-[6px] font-medium leading-tight opacity-80">
            {name}
          </div>
        </div>
      )}
      {/* Abbreviation for small areas (<10 sqm) - centered */}
      {showAbbreviation && (
        <div 
          className="absolute inset-0 flex items-center justify-center select-none pointer-events-none"
          style={{ color: borderColor }}
        >
          <div className="text-[6px] font-bold leading-tight opacity-80">
            {abbreviation}
          </div>
        </div>
      )}
      {/* Area and quantity label - bottom right corner */}
      {showLabels && (
        <div 
          className="absolute bottom-0.5 right-1 text-right select-none pointer-events-none"
          style={{ color: borderColor }}
        >
          <div className="text-[6px] font-medium leading-tight opacity-80">
            {count > 1 && <span>×{count} </span>}
            {area.toLocaleString()}m²
          </div>
        </div>
      )}
    </div>
  );
}
