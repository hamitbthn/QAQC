import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Box, Palette, Activity } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import {
  calculateBoundsWithCenter,
  calculateMinimumCurvatureTrajectory,
  calculateVerticalTrajectory,
} from '@/utils/trajectoryMinimumCurvature';
import {
  createColoredSegmentsFromLithology,
  createColoredSegmentsFromGrade,
  createTrajectorySegments,
  getAvailableGradeColumns,
  calculateGradeRange,
  getUniqueLithCodes,
  buildLithColorMap
} from '@/utils/intervalMapper';
import type { CollarRow, SurveyRow, LithologyRow, AssayRow } from '@/types/geology';

const COLOR_PRESETS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#10B981',
  '#14B8A6', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
  '#D946EF', '#0EA5E9', '#22D3EE', '#FACC15', '#4ADE80',
  '#FB923C', '#A855F7', '#F87171', '#818CF8', '#2DD4BF',
  '#6B7280', '#374151', '#92400E', '#78716C', '#FCD34D',
];

// ─── HTML Template for WebView ───
const threeJsHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>JeoValid 3D</title>
  <style>
    body { margin: 0; overflow: hidden; background-color: #0F172A; }
    canvas { display: block; width: 100vw; height: 100vh; }
  </style>
  <!-- Load Three.js and OrbitControls from CDN -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
</head>
<body>
  <script>
    let scene, camera, renderer, controls, drillholeGroup;

    function init() {
      // Scene
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0F172A);

      // Camera
      camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
      camera.position.set(300, 300, 300);

      // Renderer
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      document.body.appendChild(renderer.domElement);

      // Controls
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;

      // Lights
      const ambient = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambient);
      const dir1 = new THREE.DirectionalLight(0xffffff, 1.0);
      dir1.position.set(100, 200, 100);
      scene.add(dir1);
      const dir2 = new THREE.DirectionalLight(0xffffff, 0.5);
      dir2.position.set(-100, 100, -100);
      scene.add(dir2);

      // Grid
      const grid = new THREE.GridHelper(1000, 20, 0x555555, 0x333333);
      scene.add(grid);

      // Resize
      window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });

      // Render Loop
      renderer.setAnimationLoop(() => {
        controls.update();
        renderer.render(scene, camera);
      });

      // Signal React Native we are ready
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY' }));
    }

    // Handle messages from React Native
    window.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'UPDATE_SCENE') {
          updateScene(data.segments);
        }
      } catch (e) {
        console.error("WebView msg parse error:", e);
      }
    });

    // Build cylinder meshes from segment data
    function updateScene(segmentsData) {
      try {
        if (drillholeGroup) {
          scene.remove(drillholeGroup);
          drillholeGroup.children.forEach(mesh => {
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
          });
        }

        drillholeGroup = new THREE.Group();

        const geomCache = new Map();
        const matCache = new Map();

        // For each drillhole
        segmentsData.forEach(hole => {
          hole.segments.forEach(seg => {
            const thickness = (seg.radius && !isNaN(seg.radius)) ? seg.radius : 1.2;
            
            // Z is up in Three.js sometimes, but here we keep (X, Z, -Y) mapping
            const startV = new THREE.Vector3(seg.start.x, seg.start.z, -seg.start.y);
            const endV = new THREE.Vector3(seg.end.x, seg.end.z, -seg.end.y);
            
            const direction = new THREE.Vector3().subVectors(endV, startV);
            const len = direction.length() || 0.01;
            const pos = new THREE.Vector3().addVectors(startV, endV).multiplyScalar(0.5);
            
            const quat = new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              direction.clone().normalize()
            );

            // Reuse geometry by length and thickness
            const geomKey = len.toFixed(2) + '_' + thickness.toString();
            let geo = geomCache.get(geomKey);
            if (!geo) {
              geo = new THREE.CylinderGeometry(thickness, thickness, len, 6);
              geomCache.set(geomKey, geo);
            }

            // Reuse material by color
            let mat = matCache.get(seg.color);
            if (!mat) {
              mat = new THREE.MeshStandardMaterial({ color: seg.color, roughness: 0.6, metalness: 0.15 });
              matCache.set(seg.color, mat);
            }

            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(pos);
            mesh.quaternion.copy(quat);
            
            drillholeGroup.add(mesh);
          });
        });

        scene.add(drillholeGroup);
      } catch (err) {
        console.error("ThreeJS render error:", err);
      }
    }

    init();
  </script>
