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
  Segment3DSolidMode,
  SelectedItem,
  Solid3D,
  Tool2D,
  Tool3D,
  Vec2,
  Vec3,
  ViewMode,
  ViewSettings,
} from '../types/geometry';
import {
  DEFAULT_SHORTCUTS,
  loadSavedShortcuts,
  saveShortcuts,
  SHORTCUT_META,
  type ShortcutActionId,
  type ShortcutMap,
} from '../types/shortcuts';
import { EMPTY_SCENE_2D, EMPTY_SCENE_3D, THPT_PRESETS } from '../presets/thptPresets';
import { compileExpression, parseSmartInput } from '../math/parser';
import { formatNum, lineFrom2Points2D, resolvePoints2D } from '../math/geometry2d';
import {
  add3,
  centroid3,
  cross3,
  dist3,
  formatPlaneEq,
  intersectTwoPlanes,
  len3,
  normalize3,
  planeFrom3Points,
  resolvePlaneEq,
  resolvePoints3D,
  scale3,
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

export interface Construction3DDragTarget {
  pointIds: string[];
  anchor: Vec3;
  baseZ: number;
  label: 'z' | 'h';
}

interface GeometryStore {
  mode: ViewMode;
  activeTool2D: Tool2D;
  activeTool3D: Tool3D;
  segment3DMode: Segment3DSolidMode;
  pendingIds: string[];
  closedBase3D: string[];
  pendingSegment3DId: string | null;
  selection: SelectedItem[];
  sliders: SceneSnapshot['sliders'];
  scene2d: Scene2DState;
  scene3d: Scene3DState;
  view: ViewSettings;
  cameraRequest: { preset: CameraPreset3D; nonce: number } | null;
  toast: { text: string; tone: 'info' | 'success' | 'error' } | null;
  activePresetId: string | null;
  sidebarOpen: boolean;
  multiSelectMode: boolean;
  pointDragMode3D: 'xy' | 'z';
  shortcuts: ShortcutMap;
  renamingPoint: { domain: '2d' | '3d'; id: string } | null;

  past: SceneSnapshot[];
  future: SceneSnapshot[];

  // Actions
  setMode: (mode: ViewMode) => void;
  setTool2D: (tool: Tool2D) => void;
  setTool3D: (tool: Tool3D) => void;
  setSegment3DMode: (mode: Segment3DSolidMode) => void;
  finishPendingSegment3D: () => void;
  closeBase3DPolygon: () => void;
  applyGeneratedScene: (payload: {
    mode: ViewMode;
    showAxes: boolean;
    snapshot: Partial<SceneSnapshot>;
    summary?: string;
  }) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleMultiSelectMode: () => void;
  setPointDragMode3D: (mode: 'xy' | 'z') => void;
  togglePointDragMode3D: () => void;
  updateView: (partial: Partial<ViewSettings>) => void;
  requestCamera: (preset: CameraPreset3D) => void;
  showToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
  clearToast: () => void;

  // Point renaming & Custom Shortcuts
  openRenamePoint: (domain: '2d' | '3d', id: string) => void;
  closeRenamePoint: () => void;
  renamePoint: (domain: '2d' | '3d', id: string, newName: string) => void;
  setShortcut: (action: ShortcutActionId, keyCombo: string) => void;
  resetShortcuts: () => void;
  deleteSelection: () => void;

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
  toggleFunctionTangent: (funcId: string, patch: Partial<NonNullable<Function2D['tangent']>>) => void;
  toggleFunctionTable: (funcId: string) => void;
  plotFunctionTablePoints2D: (funcId: string, start: number, end: number, step: number) => void;
  revolveFunctionTo3D: (funcId: string) => void;

  // 3D Interactive Operations
  addPoint3D: (x: number, y: number, z: number, name?: string, skipHistory?: boolean) => string;
  updatePoint3DCoords: (id: string, coords: Vec3) => void;
  updatePoints3DZBulk: (updates: Array<{ id: string; z: number }>) => void;
  handlePoint3DClick: (pointId: string, multi?: boolean) => Construction3DDragTarget | null;
  handleGround3DConstructionClick: (coords: Vec3) => Construction3DDragTarget | null;
  buildRegularTetrahedron2Pts: (p1Id: string, p2Id: string) => Construction3DDragTarget | null;
  buildInteractiveTetrahedron3D: (p1Id: string, p2Id: string, p3Id: string, removeSegmentId?: string | null) => Construction3DDragTarget | null;
  buildInteractivePyramid4_3D: (p1Id: string, p2Id: string, apexPos?: Vec3, removeSegmentId?: string | null) => Construction3DDragTarget | null;
  buildPolygonPyramid3D: (baseIds: string[], apexCoords: Vec3, apexPointId?: string) => Construction3DDragTarget | null;
  buildPolygonPrism3D: (baseIds: string[], topCoords: Vec3) => Construction3DDragTarget | null;
  buildInteractiveBox3D: (p1Id: string, p2Id: string, height?: number, removeSegmentId?: string | null) => Construction3DDragTarget | null;
  buildInteractiveBox3DFrom3Points: (
    p1Id: string,
    p2Id: string,
    thirdTarget: { pointId?: string; coords?: Vec3 },
    removeSegmentId?: string | null
  ) => Construction3DDragTarget | null;
  extrudePolyhedronToSolid: (polyId: string, targetKind: 'pyramid' | 'prism', height?: number) => void;
  createNetForPolyhedron: (polyId: string) => void;
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
  createTetrahedronFromSelection: () => void;
  createPyramid4FromSelection: () => void;
  createCubeFromSelection: () => void;
  createBoxFrom3SelectedPoints: () => void;
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
  segment3DMode: 'tetrahedron',
  pendingIds: [],
  closedBase3D: [],
  pendingSegment3DId: null,
  selection: [],
  sliders: initialEmptySnap.sliders,
  scene2d: initialEmptySnap.scene2d,
  scene3d: initialEmptySnap.scene3d,
  view: {
    showAxes: false,
    showGrid: true,
    showLabels: true,
    snapToGrid: true,
    autoDashedHiddenEdges: true,
    globalFaceOpacity: 0.16,
    showOxyPlane3D: true,
    showCoordProjections: true,
    theme: 'light',
  },
  cameraRequest: null,
  toast: null,
  activePresetId: null,
  sidebarOpen:
    typeof window !== 'undefined'
      ? window.innerWidth >= 960 && window.innerHeight >= 540
      : true,
  multiSelectMode: false,
  pointDragMode3D: 'xy',
  shortcuts: loadSavedShortcuts(),
  renamingPoint: null,
  past: [],
  future: [],

  setMode: (mode) => set({ mode, pendingIds: [], closedBase3D: [], pendingSegment3DId: null }),
  setTool2D: (tool) => set({ activeTool2D: tool, pendingIds: [], closedBase3D: [], pendingSegment3DId: null }),
  setTool3D: (tool) => set({ activeTool3D: tool, pendingIds: [], closedBase3D: [], pendingSegment3DId: null }),
  setSegment3DMode: (segment3DMode) =>
    set((s) => ({
      segment3DMode,
      pendingIds: segment3DMode === 'segmentOnly' && s.pendingIds.length >= 2 ? [] : s.pendingIds,
      pendingSegment3DId: segment3DMode === 'segmentOnly' ? null : s.pendingSegment3DId,
    })),
  finishPendingSegment3D: () => set({ pendingIds: [], closedBase3D: [], pendingSegment3DId: null }),
  closeBase3DPolygon: () =>
    set((s) => {
      if (s.pendingIds.length < 3) return s;
      return {
        closedBase3D: [...s.pendingIds],
        pendingIds: [],
        selection: s.pendingIds.map((id) => ({ domain: '3d' as const, type: 'point' as const, id })),
        toast: {
          text:
            s.activeTool3D === 'prism'
              ? 'Đã khép đáy đa giác · Chạm điểm (hoặc giữ kéo lên) để dựng Lăng trụ!'
              : 'Đã khép đáy đa giác · Chạm (hoặc nhấn giữ kéo độ cao) để đặt đỉnh chóp S!',
          tone: 'info',
        },
      };
    }),
  applyGeneratedScene: ({ mode, showAxes, snapshot, summary }) => {
    get().pushHistory();
    set((s) => ({
      mode,
      sliders: snapshot.sliders ?? [],
      scene2d: { ...cloneSnapshot({ sliders: [], scene2d: EMPTY_SCENE_2D, scene3d: EMPTY_SCENE_3D }).scene2d, ...snapshot.scene2d },
      scene3d: { ...cloneSnapshot({ sliders: [], scene2d: EMPTY_SCENE_2D, scene3d: EMPTY_SCENE_3D }).scene3d, ...snapshot.scene3d },
      view: {
        ...s.view,
        showAxes,
        showGrid: true,
        showOxyPlane3D: true,
      },
      selection: [],
      pendingIds: [],
      closedBase3D: [],
      pendingSegment3DId: null,
      activeTool2D: 'select',
      activeTool3D: 'select',
      activePresetId: null,
      cameraRequest: { preset: 'oxyz', nonce: Date.now() },
      toast: { text: summary || 'Đã tự động dựng hình từ đề bài!', tone: 'success' },
    }));
  },
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleMultiSelectMode: () => set((s) => ({ multiSelectMode: !s.multiSelectMode })),
  setPointDragMode3D: (pointDragMode3D) => set({ pointDragMode3D }),
  togglePointDragMode3D: () =>
    set((s) => ({ pointDragMode3D: s.pointDragMode3D === 'xy' ? 'z' : 'xy' })),
  updateView: (partial) => set((s) => ({ view: { ...s.view, ...partial } })),
  requestCamera: (preset) => set({ cameraRequest: { preset, nonce: Date.now() } }),
  showToast: (text, tone = 'info') => set({ toast: { text, tone } }),
  clearToast: () => set({ toast: null }),

  openRenamePoint: (domain, id) => set({ renamingPoint: { domain, id } }),
  closeRenamePoint: () => set({ renamingPoint: null }),

  renamePoint: (domain, id, rawName) => {
    const trimmed = rawName.trim();
    if (!trimmed) {
      set({ toast: { text: 'Tên điểm không được để trống', tone: 'error' } });
      return;
    }
    const state = get();
    if (domain === '2d') {
      const target = state.scene2d.points.find((p) => p.id === id);
      if (!target) return;
      if (target.name === trimmed) {
        set({ renamingPoint: null });
        return;
      }
      const oldName = target.name;
      get().pushHistory();
      set((s) => {
        const nextPoints = s.scene2d.points.map((p) => (p.id === id ? { ...p, name: trimmed } : p));
        const nameById = new Map(nextPoints.map((p) => [p.id, p.name]));
        const nextSegments = s.scene2d.segments.map((seg) => {
          if (seg.p1Id === id || seg.p2Id === id) {
            const oldP1 = seg.p1Id === id ? oldName : nameById.get(seg.p1Id) ?? '';
            const oldP2 = seg.p2Id === id ? oldName : nameById.get(seg.p2Id) ?? '';
            if (seg.name === `${oldP1}${oldP2}`) {
              return { ...seg, name: `${nameById.get(seg.p1Id) ?? ''}${nameById.get(seg.p2Id) ?? ''}` };
            }
          }
          return seg;
        });
        return {
          renamingPoint: null,
          scene2d: { ...s.scene2d, points: nextPoints, segments: nextSegments },
          toast: { text: `Đã đổi tên điểm ${oldName} → ${trimmed}`, tone: 'success' },
        };
      });
    } else {
      const target = state.scene3d.points.find((p) => p.id === id);
      if (!target) return;
      if (target.name === trimmed) {
        set({ renamingPoint: null });
        return;
      }
      const oldName = target.name;
      get().pushHistory();
      set((s) => {
        const nextPoints = s.scene3d.points.map((p) => (p.id === id ? { ...p, name: trimmed } : p));
        const nameById = new Map(nextPoints.map((p) => [p.id, p.name]));
        const nextSegments = s.scene3d.segments.map((seg) => {
          if (seg.p1Id === id || seg.p2Id === id) {
            const oldP1 = seg.p1Id === id ? oldName : nameById.get(seg.p1Id) ?? '';
            const oldP2 = seg.p2Id === id ? oldName : nameById.get(seg.p2Id) ?? '';
            if (seg.name === `${oldP1}${oldP2}`) {
              return { ...seg, name: `${nameById.get(seg.p1Id) ?? ''}${nameById.get(seg.p2Id) ?? ''}` };
            }
          }
          return seg;
        });
        return {
          renamingPoint: null,
          scene3d: { ...s.scene3d, points: nextPoints, segments: nextSegments },
          toast: { text: `Đã đổi tên điểm ${oldName} → ${trimmed}`, tone: 'success' },
        };
      });
    }
  },

  setShortcut: (action, keyCombo) => {
    set((s) => {
      const next: ShortcutMap = { ...s.shortcuts };
      let replacedLabel: string | null = null;
      if (keyCombo) {
        for (const [existingId, existingKey] of Object.entries(next) as Array<[ShortcutActionId, string]>) {
          if (existingId !== action && existingKey === keyCombo) {
            next[existingId] = '';
            replacedLabel = SHORTCUT_META.find((m) => m.id === existingId)?.label ?? existingId;
          }
        }
      }
      next[action] = keyCombo;
      saveShortcuts(next);
      const curLabel = SHORTCUT_META.find((m) => m.id === action)?.label ?? action;
      return {
        shortcuts: next,
        toast: keyCombo
          ? {
              text: replacedLabel
                ? `Đã gán "${keyCombo}" cho ${curLabel} (đã gỡ khỏi "${replacedLabel}")`
                : `Đã đổi phím tắt "${curLabel}" thành ${keyCombo}`,
              tone: 'success',
            }
          : { text: `Đã gỡ phím tắt của "${curLabel}"`, tone: 'info' },
      };
    });
  },

  resetShortcuts: () => {
    const fresh = { ...DEFAULT_SHORTCUTS };
    saveShortcuts(fresh);
    set({
      shortcuts: fresh,
      toast: { text: 'Đã khôi phục toàn bộ phím tắt mặc định', tone: 'success' },
    });
  },

  deleteSelection: () => {
    const sel = get().selection;
    if (sel.length === 0) return;
    get().pushHistory();
    const mapKey = (domain: '2d' | '3d', t: SelectedItem['type']) => {
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
        case 'net': return 'nets';
        case 'curve': return 'curves';
      }
    };
    set((s) => {
      const next2d: Record<string, Array<{ id: string }>> = { ...(s.scene2d as unknown as Record<string, Array<{ id: string }>>) };
      const next3d: Record<string, Array<{ id: string }>> = { ...(s.scene3d as unknown as Record<string, Array<{ id: string }>>) };
      for (const item of sel) {
        const key = mapKey(item.domain, item.type);
        if (item.domain === '2d' && next2d[key]) {
          next2d[key] = next2d[key].filter((x) => x.id !== item.id);
        } else if (item.domain === '3d' && next3d[key]) {
          next3d[key] = next3d[key].filter((x) => x.id !== item.id);
        }
      }
      return {
        selection: [],
        scene2d: next2d as unknown as Scene2DState,
        scene3d: next3d as unknown as Scene3DState,
        toast: { text: `Đã xóa ${sel.length} đối tượng`, tone: 'info' },
      };
    });
  },

  selectItem: (item, multi = false) =>
    set((s) => {
      const useMulti = multi || s.multiSelectMode;
      const exists = s.selection.some((x) => x.domain === item.domain && x.type === item.type && x.id === item.id);
      if (useMulti) {
        return {
          selection: exists
            ? s.selection.filter((x) => !(x.domain === item.domain && x.type === item.type && x.id === item.id))
            : [...s.selection, item],
        };
      }
      const alreadySingle = s.selection.length === 1 && exists;
      return {
        selection: [item],
        pointDragMode3D: alreadySingle ? s.pointDragMode3D : 'xy',
      };
    }),
  clearSelection: () =>
    set({
      selection: [],
      pendingIds: [],
      closedBase3D: [],
      pendingSegment3DId: null,
      pointDragMode3D: 'xy',
    }),

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
      closedBase3D: [],
      pendingSegment3DId: null,
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
      closedBase3D: [],
      pendingSegment3DId: null,
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
        showGrid: true,
        showOxyPlane3D: true,
      },
      selection: [],
      pendingIds: [],
      closedBase3D: [],
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
      closedBase3D: [],
      pendingSegment3DId: null,
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
            scene2d: {
              ...s.scene2d,
              functions: [
                ...s.scene2d.functions,
                { id: uid('fn'), name, expr: cmd.expr, color, visible: true, showExtrema: true, showAsymptotes: true, showRoots: false },
              ],
            },
            scene3d:
              s.mode === '3d' || s.mode === 'split'
                ? {
                    ...s.scene3d,
                    curves: [
                      ...(s.scene3d.curves ?? []),
                      { id: uid('cv3'), name: `y = ${cmd.expr}`, expr: cmd.expr, color, visible: true },
                    ],
                  }
                : s.scene3d,
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

  toggleFunctionTangent: (funcId, patch) =>
    set((s) => ({
      scene2d: {
        ...s.scene2d,
        functions: s.scene2d.functions.map((fn) =>
          fn.id === funcId
            ? {
                ...fn,
                tangent: {
                  enabled: fn.tangent?.enabled ?? true,
                  x0: fn.tangent?.x0 ?? 1,
                  ...fn.tangent,
                  ...patch,
                },
              }
            : fn
        ),
      },
    })),

  toggleFunctionTable: (funcId) =>
    set((s) => ({
      scene2d: {
        ...s.scene2d,
        functions: s.scene2d.functions.map((fn) =>
          fn.id === funcId ? { ...fn, showTable: !fn.showTable } : fn
        ),
      },
    })),

  plotFunctionTablePoints2D: (funcId, start, end, step) => {
    const state = get();
    const fn = state.scene2d.functions.find((f) => f.id === funcId);
    if (!fn || step <= 0.05) return;
    const scope = Object.fromEntries(state.sliders.map((sl) => [sl.name, sl.value]));
    let compiled;
    try {
      compiled = compileExpression(fn.expr);
    } catch {
      return;
    }
    const newPts: Point2D[] = [];
    const existing = [...state.scene2d.points];
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    for (let x = lo; x <= hi + 1e-6 && newPts.length < 21; x += step) {
      const rx = Number(x.toFixed(2));
      const y = compiled.eval({ ...scope, x: rx });
      if (!Number.isFinite(y) || Math.abs(y) > 100) continue;
      const ry = Number(y.toFixed(2));
      const name = nextPointName([...existing, ...newPts], ['M', 'N', 'P', 'Q', 'I', 'K', 'A', 'B', 'C', 'D']);
      newPts.push({ id: uid('p2'), name, x: rx, y: ry, color: fn.color, visible: true, showLabel: true });
    }
    if (newPts.length === 0) return;
    get().pushHistory();
    set((s) => ({
      scene2d: { ...s.scene2d, points: [...s.scene2d.points, ...newPts] },
      toast: { text: `Đã chấm ${newPts.length} tọa độ lên đồ thị ${fn.name}`, tone: 'success' },
    }));
  },

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

  addPoint3D: (x, y, z, name, skipHistory = false) => {
    const id = uid('p3');
    const ptName = name || nextPointName(get().scene3d.points);
    if (!skipHistory) get().pushHistory();
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

  updatePoints3DZBulk: (updates) =>
    set((s) => {
      const zMap = new Map(updates.map((u) => [u.id, u.z]));
      return {
        scene3d: {
          ...s.scene3d,
          points: s.scene3d.points.map((p) => {
            const nextZ = zMap.get(p.id);
            return nextZ !== undefined ? { ...p, z: nextZ, exprCoords: undefined } : p;
          }),
        },
      };
    }),

  buildInteractiveTetrahedron3D: (p1Id, p2Id, p3Id, removeSegmentId = null) => {
    const state = get();
    const scope = Object.fromEntries(state.sliders.map((sl) => [sl.name, sl.value]));
    const ptMap = resolvePoints3D(state.scene3d.points, state.scene3d.planes, scope);
    const p1 = ptMap.get(p1Id);
    const p2 = ptMap.get(p2Id);
    let p3 = ptMap.get(p3Id);
    if (!p1 || !p2 || !p3) return null;

    // Ensure non-collinear base
    let n = cross3(sub3(p2, p1), sub3(p3, p1));
    if (len3(n) < 1e-3) {
      p3 = [p3[0] + 0.5, p3[1] + 1.5, p3[2]];
      get().updatePoint3DCoords(p3Id, p3);
      n = cross3(sub3(p2, p1), sub3(p3, p1));
    }
    if (n[2] < 0) n = scale3(n, -1);
    const unitN = len3(n) > 1e-6 ? normalize3(n) : ([0, 0, 1] as Vec3);

    const avgEdge = (dist3(p1, p2) + dist3(p2, p3) + dist3(p3, p1)) / 3;
    const h = Math.max(2, Math.round(avgEdge * Math.sqrt(2 / 3) * 2) / 2);
    const g = centroid3([p1, p2, p3]);
    const sPos: Vec3 = [
      Number((g[0] + unitN[0] * h).toFixed(2)),
      Number((g[1] + unitN[1] * h).toFixed(2)),
      Number(Math.max(1.5, g[2] + unitN[2] * h).toFixed(2)),
    ];

    const sName = nextPointName(get().scene3d.points, ['S', "S'", 'S1', 'S2', 'D', 'E']);
    const sId = uid('p3');
    const n1 = state.scene3d.points.find((p) => p.id === p1Id)?.name ?? 'A';
    const n2 = state.scene3d.points.find((p) => p.id === p2Id)?.name ?? 'B';
    const n3 = state.scene3d.points.find((p) => p.id === p3Id)?.name ?? 'C';

    // Ensure base face orientation is outward (downward for base when S is above)
    const baseSigned = cross3(sub3(p2, p1), sub3(p3, p1));
    const toS = sub3(sPos, p1);
    const baseFace =
      baseSigned[0] * toS[0] + baseSigned[1] * toS[1] + baseSigned[2] * toS[2] > 0
        ? [p1Id, p3Id, p2Id]
        : [p1Id, p2Id, p3Id];

    const poly: Polyhedron3D = {
      id: uid('poly'),
      name: `Chóp tam giác ${sName}.${n1}${n2}${n3}`,
      kind: 'tetrahedron',
      vertexIds: [p1Id, p2Id, p3Id, sId],
      faces: [
        baseFace,
        [sId, baseFace[0], baseFace[2]],
        [sId, baseFace[2], baseFace[1]],
        [sId, baseFace[1], baseFace[0]],
      ],
      color: '#0E9F6E',
      faceOpacity: state.view.globalFaceOpacity,
      visible: true,
      autoDashed: true,
    };

    set((s) => ({
      pendingIds: [],
      pendingSegment3DId: null,
      selection: [{ domain: '3d', type: 'point', id: sId }],
      scene3d: {
        ...s.scene3d,
        segments: removeSegmentId ? s.scene3d.segments.filter((seg) => seg.id !== removeSegmentId) : s.scene3d.segments,
        points: [
          ...s.scene3d.points,
          { id: sId, name: sName, x: sPos[0], y: sPos[1], z: sPos[2], color: '#D93829', visible: true, showLabel: true },
        ],
        polyhedra: [...s.scene3d.polyhedra, poly],
      },
      toast: { text: `Đã dựng ${poly.name} (nhấn giữ đỉnh ${sName} để kéo cao độ z)`, tone: 'success' },
    }));
    return { pointIds: [sId], anchor: sPos, baseZ: g[2], label: 'z' };
  },

  buildInteractivePyramid4_3D: (p1Id, p2Id, apexPos, removeSegmentId = null) => {
    const state = get();
    const scope = Object.fromEntries(state.sliders.map((sl) => [sl.name, sl.value]));
    const ptMap = resolvePoints3D(state.scene3d.points, state.scene3d.planes, scope);
    const p1 = ptMap.get(p1Id);
    const p2 = ptMap.get(p2Id);
    if (!p1 || !p2) return null;

    const u = sub3(p2, p1);
    const side = Math.max(0.5, len3(u));
    let perp: Vec3 = [-u[1], u[0], 0];
    if (len3(perp) < 1e-4) perp = [0, side, 0];
    else perp = scale3(normalize3(perp), side);

    const snap = (v: number) => Number(v.toFixed(2));
    const p3Coords: Vec3 = [snap(p2[0] + perp[0]), snap(p2[1] + perp[1]), snap(p2[2])];
    const p4Coords: Vec3 = [snap(p1[0] + perp[0]), snap(p1[1] + perp[1]), snap(p1[2])];

    const cName = nextPointName(state.scene3d.points, ['C', 'D', 'E', 'F', 'M', 'N']);
    const ptC: Point3D = {
      id: uid('p3'),
      name: cName,
      x: p3Coords[0],
      y: p3Coords[1],
      z: p3Coords[2],
      color: '#D93829',
      visible: true,
      showLabel: true,
    };
    const dName = nextPointName([...state.scene3d.points, ptC], ['D', 'E', 'F', 'M', 'N', 'P']);
    const ptD: Point3D = {
      id: uid('p3'),
      name: dName,
      x: p4Coords[0],
      y: p4Coords[1],
      z: p4Coords[2],
      color: '#D93829',
      visible: true,
      showLabel: true,
    };
    const sName = nextPointName([...state.scene3d.points, ptC, ptD], ['S', "S'", 'S1', 'S2']);
    const defaultH = Math.max(2.5, Math.round(side * 1.15 * 2) / 2);
    const center = centroid3([p1, p2, p3Coords, p4Coords]);
    const sCoords: Vec3 = apexPos
      ? [
          snap(apexPos[0]),
          snap(apexPos[1]),
          snap(Math.abs(apexPos[2] - p1[2]) < 0.25 ? p1[2] + defaultH : apexPos[2]),
        ]
      : [snap(center[0]), snap(center[1]), snap(p1[2] + defaultH)];

    const ptS: Point3D = {
      id: uid('p3'),
      name: sName,
      x: sCoords[0],
      y: sCoords[1],
      z: sCoords[2],
      color: '#D93829',
      visible: true,
      showLabel: true,
    };

    const n1 = state.scene3d.points.find((p) => p.id === p1Id)?.name ?? 'A';
    const n2 = state.scene3d.points.find((p) => p.id === p2Id)?.name ?? 'B';

    const poly: Polyhedron3D = {
      id: uid('poly'),
      name: `Hình chóp ${sName}.${n1}${n2}${cName}${dName}`,
      kind: 'pyramid',
      vertexIds: [p1Id, p2Id, ptC.id, ptD.id, ptS.id],
      faces: [
        [p1Id, ptD.id, ptC.id, p2Id],
        [ptS.id, p1Id, p2Id],
        [ptS.id, p2Id, ptC.id],
        [ptS.id, ptC.id, ptD.id],
        [ptS.id, ptD.id, p1Id],
      ],
      color: '#1D5CE5',
      faceOpacity: state.view.globalFaceOpacity,
      visible: true,
      autoDashed: true,
    };

    set((s) => ({
      pendingIds: [],
      pendingSegment3DId: null,
      selection: [{ domain: '3d', type: 'point', id: ptS.id }],
      scene3d: {
        ...s.scene3d,
        segments: removeSegmentId ? s.scene3d.segments.filter((seg) => seg.id !== removeSegmentId) : s.scene3d.segments,
        points: [...s.scene3d.points, ptC, ptD, ptS],
        polyhedra: [...s.scene3d.polyhedra, poly],
      },
      toast: { text: `Đã dựng ${poly.name} (nhấn giữ đỉnh ${sName} để kéo cao độ z)`, tone: 'success' },
    }));
    return { pointIds: [ptS.id], anchor: sCoords, baseZ: p1[2], label: 'z' };
  },

  buildInteractiveBox3D: (p1Id, p2Id, height, removeSegmentId = null) => {
    const state = get();
    const scope = Object.fromEntries(state.sliders.map((sl) => [sl.name, sl.value]));
    const ptMap = resolvePoints3D(state.scene3d.points, state.scene3d.planes, scope);
    const p1 = ptMap.get(p1Id);
    const p2 = ptMap.get(p2Id);
    if (!p1 || !p2) return null;

    const u = sub3(p2, p1);
    const side = Math.max(0.5, len3(u));
    let perp: Vec3 = [-u[1], u[0], 0];
    if (len3(perp) < 1e-4) perp = [0, side, 0];
    else perp = scale3(normalize3(perp), side);

    const h = height !== undefined && Math.abs(height) >= 0.5 ? height : Math.max(1.5, Math.round(side * 2) / 2);
    const snap = (v: number) => Number(v.toFixed(2));

    const p3Coords: Vec3 = [snap(p2[0] + perp[0]), snap(p2[1] + perp[1]), snap(p2[2])];
    const p4Coords: Vec3 = [snap(p1[0] + perp[0]), snap(p1[1] + perp[1]), snap(p1[2])];

    const n1 = state.scene3d.points.find((p) => p.id === p1Id)?.name ?? 'A';
    const n2 = state.scene3d.points.find((p) => p.id === p2Id)?.name ?? 'B';

    const cName = nextPointName(state.scene3d.points, ['C', 'D', 'E', 'F']);
    const ptC: Point3D = { id: uid('p3'), name: cName, x: p3Coords[0], y: p3Coords[1], z: p3Coords[2], color: '#D93829', visible: true, showLabel: true };
    const dName = nextPointName([...state.scene3d.points, ptC], ['D', 'E', 'F', 'G']);
    const ptD: Point3D = { id: uid('p3'), name: dName, x: p4Coords[0], y: p4Coords[1], z: p4Coords[2], color: '#D93829', visible: true, showLabel: true };

    const ptA1: Point3D = { id: uid('p3'), name: `${n1}'`, x: snap(p1[0]), y: snap(p1[1]), z: snap(p1[2] + h), color: '#D93829', visible: true, showLabel: true };
    const ptB1: Point3D = { id: uid('p3'), name: `${n2}'`, x: snap(p2[0]), y: snap(p2[1]), z: snap(p2[2] + h), color: '#D93829', visible: true, showLabel: true };
    const ptC1: Point3D = { id: uid('p3'), name: `${cName}'`, x: snap(p3Coords[0]), y: snap(p3Coords[1]), z: snap(p3Coords[2] + h), color: '#D93829', visible: true, showLabel: true };
    const ptD1: Point3D = { id: uid('p3'), name: `${dName}'`, x: snap(p4Coords[0]), y: snap(p4Coords[1]), z: snap(p4Coords[2] + h), color: '#D93829', visible: true, showLabel: true };

    const poly: Polyhedron3D = {
      id: uid('poly'),
      name: `Hình hộp ${n1}${n2}${cName}${dName}.${n1}'${n2}'${cName}'${dName}'`,
      kind: 'box',
      vertexIds: [p1Id, p2Id, ptC.id, ptD.id, ptA1.id, ptB1.id, ptC1.id, ptD1.id],
      faces: [
        [p1Id, ptD.id, ptC.id, p2Id],
        [ptA1.id, ptB1.id, ptC1.id, ptD1.id],
        [p1Id, p2Id, ptB1.id, ptA1.id],
        [p2Id, ptC.id, ptC1.id, ptB1.id],
        [ptC.id, ptD.id, ptD1.id, ptC1.id],
        [ptD.id, p1Id, ptA1.id, ptD1.id],
      ],
      color: '#7C3AED',
      faceOpacity: state.view.globalFaceOpacity,
      visible: true,
      autoDashed: true,
    };

    set((s) => ({
      pendingIds: [],
      pendingSegment3DId: null,
      selection: [{ domain: '3d', type: 'polyhedron', id: poly.id }],
      scene3d: {
        ...s.scene3d,
        segments: removeSegmentId ? s.scene3d.segments.filter((seg) => seg.id !== removeSegmentId) : s.scene3d.segments,
        points: [...s.scene3d.points, ptC, ptD, ptA1, ptB1, ptC1, ptD1],
        polyhedra: [...s.scene3d.polyhedra, poly],
      },
      toast: { text: `Đã dựng ${poly.name}`, tone: 'success' },
    }));
    return {
      pointIds: [ptA1.id, ptB1.id, ptC1.id, ptD1.id],
      anchor: [ptC1.x, ptC1.y, ptC1.z],
      baseZ: p1[2],
      label: 'h',
    };
  },

  buildInteractiveBox3DFrom3Points: (p1Id, p2Id, thirdTarget, removeSegmentId = null) => {
    const state = get();
    const scope = Object.fromEntries(state.sliders.map((sl) => [sl.name, sl.value]));
    const ptMap = resolvePoints3D(state.scene3d.points, state.scene3d.planes, scope);
    const p1 = ptMap.get(p1Id);
    const p2 = ptMap.get(p2Id);
    if (!p1 || !p2) return null;

    const snap = (v: number) => Number(v.toFixed(2));
    const u = sub3(p2, p1);
    const sideA = Math.max(0.5, len3(u));
    const perpRaw: Vec3 = [-u[1], u[0], 0];
    const unitV: Vec3 = len3(perpRaw) > 1e-4 ? normalize3(perpRaw) : [0, 1, 0];

    const n1 = state.scene3d.points.find((p) => p.id === p1Id)?.name ?? 'A';
    const n2 = state.scene3d.points.find((p) => p.id === p2Id)?.name ?? 'B';

    const newPts: Point3D[] = [];
    let baseIds: [string, string, string, string];
    let baseCoords: [Vec3, Vec3, Vec3, Vec3];
    let baseNames: [string, string, string, string];
    let h: number;

    if (thirdTarget.pointId) {
      const p3 = ptMap.get(thirdTarget.pointId);
      if (!p3) return get().buildInteractiveBox3D(p1Id, p2Id, undefined, removeSegmentId);
      // If existing 3rd point is elevated in Z, use it as box height over square base AB!
      if (Math.abs(p3[2] - p1[2]) >= 0.25) {
        return get().buildInteractiveBox3D(p1Id, p2Id, Math.abs(p3[2] - p1[2]), removeSegmentId);
      }
      const n3 = state.scene3d.points.find((p) => p.id === thirdTarget.pointId)?.name ?? 'C';
      const crossCheck = len3(cross3(sub3(p2, p1), sub3(p3, p1)));
      if (crossCheck < 1e-2) {
        return get().buildInteractiveBox3D(p1Id, p2Id, undefined, removeSegmentId);
      }

      if (dist3(p3, p2) <= dist3(p3, p1)) {
        // Base cycle: A -> B -> C(existing) -> D
        const dCoords: Vec3 = [snap(p1[0] + (p3[0] - p2[0])), snap(p1[1] + (p3[1] - p2[1])), snap(p1[2])];
        const dName = nextPointName(state.scene3d.points, ['D', 'E', 'F', 'G', 'M', 'N']);
        const ptD: Point3D = { id: uid('p3'), name: dName, x: dCoords[0], y: dCoords[1], z: dCoords[2], color: '#D93829', visible: true, showLabel: true };
        newPts.push(ptD);
        baseIds = [p1Id, p2Id, thirdTarget.pointId, ptD.id];
        baseCoords = [p1, p2, p3, dCoords];
        baseNames = [n1, n2, n3, dName];
        h = Math.max(1.5, Math.round(((sideA + dist3(p2, p3)) / 2) * 2) / 2);
      } else {
        // Base cycle: A -> B -> D -> C(existing)
        const dCoords: Vec3 = [snap(p2[0] + (p3[0] - p1[0])), snap(p2[1] + (p3[1] - p1[1])), snap(p2[2])];
        const dName = nextPointName(state.scene3d.points, ['D', 'E', 'F', 'G', 'M', 'N']);
        const ptD: Point3D = { id: uid('p3'), name: dName, x: dCoords[0], y: dCoords[1], z: dCoords[2], color: '#D93829', visible: true, showLabel: true };
        newPts.push(ptD);
        baseIds = [p1Id, p2Id, ptD.id, thirdTarget.pointId];
        baseCoords = [p1, p2, dCoords, p3];
        baseNames = [n1, n2, dName, n3];
        h = Math.max(1.5, Math.round(((sideA + dist3(p1, p3)) / 2) * 2) / 2);
      }
    } else if (thirdTarget.coords) {
      // Clicked empty ground plane at 3rd step -> clean perpendicular rectangular base ABCD!
      const cRaw = thirdTarget.coords;
      const dx = cRaw[0] - p2[0];
      const dy = cRaw[1] - p2[1];
      const bRaw = dx * unitV[0] + dy * unitV[1];
      const bSign = bRaw >= 0 ? 1 : -1;
      const bMag = Math.abs(bRaw) < 0.45 ? Math.max(1.5, sideA) : state.view.snapToGrid ? Math.round(Math.abs(bRaw) * 2) / 2 : Number(Math.abs(bRaw).toFixed(2));
      const bSigned = bSign * bMag;

      const cCoords: Vec3 = [snap(p2[0] + unitV[0] * bSigned), snap(p2[1] + unitV[1] * bSigned), snap(p2[2])];
      const dCoords: Vec3 = [snap(p1[0] + unitV[0] * bSigned), snap(p1[1] + unitV[1] * bSigned), snap(p1[2])];

      const cName = nextPointName(state.scene3d.points, ['C', 'D', 'E', 'F', 'M', 'N']);
      const ptC: Point3D = { id: uid('p3'), name: cName, x: cCoords[0], y: cCoords[1], z: cCoords[2], color: '#D93829', visible: true, showLabel: true };
      const dName = nextPointName([...state.scene3d.points, ptC], ['D', 'E', 'F', 'G', 'M', 'N']);
      const ptD: Point3D = { id: uid('p3'), name: dName, x: dCoords[0], y: dCoords[1], z: dCoords[2], color: '#D93829', visible: true, showLabel: true };
      newPts.push(ptC, ptD);
      baseIds = [p1Id, p2Id, ptC.id, ptD.id];
      baseCoords = [p1, p2, cCoords, dCoords];
      baseNames = [n1, n2, cName, dName];
      h = Math.max(1.5, Math.round(((sideA + bMag) / 2) * 2) / 2);
    } else {
      return get().buildInteractiveBox3D(p1Id, p2Id, undefined, removeSegmentId);
    }

    // Create top 4 vertices A', B', C', D'
    const topPts: Point3D[] = baseCoords.map((bc, idx) => ({
      id: uid('p3'),
      name: `${baseNames[idx]}'`,
      x: snap(bc[0]),
      y: snap(bc[1]),
      z: snap(bc[2] + h),
      color: '#D93829',
      visible: true,
      showLabel: true,
    }));
    newPts.push(...topPts);

    const [b0, b1, b2, b3] = baseIds;
    const [t0, t1, t2, t3] = topPts.map((p) => p.id);

    // Ensure outward face normals regardless of whether 3rd point was clicked left or right of AB!
    const crossZ =
      (baseCoords[1][0] - baseCoords[0][0]) * (baseCoords[2][1] - baseCoords[1][1]) -
      (baseCoords[1][1] - baseCoords[0][1]) * (baseCoords[2][0] - baseCoords[1][0]);
    const ccw = crossZ >= 0;

    const faces: string[][] = ccw
      ? [
          [b0, b3, b2, b1],
          [t0, t1, t2, t3],
          [b0, b1, t1, t0],
          [b1, b2, t2, t1],
          [b2, b3, t3, t2],
          [b3, b0, t0, t3],
        ]
      : [
          [b0, b1, b2, b3],
          [t0, t3, t2, t1],
          [b1, b0, t0, t1],
          [b2, b1, t1, t2],
          [b3, b2, t2, t3],
          [b0, b3, t3, t0],
        ];

    const poly: Polyhedron3D = {
      id: uid('poly'),
      name: `Hình hộp ${baseNames.join('')}.${baseNames.map((n) => `${n}'`).join('')}`,
      kind: 'box',
      vertexIds: [b0, b1, b2, b3, t0, t1, t2, t3],
      faces,
      color: '#7C3AED',
      faceOpacity: state.view.globalFaceOpacity,
      visible: true,
      autoDashed: true,
    };

    set((s) => ({
      pendingIds: [],
      pendingSegment3DId: null,
      selection: [{ domain: '3d', type: 'polyhedron', id: poly.id }],
      scene3d: {
        ...s.scene3d,
        segments: removeSegmentId ? s.scene3d.segments.filter((seg) => seg.id !== removeSegmentId) : s.scene3d.segments,
        points: [...s.scene3d.points, ...newPts],
        polyhedra: [...s.scene3d.polyhedra, poly],
      },
      toast: { text: `Đã tự nối thành ${poly.name} (nhấn giữ điểm thứ 3 để kéo chiều cao h)`, tone: 'success' },
    }));

    return {
      pointIds: [t0, t1, t2, t3],
      anchor: [topPts[2].x, topPts[2].y, topPts[2].z],
      baseZ: baseCoords[0][2],
      label: 'h',
    };
  },

  buildRegularTetrahedron2Pts: (p1Id, p2Id) => {
    const state = get();
    const scope = Object.fromEntries(state.sliders.map((sl) => [sl.name, sl.value]));
    const ptMap = resolvePoints3D(state.scene3d.points, state.scene3d.planes, scope);
    const p1 = ptMap.get(p1Id);
    const p2 = ptMap.get(p2Id);
    if (!p1 || !p2) return null;

    const u = sub3(p2, p1);
    const side = Math.max(0.5, len3(u));
    let perp: Vec3 = [-u[1], u[0], 0];
    if (len3(perp) < 1e-4) perp = [0, 1, 0];
    else perp = normalize3(perp);

    const snap = (v: number) => Number(v.toFixed(2));
    const triH = (side * Math.sqrt(3)) / 2;
    const mid12: Vec3 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, (p1[2] + p2[2]) / 2];
    const p3Coords: Vec3 = [snap(mid12[0] + perp[0] * triH), snap(mid12[1] + perp[1] * triH), snap(mid12[2])];

    const cName = nextPointName(state.scene3d.points, ['C', 'D', 'E', 'F']);
    const ptC: Point3D = {
      id: uid('p3'),
      name: cName,
      x: p3Coords[0],
      y: p3Coords[1],
      z: p3Coords[2],
      color: '#D93829',
      visible: true,
      showLabel: true,
    };

    const g = centroid3([p1, p2, p3Coords]);
    const h = side * Math.sqrt(2 / 3);
    const sCoords: Vec3 = [snap(g[0]), snap(g[1]), snap(g[2] + h)];
    const sName = nextPointName([...state.scene3d.points, ptC], ['S', 'D', "S'", 'S1']);
    const ptS: Point3D = {
      id: uid('p3'),
      name: sName,
      x: sCoords[0],
      y: sCoords[1],
      z: sCoords[2],
      color: '#D93829',
      visible: true,
      showLabel: true,
    };

    const n1 = state.scene3d.points.find((p) => p.id === p1Id)?.name ?? 'A';
    const n2 = state.scene3d.points.find((p) => p.id === p2Id)?.name ?? 'B';

    const baseSigned = cross3(sub3(p2, p1), sub3(p3Coords, p1));
    const toS = sub3(sCoords, p1);
    const baseFace =
      baseSigned[0] * toS[0] + baseSigned[1] * toS[1] + baseSigned[2] * toS[2] > 0
        ? [p1Id, ptC.id, p2Id]
        : [p1Id, p2Id, ptC.id];

    const poly: Polyhedron3D = {
      id: uid('poly'),
      name: `Tứ diện đều ${sName}.${n1}${n2}${cName}`,
      kind: 'tetrahedron',
      vertexIds: [p1Id, p2Id, ptC.id, ptS.id],
      faces: [
        baseFace,
        [ptS.id, baseFace[0], baseFace[2]],
        [ptS.id, baseFace[2], baseFace[1]],
        [ptS.id, baseFace[1], baseFace[0]],
      ],
      color: '#0E9F6E',
      faceOpacity: state.view.globalFaceOpacity,
      visible: true,
      autoDashed: true,
    };

    set((s) => ({
      pendingIds: [],
      closedBase3D: [],
      selection: [{ domain: '3d', type: 'point', id: ptS.id }],
      scene3d: {
        ...s.scene3d,
        points: [...s.scene3d.points, ptC, ptS],
        polyhedra: [...s.scene3d.polyhedra, poly],
      },
      toast: { text: `Đã dựng ${poly.name}`, tone: 'success' },
    }));
    return { pointIds: [ptS.id], anchor: sCoords, baseZ: g[2], label: 'z' };
  },

  buildPolygonPyramid3D: (baseIds, apexCoords, apexPointId) => {
    const state = get();
    const scope = Object.fromEntries(state.sliders.map((sl) => [sl.name, sl.value]));
    const ptMap = resolvePoints3D(state.scene3d.points, state.scene3d.planes, scope);
    const basePts = baseIds.map((id) => ptMap.get(id)).filter((v): v is Vec3 => Boolean(v));
    if (basePts.length < 3) return null;

    const g = centroid3(basePts);
    const snap = (v: number) => Number(v.toFixed(2));
    const avgSide = dist3(basePts[0], basePts[1]);
    const defaultH = Math.max(2.5, Math.round(avgSide * 1.15 * 2) / 2);
    const finalApex: Vec3 = [
      snap(apexCoords[0]),
      snap(apexCoords[1]),
      snap(Math.abs(apexCoords[2] - g[2]) < 0.25 ? g[2] + defaultH : apexCoords[2]),
    ];

    let sId = apexPointId;
    let sName = sId ? state.scene3d.points.find((p) => p.id === sId)?.name ?? 'S' : '';
    const extraPts: Point3D[] = [];
    if (!sId) {
      sName = nextPointName(state.scene3d.points, ['S', "S'", 'S1', 'S2']);
      sId = uid('p3');
      extraPts.push({
        id: sId,
        name: sName,
        x: finalApex[0],
        y: finalApex[1],
        z: finalApex[2],
        color: '#D93829',
        visible: true,
        showLabel: true,
      });
    }

    // Ensure consistent polygon face orientation
    const nVec = cross3(sub3(basePts[1], basePts[0]), sub3(basePts[2], basePts[0]));
    const toS = sub3(finalApex, basePts[0]);
    const orientedBase = nVec[0] * toS[0] + nVec[1] * toS[1] + nVec[2] * toS[2] > 0 ? [...baseIds].reverse() : [...baseIds];

    const faces: string[][] = [orientedBase];
    for (let i = 0; i < orientedBase.length; i++) {
      const a = orientedBase[i];
      const b = orientedBase[(i + 1) % orientedBase.length];
      faces.push([sId, b, a]);
    }

    const baseLabel = baseIds.map((id) => state.scene3d.points.find((p) => p.id === id)?.name ?? '').join('');
    const poly: Polyhedron3D = {
      id: uid('poly'),
      name: `Hình chóp ${sName}.${baseLabel}`,
      kind: baseIds.length === 3 ? 'tetrahedron' : 'pyramid',
      vertexIds: [...baseIds, sId],
      faces,
      color: '#1D5CE5',
      faceOpacity: state.view.globalFaceOpacity,
      visible: true,
      autoDashed: true,
    };

    set((s) => ({
      pendingIds: [],
      closedBase3D: [],
      selection: [{ domain: '3d', type: 'point', id: sId! }],
      scene3d: {
        ...s.scene3d,
        points: [...s.scene3d.points, ...extraPts],
        polyhedra: [...s.scene3d.polyhedra, poly],
      },
      toast: { text: `Đã dựng ${poly.name} (nhấn giữ đỉnh ${sName} để kéo cao độ)`, tone: 'success' },
    }));
    return { pointIds: [sId], anchor: finalApex, baseZ: g[2], label: 'z' };
  },

  buildPolygonPrism3D: (baseIds, topCoords) => {
    const state = get();
    const scope = Object.fromEntries(state.sliders.map((sl) => [sl.name, sl.value]));
    const ptMap = resolvePoints3D(state.scene3d.points, state.scene3d.planes, scope);
    const basePts = baseIds.map((id) => ptMap.get(id)).filter((v): v is Vec3 => Boolean(v));
    if (basePts.length < 3) return null;

    const snap = (v: number) => Number(v.toFixed(2));
    const g = centroid3(basePts);
    const avgSide = dist3(basePts[0], basePts[1]);
    const rawDz = topCoords[2] - g[2];
    const h = Math.abs(rawDz) >= 0.4 ? rawDz : Math.max(2.5, Math.round(avgSide * 1.2 * 2) / 2);

    const topPts: Point3D[] = baseIds.map((id, idx) => {
      const name = state.scene3d.points.find((p) => p.id === id)?.name ?? `V${idx + 1}`;
      const bp = basePts[idx];
      return {
        id: uid('p3'),
        name: `${name}'`,
        x: snap(bp[0]),
        y: snap(bp[1]),
        z: snap(bp[2] + h),
        color: '#D93829',
        visible: true,
        showLabel: true,
      };
    });

    const nVec = cross3(sub3(basePts[1], basePts[0]), sub3(basePts[2], basePts[0]));
    const isUp = nVec[2] * h >= 0;
    const bot = isUp ? [...baseIds].reverse() : [...baseIds];
    const topIds = isUp ? topPts.map((p) => p.id) : [...topPts.map((p) => p.id)].reverse();
    const matchTop = (botId: string) => topPts[baseIds.indexOf(botId)].id;

    const faces: string[][] = [bot, topIds];
    for (let i = 0; i < bot.length; i++) {
      const a = bot[i];
      const b = bot[(i + 1) % bot.length];
      faces.push([b, a, matchTop(a), matchTop(b)]);
    }

    const baseNames = baseIds.map((id) => state.scene3d.points.find((p) => p.id === id)?.name ?? '');
    const poly: Polyhedron3D = {
      id: uid('poly'),
      name: `Lăng trụ ${baseNames.join('')}.${baseNames.map((n) => `${n}'`).join('')}`,
      kind: 'prism',
      vertexIds: [...baseIds, ...topPts.map((p) => p.id)],
      faces,
      color: '#0891B2',
      faceOpacity: state.view.globalFaceOpacity,
      visible: true,
      autoDashed: true,
    };

    set((s) => ({
      pendingIds: [],
      closedBase3D: [],
      selection: [{ domain: '3d', type: 'polyhedron', id: poly.id }],
      scene3d: {
        ...s.scene3d,
        points: [...s.scene3d.points, ...topPts],
        polyhedra: [...s.scene3d.polyhedra, poly],
      },
      toast: { text: `Đã dựng ${poly.name}`, tone: 'success' },
    }));
    return {
      pointIds: topPts.map((p) => p.id),
      anchor: [topPts[0].x, topPts[0].y, topPts[0].z],
      baseZ: basePts[0][2],
      label: 'h',
    };
  },

  extrudePolyhedronToSolid: (polyId, targetKind, height = 3.5) => {
    const state = get();
    const poly = state.scene3d.polyhedra.find((p) => p.id === polyId);
    if (!poly || poly.faces.length === 0) return;
    get().pushHistory();
    const scope = Object.fromEntries(state.sliders.map((sl) => [sl.name, sl.value]));
    const ptMap = resolvePoints3D(state.scene3d.points, state.scene3d.planes, scope);
    // Pick base face with lowest average Z
    let bestFace = poly.faces[0];
    let minZ = Infinity;
    for (const f of poly.faces) {
      const zAvg = f.reduce((acc, id) => acc + (ptMap.get(id)?.[2] ?? 0), 0) / Math.max(1, f.length);
      if (zAvg < minZ) {
        minZ = zAvg;
        bestFace = f;
      }
    }
    const g = centroid3(bestFace.map((id) => ptMap.get(id) ?? [0, 0, 0]));
    if (targetKind === 'pyramid') {
      get().buildPolygonPyramid3D(bestFace, [g[0], g[1], g[2] + height]);
    } else {
      get().buildPolygonPrism3D(bestFace, [g[0], g[1], g[2] + height]);
    }
  },

  createNetForPolyhedron: (polyId) => {
    const state = get();
    const poly = state.scene3d.polyhedra.find((p) => p.id === polyId);
    if (!poly) return;
    get().pushHistory();

    const sliderName = 'u';
    const hasSlider = state.sliders.some((sl) => sl.name === sliderName);
    const existingNet = (state.scene3d.nets ?? []).find((n) => n.polyhedronId === polyId);
    if (existingNet) {
      set((s) => ({
        scene3d: {
          ...s.scene3d,
          nets: (s.scene3d.nets ?? []).map((n) => (n.id === existingNet.id ? { ...n, visible: !n.visible } : n)),
        },
        toast: { text: `Đã chuyển trạng thái trải phẳng của ${poly.name}`, tone: 'info' },
      }));
      return;
    }

    set((s) => ({
      activeTool3D: 'select',
      sliders: hasSlider
        ? s.sliders
        : [
            ...s.sliders,
            { id: uid('sl'), name: sliderName, value: 0.72, min: 0, max: 1, step: 0.02, playing: false },
          ],
      scene3d: {
        ...s.scene3d,
        nets: [
          ...(s.scene3d.nets ?? []),
          {
            id: uid('net'),
            name: `Trải phẳng ${poly.name}`,
            polyhedronId: polyId,
            sliderName,
            color: poly.color,
            visible: true,
          },
        ],
      },
      toast: { text: `Đã tạo hình trải phẳng (Net) · Kéo thanh trượt ${sliderName} để gập/mở 3D ↔ 2D!`, tone: 'success' },
    }));
  },

  handlePoint3DClick: (pointId, multi = false) => {
    const { activeTool3D, pendingIds, closedBase3D, segment3DMode, pendingSegment3DId } = get();
    if (activeTool3D === 'select' || activeTool3D === 'point') {
      get().selectItem({ domain: '3d', type: 'point', id: pointId }, multi);
      return null;
    }

    // GeoGebra 2-click regular Tetrahedron & 2-click Cube!
    if (activeTool3D === 'tetrahedron' || activeTool3D === 'cube') {
      if (pendingIds.length === 0) {
        set({ pendingIds: [pointId], selection: [{ domain: '3d', type: 'point', id: pointId }] });
        return null;
      }
      if (pendingIds[0] === pointId) return null;
      get().pushHistory();
      if (activeTool3D === 'tetrahedron') {
        return get().buildRegularTetrahedron2Pts(pendingIds[0], pointId);
      }
      return get().buildInteractiveBox3D(pendingIds[0], pointId);
    }

    // GeoGebra Cone & Cylinder: 2 clicks (Center O -> Rim point M)
    if (activeTool3D === 'cone' || activeTool3D === 'cylinder') {
      if (pendingIds.length === 0) {
        set({ pendingIds: [pointId], selection: [{ domain: '3d', type: 'point', id: pointId }] });
        return null;
      }
      if (pendingIds[0] === pointId) return null;
      const state = get();
      const scope = Object.fromEntries(state.sliders.map((sl) => [sl.name, sl.value]));
      const ptMap = resolvePoints3D(state.scene3d.points, state.scene3d.planes, scope);
      const center = ptMap.get(pendingIds[0]);
      const rim = ptMap.get(pointId);
      if (center && rim) {
        const radius = Math.max(0.5, Number(dist3(center, rim).toFixed(2)));
        const h = Math.max(2.5, Number((radius * 1.5).toFixed(2)));
        get().pushHistory();
        const kind = activeTool3D === 'cone' ? 'cone' : 'cylinder';
        set((s) => ({
          pendingIds: [],
          scene3d: {
            ...s.scene3d,
            solids: [
              ...s.scene3d.solids,
              {
                id: uid('sol'),
                name: `${kind === 'cone' ? 'Hình nón' : 'Hình trụ'} (R=${formatNum(radius)}, h=${formatNum(h)})`,
                kind,
                center,
                radius,
                height: h,
                color: kind === 'cone' ? '#E06D1F' : '#0891B2',
                opacity: 0.28,
                showAxes: true,
                visible: true,
              },
            ],
          },
          toast: { text: `Đã dựng ${kind === 'cone' ? 'Hình nón' : 'Hình trụ'} (R = ${formatNum(radius)}, h = ${formatNum(h)})`, tone: 'success' },
        }));
      }
      return null;
    }

    // GeoGebra Pyramid & Prism & Extrude: Click base polygon A->B->C...->A (close base), then Apex / Top!
    if (
      activeTool3D === 'pyramid' ||
      activeTool3D === 'prism' ||
      activeTool3D === 'extrudePyramid' ||
      activeTool3D === 'extrudePrism'
    ) {
      if (closedBase3D.length >= 3) {
        const state = get();
        const scope = Object.fromEntries(state.sliders.map((sl) => [sl.name, sl.value]));
        const ptMap = resolvePoints3D(state.scene3d.points, state.scene3d.planes, scope);
        const topPos = ptMap.get(pointId);
        if (!topPos) return null;
        get().pushHistory();
        if (activeTool3D === 'prism' || activeTool3D === 'extrudePrism') {
          return get().buildPolygonPrism3D(closedBase3D, topPos);
        }
        return get().buildPolygonPyramid3D(closedBase3D, topPos, pointId);
      }

      if (pendingIds.length >= 3 && pointId === pendingIds[0]) {
        if (activeTool3D === 'extrudePyramid' || activeTool3D === 'extrudePrism') {
          const state = get();
          const scope = Object.fromEntries(state.sliders.map((sl) => [sl.name, sl.value]));
          const ptMap = resolvePoints3D(state.scene3d.points, state.scene3d.planes, scope);
          const g = centroid3(pendingIds.map((id) => ptMap.get(id) ?? [0, 0, 0]));
          get().pushHistory();
          return activeTool3D === 'extrudePrism'
            ? get().buildPolygonPrism3D(pendingIds, [g[0], g[1], g[2] + 3.5])
            : get().buildPolygonPyramid3D(pendingIds, [g[0], g[1], g[2] + 3.5]);
        }
        get().closeBase3DPolygon();
        return null;
      }

      if (!pendingIds.includes(pointId)) {
        const next = [...pendingIds, pointId];
        set({
          pendingIds: next,
          selection: next.map((id) => ({ domain: '3d' as const, type: 'point' as const, id })),
        });
      }
      return null;
    }

    // Integrated Smart Segment Tool: 2 clicks = segment AB -> 3rd click = auto-build Tetrahedron / Pyramid / Box!
    if (activeTool3D === 'segment') {
      if (pendingIds.length === 0) {
        set({
          pendingIds: [pointId],
          pendingSegment3DId: null,
          selection: [{ domain: '3d', type: 'point', id: pointId }],
        });
        return null;
      }

      if (pendingIds.length === 1) {
        if (pendingIds[0] === pointId) return null;
        const p1Id = pendingIds[0];
        const p2Id = pointId;
        const p1 = get().scene3d.points.find((p) => p.id === p1Id);
        const p2 = get().scene3d.points.find((p) => p.id === p2Id);
        if (!p1 || !p2) return null;

        get().pushHistory();
        const segId = uid('s3');
        const nextPending = segment3DMode === 'segmentOnly' ? [] : [p1Id, p2Id];
        const nextSegId = segment3DMode === 'segmentOnly' ? null : segId;
        const hintMsg =
          segment3DMode === 'tetrahedron'
            ? `Đã nối ${p1.name}${p2.name} · Chấm điểm thứ 3 để dựng ngay Chóp tứ diện S.ABC`
            : segment3DMode === 'pyramid4'
            ? `Đã nối ${p1.name}${p2.name} · Chấm điểm thứ 3 để đặt đỉnh Chóp tứ giác S.ABCD`
            : segment3DMode === 'box'
            ? `Đã nối ${p1.name}${p2.name} · Chấm tiếp điểm thứ 3 để tự nối thành Hình hộp 3D`
            : `Đã nối đoạn thẳng ${p1.name}${p2.name}`;

        set((s) => ({
          pendingIds: nextPending,
          pendingSegment3DId: nextSegId,
          selection: [
            { domain: '3d', type: 'point', id: p1Id },
            { domain: '3d', type: 'point', id: p2Id },
          ],
          scene3d: {
            ...s.scene3d,
            segments: [
              ...s.scene3d.segments,
              { id: segId, name: `${p1.name}${p2.name}`, p1Id, p2Id, color: '#0F1B2D', style: 'solid', visible: true, showLength: true },
            ],
          },
          toast: { text: hintMsg, tone: 'success' },
        }));
        return null;
      }

      if (pendingIds.includes(pointId)) {
        set({
          pendingIds: [],
          pendingSegment3DId: null,
          toast: { text: 'Đã giữ nguyên đoạn thẳng', tone: 'info' },
        });
        return null;
      }

      get().pushHistory();
      if (segment3DMode === 'box') {
        return get().buildInteractiveBox3DFrom3Points(pendingIds[0], pendingIds[1], { pointId }, pendingSegment3DId);
      }
      if (segment3DMode === 'tetrahedron') {
        return get().buildInteractiveTetrahedron3D(pendingIds[0], pendingIds[1], pointId, pendingSegment3DId);
      }
      if (segment3DMode === 'pyramid4') {
        const state = get();
        const scope = Object.fromEntries(state.sliders.map((sl) => [sl.name, sl.value]));
        const ptMap = resolvePoints3D(state.scene3d.points, state.scene3d.planes, scope);
        const p3Pos = ptMap.get(pointId);
        return get().buildInteractivePyramid4_3D(pendingIds[0], pendingIds[1], p3Pos, pendingSegment3DId);
      }
      return null;
    }

    if (
      activeTool3D === 'line' ||
      activeTool3D === 'vector' ||
      activeTool3D === 'midpoint' ||
      activeTool3D === 'ratio' ||
      activeTool3D === 'distance'
    ) {
      if (pendingIds.length === 0) {
        set({ pendingIds: [pointId], selection: [{ domain: '3d', type: 'point', id: pointId }] });
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
        if (activeTool3D === 'line') get().createLineFromSelection('3d');
        if (activeTool3D === 'vector') get().createVectorFromSelection('3d');
        if (activeTool3D === 'midpoint') get().createMidpointFromSelection('3d');
        if (activeTool3D === 'ratio') get().createRatioPointFromSelection('3d', 1 / 3);
        if (activeTool3D === 'distance') get().createDistanceMeasureFromSelection('3d');
      }
      return null;
    }

    if (activeTool3D === 'plane3p' || activeTool3D === 'crossSection' || activeTool3D === 'angle') {
      if (pendingIds.includes(pointId)) return null;
      const next = [...pendingIds, pointId];
      if (next.length < 3) {
        set({
          pendingIds: next,
          selection: next.map((id) => ({ domain: '3d' as const, type: 'point' as const, id })),
        });
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
    return null;
  },

  handleGround3DConstructionClick: (coords) => {
    const { activeTool3D, pendingIds, closedBase3D, segment3DMode, pendingSegment3DId } = get();
    if (activeTool3D === 'select' || activeTool3D === 'net') return null;

    // Closed base polygon waiting for Apex (Pyramid) or Height (Prism) on ground plane:
    if ((activeTool3D === 'pyramid' || activeTool3D === 'extrudePyramid') && closedBase3D.length >= 3) {
      get().pushHistory();
      return get().buildPolygonPyramid3D(closedBase3D, coords);
    }
    if ((activeTool3D === 'prism' || activeTool3D === 'extrudePrism') && closedBase3D.length >= 3) {
      get().pushHistory();
      return get().buildPolygonPrism3D(closedBase3D, coords);
    }

    // Step 3 of integrated Segment tool on empty ground plane:
    if (activeTool3D === 'segment' && pendingIds.length === 2) {
      if (segment3DMode === 'box') {
        get().pushHistory();
        return get().buildInteractiveBox3DFrom3Points(pendingIds[0], pendingIds[1], { coords }, pendingSegment3DId);
      }
      if (segment3DMode === 'pyramid4') {
        get().pushHistory();
        return get().buildInteractivePyramid4_3D(pendingIds[0], pendingIds[1], coords, pendingSegment3DId);
      }
    }

    // Auto-create vertex at clicked ground position & advance the active construction tool
    const newPtId = get().addPoint3D(coords[0], coords[1], coords[2]);
    const dragTarget = get().handlePoint3DClick(newPtId, false);
    if (dragTarget) return dragTarget;
    return { pointIds: [newPtId], anchor: coords, baseZ: 0, label: 'z' };
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

  createTetrahedronFromSelection: () => {
    const pts = get().selection.filter((x) => x.domain === '3d' && x.type === 'point');
    if (pts.length < 3) return;
    get().pushHistory();
    get().buildInteractiveTetrahedron3D(pts[0].id, pts[1].id, pts[2].id);
  },

  createPyramid4FromSelection: () => {
    const pts = get().selection.filter((x) => x.domain === '3d' && x.type === 'point');
    if (pts.length < 2) return;
    get().pushHistory();
    get().buildInteractivePyramid4_3D(pts[0].id, pts[1].id);
  },

  createCubeFromSelection: () => {
    const pts = get().selection.filter((x) => x.domain === '3d' && x.type === 'point');
    if (pts.length < 2) return;
    get().pushHistory();
    get().buildInteractiveBox3D(pts[0].id, pts[1].id);
  },

  createBoxFrom3SelectedPoints: () => {
    const pts = get().selection.filter((x) => x.domain === '3d' && x.type === 'point');
    if (pts.length < 3) return;
    get().pushHistory();
    get().buildInteractiveBox3DFrom3Points(pts[0].id, pts[1].id, { pointId: pts[2].id });
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
        case 'net': return 'nets';
        case 'curve': return 'curves';
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
        case 'net': return 'nets';
        case 'curve': return 'curves';
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
        case 'net': return 'nets';
        case 'curve': return 'curves';
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
