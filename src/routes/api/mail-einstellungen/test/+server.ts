import { json } from '@sveltejs/kit';
import nodemailer from 'nodemailer';
import type { RequestHandler } from './$types';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import { ladeMailKonfiguration, entschluesseln } from '../../../../lib/server/mail-einstellungen';

export const POST: RequestHandler = async ({ locals }) => {
  const fehler = pruefeBerechtigung(locals.benutzer, 'benutzer:verwalten');
  if (fehler) return fehler;
  try {
    const mail = await ladeMailKonfiguration(locals.benutzer!.vereinId);
    if (mail.methode !== 'smtp' || !mail.smtp?.geheimnis) {
      return json({ fehler: 'Bitte zuerst eine SMTP-Konfiguration speichern.' }, { status: 400 });
    }
    const smtp = mail.smtp;
    const geheimnis = smtp.geheimnis;
    if (!geheimnis) return json({ fehler: 'SMTP-Passwort fehlt.' }, { status: 400 });
    const transport = nodemailer.createTransport({
      host: smtp.host, port: smtp.port, secure: smtp.secure,
      requireTLS: !smtp.secure,
      auth: { user: smtp.benutzername, pass: entschluesseln(geheimnis) },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
    });
    try {
      await transport.verify();
      // Der Test versendet ausschliesslich an den angemeldeten Admin.
      await transport.sendMail({
        from: smtp.absender, to: locals.benutzer!.email,
        subject: 'ClubMatiq – SMTP-Testversand',
        text: 'Der E-Mail-Versand für deinen Verein wurde erfolgreich getestet.'
      });
    } finally {
      transport.close();
    }
    return json({ erfolg: true, nachricht: 'Test-E-Mail wurde an deine eigene Adresse versendet.' });
  } catch {
    return json({ fehler: 'SMTP-Test fehlgeschlagen. Bitte Server, TLS, Anmeldedaten und Berechtigungen prüfen.' }, { status: 502 });
  }
};
