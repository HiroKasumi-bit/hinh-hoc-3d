import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Focus, Minus, Plus } from 'lucide-react';
import { useGeometryStore } from '../store/useGeometryStore';
import { compileExpression } from '../math/parser';
import {
  analyzeFunction2D,
  angle3Points2D,
  computeIntegral2D,
  dist2D,
  distPointToLine2D,
  formatNum,
  polygonArea2D,
  resolveLine2D,
  resolvePoints2D,
} from '../math/geometry2d';
import type { Vec2 } from '../types/geometry';

interface Camera2D {
  cx: number; // world center x
  cy: number; // world center y
  scale: number; // pixels per math unit
}

function niceStep(pixelsPerUnit: number): number {
  const targetPx = 68;
  const raw = targetPx / pixelsPerUnit;
  const pow10 = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / pow10;
  if (norm < 1.5) return 1 * pow10;
  if (norm < 3.5) return 2 * pow10;
  if (norm < 7.5) return 5 * pow10;
  return 10 * pow10;
}

export const Canvas2D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const scene2d = useGeometryStore((s) => s.scene2d);
  const sliders = useGeometryStore((s) => s.sliders);
  const view = useGeometryStore((s) => s.view);
  const activeTool2D = useGeometryStore((s) => s.activeTool2D);
  const selection = useGeometryStore((s) => s.selection);
  const pendingIds = useGeometryStore((s) => s.pendingIds);
  const handleCanvas2DClick = useGeometryStore((s) => s.handleCanvas2DClick);
  const movePoint2D = useGeometryStore((s) => s.movePoint2D);
  const pushHistory = useGeometryStore((s) => s.pushHistory);

  const [cam, setCam] = useState<Camera2D>({ cx: 0, cy: 0, scale: 56 });
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [hoverWorld, setHoverWorld] = useState<Vec2 | null>(null);
  const [hoverPointId, setHoverPointId] = useState<string | null>(null);

  const dragRef = useRef<{
    kind: 'none' | 'pan' | 'point' | 'pinch';
    pointId?: string;
    startScreenX: number;
    startScreenY: number;
    startCx: number;
    startCy: number;
    pinchStartDist?: number;
    pinchStartScale?: number;
    pinchWorldMid?: Vec2;
    moved: boolean;
  }>({ kind: 'none', startScreenX: 0, startScreenY: 0, startCx: 0, startCy: 0, moved: false });

  const pointersRef = useRef<Map<number, Vec2>>(new Map());

  const sliderScope = useMemo(
    () => Object.fromEntries(sliders.map((sl) => [sl.name, sl.value])),
    [sliders]
  );

  const ptMap = useMemo(
    () => resolvePoints2D(scene2d.points, scene2d.lines),
    [scene2d.points, scene2d.lines]
  );

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 10 && height > 10) {
          setSize({ width: Math.floor(width), height: Math.floor(height) });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Listen for PNG export event
  useEffect(() => {
    const handler = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `HinhHocViet-2D-${Date.now()}.png`;
      a.click();
    };
    window.addEventListener('hinhhocviet-export-2d', handler);
    return () => window.removeEventListener('hinhhocviet-export-2d', handler);
  }, []);

  const worldToScreen = useCallback(
    (wx: number, wy: number): Vec2 => [
      size.width / 2 + (wx - cam.cx) * cam.scale,
      size.height / 2 - (wy - cam.cy) * cam.scale,
    ],
    [cam, size]
  );

  const screenToWorld = useCallback(
    (sx: number, sy: number): Vec2 => [
      cam.cx + (sx - size.width / 2) / cam.scale,
      cam.cy - (sy - size.height / 2) / cam.scale,
    ],
    [cam, size]
  );

  const findHitPoint = useCallback(
    (sx: number, sy: number): string | null => {
      let bestId: string | null = null;
      let bestDist = 18;
      for (const p of scene2d.points) {
        if (!p.visible) continue;
        const pos = ptMap.get(p.id) ?? [p.x, p.y];
        const [px, py] = worldToScreen(pos[0], pos[1]);
        const d = Math.hypot(px - sx, py - sy);
        if (d < bestDist) {
          bestDist = d;
          bestId = p.id;
        }
      }
      return bestId;
    },
    [scene2d.points, ptMap, worldToScreen]
  );

  const findHitLine = useCallback(
    (sx: number, sy: number): string | null => {
      const w = screenToWorld(sx, sy);
      const tolWorld = 8 / cam.scale;
      for (const l of scene2d.lines) {
        if (!l.visible) continue;
        const eq = resolveLine2D(l, ptMap);
        if (distPointToLine2D(w, eq) < tolWorld) return l.id;
      }
      return null;
    },
    [scene2d.lines, ptMap, screenToWorld, cam.scale]
  );

  // ==================== MAIN CANVAS RENDER ====================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(size.width * dpr);
    canvas.height = Math.floor(size.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const isDark = view.theme === 'dark';
    const bgColor = isDark ? '#0D131F' : '#FAFBFD';
    const majorGridColor = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 27, 45, 0.08)';
    const minorGridColor = isDark ? 'rgba(148, 163, 184, 0.06)' : 'rgba(15, 27, 45, 0.035)';
    const axisColor = isDark ? '#94A3B8' : '#334155';
    const labelColor = isDark ? '#CBD5E1' : '#475569';
    const textInk = isDark ? '#F1F5F9' : '#0F1B2D';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size.width, size.height);

    const xMin = cam.cx - size.width / (2 * cam.scale);
    const xMax = cam.cx + size.width / (2 * cam.scale);
    const yMin = cam.cy - size.height / (2 * cam.scale);
    const yMax = cam.cy + size.height / (2 * cam.scale);

    // 1. Grid
    const step = niceStep(cam.scale);
    const minorStep = step / 2;

    if (view.showGrid) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = minorGridColor;
      ctx.beginPath();
      for (let x = Math.floor(xMin / minorStep) * minorStep; x <= xMax; x += minorStep) {
        const [sx] = worldToScreen(x, 0);
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, size.height);
      }
      for (let y = Math.floor(yMin / minorStep) * minorStep; y <= yMax; y += minorStep) {
        const [, sy] = worldToScreen(0, y);
        ctx.moveTo(0, sy);
        ctx.lineTo(size.width, sy);
      }
      ctx.stroke();

      ctx.strokeStyle = majorGridColor;
      ctx.beginPath();
      for (let x = Math.floor(xMin / step) * step; x <= xMax; x += step) {
        const [sx] = worldToScreen(x, 0);
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, size.height);
      }
      for (let y = Math.floor(yMin / step) * step; y <= yMax; y += step) {
        const [, sy] = worldToScreen(0, y);
        ctx.moveTo(0, sy);
        ctx.lineTo(size.width, sy);
      }
      ctx.stroke();
    }

    // 2. Inequalities (half-plane shading)
    for (const iq of scene2d.inequalities) {
      if (!iq.visible) continue;
      // Clip bounding rectangle of viewport against ax + by <op> c
      const corners: Vec2[] = [
        [xMin - 1, yMin - 1],
        [xMax + 1, yMin - 1],
        [xMax + 1, yMax + 1],
        [xMin - 1, yMax + 1],
      ];
      const satisfies = (p: Vec2) => {
        const val = iq.a * p[0] + iq.b * p[1] - iq.c;
        return iq.op === '<=' || iq.op === '<' ? val <= 0 : val >= 0;
      };
      const evalSigned = (p: Vec2) => {
        const raw = iq.a * p[0] + iq.b * p[1] - iq.c;
        return iq.op === '<=' || iq.op === '<' ? -raw : raw;
      };
      // Sutherland-Hodgman clip against half-plane evalSigned >= 0
      const clipped: Vec2[] = [];
      for (let i = 0; i < corners.length; i++) {
        const cur = corners[i];
        const nxt = corners[(i + 1) % corners.length];
        const dCur = evalSigned(cur);
        const dNxt = evalSigned(nxt);
        if (dCur >= 0) clipped.push(cur);
        if ((dCur >= 0 && dNxt < 0) || (dCur < 0 && dNxt >= 0)) {
          const t = dCur / (dCur - dNxt);
          clipped.push([cur[0] + t * (nxt[0] - cur[0]), cur[1] + t * (nxt[1] - cur[1])]);
        }
      }
      if (clipped.length >= 3) {
        ctx.save();
        ctx.fillStyle = iq.color;
        ctx.globalAlpha = 0.13;
        ctx.beginPath();
        clipped.forEach((pt, idx) => {
          const [sx, sy] = worldToScreen(pt[0], pt[1]);
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Draw boundary line ax + by = c
      ctx.save();
      ctx.strokeStyle = iq.color;
      ctx.lineWidth = 1.75;
      if (iq.op === '<' || iq.op === '>') ctx.setLineDash([6, 5]);
      drawInfiniteLine(ctx, { a: iq.a, b: iq.b, c: -iq.c }, xMin, xMax, yMin, yMax, worldToScreen);
      ctx.restore();
      void satisfies;
    }

    // 3. Axes Ox, Oy
    if (view.showAxes) {
      const [ox, oy] = worldToScreen(0, 0);
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = 1.5;

      // X axis
      if (oy >= -20 && oy <= size.height + 20) {
        ctx.beginPath();
        ctx.moveTo(0, oy);
        ctx.lineTo(size.width - 8, oy);
        ctx.stroke();
        // Arrow
        ctx.fillStyle = axisColor;
        ctx.beginPath();
        ctx.moveTo(size.width - 2, oy);
        ctx.lineTo(size.width - 11, oy - 4.5);
        ctx.lineTo(size.width - 11, oy + 4.5);
        ctx.closePath();
        ctx.fill();
        ctx.font = '600 13px "Be Vietnam Pro", sans-serif';
        ctx.fillText('x', size.width - 18, oy - 10);
      }

      // Y axis
      if (ox >= -20 && ox <= size.width + 20) {
        ctx.beginPath();
        ctx.moveTo(ox, size.height);
        ctx.lineTo(ox, 8);
        ctx.stroke();
        ctx.fillStyle = axisColor;
        ctx.beginPath();
        ctx.moveTo(ox, 2);
        ctx.lineTo(ox - 4.5, 11);
        ctx.lineTo(ox + 4.5, 11);
        ctx.closePath();
        ctx.fill();
        ctx.font = '600 13px "Be Vietnam Pro", sans-serif';
        ctx.fillText('y', ox + 10, 16);
      }

      // Tick labels
      ctx.fillStyle = labelColor;
      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let x = Math.floor(xMin / step) * step; x <= xMax; x += step) {
        if (Math.abs(x) < step * 0.01) continue;
        const [sx] = worldToScreen(x, 0);
        const clampedY = Math.min(Math.max(oy + 5, 4), size.height - 18);
        ctx.fillText(formatNum(x, 2), sx, clampedY);
      }
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let y = Math.floor(yMin / step) * step; y <= yMax; y += step) {
        if (Math.abs(y) < step * 0.01) continue;
        const [, sy] = worldToScreen(0, y);
        const clampedX = Math.min(Math.max(ox - 7, 28), size.width - 6);
        ctx.fillText(formatNum(y, 2), clampedX, sy);
      }
      if (ox > 12 && ox < size.width - 12 && oy > 12 && oy < size.height - 12) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('O', ox - 6, oy + 5);
      }
    }

    // 4. Polygons
    for (const poly of scene2d.polygons) {
      if (!poly.visible) continue;
      const pts = poly.pointIds.map((id) => ptMap.get(id)).filter((p): p is Vec2 => Boolean(p));
      if (pts.length < 3) continue;

      ctx.save();
      ctx.beginPath();
      pts.forEach((p, idx) => {
        const [sx, sy] = worldToScreen(p[0], p[1]);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.fillStyle = poly.color;
      ctx.globalAlpha = poly.fillOpacity;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = poly.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      if (poly.showArea && view.showLabels) {
        const area = polygonArea2D(pts);
        const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
        const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        const minY = Math.min(...pts.map((p) => p[1]));
        // Place area badge cleanly in lower interior away from centroid G / circumcenter O
        const badgeY = minY + (cy - minY) * 0.42;
        const [scx, scy] = worldToScreen(cx, badgeY);
        drawBadge(ctx, `S = ${formatNum(area, 2)}`, scx, scy, poly.color, isDark);
      }
      ctx.restore();
    }

    // 5. Circles
    for (const circle of scene2d.circles) {
      if (!circle.visible) continue;
      const center = circle.centerId ? ptMap.get(circle.centerId) ?? circle.center : circle.center;
      const radPt = circle.radiusPointId ? ptMap.get(circle.radiusPointId) : null;
      const radius = radPt ? dist2D(center, radPt) : circle.radius;
      const [scx, scy] = worldToScreen(center[0], center[1]);
      const rPx = radius * cam.scale;

      ctx.save();
      ctx.beginPath();
      ctx.arc(scx, scy, Math.max(1, rPx), 0, Math.PI * 2);
      ctx.fillStyle = circle.color;
      ctx.globalAlpha = circle.fillOpacity;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = circle.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // 6. Conics (Ellipse, Hyperbola, Parabola)
    for (const conic of scene2d.conics) {
      if (!conic.visible) continue;
      ctx.save();
      ctx.strokeStyle = conic.color;
      ctx.lineWidth = 2.2;

      if (conic.conicType === 'ellipse') {
        const [cx, cy] = worldToScreen(conic.h, conic.k);
        ctx.beginPath();
        ctx.ellipse(cx, cy, conic.a * cam.scale, conic.b * cam.scale, 0, 0, Math.PI * 2);
        ctx.stroke();
        if (conic.showFoci && view.showLabels) {
          const c = Math.sqrt(Math.abs(conic.a * conic.a - conic.b * conic.b));
          const foci: Vec2[] =
            conic.a >= conic.b
              ? [[conic.h - c, conic.k], [conic.h + c, conic.k]]
              : [[conic.h, conic.k - c], [conic.h, conic.k + c]];
          foci.forEach((f, idx) => {
            const [fx, fy] = worldToScreen(f[0], f[1]);
            ctx.fillStyle = conic.color;
            ctx.beginPath();
            ctx.arc(fx, fy, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = '600 11px "Be Vietnam Pro", sans-serif';
            ctx.fillText(`F${idx + 1}`, fx + 7, fy - 6);
          });
        }
      } else if (conic.conicType === 'hyperbola') {
        // Draw asymptotes dashed
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.2;
        const slope = conic.b / conic.a;
        drawInfiniteLine(ctx, { a: slope, b: -1, c: conic.k - slope * conic.h }, xMin, xMax, yMin, yMax, worldToScreen);
        drawInfiniteLine(ctx, { a: -slope, b: -1, c: conic.k + slope * conic.h }, xMin, xMax, yMin, yMax, worldToScreen);
        ctx.restore();

        // Two branches: x = h ± a*cosh(t), y = k + b*sinh(t)
        for (const sign of [-1, 1]) {
          ctx.beginPath();
          let started = false;
          for (let t = -3.2; t <= 3.2; t += 0.04) {
            const wx = conic.h + sign * conic.a * Math.cosh(t);
            const wy = conic.k + conic.b * Math.sinh(t);
            const [sx, sy] = worldToScreen(wx, wy);
            if (!started) {
              ctx.moveTo(sx, sy);
              started = true;
            } else {
              ctx.lineTo(sx, sy);
            }
          }
          ctx.stroke();
        }
      } else if (conic.conicType === 'parabola') {
        // (y - k)^2 = 2p(x - h)
        const p = conic.p ?? conic.a;
        ctx.beginPath();
        let started = false;
        for (let wy = yMin - 1; wy <= yMax + 1; wy += (yMax - yMin) / 240) {
          const dy = wy - conic.k;
          const wx = conic.h + (dy * dy) / (2 * p);
          const [sx, sy] = worldToScreen(wx, wy);
          if (!started) {
            ctx.moveTo(sx, sy);
            started = true;
          } else {
            ctx.lineTo(sx, sy);
          }
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // 7. Functions y = f(x) + Integral shading + Asymptotes + Extrema
    for (const fn of scene2d.functions) {
      if (!fn.visible) continue;
      let compiled;
      try {
        compiled = compileExpression(fn.expr);
      } catch {
        continue;
      }
      const evalF = (x: number) => compiled.eval({ ...sliderScope, x });

      // 7a. Integral region fill
      if (fn.integral?.enabled) {
        const a = Math.min(fn.integral.a, fn.integral.b);
        const b = Math.max(fn.integral.a, fn.integral.b);
        const steps = 160;
        const dx = (b - a) / steps;
        if (dx > 1e-6) {
          ctx.save();
          ctx.fillStyle = fn.color;
          ctx.globalAlpha = 0.2;
          ctx.beginPath();
          const [sa, sy0] = worldToScreen(a, 0);
          ctx.moveTo(sa, sy0);
          for (let i = 0; i <= steps; i++) {
            const x = a + i * dx;
            const y = evalF(x);
            if (Number.isFinite(y)) {
              const [sx, sy] = worldToScreen(x, y);
              ctx.lineTo(sx, sy);
            }
          }
          const [sb] = worldToScreen(b, 0);
          ctx.lineTo(sb, sy0);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 0.7;
          ctx.strokeStyle = fn.color;
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.restore();

          const intRes = computeIntegral2D(fn.expr, fn.integral.a, fn.integral.b, sliderScope);
          const midX = (a + b) / 2;
          const midY = evalF(midX);
          const [bx, by] = worldToScreen(midX, Number.isFinite(midY) ? midY * 0.45 : 0.5);
          drawBadge(
            ctx,
            `S = ${formatNum(intRes.area, 2)} | V = ${formatNum(intRes.volumeOx / Math.PI, 2)}π`,
            bx,
            by,
            fn.color,
            isDark
          );
        }
      }

      // 7b. Analysis: asymptotes, extrema, roots
      const analysis =
        fn.showAsymptotes || fn.showExtrema || fn.showRoots
          ? analyzeFunction2D(fn.expr, xMin, xMax, sliderScope)
          : null;

      if (analysis && fn.showAsymptotes) {
        ctx.save();
        ctx.strokeStyle = '#E06D1F';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([6, 5]);
        for (const va of analysis.verticalAsymptotes) {
          const [sx] = worldToScreen(va, 0);
          ctx.beginPath();
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, size.height);
          ctx.stroke();
          if (view.showLabels) {
            drawBadge(ctx, `TCĐ x=${formatNum(va, 2)}`, sx + 48, 28, '#E06D1F', isDark);
          }
        }
        if (analysis.horizontalAsymptote !== null) {
          const [, sy] = worldToScreen(0, analysis.horizontalAsymptote);
          ctx.beginPath();
          ctx.moveTo(0, sy);
          ctx.lineTo(size.width, sy);
          ctx.stroke();
          if (view.showLabels) {
            drawBadge(
              ctx,
              `TCN y=${formatNum(analysis.horizontalAsymptote, 2)}`,
              size.width - 78,
              sy - 14,
              '#E06D1F',
              isDark
            );
          }
        }
        ctx.restore();
      }

      // 7c. Plot curve with jump break
      ctx.save();
      ctx.strokeStyle = fn.color;
      ctx.lineWidth = 2.4;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      const samples = Math.max(600, Math.floor(size.width * 1.1));
      let penDown = false;
      let prevSy = 0;

      for (let i = 0; i <= samples; i++) {
        const sx = (i / samples) * size.width;
        const [wx] = screenToWorld(sx, 0);
        const wy = evalF(wx);
        if (!Number.isFinite(wy) || Math.abs(wy) > 1e5) {
          penDown = false;
          continue;
        }
        const [, sy] = worldToScreen(wx, wy);
        if (sy < -size.height * 2 || sy > size.height * 3) {
          penDown = false;
          continue;
        }
        if (!penDown || Math.abs(sy - prevSy) > size.height * 0.65) {
          ctx.moveTo(sx, sy);
          penDown = true;
        } else {
          ctx.lineTo(sx, sy);
        }
        prevSy = sy;
      }
      ctx.stroke();
      ctx.restore();

      // 7d. Extrema & Root markers
      if (analysis && fn.showExtrema) {
        for (const ext of analysis.extrema) {
          const [sx, sy] = worldToScreen(ext.x, ext.y);
          if (sx < -20 || sx > size.width + 20 || sy < -20 || sy > size.height + 20) continue;
          ctx.save();
          ctx.fillStyle = ext.kind === 'max' ? '#D93829' : '#0E9F6E';
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          if (view.showLabels) {
            const tag = `${ext.kind === 'max' ? 'CĐ' : 'CT'}(${formatNum(ext.x, 1)}; ${formatNum(ext.y, 1)})`;
            drawBadge(ctx, tag, sx, sy + (ext.kind === 'max' ? -18 : 18), ext.kind === 'max' ? '#D93829' : '#0E9F6E', isDark);
          }
          ctx.restore();
        }
      }
      if (analysis && fn.showRoots) {
        for (const r of analysis.roots) {
          const [sx, sy] = worldToScreen(r[0], 0);
          ctx.save();
          ctx.fillStyle = fn.color;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(sx, sy, 3.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // 8. Lines
    for (const line of scene2d.lines) {
      if (!line.visible) continue;
      const eq = resolveLine2D(line, ptMap);
      ctx.save();
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 1.9;
      if (line.dashed) ctx.setLineDash([7, 5]);
      drawInfiniteLine(ctx, eq, xMin, xMax, yMin, yMax, worldToScreen);
      ctx.restore();
    }

    // 9. Segments
    for (const seg of scene2d.segments) {
      if (!seg.visible) continue;
      const p1 = ptMap.get(seg.p1Id);
      const p2 = ptMap.get(seg.p2Id);
      if (!p1 || !p2) continue;
      const [x1, y1] = worldToScreen(p1[0], p1[1]);
      const [x2, y2] = worldToScreen(p2[0], p2[1]);
      ctx.save();
      ctx.strokeStyle = seg.color === '#0F1B2D' && isDark ? '#E2E8F0' : seg.color;
      ctx.lineWidth = 2.2;
      if (seg.dashed) ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (seg.showLength && view.showLabels) {
        const len = dist2D(p1, p2);
        drawBadge(ctx, formatNum(len, 2), (x1 + x2) / 2, (y1 + y2) / 2 - 12, seg.color, isDark);
      }
      ctx.restore();
    }

    // 10. Vectors
    for (const vec of scene2d.vectors) {
      if (!vec.visible) continue;
      const p1 = vec.originId ? ptMap.get(vec.originId) ?? vec.origin : vec.origin;
      const p2: Vec2 = vec.targetId
        ? ptMap.get(vec.targetId) ?? [p1[0] + vec.dx, p1[1] + vec.dy]
        : [p1[0] + vec.dx, p1[1] + vec.dy];
      const [x1, y1] = worldToScreen(p1[0], p1[1]);
      const [x2, y2] = worldToScreen(p2[0], p2[1]);
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const head = 11;

      ctx.save();
      ctx.strokeStyle = vec.color;
      ctx.fillStyle = vec.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2 - head * 0.7 * Math.cos(ang), y2 - head * 0.7 * Math.sin(ang));
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - head * Math.cos(ang - 0.42), y2 - head * Math.sin(ang - 0.42));
      ctx.lineTo(x2 - head * Math.cos(ang + 0.42), y2 - head * Math.sin(ang + 0.42));
      ctx.closePath();
      ctx.fill();

      if (view.showLabels) {
        drawBadge(ctx, vec.name, (x1 + x2) / 2 + 12, (y1 + y2) / 2 - 12, vec.color, isDark);
      }
      ctx.restore();
    }

    // 11. Measures (angles & distances)
    for (const m of scene2d.measures) {
      if (!m.visible) continue;
      if (m.kind === 'angle' && m.refs.length === 3) {
        const a = ptMap.get(m.refs[0]);
        const b = ptMap.get(m.refs[1]);
        const c = ptMap.get(m.refs[2]);
        if (!a || !b || !c) continue;
        const deg = angle3Points2D(a, b, c);
        const [bx, by] = worldToScreen(b[0], b[1]);
        const [ax, ay] = worldToScreen(a[0], a[1]);
        const [cx, cy] = worldToScreen(c[0], c[1]);
        const a1 = Math.atan2(ay - by, ax - bx);
        const a2 = Math.atan2(cy - by, cx - bx);
        let diff = a2 - a1;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ctx.save();
        ctx.strokeStyle = m.color;
        ctx.fillStyle = m.color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.arc(bx, by, 26, a1, a1 + diff, diff < 0);
        ctx.closePath();
        ctx.globalAlpha = 0.16;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(bx, by, 26, a1, a1 + diff, diff < 0);
        ctx.stroke();
        const midAng = a1 + diff / 2;
        drawBadge(ctx, `${formatNum(deg, 1)}°`, bx + 42 * Math.cos(midAng), by + 42 * Math.sin(midAng), m.color, isDark);
        ctx.restore();
      } else if (m.kind === 'distance' && m.refs.length >= 2) {
        const a = ptMap.get(m.refs[0]);
        const b = ptMap.get(m.refs[1]);
        if (!a || !b) continue;
        const d = dist2D(a, b);
        const [x1, y1] = worldToScreen(a[0], a[1]);
        const [x2, y2] = worldToScreen(b[0], b[1]);
        ctx.save();
        ctx.strokeStyle = m.color;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        drawBadge(ctx, `d = ${formatNum(d, 2)}`, (x1 + x2) / 2, (y1 + y2) / 2 - 14, m.color, isDark);
        ctx.restore();
      }
    }

    // 12. Live rubber-band preview for active 2D construction tools
    if (activeTool2D !== 'select' && activeTool2D !== 'point' && pendingIds.length > 0) {
      const pts = pendingIds.map((id) => ptMap.get(id)).filter((p): p is Vec2 => Boolean(p));
      const targetWorld: Vec2 | null = hoverPointId ? ptMap.get(hoverPointId) ?? hoverWorld : hoverWorld;
      if (pts.length > 0 && targetWorld) {
        ctx.save();
        ctx.strokeStyle = '#0284C7';
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2.2;

        if (activeTool2D === 'circle' && pts.length === 1) {
          const [cx, cy] = worldToScreen(pts[0][0], pts[0][1]);
          const r = dist2D(pts[0], targetWorld) * cam.scale;
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          pts.forEach((p, idx) => {
            const [sx, sy] = worldToScreen(p[0], p[1]);
            if (idx === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          });
          const [hx, hy] = worldToScreen(targetWorld[0], targetWorld[1]);
          ctx.lineTo(hx, hy);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 13. Points (drawn last so always crisp & clickable on top, with vivid hover glow!)
    for (const pt of scene2d.points) {
      if (!pt.visible) continue;
      const pos = ptMap.get(pt.id) ?? [pt.x, pt.y];
      const [sx, sy] = worldToScreen(pos[0], pos[1]);
      const isSelected = selection.some((x) => x.domain === '2d' && x.type === 'point' && x.id === pt.id);
      const isPending = pendingIds.includes(pt.id);
      const isHover = hoverPointId === pt.id;

      ctx.save();
      if (isHover) {
        ctx.beginPath();
        ctx.arc(sx, sy, 14, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(14, 165, 233, 0.22)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx, sy, 9.5, 0, Math.PI * 2);
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (isSelected || isPending) {
        ctx.beginPath();
        ctx.arc(sx, sy, 11, 0, Math.PI * 2);
        ctx.fillStyle = isPending ? 'rgba(224, 109, 31, 0.28)' : 'rgba(29, 92, 229, 0.24)';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(sx, sy, isHover ? 7 : isPending || isSelected ? 6.2 : pt.computed ? 4.8 : 5.5, 0, Math.PI * 2);
      ctx.fillStyle = isPending ? '#E06D1F' : isHover ? '#0284C7' : pt.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = isDark ? '#0D131F' : '#FFFFFF';
      ctx.stroke();

      if (view.showLabels && pt.showLabel) {
        ctx.font = isHover || isPending ? '700 13px "Be Vietnam Pro", sans-serif' : '600 12.5px "Be Vietnam Pro", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = bgColor;
        ctx.strokeText(pt.name, sx + 8, sy - 6);
        ctx.fillStyle = isPending ? '#E06D1F' : isHover ? '#0284C7' : textInk;
        ctx.fillText(pt.name, sx + 8, sy - 6);
      }
      ctx.restore();
    }
  }, [
    size,
    cam,
    scene2d,
    ptMap,
    sliderScope,
    view,
    selection,
    pendingIds,
    hoverPointId,
    hoverWorld,
    activeTool2D,
    worldToScreen,
    screenToWorld,
  ]);

  // ==================== POINTER EVENTS ====================

  const getLocalPos = (e: React.PointerEvent<HTMLCanvasElement>): Vec2 => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const snapCoord = (w: Vec2): Vec2 => {
    if (!view.snapToGrid) return [Number(w[0].toFixed(2)), Number(w[1].toFixed(2))];
    const step = 0.5;
    return [Math.round(w[0] / step) * step, Math.round(w[1] / step) * step];
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const [sx, sy] = getLocalPos(e);
    pointersRef.current.set(e.pointerId, [sx, sy]);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    // 2-finger pinch-to-zoom on mobile / tablet!
    if (pointersRef.current.size === 2) {
      const [p1, p2] = Array.from(pointersRef.current.values());
      const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const midScreen: Vec2 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
      dragRef.current = {
        kind: 'pinch',
        startScreenX: midScreen[0],
        startScreenY: midScreen[1],
        startCx: cam.cx,
        startCy: cam.cy,
        pinchStartDist: Math.max(10, dist),
        pinchStartScale: cam.scale,
        pinchWorldMid: screenToWorld(midScreen[0], midScreen[1]),
        moved: true,
      };
      return;
    }

    const hitPt = findHitPoint(sx, sy);

    if (e.button === 1 || (activeTool2D === 'select' && !hitPt)) {
      dragRef.current = { kind: 'pan', startScreenX: sx, startScreenY: sy, startCx: cam.cx, startCy: cam.cy, moved: false };
      return;
    }

    if (activeTool2D === 'select' && hitPt) {
      const pt = scene2d.points.find((p) => p.id === hitPt);
      if (pt && !pt.computed) {
        pushHistory();
        dragRef.current = { kind: 'point', pointId: hitPt, startScreenX: sx, startScreenY: sy, startCx: cam.cx, startCy: cam.cy, moved: false };
        return;
      }
    }

    const rawWorld = screenToWorld(sx, sy);
    const snapped = snapCoord(rawWorld);
    const hitLine = findHitLine(sx, sy);
    handleCanvas2DClick(snapped, hitPt ?? undefined, hitLine ?? undefined);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const [sx, sy] = getLocalPos(e);
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, [sx, sy]);
    }

    if (dragRef.current.kind === 'pinch' && pointersRef.current.size === 2) {
      const [p1, p2] = Array.from(pointersRef.current.values());
      const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const midX = (p1[0] + p2[0]) / 2;
      const midY = (p1[1] + p2[1]) / 2;
      const startDist = dragRef.current.pinchStartDist ?? 100;
      const startScale = dragRef.current.pinchStartScale ?? cam.scale;
      const worldMid = dragRef.current.pinchWorldMid ?? [0, 0];
      const nextScale = Math.max(12, Math.min(320, startScale * (dist / startDist)));
      const nextCx = worldMid[0] - (midX - size.width / 2) / nextScale;
      const nextCy = worldMid[1] + (midY - size.height / 2) / nextScale;
      setCam({ cx: nextCx, cy: nextCy, scale: nextScale });
      return;
    }

    const w = screenToWorld(sx, sy);
    setHoverWorld(w);

    if (dragRef.current.kind === 'pan') {
      const dx = sx - dragRef.current.startScreenX;
      const dy = sy - dragRef.current.startScreenY;
      if (Math.hypot(dx, dy) > 3) dragRef.current.moved = true;
      setCam((c) => ({
        ...c,
        cx: dragRef.current.startCx - dx / c.scale,
        cy: dragRef.current.startCy + dy / c.scale,
      }));
      return;
    }

    if (dragRef.current.kind === 'point' && dragRef.current.pointId) {
      const dx = sx - dragRef.current.startScreenX;
      const dy = sy - dragRef.current.startScreenY;
      if (Math.hypot(dx, dy) > 3) dragRef.current.moved = true;
      const snapped = snapCoord(w);
      movePoint2D(dragRef.current.pointId, snapped[0], snapped[1]);
      return;
    }

    setHoverPointId(findHitPoint(sx, sy));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    const [sx, sy] = getLocalPos(e);
    const d = dragRef.current;
    if (pointersRef.current.size < 2) {
      dragRef.current = { kind: 'none', startScreenX: 0, startScreenY: 0, startCx: 0, startCy: 0, moved: false };
    }

    if (!d.moved && (d.kind === 'pan' || d.kind === 'point')) {
      const hitPt = findHitPoint(sx, sy);
      const hitLine = findHitLine(sx, sy);
      handleCanvas2DClick(snapCoord(screenToWorld(sx, sy)), hitPt ?? undefined, hitLine ?? undefined);
    }
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const [wxBefore, wyBefore] = screenToWorld(sx, sy);
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setCam((prev) => {
      const nextScale = Math.max(12, Math.min(320, prev.scale * factor));
      const nextCx = wxBefore - (sx - size.width / 2) / nextScale;
      const nextCy = wyBefore + (sy - size.height / 2) / nextScale;
      return { cx: nextCx, cy: nextCy, scale: nextScale };
    });
  };

  const isDark = view.theme === 'dark';

  return (
    <div ref={containerRef} className="relative h-full w-full select-none overflow-hidden">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          setHoverWorld(null);
          setHoverPointId(null);
        }}
        onWheel={onWheel}
        className="block h-full w-full touch-none"
        style={{
          cursor:
            dragRef.current.kind === 'pan'
              ? 'grabbing'
              : hoverPointId && activeTool2D === 'select'
              ? 'grab'
              : hoverPointId
              ? 'pointer'
              : activeTool2D === 'select'
              ? 'default'
              : 'crosshair',
        }}
      />

      {/* Coordinate badge + Zoom buttons */}
      <div className="pointer-events-auto absolute right-3 bottom-3 flex items-center gap-2">
        {hoverWorld && (
          <div
            className={`font-math rounded-md border px-2.5 py-1 text-xs shadow-xs ${
              isDark
                ? 'border-slate-700 bg-slate-900/90 text-slate-200'
                : 'border-[#DCE3EC] bg-white/95 text-[#0F1B2D]'
            }`}
          >
            ({formatNum(hoverWorld[0], 2)}; {formatNum(hoverWorld[1], 2)})
          </div>
        )}
        <div
          className={`flex items-center overflow-hidden rounded-md border shadow-xs ${
            isDark ? 'border-slate-700 bg-slate-900/90' : 'border-[#DCE3EC] bg-white/95'
          }`}
        >
          <button
            type="button"
            title="Phóng to"
            onClick={() => setCam((c) => ({ ...c, scale: Math.min(320, c.scale * 1.25) }))}
            className={`p-1.5 transition-colors ${isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-[#0F1B2D] hover:bg-slate-100'}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Thu nhỏ"
            onClick={() => setCam((c) => ({ ...c, scale: Math.max(12, c.scale / 1.25) }))}
            className={`border-x p-1.5 transition-colors ${
              isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-[#DCE3EC] text-[#0F1B2D] hover:bg-slate-100'
            }`}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Về gốc tọa độ O"
            onClick={() => setCam({ cx: 0, cy: 0, scale: 56 })}
            className={`p-1.5 transition-colors ${isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-[#0F1B2D] hover:bg-slate-100'}`}
          >
            <Focus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== CANVAS 2D DRAW HELPERS ====================

function drawInfiniteLine(
  ctx: CanvasRenderingContext2D,
  eq: { a: number; b: number; c: number },
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  worldToScreen: (wx: number, wy: number) => Vec2
) {
  const pts: Vec2[] = [];
  if (Math.abs(eq.b) > 1e-8) {
    pts.push([xMin - 1, -(eq.a * (xMin - 1) + eq.c) / eq.b]);
    pts.push([xMax + 1, -(eq.a * (xMax + 1) + eq.c) / eq.b]);
  } else if (Math.abs(eq.a) > 1e-8) {
    const x = -eq.c / eq.a;
    pts.push([x, yMin - 1]);
    pts.push([x, yMax + 1]);
  }
  if (pts.length === 2) {
    const [sx1, sy1] = worldToScreen(pts[0][0], pts[0][1]);
    const [sx2, sy2] = worldToScreen(pts[1][0], pts[1][1]);
    ctx.beginPath();
    ctx.moveTo(sx1, sy1);
    ctx.lineTo(sx2, sy2);
    ctx.stroke();
  }
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  accent: string,
  isDark: boolean
) {
  ctx.save();
  ctx.font = '600 11px "JetBrains Mono", monospace';
  const metrics = ctx.measureText(text);
  const w = metrics.width + 10;
  const h = 19;
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.94)';
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = isDark ? '#F1F5F9' : '#0F1B2D';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 0.5);
  ctx.restore();
}
