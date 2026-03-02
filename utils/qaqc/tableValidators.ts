import { QAQCParams, QAQCIssue, QAQCSeverity as Severity } from '@/types/qaqc';

/**
 * Validates COLLAR table rows.
 */
export function validateCollarTable(data: any[], params: QAQCParams): QAQCIssue[] {
    const issues: QAQCIssue[] = [];
    const seenHoles = new Map<string, { x: number; y: number }>();

    data.forEach((row, idx) => {
        const holeId = row.HOLEID;
        const x = row.XCOLLAR;
        const y = row.YCOLLAR;
        const endDepth = row.ENDDEPTH;

        if (!holeId) {
            issues.push({
                severity: 'BLOCKER',
                code: 'COLLAR_MISSING_HOLEID',
                table: 'collar',
                holeId: '-',
                rowIndex: idx,
                message: 'COLLAR tablosunda HOLEID eksik.',
                suggestion: 'HOLEID sütununu kontrol edin.'
            });
            return;
        }

        if (x === null || y === null || x === undefined || y === undefined) {
            issues.push({
                severity: 'ERROR',
                code: 'COLLAR_INVALID_COORDS',
                table: 'collar',
                holeId: holeId,
                rowIndex: idx,
                message: `Koordinatlar (X/Y) geçersiz veya eksik: ${holeId}`,
                suggestion: 'Koordinat değerlerinin sayısal olduğundan emin olun.'
            });
        }

        if (endDepth === null || endDepth === undefined || endDepth <= 0) {
            issues.push({
                severity: 'ERROR',
                code: 'COLLAR_INVALID_ENDDEPTH',
                table: 'collar',
                holeId: holeId,
                rowIndex: idx,
                message: `Geçersiz bitiş derinliği: ${endDepth}`,
                suggestion: 'ENDDEPTH değeri 0\'dan büyük olmalıdır.'
            });
        }

        if (seenHoles.has(holeId)) {
            const prev = seenHoles.get(holeId)!;
            const isSameCoords = Math.abs(prev.x - (x || 0)) < 0.1 && Math.abs(prev.y - (y || 0)) < 0.1;

            issues.push({
                severity: isSameCoords ? 'WARN' : 'ERROR',
                code: 'COLLAR_DUPLICATE_HOLEID',
                table: 'collar',
                holeId: holeId,
                rowIndex: idx,
                message: `Mükerrer HOLEID: ${holeId}${isSameCoords ? ' (Aynı koordinatlar)' : ' (Farklı koordinatlar!)'}`,
                suggestion: 'Mükerrer satırı silin veya HOLEID\'yi düzeltin.'
            });
        } else {
            seenHoles.set(holeId, { x: x || 0, y: y || 0 });
        }
    });

    return issues;
}

/**
 * Validates SURVEY table rows.
 */
