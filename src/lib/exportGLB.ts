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

// Create a text plane with canvas texture (exports properly with GLB)
function createTextPlane(
  text: string,
  fontSize: number,
  color: string = '#000000',
  bgColor: string | null = null
): THREE.Mesh {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  
  // High resolution for crisp text
  const scale = 8;
  const baseFontSize = fontSize * 100; // 0.4m = 40 units
  const padding = 20;
  
  // Measure text first
  context.font = `bold ${baseFontSize * scale}px Arial, sans-serif`;
  const metrics = context.measureText(text);
  
  // Set canvas size based on text
  canvas.width = Math.ceil(metrics.width + padding * 2 * scale);
  canvas.height = Math.ceil(baseFontSize * scale * 1.5 + padding * 2 * scale);
  
  // Fill background if specified
  if (bgColor) {
    context.fillStyle = bgColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  // Draw text
  context.font = `bold ${baseFontSize * scale}px Arial, sans-serif`;
  context.fillStyle = color;
  context.textBaseline = 'middle';
  context.textAlign = 'left';
  context.fillText(text, padding * scale, canvas.height / 2);
  
  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  
  // Calculate plane dimensions in meters
  const planeWidth = fontSize * (canvas.width / canvas.height) * 2;
  const planeHeight = fontSize * 2;
  
  const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: !bgColor,
    side: THREE.DoubleSide,
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = { text, isLabel: true, width: planeWidth, height: planeHeight };
  
  return mesh;
}

// Create a 3D plane mesh for an area
function createAreaMesh(
  area: AreaNode,
  color: string,
  position: { x: number; y: number; z: number }
): THREE.Group {
  const areaGroup = new THREE.Group();
  areaGroup.name = `Area_${area.name.replace(/\s+/g, '_')}`;
  
  const dims = areaToDimensions(area.areaPerUnit * area.count);
  
  // Create the surface plane
  const geometry = new THREE.PlaneGeometry(dims.width, dims.height);
  const material = new THREE.MeshStandardMaterial({
    color: hexToThreeColor(color),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    roughness: 0.7,
    metalness: 0.1,
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = area.name;
  areaGroup.add(mesh);
  
  // Create text label (0.4m font size as specified)
  const totalArea = area.areaPerUnit * area.count;
  const labelText = `${area.name}`;
  const areaText = `${totalArea.toFixed(1)}m²`;
  
  // Name label at lower-right corner
  const nameLabel = createTextPlane(labelText, 0.4, '#ffffff');
  nameLabel.position.set(
    dims.width / 2 - nameLabel.userData.width / 2 - 0.15,
    -dims.height / 2 + nameLabel.userData.height / 2 + 0.15,
    0.02
  );
  areaGroup.add(nameLabel);
  
  // Area size above name
  const sizeLabel = createTextPlane(areaText, 0.3, '#ffffff');
  sizeLabel.position.set(
    dims.width / 2 - sizeLabel.userData.width / 2 - 0.15,
    -dims.height / 2 + sizeLabel.userData.height / 2 + 0.55,
    0.02
  );
  areaGroup.add(sizeLabel);
  
  // Position the entire group
  areaGroup.position.set(position.x, position.y, position.z);
  
  return areaGroup;
}

// Create a group container (frame/folder rectangle)
function createGroupContainer(
  groupData: Group,
  nodes: Record<string, AreaNode>,
  groupPosition: { x: number; y: number },
  areaOffsets: Record<string, { x: number; y: number }>
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
  
  // Layout areas within group
  let currentX = 0;
  let currentY = 0;
  let maxRowHeight = 0;
  const rowWidth = 30;
  const padding = 1;
  
  const areaPositions: Array<{
    node: AreaNode;
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];
  
  memberNodes.forEach((node) => {
    const dims = areaToDimensions(node.areaPerUnit * node.count);
    
    // Check if we need to wrap to next row
    if (currentX + dims.width > rowWidth && currentX > 0) {
      currentX = 0;
      currentY -= maxRowHeight + padding;
      maxRowHeight = 0;
    }
    
    // Use custom offset if available
    const offset = areaOffsets[node.id];
    const x = offset ? offset.x / 50 : currentX; // Scale down from screen coords
    const y = offset ? -offset.y / 50 : currentY;
    
    areaPositions.push({
      node,
      x: offset ? x : currentX + dims.width / 2,
      y: offset ? y : currentY - dims.height / 2,
      width: dims.width,
      height: dims.height,
    });
    
    if (!offset) {
      currentX += dims.width + padding;
      maxRowHeight = Math.max(maxRowHeight, dims.height);
    }
  });
  
  // Calculate bounds
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  areaPositions.forEach((pos) => {
    minX = Math.min(minX, pos.x - pos.width / 2);
    maxX = Math.max(maxX, pos.x + pos.width / 2);
    minY = Math.min(minY, pos.y - pos.height / 2);
    maxY = Math.max(maxY, pos.y + pos.height / 2);
  });
  
  const boundsWidth = maxX - minX + padding * 2;
  const boundsHeight = maxY - minY + padding * 2;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  
  // Create group frame (outline)
  const frameGeometry = new THREE.PlaneGeometry(boundsWidth, boundsHeight);
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.15,
  });
  const frame = new THREE.Mesh(frameGeometry, frameMaterial);
  frame.position.set(centerX, centerY, -0.01);
  group.add(frame);
  
  // Create frame border
  const borderGeometry = new THREE.EdgesGeometry(frameGeometry);
  const borderMaterial = new THREE.LineBasicMaterial({ color: color });
  const border = new THREE.LineSegments(borderGeometry, borderMaterial);
  border.position.set(centerX, centerY, -0.01);
  group.add(border);
  
  // Add group label at top-left corner (colored with group color)
  const groupTotalArea = memberNodes.reduce(
    (sum, n) => sum + n.areaPerUnit * n.count, 0
  );
  const groupLabel = createTextPlane(
    `${groupData.name} (${groupTotalArea.toFixed(1)}m²)`,
    0.5,
    '#ffffff',
    groupData.color
  );
  groupLabel.position.set(
    minX - padding + groupLabel.userData.width / 2 + 0.2,
    maxY + padding + groupLabel.userData.height / 2 + 0.3,
    0
  );
  group.add(groupLabel);
  
  // Add area surfaces
  areaPositions.forEach((pos) => {
    const areaMesh = createAreaMesh(
      pos.node,
      groupData.color,
      { x: pos.x, y: pos.y, z: 0 }
    );
    group.add(areaMesh);
  });
  
  // Position entire group (convert from screen pixels to meters)
  group.position.set(groupPosition.x / 50, -groupPosition.y / 50, 0);
  
  return group;
}

export async function exportToGLB(data: ExportGLBData): Promise<void> {
  const { projectName, nodes, groups, boardLayout } = data;
  
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
  directionalLight.position.set(10, 10, 10);
  scene.add(directionalLight);
  
  // Track which nodes are in groups
  const nodesInGroups = new Set<string>();
  
  // Calculate group bounds for proper offsetting
  const groupsArray = Object.values(groups);
  const groupBounds: Array<{ width: number; height: number }> = [];
  
  // Pre-calculate each group's bounds
  groupsArray.forEach((groupData) => {
    const memberNodes = groupData.members
      .map((id) => nodes[id])
      .filter(Boolean);
    
    if (memberNodes.length === 0) {
      groupBounds.push({ width: 5, height: 5 });
      return;
    }
    
    // Calculate approximate bounds
    let totalWidth = 0;
    let maxHeight = 0;
    const padding = 1;
    const rowWidth = 30;
    let currentRowWidth = 0;
    let rows = 1;
    
    memberNodes.forEach((node) => {
      const dims = areaToDimensions(node.areaPerUnit * node.count);
      if (currentRowWidth + dims.width > rowWidth && currentRowWidth > 0) {
        currentRowWidth = dims.width + padding;
        rows++;
      } else {
        currentRowWidth += dims.width + padding;
      }
      totalWidth = Math.max(totalWidth, currentRowWidth);
      maxHeight = Math.max(maxHeight, dims.height);
    });
    
    groupBounds.push({
      width: totalWidth + padding * 2,
      height: rows * (maxHeight + padding) + 2, // Extra for label
    });
  });
  
  // Calculate grid layout for groups
  let groupOffsetX = 0;
  let groupOffsetY = 0;
  let maxRowHeight = 0;
  const groupSpacing = 5; // Space between groups in meters
  const maxRowWidth = 100; // Max row width before wrapping
  
  const groupPositionsCalculated: Array<{ x: number; y: number }> = [];
  
  groupsArray.forEach((_groupData, index) => {
    const bounds = groupBounds[index];
    
    // Check if we need to wrap to next row
    if (groupOffsetX + bounds.width > maxRowWidth && groupOffsetX > 0) {
      groupOffsetX = 0;
      groupOffsetY -= maxRowHeight + groupSpacing;
      maxRowHeight = 0;
    }
    
    groupPositionsCalculated.push({
      x: groupOffsetX,
      y: groupOffsetY,
    });
    
    groupOffsetX += bounds.width + groupSpacing;
    maxRowHeight = Math.max(maxRowHeight, bounds.height);
  });
  
  // Create groups with their areas - now with proper offsets
  groupsArray.forEach((groupData, index) => {
    groupData.members.forEach((id) => nodesInGroups.add(id));
    
    // Use calculated position (ignoring boardLayout positions to avoid overlap)
    const calculatedPos = groupPositionsCalculated[index];
    // Scale up to match the division by 50 in createGroupContainer
    const position = { x: calculatedPos.x * 50, y: -calculatedPos.y * 50 };
    
    const groupMesh = createGroupContainer(
      groupData,
      nodes,
      position,
      boardLayout.areaOffsets
    );
    scene.add(groupMesh);
  });
  
  // Create ungrouped areas
  const ungroupedNodes = Object.values(nodes).filter(
    (node) => !nodesInGroups.has(node.id)
  );
  
  if (ungroupedNodes.length > 0) {
    const ungroupedGroup = new THREE.Group();
    ungroupedGroup.name = 'Ungrouped_Areas';
    
    let offsetX = 0;
    ungroupedNodes.forEach((node) => {
      const dims = areaToDimensions(node.areaPerUnit * node.count);
      const offset = boardLayout.areaOffsets[node.id];
      
      const areaMesh = createAreaMesh(
        node,
        '#888888', // Gray for ungrouped
        {
          x: offset ? offset.x / 50 : offsetX + dims.width / 2,
          y: offset ? -offset.y / 50 : 0,
          z: 0,
        }
      );
      ungroupedGroup.add(areaMesh);
      
      if (!offset) {
        offsetX += dims.width + 1;
      }
    });
    
    // Position ungrouped below all groups
    const ungroupedY = groupOffsetY - maxRowHeight - groupSpacing * 2;
    ungroupedGroup.position.set(0, ungroupedY, 0);
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
