import { CANONICAL_HEADERS, CanonicalKey } from './headerConstants';

/**
 * Normalizes a header string by lowercasing and removing special characters.
 */
export function normalizeHeader(header: string): string {
    return header.toLowerCase().replace(/[\s\-_./]/g, '');
}

/**
 * Calculates Levenshtein distance between two strings.
 */
function levenshteinDistance(s1: string, s2: string): number {
    if (s1.length < s2.length) return levenshteinDistance(s2, s1);
    if (s2.length === 0) return s1.length;

    let prevRow = Array.from({ length: s2.length + 1 }, (_, i) => i);
    for (let i = 0; i < s1.length; i++) {
        let currRow = [i + 1];
        for (let j = 0; j < s2.length; j++) {
            let insertions = prevRow[j + 1] + 1;
            let deletions = currRow[j] + 1;
            let substitutions = prevRow[j] + (s1[i] === s2[j] ? 0 : 1);
            currRow.push(Math.min(insertions, deletions, substitutions));
        }
        prevRow = currRow;
    }
    return prevRow[s2.length];
}

/**
 * Matches a user header against canonical maps.
 */
export function matchHeader(userHeader: string): { key: CanonicalKey | null; confidence: number } {
    const normalizedUser = normalizeHeader(userHeader);

    // 1. Exact Match on normalized string
    for (const [key, variations] of Object.entries(CANONICAL_HEADERS)) {
        for (const v of variations) {
            if (normalizeHeader(v) === normalizedUser) {
                return { key: key as CanonicalKey, confidence: 1.0 };
            }
        }
    }

    // 2. Fuzzy Match
    let bestMatch: CanonicalKey | null = null;
    let maxConfidence = 0;
    const FUZZY_THRESHOLD = 0.7;

    for (const [key, variations] of Object.entries(CANONICAL_HEADERS)) {
        for (const v of variations) {
            const normalizedV = normalizeHeader(v);
            const distance = levenshteinDistance(normalizedUser, normalizedV);
            const maxLength = Math.max(normalizedUser.length, normalizedV.length);
            const confidence = 1 - distance / maxLength;

            if (confidence > maxConfidence) {
                maxConfidence = confidence;
                bestMatch = key as CanonicalKey;
            }
        }
    }

    if (maxConfidence >= FUZZY_THRESHOLD) {
        return { key: bestMatch, confidence: maxConfidence };
    }

    return { key: null, confidence: 0 };
}

/**
 * Maps all headers in a row.
 */
export function mapHeaders(headers: string[]): Record<string, CanonicalKey | null> {
    const mapping: Record<string, CanonicalKey | null> = {};
    headers.forEach(h => {
        const match = matchHeader(h);
        mapping[h] = match.key;
    });
    return mapping;
}
