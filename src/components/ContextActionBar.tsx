import React from 'react';
import { ArrowDown, ArrowUp, Pencil, X } from 'lucide-react';
import { useGeometryStore } from '../store/useGeometryStore';
import { formatNum } from '../math/geometry2d';
import { formatShortcutBadge } from '../types/shortcuts';

import type { Segment3DSolidMode } from '../types/geometry';

const TOOL_2D_HINTS: Record<string, string> = {
  point: 'Chạm bất kỳ vị trí nào để chấm điểm mới',
  segment: 'Chọn lần lượt 2 điểm để nối đoạn thẳng',
  line: 'Chọn 2 điểm để dựng đường thẳng đi qua',
  vector: 'Chọn điểm gốc rồi điểm ngọn để vẽ vectơ',
  circle: 'Chọn tâm đường tròn rồi 1 điểm trên đường tròn',
  polygon: 'Chọn các đỉnh rồi chạm lại đỉnh đầu tiên để khép kín',
  midpoint: 'Chọn 2 điểm để lấy trung điểm',
  perpendicular: 'Chọn 1 điểm rồi chọn 1 đường thẳng để hạ đường vuông góc',
  angle: 'Chọn 3 điểm A → B (đỉnh góc) → C để đo góc ∠ABC',
  distance: 'Chọn 2 điểm để đo khoảng cách',
};

const TOOL_3D_HINTS: Record<string, string> = {
  point: 'Chạm mặt phẳng để đặt điểm · Nhấn giữ và kéo lên/xuống để nâng độ cao z',
  segment: 'Chấm 2 điểm nối đoạn · Chấm tiếp điểm thứ 3 tự dựng hình khối',
  line: 'Chạm 2 điểm để dựng đường thẳng không gian',
  vector: 'Chạm điểm gốc rồi điểm ngọn để vẽ vectơ 3D',
  plane3p: 'Chạm 3 điểm không thẳng hàng để dựng mặt phẳng (ABC)',
  midpoint: 'Chạm 2 điểm để lấy trung điểm',
  ratio: 'Chạm 2 điểm A, B để chia đoạn theo tỉ lệ k = 1/3',
  crossSection: 'Chạm 3 điểm trên hình khối để cắt ra đa giác Thiết diện',
  distance: 'Chạm 2 điểm để đo độ dài (hoặc bật "Chọn nhiều" để chọn điểm & mặt phẳng)',
  angle: 'Chạm 3 điểm A → B (đỉnh) → C để đo góc không gian ∠ABC',
};

const SEGMENT_3D_MODE_OPTIONS: Array<{ id: Segment3DSolidMode; label: string }> = [
  { id: 'box', label: 'Hình hộp' },
  { id: 'tetrahedron', label: 'Chóp tứ diện' },
  { id: 'pyramid4', label: 'Chóp tứ giác' },
  { id: 'segmentOnly', label: 'Chỉ nối đoạn' },
];

