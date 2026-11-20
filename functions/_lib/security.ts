export interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface AuthEnv {
  PROBLEM_LOCK_SALT?: string;
  PROBLEM_LOCK_HASH?: string;
  SESSION_HMAC_SECRET?: string;
  RATE_LIMIT_SALT?: string;
  AUTH_LOCK_KV?: KVNamespaceLike;
}

export interface PagesContext<Env = AuthEnv> {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
  waitUntil(promise: Promise<unknown>): void;
  next(input?: Request | string, init?: RequestInit): Promise<Response>;
  data: Record<string, unknown>;
}

export const SESSION_COOKIE_NAME = 'hhv_prob_sess';
const PBKDF2_ITERATIONS = 100_000;
const SESSION_TTL_SECONDS = 8 * 3600;

export const SECURITY_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Type': 'application/json; charset=utf-8',
};

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      ...extraHeaders,
    },
  });
}

export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const clean = hex.trim().toLowerCase();
  if (clean.length % 2 !== 0 || !/^[0-9a-f]*$/.test(clean)) {
    return new Uint8Array(new ArrayBuffer(0));
  }
  const out = new Uint8Array(new ArrayBuffer(clean.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, '0');
  }
  return s;
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlDecode(str: string): Uint8Array<ArrayBuffer> | null {
  try {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
    const bin = atob(padded);
    const out = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLen; i++) {
    const av = i < a.length ? a[i] : 0;
    const bv = i < b.length ? b[i] : 0;
    diff |= av ^ bv;
  }
  return diff === 0 && a.length > 0;
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

export async function derivePasscodeHashHex(passcode: string, saltHex: string): Promise<string> {
  const saltBytes = hexToBytes(saltHex);
  if (saltBytes.length < 16) {
    throw new Error('Invalid salt');
  }
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passcode),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(derivedBits));
}

export async function verifyPasscode(input: string, env: AuthEnv): Promise<boolean> {
  if (
    !env.PROBLEM_LOCK_SALT ||
    !env.PROBLEM_LOCK_HASH ||
    typeof input !== 'string' ||
    input.length === 0 ||
    input.length > 128
  ) {
    return false;
  }
  try {
    const derivedHex = await derivePasscodeHashHex(input, env.PROBLEM_LOCK_SALT);
    const derivedBytes = hexToBytes(derivedHex);
    const expectedBytes = hexToBytes(env.PROBLEM_LOCK_HASH);
    return constantTimeEqual(derivedBytes, expectedBytes);
  } catch {
    return false;
  }
}

function getClientIp(request: Request): string {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return 'unknown';
}

interface IpRateRecord {
  count: number;
  lockedUntil: number;
}

interface GlobalRateRecord {
  count: number;
  windowStart: number;
}

export async function checkRateLimit(
  request: Request,
  env: AuthEnv
): Promise<{ allowed: true } | { allowed: false; retryAfterSec: number; reason: 'ip_locked' | 'global_cooldown' }> {
  if (!env.AUTH_LOCK_KV) return { allowed: true };
  const now = Date.now();
  const rlSalt = env.RATE_LIMIT_SALT || env.PROBLEM_LOCK_SALT || 'fallback-rl-salt';
  const ipHash = await sha256Hex(`${rlSalt}:${getClientIp(request)}`);
  const ipKey = `rl:ip:${ipHash}`;

  try {
    const rawIp = await env.AUTH_LOCK_KV.get(ipKey);
    if (rawIp) {
      const rec = JSON.parse(rawIp) as IpRateRecord;
      if (rec.lockedUntil && rec.lockedUntil > now) {
        return {
          allowed: false,
          retryAfterSec: Math.max(1, Math.ceil((rec.lockedUntil - now) / 1000)),
          reason: 'ip_locked',
        };
      }
    }

    const rawGlobal = await env.AUTH_LOCK_KV.get('rl:global');
    if (rawGlobal) {
      const g = JSON.parse(rawGlobal) as GlobalRateRecord;
      if (now - g.windowStart < 600_000 && g.count >= 25) {
        return {
          allowed: false,
          retryAfterSec: Math.max(1, Math.ceil((g.windowStart + 600_000 - now) / 1000)),
          reason: 'global_cooldown',
        };
      }
    }
  } catch {
    // Fail open only on KV parse glitch
  }
  return { allowed: true };
}

