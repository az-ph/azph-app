/**
 * Motore del listino: calcola cosa vedono gli Sposi e cosa si registra alla conferma.
 * Porting di offerta_() e selezione_() di Code.gs (sistema Apps Script), con importi in centesimi.
 * Funzioni pure: nessun accesso al database, tutto entra come argomento.
 */

export type Categoria =
  | "formula" | "omaggio" | "extra" | "prewedding" | "album" | "replica" | "video-base" | "video" | "duo";

export interface VoceListino {
  codice: string;
  categoria: Categoria;
  voce: string;
  descrizione?: string;
  prezzo: number;          // centesimi
  prezzoBarrato?: number;  // centesimi, 0/assente = nessuno
  gruppo?: string;
  collegataA?: string;     // codice (o codici separati da virgola) della voce a cui è legata: replica → album, opzionale video → pacchetto
  /** Condizioni separate da virgola sulle opzioni del preventivo; "!" nega. Es. "proponi_op2_ibrido,!proponi_video". */
  soloSe?: string;
  /** Voce del riepilogo importi (equivale a COLONNA APERTI): "servizio", "memory_box", "secondo_operatore"… */
  riepilogo?: string;
  /** Codice del collaboratore che eroga la voce (es. il videomaker). Vuoto = il fotografo. */
  collaboratore?: string;
  attiva?: boolean;
}

export interface OpzioniPreventivo {
  proponi_video?: boolean;
  proponi_prewedding?: boolean;
  proponi_op2_ibrido?: boolean;
  [altra: string]: boolean | undefined;
}

export interface Preventivo {
  formula?: string;                          // codice della formula
  opzioni: OpzioniPreventivo;
  prezziSpeciali: Record<string, number>;    // codice (o "servizio") → centesimi
  paginaCongiunta?: boolean;
}

/** Valori della pagina congiunta foto + video, presi dalle righe duo-* del listino. */
export interface ConfigDuo {
  fotoPacchetto: number;
  fotoPieno: number;
  videoPacchetto: number;
  videoPieno: number;
  videoCodice: string;     // codice del pacchetto video incluso
  videoNome: string;
  boxPrezzo: number;
  boxDescrizione?: string;
}

export interface VoceOfferta extends VoceListino {
  barrato: number;   // prezzo barrato da mostrare (0 = nessuno)
  incluso: boolean;  // extra portato a 0: omaggio già incluso
  condiviso?: boolean;
}

export interface Offerta {
  formula: string;
  riepilogoFormula: string;
  servizio: { prezzo: number; barrato: number };
  voci: VoceOfferta[];
  duo: ConfigDuo | null;
}

export class ErroreSelezione extends Error {}

const chiave = (s: string) => s.trim().toLowerCase();

function prezzoApplicato(base: number, barrato: number | undefined, speciale: number | undefined) {
  if (speciale === undefined) return { prezzo: base, barrato: barrato && barrato > base ? barrato : 0 };
  const rif = Math.max(base, barrato ?? 0);
  return { prezzo: speciale, barrato: rif > speciale ? rif : 0 };
}

/** La voce è legata a `codice`? collegataA può elencare più codici separati da virgola. */
export function legataA(v: { collegataA?: string }, codice: string): boolean {
  return (v.collegataA ?? "").split(",").map((c) => c.trim()).includes(codice);
}

export function condizioneVera(soloSe: string | undefined, opzioni: OpzioniPreventivo): boolean {
  if (!soloSe?.trim()) return true;
  return soloSe.split(",").map((s) => s.trim()).filter(Boolean).every((c) =>
    c.startsWith("!") ? !opzioni[c.slice(1).trim()] : !!opzioni[c]);
}

/** Config della pagina congiunta dalle righe duo-photo / duo-video / duo-box del listino. */
export function configDuo(listino: VoceListino[]): ConfigDuo | null {
  const riga = (c: string) => listino.find((v) => chiave(v.codice) === c);
  const p = riga("duo-photo"), v = riga("duo-video"), b = riga("duo-box");
  if (!p || !v) return null;
  const pacchettoVideo = listino.find((x) => x.codice === v.collegataA);
  return {
    fotoPacchetto: p.prezzo, fotoPieno: p.prezzoBarrato || p.prezzo,
    videoPacchetto: v.prezzo, videoPieno: v.prezzoBarrato || v.prezzo,
    videoCodice: v.collegataA || "video",
    videoNome: v.voce || pacchettoVideo?.voce || "",
    boxPrezzo: b ? b.prezzo : 0, boxDescrizione: b?.descrizione,
  };
}

