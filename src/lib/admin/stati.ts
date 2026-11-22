/** Stati del Matrimonio con le etichette dell'area admin, nell'ordine del flusso. */
export const STATI: { valore: string; etichetta: string }[] = [
  { valore: "qte_to_contact", etichetta: "Da contattare" },
  { valore: "qte_quote", etichetta: "Preventivo" },
  { valore: "wdg_confermato", etichetta: "Confermato" },
  { valore: "wdg_lightroom", etichetta: "Lightroom" },
  { valore: "wdg_invoice", etichetta: "Saldo" },
  { valore: "wdg_album_todo", etichetta: "Album da fare" },
  { valore: "wdg_album", etichetta: "Album" },
  { valore: "clo_completed", etichetta: "Chiuso" },
  { valore: "clo_lost", etichetta: "Perso" },
  { valore: "clo_no_answer", etichetta: "Nessuna risposta" },
];
export const ETICHETTA_STATO: Record<string, string> = Object.fromEntries(STATI.map((s) => [s.valore, s.etichetta]));
export const FONTI = ["MAT", "IGR", "FBO", "PSP", "WEB", "VDB", "ALTRO"];

/** Token dei link Sposi: 22 caratteri base62 da crypto. */
export function nuovoToken(lunghezza = 22): string {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const out: string[] = [];
  const buf = new Uint8Array(lunghezza * 2);
  while (out.length < lunghezza) {
    crypto.getRandomValues(buf);
    for (const b of buf) if (b < 248 && out.length < lunghezza) out.push(alfabeto[b % 62]); // niente sbilanciamento
  }
  return out.join("");
}

/** "Anna Rossi", "Luca Bianchi" → "Anna e Luca". */
export function nomiBrevi(sposi: { ordine: number; nome: string | null }[]): string {
  return [...sposi].sort((a, b) => a.ordine - b.ordine).map((s) => (s.nome ?? "").trim().split(/\s+/)[0]).filter(Boolean).join(" e ");
}

/** Prezzi speciali: { box: 0, servizio: 110000 } ⇄ "box = 0\nservizio = 1100". */
export function prezziInTesto(p: Record<string, number>): string {
  return Object.entries(p).map(([k, v]) => `${k} = ${(v / 100).toLocaleString("it-IT", { maximumFractionDigits: 2 }).replace(/\./g, "")}`).join("\n");
}