export async function recordFailedAttempt(
  request: Request,
  env: AuthEnv
): Promise<{ count: number; remainingAttempts: number; lockedUntil: number | null }> {
  if (!env.AUTH_LOCK_KV) {
    return { count: 1, remainingAttempts: 4, lockedUntil: null };
  }
  const now = Date.now();
  const rlSalt = env.RATE_LIMIT_SALT || env.PROBLEM_LOCK_SALT || 'fallback-rl-salt';
  const ipHash = await sha256Hex(`${rlSalt}:${getClientIp(request)}`);
  const ipKey = `rl:ip:${ipHash}`;

  let prevCount = 0;
  try {
    const rawIp = await env.AUTH_LOCK_KV.get(ipKey);
    if (rawIp) {
      const parsed = JSON.parse(rawIp) as IpRateRecord;
      prevCount = parsed.count || 0;
    }
  } catch {
    prevCount = 0;
  }

  const nextCount = prevCount + 1;
  let lockedUntil = 0;
  let ttl = 900;
  if (nextCount >= 8) {
    lockedUntil = now + 24 * 3600 * 1000;
    ttl = 86400;
  } else if (nextCount >= 5) {
    lockedUntil = now + 15 * 60 * 1000;
    ttl = 1800;
  }

  await env.AUTH_LOCK_KV.put(ipKey, JSON.stringify({ count: nextCount, lockedUntil }), {
    expirationTtl: ttl,
  });

  // Global window counter
  try {
    const rawGlobal = await env.AUTH_LOCK_KV.get('rl:global');
    let g: GlobalRateRecord = { count: 1, windowStart: now };
    if (rawGlobal) {
      const parsed = JSON.parse(rawGlobal) as GlobalRateRecord;
      if (now - parsed.windowStart < 600_000) {
        g = { count: (parsed.count || 0) + 1, windowStart: parsed.windowStart };
      }
    }
    await env.AUTH_LOCK_KV.put('rl:global', JSON.stringify(g), { expirationTtl: 600 });
  } catch {
    // ignore
  }

  return {
    count: nextCount,
    remainingAttempts: Math.max(0, (nextCount >= 5 ? 8 : 5) - nextCount),
    lockedUntil: lockedUntil > 0 ? lockedUntil : null,
  };
}

export async function clearFailedAttempts(request: Request, env: AuthEnv): Promise<void> {
  if (!env.AUTH_LOCK_KV) return;
  const rlSalt = env.RATE_LIMIT_SALT || env.PROBLEM_LOCK_SALT || 'fallback-rl-salt';
  const ipHash = await sha256Hex(`${rlSalt}:${getClientIp(request)}`);
  await env.AUTH_LOCK_KV.delete(`rl:ip:${ipHash}`);
}

export async function sleepJitter(): Promise<void> {
  const ms = 350 + Math.floor(Math.random() * 250);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function checkSameOrigin(request: Request): boolean {
  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite && secFetchSite === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

interface SessionPayload {
  v: 1;
  iat: number;
  exp: number;
  jti: string;
  uah: string;
}

export async function createSessionCookie(request: Request, env: AuthEnv): Promise<string> {
  if (!env.SESSION_HMAC_SECRET) {
    throw new Error('SESSION_HMAC_SECRET is missing');
  }
  const iat = Math.floor(Date.now() / 1000);
  const rand = new Uint8Array(16);
  crypto.getRandomValues(rand);
  const ua = request.headers.get('user-agent') || '';
  const uah = (await sha256Hex(ua)).slice(0, 16);

  const payload: SessionPayload = {
    v: 1,
    iat,
    exp: iat + SESSION_TTL_SECONDS,
    jti: bytesToHex(rand),
    uah,
  };
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await importHmacKey(env.SESSION_HMAC_SECRET);
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  const sigB64 = base64UrlEncode(new Uint8Array(sigBuf));

  const isHttps = (() => {
    try {
      return new URL(request.url).protocol === 'https:';
    } catch {
      return true;
    }
  })();
  const secureFlag = isHttps ? ' Secure;' : '';
  return `${SESSION_COOKIE_NAME}=${payloadB64}.${sigB64}; HttpOnly;${secureFlag} SameSite=Strict; Path=/api; Max-Age=${SESSION_TTL_SECONDS}`;
}

function parseCookies(cookieHeader: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    map.set(k, v);
  }
  return map;
}

export async function verifySessionCookie(request: Request, env: AuthEnv): Promise<boolean> {
  if (!env.SESSION_HMAC_SECRET) return false;
  const cookies = parseCookies(request.headers.get('cookie'));
  const token = cookies.get(SESSION_COOKIE_NAME);
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const [payloadB64, sigB64] = parts;

  const sigBytes = base64UrlDecode(sigB64);
  if (!sigBytes || sigBytes.length === 0 || base64UrlEncode(sigBytes) !== sigB64) return false;

  try {
    const key = await importHmacKey(env.SESSION_HMAC_SECRET);
    const expectedSigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
    const expectedSigBytes = new Uint8Array(expectedSigBuf);
    if (!constantTimeEqual(sigBytes, expectedSigBytes)) {
      return false;
    }

    const payloadBytes = base64UrlDecode(payloadB64);
    if (!payloadBytes) return false;
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as Partial<SessionPayload>;
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.v !== 1 || typeof payload.exp !== 'number' || payload.exp <= nowSec) {
      return false;
    }
    const ua = request.headers.get('user-agent') || '';
    const expectedUah = (await sha256Hex(ua)).slice(0, 16);
    const actualUahBytes = new TextEncoder().encode(payload.uah || '');
    const expectedUahBytes = new TextEncoder().encode(expectedUah);
    return constantTimeEqual(actualUahBytes, expectedUahBytes);
  } catch {
    return false;
  }
}

export function clearSessionCookie(request: Request): string {
  const isHttps = (() => {
    try {
      return new URL(request.url).protocol === 'https:';
    } catch {
      return true;
    }
  })();
  const secureFlag = isHttps ? ' Secure;' : '';
  return `${SESSION_COOKIE_NAME}=; HttpOnly;${secureFlag} SameSite=Strict; Path=/api; Max-Age=0`;
}
