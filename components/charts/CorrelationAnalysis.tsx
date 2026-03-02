import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Line, Circle, Text as SvgText, Rect, G } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { calculateLinearRegression, calculateSpearman, mapValue, safeLog10 } from '@/utils/mathUtils';

const chartPadding = { top: 30, right: 30, bottom: 40, left: 50 };

export const ScatterPlot = ({
    dataX,
    dataY,
    labelX,
    labelY,
    isLog = false
}: {
    dataX: number[],
    dataY: number[],
    labelX: string,
    labelY: string,
    isLog?: boolean
}) => {
    const { colors } = useTheme();
    const screenWidth = Dimensions.get('window').width;
    const chartWidth = screenWidth - 48;
    const chartHeight = 280;

    const plotData = useMemo(() => {
        if (dataX.length === 0 || dataX.length !== dataY.length) return null;

        const pairs = dataX.map((x, i) => ({ x, y: dataY[i] }));
        const filtered = pairs.filter(p => p.x > 0 && p.y > 0);
        if (filtered.length < 2) return null;

        const xVals = isLog ? filtered.map(p => safeLog10(p.x)) : filtered.map(p => p.x);
        const yVals = isLog ? filtered.map(p => safeLog10(p.y)) : filtered.map(p => p.y);

        const minX = Math.min(...xVals);
        const maxX = Math.max(...xVals);
        const minY = Math.min(...yVals);
        const maxY = Math.max(...yVals);

        const regression = calculateLinearRegression(xVals, yVals);
        const spearman = calculateSpearman(xVals, yVals);

        return { xVals, yVals, minX, maxX, minY, maxY, regression, spearman, count: filtered.length };
    }, [dataX, dataY, isLog]);

    if (!plotData) return <View style={styles.empty}><Text>Yetersiz eşleşen veri</Text></View>;

    const { xVals, yVals, minX, maxX, minY, maxY, regression, spearman, count } = plotData;
    const innerWidth = chartWidth - chartPadding.left - chartPadding.right;
    const innerHeight = chartHeight - chartPadding.top - chartPadding.bottom;

    return (
        <View style={styles.container}>
            <View style={styles.statContainer}>
                <View style={styles.statBox}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pearson r</Text>
                    <Text style={[styles.statVal, { color: colors.primary }]}>{regression.rValue.toFixed(3)}</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Spearman ρ</Text>
                    <Text style={[styles.statVal, { color: colors.warning }]}>{spearman.toFixed(3)}</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Count</Text>
                    <Text style={[styles.statVal, { color: colors.text }]}>{count}</Text>
                </View>
            </View>

            <Svg width={chartWidth} height={chartHeight}>
                <Line x1={chartPadding.left} y1={chartHeight - chartPadding.bottom} x2={chartWidth - chartPadding.right} y2={chartHeight - chartPadding.bottom} stroke={colors.border} />
                <Line x1={chartPadding.left} y1={chartPadding.top} x2={chartPadding.left} y2={chartHeight - chartPadding.bottom} stroke={colors.border} />

                {/* Trendline */}
                {(() => {
                    const x1 = minX;
                    const y1 = regression.slope * x1 + regression.intercept;
                    const x2 = maxX;
                    const y2 = regression.slope * x2 + regression.intercept;

                    const sx1 = chartPadding.left + mapValue(x1, minX, maxX, 0, innerWidth);
                    const sy1 = chartHeight - chartPadding.bottom - mapValue(y1, minY, maxY, 0, innerHeight);
                    const sx2 = chartPadding.left + mapValue(x2, minX, maxX, 0, innerWidth);
                    const sy2 = chartHeight - chartPadding.bottom - mapValue(y2, minY, maxY, 0, innerHeight);

                    return <Line x1={sx1} y1={sy1} x2={sx2} y2={sy2} stroke={colors.error} strokeWidth={1.5} strokeDasharray="5,5" />;
                })()}

                {/* Points - sampled for performance */}
                {xVals.map((xv, i) => {
                    if (i > 1000 && i % 5 !== 0) return null; // Simple decimation for large datasets
                    const cx = chartPadding.left + mapValue(xv, minX, maxX, 0, innerWidth);
                    const cy = chartHeight - chartPadding.bottom - mapValue(yVals[i], minY, maxY, 0, innerHeight);
                    return <Circle key={i} cx={cx} cy={cy} r={2} fill={colors.primary} fillOpacity={0.4} />;
                })}
            </Svg>
        </View>
    );
};

