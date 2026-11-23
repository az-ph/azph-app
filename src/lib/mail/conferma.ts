import "server-only";
import { supabaseServizio } from "@/lib/supabase/server";
import { data, dataEstesa, euro } from "@/lib/formato";
import { componi, escH, riempi, stileDaColori, tabella, type Blocco } from "./testo";
import { inviaMail } from "./resend";

export type DatiConferma = {
  matrimonioId: string;
  preventivoId: string;
  codice: string;
  nomi: string;
  dataInizio: string | null;
  location: string;
  link: string;
  congiunta: boolean;
  /** Codice/nome della formula: solo nella notifica al titolare. */
  formula: string;
  /** Righe per gli Sposi: servizio, omaggi, scelte. */
  righeFoto: [string, string][];
  totaleFoto: number;
  video: { etichetta: string; totale: number }[];
  totaleVideo: number;
  videomakerCodice: string | null;
  sposi: { nome: string; telefono: string; email: string; codice_fiscale: string; indirizzo: string; indirizzo_preparativi: string }[];
  consensoPromo: boolean;
  note: string;
};

/**
 * Dopo una conferma: mail di riepilogo agli Sposi (unico invio automatico) e notifica al titolare
 * (in copia al videomaker nella pagina congiunta). Non lancia mai: la conferma resta valida comunque.
 */
