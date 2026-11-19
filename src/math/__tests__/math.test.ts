import { describe, expect, it } from 'vitest';
import {
  compileExpression,
  parseSmartInput,
  safeEval,
} from '../parser';
import {
  analyzeFunction2D,
  computeIntegral2D,
  triangleCentroid2D,
  triangleCircumcenter2D,
  triangleOrthocenter2D,
} from '../geometry2d';
import {
  angleLinePlaneDeg,
  anglePlanePlaneDeg,
  computePolyhedronEdgeVisibility,
  distPointToPlane,
  footPointOnPlane,
  intersectSpherePlane,
  mathToScene,
  planeFrom3Points,
  polyhedronVolume,
  sceneToMath,
  skewLinesDistance,
  slicePolyhedronByPlane,
} from '../geometry3d';
import type { Polyhedron3D, Vec3 } from '../../types/geometry';

describe('Math Expression Parser & Smart Command Bar', () => {
  it('evaluates implicit multiplication and Vietnamese math symbols', () => {
    expect(safeEval('2x^2 - 3x + 1', { x: 3 })).toBeCloseTo(10);
    expect(safeEval('3mx + 2', { m: 2, x: 4 })).toBeCloseTo(26);
    expect(safeEval('√(16) + 2² - |−5|')).toBeCloseTo(3);
    expect(safeEval('sin(π/2) + cos(0)')).toBeCloseTo(2);
    expect(safeEval('(x - 1)(x + 2)', { x: 4 })).toBeCloseTo(18);
  });

  it('classifies 2D/3D points, vectors, planes, spheres, conics, canonical lines, and inequalities', () => {
    const p3 = parseSmartInput('A(1, 2, 3)', '3d');
    expect(p3.kind).toBe('point3d');
    if (p3.kind === 'point3d') {
      expect(p3.name).toBe('A');
      expect(p3.coords).toEqual([1, 2, 3]);
    }

    const pl = parseSmartInput('2x - y + 3z - 6 = 0', '3d');
    expect(pl.kind).toBe('plane3d');
    if (pl.kind === 'plane3d') {
      expect(pl.a).toBeCloseTo(2);
      expect(pl.b).toBeCloseTo(-1);
      expect(pl.c).toBeCloseTo(3);
      expect(pl.d).toBeCloseTo(-6);
    }

    const sp = parseSmartInput('x^2 + y^2 + z^2 - 2x + 4y - 2z - 3 = 0', '3d');
    expect(sp.kind).toBe('sphere3d');
    if (sp.kind === 'sphere3d') {
      expect(sp.center[0]).toBeCloseTo(1);
      expect(sp.center[1]).toBeCloseTo(-2);
      expect(sp.center[2]).toBeCloseTo(1);
      expect(sp.radius).toBeCloseTo(3);
    }

    const line3 = parseSmartInput('(x - 1)/2 = (y + 1)/-1 = z/3', '3d');
    expect(line3.kind).toBe('line3d');
    if (line3.kind === 'line3d') {
      expect(line3.point).toEqual([1, -1, 0]);
      expect(line3.dir).toEqual([2, -1, 3]);
    }

    const el = parseSmartInput('x^2/25 + y^2/9 = 1', '2d');
    expect(el.kind).toBe('conic2d');
    if (el.kind === 'conic2d') {
      expect(el.conicType).toBe('ellipse');
      expect(el.a).toBeCloseTo(5);
      expect(el.b).toBeCloseTo(3);
    }

    const ineq = parseSmartInput('2x + y ≤ 4', '2d');
    expect(ineq.kind).toBe('inequality2d');
    if (ineq.kind === 'inequality2d') {
      expect(ineq.a).toBeCloseTo(2);
      expect(ineq.b).toBeCloseTo(1);
      expect(ineq.c).toBeCloseTo(4);
      expect(ineq.op).toBe('<=');
    }

    const fn = parseSmartInput('y = x^3 - 3mx + 1', '2d');
    expect(fn.kind).toBe('function2d');
    if (fn.kind === 'function2d') {
      expect(fn.params).toContain('m');
    }
  });

  it('tracks variables correctly in compiled AST', () => {
    const c = compileExpression('x^3 - 3*m*x + k');
    expect(c.variables.sort()).toEqual(['k', 'm', 'x']);
  });
});

