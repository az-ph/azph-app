import "server-only";
import { supabaseSessione } from "@/lib/supabase/sessione";
import { nomiBrevi } from "@/lib/admin/stati";
import { calendarioCollegato, eliminaEvento, localeRoma, salvaEvento } from "@/lib/google/calendario";

const MINUTI_APPUNTAMENTO = 30;
const PREFISSO = "[FCO]";

/**
 * Allinea l'evento "[FCO] Nomi" all'appuntamento segnato in un contatto: lo crea, lo sposta o lo toglie.
 * Restituisce un avviso se il calendario non risponde (il contatto resta salvato).
 */
export async function sincronizzaAppuntamento(contattoId: string, base: string, eliminato?: { evento: string | null }): Promise<string | null> {
  if (eliminato) {
    if (eliminato.evento && calendarioCollegato()) { try { await eliminaEvento(eliminato.evento); } catch { return "Contatto eliminato, ma l'evento [FCO] è rimasto in calendario."; } }
    return null;
  }
  const supabase = await supabaseSessione();
  const { data: c } = await supabase.from("contatto")
    .select("id, matrimonio_id, canale, nota, appuntamento_il, appuntamento_evento, matrimonio ( codice_id, sposi:sposo ( ordine, nome, telefono ) )")
    .eq("id", contattoId).maybeSingle();
  if (!c || (!c.appuntamento_il && !c.appuntamento_evento)) return null;
  if (!calendarioCollegato()) return c.appuntamento_il ? "Contatto salvato. Calendario non collegato: evento [FCO] non creato." : null;
  try {
    if (!c.appuntamento_il) {
      await eliminaEvento(c.appuntamento_evento!);
      await supabase.from("contatto").update({ appuntamento_evento: null }).eq("id", c.id);
      return null;
    }
    const m = c.matrimonio as unknown as { codice_id: string; sposi: { ordine: number; nome: string | null; telefono: string | null }[] };
    const sposi = [...(m?.sposi ?? [])].sort((a, b) => a.ordine - b.ordine);
    const telefoni = sposi.filter((s) => s.telefono).map((s) => `${(s.nome ?? "").split(" ")[0]}: ${s.telefono}`);
    const id = await salvaEvento({
      titolo: `${PREFISSO} ${nomiBrevi(sposi) || m?.codice_id || ""}`.trim(), inizio: localeRoma(c.appuntamento_il), minuti: MINUTI_APPUNTAMENTO,
      descrizione: [c.nota, ...telefoni, `Scheda ${m?.codice_id ?? ""}: ${base}/admin/matrimoni/${c.matrimonio_id}`].filter(Boolean).join("\n"),
    }, c.appuntamento_evento);
    if (id !== c.appuntamento_evento) await supabase.from("contatto").update({ appuntamento_evento: id }).eq("id", c.id);
    return null;
  } catch (e) {
    return `Contatto salvato, ma l'evento [FCO] non è stato aggiornato (${e instanceof Error ? e.message : "errore"}).`;
  }
}
