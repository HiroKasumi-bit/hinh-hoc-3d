import { checkSameOrigin, clearSessionCookie, jsonResponse, type PagesContext } from '../../_lib/security';

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request } = context;
  if (!checkSameOrigin(request)) {
    return jsonResponse({ error: 'Yêu cầu không hợp lệ.' }, 403);
  }
  return jsonResponse({ unlocked: false }, 200, {
    'Set-Cookie': clearSessionCookie(request),
  });
}
