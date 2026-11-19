import { create } from 'zustand';
import type {
  CameraPreset3D,
  CrossSection3D,
  Function2D,
  Plane3D,
  Point2D,
  Point3D,
  Polyhedron3D,
  Scene2DState,
  Scene3DState,
  SceneSnapshot,
  SelectedItem,
  Solid3D,
  Tool2D,
  Tool3D,
  Vec2,
  Vec3,
  ViewMode,
  ViewSettings,
} from '../types/geometry';
import { EMPTY_SCENE_2D, EMPTY_SCENE_3D, THPT_PRESETS } from '../presets/thptPresets';
import { parseSmartInput } from '../math/parser';
import { formatNum, lineFrom2Points2D, resolvePoints2D } from '../math/geometry2d';
import {
  formatPlaneEq,
  intersectTwoPlanes,
  planeFrom3Points,
  resolvePlaneEq,
  resolvePoints3D,
  sub3,
} from '../math/geometry3d';

const PALETTE = ['#1D5CE5', '#0E9F6E', '#E06D1F', '#7C3AED', '#DB2777', '#0891B2', '#D93829'];

let idCounter = 100;
function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

function nextPointName(existing: Array<{ name: string }>, preferred = ['A', 'B', 'C', 'D', 'E', 'F', 'M', 'N', 'P', 'Q', 'S', 'H', 'I', 'K']): string {
  const used = new Set(existing.map((p) => p.name));
  for (const ch of preferred) {
    if (!used.has(ch)) return ch;
  }
  let idx = 1;
  while (used.has(`P${idx}`)) idx++;
  return `P${idx}`;
}

function cloneSnapshot(snap: SceneSnapshot): SceneSnapshot {
  return JSON.parse(JSON.stringify(snap));
}

export type QuickSolid3DType =
  | 'pyramid_sa_square'
  | 'pyramid_regular_square'
  | 'tetrahedron_regular'
  | 'prism_tri_standing'
  | 'box'
  | 'cube'
  | 'cone'
  | 'cylinder'
  | 'sphere';

interface GeometryStore {
  mode: ViewMode;
  activeTool2D: Tool2D;
  activeTool3D: Tool3D;
  pendingIds: string[];
  selection: SelectedItem[];
  sliders: SceneSnapshot['sliders'];
  scene2d: Scene2DState;
  scene3d: Scene3DState;
  view: ViewSettings;
  cameraRequest: { preset: CameraPreset3D; nonce: number } | null;
  toast: { text: string; tone: 'info' | 'success' | 'error' } | null;
  activePresetId: string | null;
  sidebarOpen: boolean;

  past: SceneSnapshot[];
  future: SceneSnapshot[];

  // Actions
  setMode: (mode: ViewMode) => void;
  setTool2D: (tool: Tool2D) => void;
  setTool3D: (tool: Tool3D) => void;
  setSidebarOpen: (open: boolean) => void;
  updateView: (partial: Partial<ViewSettings>) => void;
  requestCamera: (preset: CameraPreset3D) => void;
  showToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
  clearToast: () => void;

  // Selection
  selectItem: (item: SelectedItem, multi?: boolean) => void;
  clearSelection: () => void;

  // History
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Presets & Reset
  loadPreset: (presetId: string) => void;
  clearScene: (target?: 'all' | '2d' | '3d') => void;
  exportJSON: () => string;
  importJSON: (json: string) => void;

  // Sliders
  setSliderValue: (id: string, value: number) => void;
  toggleSliderPlay: (id: string) => void;
  addSlider: (name: string, value?: number, min?: number, max?: number) => void;
  removeSlider: (id: string) => void;

  // Smart Input
  executeSmartInput: (raw: string) => void;

  // 2D Interactive Operations
  addPoint2D: (x: number, y: number, name?: string) => string;
  movePoint2D: (id: string, x: number, y: number) => void;
  handleCanvas2DClick: (worldPos: Vec2, hitPointId?: string, hitLineId?: string) => void;
  addSpecialTriangleCenter2D: (kind: 'centroid' | 'orthocenter' | 'circumcenter' | 'incenter', pIds: [string, string, string]) => void;
  toggleFunctionIntegral: (funcId: string, patch: Partial<NonNullable<Function2D['integral']>>) => void;
  revolveFunctionTo3D: (funcId: string) => void;

  // 3D Interactive Operations
  addPoint3D: (x: number, y: number, z: number, name?: string) => string;
  updatePoint3DCoords: (id: string, coords: Vec3) => void;
  handlePoint3DClick: (pointId: string, multi?: boolean) => void;
  addQuickSolid3D: (kind: QuickSolid3DType, params: { a?: number; b?: number; h?: number; r?: number; cx?: number; cy?: number; cz?: number }) => void;
  addPlane3DFromEq: (a: number, b: number, c: number, d: number, name?: string) => void;
  addLine3DFromPointDir: (point: Vec3, dir: Vec3, name?: string) => void;

  // Contextual High-Level Constructions (1-Click Vietnamese Math Actions!)
  createSegmentFromSelection: (domain: '2d' | '3d') => void;
  createLineFromSelection: (domain: '2d' | '3d') => void;
  createVectorFromSelection: (domain: '2d' | '3d') => void;
  createMidpointFromSelection: (domain: '2d' | '3d') => void;
  createRatioPointFromSelection: (domain: '2d' | '3d', k: number) => void;
  createPlaneFrom3SelectedPoints: () => void;
  createCrossSectionFromSelection: () => void;
  createFootOnPlaneFromSelection: () => void;
  createReflectAcrossPlaneFromSelection: () => void;
  createDistanceMeasureFromSelection: (domain: '2d' | '3d') => void;
  createAngleMeasureFromSelection: (domain: '2d' | '3d') => void;
  createPlanesIntersectionFromSelection: () => void;
  createPolygon2DFromSelection: () => void;
  createCircle2DFromSelection: () => void;

  // Toggle visibility / color / delete
  toggleVisibility: (domain: '2d' | '3d', type: SelectedItem['type'], id: string) => void;
  setObjectColor: (domain: '2d' | '3d', type: SelectedItem['type'], id: string, color: string) => void;
  deleteObject: (domain: '2d' | '3d', type: SelectedItem['type'], id: string) => void;
  toggleSegment3DStyle: (id: string) => void;
}

const initialEmptySnap = cloneSnapshot({
  sliders: [],
  scene2d: EMPTY_SCENE_2D,
  scene3d: EMPTY_SCENE_3D,
});

