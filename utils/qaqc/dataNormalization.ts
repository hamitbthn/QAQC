import { QAQCParams, QAQCIssue, QAQCSeverity as Severity } from '@/types/qaqc';

/**
 * Cleans multiple spaces and trims strings.
 */
export function cleanString(str: any): string {
    if (typeof str !== 'string') return String(str || '');
    return str.trim().replace(/\s+/g, ' ');
}

/**
 * Normalizes HOLEID to uppercase and trimmed.
 */
export function normalizeHoleId(holeId: any): string {
    return cleanString(holeId).toUpperCase();
}

/**
 * Parses numeric values with support for commas and detection limits.
 */
export function parseNumeric(value: any, params: QAQCParams): number | null {
    if (value === null || value === undefined || value === '') return null;

    let str = String(value).trim().replace(',', '.');

    // Handle below detection limit (e.g., "<0.01")
    if (str.startsWith('<')) {
        const numericPart = parseFloat(str.substring(1));
        if (isNaN(numericPart)) return null;

        switch (params.belowDetectionHandling) {
            case 'ZERO': return 0;
            case 'HALF': return numericPart / 2;
            case 'IGNORE': return null;
            default: return 0;
        }
    }

    // Handle above detection limit (e.g., ">10.0")
    if (str.startsWith('>')) {
        const numericPart = parseFloat(str.substring(1));
        return isNaN(numericPart) ? null : numericPart;
    }

    const result = parseFloat(str);
    return isNaN(result) ? null : result;
}

/**
 * Normalizes a row of data based on canonical mapping.
 */
export function normalizeRow(
    row: any,
    mapping: Record<string, string | null>,
    params: QAQCParams
): Record<string, any> {
    const normalized: Record<string, any> = {};

    Object.keys(row).forEach(header => {
        const canonicalKey = mapping[header];
        const value = row[header];

        if (!canonicalKey) {
            normalized[header] = value; // Keep unmapped columns as is
            return;
        }

        switch (canonicalKey) {
            case 'HOLEID':
                normalized[canonicalKey] = normalizeHoleId(value);
                break;
            case 'XCOLLAR':
            case 'YCOLLAR':
            case 'ZCOLLAR':
            case 'ENDDEPTH':
            case 'FROM':
            case 'TO':
            case 'AT':
            case 'AZIMUTH':
            case 'DIP':
                normalized[canonicalKey] = parseNumeric(value, params);
                break;
            case 'LITH':
            case 'SAMPLEID':
            case 'PROJECTCODE':
                normalized[canonicalKey] = cleanString(value);
                break;
            default:
                normalized[canonicalKey] = value;
        }
    });

    return normalized;
}
