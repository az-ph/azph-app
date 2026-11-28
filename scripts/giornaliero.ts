/**
 * Controllo giornaliero delle 6 (GitHub Action "Controllo giornaliero").
 * - Cambi di stato: Confermato → Lightroom il giorno dopo il Matrimonio; Saldo tutto incassato → Chiuso.
 * - Mail di riepilogo al titolare (solo se c'è qualcosa), con le voci della schermata Oggi.
 * Nessun invio agli Sposi. Nei log solo numeri: i nomi stanno solo nella mail al titolare.
 *
 * Variabili: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY (senza: niente mail), APP_URL, FORZA=1 (ripete oggi).
 */
import { createClient } from "@supabase/supabase-js";
import { caricaOggi, oggiRoma } from "../src/lib/admin/carica-oggi";
import { cambiDelGiorno, type Cambio } from "../src/lib/admin/automatismi";
import { ETICHETTA_STATO } from "../src/lib/admin/stati";
import { escH } from "../src/lib/mail/testo";

const NOME_JOB = "controllo_giornaliero";

function env(n: string, obbligatoria = true): string {
  const v = process.env[n]?.trim() ?? "";
  if (!v && obbligatoria) { console.error(`Manca la variabile ${n}.`); process.exit(1); }
  return v;
}

const euro = (c: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(c / 100);
const gg = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join(".") : "");

