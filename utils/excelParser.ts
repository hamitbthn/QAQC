import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  REQUIRED_COLUMNS,
  DatasetType,
  SurveyRow,
  ValidationReport,
  ValidationIssue,
  ErrorToleranceMode,
  DataRow
} from '@/types/geology';
import {
  detectColumnMappingsAdvanced,
  ColumnMappingResult,
  generateMappingReportText,
  normalizeHeader,
} from './columnMapping';

export interface ParseResult {
  headers: string[];
  data: Record<string, unknown>[];
  rowCount: number;
  fileSizeBytes?: number;
  validationReport?: ValidationReport;
}

export interface ParseResultWithWarning extends ParseResult {
  sizeWarning?: boolean;
  previewOnly?: boolean;
}

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * Sayısal değerleri temizler ve doğrular. 
 * Virgül ondalık ayracını noktaya çevirir.
 */
function parseNumericValue(value: unknown, fieldName: string, rowIdx: number): { value: number | null, error?: string } {
  if (value === null || value === undefined || value === '') {
    return { value: null };
  }

  let strVal = String(value).trim();
  // Virgülü noktaya çevir
  if (strVal.includes(',') && !strVal.includes('.')) {
    strVal = strVal.replace(',', '.');
  }

  const num = Number(strVal);
  if (isNaN(num)) {
    return {
      value: null,
      error: `Geçersiz sayısal değer: "${value}". Beklenen tip: Number.`
    };
  }

  return { value: num };
}

/**
 * Veriyi doğrular ve normalize eder.
 */
export function validateAndNormalizeData(
  data: Record<string, unknown>[],
  datasetType: DatasetType,
  mappings: Record<string, string>,
  mode: ErrorToleranceMode = 'AUTO_FIX'
): { normalized: Record<string, unknown>[], report: ValidationReport } {
  const report: ValidationReport = {
    datasetType,
    datasetName: 'Yüklenen Veri',
    totalRows: data.length,
    successRows: 0,
    errorRows: 0,
    missingRequiredColumns: [],
    typeMismatches: [],
    nullRequiredFields: [],
    errors: [],
    warnings: [],
    info: [],
    isValid: true,
    timestamp: new Date().toISOString(),
    autoFixesApplied: []
  };

  const requiredCols = REQUIRED_COLUMNS[datasetType];
  const missing = requiredCols.filter(col => !mappings[col]);

  if (missing.length > 0) {
    report.missingRequiredColumns = missing;
    report.errors.push({
      type: 'error',
      message: `Eksik Zorunlu Kolonlar: ${missing.join(', ')}`
    });
    if (mode === 'STRICT') {
      report.isValid = false;
      return { normalized: [], report };
    }
  }

  const normalized: Record<string, unknown>[] = [];
  const reverseMappings: Record<string, string> = {};
  Object.entries(mappings).forEach(([std, orig]) => {
    reverseMappings[orig] = std;
  });

  data.forEach((row, idx) => {
    const rowNum = idx + 1;
    const newRow: Record<string, unknown> = {};
    let rowHasError = false;

    // Header normalizasyonu ve veri temizleme (String trim, whitespace removal)
    Object.entries(row).forEach(([originalKey, value]) => {
      const stdKey = reverseMappings[originalKey] || originalKey;
      let processedValue = value;

      if (typeof value === 'string') {
        processedValue = value.trim().replace(/\s+/g, ' ');
      }

      newRow[stdKey] = processedValue;
    });

    // Zorunlu alan kontrolü ve tip dönüşümü
    for (const reqCol of requiredCols) {
      const val = newRow[reqCol];

      // Null / Boş kontrolü
      if (val === null || val === undefined || val === '') {
        const issue: ValidationIssue = {
          type: 'error',
          row: rowNum,
          field: reqCol,
          message: `Zorunlu alan boş: ${reqCol}`,
          received: 'NULL/EMPTY'
        };
        report.nullRequiredFields.push(issue);
        report.errors.push(issue);
        rowHasError = true;
        continue;
      }

      // Tip uyumsuzluğu kontrolü (Sayısal alanlar için)
      const numericFields = ['XCOLLAR', 'YCOLLAR', 'ZCOLLAR', 'ENDDEPTH', 'DEPTH', 'DIP', 'AZI', 'FROM', 'TO'];
      if (numericFields.includes(reqCol)) {
        const { value: numVal, error } = parseNumericValue(val, reqCol, rowNum);
        if (error) {
          const issue: ValidationIssue = {
            type: 'error',
            row: rowNum,
            field: reqCol,
            message: error,
            expected: 'Number',
            received: String(val),
            value: String(val)
          };
          report.typeMismatches.push(issue);
          report.errors.push(issue);
          rowHasError = true;
        } else {
          newRow[reqCol] = numVal;
          if (String(val).includes(',')) {
            report.autoFixesApplied.push(`Satır ${rowNum}, ${reqCol}: Virgül noktaya çevrildi.`);
          }
        }
      }
    }

    if (rowHasError) {
      report.errorRows++;
      if (mode === 'CONTINUE_WITH_WARNINGS') {
        normalized.push(newRow);
      }
    } else {
      report.successRows++;
      normalized.push(newRow);
    }
  });

  // Survey Fallback (Vertical Line)
  if (datasetType === 'SURVEY' && normalized.length === 0 && mode !== 'STRICT') {
    report.info.push({
      type: 'info',
      message: 'Survey verisi bulunamadı. Otomatik dikey survey üretiliyor (DIP=-90, AZI=0).'
    });
    // Not: Bu kısım genelde Collar verisiyle birleşirken yapılır ama burada mantık olarak hazır durabilir.
  }

  report.isValid = report.errors.length === 0 || mode !== 'STRICT';

  console.log(`[Validation Debug] Type: ${datasetType}, Total: ${report.totalRows}, Success: ${report.successRows}, Errors: ${report.errorRows}`);

  return { normalized, report };
}

