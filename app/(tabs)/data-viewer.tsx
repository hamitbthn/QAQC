import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useError } from '@/contexts/ErrorContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Database,
  Activity,
  Layers,
  TrendingUp,
  Edit3,
  X,
  Save,
  Trash2,
  Table as TableIcon,
  AlertCircle,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useQAQC } from '@/contexts/QAQCContext';
import type { DatasetType } from '@/types/geology';

type EditingCell = {
  datasetType: DatasetType;
  rowIndex: number;
  columnKey: string;
  currentValue: any;
};

export default function DataViewerScreen() {
  const { colors } = useTheme();
  const { datasets, updateDatasetRow, deleteDatasetRow } = useData();
  const { result: qaqcResult, runValidation, isRunning } = useQAQC();
  const { showError } = useError();

  const [selectedDataset, setSelectedDataset] = useState<DatasetType | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isRevalidating, setIsRevalidating] = useState(false);

  const datasetTypes: DatasetType[] = ['COLLAR', 'SURVEY', 'LITHOLOGY', 'ASSAY'];

  const getDatasetIcon = (type: DatasetType) => {
    switch (type) {
      case 'COLLAR': return <Database size={18} color={colors.collar} />;
      case 'SURVEY': return <Activity size={18} color={colors.survey} />;
      case 'LITHOLOGY': return <Layers size={18} color={colors.lithology} />;
      case 'ASSAY': return <TrendingUp size={18} color={colors.assay} />;
    }
  };

  const errorMapByDataset = useMemo(() => {
    if (!qaqcResult) return {};
    const map: Record<DatasetType, Map<number, string[]>> = {
      COLLAR: new Map(),
      SURVEY: new Map(),
      LITHOLOGY: new Map(),
      ASSAY: new Map(),
    };

    for (const issue of qaqcResult.issues) {
      if (issue.rowIndex !== undefined && issue.rowIndex >= 0) {
        const tableMap: DatasetType | null =
          issue.table === 'collar' ? 'COLLAR' :
            issue.table === 'survey' ? 'SURVEY' :
              issue.table === 'lithology' ? 'LITHOLOGY' :
                issue.table === 'assay' ? 'ASSAY' : null;

        if (tableMap) {
          if (!map[tableMap].has(issue.rowIndex)) {
            map[tableMap].set(issue.rowIndex, []);
          }
          map[tableMap].get(issue.rowIndex)!.push(issue.message);
        }
      }
    }

    return map;
  }, [qaqcResult]);

  const handleEditCell = useCallback((type: DatasetType, rowIndex: number, columnKey: string, value: any) => {
    setEditingCell({ datasetType: type, rowIndex, columnKey, currentValue: value });
    setEditValue(String(value ?? ''));
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingCell) return;

    const dataset = datasets[editingCell.datasetType];
    if (!dataset) return;

    const updatedRow = {
      ...dataset.data[editingCell.rowIndex],
      [editingCell.columnKey]: editValue,
    };

    updateDatasetRow(editingCell.datasetType, editingCell.rowIndex, updatedRow);
    setEditingCell(null);
    setEditValue('');

    setIsRevalidating(true);
    await runValidation();
    setIsRevalidating(false);
  }, [editingCell, editValue, datasets, updateDatasetRow, runValidation]);

  const handleDeleteRow = useCallback((type: DatasetType, rowIndex: number) => {
    showError({
      severity: 'WARN',
      title: 'Satırı Sil',
      message: 'Bu satırı silmek istediğinizden emin misiniz?',
      primaryAction: {
        label: 'Sil',
        style: 'destructive',
        onPress: async () => {
          deleteDatasetRow(type, rowIndex);
          setIsRevalidating(true);
          await runValidation();
          setIsRevalidating(false);
        }
      }
    });
  }, [deleteDatasetRow, runValidation]);

  const renderDatasetButton = (type: DatasetType) => {
    const dataset = datasets[type];
    const hasData = !!dataset;
    const errorCount = (errorMapByDataset as any)[type]?.size || 0;

    return (
      <TouchableOpacity
        key={type}
        style={[
          styles.datasetButton,
          {
            backgroundColor: selectedDataset === type ? colors.primary : colors.surface,
            borderColor: hasData ? colors.primary : colors.border,
          },
        ]}
        onPress={() => setSelectedDataset(hasData ? type : null)}
        disabled={!hasData}
      >
        {getDatasetIcon(type)}
        <View style={styles.datasetButtonText}>
          <Text style={[styles.datasetName, { color: selectedDataset === type ? '#FFF' : colors.text }]}>
            {type}
          </Text>
          {hasData && (
            <Text style={[styles.datasetInfo, { color: selectedDataset === type ? 'rgba(255,255,255,0.8)' : colors.textSecondary }]}>
              {dataset.data.length} satır
              {errorCount > 0 && ` · ${errorCount} hatalı`}
            </Text>
          )}
        </View>
        {errorCount > 0 && (
          <View style={[styles.errorBadge, { backgroundColor: colors.error }]}>
            <Text style={styles.errorBadgeText}>{errorCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderTable = () => {
    if (!selectedDataset) {
      return (
        <View style={styles.emptyState}>
          <TableIcon size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Veri Seti Seçin</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Görüntülemek için yukarıdan bir tablo seçin
          </Text>
        </View>
      );
    }

    const dataset = datasets[selectedDataset];
    if (!dataset || dataset.data.length === 0) {
      return (
        <View style={styles.emptyState}>
          <AlertCircle size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Veri Yok</Text>
        </View>
      );
    }

    const headers = dataset.headers;
    const data = dataset.data;
    const errorMap = (errorMapByDataset as any)[selectedDataset];

    return (
      <View style={styles.tableContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View>
            <View style={[styles.tableHeader, { backgroundColor: colors.surface }]}>
              <View style={[styles.tableCell, styles.indexCell, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.headerText, { color: colors.textSecondary }]}>#</Text>
              </View>
              {headers.map((header) => (
                <View key={header} style={[styles.tableCell, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={[styles.headerText, { color: colors.text }]}>{header}</Text>
                </View>
              ))}
              <View style={[styles.tableCell, styles.actionCell, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.headerText, { color: colors.textSecondary }]}>İşlem</Text>
              </View>
            </View>

            <FlatList
              data={data}
              keyExtractor={(_, index) => String(index)}
              initialNumToRender={15}
              maxToRenderPerBatch={20}
              windowSize={5}
              removeClippedSubviews={true}
              showsVerticalScrollIndicator={true}
              renderItem={({ item: row, index: rowIndex }) => {
                const hasError = errorMap?.has(rowIndex);
                const errorMessages = errorMap?.get(rowIndex) || [];

                return (
                  <View
                    style={[
                      styles.tableRow,
                      { backgroundColor: hasError ? colors.errorLight : colors.surface },
                    ]}
                  >
                    <View style={[styles.tableCell, styles.indexCell, { backgroundColor: colors.surfaceSecondary }]}>
                      <Text style={[styles.cellText, { color: colors.textSecondary }]}>{rowIndex + 1}</Text>
                    </View>
                    {headers.map((header) => (
                      <TouchableOpacity
                        key={header}
                        style={[
                          styles.tableCell,
                          hasError && { borderColor: colors.error, borderWidth: 1 },
                        ]}
                        onPress={() => handleEditCell(selectedDataset, rowIndex, header, row[header])}
                      >
                        <Text style={[styles.cellText, { color: hasError ? colors.error : colors.text }]} numberOfLines={2}>
                          {String(row[header] ?? '')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <View style={[styles.tableCell, styles.actionCell]}>
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          style={[styles.iconButton, { backgroundColor: colors.primaryLight + '20' }]}
                          onPress={() => handleEditCell(selectedDataset, rowIndex, headers[0], row[headers[0]])}
                        >
                          <Edit3 size={14} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.iconButton, { backgroundColor: colors.errorLight }]}
                          onPress={() => handleDeleteRow(selectedDataset, rowIndex)}
                        >
                          <Trash2 size={14} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {hasError && errorMessages.length > 0 && (
                      <View style={[styles.errorTooltip, { backgroundColor: colors.error }]}>
                        {errorMessages.map((msg: string, i: number) => (
                          <Text key={i} style={styles.errorTooltipText}>• {msg}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                );
              }}
            />
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TableIcon size={22} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Veri Görüntüleyici</Text>
          {isRevalidating && (
            <View style={styles.revalidating}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.revalidatingText, { color: colors.textSecondary }]}>Doğrulanıyor...</Text>
            </View>
          )}
        </View>
      </SafeAreaView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.datasetBar, { backgroundColor: colors.surface }]}
        contentContainerStyle={styles.datasetBarContent}
      >
        {datasetTypes.map(renderDatasetButton)}
      </ScrollView>

      {renderTable()}

      <Modal
        visible={!!editingCell}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingCell(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Düzenle</Text>
              <TouchableOpacity onPress={() => setEditingCell(null)}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {editingCell && (
              <>
                <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
                  {editingCell.datasetType} · Satır {editingCell.rowIndex + 1} · {editingCell.columnKey}
                </Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                  value={editValue}
                  onChangeText={setEditValue}
                  autoFocus
                  selectTextOnFocus
                  multiline
                />
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: colors.surfaceSecondary }]}
                onPress={() => setEditingCell(null)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleSaveEdit}
              >
                <Save size={16} color="#FFF" />
                <Text style={styles.saveButtonText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700' as const,
  },
  revalidating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  revalidatingText: {
    fontSize: 12,
  },
  datasetBar: {
    borderBottomWidth: 1,
  },
  datasetBarContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  datasetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 8,
    minWidth: 150,
  },
  datasetButtonText: {
    flex: 1,
  },
  datasetName: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  datasetInfo: {
    fontSize: 11,
    marginTop: 2,
  },
  errorBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  errorBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  tableContainer: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
  },
  tableRow: {
    flexDirection: 'row',
    position: 'relative',
  },
  tableCell: {
    width: 120,
    padding: 10,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
  },
  indexCell: {
    width: 50,
  },
  actionCell: {
    width: 100,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  cellText: {
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  iconButton: {
    padding: 6,
    borderRadius: 6,
  },
  errorTooltip: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    padding: 8,
    zIndex: 10,
    gap: 4,
  },
  errorTooltipText: {
    fontSize: 11,
    color: '#FFF',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center' as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  modalLabel: {
    fontSize: 13,
  },
  modalInput: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top' as const,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  cancelButton: {},
  saveButton: {},
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFF',
  },
});
