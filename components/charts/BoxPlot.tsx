import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Line, Rect, Circle, G, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { calculatePercentile, mapValue, safeLog10 } from '@/utils/mathUtils';

const chartPadding = { top: 20, right: 20, bottom: 60, left: 50 };

export const BoxPlot = ({
    groupedData,
    isLog = false
}: {
    groupedData: Record<string, number[]>,
    isLog?: boolean
}) => {
    const { colors } = useTheme();
    const screenWidth = Dimensions.get('window').width;
    const chartWidth = screenWidth - 48;
    const chartHeight = 300;

    const plotData = useMemo(() => {
        const keys = Object.keys(groupedData).filter(k => groupedData[k].length > 0).slice(0, 10);
        if (keys.length === 0) return null;

        const stats = keys.map(key => {
            const vals = isLog ? groupedData[key].filter(v => v > 0).map(v => safeLog10(v)) : groupedData[key];
            if (vals.length === 0) return null;

            const sorted = [...vals].sort((a, b) => a - b);
            const q1 = calculatePercentile(sorted, 25);
            const q3 = calculatePercentile(sorted, 75);
            const median = calculatePercentile(sorted, 50);
            const iqr = q3 - q1;
            const min = Math.max(sorted[0], q1 - 1.5 * iqr);
            const max = Math.min(sorted[sorted.length - 1], q3 + 1.5 * iqr);
            const outliers = sorted.filter(v => v < min || v > max);

            return { key, q1, q3, median, min, max, outliers };
        }).filter(s => s !== null);

        const allValues = stats.flatMap(s => [s!.min, s!.max, ...s!.outliers]);
        const overallMin = Math.min(...allValues);
        const overallMax = Math.max(...allValues);

        return { stats, overallMin, overallMax };
    }, [groupedData, isLog]);

    if (!plotData || plotData.stats.length === 0) return <View style={styles.empty}><Text>Veri yok</Text></View>;

    const { stats, overallMin, overallMax } = plotData;
    const innerWidth = chartWidth - chartPadding.left - chartPadding.right;
    const innerHeight = chartHeight - chartPadding.top - chartPadding.bottom;
    const colWidth = innerWidth / stats.length;

    return (
        <View style={styles.container}>
            <Svg width={chartWidth} height={chartHeight}>
                <Line x1={chartPadding.left} y1={chartPadding.top} x2={chartPadding.left} y2={chartHeight - chartPadding.bottom} stroke={colors.border} />

                {stats.map((s, i) => {
                    if (!s) return null;
                    const xCenter = chartPadding.left + i * colWidth + colWidth / 2;
                    const yMedian = chartHeight - chartPadding.bottom - mapValue(s.median, overallMin, overallMax, 0, innerHeight);
                    const yQ1 = chartHeight - chartPadding.bottom - mapValue(s.q1, overallMin, overallMax, 0, innerHeight);
                    const yQ3 = chartHeight - chartPadding.bottom - mapValue(s.q3, overallMin, overallMax, 0, innerHeight);
                    const yMin = chartHeight - chartPadding.bottom - mapValue(s.min, overallMin, overallMax, 0, innerHeight);
                    const yMax = chartHeight - chartPadding.bottom - mapValue(s.max, overallMin, overallMax, 0, innerHeight);

                    return (
                        <G key={s.key}>
                            {/* Whisker */}
                            <Line x1={xCenter} y1={yMin} x2={xCenter} y2={yMax} stroke={colors.text} strokeWidth={1} />
                            <Line x1={xCenter - 10} y1={yMin} x2={xCenter + 10} y2={yMin} stroke={colors.text} strokeWidth={1} />
                            <Line x1={xCenter - 10} y1={yMax} x2={xCenter + 10} y2={yMax} stroke={colors.text} strokeWidth={1} />

                            {/* Box */}
                            <Rect
                                x={xCenter - 15}
                                y={yQ3}
                                width={30}
                                height={Math.max(yQ1 - yQ3, 1)}
                                fill={colors.primary}
                                fillOpacity={0.6}
                                stroke={colors.primary}
                            />
                            <Line x1={xCenter - 15} y1={yMedian} x2={xCenter + 15} y2={yMedian} stroke={"#FFF"} strokeWidth={2} />

                            {/* Label */}
                            <SvgText
                                x={xCenter}
                                y={chartHeight - chartPadding.bottom + 15}
                                fontSize={8}
                                fill={colors.textSecondary}
                                textAnchor="middle"
                                transform={`rotate(45, ${xCenter}, ${chartHeight - chartPadding.bottom + 15})`}
                            >
                                {s.key}
                            </SvgText>

                            {/* Outliers */}
                            {s.outliers.map((o, idx) => (
                                <Circle
                                    key={idx}
                                    cx={xCenter}
                                    cy={chartHeight - chartPadding.bottom - mapValue(o, overallMin, overallMax, 0, innerHeight)}
                                    r={2}
                                    fill={colors.error}
                                />
                            ))}
                        </G>
                    );
                })}
            </Svg>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { marginVertical: 10 },
    empty: { height: 200, justifyContent: 'center', alignItems: 'center' }
});
