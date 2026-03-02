import { QAQCParams, DEFAULT_QAQC_PARAMS, QAQCReport, QAQCIssue } from '@/types/qaqc';
import { mapHeaders } from './headerNormalization';
import { normalizeRow } from './dataNormalization';
import { getGradeColumns } from './gradeDetection';
import {
  validateCollarTable,
  validateSurveyTable,
  validateLithologyTable,
  validateAssayTable
} from './tableValidators';
import { validateCrossTable } from './crossTableValidators';
import { createReport } from './reporting';

export interface QAQCEngineInput {
  collarRaw: any[];
  surveyRaw: any[];
  lithRaw: any[];
  assayRaw: any[];
  params?: Partial<QAQCParams>;
}

/**
 * Production-grade QAQC Validation Engine
 */
export async function runQAQC(input: QAQCEngineInput): Promise<QAQCReport> {
  const params: QAQCParams = { ...DEFAULT_QAQC_PARAMS, ...input.params };
  const allIssues: QAQCIssue[] = [];

  // 1. Header Mapping
  const collarMapping = input.collarRaw.length > 0 ? mapHeaders(Object.keys(input.collarRaw[0])) : {};
  const surveyMapping = input.surveyRaw.length > 0 ? mapHeaders(Object.keys(input.surveyRaw[0])) : {};
  const lithMapping = input.lithRaw.length > 0 ? mapHeaders(Object.keys(input.lithRaw[0])) : {};
  const assayMapping = input.assayRaw.length > 0 ? mapHeaders(Object.keys(input.assayRaw[0])) : {};

  // 2. Data Normalization
  const collarNorm = input.collarRaw.map(row => normalizeRow(row, collarMapping, params));
  const surveyNorm = input.surveyRaw.map(row => normalizeRow(row, surveyMapping, params));
  const lithNorm = input.lithRaw.map(row => normalizeRow(row, lithMapping, params));
  const assayNorm = input.assayRaw.map(row => normalizeRow(row, assayMapping, params));

  // 3. Grade Column Detection
  const gradeCols = input.assayRaw.length > 0 ? getGradeColumns(Object.keys(input.assayRaw[0])) : [];

  // 4. Table-Specific Validation
  if (collarNorm.length > 0) allIssues.push(...validateCollarTable(collarNorm, params));
  if (surveyNorm.length > 0) allIssues.push(...validateSurveyTable(surveyNorm, params));
  if (lithNorm.length > 0) allIssues.push(...validateLithologyTable(lithNorm, params));
  if (assayNorm.length > 0) allIssues.push(...validateAssayTable(assayNorm, gradeCols, params));

  // 5. Cross-Table Validation
  if (collarNorm.length > 0 || surveyNorm.length > 0 || lithNorm.length > 0 || assayNorm.length > 0) {
    allIssues.push(...validateCrossTable(collarNorm, surveyNorm, lithNorm, assayNorm, params));
  }

  return createReport(allIssues);
}
