import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { AreaNode, Group } from '@/types';
import type { BoardLayout } from '@/stores/projectStore';

interface ExportGLBData {
  projectName: string;
  nodes: Record<string, AreaNode>;
  groups: Record<string, Group>;
  boardLayout: BoardLayout;
}

// Convert hex color to THREE.Color
function hexToThreeColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

// Calculate rectangle dimensions from area (assuming roughly square proportions)
function areaToDimensions(areaSqM: number): { width: number; height: number } {
  const side = Math.sqrt(areaSqM);
  return { width: side, height: side };
}

// Create a 2D rectangle outline for an area (line geometry, no mesh)
// Rectangle is on XZ plane (horizontal floor)
function createAreaMesh(
  area: AreaNode,
  color: string,
  position: { x: number; y: number; z: number }
): THREE.Group {
  const areaGroup = new THREE.Group();
  areaGroup.name = `Area_${area.name.replace(/\s+/g, '_')}`;
  
  const dims = areaToDimensions(area.areaPerUnit * area.count);
  const totalArea = area.areaPerUnit * area.count;
  
  // Create rectangle outline using line geometry (same as groups)
  const halfW = dims.width / 2;
  const halfD = dims.height / 2;
  
  const points = [
    new THREE.Vector3(-halfW, 0, -halfD),
    new THREE.Vector3(halfW, 0, -halfD),
    new THREE.Vector3(halfW, 0, halfD),
    new THREE.Vector3(-halfW, 0, halfD),
    new THREE.Vector3(-halfW, 0, -halfD), // Close the rectangle
  ];
  
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: hexToThreeColor(color),
    linewidth: 2,
  });
  
  const line = new THREE.Line(geometry, material);
  line.name = area.name;
  // Store metadata in userData for reference (not visible, but accessible)
  line.userData = {
    areaName: area.name,
    totalArea: totalArea,
    areaPerUnit: area.areaPerUnit,
    count: area.count,
  };
  areaGroup.add(line);
  
  // Position the entire group
  areaGroup.position.set(position.x, position.y, position.z);
  
  return areaGroup;
}

