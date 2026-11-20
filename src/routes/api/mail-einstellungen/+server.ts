import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { createPrivateKey, createPublicKey, X509Certificate } from 'node:crypto';
import type { RequestHandler } from './$types';
import { db } from '../../../lib/server/mongodb';
import { pruefeBerechtigung } from '../../../lib/server/berechtigungen';
import { verschluesseln } from '../../../lib/server/mail-einstellungen';

export const GET: RequestHandler = async ({ locals }) => {
  const fehler = pruefeBerechtigung(locals.benutzer, 'benutzer:verwalten');
  if (fehler) return fehler;
  const verein = await db.collection('vereine').findOne({ _id: new ObjectId(locals.benutzer!.vereinId) });
  const mail = verein?.mailEinstellungen;
  return json({
    methode: mail?.methode === 'smtp' || mail?.methode === 'microsoft365' ? mail.methode : 'resend',
    microsoft365: mail?.microsoft365 ? {
      tenantId: mail.microsoft365.tenantId, clientId: mail.microsoft365.clientId,
      absender: mail.microsoft365.absender, zertifikatServerseitig: Boolean(mail.microsoft365.zertifikat && mail.microsoft365.privaterSchluessel)
    } : null,
    smtp: mail?.smtp ? {
      host: mail.smtp.host, port: mail.smtp.port, secure: mail.smtp.secure,
      benutzername: mail.smtp.benutzername, absender: mail.smtp.absender,
      passwortHinterlegt: Boolean(mail.smtp.geheimnis)
    } : null
  });
};

