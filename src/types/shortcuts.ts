export type ShortcutActionId =
  // Tools (shared across 2D & 3D)
  | 'tool_select'
  | 'tool_point'
  | 'tool_segment'
  | 'tool_line'
  | 'tool_vector'
  | 'tool_tetrahedron3d'
  | 'tool_pyramid4_3d'
  | 'tool_box3d'
  | 'tool_midpoint'
  | 'tool_plane_or_polygon'
  | 'tool_section_or_perp'
  | 'tool_circle_or_builder'
  | 'tool_distance'
  | 'tool_angle'
  // Editing & Point operations
  | 'rename_point'
  | 'toggle_multi_select'
  | 'delete_selected'
  // Modes, Views & Dialogs
  | 'mode_2d'
  | 'mode_3d'
  | 'mode_split'
  | 'open_builder_3d'
  | 'open_presets'
  | 'toggle_axes'
  | 'toggle_grid'
  | 'toggle_hidden_edges'
  | 'reset_camera';

export type ShortcutMap = Record<ShortcutActionId, string>;

export interface ShortcutMeta {
  id: ShortcutActionId;
  category: 'tools' | 'editing' | 'view';
  label: string;
  description: string;
}

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  // Nhóm công cụ vẽ (chuẩn tay trái + chữ cái gợi nhớ khoa học)
  tool_select: 'V',
  tool_point: 'P',
  tool_segment: 'S',
  tool_line: 'L',
  tool_vector: 'U',
  tool_tetrahedron3d: 'Y',
  tool_pyramid4_3d: 'E',
  tool_box3d: 'W',
  tool_midpoint: 'M',
  tool_plane_or_polygon: 'F',
  tool_section_or_perp: 'X',
  tool_circle_or_builder: 'C',
  tool_distance: 'D',
  tool_angle: 'A',
  // Nhóm chỉnh sửa điểm & đối tượng
  rename_point: 'R',
  toggle_multi_select: 'Q',
  delete_selected: 'Delete',
  // Nhóm chế độ & hiển thị
  mode_2d: '1',
  mode_3d: '2',
  mode_split: '3',
  open_builder_3d: 'B',
  open_presets: 'K',
  toggle_axes: 'T',
  toggle_grid: 'G',
  toggle_hidden_edges: 'H',
  reset_camera: '0',
};

