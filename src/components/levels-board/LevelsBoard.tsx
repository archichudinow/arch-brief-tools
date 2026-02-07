import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { useLevelsStore } from '@/stores';
import { LevelRow } from './LevelRow';
import { OptionSelector } from './OptionSelector';
import { toast } from 'sonner';
import { SplitSectionDialog } from './SplitSectionDialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, 
  Layers, 
  Wand2,
  RefreshCcw,
  Scissors, 
  Merge, 
  Trash2,
  Building2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Move,
} from 'lucide-react';


// Constants
const DEFAULT_LEVEL_HEIGHT = 80; // pixels per level
const MIN_LEVEL_HEIGHT = 40;
const MAX_LEVEL_HEIGHT = 200;
const DEFAULT_X_SCALE = 1.0;
const MIN_X_SCALE = 0.001;
const MAX_X_SCALE = 10.0;

export function LevelsBoard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [levelHeight, setLevelHeight] = useState(DEFAULT_LEVEL_HEIGHT);
  const [xScale, setXScale] = useState(DEFAULT_X_SCALE);
  
  // Dialogs
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  
  // Store data
  const levels = useLevelsStore((s) => s.levels);
  const sections = useLevelsStore((s) => s.sections);
  const selectedLevelId = useLevelsStore((s) => s.selectedLevelId);
  const selectedSectionIds = useLevelsStore((s) => s.selectedSectionIds);
  const getSortedLevels = useLevelsStore((s) => s.getSortedLevels);
  const getLevelSections = useLevelsStore((s) => s.getLevelSections);
  const createLevel = useLevelsStore((s) => s.createLevel);
  const deleteLevel = useLevelsStore((s) => s.deleteLevel);
  const updateSection = useLevelsStore((s) => s.updateSection);
  const selectLevel = useLevelsStore((s) => s.selectLevel);
  const clearSectionSelection = useLevelsStore((s) => s.clearSectionSelection);
  const autoPopulateSections = useLevelsStore((s) => s.autoPopulateSections);
  const syncSectionsToCurrentAreas = useLevelsStore((s) => s.syncSectionsToCurrentAreas);
  const mergeSections = useLevelsStore((s) => s.mergeSections);
  const deleteSection = useLevelsStore((s) => s.deleteSection);
  
  // Get sorted levels (top to bottom)
  const sortedLevels = useMemo(() => getSortedLevels(), [levels]);
  
  // Calculate max total area for proportional widths
  const maxLevelArea = useMemo(() => {
    let maxArea = 0;
    for (const level of sortedLevels) {
      const levelSections = getLevelSections(level.order);
      const totalArea = levelSections.reduce((sum, s) => sum + s.areaAllocation, 0);
      maxArea = Math.max(maxArea, totalArea);
    }
    return maxArea || 1; // Avoid division by zero
  }, [sortedLevels, sections]);
  
  // Track number of sections for triggering dimension recalculation
  const sectionCount = Object.keys(sections).length;
  
  // Resize observer and dimension measurement
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    
    // Get dimensions synchronously before paint
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width > 0 && (dimensions.width === 0 || dimensions.width !== rect.width)) {
      setDimensions({
        width: rect.width,
        height: rect.height,
      });
    }
  }, [sectionCount, sortedLevels.length]); // Re-measure when sections or levels change
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      
      // Delete selected sections
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedSectionIds.length > 0) {
          e.preventDefault();
          selectedSectionIds.forEach(id => deleteSection(id));
          clearSectionSelection();
          toast.success(`Deleted ${selectedSectionIds.length} section(s)`);
        }
      }
      
      // Escape to clear selection
      if (e.key === 'Escape') {
        clearSectionSelection();
        selectLevel(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSectionIds, deleteSection, clearSectionSelection, selectLevel]);
  
  // Handlers - auto create level at top (highest order + 1)
  const handleAddLevelTop = () => {
    const existingOrders = sortedLevels.map(l => l.order);
    const maxOrder = existingOrders.length > 0 ? Math.max(...existingOrders) : -1;
    const newOrder = maxOrder + 1;
    createLevel({ name: `Level ${newOrder}`, order: newOrder });
    toast.success(`Added Level ${newOrder}`);
  };
  
  // Auto create level at bottom (lowest order - 1, or basement)
  const handleAddLevelBottom = () => {
    const existingOrders = sortedLevels.map(l => l.order);
    const minOrder = existingOrders.length > 0 ? Math.min(...existingOrders) : 1;
    const newOrder = minOrder - 1;
    const name = newOrder < 0 ? `Basement ${Math.abs(newOrder)}` : `Level ${newOrder}`;
    createLevel({ name, order: newOrder });
    toast.success(`Added ${name}`);
  };
  
  const handleAddQuickLevels = () => {
    // Quick add common levels
    const existingOrders = new Set(sortedLevels.map(l => l.order));
    
    if (!existingOrders.has(0)) {
      createLevel({ name: 'Ground Floor', order: 0 });
    }
    if (!existingOrders.has(1)) {
      createLevel({ name: 'Level 1', order: 1 });
    }
    if (!existingOrders.has(2)) {
      createLevel({ name: 'Level 2', order: 2 });
    }
    
    toast.success('Added default levels');
  };
  
  const handleAutoPopulate = () => {
    autoPopulateSections();
    toast.success('Populated sections from groups');
  };
  
  const handleSyncAreas = () => {
    syncSectionsToCurrentAreas();
    toast.success('Section allocations synced to current areas');
  };
  
  const handleDeleteLevel = (levelId: string) => {
    const level = levels[levelId];
    if (!level) return;
    
    if (confirm(`Delete "${level.name}"? Sections on this level will also be removed.`)) {
      deleteLevel(levelId);
      toast.success(`Deleted level: ${level.name}`);
    }
  };
  
  const handleMergeSections = () => {
    if (selectedSectionIds.length < 2) {
      toast.error('Select at least 2 sections to merge');
      return;
    }
    
    const result = mergeSections(selectedSectionIds);
    if (result) {
      clearSectionSelection();
      toast.success('Sections merged');
    } else {
      toast.error('Cannot merge - sections must be from the same group');
    }
  };
  
  const handleSplitSection = () => {
    if (selectedSectionIds.length !== 1) {
      toast.error('Select exactly 1 section to split');
      return;
    }
    setShowSplitDialog(true);
  };
  
  const handleZoomIn = () => {
    setLevelHeight(h => Math.min(MAX_LEVEL_HEIGHT, h + 10));
  };
  
  const handleZoomOut = () => {
    setLevelHeight(h => Math.max(MIN_LEVEL_HEIGHT, h - 10));
  };
  
  const handleXScaleUp = () => {
    setXScale(s => {
      // Adaptive step: smaller steps at smaller values
      const step = s < 0.1 ? 0.01 : s < 1 ? 0.1 : 0.5;
      return Math.min(MAX_X_SCALE, s + step);
    });
  };
  
  const handleXScaleDown = () => {
    setXScale(s => {
      // Adaptive step: smaller steps at smaller values
      const step = s <= 0.1 ? 0.01 : s <= 1 ? 0.1 : 0.5;
      return Math.max(MIN_X_SCALE, s - step);
    });
  };
  
  const handleResetScale = () => {
    setLevelHeight(DEFAULT_LEVEL_HEIGHT);
    setXScale(DEFAULT_X_SCALE);
  };

  // Drag and drop handler - handles reordering within level and cross-level moves
  const handleDragEnd = useCallback((result: DropResult) => {
    const { draggableId, source, destination } = result;
    
    if (!destination) return;
    
    const sectionId = draggableId;
    const sourceLevelOrder = parseInt(source.droppableId.replace('level-', ''), 10);
    const destLevelOrder = parseInt(destination.droppableId.replace('level-', ''), 10);
    const movedSection = sections[sectionId];
    
    if (!movedSection) return;
    
    // Same level - update order
    if (source.droppableId === destination.droppableId) {
      // Only update if position actually changed
      if (source.index !== destination.index) {
        // Get sections on this level and reorder
        const levelSections = getLevelSections(sourceLevelOrder)
          .sort((a, b) => (a.orderInLevel ?? 0) - (b.orderInLevel ?? 0));
        
        // Reorder based on drag
        levelSections.forEach((s, idx) => {
          let newOrder = idx;
          if (s.id === sectionId) {
            newOrder = destination.index;
          } else if (idx >= destination.index && idx < source.index) {
            newOrder = idx + 1;
          } else if (idx <= destination.index && idx > source.index) {
            newOrder = idx - 1;
          }
          updateSection(s.id, { orderInLevel: newOrder });
        });
      }
      return;
    }
    
    // Cross-level move
    const destLevelSections = getLevelSections(destLevelOrder);
    const newOrder = destination.index;
    
    // Update order for existing sections on dest level
    destLevelSections.forEach(s => {
      const currentOrder = s.orderInLevel ?? 0;
      if (currentOrder >= newOrder) {
        updateSection(s.id, { orderInLevel: currentOrder + 1 });
      }
    });
    
    // Move section to new level
    updateSection(sectionId, {
      levelStart: destLevelOrder,
      levelEnd: destLevelOrder,
      orderInLevel: newOrder,
    });
    
    const destLevel = sortedLevels.find(l => l.order === destLevelOrder);
    toast.success(`Moved to ${destLevel?.name || `Level ${destLevelOrder}`}`);
  }, [updateSection, sortedLevels, sections, getLevelSections]);
  
  // Empty state
  if (sortedLevels.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground p-8 bg-muted/30">
        <Building2 className="w-16 h-16 opacity-30" />
        <div className="text-center">
          <h3 className="text-lg font-medium text-foreground mb-2">No Building Levels</h3>
          <p className="text-sm mb-4 max-w-sm">
            Add building levels to allocate your area groups vertically across floors
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleAddQuickLevels} variant="outline" size="sm">
            <Layers className="w-4 h-4 mr-2" />
            Quick Add (3 Levels)
          </Button>
          <Button onClick={handleAddLevelTop} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Level
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      ref={containerRef}
      className="h-full flex flex-col bg-muted/30 overflow-hidden relative select-none"
      onClick={() => {
        clearSectionSelection();
        selectLevel(null);
      }}
    >
      {/* Option selector - top left */}
      <div className="absolute top-3 left-3 z-50">
        <OptionSelector />
      </div>
      
      {/* Toolbar - floating like AreaBoard */}
      <div className="absolute top-3 right-3 z-50 flex items-center gap-1 bg-card/90 backdrop-blur rounded-lg border border-border p-1 shadow-sm">
        {/* Level actions */}
        <Button 
          variant="ghost" 
          size="icon"
          onClick={handleAutoPopulate}
          title="Auto-populate sections from groups"
        >
          <Wand2 className="w-4 h-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={handleSyncAreas}
          title="Sync section allocations to current area values"
        >
          <RefreshCcw className="w-4 h-4" />
        </Button>
        <div className="w-px h-4 bg-border" />
        <Button 
          variant="ghost" 
          size="icon"
          onClick={handleSplitSection}
          disabled={selectedSectionIds.length !== 1}
          title="Split section"
        >
          <Scissors className="w-4 h-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={handleMergeSections}
          disabled={selectedSectionIds.length < 2}
          title="Merge sections"
        >
          <Merge className="w-4 h-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => {
            selectedSectionIds.forEach(id => deleteSection(id));
            clearSectionSelection();
          }}
          disabled={selectedSectionIds.length === 0}
          title="Delete selected sections"
          className="hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
        <div className="w-px h-4 bg-border" />
        
        {/* Scale controls */}
        {/* X Scale */}
        <Button 
          variant="ghost" 
          size="icon"
          onClick={handleXScaleDown}
          disabled={xScale <= MIN_X_SCALE}
          title="Decrease horizontal scale"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground w-9 text-center tabular-nums" title="Horizontal scale">
          {xScale < 0.1 ? xScale.toFixed(2) : xScale.toFixed(1)}x
        </span>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={handleXScaleUp}
          disabled={xScale >= MAX_X_SCALE}
          title="Increase horizontal scale"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <div className="w-px h-4 bg-border" />
        
        {/* Y Scale */}
        <Button 
          variant="ghost" 
          size="icon"
          onClick={handleZoomOut}
          disabled={levelHeight <= MIN_LEVEL_HEIGHT}
          title="Decrease level height"
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground w-8 text-center tabular-nums" title="Level height">
          {levelHeight}px
        </span>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={handleZoomIn}
          disabled={levelHeight >= MAX_LEVEL_HEIGHT}
          title="Increase level height"
        >
          <ChevronUp className="w-4 h-4" />
        </Button>
        <div className="w-px h-4 bg-border" />
        
        {/* Reset */}
        <Button 
          variant="ghost" 
          size="icon"
          onClick={handleResetScale}
          title="Reset scale to default"
        >
          <Move className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Levels list - centered vertically */}
      <ScrollArea className="flex-1">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="min-h-full flex flex-col justify-center py-16 pl-2 pr-4">
            {/* Add level at top */}
            <div 
              className="h-10 mb-2 border-2 border-dashed border-border/40 rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted/40 hover:border-border transition-colors group"
              onClick={(e) => {
                e.stopPropagation();
                handleAddLevelTop();
              }}
            >
              <Plus className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            
            {dimensions.width > 0 && sortedLevels.map((level) => {
              const levelSections = getLevelSections(level.order);
              
              return (
                <LevelRow
                  key={`${level.id}-${dimensions.width}-${xScale}`}
                  level={level}
                  sections={levelSections}
                  totalBoardWidth={dimensions.width}
                  rowHeight={levelHeight}
                  xScale={xScale}
                  maxTotalArea={maxLevelArea}
                  isSelected={selectedLevelId === level.id}
                  onSelect={() => selectLevel(level.id)}
                  onDelete={() => handleDeleteLevel(level.id)}
                />
              );
            })}
          
          {/* Add level at bottom */}
            <div 
              className="h-10 mt-2 border-2 border-dashed border-border/40 rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted/40 hover:border-border transition-colors group"
              onClick={(e) => {
                e.stopPropagation();
                handleAddLevelBottom();
              }}
            >
              <Plus className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </div>
        </DragDropContext>
      </ScrollArea>
      
      {/* Dialogs */}
      {showSplitDialog && selectedSectionIds.length === 1 && (
        <SplitSectionDialog
          open={showSplitDialog}
          onOpenChange={setShowSplitDialog}
          sectionId={selectedSectionIds[0]}
        />
      )}
    </div>
  );
}
