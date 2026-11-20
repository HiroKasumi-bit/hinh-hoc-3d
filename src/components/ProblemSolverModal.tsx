import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  ShieldCheck,
  Sparkles,
  Unlock,
  X,
} from 'lucide-react';
import { useGeometryStore } from '../store/useGeometryStore';
import type { SceneSnapshot, ViewMode } from '../types/geometry';

interface ProblemSolverModalProps {
  open: boolean;
  onClose: () => void;
}

interface DrawApiResponse {
  title: string;
  category: string;
  mode: ViewMode;
  showAxes: boolean;
  summary: string;
  steps: string[];
  snapshot: Partial<SceneSnapshot>;
  error?: string;
}

const EXAMPLE_PROBLEMS: Array<{ label: string; text: string }> = [
  {
    label: 'Hình chóp S.ABCD & thiết diện',
    text: 'Cho hình chóp S.ABCD có đáy ABCD là hình vuông cạnh 4, SA vuông góc với đáy, SA = 5. Gọi M là trung điểm SC, N là trung điểm SB. Vẽ thiết diện (AMN) và tính khoảng cách từ A đến (SCD).',
  },
  {
    label: 'Tứ diện đều & góc đường–mặt',
    text: 'Cho tứ diện đều ABCD cạnh 4. Gọi M là trung điểm CD, G là trọng tâm tam giác BCD. Tính góc giữa đường thẳng AM và mặt phẳng (BCD).',
  },
  {
    label: 'Tọa độ không gian Oxyz',
    text: 'Trong không gian Oxyz cho A(1; 2; 0), B(3; 0; 2), C(0; 3; 1) và mặt phẳng (P): x + y + z - 3 = 0. Tìm hình chiếu của A lên (P) và vẽ mặt cầu tâm I(1; 1; 1) bán kính 2.',
  },
  {
    label: 'Hàm số & tích phân quay Ox',
    text: 'Khảo sát và vẽ đồ thị hàm số y = x^3 - 3x + 2, vẽ tiếp tuyến tại x = 2 và tính diện tích hình phẳng giới hạn bởi đồ thị trên đoạn [-1; 2].',
  },
];