// Create a group container (2D rectangle outline, no text)
// Layout is on XZ plane (horizontal floor)
function createGroupContainer(
  groupData: Group,
  nodes: Record<string, AreaNode>,
  groupPosition: { x: number; z: number }
): THREE.Group {
  const group = new THREE.Group();
  group.name = `Group_${groupData.name.replace(/\s+/g, '_')}`;
  
  const color = hexToThreeColor(groupData.color);
  
  // Get member nodes
  const memberNodes = groupData.members
    .map((id) => nodes[id])
    .filter(Boolean);
  
  if (memberNodes.length === 0) {
    return group;
  }
  
  // Sort areas by size (largest first) for better packing
  const sortedNodes = [...memberNodes].sort((a, b) => 
    (b.areaPerUnit * b.count) - (a.areaPerUnit * a.count)
  );
  
  // Layout areas within group using simple row-based packing
  // No custom offsets - use calculated positions to avoid overlaps
  const padding = 1; // 1 meter padding between areas
  const maxRowWidth = 50; // Max row width before wrapping
  
  let currentX = 0;
  let currentZ = 0;
  let maxRowDepth = 0;
  
  const areaPositions: Array<{
    node: AreaNode;
    x: number;
    z: number;
    width: number;
    depth: number;
  }> = [];
  
  sortedNodes.forEach((node) => {
    const dims = areaToDimensions(node.areaPerUnit * node.count);
    
    // Check if we need to wrap to next row
    if (currentX + dims.width > maxRowWidth && currentX > 0) {
      currentX = 0;
      currentZ += maxRowDepth + padding;
      maxRowDepth = 0;
    }
    
    areaPositions.push({
      node,
      x: currentX + dims.width / 2,
      z: currentZ + dims.height / 2,
      width: dims.width,
      depth: dims.height,
    });
    
    currentX += dims.width + padding;
    maxRowDepth = Math.max(maxRowDepth, dims.height);
  });
  
  // Calculate bounds
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  
  areaPositions.forEach((pos) => {
    minX = Math.min(minX, pos.x - pos.width / 2);
    maxX = Math.max(maxX, pos.x + pos.width / 2);
    minZ = Math.min(minZ, pos.z - pos.depth / 2);
    maxZ = Math.max(maxZ, pos.z + pos.depth / 2);
  });
  
  const boundsWidth = maxX - minX + padding * 2;
  const boundsDepth = maxZ - minZ + padding * 2;
  
  // Create group frame as 2D rectangle outline on XZ plane (horizontal)
  const framePoints = [
    new THREE.Vector3(minX - padding, 0, minZ - padding),
    new THREE.Vector3(maxX + padding, 0, minZ - padding),
    new THREE.Vector3(maxX + padding, 0, maxZ + padding),
    new THREE.Vector3(minX - padding, 0, maxZ + padding),
    new THREE.Vector3(minX - padding, 0, minZ - padding), // Close the rectangle
  ];
  
  const frameGeometry = new THREE.BufferGeometry().setFromPoints(framePoints);
  const frameMaterial = new THREE.LineBasicMaterial({
    color: color,
    linewidth: 2,
  });
  const frameLine = new THREE.Line(frameGeometry, frameMaterial);
  frameLine.name = `${groupData.name}_outline`;
  
  // Store group metadata in userData
  const groupTotalArea = memberNodes.reduce(
    (sum, n) => sum + n.areaPerUnit * n.count, 0
  );
  frameLine.userData = {
    groupName: groupData.name,
    totalArea: groupTotalArea,
    memberCount: memberNodes.length,
    color: groupData.color,
    width: boundsWidth,
    depth: boundsDepth,
  };
  group.add(frameLine);
  
  // Add area surfaces (2D shapes on floor)
  areaPositions.forEach((pos) => {
    const areaMesh = createAreaMesh(
      pos.node,
      groupData.color,
      { x: pos.x, y: 0, z: pos.z } // On the floor
    );
    group.add(areaMesh);
  });
  
  // Position entire group on XZ plane
  group.position.set(groupPosition.x, 0, groupPosition.z);
  
  return group;
}

// Create a single rectangle representing the summed area of a group
function createGroupSummedRectangle(
  groupData: Group,
  nodes: Record<string, AreaNode>,
  position: { x: number; z: number }
): THREE.Group {
  const group = new THREE.Group();
  group.name = `GroupSum_${groupData.name.replace(/\s+/g, '_')}`;
  
  const color = hexToThreeColor(groupData.color);
  
  // Get member nodes and calculate total area
  const memberNodes = groupData.members
    .map((id) => nodes[id])
    .filter(Boolean);
  
  if (memberNodes.length === 0) {
    return group;
  }
  
  const totalArea = memberNodes.reduce(
    (sum, n) => sum + n.areaPerUnit * n.count, 0
  );
  
  // Create a single rectangle with the total area
  const dims = areaToDimensions(totalArea);
  const halfW = dims.width / 2;
  const halfD = dims.height / 2;
  
  const points = [
    new THREE.Vector3(-halfW, 0, -halfD),
    new THREE.Vector3(halfW, 0, -halfD),
    new THREE.Vector3(halfW, 0, halfD),
    new THREE.Vector3(-halfW, 0, halfD),
    new THREE.Vector3(-halfW, 0, -halfD),
  ];
  
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: color,
    linewidth: 2,
  });
  
  const line = new THREE.Line(geometry, material);
  line.name = `${groupData.name}_summed`;
  line.userData = {
    groupName: groupData.name,
    totalArea: totalArea,
    memberCount: memberNodes.length,
    isSummed: true,
    width: dims.width,
    depth: dims.height,
  };
  group.add(line);
  
  group.position.set(position.x + halfW, 0, position.z + halfD);
  
  return group;
}

