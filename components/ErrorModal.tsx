import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Pressable,
    Platform,
} from 'react-native';
import {
    AlertCircle,
    AlertTriangle,
    Info,
    XCircle,
    X,
    ChevronDown,
    ChevronUp,
    RotateCcw,
    FileWarning,
    ExternalLink,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useError, ErrorSeverity } from '@/contexts/ErrorContext';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function ErrorModal() {
    const { colors } = useTheme();
    const { error, hideError } = useError();
    const [showDetails, setShowDetails] = useState(false);
    const router = useRouter();

    if (!error || !error.visible) return null;

    const getSeverityStyles = (severity: ErrorSeverity) => {
        switch (severity) {
            case 'BLOCKER':
                return { color: colors.error, icon: <XCircle size={32} color={colors.error} />, label: 'Blocker' };
            case 'ERROR':
                return { color: '#F97316', icon: <AlertCircle size={32} color="#F97316" />, label: 'Hata' };
            case 'WARN':
                return { color: colors.warning, icon: <AlertTriangle size={32} color={colors.warning} />, label: 'Uyarı' };
            case 'INFO':
                return { color: colors.info, icon: <Info size={32} color={colors.info} />, label: 'Bilgi' };
            default:
                return { color: colors.textSecondary, icon: <Info size={32} color={colors.textSecondary} />, label: 'Bilgi' };
        }
    };

    const styles_sev = getSeverityStyles(error.severity);

    const handleSeeAllValidation = () => {
        hideError();
        router.push('/validation');
    };

    return (
        <Modal
            transparent
            visible={error.visible}
            animationType="fade"
            onRequestClose={hideError}
        >
            <Pressable style={styles.backdrop} onPress={hideError}>
                <View style={styles.centeredView}>
                    <Pressable style={[styles.modalView, { backgroundColor: colors.surface, borderTopColor: styles_sev.color }]}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={[styles.iconContainer, { backgroundColor: styles_sev.color + '15' }]}>
                                {styles_sev.icon}
                            </View>
                            <TouchableOpacity style={styles.closeButton} onPress={hideError}>
                                <X size={20} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </View>

                        {/* Content */}
                        <View style={styles.content}>
                            <Text style={[styles.title, { color: colors.text }]}>{error.title}</Text>
                            <Text style={[styles.message, { color: colors.textSecondary }]}>{error.message}</Text>

                            {/* Validation Specific UI */}
                            {error.validationData && (
                                <View style={[styles.validationContainer, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Text style={[styles.validationTitle, { color: colors.text }]}>
                                        Toplam {error.validationData.totalCount} Doğuulama Sorunu
                                    </Text>
                                    {error.validationData.issues.slice(0, 5).map((issue, idx) => (
                                        <View key={idx} style={styles.issueRow}>
                                            <View style={[styles.severityBadge, { backgroundColor: issue.severity === 'BLOCKER' || issue.severity === 'ERROR' ? colors.error + '20' : colors.warning + '20' }]}>
                                                <Text style={[styles.severityText, { color: issue.severity === 'BLOCKER' || issue.severity === 'ERROR' ? colors.error : colors.warning }]}>
                                                    {issue.severity.charAt(0)}
                                                </Text>
                                            </View>
                                            <Text style={[styles.issueHole, { color: colors.textTertiary }]}>{issue.holeId || '-'}</Text>
                                            <Text style={[styles.issueMsg, { color: colors.textSecondary }]} numberOfLines={1}>
                                                {issue.message}
                                            </Text>
                                        </View>
                                    ))}
                                    {error.validationData.totalCount > 5 && (
                                        <TouchableOpacity style={styles.seeAllButton} onPress={handleSeeAllValidation}>
                                            <Text style={[styles.seeAllText, { color: colors.primary }]}>Tümünü Gör</Text>
                                            <ExternalLink size={14} color={colors.primary} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}

                            {/* Parsing Specific UI */}
                            {error.parsingData && (
                                <View style={[styles.parsingContainer, { backgroundColor: colors.surfaceSecondary }]}>
                                    <View style={styles.parsingRow}>
                                        <FileWarning size={16} color={colors.textSecondary} />
                                        <Text style={[styles.parsingLabel, { color: colors.textSecondary }]}>Desteklenen Formatlar:</Text>
                                        <Text style={[styles.parsingValue, { color: colors.text }]}>
                                            {error.parsingData.supportedFormats.join(', ')}
                                        </Text>
                                    </View>
                                    <View style={styles.parsingRow}>
                                        <Info size={16} color={colors.textSecondary} />
                                        <Text style={[styles.parsingLabel, { color: colors.textSecondary }]}>Limit:</Text>
                                        <Text style={[styles.parsingValue, { color: colors.text }]}>Max {error.parsingData.maxSizeMB}MB</Text>
                                    </View>
                                    {error.onRetry && (
                                        <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={error.onRetry}>
                                            <RotateCcw size={16} color="#FFF" />
                                            <Text style={styles.retryText}>Tekrar Yükle</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}

                            {/* Technical Details Toggle */}
                            {error.details && (
                                <View style={styles.detailsWrapper}>
                                    <TouchableOpacity
                                        style={styles.detailsToggle}
                                        onPress={() => setShowDetails(!showDetails)}
                                    >
                                        <Text style={[styles.detailsToggleText, { color: colors.textTertiary }]}>
                                            {showDetails ? 'Detayları Gizle' : 'Detayları Göster'}
                                        </Text>
                                        {showDetails ? <ChevronUp size={16} color={colors.textTertiary} /> : <ChevronDown size={16} color={colors.textTertiary} />}
                                    </TouchableOpacity>

                                    {showDetails && (
                                        <ScrollView style={[styles.detailsScroll, { backgroundColor: colors.surfaceSecondary }]}>
                                            <Text style={[styles.detailsText, { color: colors.textTertiary }]}>
                                                {error.details}
                                            </Text>
                                        </ScrollView>
                                    )}
                                </View>
                            )}
                        </View>

                        {/* Footer */}
                        <View style={styles.footer}>
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: colors.surfaceSecondary }]}
                                onPress={hideError}
                            >
                                <Text style={[styles.actionButtonText, { color: colors.text }]}>
                                    {error.primaryAction ? 'İptal' : 'Kapat'}
                                </Text>
                            </TouchableOpacity>

                            {error.primaryAction && (
                                <TouchableOpacity
                                    style={[
                                        styles.actionButton,
                                        {
                                            backgroundColor: error.primaryAction.style === 'destructive' ? colors.error : colors.primary,
                                            marginLeft: 12
                                        }
                                    ]}
                                    onPress={async () => {
                                        await error.primaryAction?.onPress();
                                        hideError();
                                    }}
                                >
                                    <Text style={[styles.actionButtonText, { color: '#FFF' }]}>
                                        {error.primaryAction.label}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </Pressable>
                </View>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    centeredView: {
        width: '90%',
        maxWidth: 400,
    },
    modalView: {
        borderRadius: 20,
        padding: 20,
        alignItems: 'stretch',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
        borderTopWidth: 6,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    iconContainer: {
        padding: 12,
        borderRadius: 16,
    },
    closeButton: {
        padding: 4,
    },
    content: {
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
    },
    message: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 16,
    },
    validationContainer: {
        padding: 12,
        borderRadius: 12,
        marginBottom: 16,
    },
    validationTitle: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 10,
    },
    issueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        gap: 8,
    },
    severityBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    severityText: {
        fontSize: 10,
        fontWeight: '800',
    },
    issueHole: {
        fontSize: 12,
        width: 60,
    },
    issueMsg: {
        fontSize: 12,
        flex: 1,
    },
    seeAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
        gap: 4,
    },
    seeAllText: {
        fontSize: 13,
        fontWeight: '600',
    },
    parsingContainer: {
        padding: 12,
        borderRadius: 12,
        marginBottom: 16,
        gap: 8,
    },
    parsingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    parsingLabel: {
        fontSize: 12,
        flex: 1,
    },
    parsingValue: {
        fontSize: 12,
        fontWeight: '600',
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        borderRadius: 10,
        marginTop: 8,
        gap: 8,
    },
    retryText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    detailsWrapper: {
        marginTop: 10,
    },
    detailsToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    detailsToggleText: {
        fontSize: 12,
        fontWeight: '500',
    },
    detailsScroll: {
        maxHeight: 150,
        padding: 10,
        borderRadius: 8,
        marginTop: 8,
    },
    detailsText: {
        fontSize: 11,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    actionButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
