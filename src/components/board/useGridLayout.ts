import { useMemo } from 'react';
import type { AreaNode, Group, UUID } from '@/types';

// ============================================
// TYPES
// ============================================

export interface LayoutRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  name: string;
  count: number;
  areaPerUnit: number;
  groupId: string | null;
  groupColor: string | null;
  isSmall: boolean;
}

export interface GroupLayout {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  totalArea: number;
  children: LayoutRect[];
}

export interface BoardLayout {
  groups: GroupLayout[];
  ungrouped: LayoutRect[];
  totalArea: number;
}

// ============================================
// CONSTANTS
// ============================================

export const GRID_SIZE = 16; // Snap grid size - all sizes/positions are multiples of this
export const MIN_CARD_SIZE = 32; // Minimum card dimension (2x grid)
export const SMALL_CARD_SIZE = 16; // Small card size (1x grid)
export const SMALL_AREA_THRESHOLD = 10; // m² - below this use smaller treatment
export const GROUP_PADDING = 16; // Padding inside groups (1x grid)
export const GROUP_HEADER_HEIGHT = 48; // Space for group name (3x grid)
export const GROUP_SIZE_MULTIPLIER = 1.2; // Groups are 20% bigger than needed for some breathing room
export const CARD_GAP = 4; // Gap between cards (reduced for tighter layout)

// Special ID for the "Unused Areas" virtual group
export const UNUSED_AREAS_GROUP_ID = '__unused_areas__';
export const UNUSED_AREAS_GROUP_COLOR = '#9CA3AF'; // Gray color

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function snapToGrid(value: number, gridSize: number = GRID_SIZE): number {
  return Math.round(value / gridSize) * gridSize;
}

export function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export function lightenColor(hexColor: string, amount: number = 0.85): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  const newR = Math.round(r + (255 - r) * amount);
  const newG = Math.round(g + (255 - g) * amount);
  const newB = Math.round(b + (255 - b) * amount);

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

export function darkenColor(hexColor: string, amount: number = 0.7): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  const newR = Math.round(r * (1 - amount));
  const newG = Math.round(g * (1 - amount));
  const newB = Math.round(b * (1 - amount));

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

// ============================================
// CALCULATE CARD SIZE BASED ON AREA
// ============================================

function calculateCardSize(
  area: number,
  totalArea: number,
  referenceSize: number
): { width: number; height: number } {
  // Calculate proportional area based on a fixed reference canvas
  // This ensures all areas are proportional regardless of container
  const proportion = area / totalArea;
  
  // Use a fixed reference area for consistent sizing
  // Scale up the reference to make differences more visible
  const referenceArea = referenceSize * referenceSize * 0.5;
  const targetArea = proportion * referenceArea;
  
  // Calculate dimensions (roughly square)
  // Use sqrt to get side length, then apply a minimum
  const side = Math.sqrt(targetArea);
  
  // Apply different minimums based on actual area size
  // Very small areas (< 10 sqm) use smaller size, all grid-aligned
  const minSize = area < 10 ? SMALL_CARD_SIZE : area < 30 ? MIN_CARD_SIZE : MIN_CARD_SIZE + GRID_SIZE;
  
  // Snap to grid for pixel-perfect alignment
  const width = snapToGrid(Math.max(minSize, side));
  const height = snapToGrid(Math.max(minSize, side));
  
  return { width, height };
}

// ============================================
// SIMPLE GRID LAYOUT FOR CARDS
// ============================================

function layoutCardsInGrid(
  nodes: AreaNode[],
  startX: number,
  startY: number,
  containerWidth: number,
  groupId: string | null,
  groupColor: string | null,
  totalProjectArea: number,
  referenceSize: number
): LayoutRect[] {
  if (nodes.length === 0) return [];

  const cards: LayoutRect[] = [];
  // Snap starting position to grid
  let currentX = snapToGrid(startX);
  let currentY = snapToGrid(startY);
  let rowHeight = 0;

  // Sort by area descending
  const sortedNodes = [...nodes].sort(
    (a, b) => (b.areaPerUnit * b.count) - (a.areaPerUnit * a.count)
  );

  // Use grid-aligned gap for pixel-perfect alignment
  const gap = CARD_GAP; // Already a multiple of GRID_SIZE

  for (const node of sortedNodes) {
    const nodeArea = node.areaPerUnit * node.count;
    const { width, height } = calculateCardSize(
      nodeArea,
      totalProjectArea,
      referenceSize
    );

    // Check if we need to wrap to next row
    if (currentX + width > startX + containerWidth && currentX !== snapToGrid(startX)) {
      currentX = snapToGrid(startX);
      currentY += rowHeight + gap;
      rowHeight = 0;
    }

    cards.push({
      id: node.id,
      x: currentX,
      y: currentY,
      width,
      height,
      area: nodeArea,
      name: node.name,
      count: node.count,
      areaPerUnit: node.areaPerUnit,
      groupId,
      groupColor,
      isSmall: nodeArea < SMALL_AREA_THRESHOLD || width < 80,
    });

    currentX += width + gap;
    rowHeight = Math.max(rowHeight, height);
  }

  return cards;
}

