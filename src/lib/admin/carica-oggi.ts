/**
 * Dati della schermata Oggi, letti con il client passato: la sessione admin (pagina) o il service role (controllo giornaliero).
 * Niente "server-only" qui: lo usa anche lo script delle 6.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { STATI, nomiBrevi } from "./stati";
import { cosaFare, type MatrimonioOggi } from "./oggi";
import { STATI_PROPOSTA, faseAlbum, piuMesi, type BloccoAlbum, type FaseAlbum, type RigaAlbum } from "@/lib/sposi/album";

export const APERTI = STATI.map((s) => s.valore).filter((v) => v.startsWith("qte") || v.startsWith("wdg"));
/** Dopo la consegna delle foto: stati in cui si chiede la recensione. */
export const STATI_RECENSIONE = ["wdg_invoice", "wdg_album_todo", "wdg_album", "clo_completed"];
export const GIORNI_RECENSIONE = 3;
const FASE_MIA = ["selezione", "modifiche"];

/** "aaaa-mm-gg" + n giorni */
export const piuGiorni = (d: string, n: number) => new Date(Date.parse(d + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
export const oggiRoma = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });

type Sposo = { ordine: number; nome: string | null };
export type Semplice = { id: string; nomi: string; consegna: string };

export async function caricaOggi(supabase: SupabaseClient, oggi = oggiRoma()) {
  const { data: righe, error } = await supabase.from("matrimonio")
    .select("id, codice_id, stato, data_inizio, kickoff_il, sposi:sposo ( ordine, nome ), preventivo ( versione, inviato_il, confermato_il )")
    .in("stato", APERTI).eq("esempio", false);
  if (error) return { errore: error.message } as const;
  const ids = (righe ?? []).map((m) => m.id);
  const idsPreventivi = (righe ?? []).filter((m) => m.stato.startsWith("qte")).map((m) => m.id);
  const idsAlbum = (righe ?? []).filter((m) => m.stato === "wdg_album_todo" || m.stato === "wdg_album").map((m) => m.id);
  const [importi, incassi, aperture, contatti, invii, album, blk, rec] = await Promise.all([
    supabase.from("importo").select("matrimonio_id, voce, importo").in("matrimonio_id", ids),
    supabase.from("pagamento").select("matrimonio_id, tipo, importo, pagato_il").in("matrimonio_id", ids),
    supabase.from("evento_pagina").select("matrimonio_id, avvenuto_il").eq("tipo", "apertura").in("matrimonio_id", idsPreventivi),
    supabase.from("contatto").select("matrimonio_id, tipo, canale, avvenuto_il, prossimo_il").in("matrimonio_id", idsPreventivi),
    supabase.from("invio").select("matrimonio_id, modello, canale, inviato_il").eq("stato", "inviato").in("modello", ["preventivo", "aggiornato", "duo", "follow_up"]).in("matrimonio_id", idsPreventivi),
    supabase.from("album").select("matrimonio_id, tipo, selezione_il, copertina, copertina_nota, note_sposi, anteprima_path, anteprima_nome, anteprima_il, approvato_il, modifiche_il, note_modifiche").in("matrimonio_id", idsAlbum),
    supabase.from("blocco_pagina").select("dati").eq("chiave", "album-sposi").maybeSingle(),
    // Recensione: foto consegnate da almeno 3 giorni, non ancora arrivata né chiesta
    supabase.from("matrimonio").select("id, codice_id, foto_consegnate_il, sposi:sposo ( ordine, nome )")
      .in("stato", STATI_RECENSIONE).eq("esempio", false).eq("recensione_ricevuta", false).is("recensione_chiesta_il", null)
      .lte("foto_consegnate_il", piuGiorni(oggi, -GIORNI_RECENSIONE)),
  ]);

  const elenco: MatrimonioOggi[] = (righe ?? []).map((m) => {
    const p = [...(m.preventivo as { versione: number; inviato_il: string | null; confermato_il: string | null }[])].sort((a, b) => b.versione - a.versione)[0];
    const ap = (aperture.data ?? []).filter((x) => x.matrimonio_id === m.id).map((x) => x.avvenuto_il).sort();
    return {
      id: m.id, codice: m.codice_id, stato: m.stato, data: m.data_inizio, kickoff: m.kickoff_il,
      nomi: nomiBrevi(m.sposi as Sposo[]) || m.codice_id,
      preventivo: p ? { inviato: p.inviato_il, confermato: p.confermato_il } : null,
      aperture: ap.length, ultimaApertura: ap.at(-1) ?? null,
      importi: Object.fromEntries((importi.data ?? []).filter((x) => x.matrimonio_id === m.id).map((x) => [x.voce, x.importo])),
      incassi: (incassi.data ?? []).filter((x) => x.matrimonio_id === m.id),
      contatti: [
        ...(contatti.data ?? []).filter((x) => x.matrimonio_id === m.id)
          .map((x) => ({ tipo: x.tipo as "invio" | "follow_up", il: x.avvenuto_il, canale: x.canale, prossimo: x.prossimo_il })),
        ...(invii.data ?? []).filter((x) => x.matrimonio_id === m.id && x.inviato_il)
          .map((x) => ({ tipo: (x.modello === "follow_up" ? "follow_up" : "invio") as "invio" | "follow_up", il: x.inviato_il!, canale: x.canale })),
      ],
    };
  });
  const f = cosaFare(elenco, oggi);

  // Album da proporre: foto consegnate da almeno N giorni, senza album, proposta non ancora fatta
  const prop = (blk.data?.dati as BloccoAlbum | null)?.proposta;
  const daProporre: Semplice[] = [];
  if (prop?.mesi) {
    const { data: cand } = await supabase.from("matrimonio")
      .select("id, codice_id, foto_consegnate_il, sposi:sposo ( ordine, nome ), importo ( voce, importo )")
      .in("stato", STATI_PROPOSTA).eq("esempio", false).is("album_proposto_il", null)
      .lte("foto_consegnate_il", piuGiorni(oggi, -(prop.giorni_promemoria ?? 14))).gte("foto_consegnate_il", piuMesi(oggi, -prop.mesi));
    for (const m of cand ?? []) {
      if ((m.importo as { voce: string; importo: number }[]).some((x) => x.voce === "album" && x.importo > 0)) continue;
      daProporre.push({ id: m.id, nomi: nomiBrevi(m.sposi as Sposo[]) || m.codice_id, consegna: m.foto_consegnate_il! });
    }
  }

  // Album: chi aspetta qualcosa da me (impaginare, nuova versione) e chi aspetta gli Sposi
  const albumDaSeguire = elenco.filter((m) => idsAlbum.includes(m.id)).map((m) => {
    const a = (album.data ?? []).find((x) => x.matrimonio_id === m.id) as RigaAlbum | undefined;
    return { m, a, fase: faseAlbum(m.stato, a ?? null) as FaseAlbum | null, mia: false };
  }).map((x) => ({ ...x, mia: FASE_MIA.includes(x.fase ?? "") })).sort((x, y) => Number(y.mia) - Number(x.mia));

  const recensioni: Semplice[] = (rec.data ?? []).map((m) => ({ id: m.id, nomi: nomiBrevi(m.sposi as Sposo[]) || m.codice_id, consegna: m.foto_consegnate_il! }));

  return { elenco, f, daProporre, albumDaSeguire, recensioni, oggi };
}
