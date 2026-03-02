import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useError } from '@/contexts/ErrorContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Upload,
  FileSpreadsheet,
  Check,
  X,
  ChevronDown,
  Database,
  Activity,
  Layers,
  TrendingUp,
  AlertTriangle,
  Info,
  CheckCircle,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import {
  parseExcelData,
  parseCSVData,
  detectColumnMappingsWithReport,
  applyColumnMappings,
  getMissingColumns,
  normalizeSurveyData,
  validateAndNormalizeData
} from '@/utils/excelParser';
import type { ColumnMappingReport } from '@/utils/columnMapping';
// Removed trpc to bypass API calls
import type { DatasetType, UploadedDataset, DataRow, SurveyRow } from '@/types/geology';
import { REQUIRED_COLUMNS } from '@/types/geology';

const MAX_FILE_SIZE_MB = 50;

export default function UploadScreen() {
  const { colors } = useTheme();
  const { datasets, addDataset, updateValidationReport, collarHoleIds, storageWarning } = useData();
  const { showError } = useError();

  const [selectedType, setSelectedType] = useState<DatasetType>('COLLAR');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedData, setParsedData] = useState<{
    headers: string[];
    data: Record<string, unknown>[];
    fileName: string;
    sizeWarning?: boolean;
    previewOnly?: boolean;
  } | null>(null);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [mappingReport, setMappingReport] = useState<ColumnMappingReport[]>([]);
  const [showMappingUI, setShowMappingUI] = useState(false);
  const [surveyNormChanges, setSurveyNormChanges] = useState<string[]>([]);

  const datasetTypes: { type: DatasetType; label: string; icon: React.ReactNode }[] = [
    { type: 'COLLAR', label: 'COLLAR', icon: <Database size={20} color={colors.collar} /> },
    { type: 'SURVEY', label: 'SURVEY', icon: <Activity size={20} color={colors.survey} /> },
    { type: 'LITHOLOGY', label: 'LITHOLOGY', icon: <Layers size={20} color={colors.lithology} /> },
    { type: 'ASSAY', label: 'ASSAY', icon: <TrendingUp size={20} color={colors.assay} /> },
  ];

  const pickDocument = useCallback(async () => {
    try {
      setIsLoading(true);
      setSurveyNormChanges([]);
      console.log('Starting document picker...');

      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'text/comma-separated-values',
          'application/csv',
        ],
        copyToCacheDirectory: true,
      });

      console.log('Document picker result:', result);

      if (result.canceled || !result.assets || result.assets.length === 0) {
        console.log('Document picker cancelled');
        setIsLoading(false);
        return;
      }

      const file = result.assets[0];
      console.log('Selected file:', file.name);

      const fileSizeMB = (file.size || 0) / 1024 / 1024;
      if (fileSizeMB > MAX_FILE_SIZE_MB) {
        showError({
          severity: 'WARN',
          title: 'Dosya Çok Büyük',
          message: `Dosya boyutu ${fileSizeMB.toFixed(1)}MB. Maksimum ${MAX_FILE_SIZE_MB}MB desteklenmektedir.\n\nÖnizleme modunda açılacak.`,
          parsingData: {
            fileName: file.name || 'Bilinmeyen Dosya',
            maxSizeMB: MAX_FILE_SIZE_MB,
            supportedFormats: ['.xlsx', '.csv']
          }
        });
      }

      const fileName = file.name || '';
      const isCSV = fileName.toLowerCase().endsWith('.csv') ||
        (file.mimeType && (file.mimeType.includes('csv') || file.mimeType === 'text/comma-separated-values'));

      console.log('File type detection:', { fileName, mimeType: file.mimeType, isCSV });

      let parsed;

      if (isCSV) {
        const csvText = await FileSystem.readAsStringAsync(file.uri);
        parsed = parseCSVData(csvText);
      } else {
        const base64Data = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
        parsed = parseExcelData(base64Data);
      }

      if (parsed.data.length === 0) {
        showError({
          severity: 'ERROR',
          title: 'Dosya Okunamadı',
          message: 'Excel dosyası boş veya okunamadı.',
          parsingData: {
            fileName: file.name || '',
            maxSizeMB: MAX_FILE_SIZE_MB,
            supportedFormats: ['.xlsx', '.csv']
          },
          onRetry: pickDocument
        });
        setIsLoading(false);
        return;
      }

      if (parsed.sizeWarning) {
        showError({
          severity: 'WARN',
          title: 'Büyük Dosya Uyarısı',
          message: `Dosya boyutu büyük. ${parsed.previewOnly ? 'İlk 1000 satır önizleme için yüklendi.' : 'Performans etkilenebilir.'}`
        });
      }

      const mappingResult = detectColumnMappingsWithReport(parsed.headers, selectedType);
      const missing = getMissingColumns(mappingResult.mappings, selectedType);

      setParsedData({
        headers: parsed.headers,
        data: parsed.data,
        fileName: file.name,
        sizeWarning: parsed.sizeWarning,
        previewOnly: parsed.previewOnly,
      });
      setColumnMappings(mappingResult.mappings);
      setMappingReport(mappingResult.report);

      if (missing.length > 0) {
        setShowMappingUI(true);
        showError({
          severity: 'ERROR',
          title: 'Sütun Eşleştirme Gerekli',
          message: `Eksik sütunlar: ${missing.join(', ')}\n\nLütfen manuel olarak eşleştirin.`
        });
      } else {
        const hasLowConfidence = mappingResult.report.some(r => r.confidence < 0.9 && r.confidence > 0);
        if (hasLowConfidence) {
          setShowMappingUI(true);
          showError({
            severity: 'WARN',
            title: 'Eşleştirme Doğrulama',
            message: 'Bazı sütunlar düşük güvenle eşleştirildi. Lütfen kontrol edin.'
          });
        } else {
          await processData(parsed.data, mappingResult.mappings, file.name, mappingResult.report);
        }
      }
    } catch (error: any) {
      console.error('File pick error:', error);
      showError({
        severity: 'ERROR',
        title: 'Dosya Hatası',
        message: 'Dosya yüklenirken bir hata oluştu.',
        details: error.message
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedType]);

  const processData = async (
    data: Record<string, unknown>[],
    mappings: Record<string, string>,
    fileName: string,
    report: ColumnMappingReport[]
  ) => {
    try {
      setIsLoading(true);
      console.log('Processing data with mappings:', mappings);

      const { normalized, report: validationReport } = validateAndNormalizeData(
        data,
        selectedType,
        mappings,
        'AUTO_FIX'
      );

      let finalData = normalized;

      if (selectedType === 'SURVEY') {
        const surveyData = finalData as unknown as SurveyRow[];
        const { normalized: surveyNorm, changes } = normalizeSurveyData(surveyData);
        finalData = surveyNorm as unknown as Record<string, unknown>[];
        setSurveyNormChanges(changes);

        if (changes.length > 0) {
          showError({
            severity: 'INFO',
            title: 'Survey Verisi Normalize Edildi',
            message: `${changes.length} değişiklik yapıldı:\n${changes.slice(0, 3).join('\n')}${changes.length > 3 ? `\n... ve ${changes.length - 3} daha` : ''}`
          });
        }
      }

      const dataset: UploadedDataset = {
        id: `${selectedType}_${Date.now()}`,
        type: selectedType,
        fileName,
        data: finalData as DataRow[],
        headers: Object.keys(finalData[0] || {}),
        columnMapping: {
          required: REQUIRED_COLUMNS[selectedType],
          detected: Object.keys(mappings),
          mappings,
        },
        uploadedAt: new Date().toISOString(),
        validationReport: validationReport
      };

      addDataset(dataset, report);

      setParsedData(null);
      setColumnMappings({});
      setMappingReport([]);
      setShowMappingUI(false);

      const totalIssues = validationReport.errors.length + validationReport.warnings.length;
      if (totalIssues > 0) {
        showError({
          severity: validationReport.errors.length > 0 ? 'ERROR' : 'WARN',
          title: 'Doğrulama Tamamlandı',
          message: `${fileName} yüklendi ancak bazı sorunlar tespit edildi.`,
          validationData: {
            issues: [...validationReport.errors, ...validationReport.warnings] as any,
            totalCount: totalIssues
          }
        });
      } else {
        showError({
          severity: 'INFO',
          title: 'Başarılı',
          message: `${fileName} sorunsuz bir şekilde yüklendi.`
        });
      }
    } catch (error: any) {
      console.error('Process data error:', error);
      showError({
        severity: 'ERROR',
        title: 'İşleme Hatası',
        message: 'Veri işlenirken bir hata oluştu.',
        details: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMappingChange = (requiredCol: string, selectedHeader: string) => {
    setColumnMappings(prev => ({
      ...prev,
      [requiredCol]: selectedHeader,
    }));
  };

  const confirmMapping = () => {
    const missing = getMissingColumns(columnMappings, selectedType);
    if (missing.length > 0) {
      showError({
        severity: 'ERROR',
        title: 'Eksik Eşleştirme',
        message: `Şu sütunlar eşleştirilmedi: ${missing.join(', ')}`
      });
      return;
    }

    if (parsedData) {
      processData(parsedData.data, columnMappings, parsedData.fileName, mappingReport);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return colors.success;
    if (confidence >= 0.75) return colors.warning;
    return colors.error;
  };

  const getMatchTypeIcon = (type: string, confidence: number) => {
    if (confidence === 0) return <X size={14} color={colors.error} />;
    if (confidence >= 0.9) return <CheckCircle size={14} color={colors.success} />;
    if (confidence >= 0.75) return <AlertTriangle size={14} color={colors.warning} />;
    return <Info size={14} color={colors.info} />;
  };

  const existingDataset = datasets[selectedType];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Veri Yükleme</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Excel veya CSV dosyası yükleyin (.xlsx, .csv)
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {storageWarning && (
          <View style={[styles.warningBanner, { backgroundColor: colors.warning + '20' }]}>
            <AlertTriangle size={16} color={colors.warning} />
            <Text style={[styles.warningText, { color: colors.warning }]}>
              Depolama limiti yaklaşıyor. Veri temizlemeyi düşünün.
            </Text>
          </View>
        )}

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          VERİ SETİ TİPİ
        </Text>

        <TouchableOpacity
          style={[styles.typePicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setShowTypePicker(!showTypePicker)}
        >
          <View style={styles.typePickerContent}>
            {datasetTypes.find(t => t.type === selectedType)?.icon}
            <Text style={[styles.typePickerText, { color: colors.text }]}>
              {selectedType}
            </Text>
          </View>
          <ChevronDown size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {showTypePicker && (
          <View style={[styles.typeOptions, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {datasetTypes.map(({ type, label, icon }) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeOption,
                  type === selectedType && { backgroundColor: colors.primary + '15' },
                ]}
                onPress={() => {
                  setSelectedType(type);
                  setShowTypePicker(false);
                  setParsedData(null);
                  setShowMappingUI(false);
                }}
              >
                {icon}
                <Text style={[
                  styles.typeOptionText,
                  { color: type === selectedType ? colors.primary : colors.text }
                ]}>
                  {label}
                </Text>
                {type === selectedType && <Check size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {existingDataset && (
          <View style={[styles.existingData, { backgroundColor: colors.successLight }]}>
            <FileSpreadsheet size={20} color={colors.success} />
            <View style={styles.existingDataInfo}>
              <Text style={[styles.existingDataTitle, { color: colors.success }]}>
                Mevcut veri: {existingDataset.fileName}
              </Text>
              <Text style={[styles.existingDataSubtitle, { color: colors.success }]}>
                {existingDataset.data.length} satır • {existingDataset.uploadedAt.split('T')[0]}
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.uploadArea,
            { backgroundColor: colors.surface, borderColor: colors.border },
            isLoading && styles.uploadAreaLoading,
          ]}
          onPress={pickDocument}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                {parsedData ? 'Veri İşleniyor...' : 'Dosya Okunuyor...'}
              </Text>
            </View>
          ) : (
            <>
              <View style={[styles.uploadIconContainer, { backgroundColor: colors.primary + '15' }]}>
                <Upload size={32} color={colors.primary} />
              </View>
              <Text style={[styles.uploadText, { color: colors.text }]}>
                Dosya Seçin
              </Text>
              <Text style={[styles.uploadSubtext, { color: colors.textSecondary }]}>
                .xlsx veya .csv formatında dosya yükleyin (maks. {MAX_FILE_SIZE_MB}MB)
              </Text>
            </>
          )}
        </TouchableOpacity>

        {parsedData && (
          <View style={[styles.previewCard, { backgroundColor: colors.surface }]}>
            <View style={styles.previewHeader}>
              <FileSpreadsheet size={20} color={colors.primary} />
              <Text style={[styles.previewTitle, { color: colors.text }]}>
                {parsedData.fileName}
              </Text>
              {parsedData.previewOnly && (
                <View style={[styles.previewBadge, { backgroundColor: colors.warning + '20' }]}>
                  <Text style={[styles.previewBadgeText, { color: colors.warning }]}>Önizleme</Text>
                </View>
              )}
            </View>
            <Text style={[styles.previewInfo, { color: colors.textSecondary }]}>
              {parsedData.data.length} satır • {parsedData.headers.length} sütun
            </Text>

            <View style={styles.previewHeaders}>
              <Text style={[styles.previewHeadersLabel, { color: colors.textSecondary }]}>
                Tespit edilen sütunlar:
              </Text>
              <View style={styles.headerChips}>
                {parsedData.headers.slice(0, 8).map((header, i) => (
                  <View key={i} style={[styles.headerChip, { backgroundColor: colors.surfaceSecondary }]}>
                    <Text style={[styles.headerChipText, { color: colors.text }]} numberOfLines={1}>
                      {header}
                    </Text>
                  </View>
                ))}
                {parsedData.headers.length > 8 && (
                  <View style={[styles.headerChip, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.headerChipText, { color: colors.primary }]}>
                      +{parsedData.headers.length - 8}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {showMappingUI && parsedData && (
          <View style={[styles.mappingCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.mappingTitle, { color: colors.text }]}>
              Sütun Eşleştirme
            </Text>
            <Text style={[styles.mappingSubtitle, { color: colors.textSecondary }]}>
              Gerekli sütunları dosyanızdaki sütunlarla eşleştirin
            </Text>

            {mappingReport.map((item) => (
              <View key={item.requiredColumn} style={styles.mappingRow}>
                <View style={styles.mappingLabelRow}>
                  {getMatchTypeIcon(item.matchType, item.confidence)}
                  <Text style={[styles.mappingLabel, { color: colors.text }]}>
                    {item.requiredColumn}
                  </Text>
                  {item.confidence > 0 && (
                    <Text style={[styles.confidenceText, { color: getConfidenceColor(item.confidence) }]}>
                      {(item.confidence * 100).toFixed(0)}%
                    </Text>
                  )}
                </View>
                <View style={[styles.mappingSelect, { backgroundColor: colors.surfaceSecondary }]}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.mappingOptions}
                  >
                    {parsedData.headers.map((header) => {
                      const alt = item.alternatives.find(a => a.header === header);
                      return (
                        <TouchableOpacity
                          key={header}
                          style={[
                            styles.mappingOption,
                            columnMappings[item.requiredColumn] === header && {
                              backgroundColor: colors.primary,
                            },
                            alt && columnMappings[item.requiredColumn] !== header && {
                              borderWidth: 1,
                              borderColor: colors.primary + '50',
                            },
                          ]}
                          onPress={() => handleMappingChange(item.requiredColumn, header)}
                        >
                          <Text style={[
                            styles.mappingOptionText,
                            { color: columnMappings[item.requiredColumn] === header ? '#FFF' : colors.text }
                          ]}>
                            {header}
                          </Text>
                          {alt && columnMappings[item.requiredColumn] !== header && (
                            <Text style={[styles.altScore, { color: colors.textTertiary }]}>
                              {(alt.score * 100).toFixed(0)}%
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            ))}

            <View style={styles.mappingActions}>
              <TouchableOpacity
                style={[styles.mappingButton, styles.mappingButtonCancel, { borderColor: colors.border }]}
                onPress={() => {
                  setParsedData(null);
                  setShowMappingUI(false);
                }}
              >
                <X size={18} color={colors.textSecondary} />
                <Text style={[styles.mappingButtonText, { color: colors.textSecondary }]}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.mappingButton, { backgroundColor: colors.primary }]}
                onPress={confirmMapping}
              >
                <Check size={18} color="#FFF" />
                <Text style={[styles.mappingButtonText, { color: '#FFF' }]}>Onayla</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!showMappingUI && parsedData && (
          <View style={styles.autoProcessing}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.autoProcessingText, { color: colors.textSecondary }]}>
              Veri işleniyor...
            </Text>
          </View>
        )}

        {surveyNormChanges.length > 0 && (
          <View style={[styles.normChangesCard, { backgroundColor: colors.info + '15' }]}>
            <View style={styles.normChangesHeader}>
              <Info size={18} color={colors.info} />
              <Text style={[styles.normChangesTitle, { color: colors.info }]}>
                Survey Normalizasyonu ({surveyNormChanges.length} değişiklik)
              </Text>
            </View>
            <ScrollView style={styles.normChangesList} nestedScrollEnabled>
              {surveyNormChanges.slice(0, 5).map((change, i) => (
                <Text key={i} style={[styles.normChangeItem, { color: colors.textSecondary }]}>
                  • {change}
                </Text>
              ))}
              {surveyNormChanges.length > 5 && (
                <Text style={[styles.normChangeItem, { color: colors.textTertiary }]}>
                  ... ve {surveyNormChanges.length - 5} daha
                </Text>
              )}
            </ScrollView>
          </View>
        )}
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
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  warningText: {
    fontSize: 13,
    flex: 1,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  typePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  typePickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  typePickerText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  typeOptions: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  typeOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500' as const,
  },
  existingData: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  existingDataInfo: {
    flex: 1,
  },
  existingDataTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  existingDataSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  uploadArea: {
    padding: 40,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadAreaLoading: {
    borderStyle: 'solid',
  },
  uploadIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  uploadText: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  uploadSubtext: {
    fontSize: 14,
  },
  previewCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    flex: 1,
  },
  previewBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  previewBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  previewInfo: {
    fontSize: 14,
    marginBottom: 16,
  },
  previewHeaders: {
    gap: 8,
  },
  previewHeadersLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  headerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: 120,
  },
  headerChipText: {
    fontSize: 13,
  },
  mappingCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  mappingTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  mappingSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  mappingRow: {
    marginBottom: 16,
  },
  mappingLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  mappingLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    flex: 1,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  mappingSelect: {
    borderRadius: 10,
    padding: 4,
  },
  mappingOptions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  mappingOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mappingOptionText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  altScore: {
    fontSize: 10,
  },
  mappingActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  mappingButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  mappingButtonCancel: {
    borderWidth: 1,
  },
  mappingButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  autoProcessing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
  },
  autoProcessingText: {
    fontSize: 15,
  },
  normChangesCard: {
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  normChangesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  normChangesTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  normChangesList: {
    maxHeight: 120,
  },
  normChangeItem: {
    fontSize: 12,
    marginBottom: 4,
  },
});
