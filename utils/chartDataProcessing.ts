import type { AssayRow } from '@/types/geology';
import { calculatePearson, calculateSpearman } from './mathUtils';

export type BDLHandling = 'ZERO' | 'HALF_DL' | 'NULL';

export interface ProcessingOptions {
    bdlHandling: BDLHandling;
    excludeOutliers?: boolean;
    logScale?: boolean;
    weighted?: boolean;
}

function parseBDLLimit(val: any): number | null {
    if (typeof val === 'string' && val.trim().startsWith('<')) {
        const num = parseFloat(val.trim().substring(1));
        return isNaN(num) ? null : num;
    }
    return null;
}

export function processCellValue(val: any, handling: BDLHandling): number | null {
    if (val === null || val === undefined || val === '') return null;

    const bdlLimit = parseBDLLimit(val);
    if (bdlLimit !== null) {
        if (handling === 'ZERO') return 0;
        if (handling === 'HALF_DL') return bdlLimit / 2;
        return null;
    }

    const num = Number(val);
    return isNaN(num) ? null : num;
}

/**
 * Prepares data for a single column with geochem rules
 */
export function getProcessedColumnData(
    assayData: AssayRow[],
    column: string,
    options: ProcessingOptions
): number[] {
    const result: number[] = [];

    for (const row of assayData) {
        const val = processCellValue(row[column], options.bdlHandling);
        if (val !== null) {
            result.push(val);
        }
    }

    if (options.excludeOutliers && result.length > 5) {
        const sorted = [...result].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        return result.filter(v => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
    }

    return result;
}

/**
 * Calculates correlation matrix with Spearman/Pearson support
 */
export function calculateScientificCorrelation(
    assayData: AssayRow[],
    columns: string[],
    method: 'pearson' | 'spearman' = 'spearman',
    bdlHandling: BDLHandling = 'HALF_DL'
): number[][] {
    const n = columns.length;
    const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(1));

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const x: number[] = [];
            const y: number[] = [];

            assayData.forEach(row => {
                const valX = processCellValue(row[columns[i]], bdlHandling);
                const valY = processCellValue(row[columns[j]], bdlHandling);
                if (valX !== null && valY !== null) {
                    x.push(valX);
                    y.push(valY);
                }
            });

            const corr = method === 'pearson' ? calculatePearson(x, y) : calculateSpearman(x, y);
            matrix[i][j] = corr;
            matrix[j][i] = corr;
        }
    }

    return matrix;
}

/**
 * Calculates weighted mean for a hole
 */
export function calculateWeightedMean(
    holeData: AssayRow[],
    column: string,
    bdlHandling: BDLHandling
): number {
    let totalWeightedValue = 0;
    let totalLength = 0;

    for (const row of holeData) {
        const val = processCellValue(row[column], bdlHandling);
        const length = (Number(row.TO) - Number(row.FROM)) || 0;

        if (val !== null && length > 0) {
            totalWeightedValue += val * length;
            totalLength += length;
        }
    }

    return totalLength > 0 ? totalWeightedValue / totalLength : 0;
}

/**
 * Groups assay data by a key (e.g. HOLEID or LITH)
 */
export function getGroupedData(
    assayData: AssayRow[],
    valueColumn: string,
    groupColumn: string,
    opts: ProcessingOptions
): Record<string, number[]> {
    const groups: Record<string, number[]> = {};

    for (const row of assayData) {
        const groupKey = String(row[groupColumn] || 'Unknown');
        const val = processCellValue(row[valueColumn], opts.bdlHandling);

        if (val !== null) {
            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(val);
        }
    }

    return groups;
}
