import 'dotenv/config';

function escapeHtml(wert: string): string {
  return wert.replace(/[&<>"']/g, (zeichen) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[zeichen] ?? zeichen);
}

export async function versendeEinladung(daten: {
  email: string;
  vorname: string;
  verein: string;
  link: string;
  ablaufdatum: Date;
}): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const absender = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !absender) {
    throw new Error('RESEND_API_KEY oder RESEND_FROM_EMAIL fehlt.');
  }

  const antwort = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: absender,
      to: [daten.email],
      subject: `Einladung zu ${daten.verein} auf ClubMatiq`,
      text: `Hallo ${daten.vorname},\n\nDu wurdest zu ${daten.verein} auf ClubMatiq eingeladen.\n\nRegistriere dich hier: ${daten.link}\n\nDer Link ist bis ${daten.ablaufdatum.toLocaleDateString('de-CH')} gültig.\n\nFalls du diese Einladung nicht erwartest, kannst du sie ignorieren.\n\nClubMatiq`,
      html: `<p>Hallo ${escapeHtml(daten.vorname)},</p><p>Du wurdest zu <strong>${escapeHtml(daten.verein)}</strong> auf ClubMatiq eingeladen.</p><p><a href="${escapeHtml(daten.link)}">Einladung annehmen</a></p><p>Gültig bis ${daten.ablaufdatum.toLocaleDateString('de-CH')}.</p><p>Falls du diese Einladung nicht erwartest, kannst du sie ignorieren.</p><p>ClubMatiq</p>`
    }),
    signal: AbortSignal.timeout(15000)
  });

  if (!antwort.ok) {
    const fehlermeldung = await antwort.text();
    console.error('Resend API Fehler:', antwort.status, fehlermeldung);
    throw new Error('Der E-Mail-Versand ist fehlgeschlagen.');
  }

  const ergebnis: unknown = await antwort.json();
  if (!ergebnis || typeof ergebnis !== 'object' || !('id' in ergebnis) || typeof ergebnis.id !== 'string') {
    throw new Error('Resend hat keine Versand-ID zurückgegeben.');
  }
  return { id: ergebnis.id };
}
