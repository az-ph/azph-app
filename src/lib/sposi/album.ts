import { calcolaOfferta, type Preventivo, type VoceListino, type VoceOfferta } from "@/lib/listino/motore";

/**
 * Percorso dell'album nella pagina Sposi. Funzioni pure (testabili).
 * Testi, copertine e codici del listino arrivano dal blocco "album-sposi" dell'istanza.
 */

export type TipoAlbum = "standard" | "premium";

export type Copertina = { valore: string; etichetta: string; nota?: string };

export interface BloccoAlbum {
  sopratitolo?: string;
  titolo?: string;
  intro?: string;
  passi?: { standard?: [string, string][]; premium?: [string, string][] };
  copertine?: { standard?: Copertina[]; premium?: Copertina[] };
  genitori?: string;
  studio?: string;
  /** Codici del listino: decidono il tipo solo quando manca l'importo dell'album. */
  codici?: { standard?: string; premium?: string };
  /** Da questo importo (centesimi) l'album è Premium, sotto è Standard. */
  soglia_premium?: number;
  /** Proposta dell'album a chi non l'ha preso: testi e mesi dalla consegna delle foto. */
  proposta?: { sopratitolo?: string; titolo?: string; corpo?: string; mesi?: number; giorni_promemoria?: number };
}

export interface RigaAlbum {
  scelto_il?: string | null;
  scelta?: { voce: string; importo: number }[] | null;
  tipo: TipoAlbum | null;
  selezione_il: string | null;
  copertina: string | null;
  copertina_nota: string | null;
  note_sposi: string | null;
  anteprima_path: string | null;
  anteprima_nome: string | null;
  anteprima_il: string | null;
  approvato_il: string | null;
  modifiche_il: string | null;
  note_modifiche: string | null;
}

/** Tipo dell'album: quello scelto nella scheda, poi l'importo (sotto la soglia Standard), poi le scelte del preventivo. */
export function tipoAlbum(p: { tipo: TipoAlbum | null | undefined; scelte: string[]; importoAlbum: number; blocco: BloccoAlbum | null }): TipoAlbum {
  if (p.tipo) return p.tipo;
  const soglia = p.blocco?.soglia_premium;
  if (p.importoAlbum > 0 && soglia) return p.importoAlbum < soglia ? "standard" : "premium";
  const c = p.blocco?.codici ?? {};
  if (c.standard && p.scelte.includes(c.standard)) return "standard";
  return "premium";
}

export type FaseAlbum =
  | "istruzioni"        // album da fare, selezione non ancora segnalata
  | "selezione"         // selezione ricevuta, impaginazione in corso
  | "anteprima"         // anteprima da approvare
  | "modifiche"         // modifiche chieste sull'ultima anteprima
  | "approvato";

const dopo = (a: string | null, b: string | null) => !!a && (!b || a >= b);

/** In che punto del percorso siamo, per lo stato del Matrimonio. Null = nessuna sezione album. */
export function faseAlbum(stato: string, a: RigaAlbum | null): FaseAlbum | null {
  const approvato = !!a?.approvato_il && !!a.anteprima_il && dopo(a.approvato_il, a.anteprima_il);
  if (stato === "wdg_album_todo" || stato === "wdg_album") {
    if (a?.anteprima_path && a.anteprima_il) {
      if (approvato) return "approvato";
      if (dopo(a.modifiche_il, a.anteprima_il)) return "modifiche";
      if (stato === "wdg_album") return "anteprima";
    }
    return a?.selezione_il ? "selezione" : "istruzioni";
  }
  // Dopo l'approvazione (Saldo, Chiuso…) resta il promemoria dell'ok.
  return approvato ? "approvato" : null;
}

/** Gli Sposi possono ancora cambiare selezione e copertina finché non c'è un'anteprima. */
export function selezioneModificabile(stato: string, a: RigaAlbum | null): boolean {
  return (stato === "wdg_album_todo" || stato === "wdg_album") && !a?.anteprima_path;
}

export function passiAlbum(b: BloccoAlbum | null, tipo: TipoAlbum): [string, string][] {
  return b?.passi?.[tipo] ?? b?.passi?.premium ?? [];
}

export function copertineAlbum(b: BloccoAlbum | null, tipo: TipoAlbum): Copertina[] {
  return b?.copertine?.[tipo] ?? [];
}

/** "Similpelle bianca con foto su metacrilato (foto 123)" */
export function testoCopertina(b: BloccoAlbum | null, a: Pick<RigaAlbum, "copertina" | "copertina_nota">): string {
  if (!a.copertina) return "";
  const tutte = [...(b?.copertine?.standard ?? []), ...(b?.copertine?.premium ?? [])];
  const et = tutte.find((c) => c.valore === a.copertina)?.etichetta ?? a.copertina;
  return a.copertina_nota ? `${et} (${a.copertina_nota})` : et;
}

/** Nome del file nello spazio privato: niente nomi degli Sposi, solo l'id e un'etichetta temporale. */
export function percorsoAnteprima(mid: string, estensione: string, adesso = new Date()): string {
  const t = adesso.toISOString().replace(/[-:]/g, "").replace(/\..*$/, "");
  return `${mid}/${t}.${estensione}`;
}

export const TIPI_ANTEPRIMA: Record<string, string> = {
  "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
};

/** Stati dopo la consegna delle foto in cui si può ancora proporre l'album. */
export const STATI_PROPOSTA = ["wdg_invoice", "clo_completed"];

/** "aaaa-mm-gg" + n mesi */
export function piuMesi(data: string, mesi: number): string {
  const [a, m, g] = data.slice(0, 10).split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + mesi, g));
  return d.toISOString().slice(0, 10);
}

/**
 * Sezione "scegliete l'album" nella pagina: dopo la consegna, senza album, entro i mesi previsti.
 * Senza data di consegna (Matrimoni importati) vale la data del Matrimonio.
 */
export function propostaAperta(p: { stato: string; importoAlbum: number; scelto: boolean; consegna: string | null; dataMatrimonio: string | null; mesi: number | undefined; oggi: string }): boolean {
  if (!STATI_PROPOSTA.includes(p.stato) || p.importoAlbum > 0 || p.scelto) return false;
  const rif = p.consegna ?? p.dataMatrimonio;
  if (!rif || !p.mesi) return false;
  return p.oggi <= piuMesi(rif, p.mesi);
}

/** Tipo dall'album scelto: codice del listino, altrimenti l'importo. */
export function tipoDaCodice(codice: string, importo: number, b: BloccoAlbum | null): TipoAlbum {
  return tipoAlbum({ tipo: null, scelte: [codice], importoAlbum: importo, blocco: b });
}

/** Album e repliche con i prezzi del preventivo (prezzi speciali compresi), senza le regole della pagina congiunta. */
export function vociAlbum(listino: VoceListino[], prev: Preventivo | null): VoceOfferta[] {
  const p: Preventivo = prev ? { ...prev, paginaCongiunta: false } : { opzioni: {}, prezziSpeciali: {} };
  try {
    return calcolaOfferta(listino, p).voci.filter((v) => v.categoria === "album" || v.categoria === "replica");
  } catch { return []; }
}