// ============================================
// CALCULATE GROUP SIZE (aiming for square-ish shape)
// Returns both the group dimensions and the content width for card layout
// ============================================

function calculateGroupSize(
  memberNodes: AreaNode[],
  totalProjectArea: number,
  maxWidth: number,
  referenceSize: number
): { width: number; height: number; contentWidth: number } {
  if (memberNodes.length === 0) {
    return { width: 200, height: 120, contentWidth: 200 - GROUP_PADDING * 2 };
  }
  
  // Calculate card sizes
  const cardSizes: { width: number; height: number }[] = [];
  let totalCardWidth = 0;
  let maxCardHeight = 0;
  
  for (const node of memberNodes) {
    const nodeArea = node.areaPerUnit * node.count;
    const size = calculateCardSize(nodeArea, totalProjectArea, referenceSize);
    cardSizes.push(size);
    totalCardWidth += size.width + CARD_GAP;
    maxCardHeight = Math.max(maxCardHeight, size.height);
  }
  
  // Account for padding and header
  const paddingOverhead = GROUP_PADDING * 2;
  const headerOverhead = GROUP_HEADER_HEIGHT + GROUP_PADDING;
  
  // Sort cards by area descending (same as layoutCardsInGrid)
  const sortedSizes = [...cardSizes].sort((a, b) => (b.width * b.height) - (a.width * a.height));
  
  // Try different content widths to find the most square-ish group
  let bestContentWidth = totalCardWidth;
  let bestWidth = totalCardWidth + paddingOverhead;
  let bestHeight = maxCardHeight + headerOverhead + GROUP_PADDING;
  let bestAspectDiff = Infinity;
  
  // Try widths from narrow (forces more rows) to wide (single row)
  const minContentWidth = Math.max(sortedSizes[0]?.width || MIN_CARD_SIZE, 100);
  const maxContentWidth = Math.min(totalCardWidth, maxWidth - paddingOverhead);
  
  for (let targetContentWidth = minContentWidth; targetContentWidth <= maxContentWidth; targetContentWidth += GRID_SIZE) {
    let x = 0;
    let y = 0;
    let rowHeight = 0;
    let actualMaxX = 0;
    let actualMaxY = 0;
    
    for (const size of sortedSizes) {
      // Wrap to next row if needed
      if (x + size.width > targetContentWidth && x > 0) {
        x = 0;
        y += rowHeight + CARD_GAP;
        rowHeight = 0;
      }
      
      actualMaxX = Math.max(actualMaxX, x + size.width);
      rowHeight = Math.max(rowHeight, size.height);
      actualMaxY = Math.max(actualMaxY, y + rowHeight);
      
      x += size.width + CARD_GAP;
    }
    
    // Calculate full group dimensions
    const fullWidth = actualMaxX + paddingOverhead;
    const fullHeight = actualMaxY + headerOverhead + GROUP_PADDING;
    
    // Calculate aspect ratio - we want close to 1:1
    const aspectRatio = fullWidth / fullHeight;
    const aspectDiff = Math.abs(aspectRatio - 1);
    
    if (aspectDiff < bestAspectDiff) {
      bestAspectDiff = aspectDiff;
      bestContentWidth = targetContentWidth;
      bestWidth = fullWidth;
      bestHeight = fullHeight;
    }
    
    // If we've gone past square (too tall), stop searching
    if (aspectRatio > 1.5 && bestAspectDiff < 0.5) break;
  }
  
  // Apply multiplier for extra space and snap to grid
  const finalWidth = snapToGrid(bestWidth * GROUP_SIZE_MULTIPLIER);
  const finalHeight = snapToGrid(bestHeight * GROUP_SIZE_MULTIPLIER);
  // Content width also gets some extra space
  const finalContentWidth = snapToGrid(bestContentWidth * GROUP_SIZE_MULTIPLIER);

  return {
    width: Math.max(200, Math.min(maxWidth, finalWidth)),
    height: Math.max(120, finalHeight),
    contentWidth: finalContentWidth,
  };
}

// ============================================
// MAIN LAYOUT HOOK
// ============================================

