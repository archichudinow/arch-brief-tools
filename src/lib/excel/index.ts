import * as XLSX from 'xlsx';
import type { ProgramItem, NormalizedProgram } from '@/types';

export interface ParsedExcelData {
  programs: Partial<ProgramItem>[];
  rawData: string[][];
}

/**
 * Parse an Excel file and extract program data
 */
export async function parseExcelFile(file: File): Promise<ParsedExcelData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first sheet
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert to array of arrays
        const rawData: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        // Try to extract program data
        const programs = extractProgramsFromRows(rawData);
        
        resolve({ programs, rawData });
      } catch (error) {
        reject(new Error('Failed to parse Excel file'));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Try to extract program items from Excel rows
 * Looks for columns that might be: name, quantity, area per unit, total area
 */
function extractProgramsFromRows(rows: string[][]): Partial<ProgramItem>[] {
  const programs: Partial<ProgramItem>[] = [];
  
  // Skip header row if it looks like headers
  const startRow = isHeaderRow(rows[0]) ? 1 : 0;
  
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    
    // Try to find name and area
    const name = findNameColumn(row);
    const area = findAreaColumn(row);
    
    if (name && area) {
      programs.push({
        id: `excel-${i}`,
        name,
        area,
        unit: 'sqm',
        areaType: 'unknown',
        confidence: 0.7,
        source: 'excel',
      });
    }
  }
  
  return programs;
}

function isHeaderRow(row: string[]): boolean {
  if (!row) return false;
  const headerKeywords = ['name', 'area', 'program', 'space', 'room', 'function', 'sqm', 'quantity'];
  return row.some(cell => 
    headerKeywords.some(keyword => 
      String(cell).toLowerCase().includes(keyword)
    )
  );
}

function findNameColumn(row: string[]): string | null {
  // First non-numeric value is likely the name
  for (const cell of row) {
    const str = String(cell).trim();
    if (str && isNaN(Number(str)) && str.length > 1) {
      return str;
    }
  }
  return null;
}

function findAreaColumn(row: string[]): number | null {
  // Look for numeric values, prefer larger ones (total area)
  const numbers = row
    .map(cell => parseFloat(String(cell).replace(/,/g, '')))
    .filter(n => !isNaN(n) && n > 0);
  
  if (numbers.length === 0) return null;
  
  // If there are multiple numbers, the largest is likely total area
  return Math.max(...numbers);
}

/**
 * Export normalized program data to Excel
 */
export function exportToExcel(normalized: NormalizedProgram, filename: string = 'program-data.xlsx') {
  const wsData = [
    ['Program', 'Area (sqm)', 'Type', 'Source', 'AI Notes'],
    ...normalized.items.map(item => [
      item.name,
      item.area,
      item.areaType,
      item.source,
      item.aiNotes || '',
    ]),
    [],
    ['Total', normalized.totalArea, '', '', ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 40 }, // Program name
    { wch: 15 }, // Area
    { wch: 10 }, // Type
    { wch: 10 }, // Source
    { wch: 30 }, // Notes
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Program');

  // Add assumptions sheet if any
  if (normalized.assumptions.length > 0) {
    const assumptionsData = [
      ['Field', 'Assumed Value', 'Reasoning', 'Accepted'],
      ...normalized.assumptions.map(a => [
        a.field,
        String(a.assumedValue),
        a.reasoning,
        a.accepted ? 'Yes' : 'No',
      ]),
    ];
    const wsAssumptions = XLSX.utils.aoa_to_sheet(assumptionsData);
    XLSX.utils.book_append_sheet(wb, wsAssumptions, 'Assumptions');
  }

  XLSX.writeFile(wb, filename);
}