describe('2D Geometry & Calculus Kernel (Lớp 10 & Lớp 12)', () => {
  it('computes Euler line centers (G, H, O) for a triangle', () => {
    const A: [number, number] = [0, 0];
    const B: [number, number] = [6, 0];
    const C: [number, number] = [2, 4];
    const G = triangleCentroid2D(A, B, C);
    const O = triangleCircumcenter2D(A, B, C)!;
    const H = triangleOrthocenter2D(A, B, C)!;

    expect(G[0]).toBeCloseTo(8 / 3);
    expect(G[1]).toBeCloseTo(4 / 3);
    // Euler line: O, G, H are collinear and HG = 2 GO
    expect(H[0] - G[0]).toBeCloseTo(2 * (G[0] - O.center[0]), 5);
    expect(H[1] - G[1]).toBeCloseTo(2 * (G[1] - O.center[1]), 5);
  });

  it('finds extrema, roots, and asymptotes for THPT functions', () => {
    // Cubic y = x^3 - 3x has max at (-1, 2) and min at (1, -2)
    const cubic = analyzeFunction2D('x^3 - 3x', -4, 4, {});
    const maxPt = cubic.extrema.find((e) => e.kind === 'max');
    const minPt = cubic.extrema.find((e) => e.kind === 'min');
    expect(maxPt?.x).toBeCloseTo(-1, 2);
    expect(maxPt?.y).toBeCloseTo(2, 2);
    expect(minPt?.x).toBeCloseTo(1, 2);
    expect(minPt?.y).toBeCloseTo(-2, 2);

    // Rational y = (2x - 1)/(x - 1) has VA x=1, HA y=2
    const rational = analyzeFunction2D('(2x - 1)/(x - 1)', -6, 6, {});
    expect(rational.verticalAsymptotes[0]).toBeCloseTo(1, 1);
    expect(rational.horizontalAsymptote).toBeCloseTo(2, 2);
  });

  it('computes definite integral and solid of revolution volume accurately', () => {
    // ∫_0^2 x dx = 2; V = π ∫_0^2 x^2 dx = 8π/3
    const res = computeIntegral2D('x', 0, 2, {});
    expect(res.area).toBeCloseTo(2, 4);
    expect(res.volumeOx).toBeCloseTo((8 * Math.PI) / 3, 4);
  });
});