export function parseCSVData(csvText: string): ParseResultWithWarning {
  try {
    const fileSizeBytes = csvText.length;
    const sizeWarning = fileSizeBytes > MAX_FILE_SIZE_BYTES;

    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false
    });

    let jsonData = parsed.data as Record<string, unknown>[];

    // Boş satır temizleme (Tüm hücreleri boş olan satırlar çıkarılır)
    jsonData = jsonData.filter(row => {
      return Object.values(row).some(val => val !== null && val !== undefined && String(val).trim() !== '');
    });

    if (jsonData.length === 0) {
      return { headers: [], data: [], rowCount: 0, fileSizeBytes };
    }

    const headers = parsed.meta.fields || Object.keys(jsonData[0] || {});

    return {
      headers,
      data: jsonData,
      rowCount: jsonData.length,
      fileSizeBytes,
      sizeWarning,
    };
  } catch (error: any) {
    console.error('CSV Parse Error:', error);
    throw new Error(`CSV ayrıştırılırken hata oluştu: ${error.message}`);
  }
}

export function parseExcelData(base64Data: string): ParseResultWithWarning {
  try {
    const fileSizeBytes = Math.ceil(base64Data.length * 0.75);
    const sizeWarning = fileSizeBytes > MAX_FILE_SIZE_BYTES;

    const workbook = XLSX.read(base64Data, { type: 'base64' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    let jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false }) as Record<string, unknown>[];

    // Boş satır temizleme (Tüm hücreleri boş olan satırlar çıkarılır)
    jsonData = jsonData.filter(row => {
      return Object.values(row).some(val => val !== null && val !== undefined && String(val).trim() !== '');
    });

    if (jsonData.length === 0) {
      return { headers: [], data: [], rowCount: 0, fileSizeBytes };
    }

    const headers = Object.keys(jsonData[0] as object);

    return {
      headers,
      data: jsonData as Record<string, unknown>[],
      rowCount: jsonData.length,
      fileSizeBytes,
      sizeWarning,
    };
  } catch (error: any) {
    console.error('Excel Parse Error:', error);
    throw new Error(`Excel dosyası ayrıştırılırken hata oluştu: ${error.message}`);
  }
}

export function detectColumnMappings(
  headers: string[],
  datasetType: DatasetType
): Record<string, string> {
  const result = detectColumnMappingsAdvanced(headers, datasetType, REQUIRED_COLUMNS[datasetType]);
  return result.mappings;
}

export function detectColumnMappingsWithReport(
  headers: string[],
  datasetType: DatasetType
): ColumnMappingResult {
  return detectColumnMappingsAdvanced(headers, datasetType, REQUIRED_COLUMNS[datasetType]);
}

export { generateMappingReportText };

export function applyColumnMappings(
  data: Record<string, unknown>[],
  mappings: Record<string, string>
): Record<string, unknown>[] {
  const reverseMap: Record<string, string> = {};
  for (const [standard, original] of Object.entries(mappings)) {
    reverseMap[original] = standard;
  }

  return data.map(row => {
    const newRow: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const standardKey = reverseMap[key] || key;
      newRow[standardKey] = value;
    }
    return newRow;
  });
}