</body>
</html>
`;


// ═══════════════════════════════════════════════════
// ─── MAIN SCREEN ──────────────────────────────────
// ═══════════════════════════════════════════════════

export default function Viewer3DScreen() {
  const { colors } = useTheme();
  const { datasets } = useData();

  const [colorMode, setColorMode] = useState<'default' | 'lithology' | 'grade'>('default');
  const [selectedGradeColumn, setSelectedGradeColumn] = useState<string | null>(null);
  const [webviewReady, setWebviewReady] = useState(false);
  const webviewRef = useRef<WebView>(null);

  // Lithology States
  const [customLithColors, setCustomLithColors] = useState<Record<string, string>>({});
  const [editingLithCode, setEditingLithCode] = useState<string | null>(null);

  const [customMin, setCustomMin] = useState('');
  const [customMax, setCustomMax] = useState('');
  const [gradeSteps, setGradeSteps] = useState('');
  const [hiddenLiths, setHiddenLiths] = useState<Set<string>>(new Set());

  const verticalExaggeration = 1.0;

  const collarData = datasets.COLLAR?.data || [];
  const surveyData = datasets.SURVEY?.data || [];
  const lithologyData = datasets.LITHOLOGY?.data || [];
  const assayData = datasets.ASSAY?.data || [];

  const gradeColumns = useMemo(
    () => getAvailableGradeColumns(assayData as AssayRow[]),
    [assayData]
  );

  const gradeRange = useMemo(() => {
    if (!selectedGradeColumn) return { min: 0, max: 1 };
    return calculateGradeRange(assayData as AssayRow[], selectedGradeColumn);
  }, [assayData, selectedGradeColumn]);

  const uniqueLithCodes = useMemo(() => getUniqueLithCodes(lithologyData as LithologyRow[]), [lithologyData]);
  const lithColorMap = useMemo(() => buildLithColorMap(uniqueLithCodes, customLithColors), [uniqueLithCodes, customLithColors]);

  useEffect(() => {
    if (gradeColumns.length > 0 && !selectedGradeColumn) {
      setSelectedGradeColumn(gradeColumns[0]);
    }
  }, [gradeColumns, selectedGradeColumn]);

  const center = useMemo(() => {
    if (!collarData.length) return { centerX: 0, centerY: 0, centerZ: 0 };
    const bounds = calculateBoundsWithCenter(collarData as CollarRow[]);
    return { centerX: bounds.centerX, centerY: bounds.centerY, centerZ: bounds.centerZ };
  }, [collarData]);

  // ─── Calculate 3D Segments on Native side ───
  const drillholeSegments = useMemo(() => {
    if (collarData.length === 0) return [];

    const surveyMap: Record<string, SurveyRow[]> = {};
    (surveyData as SurveyRow[]).forEach((s) => {
      const holeId = String(s.HOLEID);
      if (!surveyMap[holeId]) surveyMap[holeId] = [];
      surveyMap[holeId].push(s);
    });
    Object.values(surveyMap).forEach((sv) =>
      sv.sort((a, b) => Number(a.DEPTH) - Number(b.DEPTH))
    );

    // Evaluate Custom States
    const activeMin = customMin !== '' && !isNaN(Number(customMin)) ? Number(customMin) : gradeRange.min;
    const activeMax = customMax !== '' && !isNaN(Number(customMax)) ? Number(customMax) : gradeRange.max;
    const activeSteps = gradeSteps !== '' && !isNaN(Number(gradeSteps)) ? Number(gradeSteps) : 0;
    const hiddenLithsArray = Array.from(hiddenLiths);

    return (collarData as CollarRow[]).map((collar) => {
      const holeId = String(collar.HOLEID);
      const sv = surveyMap[holeId] || [];

      const trajectoryResult =
        sv.length >= 2
          ? calculateMinimumCurvatureTrajectory(collar, sv, center)
          : calculateVerticalTrajectory(collar, center);

      let segments: any[] = [];
      if (colorMode === 'lithology' && lithologyData.length > 0) {
        segments = createColoredSegmentsFromLithology(
          trajectoryResult.trajectory, lithologyData as LithologyRow[], holeId, verticalExaggeration, lithColorMap
        );
        segments = segments.filter(seg => !hiddenLiths.has(seg.lithCode || ''));
      } else if (colorMode === 'grade' && assayData.length > 0 && selectedGradeColumn) {
        segments = createColoredSegmentsFromGrade(
          trajectoryResult.trajectory, assayData as AssayRow[], holeId,
          selectedGradeColumn, activeMin, activeMax, verticalExaggeration, activeSteps
        );
      } else {
        segments = createTrajectorySegments(trajectoryResult.trajectory, verticalExaggeration, '#3B82F6');
      }

      // Simplify objects for JSON serialization map
      const safeSegments = segments.map(seg => ({
        start: { x: seg.start.x, y: seg.start.y, z: seg.start.z },
        end: { x: seg.end.x, y: seg.end.y, z: seg.end.z },
        color: seg.color,
        radius: seg.radius
      }));

      return { holeId, segments: safeSegments };
    }).filter(h => h.segments.length > 0);
  }, [collarData, surveyData, lithologyData, assayData, center, colorMode, selectedGradeColumn, gradeRange, verticalExaggeration, lithColorMap, customMin, customMax, gradeSteps, hiddenLiths]);

  // ─── Post segments to WebView ───
  useEffect(() => {
    if (webviewReady && webviewRef.current && drillholeSegments.length > 0) {
      // Send raw geometry data over the bridge
      const script = `
        window.postMessage(JSON.stringify({
          type: 'UPDATE_SCENE',
          segments: ${JSON.stringify(drillholeSegments)}
        }), '*');
        true;
      `;
      webviewRef.current.injectJavaScript(script);
    }
  }, [webviewReady, drillholeSegments]);

  const hasData = collarData.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        {/* HEADER */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Box size={22} color={colors.primary} />
          <View style={styles.headerTextCont}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>JeoValid 3D</Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
              {collarData.length} Kuyu •{' '}
              {colorMode === 'default' ? 'Yörünge' : colorMode === 'lithology' ? 'Litoloji' : 'Tenör'}
            </Text>
          </View>
        </View>

        {/* COLOR MODE BUTTONS */}
        <View style={styles.controlsRow}>
          {(['default', 'lithology', 'grade'] as const).map((mode) => {
            const active = colorMode === mode;
            const label = mode === 'default' ? 'Yörünge' : mode === 'lithology' ? 'Litoloji' : 'Tenör';
            const Icon = mode === 'default' ? Box : mode === 'lithology' ? Palette : Activity;
            return (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.modeBtn,
                  {
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primary : 'transparent',
                  },
                ]}
                onPress={() => setColorMode(mode)}
              >
                <Icon size={14} color={active ? '#fff' : colors.text} />
                <Text style={[styles.modeBtnText, { color: active ? '#fff' : colors.text }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* GRADE COLUMN SELECTOR */}
        {colorMode === 'grade' && gradeColumns.length > 0 && (
          <View style={[styles.gradeRow, { backgroundColor: colors.surface }]}>
            <Text style={[styles.gradeLabel, { color: colors.textSecondary }]}>Analiz Sütunu:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingRight: 16 }}
            >
              {gradeColumns.map((col) => {
                const active = selectedGradeColumn === col;
                return (
                  <TouchableOpacity
                    key={col}
                    style={[
                      styles.gradeChip,
                      {
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primary + '18' : 'transparent',
                      },
                    ]}
                    onPress={() => setSelectedGradeColumn(col)}
                  >
                    <Text
                      style={{
                        color: active ? colors.primary : colors.text,
                        fontSize: 11,
                        fontWeight: active ? '700' : '400',
                      }}
                    >
                      {col}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </SafeAreaView>

      {/* WEBVIEW 3D CANVAS */}
      <View style={styles.canvasWrap}>
        {!hasData ? (
          <View style={styles.empty}>
            <Box size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Veri Yükleyin</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              3D görüntüleme için en az COLLAR verisi gereklidir.
            </Text>
          </View>
        ) : (
          <>
            {!webviewReady && (
              <View style={[StyleSheet.absoluteFill, styles.loader]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.textSecondary, marginTop: 12 }}>3D Motoru Yükleniyor...</Text>
              </View>
            )}
            <WebView
              ref={webviewRef}
              style={{ flex: 1, backgroundColor: '#0F172A', opacity: webviewReady ? 1 : 0 }}
              source={{ html: threeJsHTML }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              onMessage={(event) => {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === 'READY') {
                  setWebviewReady(true);
                }
              }}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              scrollEnabled={false}
              bounces={false}
            />
          </>
        )}

        {/* LITHOLOGY LEGEND OVERLAY */}
        {colorMode === 'lithology' && uniqueLithCodes.length > 0 && (
          <View style={[styles.legendOverlay, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.legendTitle, { color: colors.text }]}>Litoloji Renkleri</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 10, marginBottom: 8 }}>Değiştirmek için dokun</Text>
            <ScrollView style={{ maxHeight: 100 }} nestedScrollEnabled>
              <View style={styles.legendGrid}>
                {uniqueLithCodes.map(code => (
                  <TouchableOpacity key={code} onPress={() => setEditingLithCode(editingLithCode === code ? null : code)} style={[styles.legendItem, editingLithCode === code && { backgroundColor: colors.primary + '20', borderRadius: 4 }]}>
                    <View style={[styles.colorBox, { backgroundColor: lithColorMap[code] || '#94A3B8' }]} />
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{code}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {editingLithCode && (
              <View style={styles.colorPickerContainer}>
                <Text style={{ color: colors.text, fontSize: 12, marginBottom: 6 }}>{editingLithCode} rengini seç:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {COLOR_PRESETS.map(c => (
                    <TouchableOpacity key={c} onPress={() => { setCustomLithColors(prev => ({ ...prev, [editingLithCode]: c })); setEditingLithCode(null); }} style={[styles.colorSwatch, { backgroundColor: c }]} />
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* GRADE LEGEND OVERLAY */}
        {colorMode === 'grade' && selectedGradeColumn && (
          <View style={[styles.legendOverlay, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.legendTitle, { color: colors.text }]}>Analiz: {selectedGradeColumn}</Text>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: colors.textSecondary }}>Min (Cut-off)</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.background }]}
                  value={customMin}
                  onChangeText={setCustomMin}
                  placeholder={gradeRange.min.toFixed(2)}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: colors.textSecondary }}>Maks</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.background }]}
                  value={customMax}
                  onChangeText={setCustomMax}
                  placeholder={gradeRange.max.toFixed(2)}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: colors.textSecondary }}>Adım</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.background }]}
                  value={gradeSteps}
                  onChangeText={setGradeSteps}
                  placeholder="Sürekli"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.gradeBar}>
              {/* Isı haritası önizlemesi */}
              {Array.from({ length: 10 }).map((_, i) => (
                <View key={i} style={{ flex: 1, backgroundColor: `hsl(${(1 - i / 9) * 240}, 100%, 50%)` }} />
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// ═══ Styles ═══
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerTextCont: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
  controlsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    justifyContent: 'center',
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },
  modeBtnText: { fontSize: 12, fontWeight: '500' },
  gradeRow: { paddingHorizontal: 12, paddingBottom: 8, gap: 4 },
  gradeLabel: { fontSize: 11, marginBottom: 4 },
  gradeChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  canvasWrap: { flex: 1, position: 'relative' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptySub: { fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
  loader: { justifyContent: 'center', alignItems: 'center', zIndex: 10, backgroundColor: '#0f172a' },
  legendOverlay: { position: 'absolute', bottom: 16, left: 16, right: 16, padding: 16, borderRadius: 12, borderWidth: 1, opacity: 0.95 },
  legendTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4, width: '30%' },
  colorBox: { width: 14, height: 14, borderRadius: 4 },
  colorPickerContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#333' },
  colorSwatch: { width: 28, height: 28, borderRadius: 14 },
  gradeBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginVertical: 8 },
  gradeSegment: { flex: 1 },
  gradeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  input: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 12 }
});

