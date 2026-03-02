import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  Database,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Upload,
  TrendingUp,
  Layers,
  Activity,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import type { DatasetType } from '@/types/geology';
import { LegalNotices } from '@/components/LegalNotices';

const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const { colors, isDark } = useTheme();
  const { datasets, uploadedCount, totalErrors, totalWarnings } = useData();
  const router = useRouter();

  const datasetTypes: DatasetType[] = ['COLLAR', 'SURVEY', 'LITHOLOGY', 'ASSAY'];

  const getDatasetIcon = (type: DatasetType) => {
    switch (type) {
      case 'COLLAR':
        return <Database size={20} color={colors.collar} />;
      case 'SURVEY':
        return <Activity size={20} color={colors.survey} />;
      case 'LITHOLOGY':
        return <Layers size={20} color={colors.lithology} />;
      case 'ASSAY':
        return <TrendingUp size={20} color={colors.assay} />;
    }
  };

  const getDatasetColor = (type: DatasetType) => {
    switch (type) {
      case 'COLLAR': return colors.collar;
      case 'SURVEY': return colors.survey;
      case 'LITHOLOGY': return colors.lithology;
      case 'ASSAY': return colors.assay;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={isDark ? ['#0F766E', '#0F172A'] : ['#14B8A6', '#F8FAFC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Jeoloji QA/QC</Text>
            <Text style={styles.headerSubtitle}>Veri Doğrulama Sistemi</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.statIconContainer, { backgroundColor: colors.primaryLight + '20' }]}>
              <Upload size={24} color={colors.primary} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{uploadedCount}/4</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Veri Seti</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.statIconContainer, { backgroundColor: colors.errorLight }]}>
              <AlertCircle size={24} color={colors.error} />
            </View>
            <Text style={[styles.statValue, { color: colors.error }]}>{totalErrors}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Hata</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.statIconContainer, { backgroundColor: colors.warningLight }]}>
              <AlertTriangle size={24} color={colors.warning} />
            </View>
            <Text style={[styles.statValue, { color: colors.warning }]}>{totalWarnings}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Uyarı</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Veri Setleri</Text>

        <View style={styles.datasetsGrid}>
          {datasetTypes.map((type) => {
            const dataset = datasets[type];
            const hasData = !!dataset;
            const report = dataset?.validationReport;
            const color = getDatasetColor(type);

            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.datasetCard,
                  { backgroundColor: colors.surface, borderColor: hasData ? color : colors.border },
                ]}
                onPress={() => router.push('/upload')}
                activeOpacity={0.7}
              >
                <View style={[styles.datasetIconBg, { backgroundColor: color + '15' }]}>
                  {getDatasetIcon(type)}
                </View>
                <Text style={[styles.datasetName, { color: colors.text }]}>{type}</Text>

                {hasData ? (
                  <View style={styles.datasetStats}>
                    <Text style={[styles.datasetRows, { color: colors.textSecondary }]}>
                      {dataset.data.length} satır
                    </Text>
                    {report && (
                      <View style={styles.datasetStatusRow}>
                        {report.isValid ? (
                          <CheckCircle2 size={14} color={colors.success} />
                        ) : (
                          <AlertCircle size={14} color={colors.error} />
                        )}
                        <Text style={[
                          styles.datasetStatus,
                          { color: report.isValid ? colors.success : colors.error }
                        ]}>
                          {report.isValid ? 'Geçerli' : `${report.errors.length} hata`}
                        </Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <Text style={[styles.datasetEmpty, { color: colors.textTertiary }]}>
                    Yüklenmedi
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {uploadedCount === 0 && (
          <TouchableOpacity
            style={[styles.uploadPrompt, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/upload')}
            activeOpacity={0.8}
          >
            <Upload size={24} color="#FFF" />
            <Text style={styles.uploadPromptText}>Veri Yüklemeye Başla</Text>
          </TouchableOpacity>
        )}

        {uploadedCount > 0 && (
          <View style={[styles.quickActions, { backgroundColor: colors.surface }]}>
            <Text style={[styles.quickActionsTitle, { color: colors.text }]}>Hızlı İşlemler</Text>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary + '15' }]}
                onPress={() => router.push('/validation')}
              >
                <CheckCircle2 size={20} color={colors.primary} />
                <Text style={[styles.actionButtonText, { color: colors.primary }]}>Doğrula</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.secondary + '15' }]}
                onPress={() => router.push('/validation')}
              >
                <Activity size={20} color={colors.secondary} />
                <Text style={[styles.actionButtonText, { color: colors.secondary }]}>AI Analiz</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.accent + '15' }]}
                onPress={() => router.push('/viewer3d')}
              >
                <Layers size={20} color={colors.accent} />
                <Text style={[styles.actionButtonText, { color: colors.accent }]}>3D Görüntüle</Text>
              </TouchableOpacity>
            </View>
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
  headerGradient: {
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFF',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  content: {
    flex: 1,
    marginTop: -20,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginBottom: 16,
  },
  datasetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  datasetCard: {
    width: (width - 44) / 2,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  datasetIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  datasetName: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  datasetStats: {
    gap: 4,
  },
  datasetRows: {
    fontSize: 13,
  },
  datasetStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  datasetStatus: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  datasetEmpty: {
    fontSize: 13,
  },
  uploadPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  uploadPromptText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFF',
  },
  quickActions: {
    padding: 20,
    borderRadius: 16,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  legalSection: {
    marginTop: 24,
    marginBottom: 40,
  },
});
