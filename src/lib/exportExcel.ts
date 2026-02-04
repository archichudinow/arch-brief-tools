import ExcelJS from 'exceljs';
import type { AreaNode, Group } from '@/types';

interface ExportData {
  projectName: string;
  nodes: Record<string, AreaNode>;
  groups: Record<string, Group>;
}

// Convert hex color to ARGB format for ExcelJS (without #)
function hexToArgb(hex: string): string {
  return 'FF' + hex.replace('#', '').toUpperCase();
}

// Determine if color is light or dark to choose contrasting text
function isLightColor(hex: string): boolean {
  const color = hex.replace('#', '');
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
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
  const areasHeaders = ['Area Name', 'Area/Unit (m²)', 'Count', 'Total Area (m²)', 'Group', 'Color'];
  const areasHeaderRow = allAreasSheet.getRow(3);
  areasHeaders.forEach((header, idx) => {
    const cell = areasHeaderRow.getCell(idx + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF374151' },
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
  sortedNodes.forEach((node) => {
    const groupInfo = nodeToGroup.get(node.id);
    const row = allAreasSheet.getRow(rowIdx);
    
    row.getCell(1).value = node.name;
    row.getCell(2).value = Math.round(node.areaPerUnit * 100) / 100;
    row.getCell(2).numFmt = '#,##0.00';
    row.getCell(3).value = node.count;
    row.getCell(4).value = Math.round(node.areaPerUnit * node.count * 100) / 100;
    row.getCell(4).numFmt = '#,##0.00';
    row.getCell(5).value = groupInfo?.name || 'Ungrouped';
    
    // Color cell with actual color
    if (groupInfo?.color) {
      const colorCell = row.getCell(6);
      colorCell.value = groupInfo.color;
      colorCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: hexToArgb(groupInfo.color) },
      };
      colorCell.font = {
        color: { argb: isLightColor(groupInfo.color) ? 'FF000000' : 'FFFFFFFF' },
      };
    } else {
      row.getCell(6).value = '-';
    }

    // Apply borders
    for (let i = 1; i <= 6; i++) {
      row.getCell(i).border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    }

    // Alternate row colors
    if (rowIdx % 2 === 0) {
      for (let i = 1; i <= 5; i++) {
        row.getCell(i).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' },
        };
      }
    }

    rowIdx++;
  });

  // Totals row
  rowIdx++;
  const totalRow = allAreasSheet.getRow(rowIdx);
  totalRow.getCell(1).value = 'TOTAL';
  totalRow.getCell(1).font = { bold: true };
  totalRow.getCell(3).value = totalUnits;
  totalRow.getCell(3).font = { bold: true };
  totalRow.getCell(4).value = Math.round(totalArea * 100) / 100;
  totalRow.getCell(4).font = { bold: true };
  totalRow.getCell(4).numFmt = '#,##0.00';
  
  for (let i = 1; i <= 6; i++) {
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
    { width: 12 },
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
  const groupHeaders = ['Group Name', 'Color', 'Area Types', 'Total Area (m²)', 'Total Units'];
  const groupHeaderRow = groupsSheet.getRow(3);
  groupHeaders.forEach((header, idx) => {
    const cell = groupHeaderRow.getCell(idx + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF374151' },
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
  groupsArray.forEach((group) => {
    const memberNodes = group.members.map((id) => nodes[id]).filter(Boolean);
    const groupTotalArea = memberNodes.reduce((sum, n) => sum + n.areaPerUnit * n.count, 0);
    const groupTotalUnits = memberNodes.reduce((sum, n) => sum + n.count, 0);

    const row = groupsSheet.getRow(rowIdx);
    
    // Group name with colored background
    const nameCell = row.getCell(1);
    nameCell.value = group.name;
    nameCell.font = { bold: true, color: { argb: isLightColor(group.color) ? 'FF000000' : 'FFFFFFFF' } };
    nameCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: hexToArgb(group.color) },
    };

    // Color cell
    const colorCell = row.getCell(2);
    colorCell.value = group.color;
    colorCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: hexToArgb(group.color) },
    };
    colorCell.font = { color: { argb: isLightColor(group.color) ? 'FF000000' : 'FFFFFFFF' } };

    row.getCell(3).value = memberNodes.length;
    row.getCell(4).value = Math.round(groupTotalArea * 100) / 100;
    row.getCell(4).numFmt = '#,##0.00';
    row.getCell(5).value = groupTotalUnits;

    // Apply borders
    for (let i = 1; i <= 5; i++) {
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
    row.getCell(2).value = '-';
    row.getCell(3).value = ungroupedNodes.length;
    row.getCell(4).value = Math.round(ungroupedTotalArea * 100) / 100;
    row.getCell(4).numFmt = '#,##0.00';
    row.getCell(5).value = ungroupedTotalUnits;

    for (let i = 1; i <= 5; i++) {
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

  // Totals row
  rowIdx++;
  const groupsTotalRow = groupsSheet.getRow(rowIdx);
  groupsTotalRow.getCell(1).value = 'TOTAL';
  groupsTotalRow.getCell(1).font = { bold: true };
  groupsTotalRow.getCell(3).value = nodesArray.length;
  groupsTotalRow.getCell(3).font = { bold: true };
  groupsTotalRow.getCell(4).value = Math.round(totalArea * 100) / 100;
  groupsTotalRow.getCell(4).font = { bold: true };
  groupsTotalRow.getCell(4).numFmt = '#,##0.00';
  groupsTotalRow.getCell(5).value = totalUnits;
  groupsTotalRow.getCell(5).font = { bold: true };

  for (let i = 1; i <= 5; i++) {
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

    // Title with group color
    sheet.mergeCells('A1:D1');
    const groupTitle = sheet.getCell('A1');
    groupTitle.value = group.name.toUpperCase();
    groupTitle.font = { size: 16, bold: true, color: { argb: isLightColor(group.color) ? 'FF000000' : 'FFFFFFFF' } };
    groupTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: hexToArgb(group.color) },
    };
    groupTitle.alignment = { horizontal: 'center' };

    // Color info
    sheet.getCell('A2').value = `Color: ${group.color}`;
    sheet.getCell('A2').font = { italic: true, size: 10 };

    // Header row
    const headers = ['Area Name', 'Area/Unit (m²)', 'Count', 'Total Area (m²)'];
    const headerRow = sheet.getRow(4);
    headers.forEach((header, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: hexToArgb(group.color) },
      };
      cell.alignment = { horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Data rows
    let dataRowIdx = 5;
    memberNodes.forEach((node) => {
      const row = sheet.getRow(dataRowIdx);
      row.getCell(1).value = node.name;
      row.getCell(2).value = Math.round(node.areaPerUnit * 100) / 100;
      row.getCell(2).numFmt = '#,##0.00';
      row.getCell(3).value = node.count;
      row.getCell(4).value = Math.round(node.areaPerUnit * node.count * 100) / 100;
      row.getCell(4).numFmt = '#,##0.00';

      for (let i = 1; i <= 4; i++) {
        row.getCell(i).border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      }

      // Alternate row shading
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

    // Totals
    const groupTotalArea = memberNodes.reduce((sum, n) => sum + n.areaPerUnit * n.count, 0);
    const groupTotalUnits = memberNodes.reduce((sum, n) => sum + n.count, 0);

    dataRowIdx++;
    const totalsRow = sheet.getRow(dataRowIdx);
    totalsRow.getCell(1).value = 'TOTAL';
    totalsRow.getCell(1).font = { bold: true };
    totalsRow.getCell(3).value = groupTotalUnits;
    totalsRow.getCell(3).font = { bold: true };
    totalsRow.getCell(4).value = Math.round(groupTotalArea * 100) / 100;
    totalsRow.getCell(4).font = { bold: true };
    totalsRow.getCell(4).numFmt = '#,##0.00';

    for (let i = 1; i <= 4; i++) {
      totalsRow.getCell(i).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: hexToArgb(group.color) },
      };
      totalsRow.getCell(i).font = { 
        bold: true, 
        color: { argb: isLightColor(group.color) ? 'FF000000' : 'FFFFFFFF' } 
      };
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
      fgColor: { argb: 'FF6B7280' },
    };
    title.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    title.alignment = { horizontal: 'center' };

    // Header row
    const headers = ['Area Name', 'Area/Unit (m²)', 'Count', 'Total Area (m²)'];
    const headerRow = sheet.getRow(3);
    headers.forEach((header, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF6B7280' },
      };
      cell.alignment = { horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Data rows
    let dataRowIdx = 4;
    ungroupedNodes.forEach((node) => {
      const row = sheet.getRow(dataRowIdx);
      row.getCell(1).value = node.name;
      row.getCell(2).value = Math.round(node.areaPerUnit * 100) / 100;
      row.getCell(2).numFmt = '#,##0.00';
      row.getCell(3).value = node.count;
      row.getCell(4).value = Math.round(node.areaPerUnit * node.count * 100) / 100;
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

    // Totals
    const ungroupedTotalArea = ungroupedNodes.reduce((sum, n) => sum + n.areaPerUnit * n.count, 0);
    const ungroupedTotalUnits = ungroupedNodes.reduce((sum, n) => sum + n.count, 0);

    dataRowIdx++;
    const totalsRow = sheet.getRow(dataRowIdx);
    totalsRow.getCell(1).value = 'TOTAL';
    totalsRow.getCell(1).font = { bold: true };
    totalsRow.getCell(3).value = ungroupedTotalUnits;
    totalsRow.getCell(3).font = { bold: true };
    totalsRow.getCell(4).value = Math.round(ungroupedTotalArea * 100) / 100;
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
