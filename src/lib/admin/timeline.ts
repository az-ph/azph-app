/**
 * Timeline come testo, una riga per momento:
 *   "16.00 Rito civile | Villa Conti Cipolla"   ora (hh.mm o hh:mm, facoltativa), momento, luogo dopo "|"
 *   "# parcheggio sul retro"                     nota privata (mai agli Sposi)
 * L'ordine è quello delle righe; un orario più piccolo del precedente (dopo mezzanotte) passa al giorno dopo.
 */
export type RigaTimeline = { giorno: number; ordine: number; ora: string | null; fase: string; luogo: string | null; nota_privata: boolean };

export function leggiTimeline(testo: string): { righe: RigaTimeline[]; errori: string[] } {
  const righe: RigaTimeline[] = [];
  const errori: string[] = [];
  let giorno = 1, ultimoMinuto = -1;
  testo.split(/\r?\n/).forEach((grezza, n) => {
    const r = grezza.trim();
    if (!r) return;
    if (r.startsWith("#")) {
      const fase = r.replace(/^#+\s*/, "");
      if (fase) righe.push({ giorno, ordine: righe.length + 1, ora: null, fase, luogo: null, nota_privata: true });
      return;
    }
    const m = r.match(/^(\d{1,2})[.:](\d{2})\s+(.+)$/);
    let ora: string | null = null, resto = r;
    if (m) {
      const h = Number(m[1]), min = Number(m[2]);
      if (h > 23 || min > 59) { errori.push(`Riga ${n + 1}: orario ${m[1]}.${m[2]} non valido`); return; }
      const minuti = h * 60 + min;
      if (ultimoMinuto >= 0 && minuti < ultimoMinuto) giorno++;
      ultimoMinuto = minuti;
      ora = `${String(h).padStart(2, "0")}:${m[2]}`;
      resto = m[3];
    }
    const [fase, ...luogo] = resto.split("|").map((x) => x.trim());
    if (!fase) { errori.push(`Riga ${n + 1}: manca il momento`); return; }
    righe.push({ giorno, ordine: righe.length + 1, ora, fase: fase.slice(0, 300), luogo: luogo.join(" | ").slice(0, 300) || null, nota_privata: false });
  });
  return { righe, errori };
}

export function scriviTimeline(righe: { ora: string | null; fase: string; luogo: string | null; nota_privata: boolean }[]): string {
  return righe.map((r) => r.nota_privata
    ? `# ${r.fase}`
    : `${r.ora ? r.ora.slice(0, 5).replace(":", ".") + " " : ""}${r.fase}${r.luogo ? ` | ${r.luogo}` : ""}`).join("\n");
}
