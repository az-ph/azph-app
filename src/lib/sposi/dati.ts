import "server-only";
import { supabaseServizio } from "@/lib/supabase/server";
import type { VoceListino, Categoria, Preventivo } from "@/lib/listino/motore";
import { componiPagina, type RigheGrezze, type DatiPagina } from "./componi";

/** Il token deve avere la forma giusta prima ancora di toccare il database. */
export const TOKEN_VALIDO = /^[0-9A-Za-z]{22,64}$/;

export async function matrimonioDaToken(token: string): Promise<string | null> {
  if (!TOKEN_VALIDO.test(token)) return null;
  const db = supabaseServizio();
  const { data } = await db.from("link_sposi").select("matrimonio_id")
    .eq("token", token).is("revocato_il", null).maybeSingle();
  return data?.matrimonio_id ?? null;
}

/**
 * Tutto ciò che serve alla pagina Sposi di UN matrimonio. Solo campi elencati:
 * mai note_private, righe di timeline private, dati di altri matrimoni o impostazioni interne.
 */
export async function caricaPagina(mid: string): Promise<{
  pagina: DatiPagina;
  /** Solo lato server: serve a calcolare l'offerta. */
  calcolo: { listino: VoceListino[]; preventivo: Preventivo | null; preventivoId: string | null };
}> {
  const db = supabaseServizio();
  const [m, sposi, prev, listino, timeline, importi, pagamenti, blocchi, imp, contratto] = await Promise.all([
    db.from("matrimonio").select(
      "id, codice_id, stato, data_inizio, data_fine, preparativi, galleria_url, copertina_url, link_upyourshoot, pagina_congiunta, " +
      "location:location_id ( nome, comune, provincia, galleria_url, copertina_url ), " +
      "formula:formula_id ( codice ), videomaker:videomaker_id ( codice, nome )",
    ).eq("id", mid).single(),
    db.from("sposo").select("ordine, nome, telefono, email, codice_fiscale, indirizzo, indirizzo_preparativi, consenso_promo")
      .eq("matrimonio_id", mid).order("ordine"),
    db.from("preventivo").select("id, versione, opzioni, prezzi_speciali, preselezione, scelte, confermato_il")
      .eq("matrimonio_id", mid).order("versione", { ascending: false }).limit(1).maybeSingle(),
    db.from("voce_listino").select("codice, categoria, voce, descrizione, prezzo, prezzo_barrato, gruppo, collegata_a, solo_se, riepilogo, collaboratore, attiva")
      .eq("attiva", true).order("ordine"),
    db.from("timeline").select("giorno, ora, fase, luogo, nota_privata, ordine")
      .eq("matrimonio_id", mid).eq("nota_privata", false).order("giorno").order("ordine"),
    db.from("importo").select("voce, importo").eq("matrimonio_id", mid),
    db.from("pagamento").select("tipo, importo, scadenza, pagato_il").eq("matrimonio_id", mid).order("scadenza"),
    db.from("blocco_pagina").select("chiave, ordine, quando, dati").order("ordine"),
    db.from("impostazioni").select("marchio, zone, url_recensioni, condizioni_pagamento").single(),
    db.from("contratto_versione").select("id, testo").order("valido_dal", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (m.error || !m.data) throw new Error("Matrimonio non trovato");

  const pagina = componiPagina({
    matrimonio: m.data as unknown as RigheGrezze["matrimonio"],
    sposi: sposi.data ?? [],
    preventivo: prev.data,
    listino: listino.data ?? [],
    timeline: timeline.data ?? [],
    importi: importi.data ?? [],
    pagamenti: pagamenti.data ?? [],
    blocchi: blocchi.data ?? [],
    impostazioni: imp.data,
    contratto: contratto.data,
  });
  const riga = m.data as unknown as RigheGrezze["matrimonio"];
  return {
    pagina,
    calcolo: {
      listino: listinoDaRighe(listino.data ?? []),
      preventivo: prev.data ? preventivoDaRiga(prev.data, riga.formula?.codice, riga.pagina_congiunta) : null,
      preventivoId: prev.data?.id ?? null,
    },
  };
}

/** Tracciamento interno: nessun IP, nessun cookie. */
export async function registraEvento(mid: string, tipo: "apertura" | "selezione" | "deselezione", dettaglio: object = {}) {
  await supabaseServizio().from("evento_pagina").insert({ matrimonio_id: mid, tipo, dettaglio });
}

export function listinoDaRighe(righe: RigheGrezze["listino"]): VoceListino[] {
  return righe.map((r) => ({
    codice: r.codice, categoria: r.categoria as Categoria, voce: r.voce, descrizione: r.descrizione ?? undefined,
    prezzo: r.prezzo, prezzoBarrato: r.prezzo_barrato ?? undefined, gruppo: r.gruppo ?? undefined,
    collegataA: r.collegata_a ?? undefined, soloSe: r.solo_se ?? undefined, riepilogo: r.riepilogo ?? undefined,
    collaboratore: r.collaboratore ?? undefined, attiva: r.attiva,
  }));
}

export function preventivoDaRiga(p: NonNullable<RigheGrezze["preventivo"]>, formula: string | undefined, congiunta: boolean): Preventivo {
  return {
    formula,
    opzioni: (p.opzioni ?? {}) as Preventivo["opzioni"],
    prezziSpeciali: (p.prezzi_speciali ?? {}) as Record<string, number>,
    paginaCongiunta: congiunta,
  };
}
