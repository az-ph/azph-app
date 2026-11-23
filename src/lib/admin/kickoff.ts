import "server-only";
import { supabaseSessione } from "@/lib/supabase/sessione";
import { nomiBrevi } from "@/lib/admin/stati";
import { calendarioCollegato, eliminaEvento, localeRoma, salvaEvento } from "@/lib/google/calendario";

const MINUTI_KICKOFF = 30;

/**
 * Allinea l'evento "[KOM] Nomi" nel calendario del titolare alla data del kick-off del Matrimonio:
 * lo crea, lo sposta o lo toglie. Restituisce un avviso se il calendario non risponde (la data resta salvata).
 */
export async function sincronizzaKickoff(mid: string, base: string): Promise<string | null> {
  const supabase = await supabaseSessione();
  const { data: m } = await supabase.from("matrimonio")
    .select("codice_id, kickoff_il, kickoff_evento, sposi:sposo ( ordine, nome )").eq("id", mid).maybeSingle();
  if (!m || (!m.kickoff_il && !m.kickoff_evento)) return null;
  if (!calendarioCollegato()) return m.kickoff_il ? "Data salvata. Calendario non ancora collegato: evento [KOM] non creato." : null;
  try {
    if (!m.kickoff_il) {
      if (m.kickoff_evento) await eliminaEvento(m.kickoff_evento);
      if (m.kickoff_evento) await supabase.from("matrimonio").update({ kickoff_evento: null }).eq("id", mid);
      return null;
    }
    const nomi = nomiBrevi(m.sposi as { ordine: number; nome: string | null }[]) || m.codice_id;
    const id = await salvaEvento({
      titolo: `[KOM] ${nomi}`, inizio: localeRoma(m.kickoff_il), minuti: MINUTI_KICKOFF,
      descrizione: `Kick-off meeting · ${m.codice_id}\nScheda: ${base}/admin/matrimoni/${mid}`,
    }, m.kickoff_evento);
    if (id !== m.kickoff_evento) await supabase.from("matrimonio").update({ kickoff_evento: id }).eq("id", mid);
    return null;
  } catch (e) {
    return `Data salvata, ma l'evento in calendario non è stato aggiornato (${e instanceof Error ? e.message : "errore"}).`;
  }
}
