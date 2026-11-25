import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ locals }) => {
  if (!locals.benutzer || !locals.sessionFristen) return json({ fehler: 'Nicht angemeldet.' }, { status: 401 });
  return json(locals.sessionFristen, { headers: { 'cache-control': 'no-store' } });
};
