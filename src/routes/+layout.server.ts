import { ObjectId } from 'mongodb';
import { db } from '../lib/server/mongodb';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
  depends('clubmatiq:vereinsprofil');
  let verein: { name: string; logo: string | null } | null = null;
  if (locals.benutzer && ObjectId.isValid(locals.benutzer.vereinId)) {
    try {
      const profil = await db.collection('vereine').findOne(
        { _id: new ObjectId(locals.benutzer.vereinId) },
        { projection: { name: 1, 'logo.url': 1 } }
      );
      if (profil && typeof profil.name === 'string') {
        verein = { name: profil.name, logo: typeof profil.logo?.url === 'string' ? profil.logo.url : null };
      }
    } catch (error) {
      console.error('Vereinsprofil im Layout:', error);
    }
  }
  return {
    demo: process.env.MONGODB_DB_NAME === 'clubmatiq_demo',
    benutzer: locals.benutzer,
    sessionFristen: locals.sessionFristen,
    verein
  };
};
