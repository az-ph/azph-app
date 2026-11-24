/**
 * Composizione dei dati della pagina Sposi a partire dalle righe del database.
 * Funzione pura (testabile): decide il modo della pagina e filtra cosa può arrivare al browser.
 */

import { copertineAlbum, faseAlbum, passiAlbum, selezioneModificabile, testoCopertina, tipoAlbum, type BloccoAlbum, type RigaAlbum } from "./album";

export type Modo = "preventivo" | "sposi" | "chiuso" | "non_disponibile";

export interface RigheGrezze {
  matrimonio: {
    id: string; codice_id: string; stato: string; data_inizio: string | null; data_fine: string | null;
    preparativi: boolean | null; galleria_url: string | null; copertina_url: string | null;
    link_upyourshoot: string | null; pagina_congiunta: boolean;
    location: { nome: string; comune: string | null; provincia: string | null; galleria_url: string | null; copertina_url: string | null } | null;
    formula: { codice: string } | null;
    videomaker: { codice: string | null; nome: string } | null;
  };
  sposi: { ordine: number; nome: string | null; telefono: string | null; email: string | null; codice_fiscale: string | null;
    indirizzo: string | null; indirizzo_preparativi: string | null; consenso_promo: boolean }[];
  preventivo: { id: string; versione: number; opzioni: unknown; prezzi_speciali: unknown; preselezione: string[];
    scelte: string[]; inviato_il?: string | null; confermato_il: string | null;
    righe_confermate?: { voce: string; importo: number }[] | null } | null;
  listino: { codice: string; categoria: string; voce: string; descrizione: string | null; prezzo: number;
    prezzo_barrato: number | null; gruppo: string | null; collegata_a: string | null; solo_se: string | null;
    riepilogo: string | null; collaboratore: string | null; attiva: boolean }[];
  timeline: { giorno: number; ora: string | null; fase: string | null; luogo: string | null; nota_privata: boolean; ordine: number }[];
  importi: { voce: string; importo: number }[];
  pagamenti: { tipo: string; importo: number; scadenza: string | null; pagato_il: string | null }[];
  blocchi: { chiave: string; ordine: number; quando: string; dati: unknown }[];
  impostazioni: { marchio: unknown; zone: string[]; url_recensioni: string | null; condizioni_pagamento: string | null } | null;
  contratto: { id: string; testo: string } | null;
  album?: RigaAlbum | null;
}

export interface Blocco {
  chiave: string; sopratitolo?: string; titolo?: string; corpo?: string; banda?: boolean; gallerie?: boolean;
  passi?: [string, string][]; inclusi?: string[]; voce_prezzo?: string; dati?: [string, string][]; lista?: string[];
  link?: [string, string][]; nota?: string; citazioni?: [string, string][];
}

export interface Galleria { titolo: string; url: string }

// Solo queste voci del marchio arrivano al browser (niente indirizzi di notifica o altro di interno).
const MARCHIO_PUBBLICO = ["nome", "titolare", "firma", "motto", "logo_url", "copertina_url", "badges", "real_wedding_url", "email",
  "telefono", "sito", "instagram", "indirizzo", "localita", "codice_fiscale", "partita_iva", "iban", "intestatario"] as const;
export type Marchio = Partial<Record<(typeof MARCHIO_PUBBLICO)[number], string | string[]>>;

export function modoDaStato(stato: string): Modo {
  if (stato.startsWith("qte_")) return "preventivo";
  if (stato.startsWith("wdg_")) return "sposi";
  if (stato === "clo_completed") return "chiuso";
  return "non_disponibile";
}

