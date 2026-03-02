import { QAQCParams, QAQCIssue, QAQCSeverity as Severity } from '@/types/qaqc';

/**
 * Validates integrity between different tables.
 */
export function validateCrossTable(
    collarData: any[],
    surveyData: any[],
    lithData: any[],
    assayData: any[],
    params: QAQCParams
): QAQCIssue[] {
    const issues: QAQCIssue[] = [];

    // Sets of unique HoleIds
    const hCollar = new Set(collarData.map(c => String(c.HOLEID)));
    const hSurvey = new Set(surveyData.map(s => String(s.HOLEID)).filter(id => id !== 'undefined' && id !== 'null'));
    const hLith = new Set(lithData.map(l => String(l.HOLEID)).filter(id => id !== 'undefined' && id !== 'null'));
    const hAssay = new Set(assayData.map(a => String(a.HOLEID)).filter(id => id !== 'undefined' && id !== 'null'));

    // Maps for Depth checks
    const collarDepths = new Map<string, number>();
    collarData.forEach(c => collarDepths.set(String(c.HOLEID), c.ENDDEPTH || 0));

    // 1. ORPHAN HOLES (Data in other tables but not in Collar)
    hSurvey.forEach(hid => {
        if (!hCollar.has(hid)) {
            issues.push({ severity: 'ERROR', code: 'CROSS_SURVEY_ORPHAN', table: 'cross', holeId: hid, message: `SURVEY tablosunda COLLAR'da olmayan HOLEID: ${hid}` });
        }
    });

    hLith.forEach(hid => {
        if (!hCollar.has(hid)) {
            issues.push({ severity: 'ERROR', code: 'CROSS_LITH_ORPHAN', table: 'cross', holeId: hid, message: `LITHOLOGY tablosunda COLLAR'da olmayan HOLEID: ${hid}` });
        }
    });

    hAssay.forEach(hid => {
        if (!hCollar.has(hid)) {
            issues.push({ severity: 'ERROR', code: 'CROSS_ASSAY_ORPHAN', table: 'cross', holeId: hid, message: `ASSAY tablosunda COLLAR'da olmayan HOLEID: ${hid}` });
        }
    });

    // 2. MISSING DATA (In Collar but not in others)
    hCollar.forEach(hid => {
        if (!hSurvey.has(hid)) issues.push({ severity: 'WARN', code: 'CROSS_SURVEY_MISSING', table: 'cross', holeId: hid, message: `SURVEY verisi eksik: ${hid}` });
        if (!hLith.has(hid)) issues.push({ severity: 'WARN', code: 'CROSS_LITH_MISSING', table: 'cross', holeId: hid, message: `LITHOLOGY verisi eksik: ${hid}` });
        if (!hAssay.has(hid)) issues.push({ severity: 'INFO', code: 'CROSS_ASSAY_MISSING', table: 'cross', holeId: hid, message: `ASSAY verisi bulunamadı: ${hid}` });
    });

    // 3. DEPTH LIMIT CHECKS
    // Check Lithology vs EndDepth
    lithData.forEach((row, idx) => {
        const limit = collarDepths.get(String(row.HOLEID));
        if (limit !== undefined && row.TO > limit + params.toleranceDepth) {
            issues.push({
                severity: 'ERROR',
                code: 'CROSS_LITH_EXCEEDS_DEPTH',
                table: 'cross',
                holeId: row.HOLEID,
                message: `Lithology derinliği Collar bitiş derinliğini aşıyor: ${row.TO} > ${limit}`,
                suggestion: 'Collar ENDDEPTH değerini veya Lithology TO değerini kontrol edin.'
            });
        }
    });

    // Check Assay vs EndDepth
    assayData.forEach((row, idx) => {
        const limit = collarDepths.get(String(row.HOLEID));
        if (limit !== undefined && row.TO > limit + params.toleranceDepth) {
            issues.push({
                severity: 'ERROR',
                code: 'CROSS_ASSAY_EXCEEDS_DEPTH',
                table: 'cross',
                holeId: row.HOLEID,
                message: `Assay derinliği Collar bitiş derinliğini aşıyor: ${row.TO} > ${limit}`,
                suggestion: 'Assay aralığını veya Collar derinliğini düzeltin.'
            });
        }
    });

    return issues;
}
