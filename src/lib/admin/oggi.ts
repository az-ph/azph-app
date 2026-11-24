/** Schermata Oggi: cosa fare adesso, calcolato dai dati dei Matrimoni. Funzione pura. */
import { calcolaRate, type Incasso } from "@/lib/sposi/rate";

export type MatrimonioOggi = {
  id: string; codice: string; nomi: string; stato: string; data: string | null; kickoff: string | null;
  preventivo: { inviato: string | null; confermato: string | null } | null;
  aperture: number; ultimaApertura: string | null;
  importi: Record<string, number>; incassi: Incasso[];
  /** Invii e follow-up: dall'app (mail, WhatsApp) e segnati a mano. */
  contatti?: Contatto[];
};
export type Contatto = { tipo: "invio" | "follow_up"; il: string; canale: string; prossimo?: string | null };

/** Primo invio del preventivo, ultimo contatto e data del prossimo follow-up (se fissata sull'ultimo contatto). */
export function storiaContatti(m: MatrimonioOggi) {
  const c = [...(m.contatti ?? [])];
  if (m.preventivo?.inviato) c.push({ tipo: "invio", il: m.preventivo.inviato, canale: "app" });
  c.sort((a, b) => a.il.localeCompare(b.il));
  const invio = c.find((x) => x.tipo === "invio") ?? null;
  const ultimo = c.at(-1) ?? null;
  return { invio, ultimo, prossimo: ultimo?.prossimo ?? null, followUp: c.filter((x) => x.tipo === "follow_up").length };
}
export type Pagamento = { m: MatrimonioOggi; rata: "acconto" | "saldo" | "album"; manca: number; scadenza: string | null; scaduto: boolean };

export const GIORNI_KICKOFF = 28;
export const GIORNI_FOLLOWUP = 7;
export const GIORNI_PROSSIMI = 14;
const GIORNI_PREAVVISO_PAGAMENTO = 7;

function giorni(da: string, a: string): number {
  return Math.round((Date.parse(a.slice(0, 10)) - Date.parse(da.slice(0, 10))) / 86400000);
}

export function cosaFare(elenco: MatrimonioOggi[], oggi: string) {
  const futuro = (m: MatrimonioOggi) => !!m.data && m.data >= oggi;
  const confermati = elenco.filter((m) => m.stato.startsWith("wdg"));
  const preventivi = elenco.filter((m) => m.stato.startsWith("qte"));

  // Soldi: acconti scaduti o in scadenza; saldi e album per chi è nello stato Saldo
  const pagamenti: Pagamento[] = [];
  for (const m of confermati) {
    if (!Object.keys(m.importi).length) continue;
    for (const r of calcolaRate(m.importi, m.incassi, m.data)) {
      const manca = r.dovuto - r.incassato;
      if (manca <= 0) continue;
      if (r.tipo === "acconto" && r.scadenza && giorni(oggi, r.scadenza) <= GIORNI_PREAVVISO_PAGAMENTO && m.stato === "wdg_confermato")
        pagamenti.push({ m, rata: "acconto", manca, scadenza: r.scadenza, scaduto: r.scadenza < oggi });
      if (r.tipo !== "acconto" && m.stato === "wdg_invoice")
        pagamenti.push({ m, rata: r.tipo, manca, scadenza: null, scaduto: false });
    }
  }
  pagamenti.sort((a, b) => Number(b.scaduto) - Number(a.scaduto) || (a.scadenza ?? "9").localeCompare(b.scadenza ?? "9"));

  const kickoff = confermati
    .filter((m) => m.stato === "wdg_confermato" && futuro(m) && !m.kickoff && giorni(oggi, m.data!) <= GIORNI_KICKOFF)
    .sort((a, b) => a.data!.localeCompare(b.data!));

  const daInviare = preventivi.filter((m) => !storiaContatti(m).invio).sort((a, b) => a.codice.localeCompare(b.codice));
  const followup = preventivi
    .filter((m) => {
      const st = storiaContatti(m);
      if (!st.invio || m.preventivo?.confermato) return false;
      return st.prossimo ? st.prossimo <= oggi : giorni(st.ultimo!.il, oggi) >= GIORNI_FOLLOWUP;
    })
    .sort((a, b) => storiaContatti(a).ultimo!.il.localeCompare(storiaContatti(b).ultimo!.il));

  const prossimi = confermati.filter((m) => futuro(m) && giorni(oggi, m.data!) <= GIORNI_PROSSIMI).sort((a, b) => a.data!.localeCompare(b.data!));

  return { pagamenti, kickoff, daInviare, followup, prossimi };
}

export const giorniTra = giorni;
