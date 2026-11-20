import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Axis3D,
  BookOpen,
  Box,
  Camera,
  Columns2,
  FolderOpen,
  Grid,
  Keyboard,
  Lock,
  Moon,
  PanelLeft,
  Redo2,
  Save,
  Square,
  Sun,
  Tag,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { useGeometryStore } from '../store/useGeometryStore';
import { THPT_PRESETS } from '../presets/thptPresets';
import { useViewportProfile } from '../hooks/useViewportProfile';
import { ShortcutSettingsModal } from './ShortcutSettingsModal';
import { ProblemSolverModal } from './ProblemSolverModal';
import type { ViewMode } from '../types/geometry';

export const TopBar: React.FC = () => {
  const mode = useGeometryStore((s) => s.mode);
  const setMode = useGeometryStore((s) => s.setMode);
  const view = useGeometryStore((s) => s.view);
  const updateView = useGeometryStore((s) => s.updateView);
  const sidebarOpen = useGeometryStore((s) => s.sidebarOpen);
  const setSidebarOpen = useGeometryStore((s) => s.setSidebarOpen);
  const past = useGeometryStore((s) => s.past);
  const future = useGeometryStore((s) => s.future);
  const undo = useGeometryStore((s) => s.undo);
  const redo = useGeometryStore((s) => s.redo);
  const loadPreset = useGeometryStore((s) => s.loadPreset);
  const activePresetId = useGeometryStore((s) => s.activePresetId);
  const clearScene = useGeometryStore((s) => s.clearScene);
  const exportJSON = useGeometryStore((s) => s.exportJSON);
  const importJSON = useGeometryStore((s) => s.importJSON);
  const showToast = useGeometryStore((s) => s.showToast);

  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [problemModalOpen, setProblemModalOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [gradeTab, setGradeTab] = useState<10 | 11 | 12>(11);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const vp = useViewportProfile();

  useEffect(() => {
    const onOpenPresets = () => setPresetModalOpen(true);
    const onOpenProblemSolver = () => setProblemModalOpen(true);
    const onOpenShortcuts = () => setShortcutsOpen(true);
    window.addEventListener('hinhhocviet-open-presets', onOpenPresets);
    window.addEventListener('hinhhocviet-open-problem-solver', onOpenProblemSolver);
    window.addEventListener('hinhhocviet-open-shortcuts', onOpenShortcuts);
    return () => {
      window.removeEventListener('hinhhocviet-open-presets', onOpenPresets);
      window.removeEventListener('hinhhocviet-open-problem-solver', onOpenProblemSolver);
      window.removeEventListener('hinhhocviet-open-shortcuts', onOpenShortcuts);
    };
  }, []);

  useEffect(() => {
    if (!presetModalOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPresetModalOpen(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [presetModalOpen]);

  const isDark = view.theme === 'dark';

  const handleExportPNG = () => {
    if (mode === '2d') {
      window.dispatchEvent(new Event('hinhhocviet-export-2d'));
    } else if (mode === '3d') {
      window.dispatchEvent(new Event('hinhhocviet-export-3d'));
    } else {
      window.dispatchEvent(new Event('hinhhocviet-export-2d'));
      window.dispatchEvent(new Event('hinhhocviet-export-3d'));
    }
    showToast('Đã xuất ảnh PNG sắc nét', 'success');
  };

  const handleSaveJSON = () => {
    const content = exportJSON();
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HinhHocViet-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã lưu tệp bài làm (.json)', 'success');
  };

  const handleOpenJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') importJSON(reader.result);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const modeOptions: Array<{ id: ViewMode; label: string; icon: React.ReactNode }> = [
    { id: '2d', label: '2D Phẳng', icon: <Square className="h-3.5 w-3.5" /> },
    { id: '3d', label: '3D Không gian', icon: <Box className="h-3.5 w-3.5" /> },
    { id: 'split', label: 'Song song 2D+3D', icon: <Columns2 className="h-3.5 w-3.5" /> },
  ];

  return (
    <>
      <header
        className={`safe-x z-30 flex shrink-0 items-center justify-between gap-1.5 border-b transition-colors ${
          vp.isPhoneLandscape ? 'h-10' : 'h-12'
        } ${
          isDark
            ? 'border-slate-800 bg-[#111827] text-slate-100'
            : 'border-[#E2E7EE] bg-white text-[#0F1B2D]'
        }`}
      >
        {/* Left: Sidebar toggle + Brand */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            aria-label={sidebarOpen ? 'Thu gọn bảng bên trái' : 'Mở bảng nhập & đối tượng'}
            title={sidebarOpen ? 'Thu gọn bảng bên trái' : 'Mở bảng nhập & đối tượng'}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`rounded-md p-1.5 sm:p-2 transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            <PanelLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-1.5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <polygon points="12,2.5 21,7.5 12,12.5 3,7.5" fill="#1D5CE5" fillOpacity="0.18" stroke="#1D5CE5" strokeWidth="1.7" strokeLinejoin="round" />
              <polygon points="3,7.5 12,12.5 12,21.5 3,16.5" fill="#0E9F6E" fillOpacity="0.16" stroke="#1D5CE5" strokeWidth="1.7" strokeLinejoin="round" />
              <polygon points="21,7.5 12,12.5 12,21.5 21,16.5" fill="#1D5CE5" fillOpacity="0.08" stroke="#1D5CE5" strokeWidth="1.7" strokeLinejoin="round" />
              <line x1="12" y1="2.5" x2="12" y2="21.5" stroke="#1D5CE5" strokeWidth="1.2" strokeDasharray="2 2" />
            </svg>
            <div className="leading-tight">
              <span className="hidden text-sm font-bold tracking-tight sm:inline">HìnhHọcViệt</span>
              <span className={`ml-1.5 hidden text-[11px] font-medium lg:inline ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Toán THPT 10–11–12
              </span>
            </div>
          </div>
        </div>

        {/* Center: Mode Switcher (2D | 3D in portrait; 2D | 3D | 2D+3D in landscape & desktop!) */}
        <div
          className={`flex items-center rounded-lg border p-0.5 ${
            isDark ? 'border-slate-700 bg-slate-900' : 'border-[#DCE3EC] bg-[#F2F5F9]'
          }`}
        >
          {modeOptions.map((opt) => {
            const active = mode === opt.id;
            const hideInPortrait = opt.id === 'split' && vp.isPhonePortrait;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMode(opt.id)}
                className={`${hideInPortrait ? 'hidden' : 'flex'} items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-all sm:px-2.5 ${
                  active
                    ? isDark
                      ? 'bg-[#1D5CE5] text-white shadow-2xs'
                      : 'bg-white text-[#1D5CE5] shadow-2xs'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-[#0F1B2D]'
                }`}
              >
                {opt.icon}
                <span>
                  {vp.isCompact
                    ? opt.id === '2d'
                      ? '2D'
                      : opt.id === '3d'
                      ? '3D'
                      : '2D+3D'
                    : opt.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Problem Solver + THPT Presets + Utility Controls */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button
            type="button"
            title="Nhập đề bài toán tiếng Việt để tự động vẽ hình (có khóa bảo mật)"
            onClick={() => setProblemModalOpen(true)}
            className="flex items-center gap-1 rounded-md bg-[#7C3AED] px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9] sm:px-2.5 sm:py-1.5"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>{vp.isCompact ? 'Đề bài' : 'Đề bài → Hình'}</span>
          </button>

          <button
            type="button"
            onClick={() => setPresetModalOpen(true)}
            className="flex items-center gap-1 rounded-md bg-[#1D5CE5] px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#174CC2] sm:px-2.5 sm:py-1.5"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>{vp.isCompact ? 'Mẫu' : 'Mẫu đề THPT'}</span>
          </button>

          <div className={`mx-0.5 hidden h-4 w-px sm:block ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

          <button
            type="button"
            title="Hoàn tác (Ctrl+Z)"
            disabled={past.length === 0}
            onClick={undo}
            className={`rounded-md p-1.5 transition-colors disabled:opacity-35 ${
              isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
            }`}
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Làm lại (Ctrl+Y)"
            disabled={future.length === 0}
            onClick={redo}
            className={`${vp.isPhonePortrait ? 'hidden' : 'inline-flex'} rounded-md p-1.5 transition-colors disabled:opacity-35 ${
              isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
            }`}
          >
            <Redo2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            title={view.showAxes ? 'Tắt trục tọa độ Oxy / Oxyz' : 'Bật trục tọa độ Oxy / Oxyz'}
            onClick={() => updateView({ showAxes: !view.showAxes })}
            className={`rounded-md p-1.5 transition-colors ${
              view.showAxes ? 'bg-[#1D5CE5]/12 text-[#1D5CE5]' : 'opacity-50'
            } ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
          >
            <Axis3D className="h-4 w-4" />
          </button>
          <button
            type="button"
            title={view.showGrid ? 'Tắt lưới ô vuông' : 'Bật lưới ô vuông'}
            onClick={() => updateView({ showGrid: !view.showGrid })}
            className={`${vp.isPhonePortrait ? 'hidden' : 'inline-flex'} rounded-md p-1.5 transition-colors ${
              view.showGrid ? 'bg-[#1D5CE5]/12 text-[#1D5CE5]' : 'opacity-50'
            } ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Bật/tắt tên điểm & số đo"
            onClick={() => updateView({ showLabels: !view.showLabels })}
            className={`${vp.isCompact ? 'hidden' : 'inline-flex'} rounded-md p-1.5 transition-colors ${
              view.showLabels ? 'text-[#1D5CE5]' : 'opacity-50'
            } ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
          >
            <Tag className="h-4 w-4" />
          </button>

          <div className={`mx-0.5 hidden h-4 w-px lg:block ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

          <button
            type="button"
            title="Chụp ảnh PNG chèn Word / Đề thi"
            onClick={handleExportPNG}
            className={`${vp.isPhonePortrait ? 'hidden' : 'flex'} items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium transition-colors sm:px-2 ${
              isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Xuất PNG</span>
          </button>

          <button
            type="button"
            title="Lưu tệp bài làm (.json)"
            onClick={handleSaveJSON}
            className={`${vp.isCompact ? 'hidden' : 'inline-flex'} rounded-md p-1.5 transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
          >
            <Save className="h-4 w-4" />
          </button>

          <button
            type="button"
            title="Mở tệp đã lưu (.json)"
            onClick={() => fileInputRef.current?.click()}
            className={`${vp.isCompact ? 'hidden' : 'inline-flex'} rounded-md p-1.5 transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
          >
            <FolderOpen className="h-4 w-4" />
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleOpenJSON} className="hidden" />

          <button
            type="button"
            title="Cài đặt phím tắt"
            aria-label="Cài đặt phím tắt"
            onClick={() => setShortcutsOpen(true)}
            className={`${vp.isPhonePortrait ? 'hidden' : 'inline-flex'} items-center gap-1 rounded-md p-1.5 text-xs font-medium transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            <Keyboard className="h-4 w-4" />
          </button>

          <button
            type="button"
            title="Xóa sạch bảng vẽ"
            onClick={() => clearScene('all')}
            className={`rounded-md p-1.5 text-red-500 transition-colors ${
              isDark ? 'hover:bg-red-950/50' : 'hover:bg-red-50'
            }`}
          >
            <Trash2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            title={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
            onClick={() => updateView({ theme: isDark ? 'light' : 'dark' })}
            className={`rounded-md p-1.5 transition-colors ${isDark ? 'hover:bg-slate-800 text-amber-400' : 'hover:bg-slate-100 text-slate-600'}`}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* ==================== THPT PRESETS LIBRARY MODAL ==================== */}
      {presetModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
            onClick={() => setPresetModalOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-xl ${
                isDark ? 'border-slate-700 bg-[#111827] text-slate-100' : 'border-[#DCE3EC] bg-white text-[#0F1B2D]'
              }`}
            >
              <div className={`flex shrink-0 items-center justify-between border-b px-4 py-2.5 sm:px-5 sm:py-3.5 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <div>
                  <h2 className="text-base font-bold">Thư viện Mẫu Đề Bài Toán THPT (GDPT 2018)</h2>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Chọn 1 mẫu bất kỳ để dựng ngay hình chuẩn SGK — có thể xoay, cắt thiết diện hoặc kéo tham số trực tiếp
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Đóng thư viện mẫu"
                  onClick={() => setPresetModalOpen(false)}
                  className={`rounded-md p-1.5 ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

            {/* Grade Tabs */}
            <div className={`flex gap-2 border-b px-5 py-2.5 ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-[#FAFBFD]'}`}>
              {([10, 11, 12] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGradeTab(g)}
                  className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
                    gradeTab === g
                      ? 'bg-[#1D5CE5] text-white'
                      : isDark
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Toán Lớp {g}
                </button>
              ))}
            </div>

            {/* Preset Cards */}
            <div className="grid grid-cols-1 gap-3 overflow-y-auto p-5 sm:grid-cols-2">
              {THPT_PRESETS.filter((p) => p.grade === gradeTab).map((preset) => {
                const isActive = activePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      loadPreset(preset.id);
                      setPresetModalOpen(false);
                    }}
                    className={`group flex flex-col items-start rounded-lg border p-3.5 text-left transition-all ${
                      isActive
                        ? 'border-[#1D5CE5] bg-[#1D5CE5]/8'
                        : isDark
                        ? 'border-slate-700 bg-slate-900/70 hover:border-[#1D5CE5]/70'
                        : 'border-[#DCE3EC] bg-white hover:border-[#1D5CE5]'
                    }`}
                  >
                    <div className="mb-1.5 flex w-full items-center justify-between gap-2">
                      <span className="rounded bg-[#1D5CE5]/12 px-2 py-0.5 text-[11px] font-semibold text-[#1D5CE5]">
                        {preset.badge}
                      </span>
                      <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {preset.mode === '2d' ? '2D Phẳng' : preset.mode === '3d' ? '3D Không gian' : 'Song song 2D+3D'}
                      </span>
                    </div>
                    <div className="text-sm font-semibold leading-snug group-hover:text-[#1D5CE5]">{preset.title}</div>
                    <p className={`mt-1 text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {preset.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      <ShortcutSettingsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <ProblemSolverModal open={problemModalOpen} onClose={() => setProblemModalOpen(false)} />
    </>
  );
};