/**
 * Cosa vedono gli Sposi. opz.conVideo / opz.conFoto = false solo nella pagina congiunta,
 * quando tolgono una delle due parti (l'altra torna a prezzo pieno).
 */
export function calcolaOfferta(
  listinoCompleto: VoceListino[],
  prev: Preventivo,
  opz: { conVideo?: boolean; conFoto?: boolean } = {},
): Offerta {
  const L = listinoCompleto.filter((x) => x.attiva !== false);
  const sp: Record<string, number> = {};
  for (const [k, v] of Object.entries(prev.prezziSpeciali)) sp[chiave(k)] = v;

  const f = L.find((x) => x.categoria === "formula" && x.codice === prev.formula?.trim());
  let servizio = f
    ? prezzoApplicato(f.prezzo, f.prezzoBarrato, sp["servizio"])
    : { prezzo: sp["servizio"] ?? 0, barrato: 0 };

  const duo = prev.paginaCongiunta ? configDuo(L) : null;
  if (prev.paginaCongiunta && !duo) throw new Error("Pagina congiunta senza righe duo-photo / duo-video nel listino");
  if (duo) servizio = opz.conVideo === false
    ? { prezzo: duo.fotoPieno, barrato: 0 }
    : { prezzo: duo.fotoPacchetto, barrato: duo.fotoPieno };

  // Nella pagina congiunta il video è sempre proposto.
  const opzioni: OpzioniPreventivo = { ...prev.opzioni, proponi_video: !!prev.opzioni.proponi_video || !!duo };

  const voci = L
    .filter((x) => x.categoria !== "formula" && x.categoria !== "duo")
    .filter((x) => (x.categoria !== "video" && x.categoria !== "video-base") || opzioni.proponi_video)
    .filter((x) => !duo || x.categoria !== "video-base" || x.codice === duo.videoCodice)
    .filter((x) => x.categoria !== "prewedding" || opzioni.proponi_prewedding)
    .filter((x) => condizioneVera(x.soloSe, opzioni))
    .map((x): VoceOfferta => {
      const s = sp[chiave(x.codice)];
      const o: VoceOfferta = { ...x, ...prezzoApplicato(x.prezzo, x.prezzoBarrato, s), incluso: false };
      if (duo && x.categoria === "video-base") {
        Object.assign(o, { voce: duo.videoNome }, opz.conFoto === false
          ? { prezzo: duo.videoPieno, barrato: 0 }
          : { prezzo: duo.videoPacchetto, barrato: duo.videoPieno });
      }
      // Pagina congiunta: opzionali video a prezzo pieno (lo sconto vale per chi arriva dal preventivo normale).
      if (duo && x.categoria === "video" && s === undefined && (x.prezzoBarrato ?? 0) > x.prezzo) {
        Object.assign(o, { prezzo: x.prezzoBarrato, barrato: 0 });
      }
      // Extra portato a 0 con un prezzo speciale: omaggio già incluso.
      o.incluso = s === 0 && (x.categoria === "extra" || x.categoria === "prewedding");
      // Pagina congiunta: una sola memory box con foto e video.
      if (duo && x.riepilogo === "memory_box" && !o.incluso) {
        Object.assign(o, { prezzo: duo.boxPrezzo, barrato: 0, condiviso: true },
          duo.boxDescrizione ? { descrizione: duo.boxDescrizione } : {});
      }
      return o;
    });

  return {
    formula: f?.voce ?? "",
    riepilogoFormula: f?.riepilogo || "servizio",
    servizio,
    voci,
    duo,
  };
}

export interface RigaScelta extends VoceOfferta {
  qta: number;
  totale: number;     // centesimi
  etichetta: string;
}

export interface Selezione {
  foto: RigaScelta[];
  video: RigaScelta[];
}

export interface SceltaSposi {
  extra: string[];                 // codici scelti
  qta?: Record<string, number>;    // repliche: codice → copie
  video?: string | null;           // codice del pacchetto video scelto
}

