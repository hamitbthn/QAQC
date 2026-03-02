export type QAQCSeverity = 'BLOCKER' | 'ERROR' | 'WARN' | 'INFO';
export type QAQCTable = 'collar' | 'survey' | 'lithology' | 'assay' | 'cross';

export interface QAQCFix {
  fixId: string;
  before: unknown;
  after: unknown;
}

export interface QAQCIssue {
  severity: QAQCSeverity;
  code: string;
  table: QAQCTable;
  holeId: string;
  rowIndex?: number;
  message: string;
  evidence?: any;
  suggestion?: string;
  appliedFix?: QAQCFix | null;
}

export type BelowDetectionHandling = 'ZERO' | 'HALF' | 'IGNORE';
export type DipConvention = 'negative_down' | 'positive_down';

export interface QAQCConfig {
  toleranceDepth: number;
  maxSurveyGap: number;
  requireSurveyFor3D: boolean;
  assayContinuousExpected: boolean;
  dipConvention: DipConvention;
  belowDetectionHandling: BelowDetectionHandling;
  minSampleLength: number;
  maxSampleLength: number;
}

export const DEFAULT_QAQC_CONFIG: QAQCConfig = {
  toleranceDepth: 0.01,
  maxSurveyGap: 30,
  requireSurveyFor3D: true,
  assayContinuousExpected: false,
  dipConvention: 'negative_down',
  belowDetectionHandling: 'ZERO',
  minSampleLength: 0.05,
  maxSampleLength: 10,
};

export type QAQCParams = QAQCConfig;
export const DEFAULT_QAQC_PARAMS = DEFAULT_QAQC_CONFIG;

export interface QAQCSummary {
  totalHoles: number;
  critical: number; // Sum of BLOCKER + ERROR
  warn: number;
  info: number;
  issuesByTable: Record<QAQCTable, number>;
  issuesByHole: Record<string, { critical: number; warn: number; info: number }>;
  fixesApplied: QAQCIssue[];
  timestamp: string;
}

export interface QAQCResult {
  issues: QAQCIssue[];
  summary: QAQCSummary;
  config: QAQCConfig;
}

export interface QAQCReport {
  issues: QAQCIssue[];
  summary: QAQCSummary;
}

export interface HoleSummaryRow {
  holeId: string;
  critical: number;
  warning: number;
  info: number;
}
