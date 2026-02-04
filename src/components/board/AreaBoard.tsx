import { useRef, useState, useCallback, useEffect } from 'react';
import { useProjectStore, useUIStore } from '@/stores';
import { useGridLayout, snapToGrid, findGroupAtPosition, GROUP_PADDING, GROUP_HEADER_HEIGHT, UNUSED_AREAS_GROUP_ID } from './useGridLayout';
import { GroupContainer } from './GroupContainer';
import { ZoomIn, ZoomOut, Maximize2, Move, Plus, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateAreaDialog } from '@/components/area-tools/CreateAreaDialog';
import { CreateGroupDialog } from '@/components/group-tools/CreateGroupDialog';

// ============================================
// MAIN BOARD COMPONENT
// ============================================

export function AreaBoard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  // Store absolute positions for groups (not offsets from layout)
  const [groupPositions, setGroupPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [groupSizeOverrides, setGroupSizeOverrides] = useState<Record<string, { width?: number; height?: number }>>({});
  const [areaOffsets, setAreaOffsets] = useState<Record<string, { x: number; y: number }>>({});
  // Store initial offset when drag starts - for reverting on collision
  const [dragStartOffsets, setDragStartOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  // Dialogs
  const [showCreateAreaDialog, setShowCreateAreaDialog] = useState(false);
  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);

  // Store data
  const nodes = useProjectStore((s) => s.nodes);
  const groups = useProjectStore((s) => s.groups);
  const assignToGroup = useProjectStore((s) => s.assignToGroup);
  const removeFromGroup = useProjectStore((s) => s.removeFromGroup);
  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const selectedGroupIds = useUIStore((s) => s.selectedGroupIds);
  const selectNodes = useUIStore((s) => s.selectNodes);
  const selectGroups = useUIStore((s) => s.selectGroups);

  // Measure container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width: width - 32, height: height - 32 }); // Padding
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Calculate layout with size overrides
  const layout = useGridLayout(nodes, groups, dimensions.width, dimensions.height, groupSizeOverrides);

  // Initialize positions for new groups - store them so they become independent
  useEffect(() => {
    const newPositions: Record<string, { x: number; y: number }> = {};
    let hasNew = false;
    
    for (const group of layout.groups) {
      if (!groupPositions[group.id]) {
        newPositions[group.id] = { x: group.x, y: group.y };
        hasNew = true;
      }
    }
    
    if (hasNew) {
      setGroupPositions((prev) => ({ ...prev, ...newPositions }));
    }
  }, [layout.groups, groupPositions]);

  // Handle node selection
  const handleSelectNode = useCallback(
    (id: string, append: boolean) => {
      console.log('handleSelectNode called:', { id, append, selectedNodeIds });
      const isSelected = selectedNodeIds.includes(id);
      if (append) {
        selectNodes([id], true);
      } else if (isSelected && selectedNodeIds.length === 1) {
        selectNodes([]);
      } else {
        // selectNodes already clears groups when append=false
        selectNodes([id]);
      }
    },
    [selectedNodeIds, selectNodes]
  );

  // Handle group selection
  const handleSelectGroup = useCallback(
    (groupId: string, append: boolean) => {
      // Don't allow selecting the virtual "Unused Areas" group
      if (groupId === UNUSED_AREAS_GROUP_ID) return;
      
      console.log('handleSelectGroup called:', { groupId, append, selectedGroupIds });
      const isSelected = selectedGroupIds.includes(groupId);
      if (append) {
        selectGroups([groupId], true);
      } else if (isSelected && selectedGroupIds.length === 1) {
        selectGroups([]);
      } else {
        // selectGroups already clears nodes when append=false
        selectGroups([groupId]);
      }
    },
    [selectedGroupIds, selectGroups]
  );

  // Handle group dragging - update absolute position
  const handleDragGroup = useCallback(
    (groupId: string, deltaX: number, deltaY: number, initialX?: number, initialY?: number) => {
      setGroupPositions((prev) => {
        // Use existing position, or initial layout position if first drag
        const current = prev[groupId] || { x: initialX ?? 0, y: initialY ?? 0 };
        return {
          ...prev,
          [groupId]: {
            x: current.x + deltaX,
            y: current.y + deltaY,
          },
        };
      });
    },
    []
  );

  // Handle area drag start - store initial offset for potential revert
  const handleDragAreaStart = useCallback(
    (areaId: string) => {
      setDragStartOffsets((prev) => ({
        ...prev,
        [areaId]: areaOffsets[areaId] || { x: 0, y: 0 },
      }));
    },
    [areaOffsets]
  );

  // Handle area dragging within groups
  const handleDragArea = useCallback(
    (areaId: string, deltaX: number, deltaY: number) => {
      setAreaOffsets((prev) => {
        const current = prev[areaId] || { x: 0, y: 0 };
        return {
          ...prev,
          [areaId]: {
            x: current.x + deltaX,
            y: current.y + deltaY,
          },
        };
      });
    },
    []
  );

  // Handle group resize
  const handleResizeGroup = useCallback(
    (groupId: string, newWidth: number, newHeight: number) => {
      setGroupSizeOverrides((prev) => ({
        ...prev,
        [groupId]: {
          width: snapToGrid(Math.max(100, newWidth)),
          height: snapToGrid(Math.max(60, newHeight)),
        },
      }));
    },
    []
  );

  // Check if two rectangles overlap
  const rectsOverlap = (
    r1: { x: number; y: number; width: number; height: number },
    r2: { x: number; y: number; width: number; height: number }
  ) => {
    return !(
      r1.x + r1.width <= r2.x ||
      r2.x + r2.width <= r1.x ||
      r1.y + r1.height <= r2.y ||
      r2.y + r2.height <= r1.y
    );
  };

  // Handle area drop - snap to grid and detect group membership
  const handleDropArea = useCallback(
    (areaId: string, clientX: number, clientY: number, currentGroupId: string | null) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      
      // Get the wrapper's bounding rect (the untransformed container)
      const wrapperRect = wrapper.getBoundingClientRect();
      
      // Position relative to the wrapper
      const relativeX = clientX - wrapperRect.left;
      const relativeY = clientY - wrapperRect.top;
      
      // The inner canvas has transform: translate(pan.x, pan.y) scale(scale)
      // To get canvas coords: canvasPos = (screenRelativePos - pan) / scale
      const dropX = (relativeX - pan.x) / scale;
      const dropY = (relativeY - pan.y) / scale;
      
      // Find which group (if any) the area was dropped on
      const targetGroupId = findGroupAtPosition(dropX, dropY, layout.groups, groupPositions);
      
      // Normalize group IDs: treat UNUSED_AREAS_GROUP_ID as null (ungrouped)
      const normalizedCurrentGroupId = currentGroupId === UNUSED_AREAS_GROUP_ID ? null : currentGroupId;
      const normalizedTargetGroupId = targetGroupId === UNUSED_AREAS_GROUP_ID ? null : targetGroupId;
      
      // If moving between groups or in/out of groups
      if (normalizedTargetGroupId !== normalizedCurrentGroupId) {
        // Get the source group's children before removing (to reset their offsets)
        const sourceGroup = currentGroupId 
          ? layout.groups.find((g) => g.id === currentGroupId) 
          : null;
        const sourceGroupChildIds = sourceGroup 
          ? sourceGroup.children.map((c) => c.id) 
          : [];
        
        // Remove from current real group if it has one (not the unused group)
        if (normalizedCurrentGroupId) {
          removeFromGroup(normalizedCurrentGroupId, [areaId]);
          
          // Clear size override for source group so it shrinks to fit
          setGroupSizeOverrides((prev) => {
            const next = { ...prev };
            delete next[normalizedCurrentGroupId];
            return next;
          });
        }
        
        // Add to new real group if dropped on one (not the unused group)
        if (normalizedTargetGroupId) {
          assignToGroup(normalizedTargetGroupId, [areaId]);
          
          // Clear size override for the target group so it auto-resizes to fit new content
          setGroupSizeOverrides((prev) => {
            const next = { ...prev };
            delete next[normalizedTargetGroupId];
            return next;
          });
        }
        
        // Clear size override for unused group if involved
        if (currentGroupId === UNUSED_AREAS_GROUP_ID || targetGroupId === UNUSED_AREAS_GROUP_ID) {
          setGroupSizeOverrides((prev) => {
            const next = { ...prev };
            delete next[UNUSED_AREAS_GROUP_ID];
            return next;
          });
        }
        
        // Reset offsets: for the moved area, AND for all remaining areas in source group
        // This prevents overlapping when layout recalculates positions
        setAreaOffsets((prev) => {
          const next = { ...prev };
          // Reset the moved area
          next[areaId] = { x: 0, y: 0 };
          // Reset all areas that were in the source group (they'll be re-laid out)
          for (const childId of sourceGroupChildIds) {
            if (childId !== areaId) {
              next[childId] = { x: 0, y: 0 };
            }
          }
          return next;
        });
      } else if (currentGroupId) {
        // Same group - check for collisions before allowing the move
        const group = layout.groups.find((g) => g.id === currentGroupId);
        if (!group) return;
        
        // Find the dragged area's layout info
        const draggedRect = group.children.find((c) => c.id === areaId);
        if (!draggedRect) return;
        
        setAreaOffsets((prev) => {
          const current = prev[areaId] || { x: 0, y: 0 };
          const snappedOffset = {
            x: snapToGrid(current.x),
            y: snapToGrid(current.y),
          };
          
          // Calculate the area's new position within the group
          const newX = draggedRect.x + snappedOffset.x;
          const newY = draggedRect.y + snappedOffset.y;
          
          // Check bounds - area must stay within group content area
          const minX = GROUP_PADDING;
          const minY = GROUP_HEADER_HEIGHT + GROUP_PADDING;
          const maxX = group.width - GROUP_PADDING - draggedRect.width;
          const maxY = group.height - GROUP_PADDING - draggedRect.height;
          
          if (newX < minX || newX > maxX || newY < minY || newY > maxY) {
            // Out of bounds - revert to initial position
            return {
              ...prev,
              [areaId]: dragStartOffsets[areaId] || { x: 0, y: 0 },
            };
          }
          
          // Check collision with other areas in the group
          const newRect = {
            x: newX,
            y: newY,
            width: draggedRect.width,
            height: draggedRect.height,
          };
          
          for (const otherRect of group.children) {
            if (otherRect.id === areaId) continue;
            
            const otherOffset = prev[otherRect.id] || { x: 0, y: 0 };
            const otherPos = {
              x: otherRect.x + otherOffset.x,
              y: otherRect.y + otherOffset.y,
              width: otherRect.width,
              height: otherRect.height,
            };
            
            if (rectsOverlap(newRect, otherPos)) {
              // Collision detected - revert to initial position
              return {
                ...prev,
                [areaId]: dragStartOffsets[areaId] || { x: 0, y: 0 },
              };
            }
          }
          
          // No collision and within bounds - keep the snapped position
          return {
            ...prev,
            [areaId]: snappedOffset,
          };
        });
      } else {
        // Ungrouped area - just snap the offset (no collision detection needed)
        setAreaOffsets((prev) => {
          const current = prev[areaId] || { x: 0, y: 0 };
          return {
            ...prev,
            [areaId]: { 
              x: snapToGrid(current.x), 
              y: snapToGrid(current.y) 
            },
          };
        });
      }
    },
    [layout.groups, groupPositions, pan, scale, assignToGroup, removeFromGroup, dragStartOffsets]
  );

  // Handle canvas mouse events - middle button for pan
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button (button === 1) for panning - works anywhere
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      }
    },
    [isPanning, panStart]
  );

  const handleCanvasMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || isPanning) {
      setIsPanning(false);
    }
  }, [isPanning]);

  // Mouse wheel zoom - use native event listener to properly prevent default
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((s) => Math.min(Math.max(s * delta, 0.3), 3));
    };
    
    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => wrapper.removeEventListener('wheel', handleWheel);
  }, []);

  // Zoom controls
  const handleZoomIn = () => setScale((s) => Math.min(s * 1.2, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s / 1.2, 0.3));
  const handleResetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    setGroupPositions({});
    setGroupSizeOverrides({});
    setAreaOffsets({});
  };

  // Clear selection when clicking empty area
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      selectNodes([]);
      selectGroups([]);
    }
  };

  return (
    <div ref={containerRef} className="h-full w-full relative overflow-hidden bg-muted/30 select-none">
      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-50 flex items-center gap-1 bg-card/90 backdrop-blur rounded-lg border border-border p-1 shadow-sm">
        <Button variant="ghost" size="icon" onClick={() => setShowCreateAreaDialog(true)} title="Add area">
          <Plus className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setShowCreateGroupDialog(true)} title="Add group">
          <FolderPlus className="w-4 h-4" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button variant="ghost" size="icon" onClick={handleZoomOut} title="Zoom out">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground w-12 text-center tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <Button variant="ghost" size="icon" onClick={handleZoomIn} title="Zoom in">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button variant="ghost" size="icon" onClick={handleResetView} title="Reset view">
          <Maximize2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats overlay */}
      <div className="absolute top-3 left-3 z-50 bg-card/90 backdrop-blur rounded-lg border border-border px-3 py-2 shadow-sm">
        <div className="text-xs text-muted-foreground">Total Area</div>
        <div className="text-lg font-semibold tabular-nums">
          {layout.totalArea.toLocaleString()}m²
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {layout.groups.length} groups · {Object.keys(nodes).length} areas
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={wrapperRef}
        className={`absolute inset-4 rounded-lg ${isPanning ? 'cursor-grabbing' : 'cursor-default'}`}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={() => { setIsPanning(false); }}
        onClick={handleCanvasClick}
        onContextMenu={(e) => e.button === 1 && e.preventDefault()}
        onAuxClick={(e) => e.button === 1 && e.preventDefault()}
      >
        {/* Dotted grid background - pointer-events-none so clicks go through */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, hsl(var(--muted-foreground) / 0.2) 1px, transparent 1px)`,
            backgroundSize: `${16 * scale}px ${16 * scale}px`,
            backgroundPosition: `${pan.x % (16 * scale)}px ${pan.y % (16 * scale)}px`,
          }}
        />
        <div
          ref={canvasRef}
          className="relative w-full h-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Group containers */}
          {layout.groups.map((group) => {
            // Use stored position if exists, otherwise use layout position
            const pos = groupPositions[group.id] || { x: group.x, y: group.y };
            return (
              <GroupContainer
                key={group.id}
                group={group}
                selectedNodeIds={selectedNodeIds}
                isGroupSelected={selectedGroupIds.includes(group.id)}
                onSelectNode={handleSelectNode}
                onSelectGroup={handleSelectGroup}
                onDragGroup={handleDragGroup}
                onDragAreaStart={handleDragAreaStart}
                onDragArea={handleDragArea}
                onResizeGroup={handleResizeGroup}
                onDropArea={handleDropArea}
                areaOffsets={areaOffsets}
                offsetX={pos.x}
                offsetY={pos.y}
                scale={scale}
                useAbsolutePosition={!!groupPositions[group.id]}
                />
            );
          })}

          {/* Empty state */}
          {Object.keys(nodes).length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Move className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">No areas yet</p>
                <p className="text-sm mt-1">Create areas in the left panel</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <CreateAreaDialog open={showCreateAreaDialog} onOpenChange={setShowCreateAreaDialog} />
      <CreateGroupDialog open={showCreateGroupDialog} onOpenChange={setShowCreateGroupDialog} />
    </div>
  );
}
