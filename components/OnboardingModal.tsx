import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
} from 'react-native';
import {
    Shield,
    Upload,
    BarChart3,
    Layers,
    ChevronRight,
    Database,
    Activity,
    TrendingUp,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';

const { width } = Dimensions.get('window');

const ONBOARDING_KEY = '@geology_app_onboarding_shown';

export function OnboardingModal() {
    const { colors } = useTheme();
    const [visible, setVisible] = useState(false);
    const [step, setStep] = useState(0);

    useEffect(() => {
        checkOnboarding();
    }, []);

    const checkOnboarding = async () => {
        const shown = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!shown) {
            setVisible(true);
        }
    };

    const completeOnboarding = async () => {
        await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
        setVisible(false);
    };

    const steps = [
        {
            title: 'Hoş Geldiniz',
            description: 'Jeoloji QA/QC Veri Doğrulama sistemine hoş geldiniz. Sondaj verilerinizi saniyeler içinde doğrulayın.',
            icon: <Shield size={64} color={colors.primary} />,
        },
        {
            title: 'Veri Yükleme',
            description: 'Excel veya CSV dosyalarınızı Collar, Survey, Lithology ve Assay olarak kategorize ederek yükleyin.',
            icon: <Upload size={64} color={colors.primary} />,
            details: [
                { icon: <Database size={16} color={colors.collar} />, label: 'Collar: Konum ve kuyu başı verileri' },
                { icon: <Activity size={16} color={colors.survey} />, label: 'Survey: Sapma ve yön verileri' },
                { icon: <Layers size={16} color={colors.lithology} />, label: 'Lithology: Formasyon verileri' },
                { icon: <TrendingUp size={16} color={colors.assay} />, label: 'Assay: Analiz ve Tenör verileri' },
            ]
        },
        {
            title: 'Hızlı Doğrulama',
            description: 'Sistem 100+ kuralı otomatik kontrol eder ve AI destekli çözüm önerileri sunar.',
            icon: <BarChart3 size={64} color={colors.primary} />,
        },
    ];

    const currentStep = steps[step];

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={[styles.modal, { backgroundColor: colors.background }]}>
                    <View style={styles.stepContent}>
                        <View style={styles.iconContainer}>{currentStep.icon}</View>
                        <Text style={[styles.title, { color: colors.text }]}>{currentStep.title}</Text>
                        <Text style={[styles.description, { color: colors.textSecondary }]}>
                            {currentStep.description}
                        </Text>

                        {currentStep.details && (
                            <View style={styles.detailsList}>
                                {currentStep.details.map((item, i) => (
                                    <View key={i} style={styles.detailItem}>
                                        {item.icon}
                                        <Text style={[styles.detailLabel, { color: colors.text }]}>{item.label}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    <View style={styles.footer}>
                        <View style={styles.indicatorRow}>
                            {steps.map((_, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.indicator,
                                        { backgroundColor: i === step ? colors.primary : colors.border },
                                        i === step && { width: 24 }
                                    ]}
                                />
                            ))}
                        </View>

                        <TouchableOpacity
                            style={[styles.nextButton, { backgroundColor: colors.primary }]}
                            onPress={() => {
                                if (step < steps.length - 1) setStep(step + 1);
                                else completeOnboarding();
                            }}
                        >
                            <Text style={styles.nextButtonText}>
                                {step === steps.length - 1 ? 'Başla' : 'İleri'}
                            </Text>
                            <ChevronRight size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modal: {
        width: width * 0.85,
        borderRadius: 24,
        padding: 24,
        maxHeight: '80%',
    },
    stepContent: {
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 12,
    },
    description: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    detailsList: {
        width: '100%',
        gap: 12,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(0,0,0,0.05)',
        padding: 12,
        borderRadius: 12,
    },
    detailLabel: {
        fontSize: 13,
        fontWeight: '500',
    },
    footer: {
        marginTop: 32,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    indicatorRow: {
        flexDirection: 'row',
        gap: 8,
    },
    indicator: {
        height: 8,
        width: 8,
        borderRadius: 4,
    },
    nextButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 14,
        gap: 8,
    },
    nextButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
