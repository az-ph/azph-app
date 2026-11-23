import "server-only";
import { supabaseSessione } from "@/lib/supabase/sessione";
import { STATI, nomiBrevi } from "@/lib/admin/stati";
import { impegniNelGiorno, type Impegno } from "./impegni";

export type ControlloData = {
  matrimoni: { id: string; codice: string; nomi: string; stato: string }[];
  impegni: Impegno[];
  calendario: "ok" | "non_impostato" | "errore";
};

/**
 * Cosa c'è già in una data: altri Matrimoni (preventivi e confermati) e gli impegni del calendario del titolare.
 * Il calendario si legge dall'indirizzo segreto iCal (CALENDARIO_ICS_URL, solo sul server); niente viene salvato.
 */
export async function controllaData(iso: string, escludi?: string): Promise<ControlloData> {
  const supabase = await supabaseSessione();
  const q = supabase.from("matrimonio").select("id, codice_id, stato, sposi:sposo ( ordine, nome )")
    .or(`data_inizio.eq.${iso},and(data_inizio.lte.${iso},data_fine.gte.${iso})`)
    .in("stato", STATI.map((x) => x.valore).filter((v) => v.startsWith("qte") || v.startsWith("wdg")));
  const [{ data: righe }, cal] = await Promise.all([escludi ? q.neq("id", escludi) : q, leggiCalendario(iso)]);
  return {
    matrimoni: (righe ?? []).map((m) => ({ id: m.id, codice: m.codice_id, stato: m.stato, nomi: nomiBrevi(m.sposi as { ordine: number; nome: string | null }[]) })),
    ...cal,
  };
}

async function leggiCalendario(iso: string): Promise<Pick<ControlloData, "impegni" | "calendario">> {
  const url = process.env.CALENDARIO_ICS_URL;
  if (!url || !/^https:\/\//.test(url)) return { impegni: [], calendario: "non_impostato" };
  try {
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!r.ok) return { impegni: [], calendario: "errore" };
    // Gli eventi [QTE]/[WDG] creati dal vecchio foglio sono già i Matrimoni del database
    const impegni = impegniNelGiorno(await r.text(), iso).filter((x) => !/^\[(QTE|WDG)\]/i.test(x.titolo));
    return { impegni, calendario: "ok" };
  } catch {
    return { impegni: [], calendario: "errore" };
  }
}
