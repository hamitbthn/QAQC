import type { DatasetType } from '@/types/geology';

export interface ColumnMappingResult {
  mappings: Record<string, string>;
  confidence: Record<string, number>;
  unmapped: string[];
  report: ColumnMappingReport[];
}

export interface ColumnMappingReport {
  requiredColumn: string;
  mappedTo: string | null;
  confidence: number;
  matchType: 'exact' | 'alias' | 'fuzzy' | 'partial' | 'none';
  alternatives: { header: string; score: number }[];
}

const COLLAR_ALIASES: Record<string, string[]> = {
  HOLEID: [
    'holeid', 'bhid', 'kuyuadi', 'kuyuid', 'drillhole', 'drillholeid',
    'wellid', 'id', 'name', 'hole_id', 'hole id', 'bh_id', 'kuyu_adi',
    'kuyu_id', 'sondaj', 'sondajno', 'sondaj_no', 'boreno', 'bore_no',
    'wellname', 'well_name', 'holename', 'hole_name', 'dh_id', 'dhid',
  ],
  XCOLLAR: [
    'x', 'easting', 'east', 'utmx', 'xutm', 'xcoord', 'xcoordinate',
    'xcollar', 'dogu', 'dogu_koord', 'x_collar', 'collar_x', 'e',
    'east_coord', 'easting_m', 'x_coord', 'x_coordinate', 'utm_x',
    'dogukoordinat', 'dogu_koordinat', 'koordinat_x', 'koord_x',
  ],
  YCOLLAR: [
    'y', 'northing', 'north', 'utmy', 'yutm', 'ycoord', 'ycoordinate',
    'ycollar', 'kuzey', 'kuzey_koord', 'y_collar', 'collar_y', 'n',
    'north_coord', 'northing_m', 'y_coord', 'y_coordinate', 'utm_y',
    'kuzeykoordinat', 'kuzey_koordinat', 'koordinat_y', 'koord_y',
  ],
  ZCOLLAR: [
    'z', 'rl', 'elevation', 'elev', 'zcollar', 'kot', 'yukseklik',
    'rakim', 'z_collar', 'collar_z', 'alt', 'altitude', 'height',
    'surface_rl', 'surfacerl', 'collar_rl', 'collarrl', 'z_coord',
    'kotdegeri', 'kot_degeri', 'rakimdegeri', 'yukseklikdegeri',
  ],
  ENDDEPTH: [
    'enddepth', 'totaldepth', 'depth', 'td', 'sondajderinlik',
    'sondaj_depth', 'end_depth', 'total_depth', 'max_depth', 'eoh',
    'finaledepth', 'hole_depth', 'holedepth', 'derinlik', 'toplamderinlik',
    'toplam_derinlik', 'bitis_derinlik', 'bitisderinlik', 'son_derinlik',
    'sonderinlik', 'eod', 'endofhole', 'end_of_hole',
  ],
};

const SURVEY_ALIASES: Record<string, string[]> = {
  HOLEID: COLLAR_ALIASES.HOLEID,
  DEPTH: [
    'depth', 'md', 'measureddepth', 'at', 'metre', 'downhole',
    'sondajderinlik', 'measured_depth', 'survey_depth', 'surveydepth',
    'derinlik', 'olcumderinlik', 'olcum_derinlik', 'mdepth', 'm_depth',
    'depthat', 'depth_at', 'downhole_depth', 'downholedepth',
  ],
  AZI: [
    'azimuth', 'azi', 'brg', 'bearing', 'direction', 'yon', 'istikamet',
    'az', 'azim', 'azmut', 'azimut', 'compass', 'heading', 'dir',
    'yon_acisi', 'yonacisi', 'pusulayonu', 'pusula_yonu', 'diraciion',
  ],
  DIP: [
    'dip', 'inclination', 'inc', 'angle', 'egim', 'dipangle', 'incl',
    'dip_angle', 'inclangle', 'incl_angle', 'tilt', 'slope',
    'egimacisi', 'egim_acisi', 'dalim', 'dalimacisi', 'dalim_acisi',
  ],
};