export const SHORTCUT_META: ShortcutMeta[] = [
  // Editing (put Rename Point prominently!)
  {
    id: 'rename_point',
    category: 'editing',
    label: 'Sửa tên điểm đang chọn',
    description: 'Mở hộp đổi tên điểm 2D hoặc 3D đang chọn (hỗ trợ thêm F2)',
  },
  {
    id: 'toggle_multi_select',
    category: 'editing',
    label: 'Bật/Tắt chế độ Chọn nhiều',
    description: 'Chọn liên tiếp nhiều điểm/mặt mà không cần giữ Shift',
  },
  {
    id: 'delete_selected',
    category: 'editing',
    label: 'Xóa đối tượng đang chọn',
    description: 'Xóa điểm, đoạn, mặt phẳng hoặc hình khối đang chọn',
  },

  // Drawing Tools
  {
    id: 'tool_select',
    category: 'tools',
    label: 'Chọn / Xoay / Kéo điểm',
    description: 'Trở về con trỏ chọn và xoay góc nhìn',
  },
  {
    id: 'tool_point',
    category: 'tools',
    label: 'Chấm điểm mới',
    description: 'Chạm đặt điểm (3D: nhấn giữ kéo lên/xuống chỉnh độ cao z)',
  },
  {
    id: 'tool_segment',
    category: 'tools',
    label: 'Vẽ đoạn thẳng',
    description: 'Nối 2 điểm thành đoạn thẳng',
  },
  {
    id: 'tool_line',
    category: 'tools',
    label: 'Vẽ đường thẳng',
    description: 'Dựng đường thẳng đi qua 2 điểm',
  },
  {
    id: 'tool_vector',
    category: 'tools',
    label: 'Vẽ vectơ',
    description: 'Dựng vectơ từ điểm gốc đến điểm ngọn',
  },
  {
    id: 'tool_tetrahedron3d',
    category: 'tools',
    label: 'Dựng Tứ diện / Chóp tam giác (3 điểm)',
    description: 'Chấm hoặc chọn 3 điểm A → B → C là tự dựng ngay khối tứ diện S.ABC (nhấn giữ bước 3 để kéo chiều cao S)',
  },
  {
    id: 'tool_pyramid4_3d',
    category: 'tools',
    label: 'Dựng Chóp tứ giác (2 điểm đáy + đỉnh S)',
    description: 'Chấm 2 điểm A → B tạo đáy vuông ABCD, điểm thứ 3 đặt đỉnh S ra ngay hình chóp S.ABCD',
  },
  {
    id: 'tool_box3d',
    category: 'tools',
    label: 'Dựng Khối hộp / Lập phương (2 điểm + cao)',
    description: 'Chấm 2 điểm A → B tạo đáy vuông ABCD, bước 3 chọn chiều cao ra ngay khối hộp ABCD.A′B′C′D′',
  },
  {
    id: 'tool_midpoint',
    category: 'tools',
    label: 'Lấy trung điểm',
    description: 'Tìm trung điểm của 2 điểm',
  },
  {
    id: 'tool_plane_or_polygon',
    category: 'tools',
    label: 'Mặt phẳng (3D) / Đa giác (2D)',
    description: '3D: dựng mặt phẳng qua 3 điểm · 2D: vẽ đa giác',
  },
  {
    id: 'tool_section_or_perp',
    category: 'tools',
    label: 'Thiết diện (3D) / Vuông góc (2D)',
    description: '3D: cắt thiết diện qua 3 điểm · 2D: hạ đường vuông góc',
  },
  {
    id: 'tool_circle_or_builder',
    category: 'tools',
    label: 'Đường tròn (2D) / Tạo khối 3D',
    description: '2D: vẽ đường tròn · 3D: mở nhanh bảng tạo khối & Oxyz',
  },
  {
    id: 'tool_distance',
    category: 'tools',
    label: 'Đo độ dài / Khoảng cách',
    description: 'Đo khoảng cách giữa 2 điểm hoặc điểm – mặt phẳng',
  },
  {
    id: 'tool_angle',
    category: 'tools',
    label: 'Đo góc',
    description: 'Chọn 3 điểm A → B (đỉnh) → C để đo góc ∠ABC',
  },

  // Views & Modes
  {
    id: 'mode_2d',
    category: 'view',
    label: 'Chế độ 2D Phẳng',
    description: 'Chuyển sang mặt phẳng Oxy',
  },
  {
    id: 'mode_3d',
    category: 'view',
    label: 'Chế độ 3D Không gian',
    description: 'Chuyển sang không gian 3D / Oxyz',
  },
  {
    id: 'mode_split',
    category: 'view',
    label: 'Chế độ Song song 2D + 3D',
    description: 'Chia đôi màn hình xem đồng thời 2D và 3D',
  },
  {
    id: 'open_builder_3d',
    category: 'view',
    label: 'Mở bảng + Tạo khối & Oxyz',
    description: 'Mở hộp thoại tạo nhanh chóp, lăng trụ, nón–trụ–cầu, Oxyz',
  },
  {
    id: 'open_presets',
    category: 'view',
    label: 'Mở thư viện Mẫu đề THPT',
    description: 'Chọn 12 mẫu bài tập lớp 10–11–12 dựng sẵn',
  },
  {
    id: 'toggle_axes',
    category: 'view',
    label: 'Bật/Tắt trục tọa độ Oxy/Oxyz',
    description: 'Ẩn hoặc hiện trục tọa độ màu',
  },
  {
    id: 'toggle_grid',
    category: 'view',
    label: 'Bật/Tắt lưới ô vuông',
    description: 'Ẩn hoặc hiện đường lưới nền',
  },
  {
    id: 'toggle_hidden_edges',
    category: 'view',
    label: 'Bật/Tắt nét đứt cạnh khuất 3D',
    description: 'Chuyển chế độ tự động vẽ nét đứt cho cạnh bị che khuất',
  },
  {
    id: 'reset_camera',
    category: 'view',
    label: 'Đưa góc nhìn 3D về chuẩn',
    description: 'Căn giữa lại góc nhìn 3D mặc định',
  },
];

const STORAGE_KEY = 'hinhhocviet_shortcuts_v1';

export function loadSavedShortcuts(): ShortcutMap {
  if (typeof window === 'undefined') return { ...DEFAULT_SHORTCUTS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SHORTCUTS };
    const parsed = JSON.parse(raw) as Partial<ShortcutMap>;
    return { ...DEFAULT_SHORTCUTS, ...parsed };
  } catch {
    return { ...DEFAULT_SHORTCUTS };
  }
}

export function saveShortcuts(map: ShortcutMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta']);

/**
 * Converts a KeyboardEvent into a canonical shortcut string such as:
 * "V", "R", "F2", "Delete", "Alt+R", "Shift+P".
 * Returns null if only a modifier key was pressed or if reserved (Escape).
 */
export function eventToShortcutString(e: {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  if (e.key === 'Escape') return null;

  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');

  let base = e.key;
  if (base === ' ') {
    base = 'Space';
  } else if (base.length === 1) {
    // Use physical key letter for A-Z so Vietnamese Telex/VNI IME or Shift doesn't break shortcuts
    if (e.code && /^Key[A-Z]$/.test(e.code)) {
      base = e.code.slice(3);
    } else if (e.code && /^Digit[0-9]$/.test(e.code)) {
      base = e.code.slice(5);
    } else {
      base = base.toUpperCase();
    }
  } else if (base === 'Del') {
    base = 'Delete';
  }

  // Only include Shift modifier when explicitly combined with non-symbol keys (e.g. Shift+P)
  if (e.shiftKey && (/^[A-Z0-9]$/.test(base) || /^F\d+$/.test(base))) {
    parts.push('Shift');
  }

  parts.push(base);
  return parts.join('+');
}

export function formatShortcutBadge(shortcut: string): string {
  if (!shortcut) return '—';
  return shortcut
    .replace('Delete', 'Del')
    .replace('Backspace', 'Bksp')
    .replace('Space', 'Space');
}
