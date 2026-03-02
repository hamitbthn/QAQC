export type DatasetType = 'COLLAR' | 'LITHOLOGY' | 'SURVEY' | 'ASSAY';

export interface CollarRow {
  HOLEID: string;
  XCOLLAR: number;
  YCOLLAR: number;
  ZCOLLAR: number;
  ENDDEPTH: number;
  [key: string]: string | number;
}

export interface SurveyRow {
  HOLEID: string;
  DEPTH: number;
  DIP: number;
  AZI: number;
  [key: string]: string | number;
}

export interface LithologyRow {
  HOLEID: string;
  FROM: number;
  TO: number;
  LITHCODE: string;
  [key: string]: string | number;
}

export interface AssayRow {
  HOLEID: string;
  FROM: number;
  TO: number;
  SAMPLEID?: string;
  [key: string]: string | number | undefined;
}

export type DataRow = CollarRow | SurveyRow | LithologyRow | AssayRow;

export interface ColumnMapping {
  required: string[];
  detected: string[];
  mappings: Record<string, string>;
}

export type ErrorToleranceMode = 'STRICT' | 'AUTO_FIX' | 'CONTINUE_WITH_WARNINGS';

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  row?: number;
  field?: string;
  message: string;
  expected?: string;
  received?: string;
  value?: string | number;
}

export interface ValidationReport {
  datasetType: DatasetType;
  datasetName: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  missingRequiredColumns: string[];
  typeMismatches: ValidationIssue[];
  nullRequiredFields: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  isValid: boolean;
  timestamp: string;
  autoFixesApplied: string[];
}

export interface AIAnalysis {
  rootCauses: string[];
  suggestedFixOrder: string[];
  columnMappingSuggestions: string[];
  fieldNotes: Record<string, string>;
  summary: string;
  timestamp: string;
}

export interface UploadedDataset {
  id: string;
  type: DatasetType;
  fileName: string;
  data: DataRow[];
  headers: string[];
  columnMapping: ColumnMapping;
  validationReport?: ValidationReport;
  aiAnalysis?: AIAnalysis;
  uploadedAt: string;
}

export interface DrillholeData {
  holeId: string;
  collar: CollarRow;
  surveys: SurveyRow[];
  lithology: LithologyRow[];
  assays: AssayRow[];
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface DrillholeSegment {
  holeId: string;
  start: Point3D;
  end: Point3D;
  lithCode?: string;
  grade?: number;
  depth: number;
}

export const REQUIRED_COLUMNS: Record<DatasetType, string[]> = {
  COLLAR: ['HOLEID', 'XCOLLAR', 'YCOLLAR', 'ZCOLLAR', 'ENDDEPTH'],
  SURVEY: ['HOLEID', 'DEPTH', 'DIP', 'AZI'],
  LITHOLOGY: ['HOLEID', 'FROM', 'TO', 'LITHCODE'],
  ASSAY: ['HOLEID', 'FROM', 'TO'],
};

export const COLUMN_ALIASES: Record<string, string[]> = {
  HOLEID: ['HOLE_ID', 'HOLE ID', 'BHID', 'BH_ID', 'DRILLHOLE', 'ID'],
  XCOLLAR: ['X', 'EAST', 'EASTING', 'X_COLLAR', 'COLLAR_X'],
  YCOLLAR: ['Y', 'NORTH', 'NORTHING', 'Y_COLLAR', 'COLLAR_Y'],
  ZCOLLAR: ['Z', 'ELEV', 'ELEVATION', 'RL', 'Z_COLLAR', 'COLLAR_Z'],
  ENDDEPTH: ['END_DEPTH', 'DEPTH', 'TOTAL_DEPTH', 'TD', 'MAX_DEPTH', 'EOH'],
  FROM: ['FROM_M', 'FROM_DEPTH', 'DEPTH_FROM', 'START'],
  TO: ['TO_M', 'TO_DEPTH', 'DEPTH_TO', 'END'],
  DIP: ['INCLINATION', 'INCL', 'DIP_ANGLE'],
  AZI: ['AZIMUTH', 'BEARING', 'AZ', 'DIRECTION'],
  LITHCODE: ['LITH', 'LITHOLOGY', 'ROCK_TYPE', 'ROCK', 'CODE'],
  SAMPLEID: ['SAMPLE_ID', 'SAMPLE', 'SAMP_ID', 'SAMPNO'],
};
