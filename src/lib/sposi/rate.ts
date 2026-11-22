/**
 * Rate dei pagamenti dai totali per voce e dagli incassi registrati.
 * - Acconto: 50% dei servizi (album esclusi); se c'è un incasso di tipo "acconto" diverso dal calcolo,
 *   l'acconto diventa quanto incassato e il saldo si ricalcola (servizi − acconto).
 * - Saldo: servizi − acconto. Album: album + album genitori, a parte.
 * - Incassi "altro" (es. il totale importato dal foglio) coprono le rate in ordine: acconto, saldo, album.
 */
export type Incasso = { tipo: string; importo: number; pagato_il: string | null };
export type Rata = { tipo: "acconto" | "saldo" | "album"; dovuto: number; incassato: number; scadenza: string | null };

const GIORNI_SCADENZA_ACCONTO = 21;

export function calcolaRate(perVoce: Record<string, number>, incassi: Incasso[], dataMatrimonio?: string | null): Rata[] {
  const totale = Object.values(perVoce).reduce((s, v) => s + v, 0);
  const album = (perVoce.album ?? 0) + (perVoce.album_genitori ?? 0);
  const servizi = Math.max(0, totale - album);
  const pagati = incassi.filter((x) => x.pagato_il);
  const somma = (t: string[]) => pagati.filter((x) => t.includes(x.tipo)).reduce((s, x) => s + x.importo, 0);

  const accontoIncassato = somma(["acconto"]);
  const acconto = accontoIncassato > 0 ? Math.min(accontoIncassato, servizi) : Math.round(servizi / 2);
  const rate: Rata[] = [
    { tipo: "acconto", dovuto: acconto, incassato: accontoIncassato, scadenza: meno(dataMatrimonio, GIORNI_SCADENZA_ACCONTO) },
    { tipo: "saldo", dovuto: servizi - acconto, incassato: somma(["saldo"]), scadenza: null },
  ];
  if (album > 0) rate.push({ tipo: "album", dovuto: album, incassato: somma(["album", "album_genitori"]), scadenza: null });

  let altro = somma(["altro"]);
  for (const r of rate) {
    const usa = Math.min(altro, Math.max(0, r.dovuto - r.incassato));
    r.incassato += usa;
    altro -= usa;
  }
  return rate;
}

function meno(iso: string | null | undefined, giorni: number): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - giorni);
  return d.toISOString().slice(0, 10);
}
