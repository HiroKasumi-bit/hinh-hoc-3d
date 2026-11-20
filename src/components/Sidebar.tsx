import React, { useMemo, useRef, useState } from 'react';
import {
  Axis3D,
  ChevronDown,
  ChevronRight,
  Compass,
  CornerDownLeft,
  Eye,
  EyeOff,
  FunctionSquare,
  Keyboard,
  Pause,
  Pencil,
  Play,
  Plus,
  Rotate3D,
  Sliders,
  Table2,
  Trash2,
  X,
} from 'lucide-react';
import { useGeometryStore } from '../store/useGeometryStore';
import { useViewportProfile } from '../hooks/useViewportProfile';
import { safeEval } from '../math/parser';
import {
  computeIntegral2D,
  dist2D,
  evalDerivative2D,
  formatLine2DEq,
  formatNum,
  polygonArea2D,
  resolveLine2D,
  resolvePoints2D,
} from '../math/geometry2d';
import {
  angleLineLineDeg,
  cross3,
  dist3,
  dot3,
  formatPlaneEq,
  formatVec3,
  len3,
  planeFrom3Points,
  polyhedronSurfaceArea,
  polyhedronVolume,
  resolvePlaneEq,
  resolvePoints3D,
  slicePolyhedronByPlane,
  sub3,
} from '../math/geometry3d';

const MATH_KEYS = [
  { label: 'x²', insert: '^2' },
  { label: 'x³', insert: '^3' },
  { label: '√()', insert: 'sqrt()' },
  { label: 'π', insert: 'pi' },
  { label: '|x|', insert: 'abs()' },
  { label: '≤', insert: ' <= ' },
  { label: '≥', insert: ' >= ' },
  { label: 'sin', insert: 'sin()' },
  { label: 'cos', insert: 'cos()' },
  { label: 'ln', insert: 'ln()' },
  { label: 'eˣ', insert: 'exp()' },
  { label: 'm', insert: 'm' },
];

const QUICK_EXAMPLES_2D = [
  'y = x^3 - 3*m*x + 1',
  'y = (2x - 1)/(x - 1)',
  'x^2/25 + y^2/9 = 1',
  '2x + y <= 4',
  'A(2, 3)',
];

const QUICK_EXAMPLES_3D = [
  'A(1, 2, 3)',
  '2x - y + 3z - 6 = 0',
  '(x-1)^2 + (y+1)^2 + z^2 = 9',
  '(x-1)/2 = (y+1)/-1 = z/3',
  'z = sin(x)*cos(y)',
];

