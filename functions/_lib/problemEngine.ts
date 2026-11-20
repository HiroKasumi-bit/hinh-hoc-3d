export interface ProblemDrawResult {
  title: string;
  category: 'space_geometry' | 'oxyz' | 'function_2d' | 'plane_2d';
  mode: '2d' | '3d' | 'split';
  showAxes: boolean;
  summary: string;
  steps: string[];
  snapshot: {
    sliders: Array<{ id: string; name: string; value: number; min: number; max: number; step: number; playing: boolean }>;
    scene2d: {
      points: Array<Record<string, unknown>>;
      segments: Array<Record<string, unknown>>;
      lines: Array<Record<string, unknown>>;
      vectors: Array<Record<string, unknown>>;
      circles: Array<Record<string, unknown>>;
      conics: Array<Record<string, unknown>>;
      polygons: Array<Record<string, unknown>>;
      functions: Array<Record<string, unknown>>;
      inequalities: Array<Record<string, unknown>>;
      measures: Array<Record<string, unknown>>;
    };
    scene3d: {
      points: Array<Record<string, unknown>>;
      segments: Array<Record<string, unknown>>;
      lines: Array<Record<string, unknown>>;
      vectors: Array<Record<string, unknown>>;
      planes: Array<Record<string, unknown>>;
      polyhedra: Array<Record<string, unknown>>;
      solids: Array<Record<string, unknown>>;
      surfaces: Array<Record<string, unknown>>;
      curves: Array<Record<string, unknown>>;
      crossSections: Array<Record<string, unknown>>;
      measurements: Array<Record<string, unknown>>;
      nets: Array<Record<string, unknown>>;
    };
  };
}

type Vec3 = [number, number, number];
type Vec2 = [number, number];

const PALETTE = ['#1D5CE5', '#0E9F6E', '#E06D1F', '#7C3AED', '#DB2777', '#0891B2'];

function makeUid(prefix: string, counter: { n: number }): string {
  counter.n += 1;
  return `${prefix}-srv-${counter.n}`;
}

function emptyScene2d() {
  return {
    points: [] as Array<Record<string, unknown>>,
    segments: [] as Array<Record<string, unknown>>,
    lines: [] as Array<Record<string, unknown>>,
    vectors: [] as Array<Record<string, unknown>>,
    circles: [] as Array<Record<string, unknown>>,
    conics: [] as Array<Record<string, unknown>>,
    polygons: [] as Array<Record<string, unknown>>,
    functions: [] as Array<Record<string, unknown>>,
    inequalities: [] as Array<Record<string, unknown>>,
    measures: [] as Array<Record<string, unknown>>,
  };
}

function emptyScene3d() {
  return {
    points: [] as Array<Record<string, unknown>>,
    segments: [] as Array<Record<string, unknown>>,
    lines: [] as Array<Record<string, unknown>>,
    vectors: [] as Array<Record<string, unknown>>,
    planes: [] as Array<Record<string, unknown>>,
    polyhedra: [] as Array<Record<string, unknown>>,
    solids: [] as Array<Record<string, unknown>>,
    surfaces: [] as Array<Record<string, unknown>>,
    curves: [] as Array<Record<string, unknown>>,
    crossSections: [] as Array<Record<string, unknown>>,
    measurements: [] as Array<Record<string, unknown>>,
    nets: [] as Array<Record<string, unknown>>,
  };
}

function preprocessProblemText(raw: string): string {
  return raw
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\s*\{([^{}]+)\}/g, '√($1)')
    .replace(/\\perp/g, '⊥')
    .replace(/\\angle/g, '∠')
    .replace(/−|–|—/g, '-')
    .replace(/×|·|⋅/g, '*')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function foldVi(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function round2(v: number): number {
  return Math.abs(v) < 1e-8 ? 0 : Number(v.toFixed(2));
}

function evalSimpleNumeric(raw: string, unitA = 3): number | null {
  let s = raw.trim();
  if (!s) return null;
  s = s
    .replace(/căn\s*bậc\s*hai\s*(?:của\s*)?/gi, 'sqrt ')
    .replace(/căn\s*(\d+(?:\.\d+)?)/gi, 'sqrt($1)')
    .replace(/√\s*\(([^()]+)\)/g, 'Math.sqrt($1)')
    .replace(/√\s*(\d+(?:\.\d+)?)/g, 'Math.sqrt($1)')
    .replace(/\bsqrt\s*\(([^()]+)\)/gi, 'Math.sqrt($1)')
    .replace(/\bsqrt\s+(\d+(?:\.\d+)?)/gi, 'Math.sqrt($1)')
    .replace(/π|\bpi\b/gi, String(Math.PI));

  // Replace standalone parameter `a` (like `2a`, `a/2`, `a*Math.sqrt(3)`) without clobbering Math
  s = s
    .replace(/(\d)\s*a\b/gi, `$1*(${unitA})`)
    .replace(/\ba\s*Math\.sqrt/gi, `(${unitA})*Math.sqrt`)
    .replace(/\ba\b/gi, `(${unitA})`)
    .replace(/(\d)\s*\(/g, '$1*(')
    .replace(/\)\s*(\d)/g, ')*$1')
    .replace(/\)\s*\(/g, ')*(')
    .replace(/\)\s*Math\.sqrt/g, ')*Math.sqrt');

  // Strict allowlist before Function evaluation
  const check = s.replace(/Math\.sqrt/g, '');
  if (!/^[0-9+\-*/().\s]+$/.test(check)) return null;
  try {
    const fn = new Function(`"use strict"; return (${s});`) as () => number;
    const val = fn();
    return Number.isFinite(val) ? val : null;
  } catch {
    return null;
  }
}

function extractUnitA(text: string): number {
  const m = text.match(/\ba\s*=\s*(\d+(?:\.\d+)?)\b/i);
  if (m) {
    const v = parseFloat(m[1]);
    if (Number.isFinite(v) && v > 0 && v <= 20) return v;
  }
  const mSide = text.match(/(?:cạnh(?:\s*đáy)?|canh(?:\s*day)?)\s*(?:bằng|=|là)?\s*(\d+(?:\.\d+)?)\b/i);
  if (mSide) {
    const v = parseFloat(mSide[1]);
    if (Number.isFinite(v) && v > 0 && v <= 20) return v;
  }
  return 3;
}

function extractNamedLength(text: string, labelRegex: string, unitA: number): number | null {
  const re = new RegExp(`\\b(?:${labelRegex})\\s*=\\s*([0-9aA\\s+\\-*/().√căn]+?)(?=[,;.]|\\s+(?:và|với|trên|gọi|tính|dựng|biết|cắt|khi|$))`, 'i');
  const m = text.match(re);
  if (!m) return null;
  return evalSimpleNumeric(m[1], unitA);
}

function parsePlaneEquationLinear(lhsMinusRhs: string): { a: number; b: number; c: number; d: number } | null {
  const clean = lhsMinusRhs.replace(/\s+/g, '');
  if (!clean) return null;
  // Reject non-linear powers in x, y, z
  if (/[xyz]\^/.test(clean) || /[xyz]{2}/.test(clean)) return null;

  const evalLin = (x: number, y: number, z: number): number => {
    const expr = clean
      .replace(/([0-9)])([xyz])/g, '$1*$2')
      .replace(/\bx\b/g, `(${x})`)
      .replace(/\by\b/g, `(${y})`)
      .replace(/\bz\b/g, `(${z})`);
    if (!/^[0-9+\-*/().]+$/.test(expr)) return NaN;
    try {
      return (new Function(`"use strict"; return (${expr});`) as () => number)();
    } catch {
      return NaN;
    }
  };

  const d = evalLin(0, 0, 0);
  const a = evalLin(1, 0, 0) - d;
  const b = evalLin(0, 1, 0) - d;
  const c = evalLin(0, 0, 1) - d;
  if (![a, b, c, d].every((v) => Number.isFinite(v))) return null;
  if (Math.hypot(a, b, c) < 1e-8) return null;
  return { a, b, c, d };
}

function parseLine2DLinear(lhsMinusRhs: string): { a: number; b: number; c: number; op?: '<=' | '<' | '>=' | '>' } | null {
  const eq = parsePlaneEquationLinear(lhsMinusRhs);
  if (!eq || Math.abs(eq.c) > 1e-8) return null;
  if (Math.hypot(eq.a, eq.b) < 1e-8) return null;
  return { a: eq.a, b: eq.b, c: eq.d };
}