const LITHOLOGY_ALIASES: Record<string, string[]> = {
  HOLEID: COLLAR_ALIASES.HOLEID,
  FROM: [
    'from', 'baslangic', 'start', 'depthfrom', 'from_m', 'from_depth',
    'depth_from', 'fromdepth', 'startdepth', 'start_depth', 'begin',
    'baslangicderinlik', 'baslangic_derinlik', 'ust', 'ustderinlik',
  ],
  TO: [
    'to', 'bitis', 'end', 'depthto', 'to_m', 'to_depth', 'depth_to',
    'todepth', 'enddepth', 'end_depth', 'finish', 'bitisderinlik',
    'bitis_derinlik', 'alt', 'altderinlik', 'son',
  ],
  LITHCODE: [
    'lith', 'lithology', 'rocktype', 'formasyon', 'birim', 'kaya', 'kod',
    'lithcode', 'lith_code', 'rock_type', 'rock', 'code', 'litoloji',
    'litolojikod', 'litoloji_kod', 'kayaturu', 'kaya_turu', 'formation',
    'unit', 'geolcode', 'geol_code', 'geology', 'description', 'desc',
  ],
};

const ASSAY_ALIASES: Record<string, string[]> = {
  HOLEID: COLLAR_ALIASES.HOLEID,
  FROM: LITHOLOGY_ALIASES.FROM,
  TO: LITHOLOGY_ALIASES.TO,
  SAMPLEID: [
    'sampleid', 'numuneid', 'sample', 'id', 'numune', 'sample_id',
    'samp_id', 'sampno', 'sampid', 'sampleno', 'sample_no', 'numuneadi',
    'numune_adi', 'numuneno', 'numune_no', 'specimenid', 'specimen_id',
  ],
};

const GRADE_KEYWORDS = [
  'cu', 'cu_pct', 'cu_percent', 'copper', 'au', 'gold', 'grade', 'tenor',
  'ppm', 'ppb', 'percent', 'ag', 'silver', 'pb', 'lead', 'zn', 'zinc',
  'fe', 'iron', 'mo', 'molybdenum', 'ni', 'nickel', 'co', 'cobalt',
  'as', 'arsenic', 'sb', 'antimony', 'bi', 'bismuth', 'sn', 'tin',
  'w', 'tungsten', 'u', 'uranium', 'th', 'thorium', 'ba', 'barium',
  'mn', 'manganese', 'ti', 'titanium', 'v', 'vanadium', 'cr', 'chromium',
  'pt', 'platinum', 'pd', 'palladium', 'rh', 'rhodium', 'ir', 'iridium',
];

export const COLUMN_ALIASES_MAP: Record<DatasetType, Record<string, string[]>> = {
  COLLAR: COLLAR_ALIASES,
  SURVEY: SURVEY_ALIASES,
  LITHOLOGY: LITHOLOGY_ALIASES,
  ASSAY: ASSAY_ALIASES,
};

export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[\s_\-\.]+/g, '')
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[ıİ]/g, 'i')
    .replace(/[öÖ]/g, 'o')
    .replace(/[şŞ]/g, 's')
    .replace(/[üÜ]/g, 'u')
    .replace(/[^a-z0-9]/g, '');
}

export function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = normalizeHeader(str1);
  const s2 = normalizeHeader(str2);

  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0;

  if (s1.includes(s2) || s2.includes(s1)) {
    const shorter = Math.min(s1.length, s2.length);
    const longer = Math.max(s1.length, s2.length);
    return shorter / longer * 0.9;
  }

  const matrix: number[][] = [];
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[s1.length][s2.length];
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - distance / maxLen;
}

