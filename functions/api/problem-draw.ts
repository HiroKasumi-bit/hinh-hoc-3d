import { solveVietnameseMathProblem } from '../_lib/problemEngine';
import { checkSameOrigin, jsonResponse, verifySessionCookie, type PagesContext } from '../_lib/security';

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  if (!checkSameOrigin(request)) {
    return jsonResponse({ error: 'Yêu cầu không hợp lệ (sai nguồn gốc).' }, 403);
  }

  const unlocked = await verifySessionCookie(request, env);
  if (!unlocked) {
    return jsonResponse(
      { error: 'Phiên làm việc đã hết hạn hoặc chưa mở khóa. Vui lòng nhập mã bảo mật.' },
      401
    );
  }

  let problemText = '';
  try {
    const body = (await request.json()) as { problemText?: unknown };
    if (typeof body?.problemText === 'string') {
      problemText = body.problemText.trim();
    }
  } catch {
    return jsonResponse({ error: 'Định dạng JSON không hợp lệ.' }, 400);
  }

  if (!problemText) {
    return jsonResponse({ error: 'Vui lòng nhập nội dung đề bài toán.' }, 400);
  }
  if (problemText.length > 3500) {
    return jsonResponse({ error: 'Đề bài vượt quá giới hạn 3.500 ký tự.' }, 400);
  }

  try {
    const result = solveVietnameseMathProblem(problemText);
    return jsonResponse(result, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể phân tích đề bài này.';
    return jsonResponse({ error: message }, 400);
  }
}
