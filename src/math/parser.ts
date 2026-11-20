import type { Vec2, Vec3 } from '../types/geometry';

// ==================== TOKENIZER & AST EVALUATOR ====================

type Token =
  | { type: 'num'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' }
  | { type: 'pipe' };

const BUILTIN_FUNCS = new Set([
  'sin',
  'cos',
  'tan',
  'cot',
  'asin',
  'acos',
  'atan',
  'sinh',
  'cosh',
  'tanh',
  'sqrt',
  'cbrt',
  'abs',
  'ln',
  'log',
  'lg',
  'exp',
  'floor',
  'ceil',
  'round',
  'sign',
  'min',
  'max',
]);

const BUILTIN_CONSTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

/**
 * Normalize Vietnamese / Unicode math characters into clean ASCII expressions.
 * Supports: ² ³ √ π − × · ÷ , |...|
 */
export function normalizeMathText(raw: string): string {
  let s = raw.trim();
  s = s
    .replace(/−|–|—/g, '-')
    .replace(/×|·|⋅/g, '*')
    .replace(/÷/g, '/')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/⁴/g, '^4')
    .replace(/π/g, 'pi')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/√\s*\(/g, 'sqrt(')
    .replace(/√\s*([a-zA-Z0-9_.]+)/g, 'sqrt($1)');
  return s;
}

function tokenize(input: string): Token[] {
  const s = normalizeMathText(input);
  const rawTokens: Token[] = [];
  let i = 0;

  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      let hasDot = false;
      while (j < s.length && (/[0-9]/.test(s[j]) || (s[j] === '.' && !hasDot))) {
        if (s[j] === '.') hasDot = true;
        j++;
      }
      // Scientific notation e.g. 1e-5
      if (j < s.length && (s[j] === 'e' || s[j] === 'E')) {
        const next = s[j + 1];
        if (next && (/[0-9]/.test(next) || ((next === '+' || next === '-') && /[0-9]/.test(s[j + 2] ?? '')))) {
          j++;
          if (s[j] === '+' || s[j] === '-') j++;
          while (j < s.length && /[0-9]/.test(s[j])) j++;
        }
      }
      const val = parseFloat(s.slice(i, j));
      if (!Number.isFinite(val)) throw new Error(`Số không hợp lệ: ${s.slice(i, j)}`);
      rawTokens.push({ type: 'num', value: val });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) j++;
      const word = s.slice(i, j);
      const lower = word.toLowerCase();
      if (BUILTIN_FUNCS.has(lower) || lower in BUILTIN_CONSTS) {
        rawTokens.push({ type: 'ident', value: lower });
      } else if (word.length > 1 && /^[a-zA-Z]+$/.test(word)) {
        // Split implicit product like "mx" -> "m" * "x", or "xy" -> "x" * "y"
        // unless it ends with a known function like "msin"
        let k = 0;
        while (k < word.length) {
          const rest = word.slice(k).toLowerCase();
          let matchedFunc: string | null = null;
          for (const fn of BUILTIN_FUNCS) {
            if (rest.startsWith(fn) && (k + fn.length === word.length || s[j] === '(')) {
              matchedFunc = fn;
              break;
            }
          }
          if (matchedFunc) {
            rawTokens.push({ type: 'ident', value: matchedFunc });
            k += matchedFunc.length;
          } else if (rest.startsWith('pi')) {
            rawTokens.push({ type: 'ident', value: 'pi' });
            k += 2;
          } else {
            rawTokens.push({ type: 'ident', value: word[k] });
            k += 1;
          }
        }
      } else {
        rawTokens.push({ type: 'ident', value: word });
      }
      i = j;
      continue;
    }
    if ('+-*/^'.includes(ch)) {
      rawTokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    if (ch === '(' || ch === '[') {
      rawTokens.push({ type: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')' || ch === ']') {
      rawTokens.push({ type: 'rparen' });
      i++;
      continue;
    }
    if (ch === ',') {
      rawTokens.push({ type: 'comma' });
      i++;
      continue;
    }
    if (ch === '|') {
      rawTokens.push({ type: 'pipe' });
      i++;
      continue;
    }
    throw new Error(`Ký tự không hợp lệ trong biểu thức: "${ch}"`);
  }

  // Insert implicit multiplication:
  // num ident -> num * ident (2x -> 2 * x)
  // num lparen -> num * lparen (2(x+1) -> 2 * (x+1))
  // rparen num/ident/lparen -> *
  // ident(non-func) lparen -> ident * lparen
  // ident(non-func) ident -> ident * ident (m x -> m * x)
  const tokens: Token[] = [];
  for (let idx = 0; idx < rawTokens.length; idx++) {
    const cur = rawTokens[idx];
    const prev = tokens[tokens.length - 1];
    if (prev) {
      const prevIsValue =
        prev.type === 'num' ||
        prev.type === 'rparen' ||
        (prev.type === 'ident' && !BUILTIN_FUNCS.has(prev.value));
      const curStartsValue =
        cur.type === 'num' || cur.type === 'ident' || cur.type === 'lparen';
      if (prevIsValue && curStartsValue) {
        tokens.push({ type: 'op', value: '*' });
      }
    }
    tokens.push(cur);
  }

  return tokens;
}

type AstNode =
  | { kind: 'num'; value: number }
  | { kind: 'var'; name: string }
  | { kind: 'unary'; op: '+' | '-'; arg: AstNode }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: AstNode; right: AstNode }
  | { kind: 'call'; name: string; args: AstNode[] };

