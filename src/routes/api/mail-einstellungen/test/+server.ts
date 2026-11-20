import { json } from '@sveltejs/kit';
import nodemailer from 'nodemailer';
import { versendeMicrosoft365Mail } from '../../../../lib/server/microsoft365';
import type { RequestHandler } from './$types';
import { pruefeBerechtigung } from '../../../../lib/server/berechtigungen';
import { ladeMailKonfiguration, entschluesseln } from '../../../../lib/server/mail-einstellungen';

export const POST: RequestHandler = async ({ locals }) => {
  const fehler = pruefeBerechtigung(locals.benutzer, 'benutzer:verwalten');
  if (fehler) return fehler;
  try {
    const mail = await ladeMailKonfiguration(locals.benutzer!.vereinId);
    if (mail.methode === 'microsoft365') {
      if (!mail.microsoft365) return json({ fehler: 'Bitte zuerst eine Microsoft-365-Konfiguration speichern.' }, { status: 400 });
      try {
        await versendeMicrosoft365Mail(mail.microsoft365, {
          an: locals.benutzer!.email,
          betreff: 'ClubMatiq – Microsoft-365-Testversand',
          text: 'Der Microsoft-365-E-Mail-Versand für deinen Verein wurde erfolgreich getestet.'
        });
        return json({ erfolg: true, nachricht: 'Microsoft-365-Test-E-Mail wurde an deine eigene Adresse versendet.' });
      } catch (error) {
        console.error('Microsoft-365-Testversand fehlgeschlagen:', error instanceof Error ? error.message : 'Unbekannter Fehler');
        return json({ fehler: 'Microsoft-365-Test fehlgeschlagen. Bitte Zertifikat, Entra-Anmeldung und Exchange-Berechtigung prüfen.' }, { status: 502 });
      }
    }
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
