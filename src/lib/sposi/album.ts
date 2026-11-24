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
  /** Codici del listino che decidono il tipo; senza, decide la soglia sull'importo. */
  codici?: { standard?: string; premium?: string };
  /** Album fino a questo importo (centesimi) = Standard. */
  soglia_standard?: number;
}

export interface RigaAlbum {
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

/** Tipo dell'album: quello scelto nella scheda, poi le scelte del preventivo, poi l'importo. */
export function tipoAlbum(p: { tipo: TipoAlbum | null | undefined; scelte: string[]; importoAlbum: number; blocco: BloccoAlbum | null }): TipoAlbum {
  if (p.tipo) return p.tipo;
  const c = p.blocco?.codici ?? {};
  if (c.standard && p.scelte.includes(c.standard)) return "standard";
  if (c.premium && p.scelte.includes(c.premium)) return "premium";
  const soglia = p.blocco?.soglia_standard ?? 0;
  return p.importoAlbum > 0 && p.importoAlbum <= soglia ? "standard" : "premium";
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