export interface CompiledExpr {
  ast: AstNode;
  variables: string[];
  eval: (scope: Record<string, number>) => number;
}

const exprCache = new Map<string, CompiledExpr>();

export function compileExpression(expr: string): CompiledExpr {
  const key = expr.trim();
  const cached = exprCache.get(key);
  if (cached) return cached;

  const tokens = tokenize(key);
  let pos = 0;
  const vars = new Set<string>();

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseExpression(): AstNode {
    return parseAddSub();
  }

  function parseAddSub(): AstNode {
    let left = parseMulDiv();
    while (peek()?.type === 'op' && (peek() as { value: string }).value.match(/^[+-]$/)) {
      const op = (consume() as { type: 'op'; value: '+' | '-' }).value;
      const right = parseMulDiv();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  function parseMulDiv(): AstNode {
    let left = parseUnary();
    while (peek()?.type === 'op' && (peek() as { value: string }).value.match(/^[*/]$/)) {
      const op = (consume() as { type: 'op'; value: '*' | '/' }).value;
      const right = parseUnary();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  function parseUnary(): AstNode {
    if (peek()?.type === 'op' && ((peek() as { value: string }).value === '-' || (peek() as { value: string }).value === '+')) {
      const op = (consume() as { type: 'op'; value: '+' | '-' }).value;
      return { kind: 'unary', op, arg: parseUnary() };
    }
    return parsePower();
  }

  function parsePower(): AstNode {
    let base = parsePrimary();
    if (peek()?.type === 'op' && (peek() as { value: string }).value === '^') {
      consume();
      // Right-associative: -x^2 is handled as -(x^2) because unary wraps power,
      // and 2^3^2 = 2^(3^2), and x^-2 works via parseUnary!
      const exponent = parseUnary();
      base = { kind: 'binary', op: '^', left: base, right: exponent };
    }
    return base;
  }

  function parsePrimary(): AstNode {
    const t = peek();
    if (!t) throw new Error('Thiếu toán hạng trong biểu thức');

    if (t.type === 'num') {
      consume();
      return { kind: 'num', value: t.value };
    }

    if (t.type === 'ident') {
      consume();
      if (BUILTIN_FUNCS.has(t.value)) {
        if (peek()?.type === 'lparen') {
          consume();
          const args: AstNode[] = [];
          if (peek()?.type !== 'rparen') {
            args.push(parseExpression());
            while (peek()?.type === 'comma') {
              consume();
              args.push(parseExpression());
            }
          }
          if (peek()?.type !== 'rparen') throw new Error(`Thiếu dấu ")" cho hàm ${t.value}`);
          consume();
          return { kind: 'call', name: t.value, args };
        }
        // Allow shorthand like sin x
        return { kind: 'call', name: t.value, args: [parsePower()] };
      }
      if (t.value in BUILTIN_CONSTS) {
        return { kind: 'num', value: BUILTIN_CONSTS[t.value] };
      }
      vars.add(t.value);
      return { kind: 'var', name: t.value };
    }

    if (t.type === 'lparen') {
      consume();
      const inner = parseExpression();
      if (peek()?.type !== 'rparen') throw new Error('Thiếu dấu ngoặc đóng ")"');
      consume();
      return inner;
    }

    if (t.type === 'pipe') {
      consume();
      const inner = parseExpression();
      if (peek()?.type !== 'pipe') throw new Error('Thiếu dấu "|" đóng trị tuyệt đối');
      consume();
      return { kind: 'call', name: 'abs', args: [inner] };
    }

    throw new Error('Cú pháp biểu thức toán không hợp lệ');
  }

  const ast = parseExpression();
  if (pos < tokens.length) {
    throw new Error('Dư ký tự ở cuối biểu thức');
  }

  function evaluateNode(node: AstNode, scope: Record<string, number>): number {
    switch (node.kind) {
      case 'num':
        return node.value;
      case 'var': {
        const v = scope[node.name];
        return v !== undefined ? v : NaN;
      }
      case 'unary': {
        const a = evaluateNode(node.arg, scope);
        return node.op === '-' ? -a : a;
      }
      case 'binary': {
        const l = evaluateNode(node.left, scope);
        const r = evaluateNode(node.right, scope);
        switch (node.op) {
          case '+':
            return l + r;
          case '-':
            return l - r;
          case '*':
            return l * r;
          case '/':
            return r === 0 ? NaN : l / r;
          case '^':
            // Real cube root support for negative base when exponent is 1/3 etc.
            if (l < 0 && Math.abs(r - 1 / 3) < 1e-9) return -Math.pow(-l, r);
            return Math.pow(l, r);
        }
      }
      case 'call': {
        const a0 = node.args[0] ? evaluateNode(node.args[0], scope) : NaN;
        const a1 = node.args[1] ? evaluateNode(node.args[1], scope) : NaN;
        switch (node.name) {
          case 'sin':
            return Math.sin(a0);
          case 'cos':
            return Math.cos(a0);
          case 'tan':
            return Math.tan(a0);
          case 'cot': {
            const t = Math.tan(a0);
            return Math.abs(t) < 1e-12 ? NaN : 1 / t;
          }
          case 'asin':
            return Math.asin(a0);
          case 'acos':
            return Math.acos(a0);
          case 'atan':
            return Math.atan(a0);
          case 'sinh':
            return Math.sinh(a0);
          case 'cosh':
            return Math.cosh(a0);
          case 'tanh':
            return Math.tanh(a0);
          case 'sqrt':
            return a0 < 0 ? NaN : Math.sqrt(a0);
          case 'cbrt':
            return Math.cbrt(a0);
          case 'abs':
            return Math.abs(a0);
          case 'ln':
            return a0 <= 0 ? NaN : Math.log(a0);
          case 'log':
          case 'lg':
            return a0 <= 0 ? NaN : Math.log10(a0);
          case 'exp':
            return Math.exp(a0);
          case 'floor':
            return Math.floor(a0);
          case 'ceil':
            return Math.ceil(a0);
          case 'round':
            return Math.round(a0);
          case 'sign':
            return Math.sign(a0);
          case 'min':
            return Math.min(a0, a1);
          case 'max':
            return Math.max(a0, a1);
          default:
            return NaN;
        }
      }
    }
  }

  const compiled: CompiledExpr = {
    ast,
    variables: Array.from(vars),
    eval: (scope) => evaluateNode(ast, scope),
  };

  if (exprCache.size > 400) exprCache.clear();
  exprCache.set(key, compiled);
  return compiled;
}

export function safeEval(expr: string, scope: Record<string, number> = {}): number {
  try {
    return compileExpression(expr).eval(scope);
  } catch {
    return NaN;
  }
}

export function extractParameters(expr: string, exclude: string[] = ['x', 'y', 'z']): string[] {
  try {
    const c = compileExpression(expr);
    const excl = new Set(exclude);
    return c.variables.filter((v) => !excl.has(v));
  } catch {
    return [];
  }
}

// ==================== SMART COMMAND & EQUATION PARSER ====================

export type ParsedMathCommand =
  | { kind: 'point2d'; name?: string; coords: Vec2 }
  | { kind: 'point3d'; name?: string; coords: Vec3; exprCoords?: [string, string, string] }
  | { kind: 'vector2d'; name?: string; dir: Vec2 }
  | { kind: 'vector3d'; name?: string; dir: Vec3 }
  | { kind: 'function2d'; name?: string; expr: string; params: string[] }
  | { kind: 'surface3d'; name?: string; expr: string; params: string[] }
  | { kind: 'line2d'; name?: string; a: number; b: number; c: number }
  | { kind: 'inequality2d'; name?: string; a: number; b: number; c: number; op: '<=' | '<' | '>=' | '>' }
  | { kind: 'plane3d'; name?: string; a: number; b: number; c: number; d: number }
  | { kind: 'line3d'; name?: string; point: Vec3; dir: Vec3 }
  | { kind: 'circle2d'; name?: string; center: Vec2; radius: number }
  | { kind: 'sphere3d'; name?: string; center: Vec3; radius: number }
  | { kind: 'conic2d'; name?: string; conicType: 'ellipse' | 'hyperbola' | 'parabola'; h: number; k: number; a: number; b: number; p?: number }
  | { kind: 'slider'; name: string; value: number }
  | { kind: 'viCommand'; action: 'midpoint' | 'plane' | 'distance' | 'vector' | 'segment' | 'crossSection'; targets: string[] };

/**
 * Compute linear/quadratic coefficients of F(x,y,z) = lhs - rhs numerically using exact finite probes.
 * Works reliably on ANY algebraically written equation:
 * e.g. "2x - y + 3z - 6 = 0", "x + 2y = 5", "(x-1)^2 + (y+2)^2 + (z-1)^2 = 9",
 * "x^2 + y^2 + z^2 - 2x + 4y - 2z - 3 = 0", "x^2/25 + y^2/9 = 1"
 */
function probePolynomial3(expr: string, scope: Record<string, number>) {
  const f = compileExpression(expr);
  const ev = (x: number, y: number, z: number) => f.eval({ ...scope, x, y, z });

  const f0 = ev(0, 0, 0);
  const fx1 = ev(1, 0, 0);
  const fxm1 = ev(-1, 0, 0);
  const fy1 = ev(0, 1, 0);
  const fym1 = ev(0, -1, 0);
  const fz1 = ev(0, 0, 1);
  const fzm1 = ev(0, 0, -1);

  const cxx = (fx1 + fxm1 - 2 * f0) / 2;
  const cyy = (fy1 + fym1 - 2 * f0) / 2;
  const czz = (fz1 + fzm1 - 2 * f0) / 2;
  const cx = (fx1 - fxm1) / 2;
  const cy = (fy1 - fym1) / 2;
  const cz = (fz1 - fzm1) / 2;
  const c0 = f0;

  // Cross terms
  const cxy = ev(1, 1, 0) - fx1 - fy1 + f0;
  const cxz = ev(1, 0, 1) - fx1 - fz1 + f0;
  const cyz = ev(0, 1, 1) - fy1 - fz1 + f0;

  // Verify accuracy on 3 random points to ensure it's truly at most degree 2
  const testPts: Vec3[] = [
    [2.3, -1.7, 0.9],
    [-1.4, 2.8, -2.1],
    [0.7, 1.3, 3.1],
  ];
  let maxErr = 0;
  for (const [tx, ty, tz] of testPts) {
    const actual = ev(tx, ty, tz);
    const pred =
      cxx * tx * tx +
      cyy * ty * ty +
      czz * tz * tz +
      cxy * tx * ty +
      cxz * tx * tz +
      cyz * ty * tz +
      cx * tx +
      cy * ty +
      cz * tz +
      c0;
    maxErr = Math.max(maxErr, Math.abs(actual - pred));
  }

  return {
    isQuadraticOrLinear: Number.isFinite(maxErr) && maxErr < 1e-5,
    cxx,
    cyy,
    czz,
    cxy,
    cxz,
    cyz,
    cx,
    cy,
    cz,
    c0,
    hasZ: f.variables.includes('z'),
    hasY: f.variables.includes('y'),
    hasX: f.variables.includes('x'),
  };
}

/**
 * Parse natural Vietnamese/math input from the Smart Command Bar.
 */
export function parseSmartInput(
  rawInput: string,
  activeDomain: '2d' | '3d',
  sliderScope: Record<string, number> = {}
): ParsedMathCommand {
  const raw = rawInput.trim();
  if (!raw) throw new Error('Vui lòng nhập biểu thức, tọa độ hoặc phương trình');

  const norm = normalizeMathText(raw);
  const lower = norm.toLowerCase();

  // 1. Vietnamese natural commands: "trung điểm A, B", "mặt phẳng A, B, C", "khoảng cách A, B", "thiết diện M, N, P"
  const viCmdMatch = lower.match(
    /^(trung\s*(?:điểm|diem)|mặt\s*phẳng|mat\s*phang|khoảng\s*cách|khoang\s*cach|vectơ|vecto|vector|đoạn|doan|thiết\s*diện|thiet\s*dien)\s+(.+)$/i
  );
  if (viCmdMatch) {
    const keyword = viCmdMatch[1].replace(/\s+/g, ' ').trim();
    const targets = raw
      .slice(viCmdMatch[1].length)
      .split(/[,\s]+/)
      .map((s) => s.replace(/[()]/g, '').trim())
      .filter(Boolean);
    if (keyword.startsWith('trung')) return { kind: 'viCommand', action: 'midpoint', targets };
    if (keyword.startsWith('mặt') || keyword.startsWith('mat')) return { kind: 'viCommand', action: 'plane', targets };
    if (keyword.startsWith('khoảng') || keyword.startsWith('khoang')) return { kind: 'viCommand', action: 'distance', targets };
    if (keyword.startsWith('vect')) return { kind: 'viCommand', action: 'vector', targets };
    if (keyword.startsWith('đoạn') || keyword.startsWith('doan')) return { kind: 'viCommand', action: 'segment', targets };
    if (keyword.startsWith('thiết') || keyword.startsWith('thiet')) return { kind: 'viCommand', action: 'crossSection', targets };
  }

  // 2. Point / Vector shorthand: "A(1, 2, 3)", "A(1; 2; 3)", "A = (1; 2; 3)", "u = (1; -2; 3)", "(2; 3)"
  const ptMatch = norm.match(/^([A-Za-z][A-Za-z0-9_']*)?\s*=?\s*\((.+)\)$/);
  if (ptMatch) {
    const label = ptMatch[1]?.trim();
    const parts = ptMatch[2].split(/[,;]/).map((p) => p.trim());
    if (parts.length === 2 || parts.length === 3) {
      const vals = parts.map((p) => safeEval(p, sliderScope));
      if (vals.every((v) => Number.isFinite(v))) {
        const isLowerVec = label ? /^[a-z]/.test(label) : false;
        if (parts.length === 3) {
          if (isLowerVec) {
            return { kind: 'vector3d', name: label, dir: [vals[0], vals[1], vals[2]] };
          }
          const hasParams = parts.some((p) => extractParameters(p, []).length > 0);
          return {
            kind: 'point3d',
            name: label,
            coords: [vals[0], vals[1], vals[2]],
            exprCoords: hasParams ? [parts[0], parts[1], parts[2]] : undefined,
          };
        } else {
          if (isLowerVec) {
            return { kind: 'vector2d', name: label, dir: [vals[0], vals[1]] };
          }
          if (activeDomain === '3d' && !label) {
            return { kind: 'point2d', name: label, coords: [vals[0], vals[1]] };
          }
          return { kind: 'point2d', name: label, coords: [vals[0], vals[1]] };
        }
      }
    }
  }

  // 3. Canonical 3D line: "(x - 1)/2 = (y + 1)/-1 = z/3" or "d: (x-1)/2 = (y+1)/-1 = (z-2)/3"
  const line3dPrefix = norm.match(/^(?:([a-zA-Z][a-zA-Z0-9_']*)\s*:\s*)?(.+?)=(.+?)=(.+)$/);
  if (line3dPrefix) {
    const lineName = line3dPrefix[1];
    const segs = [line3dPrefix[2].trim(), line3dPrefix[3].trim(), line3dPrefix[4].trim()];
    const parsedSegs: Record<'x' | 'y' | 'z', { p0: number; dir: number }> = {
      x: { p0: 0, dir: 1 },
      y: { p0: 0, dir: 1 },
      z: { p0: 0, dir: 1 },
    };
    let validCanonical = true;
    for (const seg of segs) {
      // Evaluate seg as linear function of x, y, or z: (v - v0)/a = (1/a)*v - v0/a
      const vars = compileExpression(seg).variables.filter((v) => v === 'x' || v === 'y' || v === 'z');
      if (vars.length !== 1) {
        validCanonical = false;
        break;
      }
      const axis = vars[0] as 'x' | 'y' | 'z';
      const f = compileExpression(seg);
      const v0 = f.eval({ ...sliderScope, x: 0, y: 0, z: 0 });
      const v1 = f.eval({ ...sliderScope, x: axis === 'x' ? 1 : 0, y: axis === 'y' ? 1 : 0, z: axis === 'z' ? 1 : 0 });
      const slope = v1 - v0;
      if (!Number.isFinite(slope) || Math.abs(slope) < 1e-9) {
        validCanonical = false;
        break;
      }
      const dir = 1 / slope;
      const rawP0 = -v0 * dir;
      const p0 = Math.abs(rawP0) < 1e-12 ? 0 : rawP0;
      parsedSegs[axis] = { p0, dir };
    }
    if (validCanonical) {
      return {
        kind: 'line3d',
        name: lineName,
        point: [parsedSegs.x.p0, parsedSegs.y.p0, parsedSegs.z.p0],
        dir: [parsedSegs.x.dir, parsedSegs.y.dir, parsedSegs.z.dir],
      };
    }
  }

  // Optional label prefix like "(P): 2x - y + z = 3" or "d: x + y - 2 = 0"
  let explicitName: string | undefined;
  let body = norm;
  const colonMatch = norm.match(/^(\(?[A-Za-z][A-Za-z0-9_']*\)?)\s*:\s*(.+)$/);
  if (colonMatch) {
    explicitName = colonMatch[1].replace(/[()]/g, '');
    body = colonMatch[2].trim();
  }

  // 4. Linear Inequality 2D: "2x + y <= 4", "x - 2y > 1"
  const ineqMatch = body.match(/^(.+?)(<=|>=|<|>)(.+)$/);
  if (ineqMatch) {
    const lhs = ineqMatch[1].trim();
    const op = ineqMatch[2] as '<=' | '>=' | '<' | '>';
    const rhs = ineqMatch[3].trim();
    const p = probePolynomial3(`(${lhs}) - (${rhs})`, sliderScope);
    if (
      p.isQuadraticOrLinear &&
      Math.abs(p.cxx) < 1e-7 &&
      Math.abs(p.cyy) < 1e-7 &&
      Math.abs(p.czz) < 1e-7 &&
      Math.abs(p.cxy) < 1e-7 &&
      (Math.abs(p.cx) > 1e-7 || Math.abs(p.cy) > 1e-7)
    ) {
      // cx*x + cy*y + c0 <op> 0  ==>  cx*x + cy*y <op> -c0
      return {
        kind: 'inequality2d',
        name: explicitName,
        a: p.cx,
        b: p.cy,
        c: -p.c0,
        op,
      };
    }
    throw new Error('Bất phương trình cần có dạng bậc nhất hai ẩn ax + by ≤ c');
  }

  // 5. Slider assignment: "m = 2"
  const sliderMatch = body.match(/^([a-zA-Z])\s*=\s*([+-]?\d+(?:\.\d+)?)$/);
  if (sliderMatch && !['x', 'y', 'z'].includes(sliderMatch[1].toLowerCase())) {
    return {
      kind: 'slider',
      name: sliderMatch[1],
      value: parseFloat(sliderMatch[2]),
    };
  }

  // 6. Explicit function y = f(x) or f(x) = ...
  const fn2dMatch = body.match(/^(?:y|([a-zA-Z])\s*\(\s*x\s*\))\s*=\s*(.+)$/);
  if (fn2dMatch) {
    const fnName = explicitName ?? fn2dMatch[1];
    const rhs = fn2dMatch[2].trim();
    const vars = compileExpression(rhs).variables;
    if (!vars.includes('y') && !vars.includes('z')) {
      return {
        kind: 'function2d',
        name: fnName,
        expr: rhs,
        params: extractParameters(rhs, ['x']),
      };
    }
  }

  // 7. Explicit 3D surface z = f(x, y)
  const surfMatch = body.match(/^z\s*=\s*(.+)$/);
  if (surfMatch) {
    const rhs = surfMatch[1].trim();
    const vars = compileExpression(rhs).variables;
    if (!vars.includes('z')) {
      // Check if it's actually a plane (linear in x, y)
      const p = probePolynomial3(`z - (${rhs})`, sliderScope);
      if (
        p.isQuadraticOrLinear &&
        Math.abs(p.cxx) < 1e-7 &&
        Math.abs(p.cyy) < 1e-7 &&
        Math.abs(p.cxy) < 1e-7
      ) {
        return {
          kind: 'plane3d',
          name: explicitName,
          a: p.cx,
          b: p.cy,
          c: p.cz,
          d: p.c0,
        };
      }
      return {
        kind: 'surface3d',
        name: explicitName,
        expr: rhs,
        params: extractParameters(rhs, ['x', 'y']),
      };
    }
  }

  // 8. Implicit equations: LHS = RHS
  const eqParts = body.split('=');
  if (eqParts.length === 2) {
    const lhs = eqParts[0].trim();
    const rhs = eqParts[1].trim();
    const diffExpr = `(${lhs}) - (${rhs})`;
    const p = probePolynomial3(diffExpr, sliderScope);

    if (p.isQuadraticOrLinear) {
      const hasQuad =
        Math.abs(p.cxx) > 1e-7 ||
        Math.abs(p.cyy) > 1e-7 ||
        Math.abs(p.czz) > 1e-7 ||
        Math.abs(p.cxy) > 1e-7;

      // 8a. Linear equation: Line 2D or Plane 3D
      if (!hasQuad) {
        if (p.hasZ || activeDomain === '3d') {
          if (Math.abs(p.cx) > 1e-7 || Math.abs(p.cy) > 1e-7 || Math.abs(p.cz) > 1e-7) {
            return {
              kind: 'plane3d',
              name: explicitName,
              a: p.cx,
              b: p.cy,
              c: p.cz,
              d: p.c0,
            };
          }
        } else {
          if (Math.abs(p.cx) > 1e-7 || Math.abs(p.cy) > 1e-7) {
            return {
              kind: 'line2d',
              name: explicitName,
              a: p.cx,
              b: p.cy,
              c: p.c0,
            };
          }
        }
      }

      // 8b. Sphere 3D: cxx == cyy == czz != 0, no cross terms
      if (
        Math.abs(p.cxx) > 1e-7 &&
        Math.abs(p.cxx - p.cyy) < 1e-5 &&
        Math.abs(p.cxx - p.czz) < 1e-5 &&
        Math.abs(p.cxy) < 1e-6 &&
        Math.abs(p.cxz) < 1e-6 &&
        Math.abs(p.cyz) < 1e-6
      ) {
        const k = p.cxx;
        const h = -p.cx / (2 * k);
        const m = -p.cy / (2 * k);
        const l = -p.cz / (2 * k);
        const r2 = h * h + m * m + l * l - p.c0 / k;
        if (r2 > 1e-7) {
          return {
            kind: 'sphere3d',
            name: explicitName,
            center: [h, m, l],
            radius: Math.sqrt(r2),
          };
        }
        throw new Error('Phương trình mặt cầu có bán kính không dương (R² ≤ 0)');
      }

      // 8c. Circle 2D: cxx == cyy != 0, czz == 0
      if (
        !p.hasZ &&
        Math.abs(p.cxx) > 1e-7 &&
        Math.abs(p.cxx - p.cyy) < 1e-5 &&
        Math.abs(p.cxy) < 1e-6
      ) {
        const k = p.cxx;
        const h = -p.cx / (2 * k);
        const m = -p.cy / (2 * k);
        const r2 = h * h + m * m - p.c0 / k;
        if (r2 > 1e-7) {
          return {
            kind: 'circle2d',
            name: explicitName,
            center: [h, m],
            radius: Math.sqrt(r2),
          };
        }
        throw new Error('Phương trình đường tròn có bán kính không dương (R² ≤ 0)');
      }

      // 8d. Ellipse / Hyperbola 2D: cxx != 0, cyy != 0, czz == 0, cxy == 0
      if (!p.hasZ && Math.abs(p.cxx) > 1e-7 && Math.abs(p.cyy) > 1e-7 && Math.abs(p.cxy) < 1e-6) {
        const h = -p.cx / (2 * p.cxx);
        const k = -p.cy / (2 * p.cyy);
        const rhsVal = p.cxx * h * h + p.cyy * k * k - p.c0;
        if (Math.abs(rhsVal) > 1e-7) {
          const A2 = rhsVal / p.cxx;
          const B2 = rhsVal / p.cyy;
          if (A2 > 0 && B2 > 0) {
            return {
              kind: 'conic2d',
              name: explicitName,
              conicType: 'ellipse',
              h,
              k,
              a: Math.sqrt(A2),
              b: Math.sqrt(B2),
            };
          }
          if (A2 > 0 && B2 < 0) {
            return {
              kind: 'conic2d',
              name: explicitName,
              conicType: 'hyperbola',
              h,
              k,
              a: Math.sqrt(A2),
              b: Math.sqrt(-B2),
            };
          }
        }
      }

      // 8e. Parabola y^2 = 2px: cyy != 0, cxx == 0, cx != 0
      if (!p.hasZ && Math.abs(p.cyy) > 1e-7 && Math.abs(p.cxx) < 1e-7 && Math.abs(p.cx) > 1e-7) {
        const k = -p.cy / (2 * p.cyy);
        // cyy*(y - k)^2 + cx*x + c0 - cyy*k^2 = 0 => (y - k)^2 = -(cx/cyy)*(x - h)
        const twoP = -p.cx / p.cyy;
        const h = (p.cyy * k * k - p.c0) / p.cx;
        return {
          kind: 'conic2d',
          name: explicitName,
          conicType: 'parabola',
          h,
          k,
          a: Math.abs(twoP) / 2,
          b: 1,
          p: twoP / 2,
        };
      }
    }
  }

  // 9. Bare expression without "=": treat as function of x (2D) or z = f(x, y) (3D)
  const compiled = compileExpression(body);
  if (compiled.variables.includes('y') && !compiled.variables.includes('z')) {
    return {
      kind: 'surface3d',
      name: explicitName,
      expr: body,
      params: extractParameters(body, ['x', 'y']),
    };
  }
  return {
    kind: 'function2d',
    name: explicitName,
    expr: body,
    params: extractParameters(body, ['x']),
  };
}
