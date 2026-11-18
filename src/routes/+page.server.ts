import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ locals }) => ({ angemeldet: !!locals.benutzer });
