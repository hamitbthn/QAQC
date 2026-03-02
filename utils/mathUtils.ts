/**
 * Mathematical utilities for geological data analysis
 */

/**
 * Calculates Pearson Correlation Coefficient (r)
 */
export function calculatePearson(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (denominator === 0) return 0;

    return (n * sumXY - sumX * sumY) / denominator;
}

/**
 * Calculates Linear Regression for Trendlines
 * Returns { slope, intercept, rValue }
 */
export function calculateLinearRegression(x: number[], y: number[]) {
    if (x.length !== y.length || x.length === 0) return { slope: 0, intercept: 0, rValue: 0 };

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const rValue = calculatePearson(x, y);

    return { slope, intercept, rValue };
}

/**
 * Calculates Percentile Value
 */
export function calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (upper >= sorted.length) return sorted[lower];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Log10 scaling with handling for zero/negative values
 */
export function safeLog10(val: number, minValue: number = 0.0001): number {
    return Math.log10(Math.max(val, minValue));
}

/**
 * Maps a value from one range to another
 */
export function mapValue(val: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
    if (inMax === inMin) return outMin;
    return (val - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

/**
 * Calculates Spearman Rank Correlation Coefficient (rho)
 */
export function calculateSpearman(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;

    // Create ranks
    const getRanks = (arr: number[]) => {
        const sorted = arr.map((val, i) => ({ val, i })).sort((a, b) => a.val - b.val);
        const ranks = new Array(n);
        for (let i = 0; i < n; i++) {
            ranks[sorted[i].i] = i + 1;
        }
        // Handle ties (average ranks)
        let i = 0;
        while (i < n) {
            let j = i + 1;
            while (j < n && sorted[j].val === sorted[i].val) {
                j++;
            }
            if (j - i > 1) {
                const avgRank = (i + 1 + j) / 2;
                for (let k = i; k < j; k++) {
                    ranks[sorted[k].i] = avgRank;
                }
            }
            i = j;
        }
        return ranks;
    };

    const ranksX = getRanks(x);
    const ranksY = getRanks(y);

    return calculatePearson(ranksX, ranksY);
}
