import { useState, useRef, useEffect } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { useLevelsStore } from '@/stores';
import { GroupSectionCard } from './GroupSectionCard';
import type { Level, GroupSection } from '@/types';
import { Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LevelRowProps {
  level: Level;
  sections: GroupSection[];
  totalBoardWidth: number;
  rowHeight: number;
  xScale: number;
  maxTotalArea: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export function LevelRow({
  level,
  sections,
  totalBoardWidth,
  rowHeight,
  xScale,
  maxTotalArea,
  isSelected,
  onSelect,
  onDelete,
}: LevelRowProps) {
  const selectedSectionIds = useLevelsStore((s) => s.selectedSectionIds);
  const selectSection = useLevelsStore((s) => s.selectSection);
  const updateLevel = useLevelsStore((s) => s.updateLevel);
  
  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(level.name);
  const [editHeight, setEditHeight] = useState(level.height.toString());
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditing]);
  
  // Handle double-click to edit
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(level.name);
    setEditHeight(level.height.toString());
    setIsEditing(true);
  };
  
  // Save edits
  const handleSave = () => {
    const newHeight = parseFloat(editHeight);
    updateLevel(level.id, {
      name: editName.trim() || level.name,
      height: isNaN(newHeight) || newHeight <= 0 ? level.height : newHeight,
    });
    setIsEditing(false);
  };
  
  // Cancel editing
  const handleCancel = () => {
    setEditName(level.name);
    setEditHeight(level.height.toString());
    setIsEditing(false);
  };
  
  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };
  
  // Calculate total area on this level
  const levelTotalArea = sections.reduce((sum, s) => sum + s.areaAllocation, 0);
  
  // Layout constants
  const LABEL_WIDTH = 120;
  const PADDING = 8;
  const RIGHT_LABEL_WIDTH = 32;
  const GAP = 4; // Fixed gap between sections
  const CONTAINER_PADDING = 32; // px-4 = 16px each side
  const availableWidth = Math.max(100, totalBoardWidth - LABEL_WIDTH - PADDING * 2 - RIGHT_LABEL_WIDTH - CONTAINER_PADDING);
  
  // Sort sections by orderInLevel for consistent display
  const sortedSections = [...sections].sort((a, b) => 
    (a.orderInLevel ?? 0) - (b.orderInLevel ?? 0)
  );
  
  // Calculate section widths proportionally with xScale
  const sectionWidths: Record<string, number> = {};
  sections.forEach(section => {
    const proportion = maxTotalArea > 0 ? section.areaAllocation / maxTotalArea : 0;
    const baseWidth = proportion * availableWidth;
    sectionWidths[section.id] = Math.max(30, baseWidth * xScale);
  });
  
  return (
    <div
      className={`
        relative flex items-stretch border-b border-border group
        ${isSelected ? 'bg-primary/5 ring-1 ring-inset ring-primary/30' : 'hover:bg-muted/40'}
        transition-colors
      `}
      style={{ height: rowHeight }}
      onClick={onSelect}
    >
      {/* Level label - left side */}
      <div 
        className="flex-shrink-0 flex items-center justify-between px-2 border-r border-border/50 bg-card/50"
        style={{ width: LABEL_WIDTH }}
      >
        {isEditing ? (
          // Editing mode
          <div className="flex flex-col gap-1 w-full" onClick={(e) => e.stopPropagation()}>
            <Input
              ref={nameInputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              className="h-5 text-[10px] px-1"
              placeholder="Level name"
            />
            <div className="flex items-center gap-1">
              <Input
                value={editHeight}
                onChange={(e) => setEditHeight(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSave}
                className="h-5 text-[10px] px-1 w-12"
                placeholder="Height"
              />
              <span className="text-[9px] text-muted-foreground">m</span>
            </div>
          </div>
        ) : (
          // Display mode
          <>
            <div 
              className="flex items-center gap-1 cursor-pointer"
              onDoubleClick={handleDoubleClick}
              title="Double-click to edit"
            >
              <GripVertical className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium truncate" title={level.name}>
                  {level.name}
                </div>
                <div className="text-[10px] text-muted-foreground tabular-nums">
                  {levelTotalArea.toLocaleString()}m² · {level.height}m
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete level"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </>
        )}
      </div>
      
      {/* Sections area - flexbox layout */}
      <div 
        className="flex-1 relative group overflow-hidden"
        style={{ padding: PADDING }}
      >
        <Droppable droppableId={`level-${level.order}`} direction="horizontal">
          {(provided, snapshot) => (
            <div 
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`flex items-start h-full min-h-[40px] rounded transition-colors ${snapshot.isDraggingOver ? 'bg-primary/10' : ''}`}
              style={{ gap: GAP }}
            >
              {sortedSections.map((section, index) => {
                const sectionWidth = sectionWidths[section.id];
                
                // Calculate height based on level span
                const levelSpan = section.levelEnd - section.levelStart + 1;
                const sectionHeight = levelSpan > 1 
                  ? rowHeight * levelSpan - PADDING * 2
                  : rowHeight - PADDING * 2;
                
                return (
                  <Draggable key={section.id} draggableId={section.id} index={index}>
                    {(dragProvided, dragSnapshot) => (
                      <div 
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        className={`flex-shrink-0 cursor-grab active:cursor-grabbing ${dragSnapshot.isDragging ? 'z-50 shadow-lg' : ''}`}
                        style={{ 
                          width: sectionWidth, 
                          height: sectionHeight,
                          ...dragProvided.draggableProps.style 
                        }}
                      >
                        <GroupSectionCard
                          section={section}
                          width={sectionWidth}
                          height={sectionHeight}
                          isSelected={selectedSectionIds.includes(section.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectSection(section.id, e.shiftKey || e.metaKey);
                          }}
                        />
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
        
        {/* Empty state */}
        {sections.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/60 text-xs pointer-events-none border-2 border-dashed border-border/30 rounded-lg m-1">
            <span>Drop sections here</span>
          </div>
        )}
      </div>
      
      {/* Level order indicator - right edge */}
      <div 
        className="flex-shrink-0 w-8 flex items-center justify-center border-l border-border/50 bg-card/30 text-[10px] text-muted-foreground font-mono tabular-nums"
        title={`Level order: ${level.order}`}
      >
        {level.order >= 0 ? `L${level.order}` : `B${Math.abs(level.order)}`}
      </div>
    </div>
  );
}