export const Sidebar: React.FC = () => {
  const mode = useGeometryStore((s) => s.mode);
  const view = useGeometryStore((s) => s.view);
  const sliders = useGeometryStore((s) => s.sliders);
  const scene2d = useGeometryStore((s) => s.scene2d);
  const scene3d = useGeometryStore((s) => s.scene3d);
  const selection = useGeometryStore((s) => s.selection);

  const executeSmartInput = useGeometryStore((s) => s.executeSmartInput);
  const setMode = useGeometryStore((s) => s.setMode);
  const updateView = useGeometryStore((s) => s.updateView);
  const setSliderValue = useGeometryStore((s) => s.setSliderValue);
  const toggleSliderPlay = useGeometryStore((s) => s.toggleSliderPlay);
  const addSlider = useGeometryStore((s) => s.addSlider);
  const removeSlider = useGeometryStore((s) => s.removeSlider);
  const selectItem = useGeometryStore((s) => s.selectItem);
  const toggleVisibility = useGeometryStore((s) => s.toggleVisibility);
  const deleteObject = useGeometryStore((s) => s.deleteObject);
  const addPoint3D = useGeometryStore((s) => s.addPoint3D);
  const addPlane3DFromEq = useGeometryStore((s) => s.addPlane3DFromEq);
  const updatePoint3DCoords = useGeometryStore((s) => s.updatePoint3DCoords);
  const toggleSegment3DStyle = useGeometryStore((s) => s.toggleSegment3DStyle);
  const toggleFunctionIntegral = useGeometryStore((s) => s.toggleFunctionIntegral);
  const toggleFunctionTangent = useGeometryStore((s) => s.toggleFunctionTangent);
  const toggleFunctionTable = useGeometryStore((s) => s.toggleFunctionTable);
  const plotFunctionTablePoints2D = useGeometryStore((s) => s.plotFunctionTablePoints2D);
  const revolveFunctionTo3D = useGeometryStore((s) => s.revolveFunctionTo3D);
  const openRenamePoint = useGeometryStore((s) => s.openRenamePoint);
  const setSidebarOpen = useGeometryStore((s) => s.setSidebarOpen);

  const [inputTab, setInputTab] = useState<'smart' | 'oxyz' | 'func'>('smart');
  const [inputVal, setInputVal] = useState('');
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Oxyz quick creator fields
  const [oxyzPtName, setOxyzPtName] = useState('A');
  const [oxyzPtX, setOxyzPtX] = useState('1');
  const [oxyzPtY, setOxyzPtY] = useState('2');
  const [oxyzPtZ, setOxyzPtZ] = useState('3');
  const [oxyzVecName, setOxyzVecName] = useState('u');
  const [oxyzVecX, setOxyzVecX] = useState('1');
  const [oxyzVecY, setOxyzVecY] = useState('-2');
  const [oxyzVecZ, setOxyzVecZ] = useState('2');
  const [oxyzPlA, setOxyzPlA] = useState('1');
  const [oxyzPlB, setOxyzPlB] = useState('1');
  const [oxyzPlC, setOxyzPlC] = useState('1');
  const [oxyzPlD, setOxyzPlD] = useState('-3');
  const [oxyzSpX, setOxyzSpX] = useState('1');
  const [oxyzSpY, setOxyzSpY] = useState('1');
  const [oxyzSpZ, setOxyzSpZ] = useState('1');
  const [oxyzSpR, setOxyzSpR] = useState('2');

  // Function quick creator & surface evaluator fields
  const [fnExpr2D, setFnExpr2D] = useState('x^3 - 3*x + 2');
  const [fnExpr3D, setFnExpr3D] = useState('0.25*(x^2 + y^2)');
  const [surfEvalX, setSurfEvalX] = useState('1');
  const [surfEvalY, setSurfEvalY] = useState('2');

  const inputRef = useRef<HTMLInputElement>(null);
  const vp = useViewportProfile();

  const isDark = view.theme === 'dark';

  const sliderScope = useMemo(
    () => Object.fromEntries(sliders.map((sl) => [sl.name, sl.value])),
    [sliders]
  );

  const ptMap2D = useMemo(() => resolvePoints2D(scene2d.points, scene2d.lines), [scene2d.points, scene2d.lines]);
  const ptMap3D = useMemo(
    () => resolvePoints3D(scene3d.points, scene3d.planes, sliderScope),
    [scene3d.points, scene3d.planes, sliderScope]
  );

  // Live Oxyz Vector & Distance Calculator
  const oxyzStats = useMemo(() => {
    const selPtIds = selection
      .filter((s) => s.domain === '3d' && s.type === 'point')
      .map((s) => s.id);
    const activePts =
      selPtIds.length >= 2
        ? selPtIds
            .map((id) => scene3d.points.find((p) => p.id === id))
            .filter((p): p is (typeof scene3d.points)[number] => Boolean(p))
        : scene3d.points;

    let abLabel: string | null = null;
    let abVec: [number, number, number] | null = null;
    let abLen: number | null = null;
    if (activePts.length >= 2) {
      const p1 = ptMap3D.get(activePts[0].id);
      const p2 = ptMap3D.get(activePts[1].id);
      if (p1 && p2) {
        abVec = sub3(p2, p1);
        abLen = len3(abVec);
        abLabel = `${activePts[0].name}${activePts[1].name}`;
      }
    }

    let uName = '';
    let vName = '';
    let uVec: [number, number, number] | null = null;
    let vVec: [number, number, number] | null = null;
    if (scene3d.vectors.length >= 2) {
      const v1 = scene3d.vectors[0];
      const v2 = scene3d.vectors[1];
      const o1 = v1.originId ? ptMap3D.get(v1.originId) : undefined;
      const e1 = v1.targetId ? ptMap3D.get(v1.targetId) : undefined;
      const o2 = v2.originId ? ptMap3D.get(v2.originId) : undefined;
      const e2 = v2.targetId ? ptMap3D.get(v2.targetId) : undefined;
      uVec = o1 && e1 ? sub3(e1, o1) : v1.dir;
      vVec = o2 && e2 ? sub3(e2, o2) : v2.dir;
      uName = v1.name;
      vName = v2.name;
    } else if (activePts.length >= 3) {
      const p1 = ptMap3D.get(activePts[0].id);
      const p2 = ptMap3D.get(activePts[1].id);
      const p3 = ptMap3D.get(activePts[2].id);
      if (p1 && p2 && p3) {
        uVec = sub3(p2, p1);
        vVec = sub3(p3, p1);
        uName = `${activePts[0].name}${activePts[1].name}`;
        vName = `${activePts[0].name}${activePts[2].name}`;
      }
    }

    const pair =
      uVec && vVec && len3(uVec) > 1e-8 && len3(vVec) > 1e-8
        ? {
            uName,
            vName,
            dot: dot3(uVec, vVec),
            cross: cross3(uVec, vVec),
            angleDeg: angleLineLineDeg(uVec, vVec),
          }
        : null;

    return { abLabel, abVec, abLen, pair };
  }, [selection, scene3d.points, scene3d.vectors, ptMap3D]);

  const surfaceEvalResult = useMemo(() => {
    const visibleSurf = scene3d.surfaces.find((sf) => sf.visible);
    if (!visibleSurf) return null;
    const x0 = parseFloat(surfEvalX);
    const y0 = parseFloat(surfEvalY);
    if (!Number.isFinite(x0) || !Number.isFinite(y0)) return null;
    const z0 = safeEval(visibleSurf.expr, { ...sliderScope, x: x0, y: y0 });
    if (!Number.isFinite(z0)) return null;
    return { name: visibleSurf.name, x0, y0, z0 };
  }, [scene3d.surfaces, surfEvalX, surfEvalY, sliderScope]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    executeSmartInput(inputVal);
    setInputVal('');
  };

  const insertToken = (tok: string) => {
    const el = inputRef.current;
    if (!el) {
      setInputVal((v) => v + tok);
      return;
    }
    const start = el.selectionStart ?? inputVal.length;
    const end = el.selectionEnd ?? inputVal.length;
    const next = inputVal.slice(0, start) + tok + inputVal.slice(end);
    setInputVal(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = tok.endsWith('()') ? start + tok.length - 1 : start + tok.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const show2DList = mode === '2d' || mode === 'split';
  const show3DList = mode === '3d' || mode === 'split';

  const isSelected = (domain: '2d' | '3d', type: string, id: string) =>
    selection.some((x) => x.domain === domain && x.type === type && x.id === id);

  const rowCls = (selected: boolean) =>
    `group flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
      selected
        ? 'border-[#1D5CE5] bg-[#1D5CE5]/10'
        : isDark
        ? 'border-transparent hover:border-slate-700 hover:bg-slate-800/70'
        : 'border-transparent hover:border-[#DCE3EC] hover:bg-[#F2F5F9]'
    }`;

  return (
    <>
      {/* Overlay backdrop on compact screens (both portrait & landscape phones!) */}
      {vp.isCompact && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-[1px]"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`${
          vp.isCompact
            ? 'fixed inset-y-0 left-0 z-40 w-[86vw] max-w-80 shadow-2xl'
            : 'static z-20 w-80 shadow-none'
        } flex h-full shrink-0 flex-col border-r transition-colors ${
          vp.isPhoneLandscape ? 'overflow-y-auto' : ''
        } ${
          isDark ? 'border-slate-800 bg-[#111827] text-slate-100' : 'border-[#E2E7EE] bg-white text-[#0F1B2D]'
        }`}
        style={{ paddingLeft: vp.isCompact ? 'env(safe-area-inset-left)' : undefined }}
      >
        {/* Compact Drawer Header (visible in both portrait & landscape phones) */}
        {vp.isCompact && (
          <div className={`flex shrink-0 items-center justify-between border-b px-3 py-2 ${isDark ? 'border-slate-800' : 'border-[#E2E7EE]'}`}>
            <span className="text-xs font-bold">Nhập toán & Danh sách</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Cài đặt phím tắt"
                onClick={() => {
                  setSidebarOpen(false);
                  window.dispatchEvent(new Event('hinhhocviet-open-shortcuts'));
                }}
                className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium ${
                  isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Keyboard className="h-3.5 w-3.5" />
                <span>Phím tắt</span>
              </button>
              <button
                type="button"
                aria-label="Đóng bảng bên"
                onClick={() => setSidebarOpen(false)}
                className={`rounded-md p-1.5 ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      {/* ==================== SMART MATH / OXYZ / FUNCTION TABS ==================== */}
      <div className={`border-b p-3 ${isDark ? 'border-slate-800' : 'border-[#E2E7EE]'}`}>
        <div
          className={`mb-2.5 grid grid-cols-3 gap-1 rounded-lg p-0.5 text-[11px] font-semibold ${
            isDark ? 'bg-slate-900' : 'bg-[#F1F5F9]'
          }`}
        >
          {[
            { id: 'smart' as const, label: 'Nhập nhanh', icon: Keyboard },
            { id: 'oxyz' as const, label: 'Tọa độ Oxyz', icon: Axis3D },
            { id: 'func' as const, label: 'Hàm số', icon: FunctionSquare },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = inputTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setInputTab(tab.id)}
                className={`flex items-center justify-center gap-1 rounded-md py-1 transition-colors ${
                  active
                    ? isDark
                      ? 'bg-slate-800 text-[#60A5FA] shadow-xs'
                      : 'bg-white text-[#1D5CE5] shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-[#0F1B2D]'
                }`}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {inputTab === 'smart' && (
          <>
            <form onSubmit={handleSubmit} className="relative">
              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder={
                  mode === '2d'
                    ? 'Nhập hàm số, điểm A(1,2), 2x+y≤4...'
                    : 'Nhập điểm A(1;2;3), mặt 2x-y+z=3...'
                }
                className={`font-math w-full rounded-lg border py-2 pr-16 pl-3 text-xs outline-none transition-colors ${
                  isDark
                    ? 'border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-[#1D5CE5]'
                    : 'border-[#CBD5E1] bg-[#FAFBFD] text-[#0F1B2D] placeholder:text-slate-400 focus:border-[#1D5CE5] focus:bg-white'
                }`}
              />
              <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-0.5">
                <button
                  type="button"
                  title="Mở bàn phím ký hiệu toán"
                  onClick={() => setShowKeyboard((k) => !k)}
                  className={`rounded p-1.5 transition-colors ${
                    showKeyboard
                      ? 'bg-[#1D5CE5]/15 text-[#1D5CE5]'
                      : isDark
                      ? 'text-slate-400 hover:bg-slate-800'
                      : 'text-slate-500 hover:bg-slate-200/70'
                  }`}
                >
                  <Keyboard className="h-3.5 w-3.5" />
                </button>
                <button
                  type="submit"
                  title="Vẽ (Enter)"
                  className="rounded-md bg-[#1D5CE5] p-1.5 text-white transition-colors hover:bg-[#174CC2]"
                >
                  <CornerDownLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>

            {/* Quick Math Keyboard */}
            {showKeyboard && (
              <div className="mt-2 grid grid-cols-6 gap-1">
                {MATH_KEYS.map((k) => (
                  <button
                    key={k.label}
                    type="button"
                    onClick={() => insertToken(k.insert)}
                    className={`font-math rounded border py-1 text-[11px] font-medium transition-colors ${
                      isDark
                        ? 'border-slate-700 bg-slate-800 text-slate-200 hover:border-[#1D5CE5]'
                        : 'border-slate-200 bg-[#F8FAFC] text-[#0F1B2D] hover:border-[#1D5CE5]'
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            )}

            {/* Collapsible Syntax Quick Examples */}
            <button
              type="button"
              onClick={() => setShowGuide((g) => !g)}
              className={`mt-2 flex items-center gap-1 text-[11px] font-medium ${
                isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-[#1D5CE5]'
              }`}
            >
              {showGuide ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <span>Ví dụ nhập nhanh (bấm để thử ngay)</span>
            </button>

            {showGuide && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {(mode === '2d' ? QUICK_EXAMPLES_2D : QUICK_EXAMPLES_3D).map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => executeSmartInput(ex)}
                    className={`font-math rounded border px-1.5 py-0.5 text-[10.5px] transition-colors ${
                      isDark
                        ? 'border-slate-700 bg-slate-900 text-slate-300 hover:border-[#1D5CE5] hover:text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-[#1D5CE5] hover:text-[#1D5CE5]'
                    }`}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {inputTab === 'oxyz' && (
          <div className="space-y-2 text-[11px]">
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => {
                  if (mode === '2d') setMode('3d');
                  updateView({ showAxes: !view.showAxes, showCoordProjections: true });
                }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border py-1.5 font-semibold transition-colors ${
                  view.showAxes
                    ? 'border-[#1D5CE5] bg-[#1D5CE5]/12 text-[#1D5CE5]'
                    : isDark
                    ? 'border-slate-700 bg-slate-900 text-slate-200'
                    : 'border-slate-300 bg-white text-slate-700'
                }`}
              >
                <Axis3D className="h-3.5 w-3.5" />
                <span>{view.showAxes ? 'Đang bật trục Oxyz' : 'Bật trục tọa độ Oxyz'}</span>
              </button>
            </div>

            {/* Point A(x; y; z) */}
            <div className={`rounded-lg border p-2 ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-[#FAFBFD]'}`}>
              <div className="mb-1 flex items-center justify-between font-semibold">
                <span>Điểm A(x; y; z)</span>
                <button
                  type="button"
                  onClick={() => {
                    const x = parseFloat(oxyzPtX) || 0;
                    const y = parseFloat(oxyzPtY) || 0;
                    const z = parseFloat(oxyzPtZ) || 0;
                    if (mode === '2d') setMode('3d');
                    updateView({ showAxes: true, showCoordProjections: true });
                    addPoint3D(x, y, z, oxyzPtName.trim() || undefined);
                  }}
                  className="rounded bg-[#1D5CE5] px-2 py-0.5 text-[10.5px] font-semibold text-white hover:bg-[#174CC2]"
                >
                  + Thêm
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1">
                <input
                  type="text"
                  value={oxyzPtName}
                  onChange={(e) => setOxyzPtName(e.target.value)}
                  placeholder="Tên"
                  className={`font-math min-w-0 rounded border px-1.5 py-1 text-center ${
                    isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
                  }`}
                />
                {[
                  { val: oxyzPtX, set: setOxyzPtX, ph: 'x' },
                  { val: oxyzPtY, set: setOxyzPtY, ph: 'y' },
                  { val: oxyzPtZ, set: setOxyzPtZ, ph: 'z' },
                ].map((c, i) => (
                  <input
                    key={i}
                    type="number"
                    step="0.5"
                    value={c.val}
                    onChange={(e) => c.set(e.target.value)}
                    placeholder={c.ph}
                    className={`font-math min-w-0 rounded border px-1.5 py-1 ${
                      isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Vector u(a; b; c) */}
            <div className={`rounded-lg border p-2 ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-[#FAFBFD]'}`}>
              <div className="mb-1 flex items-center justify-between font-semibold">
                <span>Vectơ u⃗(a; b; c)</span>
                <button
                  type="button"
                  onClick={() => {
                    if (mode === '2d') setMode('3d');
                    updateView({ showAxes: true });
                    executeSmartInput(
                      `${oxyzVecName.trim() || 'u'} = (${parseFloat(oxyzVecX) || 0}, ${parseFloat(oxyzVecY) || 0}, ${parseFloat(oxyzVecZ) || 0})`
                    );
                  }}
                  className="rounded bg-[#0E9F6E] px-2 py-0.5 text-[10.5px] font-semibold text-white hover:bg-[#059669]"
                >
                  + Vẽ
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1">
                <input
                  type="text"
                  value={oxyzVecName}
                  onChange={(e) => setOxyzVecName(e.target.value)}
                  placeholder="u"
                  className={`font-math min-w-0 rounded border px-1.5 py-1 text-center ${
                    isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
                  }`}
                />
                {[
                  { val: oxyzVecX, set: setOxyzVecX },
                  { val: oxyzVecY, set: setOxyzVecY },
                  { val: oxyzVecZ, set: setOxyzVecZ },
                ].map((c, i) => (
                  <input
                    key={i}
                    type="number"
                    step="0.5"
                    value={c.val}
                    onChange={(e) => c.set(e.target.value)}
                    className={`font-math min-w-0 rounded border px-1.5 py-1 ${
                      isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Plane ax+by+cz+d=0 & Sphere */}
            <div className={`rounded-lg border p-2 ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-[#FAFBFD]'}`}>
              <div className="mb-1 flex items-center justify-between font-semibold">
                <span>Mặt phẳng ax+by+cz+d = 0</span>
                <button
                  type="button"
                  onClick={() => {
                    if (mode === '2d') setMode('3d');
                    updateView({ showAxes: true });
                    addPlane3DFromEq(
                      parseFloat(oxyzPlA) || 0,
                      parseFloat(oxyzPlB) || 0,
                      parseFloat(oxyzPlC) || 0,
                      parseFloat(oxyzPlD) || 0
                    );
                  }}
                  className="rounded bg-[#7C3AED] px-2 py-0.5 text-[10.5px] font-semibold text-white hover:bg-[#6D28D9]"
                >
                  + Vẽ
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { val: oxyzPlA, set: setOxyzPlA, ph: 'a' },
                  { val: oxyzPlB, set: setOxyzPlB, ph: 'b' },
                  { val: oxyzPlC, set: setOxyzPlC, ph: 'c' },
                  { val: oxyzPlD, set: setOxyzPlD, ph: 'd' },
                ].map((c, i) => (
                  <input
                    key={i}
                    type="number"
                    step="0.5"
                    value={c.val}
                    onChange={(e) => c.set(e.target.value)}
                    placeholder={c.ph}
                    className={`font-math min-w-0 rounded border px-1.5 py-1 ${
                      isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
                    }`}
                  />
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between font-semibold">
                <span>Mặt cầu I(x;y;z), R</span>
                <button
                  type="button"
                  onClick={() => {
                    if (mode === '2d') setMode('3d');
                    updateView({ showAxes: true });
                    const rVal = Math.max(0.2, parseFloat(oxyzSpR) || 2);
                    const cx = parseFloat(oxyzSpX) || 0;
                    const cy = parseFloat(oxyzSpY) || 0;
                    const cz = parseFloat(oxyzSpZ) || 0;
                    executeSmartInput(`(x - (${cx}))^2 + (y - (${cy}))^2 + (z - (${cz}))^2 = ${rVal * rVal}`);
                  }}
                  className="rounded bg-[#0284C7] px-2 py-0.5 text-[10.5px] font-semibold text-white hover:bg-[#0369A1]"
                >
                  + Vẽ
                </button>
              </div>
              <div className="mt-1 grid grid-cols-4 gap-1">
                {[
                  { val: oxyzSpX, set: setOxyzSpX, ph: 'x' },
                  { val: oxyzSpY, set: setOxyzSpY, ph: 'y' },
                  { val: oxyzSpZ, set: setOxyzSpZ, ph: 'z' },
                  { val: oxyzSpR, set: setOxyzSpR, ph: 'R' },
                ].map((c, i) => (
                  <input
                    key={i}
                    type="number"
                    step="0.5"
                    value={c.val}
                    onChange={(e) => c.set(e.target.value)}
                    placeholder={c.ph}
                    className={`font-math min-w-0 rounded border px-1.5 py-1 ${
                      isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Live Oxyz Vector Calculator */}
            {(oxyzStats.abVec || oxyzStats.pair) && (
              <div className={`rounded-lg border p-2 ${isDark ? 'border-sky-900/60 bg-sky-950/30' : 'border-sky-200 bg-sky-50/70'}`}>
                <div className="mb-1 flex items-center gap-1 font-bold text-[#0284C7]">
                  <Compass className="h-3.5 w-3.5" />
                  <span>Máy tính Vectơ Oxyz</span>
                </div>
                {oxyzStats.abVec && oxyzStats.abLabel && (
                  <div className="font-math text-[10.5px]">
                    {oxyzStats.abLabel}⃗ = {formatVec3(oxyzStats.abVec)} · |{oxyzStats.abLabel}| = {formatNum(oxyzStats.abLen ?? 0, 2)}
                  </div>
                )}
                {oxyzStats.pair && (
                  <div className="font-math mt-1 space-y-0.5 text-[10.5px]">
                    <div>
                      {oxyzStats.pair.uName}⃗ · {oxyzStats.pair.vName}⃗ = {formatNum(oxyzStats.pair.dot, 2)} · ∠ = {formatNum(oxyzStats.pair.angleDeg, 1)}°
                    </div>
                    <div>
                      [{oxyzStats.pair.uName}⃗, {oxyzStats.pair.vName}⃗] = {formatVec3(oxyzStats.pair.cross)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {inputTab === 'func' && (
          <div className="space-y-2 text-[11px]">
            <div>
              <div className="mb-1 flex items-center justify-between font-semibold">
                <span>Đồ thị 2D & trên mp Oxy</span>
                <button
                  type="button"
                  onClick={() => executeSmartInput(`y = ${fnExpr2D.trim()}`)}
                  className="rounded bg-[#1D5CE5] px-2 py-0.5 text-[10.5px] font-semibold text-white hover:bg-[#174CC2]"
                >
                  Vẽ y = f(x)
                </button>
              </div>
              <input
                type="text"
                value={fnExpr2D}
                onChange={(e) => setFnExpr2D(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') executeSmartInput(`y = ${fnExpr2D.trim()}`);
                }}
                placeholder="VD: x^3 - 3*x + 2"
                className={`font-math w-full rounded-md border px-2 py-1 ${
                  isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
                }`}
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between font-semibold">
                <span>Mặt cong 3D Oxyz</span>
                <button
                  type="button"
                  onClick={() => {
                    if (mode === '2d') setMode('3d');
                    updateView({ showAxes: true });
                    executeSmartInput(`z = ${fnExpr3D.trim()}`);
                  }}
                  className="rounded bg-[#0E9F6E] px-2 py-0.5 text-[10.5px] font-semibold text-white hover:bg-[#059669]"
                >
                  Vẽ z = f(x,y)
                </button>
              </div>
              <input
                type="text"
                value={fnExpr3D}
                onChange={(e) => setFnExpr3D(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (mode === '2d') setMode('3d');
                    updateView({ showAxes: true });
                    executeSmartInput(`z = ${fnExpr3D.trim()}`);
                  }
                }}
                placeholder="VD: sin(x)*cos(y)"
                className={`font-math w-full rounded-md border px-2 py-1 ${
                  isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
                }`}
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {[
                { label: 'Bậc 3', expr: 'y = x^3 - 3*x + 2' },
                { label: 'Phân thức', expr: 'y = (2x - 1)/(x - 1)' },
                { label: 'Parabol', expr: 'y = -x^2 + 4*x - 3' },
                { label: 'z=x²+y²', expr: 'z = 0.25*(x^2 + y^2)' },
                { label: 'Sóng 3D', expr: 'z = sin(x)*cos(y)' },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    if (preset.expr.startsWith('z =') && mode === '2d') setMode('3d');
                    updateView({ showAxes: true });
                    executeSmartInput(preset.expr);
                  }}
                  className={`rounded border px-1.5 py-0.5 text-[10.5px] font-medium ${
                    isDark
                      ? 'border-slate-700 bg-slate-900 text-slate-300 hover:border-[#1D5CE5]'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-[#1D5CE5] hover:text-[#1D5CE5]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {scene3d.surfaces.some((sf) => sf.visible) && (
              <div className={`rounded-lg border p-2 ${isDark ? 'border-emerald-900/60 bg-emerald-950/30' : 'border-emerald-200 bg-emerald-50/70'}`}>
                <div className="mb-1 flex items-center justify-between font-semibold text-[#0E9F6E]">
                  <span>Chấm điểm trên mặt cong</span>
                  {surfaceEvalResult && (
                    <button
                      type="button"
                      onClick={() => {
                        if (mode === '2d') setMode('3d');
                        updateView({ showAxes: true, showCoordProjections: true });
                        addPoint3D(surfaceEvalResult.x0, surfaceEvalResult.y0, Number(surfaceEvalResult.z0.toFixed(3)));
                      }}
                      className="rounded bg-[#0E9F6E] px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-[#059669]"
                    >
                      + Chấm M
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <input
                    type="number"
                    step="0.5"
                    value={surfEvalX}
                    onChange={(e) => setSurfEvalX(e.target.value)}
                    placeholder="x₀"
                    className={`font-math min-w-0 rounded border px-1.5 py-1 ${
                      isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
                    }`}
                  />
                  <input
                    type="number"
                    step="0.5"
                    value={surfEvalY}
                    onChange={(e) => setSurfEvalY(e.target.value)}
                    placeholder="y₀"
                    className={`font-math min-w-0 rounded border px-1.5 py-1 ${
                      isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
                    }`}
                  />
                </div>
                {surfaceEvalResult && (
                  <div className="font-math mt-1 text-[10.5px]">
                    M({formatNum(surfaceEvalResult.x0, 2)}; {formatNum(surfaceEvalResult.y0, 2)}; {formatNum(surfaceEvalResult.z0, 2)})
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================== PARAMETER SLIDERS (m, h, k) ==================== */}
      <div className={`border-b px-3 py-2.5 ${isDark ? 'border-slate-800' : 'border-[#E2E7EE]'}`}>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold">
            <Sliders className="h-3.5 w-3.5 text-[#1D5CE5]" />
            <span>Tham số động</span>
          </span>
          <button
            type="button"
            onClick={() => {
              const names = ['m', 'k', 'a', 'b', 'h', 't'];
              const next = names.find((n) => !sliders.some((sl) => sl.name === n)) ?? `p${sliders.length + 1}`;
              addSlider(next, 1, -5, 5);
            }}
            className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium text-[#1D5CE5] hover:bg-[#1D5CE5]/10"
          >
            <Plus className="h-3 w-3" />
            <span>Thêm</span>
          </button>
        </div>

        {sliders.length === 0 ? (
          <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Gõ hàm chứa tham số (vd: <code className="font-math">y = x^3 - 3mx</code>) để tự động sinh thanh trượt
          </p>
        ) : (
          <div className="space-y-2">
            {sliders.map((sl) => (
              <div
                key={sl.id}
                className={`rounded-md border px-2.5 py-1.5 ${
                  isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-[#FAFBFD]'
                }`}
              >
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-math font-semibold text-[#1D5CE5]">
                    {sl.name} = {formatNum(sl.value, 2)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title={sl.playing ? 'Tạm dừng' : 'Chạy tự động'}
                      onClick={() => toggleSliderPlay(sl.id)}
                      className={`rounded p-1 ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-200/70'}`}
                    >
                      {sl.playing ? <Pause className="h-3 w-3 text-[#E06D1F]" /> : <Play className="h-3 w-3 text-[#0E9F6E]" />}
                    </button>
                    <button
                      type="button"
                      title="Xóa tham số"
                      onClick={() => removeSlider(sl.id)}
                      className="rounded p-1 opacity-55 hover:text-red-500 hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min={sl.min}
                  max={sl.max}
                  step={sl.step}
                  value={sl.value}
                  onChange={(e) => setSliderValue(sl.id, parseFloat(e.target.value))}
                  className="math-slider w-full"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==================== OBJECT EXPLORER & AUTO INSPECTOR ==================== */}
      <div className={`${vp.isPhoneLandscape ? 'space-y-3 p-3' : 'flex-1 space-y-4 overflow-y-auto p-3'}`}>
        {/* ---------- 3D OBJECTS LIST ---------- */}
        {show3DList && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1D5CE5]">Không gian 3D (Oxyz)</span>
              <span className={`font-math text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {scene3d.polyhedra.length +
                  scene3d.solids.length +
                  scene3d.planes.length +
                  scene3d.surfaces.length +
                  (scene3d.nets?.length ?? 0) +
                  (scene3d.curves?.length ?? 0) +
                  scene3d.vectors.length +
                  scene3d.points.length +
                  scene3d.segments.length +
                  scene3d.lines.length +
                  scene3d.crossSections.length}{' '}
                đối tượng
              </span>
            </div>

            {/* Polyhedra */}
            {scene3d.polyhedra.map((poly) => {
              const vol = polyhedronVolume(poly, ptMap3D);
              const area = polyhedronSurfaceArea(poly, ptMap3D);
              return (
                <div
                  key={poly.id}
                  onClick={(e) => selectItem({ domain: '3d', type: 'polyhedron', id: poly.id }, e.shiftKey || e.ctrlKey)}
                  className={rowCls(isSelected('3d', 'polyhedron', poly.id))}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-xs" style={{ backgroundColor: poly.color }} />
                      <span className="truncate">{poly.name}</span>
                    </div>
                    <div className={`font-math mt-0.5 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      V = {formatNum(vol, 2)} · S_tp = {formatNum(area, 2)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button type="button" onClick={(e) => { e.stopPropagation(); toggleVisibility('3d', 'polyhedron', poly.id); }} className="rounded p-1 opacity-65 hover:opacity-100">
                      {poly.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); deleteObject('3d', 'polyhedron', poly.id); }} className="rounded p-1 opacity-55 hover:text-red-500 hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Cross Sections */}
            {scene3d.crossSections.map((cs) => {
              const poly = scene3d.polyhedra.find((p) => p.id === cs.polyhedronId);
              let secArea: number | null = null;
              let vCount = 0;
              if (poly) {
                let eq = null;
                if (cs.planeId) {
                  const pl = scene3d.planes.find((p) => p.id === cs.planeId);
                  if (pl) eq = resolvePlaneEq(pl, ptMap3D);
                } else if (cs.pointIds) {
                  const a = ptMap3D.get(cs.pointIds[0]);
                  const b = ptMap3D.get(cs.pointIds[1]);
                  const c = ptMap3D.get(cs.pointIds[2]);
                  if (a && b && c) eq = planeFrom3Points(a, b, c);
                }
                if (eq) {
                  const res = slicePolyhedronByPlane(poly, ptMap3D, eq);
                  if (res) {
                    secArea = res.area;
                    vCount = res.vertices.length;
                  }
                }
              }
              return (
                <div key={cs.id} className={rowCls(isSelected('3d', 'crossSection', cs.id))}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-xs" style={{ backgroundColor: cs.color }} />
                      <span className="truncate">{cs.name}</span>
                    </div>
                    <div className={`font-math mt-0.5 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {secArea !== null ? `Đa giác ${vCount} cạnh · S = ${formatNum(secArea, 2)}` : 'Không cắt khối đa diện'}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button type="button" onClick={() => toggleVisibility('3d', 'crossSection', cs.id)} className="rounded p-1 opacity-65 hover:opacity-100">
                      {cs.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <button type="button" onClick={() => deleteObject('3d', 'crossSection', cs.id)} className="rounded p-1 opacity-55 hover:text-red-500 hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Solids (Sphere, Cone, Cylinder, Revolution) */}
            {scene3d.solids.map((solid) => {
              const r = solid.radius;
              const h = solid.height ?? 0;
              let formulaLine = '';
              if (solid.kind === 'sphere') {
                formulaLine = `I${formatVec3(solid.center)}, R=${formatNum(r)} · V=${formatNum((4 / 3) * r * r * r, 2)}π`;
              } else if (solid.kind === 'cone') {
                const l = Math.hypot(r, h);
                formulaLine = `R=${formatNum(r)}, h=${formatNum(h)}, l=${formatNum(l)} · V=${formatNum((r * r * h) / 3, 2)}π`;
              } else if (solid.kind === 'cylinder') {
                formulaLine = `R=${formatNum(r)}, h=${formatNum(h)} · V=${formatNum(r * r * h, 2)}π`;
              } else if (solid.kind === 'revolution' && solid.funcExpr && solid.domain) {
                const res = computeIntegral2D(solid.funcExpr, solid.domain[0], solid.domain[1], sliderScope);
                formulaLine = `V = π∫f²(x)dx = ${formatNum(res.volumeOx / Math.PI, 2)}π ≈ ${formatNum(res.volumeOx, 2)}`;
              }
              return (
                <div key={solid.id} className={rowCls(isSelected('3d', 'solid', solid.id))}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: solid.color }} />
                      <span className="truncate">{solid.name}</span>
                    </div>
                    <div className={`font-math mt-0.5 text-[10.5px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {formulaLine}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button type="button" onClick={() => toggleVisibility('3d', 'solid', solid.id)} className="rounded p-1 opacity-65 hover:opacity-100">
                      {solid.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <button type="button" onClick={() => deleteObject('3d', 'solid', solid.id)} className="rounded p-1 opacity-55 hover:text-red-500 hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Planes */}
            {scene3d.planes.map((pl) => {
              const eq = resolvePlaneEq(pl, ptMap3D);
              return (
                <div
                  key={pl.id}
                  onClick={(e) => selectItem({ domain: '3d', type: 'plane', id: pl.id }, e.shiftKey || e.ctrlKey)}
                  className={rowCls(isSelected('3d', 'plane', pl.id))}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-xs" style={{ backgroundColor: pl.color }} />
                      <span className="truncate">Mặt phẳng {pl.name}</span>
                    </div>
                    {eq && (
                      <div className={`font-math mt-0.5 truncate text-[10.5px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {formatPlaneEq(eq)}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button type="button" onClick={(e) => { e.stopPropagation(); toggleVisibility('3d', 'plane', pl.id); }} className="rounded p-1 opacity-65 hover:opacity-100">
                      {pl.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); deleteObject('3d', 'plane', pl.id); }} className="rounded p-1 opacity-55 hover:text-red-500 hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Surfaces */}
            {scene3d.surfaces.map((sf) => (
              <div key={sf.id} className={rowCls(isSelected('3d', 'surface', sf.id))}>
                <div className="min-w-0 flex-1">
                  <div className="font-math truncate font-semibold">{sf.name}</div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button type="button" onClick={() => toggleVisibility('3d', 'surface', sf.id)} className="rounded p-1 opacity-65 hover:opacity-100">
                    {sf.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => deleteObject('3d', 'surface', sf.id)} className="rounded p-1 opacity-55 hover:text-red-500 hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {/* 3D Nets (Trải phẳng đa diện) */}
            {(scene3d.nets ?? []).map((net) => (
              <div key={net.id} className={rowCls(isSelected('3d', 'net', net.id))}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-xs" style={{ backgroundColor: net.color }} />
                    <span className="truncate">{net.name}</span>
                  </div>
                  <div className={`text-[10.5px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Kéo thanh trượt <span className="font-math font-semibold">{net.sliderName}</span> để trải phẳng
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button type="button" onClick={() => toggleVisibility('3d', 'net', net.id)} className="rounded p-1 opacity-65 hover:opacity-100">
                    {net.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => deleteObject('3d', 'net', net.id)} className="rounded p-1 opacity-55 hover:text-red-500 hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {/* 3D Curves on Oxy */}
            {(scene3d.curves ?? []).map((cv) => (
              <div key={cv.id} className={rowCls(false)}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: cv.color }} />
                    <span className="font-math truncate">{cv.name}</span>
                  </div>
                  <div className={`font-math text-[10.5px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    y = {cv.expr} trên (Oxy)
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button type="button" onClick={() => toggleVisibility('3d', 'curve', cv.id)} className="rounded p-1 opacity-65 hover:opacity-100">
                    {cv.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => deleteObject('3d', 'curve', cv.id)} className="rounded p-1 opacity-55 hover:text-red-500 hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {/* 3D Segments & Lines & Measurements */}
            {scene3d.segments.map((seg) => {
              const p1 = ptMap3D.get(seg.p1Id);
              const p2 = ptMap3D.get(seg.p2Id);
              const len = p1 && p2 ? dist3(p1, p2) : null;
              return (
                <div
                  key={seg.id}
                  onClick={(e) => selectItem({ domain: '3d', type: 'segment', id: seg.id }, e.shiftKey || e.ctrlKey)}
                  className={rowCls(isSelected('3d', 'segment', seg.id))}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="h-0.5 w-3 shrink-0" style={{ backgroundColor: seg.color }} />
                      <span className="truncate">{seg.name}</span>
                      {len !== null && <span className="font-math text-[11px] opacity-65">= {formatNum(len, 2)}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      title="Đổi nét liền / nét đứt"
                      onClick={(e) => { e.stopPropagation(); toggleSegment3DStyle(seg.id); }}
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                        isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {seg.style === 'dashed' ? 'Đứt' : 'Liền'}
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); deleteObject('3d', 'segment', seg.id); }} className="rounded p-1 opacity-55 hover:text-red-500 hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {scene3d.lines.map((ln) => (
              <div
                key={ln.id}
                onClick={(e) => selectItem({ domain: '3d', type: 'line', id: ln.id }, e.shiftKey || e.ctrlKey)}
                className={rowCls(isSelected('3d', 'line', ln.id))}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{ln.name}</div>
                  <div className={`font-math text-[10.5px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    u⃗ = {formatVec3(ln.dir)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button type="button" onClick={(e) => { e.stopPropagation(); toggleVisibility('3d', 'line', ln.id); }} className="rounded p-1 opacity-65 hover:opacity-100">
                    {ln.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); deleteObject('3d', 'line', ln.id); }} className="rounded p-1 opacity-55 hover:text-red-500 hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {scene3d.measurements.map((m) => (
              <div key={m.id} className={rowCls(false)}>
                <div className="min-w-0 flex-1 font-semibold text-violet-600 dark:text-violet-400">{m.name}</div>
                <button type="button" onClick={() => deleteObject('3d', 'measurement', m.id)} className="rounded p-1 opacity-55 hover:text-red-500 hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* 3D Points with inline coordinate editor when selected */}
            {scene3d.points.length > 0 && (
              <div className="space-y-1 pt-1">
                <div className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Các điểm 3D (Shift+Nhấp chọn nhiều điểm)
                </div>
                {scene3d.points.map((pt) => {
                  const pos = ptMap3D.get(pt.id) ?? [pt.x, pt.y, pt.z];
                  const sel = isSelected('3d', 'point', pt.id);
                  return (
                    <div
                      key={pt.id}
                      onClick={(e) => selectItem({ domain: '3d', type: 'point', id: pt.id }, e.shiftKey || e.ctrlKey)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        openRenamePoint('3d', pt.id);
                      }}
                      className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                        sel
                          ? 'border-[#1D5CE5] bg-[#1D5CE5]/10'
                          : isDark
                          ? 'border-transparent hover:bg-slate-800/70'
                          : 'border-transparent hover:bg-[#F2F5F9]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pt.color }} />
                          <span className="font-semibold">{pt.name}</span>
                          <span className="font-math text-[11px] opacity-75">{formatVec3(pos)}</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            title="Sửa tên điểm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openRenamePoint('3d', pt.id);
                            }}
                            className="rounded p-1 opacity-60 hover:text-[#1D5CE5] hover:opacity-100"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); toggleVisibility('3d', 'point', pt.id); }} className="rounded p-1 opacity-60 hover:opacity-100">
                            {pt.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          </button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); deleteObject('3d', 'point', pt.id); }} className="rounded p-1 opacity-55 hover:text-red-500 hover:opacity-100">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      {sel && !pt.computed && (
                        <div className="mt-1.5 grid grid-cols-3 gap-1" onClick={(e) => e.stopPropagation()}>
                          {(['x', 'y', 'z'] as const).map((axis, idx) => (
                            <label key={axis} className="flex items-center gap-1 text-[10px]">
                              <span className="opacity-65">{axis}</span>
                              <input
                                type="number"
                                step="0.5"
                                value={Number(pos[idx].toFixed(2))}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value);
                                  if (!Number.isFinite(v)) return;
                                  const next: [number, number, number] = [...pos];
                                  next[idx] = v;
                                  updatePoint3DCoords(pt.id, next);
                                }}
                                className={`font-math w-full rounded border px-1 py-0.5 text-[11px] ${
                                  isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
                                }`}
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ---------- 2D OBJECTS LIST ---------- */}
        {show2DList && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0E9F6E]">Mặt phẳng 2D (Oxy)</span>
              <span className={`font-math text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {scene2d.functions.length +
                  scene2d.conics.length +
                  scene2d.inequalities.length +
                  scene2d.polygons.length +
                  scene2d.circles.length +
                  scene2d.points.length}{' '}
                đối tượng
              </span>
            </div>

            {/* Functions with Integral + Tangent + Table + Revolve 3D Controls */}
            {scene2d.functions.map((fn) => {
              const intData = fn.integral?.enabled
                ? computeIntegral2D(fn.expr, fn.integral.a, fn.integral.b, sliderScope)
                : null;
              const tanX0 = fn.tangent?.x0 ?? 1;
              const tanY0 = fn.tangent?.enabled
                ? safeEval(fn.expr, { ...sliderScope, x: tanX0 })
                : null;
              const tanSlope = fn.tangent?.enabled
                ? evalDerivative2D(fn.expr, tanX0, sliderScope)
                : null;
              const tanB =
                tanY0 !== null && Number.isFinite(tanY0) && tanSlope !== null && Number.isFinite(tanSlope)
                  ? tanY0 - tanSlope * tanX0
                  : null;
              return (
                <div
                  key={fn.id}
                  className={`rounded-lg border p-2 text-xs ${
                    isDark ? 'border-slate-800 bg-slate-900/60' : 'border-[#DCE3EC] bg-[#FAFBFD]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: fn.color }} />
                      <span className="font-math truncate font-semibold">y = {fn.expr}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button type="button" onClick={() => toggleVisibility('2d', 'function', fn.id)} className="rounded p-1 opacity-65 hover:opacity-100">
                        {fn.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      <button type="button" onClick={() => deleteObject('2d', 'function', fn.id)} className="rounded p-1 opacity-55 hover:text-red-500 hover:opacity-100">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Function Analysis Controls */}
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        toggleFunctionIntegral(fn.id, { enabled: !(fn.integral?.enabled ?? false) })
                      }
                      className={`rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        fn.integral?.enabled
                          ? 'border-[#1D5CE5] bg-[#1D5CE5]/12 text-[#1D5CE5]'
                          : isDark
                          ? 'border-slate-700 text-slate-300'
                          : 'border-slate-300 text-slate-600'
                      }`}
                    >
                      ∫ Tích phân
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        toggleFunctionTangent(fn.id, { enabled: !(fn.tangent?.enabled ?? false) })
                      }
                      className={`rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        fn.tangent?.enabled
                          ? 'border-[#E06D1F] bg-[#E06D1F]/12 text-[#E06D1F]'
                          : isDark
                          ? 'border-slate-700 text-slate-300'
                          : 'border-slate-300 text-slate-600'
                      }`}
                    >
                      Tiếp tuyến
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFunctionTable(fn.id)}
                      className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        fn.showTable
                          ? 'border-[#7C3AED] bg-[#7C3AED]/12 text-[#7C3AED]'
                          : isDark
                          ? 'border-slate-700 text-slate-300'
                          : 'border-slate-300 text-slate-600'
                      }`}
                    >
                      <Table2 className="h-3 w-3" />
                      <span>Bảng x|y</span>
                    </button>
                    <button
                      type="button"
                      title="Quay đồ thị quanh trục Ox sang khung 3D"
                      onClick={() => revolveFunctionTo3D(fn.id)}
                      className="flex items-center gap-1 rounded border border-[#0E9F6E]/40 bg-[#0E9F6E]/10 px-2 py-0.5 text-[11px] font-medium text-[#0E9F6E] hover:bg-[#0E9F6E]/20"
                    >
                      <Rotate3D className="h-3 w-3" />
                      <span>Xoay 3D</span>
                    </button>
                  </div>

                  {fn.integral?.enabled && (
                    <div className="mt-2 space-y-1.5 border-t border-slate-200/60 pt-2 dark:border-slate-800">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-1.5 text-[11px]">
                          <span className="shrink-0 whitespace-nowrap font-math opacity-75">a =</span>
                          <input
                            type="number"
                            step="0.5"
                            value={fn.integral.a}
                            onChange={(e) => toggleFunctionIntegral(fn.id, { a: parseFloat(e.target.value) || 0 })}
                            className={`font-math min-w-0 flex-1 rounded border px-1.5 py-0.5 text-[11px] ${
                              isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
                            }`}
                          />
                        </label>
                        <label className="flex items-center gap-1.5 text-[11px]">
                          <span className="shrink-0 whitespace-nowrap font-math opacity-75">b =</span>
                          <input
                            type="number"
                            step="0.5"
                            value={fn.integral.b}
                            onChange={(e) => toggleFunctionIntegral(fn.id, { b: parseFloat(e.target.value) || 0 })}
                            className={`font-math min-w-0 flex-1 rounded border px-1.5 py-0.5 text-[11px] ${
                              isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
                            }`}
                          />
                        </label>
                      </div>
                      {intData && (
                        <div className="font-math text-[10.5px] text-[#1D5CE5]">
                          S = {formatNum(intData.area, 3)} · V_Ox = {formatNum(intData.volumeOx / Math.PI, 2)}π
                        </div>
                      )}
                    </div>
                  )}

                  {fn.tangent?.enabled && (
                    <div className="mt-2 space-y-1 border-t border-slate-200/60 pt-2 dark:border-slate-800">
                      <label className="flex items-center gap-1.5 text-[11px]">
                        <span className="shrink-0 whitespace-nowrap font-math opacity-75">Tại x₀ =</span>
                        <input
                          type="number"
                          step="0.25"
                          value={tanX0}
                          onChange={(e) =>
                            toggleFunctionTangent(fn.id, { x0: parseFloat(e.target.value) || 0 })
                          }
                          className={`font-math min-w-0 flex-1 rounded border px-1.5 py-0.5 text-[11px] ${
                            isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
                          }`}
                        />
                      </label>
                      {tanY0 !== null && tanSlope !== null && tanB !== null && (
                        <div className="font-math text-[10.5px] text-[#E06D1F]">
                          y = {formatNum(tanSlope, 2)}x {tanB >= 0 ? '+' : '-'} {formatNum(Math.abs(tanB), 2)} · f'(x₀)={formatNum(tanSlope, 2)}
                        </div>
                      )}
                    </div>
                  )}

                  {fn.showTable && (
                    <div className="mt-2 space-y-1.5 border-t border-slate-200/60 pt-2 dark:border-slate-800">
                      <div className={`overflow-hidden rounded border text-[10.5px] ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                        <div className={`grid grid-cols-3 px-2 py-1 font-semibold ${isDark ? 'bg-slate-800/80' : 'bg-slate-100'}`}>
                          <span>x</span>
                          <span>f(x)</span>
                          <span>f'(x)</span>
                        </div>
                        {[-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2].map((xv) => {
                          const yv = safeEval(fn.expr, { ...sliderScope, x: xv });
                          const dv = evalDerivative2D(fn.expr, xv, sliderScope);
                          return (
                            <div
                              key={xv}
                              className={`font-math grid grid-cols-3 border-t px-2 py-0.5 ${
                                isDark ? 'border-slate-800/80' : 'border-slate-200/70'
                              }`}
                            >
                              <span>{formatNum(xv, 1)}</span>
                              <span>{Number.isFinite(yv) ? formatNum(yv, 2) : '∅'}</span>
                              <span className="opacity-75">{dv !== null ? formatNum(dv, 2) : '—'}</span>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => plotFunctionTablePoints2D(fn.id, -2, 2, 1)}
                        className="w-full rounded bg-[#7C3AED] py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#6D28D9]"
                      >
                        Chấm tọa độ lên đồ thị
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Conics */}
            {scene2d.conics.map((cn) => (
              <div key={cn.id} className={rowCls(false)}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cn.color }} />
                    <span className="truncate">{cn.name}</span>
                  </div>
                  <div className="font-math text-[10.5px] opacity-70">
                    a = {formatNum(cn.a, 2)}, b = {formatNum(cn.b, 2)}
                  </div>
                </div>
                <button type="button" onClick={() => deleteObject('2d', 'conic', cn.id)} className="rounded p-1 opacity-55 hover:text-red-500 hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* Inequalities */}
            {scene2d.inequalities.map((iq) => (
              <div key={iq.id} className={rowCls(false)}>
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: iq.color }} />
                  <span className="font-math truncate font-medium">{iq.name}</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => toggleVisibility('2d', 'inequality', iq.id)} className="rounded p-1 opacity-65 hover:opacity-100">
                    {iq.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => deleteObject('2d', 'inequality', iq.id)} className="rounded p-1 opacity-55 hover:text-red-500 hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {/* Polygons */}
            {scene2d.polygons.map((pg) => {
              const pts = pg.pointIds.map((id) => ptMap2D.get(id)).filter((v): v is [number, number] => Boolean(v));
              const area = polygonArea2D(pts);
              return (
                <div key={pg.id} className={rowCls(false)}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{pg.name}</div>
                    <div className="font-math text-[10.5px] opacity-70">S = {formatNum(area, 2)}</div>
                  </div>
                  <button type="button" onClick={() => deleteObject('2d', 'polygon', pg.id)} className="rounded p-1 opacity-55 hover:text-red-500 hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}

            {/* Circles */}
            {scene2d.circles.map((c) => {
              const center = c.centerId ? ptMap2D.get(c.centerId) ?? c.center : c.center;
              const radPt = c.radiusPointId ? ptMap2D.get(c.radiusPointId) : null;
              const r = radPt ? dist2D(center, radPt) : c.radius;
              return (
                <div key={c.id} className={rowCls(false)}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{c.name}</div>
                    <div className="font-math text-[10.5px] opacity-70">
                      Tâm ({formatNum(center[0])}; {formatNum(center[1])}), R = {formatNum(r, 2)}
                    </div>
                  </div>
                  <button type="button" onClick={() => deleteObject('2d', 'circle', c.id)} className="rounded p-1 opacity-55 hover:text-red-500 hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}

            {/* Lines */}
            {scene2d.lines.map((ln) => {
              const eq = resolveLine2D(ln, ptMap2D);
              return (
                <div key={ln.id} className={rowCls(false)}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{ln.name}</div>
                    <div className="font-math text-[10.5px] opacity-70">{formatLine2DEq(eq.a, eq.b, eq.c)}</div>
                  </div>
                  <button type="button" onClick={() => deleteObject('2d', 'line', ln.id)} className="rounded p-1 opacity-55 hover:text-red-500 hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}

            {/* 2D Points */}
            {scene2d.points.map((pt) => {
              const pos = ptMap2D.get(pt.id) ?? [pt.x, pt.y];
              return (
                <div
                  key={pt.id}
                  onClick={(e) => selectItem({ domain: '2d', type: 'point', id: pt.id }, e.shiftKey || e.ctrlKey)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    openRenamePoint('2d', pt.id);
                  }}
                  className={rowCls(isSelected('2d', 'point', pt.id))}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: pt.color }} />
                    <span className="truncate font-semibold">{pt.name}</span>
                    <span className="font-math text-[11px] opacity-75">
                      ({formatNum(pos[0])}; {formatNum(pos[1])})
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      title="Sửa tên điểm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRenamePoint('2d', pt.id);
                      }}
                      className="rounded p-1 opacity-60 hover:text-[#1D5CE5] hover:opacity-100"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); deleteObject('2d', 'point', pt.id); }} className="rounded p-1 opacity-55 hover:text-red-500 hover:opacity-100">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
    </>
  );
};
