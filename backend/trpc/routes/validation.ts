import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";
import type {
  ValidationReport,
  ValidationIssue,
} from "@/types/geology";

const dataRowSchema = z.record(z.string(), z.union([z.string(), z.number(), z.null(), z.undefined()]));

const validateInputSchema = z.object({
  datasetType: z.enum(['COLLAR', 'LITHOLOGY', 'SURVEY', 'ASSAY']),
  data: z.array(dataRowSchema),
  datasetName: z.string(),
  collarHoleIds: z.array(z.string()).optional(),
});

function validateCollar(data: Record<string, unknown>[]): { errors: ValidationIssue[]; warnings: ValidationIssue[]; info: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];
  const holeIds = new Set<string>();

  data.forEach((row, index) => {
    const rowNum = index + 2;

    if (!row.HOLEID || String(row.HOLEID).trim() === '') {
      errors.push({ type: 'error', row: rowNum, field: 'HOLEID', message: 'HOLEID boş olamaz' });
    } else {
      const holeId = String(row.HOLEID);
      if (holeIds.has(holeId)) {
        errors.push({ type: 'error', row: rowNum, field: 'HOLEID', message: `Tekrarlanan HOLEID: ${holeId}`, value: holeId });
      }
      holeIds.add(holeId);
    }

    const xcollar = Number(row.XCOLLAR);
    if (isNaN(xcollar)) {
      errors.push({ type: 'error', row: rowNum, field: 'XCOLLAR', message: 'XCOLLAR sayısal değer olmalı', value: String(row.XCOLLAR) });
    }

    const ycollar = Number(row.YCOLLAR);
    if (isNaN(ycollar)) {
      errors.push({ type: 'error', row: rowNum, field: 'YCOLLAR', message: 'YCOLLAR sayısal değer olmalı', value: String(row.YCOLLAR) });
    }

    const zcollar = Number(row.ZCOLLAR);
    if (isNaN(zcollar)) {
      errors.push({ type: 'error', row: rowNum, field: 'ZCOLLAR', message: 'ZCOLLAR sayısal değer olmalı', value: String(row.ZCOLLAR) });
    }

    const enddepth = Number(row.ENDDEPTH);
    if (isNaN(enddepth) || enddepth <= 0) {
      errors.push({ type: 'error', row: rowNum, field: 'ENDDEPTH', message: 'ENDDEPTH sıfırdan büyük olmalı', value: String(row.ENDDEPTH) });
    }

    if (enddepth > 2000) {
      warnings.push({ type: 'warning', row: rowNum, field: 'ENDDEPTH', message: `Olağandışı derinlik: ${enddepth}m`, value: enddepth });
    }
  });

  info.push({ type: 'info', message: `Toplam ${holeIds.size} benzersiz sondaj tespit edildi` });

  return { errors, warnings, info };
}

function validateSurvey(data: Record<string, unknown>[], collarHoleIds?: string[]): { errors: ValidationIssue[]; warnings: ValidationIssue[]; info: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];
  const collarSet = new Set(collarHoleIds || []);
  const holeDepths: Record<string, number[]> = {};

  data.forEach((row, index) => {
    const rowNum = index + 2;
    const holeId = String(row.HOLEID || '');

    if (!holeId) {
      errors.push({ type: 'error', row: rowNum, field: 'HOLEID', message: 'HOLEID boş olamaz' });
    } else if (collarSet.size > 0 && !collarSet.has(holeId)) {
      errors.push({ type: 'error', row: rowNum, field: 'HOLEID', message: `HOLEID COLLAR verisinde bulunamadı: ${holeId}`, value: holeId });
    }

    const depth = Number(row.DEPTH);
    if (isNaN(depth) || depth < 0) {
      errors.push({ type: 'error', row: rowNum, field: 'DEPTH', message: 'DEPTH geçerli bir pozitif sayı olmalı', value: String(row.DEPTH) });
    } else {
      if (!holeDepths[holeId]) holeDepths[holeId] = [];
      const prevDepths = holeDepths[holeId];
      if (prevDepths.length > 0 && depth <= prevDepths[prevDepths.length - 1]) {
        warnings.push({ type: 'warning', row: rowNum, field: 'DEPTH', message: `Derinlik artan sırada değil: ${depth}`, value: depth });
      }
      holeDepths[holeId].push(depth);
    }

    const dip = Number(row.DIP);
    if (isNaN(dip) || dip < -90 || dip > 90) {
      errors.push({ type: 'error', row: rowNum, field: 'DIP', message: 'DIP -90 ile +90 arasında olmalı', value: String(row.DIP) });
    }

    const azi = Number(row.AZI);
    if (isNaN(azi) || azi < 0 || azi > 360) {
      errors.push({ type: 'error', row: rowNum, field: 'AZI', message: 'AZI 0 ile 360 arasında olmalı', value: String(row.AZI) });
    }
  });

  info.push({ type: 'info', message: `${Object.keys(holeDepths).length} sondaj için survey verisi işlendi` });

  return { errors, warnings, info };
}

