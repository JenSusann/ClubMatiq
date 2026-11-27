import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { versendeMicrosoft365Mail } from './microsoft365';
import { entschluesseln, ladeMailKonfiguration } from './mail-einstellungen';

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
  vereinId?: string;
}): Promise<{ id: string }> {
  if (process.env.MONGODB_DB_NAME === 'clubmatiq_demo') throw new Error('E-Mail-Versand ist in der Demo deaktiviert.');
  const textInhalt = `Hallo ${daten.vorname},\n\nDu wurdest zu ${daten.verein} auf ClubMatiq eingeladen.\n\nRegistriere dich hier: ${daten.link}\n\nDer Link ist bis ${daten.ablaufdatum.toLocaleDateString('de-CH')} gültig.\n\nClubMatiq`;
  const htmlInhalt = `<p>Hallo ${escapeHtml(daten.vorname)},</p><p>Du wurdest zu <strong>${escapeHtml(daten.verein)}</strong> auf ClubMatiq eingeladen.</p><p><a href="${escapeHtml(daten.link)}">Einladung annehmen</a></p><p>Gültig bis ${daten.ablaufdatum.toLocaleDateString('de-CH')}.</p><p>ClubMatiq</p>`;
  if (daten.vereinId) {
    const mail = await ladeMailKonfiguration(daten.vereinId);
    if (mail.methode === 'microsoft365') {
      if (!mail.microsoft365) throw new Error('Microsoft-365-Konfiguration unvollständig.');
      await versendeMicrosoft365Mail(mail.microsoft365, {
        an: daten.email, betreff: `Einladung zu ${daten.verein} auf ClubMatiq`, text: textInhalt, html: htmlInhalt
      });
      return { id: `m365-${randomUUID()}` };
    }
    if (mail.methode === 'smtp') {
      const smtp = mail.smtp;
      if (!smtp?.geheimnis) throw new Error('SMTP-Konfiguration unvollständig.');
      const transport = nodemailer.createTransport({
        host: smtp.host, port: smtp.port, secure: smtp.secure, requireTLS: !smtp.secure,
        auth: { user: smtp.benutzername, pass: entschluesseln(smtp.geheimnis) },
        connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
      });
      const ergebnis = await transport.sendMail({
        from: smtp.absender, to: daten.email,
        subject: `Einladung zu ${daten.verein} auf ClubMatiq`,
        text: textInhalt, html: htmlInhalt
      });
      return { id: ergebnis.messageId };
    }
  }
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
    console.error('Resend API Fehler:', antwort.status);
    throw new Error('Der E-Mail-Versand ist fehlgeschlagen.');
  }

  const ergebnis: unknown = await antwort.json();
  if (!ergebnis || typeof ergebnis !== 'object' || !('id' in ergebnis) || typeof ergebnis.id !== 'string') {
    throw new Error('Resend hat keine Versand-ID zurückgegeben.');
  }
  return { id: ergebnis.id };
}
