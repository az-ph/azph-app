/**
 * Backup notturno: carica il file di backup (già compresso) nel Drive condiviso del titolare e fa pulizia.
 * Tiene gli ultimi 30 giorni e il primo backup di ogni mese. Tocca solo i file creati da sé (scope drive.file).
 * Variabili: GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY, BACKUP_DRIVE_ID. Argomento: percorso del file.
 * Nei log solo nomi dei file di backup (data) e numeri, niente dati.
 */
import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { PREFISSO_BACKUP as PREFISSO, daEliminare } from "../src/lib/admin/backup";

function env(n: string): string {
  const v = process.env[n]?.trim();
  if (!v) { console.error(`Manca la variabile ${n}.`); process.exit(1); }
  return v;
}

const b64 = (x: string | Buffer) => Buffer.from(x).toString("base64url");

async function token(): Promise<string> {
  const ora = Math.floor(Date.now() / 1000);
  const corpo = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64(JSON.stringify({
    iss: env("GOOGLE_SA_EMAIL"), scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token", iat: ora, exp: ora + 3600,
  }))}`;
  const firma = createSign("RSA-SHA256").update(corpo).sign(env("GOOGLE_SA_PRIVATE_KEY").replace(/\\n/g, "\n")).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${corpo}.${firma}` }),
  });
  if (!r.ok) throw new Error(`accesso a Google rifiutato (${r.status})`);
  return ((await r.json()) as { access_token: string }).access_token;
}

async function main() {
  const file = process.argv[2];
  if (!file) { console.error("Indica il file di backup."); process.exit(1); }
  const drive = env("BACKUP_DRIVE_ID");
  const t = await token();
  const auth = { Authorization: `Bearer ${t}` };

  // Caricamento (multipart) nel Drive condiviso
  const nome = basename(file);
  const confine = "azph" + Date.now();
  const dati = await readFile(file);
  const corpo = Buffer.concat([
    Buffer.from(`--${confine}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nome, parents: [drive] })}\r\n--${confine}\r\nContent-Type: application/gzip\r\n\r\n`),
    dati, Buffer.from(`\r\n--${confine}--`),
  ]);
  const up = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id", {
    method: "POST", headers: { ...auth, "Content-Type": `multipart/related; boundary=${confine}` }, body: corpo,
  });
  if (!up.ok) throw new Error(`caricamento non riuscito (${up.status}): ${(await up.text()).slice(0, 200)}`);
  console.log(`Caricato ${nome} (${Math.round(dati.length / 1024)} KB).`);

  // Pulizia
  const q = encodeURIComponent(`'${drive}' in parents and name contains '${PREFISSO}' and trashed = false`);
  const lista = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&corpora=drive&driveId=${drive}&includeItemsFromAllDrives=true&supportsAllDrives=true&pageSize=1000&fields=files(id,name)`, { headers: auth });
  if (!lista.ok) { console.error(`Elenco dei backup non leggibile (${lista.status}): pulizia saltata.`); return; }
  const files = ((await lista.json()) as { files: { id: string; name: string }[] }).files;
  const via = new Set(daEliminare(files.map((f) => f.name), new Date().toISOString().slice(0, 10)));
  for (const f of files.filter((x) => via.has(x.name))) {
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?supportsAllDrives=true`, { method: "DELETE", headers: auth });
    console.log(r.ok ? `Eliminato ${f.name}` : `Non eliminato ${f.name} (${r.status})`);
  }
  console.log(`Backup in Drive: ${files.length - via.size}.`);
}

main().catch((e) => { console.error("Backup non riuscito:", e instanceof Error ? e.message : "errore"); process.exit(1); });
