import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from 'react-native';
import {
  BarChart3,
  ScatterChart,
  Globe,
  Layers,
  ChevronDown,
  Filter,
  Download,
  Eye,
  Settings2,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import type { AssayRow, CollarRow } from '@/types/geology';

// Component Imports
import { EnhancedHistogram, DownholeGradePlot } from '@/components/charts/DrillholeAnalysis';
import { ScatterPlot, CorrelationHeatmap } from '@/components/charts/CorrelationAnalysis';
import { BoxPlot } from '@/components/charts/BoxPlot';

// Utils
import {
  getProcessedColumnData,
  calculateScientificCorrelation,
  getGroupedData,
  type BDLHandling
} from '@/utils/chartDataProcessing';
import { discoverGradeColumns } from '@/utils/assayDiscovery';
import { convertToCSV, exportCSV } from '@/utils/exportUtils';

const { width: screenWidth } = Dimensions.get('window');

type Category = 'Drillhole' | 'Correlation' | 'Histogram' | 'Boxplot' | 'Matrix';

export default function ChartsScreen() {
  const { colors } = useTheme();
  const { datasets } = useData();

  const [category, setCategory] = useState<Category>('Drillhole');
  const [bdlHandling, setBdlHandling] = useState<BDLHandling>('HALF_DL');
  const [isLog, setIsLog] = useState(false);
  const [isWeighted, setIsWeighted] = useState(false);
  const [excludeOutliers, setExcludeOutliers] = useState(false);
  const [corrMethod, setCorrMethod] = useState<'pearson' | 'spearman'>('spearman');

  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [selectedHoleId, setSelectedHoleId] = useState<string | null>(null);
  const [showHolePicker, setShowHolePicker] = useState(false);

  const assayData = (datasets.ASSAY?.data || []) as AssayRow[];
  const collarData = (datasets.COLLAR?.data || []) as CollarRow[];

  const holeIds = useMemo(() => Array.from(new Set(assayData.map(d => String(d.HOLEID)))), [assayData]);

  // 1. Automatic Column Discovery
  const discoveredColumns = useMemo(() => discoverGradeColumns(assayData), [assayData]);
  const availableGradeColumns = useMemo(() => discoveredColumns.map(c => c.name), [discoveredColumns]);

  // Initialize selected elements
  React.useEffect(() => {
    if (selectedElements.length === 0 && availableGradeColumns.length > 0) {
      setSelectedElements(availableGradeColumns.slice(0, 3));
    }
  }, [availableGradeColumns]);

  // Derived Data
  const currentElement = selectedElements[0] || availableGradeColumns[0];
  const secondElement = selectedElements[1] || availableGradeColumns[1];

  const processedData = useMemo(() =>
    currentElement ? getProcessedColumnData(assayData, currentElement, { bdlHandling, excludeOutliers }) : [],
    [assayData, currentElement, bdlHandling, excludeOutliers]
  );

  const correlationMatrix = useMemo(() =>
    calculateScientificCorrelation(assayData, selectedElements, corrMethod, bdlHandling),
    [assayData, selectedElements, corrMethod, bdlHandling]
  );

  const groupedData = useMemo(() =>
    getGroupedData(assayData, currentElement, 'HOLEID', { bdlHandling, excludeOutliers }),
    [assayData, currentElement, bdlHandling, excludeOutliers]
  );

  const handleExport = async () => {
    try {
      if (!assayData || assayData.length === 0) {
        Alert.alert("Uyarı", "Dışa aktarılacak veri bulunamadı.");
        return;
      }

      let dataToExport = assayData;
      let fileName = `JeoValid_${category}_Data.csv`;

      // If Drillhole is selected, export only the selected hole's data
      if (category === 'Drillhole') {
        const currentHole = selectedHoleId || holeIds[0];
        dataToExport = assayData.filter((d: any) => String(d.HOLEID) === currentHole);
        fileName = `JeoValid_Downhole_${currentHole}.csv`;
      } else {
        // For other charts, export the selected elements
        dataToExport = assayData.map((row: any) => {
          const newRow: any = { HOLEID: row.HOLEID, FROM: row.FROM, TO: row.TO };
          selectedElements.forEach(el => newRow[el] = row[el]);
          return newRow as AssayRow;
        });
      }

      const csv = convertToCSV(dataToExport);
      await exportCSV(fileName, csv);
    } catch (error) {
      Alert.alert("Hata", "Dışa aktarma işlemi başarısız oldu.");
    }
  };

  const renderControls = () => (
    <View style={[styles.controls, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.controlRow}>
        <View style={styles.controlItem}>
          <Text style={[styles.controlLabel, { color: colors.textSecondary }]}>BDL HANDLING</Text>
          <View style={styles.cutoffContainer}>
            {(['ZERO', 'HALF_DL', 'NULL'] as BDLHandling[]).map(v => (
              <TouchableOpacity
                key={v}
                onPress={() => setBdlHandling(v)}
                style={[styles.cutoffBtn, bdlHandling === v && { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.cutoffText, { color: bdlHandling === v ? '#FFF' : colors.textSecondary }]}>
                  {v.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.toggleRow}>
          <TouchableOpacity onPress={() => setIsLog(!isLog)} style={[styles.toggle, isLog && { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.toggleText, { color: isLog ? colors.primary : colors.textSecondary }]}>LOG</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsWeighted(!isWeighted)} style={[styles.toggle, isWeighted && { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.toggleText, { color: isWeighted ? colors.primary : colors.textSecondary }]}>WEIGHTED</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.elementRow}>
        <Text style={[styles.controlLabel, { color: colors.textSecondary }]}>ELEMENTS:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {availableGradeColumns.map(el => (
            <TouchableOpacity
              key={el}
              onPress={() => {
                if (selectedElements.includes(el)) {
                  setSelectedElements(selectedElements.filter(e => e !== el));
                } else {
                  setSelectedElements([...selectedElements, el]);
                }
              }}
              style={[styles.elBadge, selectedElements.includes(el) && { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.elText, { color: selectedElements.includes(el) ? '#FFF' : colors.textSecondary }]}>{el}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  const renderCategoryContent = () => {
    if (availableGradeColumns.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={{ color: colors.textSecondary }}>Assay verisi veya grade kolonu bulunamadı.</Text>
        </View>
      );
    }

    switch (category) {
      case 'Drillhole':
        return (
          <>
            <View style={[styles.sectionHeader, { zIndex: 10 }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Downhole Grade vs Depth</Text>
              <View style={{ position: 'relative' }}>
                <TouchableOpacity onPress={() => setShowHolePicker(!showHolePicker)} style={styles.holeSelector}>
                  <Text style={{ color: colors.primary }}>{selectedHoleId || holeIds[0] || 'Hole Seçin'}</Text>
                  <ChevronDown size={14} color={colors.primary} />
                </TouchableOpacity>

                {showHolePicker && (
                  <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <ScrollView style={{ maxHeight: 350 }} nestedScrollEnabled={true} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true}>
                      {holeIds.map(hId => (
                        <TouchableOpacity
                          key={hId}
                          style={[styles.dropdownItem, selectedHoleId === hId && { backgroundColor: colors.primary + '15' }]}
                          onPress={() => {
                            setSelectedHoleId(hId);
                            setShowHolePicker(false);
                          }}
                        >
                          <Text style={{
                            color: selectedHoleId === hId ? colors.primary : colors.text,
                            fontSize: 13,
                            fontWeight: selectedHoleId === hId ? '700' : '500'
                          }}>
                            {hId}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.chartWrapper}>
              <DownholeGradePlot
                assayData={assayData}
                holeId={selectedHoleId || holeIds[0]}
                elements={selectedElements}
                isLog={isLog}
                isWeighted={isWeighted}
                bdlHandling={bdlHandling}
              />
            </View>
          </>
        );
      case 'Histogram':
        return (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Histogram ({currentElement})</Text>
            </View>
            <View style={styles.chartWrapper}>
              <EnhancedHistogram data={processedData} element={currentElement} isLog={isLog} />
            </View>
          </>
        );
      case 'Correlation':
        return (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Scatter Plot</Text>
            </View>
            <View style={styles.chartWrapper}>
              <ScatterPlot
                dataX={getProcessedColumnData(assayData, currentElement, { bdlHandling })}
                dataY={getProcessedColumnData(assayData, secondElement, { bdlHandling })}
                labelX={currentElement}
                labelY={secondElement}
                isLog={isLog}
              />
            </View>
          </>
        );
      case 'Matrix':
        return (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Correlation Matrix</Text>
              <TouchableOpacity onPress={() => setCorrMethod(corrMethod === 'pearson' ? 'spearman' : 'pearson')}>
                <Text style={{ color: colors.primary }}>{corrMethod.toUpperCase()}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.chartWrapper}>
              <CorrelationHeatmap matrix={correlationMatrix} elements={selectedElements} />
            </View>
          </>
        );
      case 'Boxplot':
        return (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Boxplot Comparative</Text>
            </View>
            <View style={styles.chartWrapper}>
              <BoxPlot groupedData={groupedData} isLog={isLog} />
            </View>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Exploration Charts</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Professional Analysis Suite</Text>
          </View>
          <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
            <Download size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {[
          { id: 'Drillhole', icon: BarChart3, label: 'Downhole' },
          { id: 'Histogram', icon: BarChart3, label: 'Histogram' },
          { id: 'Correlation', icon: ScatterChart, label: 'Scatter' },
          { id: 'Matrix', icon: Globe, label: 'Matrix' },
          { id: 'Boxplot', icon: Layers, label: 'Boxplot' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setCategory(tab.id as Category)}
            style={[styles.tab, category === tab.id && { borderBottomColor: colors.primary }]}
          >
            <tab.icon size={18} color={category === tab.id ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabText, { color: category === tab.id ? colors.primary : colors.textSecondary }]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {renderControls()}

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} nestedScrollEnabled={true} keyboardShouldPersistTaps="handled">
        {renderCategoryContent()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { backgroundColor: 'transparent' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  exportBtn: { padding: 8, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.05)' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 10 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', gap: 4 },
  tabText: { fontSize: 11, fontWeight: '600' },
  controls: { padding: 15, borderBottomWidth: 1 },
  controlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  controlItem: { flex: 1 },
  controlLabel: { fontSize: 9, fontWeight: '800', marginBottom: 6, letterSpacing: 1 },
  cutoffContainer: { flexDirection: 'row', gap: 4 },
  cutoffBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.05)' },
  cutoffText: { fontSize: 11, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggle: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  toggleText: { fontSize: 10, fontWeight: '700' },
  elementRow: { marginTop: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  elBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.05)', marginRight: 6 },
  elText: { fontSize: 10, fontWeight: '800' },
  content: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  holeSelector: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.03)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  chartWrapper: { marginBottom: 30, padding: 15, backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 16 },
  chartSub: { fontSize: 12, fontWeight: '600', marginBottom: 10 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 400 },
  dropdown: { position: 'absolute', top: '100%', right: 0, width: 140, borderWidth: 1, borderRadius: 8, marginTop: 4, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, zIndex: 50 },
  dropdownItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.1)' },
});