export function validateSurveyTable(data: any[], params: QAQCParams): QAQCIssue[] {
    const issues: QAQCIssue[] = [];
    const holeTrackers = new Map<string, { lastDepth: number; lastAzi: number; lastDip: number }>();

    data.forEach((row, idx) => {
        const holeId = row.HOLEID;
        const depth = row.AT !== undefined ? row.AT : row.DEPTH;
        const azi = row.AZIMUTH !== undefined ? row.AZIMUTH : row.AZI;
        const dip = row.DIP;

        if (!holeId) return;

        if (depth === null || azi === null || dip === null || depth === undefined || azi === undefined || dip === undefined) {
            issues.push({
                severity: 'ERROR',
                code: 'SURVEY_MISSING_DATA',
                table: 'survey',
                holeId: holeId,
                rowIndex: idx,
                message: `SURVEY verisi eksik (Depth/Azi/Dip): ${holeId}`,
                suggestion: 'Eksik kolonları doldurun.'
            });
            return;
        }

        if (depth < 0) {
            issues.push({
                severity: 'ERROR',
                code: 'SURVEY_NEGATIVE_DEPTH',
                table: 'survey',
                holeId: holeId,
                rowIndex: idx,
                message: `SURVEY derinliği negatif olamaz: ${depth}`,
                suggestion: 'Pozitif bir derinlik girin.'
            });
        }

        if (azi < 0 || azi >= 360) {
            issues.push({
                severity: 'WARN',
                code: 'SURVEY_INVALID_AZIMUTH',
                table: 'survey',
                holeId: holeId,
                rowIndex: idx,
                message: `Azimuth değeri [0-360) aralığı dışında: ${azi}`,
                suggestion: 'Değeri normalleştirin (örn. 361 -> 1).'
            });
        }

        if (holeTrackers.has(holeId)) {
            const tracker = holeTrackers.get(holeId)!;
            if (depth < tracker.lastDepth) {
                issues.push({
                    severity: 'ERROR',
                    code: 'SURVEY_DEPTH_DECREASING',
                    table: 'survey',
                    holeId: holeId,
                    rowIndex: idx,
                    message: `SURVEY derinliği azalıyor: ${depth} < ${tracker.lastDepth}`,
                    suggestion: 'Satırların derinliğe göre sıralı olduğundan emin olun.'
                });
            } else if (depth === tracker.lastDepth) {
                const isSame = Math.abs(tracker.lastAzi - azi) < 0.1 && Math.abs(tracker.lastDip - dip) < 0.1;
                issues.push({
                    severity: isSame ? 'WARN' : 'ERROR',
                    code: 'SURVEY_DUPLICATE_STATION',
                    table: 'survey',
                    holeId: holeId,
                    rowIndex: idx,
                    message: `Aynı derinlikte birden fazla SURVEY ölçümü: ${depth}m`,
                    suggestion: 'Mükerrer ölçümü silin.'
                });
            }
            tracker.lastDepth = depth;
            tracker.lastAzi = azi;
            tracker.lastDip = dip;
        } else {
            holeTrackers.set(holeId, { lastDepth: depth, lastAzi: azi, lastDip: dip });
        }
    });

    return issues;
}

/**
 * Validates LITHOLOGY table rows.
 */
export function validateLithologyTable(data: any[], params: QAQCParams): QAQCIssue[] {
    const issues: QAQCIssue[] = [];
    const holeIntervals = new Map<string, { from: number; to: number; lith: string; idx: number }[]>();

    data.forEach((row, idx) => {
        const holeId = row.HOLEID;
        const from = row.FROM;
        const to = row.TO;
        const lith = row.LITH !== undefined ? row.LITH : row.LITHCODE;

        if (!holeId) return;

        if (from === null || to === null || !lith || from === undefined || to === undefined) {
            issues.push({
                severity: 'ERROR',
                code: 'LITH_MISSING_DATA',
                table: 'lithology',
                holeId: holeId,
                rowIndex: idx,
                message: `LITHOLOGY verisi eksik (From/To/Lith): ${holeId}`,
                suggestion: 'Eksik verileri tamamlayın.'
            });
            return;
        }

        if (from >= to) {
            issues.push({
                severity: 'ERROR',
                code: 'LITH_INVALID_INTERVAL',
                table: 'lithology',
                holeId: holeId,
                rowIndex: idx,
                message: `FROM >= TO hatası: ${from} - ${to}`,
                suggestion: 'Derinlik değerlerini düzeltin.'
            });
        }

        const intervals = holeIntervals.get(holeId) || [];
        intervals.push({ from, to, lith, idx });
        holeIntervals.set(holeId, intervals);
    });

    holeIntervals.forEach((intervals, holeId) => {
        const sorted = [...intervals].sort((a, b) => a.from - b.from);
        for (let i = 0; i < sorted.length - 1; i++) {
            const current = sorted[i];
            const next = sorted[i + 1];

            if (current.to > next.from + params.toleranceDepth) {
                issues.push({
                    severity: 'ERROR',
                    code: 'LITH_OVERLAP',
                    table: 'lithology',
                    holeId: holeId,
                    rowIndex: next.idx,
                    message: `Lithology interval overlap: ${current.to} > ${next.from}`,
                    evidence: { prev: current, next: next },
                    suggestion: 'Çakışan aralıkları düzeltin.'
                });
            }
            else if (current.to < next.from - params.toleranceDepth) {
                issues.push({
                    severity: 'WARN',
                    code: 'LITH_GAP',
                    table: 'lithology',
                    holeId: holeId,
                    rowIndex: next.idx,
                    message: `Lithology interval gap: ${current.to} - ${next.from}`,
                    suggestion: 'Eksik aralığı kontrol edin.'
                });
            }
        }
    });

    return issues;
}

