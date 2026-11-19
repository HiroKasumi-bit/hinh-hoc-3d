# HìnhHọcViệt — Ứng dụng Vẽ Hình 2D & 3D Toán THPT (Lớp 10, 11, 12)

## Mục tiêu
Xây dựng ứng dụng web vẽ hình học 2D & 3D giống GeoGebra nhưng đơn giản hơn, tiện dùng hơn, 100% tiếng Việt chuẩn chương trình GDPT 2018 cho học sinh & giáo viên THPT (Lớp 10, 11, 12).

## Công nghệ chính
- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS v4, Zustand, Lucide Icons.
- **Đồ họa 3D**: Three.js + React Three Fiber (`@react-three/fiber` v9) + `@react-three/drei` v10 (`Line2`, `Html`, `OrbitControls`, `GizmoHelper`).
- **Đồ họa 2D**: HTML5 Canvas 2D HiDPI tự tối ưu (pan/zoom, lưới thích ứng, kéo điểm thời gian thực, đồ thị hàm số + tiệm cận + cực trị + tích phân + bất phương trình + Conic).
- **Kiểm thử toán học**: Vitest (`npm run test`).

## Quy ước quan trọng
- **Hệ tọa độ Oxyz chuẩn SGK Việt Nam**: Trục $Oz$ hướng thẳng đứng lên trên. Ánh xạ sang Three.js: `(x, y, z)_math -> (y, z, x)_three` (bảo toàn hệ trục tay phải).
- **Nét đứt cạnh khuất tự động**: Mọi đa diện lớp 11 tự động đổi cạnh khuất sang nét đứt theo góc nhìn camera.
- **Ngôn ngữ**: 100% tiếng Việt tự nhiên, font `Be Vietnam Pro` + `JetBrains Mono`.
