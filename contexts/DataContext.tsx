import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { saveDatasetLocally, loadDatasetLocally, clearAllLocalData } from '@/utils/localFileManager';
import type {
  DatasetType,
  UploadedDataset,
  ValidationReport,
  AIAnalysis,
  CollarRow,
} from '@/types/geology';
import type { ColumnMappingReport } from '@/utils/columnMapping';

const STORAGE_KEY = 'geology_datasets';

// Cross-platform byte length calculation (Blob not available in React Native)
function getByteLength(str: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  // Fallback: manual UTF-8 byte count
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) { bytes += 4; i++; }
    else bytes += 3;
  }
  return bytes;
}

export interface MappingReportData {
  datasetType: DatasetType;
  report: ColumnMappingReport[];
  timestamp: string;
}

export const [DataProvider, useData] = createContextHook(() => {
  const [datasets, setDatasets] = useState<Record<DatasetType, UploadedDataset | null>>({
    COLLAR: null,
    SURVEY: null,
    LITHOLOGY: null,
    ASSAY: null,
  });
  const [mappingReports, setMappingReports] = useState<Record<DatasetType, MappingReportData | null>>({
    COLLAR: null,
    SURVEY: null,
    LITHOLOGY: null,
    ASSAY: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [storageWarning, setStorageWarning] = useState(false);

  useEffect(() => {
    loadFromStorage();
  }, []);

  const loadFromStorage = async () => {
    try {
      console.log('Loading data from FileSystem...');
      const datasetsData: any = {
        COLLAR: await loadDatasetLocally('COLLAR'),
        SURVEY: await loadDatasetLocally('SURVEY'),
        LITHOLOGY: await loadDatasetLocally('LITHOLOGY'),
        ASSAY: await loadDatasetLocally('ASSAY'),
      };

      const newDatasets = { ...datasets };
      for (const [key, val] of Object.entries(datasetsData)) {
        if (val) newDatasets[key as DatasetType] = val as UploadedDataset;
      }
      setDatasets(newDatasets);

      const reportsData: any = {
        COLLAR: await loadDatasetLocally('REPORT_COLLAR'),
        SURVEY: await loadDatasetLocally('REPORT_SURVEY'),
        LITHOLOGY: await loadDatasetLocally('REPORT_LITHOLOGY'),
        ASSAY: await loadDatasetLocally('REPORT_ASSAY'),
      };

      const newReports = { ...mappingReports };
      for (const [key, val] of Object.entries(reportsData)) {
        if (val) newReports[key as DatasetType] = val as MappingReportData;
      }
      setMappingReports(newReports);

      console.log('Data loaded from local file system');
    } catch (error) {
      console.error('Error loading from storage:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveToStorage = async (
    newDatasets: Record<DatasetType, UploadedDataset | null>,
    newMappingReports: Record<DatasetType, MappingReportData | null>
  ) => {
    try {
      for (const [key, data] of Object.entries(newDatasets)) {
        await saveDatasetLocally(key, data || null);
      }
      for (const [key, data] of Object.entries(newMappingReports)) {
        await saveDatasetLocally(`REPORT_${key}`, data || null);
      }
      console.log('Data saved to local file system successfully.');
      setStorageWarning(false);
      return true;
    } catch (error) {
      console.error('Error saving to storage:', error);
      setStorageWarning(true);
      return false;
    }
  };

  const addDataset = useCallback((dataset: UploadedDataset, mappingReport?: ColumnMappingReport[]) => {
    console.log('Adding dataset:', dataset.type, dataset.fileName);
    setDatasets(prev => {
      const updated = {
        ...prev,
        [dataset.type]: dataset,
      };

      const newMappingReports = mappingReport ? {
        ...mappingReports,
        [dataset.type]: {
          datasetType: dataset.type,
          report: mappingReport,
          timestamp: new Date().toISOString(),
        },
      } : mappingReports;

      if (mappingReport) {
        setMappingReports(newMappingReports);
      }

      saveToStorage(updated, newMappingReports);
      return updated;
    });
  }, [mappingReports]);

  const updateValidationReport = useCallback((type: DatasetType, report: ValidationReport) => {
    console.log('Updating validation report for:', type);
    setDatasets(prev => {
      const existing = prev[type];
      if (!existing) return prev;
      const updated = {
        ...prev,
        [type]: { ...existing, validationReport: report },
      };
      saveToStorage(updated, mappingReports);
      return updated;
    });
  }, [mappingReports]);

  const updateAIAnalysis = useCallback((type: DatasetType, analysis: AIAnalysis) => {
    console.log('Updating AI analysis for:', type);
    setDatasets(prev => {
      const existing = prev[type];
      if (!existing) return prev;
      const updated = {
        ...prev,
        [type]: { ...existing, aiAnalysis: analysis },
      };
      saveToStorage(updated, mappingReports);
      return updated;
    });
  }, [mappingReports]);

  const updateDatasetRow = useCallback((type: DatasetType, rowIndex: number, updatedRow: any) => {
    console.log('Updating row in dataset:', type, 'rowIndex:', rowIndex);
    setDatasets(prev => {
      const existing = prev[type];
      if (!existing || rowIndex < 0 || rowIndex >= existing.data.length) return prev;
      const newData = [...existing.data];
      newData[rowIndex] = updatedRow;
      const updated = {
        ...prev,
        [type]: { ...existing, data: newData },
      };
      saveToStorage(updated, mappingReports);
      return updated;
    });
  }, [mappingReports]);

  const deleteDatasetRow = useCallback((type: DatasetType, rowIndex: number) => {
    console.log('Deleting row in dataset:', type, 'rowIndex:', rowIndex);
    setDatasets(prev => {
      const existing = prev[type];
      if (!existing || rowIndex < 0 || rowIndex >= existing.data.length) return prev;
      const newData = existing.data.filter((_, i) => i !== rowIndex);
      const updated = {
        ...prev,
        [type]: { ...existing, data: newData },
      };
      saveToStorage(updated, mappingReports);
      return updated;
    });
  }, [mappingReports]);

  const removeDataset = useCallback((type: DatasetType) => {
    console.log('Removing dataset:', type);
    setDatasets(prev => {
      const updated = {
        ...prev,
        [type]: null,
      };
      const newMappingReports = {
        ...mappingReports,
        [type]: null,
      };
      setMappingReports(newMappingReports);
      saveToStorage(updated, newMappingReports);
      return updated;
    });
  }, [mappingReports]);

  const clearAllData = useCallback(async () => {
    console.log('Clearing all data');
    const emptyDatasets = {
      COLLAR: null,
      SURVEY: null,
      LITHOLOGY: null,
      ASSAY: null,
    };
    const emptyReports = {
      COLLAR: null,
      SURVEY: null,
      LITHOLOGY: null,
      ASSAY: null,
    };
    setDatasets(emptyDatasets);
    setMappingReports(emptyReports);
    setStorageWarning(false);

    try {
      await clearAllLocalData();
      console.log('Storage cleared');
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }, []);

  const getStorageStats = useCallback(async () => {
    return { sizeBytes: 0, sizeMB: 0 };
  }, []);

  const collarHoleIds = useMemo(() => {
    const collar = datasets.COLLAR;
    if (!collar) return [];
    return collar.data.map(row => String((row as CollarRow).HOLEID)).filter(Boolean);
  }, [datasets.COLLAR]);

  const uploadedCount = useMemo(() => {
    return Object.values(datasets).filter(Boolean).length;
  }, [datasets]);

  const totalErrors = useMemo(() => {
    return Object.values(datasets).reduce((sum, ds) => {
      return sum + (ds?.validationReport?.errors.length || 0);
    }, 0);
  }, [datasets]);

  const totalWarnings = useMemo(() => {
    return Object.values(datasets).reduce((sum, ds) => {
      return sum + (ds?.validationReport?.warnings.length || 0);
    }, 0);
  }, [datasets]);

  const totalRowCount = useMemo(() => {
    return Object.values(datasets).reduce((sum, ds) => {
      return sum + (ds?.data.length || 0);
    }, 0);
  }, [datasets]);

  return {
    datasets,
    mappingReports,
    isLoading,
    storageWarning,
    addDataset,
    updateValidationReport,
    updateAIAnalysis,
    updateDatasetRow,
    deleteDatasetRow,
    removeDataset,
    clearAllData,
    getStorageStats,
    collarHoleIds,
    uploadedCount,
    totalErrors,
    totalWarnings,
    totalRowCount,
  };
});