export function detectColumnMappingsAdvanced(
  headers: string[],
  datasetType: DatasetType,
  requiredColumns: string[]
): ColumnMappingResult {
  const aliases = COLUMN_ALIASES_MAP[datasetType];
  const mappings: Record<string, string> = {};
  const confidence: Record<string, number> = {};
  const report: ColumnMappingReport[] = [];
  const usedHeaders = new Set<string>();

  const normalizedHeaders = headers.map(h => ({
    original: h,
    normalized: normalizeHeader(h),
  }));

  for (const reqCol of requiredColumns) {
    const colAliases = aliases[reqCol] || [];
    let bestMatch: { header: string; score: number; type: 'exact' | 'alias' | 'fuzzy' | 'partial' } | null = null;
    const alternatives: { header: string; score: number }[] = [];

    for (const { original, normalized } of normalizedHeaders) {
      if (usedHeaders.has(original)) continue;

      const normalizedReq = normalizeHeader(reqCol);
      if (normalized === normalizedReq) {
        if (!bestMatch || bestMatch.score < 1.0) {
          bestMatch = { header: original, score: 1.0, type: 'exact' };
        }
        alternatives.push({ header: original, score: 1.0 });
        continue;
      }

      for (const alias of colAliases) {
        const normalizedAlias = normalizeHeader(alias);
        if (normalized === normalizedAlias) {
          const score = 0.95;
          if (!bestMatch || bestMatch.score < score) {
            bestMatch = { header: original, score, type: 'alias' };
          }
          alternatives.push({ header: original, score });
          break;
        }
      }

      const fuzzyScore = calculateStringSimilarity(normalized, normalizedReq);
      if (fuzzyScore >= 0.75) {
        if (!bestMatch || bestMatch.score < fuzzyScore) {
          bestMatch = { header: original, score: fuzzyScore, type: 'fuzzy' };
        }
        alternatives.push({ header: original, score: fuzzyScore });
      }

      for (const alias of colAliases) {
        const aliasScore = calculateStringSimilarity(normalized, alias);
        if (aliasScore >= 0.75) {
          const adjustedScore = aliasScore * 0.9;
          if (!bestMatch || bestMatch.score < adjustedScore) {
            bestMatch = { header: original, score: adjustedScore, type: 'fuzzy' };
          }
          if (!alternatives.find(a => a.header === original)) {
            alternatives.push({ header: original, score: adjustedScore });
          }
        }
      }

      if (normalized.includes(normalizedReq) || normalizedReq.includes(normalized)) {
        const partialScore = 0.7;
        if (!bestMatch || bestMatch.score < partialScore) {
          bestMatch = { header: original, score: partialScore, type: 'partial' };
        }
        if (!alternatives.find(a => a.header === original)) {
          alternatives.push({ header: original, score: partialScore });
        }
      }
    }

    const sortedAlternatives = alternatives
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (bestMatch && bestMatch.score >= 0.7) {
      mappings[reqCol] = bestMatch.header;
      confidence[reqCol] = bestMatch.score;
      usedHeaders.add(bestMatch.header);

      report.push({
        requiredColumn: reqCol,
        mappedTo: bestMatch.header,
        confidence: bestMatch.score,
        matchType: bestMatch.type,
        alternatives: sortedAlternatives,
      });
    } else {
      report.push({
        requiredColumn: reqCol,
        mappedTo: null,
        confidence: 0,
        matchType: 'none',
        alternatives: sortedAlternatives,
      });
    }
  }

  const unmapped = requiredColumns.filter(col => !mappings[col]);

  // Debug Log Sistemi
  console.log('--- SÜTUN EŞLEŞTİRME DEBUG ---');
  console.log('Dataset Type:', datasetType);
  console.log('Gelen Header Listesi:', headers);
  console.log('Eşleşen Sütunlar:', mappings);
  console.log('Eksik Zorunlu Sütunlar:', unmapped);
  console.log('Güven Skorları:', confidence);
  console.log('------------------------------');

  return { mappings, confidence, unmapped, report };
}

export function detectGradeColumns(headers: string[]): string[] {
  const gradeColumns: string[] = [];

  for (const header of headers) {
    const normalized = normalizeHeader(header);

    for (const keyword of GRADE_KEYWORDS) {
      if (normalized.includes(keyword) || keyword.includes(normalized)) {
        gradeColumns.push(header);
        break;
      }
    }

    if (/^[a-z]{1,2}[_\s]?(pct|percent|ppm|ppb|grade)?$/i.test(header.trim())) {
      if (!gradeColumns.includes(header)) {
        gradeColumns.push(header);
      }
    }
  }

  return gradeColumns;
}

export function generateMappingReportText(report: ColumnMappingReport[]): string {
  const lines: string[] = [
    'SÜTUN EŞLEŞTİRME RAPORU',
    '========================',
    '',
  ];

  for (const item of report) {
    const status = item.mappedTo ? '✓' : '✗';
    const confidenceText = item.mappedTo
      ? `(${(item.confidence * 100).toFixed(0)}% güven)`
      : '(eşleşme bulunamadı)';

    lines.push(`${status} ${item.requiredColumn} → ${item.mappedTo || 'EKSIK'} ${confidenceText}`);
    lines.push(`   Eşleşme Tipi: ${getMatchTypeLabel(item.matchType)}`);

    if (item.alternatives.length > 0) {
      lines.push(`   Alternatifler: ${item.alternatives.slice(0, 3).map(a => `${a.header} (${(a.score * 100).toFixed(0)}%)`).join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function getMatchTypeLabel(type: 'exact' | 'alias' | 'fuzzy' | 'partial' | 'none'): string {
  switch (type) {
    case 'exact': return 'Tam Eşleşme';
    case 'alias': return 'Takma Ad Eşleşmesi';
    case 'fuzzy': return 'Benzerlik Eşleşmesi';
    case 'partial': return 'Kısmi Eşleşme';
    case 'none': return 'Eşleşme Yok';
  }
}