describe('3D Oxyz & Solid Geometry Kernel (Lớp 11 & Lớp 12)', () => {
  it('preserves right-handed Vietnamese Oxyz coordinate bridge', () => {
    const p: Vec3 = [2, 3, 5];
    expect(sceneToMath(mathToScene(p))).toEqual(p);
  });

  it('computes classic Lớp 11 pyramid S.ABCD with SA ⊥ (ABCD): d(A,(SBD)) and angles', () => {
    // Square base ABCD of side 2, SA = 2 perpendicular to base:
    // A(0,0,0), B(2,0,0), C(2,2,0), D(0,2,0), S(0,0,2)
    // Exact textbook formula: 1/d^2 = 1/AB^2 + 1/AD^2 + 1/AS^2 = 1/4 + 1/4 + 1/4 = 3/4 => d = 2/sqrt(3)
    const A: Vec3 = [0, 0, 0];
    const B: Vec3 = [2, 0, 0];
    const D: Vec3 = [0, 2, 0];
    const S: Vec3 = [0, 0, 2];
    const plSBD = planeFrom3Points(S, B, D)!;
    const d = distPointToPlane(A, plSBD);
    expect(d).toBeCloseTo(2 / Math.sqrt(3), 5);

    const H = footPointOnPlane(A, plSBD);
    expect(H[0]).toBeCloseTo(2 / 3, 5);
    expect(H[1]).toBeCloseTo(2 / 3, 5);
    expect(H[2]).toBeCloseTo(2 / 3, 5);

    // Angle between SC (dir (2,2,-2)) and base Oxy (z=0): sin = 2 / sqrt(12) = 1/sqrt(3)
    const ang = angleLinePlaneDeg([2, 2, -2], { a: 0, b: 0, c: 1, d: 0 });
    expect(ang).toBeCloseTo((Math.asin(1 / Math.sqrt(3)) * 180) / Math.PI, 4);
  });

  it('computes skew line distance and common perpendicular endpoints', () => {
    // Line 1: x-axis (t, 0, 0), Line 2: (0, t, 3) -> distance = 3, H1=(0,0,0), H2=(0,0,3)
    const res = skewLinesDistance([0, 0, 0], [1, 0, 0], [0, 0, 3], [0, 1, 0]);
    expect(res.distance).toBeCloseTo(3, 5);
    expect(res.h1).toEqual([0, 0, 0]);
    expect(res.h2).toEqual([0, 0, 3]);
  });

  it('slices a cube by plane z = 1 into an exact square cross-section and detects hidden edges', () => {
    const ptMap = new Map<string, Vec3>([
      ['A', [0, 0, 0]],
      ['B', [2, 0, 0]],
      ['C', [2, 2, 0]],
      ['D', [0, 2, 0]],
      ['A1', [0, 0, 2]],
      ['B1', [2, 0, 2]],
      ['C1', [2, 2, 2]],
      ['D1', [0, 2, 2]],
    ]);
    const cube: Polyhedron3D = {
      id: 'cube',
      name: 'Lập phương',
      kind: 'box',
      vertexIds: ['A', 'B', 'C', 'D', 'A1', 'B1', 'C1', 'D1'],
      faces: [
        ['A', 'D', 'C', 'B'],
        ['A1', 'B1', 'C1', 'D1'],
        ['A', 'B', 'B1', 'A1'],
        ['B', 'C', 'C1', 'B1'],
        ['C', 'D', 'D1', 'C1'],
        ['D', 'A', 'A1', 'D1'],
      ],
      color: '#1D5CE5',
      faceOpacity: 0.15,
      visible: true,
      autoDashed: true,
    };

    expect(polyhedronVolume(cube, ptMap)).toBeCloseTo(8, 5);

    const section = slicePolyhedronByPlane(cube, ptMap, { a: 0, b: 0, c: 1, d: -1 });
    expect(section).not.toBeNull();
    expect(section!.vertices.length).toBe(4);
    expect(section!.area).toBeCloseTo(4, 5);

    // Camera in positive octant (10, 10, 10): edges meeting vertex A(0,0,0) are hidden (3 back faces meet at A)
    const edges = computePolyhedronEdgeVisibility(cube, ptMap, [10, 10, 10]);
    const hiddenEdges = edges.filter((e) => e.isHidden);
    expect(hiddenEdges.length).toBe(3);
  });

  it('computes sphere-plane intersection circle & dihedral plane angles (Lớp 12 Oxyz)', () => {
    // Sphere center (1,2,1), R=3; plane x + y + z - 3 = 0 => d = |1+2+1-3|/sqrt(3) = 1/sqrt(3)
    const inter = intersectSpherePlane([1, 2, 1], 3, { a: 1, b: 1, c: 1, d: -3 });
    expect(inter).not.toBeNull();
    expect(inter!.distance).toBeCloseTo(1 / Math.sqrt(3), 5);
    expect(inter!.circleRadius).toBeCloseTo(Math.sqrt(9 - 1 / 3), 5);

    const ang = anglePlanePlaneDeg(
      { a: 1, b: 0, c: 0, d: 0 },
      { a: 1, b: 1, c: 0, d: 0 }
    );
    expect(ang).toBeCloseTo(45, 4);
  });
});
