import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Keyboard, RotateCcw, Trash2, X } from 'lucide-react';
import { useGeometryStore } from '../store/useGeometryStore';
import {
  eventToShortcutString,
  formatShortcutBadge,
  SHORTCUT_META,
  type ShortcutActionId,
} from '../types/shortcuts';

const CATEGORY_TITLES: Record<'editing' | 'tools' | 'view', string> = {
  editing: 'Chỉnh sửa điểm & đối tượng',
  tools: 'Công cụ vẽ hình (2D & 3D)',
  view: 'Chế độ làm việc & hiển thị',
};

export const ShortcutSettingsModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const shortcuts = useGeometryStore((s) => s.shortcuts);
  const setShortcut = useGeometryStore((s) => s.setShortcut);
  const resetShortcuts = useGeometryStore((s) => s.resetShortcuts);
  const isDark = useGeometryStore((s) => s.view.theme === 'dark');

  const [recordingId, setRecordingId] = useState<ShortcutActionId | null>(null);

  useEffect(() => {
    if (!open) {
      setRecordingId(null);
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (recordingId) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape') {
          setRecordingId(null);
          return;
        }
        const combo = eventToShortcutString(e);
        if (combo) {
          setShortcut(recordingId, combo);
          setRecordingId(null);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, recordingId, setShortcut, onClose]);

  if (!open) return null;

  const categories: Array<'editing' | 'tools' | 'view'> = ['editing', 'tools', 'view'];

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/45 p-3 sm:p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-xl ${
          isDark ? 'border-slate-700 bg-[#111827] text-slate-100' : 'border-[#DCE3EC] bg-white text-[#0F1B2D]'
        }`}
      >
        {/* Header */}
        <div className={`flex shrink-0 items-center justify-between border-b px-4 py-3 sm:px-5 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-[#1D5CE5]" />
            <div>
              <h2 className="text-sm font-bold sm:text-base">Cài đặt phím tắt</h2>
              <p className={`hidden text-xs sm:block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Bấm vào ô phím để gán phím mới (tự lưu vào trình duyệt, tự xử lý trùng phím)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={resetShortcuts}
              className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                isDark
                  ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Mặc định</span>
            </button>
            <button
              type="button"
              aria-label="Đóng cài đặt phím tắt"
              onClick={onClose}
              className={`rounded-md p-1.5 ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          {categories.map((cat) => (
            <div key={cat} className="space-y-2">
              <h3 className="text-xs font-bold text-[#1D5CE5]">{CATEGORY_TITLES[cat]}</h3>
              <div className="divide-y rounded-lg border dark:divide-slate-800 dark:border-slate-800 divide-slate-100 border-[#E2E7EE]">
                {SHORTCUT_META.filter((m) => m.category === cat).map((item) => {
                  const isRecording = recordingId === item.id;
                  const currentKey = shortcuts[item.id] ?? '';
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-3 px-3 py-2 text-xs ${
                        isRecording
                          ? isDark
                            ? 'bg-[#1D5CE5]/15'
                            : 'bg-[#1D5CE5]/8'
                          : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{item.label}</div>
                        <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {item.description}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setRecordingId(isRecording ? null : item.id)}
                          className={`font-math min-w-[76px] rounded-md border px-2.5 py-1 text-center text-xs font-semibold transition-all ${
                            isRecording
                              ? 'border-[#1D5CE5] bg-[#1D5CE5] text-white'
                              : currentKey
                              ? isDark
                                ? 'border-slate-600 bg-slate-800 text-slate-100 hover:border-[#1D5CE5]'
                                : 'border-slate-300 bg-[#FAFBFD] text-[#0F1B2D] hover:border-[#1D5CE5]'
                              : isDark
                              ? 'border-dashed border-slate-700 text-slate-500 hover:border-slate-500'
                              : 'border-dashed border-slate-300 text-slate-400 hover:border-slate-400'
                          }`}
                        >
                          {isRecording ? 'Nhấn phím...' : formatShortcutBadge(currentKey)}
                        </button>
                        {currentKey && !isRecording && (
                          <button
                            type="button"
                            title="Gỡ phím tắt này"
                            onClick={() => setShortcut(item.id, '')}
                            className="rounded p-1 opacity-50 hover:text-red-500 hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div
            className={`rounded-lg border px-3 py-2 text-[11px] ${
              isDark ? 'border-slate-800 bg-slate-900/60 text-slate-400' : 'border-slate-200 bg-[#FAFBFD] text-slate-500'
            }`}
          >
            Phím hệ thống luôn hoạt động: <strong className="font-math">Ctrl+Z</strong> (Hoàn tác),{' '}
            <strong className="font-math">Ctrl+Y</strong> (Làm lại), <strong className="font-math">Esc</strong> (Hủy công cụ / Bỏ chọn),{' '}
            <strong className="font-math">F2</strong> (Sửa nhanh tên điểm đang chọn).
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
