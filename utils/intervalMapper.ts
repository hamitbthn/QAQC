import type { LithologyRow, AssayRow, Point3D } from '@/types/geology';
import { TrajectoryPoint, interpolatePointAtMD } from './trajectoryMinimumCurvature';

export interface IntervalSegment {
  from: number;
  to: number;
  startPoint: {
    x_local: number;
    y_local: number;
    z_local: number;
    x_world: number;
    y_world: number;
    z_world: number;
  };
  endPoint: {
    x_local: number;
    y_local: number;
    z_local: number;
    x_world: number;
    y_world: number;
    z_world: number;
  };
  lithCode?: string;
  gradeValue?: number;
  gradeColumn?: string;
}

export interface ColoredSegment {
  start: Point3D;
  end: Point3D;
  color: string;
  from: number;
  to: number;
  lithCode?: string;
  gradeValue?: number;
}

const LITH_COLOR_PALETTE: Record<string, string> = {
  'GR': '#6B7280',
  'GN': '#10B981',
  'SH': '#8B5CF6',
  'SS': '#F59E0B',
  'LS': '#3B82F6',
  'QZ': '#EC4899',
  'AND': '#EF4444',
  'BAS': '#374151',
  'RHY': '#F97316',
  'DAC': '#A855F7',
  'GRD': '#84CC16',
  'DIO': '#14B8A6',
  'GAB': '#1F2937',
  'POR': '#FB923C',
  'SCH': '#8B5CF6',
  'GNS': '#6366F1',
  'MAR': '#F1F5F9',
  'SKN': '#0EA5E9',
  'HFE': '#DC2626',
  'OX': '#B91C1C',
  'SUL': '#FACC15',
  'BRX': '#92400E',
  'CGL': '#D97706',
  'SLT': '#78716C',
  'MUD': '#57534E',
  'CLY': '#A8A29E',
  'SND': '#FCD34D',
  'LIM': '#60A5FA',
  'DOL': '#93C5FD',
  'CHT': '#F0ABFC',
  'default': '#94A3B8',
};

export function getLithologyColor(lithCode: string | undefined, colorMap: Record<string, string>): string {
  if (!lithCode) return '#94A3B8';
  const upperCode = String(lithCode).toUpperCase().trim();
  return colorMap[upperCode] || '#94A3B8';
}

const AUTO_COLOR_POOL = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
  '#6366F1', '#84CC16', '#0EA5E9', '#D946EF', '#A855F7', '#FB923C', '#22D3EE', '#FACC15',
  '#4ADE80', '#F87171', '#818CF8', '#2DD4BF', '#E879F9', '#FCA5A1', '#86EFAC', '#FDE047',
  '#67E8F9', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5', '#9B59B6',
  '#3498DB', '#2ECC71', '#1ABC9C', '#F1C40F', '#E67E22', '#E74C3C', '#34495E', '#16A085',
  '#27AE60', '#2980B9', '#8E44AD', '#F39C12', '#D35400', '#C0392B', '#BDC3C7', '#FF9FF3'
];

export function getUniqueLithCodes(lithologyData: LithologyRow[]): string[] {
  const codes = new Set<string>();
  for (const row of lithologyData) {
    const code = row.LITHCODE;
    if (code != null && String(code).trim() !== '') {
      codes.add(String(code).toUpperCase().trim());
    }
  }
  return Array.from(codes).sort();
}

export function buildLithColorMap(
  lithCodes: string[],
  customColors?: Record<string, string>
): Record<string, string> {
  const colorMap: Record<string, string> = {};
  let autoIndex = 0;
  for (const code of lithCodes) {
    if (customColors && customColors[code]) {
      colorMap[code] = customColors[code];
    } else if (LITH_COLOR_PALETTE[code]) {
      colorMap[code] = LITH_COLOR_PALETTE[code];
    } else {
      colorMap[code] = AUTO_COLOR_POOL[autoIndex % AUTO_COLOR_POOL.length];
      autoIndex++;
    }
  }
  return colorMap;
}

export function getGradeColor(
  value: number,
  minValue: number,
  maxValue: number
): string {
  if (isNaN(value) || minValue === maxValue) {
    return '#94A3B8';
  }

  const normalized = Math.max(0, Math.min(1, (value - minValue) / (maxValue - minValue)));

  const r = Math.round(255 * normalized);
  const g = Math.round(255 * (1 - normalized) * 0.7);
  const b = Math.round(100 * (1 - normalized));

  return `rgb(${r},${g},${b})`;
}

export function mapIntervalsToTrajectory(
  trajectory: TrajectoryPoint[],
  lithologyData: LithologyRow[],
  holeId: string
): IntervalSegment[] {
  if (trajectory.length < 2 || !lithologyData || lithologyData.length === 0) {
    return [];
  }

  const holeLithology = lithologyData.filter(
    l => String(l.HOLEID) === holeId
  ).sort((a, b) => Number(a.FROM) - Number(b.FROM));

  const segments: IntervalSegment[] = [];

  for (const lith of holeLithology) {
    const from = Number(lith.FROM);
    const to = Number(lith.TO);

    if (isNaN(from) || isNaN(to) || from >= to) continue;

    const startPoint = interpolatePointAtMD(trajectory, from);
    const endPoint = interpolatePointAtMD(trajectory, to);

    if (!startPoint || !endPoint) continue;

    segments.push({
      from,
      to,
      startPoint: {
        x_local: startPoint.x_local,
        y_local: startPoint.y_local,
        z_local: startPoint.z_local,
        x_world: startPoint.x_world,
        y_world: startPoint.y_world,
        z_world: startPoint.z_world,
      },
      endPoint: {
        x_local: endPoint.x_local,
        y_local: endPoint.y_local,
        z_local: endPoint.z_local,
        x_world: endPoint.x_world,
        y_world: endPoint.y_world,
        z_world: endPoint.z_world,
      },
      lithCode: lith.LITHCODE,
    });
  }

  return segments;
}

