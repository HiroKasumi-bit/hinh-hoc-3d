import { jsonResponse, verifySessionCookie, type PagesContext } from '../../_lib/security';

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const unlocked = await verifySessionCookie(context.request, context.env);
  return jsonResponse({ unlocked });
}
