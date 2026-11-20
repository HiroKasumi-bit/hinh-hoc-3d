import type { Plane3D, Point3D, Polyhedron3D, Vec3 } from '../types/geometry';
import { formatNum } from './geometry2d';
import { safeEval } from './parser';

// ==================== VIETNAMESE OXYZ <-> THREE.JS COORDINATE BRIDGE ====================
// Vietnamese SGK Toán 12: Oz points UP, Ox forward-left, Oy right.
// Right-handed mapping to Three.js (Y-up):
//   e_x = (0, 0, 1), e_y = (1, 0, 0), e_z = (0, 1, 0)
// Check right-hand rule: e_x × e_y = (0,0,1) × (1,0,0) = (0,1,0) = e_z. EXACT!

export function mathToScene([x, y, z]: Vec3): [number, number, number] {
  return [y, z, x];
}

export function sceneToMath([sx, sy, sz]: [number, number, number]): Vec3 {
  return [sz, sx, sy];
}

// ==================== 3D VECTOR ALGEBRA ====================

export function add3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale3(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function len3(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

export function normalize3(v: Vec3): Vec3 {
  const l = len3(v);
  if (l < 1e-12) return [0, 0, 0];
  return [v[0] / l, v[1] / l, v[2] / l];
}

export function dist3(a: Vec3, b: Vec3): number {
  return len3(sub3(b, a));
}

export function midpoint3(a: Vec3, b: Vec3): Vec3 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

export function ratioPoint3(a: Vec3, b: Vec3, k: number): Vec3 {
  return [
    a[0] + k * (b[0] - a[0]),
    a[1] + k * (b[1] - a[1]),
    a[2] + k * (b[2] - a[2]),
  ];
}

export function centroid3(pts: Vec3[]): Vec3 {
  if (pts.length === 0) return [0, 0, 0];
  let x = 0, y = 0, z = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
    z += p[2];
  }
  return [x / pts.length, y / pts.length, z / pts.length];
}

// ==================== PLANES, LINES, PROJECTIONS & DISTANCES ====================

export interface PlaneEq {
  a: number;
  b: number;
  c: number;
  d: number;
}

export function planeFrom3Points(p1: Vec3, p2: Vec3, p3: Vec3): PlaneEq | null {
  const n = cross3(sub3(p2, p1), sub3(p3, p1));
  const l = len3(n);
  if (l < 1e-10) return null;
  const a = n[0] / l;
  const b = n[1] / l;
  const c = n[2] / l;
  const d = -(a * p1[0] + b * p1[1] + c * p1[2]);
  return { a, b, c, d };
}

export function distPointToPlane(p: Vec3, pl: PlaneEq): number {
  const denom = Math.hypot(pl.a, pl.b, pl.c);
  if (denom < 1e-12) return 0;
  return Math.abs(pl.a * p[0] + pl.b * p[1] + pl.c * p[2] + pl.d) / denom;
}

export function footPointOnPlane(p: Vec3, pl: PlaneEq): Vec3 {
  const denom = pl.a * pl.a + pl.b * pl.b + pl.c * pl.c;
  if (denom < 1e-12) return p;
  const t = (pl.a * p[0] + pl.b * p[1] + pl.c * p[2] + pl.d) / denom;
  return [p[0] - pl.a * t, p[1] - pl.b * t, p[2] - pl.c * t];
}

export function reflectPointAcrossPlane(p: Vec3, pl: PlaneEq): Vec3 {
  const h = footPointOnPlane(p, pl);
  return [2 * h[0] - p[0], 2 * h[1] - p[1], 2 * h[2] - p[2]];
}

export function footPointOnLine3D(p: Vec3, linePoint: Vec3, lineDir: Vec3): Vec3 {
  const d2 = dot3(lineDir, lineDir);
  if (d2 < 1e-12) return linePoint;
  const t = dot3(sub3(p, linePoint), lineDir) / d2;
  return add3(linePoint, scale3(lineDir, t));
}

export function distPointToLine3D(p: Vec3, linePoint: Vec3, lineDir: Vec3): number {
  const h = footPointOnLine3D(p, linePoint, lineDir);
  return dist3(p, h);
}

export function intersectLinePlane(linePoint: Vec3, lineDir: Vec3, pl: PlaneEq): Vec3 | null {
  const denom = pl.a * lineDir[0] + pl.b * lineDir[1] + pl.c * lineDir[2];
  if (Math.abs(denom) < 1e-10) return null;
  const t = -(pl.a * linePoint[0] + pl.b * linePoint[1] + pl.c * linePoint[2] + pl.d) / denom;
  return add3(linePoint, scale3(lineDir, t));
}

export function intersectTwoPlanes(p1: PlaneEq, p2: PlaneEq): { point: Vec3; dir: Vec3 } | null {
  const n1: Vec3 = [p1.a, p1.b, p1.c];
  const n2: Vec3 = [p2.a, p2.b, p2.c];
  const dir = cross3(n1, n2);
  const dLen = len3(dir);
  if (dLen < 1e-10) return null;

  // Find a point on both planes by setting the coordinate with largest |dir| component to 0
  const ax = Math.abs(dir[0]);
  const ay = Math.abs(dir[1]);
  const az = Math.abs(dir[2]);
  let pt: Vec3;
  if (az >= ax && az >= ay) {
    const det = p1.a * p2.b - p2.a * p1.b;
    const x = (p1.b * p2.d - p2.b * p1.d) / det;
    const y = (p2.a * p1.d - p1.a * p2.d) / det;
    pt = [x, y, 0];
  } else if (ay >= ax && ay >= az) {
    const det = p1.a * p2.c - p2.a * p1.c;
    const x = (p1.c * p2.d - p2.c * p1.d) / det;
    const z = (p2.a * p1.d - p1.a * p2.d) / det;
    pt = [x, 0, z];
  } else {
    const det = p1.b * p2.c - p2.b * p1.c;
    const y = (p1.c * p2.d - p2.c * p1.d) / det;
    const z = (p2.b * p1.d - p1.b * p2.d) / det;
    pt = [0, y, z];
  }
  return { point: pt, dir: scale3(dir, 1 / dLen) };
}

/**
 * Shortest distance between two 3D lines (skew or parallel) AND the exact endpoints
 * H1 on line 1, H2 on line 2 of the common perpendicular segment (đoạn vuông góc chung!).
 */
export function skewLinesDistance(
  p1: Vec3,
  u: Vec3,
  p2: Vec3,
  v: Vec3
): { distance: number; h1: Vec3; h2: Vec3; isParallel: boolean } {
  const w0 = sub3(p1, p2);
  const a = dot3(u, u);
  const b = dot3(u, v);
  const c = dot3(v, v);
  const d = dot3(u, w0);
  const e = dot3(v, w0);
  const denom = a * c - b * b;

  if (Math.abs(denom) < 1e-10) {
    // Parallel lines
    const h2 = footPointOnLine3D(p1, p2, v);
    return { distance: dist3(p1, h2), h1: p1, h2, isParallel: true };
  }

  const sc = (b * e - c * d) / denom;
  const tc = (a * e - b * d) / denom;
  const h1 = add3(p1, scale3(u, sc));
  const h2 = add3(p2, scale3(v, tc));
  return { distance: dist3(h1, h2), h1, h2, isParallel: false };
}

// ==================== ANGLES (Lớp 11 & Lớp 12) ====================

/** Angle between two lines (0° to 90°) */
export function angleLineLineDeg(u: Vec3, v: Vec3): number {
  const lu = len3(u);
  const lv = len3(v);
  if (lu < 1e-12 || lv < 1e-12) return 0;
  const cos = Math.min(1, Math.abs(dot3(u, v)) / (lu * lv));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Angle ∠ABC at vertex B (0° to 180°) */
export function angle3Points3DDeg(a: Vec3, vertex: Vec3, c: Vec3): number {
  const u = sub3(a, vertex);
  const v = sub3(c, vertex);
  const lu = len3(u);
  const lv = len3(v);
  if (lu < 1e-12 || lv < 1e-12) return 0;
  const cos = Math.max(-1, Math.min(1, dot3(u, v) / (lu * lv)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Angle between a line and a plane (0° to 90°): sin(φ) = |u·n| / (|u||n|) */
export function angleLinePlaneDeg(lineDir: Vec3, pl: PlaneEq): number {
  const n: Vec3 = [pl.a, pl.b, pl.c];
  const lu = len3(lineDir);
  const ln = len3(n);
  if (lu < 1e-12 || ln < 1e-12) return 0;
  const sinVal = Math.min(1, Math.abs(dot3(lineDir, n)) / (lu * ln));
  return (Math.asin(sinVal) * 180) / Math.PI;
}

/** Angle between two planes (0° to 90°): cos(φ) = |n1·n2| / (|n1||n2|) */
export function anglePlanePlaneDeg(p1: PlaneEq, p2: PlaneEq): number {
  const n1: Vec3 = [p1.a, p1.b, p1.c];
  const n2: Vec3 = [p2.a, p2.b, p2.c];
  const l1 = len3(n1);
  const l2 = len3(n2);
  if (l1 < 1e-12 || l2 < 1e-12) return 0;
  const cosVal = Math.min(1, Math.abs(dot3(n1, n2)) / (l1 * l2));
  return (Math.acos(cosVal) * 180) / Math.PI;
}

/** Orthonormal basis (u, v) lying inside plane (a,b,c,d) */
export function planeBasis(pl: PlaneEq): { origin: Vec3; u: Vec3; v: Vec3; n: Vec3 } {
  const n = normalize3([pl.a, pl.b, pl.c]);
  const denom = pl.a * pl.a + pl.b * pl.b + pl.c * pl.c || 1;
  const origin: Vec3 = [(-pl.d * pl.a) / denom, (-pl.d * pl.b) / denom, (-pl.d * pl.c) / denom];
  const helper: Vec3 = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = normalize3(cross3(helper, n));
  const v = normalize3(cross3(n, u));
  return { origin, u, v, n };
}

/** Sphere-plane intersection circle (Lớp 12 Oxyz) */
export function intersectSpherePlane(
  center: Vec3,
  radius: number,
  pl: PlaneEq
): { circleCenter: Vec3; circleRadius: number; distance: number; basis: { u: Vec3; v: Vec3; n: Vec3 } } | null {
  const d = distPointToPlane(center, pl);
  if (d > radius + 1e-6) return null;
  const circleCenter = footPointOnPlane(center, pl);
  const circleRadius = Math.sqrt(Math.max(0, radius * radius - d * d));
  const { u, v, n } = planeBasis(pl);
  return { circleCenter, circleRadius, distance: d, basis: { u, v, n } };
}

// ==================== POLYHEDRON CROSS-SECTION SLICER (Thiết diện Lớp 11!) ====================

export interface CrossSectionResult {
  vertices: Vec3[];
  area: number;
  perimeter: number;
  centroid: Vec3;
  normal: Vec3;
}

/**
 * Slices a convex polyhedron by a plane (P): ax + by + cz + d = 0.
 * Returns counter-clockwise sorted cross-section polygon vertices, area, and perimeter.
 */
export function slicePolyhedronByPlane(
  poly: Polyhedron3D,
  ptMap: Map<string, Vec3>,
  pl: PlaneEq
): CrossSectionResult | null {
  const nLen = Math.hypot(pl.a, pl.b, pl.c);
  if (nLen < 1e-10) return null;
  const na = pl.a / nLen;
  const nb = pl.b / nLen;
  const nc = pl.c / nLen;
  const nd = pl.d / nLen;

  const signedDist = (p: Vec3) => na * p[0] + nb * p[1] + nc * p[2] + nd;

  // Collect all unique edges of the polyhedron
  const edgeSet = new Set<string>();
  const edges: Array<[Vec3, Vec3]> = [];
  for (const face of poly.faces) {
    for (let i = 0; i < face.length; i++) {
      const id1 = face[i];
      const id2 = face[(i + 1) % face.length];
      const key = id1 < id2 ? `${id1}|${id2}` : `${id2}|${id1}`;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      const v1 = ptMap.get(id1);
      const v2 = ptMap.get(id2);
      if (v1 && v2) edges.push([v1, v2]);
    }
  }

  const rawPoints: Vec3[] = [];
  const eps = 1e-5;

  for (const [v1, v2] of edges) {
    const s1 = signedDist(v1);
    const s2 = signedDist(v2);

    if (Math.abs(s1) <= eps) rawPoints.push(v1);
    if (Math.abs(s2) <= eps) rawPoints.push(v2);

    if ((s1 > eps && s2 < -eps) || (s1 < -eps && s2 > eps)) {
      const t = s1 / (s1 - s2);
      rawPoints.push([
        v1[0] + t * (v2[0] - v1[0]),
        v1[1] + t * (v2[1] - v1[1]),
        v1[2] + t * (v2[2] - v1[2]),
      ]);
    }
  }

  // Deduplicate points within tolerance
  const unique: Vec3[] = [];
  for (const pt of rawPoints) {
    if (!unique.some((q) => dist3(pt, q) < 1e-4)) {
      unique.push(pt);
    }
  }

  if (unique.length < 3) return null;

  const center = centroid3(unique);
  const { u, v, n } = planeBasis({ a: na, b: nb, c: nc, d: nd });

  // Sort cyclically around centroid in the plane's (u, v) coordinates
  unique.sort((pA, pB) => {
    const dA = sub3(pA, center);
    const dB = sub3(pB, center);
    const angA = Math.atan2(dot3(dA, v), dot3(dA, u));
    const angB = Math.atan2(dot3(dB, v), dot3(dB, u));
    return angA - angB;
  });

  // Compute area and perimeter
  let areaSum = 0;
  let perimeter = 0;
  for (let i = 0; i < unique.length; i++) {
    const cur = unique[i];
    const next = unique[(i + 1) % unique.length];
    perimeter += dist3(cur, next);
    areaSum += len3(cross3(sub3(cur, center), sub3(next, center))) * 0.5;
  }

  return {
    vertices: unique,
    area: areaSum,
    perimeter,
    centroid: center,
    normal: n,
  };
}

// ==================== AUTO HIDDEN-EDGE VISIBILITY (Nét đứt cạnh khuất!) ====================

export interface PolyhedronEdgeInfo {
  id1: string;
  id2: string;
  p1: Vec3;
  p2: Vec3;
  isHidden: boolean;
}

/**
 * Computes outward face normals for a convex polyhedron and determines which edges are hidden
 * from `cameraMathPos` (i.e. both adjacent faces face away from the camera).
 */
export function computePolyhedronEdgeVisibility(
  poly: Polyhedron3D,
  ptMap: Map<string, Vec3>,
  cameraMathPos: Vec3
): PolyhedronEdgeInfo[] {
  const polyVerts = poly.vertexIds.map((id) => ptMap.get(id)).filter((v): v is Vec3 => Boolean(v));
  const polyCenter = centroid3(polyVerts);

  // Determine front-facing status of each face using outward-corrected normals
  const faceFront: boolean[] = poly.faces.map((face) => {
    const pts = face.map((id) => ptMap.get(id)).filter((v): v is Vec3 => Boolean(v));
    if (pts.length < 3) return true;
    const fc = centroid3(pts);
    let n = cross3(sub3(pts[1], pts[0]), sub3(pts[2], pts[0]));
    // Ensure normal points outward away from polyhedron center
    if (dot3(n, sub3(fc, polyCenter)) < 0) {
      n = scale3(n, -1);
    }
    const toCam = sub3(cameraMathPos, fc);
    return dot3(n, toCam) > 1e-4;
  });

  // Map each unique edge to its adjacent face indices
  const edgeMap = new Map<string, { id1: string; id2: string; faceIndices: number[] }>();
  poly.faces.forEach((face, fi) => {
    for (let i = 0; i < face.length; i++) {
      const a = face[i];
      const b = face[(i + 1) % face.length];
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      const existing = edgeMap.get(key);
      if (existing) {
        if (!existing.faceIndices.includes(fi)) existing.faceIndices.push(fi);
      } else {
        edgeMap.set(key, { id1: a, id2: b, faceIndices: [fi] });
      }
    }
  });

  const result: PolyhedronEdgeInfo[] = [];
  for (const { id1, id2, faceIndices } of edgeMap.values()) {
    const p1 = ptMap.get(id1);
    const p2 = ptMap.get(id2);
    if (!p1 || !p2) continue;
    // Hidden iff ALL adjacent faces are back-facing
    const isHidden = poly.autoDashed && faceIndices.length > 0 && faceIndices.every((fi) => !faceFront[fi]);
    result.push({ id1, id2, p1, p2, isHidden });
  }
  return result;
}

/** Volume of a convex polyhedron via signed tetrahedra from centroid */
export function polyhedronVolume(poly: Polyhedron3D, ptMap: Map<string, Vec3>): number {
  const verts = poly.vertexIds.map((id) => ptMap.get(id)).filter((v): v is Vec3 => Boolean(v));
  const center = centroid3(verts);
  let total = 0;
  for (const face of poly.faces) {
    const pts = face.map((id) => ptMap.get(id)).filter((v): v is Vec3 => Boolean(v));
    if (pts.length < 3) continue;
    const p0 = pts[0];
    for (let i = 1; i < pts.length - 1; i++) {
      const v1 = sub3(p0, center);
      const v2 = sub3(pts[i], center);
      const v3 = sub3(pts[i + 1], center);
      total += Math.abs(dot3(v1, cross3(v2, v3))) / 6;
    }
  }
  return total;
}

/** Surface area of a polyhedron */
export function polyhedronSurfaceArea(poly: Polyhedron3D, ptMap: Map<string, Vec3>): number {
  let area = 0;
  for (const face of poly.faces) {
    const pts = face.map((id) => ptMap.get(id)).filter((v): v is Vec3 => Boolean(v));
    if (pts.length < 3) continue;
    const p0 = pts[0];
    for (let i = 1; i < pts.length - 1; i++) {
      area += len3(cross3(sub3(pts[i], p0), sub3(pts[i + 1], p0))) * 0.5;
    }
  }
  return area;
}

/** Resolve all 3D points (including slider expressions and computed geometry) */
export function resolvePoints3D(
  points: Point3D[],
  planes: Plane3D[],
  sliderScope: Record<string, number>
): Map<string, Vec3> {
  const map = new Map<string, Vec3>();
  for (const p of points) {
    if (p.exprCoords) {
      const ex = safeEval(p.exprCoords[0], sliderScope);
      const ey = safeEval(p.exprCoords[1], sliderScope);
      const ez = safeEval(p.exprCoords[2], sliderScope);
      map.set(p.id, [
        Number.isFinite(ex) ? ex : p.x,
        Number.isFinite(ey) ? ey : p.y,
        Number.isFinite(ez) ? ez : p.z,
      ]);
    } else {
      map.set(p.id, [p.x, p.y, p.z]);
    }
  }

  const planeMap = new Map(planes.map((pl) => [pl.id, pl]));

  for (let pass = 0; pass < 3; pass++) {
    for (const p of points) {
      if (!p.computed) continue;
      const refs = p.computed.refs;
      switch (p.computed.kind) {
        case 'midpoint': {
          const a = map.get(refs[0]);
          const b = map.get(refs[1]);
          if (a && b) map.set(p.id, midpoint3(a, b));
          break;
        }
        case 'ratio': {
          const a = map.get(refs[0]);
          const b = map.get(refs[1]);
          const k = p.computed.ratio ?? 0.5;
          if (a && b) map.set(p.id, ratioPoint3(a, b, k));
          break;
        }
        case 'centroid': {
          const pts = refs.map((id) => map.get(id)).filter((v): v is Vec3 => Boolean(v));
          if (pts.length >= 2) map.set(p.id, centroid3(pts));
          break;
        }
        case 'footPlane': {
          const pt = map.get(refs[0]);
          const pl = planeMap.get(refs[1]);
          if (pt && pl) {
            const eq = resolvePlaneEq(pl, map);
            if (eq) map.set(p.id, footPointOnPlane(pt, eq));
          }
          break;
        }
        case 'reflectPlane': {
          const pt = map.get(refs[0]);
          const pl = planeMap.get(refs[1]);
          if (pt && pl) {
            const eq = resolvePlaneEq(pl, map);
            if (eq) map.set(p.id, reflectPointAcrossPlane(pt, eq));
          }
          break;
        }
        case 'footLine': {
          const pt = map.get(refs[0]);
          const a = map.get(refs[1]);
          const b = map.get(refs[2]);
          if (pt && a && b) {
            map.set(p.id, footPointOnLine3D(pt, a, sub3(b, a)));
          }
          break;
        }
        case 'intersectLinePlane': {
          const a = map.get(refs[0]);
          const b = map.get(refs[1]);
          const pl = planeMap.get(refs[2]);
          if (a && b && pl) {
            const eq = resolvePlaneEq(pl, map);
            if (eq) {
              const q = intersectLinePlane(a, sub3(b, a), eq);
              if (q) map.set(p.id, q);
            }
          }
          break;
        }
      }
    }
  }
  return map;
}

export function resolvePlaneEq(pl: Plane3D, ptMap: Map<string, Vec3>): PlaneEq | null {
  if (pl.pointIds && pl.pointIds.length === 3) {
    const a = ptMap.get(pl.pointIds[0]);
    const b = ptMap.get(pl.pointIds[1]);
    const c = ptMap.get(pl.pointIds[2]);
    if (a && b && c) return planeFrom3Points(a, b, c);
  }
  if (Math.hypot(pl.a, pl.b, pl.c) < 1e-10) return null;
  return { a: pl.a, b: pl.b, c: pl.c, d: pl.d };
}

export function formatPlaneEq(eq: PlaneEq): string {
  let { a, b, c, d } = eq;
  const maxAbs = Math.max(Math.abs(a), Math.abs(b), Math.abs(c));
  const isNearInt = (v: number) => Math.abs(v - Math.round(v)) < 1e-3;
  if (maxAbs > 1e-9 && !(isNearInt(a) && isNearInt(b) && isNearInt(c) && isNearInt(d))) {
    // Try finding clean smallest non-zero divisor so planes from 3 points show nice equations like x + y + z - 3 = 0
    const nonZeros = [Math.abs(a), Math.abs(b), Math.abs(c)].filter((v) => v > 1e-5);
    const minNZ = Math.min(...nonZeros);
    const sA = a / minNZ;
    const sB = b / minNZ;
    const sC = c / minNZ;
    const sD = d / minNZ;
    if (isNearInt(sA) && isNearInt(sB) && isNearInt(sC) && Math.abs(sA) <= 12 && Math.abs(sB) <= 12 && Math.abs(sC) <= 12) {
      a = sA;
      b = sB;
      c = sC;
      d = sD;
    } else {
      a /= maxAbs;
      b /= maxAbs;
      c /= maxAbs;
      d /= maxAbs;
    }
  }
  if (a < -1e-6 || (Math.abs(a) < 1e-6 && b < -1e-6) || (Math.abs(a) < 1e-6 && Math.abs(b) < 1e-6 && c < -1e-6)) {
    a = -a;
    b = -b;
    c = -c;
    d = -d;
  }

  const parts: string[] = [];
  const pushTerm = (coef: number, label: string) => {
    if (Math.abs(coef) < 1e-5) return;
    const sign = coef > 0 ? (parts.length ? ' + ' : '') : parts.length ? ' - ' : '-';
    const abs = Math.abs(coef);
    parts.push(`${sign}${Math.abs(abs - 1) < 1e-4 ? label : `${formatNum(abs)}${label}`}`);
  };
  pushTerm(a, 'x');
  pushTerm(b, 'y');
  pushTerm(c, 'z');
  if (Math.abs(d) > 1e-5) {
    parts.push(`${d > 0 ? ' + ' : ' - '}${formatNum(Math.abs(d))}`);
  }
  return `${parts.join('') || '0'} = 0`;
}

export function formatVec3(v: Vec3): string {
  return `(${formatNum(v[0])}; ${formatNum(v[1])}; ${formatNum(v[2])})`;
}

export interface ScreenPointCandidate {
  id: string;
  screenX: number;
  screenY: number;
  worldPos: Vec3;
}

export function pickMagneticPoint3D(params: {
  candidates: ScreenPointCandidate[];
  pointerX: number;
  pointerY: number;
  rawGroundPos?: Vec3 | null;
  priorityCloseId?: string | null;
  isTouch?: boolean;
}): string | null {
  const { candidates, pointerX, pointerY, rawGroundPos, priorityCloseId, isTouch = false } = params;
  const normalScreenR = isTouch ? 34 : 24;
  const priorityScreenR = isTouch ? 46 : 36;

  if (priorityCloseId) {
    const closeCand = candidates.find((c) => c.id === priorityCloseId);
    if (closeCand) {
      const dPx = Math.hypot(closeCand.screenX - pointerX, closeCand.screenY - pointerY);
      const dWorld = rawGroundPos ? dist3(closeCand.worldPos, rawGroundPos) : Infinity;
      if (dPx <= priorityScreenR || dWorld <= 0.72) {
        return closeCand.id;
      }
    }
  }

  let bestScreenId: string | null = null;
  let bestScreenDist = normalScreenR;
  for (const c of candidates) {
    const dPx = Math.hypot(c.screenX - pointerX, c.screenY - pointerY);
    if (dPx <= bestScreenDist) {
      bestScreenDist = dPx;
      bestScreenId = c.id;
    }
  }
  if (bestScreenId) return bestScreenId;

  if (rawGroundPos) {
    let bestWorldId: string | null = null;
    let bestWorldDist = 0.52;
    for (const c of candidates) {
      const dWorld = dist3(c.worldPos, rawGroundPos);
      if (dWorld <= bestWorldDist) {
        bestWorldDist = dWorld;
        bestWorldId = c.id;
      }
    }
    return bestWorldId;
  }

  return null;
}