function validateLithology(data: Record<string, unknown>[], collarHoleIds?: string[]): { errors: ValidationIssue[]; warnings: ValidationIssue[]; info: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];
  const collarSet = new Set(collarHoleIds || []);
  const holeIntervals: Record<string, { from: number; to: number; row: number }[]> = {};
  const lithCodes = new Set<string>();

  data.forEach((row, index) => {
    const rowNum = index + 2;
    const holeId = String(row.HOLEID || '');

    if (!holeId) {
      errors.push({ type: 'error', row: rowNum, field: 'HOLEID', message: 'HOLEID boş olamaz' });
    } else if (collarSet.size > 0 && !collarSet.has(holeId)) {
      errors.push({ type: 'error', row: rowNum, field: 'HOLEID', message: `HOLEID COLLAR verisinde bulunamadı: ${holeId}`, value: holeId });
    }

    const from = Number(row.FROM);
    const to = Number(row.TO);

    if (isNaN(from)) {
      errors.push({ type: 'error', row: rowNum, field: 'FROM', message: 'FROM sayısal değer olmalı', value: String(row.FROM) });
    }
    if (isNaN(to)) {
      errors.push({ type: 'error', row: rowNum, field: 'TO', message: 'TO sayısal değer olmalı', value: String(row.TO) });
    }
    if (!isNaN(from) && !isNaN(to) && from >= to) {
      errors.push({ type: 'error', row: rowNum, field: 'FROM/TO', message: `FROM (${from}) TO (${to}) değerinden küçük olmalı`, value: `${from}-${to}` });
    }

    if (!isNaN(from) && !isNaN(to) && holeId) {
      if (!holeIntervals[holeId]) holeIntervals[holeId] = [];
      const existingIntervals = holeIntervals[holeId];
      for (const interval of existingIntervals) {
        if (from < interval.to && to > interval.from) {
          warnings.push({
            type: 'warning',
            row: rowNum,
            field: 'FROM/TO',
            message: `Çakışan aralık: ${from}-${to} (satır ${interval.row} ile çakışıyor: ${interval.from}-${interval.to})`
          });
          break;
        }
      }
      holeIntervals[holeId].push({ from, to, row: rowNum });
    }

    const lithCode = String(row.LITHCODE || '');
    if (!lithCode) {
      errors.push({ type: 'error', row: rowNum, field: 'LITHCODE', message: 'LITHCODE boş olamaz' });
    } else {
      lithCodes.add(lithCode);
    }
  });

  info.push({ type: 'info', message: `${lithCodes.size} farklı litoloji kodu tespit edildi: ${Array.from(lithCodes).slice(0, 10).join(', ')}${lithCodes.size > 10 ? '...' : ''}` });

  return { errors, warnings, info };
}