export const ProblemSolverModal: React.FC<ProblemSolverModalProps> = ({ open, onClose }) => {
  const view = useGeometryStore((s) => s.view);
  const applyGeneratedScene = useGeometryStore((s) => s.applyGeneratedScene);
  const showToast = useGeometryStore((s) => s.showToast);

  const [checkingAuth, setCheckingAuth] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [retryCountdown, setRetryCountdown] = useState(0);

  const [problemText, setProblemText] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<DrawApiResponse | null>(null);

  const isDark = view.theme === 'dark';

  // Close with Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Check server session status on open (clear sensitive passcode input on close)
  useEffect(() => {
    if (!open) {
      setPasscode('');
      setAuthError(null);
      setDrawError(null);
      return;
    }
    let cancelled = false;
    setCheckingAuth(true);
    setAuthError(null);
    fetch('/api/problem-auth/status', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Không thể kiểm tra trạng thái xác thực.');
        const data = (await res.json()) as { unlocked?: boolean };
        if (!cancelled) {
          setUnlocked(Boolean(data.unlocked));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUnlocked(false);
          setAuthError('Không kết nối được máy chủ xác thực (/api/problem-auth/status).');
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingAuth(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Rate-limit countdown timer
  useEffect(() => {
    if (retryCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setRetryCountdown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryCountdown]);

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim() || unlocking || retryCountdown > 0) return;
    setUnlocking(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/problem-auth/unlock', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        unlocked?: boolean;
        error?: string;
        retryAfterSec?: number;
      };
      if (res.ok && data.unlocked) {
        setUnlocked(true);
        setPasscode('');
        setAuthError(null);
        showToast('Đã mở khóa tính năng Vẽ theo đề bài.');
      } else {
        setPasscode('');
        if (res.status === 429 && typeof data.retryAfterSec === 'number') {
          setRetryCountdown(data.retryAfterSec);
        }
        setAuthError(data.error || 'Mã bảo mật không chính xác.');
      }
    } catch {
      setAuthError('Lỗi kết nối tới máy chủ xác thực.');
    } finally {
      setUnlocking(false);
    }
  };

  const handleLockSession = async () => {
    try {
      await fetch('/api/problem-auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch {
      // Ignore network hiccup on logout
    }
    setUnlocked(false);
    setPasscode('');
    setLastResult(null);
    showToast('Đã khóa lại tính năng Đề bài → Hình.');
  };

  const handleDrawProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = problemText.trim();
    if (!trimmed || drawing) return;
    setDrawing(true);
    setDrawError(null);
    try {
      const res = await fetch('/api/problem-draw', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemText: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as DrawApiResponse;
      if (res.status === 401) {
        setUnlocked(false);
        setAuthError(data.error || 'Phiên làm việc đã hết hạn. Vui lòng nhập lại mã bảo mật.');
        return;
      }
      if (!res.ok) {
        setDrawError(data.error || 'Không thể phân tích đề bài này.');
        return;
      }
      setLastResult(data);
      applyGeneratedScene({
        mode: data.mode,
        showAxes: data.showAxes,
        snapshot: data.snapshot,
        summary: data.summary,
      });
    } catch {
      setDrawError('Lỗi mạng khi gọi bộ phân tích đề bài trên máy chủ.');
    } finally {
      setDrawing(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-[2px] sm:p-4"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-2xl ${
          isDark ? 'border-slate-700 bg-[#111827] text-slate-100' : 'border-[#DCE3EC] bg-white text-[#0F1B2D]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between border-b px-4 py-3 sm:px-5 ${isDark ? 'border-slate-800' : 'border-[#E2E7EE]'}`}>
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${unlocked ? 'bg-[#0E9F6E]/15 text-[#0E9F6E]' : 'bg-[#7C3AED]/15 text-[#7C3AED]'}`}>
              {unlocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </div>
            <div>
              <h2 className="text-sm font-bold sm:text-base">Vẽ hình tự động từ đề bài</h2>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Phân tích & dựng hình trực tiếp phía máy chủ Cloudflare bảo mật
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {unlocked && (
              <button
                type="button"
                onClick={handleLockSession}
                className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                  isDark
                    ? 'border-slate-700 text-slate-300 hover:border-red-500 hover:text-red-400'
                    : 'border-slate-300 text-slate-600 hover:border-red-400 hover:text-red-600'
                }`}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Khóa lại</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`rounded-md p-1.5 ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {checkingAuth ? (
            <div className="flex items-center justify-center py-12 text-xs opacity-75">
              Đang kiểm tra phiên bảo mật máy chủ...
            </div>
          ) : !unlocked ? (
            <form onSubmit={handleUnlockSubmit} className="mx-auto max-w-md space-y-4 py-2">
              <div
                className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs leading-relaxed ${
                  isDark ? 'border-slate-800 bg-slate-900/70 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0E9F6E]" />
                <div>
                  Mã bảo mật được kiểm tra hoàn toàn trên máy chủ bằng thuật toán băm <strong>PBKDF2-SHA256</strong> và cấp phiên qua <strong>Cookie HttpOnly</strong>. Trình duyệt không lưu trữ mã dưới bất kỳ hình thức nào.
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold">Nhập mã bảo mật để mở khóa</label>
                <div className="relative">
                  <input
                    type={showPasscode ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    autoFocus
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Nhập mã bảo mật..."
                    disabled={retryCountdown > 0 || unlocking}
                    className={`w-full rounded-lg border py-2 pr-10 pl-3 text-sm outline-none transition-colors ${
                      isDark
                        ? 'border-slate-700 bg-slate-900 text-slate-100 focus:border-[#7C3AED]'
                        : 'border-slate-300 bg-white text-[#0F1B2D] focus:border-[#7C3AED]'
                    }`}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPasscode((v) => !v)}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 opacity-60 hover:opacity-100"
                    title={showPasscode ? 'Ẩn mã' : 'Hiện mã'}
                  >
                    {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {authError && (
                <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400">
                  {authError}
                  {retryCountdown > 0 && ` (Thử lại sau ${retryCountdown}s)`}
                </div>
              )}

              <button
                type="submit"
                disabled={!passcode.trim() || unlocking || retryCountdown > 0}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#7C3AED] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#6D28D9] disabled:opacity-50"
              >
                <Unlock className="h-4 w-4" />
                <span>{unlocking ? 'Đang xác thực...' : retryCountdown > 0 ? `Tạm khóa (${retryCountdown}s)` : 'Mở khóa tính năng'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleDrawProblem} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0E9F6E]/12 px-2.5 py-1 text-xs font-semibold text-[#0E9F6E]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Đã mở khóa (Bảo mật Server)
                </span>
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Hỗ trợ: Hình không gian S.ABCD / S.ABC / Tứ diện / Oxyz / Hàm số 2D
                </span>
              </div>

              <div>
                <div className="mb-1.5 text-xs font-semibold">Ví dụ đề bài THPT (bấm để điền nhanh)</div>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLE_PROBLEMS.map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => setProblemText(ex.text)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                        isDark
                          ? 'border-slate-700 bg-slate-900 text-slate-200 hover:border-[#1D5CE5]'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-[#1D5CE5] hover:text-[#1D5CE5]'
                      }`}
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold">Nhập nguyên văn đề bài toán tiếng Việt</label>
                <textarea
                  rows={4}
                  value={problemText}
                  onChange={(e) => setProblemText(e.target.value)}
                  placeholder="Ví dụ: Cho hình chóp S.ABCD có đáy ABCD là hình vuông cạnh 4, SA vuông góc với đáy, SA = 5. Gọi M là trung điểm SC..."
                  className={`w-full rounded-lg border p-3 text-xs leading-relaxed outline-none transition-colors sm:text-sm ${
                    isDark
                      ? 'border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-[#1D5CE5]'
                      : 'border-slate-300 bg-[#FAFBFD] text-[#0F1B2D] placeholder:text-slate-400 focus:border-[#1D5CE5] focus:bg-white'
                  }`}
                />
              </div>

              {drawError && (
                <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400">
                  {drawError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="submit"
                  disabled={!problemText.trim() || drawing}
                  className="flex items-center gap-1.5 rounded-lg bg-[#1D5CE5] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#174CC2] disabled:opacity-50 sm:text-sm"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{drawing ? 'Đang dựng hình...' : 'Phân tích & Vẽ hình'}</span>
                </button>
              </div>

              {lastResult && (
                <div className={`space-y-2 rounded-lg border p-3 ${isDark ? 'border-emerald-900/60 bg-emerald-950/25' : 'border-emerald-200 bg-emerald-50/70'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#0E9F6E]">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>{lastResult.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-md bg-[#0E9F6E] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#059669]"
                    >
                      Xem hình vẽ
                    </button>
                  </div>
                  <p className="text-xs opacity-85">{lastResult.summary}</p>
                  {lastResult.steps?.length > 0 && (
                    <ul className="list-disc space-y-0.5 pl-4 text-[11.5px] opacity-85">
                      {lastResult.steps.map((st, idx) => (
                        <li key={idx}>{st}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
