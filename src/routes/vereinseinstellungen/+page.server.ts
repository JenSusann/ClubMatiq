import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  if (!locals.benutzer) redirect(303, '/anmelden');
  if (locals.benutzer.rolle !== 'admin') error(403, 'Nur Administratoren können die Vereinseinstellungen öffnen.');
  return {};
};