function validateAssay(data: Record<string, unknown>[], collarHoleIds?: string[]): { errors: ValidationIssue[]; warnings: ValidationIssue[]; info: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];
  const collarSet = new Set(collarHoleIds || []);
  const sampleIds = new Set<string>();
  const gradeColumns: string[] = [];

  if (data.length > 0) {
    const firstRow = data[0];
    const knownNonGrade = ['HOLEID', 'FROM', 'TO', 'SAMPLEID', 'SAMPLE_ID', 'SAMPLE'];
    for (const key of Object.keys(firstRow)) {
      if (!knownNonGrade.includes(key.toUpperCase())) {
        const val = Number(firstRow[key]);
        if (!isNaN(val)) {
          gradeColumns.push(key);
        }
      }
    }
  }

  data.forEach((row, index) => {
    const rowNum = index + 2;
    const holeId = String(row.HOLEID || '');

    if (!holeId) {
      errors.push({ type: 'error', row: rowNum, field: 'HOLEID', message: 'HOLEID boş olamaz' });
    } else if (collarSet.size > 0 && !collarSet.has(holeId)) {
      errors.push({ type: 'error', row: rowNum, field: 'HOLEID', message: `HOLEID COLLAR verisinde bulunamadı: ${holeId}`, value: holeId });
    }

    const from = Number(row.FROM);
    const to = Number(row.TO);

    if (isNaN(from)) {
      errors.push({ type: 'error', row: rowNum, field: 'FROM', message: 'FROM sayısal değer olmalı', value: String(row.FROM) });
    }
    if (isNaN(to)) {
      errors.push({ type: 'error', row: rowNum, field: 'TO', message: 'TO sayısal değer olmalı', value: String(row.TO) });
    }
    if (!isNaN(from) && !isNaN(to) && from >= to) {
      errors.push({ type: 'error', row: rowNum, field: 'FROM/TO', message: `FROM (${from}) TO (${to}) değerinden küçük olmalı`, value: `${from}-${to}` });
    }

    const sampleId = String(row.SAMPLEID || row.SAMPLE_ID || row.SAMPLE || '');
    if (sampleId && sampleId !== 'undefined') {
      if (sampleIds.has(sampleId)) {
        warnings.push({ type: 'warning', row: rowNum, field: 'SAMPLEID', message: `Tekrarlanan SampleID: ${sampleId}`, value: sampleId });
      }
      sampleIds.add(sampleId);
    }

    for (const gradeCol of gradeColumns) {
      const gradeVal = Number(row[gradeCol]);
      if (!isNaN(gradeVal) && gradeVal < 0) {
        errors.push({ type: 'error', row: rowNum, field: gradeCol, message: `Negatif tenör değeri: ${gradeVal}`, value: gradeVal });
      }
    }
  });

  if (gradeColumns.length > 0) {
    info.push({ type: 'info', message: `Tespit edilen tenör sütunları: ${gradeColumns.join(', ')}` });
  }
  info.push({ type: 'info', message: `Toplam ${sampleIds.size} benzersiz örnek tespit edildi` });

  return { errors, warnings, info };
}

export const validationRouter = createTRPCRouter({
  validate: publicProcedure
    .input(validateInputSchema)
    .mutation(async ({ input }) => {
      const { datasetType, data, datasetName, collarHoleIds } = input;

      let result: { errors: ValidationIssue[]; warnings: ValidationIssue[]; info: ValidationIssue[] };

      switch (datasetType) {
        case 'COLLAR':
          result = validateCollar(data);
          break;
        case 'SURVEY':
          result = validateSurvey(data, collarHoleIds);
          break;
        case 'LITHOLOGY':
          result = validateLithology(data, collarHoleIds);
          break;
        case 'ASSAY':
          result = validateAssay(data, collarHoleIds);
          break;
        default:
          throw new Error(`Unknown dataset type: ${datasetType}`);
      }

      const report: ValidationReport = {
        datasetType,
        datasetName,
        totalRows: data.length,
        successRows: data.length - result.errors.length,
        errorRows: result.errors.length,
        missingRequiredColumns: [],
        typeMismatches: [],
        nullRequiredFields: [],
        errors: result.errors,
        warnings: result.warnings,
        info: result.info,
        isValid: result.errors.length === 0,
        timestamp: new Date().toISOString(),
        autoFixesApplied: [],
      };

      return report;
    }),
});
