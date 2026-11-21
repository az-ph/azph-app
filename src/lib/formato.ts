/** Formati dell'interfaccia: euro da centesimi, date gg.mm.aaaa, date estese. */

/** "1.100,00 €": il punto delle migliaia anche sotto 10.000 (Intl in italiano non lo mette). */
export function euro(centesimi: number): string {
  const [i, d] = (Math.abs(centesimi) / 100).toFixed(2).split(".");
  return (centesimi < 0 ? "-" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + d + " €";
}

/** Senza decimali se tondo: 1.100 € / 1.287,57 €. */
export function euroBreve(centesimi: number): string {
  return centesimi % 100 ? euro(centesimi) : euro(centesimi).replace(",00 €", " €");
}

export function data(iso: string | null | undefined): string {
  if (!iso) return "";
  const [a, m, g] = iso.slice(0, 10).split("-");
  return `${g}.${m}.${a}`;
}

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

export function dataEstesa(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso.slice(0, 10) + "T12:00:00Z");
  return `${GIORNI[d.getUTCDay()]} ${d.getUTCDate()} ${MESI[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "15:30" → "15.30" */
export function ora(hhmm: string | null | undefined): string {
  return hhmm ? hhmm.slice(0, 5).replace(":", ".") : "";
}