// Create a rectangle for the entire project program
function createProjectRectangle(
  projectName: string,
  width: number,
  depth: number,
  position: { x: number; z: number }
): THREE.Group {
  const group = new THREE.Group();
  group.name = `Project_${projectName.replace(/\s+/g, '_')}`;
  
  const halfW = width / 2;
  const halfD = depth / 2;
  
  const points = [
    new THREE.Vector3(-halfW, 0, -halfD),
    new THREE.Vector3(halfW, 0, -halfD),
    new THREE.Vector3(halfW, 0, halfD),
    new THREE.Vector3(-halfW, 0, halfD),
    new THREE.Vector3(-halfW, 0, -halfD),
  ];
  
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0x333333, // Dark gray for project outline
    linewidth: 3,
  });
  
  const line = new THREE.Line(geometry, material);
  line.name = 'ProjectProgram';
  line.userData = {
    projectName: projectName,
    totalArea: width * depth,
    isProjectProgram: true,
    width: width,
    depth: depth,
  };
  group.add(line);
  
  group.position.set(position.x + halfW, 0, position.z + halfD);
  
  return group;
}

// Create a fixed-height rectangle (20m deep, length calculated from area, extends to the right)
function createFixedWidthRectangle(
  groupData: Group,
  nodes: Record<string, AreaNode>,
  fixedDepth: number,
  position: { x: number; z: number }
): { group: THREE.Group; length: number; depth: number } {
  const group = new THREE.Group();
  group.name = `GroupStrip_${groupData.name.replace(/\s+/g, '_')}`;
  
  const color = hexToThreeColor(groupData.color);
  
  const memberNodes = groupData.members
    .map((id) => nodes[id])
    .filter(Boolean);
  
  if (memberNodes.length === 0) {
    return { group, length: 0, depth: fixedDepth };
  }
  
  const totalArea = memberNodes.reduce(
    (sum, n) => sum + n.areaPerUnit * n.count, 0
  );
  
  // Calculate length to match area: area = depth * length
  // Length extends along X axis (to the right)
  const length = totalArea / fixedDepth;
  
  // Rectangle: starts at left edge (x=0), extends right
  // Depth is fixed along Z axis
  const points = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(length, 0, 0),
    new THREE.Vector3(length, 0, fixedDepth),
    new THREE.Vector3(0, 0, fixedDepth),
    new THREE.Vector3(0, 0, 0),
  ];
  
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: color,
    linewidth: 2,
  });
  
  const line = new THREE.Line(geometry, material);
  line.name = `${groupData.name}_strip`;
  line.userData = {
    groupName: groupData.name,
    totalArea: totalArea,
    fixedDepth: fixedDepth,
    calculatedLength: length,
    isStrip: true,
  };
  group.add(line);
  
  group.position.set(position.x, 0, position.z);
  
  return { group, length, depth: fixedDepth };
}