export const PUT: RequestHandler = async ({ locals, request }) => {
  const fehler = pruefeBerechtigung(locals.benutzer, 'benutzer:verwalten');
  if (fehler) return fehler;
  const daten: unknown = await request.json().catch(() => null);
  if (!daten || typeof daten !== 'object' || Array.isArray(daten)) {
    return json({ fehler: 'Ungültige Eingabe.' }, { status: 400 });
  }
  const eingabe = daten as Record<string, unknown>;
  if (eingabe.methode !== 'smtp' && eingabe.methode !== 'resend' && eingabe.methode !== 'microsoft365') {
    return json({ fehler: 'Ungültige Versandmethode.' }, { status: 400 });
  }
  const vereinId = locals.benutzer!.vereinId;
  const vereine = db.collection('vereine');
  const filter = { _id: new ObjectId(vereinId) };
  if (eingabe.methode === 'resend') {
    await vereine.updateOne(filter, { $set: { 'mailEinstellungen.methode': 'resend' } });
    return json({ erfolg: true });
  }
  if (eingabe.methode === 'microsoft365') {
    const daten = eingabe.microsoft365;
    if (!daten || typeof daten !== 'object' || Array.isArray(daten)) return json({ fehler: 'Microsoft-365-Einstellungen fehlen.' }, { status: 400 });
    const wert = daten as Record<string, unknown>;
    const tenantId = typeof wert.tenantId === 'string' ? wert.tenantId.trim() : '';
    const clientId = typeof wert.clientId === 'string' ? wert.clientId.trim() : '';
    const absender = typeof wert.absender === 'string' ? wert.absender.trim() : '';
    const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!guid.test(tenantId) || !guid.test(clientId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(absender)) return json({ fehler: 'Ungültige Microsoft-365-Einstellungen.' }, { status: 400 });
    const certPem = typeof wert.zertifikatPem === 'string' ? wert.zertifikatPem.trim() : '';
    const keyPem = typeof wert.privaterSchluesselPem === 'string' ? wert.privaterSchluesselPem.trim() : '';
    if (certPem.length > 20000 || keyPem.length > 20000 || Boolean(certPem) !== Boolean(keyPem)) {
      return json({ fehler: 'Zertifikat und privater Schlüssel müssen gemeinsam angegeben werden (maximal 20 KB je Datei).' }, { status: 400 });
    }
    if (certPem && keyPem && !/^[a-f0-9]{64}$/i.test(process.env.MAIL_ENCRYPTION_KEY ?? '')) {
      return json({ fehler: 'Server-Konfiguration unvollständig: MAIL_ENCRYPTION_KEY fehlt oder ist ungültig (64 Hex-Zeichen erforderlich).' }, { status: 503 });
    }
    try {
      const bisher = await vereine.findOne(filter);
      const alteKonfiguration = bisher?.mailEinstellungen?.microsoft365;
      let zertifikat = alteKonfiguration?.zertifikat as string | undefined;
      let privaterSchluessel = alteKonfiguration?.privaterSchluessel as string | undefined;
      if (certPem && keyPem) {
        const cert = new X509Certificate(certPem);
        const key = createPrivateKey(keyPem);
        const publicKey = createPublicKey(key).export({ type: 'spki', format: 'der' });
        const certKey = cert.publicKey.export({ type: 'spki', format: 'der' });
        if (!Buffer.from(publicKey).equals(Buffer.from(certKey))) {
          return json({ fehler: 'Zertifikat und privater Schlüssel passen nicht zusammen.' }, { status: 400 });
        }
        if (Date.now() >= new Date(cert.validTo).getTime() || Date.now() < new Date(cert.validFrom).getTime()) {
          return json({ fehler: 'Das Zertifikat ist abgelaufen oder noch nicht gültig.' }, { status: 400 });
        }
        zertifikat = verschluesseln(certPem);
        privaterSchluessel = verschluesseln(keyPem);
      } else if (alteKonfiguration?.tenantId !== tenantId || alteKonfiguration?.clientId !== clientId) {
        // Schlüssel niemals stillschweigend auf eine andere Entra-App übertragen.
        zertifikat = undefined;
        privaterSchluessel = undefined;
      }
      await vereine.updateOne(filter, { $set: { mailEinstellungen: {
        methode: 'microsoft365', microsoft365: { tenantId, clientId, absender, ...(zertifikat && privaterSchluessel ? { zertifikat, privaterSchluessel } : {}) }
      } } });
      return json({ erfolg: true });
    } catch (error) {
      console.error('Microsoft-365-Konfiguration konnte nicht gespeichert werden:', error instanceof Error ? error.name : 'Unbekannter Fehler');
      return json({ fehler: 'Microsoft-365-Einstellungen konnten nicht gespeichert werden. Bitte Zertifikatsformat und Serverprotokoll prüfen.' }, { status: 500 });
    }
  }
  const smtp = eingabe.smtp;
  if (!smtp || typeof smtp !== 'object' || Array.isArray(smtp)) {
    return json({ fehler: 'SMTP-Einstellungen fehlen.' }, { status: 400 });
  }
  const wert = smtp as Record<string, unknown>;
  const host = typeof wert.host === 'string' ? wert.host.trim() : '';
  const benutzername = typeof wert.benutzername === 'string' ? wert.benutzername.trim() : '';
  const absender = typeof wert.absender === 'string' ? wert.absender.trim() : '';
  const passwort = typeof wert.passwort === 'string' ? wert.passwort : '';
  if (!/^[a-z0-9.-]{1,253}$/i.test(host) || host.startsWith('.') || host.endsWith('.') ||
      !Number.isInteger(wert.port) || (wert.port as number) < 1 || (wert.port as number) > 65535 ||
      typeof wert.secure !== 'boolean' || !benutzername || benutzername.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(absender)) {
    return json({ fehler: 'Ungültige SMTP-Einstellungen.' }, { status: 400 });
  }
  try {
    const bisher = await vereine.findOne(filter);
    const geheimnis = passwort ? verschluesseln(passwort) : bisher?.mailEinstellungen?.smtp?.geheimnis;
    if (!geheimnis) return json({ fehler: 'SMTP-Passwort fehlt.' }, { status: 400 });
    await vereine.updateOne(filter, { $set: { mailEinstellungen: {
      methode: 'smtp', smtp: { host, port: wert.port, secure: wert.secure, benutzername, absender, geheimnis }
    } } });
    return json({ erfolg: true });
  } catch {
    return json({ fehler: 'E-Mail-Einstellungen konnten nicht gespeichert werden. Prüfe den Verschlüsselungsschlüssel.' }, { status: 500 });
  }
};
