import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Line, Rect, Text as SvgText, G, Path } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { calculatePercentile, safeLog10, mapValue } from '@/utils/mathUtils';
import { processCellValue, type BDLHandling } from '@/utils/chartDataProcessing';

interface ChartPadding {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

const chartPadding: ChartPadding = { top: 20, right: 30, bottom: 40, left: 50 };

/**
 * Freedman-Diaconis Bin Count Calculation
 */
function calculateFDBins(data: number[]): number {
    if (data.length < 5) return 10;
    const sorted = [...data].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const binWidth = (2 * iqr) / Math.pow(data.length, 1 / 3);

    if (binWidth === 0) return 15;

    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const bins = Math.ceil((max - min) / binWidth);
    return Math.min(Math.max(bins, 5), 50); // Clamp between 5 and 50
}

export const EnhancedHistogram = ({
    data,
    element,
    isLog = false,
}: {
    data: number[],
    element: string,
    isLog?: boolean,
}) => {
    const { colors } = useTheme();
    const screenWidth = Dimensions.get('window').width;
    const chartWidth = screenWidth - 48;
    const chartHeight = 220;

    const histogramData = useMemo(() => {
        if (data.length === 0) return null;

        // Filters nulls and handles logs
        const values = isLog ? data.filter(v => v > 0).map(v => safeLog10(v)) : data;
        if (values.length === 0) return null;

        const min = Math.min(...values);
        const max = Math.max(...values);
        const binCount = calculateFDBins(values);
        const range = max - min || 1;
        const binWidth = range / binCount;

        const bins = Array.from({ length: binCount }, (_, i) => ({
            start: min + i * binWidth,
            end: min + (i + 1) * binWidth,
            count: 0,
        }));

        values.forEach(v => {
            const idx = Math.min(Math.floor((v - min) / binWidth), binCount - 1);
            if (idx >= 0) bins[idx].count++;
        });

        const maxCount = Math.max(...bins.map(b => b.count));
        const p90 = calculatePercentile(data, 90);
        const p95 = calculatePercentile(data, 95);

        return { bins, maxCount, min, max, p90, p95, binCount };
    }, [data, isLog]);

    if (!histogramData) return <View style={styles.empty}><Text>Yetersiz veri</Text></View>;

    const { bins, maxCount, min, max, p90, p95, binCount } = histogramData;
    const innerWidth = chartWidth - chartPadding.left - chartPadding.right;
    const innerHeight = chartHeight - chartPadding.top - chartPadding.bottom;

    return (
        <View style={styles.container}>
            <Svg width={chartWidth} height={chartHeight}>
                <Line x1={chartPadding.left} y1={chartHeight - chartPadding.bottom} x2={chartWidth - chartPadding.right} y2={chartHeight - chartPadding.bottom} stroke={colors.border} />
                <Line x1={chartPadding.left} y1={chartPadding.top} x2={chartPadding.left} y2={chartHeight - chartPadding.bottom} stroke={colors.border} />

                {bins.map((bin, i) => {
                    const h = (bin.count / maxCount) * innerHeight;
                    const w = innerWidth / binCount - 1;
                    const x = chartPadding.left + i * (innerWidth / binCount);
                    const y = chartHeight - chartPadding.bottom - h;
                    if (h <= 0) return null;
                    return (
                        <Rect key={i} x={x} y={y} width={w} height={h} fill={colors.primary} fillOpacity={0.7} />
                    );
                })}

                {[p90, p95].map((val, i) => {
                    const actualVal = isLog ? safeLog10(val) : val;
                    const x = chartPadding.left + mapValue(actualVal, min, max, 0, innerWidth);
                    if (x < chartPadding.left || x > chartWidth - chartPadding.right) return null;
                    return (
                        <G key={i}>
                            <Line x1={x} y1={chartPadding.top} x2={x} y2={chartHeight - chartPadding.bottom} stroke={i === 0 ? colors.warning : colors.error} strokeDasharray="4,4" />
                            <SvgText x={x} y={chartPadding.top - 5} fontSize={9} fill={i === 0 ? colors.warning : colors.error} textAnchor="middle">P{i === 0 ? 90 : 95}</SvgText>
                        </G>
                    );
                })}
            </Svg>
        </View>
    );
};

export const DownholeGradePlot = ({
    assayData,
    holeId,
    elements,
    isLog = false,
    isWeighted = false,
    bdlHandling = 'HALF_DL'
}: {
    assayData: any[],
    holeId: string,
    elements: string[],
    isLog?: boolean,
    isWeighted?: boolean,
    bdlHandling?: BDLHandling
}) => {
    const { colors } = useTheme();
    const chartWidth = Dimensions.get('window').width - 48;
    const chartHeight = 350;

    const result = useMemo(() => {
        const holeData = assayData
            .filter((row: any) => String(row.HOLEID) === holeId)
            .sort((a: any, b: any) => Number(a.FROM) - Number(b.FROM));

        if (holeData.length === 0) return null;

        const maxDepth = Math.max(...holeData.map(d => Number(d.TO)));
        const elementStats = elements.map((el) => {
            const vals = holeData.map(d => processCellValue(d[el], bdlHandling)).filter((v): v is number => v !== null);
            return {
                element: el,
                min: Math.min(...vals),
                max: Math.max(...vals),
            };
        });

        return { holeData, maxDepth, elementStats };
    }, [assayData, holeId, elements, bdlHandling]);

    if (!result) return <View style={styles.empty}><Text>Veri yok</Text></View>;

    const { holeData, maxDepth, elementStats } = result;
    const innerWidth = chartWidth - chartPadding.left - chartPadding.right;
    const innerHeight = chartHeight - chartPadding.top - chartPadding.bottom;
    const elementColors = [colors.primary, colors.error, colors.warning, '#10B981', '#6366F1', '#F59E0B', '#EC4899'];

    return (
        <View style={styles.container}>
            <Svg width={chartWidth} height={chartHeight}>
                <Line x1={chartPadding.left} y1={chartPadding.top} x2={chartPadding.left} y2={chartHeight - chartPadding.bottom} stroke={colors.border} />
                <Line x1={chartPadding.left} y1={chartHeight - chartPadding.bottom} x2={chartWidth - chartPadding.right} y2={chartHeight - chartPadding.bottom} stroke={colors.border} />

                {elements.map((el, elIdx) => {
                    const stats = elementStats[elIdx];
                    const color = elementColors[elIdx % elementColors.length];
                    const minVal = isLog ? safeLog10(stats.min) : stats.min;
                    const maxVal = isLog ? safeLog10(stats.max) : stats.max;

                    let pathData = "";
                    holeData.forEach((row, i) => {
                        const rawVal = processCellValue(row[el], bdlHandling);
                        if (rawVal === null) return;

                        const midDepth = (Number(row.FROM) + Number(row.TO)) / 2;
                        const val = isLog ? safeLog10(rawVal) : rawVal;

                        const x = chartPadding.left + mapValue(val, minVal, maxVal, 0, innerWidth);
                        const y = chartPadding.top + (midDepth / maxDepth) * innerHeight;
                        pathData += `${pathData === "" ? "M" : "L"}${x},${y} `;
                    });

                    return (
                        <G key={el}>
                            <Path d={pathData} fill="none" stroke={color} strokeWidth={1.5} />
                        </G>
                    );
                })}

                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                    <SvgText key={i} x={chartPadding.left - 5} y={chartPadding.top + ratio * innerHeight + 4} fontSize={10} fill={colors.textSecondary} textAnchor="end">
                        {(ratio * maxDepth).toFixed(0)}m
                    </SvgText>
                ))}
            </Svg>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { marginVertical: 10 },
    empty: { height: 200, justifyContent: 'center', alignItems: 'center' }
});
