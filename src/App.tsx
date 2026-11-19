import React, { useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { Canvas2D } from './components/Canvas2D';
import { Viewport3D } from './components/Viewport3D';
import { FloatingToolbar } from './components/FloatingToolbar';
import { ContextActionBar } from './components/ContextActionBar';
import { useGeometryStore } from './store/useGeometryStore';

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
  const sidebarOpen = useGeometryStore((s) => s.sidebarOpen);
  const toast = useGeometryStore((s) => s.toast);
  const clearToast = useGeometryStore((s) => s.clearToast);
  const sliders = useGeometryStore((s) => s.sliders);
  const setSliderValue = useGeometryStore((s) => s.setSliderValue);
  const undo = useGeometryStore((s) => s.undo);
  const redo = useGeometryStore((s) => s.redo);
  const setTool2D = useGeometryStore((s) => s.setTool2D);
  const setTool3D = useGeometryStore((s) => s.setTool3D);
  const clearSelection = useGeometryStore((s) => s.clearSelection);

  const isDark = view.theme === 'dark';

  // Auto-dismiss toast after 3.2s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => clearToast(), 3200);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  // Global keyboard shortcuts (Ctrl+Z, Ctrl+Y, Esc)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 'Escape') {
        setTool2D('select');
        setTool3D('select');
        clearSelection();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, setTool2D, setTool3D, clearSelection]);

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

  return (
    <div
      className={`flex h-screen w-screen flex-col overflow-hidden ${
        isDark ? 'dark bg-[#0D131F] text-slate-100' : 'bg-[#FAFBFD] text-[#0F1B2D]'
      }`}
    >
      <TopBar />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {sidebarOpen && <Sidebar />}

        <main className="relative flex min-w-0 flex-1 overflow-hidden">
          {/* 2D Pane (kept mounted cleanly to preserve pan/zoom & avoid teardown jank) */}
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

          {/* 3D Pane (kept mounted so WebGL & R3F Html portals never hit React 19 unmount race!) */}
          <section className={`${show3D ? 'flex' : 'hidden'} h-full min-w-0 flex-1 flex-col`}>
            <FloatingToolbar domain="3d" compact={mode === 'split'} />
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <CanvasErrorBoundary>
                <Viewport3D />
              </CanvasErrorBoundary>
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
    </div>
  );
}