/** "Titolo | url" oppure solo url, una per riga. */
export function leggiGallerie(testo: string | null | undefined): Galleria[] {
  return String(testo ?? "").split("\n").map((s) => s.trim()).filter(Boolean).map((s) => {
    const [titolo, url] = s.includes("|") ? s.split("|").map((x) => x.trim()) : ["Un real wedding pensato per voi", s];
    return { titolo, url };
  }).filter((g) => /^https?:\/\//.test(g.url));
}

/** "Anna Rossi", "Bruno Verdi" → "Anna e Bruno". */
export function nomiSposi(sposi: { nome: string | null }[]): string {
  return sposi.map((s) => (s.nome ?? "").trim().split(/\s+/)[0]).filter(Boolean).join(" e ");
}

export function componiPagina(r: RigheGrezze) {
  const m = r.matrimonio;
  const modo = modoDaStato(m.stato);
  const marchioGrezzo = (r.impostazioni?.marchio ?? {}) as Record<string, unknown>;
  const marchio = Object.fromEntries(MARCHIO_PUBBLICO.filter((k) => k in marchioGrezzo).map((k) => [k, marchioGrezzo[k]])) as Marchio;
  const congiunta = m.pagina_congiunta;

  const blocchi: Blocco[] = r.blocchi
    .filter((b) => b.quando === "sempre"
      || (modo === "preventivo" && (congiunta ? b.quando === "preventivo_duo" || (b.quando === "preventivo" && !["mi-presento", "reportage", "come-lavoro", "servizio", "video", "recensioni"].includes(b.chiave)) : b.quando === "preventivo"))
      || ((modo === "sposi" || modo === "chiuso") && b.quando === "sposi"))
    .map((b) => ({ chiave: b.chiave, ...(b.dati as object) }));

  return {
    modo,
    solaLettura: modo === "chiuso",
    matrimonio: {
      codice: m.codice_id,
      dataInizio: m.data_inizio,
      dataFine: m.data_fine,
      location: m.location?.nome ?? "",
      luogo: [m.location?.comune, m.location?.provincia].filter(Boolean).join(" "),
      copertina: m.copertina_url || m.location?.copertina_url || (marchio.copertina_url as string | undefined) || "",
      gallerie: [...leggiGallerie(m.galleria_url), ...leggiGallerie(m.location?.galleria_url),
        ...(marchio.real_wedding_url ? [{ titolo: "Tutti i real wedding", url: marchio.real_wedding_url as string }] : [])],
      galleriaSposi: modo === "preventivo" ? "" : (m.link_upyourshoot ?? ""),
      paginaCongiunta: congiunta,
      videomaker: m.videomaker?.nome ?? null,
    },
    nomi: nomiSposi(r.sposi),
    // Dati per precompilare il modulo: sono degli Sposi stessi, che hanno il link.
    sposi: r.sposi.map((s) => ({
      ordine: s.ordine, nome: s.nome ?? "", telefono: s.telefono ?? "", email: s.email ?? "",
      codice_fiscale: s.codice_fiscale ?? "", indirizzo: s.indirizzo ?? "", indirizzo_preparativi: s.indirizzo_preparativi ?? "",
      consenso_promo: s.consenso_promo,
    })),
    preventivo: r.preventivo ? {
      id: r.preventivo.id, versione: r.preventivo.versione, preselezione: r.preventivo.preselezione,
      scelte: r.preventivo.scelte, confermato: !!r.preventivo.confermato_il,
      inviato: r.preventivo.inviato_il ?? null,
      righe: Array.isArray(r.preventivo.righe_confermate) ? r.preventivo.righe_confermate : [],
    } : null,
    timeline: r.timeline.filter((t) => !t.nota_privata && t.fase)
      .map((t) => ({ giorno: t.giorno, ora: t.ora ? t.ora.slice(0, 5) : null, fase: t.fase as string, luogo: t.luogo })),
    importi: r.importi,
    pagamenti: r.pagamenti,
    blocchi,
    marchio,
    zone: r.impostazioni?.zone ?? [],
    urlRecensioni: modo === "preventivo" && /^https:\/\//.test(r.impostazioni?.url_recensioni ?? "") ? r.impostazioni!.url_recensioni! : null,
    contratto: r.contratto,
    album: componiAlbum(r, modo),
  };
}

/** Sezione album: solo nell'area Sposi e solo nelle fasi previste. L'indirizzo dell'anteprima si aggiunge sul server. */
function componiAlbum(r: RigheGrezze, modo: Modo) {
  if (modo !== "sposi" && modo !== "chiuso") return null;
  const a = r.album ?? null;
  const fase = faseAlbum(r.matrimonio.stato, a);
  if (!fase) return null;
  const grezzo = r.blocchi.find((b) => b.chiave === "album-sposi");
  const blocco = (grezzo?.dati ?? null) as BloccoAlbum | null;
  const imp = Object.fromEntries(r.importi.map((x) => [x.voce, x.importo]));
  const tipo = tipoAlbum({ tipo: a?.tipo, scelte: r.preventivo?.scelte ?? [], importoAlbum: imp.album ?? 0, blocco });
  const note = [(imp.album_genitori ?? 0) > 0 ? blocco?.genitori : "", blocco?.studio].filter((x): x is string => !!x);
  return {
    fase, tipo,
    sopratitolo: blocco?.sopratitolo ?? "", titolo: blocco?.titolo ?? "Il vostro Album", intro: blocco?.intro ?? "",
    passi: passiAlbum(blocco, tipo), note,
    copertine: copertineAlbum(blocco, tipo),
    modificabile: selezioneModificabile(r.matrimonio.stato, a),
    selezioneIl: a?.selezione_il ?? null,
    copertina: a?.copertina ?? "", copertinaNota: a?.copertina_nota ?? "", noteSposi: a?.note_sposi ?? "",
    copertinaTesto: a ? testoCopertina(blocco, a) : "",
    anteprimaIl: a?.anteprima_path ? a.anteprima_il : null,
    anteprimaPdf: !!a?.anteprima_path?.endsWith(".pdf"),
    approvatoIl: a?.approvato_il ?? null,
    modificheIl: a?.modifiche_il ?? null,
    /** Riempito dal server con un link temporaneo. */
    anteprimaUrl: "" as string,
  };
}

export type DatiPagina = ReturnType<typeof componiPagina>;