export const useGeometryStore = create<GeometryStore>((set, get) => ({
  mode: '3d',
  activeTool2D: 'select',
  activeTool3D: 'select',
  pendingIds: [],
  selection: [],
  sliders: initialEmptySnap.sliders,
  scene2d: initialEmptySnap.scene2d,
  scene3d: initialEmptySnap.scene3d,
  view: {
    showAxes: false,
    showGrid: false,
    showLabels: true,
    snapToGrid: true,
    autoDashedHiddenEdges: true,
    globalFaceOpacity: 0.16,
    showOxyPlane3D: false,
    theme: 'light',
  },
  cameraRequest: null,
  toast: null,
  activePresetId: null,
  sidebarOpen: true,
  past: [],
  future: [],

  setMode: (mode) => set({ mode, pendingIds: [] }),
  setTool2D: (tool) => set({ activeTool2D: tool, pendingIds: [] }),
  setTool3D: (tool) => set({ activeTool3D: tool, pendingIds: [] }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  updateView: (partial) => set((s) => ({ view: { ...s.view, ...partial } })),
  requestCamera: (preset) => set({ cameraRequest: { preset, nonce: Date.now() } }),
  showToast: (text, tone = 'info') => set({ toast: { text, tone } }),
  clearToast: () => set({ toast: null }),

  selectItem: (item, multi = false) =>
    set((s) => {
      const exists = s.selection.some((x) => x.domain === item.domain && x.type === item.type && x.id === item.id);
      if (multi) {
        return {
          selection: exists
            ? s.selection.filter((x) => !(x.domain === item.domain && x.type === item.type && x.id === item.id))
            : [...s.selection, item],
        };
      }
      return { selection: [item] };
    }),
  clearSelection: () => set({ selection: [], pendingIds: [] }),

  pushHistory: () => {
    const { sliders, scene2d, scene3d, past } = get();
    const snap = cloneSnapshot({ sliders, scene2d, scene3d });
    set({ past: [...past.slice(-29), snap], future: [] });
  },

  undo: () => {
    const { past, future, sliders, scene2d, scene3d } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    const current = cloneSnapshot({ sliders, scene2d, scene3d });
    set({
      sliders: prev.sliders,
      scene2d: prev.scene2d,
      scene3d: prev.scene3d,
      past: past.slice(0, -1),
      future: [current, ...future.slice(0, 29)],
      selection: [],
      pendingIds: [],
    });
  },

  redo: () => {
    const { past, future, sliders, scene2d, scene3d } = get();
    if (future.length === 0) return;
    const next = future[0];
    const current = cloneSnapshot({ sliders, scene2d, scene3d });
    set({
      sliders: next.sliders,
      scene2d: next.scene2d,
      scene3d: next.scene3d,
      past: [...past, current],
      future: future.slice(1),
      selection: [],
      pendingIds: [],
    });
  },

  loadPreset: (presetId) => {
    const preset = THPT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    get().pushHistory();
    const snap = preset.build();
    const needsCoords = preset.grade === 10 || preset.grade === 12;
    set((s) => ({
      mode: preset.mode,
      sliders: snap.sliders,
      scene2d: snap.scene2d,
      scene3d: snap.scene3d,
      view: {
        ...s.view,
        showAxes: needsCoords,
        showGrid: needsCoords,
        showOxyPlane3D: false,
      },
      selection: [],
      pendingIds: [],
      activeTool2D: 'select',
      activeTool3D: 'select',
      activePresetId: preset.id,
      cameraRequest: { preset: 'oxyz', nonce: Date.now() },
      toast: { text: `Đã mở mẫu: ${preset.title}`, tone: 'success' },
    }));
  },

  clearScene: (target = 'all') => {
    get().pushHistory();
    set((s) => ({
      sliders: target === 'all' ? [] : s.sliders,
      scene2d: target === 'all' || target === '2d' ? cloneSnapshot({ sliders: [], scene2d: EMPTY_SCENE_2D, scene3d: EMPTY_SCENE_3D }).scene2d : s.scene2d,
      scene3d: target === 'all' || target === '3d' ? cloneSnapshot({ sliders: [], scene2d: EMPTY_SCENE_2D, scene3d: EMPTY_SCENE_3D }).scene3d : s.scene3d,
      selection: [],
      pendingIds: [],
      activePresetId: null,
      toast: { text: 'Đã làm sạch bảng vẽ', tone: 'info' },
    }));
  },

  exportJSON: () => {
    const { mode, sliders, scene2d, scene3d } = get();
    return JSON.stringify({ app: 'HinhHocViet', version: 1, mode, sliders, scene2d, scene3d }, null, 2);
  },

  importJSON: (json) => {
    try {
      const data = JSON.parse(json);
      if (!data.scene2d || !data.scene3d) throw new Error('Tệp không đúng định dạng HìnhHọcViệt');
      get().pushHistory();
      set({
        mode: data.mode ?? '3d',
        sliders: data.sliders ?? [],
        scene2d: { ...EMPTY_SCENE_2D, ...data.scene2d },
        scene3d: { ...EMPTY_SCENE_3D, ...data.scene3d },
        selection: [],
        pendingIds: [],
        activePresetId: null,
        toast: { text: 'Đã mở tệp hình vẽ thành công', tone: 'success' },
      });
    } catch (e) {
      set({ toast: { text: (e as Error).message || 'Không thể đọc tệp JSON', tone: 'error' } });
    }
  },

  setSliderValue: (id, value) =>
    set((s) => ({
      sliders: s.sliders.map((sl) => (sl.id === id ? { ...sl, value } : sl)),
    })),

  toggleSliderPlay: (id) =>
    set((s) => ({
      sliders: s.sliders.map((sl) => (sl.id === id ? { ...sl, playing: !sl.playing } : sl)),
    })),

  addSlider: (name, value = 1, min = -5, max = 5) =>
    set((s) => {
      if (s.sliders.some((sl) => sl.name === name)) return s;
      return {
        sliders: [...s.sliders, { id: uid('sl'), name, value, min, max, step: 0.1, playing: false }],
      };
    }),

  removeSlider: (id) =>
    set((s) => ({
      sliders: s.sliders.filter((sl) => sl.id !== id),
    })),

  executeSmartInput: (raw) => {
    const state = get();
    const activeDomain: '2d' | '3d' = state.mode === '2d' ? '2d' : '3d';
    const scope = Object.fromEntries(state.sliders.map((sl) => [sl.name, sl.value]));
    try {
      const cmd = parseSmartInput(raw, activeDomain, scope);
      get().pushHistory();

      const ensureSliders = (names: string[]) => {
        for (const p of names) {
          if (!get().sliders.some((sl) => sl.name === p)) {
            get().addSlider(p, 1, -5, 5);
          }
        }
      };

      switch (cmd.kind) {
        case 'slider': {
          const existing = state.sliders.find((sl) => sl.name === cmd.name);
          if (existing) {
            get().setSliderValue(existing.id, cmd.value);
          } else {
            get().addSlider(cmd.name, cmd.value, Math.min(-5, cmd.value - 5), Math.max(5, cmd.value + 5));
          }
          set({ toast: { text: `Đã tạo thanh trượt tham số ${cmd.name} = ${cmd.value}`, tone: 'success' } });
          return;
        }
        case 'point2d': {
          const name = cmd.name || nextPointName(state.scene2d.points);
          const id = uid('p2');
          set((s) => ({
            mode: s.mode === '3d' ? '2d' : s.mode,
            scene2d: {
              ...s.scene2d,
              points: [...s.scene2d.points, { id, name, x: cmd.coords[0], y: cmd.coords[1], color: '#D93829', visible: true, showLabel: true }],
            },
            toast: { text: `Đã thêm điểm 2D ${name}(${formatNum(cmd.coords[0])}; ${formatNum(cmd.coords[1])})`, tone: 'success' },
          }));
          return;
        }
        case 'point3d': {
          const name = cmd.name || nextPointName(state.scene3d.points);
          const id = uid('p3');
          set((s) => ({
            mode: s.mode === '2d' ? '3d' : s.mode,
            scene3d: {
              ...s.scene3d,
              points: [
                ...s.scene3d.points,
                {
                  id,
                  name,
                  x: cmd.coords[0],
                  y: cmd.coords[1],
                  z: cmd.coords[2],
                  exprCoords: cmd.exprCoords,
                  color: '#D93829',
                  visible: true,
                  showLabel: true,
                },
              ],
            },
            toast: { text: `Đã thêm điểm Oxyz ${name}(${formatNum(cmd.coords[0])}; ${formatNum(cmd.coords[1])}; ${formatNum(cmd.coords[2])})`, tone: 'success' },
          }));
          return;
        }
        case 'vector2d': {
          const name = cmd.name || `u${state.scene2d.vectors.length + 1}`;
          set((s) => ({
            mode: s.mode === '3d' ? '2d' : s.mode,
            scene2d: {
              ...s.scene2d,
              vectors: [...s.scene2d.vectors, { id: uid('v2'), name, origin: [0, 0], dx: cmd.dir[0], dy: cmd.dir[1], color: '#7C3AED', visible: true }],
            },
            toast: { text: `Đã vẽ vectơ 2D ${name}(${formatNum(cmd.dir[0])}; ${formatNum(cmd.dir[1])})`, tone: 'success' },
          }));
          return;
        }
        case 'vector3d': {
          const name = cmd.name || `u${state.scene3d.vectors.length + 1}`;
          set((s) => ({
            mode: s.mode === '2d' ? '3d' : s.mode,
            scene3d: {
              ...s.scene3d,
              vectors: [...s.scene3d.vectors, { id: uid('v3'), name, origin: [0, 0, 0], dir: cmd.dir, color: '#7C3AED', visible: true }],
            },
            toast: { text: `Đã vẽ vectơ Oxyz ${name}(${formatNum(cmd.dir[0])}; ${formatNum(cmd.dir[1])}; ${formatNum(cmd.dir[2])})`, tone: 'success' },
          }));
          return;
        }
        case 'function2d': {
          ensureSliders(cmd.params);
          const color = PALETTE[state.scene2d.functions.length % PALETTE.length];
          const name = cmd.name || `f${state.scene2d.functions.length + 1}(x)`;
          set((s) => ({
            mode: s.mode === '3d' ? '2d' : s.mode,
            scene2d: {
              ...s.scene2d,
              functions: [
                ...s.scene2d.functions,
                { id: uid('fn'), name, expr: cmd.expr, color, visible: true, showExtrema: true, showAsymptotes: true, showRoots: false },
              ],
            },
            toast: {
              text: cmd.params.length
                ? `Đã vẽ đồ thị y = ${cmd.expr} và tự tạo thanh trượt ${cmd.params.join(', ')}`
                : `Đã vẽ đồ thị y = ${cmd.expr}`,
              tone: 'success',
            },
          }));
          return;
        }
        case 'surface3d': {
          ensureSliders(cmd.params);
          const color = PALETTE[state.scene3d.surfaces.length % PALETTE.length];
          set((s) => ({
            mode: s.mode === '2d' ? '3d' : s.mode,
            scene3d: {
              ...s.scene3d,
              surfaces: [
                ...s.scene3d.surfaces,
                { id: uid('sf'), name: cmd.name || `z = ${cmd.expr}`, expr: cmd.expr, range: [-4, 4], color, opacity: 0.72, wireframe: true, visible: true },
              ],
            },
            toast: { text: `Đã vẽ mặt cong 3D z = ${cmd.expr}`, tone: 'success' },
          }));
          return;
        }
        case 'line2d': {
          const color = PALETTE[state.scene2d.lines.length % PALETTE.length];
          set((s) => ({
            mode: s.mode === '3d' ? '2d' : s.mode,
            scene2d: {
              ...s.scene2d,
              lines: [...s.scene2d.lines, { id: uid('l2'), name: cmd.name || `d${s.scene2d.lines.length + 1}`, a: cmd.a, b: cmd.b, c: cmd.c, color, visible: true }],
            },
            toast: { text: 'Đã vẽ đường thẳng 2D', tone: 'success' },
          }));
          return;
        }
        case 'inequality2d': {
          const color = PALETTE[state.scene2d.inequalities.length % PALETTE.length];
          set((s) => ({
            mode: s.mode === '3d' ? '2d' : s.mode,
            scene2d: {
              ...s.scene2d,
              inequalities: [
                ...s.scene2d.inequalities,
                { id: uid('iq'), name: raw.trim(), a: cmd.a, b: cmd.b, c: cmd.c, op: cmd.op, color, visible: true },
              ],
            },
            toast: { text: `Đã tô miền nghiệm: ${raw.trim()}`, tone: 'success' },
          }));
          return;
        }
        case 'plane3d': {
          const color = PALETTE[(state.scene3d.planes.length + 1) % PALETTE.length];
          const eqStr = formatPlaneEq({ a: cmd.a, b: cmd.b, c: cmd.c, d: cmd.d });
          set((s) => ({
            mode: s.mode === '2d' ? '3d' : s.mode,
            scene3d: {
              ...s.scene3d,
              planes: [
                ...s.scene3d.planes,
                {
                  id: uid('pl'),
                  name: cmd.name ? `(${cmd.name})` : `(P${s.scene3d.planes.length + 1})`,
                  a: cmd.a,
                  b: cmd.b,
                  c: cmd.c,
                  d: cmd.d,
                  color,
                  opacity: 0.24,
                  showNormal: true,
                  visible: true,
                  size: 6,
                },
              ],
            },
            toast: { text: `Đã dựng mặt phẳng ${eqStr}`, tone: 'success' },
          }));
          return;
        }
        case 'line3d': {
          const color = PALETTE[state.scene3d.lines.length % PALETTE.length];
          set((s) => ({
            mode: s.mode === '2d' ? '3d' : s.mode,
            scene3d: {
              ...s.scene3d,
              lines: [...s.scene3d.lines, { id: uid('l3'), name: cmd.name || `d${s.scene3d.lines.length + 1}`, point: cmd.point, dir: cmd.dir, color, visible: true }],
            },
            toast: { text: 'Đã vẽ đường thẳng Oxyz', tone: 'success' },
          }));
          return;
        }
        case 'circle2d': {
          const color = PALETTE[state.scene2d.circles.length % PALETTE.length];
          set((s) => ({
            mode: s.mode === '3d' ? '2d' : s.mode,
            scene2d: {
              ...s.scene2d,
              circles: [
                ...s.scene2d.circles,
                { id: uid('c2'), name: cmd.name || `(C${s.scene2d.circles.length + 1})`, center: cmd.center, radius: cmd.radius, color, fillOpacity: 0.08, visible: true },
              ],
            },
            toast: { text: `Đã vẽ đường tròn tâm (${formatNum(cmd.center[0])}; ${formatNum(cmd.center[1])}), R = ${formatNum(cmd.radius)}`, tone: 'success' },
          }));
          return;
        }
        case 'sphere3d': {
          const color = PALETTE[state.scene3d.solids.length % PALETTE.length];
          set((s) => ({
            mode: s.mode === '2d' ? '3d' : s.mode,
            scene3d: {
              ...s.scene3d,
              solids: [
                ...s.scene3d.solids,
                {
                  id: uid('sp'),
                  name: cmd.name ? `(${cmd.name})` : `Mặt cầu (S${s.scene3d.solids.length + 1})`,
                  kind: 'sphere',
                  center: cmd.center,
                  radius: cmd.radius,
                  color,
                  opacity: 0.25,
                  showAxes: true,
                  visible: true,
                },
              ],
            },
            toast: {
              text: `Đã dựng mặt cầu tâm (${formatNum(cmd.center[0])}; ${formatNum(cmd.center[1])}; ${formatNum(cmd.center[2])}), R = ${formatNum(cmd.radius)}`,
              tone: 'success',
            },
          }));
          return;
        }
        case 'conic2d': {
          const color = PALETTE[state.scene2d.conics.length % PALETTE.length];
          const labelVi = cmd.conicType === 'ellipse' ? 'Elip' : cmd.conicType === 'hyperbola' ? 'Hypebol' : 'Parabol';
          set((s) => ({
            mode: s.mode === '3d' ? '2d' : s.mode,
            scene2d: {
              ...s.scene2d,
              conics: [
                ...s.scene2d.conics,
                {
                  id: uid('cn'),
                  name: cmd.name || `${labelVi} (${s.scene2d.conics.length + 1})`,
                  conicType: cmd.conicType,
                  h: cmd.h,
                  k: cmd.k,
                  a: cmd.a,
                  b: cmd.b,
                  p: cmd.p,
                  color,
                  showFoci: true,
                  visible: true,
                },
              ],
            },
            toast: { text: `Đã vẽ đường ${labelVi}`, tone: 'success' },
          }));
          return;
        }
        case 'viCommand': {
          // Resolve point names in current domain
          const findPt3 = (nm: string) => state.scene3d.points.find((p) => p.name.toLowerCase() === nm.toLowerCase());
          const findPt2 = (nm: string) => state.scene2d.points.find((p) => p.name.toLowerCase() === nm.toLowerCase());

          if (activeDomain === '3d') {
            const pts = cmd.targets.map(findPt3).filter((p): p is Point3D => Boolean(p));
            if (cmd.action === 'midpoint' && pts.length >= 2) {
              set({ selection: pts.slice(0, 2).map((p) => ({ domain: '3d', type: 'point', id: p.id })) });
              get().createMidpointFromSelection('3d');
              return;
            }
            if (cmd.action === 'segment' && pts.length >= 2) {
              set({ selection: pts.slice(0, 2).map((p) => ({ domain: '3d', type: 'point', id: p.id })) });
              get().createSegmentFromSelection('3d');
              return;
            }
            if (cmd.action === 'vector' && pts.length >= 2) {
              set({ selection: pts.slice(0, 2).map((p) => ({ domain: '3d', type: 'point', id: p.id })) });
              get().createVectorFromSelection('3d');
              return;
            }
            if (cmd.action === 'plane' && pts.length >= 3) {
              set({ selection: pts.slice(0, 3).map((p) => ({ domain: '3d', type: 'point', id: p.id })) });
              get().createPlaneFrom3SelectedPoints();
              return;
            }
            if (cmd.action === 'crossSection' && pts.length >= 3) {
              set({ selection: pts.slice(0, 3).map((p) => ({ domain: '3d', type: 'point', id: p.id })) });
              get().createCrossSectionFromSelection();
              return;
            }
            if (cmd.action === 'distance' && pts.length >= 2) {
              set({ selection: pts.slice(0, 2).map((p) => ({ domain: '3d', type: 'point', id: p.id })) });
              get().createDistanceMeasureFromSelection('3d');
              return;
            }
            throw new Error(`Không tìm thấy đủ các điểm (${cmd.targets.join(', ')}) trong không gian 3D`);
          } else {
            const pts = cmd.targets.map(findPt2).filter((p): p is Point2D => Boolean(p));
            if (cmd.action === 'midpoint' && pts.length >= 2) {
              set({ selection: pts.slice(0, 2).map((p) => ({ domain: '2d', type: 'point', id: p.id })) });
              get().createMidpointFromSelection('2d');
              return;
            }
            if (cmd.action === 'segment' && pts.length >= 2) {
              set({ selection: pts.slice(0, 2).map((p) => ({ domain: '2d', type: 'point', id: p.id })) });
              get().createSegmentFromSelection('2d');
              return;
            }
            if (cmd.action === 'vector' && pts.length >= 2) {
              set({ selection: pts.slice(0, 2).map((p) => ({ domain: '2d', type: 'point', id: p.id })) });
              get().createVectorFromSelection('2d');
              return;
            }
            if (cmd.action === 'distance' && pts.length >= 2) {
              set({ selection: pts.slice(0, 2).map((p) => ({ domain: '2d', type: 'point', id: p.id })) });
              get().createDistanceMeasureFromSelection('2d');
              return;
            }
            throw new Error(`Không tìm thấy đủ các điểm (${cmd.targets.join(', ')}) trên mặt phẳng 2D`);
          }
        }
      }
    } catch (e) {
      set({ toast: { text: (e as Error).message || 'Biểu thức chưa hợp lệ', tone: 'error' } });
    }
  },

  // ==================== 2D INTERACTIVE OPERATIONS ====================

  addPoint2D: (x, y, name) => {
    const id = uid('p2');
    const ptName = name || nextPointName(get().scene2d.points);
    get().pushHistory();
    set((s) => ({
      scene2d: {
        ...s.scene2d,
        points: [...s.scene2d.points, { id, name: ptName, x, y, color: '#D93829', visible: true, showLabel: true }],
      },
    }));
    return id;
  },

  movePoint2D: (id, x, y) =>
    set((s) => ({
      scene2d: {
        ...s.scene2d,
        points: s.scene2d.points.map((p) => (p.id === id && !p.computed ? { ...p, x, y } : p)),
      },
    })),

  handleCanvas2DClick: (worldPos, hitPointId, hitLineId) => {
    const { activeTool2D, pendingIds, scene2d } = get();

    const ensurePoint = (): string => {
      if (hitPointId) return hitPointId;
      return get().addPoint2D(worldPos[0], worldPos[1]);
    };

    if (activeTool2D === 'select') {
      if (hitPointId) {
        get().selectItem({ domain: '2d', type: 'point', id: hitPointId }, false);
      } else if (hitLineId) {
        get().selectItem({ domain: '2d', type: 'line', id: hitLineId }, false);
      } else {
        set({ selection: [] });
      }
      return;
    }

    if (activeTool2D === 'point') {
      const id = get().addPoint2D(worldPos[0], worldPos[1]);
      set({ selection: [{ domain: '2d', type: 'point', id }] });
      return;
    }

    if (
      activeTool2D === 'segment' ||
      activeTool2D === 'line' ||
      activeTool2D === 'vector' ||
      activeTool2D === 'circle' ||
      activeTool2D === 'midpoint' ||
      activeTool2D === 'distance'
    ) {
      const pid = ensurePoint();
      if (pendingIds.length === 0) {
        set({ pendingIds: [pid] });
      } else if (pendingIds[0] !== pid) {
        const p1 = pendingIds[0];
        const p2 = pid;
        set({ pendingIds: [], selection: [{ domain: '2d', type: 'point', id: p1 }, { domain: '2d', type: 'point', id: p2 }] });
        if (activeTool2D === 'segment') get().createSegmentFromSelection('2d');
        if (activeTool2D === 'line') get().createLineFromSelection('2d');
        if (activeTool2D === 'vector') get().createVectorFromSelection('2d');
        if (activeTool2D === 'circle') get().createCircle2DFromSelection();
        if (activeTool2D === 'midpoint') get().createMidpointFromSelection('2d');
        if (activeTool2D === 'distance') get().createDistanceMeasureFromSelection('2d');
      }
      return;
    }

    if (activeTool2D === 'angle') {
      const pid = ensurePoint();
      const next = [...pendingIds, pid];
      if (next.length < 3) {
        set({ pendingIds: next });
      } else {
        set({
          pendingIds: [],
          selection: next.map((id) => ({ domain: '2d' as const, type: 'point' as const, id })),
        });
        get().createAngleMeasureFromSelection('2d');
      }
      return;
    }

    if (activeTool2D === 'polygon') {
      if (pendingIds.length >= 3 && hitPointId === pendingIds[0]) {
        // Close polygon
        set({
          pendingIds: [],
          selection: pendingIds.map((id) => ({ domain: '2d' as const, type: 'point' as const, id })),
        });
        get().createPolygon2DFromSelection();
      } else {
        const pid = ensurePoint();
        if (!pendingIds.includes(pid)) {
          set({ pendingIds: [...pendingIds, pid] });
        }
      }
      return;
    }

    if (activeTool2D === 'perpendicular') {
      if (hitPointId && pendingIds.length === 0) {
        set({ pendingIds: [hitPointId] });
      } else if (hitLineId && pendingIds.length === 1) {
        const ptId = pendingIds[0];
        const pt = scene2d.points.find((p) => p.id === ptId);
        const line = scene2d.lines.find((l) => l.id === hitLineId);
        if (pt && line) {
          get().pushHistory();
          const ptMap = resolvePoints2D(scene2d.points, scene2d.lines);
          const p = ptMap.get(ptId) ?? [pt.x, pt.y];
          // Perpendicular to ax + by + c = 0 has normal (-b, a)
          const A = -line.b;
          const B = line.a;
          const C = -(A * p[0] + B * p[1]);
          const footId = uid('p2');
          set((s) => ({
            pendingIds: [],
            scene2d: {
              ...s.scene2d,
              lines: [...s.scene2d.lines, { id: uid('l2'), name: `⊥ ${line.name}`, a: A, b: B, c: C, color: '#7C3AED', dashed: true, visible: true }],
              points: [
                ...s.scene2d.points,
                { id: footId, name: nextPointName(s.scene2d.points, ['H', 'K', 'E', 'F']), x: p[0], y: p[1], color: '#7C3AED', visible: true, showLabel: true, computed: { kind: 'footLine', refs: [ptId, hitLineId] } },
              ],
            },
            toast: { text: 'Đã dựng đường vuông góc và chân đường vuông góc H', tone: 'success' },
          }));
        }
      }
    }
  },

  addSpecialTriangleCenter2D: (kind, pIds) => {
    const labelMap = {
      centroid: 'G (Trọng tâm)',
      orthocenter: 'H (Trực tâm)',
      circumcenter: 'O (Ngoại tiếp)',
      incenter: 'I (Nội tiếp)',
    };
    const colorMap = {
      centroid: '#1D5CE5',
      orthocenter: '#7C3AED',
      circumcenter: '#0E9F6E',
      incenter: '#E06D1F',
    };
    get().pushHistory();
    const id = uid('p2');
    set((s) => ({
      scene2d: {
        ...s.scene2d,
        points: [
          ...s.scene2d.points,
          { id, name: labelMap[kind], x: 0, y: 0, color: colorMap[kind], visible: true, showLabel: true, computed: { kind, refs: pIds } },
        ],
        circles:
          kind === 'circumcenter'
            ? [
                ...s.scene2d.circles,
                { id: uid('c2'), name: 'Đường tròn ngoại tiếp', centerId: id, center: [0, 0], radius: 1, radiusPointId: pIds[0], color: '#0E9F6E', fillOpacity: 0.05, visible: true },
              ]
            : s.scene2d.circles,
      },
      toast: { text: `Đã dựng ${labelMap[kind]}`, tone: 'success' },
    }));
  },

  toggleFunctionIntegral: (funcId, patch) =>
    set((s) => ({
      scene2d: {
        ...s.scene2d,
        functions: s.scene2d.functions.map((fn) =>
          fn.id === funcId
            ? {
                ...fn,
                integral: {
                  enabled: fn.integral?.enabled ?? true,
                  a: fn.integral?.a ?? 0,
                  b: fn.integral?.b ?? 2,
                  ...fn.integral,
                  ...patch,
                },
              }
            : fn
        ),
      },
    })),

  revolveFunctionTo3D: (funcId) => {
    const fn = get().scene2d.functions.find((f) => f.id === funcId);
    if (!fn) return;
    const a = fn.integral?.a ?? 0;
    const b = fn.integral?.b ?? 3;
    get().pushHistory();
    set((s) => ({
      mode: 'split',
      scene3d: {
        ...s.scene3d,
        solids: [
          ...s.scene3d.solids.filter((so) => so.kind !== 'revolution'),
          {
            id: uid('rev'),
            name: `Khối tròn xoay y = ${fn.expr} [${a}; ${b}]`,
            kind: 'revolution',
            center: [0, 0, 0],
            radius: 1,
            funcExpr: fn.expr,
            domain: [a, b],
            color: fn.color,
            opacity: 0.42,
            showAxes: true,
            visible: true,
          },
        ],
      },
      toast: { text: `Đã quay đồ thị y = ${fn.expr} quanh trục Ox ở khung 3D`, tone: 'success' },
    }));
  },

  // ==================== 3D INTERACTIVE OPERATIONS ====================

  addPoint3D: (x, y, z, name) => {
    const id = uid('p3');
    const ptName = name || nextPointName(get().scene3d.points);
    get().pushHistory();
    set((s) => ({
      scene3d: {
        ...s.scene3d,
        points: [...s.scene3d.points, { id, name: ptName, x, y, z, color: '#D93829', visible: true, showLabel: true }],
      },
    }));
    return id;
  },

  updatePoint3DCoords: (id, [x, y, z]) =>
    set((s) => ({
      scene3d: {
        ...s.scene3d,
        points: s.scene3d.points.map((p) => (p.id === id ? { ...p, x, y, z, exprCoords: undefined } : p)),
      },
    })),

  handlePoint3DClick: (pointId, multi = false) => {
    const { activeTool3D, pendingIds } = get();
    if (activeTool3D === 'select') {
      get().selectItem({ domain: '3d', type: 'point', id: pointId }, multi);
      return;
    }

    if (
      activeTool3D === 'segment' ||
      activeTool3D === 'line' ||
      activeTool3D === 'vector' ||
      activeTool3D === 'midpoint' ||
      activeTool3D === 'ratio' ||
      activeTool3D === 'distance'
    ) {
      if (pendingIds.length === 0) {
        set({ pendingIds: [pointId] });
      } else if (pendingIds[0] !== pointId) {
        const p1 = pendingIds[0];
        const p2 = pointId;
        set({
          pendingIds: [],
          selection: [
            { domain: '3d', type: 'point', id: p1 },
            { domain: '3d', type: 'point', id: p2 },
          ],
        });
        if (activeTool3D === 'segment') get().createSegmentFromSelection('3d');
        if (activeTool3D === 'line') get().createLineFromSelection('3d');
        if (activeTool3D === 'vector') get().createVectorFromSelection('3d');
        if (activeTool3D === 'midpoint') get().createMidpointFromSelection('3d');
        if (activeTool3D === 'ratio') get().createRatioPointFromSelection('3d', 1 / 3);
        if (activeTool3D === 'distance') get().createDistanceMeasureFromSelection('3d');
      }
      return;
    }

    if (activeTool3D === 'plane3p' || activeTool3D === 'crossSection' || activeTool3D === 'angle') {
      if (pendingIds.includes(pointId)) return;
      const next = [...pendingIds, pointId];
      if (next.length < 3) {
        set({ pendingIds: next });
      } else {
        set({
          pendingIds: [],
          selection: next.map((id) => ({ domain: '3d' as const, type: 'point' as const, id })),
        });
        if (activeTool3D === 'plane3p') get().createPlaneFrom3SelectedPoints();
        if (activeTool3D === 'crossSection') get().createCrossSectionFromSelection();
        if (activeTool3D === 'angle') get().createAngleMeasureFromSelection('3d');
      }
    }
  },

  addQuickSolid3D: (kind, params) => {
    get().pushHistory();
    const a = params.a ?? 3;
    const b = params.b ?? 3;
    const h = params.h ?? 3.5;
    const r = params.r ?? 2;
    const cx = params.cx ?? 0;
    const cy = params.cy ?? 0;
    const cz = params.cz ?? 0;

    const addPoly = (
      name: string,
      polyKind: Polyhedron3D['kind'],
      verts: Array<{ name: string; pos: Vec3 }>,
      faceIndices: number[][],
      color: string
    ) => {
      const pts: Point3D[] = verts.map((v) => ({
        id: uid('p3'),
        name: v.name,
        x: v.pos[0],
        y: v.pos[1],
        z: v.pos[2],
        color: '#D93829',
        visible: true,
        showLabel: true,
      }));
      const poly: Polyhedron3D = {
        id: uid('poly'),
        name,
        kind: polyKind,
        vertexIds: pts.map((p) => p.id),
        faces: faceIndices.map((fi) => fi.map((idx) => pts[idx].id)),
        color,
        faceOpacity: get().view.globalFaceOpacity,
        visible: true,
        autoDashed: true,
      };
      set((s) => ({
        mode: s.mode === '2d' ? '3d' : s.mode,
        scene3d: {
          ...s.scene3d,
          points: [...s.scene3d.points, ...pts],
          polyhedra: [...s.scene3d.polyhedra, poly],
        },
        toast: { text: `Đã tạo ${name}`, tone: 'success' },
      }));
    };

    switch (kind) {
      case 'pyramid_sa_square':
        addPoly(
          'Hình chóp S.ABCD (SA ⊥ đáy)',
          'pyramid',
          [
            { name: 'A', pos: [cx, cy, cz] },
            { name: 'B', pos: [cx + a, cy, cz] },
            { name: 'C', pos: [cx + a, cy + b, cz] },
            { name: 'D', pos: [cx, cy + b, cz] },
            { name: 'S', pos: [cx, cy, cz + h] },
          ],
          [
            [0, 3, 2, 1],
            [4, 0, 1],
            [4, 1, 2],
            [4, 2, 3],
            [4, 3, 0],
          ],
          '#1D5CE5'
        );
        return;

      case 'pyramid_regular_square': {
        const ha = a / 2;
        addPoly(
          'Chóp tứ giác đều S.ABCD',
          'pyramid',
          [
            { name: 'A', pos: [cx - ha, cy - ha, cz] },
            { name: 'B', pos: [cx + ha, cy - ha, cz] },
            { name: 'C', pos: [cx + ha, cy + ha, cz] },
            { name: 'D', pos: [cx - ha, cy + ha, cz] },
            { name: 'S', pos: [cx, cy, cz + h] },
          ],
          [
            [0, 3, 2, 1],
            [4, 0, 1],
            [4, 1, 2],
            [4, 2, 3],
            [4, 3, 0],
          ],
          '#1D5CE5'
        );
        return;
      }

      case 'tetrahedron_regular': {
        const R = a / Math.sqrt(3);
        const H = a * Math.sqrt(2 / 3);
        addPoly(
          'Tứ diện đều S.ABC',
          'tetrahedron',
          [
            { name: 'A', pos: [cx + R, cy, cz] },
            { name: 'B', pos: [cx - R / 2, cy + (R * Math.sqrt(3)) / 2, cz] },
            { name: 'C', pos: [cx - R / 2, cy - (R * Math.sqrt(3)) / 2, cz] },
            { name: 'S', pos: [cx, cy, cz + H] },
          ],
          [
            [0, 2, 1],
            [3, 0, 1],
            [3, 1, 2],
            [3, 2, 0],
          ],
          '#0E9F6E'
        );
        return;
      }

      case 'prism_tri_standing': {
        const triH = (a * Math.sqrt(3)) / 2;
        addPoly(
          "Lăng trụ đứng ABC.A'B'C'",
          'prism',
          [
            { name: 'A', pos: [cx, cy, cz] },
            { name: 'B', pos: [cx + a, cy, cz] },
            { name: 'C', pos: [cx + a / 2, cy + triH, cz] },
            { name: "A'", pos: [cx, cy, cz + h] },
            { name: "B'", pos: [cx + a, cy, cz + h] },
            { name: "C'", pos: [cx + a / 2, cy + triH, cz + h] },
          ],
          [
            [0, 2, 1],
            [3, 4, 5],
            [0, 1, 4, 3],
            [1, 2, 5, 4],
            [2, 0, 3, 5],
          ],
          '#0891B2'
        );
        return;
      }

      case 'box':
      case 'cube': {
        const sx = a;
        const sy = kind === 'cube' ? a : b;
        const sz = kind === 'cube' ? a : h;
        addPoly(
          kind === 'cube' ? "Hình lập phương ABCD.A'B'C'D'" : "Hình hộp chữ nhật ABCD.A'B'C'D'",
          'box',
          [
            { name: 'A', pos: [cx, cy, cz] },
            { name: 'B', pos: [cx + sx, cy, cz] },
            { name: 'C', pos: [cx + sx, cy + sy, cz] },
            { name: 'D', pos: [cx, cy + sy, cz] },
            { name: "A'", pos: [cx, cy, cz + sz] },
            { name: "B'", pos: [cx + sx, cy, cz + sz] },
            { name: "C'", pos: [cx + sx, cy + sy, cz + sz] },
            { name: "D'", pos: [cx, cy + sy, cz + sz] },
          ],
          [
            [0, 3, 2, 1],
            [4, 5, 6, 7],
            [0, 1, 5, 4],
            [1, 2, 6, 5],
            [2, 3, 7, 6],
            [3, 0, 4, 7],
          ],
          '#7C3AED'
        );
        return;
      }

      case 'cone':
      case 'cylinder':
      case 'sphere': {
        const label = kind === 'cone' ? 'Hình nón' : kind === 'cylinder' ? 'Hình trụ' : 'Mặt cầu';
        const solid: Solid3D = {
          id: uid('sol'),
          name: `${label} (R=${formatNum(r)}${kind !== 'sphere' ? `, h=${formatNum(h)}` : ''})`,
          kind,
          center: [cx, cy, cz],
          radius: r,
          height: kind === 'sphere' ? undefined : h,
          color: kind === 'cone' ? '#E06D1F' : kind === 'cylinder' ? '#0891B2' : '#1D5CE5',
          opacity: 0.28,
          showAxes: true,
          visible: true,
        };
        set((s) => ({
          mode: s.mode === '2d' ? '3d' : s.mode,
          scene3d: { ...s.scene3d, solids: [...s.scene3d.solids, solid] },
          toast: { text: `Đã tạo ${solid.name}`, tone: 'success' },
        }));
      }
    }
  },

  addPlane3DFromEq: (a, b, c, d, name) => {
    get().pushHistory();
    set((s) => ({
      mode: s.mode === '2d' ? '3d' : s.mode,
      scene3d: {
        ...s.scene3d,
        planes: [
          ...s.scene3d.planes,
          {
            id: uid('pl'),
            name: name || `(P${s.scene3d.planes.length + 1})`,
            a,
            b,
            c,
            d,
            color: PALETTE[(s.scene3d.planes.length + 1) % PALETTE.length],
            opacity: 0.24,
            showNormal: true,
            visible: true,
            size: 6,
          },
        ],
      },
      toast: { text: `Đã tạo mặt phẳng ${formatPlaneEq({ a, b, c, d })}`, tone: 'success' },
    }));
  },

  addLine3DFromPointDir: (point, dir, name) => {
    get().pushHistory();
    set((s) => ({
      mode: s.mode === '2d' ? '3d' : s.mode,
      scene3d: {
        ...s.scene3d,
        lines: [
          ...s.scene3d.lines,
          { id: uid('l3'), name: name || `d${s.scene3d.lines.length + 1}`, point, dir, color: '#1D5CE5', visible: true },
        ],
      },
      toast: { text: 'Đã tạo đường thẳng Oxyz', tone: 'success' },
    }));
  },

  // ==================== CONTEXTUAL CONSTRUCTIONS ====================

  createSegmentFromSelection: (domain) => {
    const pts = get().selection.filter((x) => x.domain === domain && x.type === 'point');
    if (pts.length < 2) return;
    get().pushHistory();
    if (domain === '2d') {
      const p1 = get().scene2d.points.find((p) => p.id === pts[0].id);
      const p2 = get().scene2d.points.find((p) => p.id === pts[1].id);
      if (!p1 || !p2) return;
      set((s) => ({
        scene2d: {
          ...s.scene2d,
          segments: [
            ...s.scene2d.segments,
            { id: uid('s2'), name: `${p1.name}${p2.name}`, p1Id: p1.id, p2Id: p2.id, color: '#0F1B2D', visible: true, showLength: true },
          ],
        },
        toast: { text: `Đã nối đoạn thẳng ${p1.name}${p2.name}`, tone: 'success' },
      }));
    } else {
      const p1 = get().scene3d.points.find((p) => p.id === pts[0].id);
      const p2 = get().scene3d.points.find((p) => p.id === pts[1].id);
      if (!p1 || !p2) return;
      set((s) => ({
        scene3d: {
          ...s.scene3d,
          segments: [
            ...s.scene3d.segments,
            { id: uid('s3'), name: `${p1.name}${p2.name}`, p1Id: p1.id, p2Id: p2.id, color: '#0F1B2D', style: 'solid', visible: true, showLength: true },
          ],
        },
        toast: { text: `Đã nối đoạn thẳng ${p1.name}${p2.name}`, tone: 'success' },
      }));
    }
  },

  createLineFromSelection: (domain) => {
    const pts = get().selection.filter((x) => x.domain === domain && x.type === 'point');
    if (pts.length < 2) return;
    get().pushHistory();
    if (domain === '2d') {
      const ptMap = resolvePoints2D(get().scene2d.points, get().scene2d.lines);
      const p1 = ptMap.get(pts[0].id);
      const p2 = ptMap.get(pts[1].id);
      const n1 = get().scene2d.points.find((p) => p.id === pts[0].id)?.name ?? '';
      const n2 = get().scene2d.points.find((p) => p.id === pts[1].id)?.name ?? '';
      if (!p1 || !p2) return;
      const eq = lineFrom2Points2D(p1, p2);
      set((s) => ({
        scene2d: {
          ...s.scene2d,
          lines: [...s.scene2d.lines, { id: uid('l2'), name: `Đường ${n1}${n2}`, ...eq, p1Id: pts[0].id, p2Id: pts[1].id, color: '#1D5CE5', visible: true }],
        },
        toast: { text: `Đã dựng đường thẳng qua ${n1}, ${n2}`, tone: 'success' },
      }));
    } else {
      const scope = Object.fromEntries(get().sliders.map((sl) => [sl.name, sl.value]));
      const ptMap = resolvePoints3D(get().scene3d.points, get().scene3d.planes, scope);
      const p1 = ptMap.get(pts[0].id);
      const p2 = ptMap.get(pts[1].id);
      const n1 = get().scene3d.points.find((p) => p.id === pts[0].id)?.name ?? '';
      const n2 = get().scene3d.points.find((p) => p.id === pts[1].id)?.name ?? '';
      if (!p1 || !p2) return;
      set((s) => ({
        scene3d: {
          ...s.scene3d,
          lines: [
            ...s.scene3d.lines,
            { id: uid('l3'), name: `Đường ${n1}${n2}`, point: p1, dir: sub3(p2, p1), p1Id: pts[0].id, p2Id: pts[1].id, color: '#1D5CE5', visible: true },
          ],
        },
        toast: { text: `Đã dựng đường thẳng qua ${n1}, ${n2}`, tone: 'success' },
      }));
    }
  },

  createVectorFromSelection: (domain) => {
    const pts = get().selection.filter((x) => x.domain === domain && x.type === 'point');
    if (pts.length < 2) return;
    get().pushHistory();
    if (domain === '2d') {
      const ptMap = resolvePoints2D(get().scene2d.points, get().scene2d.lines);
      const p1 = ptMap.get(pts[0].id);
      const p2 = ptMap.get(pts[1].id);
      const n1 = get().scene2d.points.find((p) => p.id === pts[0].id)?.name ?? '';
      const n2 = get().scene2d.points.find((p) => p.id === pts[1].id)?.name ?? '';
      if (!p1 || !p2) return;
      set((s) => ({
        scene2d: {
          ...s.scene2d,
          vectors: [
            ...s.scene2d.vectors,
            { id: uid('v2'), name: `→${n1}${n2}`, originId: pts[0].id, targetId: pts[1].id, origin: p1, dx: p2[0] - p1[0], dy: p2[1] - p1[1], color: '#7C3AED', visible: true },
          ],
        },
        toast: { text: `Đã dựng vectơ ${n1}${n2}`, tone: 'success' },
      }));
    } else {
      const scope = Object.fromEntries(get().sliders.map((sl) => [sl.name, sl.value]));
      const ptMap = resolvePoints3D(get().scene3d.points, get().scene3d.planes, scope);
      const p1 = ptMap.get(pts[0].id);
      const p2 = ptMap.get(pts[1].id);
      const n1 = get().scene3d.points.find((p) => p.id === pts[0].id)?.name ?? '';
      const n2 = get().scene3d.points.find((p) => p.id === pts[1].id)?.name ?? '';
      if (!p1 || !p2) return;
      set((s) => ({
        scene3d: {
          ...s.scene3d,
          vectors: [
            ...s.scene3d.vectors,
            { id: uid('v3'), name: `→${n1}${n2}`, originId: pts[0].id, targetId: pts[1].id, origin: p1, dir: sub3(p2, p1), color: '#7C3AED', visible: true },
          ],
        },
        toast: { text: `Đã dựng vectơ ${n1}${n2}`, tone: 'success' },
      }));
    }
  },

  createMidpointFromSelection: (domain) => {
    get().createRatioPointFromSelection(domain, 0.5);
  },

  createRatioPointFromSelection: (domain, k) => {
    const pts = get().selection.filter((x) => x.domain === domain && x.type === 'point');
    if (pts.length < 2) return;
    get().pushHistory();
    const isMid = Math.abs(k - 0.5) < 1e-6;
    if (domain === '2d') {
      const name = nextPointName(get().scene2d.points, ['M', 'N', 'P', 'Q', 'I', 'K']);
      const id = uid('p2');
      set((s) => ({
        scene2d: {
          ...s.scene2d,
          points: [
            ...s.scene2d.points,
            { id, name, x: 0, y: 0, color: '#0E9F6E', visible: true, showLabel: true, computed: { kind: isMid ? 'midpoint' : 'ratio', refs: [pts[0].id, pts[1].id], ratio: k } },
          ],
        },
        toast: { text: isMid ? `Đã lấy trung điểm ${name}` : `Đã lấy điểm chia tỉ lệ k = ${formatNum(k)}: ${name}`, tone: 'success' },
      }));
    } else {
      const name = nextPointName(get().scene3d.points, ['M', 'N', 'P', 'Q', 'I', 'K', 'E', 'F']);
      const id = uid('p3');
      set((s) => ({
        scene3d: {
          ...s.scene3d,
          points: [
            ...s.scene3d.points,
            { id, name, x: 0, y: 0, z: 0, color: '#E06D1F', visible: true, showLabel: true, computed: { kind: isMid ? 'midpoint' : 'ratio', refs: [pts[0].id, pts[1].id], ratio: k } },
          ],
        },
        toast: { text: isMid ? `Đã lấy trung điểm ${name}` : `Đã chia đoạn theo tỉ lệ k = ${formatNum(k)}: ${name}`, tone: 'success' },
      }));
    }
  },

  createPlaneFrom3SelectedPoints: () => {
    const pts = get().selection.filter((x) => x.domain === '3d' && x.type === 'point');
    if (pts.length < 3) return;
    const scope = Object.fromEntries(get().sliders.map((sl) => [sl.name, sl.value]));
    const ptMap = resolvePoints3D(get().scene3d.points, get().scene3d.planes, scope);
    const p1 = ptMap.get(pts[0].id);
    const p2 = ptMap.get(pts[1].id);
    const p3 = ptMap.get(pts[2].id);
    if (!p1 || !p2 || !p3) return;
    const eq = planeFrom3Points(p1, p2, p3);
    if (!eq) {
      set({ toast: { text: 'Ba điểm thẳng hàng — không tạo được mặt phẳng', tone: 'error' } });
      return;
    }
    const names = pts.slice(0, 3).map((x) => get().scene3d.points.find((p) => p.id === x.id)?.name ?? '').join('');
    get().pushHistory();
    const plane: Plane3D = {
      id: uid('pl'),
      name: `(${names})`,
      ...eq,
      pointIds: [pts[0].id, pts[1].id, pts[2].id],
      color: PALETTE[(get().scene3d.planes.length + 1) % PALETTE.length],
      opacity: 0.24,
      showNormal: false,
      visible: true,
      size: 5,
    };
    set((s) => ({
      scene3d: { ...s.scene3d, planes: [...s.scene3d.planes, plane] },
      toast: { text: `Đã dựng mặt phẳng ${plane.name}: ${formatPlaneEq(eq)}`, tone: 'success' },
    }));
  },

  createCrossSectionFromSelection: () => {
    const sel = get().selection.filter((x) => x.domain === '3d');
    const pts = sel.filter((x) => x.type === 'point');
    const plSel = sel.find((x) => x.type === 'plane');
    const polySel = sel.find((x) => x.type === 'polyhedron') ?? (get().scene3d.polyhedra[0] ? { id: get().scene3d.polyhedra[0].id } : null);
    if (!polySel) {
      set({ toast: { text: 'Cần có ít nhất 1 khối đa diện (Chóp, Lăng trụ, Lập phương) để cắt thiết diện', tone: 'error' } });
      return;
    }
    if (pts.length < 3 && !plSel) {
      set({ toast: { text: 'Hãy chọn 3 điểm hoặc 1 mặt phẳng để cắt thiết diện', tone: 'error' } });
      return;
    }
    get().pushHistory();
    const cs: CrossSection3D = {
      id: uid('cs'),
      name: plSel
        ? `Thiết diện bởi ${get().scene3d.planes.find((p) => p.id === plSel.id)?.name ?? '(P)'}`
        : `Thiết diện (${pts
            .slice(0, 3)
            .map((x) => get().scene3d.points.find((p) => p.id === x.id)?.name ?? '')
            .join('')})`,
      polyhedronId: polySel.id,
      planeId: plSel?.id,
      pointIds: pts.length >= 3 ? [pts[0].id, pts[1].id, pts[2].id] : undefined,
      color: '#E06D1F',
      opacity: 0.44,
      visible: true,
    };
    set((s) => ({
      scene3d: { ...s.scene3d, crossSections: [...s.scene3d.crossSections, cs] },
      toast: { text: `Đã dựng ${cs.name}`, tone: 'success' },
    }));
  },

  createFootOnPlaneFromSelection: () => {
    const sel = get().selection.filter((x) => x.domain === '3d');
    const pt = sel.find((x) => x.type === 'point');
    const pl = sel.find((x) => x.type === 'plane');
    if (!pt || !pl) return;
    get().pushHistory();
    const ptName = get().scene3d.points.find((p) => p.id === pt.id)?.name ?? 'A';
    const plName = get().scene3d.planes.find((p) => p.id === pl.id)?.name ?? '(P)';
    const hName = nextPointName(get().scene3d.points, ['H', 'K', 'E', 'F']);
    const hId = uid('p3');
    set((s) => ({
      scene3d: {
        ...s.scene3d,
        points: [
          ...s.scene3d.points,
          { id: hId, name: hName, x: 0, y: 0, z: 0, color: '#7C3AED', visible: true, showLabel: true, computed: { kind: 'footPlane', refs: [pt.id, pl.id] } },
        ],
        segments: [
          ...s.scene3d.segments,
          { id: uid('s3'), name: `${ptName}${hName} ⊥ ${plName}`, p1Id: pt.id, p2Id: hId, color: '#7C3AED', style: 'dashed', visible: true, showLength: true },
        ],
      },
      toast: { text: `Đã dựng hình chiếu vuông góc ${hName} của ${ptName} lên ${plName}`, tone: 'success' },
    }));
  },

  createReflectAcrossPlaneFromSelection: () => {
    const sel = get().selection.filter((x) => x.domain === '3d');
    const pt = sel.find((x) => x.type === 'point');
    const pl = sel.find((x) => x.type === 'plane');
    if (!pt || !pl) return;
    get().pushHistory();
    const ptName = get().scene3d.points.find((p) => p.id === pt.id)?.name ?? 'A';
    const rId = uid('p3');
    set((s) => ({
      scene3d: {
        ...s.scene3d,
        points: [
          ...s.scene3d.points,
          { id: rId, name: `${ptName}'`, x: 0, y: 0, z: 0, color: '#DB2777', visible: true, showLabel: true, computed: { kind: 'reflectPlane', refs: [pt.id, pl.id] } },
        ],
        segments: [
          ...s.scene3d.segments,
          { id: uid('s3'), name: `${ptName}${ptName}'`, p1Id: pt.id, p2Id: rId, color: '#DB2777', style: 'dashed', visible: true },
        ],
      },
      toast: { text: `Đã lấy điểm đối xứng ${ptName}' qua mặt phẳng`, tone: 'success' },
    }));
  },

  createDistanceMeasureFromSelection: (domain) => {
    const sel = get().selection.filter((x) => x.domain === domain);
    get().pushHistory();
    if (domain === '2d') {
      const pts = sel.filter((x) => x.type === 'point');
      if (pts.length >= 2) {
        const n1 = get().scene2d.points.find((p) => p.id === pts[0].id)?.name ?? '';
        const n2 = get().scene2d.points.find((p) => p.id === pts[1].id)?.name ?? '';
        set((s) => ({
          scene2d: {
            ...s.scene2d,
            measures: [...s.scene2d.measures, { id: uid('m2'), name: `d(${n1}, ${n2})`, kind: 'distance', refs: [pts[0].id, pts[1].id], color: '#7C3AED', visible: true }],
          },
          toast: { text: `Đã đo khoảng cách ${n1}${n2}`, tone: 'success' },
        }));
      }
      return;
    }

    const pts = sel.filter((x) => x.type === 'point');
    const planes = sel.filter((x) => x.type === 'plane');
    const segsOrLines = sel.filter((x) => x.type === 'segment' || x.type === 'line');

    if (pts.length >= 1 && planes.length >= 1) {
      const pn = get().scene3d.points.find((p) => p.id === pts[0].id)?.name ?? 'A';
      const pln = get().scene3d.planes.find((p) => p.id === planes[0].id)?.name ?? '(P)';
      set((s) => ({
        scene3d: {
          ...s.scene3d,
          measurements: [
            ...s.scene3d.measurements,
            { id: uid('m3'), name: `d(${pn}, ${pln})`, kind: 'distancePPlane', refs: [pts[0].id, planes[0].id], color: '#7C3AED', visible: true },
          ],
        },
        toast: { text: `Đã đo khoảng cách d(${pn}, ${pln})`, tone: 'success' },
      }));
    } else if (segsOrLines.length >= 2) {
      set((s) => ({
        scene3d: {
          ...s.scene3d,
          measurements: [
            ...s.scene3d.measurements,
            { id: uid('m3'), name: 'Khoảng cách 2 đường thẳng', kind: 'distanceSkew', refs: [segsOrLines[0].id, segsOrLines[1].id], color: '#7C3AED', visible: true },
          ],
        },
        toast: { text: 'Đã tính khoảng cách & đoạn vuông góc chung giữa 2 đường thẳng', tone: 'success' },
      }));
    } else if (pts.length >= 2) {
      const n1 = get().scene3d.points.find((p) => p.id === pts[0].id)?.name ?? '';
      const n2 = get().scene3d.points.find((p) => p.id === pts[1].id)?.name ?? '';
      set((s) => ({
        scene3d: {
          ...s.scene3d,
          measurements: [
            ...s.scene3d.measurements,
            { id: uid('m3'), name: `d(${n1}, ${n2})`, kind: 'distancePP', refs: [pts[0].id, pts[1].id], color: '#7C3AED', visible: true },
          ],
        },
        toast: { text: `Đã đo độ dài ${n1}${n2}`, tone: 'success' },
      }));
    }
  },

  createAngleMeasureFromSelection: (domain) => {
    const sel = get().selection.filter((x) => x.domain === domain);
    get().pushHistory();
    if (domain === '2d') {
      const pts = sel.filter((x) => x.type === 'point');
      if (pts.length >= 3) {
        const names = pts.slice(0, 3).map((x) => get().scene2d.points.find((p) => p.id === x.id)?.name ?? '').join('');
        set((s) => ({
          scene2d: {
            ...s.scene2d,
            measures: [...s.scene2d.measures, { id: uid('m2'), name: `∠${names}`, kind: 'angle', refs: [pts[0].id, pts[1].id, pts[2].id], color: '#E06D1F', visible: true }],
          },
          toast: { text: `Đã đo góc ∠${names}`, tone: 'success' },
        }));
      }
      return;
    }

    const pts = sel.filter((x) => x.type === 'point');
    const planes = sel.filter((x) => x.type === 'plane');
    const segsOrLines = sel.filter((x) => x.type === 'segment' || x.type === 'line');

    if (planes.length >= 2) {
      const n1 = get().scene3d.planes.find((p) => p.id === planes[0].id)?.name ?? '(P)';
      const n2 = get().scene3d.planes.find((p) => p.id === planes[1].id)?.name ?? '(Q)';
      set((s) => ({
        scene3d: {
          ...s.scene3d,
          measurements: [
            ...s.scene3d.measurements,
            { id: uid('m3'), name: `∠( ${n1}, ${n2} )`, kind: 'anglePlanePlane', refs: [planes[0].id, planes[1].id], color: '#E06D1F', visible: true },
          ],
        },
        toast: { text: `Đã đo góc giữa 2 mặt phẳng ${n1} và ${n2}`, tone: 'success' },
      }));
    } else if (segsOrLines.length >= 1 && planes.length >= 1) {
      set((s) => ({
        scene3d: {
          ...s.scene3d,
          measurements: [
            ...s.scene3d.measurements,
            { id: uid('m3'), name: 'Góc đường – mặt', kind: 'angleLPlane', refs: [segsOrLines[0].id, planes[0].id], color: '#E06D1F', visible: true },
          ],
        },
        toast: { text: 'Đã đo góc giữa đường thẳng và mặt phẳng', tone: 'success' },
      }));
    } else if (segsOrLines.length >= 2) {
      set((s) => ({
        scene3d: {
          ...s.scene3d,
          measurements: [
            ...s.scene3d.measurements,
            { id: uid('m3'), name: 'Góc 2 đường thẳng', kind: 'angleLL', refs: [segsOrLines[0].id, segsOrLines[1].id], color: '#E06D1F', visible: true },
          ],
        },
        toast: { text: 'Đã đo góc giữa 2 đường thẳng', tone: 'success' },
      }));
    } else if (pts.length >= 3) {
      const names = pts.slice(0, 3).map((x) => get().scene3d.points.find((p) => p.id === x.id)?.name ?? '').join('');
      set((s) => ({
        scene3d: {
          ...s.scene3d,
          measurements: [
            ...s.scene3d.measurements,
            { id: uid('m3'), name: `∠${names}`, kind: 'angle3P', refs: [pts[0].id, pts[1].id, pts[2].id], color: '#E06D1F', visible: true },
          ],
        },
        toast: { text: `Đã đo góc ∠${names}`, tone: 'success' },
      }));
    }
  },

  createPlanesIntersectionFromSelection: () => {
    const planes = get().selection.filter((x) => x.domain === '3d' && x.type === 'plane');
    if (planes.length < 2) return;
    const scope = Object.fromEntries(get().sliders.map((sl) => [sl.name, sl.value]));
    const ptMap = resolvePoints3D(get().scene3d.points, get().scene3d.planes, scope);
    const p1 = get().scene3d.planes.find((p) => p.id === planes[0].id);
    const p2 = get().scene3d.planes.find((p) => p.id === planes[1].id);
    if (!p1 || !p2) return;
    const eq1 = resolvePlaneEq(p1, ptMap);
    const eq2 = resolvePlaneEq(p2, ptMap);
    if (!eq1 || !eq2) return;
    const inter = intersectTwoPlanes(eq1, eq2);
    if (!inter) {
      set({ toast: { text: 'Hai mặt phẳng song song hoặc trùng nhau — không có giao tuyến', tone: 'error' } });
      return;
    }
    get().pushHistory();
    set((s) => ({
      scene3d: {
        ...s.scene3d,
        lines: [
          ...s.scene3d.lines,
          { id: uid('l3'), name: `Giao tuyến ${p1.name}∩${p2.name}`, point: inter.point, dir: inter.dir, color: '#E06D1F', visible: true },
        ],
      },
      toast: { text: `Đã dựng giao tuyến ${p1.name} ∩ ${p2.name}`, tone: 'success' },
    }));
  },

  createPolygon2DFromSelection: () => {
    const pts = get().selection.filter((x) => x.domain === '2d' && x.type === 'point');
    if (pts.length < 3) return;
    get().pushHistory();
    const names = pts.map((x) => get().scene2d.points.find((p) => p.id === x.id)?.name ?? '').join('');
    set((s) => ({
      scene2d: {
        ...s.scene2d,
        polygons: [
          ...s.scene2d.polygons,
          { id: uid('pg2'), name: `Đa giác ${names}`, pointIds: pts.map((p) => p.id), color: '#1D5CE5', fillOpacity: 0.12, visible: true, showArea: true },
        ],
      },
      toast: { text: `Đã tạo đa giác ${names}`, tone: 'success' },
    }));
  },

  createCircle2DFromSelection: () => {
    const pts = get().selection.filter((x) => x.domain === '2d' && x.type === 'point');
    if (pts.length < 2) return;
    get().pushHistory();
    const cName = get().scene2d.points.find((p) => p.id === pts[0].id)?.name ?? 'O';
    set((s) => ({
      scene2d: {
        ...s.scene2d,
        circles: [
          ...s.scene2d.circles,
          { id: uid('c2'), name: `Đường tròn (${cName})`, centerId: pts[0].id, center: [0, 0], radius: 2, radiusPointId: pts[1].id, color: '#0E9F6E', fillOpacity: 0.06, visible: true },
        ],
      },
      toast: { text: `Đã vẽ đường tròn tâm ${cName}`, tone: 'success' },
    }));
  },

  // ==================== GENERIC VISIBILITY / COLOR / DELETE ====================

  toggleVisibility: (domain, type, id) => {
    const mapKey = (t: SelectedItem['type']) => {
      switch (t) {
        case 'point': return 'points';
        case 'segment': return 'segments';
        case 'line': return 'lines';
        case 'vector': return 'vectors';
        case 'circle': return 'circles';
        case 'conic': return 'conics';
        case 'polygon': return 'polygons';
        case 'function': return 'functions';
        case 'inequality': return 'inequalities';
        case 'plane': return 'planes';
        case 'polyhedron': return 'polyhedra';
        case 'solid': return 'solids';
        case 'surface': return 'surfaces';
        case 'crossSection': return 'crossSections';
        case 'measurement': return domain === '2d' ? 'measures' : 'measurements';
      }
    };
    const key = mapKey(type);
    set((s) => {
      if (domain === '2d') {
        const list = (s.scene2d as unknown as Record<string, Array<{ id: string; visible: boolean }>>)[key];
        if (!list) return s;
        return { scene2d: { ...s.scene2d, [key]: list.map((it) => (it.id === id ? { ...it, visible: !it.visible } : it)) } };
      } else {
        const list = (s.scene3d as unknown as Record<string, Array<{ id: string; visible: boolean }>>)[key];
        if (!list) return s;
        return { scene3d: { ...s.scene3d, [key]: list.map((it) => (it.id === id ? { ...it, visible: !it.visible } : it)) } };
      }
    });
  },

  setObjectColor: (domain, type, id, color) => {
    const mapKey = (t: SelectedItem['type']) => {
      switch (t) {
        case 'point': return 'points';
        case 'segment': return 'segments';
        case 'line': return 'lines';
        case 'vector': return 'vectors';
        case 'circle': return 'circles';
        case 'conic': return 'conics';
        case 'polygon': return 'polygons';
        case 'function': return 'functions';
        case 'inequality': return 'inequalities';
        case 'plane': return 'planes';
        case 'polyhedron': return 'polyhedra';
        case 'solid': return 'solids';
        case 'surface': return 'surfaces';
        case 'crossSection': return 'crossSections';
        case 'measurement': return domain === '2d' ? 'measures' : 'measurements';
      }
    };
    const key = mapKey(type);
    set((s) => {
      if (domain === '2d') {
        const list = (s.scene2d as unknown as Record<string, Array<{ id: string; color: string }>>)[key];
        if (!list) return s;
        return { scene2d: { ...s.scene2d, [key]: list.map((it) => (it.id === id ? { ...it, color } : it)) } };
      } else {
        const list = (s.scene3d as unknown as Record<string, Array<{ id: string; color: string }>>)[key];
        if (!list) return s;
        return { scene3d: { ...s.scene3d, [key]: list.map((it) => (it.id === id ? { ...it, color } : it)) } };
      }
    });
  },

  deleteObject: (domain, type, id) => {
    get().pushHistory();
    const mapKey = (t: SelectedItem['type']) => {
      switch (t) {
        case 'point': return 'points';
        case 'segment': return 'segments';
        case 'line': return 'lines';
        case 'vector': return 'vectors';
        case 'circle': return 'circles';
        case 'conic': return 'conics';
        case 'polygon': return 'polygons';
        case 'function': return 'functions';
        case 'inequality': return 'inequalities';
        case 'plane': return 'planes';
        case 'polyhedron': return 'polyhedra';
        case 'solid': return 'solids';
        case 'surface': return 'surfaces';
        case 'crossSection': return 'crossSections';
        case 'measurement': return domain === '2d' ? 'measures' : 'measurements';
      }
    };
    const key = mapKey(type);
    set((s) => {
      const nextSel = s.selection.filter((x) => !(x.domain === domain && x.type === type && x.id === id));
      if (domain === '2d') {
        const list = (s.scene2d as unknown as Record<string, Array<{ id: string }>>)[key];
        if (!list) return s;
        return { selection: nextSel, scene2d: { ...s.scene2d, [key]: list.filter((it) => it.id !== id) } };
      } else {
        const list = (s.scene3d as unknown as Record<string, Array<{ id: string }>>)[key];
        if (!list) return s;
        return { selection: nextSel, scene3d: { ...s.scene3d, [key]: list.filter((it) => it.id !== id) } };
      }
    });
  },

  toggleSegment3DStyle: (id) =>
    set((s) => ({
      scene3d: {
        ...s.scene3d,
        segments: s.scene3d.segments.map((seg) =>
          seg.id === id
            ? { ...seg, style: seg.style === 'solid' ? 'dashed' : seg.style === 'dashed' ? 'auto' : 'solid' }
            : seg
        ),
      },
    })),
}));
