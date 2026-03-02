import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";
import type { AIAnalysis, ValidationIssue } from "@/types/geology";

const analyzeInputSchema = z.object({
  datasetType: z.enum(['COLLAR', 'LITHOLOGY', 'SURVEY', 'ASSAY']),
  errors: z.array(z.object({
    type: z.enum(['error', 'warning', 'info']),
    row: z.number().optional(),
    field: z.string().optional(),
    message: z.string(),
    value: z.union([z.string(), z.number()]).optional(),
  })),
  warnings: z.array(z.object({
    type: z.enum(['error', 'warning', 'info']),
    row: z.number().optional(),
    field: z.string().optional(),
    message: z.string(),
    value: z.union([z.string(), z.number()]).optional(),
  })),
  sampleRows: z.array(z.record(z.string(), z.unknown())).optional(),
  totalRows: z.number(),
});

async function callGeminiAPI(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY ortam değişkeni ayarlanmamış");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', errorText);
    throw new Error(`Gemini API hatası: ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const data = await response.json();

    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }

    throw new Error("Gemini API'den geçersiz yanıt");
  } else {
    throw new Error("Sunucu geçersiz format döndürdü. JSON bekleniyordu ancak HTML/Text alındı.");
  }
}

function buildAnalysisPrompt(
  datasetType: string,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  sampleRows: Record<string, unknown>[] | undefined,
  totalRows: number
): string {
  const errorSummary = errors.slice(0, 20).map(e =>
    `- Satır ${e.row || 'N/A'}, Alan: ${e.field || 'N/A'}: ${e.message}${e.value ? ` (Değer: ${e.value})` : ''}`
  ).join('\n');

  const warningSummary = warnings.slice(0, 20).map(w =>
    `- Satır ${w.row || 'N/A'}, Alan: ${w.field || 'N/A'}: ${w.message}${w.value ? ` (Değer: ${w.value})` : ''}`
  ).join('\n');

  const sampleDataStr = sampleRows && sampleRows.length > 0
    ? `\n\nÖrnek Sorunlu Satırlar (ilk 10):\n${JSON.stringify(sampleRows.slice(0, 10), null, 2)}`
    : '';

  return `Sen bir madencilik jeolojisi veri kalite kontrol uzmanısın. Aşağıdaki ${datasetType} veri seti doğrulama sonuçlarını analiz et ve Türkçe olarak detaylı bir değerlendirme yap.

DOĞRULAMA SONUÇLARI:
Toplam Satır: ${totalRows}
Toplam Hata: ${errors.length}
Toplam Uyarı: ${warnings.length}

HATALAR:
${errorSummary || 'Hata bulunamadı'}

UYARILAR:
${warningSummary || 'Uyarı bulunamadı'}
${sampleDataStr}

Lütfen aşağıdaki formatta yanıt ver (her bölümü ### ile ayır):

### KÖK NEDEN ANALİZİ
Tespit edilen sorunların olası kök nedenlerini listele.

### ÖNERİLEN DÜZELTME SIRASI
Düzeltmelerin hangi sırada yapılması gerektiğini öncelik sırasına göre listele.

### SÜTUN EŞLEŞTİRME ÖNERİLERİ
Sütun eşleştirmesi ile ilgili iyileştirme önerileri.

### ALAN BAZLI NOTLAR
Her problemli alan için spesifik notlar ve öneriler.

### ÖZET
Genel değerlendirme ve sonraki adımlar.

ÖNEMLİ: Veri oluşturma veya tahmin etme. Sadece mevcut doğrulama sonuçlarına dayalı öneriler sun.`;
}

function parseGeminiResponse(response: string): AIAnalysis {
  const sections = response.split('###').filter(s => s.trim());

  const rootCauses: string[] = [];
  const suggestedFixOrder: string[] = [];
  const columnMappingSuggestions: string[] = [];
  const fieldNotes: Record<string, string> = {};
  let summary = '';

  for (const section of sections) {
    const lines = section.trim().split('\n');
    const title = lines[0]?.toLowerCase() || '';
    const content = lines.slice(1).join('\n').trim();

    if (title.includes('kök neden') || title.includes('root cause')) {
      const items = content.split('\n').filter(l => l.trim().startsWith('-') || l.trim().match(/^\d+\./));
      rootCauses.push(...items.map(i => i.replace(/^[-\d.]+\s*/, '').trim()).filter(Boolean));
    } else if (title.includes('düzeltme sırası') || title.includes('fix order')) {
      const items = content.split('\n').filter(l => l.trim().startsWith('-') || l.trim().match(/^\d+\./));
      suggestedFixOrder.push(...items.map(i => i.replace(/^[-\d.]+\s*/, '').trim()).filter(Boolean));
    } else if (title.includes('sütun') || title.includes('column')) {
      const items = content.split('\n').filter(l => l.trim().startsWith('-') || l.trim().match(/^\d+\./));
      columnMappingSuggestions.push(...items.map(i => i.replace(/^[-\d.]+\s*/, '').trim()).filter(Boolean));
    } else if (title.includes('alan') || title.includes('field')) {
      const fieldMatches = content.match(/\*\*([^*]+)\*\*:?\s*([^*\n]+)/g);
      if (fieldMatches) {
        for (const match of fieldMatches) {
          const [, field, note] = match.match(/\*\*([^*]+)\*\*:?\s*(.+)/) || [];
          if (field && note) {
            fieldNotes[field.trim()] = note.trim();
          }
        }
      }
      if (Object.keys(fieldNotes).length === 0) {
        fieldNotes['Genel'] = content;
      }
    } else if (title.includes('özet') || title.includes('summary')) {
      summary = content;
    }
  }

  if (!summary && response.length > 0) {
    summary = response.slice(0, 500);
  }

  return {
    rootCauses: rootCauses.length > 0 ? rootCauses : ['Analiz tamamlandı, detaylı sonuçlar yukarıda.'],
    suggestedFixOrder: suggestedFixOrder.length > 0 ? suggestedFixOrder : ['Önce hataları, sonra uyarıları düzeltin.'],
    columnMappingSuggestions: columnMappingSuggestions.length > 0 ? columnMappingSuggestions : ['Sütun eşleştirmesi uygun görünüyor.'],
    fieldNotes,
    summary: summary || 'Analiz tamamlandı.',
    timestamp: new Date().toISOString(),
  };
}

export const aiAnalysisRouter = createTRPCRouter({
  analyze: publicProcedure
    .input(analyzeInputSchema)
    .mutation(async ({ input }) => {
      const { datasetType, errors, warnings, sampleRows, totalRows } = input;

      if (errors.length === 0 && warnings.length === 0) {
        return {
          rootCauses: [],
          suggestedFixOrder: [],
          columnMappingSuggestions: [],
          fieldNotes: {},
          summary: 'Veri setinde hata veya uyarı bulunamadı. Veri kalitesi uygun.',
          timestamp: new Date().toISOString(),
        } as AIAnalysis;
      }

      const prompt = buildAnalysisPrompt(datasetType, errors, warnings, sampleRows, totalRows);

      try {
        const response = await callGeminiAPI(prompt);
        return parseGeminiResponse(response);
      } catch (error) {
        console.error('AI Analysis error:', error);
        throw new Error(`AI analizi başarısız: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
      }
    }),
});
