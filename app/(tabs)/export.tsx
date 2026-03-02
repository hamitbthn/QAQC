import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useError } from '@/contexts/ErrorContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Download,
  FileJson,
  FileText,
  Table,
  CheckCircle2,
  AlertCircle,
  Database,
  Activity,
  Layers,
  TrendingUp,
  ClipboardCheck,
  MapPin,
  Trash2,
  HardDrive,
  Shield,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useQAQC } from '@/contexts/QAQCContext';
import { exportToCSV, exportValidationReport, generateMappingReportText } from '@/utils/excelParser';
import { LegalNotices } from '@/components/LegalNotices';
import type { DatasetType } from '@/types/geology';

type ExportFormat = 'csv' | 'json' | 'txt';

interface ExportOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  formats: ExportFormat[];
  available: boolean;
}

export default function ExportScreen() {
  const { colors } = useTheme();
  const { datasets, mappingReports, clearAllData, getStorageStats, storageWarning } = useData();
  const { result: qaqcResult } = useQAQC();
  const { showError } = useError();

  const [exporting, setExporting] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<{ sizeMB: number } | null>(null);

  const loadStorageInfo = useCallback(async () => {
    const stats = await getStorageStats();
    setStorageInfo(stats);
  }, [getStorageStats]);

  React.useEffect(() => {
    loadStorageInfo();
  }, [loadStorageInfo]);

  const datasetIcons: Record<DatasetType, React.ReactNode> = {
    COLLAR: <Database size={20} color={colors.collar} />,
    SURVEY: <Activity size={20} color={colors.survey} />,
    LITHOLOGY: <Layers size={20} color={colors.lithology} />,
    ASSAY: <TrendingUp size={20} color={colors.assay} />,
  };

  const exportOptions: ExportOption[] = [
    ...(['COLLAR', 'SURVEY', 'LITHOLOGY', 'ASSAY'] as DatasetType[]).map(type => ({
      id: `data_${type}`,
      title: `${type} Verisi`,
      description: datasets[type]
        ? `${datasets[type]!.data.length} satır • ${datasets[type]!.fileName}`
        : 'Yüklenmedi',
      icon: datasetIcons[type],
      formats: ['csv', 'json'] as ExportFormat[],
      available: !!datasets[type],
    })),
    ...(['COLLAR', 'SURVEY', 'LITHOLOGY', 'ASSAY'] as DatasetType[]).map(type => ({
      id: `mapping_${type}`,
      title: `${type} Sütun Eşleme Raporu`,
      description: mappingReports[type]
        ? `${mappingReports[type]!.report.length} sütun eşleştirildi`
        : 'Rapor yok',
      icon: <MapPin size={20} color={colors.info} />,
      formats: ['txt', 'json'] as ExportFormat[],
      available: !!mappingReports[type],
    })),
    ...(['COLLAR', 'SURVEY', 'LITHOLOGY', 'ASSAY'] as DatasetType[]).map(type => ({
      id: `report_${type}`,
      title: `${type} Doğrulama Raporu`,
      description: datasets[type]?.validationReport
        ? `${datasets[type]!.validationReport!.errors.length} hata, ${datasets[type]!.validationReport!.warnings.length} uyarı`
        : 'Rapor yok',
      icon: <ClipboardCheck size={20} color={colors.primary} />,
      formats: ['txt', 'json'] as ExportFormat[],
      available: !!datasets[type]?.validationReport,
    })),
    {
      id: 'combined_report',
      title: 'Kombine Rapor',
      description: 'Tüm eşleme ve doğrulama raporları',
      icon: <ClipboardCheck size={20} color={colors.success} />,
      formats: ['txt', 'json'] as ExportFormat[],
      available: Object.values(datasets).some(d => d?.validationReport) || Object.values(mappingReports).some(r => r),
    },
    {
      id: 'qaqc_report',
      title: 'QA/QC Raporu',
      description: qaqcResult
        ? `${qaqcResult.summary.critical} kritik, ${qaqcResult.summary.warn} uyarı, ${qaqcResult.summary.info} bilgi`
        : 'Rapor yok',
      icon: <Shield size={20} color={colors.primary} />,
      formats: ['json'] as ExportFormat[],
      available: !!qaqcResult,
    },
    {
      id: 'qaqc_summary_csv',
      title: 'QA/QC Özet (Kuyu Bazlı)',
      description: qaqcResult
        ? `${qaqcResult.summary.totalHoles} kuyu`
        : 'Rapor yok',
      icon: <Shield size={20} color={colors.success} />,
      formats: ['csv', 'json'] as ExportFormat[],
      available: !!qaqcResult,
    },
    {
      id: 'qaqc_fixes',
      title: 'Düzeltme Raporu',
      description: qaqcResult && qaqcResult.summary.fixesApplied.length > 0
        ? `${qaqcResult.summary.fixesApplied.length} düzeltme uygulandı`
        : 'Düzeltme yok',
      icon: <Shield size={20} color={colors.warning} />,
      formats: ['json'] as ExportFormat[],
      available: !!qaqcResult && qaqcResult.summary.fixesApplied.length > 0,
    },
    {
      id: '3d_metadata',
      title: '3D Görselleştirme Meta Verisi',
      description: datasets.COLLAR ? `${datasets.COLLAR.data.length} sondaj koordinatı` : 'Veri yok',
      icon: <Layers size={20} color={colors.primary} />,
      formats: ['json'] as ExportFormat[],
      available: !!datasets.COLLAR,
    },
  ];

  const getFormatIcon = (format: ExportFormat) => {
    switch (format) {
      case 'csv': return <Table size={16} color={colors.success} />;
      case 'json': return <FileJson size={16} color={colors.info} />;
      case 'txt': return <FileText size={16} color={colors.warning} />;
    }
  };

  const generateExportContent = (optionId: string, format: ExportFormat): { content: string; filename: string } => {
    const parts = optionId.split('_');
    const category = parts[0];
    const type = parts.slice(1).join('_') as DatasetType;

    let content = '';
    let filename = '';

    if (category === 'data') {
      const dataset = datasets[type];
      if (!dataset) throw new Error('Veri bulunamadı');

      filename = `${type}_data_${Date.now()}`;
      if (format === 'csv') {
        content = exportToCSV(dataset.data as Record<string, unknown>[], filename);
      } else {
        content = JSON.stringify(dataset.data, null, 2);
      }
    } else if (category === 'mapping') {
      const mappingReport = mappingReports[type];
      if (!mappingReport) throw new Error('Eşleme raporu bulunamadı');

      filename = `${type}_mapping_report_${Date.now()}`;
      if (format === 'txt') {
        content = generateMappingReportText(mappingReport.report);
      } else {
        content = JSON.stringify(mappingReport, null, 2);
      }
    } else if (category === 'report') {
      const dataset = datasets[type];
      const report = dataset?.validationReport;
      if (!report) throw new Error('Rapor bulunamadı');

      filename = `${type}_validation_report_${Date.now()}`;
      if (format === 'txt') {
        content = exportValidationReport(report);
      } else {
        content = JSON.stringify(report, null, 2);
      }
    } else if (category === 'ai') {
      const dataset = datasets[type];
      const analysis = dataset?.aiAnalysis;
      if (!analysis) throw new Error('Analiz bulunamadı');

      filename = `${type}_ai_analysis_${Date.now()}`;
      if (format === 'txt') {
        content = [
          'AI ANALİZ RAPORU',
          '================',
          '',
          'ÖZET:',
          analysis.summary,
          '',
          'KÖK NEDENLER:',
          ...analysis.rootCauses.map((c, i) => `${i + 1}. ${c}`),
          '',
          'ÖNERİLEN DÜZELTME SIRASI:',
          ...analysis.suggestedFixOrder.map((f, i) => `${i + 1}. ${f}`),
          '',
          'SÜTUN EŞLEŞTİRME ÖNERİLERİ:',
          ...analysis.columnMappingSuggestions.map(s => `- ${s}`),
          '',
          'ALAN BAZLI NOTLAR:',
          ...Object.entries(analysis.fieldNotes).map(([k, v]) => `${k}: ${v}`),
          '',
          `Oluşturulma: ${new Date(analysis.timestamp).toLocaleString('tr-TR')}`,
        ].join('\n');
      } else {
        content = JSON.stringify(analysis, null, 2);
      }
    } else if (optionId === 'combined_report') {
      filename = `combined_report_${Date.now()}`;

      if (format === 'txt') {
        const sections: string[] = [
          'KOMBİNE RAPOR',
          '=============',
          `Oluşturulma: ${new Date().toLocaleString('tr-TR')}`,
          '',
        ];

        for (const datasetType of ['COLLAR', 'SURVEY', 'LITHOLOGY', 'ASSAY'] as DatasetType[]) {
          const mappingReport = mappingReports[datasetType];
          const dataset = datasets[datasetType];

          if (mappingReport || dataset?.validationReport) {
            sections.push(`\n${'='.repeat(40)}`);
            sections.push(`${datasetType} VERİ SETİ`);
            sections.push(`${'='.repeat(40)}\n`);

            if (mappingReport) {
              sections.push('SÜTUN EŞLEŞTİRME:');
              sections.push(generateMappingReportText(mappingReport.report));
              sections.push('');
            }

            if (dataset?.validationReport) {
              sections.push('DOĞRULAMA:');
              sections.push(exportValidationReport(dataset.validationReport));
              sections.push('');
            }
          }
        }

        content = sections.join('\n');
      } else {
        const combinedData = {
          timestamp: new Date().toISOString(),
          mappingReports: Object.fromEntries(
            Object.entries(mappingReports).filter(([_, v]) => v)
          ),
          validationReports: Object.fromEntries(
            Object.entries(datasets)
              .filter(([_, d]) => d?.validationReport)
              .map(([k, d]) => [k, d!.validationReport])
          ),
        };
        content = JSON.stringify(combinedData, null, 2);
      }
    } else if (optionId === 'qaqc_report') {
      filename = `QAQC_Raporu_${Date.now()}`;
      content = JSON.stringify(qaqcResult, null, 2);
    } else if (optionId === 'qaqc_summary_csv') {
      filename = `QAQC_Ozet_${Date.now()}`;
      if (format === 'csv') {
        const rows: Record<string, unknown>[] = [];
        if (qaqcResult?.summary.issuesByHole) {
          for (const [holeId, counts] of Object.entries(qaqcResult.summary.issuesByHole)) {
            rows.push({ HOLEID: holeId, CRITICAL: counts.critical, WARNING: counts.warn, INFO: counts.info });
          }
        }
        content = rows.length > 0 ? exportToCSV(rows, filename) : 'HOLEID,CRITICAL,WARNING,INFO';
      } else {
        content = JSON.stringify(qaqcResult?.summary.issuesByHole || {}, null, 2);
      }
    } else if (optionId === 'qaqc_fixes') {
      filename = `Duzeltme_Raporu_${Date.now()}`;
      content = JSON.stringify(qaqcResult?.summary.fixesApplied || [], null, 2);
    } else if (optionId === '3d_metadata') {
      filename = `3d_metadata_${Date.now()}`;

      const collar = datasets.COLLAR;
      const survey = datasets.SURVEY;
      const lithology = datasets.LITHOLOGY;

      const metadata = {
        timestamp: new Date().toISOString(),
        collarCount: collar?.data.length || 0,
        surveyCount: survey?.data.length || 0,
        lithologyCount: lithology?.data.length || 0,
        bounds: collar ? calculateBounds(collar.data) : null,
        holeIds: collar?.data.map(row => (row as Record<string, unknown>).HOLEID) || [],
        visualization: {
          recommendedMode: (collar?.data.length || 0) > 30 ? 'plan' : 'full3d',
          hasTrajectory: !!survey,
          hasLithology: !!lithology,
        },
      };

      content = JSON.stringify(metadata, null, 2);
    }

    return { content, filename: `${filename}.${format}` };
  };

  const calculateBounds = (collarData: unknown[]) => {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const row of collarData) {
      const r = row as Record<string, unknown>;
      const x = Number(r.XCOLLAR);
      const y = Number(r.YCOLLAR);
      const z = Number(r.ZCOLLAR);

      if (!isNaN(x)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
      if (!isNaN(y)) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      if (!isNaN(z)) { minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
    }

    return { minX, maxX, minY, maxY, minZ, maxZ };
  };

  const handleExport = useCallback(async (optionId: string, format: ExportFormat) => {
    try {
      setExporting(`${optionId}_${format}`);

      const { content, filename } = generateExportContent(optionId, format);

      if (Platform.OS === 'web') {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showError({
          severity: 'INFO',
          title: 'Başarılı',
          message: `${filename} indirildi`
        });
      } else {
        const fileUri = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(fileUri, content, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: format === 'json' ? 'application/json' : 'text/plain',
            dialogTitle: `${filename} paylaş`,
          });
        } else {
          showError({
            severity: 'INFO',
            title: 'Bilgi',
            message: `Dosya kaydedildi: ${fileUri}`
          });
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      showError({
        severity: 'ERROR',
        title: 'Hata',
        message: 'Dışa aktarma sırasında bir hata oluştu'
      });
    } finally {
      setExporting(null);
    }
  }, [datasets, mappingReports, qaqcResult]);

  const handleClearData = useCallback(() => {
    showError({
      severity: 'WARN',
      title: 'Veri Temizle',
      message: 'Tüm yüklenen veriler ve raporlar silinecek. Bu işlem geri alınamaz.',
      primaryAction: {
        label: 'Temizle',
        style: 'destructive',
        onPress: async () => {
          await clearAllData();
          loadStorageInfo();
          showError({
            severity: 'INFO',
            title: 'Başarılı',
            message: 'Tüm veriler temizlendi'
          });
        }
      }
    });
  }, [clearAllData, loadStorageInfo]);

  const availableExports = exportOptions.filter(opt => opt.available);
  const unavailableExports = exportOptions.filter(opt => !opt.available);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerRow}>
            <Download size={24} color={colors.primary} />
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Dışa Aktar</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                Veri ve raporları indirin
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.storageCard, { backgroundColor: colors.surface }]}>
          <View style={styles.storageHeader}>
            <HardDrive size={20} color={colors.primary} />
            <Text style={[styles.storageTitle, { color: colors.text }]}>Depolama</Text>
          </View>
          <Text style={[styles.storageInfo, { color: colors.textSecondary }]}>
            Kullanılan: {storageInfo?.sizeMB.toFixed(2) || '0'} MB
          </Text>
          {storageWarning && (
            <Text style={[styles.storageWarning, { color: colors.warning }]}>
              Depolama limiti yaklaşıyor
            </Text>
          )}
          <TouchableOpacity
            style={[styles.clearButton, { backgroundColor: colors.error + '15' }]}
            onPress={handleClearData}
          >
            <Trash2 size={16} color={colors.error} />
            <Text style={[styles.clearButtonText, { color: colors.error }]}>Veri Temizle</Text>
          </TouchableOpacity>
        </View>

        {availableExports.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <CheckCircle2 size={18} color={colors.success} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Dışa Aktarılabilir ({availableExports.length})
              </Text>
            </View>

            {availableExports.map((option) => (
              <View key={option.id} style={[styles.exportCard, { backgroundColor: colors.surface }]}>
                <View style={styles.exportHeader}>
                  <View style={[styles.exportIconBg, { backgroundColor: colors.surfaceSecondary }]}>
                    {option.icon}
                  </View>
                  <View style={styles.exportInfo}>
                    <Text style={[styles.exportTitle, { color: colors.text }]}>{option.title}</Text>
                    <Text style={[styles.exportDesc, { color: colors.textSecondary }]}>{option.description}</Text>
                  </View>
                </View>

                <View style={styles.formatButtons}>
                  {option.formats.map((format) => (
                    <TouchableOpacity
                      key={format}
                      style={[
                        styles.formatButton,
                        { backgroundColor: colors.surfaceSecondary },
                        exporting === `${option.id}_${format}` && { opacity: 0.5 },
                      ]}
                      onPress={() => handleExport(option.id, format)}
                      disabled={exporting !== null}
                    >
                      {getFormatIcon(format)}
                      <Text style={[styles.formatText, { color: colors.text }]}>
                        {format.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </>
        )}

        {unavailableExports.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { marginTop: 24 }]}>
              <AlertCircle size={18} color={colors.textTertiary} />
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Kullanılamaz ({unavailableExports.length})
              </Text>
            </View>

            {unavailableExports.slice(0, 4).map((option) => (
              <View
                key={option.id}
                style={[styles.exportCard, styles.exportCardDisabled, { backgroundColor: colors.surfaceSecondary }]}
              >
                <View style={styles.exportHeader}>
                  <View style={[styles.exportIconBg, { backgroundColor: colors.background, opacity: 0.5 }]}>
                    {option.icon}
                  </View>
                  <View style={styles.exportInfo}>
                    <Text style={[styles.exportTitle, { color: colors.textTertiary }]}>{option.title}</Text>
                    <Text style={[styles.exportDesc, { color: colors.textTertiary }]}>{option.description}</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {availableExports.length === 0 && (
          <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
            <Download size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Veri Yok</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Dışa aktarmak için önce veri yükleyin
            </Text>
          </View>
        )}

        <View style={styles.legalSection}>
          <LegalNotices compact />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    backgroundColor: 'transparent',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  storageCard: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
  },
  storageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  storageTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  storageInfo: {
    fontSize: 14,
    marginBottom: 4,
  },
  storageWarning: {
    fontSize: 13,
    marginBottom: 12,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 8,
    marginTop: 8,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  exportCard: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  exportCardDisabled: {
    opacity: 0.6,
  },
  exportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  exportIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportInfo: {
    flex: 1,
  },
  exportTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  exportDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  formatButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  formatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  formatText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  emptyState: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  legalSection: {
    marginTop: 24,
  },
});