export async function exportToGLB(data: ExportGLBData): Promise<void> {
  const { projectName, nodes, groups } = data;
  
  // Create scene
  const scene = new THREE.Scene();
  scene.name = projectName;
  scene.userData = {
    generator: 'ArchBrief Tools',
    version: '1.0.0',
    exportDate: new Date().toISOString(),
  };
  
  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.position.set(10, 20, 10);
  scene.add(directionalLight);
  
  // Track which nodes are in groups
  const nodesInGroups = new Set<string>();
  
  // Calculate group bounds for proper offsetting
  const groupsArray = Object.values(groups);
  const groupBounds: Array<{ width: number; depth: number }> = [];
  
  // Pre-calculate each group's bounds (sorting areas by size for better packing)
  groupsArray.forEach((groupData) => {
    const memberNodes = groupData.members
      .map((id) => nodes[id])
      .filter(Boolean);
    
    if (memberNodes.length === 0) {
      groupBounds.push({ width: 5, depth: 5 });
      return;
    }
    
    // Sort by size for better packing
    const sortedNodes = [...memberNodes].sort((a, b) => 
      (b.areaPerUnit * b.count) - (a.areaPerUnit * a.count)
    );
    
    // Calculate bounds with row-based packing
    const padding = 1;
    const maxRowWidth = 50;
    let currentX = 0;
    let currentZ = 0;
    let maxRowDepth = 0;
    let totalWidth = 0;
    
    sortedNodes.forEach((node) => {
      const dims = areaToDimensions(node.areaPerUnit * node.count);
      if (currentX + dims.width > maxRowWidth && currentX > 0) {
        currentX = 0;
        currentZ += maxRowDepth + padding;
        maxRowDepth = 0;
      }
      currentX += dims.width + padding;
      totalWidth = Math.max(totalWidth, currentX);
      maxRowDepth = Math.max(maxRowDepth, dims.height);
    });
    
    groupBounds.push({
      width: totalWidth + padding * 2,
      depth: currentZ + maxRowDepth + padding * 2,
    });
  });
  
  // Calculate grid layout for groups on XZ plane
  let groupOffsetX = 0;
  let groupOffsetZ = 0;
  let maxRowDepth = 0;
  const groupSpacing = 8; // Space between groups in meters
  const maxRowWidth = 150; // Max row width before wrapping
  
  const groupPositionsCalculated: Array<{ x: number; z: number }> = [];
  
  groupsArray.forEach((_groupData, index) => {
    const bounds = groupBounds[index];
    
    // Check if we need to wrap to next row
    if (groupOffsetX + bounds.width > maxRowWidth && groupOffsetX > 0) {
      groupOffsetX = 0;
      groupOffsetZ += maxRowDepth + groupSpacing;
      maxRowDepth = 0;
    }
    
    groupPositionsCalculated.push({
      x: groupOffsetX,
      z: groupOffsetZ,
    });
    
    groupOffsetX += bounds.width + groupSpacing;
    maxRowDepth = Math.max(maxRowDepth, bounds.depth);
  });
  
  // Create groups with their areas
  groupsArray.forEach((groupData, index) => {
    groupData.members.forEach((id) => nodesInGroups.add(id));
    
    const calculatedPos = groupPositionsCalculated[index];
    
    const groupMesh = createGroupContainer(
      groupData,
      nodes,
      { x: calculatedPos.x, z: calculatedPos.z }
    );
    scene.add(groupMesh);
  });
  
  // Calculate position for summed rectangles (after detailed groups)
  const summedStartZ = groupOffsetZ + maxRowDepth + groupSpacing * 3;
  
  // Calculate total project area first
  let totalProjectArea = 0;
  const ungroupedNodes = Object.values(nodes).filter(
    (node) => !nodesInGroups.has(node.id)
  );
  
  groupsArray.forEach((groupData) => {
    const memberNodes = groupData.members
      .map((id) => nodes[id])
      .filter(Boolean);
    totalProjectArea += memberNodes.reduce(
      (sum, n) => sum + n.areaPerUnit * n.count, 0
    );
  });
  
  ungroupedNodes.forEach((node) => {
    totalProjectArea += node.areaPerUnit * node.count;
  });
  
  // === SECTION 2: Summed group rectangles INSIDE project rectangle ===
  const summedGroup = new THREE.Group();
  summedGroup.name = 'ProjectProgram_WithGroups';
  
  const summedSpacing = 2;
  const summedPadding = 3; // Padding inside project rectangle
  
  // Calculate dimensions for each group's summed rectangle
  const groupDims: Array<{ width: number; depth: number; area: number }> = [];
  groupsArray.forEach((groupData) => {
    const memberNodes = groupData.members
      .map((id) => nodes[id])
      .filter(Boolean);
    const groupTotalArea = memberNodes.reduce(
      (sum, n) => sum + n.areaPerUnit * n.count, 0
    );
    const dims = areaToDimensions(groupTotalArea);
    groupDims.push({ width: dims.width, depth: dims.height, area: groupTotalArea });
  });
  
  // Calculate total width needed for all summed rectangles in a row
  const totalSummedWidth = groupDims.reduce((sum, d) => sum + d.width, 0) + 
    (groupDims.length - 1) * summedSpacing;
  const maxSummedDepth = Math.max(...groupDims.map(d => d.depth), 10);
  
  // Project rectangle dimensions (to contain all summed rectangles)
  const projectWidth = totalSummedWidth + summedPadding * 2;
  const projectDepth = maxSummedDepth + summedPadding * 2;
  
  // Create project outline rectangle first
  const projectRect = createProjectRectangle(
    projectName,
    projectWidth,
    projectDepth,
    { x: 0, z: 0 }
  );
  summedGroup.add(projectRect);
  
  // Place summed group rectangles inside the project rectangle
  let innerOffsetX = summedPadding;
  groupsArray.forEach((groupData, index) => {
    const dims = groupDims[index];
    
    const summedRect = createGroupSummedRectangle(
      groupData,
      nodes,
      { x: innerOffsetX, z: summedPadding + (maxSummedDepth - dims.depth) / 2 }
    );
    summedGroup.add(summedRect);
    
    innerOffsetX += dims.width + summedSpacing;
  });
  
  summedGroup.position.set(0, 0, summedStartZ);
  scene.add(summedGroup);
  
  // === SECTION 3: Fixed-depth strip rectangles (20m deep, vertical column, length extends right) ===
  const stripDepth = 20; // Fixed 20m depth
  const stripStartZ = summedStartZ + projectDepth + groupSpacing * 3;
  
  const stripGroup = new THREE.Group();
  stripGroup.name = 'Strip_Rectangles';
  
  let stripOffsetZ = 0;
  const stripSpacing = 2;
  
  groupsArray.forEach((groupData) => {
    const memberNodes = groupData.members
      .map((id) => nodes[id])
      .filter(Boolean);
    
    if (memberNodes.length === 0) return;
    
    const result = createFixedWidthRectangle(
      groupData,
      nodes,
      stripDepth,
      { x: 0, z: stripOffsetZ } // Aligned to left (x=0), stacked vertically (z)
    );
    stripGroup.add(result.group);
    
    stripOffsetZ += stripDepth + stripSpacing;
  });
  
  stripGroup.position.set(0, 0, stripStartZ);
  scene.add(stripGroup);

  // Create ungrouped areas (detailed)
  
  if (ungroupedNodes.length > 0) {
    const ungroupedGroup = new THREE.Group();
    ungroupedGroup.name = 'Ungrouped_Areas';
    
    // Sort ungrouped by size
    const sortedUngrouped = [...ungroupedNodes].sort((a, b) => 
      (b.areaPerUnit * b.count) - (a.areaPerUnit * a.count)
    );
    
    let offsetX = 0;
    let offsetZ = 0;
    let maxRowDepthUngrouped = 0;
    const padding = 1;
    const maxRowWidthUngrouped = 50;
    
    sortedUngrouped.forEach((node) => {
      const dims = areaToDimensions(node.areaPerUnit * node.count);
      
      // Check if we need to wrap to next row
      if (offsetX + dims.width > maxRowWidthUngrouped && offsetX > 0) {
        offsetX = 0;
        offsetZ += maxRowDepthUngrouped + padding;
        maxRowDepthUngrouped = 0;
      }
      
      const areaMesh = createAreaMesh(
        node,
        '#888888', // Gray for ungrouped
        {
          x: offsetX + dims.width / 2,
          y: 0, // On the floor
          z: offsetZ + dims.height / 2,
        }
      );
      ungroupedGroup.add(areaMesh);
      
      offsetX += dims.width + padding;
      maxRowDepthUngrouped = Math.max(maxRowDepthUngrouped, dims.height);
    });
    
    // Position ungrouped after all groups
    const ungroupedZ = groupOffsetZ + maxRowDepth + groupSpacing * 2;
    ungroupedGroup.position.set(0, 0, ungroupedZ);
    scene.add(ungroupedGroup);
  }
  
  // Export to GLB
  const exporter = new GLTFExporter();
  
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectName.replace(/\s+/g, '_')}.glb`;
        a.click();
        
        URL.revokeObjectURL(url);
        resolve();
      },
      (error) => {
        console.error('GLB export error:', error);
        reject(error);
      },
      { binary: true }
    );
  });
}
