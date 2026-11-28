/** Automatismi del controllo giornaliero: cambi di stato. Funzione pura, come le regole del vecchio foglio. */
import type { MatrimonioOggi } from "./oggi";

export type Cambio = { id: string; codice: string; nomi: string; da: string; a: string; motivo: string };

/** Totale delle voci (album compreso) e incassato. */
export function conti(m: Pick<MatrimonioOggi, "importi" | "incassi">) {
  const totale = Object.values(m.importi).reduce((t, x) => t + (x ?? 0), 0);
  const incassato = m.incassi.reduce((t, x) => t + (x.importo ?? 0), 0);
  return { totale, incassato };
}

/**
 * - Confermato con il giorno del Matrimonio passato → Lightroom.
 * - Saldo con tutto incassato (album compreso: se è ancora da pagare non si chiude) → Chiuso.
 */
export function cambiDelGiorno(elenco: MatrimonioOggi[], oggi: string): Cambio[] {
  const out: Cambio[] = [];
  for (const m of elenco) {
    if (m.stato === "wdg_confermato" && m.data && m.data < oggi) {
      out.push({ id: m.id, codice: m.codice, nomi: m.nomi, da: m.stato, a: "wdg_lightroom", motivo: "Matrimonio fatto" });
    }
    if (m.stato === "wdg_invoice") {
      const { totale, incassato } = conti(m);
      if (totale > 0 && incassato >= totale) out.push({ id: m.id, codice: m.codice, nomi: m.nomi, da: m.stato, a: "clo_completed", motivo: "tutto incassato" });
    }
  }
  return out;
}
