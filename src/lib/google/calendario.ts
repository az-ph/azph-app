import "server-only";
import { createSign } from "node:crypto";

/**
 * Google Calendar con un account di servizio (GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY, solo su Netlify).
 * Il titolare condivide il proprio calendario (GOOGLE_CALENDARIO_ID) con l'account di servizio,
 * con il permesso "Apportare modifiche agli eventi": l'app vede e tocca solo quel calendario.
 */
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const FUSO = "Europe/Rome";

/** inizio "aaaa-mm-ggThh:mm" (ora di Roma) + minuti, oppure giornate intere da "aaaa-mm-gg" a "aaaa-mm-gg" (comprese). */
export type EventoCalendario =
  | { titolo: string; descrizione?: string; luogo?: string; inizio: string; minuti: number }
  | { titolo: string; descrizione?: string; luogo?: string; giorni: { dal: string; al: string } };

export function calendarioCollegato(): boolean {
  return !!(process.env.GOOGLE_SA_EMAIL && process.env.GOOGLE_SA_PRIVATE_KEY && process.env.GOOGLE_CALENDARIO_ID);
}

const b64 = (x: string | Buffer) => Buffer.from(x).toString("base64url");

let cache: { token: string; scade: number } | null = null;

async function token(): Promise<string> {
  const ora = Math.floor(Date.now() / 1000);
  if (cache && cache.scade > ora + 60) return cache.token;
  const corpo = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64(JSON.stringify({
    iss: process.env.GOOGLE_SA_EMAIL, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: ora, exp: ora + 3600,
  }))}`;
  const chiave = (process.env.GOOGLE_SA_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const firma = createSign("RSA-SHA256").update(corpo).sign(chiave).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${corpo}.${firma}` }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`accesso a Google rifiutato (${r.status}): controlla GOOGLE_SA_EMAIL e GOOGLE_SA_PRIVATE_KEY`);
  const t = ((await r.json()) as { access_token: string; expires_in?: number });
  cache = { token: t.access_token, scade: ora + (t.expires_in ?? 3600) };
  return t.access_token;
}

/** "aaaa-mm-ggThh:mm" + minuti, senza fuso (lo dà timeZone). */
export function piuMinuti(locale: string, minuti: number): string {
  const d = new Date(`${locale}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + minuti);
  return d.toISOString().slice(0, 16);
}

/** Crea o aggiorna l'evento; restituisce il suo id. */
export async function salvaEvento(e: EventoCalendario, id?: string | null): Promise<string> {
  const cal = encodeURIComponent(process.env.GOOGLE_CALENDARIO_ID ?? "");
  const url = `https://www.googleapis.com/calendar/v3/calendars/${cal}/events${id ? `/${encodeURIComponent(id)}` : ""}`;
  const r = await fetch(url, {
    method: id ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ summary: e.titolo, description: e.descrizione ?? "", location: e.luogo ?? "", ...tempi(e) }),
    signal: AbortSignal.timeout(8000),
  });
  if ((r.status === 404 || r.status === 410) && id) return salvaEvento(e, null); // cancellato a mano dal calendario: lo ricrea
  if (!r.ok) throw new Error(await motivo(r));
  return ((await r.json()) as { id: string }).id;
}

export async function eliminaEvento(id: string): Promise<void> {
  const cal = encodeURIComponent(process.env.GOOGLE_CALENDARIO_ID ?? "");
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${cal}/events/${encodeURIComponent(id)}`, {
    method: "DELETE", headers: { Authorization: `Bearer ${await token()}` }, signal: AbortSignal.timeout(8000),
  });
  if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error(await motivo(r));
}

/** Istante (ISO con fuso) → "aaaa-mm-ggThh:mm" in ora di Roma, per i campi datetime-local e per Google. */
export function localeRoma(iso: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// I campi dell'altro tipo vanno azzerati: con PATCH Google unisce i vecchi e i nuovi,
// e un evento con sia "date" sia "dateTime" viene rifiutato (400 invalid).
export function tempi(e: EventoCalendario) {
  if ("giorni" in e) return { start: { date: e.giorni.dal, dateTime: null, timeZone: null }, end: { date: giornoDopo(e.giorni.al), dateTime: null, timeZone: null } };
  return {
    start: { date: null, dateTime: `${e.inizio}:00`, timeZone: FUSO },
    end: { date: null, dateTime: `${piuMinuti(e.inizio, e.minuti)}:00`, timeZone: FUSO },
  };
}

export function giornoDopo(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Il motivo che dà Google, in chiaro (senza dati personali). */
async function motivo(r: Response): Promise<string> {
  const j = (await r.json().catch(() => ({}))) as { error?: { message?: string; errors?: { reason?: string }[] } };
  const ragione = j.error?.errors?.[0]?.reason;
  const spiegazione: Record<string, string> = {
    forbidden: "l'account di servizio non può modificare il calendario: condividilo con \"Apportare modifiche agli eventi\"",
    requiredAccessLevel: "l'account di servizio non può modificare il calendario: condividilo con \"Apportare modifiche agli eventi\"",
    accessNotConfigured: "Google Calendar API non abilitata nel progetto Google Cloud",
    notFound: "calendario non trovato: controlla GOOGLE_CALENDARIO_ID",
    rateLimitExceeded: "troppe richieste a Google, riprova tra poco",
  };
  return `Google Calendar ${r.status}${ragione ? `: ${spiegazione[ragione] ?? ragione}` : ""}`;
}

/** Eventi di uno o più giorni (per riprendere quelli creati dal vecchio foglio). */
export async function eventiNeiGiorni(dal: string, al: string): Promise<{ id: string; titolo: string }[]> {
  const cal = encodeURIComponent(process.env.GOOGLE_CALENDARIO_ID ?? "");
  const q = new URLSearchParams({ timeMin: `${dal}T00:00:00+02:00`, timeMax: `${giornoDopo(al)}T02:00:00+01:00`, singleEvents: "true", maxResults: "50" });
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${cal}/events?${q}`, {
    headers: { Authorization: `Bearer ${await token()}` }, signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(await motivo(r));
  const j = (await r.json()) as { items?: { id: string; summary?: string; status?: string }[] };
  return (j.items ?? []).filter((x) => x.status !== "cancelled").map((x) => ({ id: x.id, titolo: x.summary ?? "" }));
}
