/** Formati dell'interfaccia: euro da centesimi, date gg.mm.aaaa, date estese. */

const EURO = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

export function euro(centesimi: number): string {
  return EURO.format(centesimi / 100);
}

/** Senza decimali se tondo: 1.100 € / 1.287,57 €. */
export function euroBreve(centesimi: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency", currency: "EUR",
    minimumFractionDigits: centesimi % 100 ? 2 : 0, maximumFractionDigits: 2,
  }).format(centesimi / 100);
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
