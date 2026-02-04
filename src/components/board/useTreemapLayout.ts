import { useMemo } from 'react';
import * as d3 from 'd3-hierarchy';
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
  isSmall: boolean; // For icon-only treatment
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

const MIN_SIZE = 48; // Minimum dimension for readability
const SMALL_AREA_THRESHOLD = 30; // m² - below this use icon treatment
const PADDING = 8; // Padding between items
const GROUP_PADDING = 12; // Extra padding inside groups
const GROUP_HEADER_HEIGHT = 36; // Space for group name

// ============================================
// TREEMAP LAYOUT HOOK
// ============================================

export function useTreemapLayout(
  nodes: Record<UUID, AreaNode>,
  groups: Record<UUID, Group>,
  containerWidth: number,
  containerHeight: number
): BoardLayout {
  return useMemo(() => {
    if (containerWidth <= 0 || containerHeight <= 0) {
      return { groups: [], ungrouped: [], totalArea: 0 };
    }

    const nodeList = Object.values(nodes);
    const groupList = Object.values(groups);

    // Calculate total area
    const totalArea = nodeList.reduce((sum, n) => sum + n.areaPerUnit * n.count, 0);
    if (totalArea === 0) {
      return { groups: [], ungrouped: [], totalArea: 0 };
    }

    // Separate nodes by group membership
    const assignedNodeIds = new Set<string>();
    groupList.forEach((g) => g.members.forEach((id) => assignedNodeIds.add(id)));
    const ungroupedNodes = nodeList.filter((n) => !assignedNodeIds.has(n.id));

    // Calculate group areas
    const groupAreas = groupList.map((g) => {
      const memberNodes = g.members.map((id) => nodes[id]).filter(Boolean);
      const groupArea = memberNodes.reduce((sum, n) => sum + n.areaPerUnit * n.count, 0);
      return { group: g, area: groupArea, nodes: memberNodes };
    });

    // Sort by area (largest first) for better treemap
    groupAreas.sort((a, b) => b.area - a.area);

    // Calculate ungrouped area
    const ungroupedArea = ungroupedNodes.reduce((sum, n) => sum + n.areaPerUnit * n.count, 0);

    // Build hierarchical data for outer treemap (groups + ungrouped)
    const outerData = {
      name: 'root',
      children: [
        ...groupAreas.map((ga) => ({
          name: ga.group.id,
          value: ga.area,
          isGroup: true,
          group: ga.group,
          nodes: ga.nodes,
        })),
        ...(ungroupedArea > 0
          ? [
              {
                name: 'ungrouped',
                value: ungroupedArea,
                isGroup: false,
                group: null,
                nodes: ungroupedNodes,
              },
            ]
          : []),
      ],
    };

    // Create outer treemap
    const outerHierarchy = d3
      .hierarchy(outerData)
      .sum((d: any) => d.value || 0);

    const outerTreemap = d3
      .treemap<any>()
      .size([containerWidth, containerHeight])
      .padding(PADDING * 2)
      .round(true);

    const outerRoot = outerTreemap(outerHierarchy);

    // Process each group/section
    const layoutGroups: GroupLayout[] = [];
    const layoutUngrouped: LayoutRect[] = [];

    for (const leaf of outerRoot.children || []) {
      const data = leaf.data as any;
      const x = leaf.x0;
      const y = leaf.y0;
      const width = leaf.x1 - leaf.x0;
      const height = leaf.y1 - leaf.y0;

      if (data.isGroup && data.group) {
        // This is a group container
        const group = data.group as Group;
        const memberNodes = data.nodes as AreaNode[];

        // Calculate inner treemap for group members with extra padding
        const innerChildren = layoutNodesInRect(
          memberNodes,
          x + GROUP_PADDING,
          y + GROUP_HEADER_HEIGHT + GROUP_PADDING,
          width - GROUP_PADDING * 2,
          height - GROUP_HEADER_HEIGHT - GROUP_PADDING * 2,
          group.id,
          group.color
        );

        layoutGroups.push({
          id: group.id,
          name: group.name,
          color: group.color,
          x,
          y,
          width,
          height,
          totalArea: data.value,
          children: innerChildren,
        });
      } else {
        // Ungrouped nodes
        const innerRects = layoutNodesInRect(
          data.nodes as AreaNode[],
          x + PADDING,
          y + PADDING,
          width - PADDING * 2,
          height - PADDING * 2,
          null,
          null
        );
        layoutUngrouped.push(...innerRects);
      }
    }

    return {
      groups: layoutGroups,
      ungrouped: layoutUngrouped,
      totalArea,
    };
  }, [nodes, groups, containerWidth, containerHeight]);
}

// ============================================
// HELPER: Layout nodes within a rectangle
// ============================================

function layoutNodesInRect(
  nodes: AreaNode[],
  x: number,
  y: number,
  width: number,
  height: number,
  groupId: string | null,
  groupColor: string | null
): LayoutRect[] {
  if (nodes.length === 0 || width <= 0 || height <= 0) {
    return [];
  }

  // Build hierarchy for inner treemap
  const innerData = {
    name: 'inner',
    children: nodes.map((n) => ({
      name: n.id,
      value: n.areaPerUnit * n.count,
      node: n,
    })),
  };

  const innerHierarchy = d3
    .hierarchy(innerData)
    .sum((d: any) => d.value || 0)
    .sort((a, b) => (b.value || 0) - (a.value || 0));

  const innerTreemap = d3
    .treemap<any>()
    .size([width, height])
    .padding(PADDING)
    .round(true);

  const innerRoot = innerTreemap(innerHierarchy);

  const results: LayoutRect[] = [];

  for (const leaf of innerRoot.children || []) {
    const node = leaf.data.node as AreaNode;
    const rectWidth = Math.max(MIN_SIZE, leaf.x1 - leaf.x0);
    const rectHeight = Math.max(MIN_SIZE, leaf.y1 - leaf.y0);
    const totalArea = node.areaPerUnit * node.count;

    results.push({
      id: node.id,
      x: x + leaf.x0,
      y: y + leaf.y0,
      width: rectWidth,
      height: rectHeight,
      area: totalArea,
      name: node.name,
      count: node.count,
      areaPerUnit: node.areaPerUnit,
      groupId,
      groupColor,
      isSmall: totalArea < SMALL_AREA_THRESHOLD || rectWidth < 80 || rectHeight < 60,
    });
  }

  return results;
}

// ============================================
// UTILITY: Get contrasting text color
// ============================================

export function getContrastColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// ============================================
// UTILITY: Lighten color for backgrounds
// ============================================

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