export function useGridLayout(
  nodes: Record<UUID, AreaNode>,
  groups: Record<UUID, Group>,
  containerWidth: number,
  containerHeight: number,
  groupSizeOverrides: Record<string, { width?: number; height?: number }> = {}
): BoardLayout {
  return useMemo(() => {
    if (containerWidth <= 0 || containerHeight <= 0) {
      return { groups: [], ungrouped: [], totalArea: 0 };
    }

    const nodeList = Object.values(nodes);
    const groupList = Object.values(groups);

    // Calculate total area
    const totalArea = nodeList.reduce((sum, n) => sum + n.areaPerUnit * n.count, 0);
    if (totalArea === 0 && groupList.length === 0) {
      return { groups: [], ungrouped: [], totalArea: 0 };
    }

    // Separate nodes by group membership
    const assignedNodeIds = new Set<string>();
    groupList.forEach((g) => g.members.forEach((id) => assignedNodeIds.add(id)));
    const ungroupedNodes = nodeList.filter((n) => !assignedNodeIds.has(n.id));

    // Layout groups in a grid pattern (wrap to keep things organized)
    const layoutGroups: GroupLayout[] = [];
    let currentX = 20;
    let currentY = 20;
    let rowHeight = 0;
    const groupGap = 12; // Gap between groups
    
    // Use a fixed reference size for consistent card sizing across all groups
    const referenceSize = Math.min(containerWidth, containerHeight) * 0.8;
    
    // Maximum width for a row of groups - aim for 2-3 groups per row typically
    // Use the visible container width, not the infinite canvas
    const maxRowWidth = Math.min(containerWidth * 0.9, 1200);

    for (const group of groupList) {
      const memberNodes = group.members.map((id) => nodes[id]).filter(Boolean);
      const groupArea = memberNodes.reduce((sum, n) => sum + n.areaPerUnit * n.count, 0);

      // Get size (use override if available)
      const override = groupSizeOverrides[group.id];
      const calculatedSize = calculateGroupSize(memberNodes, totalArea || 1, maxRowWidth - 40, referenceSize);
      const width = override?.width || calculatedSize.width;
      const height = override?.height || calculatedSize.height;
      // Use the calculated content width for card layout (respects square-ish target)
      const contentWidth = calculatedSize.contentWidth;

      // Check if we need to wrap to next row
      if (currentX + width > maxRowWidth && currentX !== 20) {
        currentX = 20;
        currentY += rowHeight + groupGap;
        rowHeight = 0;
      }

      // Layout cards inside group using the calculated content width
      const children = layoutCardsInGrid(
        memberNodes,
        GROUP_PADDING,
        GROUP_HEADER_HEIGHT + GROUP_PADDING,
        contentWidth, // Use calculated content width so cards wrap properly
        group.id,
        group.color,
        totalArea || 1,
        referenceSize
      );

      layoutGroups.push({
        id: group.id,
        name: group.name,
        color: group.color,
        x: currentX,
        y: currentY,
        width,
        height,
        totalArea: groupArea,
        children,
      });

      currentX += width + groupGap;
      rowHeight = Math.max(rowHeight, height);
    }

    // Create "Unused Areas" virtual group for ungrouped nodes
    // This behaves like a regular group but collects all ungrouped areas
    const unusedGroupArea = ungroupedNodes.reduce((sum, n) => sum + n.areaPerUnit * n.count, 0);
    
    // Get size override for unused group if any
    const unusedOverride = groupSizeOverrides[UNUSED_AREAS_GROUP_ID];
    const unusedCalculatedSize = calculateGroupSize(ungroupedNodes, totalArea || 1, maxRowWidth - 40, referenceSize);
    const unusedWidth = unusedOverride?.width || unusedCalculatedSize.width;
    const unusedHeight = unusedOverride?.height || Math.max(120, unusedCalculatedSize.height); // Min height even when empty
    const unusedContentWidth = unusedCalculatedSize.contentWidth;
    
    // Position the unused group - check if it fits in current row, otherwise wrap
    let unusedX = currentX;
    let unusedY = currentY;
    
    if (currentX + unusedWidth > maxRowWidth && currentX !== 20) {
      // Wrap to next row
      unusedX = 20;
      unusedY = currentY + rowHeight + groupGap;
    }
    
    // Layout cards inside the unused group
    const unusedChildren = layoutCardsInGrid(
      ungroupedNodes,
      GROUP_PADDING,
      GROUP_HEADER_HEIGHT + GROUP_PADDING,
      unusedContentWidth || (unusedWidth - GROUP_PADDING * 2),
      UNUSED_AREAS_GROUP_ID,
      UNUSED_AREAS_GROUP_COLOR,
      totalArea || 1,
      referenceSize
    );
    
    // Add the unused areas group (always present, even when empty)
    layoutGroups.push({
      id: UNUSED_AREAS_GROUP_ID,
      name: 'Unused Areas',
      color: UNUSED_AREAS_GROUP_COLOR,
      x: unusedX,
      y: unusedY,
      width: Math.max(200, unusedWidth), // Minimum width when empty
      height: unusedHeight,
      totalArea: unusedGroupArea,
      children: unusedChildren,
    });

    return {
      groups: layoutGroups,
      ungrouped: [], // No longer have separate ungrouped - they're in the unused group
      totalArea,
    };
  }, [nodes, groups, containerWidth, containerHeight, groupSizeOverrides]);
}

// ============================================
// HIT TESTING
// ============================================

export function findGroupAtPosition(
  x: number,
  y: number,
  groups: GroupLayout[],
  groupPositions: Record<string, { x: number; y: number }>
): string | null {
  for (const group of groups) {
    // If group has a stored absolute position, use it; otherwise use layout position
    const pos = groupPositions[group.id] || { x: group.x, y: group.y };
    const gx = pos.x;
    const gy = pos.y;
    
    if (x >= gx && x <= gx + group.width && y >= gy && y <= gy + group.height) {
      return group.id;
    }
  }
  return null;
}
