import type { CollarRow, SurveyRow } from '@/types/geology';

export interface TrajectoryPoint {
  md: number;
  tvd: number;
  x_world: number;
  y_world: number;
  z_world: number;
  x_local: number;
  y_local: number;
  z_local: number;
  azimuth: number;
  dip: number;
}

export interface NormalizationCenter {
  centerX: number;
  centerY: number;
  centerZ: number;
}

export interface TrajectoryResult {
  trajectory: TrajectoryPoint[];
  totalHorizontalOffset: number;
  maxDogleg: number;
  doglegWarnings: { md: number; doglegDeg: number }[];
}

export interface BoundsWithCenter {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerY: number;
  centerZ: number;
  rangeX: number;
  rangeY: number;
  rangeZ: number;
}

export function calculateBoundsWithCenter(collarData: CollarRow[]): BoundsWithCenter {
  if (!collarData || collarData.length === 0) {
    return {
      minX: 0, maxX: 100,
      minY: 0, maxY: 100,
      minZ: 0, maxZ: 100,
      centerX: 50, centerY: 50, centerZ: 50,
      rangeX: 100, rangeY: 100, rangeZ: 100,
    };
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  collarData.forEach(c => {
    const x = Number(c.XCOLLAR);
    const y = Number(c.YCOLLAR);
    const z = Number(c.ZCOLLAR);
    const depth = Number(c.ENDDEPTH) || 0;

    if (!isNaN(x)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    if (!isNaN(y)) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    if (!isNaN(z)) { 
      minZ = Math.min(minZ, z - depth); 
      maxZ = Math.max(maxZ, z); 
    }
  });

  if (!isFinite(minX)) { minX = 0; maxX = 100; }
  if (!isFinite(minY)) { minY = 0; maxY = 100; }
  if (!isFinite(minZ)) { minZ = 0; maxZ = 100; }

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const rangeZ = maxZ - minZ || 1;

  return {
    minX, maxX,
    minY, maxY,
    minZ, maxZ,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    centerZ: (minZ + maxZ) / 2,
    rangeX, rangeY, rangeZ,
  };
}

export function normalizeToLocal(
  x: number, 
  y: number, 
  z: number, 
  center: NormalizationCenter
): { x_local: number; y_local: number; z_local: number } {
  return {
    x_local: x - center.centerX,
    y_local: y - center.centerY,
    z_local: z - center.centerZ,
  };
}

export function localToWorld(
  x_local: number,
  y_local: number,
  z_local: number,
  center: NormalizationCenter
): { x: number; y: number; z: number } {
  return {
    x: x_local + center.centerX,
    y: y_local + center.centerY,
    z: z_local + center.centerZ,
  };
}

function normalizeAzimuth(azi: number): number {
  let normalized = azi % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

function clampDip(dip: number): number {
  return Math.max(-90, Math.min(90, dip));
}

function prepareSurveyData(surveys: SurveyRow[]): { md: number; azi: number; dip: number }[] {
  const prepared = surveys
    .map(s => ({
      md: Number(s.DEPTH),
      azi: normalizeAzimuth(Number(s.AZI)),
      dip: clampDip(Number(s.DIP)),
    }))
    .filter(s => !isNaN(s.md) && !isNaN(s.azi) && !isNaN(s.dip))
    .sort((a, b) => a.md - b.md);

  if (prepared.length === 0) {
    return [{ md: 0, azi: 0, dip: -90 }];
  }

  if (prepared[0].md > 0) {
    prepared.unshift({
      md: 0,
      azi: prepared[0].azi,
      dip: prepared[0].dip,
    });
  }

  return prepared;
}

export function calculateMinimumCurvatureTrajectory(
  collar: CollarRow,
  surveys: SurveyRow[],
  center: NormalizationCenter
): TrajectoryResult {
  const collarX = Number(collar.XCOLLAR);
  const collarY = Number(collar.YCOLLAR);
  const rl = Number(collar.ZCOLLAR);
  const endDepth = Number(collar.ENDDEPTH) || 0;

  if (isNaN(collarX) || isNaN(collarY) || isNaN(rl)) {
    console.warn('Invalid collar coordinates');
    return {
      trajectory: [],
      totalHorizontalOffset: 0,
      maxDogleg: 0,
      doglegWarnings: [],
    };
  }

  const preparedSurveys = prepareSurveyData(surveys);
  
  const trajectory: TrajectoryPoint[] = [];
  const doglegWarnings: { md: number; doglegDeg: number }[] = [];
  let maxDogleg = 0;

  let x_world = collarX;
  let y_world = collarY;
  let tvd = 0;

  const firstLocal = normalizeToLocal(collarX, collarY, rl, center);
  trajectory.push({
    md: 0,
    tvd: 0,
    x_world: collarX,
    y_world: collarY,
    z_world: rl,
    x_local: firstLocal.x_local,
    y_local: firstLocal.y_local,
    z_local: firstLocal.z_local,
    azimuth: preparedSurveys[0].azi,
    dip: preparedSurveys[0].dip,
  });

  for (let i = 1; i < preparedSurveys.length; i++) {
    const s1 = preparedSurveys[i - 1];
    const s2 = preparedSurveys[i];
    const dMD = s2.md - s1.md;

    if (dMD <= 0) continue;

    const I1 = ((90 - Math.abs(s1.dip)) * Math.PI) / 180;
    const I2 = ((90 - Math.abs(s2.dip)) * Math.PI) / 180;
    const A1 = (s1.azi * Math.PI) / 180;
    const A2 = (s2.azi * Math.PI) / 180;

    const cosDL = Math.cos(I2 - I1) - Math.sin(I1) * Math.sin(I2) * (1 - Math.cos(A2 - A1));
    const DL = Math.acos(Math.max(-1, Math.min(1, cosDL)));

    let RF = 1;
    if (DL > 1e-8) {
      RF = (2 / DL) * Math.tan(DL / 2);
    }

    const doglegDeg = (DL * 180) / Math.PI;
    const doglegPer30m = (doglegDeg / dMD) * 30;
    
    if (doglegPer30m > maxDogleg) {
      maxDogleg = doglegPer30m;
    }
    
    if (doglegPer30m > 5) {
      doglegWarnings.push({ md: s2.md, doglegDeg: doglegPer30m });
    }

    const dX = (dMD / 2) * (Math.sin(I1) * Math.sin(A1) + Math.sin(I2) * Math.sin(A2)) * RF;
    const dY = (dMD / 2) * (Math.sin(I1) * Math.cos(A1) + Math.sin(I2) * Math.cos(A2)) * RF;
    const dTVD = (dMD / 2) * (Math.cos(I1) + Math.cos(I2)) * RF;

    x_world += dX;
    y_world += dY;
    tvd += dTVD;

    const z_world = rl - tvd;
    const local = normalizeToLocal(x_world, y_world, z_world, center);

    trajectory.push({
      md: s2.md,
      tvd,
      x_world,
      y_world,
      z_world,
      x_local: local.x_local,
      y_local: local.y_local,
      z_local: local.z_local,
      azimuth: s2.azi,
      dip: s2.dip,
    });
  }

  const lastSurvey = preparedSurveys[preparedSurveys.length - 1];
  if (lastSurvey.md < endDepth && endDepth > 0) {
    const dMD = endDepth - lastSurvey.md;
    const I = ((90 - Math.abs(lastSurvey.dip)) * Math.PI) / 180;
    const A = (lastSurvey.azi * Math.PI) / 180;

    x_world += dMD * Math.sin(I) * Math.sin(A);
    y_world += dMD * Math.sin(I) * Math.cos(A);
    tvd += dMD * Math.cos(I);

    const z_world = rl - tvd;
    const local = normalizeToLocal(x_world, y_world, z_world, center);

    trajectory.push({
      md: endDepth,
      tvd,
      x_world,
      y_world,
      z_world,
      x_local: local.x_local,
      y_local: local.y_local,
      z_local: local.z_local,
      azimuth: lastSurvey.azi,
      dip: lastSurvey.dip,
    });
  }

  const lastPoint = trajectory[trajectory.length - 1];
  const totalHorizontalOffset = Math.sqrt(
    Math.pow(lastPoint.x_world - collarX, 2) + 
    Math.pow(lastPoint.y_world - collarY, 2)
  );

  return {
    trajectory,
    totalHorizontalOffset,
    maxDogleg,
    doglegWarnings,
  };
}

export function calculateVerticalTrajectory(
  collar: CollarRow,
  center: NormalizationCenter,
  stepSize: number = 10
): TrajectoryResult {
  const collarX = Number(collar.XCOLLAR);
  const collarY = Number(collar.YCOLLAR);
  const rl = Number(collar.ZCOLLAR);
  const endDepth = Number(collar.ENDDEPTH) || 0;

  if (isNaN(collarX) || isNaN(collarY) || isNaN(rl)) {
    return {
      trajectory: [],
      totalHorizontalOffset: 0,
      maxDogleg: 0,
      doglegWarnings: [],
    };
  }

  const trajectory: TrajectoryPoint[] = [];
  const steps = Math.ceil(endDepth / stepSize) + 1;

  for (let i = 0; i < steps; i++) {
    const md = Math.min(i * stepSize, endDepth);
    const tvd = md;
    const z_world = rl - tvd;
    const local = normalizeToLocal(collarX, collarY, z_world, center);

    trajectory.push({
      md,
      tvd,
      x_world: collarX,
      y_world: collarY,
      z_world,
      x_local: local.x_local,
      y_local: local.y_local,
      z_local: local.z_local,
      azimuth: 0,
      dip: -90,
    });

    if (md >= endDepth) break;
  }

  return {
    trajectory,
    totalHorizontalOffset: 0,
    maxDogleg: 0,
    doglegWarnings: [],
  };
}

export function interpolatePointAtMD(
  trajectory: TrajectoryPoint[],
  targetMD: number
): TrajectoryPoint | null {
  if (trajectory.length === 0) return null;
  if (targetMD <= trajectory[0].md) return trajectory[0];
  if (targetMD >= trajectory[trajectory.length - 1].md) {
    return trajectory[trajectory.length - 1];
  }

  for (let i = 1; i < trajectory.length; i++) {
    const p1 = trajectory[i - 1];
    const p2 = trajectory[i];

    if (targetMD >= p1.md && targetMD <= p2.md) {
      const t = (targetMD - p1.md) / (p2.md - p1.md);
      
      return {
        md: targetMD,
        tvd: p1.tvd + t * (p2.tvd - p1.tvd),
        x_world: p1.x_world + t * (p2.x_world - p1.x_world),
        y_world: p1.y_world + t * (p2.y_world - p1.y_world),
        z_world: p1.z_world + t * (p2.z_world - p1.z_world),
        x_local: p1.x_local + t * (p2.x_local - p1.x_local),
        y_local: p1.y_local + t * (p2.y_local - p1.y_local),
        z_local: p1.z_local + t * (p2.z_local - p1.z_local),
        azimuth: p1.azimuth + t * (p2.azimuth - p1.azimuth),
        dip: p1.dip + t * (p2.dip - p1.dip),
      };
    }
  }

  return null;
}
