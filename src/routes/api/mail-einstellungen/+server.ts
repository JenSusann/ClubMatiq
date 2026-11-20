import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
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
      absender: mail.microsoft365.absender, geheimnisHinterlegt: Boolean(mail.microsoft365.geheimnis)
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
    const geheimnisNeu = typeof wert.geheimnis === 'string' ? wert.geheimnis : '';
    const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!guid.test(tenantId) || !guid.test(clientId) || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(absender)) return json({ fehler: 'Ungültige Microsoft-365-Einstellungen.' }, { status: 400 });
    try {
      const bisher = await vereine.findOne(filter);
      const geheimnis = geheimnisNeu ? verschluesseln(geheimnisNeu) : bisher?.mailEinstellungen?.microsoft365?.geheimnis;
      if (!geheimnis) return json({ fehler: 'Microsoft-365-Client-Secret fehlt.' }, { status: 400 });
      await vereine.updateOne(filter, { $set: { mailEinstellungen: {
        methode: 'microsoft365', microsoft365: { tenantId, clientId, absender, geheimnis }
      } } });
      return json({ erfolg: true });
    } catch {
      return json({ fehler: 'Microsoft-365-Einstellungen konnten nicht gespeichert werden.' }, { status: 500 });
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
