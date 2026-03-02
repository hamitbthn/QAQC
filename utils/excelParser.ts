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
  normalizeHeader as oldNormalizeHeader, // Not entirely used directly inside logic below
} from './columnMapping';
import { matchHeader } from './qaqc/headerNormalization';

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
 * Virgül ondalık ayracını noktaya çevirir. Türk tipi formatları (1.425,50) İngilizce standardına (1425.50) dönüştürür.
 */
function parseNumericValue(value: unknown, fieldName: string, rowIdx: number): { value: number | null, error?: string, wasFixed?: boolean } {
  if (value === null || value === undefined || value === '') {
    return { value: null };
  }

  let strVal = String(value).trim();
  // Temizleme (görünmez karakterleri, \r, boşlukları silme)
  strVal = strVal.replace(/[\u200B-\u200D\uFEFF]/g, '');

  let wasFixed = false;

  // Format 1: 1.425,50 veya 1425,50 (Binlik ayracı nokta, ondalık virgül)
  if (/^[-+]?\d{1,3}(?:\.\d{3})*(?:,\d+)?$/.test(strVal) || /^[-+]?\d+(?:,\d+)?$/.test(strVal)) {
    if (strVal.includes(',') || strVal.includes('.')) {
      strVal = strVal.replace(/\./g, ''); // Binlikleri kaldır
      strVal = strVal.replace(',', '.');  // Ondalığı noktaya yap
      wasFixed = true;
    }
  }
  // Format 2: 1,425.50 (Binlik ayracı virgül, ondalık nokta - US formatı)
  else if (/^[-+]?\d{1,3}(?:,\d{3})*(?:\.\d+)?$/.test(strVal)) {
    if (strVal.includes(',')) {
      strVal = strVal.replace(/,/g, ''); // Sadece binlik virgüllerini kaldır
      wasFixed = true;
    }
  }

  const num = Number(strVal);
  if (isNaN(num)) {
    return {
      value: null,
      error: `Geçersiz sayısal değer: "${value}". Beklenen tip: Number.`
    };
  }

  return { value: num, wasFixed };
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

  // Update reverse mapping combining standard mapping argument and fuzzy matching integration
  const allOriginalHeaders = Object.keys(data[0] || {});
  allOriginalHeaders.forEach(orig => {
    let matchedStdKey: string | null = null;

    // First check explicitly provided mappings
    const stdMatchEntry = Object.entries(mappings).find(([std, origMap]) => origMap === orig);
    if (stdMatchEntry) {
      matchedStdKey = stdMatchEntry[0];
    } else {
      // Auto fuzzy match via headerNormalization
      const matchResult = matchHeader(orig);
      if (matchResult && matchResult.key && matchResult.confidence > 0.7) {
        matchedStdKey = matchResult.key;
      }
    }
    if (matchedStdKey) {
      reverseMappings[orig] = matchedStdKey;
    }
  });

  data.forEach((row, idx) => {
    const rowNum = idx + 1;
    const newRow: Record<string, unknown> = {};
    let rowHasError = false;

    let isEmptyRow = true;

    // Header normalizasyonu ve veri temizleme (String trim, invisible characters)
    Object.entries(row).forEach(([originalKey, value]) => {
      // Temiz key
      const cleanOrigKey = originalKey.trim().replace(/[\u200B-\u200D\uFEFF\r\n]/g, '');
      const stdKey = reverseMappings[cleanOrigKey] || cleanOrigKey;
      let processedValue = value;

      if (typeof value === 'string') {
        processedValue = value.trim().replace(/[\u200B-\u200D\uFEFF\r]/g, '').replace(/\s+/g, ' ');
      }

      if (processedValue !== null && processedValue !== undefined && processedValue !== '') {
        isEmptyRow = false;
      }

      newRow[stdKey] = processedValue;
    });

    if (isEmptyRow) {
      // Skip completely empty row without counting it as an error
      return;
    }

    // Primary key check (Null / Boş kontrolü) => e.g., HOLEID
    const primaryKey = requiredCols[0];
    if (requiredCols.length > 0 && (!newRow[primaryKey] || newRow[primaryKey] === '')) {
      report.errorRows++;
      report.errors.push({
        type: 'error',
        row: rowNum,
        field: primaryKey,
        message: `Primary Key (${primaryKey}) eksik. Satır atlanıyor.`,
      });
      if (mode !== 'CONTINUE_WITH_WARNINGS') rowHasError = true;
      return; // Primary key is essential, skip row.
    }

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
        const { value: numVal, error, wasFixed } = parseNumericValue(val, reqCol, rowNum);
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
          if (wasFixed) {
            report.autoFixesApplied.push(`Satır ${rowNum}, ${reqCol}: Küsürat/Binlik ayracı düzeltmesi yapıldı (Eski: ${val}, Yeni: ${numVal}).`);
          }
        }
      }
    }

    if (rowHasError) {
      report.errorRows++;
      if (mode === 'CONTINUE_WITH_WARNINGS') {
        // Even if some secondary validations failed, keep the row structurally if primary is ok
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

    let parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false
    });

    // Auto-detect Fallback Mechanism
    // If the parser returned fewer than 2 fields (e.g. 1 big concatenated unparsed column)
    if (!parsed.meta.fields || parsed.meta.fields.length <= 1) {
      console.log('PapaParse auto-detect failed. Proceeding with fallback delimiter tests.');
      const testDelimiters = [',', ';', '\t', '|'];
      let bestResult = parsed;
      let maxCols = parsed.meta.fields ? parsed.meta.fields.length : 0;

      for (const delimiter of testDelimiters) {
        const testParse = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false,
          delimiter: delimiter
        });

        if (testParse.meta.fields && testParse.meta.fields.length > maxCols) {
          maxCols = testParse.meta.fields.length;
          bestResult = testParse;
        }
      }
      parsed = bestResult;
    }

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
