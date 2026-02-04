import ExcelJS from 'exceljs';
import type { AreaNode, Group } from '@/types';

interface ExportData {
  projectName: string;
  nodes: Record<string, AreaNode>;
  groups: Record<string, Group>;
}

// Convert a hex color to a pastel version (mix with white)
function hexToPastel(hex: string, mixRatio = 0.6): string {
  const color = hex.replace('#', '');
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  
  // Mix with white (255, 255, 255)
  const pastelR = Math.round(r + (255 - r) * mixRatio);
  const pastelG = Math.round(g + (255 - g) * mixRatio);
  const pastelB = Math.round(b + (255 - b) * mixRatio);
  
  return 'FF' + 
    pastelR.toString(16).padStart(2, '0').toUpperCase() +
    pastelG.toString(16).padStart(2, '0').toUpperCase() +
    pastelB.toString(16).padStart(2, '0').toUpperCase();
}

export async function exportToExcel(data: ExportData): Promise<void> {
  const { projectName, nodes, groups } = data;

  const nodesArray = Object.values(nodes);
  const groupsArray = Object.values(groups);

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ArchBrief Tools';
  workbook.created = new Date();

  // Map node IDs to group info
  const nodeToGroup = new Map<string, { name: string; color: string; group: Group }>();
  groupsArray.forEach((group) => {
    group.members.forEach((memberId) => {
      nodeToGroup.set(memberId, { name: group.name, color: group.color, group });
    });
  });

  // Calculate totals
  const totalArea = nodesArray.reduce((sum, node) => sum + node.areaPerUnit * node.count, 0);
  const totalUnits = nodesArray.reduce((sum, node) => sum + node.count, 0);

  // ============================================
  // Sheet 1: Summary
  // ============================================
  const summarySheet = workbook.addWorksheet('Summary');
  
  // Title
  summarySheet.mergeCells('A1:C1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'ARCHBRIEF PROJECT SUMMARY';
  titleCell.font = { size: 18, bold: true, color: { argb: 'FF2563EB' } };
  titleCell.alignment = { horizontal: 'center' };

  // Project info
  summarySheet.getCell('A3').value = 'Project Name:';
  summarySheet.getCell('B3').value = projectName;
  summarySheet.getCell('B3').font = { bold: true };

  summarySheet.getCell('A4').value = 'Export Date:';
  summarySheet.getCell('B4').value = new Date().toLocaleString();

  // Statistics section
  summarySheet.getCell('A6').value = 'STATISTICS';
  summarySheet.getCell('A6').font = { size: 14, bold: true };

  const statsData = [
    ['Total Area Types', nodesArray.length],
    ['Total Groups', groupsArray.length],
    ['Total Area (m²)', Math.round(totalArea * 100) / 100],
    ['Total Units', totalUnits],
  ];

  statsData.forEach((row, idx) => {
    summarySheet.getCell(`A${7 + idx}`).value = row[0] as string;
    const valueCell = summarySheet.getCell(`B${7 + idx}`);
    valueCell.value = row[1] as number;
    valueCell.font = { bold: true };
    if (typeof row[1] === 'number') {
      valueCell.numFmt = '#,##0.00';
    }
  });

  // Set column widths
  summarySheet.columns = [
    { width: 20 },
    { width: 25 },
    { width: 15 },
  ];

  // ============================================
  // Sheet 2: All Areas (Master List)
  // ============================================
  const allAreasSheet = workbook.addWorksheet('All Areas');
  
  // Title
  allAreasSheet.mergeCells('A1:F1');
  const areasTitle = allAreasSheet.getCell('A1');
  areasTitle.value = 'ALL AREAS - MASTER LIST';
  areasTitle.font = { size: 16, bold: true, color: { argb: 'FF2563EB' } };
  areasTitle.alignment = { horizontal: 'center' };

  // Header row
  const areasHeaders = ['Area Name', 'Area/Unit (m²)', 'Count', 'Total Area (m²)', 'Group'];
  const areasHeaderRow = allAreasSheet.getRow(3);
  areasHeaders.forEach((header, idx) => {
    const cell = areasHeaderRow.getCell(idx + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FF374151' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    };
    cell.alignment = { horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // Sort nodes by group
  const sortedNodes = [...nodesArray].sort((a, b) => {
    const groupA = nodeToGroup.get(a.id)?.name || 'zzz_Ungrouped';
    const groupB = nodeToGroup.get(b.id)?.name || 'zzz_Ungrouped';
    if (groupA !== groupB) return groupA.localeCompare(groupB);
    return a.name.localeCompare(b.name);
  });

  // Data rows
  let rowIdx = 4;
  const dataStartRow = 4;
  sortedNodes.forEach((node) => {
    const groupInfo = nodeToGroup.get(node.id);
    const row = allAreasSheet.getRow(rowIdx);
    
    row.getCell(1).value = node.name;
    row.getCell(2).value = node.areaPerUnit;
    row.getCell(2).numFmt = '#,##0.00';
    row.getCell(3).value = node.count;
    // Formula: Area/Unit * Count
    row.getCell(4).value = { formula: `B${rowIdx}*C${rowIdx}` };
    row.getCell(4).numFmt = '#,##0.00';
    row.getCell(5).value = groupInfo?.name || 'Ungrouped';
    
    // Apply pastel color from group to the entire row
    if (groupInfo?.color) {
      const pastelColor = hexToPastel(groupInfo.color, 0.7);
      for (let i = 1; i <= 5; i++) {
        row.getCell(i).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: pastelColor },
        };
      }
    }

    // Apply borders
    for (let i = 1; i <= 5; i++) {
      row.getCell(i).border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    }

    rowIdx++;
  });

  // Totals row with formulas
  rowIdx++;
  const totalRow = allAreasSheet.getRow(rowIdx);
  totalRow.getCell(1).value = 'TOTAL';
  totalRow.getCell(1).font = { bold: true };
  // SUM formula for Count
  totalRow.getCell(3).value = { formula: `SUM(C${dataStartRow}:C${rowIdx - 2})` };
  totalRow.getCell(3).font = { bold: true };
  // SUM formula for Total Area
  totalRow.getCell(4).value = { formula: `SUM(D${dataStartRow}:D${rowIdx - 2})` };
  totalRow.getCell(4).font = { bold: true };
  totalRow.getCell(4).numFmt = '#,##0.00';
  
  for (let i = 1; i <= 5; i++) {
    totalRow.getCell(i).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    };
    totalRow.getCell(i).border = {
      top: { style: 'medium' },
      bottom: { style: 'medium' },
    };
  }

  // Set column widths
  allAreasSheet.columns = [
    { width: 30 },
    { width: 15 },
    { width: 10 },
    { width: 18 },
    { width: 20 },
  ];

  // ============================================
  // Sheet 3: Groups Overview
  // ============================================
  const groupsSheet = workbook.addWorksheet('Groups Overview');
  
  // Title
  groupsSheet.mergeCells('A1:E1');
  const groupsTitle = groupsSheet.getCell('A1');
  groupsTitle.value = 'GROUPS OVERVIEW';
  groupsTitle.font = { size: 16, bold: true, color: { argb: 'FF2563EB' } };
  groupsTitle.alignment = { horizontal: 'center' };

  // Header row
  const groupHeaders = ['Group Name', 'Area Types', 'Total Area (m²)', 'Total Units'];
  const groupHeaderRow = groupsSheet.getRow(3);
  groupHeaders.forEach((header, idx) => {
    const cell = groupHeaderRow.getCell(idx + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FF374151' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    };
    cell.alignment = { horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // Group data
  rowIdx = 4;
  const groupDataStartRow = 4;
  groupsArray.forEach((group) => {
    const memberNodes = group.members.map((id) => nodes[id]).filter(Boolean);
    const groupTotalArea = memberNodes.reduce((sum, n) => sum + n.areaPerUnit * n.count, 0);
    const groupTotalUnits = memberNodes.reduce((sum, n) => sum + n.count, 0);

    const row = groupsSheet.getRow(rowIdx);
    
    // Group name with pastel colored background
    const nameCell = row.getCell(1);
    nameCell.value = group.name;
    nameCell.font = { bold: true };
    
    // Apply pastel color to entire row
    const pastelColor = hexToPastel(group.color, 0.7);
    for (let i = 1; i <= 4; i++) {
      row.getCell(i).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: pastelColor },
      };
    }

    row.getCell(2).value = memberNodes.length;
    row.getCell(3).value = Math.round(groupTotalArea * 100) / 100;
    row.getCell(3).numFmt = '#,##0.00';
    row.getCell(4).value = groupTotalUnits;

    // Apply borders
    for (let i = 1; i <= 4; i++) {
      row.getCell(i).border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
      row.getCell(i).alignment = { horizontal: 'center' };
    }
    row.getCell(1).alignment = { horizontal: 'left' };

    rowIdx++;
  });

  // Ungrouped summary
  const ungroupedNodes = nodesArray.filter((node) => !nodeToGroup.has(node.id));
  if (ungroupedNodes.length > 0) {
    const ungroupedTotalArea = ungroupedNodes.reduce((sum, n) => sum + n.areaPerUnit * n.count, 0);
    const ungroupedTotalUnits = ungroupedNodes.reduce((sum, n) => sum + n.count, 0);

    const row = groupsSheet.getRow(rowIdx);
    row.getCell(1).value = 'Ungrouped';
    row.getCell(1).font = { italic: true };
    row.getCell(2).value = ungroupedNodes.length;
    row.getCell(3).value = Math.round(ungroupedTotalArea * 100) / 100;
    row.getCell(3).numFmt = '#,##0.00';
    row.getCell(4).value = ungroupedTotalUnits;

    for (let i = 1; i <= 4; i++) {
      row.getCell(i).border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
      row.getCell(i).alignment = { horizontal: 'center' };
    }
    row.getCell(1).alignment = { horizontal: 'left' };
    rowIdx++;
  }

  // Totals row with formulas
  rowIdx++;
  const groupsTotalRow = groupsSheet.getRow(rowIdx);
  groupsTotalRow.getCell(1).value = 'TOTAL';
  groupsTotalRow.getCell(1).font = { bold: true };
  // SUM formula for Area Types
  groupsTotalRow.getCell(2).value = { formula: `SUM(B${groupDataStartRow}:B${rowIdx - 2})` };
  groupsTotalRow.getCell(2).font = { bold: true };
  // SUM formula for Total Area
  groupsTotalRow.getCell(3).value = { formula: `SUM(C${groupDataStartRow}:C${rowIdx - 2})` };
  groupsTotalRow.getCell(3).font = { bold: true };
  groupsTotalRow.getCell(3).numFmt = '#,##0.00';
  // SUM formula for Total Units
  groupsTotalRow.getCell(4).value = { formula: `SUM(D${groupDataStartRow}:D${rowIdx - 2})` };
  groupsTotalRow.getCell(4).font = { bold: true };

  for (let i = 1; i <= 4; i++) {
    groupsTotalRow.getCell(i).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    };
    groupsTotalRow.getCell(i).border = {
      top: { style: 'medium' },
      bottom: { style: 'medium' },
    };
    groupsTotalRow.getCell(i).alignment = { horizontal: 'center' };
  }
  groupsTotalRow.getCell(1).alignment = { horizontal: 'left' };

  // Set column widths
  groupsSheet.columns = [
    { width: 25 },
    { width: 12 },
    { width: 18 },
    { width: 12 },
  ];

  // ============================================
  // Individual sheets for each Group
  // ============================================
  groupsArray.forEach((group) => {
    const memberNodes = group.members.map((id) => nodes[id]).filter(Boolean);
    if (memberNodes.length === 0) return;

    // Sanitize sheet name
    let sheetName = group.name.replace(/[\\/*?[\]:]/g, '').substring(0, 28);
    let counter = 1;
    let finalName = sheetName;
    while (workbook.worksheets.some((ws: { name: string }) => ws.name === finalName)) {
      finalName = `${sheetName}_${counter}`;
      counter++;
    }

    const sheet = workbook.addWorksheet(finalName);
    const pastelColor = hexToPastel(group.color, 0.6);

    // Title with pastel group color
    sheet.mergeCells('A1:D1');
    const groupTitle = sheet.getCell('A1');
    groupTitle.value = group.name.toUpperCase();
    groupTitle.font = { size: 16, bold: true };
    groupTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: pastelColor },
    };
    groupTitle.alignment = { horizontal: 'center' };

    // Header row
    const headers = ['Area Name', 'Area/Unit (m²)', 'Count', 'Total Area (m²)'];
    const headerRow = sheet.getRow(3);
    headers.forEach((header, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: pastelColor },
      };
      cell.alignment = { horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Data rows with formulas
    let dataRowIdx = 4;
    const groupDataStart = 4;
    memberNodes.forEach((node) => {
      const row = sheet.getRow(dataRowIdx);
      row.getCell(1).value = node.name;
      row.getCell(2).value = node.areaPerUnit;
      row.getCell(2).numFmt = '#,##0.00';
      row.getCell(3).value = node.count;
      // Formula: Area/Unit * Count
      row.getCell(4).value = { formula: `B${dataRowIdx}*C${dataRowIdx}` };
      row.getCell(4).numFmt = '#,##0.00';

      for (let i = 1; i <= 4; i++) {
        row.getCell(i).border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      }

      // Alternate row shading with very light gray
      if (dataRowIdx % 2 === 1) {
        for (let i = 1; i <= 4; i++) {
          row.getCell(i).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9FAFB' },
          };
        }
      }

      dataRowIdx++;
    });

    // Totals with formulas
    dataRowIdx++;
    const totalsRow = sheet.getRow(dataRowIdx);
    totalsRow.getCell(1).value = 'TOTAL';
    totalsRow.getCell(1).font = { bold: true };
    // SUM formula for Count
    totalsRow.getCell(3).value = { formula: `SUM(C${groupDataStart}:C${dataRowIdx - 2})` };
    totalsRow.getCell(3).font = { bold: true };
    // SUM formula for Total Area
    totalsRow.getCell(4).value = { formula: `SUM(D${groupDataStart}:D${dataRowIdx - 2})` };
    totalsRow.getCell(4).font = { bold: true };
    totalsRow.getCell(4).numFmt = '#,##0.00';

    for (let i = 1; i <= 4; i++) {
      totalsRow.getCell(i).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: pastelColor },
      };
      totalsRow.getCell(i).font = { bold: true };
      totalsRow.getCell(i).border = {
        top: { style: 'medium' },
        bottom: { style: 'medium' },
      };
    }

    // Set column widths
    sheet.columns = [
      { width: 30 },
      { width: 15 },
      { width: 10 },
      { width: 18 },
    ];
  });

  // ============================================
  // Ungrouped sheet (if any)
  // ============================================
  if (ungroupedNodes.length > 0) {
    const sheet = workbook.addWorksheet('Ungrouped');

    // Title
    sheet.mergeCells('A1:D1');
    const title = sheet.getCell('A1');
    title.value = 'UNGROUPED AREAS';
    title.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    };
    title.font = { size: 16, bold: true, color: { argb: 'FF374151' } };
    title.alignment = { horizontal: 'center' };

    // Header row
    const headers = ['Area Name', 'Area/Unit (m²)', 'Count', 'Total Area (m²)'];
    const headerRow = sheet.getRow(3);
    headers.forEach((header, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FF374151' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5E7EB' },
      };
      cell.alignment = { horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Data rows with formulas
    let dataRowIdx = 4;
    const ungroupedDataStart = 4;
    ungroupedNodes.forEach((node) => {
      const row = sheet.getRow(dataRowIdx);
      row.getCell(1).value = node.name;
      row.getCell(2).value = node.areaPerUnit;
      row.getCell(2).numFmt = '#,##0.00';
      row.getCell(3).value = node.count;
      // Formula: Area/Unit * Count
      row.getCell(4).value = { formula: `B${dataRowIdx}*C${dataRowIdx}` };
      row.getCell(4).numFmt = '#,##0.00';

      for (let i = 1; i <= 4; i++) {
        row.getCell(i).border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      }

      if (dataRowIdx % 2 === 0) {
        for (let i = 1; i <= 4; i++) {
          row.getCell(i).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9FAFB' },
          };
        }
      }

      dataRowIdx++;
    });

    // Totals with formulas
    dataRowIdx++;
    const totalsRow = sheet.getRow(dataRowIdx);
    totalsRow.getCell(1).value = 'TOTAL';
    totalsRow.getCell(1).font = { bold: true };
    // SUM formula for Count
    totalsRow.getCell(3).value = { formula: `SUM(C${ungroupedDataStart}:C${dataRowIdx - 2})` };
    totalsRow.getCell(3).font = { bold: true };
    // SUM formula for Total Area
    totalsRow.getCell(4).value = { formula: `SUM(D${ungroupedDataStart}:D${dataRowIdx - 2})` };
    totalsRow.getCell(4).font = { bold: true };
    totalsRow.getCell(4).numFmt = '#,##0.00';

    for (let i = 1; i <= 4; i++) {
      totalsRow.getCell(i).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5E7EB' },
      };
      totalsRow.getCell(i).border = {
        top: { style: 'medium' },
        bottom: { style: 'medium' },
      };
    }

    sheet.columns = [
      { width: 30 },
      { width: 15 },
      { width: 10 },
      { width: 18 },
    ];
  }

  // ============================================
  // Download
  // ============================================
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName.replace(/\s+/g, '_')}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
