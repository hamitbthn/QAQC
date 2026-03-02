import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useMemo } from 'react';
import type { QAQCResult, QAQCConfig, QAQCIssue, QAQCSeverity, QAQCTable, HoleSummaryRow } from '@/types/qaqc';
import { DEFAULT_QAQC_CONFIG } from '@/types/qaqc';
import { runQAQC } from '@/utils/qaqc/engine';
import { useData } from '@/contexts/DataContext';

export const [QAQCProvider, useQAQC] = createContextHook(() => {
  const { datasets } = useData();

  const [result, setResult] = useState<QAQCResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<QAQCConfig>(DEFAULT_QAQC_CONFIG);
  const [lastRunTimestamp, setLastRunTimestamp] = useState<string | null>(null);

  const runValidation = useCallback(async (customConfig?: Partial<QAQCConfig>) => {
    console.log('Running Production QAQC validation...');
    setIsRunning(true);

    try {
      const collarRaw = datasets.COLLAR?.data || [];
      const surveyRaw = datasets.SURVEY?.data || [];
      const lithRaw = datasets.LITHOLOGY?.data || [];
      const assayRaw = datasets.ASSAY?.data || [];

      const mergedConfig = { ...config, ...customConfig };
      setConfig(mergedConfig);

      const qaqcReport = await runQAQC({
        collarRaw,
        surveyRaw,
        lithRaw,
        assayRaw,
        params: mergedConfig,
      });

      // qaqcReport follows the QAQCReport interface which has issues and summary.
      // QAQCResult expects { issues, summary, config }.
      const qaqcResult: QAQCResult = {
        issues: qaqcReport.issues,
        summary: qaqcReport.summary,
        config: mergedConfig
      };

      setResult(qaqcResult);
      setLastRunTimestamp(qaqcResult.summary.timestamp);
      console.log('QAQC validation complete');
    } catch (error) {
      console.error('QAQC validation error:', error);
    } finally {
      setIsRunning(false);
    }
  }, [datasets, config]);

  const clearResult = useCallback(() => {
    setResult(null);
    setLastRunTimestamp(null);
  }, []);

  const updateConfig = useCallback((updates: Partial<QAQCConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const holeSummaries = useMemo((): HoleSummaryRow[] => {
    if (!result) return [];
    const map = new Map<string, HoleSummaryRow>();

    // Use the pre-calculated summary from reporting layer if possible,
    // but here we might prefer to build it from issues to ensure consistency with filters if needed.
    // However, holeSummaries is a separate list for the "Holes" view.

    for (const [holeId, stats] of Object.entries(result.summary.issuesByHole)) {
      if (holeId === '-') continue;
      map.set(holeId, {
        holeId,
        critical: stats.critical,
        warning: stats.warn,
        info: stats.info
      });
    }

    return Array.from(map.values()).sort((a, b) => b.critical - a.critical || b.warning - a.warning);
  }, [result]);

  return {
    result,
    isRunning,
    config,
    lastRunTimestamp,
    runValidation,
    clearResult,
    updateConfig,
    holeSummaries,
  };
});

export function useFilteredQAQCIssues(
  severityFilter: QAQCSeverity | 'all',
  tableFilter: QAQCTable | 'all',
  holeFilter: string,
  searchQuery: string
): QAQCIssue[] {
  const { result } = useQAQC();

  return useMemo(() => {
    if (!result) return [];
    let issues = result.issues;

    if (severityFilter !== 'all') {
      issues = issues.filter(i => i.severity === severityFilter);
    }
    if (tableFilter !== 'all') {
      issues = issues.filter(i => i.table === tableFilter);
    }
    if (holeFilter) {
      const lower = holeFilter.toLowerCase();
      issues = issues.filter(i => i.holeId.toLowerCase().includes(lower));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      issues = issues.filter(i =>
        i.message.toLowerCase().includes(q) ||
        i.code.toLowerCase().includes(q)
      );
    }

    return issues;
  }, [result, severityFilter, tableFilter, holeFilter, searchQuery]);
}
