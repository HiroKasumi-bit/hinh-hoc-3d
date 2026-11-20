import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, X } from 'lucide-react';
import { useGeometryStore } from '../store/useGeometryStore';
import { formatShortcutBadge } from '../types/shortcuts';

const QUICK_NAMES = ['S', 'A', 'B', 'C', 'D', "A'", "B'", "C'", "D'", 'M', 'N', 'P', 'H', 'O', 'I', 'G'];

export const RenamePointModal: React.FC = () => {
  const renamingPoint = useGeometryStore((s) => s.renamingPoint);
  const closeRenamePoint = useGeometryStore((s) => s.closeRenamePoint);
  const renamePoint = useGeometryStore((s) => s.renamePoint);
  const scene2d = useGeometryStore((s) => s.scene2d);
  const scene3d = useGeometryStore((s) => s.scene3d);
  const shortcuts = useGeometryStore((s) => s.shortcuts);
  const isDark = useGeometryStore((s) => s.view.theme === 'dark');

  const currentPoint = renamingPoint
    ? renamingPoint.domain === '2d'
      ? scene2d.points.find((p) => p.id === renamingPoint.id)
      : scene3d.points.find((p) => p.id === renamingPoint.id)
    : null;

  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentPoint) return;
    setValue(currentPoint.name);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [currentPoint?.id, currentPoint?.name]);

  useEffect(() => {
    if (!renamingPoint) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRenamePoint();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [renamingPoint, closeRenamePoint]);

  if (!renamingPoint || !currentPoint) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    renamePoint(renamingPoint.domain, renamingPoint.id, value);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
      onClick={closeRenamePoint}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92dvh] w-full max-w-sm flex-col overflow-hidden rounded-xl border shadow-xl ${
          isDark ? 'border-slate-700 bg-[#111827] text-slate-100' : 'border-[#DCE3EC] bg-white text-[#0F1B2D]'
        }`}
      >
        <div className={`flex shrink-0 items-center justify-between border-b px-4 py-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-[#1D5CE5]" />
            <h3 className="text-sm font-bold">Sửa tên điểm</h3>
            {shortcuts.rename_point && (
              <kbd
                className={`font-math rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                  isDark ? 'border-slate-700 bg-slate-800 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'
                }`}
              >
                {formatShortcutBadge(shortcuts.rename_point)}
              </kbd>
            )}
          </div>
          <button
            type="button"
            aria-label="Đóng hộp đổi tên"
            onClick={closeRenamePoint}
            className={`rounded-md p-1 ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 overflow-y-auto p-4">
          <div>
            <label className="mb-1.5 block text-xs opacity-75">
              Tên mới cho điểm <strong className="font-semibold">{currentPoint.name}</strong> ({renamingPoint.domain.toUpperCase()})
            </label>
            <div className="flex items-center gap-1.5">
              <input
                ref={inputRef}
                type="text"
                maxLength={24}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Vd: S, A', M, H..."
                className={`font-math flex-1 rounded-lg border px-3 py-2 text-sm font-semibold outline-none ${
                  isDark
                    ? 'border-slate-700 bg-slate-900 text-slate-100 focus:border-[#1D5CE5]'
                    : 'border-slate-300 bg-[#FAFBFD] text-[#0F1B2D] focus:border-[#1D5CE5] focus:bg-white'
                }`}
              />
              <button
                type="button"
                title="Thêm dấu phẩy trên (A')"
                onClick={() => {
                  setValue((v) => `${v}'`);
                  inputRef.current?.focus();
                }}
                className={`font-math rounded-lg border px-2.5 py-2 text-sm font-bold ${
                  isDark ? 'border-slate-700 bg-slate-800 hover:bg-slate-700' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                ′
              </button>
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] opacity-65">Chọn nhanh ký hiệu hay dùng:</div>
            <div className="grid grid-cols-8 gap-1">
              {QUICK_NAMES.map((nm) => (
                <button
                  key={nm}
                  type="button"
                  onClick={() => setValue(nm)}
                  className={`font-math rounded border py-1 text-xs font-semibold transition-colors ${
                    value === nm
                      ? 'border-[#1D5CE5] bg-[#1D5CE5] text-white'
                      : isDark
                      ? 'border-slate-700 bg-slate-800 text-slate-200 hover:border-[#1D5CE5]'
                      : 'border-slate-200 bg-[#F8FAFC] text-[#0F1B2D] hover:border-[#1D5CE5]'
                  }`}
                >
                  {nm}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={closeRenamePoint}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'
              }`}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              className="rounded-lg bg-[#1D5CE5] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#174CC2] disabled:opacity-40"
            >
              Lưu tên mới
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
