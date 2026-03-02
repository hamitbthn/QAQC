import { GRADE_PATTERNS } from './headerConstants';

/**
 * Detects if a column name represents a grade (assay) column.
 */
export function isGradeColumn(header: string): boolean {
    const lowerHeader = header.toLowerCase();

    // Check against patterns (suffixes/prefixes)
    for (const pattern of GRADE_PATTERNS) {
        const lowerPattern = pattern.toLowerCase();

        // Pattern might be a suffix like _ppm
        if (pattern.startsWith('_')) {
            if (lowerHeader.endsWith(lowerPattern)) return true;
        }
        // Or it might be the element name itself
        else if (lowerHeader === lowerPattern || lowerHeader.startsWith(lowerPattern + '_') || lowerHeader.endsWith('_' + lowerPattern)) {
            return true;
        }
    }

    return false;
}

/**
 * Extracts all grade columns from a list of headers.
 */
export function getGradeColumns(headers: string[]): string[] {
    return headers.filter(isGradeColumn);
}
