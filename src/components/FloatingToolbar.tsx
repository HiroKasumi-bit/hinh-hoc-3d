import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpRight,
  Box,
  CheckSquare,
  Circle,
  Compass,
  Dot,
  Hexagon,
  Layers,
  Minus,
  MousePointer2,
  MoveDiagonal,
  Plus,
  Ruler,
  Scissors,
  Square,
  Triangle,
  X,
} from 'lucide-react';
import { useGeometryStore, type QuickSolid3DType } from '../store/useGeometryStore';
import { useViewportProfile } from '../hooks/useViewportProfile';
import { formatShortcutBadge, type ShortcutActionId } from '../types/shortcuts';
import type { Tool2D, Tool3D } from '../types/geometry';

export const FloatingToolbar: React.FC<{ domain: '2d' | '3d'; compact?: boolean }> = ({ domain, compact = false }) => {
  const vp = useViewportProfile();
  const activeTool2D = useGeometryStore((s) => s.activeTool2D);
  const activeTool3D = useGeometryStore((s) => s.activeTool3D);
  const setTool2D = useGeometryStore((s) => s.setTool2D);
  const setTool3D = useGeometryStore((s) => s.setTool3D);
  const multiSelectMode = useGeometryStore((s) => s.multiSelectMode);
  const toggleMultiSelectMode = useGeometryStore((s) => s.toggleMultiSelectMode);
  const shortcuts = useGeometryStore((s) => s.shortcuts);
  const view = useGeometryStore((s) => s.view);
  const addQuickSolid3D = useGeometryStore((s) => s.addQuickSolid3D);
  const addPoint3D = useGeometryStore((s) => s.addPoint3D);
  const addPlane3DFromEq = useGeometryStore((s) => s.addPlane3DFromEq);
  const addLine3DFromPointDir = useGeometryStore((s) => s.addLine3DFromPointDir);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderTab, setBuilderTab] = useState<'poly' | 'round' | 'oxyz'>('poly');

  useEffect(() => {
    if (domain !== '3d') return;
    const onOpenBuilder = () => setBuilderOpen(true);
    window.addEventListener('hinhhocviet-open-builder', onOpenBuilder);
    return () => window.removeEventListener('hinhhocviet-open-builder', onOpenBuilder);
  }, [domain]);

  useEffect(() => {
    if (!builderOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBuilderOpen(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [builderOpen]);

  // Form states for visual no-syntax 3D creation
  const [solidType, setSolidType] = useState<QuickSolid3DType>('pyramid_sa_square');
  const [dimA, setDimA] = useState('3');
  const [dimB, setDimB] = useState('3');
  const [dimH, setDimH] = useState('3.5');
  const [dimR, setDimR] = useState('2');

  const [ptName, setPtName] = useState('');
  const [ptX, setPtX] = useState('1');
  const [ptY, setPtY] = useState('2');
  const [ptZ, setPtZ] = useState('3');

  const [plA, setPlA] = useState('1');
  const [plB, setPlB] = useState('1');
  const [plC, setPlC] = useState('1');
  const [plD, setPlD] = useState('-3');

  const [lnX0, setLnX0] = useState('1');
  const [lnY0, setLnY0] = useState('0');
  const [lnZ0, setLnZ0] = useState('1');
  const [lnU, setLnU] = useState('1');
  const [lnV, setLnV] = useState('2');
  const [lnW, setLnW] = useState('-1');

  const isDark = view.theme === 'dark';

  const tools2D: Array<{ id: Tool2D; label: string; short: string; shortcutId: ShortcutActionId; icon: React.ReactNode }> = [
    { id: 'select', label: 'Chọn / Kéo điểm', short: 'Chọn', shortcutId: 'tool_select', icon: <MousePointer2 className="h-3.5 w-3.5" /> },
    { id: 'point', label: 'Chấm điểm', short: 'Điểm', shortcutId: 'tool_point', icon: <Dot className="h-4 w-4" /> },
    { id: 'segment', label: 'Đoạn thẳng', short: 'Đoạn', shortcutId: 'tool_segment', icon: <Minus className="h-3.5 w-3.5" /> },
    { id: 'line', label: 'Đường thẳng', short: 'Đường', shortcutId: 'tool_line', icon: <MoveDiagonal className="h-3.5 w-3.5" /> },
    { id: 'vector', label: 'Vectơ', short: 'Vectơ', shortcutId: 'tool_vector', icon: <ArrowUpRight className="h-3.5 w-3.5" /> },
    { id: 'circle', label: 'Đường tròn', short: 'Tròn', shortcutId: 'tool_circle_or_builder', icon: <Circle className="h-3.5 w-3.5" /> },
    { id: 'polygon', label: 'Đa giác', short: 'Đa giác', shortcutId: 'tool_plane_or_polygon', icon: <Hexagon className="h-3.5 w-3.5" /> },
    { id: 'midpoint', label: 'Trung điểm', short: 'T.điểm', shortcutId: 'tool_midpoint', icon: <Triangle className="h-3.5 w-3.5" /> },
    { id: 'perpendicular', label: 'Đường vuông góc', short: 'Vuông góc', shortcutId: 'tool_section_or_perp', icon: <Square className="h-3.5 w-3.5" /> },
    { id: 'angle', label: 'Đo góc', short: 'Góc', shortcutId: 'tool_angle', icon: <Compass className="h-3.5 w-3.5" /> },
    { id: 'distance', label: 'Đo độ dài', short: 'Đo cạnh', shortcutId: 'tool_distance', icon: <Ruler className="h-3.5 w-3.5" /> },
  ];

  const tools3D: Array<{ id: Tool3D; label: string; short: string; shortcutId: ShortcutActionId; icon: React.ReactNode }> = [
    { id: 'select', label: 'Chọn / Xoay 3D', short: 'Chọn', shortcutId: 'tool_select', icon: <MousePointer2 className="h-3.5 w-3.5" /> },
    { id: 'point', label: 'Chấm điểm (nhấn giữ kéo độ cao z)', short: 'Điểm', shortcutId: 'tool_point', icon: <Dot className="h-4 w-4" /> },
    { id: 'segment', label: 'Nối đoạn thẳng', short: 'Đoạn', shortcutId: 'tool_segment', icon: <Minus className="h-3.5 w-3.5" /> },
    { id: 'tetrahedron3d', label: 'Chóp tứ diện S.ABC (chọn 3 điểm)', short: 'Tứ diện', shortcutId: 'tool_tetrahedron3d', icon: <Triangle className="h-3.5 w-3.5" /> },
    { id: 'pyramid4_3d', label: 'Chóp tứ giác S.ABCD (2 điểm đáy + điểm thứ 3)', short: 'Chóp 4', shortcutId: 'tool_pyramid4_3d', icon: <Hexagon className="h-3.5 w-3.5" /> },
    { id: 'box3d', label: 'Hình lập phương / Khối hộp (2 điểm cạnh đáy)', short: 'Khối hộp', shortcutId: 'tool_box3d', icon: <Box className="h-3.5 w-3.5" /> },
    { id: 'line', label: 'Đường thẳng Oxyz', short: 'Đường', shortcutId: 'tool_line', icon: <MoveDiagonal className="h-3.5 w-3.5" /> },
    { id: 'vector', label: 'Vectơ 3D', short: 'Vectơ', shortcutId: 'tool_vector', icon: <ArrowUpRight className="h-3.5 w-3.5" /> },
    { id: 'plane3p', label: 'Mặt phẳng qua 3 điểm', short: 'Mặt phẳng', shortcutId: 'tool_plane_or_polygon', icon: <Layers className="h-3.5 w-3.5" /> },
    { id: 'midpoint', label: 'Trung điểm', short: 'T.điểm', shortcutId: 'tool_midpoint', icon: <Dot className="h-3.5 w-3.5" /> },
    { id: 'crossSection', label: 'Cắt thiết diện (3 điểm)', short: 'Thiết diện', shortcutId: 'tool_section_or_perp', icon: <Scissors className="h-3.5 w-3.5" /> },
    { id: 'distance', label: 'Đo khoảng cách', short: 'K.cách', shortcutId: 'tool_distance', icon: <Ruler className="h-3.5 w-3.5" /> },
    { id: 'angle', label: 'Đo góc không gian', short: 'Góc', shortcutId: 'tool_angle', icon: <Compass className="h-3.5 w-3.5" /> },
  ];

  const items = domain === '2d' ? tools2D : tools3D;
  const activeId = domain === '2d' ? activeTool2D : activeTool3D;

  const num = (v: string, fallback: number) => {
    const p = parseFloat(v);
    return Number.isFinite(p) ? p : fallback;
  };

  return (
    <>
      <div
        className={`safe-x z-20 flex shrink-0 items-center justify-between gap-1.5 border-b ${
          vp.isPhoneLandscape ? 'py-1' : 'py-1.5'
        } ${
          isDark ? 'border-slate-800 bg-[#111827]/95' : 'border-[#E2E7EE] bg-white'
        }`}
      >
        <div className="no-scrollbar flex min-w-0 flex-1 flex-nowrap items-center gap-0.5 overflow-x-auto">
          {items.map((tool) => {
            const isActive = activeId === tool.id;
            const keyHint = shortcuts[tool.shortcutId];
            return (
              <button
                key={tool.id}
                type="button"
                title={keyHint ? `${tool.label} (${formatShortcutBadge(keyHint)})` : tool.label}
                onClick={() => (domain === '2d' ? setTool2D(tool.id as Tool2D) : setTool3D(tool.id as Tool3D))}
                className={`flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1.5 text-[11.5px] font-medium transition-colors ${
                  isActive
                    ? 'bg-[#1D5CE5] text-white'
                    : isDark
                    ? 'text-slate-300 hover:bg-slate-800'
                    : 'text-[#0F1B2D] hover:bg-[#F2F5F9]'
                }`}
              >
                {tool.icon}
                {!compact && (
                  <span
                    className={
                      tool.id === 'point' ||
                      tool.id === 'select' ||
                      tool.id === 'segment' ||
                      tool.id === 'tetrahedron3d' ||
                      tool.id === 'pyramid4_3d' ||
                      tool.id === 'box3d'
                        ? 'inline'
                        : 'hidden xl:inline'
                    }
                  >
                    {tool.short}
                  </span>
                )}
                {!compact && keyHint && (
                  <kbd
                    className={`font-math hidden rounded px-1 text-[9.5px] font-semibold 2xl:inline ${
                      isActive ? 'bg-white/20 text-white' : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {formatShortcutBadge(keyHint)}
                  </kbd>
                )}
              </button>
            );
          })}

          <div className={`mx-0.5 h-4 w-px shrink-0 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

          <button
            type="button"
            title={`Bật/tắt chế độ chọn nhiều đối tượng bằng 1 chạm${shortcuts.toggle_multi_select ? ` (${formatShortcutBadge(shortcuts.toggle_multi_select)})` : ''}`}
            onClick={toggleMultiSelectMode}
            className={`flex shrink-0 items-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
              multiSelectMode
                ? 'border-[#1D5CE5] bg-[#1D5CE5]/12 text-[#1D5CE5]'
                : isDark
                ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                : 'border-slate-200 text-slate-600 hover:bg-[#F2F5F9]'
            }`}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            <span className="hidden 2xl:inline">Chọn nhiều</span>
          </button>
        </div>

        {domain === '3d' && (
          <button
            type="button"
            onClick={() => setBuilderOpen(true)}
            className="flex shrink-0 items-center gap-1 rounded-md bg-[#0E9F6E] px-2.5 py-1.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-[#0B835B]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{compact ? 'Tạo 3D' : <><span className="sm:hidden">Tạo 3D</span><span className="hidden sm:inline">Tạo khối & Oxyz</span></>}</span>
          </button>
        )}
      </div>

      {/* ==================== 1-CLICK 3D SOLID & OXYZ BUILDER MODAL ==================== */}
      {builderOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
            onClick={() => setBuilderOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-xl border shadow-xl ${
                isDark ? 'border-slate-700 bg-[#111827] text-slate-100' : 'border-[#DCE3EC] bg-white text-[#0F1B2D]'
              }`}
            >
              <div className={`flex shrink-0 items-center justify-between border-b px-4 py-2.5 sm:px-5 sm:py-3.5 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <div>
                  <h3 className="text-sm font-bold">Tạo nhanh Hình Không Gian & Đối Tượng Oxyz</h3>
                  <p className={`hidden text-xs sm:block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Điền trực tiếp kích thước hoặc tọa độ — không cần nhớ câu lệnh phức tạp
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Đóng hộp thoại"
                  onClick={() => setBuilderOpen(false)}
                  className={`rounded-md p-1 ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

            <div className={`flex shrink-0 border-b text-xs font-semibold ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              {[
                { id: 'poly', label: 'Đa diện (Lớp 11)' },
                { id: 'round', label: 'Nón – Trụ – Cầu (Lớp 12)' },
                { id: 'oxyz', label: 'Điểm / Mặt / Đường Oxyz' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setBuilderTab(t.id as 'poly' | 'round' | 'oxyz')}
                  className={`flex-1 border-b-2 py-2 transition-colors ${
                    builderTab === t.id
                      ? 'border-[#1D5CE5] text-[#1D5CE5]'
                      : 'border-transparent opacity-65 hover:opacity-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {builderTab === 'poly' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: 'pyramid_sa_square', label: 'Chóp S.ABCD (SA ⊥ đáy)' },
                        { id: 'pyramid_regular_square', label: 'Chóp tứ giác đều' },
                        { id: 'tetrahedron_regular', label: 'Tứ diện đều S.ABC' },
                        { id: 'prism_tri_standing', label: "Lăng trụ đứng ABC.A'B'C'" },
                        { id: 'box', label: 'Hình hộp chữ nhật' },
                        { id: 'cube', label: 'Hình lập phương' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSolidType(opt.id)}
                        className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
                          solidType === opt.id
                            ? 'border-[#1D5CE5] bg-[#1D5CE5]/10 text-[#1D5CE5]'
                            : isDark
                            ? 'border-slate-700 hover:border-slate-500'
                            : 'border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <label className="text-xs">
                      <span className="mb-1 block opacity-75">Cạnh a</span>
                      <input
                        type="number"
                        step="0.5"
                        value={dimA}
                        onChange={(e) => setDimA(e.target.value)}
                        className={`font-math w-full rounded-md border px-2.5 py-1.5 text-xs ${
                          isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
                        }`}
                      />
                    </label>
                    {(solidType === 'pyramid_sa_square' || solidType === 'box') && (
                      <label className="text-xs">
                        <span className="mb-1 block opacity-75">Cạnh b</span>
                        <input
                          type="number"
                          step="0.5"
                          value={dimB}
                          onChange={(e) => setDimB(e.target.value)}
                          className={`font-math w-full rounded-md border px-2.5 py-1.5 text-xs ${
                            isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
                          }`}
                        />
                      </label>
                    )}
                    {solidType !== 'cube' && solidType !== 'tetrahedron_regular' && (
                      <label className="text-xs">
                        <span className="mb-1 block opacity-75">Chiều cao h</span>
                        <input
                          type="number"
                          step="0.5"
                          value={dimH}
                          onChange={(e) => setDimH(e.target.value)}
                          className={`font-math w-full rounded-md border px-2.5 py-1.5 text-xs ${
                            isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
                          }`}
                        />
                      </label>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      addQuickSolid3D(solidType, { a: num(dimA, 3), b: num(dimB, 3), h: num(dimH, 3.5) });
                      setBuilderOpen(false);
                    }}
                    className="w-full rounded-lg bg-[#1D5CE5] py-2 text-xs font-semibold text-white hover:bg-[#174CC2]"
                  >
                    Dựng khối đa diện vào không gian 3D
                  </button>
                </div>
              )}

              {builderTab === 'round' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'cone', label: 'Hình nón' },
                        { id: 'cylinder', label: 'Hình trụ' },
                        { id: 'sphere', label: 'Mặt cầu' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSolidType(opt.id)}
                        className={`rounded-lg border px-3 py-2 text-center text-xs font-semibold transition-colors ${
                          solidType === opt.id
                            ? 'border-[#1D5CE5] bg-[#1D5CE5]/10 text-[#1D5CE5]'
                            : isDark
                            ? 'border-slate-700 hover:border-slate-500'
                            : 'border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs">
                      <span className="mb-1 block opacity-75">Bán kính R</span>
                      <input
                        type="number"
                        step="0.5"
                        value={dimR}
                        onChange={(e) => setDimR(e.target.value)}
                        className={`font-math w-full rounded-md border px-2.5 py-1.5 text-xs ${
                          isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
                        }`}
                      />
                    </label>
                    {solidType !== 'sphere' && (
                      <label className="text-xs">
                        <span className="mb-1 block opacity-75">Chiều cao h</span>
                        <input
                          type="number"
                          step="0.5"
                          value={dimH}
                          onChange={(e) => setDimH(e.target.value)}
                          className={`font-math w-full rounded-md border px-2.5 py-1.5 text-xs ${
                            isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
                          }`}
                        />
                      </label>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const k = solidType === 'cone' || solidType === 'cylinder' || solidType === 'sphere' ? solidType : 'cone';
                      addQuickSolid3D(k, { r: num(dimR, 2), h: num(dimH, 3.5), cz: k === 'sphere' ? num(dimR, 2) : 0 });
                      setBuilderOpen(false);
                    }}
                    className="w-full rounded-lg bg-[#0E9F6E] py-2 text-xs font-semibold text-white hover:bg-[#0B835B]"
                  >
                    Dựng khối tròn xoay
                  </button>
                </div>
              )}

              {builderTab === 'oxyz' && (
                <div className="space-y-4">
                  {/* Add Point */}
                  <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-[#FAFBFD]'}`}>
                    <div className="mb-2 text-xs font-semibold">Thêm điểm M(x; y; z)</div>
                    <div className="grid grid-cols-5 gap-2">
                      <input
                        placeholder="Tên (A)"
                        value={ptName}
                        onChange={(e) => setPtName(e.target.value)}
                        className={`rounded border px-2 py-1 text-xs ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`}
                      />
                      <input type="number" step="0.5" value={ptX} onChange={(e) => setPtX(e.target.value)} placeholder="x" className={`font-math rounded border px-2 py-1 text-xs ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`} />
                      <input type="number" step="0.5" value={ptY} onChange={(e) => setPtY(e.target.value)} placeholder="y" className={`font-math rounded border px-2 py-1 text-xs ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`} />
                      <input type="number" step="0.5" value={ptZ} onChange={(e) => setPtZ(e.target.value)} placeholder="z" className={`font-math rounded border px-2 py-1 text-xs ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`} />
                      <button
                        type="button"
                        onClick={() => {
                          addPoint3D(num(ptX, 0), num(ptY, 0), num(ptZ, 0), ptName.trim() || undefined);
                          setBuilderOpen(false);
                        }}
                        className="rounded bg-[#1D5CE5] text-xs font-semibold text-white hover:bg-[#174CC2]"
                      >
                        Thêm
                      </button>
                    </div>
                  </div>

                  {/* Add Plane */}
                  <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-[#FAFBFD]'}`}>
                    <div className="mb-2 text-xs font-semibold">Mặt phẳng ax + by + cz + d = 0</div>
                    <div className="grid grid-cols-5 gap-2">
                      <input type="number" value={plA} onChange={(e) => setPlA(e.target.value)} placeholder="a" className={`font-math rounded border px-2 py-1 text-xs ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`} />
                      <input type="number" value={plB} onChange={(e) => setPlB(e.target.value)} placeholder="b" className={`font-math rounded border px-2 py-1 text-xs ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`} />
                      <input type="number" value={plC} onChange={(e) => setPlC(e.target.value)} placeholder="c" className={`font-math rounded border px-2 py-1 text-xs ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`} />
                      <input type="number" value={plD} onChange={(e) => setPlD(e.target.value)} placeholder="d" className={`font-math rounded border px-2 py-1 text-xs ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`} />
                      <button
                        type="button"
                        onClick={() => {
                          addPlane3DFromEq(num(plA, 1), num(plB, 1), num(plC, 1), num(plD, -3));
                          setBuilderOpen(false);
                        }}
                        className="rounded bg-[#0E9F6E] text-xs font-semibold text-white hover:bg-[#0B835B]"
                      >
                        Dựng
                      </button>
                    </div>
                  </div>

                  {/* Add Line */}
                  <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-[#FAFBFD]'}`}>
                    <div className="mb-2 text-xs font-semibold">Đường thẳng qua M₀(x₀; y₀; z₀) và VTCP u⃗(a; b; c)</div>
                    <div className="grid grid-cols-6 gap-1.5">
                      <input type="number" value={lnX0} onChange={(e) => setLnX0(e.target.value)} placeholder="x₀" className={`font-math rounded border px-1.5 py-1 text-xs ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`} />
                      <input type="number" value={lnY0} onChange={(e) => setLnY0(e.target.value)} placeholder="y₀" className={`font-math rounded border px-1.5 py-1 text-xs ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`} />
                      <input type="number" value={lnZ0} onChange={(e) => setLnZ0(e.target.value)} placeholder="z₀" className={`font-math rounded border px-1.5 py-1 text-xs ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`} />
                      <input type="number" value={lnU} onChange={(e) => setLnU(e.target.value)} placeholder="uₓ" className={`font-math rounded border px-1.5 py-1 text-xs ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`} />
                      <input type="number" value={lnV} onChange={(e) => setLnV(e.target.value)} placeholder="uᵧ" className={`font-math rounded border px-1.5 py-1 text-xs ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`} />
                      <input type="number" value={lnW} onChange={(e) => setLnW(e.target.value)} placeholder="u_z" className={`font-math rounded border px-1.5 py-1 text-xs ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`} />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        addLine3DFromPointDir(
                          [num(lnX0, 0), num(lnY0, 0), num(lnZ0, 0)],
                          [num(lnU, 1), num(lnV, 1), num(lnW, 1)]
                        );
                        setBuilderOpen(false);
                      }}
                      className="mt-2 w-full rounded bg-[#7C3AED] py-1.5 text-xs font-semibold text-white hover:bg-[#6D28D9]"
                    >
                      Dựng đường thẳng Oxyz
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
