import { error } from '@sveltejs/kit';
import { hilfeArtikel } from '../../../lib/hilfe';
import type { PageLoad } from './$types';
export const load: PageLoad = ({ params }) => {
  const artikel = hilfeArtikel.find((eintrag) => eintrag.slug === params.slug);
  if (!artikel) error(404, 'Diese Anleitung wurde nicht gefunden.');
  return { artikel };
};