export async function mailConferma(c: DatiConferma): Promise<void> {
  const db = supabaseServizio();
  const [imp, modelli, vm] = await Promise.all([
    db.from("impostazioni").select("marchio, colori, firma").single(),
    db.from("modello_messaggio").select("chiave, oggetto, corpo_mail")
      .in("chiave", ["conferma_sposi", "conferma_video", "conferma_video_duo"]),
    c.videomakerCodice
      ? db.from("collaboratore").select("nome, email, telefono").eq("codice", c.videomakerCodice).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const marchio = (imp.data?.marchio ?? {}) as Record<string, string | undefined>;
  const mittente = marchio.email;
  const titolare = marchio.titolare || marchio.nome || "";
  const da = mittente ? `${titolare} <${mittente}>` : "";
  const modello = (k: string) => modelli.data?.find((m) => m.chiave === k);
  const stile = stileDaColori(imp.data?.colori as Record<string, string> | null);
  const firma = { testo: imp.data?.firma || marchio.firma || titolare, html: marchio.firma_mail_html || undefined };
  const videomaker = vm.data as { nome: string; email: string | null; telefono: string | null } | null;

  // 1. Mail agli Sposi
  let esito: string;
  const t = modello("conferma_sposi");
  const destinatari = [...new Set(c.sposi.map((s) => s.email.trim().toLowerCase()).filter(Boolean))];
  if (!da) esito = "⚠️ Mail agli Sposi NON inviata: manca l'indirizzo mittente nelle impostazioni.";
  else if (!t?.corpo_mail || !t.oggetto) esito = "⚠️ Mail agli Sposi NON inviata: manca il modello \"conferma_sposi\" (premi Aggiorna i testi).";
  else {
    const valori: Record<string, string> = {
      NOMI: c.nomi, DATA_ESTESA: dataEstesa(c.dataInizio), DATA: data(c.dataInizio), LINK: c.link,
      TOTALE: euro(c.totaleFoto),
      VIDEOMAKER: videomaker?.nome ?? "", VIDEOMAKER_TELEFONO: videomaker?.telefono ?? "",
    };
    const paragrafoVideo = c.video.length ? modello(c.congiunta ? "conferma_video_duo" : "conferma_video")?.corpo_mail ?? "" : "";
    valori.VIDEO = paragrafoVideo ? riempi(paragrafoVideo, valori) + "\n" : "";
    const riepilogo = tabella(c.righeFoto, ["Totale servizi fotografici", euro(c.totaleFoto)], stile);
    const corpo = componi(riempi(t.corpo_mail, valori), { RIEPILOGO: riepilogo }, stile, firma);
    const r = await inviaMail({
      da, a: destinatari, rispondiA: mittente, oggetto: riempi(t.oggetto, valori),
      html: corpo.html, testo: corpo.testo, idempotenza: `conferma-sposi-${c.preventivoId}`,
    });
    esito = r.ok ? `📧 Mail di conferma inviata agli Sposi (${destinatari.join(", ")}).`
      : `⚠️ Mail agli Sposi NON inviata (${r.errore}): mandala tu.`;
    await db.from("invio").insert({
      matrimonio_id: c.matrimonioId, modello: "conferma_sposi", canale: "mail",
      stato: r.ok ? "inviato" : "errore", inviato_il: r.ok ? new Date().toISOString() : null,
      errore: r.ok ? null : r.errore,
    });
  }

  // 2. Notifica al titolare
  const destNotifica = marchio.email_notifiche || mittente;
  if (!da || !destNotifica) return;
  const notifica = corpoNotifica(c, esito, videomaker?.nome ?? null);
  await inviaMail({
    da, a: [destNotifica],
    cc: c.congiunta && videomaker?.email ? [videomaker.email] : undefined,
    oggetto: `✅ Conferma ${c.nomi} – ${data(c.dataInizio)}`,
    html: notifica.html, testo: notifica.testo, idempotenza: `conferma-notifica-${c.preventivoId}`,
  });
}

function corpoNotifica(c: DatiConferma, esito: string, videomaker: string | null): Blocco {
  const p = (html: string, stile = "") => `<p style="margin:14px 0 6px;${stile}">${html}</p>`;
  const righe = c.righeFoto.map((r, i): [string, string] => (i === 0 && c.formula ? [`${r[0]} (${c.formula})`, r[1]] : r));
  const tFoto = tabella(righe, ["Totale fotografia", euro(c.totaleFoto)]);
  const tVideo = c.video.length
    ? tabella(c.video.map((v) => [v.etichetta, euro(v.totale)]), ["Totale video", euro(c.totaleVideo)]) : null;
  const sposi = c.sposi.map((s, i) => ({
    titolo: `Sposa/o ${i + 1}`,
    t: tabella(([["Nome", s.nome], ["Telefono", s.telefono], ["Email", s.email], ["Codice fiscale", s.codice_fiscale],
      ["Indirizzo", s.indirizzo], ["Indirizzo preparativi", s.indirizzo_preparativi]] as [string, string][]).filter(([, v]) => v)),
  }));
  const pacchetto = c.congiunta
    ? (c.video.length ? `Pacchetto foto + video, totale ${euro(c.totaleFoto + c.totaleVideo)}` : "⚠️ Hanno tolto il video: solo fotografia a prezzo pieno")
    : "";

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#383838">` +
    p(`<b style="font-size:16px">${escH(c.nomi)}</b> hanno confermato il preventivo (${escH(c.codice)})`, "margin-top:0") +
    p(escH([data(c.dataInizio), c.location].filter(Boolean).join(" – "))) +
    p(escH(esito), "padding:8px 10px;background:#eef2ea") +
    p("<b>Fotografia</b>") + tFoto.html +
    (pacchetto ? p(escH(pacchetto), "padding:8px 10px;background:#f3f3f3") : "") +
    (tVideo ? p(`<b>Video</b> – contratto e pagamento con ${escH(videomaker ?? "il videomaker")}`) + tVideo.html : "") +
    sposi.map((s) => p(`<b>${s.titolo}</b>`) + s.t.html).join("") +
    p(`Consenso uso promozionale: <b>${c.consensoPromo ? "Sì" : "No"}</b>`) +
    (c.note ? p(`<b>Note</b><br>${escH(c.note).replace(/\n/g, "<br>")}`) : "") +
    p(`<a href="${escH(c.link)}">Apri la pagina</a>`, "color:#777") + `</div>`;

  const testo = [
    `${c.nomi} hanno confermato il preventivo (${c.codice})`, [data(c.dataInizio), c.location].filter(Boolean).join(" – "), "",
    esito, "", "FOTOGRAFIA", tFoto.testo, pacchetto,
    tVideo ? `VIDEO (con ${videomaker ?? "il videomaker"})\n${tVideo.testo}` : "",
    ...sposi.map((s) => `${s.titolo.toUpperCase()}\n${s.t.testo}`),
    `Consenso uso promozionale: ${c.consensoPromo ? "Sì" : "No"}`,
    c.note ? `\nNote:\n${c.note}` : "", "", `Pagina: ${c.link}`,
  ].filter((x) => x !== undefined).join("\n").replace(/\n{3,}/g, "\n\n");
  return { html, testo };
}