/**
 * Validates ASSAY table rows.
 */
export function validateAssayTable(data: any[], gradeCols: string[], params: QAQCParams): QAQCIssue[] {
    const issues: QAQCIssue[] = [];
    const holeIntervals = new Map<string, { from: number; to: number; idx: number }[]>();
    const sampleIds = new Map<string, { holeId: string; from: number; to: number; idx: number }>();

    data.forEach((row, idx) => {
        const holeId = row.HOLEID;
        const from = row.FROM;
        const to = row.TO;
        const sampleId = row.SAMPLEID;

        if (!holeId) return;

        if (from === null || to === null || from === undefined || to === undefined) {
            issues.push({
                severity: 'ERROR',
                code: 'ASSAY_MISSING_DEPTH',
                table: 'assay',
                holeId: holeId,
                rowIndex: idx,
                message: `ASSAY derinlik bilgisi eksik: ${holeId}`,
                suggestion: 'From/To kolonlarını doldurun.'
            });
            return;
        }

        if (from >= to) {
            issues.push({
                severity: 'ERROR',
                code: 'ASSAY_INVALID_INTERVAL',
                table: 'assay',
                holeId: holeId,
                rowIndex: idx,
                message: `FROM >= TO hatası: ${from} - ${to}`,
                suggestion: 'Derinlik değerlerini düzeltin.'
            });
        }

        gradeCols.forEach(col => {
            const val = row[col];
            if (val !== null && val !== undefined && val < 0) {
                issues.push({
                    severity: 'ERROR',
                    code: 'ASSAY_NEGATIVE_GRADE',
                    table: 'assay',
                    holeId: holeId,
                    rowIndex: idx,
                    message: `Negatif tenor değeri: ${col} = ${val}`,
                    suggestion: 'Değeri 0 veya tespit sınırı olarak girin.'
                });
            }
        });

        if (sampleId) {
            if (sampleIds.has(String(sampleId))) {
                const prev = sampleIds.get(String(sampleId))!;
                const sameInterval = prev.holeId === holeId && Math.abs(prev.from - from) < 0.01;
                issues.push({
                    severity: sameInterval ? 'WARN' : 'ERROR',
                    code: 'ASSAY_DUPLICATE_SAMPLEID',
                    table: 'assay',
                    holeId: holeId,
                    rowIndex: idx,
                    message: `Mükerrer SAMPLEID: ${sampleId}`,
                    suggestion: 'SampleID değerinin benzersiz olduğundan emin olun.'
                });
            } else {
                sampleIds.set(String(sampleId), { holeId, from, to, idx });
            }
        }

        const intervals = holeIntervals.get(holeId) || [];
        intervals.push({ from, to, idx });
        holeIntervals.set(holeId, intervals);
    });

    holeIntervals.forEach((intervals, holeId) => {
        const sorted = [...intervals].sort((a, b) => a.from - b.from);
        for (let i = 0; i < sorted.length - 1; i++) {
            if (sorted[i].to > sorted[i + 1].from + params.toleranceDepth) {
                issues.push({
                    severity: 'ERROR',
                    code: 'ASSAY_OVERLAP',
                    table: 'assay',
                    holeId: holeId,
                    rowIndex: sorted[i + 1].idx,
                    message: `Assay interval overlap: ${sorted[i].to} > ${sorted[i + 1].from}`,
                    suggestion: 'Çakışan numune aralıklarını düzeltin.'
                });
            }
        }
    });

    return issues;
}
