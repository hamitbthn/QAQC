import { QAQCIssue, QAQCReport, QAQCSummary, QAQCTable } from '@/types/qaqc';

/**
 * Groups issues by HoleID.
 */
export function groupByHoleId(issues: QAQCIssue[]): Record<string, QAQCIssue[]> {
    const groups: Record<string, QAQCIssue[]> = {};
    issues.forEach(issue => {
        const hid = issue.holeId || '-';
        if (!groups[hid]) groups[hid] = [];
        groups[hid].push(issue);
    });
    return groups;
}

/**
 * Generates summary statistics from issues.
 */
export function generateSummary(issues: QAQCIssue[]): QAQCSummary {
    const holesWithIssues = new Set(issues.map(i => i.holeId).filter(id => id && id !== '-'));

    const issuesByTable = issues.reduce((acc, issue) => {
        acc[issue.table] = (acc[issue.table] || 0) + 1;
        return acc;
    }, { collar: 0, survey: 0, lithology: 0, assay: 0, cross: 0 } as Record<QAQCTable, number>);

    const issuesByHole: Record<string, { critical: number; warn: number; info: number }> = {};
    issues.forEach(issue => {
        const hid = issue.holeId || '-';
        if (!issuesByHole[hid]) {
            issuesByHole[hid] = { critical: 0, warn: 0, info: 0 };
        }
        if (issue.severity === 'BLOCKER' || issue.severity === 'ERROR') {
            issuesByHole[hid].critical++;
        } else if (issue.severity === 'WARN') {
            issuesByHole[hid].warn++;
        } else if (issue.severity === 'INFO') {
            issuesByHole[hid].info++;
        }
    });

    return {
        totalHoles: holesWithIssues.size,
        critical: issues.filter(i => i.severity === 'BLOCKER' || i.severity === 'ERROR').length,
        warn: issues.filter(i => i.severity === 'WARN').length,
        info: issues.filter(i => i.severity === 'INFO').length,
        issuesByTable,
        issuesByHole,
        fixesApplied: issues.filter(i => !!i.appliedFix),
        timestamp: new Date().toISOString()
    };
}

/**
 * Creates the final structured report.
 */
export function createReport(issues: QAQCIssue[]): QAQCReport {
    return {
        issues,
        summary: generateSummary(issues)
    };
}
