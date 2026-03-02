import type { AssayRow } from '@/types/geology';

export interface ColumnStats {
    min: number;
    max: number;
    mean: number;
    median: number;
    nullCount: number;
    bdlCount: number;
    unit: 'ppm' | 'ppb' | '%' | 'g/t' | 'unknown';
}

export interface DiscoveredColumn {
    name: string;
    stats: ColumnStats;
}

const EXCLUDE_LIST = [
    'HOLEID', 'SAMPLEID', 'FROM', 'TO', 'AT', 'DEPTH',
    'PROJECTCODE', 'COMMENT', 'DATE', 'LITH', 'UNIT',
    'LITHCODE', 'COLOR', 'FROM_DEPTH', 'TO_DEPTH'
];

const OXIDE_PATTERNS = [
    'AL2O3', 'SIO2', 'FE2O3', 'MGO', 'CAO', 'NA2O', 'K2O', 'TIO2', 'P2O5', 'MNO', 'CR2O3', 'LOI'
];

const ELEMENT_SYMBOLS = [
    'AU', 'AG', 'CU', 'PB', 'ZN', 'NI', 'CO', 'CR', 'MN', 'MO', 'W', 'SN', 'AS', 'SB', 'PT', 'PD', 'FE', 'S', 'BA', 'MG', 'AL', 'SI', 'K', 'CA', 'TI'
];

const UNIT_PATTERNS = ['PPM', 'PPB', 'PCT', 'PERCENT', 'GPT', 'G/T'];

function estimateUnit(name: string): ColumnStats['unit'] {
    const upper = name.toUpperCase();
    if (upper.includes('PPM')) return 'ppm';
    if (upper.includes('PPB')) return 'ppb';
    if (upper.includes('PCT') || upper.includes('PERCENT') || upper.includes('%')) return '%';
    if (upper.includes('GPT') || upper.includes('G/T')) return 'g/t';
    if (OXIDE_PATTERNS.includes(upper)) return '%';
    return 'unknown';
}

function parseBDL(val: any): number | null {
    if (typeof val === 'number') return null; // Not BDL text
    if (typeof val === 'string') {
        const clean = val.trim();
        if (clean.startsWith('<')) {
            const num = parseFloat(clean.substring(1));
            return isNaN(num) ? null : num;
        }
    }
    return null;
}

export function discoverGradeColumns(assayData: AssayRow[]): DiscoveredColumn[] {
    if (!assayData || assayData.length === 0) return [];

    const headers = Object.keys(assayData[0]);
    const discovered: DiscoveredColumn[] = [];

    for (const header of headers) {
        const upperHeader = header.toUpperCase();

        // 1. Exclude list check
        if (EXCLUDE_LIST.includes(upperHeader)) continue;

        // 2. Pattern detection
        const isOxide = OXIDE_PATTERNS.includes(upperHeader);
        const hasUnitPattern = UNIT_PATTERNS.some(p => upperHeader.includes(p));
        const isElementSymbol = ELEMENT_SYMBOLS.some(s => upperHeader === s || upperHeader.startsWith(s + '_') || upperHeader.endsWith('_' + s));

        if (!isOxide && !hasUnitPattern && !isElementSymbol) continue;

        // 3. Numeric dominance check (>= 70%)
        let numericCount = 0;
        let bdlCount = 0;
        let nullCount = 0;
        const values: number[] = [];

        for (const row of assayData) {
            const rawVal = row[header];
            if (rawVal === null || rawVal === undefined || rawVal === '') {
                nullCount++;
                continue;
            }

            const bdlLimit = parseBDL(rawVal);
            if (bdlLimit !== null) {
                bdlCount++;
                numericCount++; // BDL is considered "geochemically numeric"
                continue;
            }

            const num = Number(rawVal);
            if (!isNaN(num)) {
                numericCount++;
                values.push(num);
            }
        }

        const numericRatio = numericCount / assayData.length;
        if (numericRatio < 0.7 && values.length < 5) continue; // Failure to meet numeric dominance

        // 4. Calculate Stats
        values.sort((a, b) => a - b);
        const min = values.length > 0 ? values[0] : 0;
        const max = values.length > 0 ? values[values.length - 1] : 0;
        const sum = values.reduce((a, b) => a + b, 0);
        const mean = values.length > 0 ? sum / values.length : 0;
        const median = values.length > 0 ? values[Math.floor(values.length / 2)] : 0;

        discovered.push({
            name: header,
            stats: {
                min,
                max,
                mean,
                median,
                nullCount,
                bdlCount,
                unit: estimateUnit(header)
            }
        });
    }

    return discovered;
}