export function getMissingColumns(
  mappings: Record<string, string>,
  datasetType: DatasetType
): string[] {
  const required = REQUIRED_COLUMNS[datasetType];
  return required.filter(col => !mappings[col]);
}

export function exportToCSV(data: Record<string, unknown>[], filename: string): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h];
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return String(val ?? '');
      }).join(',')
    )
  ].join('\n');

  return csvContent;
}

export function exportValidationReport(report: ValidationReport): string {
  const lines = [
    `DOĞRULAMA RAPORU - ${report.datasetType}`,
    `=====================================`,
    `Tarih: ${new Date(report.timestamp).toLocaleString('tr-TR')}`,
    `Toplam Satır: ${report.totalRows}`,
    `Başarılı: ${report.successRows}`,
    `Hatalı: ${report.errorRows}`,
    `Durum: ${report.isValid ? 'GEÇERLİ' : 'GEÇERSİZ'}`,
    ``,
  ];

  if (report.missingRequiredColumns.length > 0) {
    lines.push(`EKSIK ZORUNLU KOLONLAR:`);
    lines.push(...report.missingRequiredColumns.map(c => `  - ${c}`));
    lines.push(``);
  }

  if (report.errors.length > 0) {
    lines.push(`HATALAR (${report.errors.length}):`);
    lines.push(...report.errors.slice(0, 50).map(e =>
      `  - Satır ${e.row || 'N/A'}, ${e.field || 'Genel'}: ${e.message}${e.received ? ` (Alınan: ${e.received})` : ''}`
    ));
    if (report.errors.length > 50) lines.push(`  ... ve ${report.errors.length - 50} hata daha.`);
    lines.push(``);
  }

  if (report.autoFixesApplied.length > 0) {
    lines.push(`OTOMATIK DÜZELTMELER (${report.autoFixesApplied.length}):`);
    lines.push(...report.autoFixesApplied.slice(0, 20).map(f => `  - ${f}`));
    if (report.autoFixesApplied.length > 20) lines.push(`  ... ve ${report.autoFixesApplied.length - 20} düzeltme daha.`);
    lines.push(``);
  }

  if (report.warnings.length > 0) {
    lines.push(`UYARILAR (${report.warnings.length}):`);
    lines.push(...report.warnings.map(w => `  - Satır ${w.row || 'N/A'}: ${w.message}`));
    lines.push(``);
  }

  return lines.join('\n');
}

export function normalizeSurveyData(data: SurveyRow[]): { normalized: SurveyRow[]; changes: string[] } {
  const changes: string[] = [];
  const surveysByHole: Record<string, SurveyRow[]> = {};

  for (const row of data) {
    const holeId = String(row.HOLEID);
    if (!surveysByHole[holeId]) surveysByHole[holeId] = [];
    surveysByHole[holeId].push({ ...row });
  }

  const normalized: SurveyRow[] = [];

  for (const [holeId, surveys] of Object.entries(surveysByHole)) {
    surveys.sort((a, b) => Number(a.DEPTH) - Number(b.DEPTH));

    if (surveys.length > 0 && Number(surveys[0].DEPTH) > 0) {
      const firstSurvey = surveys[0];
      const syntheticSurvey: SurveyRow = {
        HOLEID: holeId,
        DEPTH: 0,
        DIP: Number(firstSurvey.DIP),
        AZI: Number(firstSurvey.AZI),
      };
      surveys.unshift(syntheticSurvey);
      changes.push(`${holeId}: MD=0 sentetik kayıt eklendi (DIP=${syntheticSurvey.DIP}, AZI=${syntheticSurvey.AZI})`);
    }

    for (const survey of surveys) {
      let azi = Number(survey.AZI);
      if (azi < 0 || azi > 360) {
        const oldAzi = azi;
        azi = ((azi % 360) + 360) % 360;
        survey.AZI = azi;
        changes.push(`${holeId} @ ${survey.DEPTH}m: AZI ${oldAzi} → ${azi} (normalize edildi)`);
      }

      let dip = Number(survey.DIP);
      if (dip > 90) {
        survey.DIP = 90;
        changes.push(`${holeId} @ ${survey.DEPTH}m: DIP ${dip} → 90 (clamp edildi)`);
      } else if (dip < -90) {
        survey.DIP = -90;
        changes.push(`${holeId} @ ${survey.DEPTH}m: DIP ${dip} → -90 (clamp edildi)`);
      }
    }

    normalized.push(...surveys);
  }

  return { normalized, changes };
}
