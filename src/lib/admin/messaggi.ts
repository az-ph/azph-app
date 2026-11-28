/** Messaggi agli Sposi dall'area admin: testi pronti dai modelli, da ritoccare prima dell'invio. Funzioni pure. */
import { perWhatsapp, riempi } from "@/lib/mail/testo";

export const MESSAGGI = [
  { chiave: "preventivo", titolo: "Preventivo", segnaInviato: true },
  { chiave: "aggiornato", titolo: "Preventivo aggiornato", segnaInviato: true },
  { chiave: "follow_up", titolo: "Follow up", segnaInviato: false },
  { chiave: "duo", titolo: "Proposta foto + video", segnaInviato: true },
  { chiave: "sposi", titolo: "Area Sposi", segnaInviato: false },
  { chiave: "timeline", titolo: "Timeline aggiornata", segnaInviato: false },
  { chiave: "album", titolo: "Album", segnaInviato: false },
  { chiave: "album_pagina", titolo: "Album + pagina", segnaInviato: false },
  { chiave: "album_proposta", titolo: "Proposta album", segnaInviato: false },
] as const;
export type ChiaveMessaggio = (typeof MESSAGGI)[number]["chiave"];
export const CHIAVI_MESSAGGIO = MESSAGGI.map((m) => m.chiave) as [ChiaveMessaggio, ...ChiaveMessaggio[]];

export type Modello = { chiave: string; oggetto: string | null; corpo_mail: string | null; corpo_whatsapp: string | null };
export type Pronto = { chiave: ChiaveMessaggio; titolo: string; oggetto: string; mail: string; whatsapp: string; manca?: boolean };

/** "a" · "a e b" · "a, b e c" */
export function elenco(voci: string[]): string {
  return voci.length < 2 ? (voci[0] ?? "") : `${voci.slice(0, -1).join(", ")} e ${voci.at(-1)}`;
}

/**
 * Testi pronti per ogni messaggio. Restano {FIRMA} nella mail (nome breve nel testo, firma completa in coda)
 * e {NOME} su WhatsApp (il nome di chi riceve, scelto al momento dell'invio).
 */
export function preparaMessaggi(modelli: Modello[], valori: Record<string, string>, extra: { omaggi: string[]; video: boolean; firma: string; titoli?: Partial<Record<ChiaveMessaggio, string>>; galleria?: string }): Pronto[] {
  const trova = (k: string) => modelli.find((m) => m.chiave === k);
  const v: Record<string, string> = { ...valori };
  delete v.FIRMA; delete v.NOME;
  const omaggi = trova("preventivo_omaggi")?.corpo_mail;
  v.OMAGGI = extra.omaggi.length && omaggi ? riempi(omaggi, { ELENCO: elenco(extra.omaggi) }) : "";
  const video = trova("preventivo_video")?.corpo_mail;
  v.VIDEO = extra.video && video ? riempi(video, v) + "\n" : "";
  const galleria = trova("album_galleria")?.corpo_mail;
  v.GALLERIA = extra.galleria && galleria ? riempi(galleria, { URL: extra.galleria }) : "";

  return MESSAGGI.map(({ chiave, titolo: base }) => {
    const titolo = extra.titoli?.[chiave] || base;
    const m = trova(chiave);
    if (!m?.corpo_mail) return { chiave, titolo, oggetto: "", mail: "", whatsapp: "", manca: true };
    const mail = riempi(m.corpo_mail, v);
    const wa = m.corpo_whatsapp ? riempi(m.corpo_whatsapp, v) : mail.split("{FIRMA}").join(extra.firma);
    return { chiave, titolo, oggetto: riempi(m.oggetto ?? "", v), mail, whatsapp: perWhatsapp(wa) };
  });
}

/** Messaggio proposto all'apertura della scheda, in base a dove siamo con il preventivo. */
export function messaggioSuggerito(p: { confermato: boolean; inviato: boolean; congiunta: boolean; stato?: string; propostaAlbum?: boolean }): ChiaveMessaggio {
  if (p.stato === "wdg_album_todo") return "album";
  if (p.propostaAlbum) return "album_proposta";
  if (p.confermato) return "sposi";
  if (p.inviato) return "follow_up";
  return p.congiunta ? "duo" : "preventivo";
}

/** Numero per wa.me: solo cifre, prefisso 39 se manca. Null se non sembra un cellulare. */
export function numeroWhatsapp(tel: string | null | undefined): string | null {
  const n = (tel ?? "").replace(/[^\d+]/g, "").replace(/^\+/, "").replace(/^00/, "");
  if (!/^\d{9,15}$/.test(n)) return null;
  return /^3\d{8,9}$/.test(n) ? `39${n}` : n;
}

export const primoNome = (nome: string | null | undefined) => (nome ?? "").trim().split(/\s+/)[0] ?? "";
