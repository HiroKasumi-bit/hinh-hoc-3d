import type { Line2D, Point2D, Vec2 } from '../types/geometry';
import { compileExpression } from './parser';

export function dist2D(a: Vec2, b: Vec2): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

export function midpoint2D(a: Vec2, b: Vec2): Vec2 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

export function ratioPoint2D(a: Vec2, b: Vec2, k: number): Vec2 {
  return [a[0] + k * (b[0] - a[0]), a[1] + k * (b[1] - a[1])];
}

export function lineFrom2Points2D(a: Vec2, b: Vec2): { a: number; b: number; c: number } {
  const A = a[1] - b[1];
  const B = b[0] - a[0];
  const C = a[0] * b[1] - b[0] * a[1];
  const norm = Math.hypot(A, B) || 1;
  return { a: A / norm, b: B / norm, c: C / norm };
}

export function distPointToLine2D(p: Vec2, line: { a: number; b: number; c: number }): number {
  const denom = Math.hypot(line.a, line.b);
  if (denom < 1e-12) return 0;
  return Math.abs(line.a * p[0] + line.b * p[1] + line.c) / denom;
}

export function footPointOnLine2D(p: Vec2, line: { a: number; b: number; c: number }): Vec2 {
  const denom = line.a * line.a + line.b * line.b;
  if (denom < 1e-12) return p;
  const t = (line.a * p[0] + line.b * p[1] + line.c) / denom;
  return [p[0] - line.a * t, p[1] - line.b * t];
}

export function intersectLines2D(
  l1: { a: number; b: number; c: number },
  l2: { a: number; b: number; c: number }
): Vec2 | null {
  const det = l1.a * l2.b - l2.a * l1.b;
  if (Math.abs(det) < 1e-10) return null;
  const x = (l1.b * l2.c - l2.b * l1.c) / det;
  const y = (l2.a * l1.c - l1.a * l2.c) / det;
  return [x, y];
}

