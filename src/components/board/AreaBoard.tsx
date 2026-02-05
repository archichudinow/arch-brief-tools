import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useProjectStore, useUIStore } from '@/stores';
import { useGridLayout, snapToGrid, findGroupAtPosition, GROUP_PADDING, GROUP_HEADER_HEIGHT, UNUSED_AREAS_GROUP_ID, type LayoutRect } from './useGridLayout';
import type { AreaNode, UUID } from '@/types';
import { GroupContainer } from './GroupContainer';
import { BoardComment } from './BoardComment';
import { ZoomIn, ZoomOut, Maximize2, Move, Plus, FolderPlus, MessageSquare, MousePointer2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateAreaDialog } from '@/components/area-tools/CreateAreaDialog';
import { CreateGroupDialog } from '@/components/group-tools/CreateGroupDialog';

// ============================================
// SELECTION BOX TYPES
// ============================================

interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

// ============================================
// MAIN BOARD COMPONENT
// ============================================

export function AreaBoard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  // Store initial offset when drag starts - for reverting on collision
  const [dragStartOffsets, setDragStartOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  // Selection box state
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  // Dialogs
  const [showCreateAreaDialog, setShowCreateAreaDialog] = useState(false);
  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);

  // Store data - project store (persisted)
  const rawNodes = useProjectStore((s) => s.nodes);
  const groups = useProjectStore((s) => s.groups);
  const getNodeDerived = useProjectStore((s) => s.getNodeDerived);
  const assignToGroup = useProjectStore((s) => s.assignToGroup);
  
  // Compute nodes with effective areas (resolves instance links)
  // This ensures instances display with their source's areaPerUnit
  const nodes = useMemo(() => {
    const effectiveNodes: Record<UUID, AreaNode> = {};
    for (const [id, node] of Object.entries(rawNodes)) {
      const derived = getNodeDerived(id);
      if (derived && node.instanceOf) {
        // Instance: use effective area from source
        effectiveNodes[id] = {
          ...node,
          areaPerUnit: derived.effectiveAreaPerUnit,
        };
        console.debug(`[AreaBoard] Instance ${node.name}: using effective area ${derived.effectiveAreaPerUnit} from source`);
      } else {
        effectiveNodes[id] = node;
      }
    }
    return effectiveNodes;
  }, [rawNodes, getNodeDerived]);
  const removeFromGroup = useProjectStore((s) => s.removeFromGroup);
  
  // Board layout from project store (persisted on export)
  const groupPositions = useProjectStore((s) => s.boardLayout.groupPositions);
  const groupSizeOverrides = useProjectStore((s) => s.boardLayout.groupSizeOverrides);
  const areaOffsets = useProjectStore((s) => s.boardLayout.areaOffsets);
  const comments = useProjectStore((s) => s.boardLayout.comments);
  const setGroupPosition = useProjectStore((s) => s.setGroupPosition);
  const setGroupSizeOverride = useProjectStore((s) => s.setGroupSizeOverride);
  const clearGroupSizeOverride = useProjectStore((s) => s.clearGroupSizeOverride);
  const setAreaOffset = useProjectStore((s) => s.setAreaOffset);
  const setAreaOffsets = useProjectStore((s) => s.setAreaOffsets);
  const clearAreaOffset = useProjectStore((s) => s.clearAreaOffset);
  const clearAreaOffsets = useProjectStore((s) => s.clearAreaOffsets);
  const addComment = useProjectStore((s) => s.addComment);
  const updateComment = useProjectStore((s) => s.updateComment);
  const deleteComment = useProjectStore((s) => s.deleteComment);
  const moveComment = useProjectStore((s) => s.moveComment);
  
  // UI store (not persisted)
  const selectedNodeIds = useUIStore((s) => s.selectedNodeIds);
  const selectedGroupIds = useUIStore((s) => s.selectedGroupIds);
  const selectNodes = useUIStore((s) => s.selectNodes);
  const selectGroups = useUIStore((s) => s.selectGroups);
  const isAddingComment = useUIStore((s) => s.isAddingComment);
  const setAddingComment = useUIStore((s) => s.setAddingComment);

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

  // Initialize positions for new groups - only once per group
  // Use a ref to track which groups have been initialized to avoid re-running
  const initializedGroupsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const group of layout.groups) {
      // Only initialize if not already in store AND not already initialized this session
      if (!groupPositions[group.id] && !initializedGroupsRef.current.has(group.id)) {
        initializedGroupsRef.current.add(group.id);
        setGroupPosition(group.id, group.x, group.y);
      }
    }
  }, [layout.groups]); // Intentionally exclude groupPositions to avoid re-running on drag

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
  // Use a ref to always have access to latest positions without recreating callback
  const groupPositionsRef = useRef(groupPositions);
  groupPositionsRef.current = groupPositions;
  
  // Ref for selected groups to avoid recreating callback
  const selectedGroupIdsRef = useRef(selectedGroupIds);
  selectedGroupIdsRef.current = selectedGroupIds;
  
  const handleDragGroup = useCallback(
    (groupId: string, deltaX: number, deltaY: number, initialX?: number, initialY?: number) => {
      // Check if dragging a selected group - move all selected groups together
      const selectedIds = selectedGroupIdsRef.current;
      const isMultiDrag = selectedIds.includes(groupId) && selectedIds.length > 1;
      
      if (isMultiDrag) {
        // Move all selected groups by the same delta
        for (const gId of selectedIds) {
          if (gId === UNUSED_AREAS_GROUP_ID) continue; // Skip unused group
          const current = groupPositionsRef.current[gId];
          if (current) {
            setGroupPosition(gId, current.x + deltaX, current.y + deltaY);
          }
        }
      } else {
        // Single group drag - original behavior
        const current = groupPositionsRef.current[groupId] || { x: initialX ?? 0, y: initialY ?? 0 };
        setGroupPosition(groupId, current.x + deltaX, current.y + deltaY);
      }
    },
    [setGroupPosition]
  );

  // Handle area drag start - store initial offset for potential revert
  // Ref for selected nodes to avoid recreating callback
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  selectedNodeIdsRef.current = selectedNodeIds;
  
  const handleDragAreaStart = useCallback(
    (areaId: string) => {
      // Store initial offsets for the dragged area
      setDragStartOffsets((prev) => {
        const updates: Record<string, { x: number; y: number }> = {
          ...prev,
          [areaId]: areaOffsets[areaId] || { x: 0, y: 0 },
        };
        
        // If multi-selecting, store initial offsets for all selected areas
        const selectedIds = selectedNodeIdsRef.current;
        if (selectedIds.includes(areaId) && selectedIds.length > 1) {
          for (const id of selectedIds) {
            updates[id] = areaOffsets[id] || { x: 0, y: 0 };
          }
        }
        
        return updates;
      });
    },
    [areaOffsets]
  );

  // Handle area dragging within groups
  // Use a ref to always have access to latest offsets without recreating callback
  const areaOffsetsRef = useRef(areaOffsets);
  areaOffsetsRef.current = areaOffsets;
  
  const handleDragArea = useCallback(
    (areaId: string, deltaX: number, deltaY: number) => {
      // Check if dragging a selected area - move all selected areas together
      const selectedIds = selectedNodeIdsRef.current;
      const isMultiDrag = selectedIds.includes(areaId) && selectedIds.length > 1;
      
      if (isMultiDrag) {
        // Batch update all selected areas in a single state change
        const newOffsets: Record<string, { x: number; y: number }> = {};
        for (const id of selectedIds) {
          const current = areaOffsetsRef.current[id] || { x: 0, y: 0 };
          newOffsets[id] = { x: current.x + deltaX, y: current.y + deltaY };
        }
        setAreaOffsets(newOffsets);
      } else {
        // Single area drag - original behavior
        const current = areaOffsetsRef.current[areaId] || { x: 0, y: 0 };
        setAreaOffset(areaId, current.x + deltaX, current.y + deltaY);
      }
    },
    [setAreaOffset, setAreaOffsets]
  );

  // Handle group resize
  const handleResizeGroup = useCallback(
    (groupId: string, newWidth: number, newHeight: number) => {
      setGroupSizeOverride(groupId, {
        width: snapToGrid(Math.max(100, newWidth)),
        height: snapToGrid(Math.max(60, newHeight)),
      });
    },
    [setGroupSizeOverride]
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
      
      // Check if this is a multi-area drag
      const selectedIds = selectedNodeIdsRef.current;
      const isMultiDrag = selectedIds.includes(areaId) && selectedIds.length > 1;
      const draggedAreaIds = isMultiDrag ? selectedIds : [areaId];
      
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
        
        // For multi-drag, only allow if all dragged areas are from the same group
        // (don't support moving areas from different groups at once)
        if (!isMultiDrag) {
          // Remove from current real group if it has one (not the unused group)
          if (normalizedCurrentGroupId) {
            removeFromGroup(normalizedCurrentGroupId, [areaId]);
            
            // Clear size override for source group so it shrinks to fit
            clearGroupSizeOverride(normalizedCurrentGroupId);
          }
          
          // Add to new real group if dropped on one (not the unused group)
          if (normalizedTargetGroupId) {
            assignToGroup(normalizedTargetGroupId, [areaId]);
            
            // Clear size override for the target group so it auto-resizes to fit new content
            clearGroupSizeOverride(normalizedTargetGroupId);
          }
          
          // Clear size override for unused group if involved
          if (currentGroupId === UNUSED_AREAS_GROUP_ID || targetGroupId === UNUSED_AREAS_GROUP_ID) {
            clearGroupSizeOverride(UNUSED_AREAS_GROUP_ID);
          }
          
          // Reset offsets: for the moved area, AND for all remaining areas in source group
          // This prevents overlapping when layout recalculates positions
          clearAreaOffset(areaId);
          const siblingIds = sourceGroupChildIds.filter((id) => id !== areaId);
          if (siblingIds.length > 0) {
            clearAreaOffsets(siblingIds);
          }
        } else {
          // Multi-drag to different group - revert all to initial positions (batch update)
          const revertOffsets: Record<string, { x: number; y: number }> = {};
          for (const id of draggedAreaIds) {
            revertOffsets[id] = dragStartOffsets[id] || { x: 0, y: 0 };
          }
          setAreaOffsets(revertOffsets);
        }
      } else if (currentGroupId) {
        // Same group - check for collisions before allowing the move
        const group = layout.groups.find((g) => g.id === currentGroupId);
        if (!group) return;
        
        // For multi-drag, check collisions for all dragged areas
        const draggingRects: Array<{ id: string; rect: LayoutRect; snappedOffset: { x: number; y: number } }> = [];
        
        for (const id of draggedAreaIds) {
          const rect = group.children.find((c) => c.id === id);
          if (!rect) continue;
          
          const current = areaOffsetsRef.current[id] || { x: 0, y: 0 };
          const snappedOffset = {
            x: snapToGrid(current.x),
            y: snapToGrid(current.y),
          };
          
          draggingRects.push({ id, rect, snappedOffset });
        }
        
        // Check bounds and collisions for all dragging areas
        let hasCollisionOrOutOfBounds = false;
        
        for (const { rect: draggedRect, snappedOffset } of draggingRects) {
          const newX = draggedRect.x + snappedOffset.x;
          const newY = draggedRect.y + snappedOffset.y;
          
          // Check bounds - area must stay within group content area
          const minX = GROUP_PADDING;
          const minY = GROUP_HEADER_HEIGHT + GROUP_PADDING;
          const maxX = group.width - GROUP_PADDING - draggedRect.width;
          const maxY = group.height - GROUP_PADDING - draggedRect.height;
          
          if (newX < minX || newX > maxX || newY < minY || newY > maxY) {
            hasCollisionOrOutOfBounds = true;
            break;
          }
          
          // Check collision with non-dragged areas in the group
          const newRect = {
            x: newX,
            y: newY,
            width: draggedRect.width,
            height: draggedRect.height,
          };
          
          for (const otherRect of group.children) {
            // Skip if this is one of the dragged areas
            if (draggedAreaIds.includes(otherRect.id)) continue;
            
            const otherOffset = areaOffsetsRef.current[otherRect.id] || { x: 0, y: 0 };
            const otherPos = {
              x: otherRect.x + otherOffset.x,
              y: otherRect.y + otherOffset.y,
              width: otherRect.width,
              height: otherRect.height,
            };
            
            if (rectsOverlap(newRect, otherPos)) {
              hasCollisionOrOutOfBounds = true;
              break;
            }
          }
          
          if (hasCollisionOrOutOfBounds) break;
        }
        
        if (hasCollisionOrOutOfBounds) {
          // Collision or out of bounds - revert all to initial positions (batch update)
          const revertOffsets: Record<string, { x: number; y: number }> = {};
          for (const id of draggedAreaIds) {
            revertOffsets[id] = dragStartOffsets[id] || { x: 0, y: 0 };
          }
          setAreaOffsets(revertOffsets);
        } else {
          // No collision and within bounds - keep the snapped positions (batch update)
          const snappedOffsets: Record<string, { x: number; y: number }> = {};
          for (const { id, snappedOffset } of draggingRects) {
            snappedOffsets[id] = snappedOffset;
          }
          setAreaOffsets(snappedOffsets);
        }
      } else {
        // Ungrouped areas - just snap the offsets (batch update)
        const snappedOffsets: Record<string, { x: number; y: number }> = {};
        for (const id of draggedAreaIds) {
          const current = areaOffsetsRef.current[id] || { x: 0, y: 0 };
          snappedOffsets[id] = { x: snapToGrid(current.x), y: snapToGrid(current.y) };
        }
        setAreaOffsets(snappedOffsets);
      }
    },
    [layout.groups, groupPositions, pan, scale, assignToGroup, removeFromGroup, dragStartOffsets, setAreaOffset, setAreaOffsets, clearAreaOffset, clearAreaOffsets, clearGroupSizeOverride]
  );

  // Handle canvas mouse events - middle button for pan, left button for comments/selection
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button (button === 1) for panning - works anywhere
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
    // Left click while adding comment mode
    else if (e.button === 0 && isAddingComment) {
      const target = e.target as HTMLElement;
      // Don't place comment on cards/groups
      if (target.closest('[data-area-card]') || target.closest('[data-group-container]')) {
        return;
      }
      e.preventDefault();
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      // Convert to canvas coordinates
      const canvasX = (e.clientX - rect.left - pan.x) / scale;
      const canvasY = (e.clientY - rect.top - pan.y) / scale;
      addComment(canvasX, canvasY, '');
      setAddingComment(false);
    }
    // Left click in select mode or on empty area - start selection box
    else if (e.button === 0 && isSelectMode) {
      const target = e.target as HTMLElement;
      // Don't start selection on cards/groups
      if (target.closest('[data-area-card]') || target.closest('[data-group-container]')) {
        return;
      }
      e.preventDefault();
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      // Convert to canvas coordinates
      const canvasX = (e.clientX - rect.left - pan.x) / scale;
      const canvasY = (e.clientY - rect.top - pan.y) / scale;
      setSelectionBox({
        startX: canvasX,
        startY: canvasY,
        currentX: canvasX,
        currentY: canvasY,
      });
    }
  }, [pan, scale, isAddingComment, isSelectMode, addComment, setAddingComment]);

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      } else if (selectionBox) {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        const canvasX = (e.clientX - rect.left - pan.x) / scale;
        const canvasY = (e.clientY - rect.top - pan.y) / scale;
        setSelectionBox({
          ...selectionBox,
          currentX: canvasX,
          currentY: canvasY,
        });
      }
    },
    [isPanning, panStart, selectionBox, pan, scale]
  );

  const handleCanvasMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || isPanning) {
      setIsPanning(false);
    }
    
    // Complete selection box - find groups that intersect
    if (selectionBox && e.button === 0) {
      const boxLeft = Math.min(selectionBox.startX, selectionBox.currentX);
      const boxTop = Math.min(selectionBox.startY, selectionBox.currentY);
      const boxRight = Math.max(selectionBox.startX, selectionBox.currentX);
      const boxBottom = Math.max(selectionBox.startY, selectionBox.currentY);
      const boxWidth = boxRight - boxLeft;
      const boxHeight = boxBottom - boxTop;
      
      // Only select if box is big enough (to avoid accidental clicks)
      if (boxWidth > 10 || boxHeight > 10) {
        const selectedIds: string[] = [];
        
        for (const group of layout.groups) {
          // Skip unused areas group
          if (group.id === UNUSED_AREAS_GROUP_ID) continue;
          
          const pos = groupPositions[group.id] || { x: group.x, y: group.y };
          const groupLeft = pos.x;
          const groupTop = pos.y;
          const groupRight = pos.x + group.width;
          const groupBottom = pos.y + group.height;
          
          // Check if group intersects with selection box
          if (!(boxRight < groupLeft || boxLeft > groupRight || boxBottom < groupTop || boxTop > groupBottom)) {
            selectedIds.push(group.id);
          }
        }
        
        if (selectedIds.length > 0) {
          selectGroups(selectedIds);
        } else {
          // Clear selection if no groups selected
          selectGroups([]);
          selectNodes([]);
        }
      }
      
      setSelectionBox(null);
    }
  }, [isPanning, selectionBox, layout.groups, groupPositions, selectGroups, selectNodes]);

  // Mouse wheel zoom toward cursor - use native event listener to properly prevent default
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      // Get cursor position relative to wrapper
      const rect = wrapper.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      
      // Calculate new scale
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(Math.max(scale * delta, 0.3), 3);
      const scaleFactor = newScale / scale;
      
      // Adjust pan to zoom toward cursor
      // Formula: newPan = cursor - (cursor - oldPan) * scaleFactor
      const newPanX = cursorX - (cursorX - pan.x) * scaleFactor;
      const newPanY = cursorY - (cursorY - pan.y) * scaleFactor;
      
      setScale(newScale);
      setPan({ x: newPanX, y: newPanY });
    };
    
    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => wrapper.removeEventListener('wheel', handleWheel);
  }, [scale, pan]);

  // Zoom controls
  const handleZoomIn = () => setScale((s) => Math.min(s * 1.2, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s / 1.2, 0.3));
  const handleResetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    // Note: positions, sizes, and offsets are preserved (stored in project)
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
        <Button 
          variant={isAddingComment ? 'default' : 'ghost'} 
          size="icon" 
          onClick={() => { setAddingComment(!isAddingComment); setIsSelectMode(false); }} 
          title={isAddingComment ? 'Cancel adding comment' : 'Add comment'}
        >
          <MessageSquare className="w-4 h-4" />
        </Button>
        <Button 
          variant={isSelectMode ? 'default' : 'ghost'} 
          size="icon" 
          onClick={() => { setIsSelectMode(!isSelectMode); setAddingComment(false); }} 
          title={isSelectMode ? 'Cancel selection mode' : 'Select groups (drag to select)'}
        >
          <MousePointer2 className="w-4 h-4" />
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
        className={`absolute inset-4 rounded-lg ${
          isPanning ? 'cursor-grabbing' : 
          isAddingComment ? 'cursor-crosshair' : 
          isSelectMode ? 'cursor-crosshair' : 
          'cursor-default'
        }`}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={() => { setIsPanning(false); setSelectionBox(null); }}
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
        
        {/* Selection box overlay - rendered in screen space above the canvas */}
        {selectionBox && (
          <div
            className="absolute border-2 border-primary bg-primary/10 pointer-events-none z-50"
            style={{
              left: Math.min(selectionBox.startX, selectionBox.currentX) * scale + pan.x,
              top: Math.min(selectionBox.startY, selectionBox.currentY) * scale + pan.y,
              width: Math.abs(selectionBox.currentX - selectionBox.startX) * scale,
              height: Math.abs(selectionBox.currentY - selectionBox.startY) * scale,
            }}
          />
        )}
        
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

          {/* Board comments */}
          {comments.map((comment) => (
            <BoardComment
              key={comment.id}
              id={comment.id}
              x={comment.x}
              y={comment.y}
              text={comment.text}
              isEditing={comment.text === ''}
              onUpdate={updateComment}
              onDelete={deleteComment}
              onDrag={moveComment}
              scale={scale}
            />
          ))}

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