async function main() {
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const app = (env("APP_URL", false) || "https://azph-app.netlify.app").replace(/\/$/, "");
  const oggi = oggiRoma();
  // Lanciato dall'orario: solo dalle 6 di Roma (GitHub gira in UTC, con l'ora legale cambia)
  const ora = Number(new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  if (process.env.MANUALE !== "1" && ora < 6) { console.log("Troppo presto: riparte all'esecuzione successiva."); return; }

  // Una volta al giorno (l'Action può ripartire): FORZA=1 per rifarlo
  if (process.env.FORZA !== "1") {
    const { data: fatto } = await db.from("log_job").select("id").eq("nome", NOME_JOB).eq("esito", "ok").contains("dettaglio", { giorno: oggi }).limit(1);
    if (fatto?.length) { console.log("Controllo di oggi già eseguito."); return; }
  }

  const prima = await caricaOggi(db, oggi);
  if ("errore" in prima) throw new Error(`Lettura dati: ${prima.errore}`);

  // 1. Cambi di stato, ciascuno solo se lo stato è ancora quello letto
  const fatti: Cambio[] = [], errori: Cambio[] = [];
  for (const c of cambiDelGiorno(prima.elenco, oggi)) {
    const { data, error } = await db.from("matrimonio").update({ stato: c.a }).eq("id", c.id).eq("stato", c.da).select("id");
    (error || !data?.length ? errori : fatti).push(c);
  }

  // 2. Riepilogo con i dati aggiornati
  const d = await caricaOggi(db, oggi);
  if ("errore" in d) throw new Error(`Lettura dati: ${d.errore}`);
  const { data: app_oggi } = await db.from("contatto").select("matrimonio_id, appuntamento_il, matrimonio ( codice_id, sposi:sposo ( ordine, nome ) )")
    .gte("appuntamento_il", `${oggi}T00:00:00+03:00`).lt("appuntamento_il", `${oggi}T23:59:59-03:00`);
  // finestra larga, poi solo il giorno di Roma
  const giornoRoma = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });

  const sezioni: [string, string[]][] = [
    ["Cambi di stato", [
      ...fatti.map((c) => `${c.nomi}: ${ETICHETTA_STATO[c.da]} → ${ETICHETTA_STATO[c.a]} (${c.motivo})`),
      ...errori.map((c) => `⚠️ ${c.nomi}: non passato a ${ETICHETTA_STATO[c.a]}, controlla la scheda`),
    ]],
    ["Appuntamenti di oggi", (app_oggi ?? []).filter((x) => x.appuntamento_il && giornoRoma(x.appuntamento_il) === oggi).map((x) => {
      const m = x.matrimonio as unknown as { codice_id: string; sposi: { ordine: number; nome: string | null }[] } | null;
      const nomi = [...(m?.sposi ?? [])].sort((a, b) => a.ordine - b.ordine).map((s) => (s.nome ?? "").split(" ")[0]).filter(Boolean).join(" e ");
      const ora = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" }).format(new Date(x.appuntamento_il!)).replace(":", ".");
      return `${ora} [FCO] ${nomi || m?.codice_id || ""}`;
    })],
    ["Soldi e scadenze", d.f.pagamenti.map((p) => `${p.m.nomi}: ${p.rata} ${euro(p.manca)}${p.scadenza ? ` · ${p.scaduto ? "scaduto" : "scade"} il ${gg(p.scadenza)}` : ""}`)],
    ["Kick-off da fissare", d.f.kickoff.map((m) => `${m.nomi} · Matrimonio il ${gg(m.data)}`)],
    ["Preventivi da fare", d.f.daInviare.map((m) => `${m.nomi} · ${ETICHETTA_STATO[m.stato]}`)],
    ["Follow up", d.f.followup.map((m) => `${m.nomi} · ${m.aperture} aperture della pagina`)],
    ["Album", d.albumDaSeguire.filter((x) => x.mia).map((x) => `${x.m.nomi}: ${x.fase === "selezione" ? "da impaginare" : "nuova versione da caricare"}`)],
    ["Album da proporre", d.daProporre.map((m) => `${m.nomi} · foto consegnate il ${gg(m.consegna)}`)],
    ["Recensioni da chiedere", d.recensioni.map((m) => `${m.nomi} · foto consegnate il ${gg(m.consegna)}`)],
  ];
  const piene = sezioni.filter(([, r]) => r.length);
  const conteggi = Object.fromEntries(sezioni.map(([t, r]) => [t, r.length]));

  // 3. Mail al titolare
  let mail = false;
  const chiave = env("RESEND_API_KEY", false);
  if (piene.length && chiave) {
    const { data: imp } = await db.from("impostazioni").select("marchio").single();
    const marchio = (imp?.marchio ?? {}) as Record<string, string | undefined>;
    const mittente = marchio.email, dest = marchio.email_notifiche || mittente;
    if (mittente && dest) {
      const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#383838">` +
        piene.map(([t, r]) => `<p style="margin:16px 0 4px"><b>${escH(t)}</b></p>` + r.map((x) => `<div>• ${escH(x)}</div>`).join("")).join("") +
        `<p style="margin:20px 0 0"><a href="${app}/admin">Apri Oggi</a></p></div>`;
      const testo = piene.map(([t, r]) => `${t}\n${r.map((x) => `• ${x}`).join("\n")}`).join("\n\n") + `\n\nOggi: ${app}/admin`;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${chiave}`, "Content-Type": "application/json", "Idempotency-Key": `${NOME_JOB}-${oggi}` },
        body: JSON.stringify({ from: `${marchio.titolare || marchio.nome || ""} <${mittente}>`, to: [dest], subject: `📋 Oggi – ${gg(oggi)}`, html, text: testo }),
      });
      mail = r.ok;
      if (!r.ok) console.error(`Mail non inviata (HTTP ${r.status}).`);
    }
  }

  const esito = errori.length ? "errore" : "ok";
  await db.from("log_job").insert({
    nome: NOME_JOB, esito,
    dettaglio: { giorno: oggi, cambi: fatti.map((c) => ({ codice: c.codice, da: c.da, a: c.a })), errori: errori.map((c) => c.codice), conteggi, mail },
  });
  console.log(`Controllo ${oggi}: ${fatti.length} cambi, ${errori.length} errori, mail ${mail ? "inviata" : "non inviata"}.`, JSON.stringify(conteggi));
  if (errori.length) process.exitCode = 1;
}

main().catch(async (e) => {
  console.error("Controllo giornaliero non riuscito:", e instanceof Error ? e.message : "errore");
  process.exit(1);
});