export const CorrelationHeatmap = ({
    matrix,
    elements
}: {
    matrix: number[][],
    elements: string[]
}) => {
    const { colors } = useTheme();
    const screenWidth = Dimensions.get('window').width;
    const chartWidth = screenWidth - 48;

    // Kenar boşluklarını artırıyoruz
    const leftMargin = 85;
    const topMargin = 85;

    // Hücre boyutunu yeni boşluklara göre hesaplıyoruz
    const cellSize = Math.min((chartWidth - leftMargin - 10) / elements.length, 35);
    const chartHeight = topMargin + (cellSize * elements.length) + 20;

    // Uzun metinleri kısaltan yardımcı fonksiyon
    const formatLabel = (txt: string) => txt.length > 12 ? txt.substring(0, 10) + '..' : txt;

    return (
        <View style={styles.heatmapContainer}>
            <Svg width={chartWidth} height={chartHeight}>
                <G>
                    {/* 1. Sütun İsimleri (Yukarıda, Çapraz Eğik) */}
                    {elements.map((el, i) => {
                        const xPos = leftMargin + i * cellSize + cellSize / 2;
                        const yPos = topMargin - 10;
                        return (
                            <SvgText
                                key={`col-${i}`}
                                x={xPos}
                                y={yPos}
                                fontSize={9}
                                fill={colors.textSecondary}
                                textAnchor="start"
                                transform={`rotate(-45, ${xPos}, ${yPos})`}
                            >
                                {formatLabel(el)}
                            </SvgText>
                        );
                    })}

                    {/* 2. Satır İsimleri ve Matrix Hücreleri */}
                    {elements.map((el, i) => (
                        <G key={`row-${i}`}>
                            <SvgText
                                x={leftMargin - 10}
                                y={topMargin + i * cellSize + cellSize / 2 + 3}
                                fontSize={9}
                                fill={colors.textSecondary}
                                textAnchor="end"
                            >
                                {formatLabel(el)}
                            </SvgText>

                            {elements.map((_, j) => {
                                const r = matrix[i][j];
                                const absR = Math.abs(r);
                                const color = r > 0 ? `rgba(59, 130, 246, ${absR})` : `rgba(239, 68, 68, ${absR})`;
                                return (
                                    <G key={`cell-${j}`}>
                                        <Rect
                                            x={leftMargin + j * cellSize}
                                            y={topMargin + i * cellSize}
                                            width={cellSize - 1}
                                            height={cellSize - 1}
                                            fill={color}
                                        />
                                        {cellSize > 20 && (
                                            <SvgText
                                                x={leftMargin + j * cellSize + cellSize / 2}
                                                y={topMargin + i * cellSize + cellSize / 2 + 3}
                                                fontSize={8}
                                                fill={absR > 0.6 ? "#FFF" : colors.text}
                                                textAnchor="middle"
                                            >
                                                {r.toFixed(1)}
                                            </SvgText>
                                        )}
                                    </G>
                                );
                            })}
                        </G>
                    ))}
                </G>
            </Svg>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { marginVertical: 10 },
    statContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15, backgroundColor: 'rgba(0,0,0,0.03)', padding: 10, borderRadius: 12 },
    statBox: { alignItems: 'center' },
    statLabel: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
    statVal: { fontSize: 14, fontWeight: '800' },
    heatmapContainer: { padding: 5 },
    empty: { height: 150, justifyContent: 'center', alignItems: 'center' }
});
