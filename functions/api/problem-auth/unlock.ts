import {
  checkRateLimit,
  checkSameOrigin,
  clearFailedAttempts,
  createSessionCookie,
  jsonResponse,
  recordFailedAttempt,
  sleepJitter,
  verifyPasscode,
  type PagesContext,
} from '../../_lib/security';

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  if (!checkSameOrigin(request)) {
    return jsonResponse({ error: 'Yêu cầu không hợp lệ (sai nguồn gốc).' }, 403);
  }

  if (!env.PROBLEM_LOCK_SALT || !env.PROBLEM_LOCK_HASH || !env.SESSION_HMAC_SECRET) {
    return jsonResponse(
      { error: 'Máy chủ chưa cấu hình khóa bảo mật. Vui lòng kiểm tra Secrets trên Cloudflare.' },
      503
    );
  }

  const rl = await checkRateLimit(request, env);
  if (!rl.allowed) {
    const mins = Math.floor(rl.retryAfterSec / 60);
    const secs = rl.retryAfterSec % 60;
    const timeLabel = mins > 0 ? `${mins} phút ${secs} giây` : `${secs} giây`;
    return jsonResponse(
      {
        error:
          rl.reason === 'global_cooldown'
            ? `Hệ thống đang tạm khóa bảo vệ do nhiều lần thử sai. Vui lòng đợi ${timeLabel}.`
            : `Bạn đã nhập sai quá số lần quy định. Tạm khóa trong ${timeLabel}.`,
        retryAfterSec: rl.retryAfterSec,
      },
      429,
      { 'Retry-After': String(rl.retryAfterSec) }
    );
  }

  let passcode = '';
  try {
    const body = (await request.json()) as { passcode?: unknown };
    if (typeof body?.passcode === 'string') {
      passcode = body.passcode;
    }
  } catch {
    return jsonResponse({ error: 'Dữ liệu gửi lên không hợp lệ.' }, 400);
  }

  const ok = await verifyPasscode(passcode, env);
  if (!ok) {
    const fail = await recordFailedAttempt(request, env);
    await sleepJitter();
    const lockMsg = fail.lockedUntil
      ? fail.count >= 8
        ? 'Nhập sai quá 8 lần — IP bị khóa 24 giờ.'
        : 'Nhập sai 5 lần — IP bị tạm khóa 15 phút.'
      : `Mã bảo mật không chính xác (còn ${fail.remainingAttempts} lần thử).`;
    return jsonResponse(
      {
        unlocked: false,
        error: lockMsg,
        remainingAttempts: fail.remainingAttempts,
        lockedUntil: fail.lockedUntil,
      },
      401
    );
  }

  await clearFailedAttempts(request, env);
  const cookieHeader = await createSessionCookie(request, env);
  return jsonResponse({ unlocked: true }, 200, { 'Set-Cookie': cookieHeader });
}