export const ContextActionBar: React.FC<{ domain: '2d' | '3d' }> = ({ domain }) => {
  const activeTool2D = useGeometryStore((s) => s.activeTool2D);
  const activeTool3D = useGeometryStore((s) => s.activeTool3D);
  const segment3DMode = useGeometryStore((s) => s.segment3DMode);
  const setTool2D = useGeometryStore((s) => s.setTool2D);
  const setTool3D = useGeometryStore((s) => s.setTool3D);
  const setSegment3DMode = useGeometryStore((s) => s.setSegment3DMode);
  const finishPendingSegment3D = useGeometryStore((s) => s.finishPendingSegment3D);
  const pendingIds = useGeometryStore((s) => s.pendingIds);
  const selection = useGeometryStore((s) => s.selection).filter((x) => x.domain === domain);
  const clearSelection = useGeometryStore((s) => s.clearSelection);
  const view = useGeometryStore((s) => s.view);
  const scene2d = useGeometryStore((s) => s.scene2d);
  const scene3d = useGeometryStore((s) => s.scene3d);
  const shortcuts = useGeometryStore((s) => s.shortcuts);
  const openRenamePoint = useGeometryStore((s) => s.openRenamePoint);
  const updatePoint3DCoords = useGeometryStore((s) => s.updatePoint3DCoords);
  const pushHistory = useGeometryStore((s) => s.pushHistory);

  const createSegmentFromSelection = useGeometryStore((s) => s.createSegmentFromSelection);
  const createLineFromSelection = useGeometryStore((s) => s.createLineFromSelection);
  const createVectorFromSelection = useGeometryStore((s) => s.createVectorFromSelection);
  const createMidpointFromSelection = useGeometryStore((s) => s.createMidpointFromSelection);
  const createRatioPointFromSelection = useGeometryStore((s) => s.createRatioPointFromSelection);
  const createPlaneFrom3SelectedPoints = useGeometryStore((s) => s.createPlaneFrom3SelectedPoints);
  const createTetrahedronFromSelection = useGeometryStore((s) => s.createTetrahedronFromSelection);
  const createPyramid4FromSelection = useGeometryStore((s) => s.createPyramid4FromSelection);
  const createCubeFromSelection = useGeometryStore((s) => s.createCubeFromSelection);
  const createBoxFrom3SelectedPoints = useGeometryStore((s) => s.createBoxFrom3SelectedPoints);
  const createCrossSectionFromSelection = useGeometryStore((s) => s.createCrossSectionFromSelection);
  const createFootOnPlaneFromSelection = useGeometryStore((s) => s.createFootOnPlaneFromSelection);
  const createReflectAcrossPlaneFromSelection = useGeometryStore((s) => s.createReflectAcrossPlaneFromSelection);
  const createDistanceMeasureFromSelection = useGeometryStore((s) => s.createDistanceMeasureFromSelection);
  const createAngleMeasureFromSelection = useGeometryStore((s) => s.createAngleMeasureFromSelection);
  const createPlanesIntersectionFromSelection = useGeometryStore((s) => s.createPlanesIntersectionFromSelection);
  const createPolygon2DFromSelection = useGeometryStore((s) => s.createPolygon2DFromSelection);
  const createCircle2DFromSelection = useGeometryStore((s) => s.createCircle2DFromSelection);
  const addSpecialTriangleCenter2D = useGeometryStore((s) => s.addSpecialTriangleCenter2D);

  const isDark = view.theme === 'dark';
  const tool = domain === '2d' ? activeTool2D : activeTool3D;

  // 1. Active multi-step tool prompt (with integrated 3rd-point 3D solid switcher inside Segment!)
  if (tool !== 'select') {
    if (domain === '3d' && tool === 'segment') {
      const stepHint =
        pendingIds.length === 0
          ? 'Chấm điểm 1 → điểm 2 để nối đoạn'
          : pendingIds.length === 1
          ? 'Chấm điểm 2 để nối đoạn thẳng'
          : segment3DMode === 'box'
          ? 'Đã nối đoạn · Chấm điểm 3 để tự nối thành Hình hộp (nhấn giữ kéo chiều cao)'
          : segment3DMode === 'tetrahedron'
          ? 'Đã nối đoạn · Chấm điểm 3 để dựng ngay Chóp tứ diện'
          : 'Đã nối đoạn · Chấm điểm 3 để đặt đỉnh Chóp tứ giác';

      return (
        <div
          className={`pointer-events-auto absolute bottom-3 left-1/2 z-20 flex max-w-[96%] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-xl border px-3 py-1.5 text-xs shadow-sm ${
            isDark
              ? 'border-[#1D5CE5]/50 bg-slate-900/95 text-slate-100'
              : 'border-[#1D5CE5]/35 bg-white/97 text-[#0F1B2D]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#1D5CE5]" />
            <span className="font-medium">
              {stepHint}
              {pendingIds.length > 0 && <strong className="ml-1 text-[#E06D1F]">({pendingIds.length}/3)</strong>}
            </span>
          </div>

          <div
            className={`flex items-center gap-0.5 rounded-lg border p-0.5 ${
              isDark ? 'border-slate-700 bg-slate-800/80' : 'border-slate-200 bg-[#F2F5F9]'
            }`}
          >
            <span className="hidden px-1.5 text-[10.5px] font-semibold opacity-65 sm:inline">Điểm 3:</span>
            {SEGMENT_3D_MODE_OPTIONS.map((opt) => {
              const active = segment3DMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSegment3DMode(opt.id)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                    active
                      ? 'bg-[#1D5CE5] text-white shadow-2xs'
                      : isDark
                      ? 'text-slate-300 hover:bg-slate-700'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {pendingIds.length === 2 && (
            <button
              type="button"
              onClick={finishPendingSegment3D}
              className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                isDark
                  ? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Giữ đoạn
            </button>
          )}

          <button
            type="button"
            onClick={() => setTool3D('select')}
            className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
              isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Esc
          </button>
        </div>
      );
    }

    const hint = domain === '2d' ? TOOL_2D_HINTS[tool] : TOOL_3D_HINTS[tool];
    return (
      <div
        className={`pointer-events-auto absolute bottom-3 left-1/2 z-20 flex max-w-[92%] -translate-x-1/2 items-center gap-3 rounded-lg border px-3.5 py-2 text-xs shadow-sm ${
          isDark
            ? 'border-[#1D5CE5]/50 bg-slate-900/95 text-slate-100'
            : 'border-[#1D5CE5]/35 bg-white/96 text-[#0F1B2D]'
        }`}
      >
        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#1D5CE5]" />
        <span className="font-medium">
          {hint}
          {pendingIds.length > 0 && <strong className="ml-1.5 text-[#E06D1F]">(Đã chọn {pendingIds.length})</strong>}
        </span>
        <button
          type="button"
          onClick={() => (domain === '2d' ? setTool2D('select') : setTool3D('select'))}
          className={`ml-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
            isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Esc
        </button>
      </div>
    );
  }

  // 2. Contextual 1-Click Vietnamese Math Actions based on Selection!
  const pts = selection.filter((x) => x.type === 'point');
  const planes = selection.filter((x) => x.type === 'plane');
  const linesOrSegs = selection.filter((x) => x.type === 'segment' || x.type === 'line');

  const actions: Array<{ label: string; onClick: () => void; accent?: boolean }> = [];

  if (domain === '2d') {
    if (pts.length === 2) {
      actions.push(
        { label: 'Nối đoạn thẳng', onClick: () => createSegmentFromSelection('2d'), accent: true },
        { label: 'Đường thẳng', onClick: () => createLineFromSelection('2d') },
        { label: 'Vectơ', onClick: () => createVectorFromSelection('2d') },
        { label: 'Trung điểm', onClick: () => createMidpointFromSelection('2d') },
        { label: 'Đường tròn', onClick: () => createCircle2DFromSelection() },
        { label: 'Đo độ dài', onClick: () => createDistanceMeasureFromSelection('2d') }
      );
    } else if (pts.length === 3) {
      const triple: [string, string, string] = [pts[0].id, pts[1].id, pts[2].id];
      actions.push(
        { label: 'Tạo tam giác', onClick: () => createPolygon2DFromSelection(), accent: true },
        { label: 'Trọng tâm G', onClick: () => addSpecialTriangleCenter2D('centroid', triple) },
        { label: 'Trực tâm H', onClick: () => addSpecialTriangleCenter2D('orthocenter', triple) },
        { label: 'Ngoại tiếp O', onClick: () => addSpecialTriangleCenter2D('circumcenter', triple) },
        { label: 'Nội tiếp I', onClick: () => addSpecialTriangleCenter2D('incenter', triple) },
        { label: 'Đo góc', onClick: () => createAngleMeasureFromSelection('2d') }
      );
    } else if (pts.length > 3) {
      actions.push({ label: `Tạo đa giác (${pts.length} đỉnh)`, onClick: () => createPolygon2DFromSelection(), accent: true });
    }
  } else {
    if (pts.length === 2 && planes.length === 0) {
      actions.push(
        { label: 'Nối đoạn thẳng', onClick: () => createSegmentFromSelection('3d'), accent: true },
        { label: 'Dựng Chóp tứ giác', onClick: () => createPyramid4FromSelection(), accent: true },
        { label: 'Dựng Khối hộp', onClick: () => createCubeFromSelection(), accent: true },
        { label: 'Đường thẳng', onClick: () => createLineFromSelection('3d') },
        { label: 'Vectơ', onClick: () => createVectorFromSelection('3d') },
        { label: 'Trung điểm', onClick: () => createMidpointFromSelection('3d') },
        { label: 'Chia 1/3', onClick: () => createRatioPointFromSelection('3d', 1 / 3) },
        { label: 'Đo độ dài', onClick: () => createDistanceMeasureFromSelection('3d') }
      );
    } else if (pts.length === 3) {
      actions.push(
        { label: 'Dựng Chóp tứ diện S.ABC', onClick: () => createTetrahedronFromSelection(), accent: true },
        { label: 'Dựng Hình hộp', onClick: () => createBoxFrom3SelectedPoints(), accent: true },
        { label: 'Dựng mặt phẳng', onClick: () => createPlaneFrom3SelectedPoints(), accent: true },
        { label: 'Cắt thiết diện', onClick: () => createCrossSectionFromSelection(), accent: true },
        { label: 'Đo góc ∠', onClick: () => createAngleMeasureFromSelection('3d') }
      );
    } else if (pts.length === 1 && planes.length === 1) {
      actions.push(
        { label: 'Tính d(A, (P))', onClick: () => createDistanceMeasureFromSelection('3d'), accent: true },
        { label: 'Hình chiếu H', onClick: () => createFootOnPlaneFromSelection(), accent: true },
        { label: "Đối xứng A'", onClick: () => createReflectAcrossPlaneFromSelection() }
      );
    } else if (linesOrSegs.length === 2) {
      actions.push(
        { label: 'Khoảng cách chéo nhau', onClick: () => createDistanceMeasureFromSelection('3d'), accent: true },
        { label: 'Đo góc 2 đường', onClick: () => createAngleMeasureFromSelection('3d') }
      );
    } else if (linesOrSegs.length === 1 && planes.length === 1) {
      actions.push({ label: 'Đo góc đường – mặt', onClick: () => createAngleMeasureFromSelection('3d'), accent: true });
    } else if (planes.length === 2) {
      actions.push(
        { label: 'Dựng giao tuyến', onClick: () => createPlanesIntersectionFromSelection(), accent: true },
        { label: 'Góc 2 mặt phẳng', onClick: () => createAngleMeasureFromSelection('3d') }
      );
    } else if (planes.length === 1 && pts.length === 0) {
      actions.push({ label: 'Cắt thiết diện bằng mặt này', onClick: () => createCrossSectionFromSelection(), accent: true });
    }
  }

  if (actions.length === 0) {
    const renameKey = shortcuts.rename_point ? formatShortcutBadge(shortcuts.rename_point) : '';

    // Single 2D point selected -> instant Rename pill!
    if (domain === '2d' && selection.length === 1 && pts.length === 1) {
      const pt2 = scene2d.points.find((p) => p.id === pts[0].id);
      if (pt2) {
        return (
          <div
            className={`pointer-events-auto absolute bottom-3 left-1/2 z-20 flex max-w-[96%] -translate-x-1/2 flex-nowrap items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs shadow-sm ${
              isDark ? 'border-slate-700 bg-slate-900/95 text-slate-200' : 'border-[#DCE3EC] bg-white/96 text-[#0F1B2D]'
            }`}
          >
            <span className="font-semibold text-[#1D5CE5]">Điểm {pt2.name}</span>
            <button
              type="button"
              onClick={() => openRenamePoint('2d', pt2.id)}
              className="flex items-center gap-1 rounded-md bg-[#1D5CE5] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#174CC2]"
            >
              <Pencil className="h-3 w-3" />
              <span>Sửa tên</span>
              {renameKey && <kbd className="font-math hidden rounded bg-white/20 px-1 text-[10px] sm:inline">{renameKey}</kbd>}
            </button>
            <button type="button" onClick={clearSelection} className="shrink-0 rounded p-1 hover:bg-slate-200/50">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      }
    }

    // Single 3D point selected -> Rename + Z-height stepper!
    if (domain === '3d' && selection.length === 1 && pts.length === 1) {
      const selectedPt = scene3d.points.find((p) => p.id === pts[0].id);
      if (selectedPt) {
        const stepZ = (delta: number) => {
          pushHistory();
          const nextZ = Number((selectedPt.z + delta).toFixed(2));
          updatePoint3DCoords(selectedPt.id, [selectedPt.x, selectedPt.y, nextZ]);
        };
        return (
          <div
            className={`pointer-events-auto absolute bottom-3 left-1/2 z-20 flex max-w-[96%] -translate-x-1/2 flex-nowrap items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs shadow-sm ${
              isDark ? 'border-slate-700 bg-slate-900/95 text-slate-200' : 'border-[#DCE3EC] bg-white/96 text-[#0F1B2D]'
            }`}
          >
            <span className="font-semibold text-[#1D5CE5]">Điểm {selectedPt.name}</span>
            <button
              type="button"
              onClick={() => openRenamePoint('3d', selectedPt.id)}
              className="flex items-center gap-1 rounded-md bg-[#1D5CE5] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#174CC2]"
            >
              <Pencil className="h-3 w-3" />
              <span>Sửa tên</span>
              {renameKey && <kbd className="font-math hidden rounded bg-white/20 px-1 text-[9.5px] sm:inline">{renameKey}</kbd>}
            </button>
            {!selectedPt.computed && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Hạ z xuống 0.5"
                  onClick={() => stepZ(-0.5)}
                  className={`flex items-center gap-0.5 rounded border px-2 py-1 font-math text-[11px] font-semibold ${
                    isDark ? 'border-slate-700 bg-slate-800 hover:bg-slate-700' : 'border-slate-200 bg-[#F2F5F9] hover:bg-slate-200'
                  }`}
                >
                  <ArrowDown className="h-3 w-3" />
                  0.5
                </button>
                <span className="font-math px-1 text-xs font-bold">z={formatNum(selectedPt.z, 2)}</span>
                <button
                  type="button"
                  title="Nâng z lên 0.5"
                  onClick={() => stepZ(0.5)}
                  className={`flex items-center gap-0.5 rounded border px-2 py-1 font-math text-[11px] font-semibold ${
                    isDark ? 'border-slate-700 bg-slate-800 hover:bg-slate-700' : 'border-slate-200 bg-[#F2F5F9] hover:bg-slate-200'
                  }`}
                >
                  <ArrowUp className="h-3 w-3" />
                  0.5
                </button>
              </div>
            )}
            <button type="button" onClick={clearSelection} className="shrink-0 rounded p-1 hover:bg-slate-200/50">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      }
    }
    if (domain === '3d' && selection.length === 1) {
      return (
        <div
          className={`pointer-events-auto absolute bottom-3 left-1/2 z-20 flex max-w-[94%] -translate-x-1/2 items-center gap-2 rounded-lg border px-3 py-1.5 text-xs shadow-xs ${
            isDark ? 'border-slate-700 bg-slate-900/92 text-slate-300' : 'border-[#DCE3EC] bg-white/95 text-slate-600'
          }`}
        >
          <span>Bật <strong>Chọn nhiều</strong> (hoặc giữ <strong>Shift</strong>) để chọn thêm điểm/mặt và dựng hình tức thì</span>
          <button type="button" onClick={clearSelection} className="rounded p-0.5 hover:bg-slate-200/50">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    }
    return null;
  }

  return (
    <div
      className={`pointer-events-auto absolute bottom-3 left-1/2 z-20 flex max-w-[94%] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-xl border px-3 py-2 shadow-md ${
        isDark ? 'border-slate-700 bg-slate-900/96 text-slate-100' : 'border-[#DCE3EC] bg-white/98 text-[#0F1B2D]'
      }`}
    >
      <span className="mr-1 text-[11px] font-semibold opacity-65">Đã chọn {selection.length}:</span>
      {actions.map((act) => (
        <button
          key={act.label}
          type="button"
          onClick={act.onClick}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
            act.accent
              ? 'bg-[#1D5CE5] text-white hover:bg-[#174CC2]'
              : isDark
              ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              : 'bg-[#F2F5F9] text-[#0F1B2D] hover:bg-[#E2E8F0]'
          }`}
        >
          {act.label}
        </button>
      ))}
      <button
        type="button"
        title="Bỏ chọn"
        onClick={clearSelection}
        className={`ml-1 rounded-md p-1 ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