/** Scelte degli Sposi validate contro l'offerta. */
export function selezione(voci: VoceOfferta[], scelta: SceltaSposi): Selezione {
  const ids = new Set(scelta.extra.map(String));
  const scelte = voci.filter((x) =>
    ["extra", "prewedding", "album"].includes(x.categoria) && (ids.has(x.codice) || x.incluso));

  const gruppi = scelte.map((x) => x.gruppo).filter(Boolean);
  if (new Set(gruppi).size < gruppi.length) throw new ErroreSelezione("Per alcune voci è possibile una sola scelta.");
  if (scelte.filter((x) => x.categoria === "album").length > 1) throw new ErroreSelezione("Scegliete un solo album.");

  const foto: RigaScelta[] = scelte.map((x) => ({
    ...x, qta: 1, totale: x.prezzo,
    etichetta: (x.gruppo ? x.gruppo + " - " : "") + x.voce + (x.incluso ? " (omaggio)" : ""),
  }));
  for (const x of voci.filter((v) => v.categoria === "replica")) {
    const n = Math.max(0, Math.min(10, Math.floor(Number(scelta.qta?.[x.codice] ?? 0))));
    if (n && scelte.some((s) => legataA(x, s.codice))) {
      foto.push({ ...x, qta: n, totale: n * x.prezzo, etichetta: `${x.voce} × ${n}` });
    }
  }

  const video: RigaScelta[] = [];
  if (scelta.video) {
    const base = voci.find((x) => x.categoria === "video-base" && x.codice === scelta.video);
    if (!base) throw new ErroreSelezione("Pacchetto video non disponibile: ricaricate la pagina.");
    video.push({ ...base, qta: 1, totale: base.prezzo, etichetta: base.voce });
    for (const x of voci.filter((v) => v.categoria === "video" && ids.has(v.codice))) {
      video.push({ ...x, qta: 1, totale: x.prezzo, etichetta: "Video - " + x.voce });
    }
  }
  return { foto, video };
}

/** Importi della conferma, raggruppati per voce di riepilogo (servizio, memory_box, album…). */
export function importiConferma(offerta: Offerta, sel: Selezione) {
  const perVoce: Record<string, number> = { [offerta.riepilogoFormula]: offerta.servizio.prezzo };
  for (const x of sel.foto) {
    if (x.riepilogo) perVoce[x.riepilogo] = (perVoce[x.riepilogo] ?? 0) + x.totale;
  }
  const totaleFoto = offerta.servizio.prezzo + sel.foto.reduce((s, x) => s + x.totale, 0);
  const totaleVideo = sel.video.reduce((s, x) => s + x.totale, 0);
  return { perVoce, totaleFoto, totaleVideo };
}

/** Righe del riepilogo foto, nell'ordine della pagina: servizio, omaggi, poi le scelte (importi in centesimi, 0 = omaggio). */
export function righeRiepilogo(offerta: Offerta, sel: Selezione): { voce: string; importo: number }[] {
  return [
    { voce: "Servizio fotografico", importo: offerta.servizio.prezzo },
    ...offerta.voci.filter((v) => v.categoria === "omaggio").map((v) => ({ voce: v.voce, importo: 0 })),
    ...sel.foto.map((x) => ({ voce: x.etichetta.replace(/ \(omaggio\)$/, ""), importo: x.totale })),
  ];
}

/** Acconto: 50% dei servizi; album e album genitori si pagano a parte. */
export function piano(perVoce: Record<string, number>) {
  const totale = Object.values(perVoce).reduce((s, v) => s + v, 0);
  const album = (perVoce["album"] ?? 0) + (perVoce["album_genitori"] ?? 0);
  const servizi = Math.max(0, totale - album);
  return { totale, album, servizi, acconto: Math.round(servizi / 2) };
}

/** "box = 0\nservizio = 1100" → { box: 0, servizio: 110000 } (euro → centesimi). */
export function leggiPrezziSpeciali(testo: string): Record<string, number> {
  const m: Record<string, number> = {};
  for (const riga of String(testo || "").split(/[\n;]/)) {
    const [k, v] = riga.split("=").map((x) => (x ?? "").trim());
    if (k && v !== undefined && v !== "") m[k.toLowerCase()] = euroInCentesimi(v);
  }
  return m;
}

/** "1.287,57 €" / "1100" / 1100 → centesimi. */
export function euroInCentesimi(v: string | number): number {
  if (typeof v === "number") return Math.round(v * 100);
  const s = v.replace(/[€\s]/g, "");
  const n = parseFloat(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return isNaN(n) ? 0 : Math.round(n * 100);
}
