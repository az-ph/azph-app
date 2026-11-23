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
export type Fonte = { codice: string; nome: string };

/** Fonti da proporre: quelle delle impostazioni, più i codici già usati nei Matrimoni (anche importati dal foglio) e quello attuale. */
export function unisciFonti(base: unknown, usate: (string | null)[], attuale?: string | null): Fonte[] {
  const elenco = new Map<string, string>();
  for (const f of Array.isArray(base) ? base : []) {
    const c = typeof f?.codice === "string" ? f.codice.trim() : "";
    if (c) elenco.set(c, typeof f.nome === "string" && f.nome.trim() ? f.nome.trim() : c);
  }
  for (const u of [...usate, attuale]) {
    const c = u?.trim();
    if (c && !elenco.has(c)) elenco.set(c, c);
  }
  return [...elenco].map(([codice, nome]) => ({ codice, nome }))
    .sort((a, b) => (a.codice === "ALTRO" ? 1 : b.codice === "ALTRO" ? -1 : a.codice.localeCompare(b.codice)));
}

/** Testo dell'opzione: "MAT · Matrimonio.com". */
export const etichettaFonte = (f: Fonte) => (f.nome === f.codice ? f.codice : `${f.codice} · ${f.nome}`);

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
