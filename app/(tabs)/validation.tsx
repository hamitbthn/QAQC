import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Search,
  CheckCircle2,
  XCircle,
  Database,
  Activity,
  Layers,
  TrendingUp,
  Play,
  Settings,
  ChevronDown,
  ChevronUp,
  Shield,
  Wrench,
  Link2,
  Filter,
  Download,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useQAQC, useFilteredQAQCIssues } from '@/contexts/QAQCContext';
import type { QAQCSeverity, QAQCTable, QAQCIssue } from '@/types/qaqc';
import { convertToCSV, exportCSV } from '@/utils/exportUtils';

type ViewMode = 'issues' | 'holes' | 'config';

export default function ValidationScreen() {
  const { colors } = useTheme();
  const { datasets } = useData();
  const { result, isRunning, config, runValidation, updateConfig, holeSummaries, lastRunTimestamp } = useQAQC();

  const [viewMode, setViewMode] = useState<ViewMode>('issues');
  const [severityFilter, setSeverityFilter] = useState<QAQCSeverity | 'all'>('all');
  const [tableFilter, setTableFilter] = useState<QAQCTable | 'all'>('all');
  const [holeFilter, setHoleFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  const filteredIssues = useFilteredQAQCIssues(severityFilter, tableFilter, holeFilter, searchQuery);

  const hasData = useMemo(() => {
    return Object.values(datasets).some(d => d !== null);
  }, [datasets]);

  const handleRun = useCallback(() => {
    runValidation();
  }, [runValidation]);

  const handleExport = async () => {
    if (!filteredIssues || filteredIssues.length === 0) return;

    const exportData = filteredIssues.map((issue: QAQCIssue) => ({
      Code: issue.code,
      Tablo: issue.table,
      HoleID: issue.holeId,
      Satir: issue.rowIndex !== undefined ? issue.rowIndex + 1 : '-',
      Seviye: issue.severity,
      Mesaj: issue.message,
      Kanit: JSON.stringify(issue.evidence).replace(/"/g, '""')
    }));

    const csv = convertToCSV(exportData);
    await exportCSV(`QAQC_Raporu_${new Date().getTime()}.csv`, csv);
  };

  const getSeverityColor = useCallback((severity: QAQCSeverity) => {
    switch (severity) {
      case 'BLOCKER': return colors.error;
      case 'ERROR': return colors.error;
      case 'WARN': return colors.warning;
      case 'INFO': return colors.info;
      default: return colors.textSecondary;
    }
  }, [colors]);

  const getSeverityBg = useCallback((severity: QAQCSeverity) => {
    switch (severity) {
      case 'BLOCKER': return colors.errorLight;
      case 'ERROR': return colors.errorLight;
      case 'WARN': return colors.warningLight;
      case 'INFO': return colors.infoLight;
      default: return colors.surfaceSecondary;
    }
  }, [colors]);

  const getSeverityIcon = useCallback((severity: QAQCSeverity) => {
    switch (severity) {
      case 'BLOCKER': return <XCircle size={16} color={colors.error} />;
      case 'ERROR': return <AlertCircle size={16} color={colors.error} />;
      case 'WARN': return <AlertTriangle size={16} color={colors.warning} />;
      case 'INFO': return <Info size={16} color={colors.info} />;
      default: return <Info size={16} color={colors.textSecondary} />;
    }
  }, [colors]);

  const getTableIcon = useCallback((table: QAQCTable) => {
    switch (table) {
      case 'collar': return <Database size={14} color={colors.collar} />;
      case 'survey': return <Activity size={14} color={colors.survey} />;
      case 'lithology': return <Layers size={14} color={colors.lithology} />;
      case 'assay': return <TrendingUp size={14} color={colors.assay} />;
      case 'cross': return <Link2 size={14} color={colors.primary} />;
    }
  }, [colors]);

  const getTableLabel = useCallback((table: QAQCTable) => {
    switch (table) {
      case 'collar': return 'Collar';
      case 'survey': return 'Survey';
      case 'lithology': return 'Litoloji';
      case 'assay': return 'Assay';
      case 'cross': return 'Çapraz';
    }
  }, []);

  const renderIssueItem = useCallback(({ item, index }: { item: QAQCIssue; index: number }) => {
    const issueId = `${item.code}_${index}`;
    const isExpanded = expandedIssue === issueId;
    return (
      <TouchableOpacity
        style={[styles.issueCard, { backgroundColor: colors.surface }]}
        onPress={() => setExpandedIssue(isExpanded ? null : issueId)}
        activeOpacity={0.7}
      >
        <View style={styles.issueRow}>
          <View style={[styles.severityDot, { backgroundColor: getSeverityColor(item.severity) }]} />
          <View style={styles.issueContent}>
            <Text style={[styles.issueMessage, { color: colors.text }]} numberOfLines={isExpanded ? undefined : 2}>
              {item.message}
            </Text>
            <View style={styles.issueTags}>
              <View style={[styles.tag, { backgroundColor: getSeverityBg(item.severity) }]}>
                {getSeverityIcon(item.severity)}
                <Text style={[styles.tagText, { color: getSeverityColor(item.severity) }]}>
                  {item.severity}
                </Text>
              </View>
              <View style={[styles.tag, { backgroundColor: colors.surfaceSecondary }]}>
                {getTableIcon(item.table)}
                <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                  {getTableLabel(item.table)}
                </Text>
              </View>
              {item.holeId !== '-' && (
                <View style={[styles.tag, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                    {item.holeId}
                  </Text>
                </View>
              )}
              {item.rowIndex !== undefined && (
                <View style={[styles.tag, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                    Satır {item.rowIndex + 1}
                  </Text>
                </View>
              )}
            </View>
            {isExpanded && (
              <View style={[styles.detailsPanel, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Kod: {item.code}</Text>
                {item.suggestion && (
                  <View style={styles.suggestionBox}>
                    <Wrench size={14} color={colors.primary} />
                    <Text style={[styles.suggestionText, { color: colors.primary }]}>{item.suggestion}</Text>
                  </View>
                )}
                {item.evidence && (
                  <View style={styles.evidenceContainer}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary, marginBottom: 4 }]}>Kanıt:</Text>
                    <Text style={[styles.detailJson, { color: colors.textTertiary }]}>
                      {JSON.stringify(item.evidence, null, 2)}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
          {isExpanded ? <ChevronUp size={16} color={colors.textTertiary} /> : <ChevronDown size={16} color={colors.textTertiary} />}
        </View>
      </TouchableOpacity>
    );
  }, [expandedIssue, colors, getSeverityColor, getSeverityBg, getSeverityIcon, getTableIcon, getTableLabel]);

  const renderHoleSummary = useCallback(() => {
    return (
      <FlatList
        data={holeSummaries}
        keyExtractor={(item) => item.holeId}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.holeCard, { backgroundColor: colors.surface }]}
            onPress={() => {
              setHoleFilter(item.holeId);
              setViewMode('issues');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.holeHeader}>
              <Text style={[styles.holeName, { color: colors.text }]}>{item.holeId}</Text>
              <View style={styles.holeCounts}>
                {item.critical > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: colors.errorLight }]}>
                    <Text style={[styles.countText, { color: colors.error }]}>{item.critical}</Text>
                  </View>
                )}
                {item.warning > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: colors.warningLight }]}>
                    <Text style={[styles.countText, { color: colors.warning }]}>{item.warning}</Text>
                  </View>
                )}
                {item.info > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: colors.infoLight }]}>
                    <Text style={[styles.countText, { color: colors.info }]}>{item.info}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={[styles.holeBar, { backgroundColor: colors.surfaceSecondary }]}>
              {item.critical > 0 && (
                <View style={[styles.holeBarSegment, { backgroundColor: colors.error, flex: item.critical }]} />
              )}
              {item.warning > 0 && (
                <View style={[styles.holeBarSegment, { backgroundColor: colors.warning, flex: item.warning }]} />
              )}
              {item.info > 0 && (
                <View style={[styles.holeBarSegment, { backgroundColor: colors.info, flex: item.info }]} />
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyList}>
            <CheckCircle2 size={40} color={colors.success} />
            <Text style={[styles.emptyListText, { color: colors.textSecondary }]}>Hole bazlı sorun bulunamadı</Text>
          </View>
        )}
      />
    );
  }, [holeSummaries, colors, setHoleFilter, setViewMode]);

  const renderConfigPanel = useCallback(() => {
    return (
      <ScrollView style={styles.configScroll} contentContainerStyle={styles.listContent}>
        <View style={[styles.configCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.configTitle, { color: colors.text }]}>QA/QC Ayarları</Text>

          {[
            { key: 'toleranceDepth' as const, label: 'Derinlik Toleransı (m)', desc: 'From/To çakışmaları için tolerans' },
            { key: 'maxSurveyGap' as const, label: 'Max Survey Gap (m)', desc: 'Survey ölçümleri arası max mesafe' },
            { key: 'minSampleLength' as const, label: 'Min Örnek Boyu (m)', desc: 'Altı bilgi/uyarı verir' },
            { key: 'maxSampleLength' as const, label: 'Max Örnek Boyu (m)', desc: 'Üstü uyarı verir' },
          ].map(({ key, label, desc }) => (
            <View key={key} style={styles.configRow}>
              <View style={styles.configLabelContainer}>
                <Text style={[styles.configLabel, { color: colors.text }]}>{label}</Text>
                <Text style={[styles.configDesc, { color: colors.textTertiary }]}>{desc}</Text>
              </View>
              <TextInput
                style={[styles.configInput, { color: colors.text, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                value={String(config[key])}
                onChangeText={(val) => {
                  const num = parseFloat(val);
                  if (!isNaN(num)) updateConfig({ [key]: num });
                }}
                keyboardType="numeric"
                selectTextOnFocus
              />
            </View>
          ))}

          <View style={styles.configRow}>
            <View style={styles.configLabelContainer}>
              <Text style={[styles.configLabel, { color: colors.text }]}>Dip Convention</Text>
              <Text style={[styles.configDesc, { color: colors.textTertiary }]}>Derinleşince Dip değeri küçülür mü?</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                { backgroundColor: config.dipConvention === 'negative_down' ? colors.primary : colors.surfaceSecondary }
              ]}
              onPress={() => updateConfig({ dipConvention: config.dipConvention === 'negative_down' ? 'positive_down' : 'negative_down' })}
            >
              <Text style={[styles.toggleText, { color: config.dipConvention === 'negative_down' ? '#FFF' : colors.textSecondary }]}>
                {config.dipConvention === 'negative_down' ? 'Negatif Down' : 'Pozitif Down'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }, [config, colors, updateConfig]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerRow}>
            <Shield size={22} color={colors.primary} />
            <View style={styles.headerTextBlock}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>QA/QC Doğrulama</Text>
              {lastRunTimestamp && (
                <Text style={[styles.headerSub, { color: colors.textTertiary }]}>
                  Son: {new Date(lastRunTimestamp).toLocaleTimeString('tr-TR')}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.exportButton, { borderColor: colors.border }]}
              onPress={handleExport}
              disabled={!result || filteredIssues.length === 0}
            >
              <Download size={20} color={!result || filteredIssues.length === 0 ? colors.textTertiary : colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.runButton, { backgroundColor: isRunning ? colors.surfaceSecondary : colors.primary }]}
              onPress={handleRun}
              disabled={isRunning || !hasData}
            >
              {isRunning ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Play size={14} color="#FFF" />
                  <Text style={styles.runButtonText}>Çalıştır</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {result && (
        <View style={[styles.summaryBar, { backgroundColor: colors.surface }]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{result.summary.totalHoles}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Kuyu</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.error }]}>{result.summary.critical}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Kritik</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.warning }]}>{result.summary.warn}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Uyarı</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.info }]}>{result.summary.info}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Bilgi</Text>
          </View>
        </View>
      )}

      <View style={[styles.modeBar, { borderBottomColor: colors.border }]}>
        {([
          { key: 'issues' as const, label: 'Sorunlar', icon: <AlertCircle size={14} color={viewMode === 'issues' ? colors.primary : colors.textTertiary} /> },
          { key: 'holes' as const, label: 'Kuyular', icon: <Database size={14} color={viewMode === 'holes' ? colors.primary : colors.textTertiary} /> },
          { key: 'config' as const, label: 'Ayarlar', icon: <Settings size={14} color={viewMode === 'config' ? colors.primary : colors.textTertiary} /> },
        ]).map(({ key, label, icon }) => (
          <TouchableOpacity
            key={key}
            style={[styles.modeTab, viewMode === key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setViewMode(key)}
          >
            {icon}
            <Text style={[styles.modeTabText, { color: viewMode === key ? colors.primary : colors.textTertiary }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {viewMode === 'issues' && (
        <>
          <View style={styles.filterBar}>
            <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Search size={16} color={colors.textTertiary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Ara..."
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              {(['all', 'BLOCKER', 'ERROR', 'WARN', 'INFO'] as (QAQCSeverity | 'all')[]).map((sev) => (
                <TouchableOpacity
                  key={sev}
                  style={[styles.filterChip, { backgroundColor: severityFilter === sev ? colors.primary : colors.surface }]}
                  onPress={() => setSeverityFilter(sev)}
                >
                  <Text style={[styles.filterChipText, { color: severityFilter === sev ? '#FFF' : colors.textSecondary }]}>
                    {sev === 'all' ? 'Tümü' : sev}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              {(['all', 'collar', 'survey', 'lithology', 'assay', 'cross'] as (QAQCTable | 'all')[]).map((tbl) => (
                <TouchableOpacity
                  key={tbl}
                  style={[styles.filterChip, { backgroundColor: tableFilter === tbl ? colors.primary : colors.surface }]}
                  onPress={() => setTableFilter(tbl)}
                >
                  <Text style={[styles.filterChipText, { color: tableFilter === tbl ? '#FFF' : colors.textSecondary }]}>
                    {tbl === 'all' ? 'Tüm Tablolar' : tbl === 'cross' ? 'Çapraz' : tbl.charAt(0).toUpperCase() + tbl.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {holeFilter !== '' && (
              <TouchableOpacity
                style={[styles.activeFilter, { backgroundColor: colors.primaryLight + '20' }]}
                onPress={() => setHoleFilter('')}
              >
                <Filter size={14} color={colors.primary} />
                <Text style={[styles.activeFilterText, { color: colors.primary }]}>Kuyu: {holeFilter}</Text>
                <XCircle size={14} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {!result ? (
            <View style={styles.emptyState}>
              <Shield size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {hasData ? 'QA/QC Hazır' : 'Veri Yok'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {hasData ? '"Çalıştır" butonuna basarak doğrulamayı başlatın' : 'Önce veri yükleyin'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredIssues}
              keyExtractor={(item, index) => `${item.code}_${index}`}
              renderItem={renderIssueItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={() => (
                <Text style={[styles.resultCount, { color: colors.textTertiary }]}>
                  {filteredIssues.length} sonuç gösteriliyor
                </Text>
              )}
              ListEmptyComponent={() => (
                <View style={styles.emptyList}>
                  <CheckCircle2 size={40} color={colors.success} />
                  <Text style={[styles.emptyListText, { color: colors.textSecondary }]}>Bu filtrede sorun bulunamadı</Text>
                </View>
              )}
            />
          )}
        </>
      )}

      {viewMode === 'holes' && renderHoleSummary()}
      {viewMode === 'config' && renderConfigPanel()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { backgroundColor: 'transparent' },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTextBlock: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 11, marginTop: 2 },
  exportButton: { padding: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  runButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, gap: 6 },
  runButtonText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  summaryBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, marginHorizontal: 12, marginTop: 10, borderRadius: 12 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 18, fontWeight: '700' },
  summaryLabel: { fontSize: 10, marginTop: 2 },
  summaryDivider: { width: 1, height: 28 },
  modeBar: { flexDirection: 'row', borderBottomWidth: 1, marginTop: 6 },
  modeTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 6 },
  modeTabText: { fontSize: 12, fontWeight: '600' },
  filterBar: { paddingHorizontal: 12, paddingTop: 10, gap: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, gap: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  filterRow: { flexDirection: 'row' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 6 },
  filterChipText: { fontSize: 12, fontWeight: '500' },
  activeFilter: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6, alignSelf: 'flex-start' },
  activeFilterText: { fontSize: 12, fontWeight: '500' },
  listContent: { padding: 12, paddingBottom: 100 },
  resultCount: { fontSize: 12, marginBottom: 8 },
  issueCard: { padding: 12, borderRadius: 10, marginBottom: 8 },
  issueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  severityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  issueContent: { flex: 1 },
  issueMessage: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  issueTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, gap: 4 },
  tagText: { fontSize: 11, fontWeight: '500' },
  detailsPanel: { marginTop: 10, padding: 10, borderRadius: 8, gap: 4 },
  detailLabel: { fontSize: 11 },
  detailJson: { fontWeight: '500', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 4, fontSize: 11 },
  suggestionBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, padding: 8, borderRadius: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: '#3B82F640' },
  suggestionText: { fontSize: 12, fontWeight: '500', flex: 1 },
  evidenceContainer: { marginTop: 8 },
  configInput: { width: 60, height: 36, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, fontSize: 13, textAlign: 'center' },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  toggleText: { fontSize: 12, fontWeight: '600' },
  holeCard: { padding: 14, borderRadius: 10, marginBottom: 8 },
  holeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  holeName: { fontSize: 14, fontWeight: '600' },
  holeCounts: { flexDirection: 'row', gap: 6 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, minWidth: 24, alignItems: 'center' },
  countText: { fontSize: 12, fontWeight: '600' },
  holeBar: { height: 4, borderRadius: 2, flexDirection: 'row', overflow: 'hidden' },
  holeBarSegment: { height: 4 },
  configScroll: { flex: 1 },
  configCard: { padding: 16, borderRadius: 12, gap: 16 },
  configTitle: { fontSize: 16, fontWeight: '600' },
  configRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  configLabelContainer: { flex: 1 },
  configLabel: { fontSize: 13, fontWeight: '500' },
  configDesc: { fontSize: 11 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },
  emptyList: { padding: 40, alignItems: 'center', gap: 12 },
  emptyListText: { fontSize: 14 },
});
