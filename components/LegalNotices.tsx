import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { Shield, FileText, Info, X, ExternalLink } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface LegalNoticesProps {
  compact?: boolean;
}

export function LegalNotices({ compact = false }: LegalNoticesProps) {
  const { colors } = useTheme();
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const privacyContent = `
GİZLİLİK POLİTİKASI

Son Güncelleme: Şubat 2026

1. VERİ TOPLAMA
Bu uygulama, yüklediğiniz jeoloji verilerini yalnızca cihazınızda işler. Kişisel bilgileriniz sunucularımızda saklanmaz.

2. VERİ İŞLEME
• Yüklenen Excel dosyaları cihaz üzerinde ayrıştırılır
• Doğrulama işlemleri yerel olarak gerçekleştirilir
• AI analizi için yalnızca özet veriler (hata sayısı, uyarılar) sunucuya gönderilir
• Ham veri satırları sunucuya gönderilmez

3. ÜÇÜNCÜ TARAF HİZMETLER
• Google Gemini AI: Yalnızca doğrulama özeti ve örnek hatalar gönderilir
• Kişisel tanımlayıcı bilgiler gönderilmez

4. VERİ SAKLAMA
• Tüm veriler cihazınızın yerel depolama alanında tutulur
• "Veri Temizle" özelliği ile tüm verileri silebilirsiniz
• Uygulama kaldırıldığında tüm yerel veriler silinir

5. HAKLARINIZ
• Verilerinize erişim hakkı
• Verilerin silinmesini talep hakkı
• Veri işlemeye itiraz hakkı

İletişim: support@example.com
`;

  const disclaimerContent = `
YASAL UYARI VE SORUMLULUK REDDİ

1. AI ANALİZ UYARISI
Bu uygulamadaki AI destekli analiz sonuçları yalnızca ÖNERİ amaçlıdır. AI tarafından sağlanan:
• Kök neden teşhisleri
• Düzeltme önerileri
• Sütun eşleme tavsiyeleri

Kesin sonuçlar olarak değerlendirilmemelidir. Tüm öneriler uzman bir jeolog veya maden mühendisi tarafından doğrulanmalıdır.

2. DOĞRULAMA SONUÇLARI
Deterministik doğrulama kuralları endüstri standartlarına dayanmaktadır, ancak:
• Her veri seti için uygun olmayabilir
• Proje özel gereksinimlerini karşılamayabilir
• Uzman incelemesi gerektirebilir

3. VERİ DOĞRULUĞU
Uygulama, yüklenen verilerin doğruluğunu garanti etmez. Kullanıcı:
• Girdi verilerinin kalitesinden sorumludur
• Çıktı sonuçlarını doğrulamalıdır
• Kritik kararlar için bağımsız doğrulama yapmalıdır

4. YEREL İŞLEME
Veri cihaz üzerinde işlenir. Bu:
• İnternet bağlantısı gerektirmez (AI analizi hariç)
• Veri gizliliğini artırır
• Cihaz performansına bağlıdır

5. SORUMLULUK SINIRI
Bu uygulama "olduğu gibi" sunulmaktadır. Geliştiriciler:
• Veri kaybından sorumlu değildir
• Yanlış sonuçlardan sorumlu değildir
• Ticari kayıplardan sorumlu değildir

Uygulamayı kullanarak bu koşulları kabul etmiş sayılırsınız.
`;

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: colors.surface }]}>
        <View style={styles.compactRow}>
          <Info size={14} color={colors.textTertiary} />
          <Text style={[styles.compactText, { color: colors.textTertiary }]}>
            AI analiz öneri amaçlıdır. Veri cihaz üzerinde işlenir.
          </Text>
        </View>
        <View style={styles.compactLinks}>
          <TouchableOpacity onPress={() => setShowPrivacy(true)}>
            <Text style={[styles.compactLink, { color: colors.primary }]}>Gizlilik</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.textTertiary }}> • </Text>
          <TouchableOpacity onPress={() => setShowDisclaimer(true)}>
            <Text style={[styles.compactLink, { color: colors.primary }]}>Yasal Uyarı</Text>
          </TouchableOpacity>
        </View>

        <LegalModal
          visible={showPrivacy}
          onClose={() => setShowPrivacy(false)}
          title="Gizlilik Politikası"
          content={privacyContent}
          icon={<Shield size={24} color={colors.primary} />}
        />
        <LegalModal
          visible={showDisclaimer}
          onClose={() => setShowDisclaimer(false)}
          title="Yasal Uyarı"
          content={disclaimerContent}
          icon={<FileText size={24} color={colors.warning} />}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.noticeCard, { backgroundColor: colors.surface }]}
        onPress={() => setShowPrivacy(true)}
      >
        <Shield size={20} color={colors.primary} />
        <View style={styles.noticeContent}>
          <Text style={[styles.noticeTitle, { color: colors.text }]}>Gizlilik Politikası</Text>
          <Text style={[styles.noticeSubtitle, { color: colors.textSecondary }]}>
            Verileriniz nasıl işlenir
          </Text>
        </View>
        <ExternalLink size={16} color={colors.textTertiary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.noticeCard, { backgroundColor: colors.surface }]}
        onPress={() => setShowDisclaimer(true)}
      >
        <FileText size={20} color={colors.warning} />
        <View style={styles.noticeContent}>
          <Text style={[styles.noticeTitle, { color: colors.text }]}>Yasal Uyarı</Text>
          <Text style={[styles.noticeSubtitle, { color: colors.textSecondary }]}>
            AI analiz ve sorumluluk
          </Text>
        </View>
        <ExternalLink size={16} color={colors.textTertiary} />
      </TouchableOpacity>

      <View style={[styles.disclaimerBanner, { backgroundColor: colors.warning + '15' }]}>
        <Info size={16} color={colors.warning} />
        <Text style={[styles.disclaimerText, { color: colors.warning }]}>
          AI analiz sonuçları yalnızca öneri amaçlıdır. Tüm sonuçlar uzman tarafından doğrulanmalıdır.
        </Text>
      </View>

      <View style={[styles.localProcessingBanner, { backgroundColor: colors.success + '15' }]}>
        <Shield size={16} color={colors.success} />
        <Text style={[styles.localProcessingText, { color: colors.success }]}>
          Veri cihaz üzerinde işlenir. Ham verileriniz sunucuya gönderilmez.
        </Text>
      </View>

      <LegalModal
        visible={showPrivacy}
        onClose={() => setShowPrivacy(false)}
        title="Gizlilik Politikası"
        content={privacyContent}
        icon={<Shield size={24} color={colors.primary} />}
      />
      <LegalModal
        visible={showDisclaimer}
        onClose={() => setShowDisclaimer(false)}
        title="Yasal Uyarı"
        content={disclaimerContent}
        icon={<FileText size={24} color={colors.warning} />}
      />
    </View>
  );
}

interface LegalModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  content: string;
  icon: React.ReactNode;
}

function LegalModal({ visible, onClose, title, content, icon }: LegalModalProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.modalTitleRow}>
            {icon}
            <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.modalText, { color: colors.textSecondary }]}>
            {content}
          </Text>
        </ScrollView>

        <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.acceptButton, { backgroundColor: colors.primary }]}
            onPress={onClose}
          >
            <Text style={styles.acceptButtonText}>Anladım</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  compactContainer: {
    padding: 12,
    borderRadius: 10,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactText: {
    fontSize: 11,
    flex: 1,
  },
  compactLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    justifyContent: 'center',
  },
  compactLink: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  noticeContent: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  noticeSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  disclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 10,
    gap: 10,
  },
  disclaimerText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  localProcessingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 10,
    gap: 10,
  },
  localProcessingText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 22,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
  },
  acceptButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
