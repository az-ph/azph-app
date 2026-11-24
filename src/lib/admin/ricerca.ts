/** Ricerca e filtri dell'elenco Matrimoni. Funzioni pure. */
import { data, dataEstesa } from "@/lib/formato";
import { ETICHETTA_STATO } from "@/lib/admin/stati";

export type VoceElenco = {
  id: string; codice: string; stato: string; data: string | null; nomi: string; location: string; fonte: string;
  token: string | null; senzaPreventivo: boolean;
};

export const FILTRI_STATO = [
  { k: "tutti", t: "Tutti", stati: null },
  { k: "contattare", t: "Da contattare", stati: ["qte_to_contact"] },
  { k: "preventivo", t: "Preventivo", stati: ["qte_quote"] },
  { k: "confermato", t: "Confermato", stati: ["wdg_confermato"] },
  { k: "lightroom", t: "Lightroom", stati: ["wdg_lightroom"] },
  { k: "saldo", t: "Saldo", stati: ["wdg_invoice"] },
  { k: "album", t: "Album", stati: ["wdg_album_todo", "wdg_album"] },
  { k: "chiusi", t: "Chiusi", stati: ["clo_completed"] },
  { k: "persi", t: "Persi", stati: ["clo_lost", "clo_no_answer"] },
] as const;
export type FiltroStato = (typeof FILTRI_STATO)[number]["k"];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Testo in cui cercare: nomi, codice, location, fonte, stato e la data in più forme (12.12.2026, 12/12, dicembre, sabato). */
function pagliaio(v: VoceElenco): string {
  return norm([v.nomi, v.codice, v.location, v.fonte, ETICHETTA_STATO[v.stato] ?? "", data(v.data), (data(v.data) || "").replace(/\./g, "/"), dataEstesa(v.data)].join(" "));
}

export function filtra(elenco: VoceElenco[], q: string, filtro: FiltroStato): VoceElenco[] {
  const parole = norm(q).split(/\s+/).filter(Boolean);
  const stati = FILTRI_STATO.find((f) => f.k === filtro)?.stati ?? null;
  return elenco.filter((v) => {
    // Senza ricerca e senza filtro, i chiusi e i persi restano fuori
    if (!stati && !parole.length && v.stato.startsWith("clo_")) return false;
    if (stati && !(stati as readonly string[]).includes(v.stato)) return false;
    if (!parole.length) return true;
    const p = pagliaio(v);
    return parole.every((w) => p.includes(w));
  });
}

export type Gruppo = { titolo: string; voci: VoceElenco[] };

/** Preventivi · Confermati da fare (dal giorno oggi in poi) · Fatti (data passata) · Chiusi e persi. */
export function raggruppa(elenco: VoceElenco[], oggi: string): Gruppo[] {
  const perData = (a: VoceElenco, b: VoceElenco) => (a.data ?? "9999").localeCompare(b.data ?? "9999");
  const wdg = elenco.filter((v) => v.stato.startsWith("wdg"));
  return [
    { titolo: "Preventivi", voci: elenco.filter((v) => v.stato.startsWith("qte")).sort(perData) },
    { titolo: "Confermati da fare", voci: wdg.filter((v) => !v.data || v.data >= oggi).sort(perData) },
    { titolo: "Confermati fatti", voci: wdg.filter((v) => v.data && v.data < oggi).sort((a, b) => perData(b, a)) },
    { titolo: "Chiusi e persi", voci: elenco.filter((v) => v.stato.startsWith("clo")).sort((a, b) => perData(b, a)) },
  ].filter((g) => g.voci.length);
}
