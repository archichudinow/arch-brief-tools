import { useLevelsStore, useProjectStore } from '@/stores';
import type { GroupSection } from '@/types';
import { useTheme } from 'next-themes';
import { useMemo } from 'react';

// Color manipulation helpers (same as AreaCard)
function lightenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lighten = (c: number) => Math.round(c + (255 - c) * factor);
  return `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`;
}

function darkenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const darken = (c: number) => Math.round(c * (1 - factor));
  return `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`;
}

interface GroupSectionCardProps {
  section: GroupSection;
  width: number;
  height: number;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
}

export function GroupSectionCard({ 
  section, 
  width, 
  height, 
  isSelected, 
  onClick 
}: GroupSectionCardProps) {
  const getSectionDerived = useLevelsStore((s) => s.getSectionDerived);
  const groups = useProjectStore((s) => s.groups);
  const nodes = useProjectStore((s) => s.nodes); // Subscribe to nodes for area updates
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';
  
  // Calculate derived data - will recalculate when nodes change
  const derived = useMemo(() => getSectionDerived(section.id), [getSectionDerived, section.id, nodes]);
  const group = groups[section.groupId];
  
  if (!derived || !group) return null;
  
  // Calculate display values
  const displayName = section.name || derived.groupName;
  const levelCount = derived.levelCount;
  const percentDisplay = derived.percentOfGroup.toFixed(0);
  
  // Determine colors from group - adapt to dark/light mode like AreaCard
  const bgColor = useMemo(() => {
    if (group.color) {
      return isDarkMode ? darkenColor(group.color, 0.6) : lightenColor(group.color, 0.7);
    }
    return 'hsl(var(--muted))';
  }, [group.color, isDarkMode]);
  
  const borderColor = isSelected ? 'hsl(var(--primary))' : group.color;
  const textColor = group.color;
  
  // Size-based label visibility
  const showFullLabel = width > 80 && height > 40;
  const showCompactLabel = width > 40 && height > 24;
  
  // Build informative tooltip
  const tooltipLines = [
    displayName,
    `Allocated: ${section.areaAllocation.toLocaleString()}m²`,
    `Group total: ${derived.groupTotalArea.toLocaleString()}m²`,
    `${percentDisplay}% of group`,
  ];
  if (levelCount > 1) {
    tooltipLines.push(`Spans ${levelCount} levels`);
  }
  
  return (
    <div
      className={`
        relative w-full h-full rounded-md overflow-hidden cursor-grab active:cursor-grabbing
        transition-all duration-150 ease-out border
        hover:ring-2 hover:ring-primary/50
        ${isSelected ? 'ring-2 ring-primary shadow-lg z-10' : 'shadow-sm'}
      `}
      style={{
        backgroundColor: bgColor,
        borderColor,
      }}
      onClick={onClick}
      title={tooltipLines.join('\n')}
    >
      {/* Full label for larger cards */}
      {showFullLabel && (
        <div className="absolute inset-1 flex flex-col justify-center items-center text-center select-none pointer-events-none">
          <div 
            className="text-[10px] font-semibold leading-tight truncate max-w-full px-1"
            style={{ color: textColor }}
          >
            {displayName}
          </div>
          <div 
            className="text-[8px] leading-tight opacity-80 tabular-nums"
            style={{ color: textColor }}
          >
            {section.areaAllocation.toLocaleString()}m²
          </div>
          {levelCount > 1 && (
            <div 
              className="text-[7px] leading-tight opacity-60 mt-0.5"
              style={{ color: textColor }}
            >
              ×{levelCount} levels
            </div>
          )}
        </div>
      )}
      
      {/* Compact label for medium cards */}
      {!showFullLabel && showCompactLabel && (
        <div 
          className="absolute inset-0 flex items-center justify-center select-none pointer-events-none"
          style={{ color: textColor }}
        >
          <div className="text-[8px] font-bold opacity-80 truncate px-1">
            {displayName.slice(0, 8)}
          </div>
        </div>
      )}
      
      {/* Multi-level indicator stripe */}
      {levelCount > 1 && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-1 opacity-50"
          style={{ backgroundColor: textColor }}
        />
      )}
    </div>
  );
}
