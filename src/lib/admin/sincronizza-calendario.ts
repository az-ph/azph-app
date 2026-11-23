import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nomiBrevi, primoNomeDi } from "@/lib/admin/stati";
import { calendarioCollegato, eliminaEvento, eventiNeiGiorni, salvaEvento } from "@/lib/google/calendario";
import { eventoDaRiprendere, eventoMatrimonio } from "./evento-matrimonio";

type Db = SupabaseClient;

/**
 * Crea, aggiorna o toglie l'evento [WDG]/[QTE] del Matrimonio nel calendario del titolare.
 * Non lancia: restituisce un avviso se Google non risponde (i dati restano salvati).
 */
export async function sincronizzaMatrimonio(db: Db, mid: string, base: string): Promise<string | null> {
  if (!calendarioCollegato()) return null;
  const [{ data: m }, { data: tl }] = await Promise.all([
    db.from("matrimonio").select("codice_id, stato, fonte, data_inizio, data_fine, ora_inizio, ora_fine, calendario_evento, location ( nome, comune ), sposi:sposo ( ordine, nome, telefono )").eq("id", mid).maybeSingle(),
    db.from("timeline").select("giorno, ora").eq("matrimonio_id", mid),
  ]);
  if (!m) return null;
  const sposi = ((m.sposi ?? []) as { ordine: number; nome: string | null; telefono: string | null }[]).sort((a, b) => a.ordine - b.ordine);
  const locGrezza = m.location as unknown as { nome: string; comune: string | null } | { nome: string; comune: string | null }[] | null;
  const loc = Array.isArray(locGrezza) ? locGrezza[0] ?? null : locGrezza;
  const nomi = nomiBrevi(sposi) || m.codice_id;
  const evento = eventoMatrimonio({
    codice: m.codice_id, stato: m.stato, fonte: m.fonte, nomi,
    dataInizio: m.data_inizio, dataFine: m.data_fine, oraInizio: m.ora_inizio, oraFine: m.ora_fine,
    luogo: loc ? [loc.nome, loc.comune].filter(Boolean).join(" - ") : "",
    telefoni: sposi.map((s) => ({ nome: primoNomeDi(s.nome), telefono: s.telefono ?? "" })),
    scheda: `${base}/admin/matrimoni/${mid}`, timeline: (tl ?? []) as { giorno: number; ora: string | null }[],
  });
  try {
    if (!evento) {
      if (m.calendario_evento) {
        await eliminaEvento(m.calendario_evento);
        await db.from("matrimonio").update({ calendario_evento: null }).eq("id", mid);
      }
      return null;
    }
    let id = m.calendario_evento as string | null;
    if (!id && m.data_inizio) id = eventoDaRiprendere(await eventiNeiGiorni(m.data_inizio, m.data_fine ?? m.data_inizio), nomi);
    const nuovo = await salvaEvento(evento, id);
    if (nuovo !== m.calendario_evento) await db.from("matrimonio").update({ calendario_evento: nuovo }).eq("id", mid);
    return null;
  } catch (e) {
    return `Dati salvati, ma il calendario non è stato aggiornato (${e instanceof Error ? e.message : "errore"}).`;
  }
}

/** Tutti i Matrimoni aperti o chiusi con un evento, a blocchi entro un tempo massimo: restituisce quanti ne restano. */
export async function sincronizzaTutti(db: Db, base: string, dopo: string | null, msMax = 7000) {
  const inizio = Date.now();
  const { data } = await db.from("matrimonio").select("id, stato, calendario_evento").order("id");
  const elenco = (data ?? []).filter((m) => m.calendario_evento || m.stato.startsWith("wdg_") || m.stato === "qte_quote")
    .filter((m) => !dopo || m.id > dopo);
  let fatti = 0;
  const avvisi: string[] = [];
  for (const m of elenco) {
    if (Date.now() - inizio > msMax) break;
    const a = await sincronizzaMatrimonio(db, m.id, base);
    if (a) avvisi.push(a);
    fatti++;
  }
  return { fatti, restano: elenco.length - fatti, ultimo: elenco[fatti - 1]?.id ?? dopo, avvisi: [...new Set(avvisi)].slice(0, 3) };
}