function parseVertexPairToken(tok: string, knownNames: Set<string>): [string, string] | null {
  const clean = tok.replace(/[^A-Za-z0-9']/g, '');
  if (clean.length < 2) return null;
  const names = Array.from(knownNames).sort((x, y) => y.length - x.length);
  for (const n1 of names) {
    if (clean.startsWith(n1)) {
      const rest = clean.slice(n1.length);
      if (knownNames.has(rest) && rest !== n1) {
        return [n1, rest];
      }
    }
  }
  return null;
}

function parseThreeVertexToken(tok: string, knownNames: Set<string>): [string, string, string] | null {
  const clean = tok.replace(/[^A-Za-z0-9']/g, '');
  if (clean.length < 3) return null;
  const names = Array.from(knownNames).sort((x, y) => y.length - x.length);
  for (const n1 of names) {
    if (!clean.startsWith(n1)) continue;
    const r1 = clean.slice(n1.length);
    for (const n2 of names) {
      if (n2 === n1 || !r1.startsWith(n2)) continue;
      const r2 = r1.slice(n2.length);
      if (knownNames.has(r2) && r2 !== n1 && r2 !== n2) {
        return [n1, n2, r2];
      }
    }
  }
  return null;
}

function planeFrom3Pts(p1: Vec3, p2: Vec3, p3: Vec3): { a: number; b: number; c: number; d: number } | null {
  const u: Vec3 = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
  const v: Vec3 = [p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2]];
  const n: Vec3 = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const l = Math.hypot(n[0], n[1], n[2]);
  if (l < 1e-8) return null;
  const a = n[0] / l;
  const b = n[1] / l;
  const c = n[2] / l;
  const d = -(a * p1[0] + b * p1[1] + c * p1[2]);
  return { a, b, c, d };
}

function parseCanonicalLine3D(rawSegs: [string, string, string]): { point: Vec3; dir: Vec3 } | null {
  const map: Record<'x' | 'y' | 'z', { p0: number; dir: number } | null> = { x: null, y: null, z: null };
  for (const seg of rawSegs) {
    const clean = seg.replace(/\s+/g, '');
    const m = clean.match(/^\(?([xyz])([+-]\d+(?:\.\d+)?)?\)?\/([+-]?\d+(?:\.\d+)?)$/) ||
              clean.match(/^([xyz])\/([+-]?\d+(?:\.\d+)?)$/);
    if (m) {
      if (m.length === 4) {
        const axis = m[1] as 'x' | 'y' | 'z';
        const offset = m[2] ? parseFloat(m[2]) : 0;
        const dir = parseFloat(m[3]);
        if (!Number.isFinite(dir) || Math.abs(dir) < 1e-9) return null;
        map[axis] = { p0: -offset, dir };
      } else if (m.length === 3) {
        const axis = m[1] as 'x' | 'y' | 'z';
        const dir = parseFloat(m[2]);
        if (!Number.isFinite(dir) || Math.abs(dir) < 1e-9) return null;
        map[axis] = { p0: 0, dir };
      }
    }
  }
  if (map.x && map.y && map.z) {
    return {
      point: [map.x.p0, map.y.p0, map.z.p0],
      dir: [map.x.dir, map.y.dir, map.z.dir],
    };
  }
  return null;
}

// ==================== BRANCH 1: OXYZ COORDINATE GEOMETRY ====================

function solveOxyzProblem(text: string, uid: { n: number }): ProblemDrawResult {
  const scene2d = emptyScene2d();
  const scene3d = emptyScene3d();
  const steps: string[] = [];
  const ptIdByName = new Map<string, string>();
  const ptCoordsByName = new Map<string, Vec3>();
  const planeIdByName = new Map<string, string>();

  // 1. Extract 3D points: A(1; 0; 2), B = (-1, 2, 3)
  const ptRe = /\b([A-Z][0-9']?)\s*(?:=\s*)?\(\s*([^;()]+?)\s*[;,]\s*([^;()]+?)\s*[;,]\s*([^;()]+?)\s*\)/g;
  let mPt: RegExpExecArray | null;
  while ((mPt = ptRe.exec(text)) !== null) {
    const name = mPt[1];
    const x = evalSimpleNumeric(mPt[2]);
    const y = evalSimpleNumeric(mPt[3]);
    const z = evalSimpleNumeric(mPt[4]);
    if (x !== null && y !== null && z !== null && !ptIdByName.has(name)) {
      const id = makeUid('p3', uid);
      scene3d.points.push({ id, name, x: round2(x), y: round2(y), z: round2(z), color: '#D93829', visible: true, showLabel: true });
      ptIdByName.set(name, id);
      ptCoordsByName.set(name, [round2(x), round2(y), round2(z)]);
      steps.push(`Đặt điểm ${name}(${round2(x)}; ${round2(y)}; ${round2(z)})`);
    }
  }

  // 2. Extract 3D vectors: u = (1; -2; 3) or vectơ u(1; 2; 3)
  const vecRe = /(?:vect[oơ]\s*)?\b([a-z][0-9']?)\s*(?:=\s*)?\(\s*([^;()]+?)\s*[;,]\s*([^;()]+?)\s*[;,]\s*([^;()]+?)\s*\)/gi;
  let mVec: RegExpExecArray | null;
  while ((mVec = vecRe.exec(text)) !== null) {
    const name = mVec[1];
    if (/^[A-Z]/.test(name)) continue;
    const x = evalSimpleNumeric(mVec[2]);
    const y = evalSimpleNumeric(mVec[3]);
    const z = evalSimpleNumeric(mVec[4]);
    if (x !== null && y !== null && z !== null) {
      scene3d.vectors.push({
        id: makeUid('v3', uid),
        name: `${name}⃗`,
        origin: [0, 0, 0],
        dir: [round2(x), round2(y), round2(z)],
        color: '#7C3AED',
        visible: true,
      });
      steps.push(`Dựng vectơ ${name}⃗(${round2(x)}; ${round2(y)}; ${round2(z)})`);
    }
  }

  // 3. Extract planes: (P): ax + by + cz + d = 0 or (P): x + y = 3
  const plRe = /(?:\(([A-Z][A-Za-z0-9']*)\)\s*:\s*|mặt\s*phẳng\s*(?:\(([A-Z0-9']+)\)\s*:?\s*)?)([^,.;\n]*?[xyz][^,.;\n]*?)\s*=\s*([+-]?\s*\d+(?:\.\d+)?|0)/gi;
  let mPl: RegExpExecArray | null;
  while ((mPl = plRe.exec(text)) !== null) {
    const rawName = mPl[1] || mPl[2] || `P${scene3d.planes.length + 1}`;
    const lhs = mPl[3];
    const rhs = mPl[4];
    if (/\^2/.test(lhs) || /\//.test(lhs)) continue;
    const eq = parsePlaneEquationLinear(`(${lhs}) - (${rhs})`);
    if (eq) {
      const id = makeUid('pl', uid);
      const plName = `(${rawName})`;
      scene3d.planes.push({
        id,
        name: plName,
        ...eq,
        color: PALETTE[(scene3d.planes.length + 1) % PALETTE.length],
        opacity: 0.24,
        showNormal: true,
        visible: true,
        size: 6,
      });
      planeIdByName.set(rawName, id);
      steps.push(`Dựng mặt phẳng ${plName}`);
    }
  }

  // 4. Extract spheres: (S): (x-1)^2 + (y+2)^2 + (z-3)^2 = 9
  const sphRe = /(?:\(([A-Z][0-9']*)\)\s*:\s*)?\(\s*x\s*([+-]\s*\d+(?:\.\d+)?)?\s*\)\^2\s*\+\s*\(\s*y\s*([+-]\s*\d+(?:\.\d+)?)?\s*\)\^2\s*\+\s*\(\s*z\s*([+-]\s*\d+(?:\.\d+)?)?\s*\)\^2\s*=\s*(\d+(?:\.\d+)?)/gi;
  let mSph: RegExpExecArray | null;
  while ((mSph = sphRe.exec(text)) !== null) {
    const cx = mSph[2] ? -parseFloat(mSph[2].replace(/\s+/g, '')) : 0;
    const cy = mSph[3] ? -parseFloat(mSph[3].replace(/\s+/g, '')) : 0;
    const cz = mSph[4] ? -parseFloat(mSph[4].replace(/\s+/g, '')) : 0;
    const r = Math.sqrt(Math.max(0.1, parseFloat(mSph[5])));
    scene3d.solids.push({
      id: makeUid('sol', uid),
      name: `Mặt cầu (${mSph[1] || 'S'}) (R=${round2(r)})`,
      kind: 'sphere',
      center: [round2(cx), round2(cy), round2(cz)],
      radius: round2(r),
      color: '#1D5CE5',
      opacity: 0.24,
      showAxes: true,
      visible: true,
    });
    steps.push(`Dựng mặt cầu (${mSph[1] || 'S'}) tâm (${round2(cx)}; ${round2(cy)}; ${round2(cz)}), R = ${round2(r)}`);
  }

  // 4b. Extract natural Vietnamese spheres: "mặt cầu tâm I(1; 1; 1) bán kính 2" or "mặt cầu (S) tâm I bán kính R = 3"
  const sphViRe =
    /mặt\s*cầu\s*(?:\(([A-Z][0-9']*)\)\s*)?(?:có\s*)?tâm\s*([A-Z][0-9']*)\s*(?:\(\s*([^;()]+?)\s*[;,]\s*([^;()]+?)\s*[;,]\s*([^;()]+?)\s*\))?[^.]{0,40}?(?:bán\s*kính|R\s*=)\s*(?:R\s*=\s*)?(\d+(?:\.\d+)?)/gi;
  let mSphVi: RegExpExecArray | null;
  while ((mSphVi = sphViRe.exec(text)) !== null) {
    const sLabel = mSphVi[1] || 'S';
    const cName = mSphVi[2];
    const r = Math.max(0.1, parseFloat(mSphVi[6]));
    let centerVec: Vec3 | undefined = ptCoordsByName.get(cName);
    if (!centerVec && mSphVi[3] && mSphVi[4] && mSphVi[5]) {
      const cx = evalSimpleNumeric(mSphVi[3]);
      const cy = evalSimpleNumeric(mSphVi[4]);
      const cz = evalSimpleNumeric(mSphVi[5]);
      if (cx !== null && cy !== null && cz !== null) {
        centerVec = [round2(cx), round2(cy), round2(cz)];
      }
    }
    if (centerVec) {
      scene3d.solids.push({
        id: makeUid('sol', uid),
        name: `Mặt cầu (${sLabel}) tâm ${cName} (R=${round2(r)})`,
        kind: 'sphere',
        center: centerVec,
        radius: round2(r),
        color: '#1D5CE5',
        opacity: 0.24,
        showAxes: true,
        visible: true,
      });
      steps.push(`Dựng mặt cầu (${sLabel}) tâm ${cName}(${centerVec.join('; ')}), R = ${round2(r)}`);
    }
  }

  // 5. Extract canonical 3D lines: (x-1)/2 = (y+1)/-1 = (z-2)/3
  const lnRe = /(?:([a-zA-Z][a-zA-Z0-9']*)\s*:\s*)?(\(?x[^=;,\s]*\)?\/[+-]?\d+(?:\.\d+)?)\s*=\s*(\(?y[^=;,\s]*\)?\/[+-]?\d+(?:\.\d+)?)\s*=\s*(\(?z[^=;,\s]*\)?\/[+-]?\d+(?:\.\d+)?)/gi;
  let mLn: RegExpExecArray | null;
  while ((mLn = lnRe.exec(text)) !== null) {
    const parsed = parseCanonicalLine3D([mLn[2], mLn[3], mLn[4]]);
    if (parsed) {
      const lnName = mLn[1] || `d${scene3d.lines.length + 1}`;
      scene3d.lines.push({
        id: makeUid('l3', uid),
        name: lnName,
        point: parsed.point,
        dir: parsed.dir,
        color: '#1D5CE5',
        visible: true,
      });
      steps.push(`Dựng đường thẳng Oxyz ${lnName}`);
    }
  }

  // 6. Connect triangle / tetrahedron if named points exist
  const knownNames = new Set(ptIdByName.keys());
  const folded = foldVi(text);
  if (ptIdByName.size >= 3 && (folded.includes('tam giac') || folded.includes('tu dien') || folded.includes('chop'))) {
    const ptsArr = Array.from(ptIdByName.entries());
    if (folded.includes('tu dien') && ptsArr.length >= 4) {
      const [p0, p1, p2, p3] = ptsArr.slice(0, 4);
      scene3d.polyhedra.push({
        id: makeUid('poly', uid),
        name: `Tứ diện ${p0[0]}${p1[0]}${p2[0]}${p3[0]}`,
        kind: 'tetrahedron',
        vertexIds: [p0[1], p1[1], p2[1], p3[1]],
        faces: [
          [p0[1], p1[1], p2[1]],
          [p3[1], p0[1], p1[1]],
          [p3[1], p1[1], p2[1]],
          [p3[1], p2[1], p0[1]],
        ],
        color: '#0E9F6E',
        faceOpacity: 0.16,
        visible: true,
        autoDashed: true,
      });
      steps.push(`Nối tứ diện ${p0[0]}${p1[0]}${p2[0]}${p3[0]}`);
    } else if (ptsArr.length >= 3) {
      for (let i = 0; i < 3; i++) {
        const a = ptsArr[i];
        const b = ptsArr[(i + 1) % 3];
        scene3d.segments.push({
          id: makeUid('s3', uid),
          name: `${a[0]}${b[0]}`,
          p1Id: a[1],
          p2Id: b[1],
          color: '#0F1B2D',
          style: 'solid',
          visible: true,
          showLength: true,
        });
      }
      steps.push(`Nối tam giác ${ptsArr[0][0]}${ptsArr[1][0]}${ptsArr[2][0]}`);
    }
  }

  // 7. Plane through 3 points if mentioned: mặt phẳng (ABC)
  const pl3pRe = /(?:mặt\s*phẳng|mat\s*phang)\s*\(([A-Z0-9']{3,6})\)/gi;
  let mPl3: RegExpExecArray | null;
  while ((mPl3 = pl3pRe.exec(text)) !== null) {
    const trio = parseThreeVertexToken(mPl3[1], knownNames);
    if (trio && !planeIdByName.has(mPl3[1])) {
      const c0 = ptCoordsByName.get(trio[0]);
      const c1 = ptCoordsByName.get(trio[1]);
      const c2 = ptCoordsByName.get(trio[2]);
      if (c0 && c1 && c2) {
        const eq = planeFrom3Pts(c0, c1, c2);
        if (eq) {
          const id = makeUid('pl', uid);
          scene3d.planes.push({
            id,
            name: `(${mPl3[1]})`,
            ...eq,
            pointIds: [ptIdByName.get(trio[0])!, ptIdByName.get(trio[1])!, ptIdByName.get(trio[2])!],
            color: '#0E9F6E',
            opacity: 0.22,
            showNormal: false,
            visible: true,
            size: 6,
          });
          planeIdByName.set(mPl3[1], id);
          steps.push(`Dựng mặt phẳng (${mPl3[1]})`);
        }
      }
    }
  }

  // 8. Foot on plane: hình chiếu của A lên (P)
  const footMatch = text.match(/(?:hình\s*chiếu|hinh\s*chieu)[^.;]*?(?:của\s*)?\b([A-Z][0-9']?)\b\s*(?:lên|len|xuống|xuong)\s*(?:mặt\s*phẳng\s*)?\(([A-Z0-9']+)\)/i);
  if (footMatch) {
    const pName = footMatch[1];
    const plKey = footMatch[2];
    const pId = ptIdByName.get(pName);
    const plId = planeIdByName.get(plKey);
    if (pId && plId) {
      const hName = ptIdByName.has('H') ? "H'" : 'H';
      const hId = makeUid('p3', uid);
      scene3d.points.push({
        id: hId,
        name: hName,
        x: 0,
        y: 0,
        z: 0,
        color: '#7C3AED',
        visible: true,
        showLabel: true,
        computed: { kind: 'footPlane', refs: [pId, plId] },
      });
      scene3d.segments.push({
        id: makeUid('s3', uid),
        name: `${pName}${hName} ⊥ (${plKey})`,
        p1Id: pId,
        p2Id: hId,
        color: '#7C3AED',
        style: 'dashed',
        visible: true,
        showLength: true,
      });
      steps.push(`Dựng hình chiếu ${hName} của ${pName} lên (${plKey})`);
    }
  }

  // 9. Distance d(A, (P))
  const distMatch = text.match(/(?:khoảng\s*cách\s*(?:từ\s*)?|d\s*\()\s*([A-Z][0-9']?)\s*(?:đến|toi|,)\s*(?:mặt\s*phẳng\s*)?\(([A-Z0-9']+)\)/i);
  if (distMatch) {
    const pId = ptIdByName.get(distMatch[1]);
    const plId = planeIdByName.get(distMatch[2]);
    if (pId && plId) {
      scene3d.measurements.push({
        id: makeUid('m3', uid),
        name: `d(${distMatch[1]}, (${distMatch[2]}))`,
        kind: 'distancePPlane',
        refs: [pId, plId],
        color: '#7C3AED',
        visible: true,
      });
      steps.push(`Tính khoảng cách d(${distMatch[1]}, (${distMatch[2]}))`);
    }
  }

  return {
    title: 'Bài toán Tọa độ Không gian (Oxyz)',
    category: 'oxyz',
    mode: '3d',
    showAxes: true,
    summary: `Đã dựng ${scene3d.points.length} điểm, ${scene3d.planes.length} mặt phẳng, ${scene3d.solids.length} mặt cầu/khối Oxyz.`,
    steps,
    snapshot: { sliders: [], scene2d, scene3d },
  };
}

// ==================== BRANCH 2: VIETNAMESE SPACE GEOMETRY (LỚP 11 & 12) ====================

function solveSpaceGeometryProblem(text: string, uid: { n: number }): ProblemDrawResult {
  const scene2d = emptyScene2d();
  const scene3d = emptyScene3d();
  const steps: string[] = [];
  const folded = foldVi(text);
  const unitA = extractUnitA(text);

  const ptIdByName = new Map<string, string>();
  const ptCoordsByName = new Map<string, Vec3>();
  const planeIdByName = new Map<string, string>();

  const addPt = (name: string, coords: Vec3, color = '#D93829', computed?: Record<string, unknown>): string => {
    const id = makeUid('p3', uid);
    scene3d.points.push({
      id,
      name,
      x: round2(coords[0]),
      y: round2(coords[1]),
      z: round2(coords[2]),
      color,
      visible: true,
      showLabel: true,
      ...(computed ? { computed } : {}),
    });
    ptIdByName.set(name, id);
    ptCoordsByName.set(name, [round2(coords[0]), round2(coords[1]), round2(coords[2])]);
    return id;
  };

  let primaryPolyId: string | null = null;
  let basePlaneName: string | null = null;

  // 1. Round Solids standalone (Hình nón / Hình trụ / Mặt cầu) when no polyhedron
  const hasPolyKeyword = /(?:chóp|chop|tứ\s*diện|tu\s*dien|lăng\s*trụ|lang\s*tru|lập\s*phương|lap\s*phuong|hình\s*hộp|hinh\s*hop)/.test(folded);
  if (!hasPolyKeyword && /(?:hình\s*nón|hinh\s*non|hình\s*trụ|hinh\s*tru|mặt\s*cầu|mat\s*cau)/.test(folded)) {
    const r = extractNamedLength(text, 'R|r|bán\\s*kính', unitA) ?? 2;
    const h = extractNamedLength(text, 'h|chiều\\s*cao|SO|OO\'', unitA) ?? 3.5;
    if (folded.includes('mat cau') || folded.includes('mặt cầu')) {
      scene3d.solids.push({
        id: makeUid('sol', uid),
        name: `Mặt cầu (R=${round2(r)})`,
        kind: 'sphere',
        center: [0, 0, round2(r)],
        radius: round2(r),
        color: '#1D5CE5',
        opacity: 0.28,
        showAxes: true,
        visible: true,
      });
      steps.push(`Dựng mặt cầu bán kính R = ${round2(r)}`);
    } else if (folded.includes('hinh non') || folded.includes('hình nón')) {
      scene3d.solids.push({
        id: makeUid('sol', uid),
        name: `Hình nón (R=${round2(r)}, h=${round2(h)})`,
        kind: 'cone',
        center: [0, 0, 0],
        radius: round2(r),
        height: round2(h),
        color: '#E06D1F',
        opacity: 0.28,
        showAxes: true,
        visible: true,
      });
      steps.push(`Dựng hình nón bán kính R = ${round2(r)}, chiều cao h = ${round2(h)}`);
    } else {
      scene3d.solids.push({
        id: makeUid('sol', uid),
        name: `Hình trụ (R=${round2(r)}, h=${round2(h)})`,
        kind: 'cylinder',
        center: [0, 0, 0],
        radius: round2(r),
        height: round2(h),
        color: '#0891B2',
        opacity: 0.28,
        showAxes: true,
        visible: true,
      });
      steps.push(`Dựng hình trụ bán kính R = ${round2(r)}, chiều cao h = ${round2(h)}`);
    }
    return {
      title: 'Khối tròn xoay (Hình học 12)',
      category: 'space_geometry',
      mode: '3d',
      showAxes: false,
      summary: steps[0],
      steps,
      snapshot: { sliders: [], scene2d, scene3d },
    };
  }

  // 2. Cube or Rectangular Box: Hình lập phương / Hình hộp ABCD.A'B'C'D'
  if (folded.includes('lap phuong') || folded.includes('hinh hop')) {
    const isCube = folded.includes('lap phuong');
    const lenA = extractNamedLength(text, 'AB|CD|a|canh', unitA) ?? unitA;
    const lenB = isCube ? lenA : (extractNamedLength(text, 'AD|BC|b', unitA) ?? round2(lenA * 1.25));
    const lenH = isCube ? lenA : (extractNamedLength(text, "AA'|BB'|CC'|DD'|h|chieu\\s*cao", unitA) ?? round2(lenA * 1.35));
    const hx = lenA / 2;
    const hy = lenB / 2;

    const aId = addPt('A', [-hx, -hy, 0]);
    const bId = addPt('B', [hx, -hy, 0]);
    const cId = addPt('C', [hx, hy, 0]);
    const dId = addPt('D', [-hx, hy, 0]);
    const a1Id = addPt("A'", [-hx, -hy, lenH]);
    const b1Id = addPt("B'", [hx, -hy, lenH]);
    const c1Id = addPt("C'", [hx, hy, lenH]);
    const d1Id = addPt("D'", [-hx, hy, lenH]);

    const polyId = makeUid('poly', uid);
    scene3d.polyhedra.push({
      id: polyId,
      name: isCube ? "Hình lập phương ABCD.A'B'C'D'" : "Hình hộp chữ nhật ABCD.A'B'C'D'",
      kind: 'box',
      vertexIds: [aId, bId, cId, dId, a1Id, b1Id, c1Id, d1Id],
      faces: [
        [aId, dId, cId, bId],
        [a1Id, b1Id, c1Id, d1Id],
        [aId, bId, b1Id, a1Id],
        [bId, cId, c1Id, b1Id],
        [cId, dId, d1Id, c1Id],
        [dId, aId, a1Id, d1Id],
      ],
      color: '#7C3AED',
      faceOpacity: 0.16,
      visible: true,
      autoDashed: true,
    });
    primaryPolyId = polyId;
    basePlaneName = 'ABCD';
    steps.push(`Dựng ${isCube ? 'hình lập phương' : 'hình hộp'} ABCD.A'B'C'D' (${round2(lenA)} × ${round2(lenB)} × ${round2(lenH)})`);
  }
  // 3. Standing / Regular Triangular Prism: Lăng trụ ABC.A'B'C'
  else if (folded.includes('lang tru')) {
    const a = extractNamedLength(text, 'AB|AC|BC|canh', unitA) ?? unitA;
    const h = extractNamedLength(text, "AA'|BB'|CC'|h|chieu\\s*cao", unitA) ?? round2(a * 1.3);
    const r = a / Math.sqrt(3);
    const pA: Vec3 = [r, 0, 0];
    const pB: Vec3 = [-r / 2, (r * Math.sqrt(3)) / 2, 0];
    const pC: Vec3 = [-r / 2, -(r * Math.sqrt(3)) / 2, 0];
    const obliqueShift = folded.includes('dung') || folded.includes('deu') ? 0 : round2(a * 0.35);

    const aId = addPt('A', pA);
    const bId = addPt('B', pB);
    const cId = addPt('C', pC);
    const a1Id = addPt("A'", [pA[0] + obliqueShift, pA[1], h]);
    const b1Id = addPt("B'", [pB[0] + obliqueShift, pB[1], h]);
    const c1Id = addPt("C'", [pC[0] + obliqueShift, pC[1], h]);

    const polyId = makeUid('poly', uid);
    scene3d.polyhedra.push({
      id: polyId,
      name: "Lăng trụ ABC.A'B'C'",
      kind: 'prism',
      vertexIds: [aId, bId, cId, a1Id, b1Id, c1Id],
      faces: [
        [aId, cId, bId],
        [a1Id, b1Id, c1Id],
        [aId, bId, b1Id, a1Id],
        [bId, cId, c1Id, b1Id],
        [cId, aId, a1Id, c1Id],
      ],
      color: '#0891B2',
      faceOpacity: 0.16,
      visible: true,
      autoDashed: true,
    });
    primaryPolyId = polyId;
    basePlaneName = 'ABC';
    steps.push(`Dựng lăng trụ ${obliqueShift === 0 ? 'đứng' : 'xiên'} ABC.A'B'C' (a = ${round2(a)}, h = ${round2(h)})`);
  }
  // 4. Triangular Pyramid / Tetrahedron: Tứ diện hoặc Chóp tam giác S.ABC / ABCD
  else if (
    folded.includes('tu dien') ||
    /chop\s*(?:tam\s*giac|deu)?\s*s\.?abc\b/.test(folded) ||
    (/chop/.test(folded) && /day\s*(?:la\s*)?tam\s*giac/.test(folded))
  ) {
    const namedABCD =
      (/tu\s*dien(?:\s+\w+){0,2}\s+abcd\b/.test(folded) ||
        (folded.includes('tu dien') && /\babcd\b/.test(folded))) &&
      !folded.includes('s.abc');
    const vNames: [string, string, string, string] = namedABCD ? ['B', 'C', 'D', 'A'] : ['A', 'B', 'C', 'S'];
    const a = extractNamedLength(text, 'AB|BC|AC|canh', unitA) ?? unitA;

    let p0: Vec3, p1: Vec3, p2: Vec3;
    if (folded.includes('vuong tai a') || folded.includes('vuong can tai a')) {
      const ab = extractNamedLength(text, 'AB', unitA) ?? a;
      const ac = extractNamedLength(text, 'AC', unitA) ?? (folded.includes('vuong can') ? ab : round2(a * 1.2));
      p0 = [-ab / 3, -ac / 3, 0];
      p1 = [ab * (2 / 3), -ac / 3, 0];
      p2 = [-ab / 3, ac * (2 / 3), 0];
    } else if (folded.includes('vuong tai b') || folded.includes('vuong can tai b')) {
      const ba = extractNamedLength(text, 'AB', unitA) ?? a;
      const bc = extractNamedLength(text, 'BC', unitA) ?? ba;
      p1 = [-ba / 2, -bc / 3, 0];
      p0 = [ba / 2, -bc / 3, 0];
      p2 = [-ba / 2, bc * (2 / 3), 0];
    } else {
      const R = a / Math.sqrt(3);
      p0 = [R, 0, 0];
      p1 = [-R / 2, (R * Math.sqrt(3)) / 2, 0];
      p2 = [-R / 2, -(R * Math.sqrt(3)) / 2, 0];
    }

    const defaultH = folded.includes('tu dien deu') ? round2(a * Math.sqrt(2 / 3)) : round2(a * 1.25);
    const h =
      extractNamedLength(text, `${vNames[3]}${vNames[0]}|${vNames[3]}${vNames[1]}|${vNames[3]}O|h|chieu\\s*cao`, unitA) ??
      defaultH;

    let apexPos: Vec3 = [round2((p0[0] + p1[0] + p2[0]) / 3), round2((p0[1] + p1[1] + p2[1]) / 3), h];
    let footIdx: number | null = null;
    if (new RegExp(`${vNames[3].toLowerCase()}${vNames[0].toLowerCase()}\\s*(?:⊥|vuong\\s*goc)`).test(folded)) {
      apexPos = [p0[0], p0[1], h];
      footIdx = 0;
    } else if (new RegExp(`${vNames[3].toLowerCase()}${vNames[1].toLowerCase()}\\s*(?:⊥|vuong\\s*goc)`).test(folded)) {
      apexPos = [p1[0], p1[1], h];
      footIdx = 1;
    } else if (new RegExp(`${vNames[3].toLowerCase()}${vNames[2].toLowerCase()}\\s*(?:⊥|vuong\\s*goc)`).test(folded)) {
      apexPos = [p2[0], p2[1], h];
      footIdx = 2;
    }

    const id0 = addPt(vNames[0], p0);
    const id1 = addPt(vNames[1], p1);
    const id2 = addPt(vNames[2], p2);
    const idTop = addPt(vNames[3], apexPos);

    // Compute correct base winding
    const u: Vec3 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const v: Vec3 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    const nz = u[0] * v[1] - u[1] * v[0];
    const baseFace = nz > 0 ? [id0, id2, id1] : [id0, id1, id2];

    const polyId = makeUid('poly', uid);
    scene3d.polyhedra.push({
      id: polyId,
      name: `${folded.includes('tu dien') ? 'Tứ diện' : 'Hình chóp'} ${vNames[3]}.${vNames[0]}${vNames[1]}${vNames[2]}`,
      kind: 'tetrahedron',
      vertexIds: [id0, id1, id2, idTop],
      faces: [
        baseFace,
        [idTop, baseFace[0], baseFace[2]],
        [idTop, baseFace[2], baseFace[1]],
        [idTop, baseFace[1], baseFace[0]],
      ],
      color: '#0E9F6E',
      faceOpacity: 0.16,
      visible: true,
      autoDashed: true,
    });
    primaryPolyId = polyId;
    basePlaneName = `${vNames[0]}${vNames[1]}${vNames[2]}`;
    steps.push(
      `Dựng ${folded.includes('tu dien') ? 'tứ diện' : 'chóp tam giác'} ${vNames[3]}.${vNames[0]}${vNames[1]}${vNames[2]} (${footIdx !== null ? `${vNames[3]}${vNames[footIdx]} ⊥ đáy, ` : ''}h = ${round2(h)})`
    );
  }
  // 5. Quadrilateral Pyramid: Chóp S.ABCD (default space geometry if chóp S.ABCD or unspecified quad pyramid)
  else {
    const a = extractNamedLength(text, 'AB|a|canh', unitA) ?? unitA;
    let b = a;
    if (folded.includes('chu nhat') || folded.includes('chữ nhật')) {
      b = extractNamedLength(text, 'AD|BC|b', unitA) ?? round2(a * 1.35);
    } else if (folded.includes('hinh thang') || folded.includes('hình thang')) {
      b = extractNamedLength(text, 'AD|BC', unitA) ?? a;
    }

    let pA: Vec3, pB: Vec3, pC: Vec3, pD: Vec3;
    const hx = a / 2;
    const hy = b / 2;

    if (folded.includes('thoi') && !folded.includes('vuong')) {
      const ang = (folded.includes('120') ? 120 : 60) * (Math.PI / 180);
      const dx = a * Math.cos(ang);
      const dy = a * Math.sin(ang);
      const cx = (a + dx) / 2;
      const cy = dy / 2;
      pA = [-cx, -cy, 0];
      pB = [a - cx, -cy, 0];
      pC = [a + dx - cx, dy - cy, 0];
      pD = [dx - cx, dy - cy, 0];
    } else if (folded.includes('hinh thang') || folded.includes('hình thang')) {
      const bigBase = extractNamedLength(text, 'AD', unitA) ?? a * 2;
      pA = [-hx, -hy, 0];
      pB = [hx, -hy, 0];
      pC = [hx, hy, 0];
      pD = [-hx, -hy + bigBase, 0];
    } else {
      pA = [-hx, -hy, 0];
      pB = [hx, -hy, 0];
      pC = [hx, hy, 0];
      pD = [-hx, hy, 0];
    }

    const h =
      extractNamedLength(text, 'SA|SB|SC|SD|SO|SH|h|chieu\\s*cao', unitA) ??
      round2(Math.max(2.5, a * 1.15));

    let apexPos: Vec3 = [0, 0, h];
    let perpDesc = 'chóp đều SO ⊥ đáy';
    if (/sa\s*(?:⊥|vuong\s*goc)/.test(folded)) {
      apexPos = [pA[0], pA[1], h];
      perpDesc = 'SA ⊥ (ABCD)';
    } else if (/sb\s*(?:⊥|vuong\s*goc)/.test(folded)) {
      apexPos = [pB[0], pB[1], h];
      perpDesc = 'SB ⊥ (ABCD)';
    } else if (/sc\s*(?:⊥|vuong\s*goc)/.test(folded)) {
      apexPos = [pC[0], pC[1], h];
      perpDesc = 'SC ⊥ (ABCD)';
    } else if (/sd\s*(?:⊥|vuong\s*goc)/.test(folded)) {
      apexPos = [pD[0], pD[1], h];
      perpDesc = 'SD ⊥ (ABCD)';
    } else if (/\(sab\)\s*(?:⊥|vuong\s*goc)/.test(folded)) {
      apexPos = [(pA[0] + pB[0]) / 2, (pA[1] + pB[1]) / 2, h];
      perpDesc = '(SAB) ⊥ (ABCD)';
    }

    const aId = addPt('A', pA);
    const bId = addPt('B', pB);
    const cId = addPt('C', pC);
    const dId = addPt('D', pD);
    const sId = addPt('S', apexPos);

    const polyId = makeUid('poly', uid);
    scene3d.polyhedra.push({
      id: polyId,
      name: 'Hình chóp S.ABCD',
      kind: 'pyramid',
      vertexIds: [aId, bId, cId, dId, sId],
      faces: [
        [aId, dId, cId, bId],
        [sId, aId, bId],
        [sId, bId, cId],
        [sId, cId, dId],
        [sId, dId, aId],
      ],
      color: '#1D5CE5',
      faceOpacity: 0.16,
      visible: true,
      autoDashed: true,
    });
    primaryPolyId = polyId;
    basePlaneName = 'ABCD';
    steps.push(`Dựng hình chóp S.ABCD (${perpDesc}, h = ${round2(h)})`);

    // If (SAB) ⊥ (ABCD) add midpoint H & altitude SH
    if (/\(sab\)\s*(?:⊥|vuong\s*goc)/.test(folded)) {
      const hId = addPt('H', [(pA[0] + pB[0]) / 2, (pA[1] + pB[1]) / 2, 0], '#0E9F6E', {
        kind: 'midpoint',
        refs: [aId, bId],
      });
      scene3d.segments.push({
        id: makeUid('s3', uid),
        name: 'SH',
        p1Id: sId,
        p2Id: hId,
        color: '#7C3AED',
        style: 'dashed',
        visible: true,
        showLength: true,
      });
      steps.push('Dựng trung điểm H của AB và đường cao SH ⊥ (ABCD)');
    }
  }

  // ==================== SECONDARY POINTS & CONSTRUCTIONS ====================
  const known = () => new Set(ptIdByName.keys());

  // A. Center O of base: O là tâm đáy / O là giao điểm AC và BD
  if (/(?:\bO\b\s*là\s*tâm|\bO\b\s*là\s*giao\s*điểm)/i.test(text) && ptIdByName.has('A') && ptIdByName.has('C') && !ptIdByName.has('O')) {
    const aCoords = ptCoordsByName.get('A')!;
    const cCoords = ptCoordsByName.get('C')!;
    const oPos: Vec3 = [(aCoords[0] + cCoords[0]) / 2, (aCoords[1] + cCoords[1]) / 2, (aCoords[2] + cCoords[2]) / 2];
    const oId = addPt('O', oPos, '#0E9F6E', { kind: 'midpoint', refs: [ptIdByName.get('A')!, ptIdByName.get('C')!] });
    if (ptIdByName.has('B') && ptIdByName.has('D')) {
      scene3d.segments.push(
        { id: makeUid('s3', uid), name: 'AC', p1Id: ptIdByName.get('A')!, p2Id: ptIdByName.get('C')!, color: '#64748B', style: 'dashed', visible: true },
        { id: makeUid('s3', uid), name: 'BD', p1Id: ptIdByName.get('B')!, p2Id: ptIdByName.get('D')!, color: '#64748B', style: 'dashed', visible: true }
      );
    }
    if (ptIdByName.has('S') && folded.includes('chóp đều')) {
      scene3d.segments.push({ id: makeUid('s3', uid), name: 'SO', p1Id: ptIdByName.get('S')!, p2Id: oId, color: '#7C3AED', style: 'dashed', visible: true, showLength: true });
    }
    steps.push('Dựng tâm đáy O (giao điểm AC và BD)');
  }

  // B. Midpoints: e.g. "M là trung điểm SC", "M, N lần lượt là trung điểm của SA, SB"
  const midRe = /([A-Z](?:\s*,\s*[A-Z])*)\s*(?:lần\s*lượt\s*)?là\s*trung\s*điểm\s*(?:của\s*(?:các\s*)?(?:cạnh|đoạn)?\s*)?([A-Z0-9']{2,6}(?:\s*(?:,|và)\s*[A-Z0-9']{2,6})*)/gi;
  let mMid: RegExpExecArray | null;
  while ((mMid = midRe.exec(text)) !== null) {
    const names = mMid[1].split(',').map((s) => s.trim()).filter(Boolean);
    const segTokens = mMid[2].split(/[,]|và/i).map((s) => s.trim()).filter(Boolean);
    for (let i = 0; i < Math.min(names.length, segTokens.length); i++) {
      const pName = names[i];
      const pair = parseVertexPairToken(segTokens[i], known());
      if (pair && !ptIdByName.has(pName)) {
        const c1 = ptCoordsByName.get(pair[0])!;
        const c2 = ptCoordsByName.get(pair[1])!;
        const midCoords: Vec3 = [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2, (c1[2] + c2[2]) / 2];
        addPt(pName, midCoords, '#E06D1F', {
          kind: 'midpoint',
          refs: [ptIdByName.get(pair[0])!, ptIdByName.get(pair[1])!],
        });
        steps.push(`Lấy trung điểm ${pName} của ${pair[0]}${pair[1]}`);
      }
    }
  }

  // C. Centroids: "G là trọng tâm tam giác ABC"
  const centRe = /\b([A-Z])\b\s*là\s*trọng\s*tâm\s*(?:của\s*)?(?:tam\s*giác\s*|Δ\s*)?([A-Z0-9']{3,6})/gi;
  let mCent: RegExpExecArray | null;
  while ((mCent = centRe.exec(text)) !== null) {
    const gName = mCent[1];
    const trio = parseThreeVertexToken(mCent[2], known());
    if (trio && !ptIdByName.has(gName)) {
      const c0 = ptCoordsByName.get(trio[0])!;
      const c1 = ptCoordsByName.get(trio[1])!;
      const c2 = ptCoordsByName.get(trio[2])!;
      addPt(gName, [(c0[0] + c1[0] + c2[0]) / 3, (c0[1] + c1[1] + c2[1]) / 3, (c0[2] + c1[2] + c2[2]) / 3], '#0E9F6E', {
        kind: 'centroid',
        refs: [ptIdByName.get(trio[0])!, ptIdByName.get(trio[1])!, ptIdByName.get(trio[2])!],
      });
      steps.push(`Lấy trọng tâm ${gName} của Δ${trio.join('')}`);
    }
  }

  // D. Ratio points: "M thuộc SA sao cho SM = 1/3 SA" or "AM = 2/3 AC"
  const ratioRe = /\b([A-Z])\b\s*(?:thuộc|nằm\s*trên)\s*(?:cạnh\s*|đoạn\s*)?([A-Z0-9']{2,6})\s*sao\s*cho\s*([A-Z0-9']{2,6})\s*=\s*(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?)\s*([A-Z0-9']{2,6})/gi;
  let mRat: RegExpExecArray | null;
  while ((mRat = ratioRe.exec(text)) !== null) {
    const ptName = mRat[1];
    const segPair = parseVertexPairToken(mRat[2], known());
    const k = evalSimpleNumeric(mRat[4]);
    if (segPair && k !== null && k > 0 && k < 1 && !ptIdByName.has(ptName)) {
      const p1Id = ptIdByName.get(segPair[0])!;
      const p2Id = ptIdByName.get(segPair[1])!;
      const c1 = ptCoordsByName.get(segPair[0])!;
      const c2 = ptCoordsByName.get(segPair[1])!;
      // Check if LHS starts at segPair[1] instead of segPair[0]
      const lhsFirst = mRat[3].charAt(0);
      const ratio = lhsFirst === segPair[1] ? 1 - k : k;
      addPt(ptName, [c1[0] + ratio * (c2[0] - c1[0]), c1[1] + ratio * (c2[1] - c1[1]), c1[2] + ratio * (c2[2] - c1[2])], '#E06D1F', {
        kind: 'ratio',
        refs: [p1Id, p2Id],
        ratio,
      });
      steps.push(`Đặt điểm ${ptName} trên ${segPair[0]}${segPair[1]} theo tỉ lệ ${round2(ratio)}`);
    }
  }

  const ensurePlane3P = (planeToken: string, color = '#0E9F6E'): string | null => {
    if (planeIdByName.has(planeToken)) return planeIdByName.get(planeToken)!;
    // Handle base plane like ABCD (pick A, B, C)
    if (planeToken.length >= 3) {
      const kSet = known();
      const ids: string[] = [];
      const coords: Vec3[] = [];
      let rem = planeToken;
      const sortedNames = Array.from(kSet).sort((x, y) => y.length - x.length);
      while (rem.length > 0 && ids.length < 3) {
        const hit = sortedNames.find((n) => rem.startsWith(n));
        if (!hit) break;
        ids.push(ptIdByName.get(hit)!);
        coords.push(ptCoordsByName.get(hit)!);
        rem = rem.slice(hit.length);
      }
      if (ids.length === 3) {
        const eq = planeFrom3Pts(coords[0], coords[1], coords[2]);
        if (eq) {
          const plId = makeUid('pl', uid);
          scene3d.planes.push({
            id: plId,
            name: `(${planeToken})`,
            ...eq,
            pointIds: [ids[0], ids[1], ids[2]],
            color,
            opacity: 0.2,
            showNormal: false,
            visible: true,
            size: 5.5,
          });
          planeIdByName.set(planeToken, plId);
          return plId;
        }
      }
    }
    return null;
  };

  // E. Cross Sections: "thiết diện ... (AMN)"
  const csRe = /(?:thiết\s*diện|thiet\s*dien)[^.;]*?\(([A-Z0-9']{3,6})\)/gi;
  let mCs: RegExpExecArray | null;
  while ((mCs = csRe.exec(text)) !== null && primaryPolyId) {
    const trio = parseThreeVertexToken(mCs[1], known());
    if (trio) {
      const plId = ensurePlane3P(mCs[1], '#E06D1F');
      scene3d.crossSections.push({
        id: makeUid('cs', uid),
        name: `Thiết diện (${mCs[1]})`,
        polyhedronId: primaryPolyId,
        planeId: plId || undefined,
        pointIds: [ptIdByName.get(trio[0])!, ptIdByName.get(trio[1])!, ptIdByName.get(trio[2])!],
        color: '#E06D1F',
        opacity: 0.45,
        visible: true,
      });
      steps.push(`Cắt thiết diện khối bởi mặt phẳng (${mCs[1]})`);
    }
  }

  // F. Distance from point to plane: "khoảng cách từ A đến (SBC)" / "d(A, (SBC))"
  const dPlaneRe = /(?:khoảng\s*cách\s*(?:từ\s*)?|d\s*\()\s*([A-Z][0-9']?)\s*(?:đến|tới|,)\s*(?:mặt\s*phẳng\s*)?\(([A-Z0-9']{3,6})\)/gi;
  let mDp: RegExpExecArray | null;
  while ((mDp = dPlaneRe.exec(text)) !== null) {
    const pId = ptIdByName.get(mDp[1]);
    const plId = ensurePlane3P(mDp[2], '#1D5CE5');
    if (pId && plId) {
      scene3d.measurements.push({
        id: makeUid('m3', uid),
        name: `d(${mDp[1]}, (${mDp[2]}))`,
        kind: 'distancePPlane',
        refs: [pId, plId],
        color: '#7C3AED',
        visible: true,
      });
      steps.push(`Tính khoảng cách d(${mDp[1]}, (${mDp[2]})) kèm hình chiếu vuông góc`);
    }
  }

  // G. Angle between line & plane: "góc giữa SM và (ABC)"
  const angLpRe = /góc\s*(?:giữa\s*)?(?:đường\s*thẳng\s*)?([A-Z0-9']{2,6})\s*(?:và|với)\s*(?:mặt\s*phẳng\s*)?\(([A-Z0-9']{3,6})\)/gi;
  let mAlp: RegExpExecArray | null;
  while ((mAlp = angLpRe.exec(text)) !== null) {
    const pair = parseVertexPairToken(mAlp[1], known());
    const plId = ensurePlane3P(mAlp[2], '#0E9F6E');
    if (pair && plId) {
      const segId = makeUid('s3', uid);
      scene3d.segments.push({
        id: segId,
        name: `${pair[0]}${pair[1]}`,
        p1Id: ptIdByName.get(pair[0])!,
        p2Id: ptIdByName.get(pair[1])!,
        color: '#E06D1F',
        style: 'solid',
        visible: true,
      });
      scene3d.measurements.push({
        id: makeUid('m3', uid),
        name: `∠(${pair[0]}${pair[1]}, (${mAlp[2]}))`,
        kind: 'angleLPlane',
        refs: [segId, plId],
        color: '#E06D1F',
        visible: true,
      });
      steps.push(`Đo góc giữa ${pair[0]}${pair[1]} và (${mAlp[2]})`);
    }
  }

  // H. Angle between 2 planes: "góc giữa (SBC) và (ABCD)"
  const angPpRe = /góc\s*(?:giữa\s*)?\(([A-Z0-9']{3,6})\)\s*(?:và|với)\s*\(([A-Z0-9']{3,6})\)/gi;
  let mApp: RegExpExecArray | null;
  while ((mApp = angPpRe.exec(text)) !== null) {
    const pl1 = ensurePlane3P(mApp[1], '#0E9F6E');
    const pl2 = ensurePlane3P(mApp[2] || basePlaneName || '', '#1D5CE5');
    if (pl1 && pl2) {
      scene3d.measurements.push({
        id: makeUid('m3', uid),
        name: `∠((${mApp[1]}), (${mApp[2]}))`,
        kind: 'anglePlanePlane',
        refs: [pl1, pl2],
        color: '#E06D1F',
        visible: true,
      });
      steps.push(`Đo góc giữa hai mặt phẳng (${mApp[1]}) và (${mApp[2]})`);
    }
  }

  // I. Skew line distance: "khoảng cách giữa AB và SC"
  const dSkewRe = /khoảng\s*cách\s*(?:giữa\s*)?(?:hai\s*đường\s*thẳng\s*)?([A-Z0-9']{2,4})\s*(?:và|với)\s*([A-Z0-9']{2,4})/gi;
  let mSk: RegExpExecArray | null;
  while ((mSk = dSkewRe.exec(text)) !== null) {
    const pA = parseVertexPairToken(mSk[1], known());
    const pB = parseVertexPairToken(mSk[2], known());
    if (pA && pB) {
      const s1 = makeUid('s3', uid);
      const s2 = makeUid('s3', uid);
      scene3d.segments.push(
        { id: s1, name: `${pA[0]}${pA[1]}`, p1Id: ptIdByName.get(pA[0])!, p2Id: ptIdByName.get(pA[1])!, color: '#1D5CE5', style: 'solid', visible: true },
        { id: s2, name: `${pB[0]}${pB[1]}`, p1Id: ptIdByName.get(pB[0])!, p2Id: ptIdByName.get(pB[1])!, color: '#0E9F6E', style: 'solid', visible: true }
      );
      scene3d.measurements.push({
        id: makeUid('m3', uid),
        name: `d(${mSk[1]}, ${mSk[2]})`,
        kind: 'distanceSkew',
        refs: [s1, s2],
        color: '#7C3AED',
        visible: true,
      });
      steps.push(`Dựng đoạn vuông góc chung & đo khoảng cách giữa ${mSk[1]} và ${mSk[2]}`);
    }
  }

  return {
    title: 'Hình học Không gian THPT',
    category: 'space_geometry',
    mode: '3d',
    showAxes: false,
    summary: steps[0] || 'Đã phân tích và dựng mô hình 3D theo đề bài.',
    steps,
    snapshot: { sliders: [], scene2d, scene3d },
  };
}

// ==================== BRANCH 3: 2D FUNCTIONS, 3D SURFACES & OXY PLANE ====================

function solve2DOrFunctionProblem(text: string, uid: { n: number }): ProblemDrawResult {
  const scene2d = emptyScene2d();
  const scene3d = emptyScene3d();
  const sliders: ProblemDrawResult['snapshot']['sliders'] = [];
  const steps: string[] = [];
  const folded = foldVi(text);

  // 1. Check for 3D surface z = f(x, y)
  const surfMatch = text.match(/\bz\s*=\s*([0-9a-zA-Z+\-*/^().\s]+?)(?=[,;]|$|\s+(?:với|trên|trong|khi|và\s+(?:tính|tìm)))/i);
  if (surfMatch && /[xy]/.test(surfMatch[1])) {
    const expr = surfMatch[1].trim();
    scene3d.surfaces.push({
      id: makeUid('sf', uid),
      name: `z = ${expr}`,
      expr,
      range: [-3.5, 3.5],
      color: '#1D5CE5',
      opacity: 0.78,
      wireframe: true,
      visible: true,
    });
    steps.push(`Vẽ mặt cong không gian z = ${expr}`);
    return {
      title: 'Mặt cong Hàm số z = f(x, y)',
      category: 'oxyz',
      mode: '3d',
      showAxes: true,
      summary: steps[0],
      steps,
      snapshot: { sliders, scene2d, scene3d },
    };
  }

  // 2. Extract 2D functions y = f(x) or f(x) = ...
  const fnRe = /(?:y|[fgh]\s*\(\s*x\s*\))\s*=\s*([0-9a-zA-Z+\-*/^().√|\s]+?)(?=[,.;]|$|\s+(?:trên|từ|với|và\s+(?:y|trục|tìm|tính|x|cắt)|giới\s*hạn|quay|tại))/gi;
  let mFn: RegExpExecArray | null;
  let intBounds: [number, number] | null = null;
  const boundMatch =
    text.match(/(?:trên\s*đoạn|trên)\s*\[\s*([+-]?\d+(?:\.\d+)?)\s*[;,]\s*([+-]?\d+(?:\.\d+)?)\s*\]/i) ||
    text.match(/từ\s*x\s*=\s*([+-]?\d+(?:\.\d+)?)\s*(?:đến|tới)\s*x\s*=\s*([+-]?\d+(?:\.\d+)?)/i) ||
    text.match(/x\s*=\s*([+-]?\d+(?:\.\d+)?)\s*(?:,|và)\s*x\s*=\s*([+-]?\d+(?:\.\d+)?)/i);
  if (boundMatch) {
    const a = parseFloat(boundMatch[1]);
    const b = parseFloat(boundMatch[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(b - a) > 1e-6) {
      intBounds = [a, b];
    }
  } else if (folded.includes('tich phan') || folded.includes('dien tich hinh phang') || folded.includes('quay quanh')) {
    intBounds = [0, 2];
  }

  const tangentMatch = text.match(/(?:tiếp\s*tuyến|hoành\s*độ)[^0-9\-+]*?x[₀0]?\s*=\s*([+-]?\d+(?:\.\d+)?)/i);
  const tangentX0 = tangentMatch ? parseFloat(tangentMatch[1]) : null;
  const wantRevolve = folded.includes('quay quanh ox') || folded.includes('quay quanh truc ox') || folded.includes('tron xoay');

  while ((mFn = fnRe.exec(text)) !== null) {
    const rawExpr = mFn[1].trim();
    if (!rawExpr || !/[x0-9]/.test(rawExpr)) continue;
    // Detect parameter m
    if (/\bm\b/.test(rawExpr) && !sliders.some((s) => s.name === 'm')) {
      sliders.push({ id: makeUid('sl', uid), name: 'm', value: 1, min: -5, max: 5, step: 0.1, playing: false });
      steps.push('Tự động tạo tham số động m ∈ [-5; 5]');
    }
    const fnColor = PALETTE[scene2d.functions.length % PALETTE.length];
    scene2d.functions.push({
      id: makeUid('fn', uid),
      name: `y = ${rawExpr}`,
      expr: rawExpr,
      color: fnColor,
      visible: true,
      showExtrema: true,
      showAsymptotes: true,
      showRoots: true,
      ...(intBounds && scene2d.functions.length === 0
        ? { integral: { enabled: true, a: intBounds[0], b: intBounds[1], revolve3D: wantRevolve } }
        : {}),
      ...(tangentX0 !== null && scene2d.functions.length === 0
        ? { tangent: { enabled: true, x0: tangentX0 } }
        : {}),
    });
    steps.push(`Vẽ đồ thị y = ${rawExpr} (tự đánh dấu cực trị, tiệm cận, giao điểm)`);

    if (wantRevolve && scene2d.functions.length === 1 && intBounds) {
      scene3d.solids.push({
        id: makeUid('rev', uid),
        name: `Khối tròn xoay y = ${rawExpr} [${intBounds[0]}; ${intBounds[1]}]`,
        kind: 'revolution',
        center: [0, 0, 0],
        radius: 1,
        funcExpr: rawExpr,
        domain: intBounds,
        color: fnColor,
        opacity: 0.42,
        showAxes: true,
        visible: true,
      });
      steps.push(`Quay quanh trục Ox trên [${intBounds[0]}; ${intBounds[1]}] sang khung 3D`);
    }
  }

  // 3. Extract 2D inequalities: ax + by <= c
  const iqRe = /([0-9xXyY+\-*/.\s]+?)\s*(<=|>=|<|>)\s*([+-]?\d+(?:\.\d+)?)/g;
  let mIq: RegExpExecArray | null;
  while ((mIq = iqRe.exec(text)) !== null) {
    if (!/[xy]/i.test(mIq[1])) continue;
    const eq = parseLine2DLinear(`(${mIq[1]}) - (${mIq[3]})`);
    if (eq) {
      scene2d.inequalities.push({
        id: makeUid('iq', uid),
        name: `${mIq[1].trim()} ${mIq[2]} ${mIq[3]}`,
        a: eq.a,
        b: eq.b,
        c: -eq.c,
        op: mIq[2] as '<=' | '<' | '>=' | '>',
        color: PALETTE[scene2d.inequalities.length % PALETTE.length],
        visible: true,
      });
      steps.push(`Vẽ miền nghiệm bất phương trình ${mIq[1].trim()} ${mIq[2]} ${mIq[3]}`);
    }
  }

  // 4. Extract 2D points: A(1; 2)
  const pt2Re = /\b([A-Z][0-9']?)\s*(?:=\s*)?\(\s*([+-]?\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*[;,]\s*([+-]?\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*\)/g;
  let mPt2: RegExpExecArray | null;
  const pts2Ids: string[] = [];
  while ((mPt2 = pt2Re.exec(text)) !== null) {
    const x = evalSimpleNumeric(mPt2[2]);
    const y = evalSimpleNumeric(mPt2[3]);
    if (x !== null && y !== null) {
      const id = makeUid('p2', uid);
      scene2d.points.push({ id, name: mPt2[1], x: round2(x), y: round2(y), color: '#D93829', visible: true, showLabel: true });
      pts2Ids.push(id);
      steps.push(`Đặt điểm ${mPt2[1]}(${round2(x)}; ${round2(y)})`);
    }
  }

  if (pts2Ids.length >= 3 && (folded.includes('tam giac') || folded.includes('da giac'))) {
    scene2d.polygons.push({
      id: makeUid('pg2', uid),
      name: 'Đa giác',
      pointIds: pts2Ids,
      color: '#1D5CE5',
      fillOpacity: 0.14,
      visible: true,
      showArea: true,
    });
    steps.push(`Nối đa giác qua ${pts2Ids.length} đỉnh đã cho`);
  }

  return {
    title: scene2d.functions.length > 0 ? 'Khảo sát Hàm số & Giải tích 12' : 'Hình học Phẳng Oxy',
    category: scene2d.functions.length > 0 ? 'function_2d' : 'plane_2d',
    mode: wantRevolve && scene3d.solids.length > 0 ? 'split' : '2d',
    showAxes: true,
    summary: steps[0] || 'Đã vẽ hệ tọa độ và biểu thức từ đề bài.',
    steps,
    snapshot: { sliders, scene2d, scene3d },
  };
}

// ==================== MAIN ENTRYPOINT ====================

export function solveVietnameseMathProblem(rawText: string): ProblemDrawResult {
  const text = preprocessProblemText(rawText);
  if (!text) {
    throw new Error('Vui lòng nhập nội dung đề bài.');
  }

  const uid = { n: 10 };
  const folded = foldVi(text);

  // Detect 3D coordinate triples like A(1; 0; 2)
  const has3DPtTriple = /\(\s*[^;(),]+?\s*[;,]\s*[^;(),]+?\s*[;,]\s*[^;(),]+?\s*\)/.test(text);
  const hasZVar = /\bz\b/i.test(text);
  const isOxyz =
    folded.includes('oxyz') ||
    has3DPtTriple ||
    (hasZVar && (folded.includes('mat phang') || folded.includes('mat cau') || folded.includes('duong thang') || /\/\s*[+-]?\d+\s*=/.test(text)));

  if (isOxyz) {
    return solveOxyzProblem(text, uid);
  }

  const isSpaceGeo = /(?:chóp|chop|tứ\s*diện|tu\s*dien|lăng\s*trụ|lang\s*tru|lập\s*phương|lap\s*phuong|hình\s*hộp|hinh\s*hop|hình\s*nón|hinh\s*non|hình\s*trụ|hinh\s*tru|mặt\s*cầu|mat\s*cau)/.test(
    folded
  );
  if (isSpaceGeo) {
    return solveSpaceGeometryProblem(text, uid);
  }

  return solve2DOrFunctionProblem(text, uid);
}
