/** Evento [WDG]/[QTE] di un Matrimonio nel calendario del titolare. Funzioni pure. */
import type { EventoCalendario } from "@/lib/google/calendario";

export type DatiEvento = {
  codice: string; stato: string; fonte: string | null; nomi: string;
  dataInizio: string | null; dataFine: string | null; oraInizio: string | null; oraFine: string | null;
  luogo: string; telefoni: { nome: string; telefono: string }[]; scheda: string;
  timeline: { giorno: number; ora: string | null }[];
  esempio?: boolean;
};

/** Etichetta del calendario per lo stato, o null se l'evento non deve esserci (come il vecchio foglio). */
export function etichetta(stato: string): "QTE" | "WDG" | null {
  if (stato === "qte_quote") return "QTE";
  if (stato.startsWith("wdg_") || stato === "clo_completed") return "WDG";
  return null;
}

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);
const minuti = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
function piuGiorni(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function eventoMatrimonio(m: DatiEvento): EventoCalendario | null {
  const tag = etichetta(m.stato);
  if (!tag || !m.dataInizio || m.esempio) return null;
  const titolo = `[${tag}]${m.fonte ? `[${m.fonte}]` : ""} ${m.nomi}`;
  const descrizione = [
    ...m.telefoni.filter((t) => t.telefono).map((t) => `${t.nome}: ${t.telefono}`),
    `Scheda ${m.codice}: ${m.scheda}`,
  ].join("\n");
  const luogo = m.luogo || undefined;

  // Orari: quelli del Matrimonio, altrimenti dalla timeline (prima e ultima riga con l'ora)
  const conOra = m.timeline.filter((r) => r.ora).sort((a, b) => a.giorno - b.giorno || a.ora!.localeCompare(b.ora!));
  // 00.00 come ora di inizio arriva dal foglio quando la cella era vuota: si usa la timeline
  const inizio = (m.oraInizio && hhmm(m.oraInizio) !== "00:00" ? hhmm(m.oraInizio) : null) ?? hhmm(conOra[0]?.ora);
  const ultima = conOra.at(-1);
  const fine = hhmm(m.oraFine) ?? hhmm(ultima?.ora);
  const al = m.dataFine && m.dataFine > m.dataInizio ? m.dataFine : m.dataInizio; // data fine mancante o sbagliata
  if (!inizio || !fine) return { titolo, descrizione, luogo, giorni: { dal: m.dataInizio, al } };

  let giornoFine = m.dataFine && m.dataFine >= m.dataInizio ? m.dataFine : piuGiorni(m.dataInizio, m.oraFine ? 0 : Math.max(0, (ultima?.giorno ?? 1) - 1));
  if (giornoFine === m.dataInizio && minuti(fine) <= minuti(inizio)) giornoFine = piuGiorni(m.dataInizio, 1); // dopo mezzanotte
  const durata = Math.round((Date.parse(`${giornoFine}T${fine}:00Z`) - Date.parse(`${m.dataInizio}T${inizio}:00Z`)) / 60000);
  return { titolo, descrizione, luogo, inizio: `${m.dataInizio}T${inizio}`, minuti: Math.max(30, durata) };
}

/** Evento del vecchio foglio da riprendere: stesso giorno, [WDG]/[QTE] e gli stessi nomi. */
export function eventoDaRiprendere(eventi: { id: string; titolo: string }[], nomi: string): string | null {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  const n = norm(nomi);
  if (!n) return null;
  const trovati = eventi.filter((e) => /^\[(WDG|QTE)\]/i.test(e.titolo) && norm(e.titolo.replace(/^(\[[^\]]*\])+\s*/, "")) === n);
  return trovati.length === 1 ? trovati[0].id : null;
}
