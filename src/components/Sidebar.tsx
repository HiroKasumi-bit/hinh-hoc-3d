import React, { useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  Eye,
  EyeOff,
  Keyboard,
  Pause,
  Play,
  Plus,
  Rotate3D,
  Sliders,
  Trash2,
} from 'lucide-react';
import { useGeometryStore } from '../store/useGeometryStore';
import { computeIntegral2D, dist2D, formatLine2DEq, formatNum, polygonArea2D, resolveLine2D, resolvePoints2D } from '../math/geometry2d';
import {
  dist3,
  formatPlaneEq,
  formatVec3,
  polyhedronSurfaceArea,
  polyhedronVolume,
  resolvePlaneEq,
  resolvePoints3D,
  slicePolyhedronByPlane,
  planeFrom3Points,
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
  const setSliderValue = useGeometryStore((s) => s.setSliderValue);
  const toggleSliderPlay = useGeometryStore((s) => s.toggleSliderPlay);
  const addSlider = useGeometryStore((s) => s.addSlider);
  const removeSlider = useGeometryStore((s) => s.removeSlider);
  const selectItem = useGeometryStore((s) => s.selectItem);
  const toggleVisibility = useGeometryStore((s) => s.toggleVisibility);
  const deleteObject = useGeometryStore((s) => s.deleteObject);
  const updatePoint3DCoords = useGeometryStore((s) => s.updatePoint3DCoords);
  const toggleSegment3DStyle = useGeometryStore((s) => s.toggleSegment3DStyle);
  const toggleFunctionIntegral = useGeometryStore((s) => s.toggleFunctionIntegral);
  const revolveFunctionTo3D = useGeometryStore((s) => s.revolveFunctionTo3D);

  const [inputVal, setInputVal] = useState('');
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    <aside
      className={`z-20 flex h-full w-80 shrink-0 flex-col border-r transition-colors ${
        isDark ? 'border-slate-800 bg-[#111827] text-slate-100' : 'border-[#E2E7EE] bg-white text-[#0F1B2D]'
      }`}
    >
      {/* ==================== SMART MATH INPUT ==================== */}
      <div className={`border-b p-3 ${isDark ? 'border-slate-800' : 'border-[#E2E7EE]'}`}>
        <form onSubmit={handleSubmit} className="relative">
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder={
              mode === '2d'
                ? 'Nhập hàm số, điểm A(1,2), 2x+y≤4...'
                : 'Nhập điểm A(1,2,3), mặt 2x-y+z=3...'
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
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {/* ---------- 3D OBJECTS LIST ---------- */}
        {show3DList && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1D5CE5]">Không gian 3D (Oxyz)</span>
              <span className={`font-math text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {scene3d.polyhedra.length +
                  scene3d.solids.length +
                  scene3d.planes.length +
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

            {/* Functions with Integral + Revolve 3D Controls */}
            {scene2d.functions.map((fn) => {
              const intData = fn.integral?.enabled
                ? computeIntegral2D(fn.expr, fn.integral.a, fn.integral.b, sliderScope)
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

                  {/* Integral & 3D Revolution mini panel */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
                      ∫ Tích phân [a; b]
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
                  className={rowCls(isSelected('2d', 'point', pt.id))}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: pt.color }} />
                    <span className="truncate font-semibold">{pt.name}</span>
                    <span className="font-math text-[11px] opacity-75">
                      ({formatNum(pos[0])}; {formatNum(pos[1])})
                    </span>
                  </div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); deleteObject('2d', 'point', pt.id); }} className="rounded p-1 opacity-55 hover:text-red-500 hover:opacity-100">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
