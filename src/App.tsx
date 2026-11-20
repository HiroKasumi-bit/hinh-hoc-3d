import React, { useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { Canvas2D } from './components/Canvas2D';
import { Viewport3D } from './components/Viewport3D';
import { FloatingToolbar } from './components/FloatingToolbar';
import { ContextActionBar } from './components/ContextActionBar';
import { RenamePointModal } from './components/RenamePointModal';
import { useGeometryStore } from './store/useGeometryStore';
import { useViewportProfile } from './hooks/useViewportProfile';
import { eventToShortcutString, type ShortcutActionId } from './types/shortcuts';

class CanvasErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-5 text-red-900">
            <h3 className="text-sm font-bold">Không thể khởi tạo khung hình 3D WebGL</h3>
            <p className="mt-1.5 text-xs opacity-80">{this.state.error.message}</p>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Thử lại
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const mode = useGeometryStore((s) => s.mode);
  const view = useGeometryStore((s) => s.view);
  const scene2d = useGeometryStore((s) => s.scene2d);
  const scene3d = useGeometryStore((s) => s.scene3d);
  const activeTool2D = useGeometryStore((s) => s.activeTool2D);
  const activeTool3D = useGeometryStore((s) => s.activeTool3D);
  const sidebarOpen = useGeometryStore((s) => s.sidebarOpen);
  const toast = useGeometryStore((s) => s.toast);
  const clearToast = useGeometryStore((s) => s.clearToast);
  const sliders = useGeometryStore((s) => s.sliders);
  const setSliderValue = useGeometryStore((s) => s.setSliderValue);
  const undo = useGeometryStore((s) => s.undo);
  const redo = useGeometryStore((s) => s.redo);
  const setTool2D = useGeometryStore((s) => s.setTool2D);
  const setTool3D = useGeometryStore((s) => s.setTool3D);
  const setMode = useGeometryStore((s) => s.setMode);
  const setSidebarOpen = useGeometryStore((s) => s.setSidebarOpen);
  const clearSelection = useGeometryStore((s) => s.clearSelection);
  const vp = useViewportProfile();

  const isDark = view.theme === 'dark';

  // Auto-adapt smoothly on phone rotation (portrait <-> landscape)
  useEffect(() => {
    if (vp.isPhonePortrait && mode === 'split') {
      setMode('3d');
    }
    if (vp.isCompact) {
      setSidebarOpen(false);
    }
    // Only react to orientation/profile category changes, not manual sidebar toggles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vp.isCompact, vp.isPhonePortrait, vp.isPhoneLandscape]);

  // Auto-dismiss toast after 3.2s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => clearToast(), 3200);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  // Global keyboard shortcuts (Ctrl+Z, Ctrl+Y, Esc + fully customizable tool/rename/view shortcuts!)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const st = useGeometryStore.getState();
      if (st.renamingPoint) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        st.redo();
        return;
      }
      if (e.key === 'Escape') {
        st.setTool2D('select');
        st.setTool3D('select');
        st.clearSelection();
        return;
      }

      const combo = eventToShortcutString(e);
      if (!combo) return;

      // Find matching custom shortcut action (plus F2 built-in alias for rename_point if F2 isn't bound elsewhere)
      let matched: ShortcutActionId | null = null;
      for (const [actionId, bound] of Object.entries(st.shortcuts) as Array<[ShortcutActionId, string]>) {
        if (bound && bound === combo) {
          matched = actionId;
          break;
        }
      }
      if (!matched && combo === 'F2') {
        matched = 'rename_point';
      }
      if (!matched) return;

      e.preventDefault();
      const activeDomain: '2d' | '3d' = st.mode === '2d' ? '2d' : '3d';

      switch (matched) {
        case 'tool_select':
          st.setTool2D('select');
          st.setTool3D('select');
          break;
        case 'tool_point':
          st.setTool2D('point');
          st.setTool3D('point');
          break;
        case 'tool_segment':
          st.setTool2D('segment');
          st.setTool3D('segment');
          break;
        case 'tool_line':
          st.setTool2D('line');
          st.setTool3D('line');
          break;
        case 'tool_vector':
          st.setTool2D('vector');
          st.setTool3D('vector');
          break;
        case 'tool_midpoint':
          st.setTool2D('midpoint');
          st.setTool3D('midpoint');
          break;
        case 'tool_plane_or_polygon':
          if (activeDomain === '2d') st.setTool2D('polygon');
          else st.setTool3D('plane3p');
          break;
        case 'tool_section_or_perp':
          if (activeDomain === '2d') st.setTool2D('perpendicular');
          else st.setTool3D('crossSection');
          break;
        case 'tool_circle_or_builder':
          if (activeDomain === '2d') st.setTool2D('circle');
          else window.dispatchEvent(new Event('hinhhocviet-open-builder'));
          break;
        case 'tool_distance':
          st.setTool2D('distance');
          st.setTool3D('distance');
          break;
        case 'tool_angle':
          st.setTool2D('angle');
          st.setTool3D('angle');
          break;
        case 'rename_point': {
          const ptSel = st.selection.find((x) => x.type === 'point');
          if (ptSel) {
            st.openRenamePoint(ptSel.domain, ptSel.id);
          } else {
            const ptsInDomain = activeDomain === '2d' ? st.scene2d.points : st.scene3d.points;
            if (ptsInDomain.length === 1) {
              st.openRenamePoint(activeDomain, ptsInDomain[0].id);
            } else {
              st.showToast('Hãy chọn 1 điểm trước khi sửa tên', 'info');
            }
          }
          break;
        }
        case 'toggle_multi_select':
          st.toggleMultiSelectMode();
          st.showToast(
            !st.multiSelectMode ? 'Đã bật chế độ Chọn nhiều điểm' : 'Đã tắt chế độ Chọn nhiều điểm',
            'info'
          );
          break;
        case 'delete_selected':
          st.deleteSelection();
          break;
        case 'mode_2d':
          st.setMode('2d');
          break;
        case 'mode_3d':
          st.setMode('3d');
          break;
        case 'mode_split':
          st.setMode('split');
          break;
        case 'open_builder_3d':
          if (st.mode === '2d') st.setMode('3d');
          window.dispatchEvent(new Event('hinhhocviet-open-builder'));
          break;
        case 'open_presets':
          window.dispatchEvent(new Event('hinhhocviet-open-presets'));
          break;
        case 'toggle_axes':
          st.updateView({ showAxes: !st.view.showAxes });
          break;
        case 'toggle_grid':
          st.updateView({ showGrid: !st.view.showGrid });
          break;
        case 'toggle_hidden_edges':
          st.updateView({ autoDashedHiddenEdges: !st.view.autoDashedHiddenEdges });
          break;
        case 'reset_camera':
          st.requestCamera('oxyz');
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Smooth slider animation loop for playing parameters (m, h, k)
  const hasPlayingSlider = sliders.some((s) => s.playing);
  useEffect(() => {
    if (!hasPlayingSlider) return;
    const dirs = new Map<string, number>();
    let raf = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const curSliders = useGeometryStore.getState().sliders;
      for (const sl of curSliders) {
        if (!sl.playing) continue;
        const speed = (sl.max - sl.min) * 0.16;
        let dir = dirs.get(sl.id) ?? 1;
        let next = sl.value + dir * speed * dt;
        if (next >= sl.max) {
          next = sl.max;
          dir = -1;
        } else if (next <= sl.min) {
          next = sl.min;
          dir = 1;
        }
        dirs.set(sl.id, dir);
        setSliderValue(sl.id, Number(next.toFixed(3)));
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hasPlayingSlider, setSliderValue]);

  const show2D = mode === '2d' || mode === 'split';
  const show3D = mode === '3d' || mode === 'split';

  const is2DEmpty =
    scene2d.points.length +
      scene2d.segments.length +
      scene2d.lines.length +
      scene2d.vectors.length +
      scene2d.circles.length +
      scene2d.conics.length +
      scene2d.polygons.length +
      scene2d.functions.length +
      scene2d.inequalities.length ===
    0;

  const is3DEmpty =
    scene3d.points.length +
      scene3d.segments.length +
      scene3d.lines.length +
      scene3d.vectors.length +
      scene3d.planes.length +
      scene3d.polyhedra.length +
      scene3d.solids.length +
      scene3d.surfaces.length +
      scene3d.crossSections.length ===
    0;

  return (
    <div
      className={`safe-bottom flex h-dvh w-screen flex-col overflow-hidden ${
        isDark ? 'dark bg-[#0D131F] text-slate-100' : 'bg-[#FAFBFD] text-[#0F1B2D]'
      }`}
    >
      <TopBar />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {sidebarOpen && <Sidebar />}

        <main className="relative flex min-w-0 flex-1 overflow-hidden">
          {/* 2D Pane */}
          <section
            className={`${show2D ? 'flex' : 'hidden'} h-full min-w-0 flex-1 flex-col ${
              mode === 'split'
                ? isDark
                  ? 'border-r border-slate-800'
                  : 'border-r border-[#DCE3EC]'
                : ''
            }`}
          >
            <FloatingToolbar domain="2d" compact={mode === 'split'} />
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <Canvas2D />
              {is2DEmpty && activeTool2D === 'select' && (
                <div className="pointer-events-none absolute right-3 bottom-14 left-3 flex justify-center sm:bottom-3">
                  <div
                    className={`rounded-full border px-3 py-1 text-[11px] font-medium shadow-2xs ${
                      isDark
                        ? 'border-slate-800 bg-slate-900/85 text-slate-400'
                        : 'border-[#DCE3EC] bg-white/88 text-slate-500'
                    }`}
                  >
                    Chọn <strong>Điểm</strong> để chấm trên lưới · Chụm 2 ngón để thu phóng
                  </div>
                </div>
              )}
              <ContextActionBar domain="2d" />
              {mode === 'split' && (
                <div
                  className={`pointer-events-none absolute top-2.5 left-2.5 rounded border px-2 py-0.5 text-[11px] font-semibold ${
                    isDark ? 'border-slate-700 bg-slate-900/90 text-slate-300' : 'border-slate-200 bg-white/90 text-slate-600'
                  }`}
                >
                  Mặt phẳng 2D (Oxy)
                </div>
              )}
            </div>
          </section>

          {/* 3D Pane */}
          <section className={`${show3D ? 'flex' : 'hidden'} h-full min-w-0 flex-1 flex-col`}>
            <FloatingToolbar domain="3d" compact={mode === 'split'} />
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <CanvasErrorBoundary>
                <Viewport3D />
              </CanvasErrorBoundary>
              {is3DEmpty && activeTool3D === 'select' && (
                <div className={`pointer-events-none absolute right-3 left-3 flex justify-center ${vp.isPhoneLandscape ? 'bottom-1.5' : 'bottom-3'}`}>
                  <div
                    className={`rounded-full border px-3 text-center font-medium shadow-2xs ${
                      vp.isPhoneLandscape ? 'py-0.5 text-[10.5px]' : 'py-1.5 text-[11px]'
                    } ${
                      isDark
                        ? 'border-slate-800 bg-slate-900/88 text-slate-300'
                        : 'border-[#DCE3EC] bg-white/90 text-slate-600'
                    }`}
                  >
                    {vp.isPhoneLandscape
                      ? <>Chọn <strong>Điểm</strong> + nhấn giữ kéo z · Nhấn giữ điểm có sẵn để chỉnh z</>
                      : <>Chọn <strong>Điểm</strong> rồi nhấn giữ kéo lên/xuống để tạo điểm cao độ z · Hoặc nhấn giữ bất kỳ điểm nào để chỉnh z</>}
                  </div>
                </div>
              )}
              <ContextActionBar domain="3d" />
              {mode === 'split' && (
                <div
                  className={`pointer-events-none absolute top-2.5 left-2.5 rounded border px-2 py-0.5 text-[11px] font-semibold ${
                    isDark ? 'border-slate-700 bg-slate-900/90 text-slate-300' : 'border-slate-200 bg-white/90 text-slate-600'
                  }`}
                >
                  Không gian 3D (Oxyz)
                </div>
              )}
            </div>
          </section>

          {/* Non-intrusive Toast at bottom-left of main workspace (never covers zoom or 3D Gizmo!) */}
          {toast && (
            <div
              className={`pointer-events-none absolute bottom-3 left-3 z-40 rounded-lg border px-3.5 py-2 text-xs font-medium shadow-md transition-all ${
                toast.tone === 'error'
                  ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
                  : toast.tone === 'success'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                  : 'border-slate-300 bg-white text-[#0F1B2D] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
              }`}
            >
              {toast.text}
            </div>
          )}
        </main>
      </div>
      <RenamePointModal />
    </div>
  );
}