export function angle3Points2D(a: Vec2, vertex: Vec2, c: Vec2): number {
  const v1: Vec2 = [a[0] - vertex[0], a[1] - vertex[1]];
  const v2: Vec2 = [c[0] - vertex[0], c[1] - vertex[1]];
  const n1 = Math.hypot(v1[0], v1[1]);
  const n2 = Math.hypot(v2[0], v2[1]);
  if (n1 < 1e-12 || n2 < 1e-12) return 0;
  const cos = Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (n1 * n2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function polygonArea2D(pts: Vec2[]): number {
  if (pts.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    s += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  return Math.abs(s) / 2;
}

export function polygonPerimeter2D(pts: Vec2[]): number {
  if (pts.length < 2) return 0;
  let p = 0;
  for (let i = 0; i < pts.length; i++) {
    p += dist2D(pts[i], pts[(i + 1) % pts.length]);
  }
  return p;
}

// ==================== TRIANGLE SPECIAL CENTERS (Lớp 10) ====================

export function triangleCentroid2D(a: Vec2, b: Vec2, c: Vec2): Vec2 {
  return [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
}

export function triangleCircumcenter2D(a: Vec2, b: Vec2, c: Vec2): { center: Vec2; radius: number } | null {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-10) return null;
  const a2 = a[0] * a[0] + a[1] * a[1];
  const b2 = b[0] * b[0] + b[1] * b[1];
  const c2 = c[0] * c[0] + c[1] * c[1];
  const ux = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
  const uy = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
  const center: Vec2 = [ux, uy];
  return { center, radius: dist2D(center, a) };
}

export function triangleOrthocenter2D(a: Vec2, b: Vec2, c: Vec2): Vec2 | null {
  const circum = triangleCircumcenter2D(a, b, c);
  if (!circum) return null;
  // Euler relation: H = A + B + C - 2O
  return [
    a[0] + b[0] + c[0] - 2 * circum.center[0],
    a[1] + b[1] + c[1] - 2 * circum.center[1],
  ];
}

export function triangleIncenter2D(a: Vec2, b: Vec2, c: Vec2): { center: Vec2; radius: number } | null {
  const la = dist2D(b, c);
  const lb = dist2D(a, c);
  const lc = dist2D(a, b);
  const p = la + lb + lc;
  if (p < 1e-10) return null;
  const center: Vec2 = [
    (la * a[0] + lb * b[0] + lc * c[0]) / p,
    (la * a[1] + lb * b[1] + lc * c[1]) / p,
  ];
  const area = polygonArea2D([a, b, c]);
  return { center, radius: (2 * area) / p };
}

/** Resolve all computed 2D points in topological order */
export function resolvePoints2D(points: Point2D[], lines: Line2D[]): Map<string, Vec2> {
  const map = new Map<string, Vec2>();
  for (const p of points) {
    map.set(p.id, [p.x, p.y]);
  }
  const lineMap = new Map(lines.map((l) => [l.id, l]));

  // Two passes resolve nested computed points cleanly
  for (let pass = 0; pass < 3; pass++) {
    for (const p of points) {
      if (!p.computed) continue;
      const pts = p.computed.refs.map((id) => map.get(id));
      switch (p.computed.kind) {
        case 'midpoint':
          if (pts[0] && pts[1]) map.set(p.id, midpoint2D(pts[0], pts[1]));
          break;
        case 'ratio':
          if (pts[0] && pts[1]) map.set(p.id, ratioPoint2D(pts[0], pts[1], p.computed.ratio ?? 0.5));
          break;
        case 'centroid':
          if (pts[0] && pts[1] && pts[2]) map.set(p.id, triangleCentroid2D(pts[0], pts[1], pts[2]));
          break;
        case 'orthocenter':
          if (pts[0] && pts[1] && pts[2]) {
            const h = triangleOrthocenter2D(pts[0], pts[1], pts[2]);
            if (h) map.set(p.id, h);
          }
          break;
        case 'circumcenter':
          if (pts[0] && pts[1] && pts[2]) {
            const o = triangleCircumcenter2D(pts[0], pts[1], pts[2]);
            if (o) map.set(p.id, o.center);
          }
          break;
        case 'incenter':
          if (pts[0] && pts[1] && pts[2]) {
            const inc = triangleIncenter2D(pts[0], pts[1], pts[2]);
            if (inc) map.set(p.id, inc.center);
          }
          break;
        case 'footLine': {
          const pt = map.get(p.computed.refs[0]);
          const line = lineMap.get(p.computed.refs[1]);
          if (pt && line) {
            const resolvedLine = resolveLine2D(line, map);
            map.set(p.id, footPointOnLine2D(pt, resolvedLine));
          }
          break;
        }
      }
    }
  }
  return map;
}

export function resolveLine2D(line: Line2D, ptMap: Map<string, Vec2>): { a: number; b: number; c: number } {
  if (line.p1Id && line.p2Id) {
    const p1 = ptMap.get(line.p1Id);
    const p2 = ptMap.get(line.p2Id);
    if (p1 && p2) return lineFrom2Points2D(p1, p2);
  }
  return { a: line.a, b: line.b, c: line.c };
}

// ==================== FUNCTION ANALYSIS (Lớp 10 & Lớp 12) ====================

export interface FunctionAnalysis {
  roots: Vec2[];
  extrema: Array<{ x: number; y: number; kind: 'max' | 'min' }>;
  verticalAsymptotes: number[];
  horizontalAsymptote: number | null;
  yIntercept: number | null;
}

export function analyzeFunction2D(
  expr: string,
  xMin: number,
  xMax: number,
  scope: Record<string, number>
): FunctionAnalysis {
  const result: FunctionAnalysis = {
    roots: [],
    extrema: [],
    verticalAsymptotes: [],
    horizontalAsymptote: null,
    yIntercept: null,
  };

  let compiled;
  try {
    compiled = compileExpression(expr);
  } catch {
    return result;
  }

  const f = (x: number) => compiled.eval({ ...scope, x });
  const df = (x: number) => {
    const h = 1e-5;
    const y1 = f(x + h);
    const y0 = f(x - h);
    if (!Number.isFinite(y1) || !Number.isFinite(y0)) return NaN;
    return (y1 - y0) / (2 * h);
  };

  const y0 = f(0);
  if (Number.isFinite(y0) && Math.abs(y0) < 1e6) result.yIntercept = y0;

  const samples = 400;
  const dx = (xMax - xMin) / samples;

  let prevX = xMin;
  let prevY = f(prevX);
  let prevD = df(prevX);

  const pushUniqueX = (arr: number[], x: number, tol = 0.08) => {
    if (!arr.some((v) => Math.abs(v - x) < tol)) arr.push(x);
  };

  for (let i = 1; i <= samples; i++) {
    const x = xMin + i * dx;
    const y = f(x);
    const d = df(x);

    // Detect vertical asymptote: huge sign flip & divergence
    if (Number.isFinite(prevY) && Number.isFinite(y)) {
      const jump = Math.abs(y - prevY);
      if (jump > 25 && prevY * y < 0) {
        // Refine pole via binary search for max |f|
        let lo = prevX;
        let hi = x;
        for (let iter = 0; iter < 18; iter++) {
          const mid = (lo + hi) / 2;
          const ym = f(mid);
          if (!Number.isFinite(ym)) {
            lo = hi = mid;
            break;
          }
          if (ym * prevY > 0) lo = mid;
          else hi = mid;
        }
        const pole = (lo + hi) / 2;
        const nearL = Math.abs(f(pole - 1e-4));
        const nearR = Math.abs(f(pole + 1e-4));
        if (!Number.isFinite(nearL) || !Number.isFinite(nearR) || nearL > 40 || nearR > 40) {
          pushUniqueX(result.verticalAsymptotes, Math.round(pole * 1000) / 1000, 0.12);
        }
      } else if (prevY * y <= 0 && jump < 25) {
        // Root via bisection
        let lo = prevX;
        let hi = x;
        let ylo = prevY;
        for (let iter = 0; iter < 24; iter++) {
          const mid = (lo + hi) / 2;
          const ym = f(mid);
          if (!Number.isFinite(ym)) break;
          if (Math.abs(ym) < 1e-9) {
            lo = hi = mid;
            break;
          }
          if (ylo * ym <= 0) hi = mid;
          else {
            lo = mid;
            ylo = ym;
          }
        }
        const rx = (lo + hi) / 2;
        const ry = f(rx);
        if (Number.isFinite(ry) && Math.abs(ry) < 1e-2) {
          if (!result.roots.some((r) => Math.abs(r[0] - rx) < 0.06)) {
            result.roots.push([rx, 0]);
          }
        }
      }
    }

    // Detect local extrema via derivative sign change
    if (Number.isFinite(prevD) && Number.isFinite(d) && prevD * d <= 0 && Math.abs(prevD) < 1e4 && Math.abs(d) < 1e4) {
      let lo = prevX;
      let hi = x;
      let dlo = prevD;
      for (let iter = 0; iter < 22; iter++) {
        const mid = (lo + hi) / 2;
        const dm = df(mid);
        if (!Number.isFinite(dm)) break;
        if (dlo * dm <= 0) hi = mid;
        else {
          lo = mid;
          dlo = dm;
        }
      }
      const ex = (lo + hi) / 2;
      const ey = f(ex);
      const isNearAsym = result.verticalAsymptotes.some((a) => Math.abs(a - ex) < 0.12);
      if (!isNearAsym && Number.isFinite(ey) && Math.abs(ey) < 1e4) {
        const dLeft = df(ex - 1e-3);
        const dRight = df(ex + 1e-3);
        if (dLeft > 0 && dRight < 0) {
          if (!result.extrema.some((e) => Math.abs(e.x - ex) < 0.08)) {
            result.extrema.push({ x: ex, y: ey, kind: 'max' });
          }
        } else if (dLeft < 0 && dRight > 0) {
          if (!result.extrema.some((e) => Math.abs(e.x - ex) < 0.08)) {
            result.extrema.push({ x: ex, y: ey, kind: 'min' });
          }
        }
      }
    }

    prevX = x;
    prevY = y;
    prevD = d;
  }

  // Horizontal asymptote check at ±1e4
  const yPos = f(1e4);
  const yPos2 = f(2e4);
  const yNeg = f(-1e4);
  const yNeg2 = f(-2e4);
  if (
    Number.isFinite(yPos) &&
    Number.isFinite(yPos2) &&
    Math.abs(yPos - yPos2) < 1e-2 &&
    Math.abs(yPos) < 1e3
  ) {
    result.horizontalAsymptote = Math.round(yPos2 * 1000) / 1000;
  } else if (
    Number.isFinite(yNeg) &&
    Number.isFinite(yNeg2) &&
    Math.abs(yNeg - yNeg2) < 1e-2 &&
    Math.abs(yNeg) < 1e3
  ) {
    result.horizontalAsymptote = Math.round(yNeg2 * 1000) / 1000;
  }

  return result;
}

export function evalDerivative2D(expr: string, x: number, scope: Record<string, number> = {}): number {
  try {
    const compiled = compileExpression(expr);
    const h = 1e-5;
    const y1 = compiled.eval({ ...scope, x: x + h });
    const y0 = compiled.eval({ ...scope, x: x - h });
    if (!Number.isFinite(y1) || !Number.isFinite(y0)) return NaN;
    return (y1 - y0) / (2 * h);
  } catch {
    return NaN;
  }
}

export function findFunctionIntersections2D(
  expr1: string,
  expr2: string,
  xMin: number,
  xMax: number,
  scope: Record<string, number> = {}
): Vec2[] {
  let c1, c2;
  try {
    c1 = compileExpression(expr1);
    c2 = compileExpression(expr2);
  } catch {
    return [];
  }

  const diff = (x: number) => {
    const y1 = c1.eval({ ...scope, x });
    const y2 = c2.eval({ ...scope, x });
    if (!Number.isFinite(y1) || !Number.isFinite(y2)) return NaN;
    return y1 - y2;
  };

  const results: Vec2[] = [];
  const samples = 320;
  const dx = (xMax - xMin) / samples;
  let prevX = xMin;
  let prevD = diff(prevX);

  for (let i = 1; i <= samples; i++) {
    const x = xMin + i * dx;
    const d = diff(x);
    if (Number.isFinite(prevD) && Number.isFinite(d) && prevD * d <= 0 && Math.abs(d - prevD) < 30) {
      let lo = prevX;
      let hi = x;
      let dLo = prevD;
      for (let iter = 0; iter < 24; iter++) {
        const mid = (lo + hi) / 2;
        const dm = diff(mid);
        if (!Number.isFinite(dm)) break;
        if (Math.abs(dm) < 1e-9) {
          lo = hi = mid;
          break;
        }
        if (dLo * dm <= 0) hi = mid;
        else {
          lo = mid;
          dLo = dm;
        }
      }
      const rx = (lo + hi) / 2;
      const dFinal = diff(rx);
      const ry = c1.eval({ ...scope, x: rx });
      if (Number.isFinite(dFinal) && Math.abs(dFinal) < 1e-2 && Number.isFinite(ry)) {
        if (!results.some((p) => Math.abs(p[0] - rx) < 0.06)) {
          results.push([rx, ry]);
        }
      }
    }
    prevX = x;
    prevD = d;
  }

  return results;
}

/** Simpson's rule numerical integration for Lớp 12 integrals & revolution volumes */
export function computeIntegral2D(
  expr: string,
  a: number,
  b: number,
  scope: Record<string, number>,
  otherExpr?: string
): { signedIntegral: number; area: number; volumeOx: number } {
  const n = 200; // even number of subintervals
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const sign = a <= b ? 1 : -1;
  const h = (hi - lo) / n;
  if (h < 1e-12) return { signedIntegral: 0, area: 0, volumeOx: 0 };

  const f1 = compileExpression(expr);
  const f2 = otherExpr ? compileExpression(otherExpr) : null;

  let sumSigned = 0;
  let sumArea = 0;
  let sumVol = 0;

  for (let i = 0; i <= n; i++) {
    const x = lo + i * h;
    const w = i === 0 || i === n ? 1 : i % 2 === 1 ? 4 : 2;
    const y1 = f1.eval({ ...scope, x });
    const y2 = f2 ? f2.eval({ ...scope, x }) : 0;
    if (!Number.isFinite(y1) || !Number.isFinite(y2)) continue;
    const diff = y1 - y2;
    sumSigned += w * diff;
    sumArea += w * Math.abs(diff);
    sumVol += w * Math.abs(y1 * y1 - y2 * y2);
  }

  return {
    signedIntegral: (sign * sumSigned * h) / 3,
    area: (sumArea * h) / 3,
    volumeOx: (Math.PI * sumVol * h) / 3,
  };
}

export function formatNum(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.abs(n) < 1e-9 ? 0 : Number(n.toFixed(digits));
  return String(rounded);
}

export function formatLine2DEq(a: number, b: number, c: number): string {
  // Normalize so leading non-zero is positive and nicely scaled
  let A = a;
  let B = b;
  let C = c;
  const maxAbs = Math.max(Math.abs(A), Math.abs(B));
  if (maxAbs > 1e-9) {
    // If already close to integers, keep nice scale; otherwise normalize
    const isNearInt = (v: number) => Math.abs(v - Math.round(v)) < 1e-4;
    if (!(isNearInt(A) && isNearInt(B) && isNearInt(C))) {
      A /= maxAbs;
      B /= maxAbs;
      C /= maxAbs;
    }
  }
  if (A < -1e-9 || (Math.abs(A) < 1e-9 && B < -1e-9)) {
    A = -A;
    B = -B;
    C = -C;
  }
  const terms: string[] = [];
  if (Math.abs(A) > 1e-6) {
    terms.push(Math.abs(A - 1) < 1e-4 ? 'x' : `${formatNum(A)}x`);
  }
  if (Math.abs(B) > 1e-6) {
    const sign = B > 0 ? (terms.length ? ' + ' : '') : terms.length ? ' - ' : '-';
    const absB = Math.abs(B);
    terms.push(`${sign}${Math.abs(absB - 1) < 1e-4 ? 'y' : `${formatNum(absB)}y`}`);
  }
  if (Math.abs(C) > 1e-6) {
    const sign = C > 0 ? ' + ' : ' - ';
    terms.push(`${sign}${formatNum(Math.abs(C))}`);
  }
  return `${terms.join('') || '0'} = 0`;
}