export function mapAssayIntervalsToTrajectory(
  trajectory: TrajectoryPoint[],
  assayData: AssayRow[],
  holeId: string,
  gradeColumn: string
): IntervalSegment[] {
  if (trajectory.length < 2 || !assayData || assayData.length === 0) {
    return [];
  }

  const holeAssays = assayData.filter(
    a => String(a.HOLEID) === holeId
  ).sort((a, b) => Number(a.FROM) - Number(b.FROM));

  const segments: IntervalSegment[] = [];

  for (const assay of holeAssays) {
    const from = Number(assay.FROM);
    const to = Number(assay.TO);
    const gradeValue = Number(assay[gradeColumn]);

    if (isNaN(from) || isNaN(to) || from >= to) continue;

    const startPoint = interpolatePointAtMD(trajectory, from);
    const endPoint = interpolatePointAtMD(trajectory, to);

    if (!startPoint || !endPoint) continue;

    segments.push({
      from,
      to,
      startPoint: {
        x_local: startPoint.x_local,
        y_local: startPoint.y_local,
        z_local: startPoint.z_local,
        x_world: startPoint.x_world,
        y_world: startPoint.y_world,
        z_world: startPoint.z_world,
      },
      endPoint: {
        x_local: endPoint.x_local,
        y_local: endPoint.y_local,
        z_local: endPoint.z_local,
        x_world: endPoint.x_world,
        y_world: endPoint.y_world,
        z_world: endPoint.z_world,
      },
      gradeValue: isNaN(gradeValue) ? undefined : gradeValue,
      gradeColumn,
    });
  }

  return segments;
}

export function createColoredSegmentsFromLithology(
  trajectory: TrajectoryPoint[], lithologyData: LithologyRow[], holeId: string,
  verticalExaggeration: number = 1, colorMap: Record<string, string> = {}
): ColoredSegment[] {
  const intervals = mapIntervalsToTrajectory(trajectory, lithologyData, holeId);
  return intervals.map(interval => ({
    start: { x: interval.startPoint.x_local, y: interval.startPoint.y_local, z: interval.startPoint.z_local * verticalExaggeration },
    end: { x: interval.endPoint.x_local, y: interval.endPoint.y_local, z: interval.endPoint.z_local * verticalExaggeration },
    color: getLithologyColor(interval.lithCode, colorMap),
    from: interval.from, to: interval.to, lithCode: interval.lithCode,
  }));
}

export function createColoredSegmentsFromGrade(
  trajectory: TrajectoryPoint[],
  assayData: AssayRow[],
  holeId: string,
  gradeColumn: string,
  minGrade: number,
  maxGrade: number,
  verticalExaggeration: number = 1
): ColoredSegment[] {
  const intervals = mapAssayIntervalsToTrajectory(trajectory, assayData, holeId, gradeColumn);

  return intervals.map(interval => ({
    start: {
      x: interval.startPoint.x_local,
      y: interval.startPoint.y_local,
      z: interval.startPoint.z_local * verticalExaggeration,
    },
    end: {
      x: interval.endPoint.x_local,
      y: interval.endPoint.y_local,
      z: interval.endPoint.z_local * verticalExaggeration,
    },
    color: getGradeColor(interval.gradeValue ?? 0, minGrade, maxGrade),
    from: interval.from,
    to: interval.to,
    gradeValue: interval.gradeValue,
  }));
}

export function createTrajectorySegments(
  trajectory: TrajectoryPoint[],
  verticalExaggeration: number = 1,
  defaultColor: string = '#3B82F6'
): ColoredSegment[] {
  if (trajectory.length < 2) return [];

  const segments: ColoredSegment[] = [];

  for (let i = 1; i < trajectory.length; i++) {
    const p1 = trajectory[i - 1];
    const p2 = trajectory[i];

    segments.push({
      start: {
        x: p1.x_local,
        y: p1.y_local,
        z: p1.z_local * verticalExaggeration,
      },
      end: {
        x: p2.x_local,
        y: p2.y_local,
        z: p2.z_local * verticalExaggeration,
      },
      color: defaultColor,
      from: p1.md,
      to: p2.md,
    });
  }

  return segments;
}

export function calculateGradeRange(
  assayData: AssayRow[],
  gradeColumn: string
): { min: number; max: number } {
  if (!assayData || assayData.length === 0) {
    return { min: 0, max: 1 };
  }

  let min = Infinity;
  let max = -Infinity;

  for (const row of assayData) {
    const value = Number(row[gradeColumn]);
    if (!isNaN(value) && value >= 0) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  if (!isFinite(min)) min = 0;
  if (!isFinite(max)) max = 1;
  if (min === max) max = min + 1;

  return { min, max };
}

export function getAvailableGradeColumns(assayData: AssayRow[]): string[] {
  if (!assayData || assayData.length === 0) return [];

  const firstRow = assayData[0];
  const excludeColumns = ['HOLEID', 'FROM', 'TO', 'SAMPLEID'];

  return Object.keys(firstRow).filter(key => {
    if (excludeColumns.includes(key.toUpperCase())) return false;
    const value = firstRow[key];
    return typeof value === 'number' || !isNaN(Number(value));
  });
}
