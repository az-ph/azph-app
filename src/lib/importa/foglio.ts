/**
 * Lettura del foglio "Matrimoni" (export .xlsx) e preparazione dei dati per public.importa_foglio().
 * Uso una tantum per AZ-ph. Funzione pura: riceve il workbook, restituisce dati + resoconto.
 * Il resoconto cita solo codici matrimonio, mai nomi o contatti.
 */
import * as XLSX from "xlsx";
import { euroInCentesimi, leggiPrezziSpeciali, type Categoria } from "@/lib/listino/motore";
import { nuovoToken } from "@/lib/token";

type Cella = string | number | boolean | null;
type Riga = Record<string, Cella> & { _n: number };

export interface Resoconto {
  conteggi: Record<string, number>;
  avvisi: string[];
}

export interface DatiImport {
  listino: Record<string, unknown>[];
  location: Record<string, unknown>[];
  collaboratori: Record<string, unknown>[];
  fornitori: Record<string, unknown>[];
  matrimoni: Record<string, unknown>[];
}

// Pagina congiunta: oggi in AZP.DUO di Code.gs, diventa righe del listino.
const DUO_AZPH = [
  { codice: "duo-photo", categoria: "duo", voce: "Foto + Video · fotografia", prezzo: 119000, prezzo_barrato: 140000 },
  { codice: "duo-video", categoria: "duo", voce: "Pacchetto Emozione", prezzo: 146000, prezzo_barrato: 156312, collegata_a: "video" },
  { codice: "duo-box", categoria: "duo", voce: "Memory box condivisa", prezzo: 7000,
    descrizione: "Chiavetta USB in scatola personalizzata con nomi e data: contiene sia le foto sia il video." },
];
const SUFFISSO_DUO = /-vdm$/i;

const COLONNE_IMPORTI: [string, string][] = [
  ["PHOTO", "servizio"], ["PRE WDG", "prewedding"], ["PHOTO BOOTH", "photo_booth"], ["PHOTO 2ND", "secondo_operatore"],
  ["MEMORY BOX", "memory_box"], ["ALBUM", "album"], ["ALBUM GENITORI", "album_genitori"],
];
const RIEPILOGO_DA_COLONNA = Object.fromEntries(COLONNE_IMPORTI);

const OPZIONI: Record<string, string> = {
  "PROPONI VIDEO": "proponi_video", "PROPONI PRE WDG": "proponi_prewedding", "PROPONI OP2 IBRIDO": "proponi_op2_ibrido",
};

const NOMI_VIDEOMAKER: Record<string, string> = {
  ASA: "Alessandra Savi", CNT: "Centobraccia", LAN: "Luca Angolini", MBA: "Mattia Batalocco",
  MSA: "Mattia Sabbadini", RNY: "Raymon Nyantakyi", SMA: "Simone Mafezzoni",
};
// Codici sostituiti (decisione di Ale, 21.11.2026): GBO diventa CNT Centobraccia.
const CODICE_VIDEOMAKER: Record<string, string> = { GBO: "CNT" };
const codiceVideo = (c: string) => CODICE_VIDEOMAKER[c] ?? c;

const CATEGORIE: Categoria[] = ["formula", "omaggio", "extra", "prewedding", "album", "replica", "video-base", "video", "duo"];

// ---------------------------------------------------------------- utilità celle

const testo = (v: Cella | undefined) => (v === null || v === undefined ? "" : String(v).trim());
const vuota = (v: Cella | undefined) => testo(v) === "";
const vero = (v: Cella | undefined) => v === true || testo(v).toUpperCase() === "TRUE";

export function dataIso(v: Cella | undefined): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d || !d.y) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function oraIso(v: Cella | undefined): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    const frazione = v - Math.floor(v);
    const minuti = Math.round(frazione * 24 * 60) % (24 * 60);
    return `${String(Math.floor(minuti / 60)).padStart(2, "0")}:${String(minuti % 60).padStart(2, "0")}`;
  }
  const m = String(v).trim().match(/^(\d{1,2})[.:](\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

const euro = (v: Cella | undefined) => (vuota(v) ? null : euroInCentesimi(typeof v === "number" ? v : testo(v)));

function leggiFoglio(wb: XLSX.WorkBook, nome: string): Riga[] {
  const ws = wb.Sheets[nome];
  if (!ws) throw new Error(`Nel file manca il foglio "${nome}"`);
  const righe = XLSX.utils.sheet_to_json<Cella[]>(ws, { header: 1, raw: true, defval: null, blankrows: true });
  let h = 0;
  for (let i = 0; i < Math.min(5, righe.length); i++) {
    const r = righe[i].map(testo);
    if (r.includes("ID") || r.includes("LOCATION")) { h = i; break; }
  }
  const intestazioni = (righe[h] ?? []).map(testo);
  return righe.slice(h + 1).map((r, i) => {
    const o = { _n: h + 2 + i } as Riga;
    // Come Code.gs: con intestazioni doppie vale la prima colonna.
    intestazioni.forEach((k, j) => { if (k && !(k in o)) o[k] = r[j] ?? null; });
    return o;
  });
}

function statoDa(v: string): string | null {
  if (/^WDG \d{4}$/.test(v)) return "wdg_confermato";
  return ({
    "QTE To Contact": "qte_to_contact", "QTE Quote": "qte_quote",
    "WDG Lightroom": "wdg_lightroom", "WDG Invoice": "wdg_invoice", "WDG Album To Do": "wdg_album_todo", "WDG Album": "wdg_album",
    "CLO Completed": "clo_completed", "CLO Lost": "clo_lost", "CLO No Answer": "clo_no_answer",
  } as Record<string, string>)[v] ?? null;
}

function piuGiorni(iso: string, giorni: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- lettura

export function leggiWorkbook(buf: ArrayBuffer | Uint8Array, oggi = new Date().toISOString().slice(0, 10)):
  { dati: DatiImport; resoconto: Resoconto } {
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const avvisi: string[] = [];

  // Listino
  const listino: Record<string, unknown>[] = leggiFoglio(wb, "Listino").filter((r) => !vuota(r["ID"])).map((r, i) => {
    const codice = testo(r["ID"]);
    const categoria = testo(r["CATEGORIA"]).toLowerCase() as Categoria;
    if (!CATEGORIE.includes(categoria)) avvisi.push(`Listino riga ${r._n}: categoria "${categoria}" sconosciuta`);
    let soloSe = testo(r["SOLO SE"]).split(",").map((s) => OPZIONI[s.trim().toUpperCase()] ?? "").filter(Boolean);
    if (codice === "op2-hyb") soloSe = [...soloSe, "!proponi_video"];   // regola di Ale: l'ibrido mai con il video
    return {
      codice, categoria, voce: testo(r["VOCE"]), descrizione: testo(r["DESCRIZIONE"]) || null,
      prezzo: euro(r["PREZZO"]) ?? 0, prezzo_barrato: euro(r["PREZZO BARRATO"]),
      gruppo: testo(r["GRUPPO"]) || null, collegata_a: testo(r["COLLEGATO A"]) || null,
      solo_se: soloSe.join(",") || null,
      riepilogo: RIEPILOGO_DA_COLONNA[testo(r["COLONNA APERTI"]).toUpperCase()] ??
        (categoria === "formula" ? "servizio" : null),
      // Oggi i pacchetti video del listino sono tutti di Mattia Batalocco.
      collaboratore: categoria === "video" || categoria === "video-base" ? "MBA" : null,
      attiva: !(r["ATTIVO"] === false || testo(r["ATTIVO"]).toUpperCase() === "FALSE"),
      ordine: i,
    };
  });
  for (const d of DUO_AZPH) {
    if (!listino.some((v) => v.codice === d.codice)) {
      listino.push({ descrizione: null, prezzo_barrato: null, gruppo: null, collegata_a: null, solo_se: null,
        riepilogo: null, attiva: true, ordine: listino.length, ...d });
    }
  }

  // Location e liste da Dati
  const datiRighe = leggiFoglio(wb, "Dati");
  const location = new Map<string, Record<string, unknown>>();
  for (const r of datiRighe) {
    const nome = testo(r["LOCATION"]);
    if (!nome || location.has(nome)) continue;
    location.set(nome, {
      nome, comune: testo(r["COMUNE"]) || null, provincia: testo(r["PROVINCIA"]) || null,
      galleria_url: testo(r["GALLERIA"]) || null, copertina_url: testo(r["COPERTINA"]) || null,
    });
  }
  const codiciVideo = new Set(datiRighe.map((r) => codiceVideo(testo(r["VIDEO"]))).filter(Boolean));

  // Preventivi, Timeline, Fornitori per ID
  const prevPerId = new Map(leggiFoglio(wb, "Preventivi").filter((r) => !vuota(r["ID"])).map((r) => [testo(r["ID"]), r]));
  const timelinePerId = new Map<string, Riga[]>();
  for (const r of leggiFoglio(wb, "Timeline")) {
    const id = testo(r["ID"]);
    if (!id) continue;
    timelinePerId.set(id, [...(timelinePerId.get(id) ?? []), r]);
  }
  const fornitori = new Map<string, { categoria: string; nome: string; social: string | null }>();
  const fornitoriPerId = new Map<string, { categoria: string; nome: string }[]>();
  for (const r of leggiFoglio(wb, "Fornitori")) {
    const id = testo(r["ID"]), categoria = testo(r["CAT"]), nome = testo(r["VOCE"]);
    if (!id || !categoria || !nome) continue;
    if (/^(bride|groom)$/i.test(categoria)) continue;   // sono gli Sposi, non fornitori
    const k = categoria + "\u0000" + nome;
    if (!fornitori.has(k)) fornitori.set(k, { categoria, nome, social: testo(r["SOCIAL"]) || null });
    fornitoriPerId.set(id, [...(fornitoriPerId.get(id) ?? []), { categoria, nome }]);
  }

  // Matrimoni
  const matrimoni: Record<string, unknown>[] = [];
  const codiciUsati = new Set<string>();
  const usati = { video: new Set<string>() };
  for (const foglio of ["Aperti", "Lavorazione", "Chiusi"]) {
    for (const w of leggiFoglio(wb, foglio)) {
      const idFoglio = testo(w["ID"]), statoFoglio = testo(w["STATO"]);
      if (!idFoglio || !statoFoglio) continue;
      const stato = statoDa(statoFoglio);
      if (!stato) { avvisi.push(`${idFoglio}: stato "${statoFoglio}" non riconosciuto, saltato`); continue; }

      const congiunta = SUFFISSO_DUO.test(idFoglio);
      let codiceId = idFoglio.replace(SUFFISSO_DUO, "");
      if (codiciUsati.has(codiceId)) codiceId = idFoglio;
      if (codiciUsati.has(codiceId)) { avvisi.push(`${idFoglio}: codice ripetuto, saltato`); continue; }
      codiciUsati.add(codiceId);

      const p = prevPerId.get(idFoglio);
      const nomeLocation = testo(w["LOCATION"]);
      if (nomeLocation && !location.has(nomeLocation)) {
        location.set(nomeLocation, { nome: nomeLocation, comune: null, provincia: testo(w["PROV"]) || null, galleria_url: null, copertina_url: null });
        avvisi.push(`${idFoglio}: location non presente in Dati, creata solo con il nome`);
      }
      const video = codiceVideo(testo(w["VIDEO"]));
      if (video) usati.video.add(video);

      // Importi confermati: cella vuota = voce assente, 0 = omaggio
      const importi = COLONNE_IMPORTI
        .filter(([col]) => !vuota(w[col]))
        .map(([col, voce]) => ({ voce, importo: euro(w[col]) ?? 0 }));
      const somma = importi.reduce((s, x) => s + x.importo, 0);
      const tot = euro(w["TOT"]) ?? 0;
      if (tot !== somma) avvisi.push(`${idFoglio}: TOT ${tot / 100} € diverso dalla somma delle voci ${somma / 100} €`);
      if (stato.startsWith("wdg") && !dataIso(w["DATA INIZIO"])) avvisi.push(`${idFoglio}: confermato senza data`);
      if (vero(w["MB"]) && !importi.some((x) => x.voce === "memory_box")) {
        avvisi.push(`${idFoglio}: MB spuntato ma la memory box non è nel pacchetto, spunta non importata`);
      }

      // Sposi: da Preventivi se ci sono i dati, altrimenti i nomi di Aperti ("Nome e Nome")
      let sposi = [1, 2].map((n) => ({
        ordine: n,
        nome: testo(p?.[`SPOSO ${n} nome`]) || null,
        telefono: testo(p?.[`SPOSO ${n} telefono`]) || null,
        email: testo(p?.[`SPOSO ${n} email`]) || null,
        codice_fiscale: testo(p?.[`SPOSO ${n} CF`]) || null,
        indirizzo: testo(p?.[`SPOSO ${n} indirizzo`]) || null,
        indirizzo_preparativi: testo(p?.[`SPOSO ${n} preparativi`]) || null,
        consenso_promo: testo(p?.["CONSENSO PROMO"]).toLowerCase().startsWith("s"),
      })).filter((s) => s.nome || s.telefono || s.email);
      if (!sposi.length) {
        sposi = testo(w["SPOSI"]).split(/\s+e\s+/).filter(Boolean).slice(0, 2).map((nome, i) => ({
          ordine: i + 1, nome, telefono: null, email: null, codice_fiscale: null, indirizzo: null,
          indirizzo_preparativi: null, consenso_promo: false,
        }));
      }

      const scelte = testo(p?.["SCELTE ID"]).split(",").map((s) => s.trim()).filter(Boolean);
      const preventivo = p && (!vuota(p["FORMULA"]) || !vuota(p["DATA CONFERMA"])) ? {
        versione: parseInt(testo(p["VERSIONE"]).replace(/\D/g, ""), 10) || 1,
        opzioni: Object.fromEntries(Object.entries(OPZIONI).map(([col, k]) => [k, vero(p[col])])),
        prezzi_speciali: leggiPrezziSpeciali(testo(p["PREZZI SPECIALI"])),
        preselezione: testo(p["PRESELEZIONE"]).split(/[,;\n]/).map((s) => s.trim().toLowerCase()).filter(Boolean),
        scelte,
        totale: importi.length ? somma : null,
        inviato_il: dataIso(p["DATA PREVENTIVO"]),
        confermato_il: dataIso(p["DATA CONFERMA"]),
      } : null;

      const importoAlbum = importi.find((x) => x.voce === "album")?.importo ?? 0;
      const album = importoAlbum > 0 || !vuota(p?.["ALBUM APPROVATO"]) || !vuota(p?.["ALBUM FILE"]) ? {
        // stessa regola dell'app: sotto 550 € Standard, da 550 € Premium (vedi blocco album-sposi)
        tipo: importoAlbum > 0 ? (importoAlbum < 55000 ? "standard" : "premium")
          : scelte.includes("alb-std") ? "standard" : scelte.includes("alb-prm") ? "premium" : null,
        cartella: testo(p?.["ALBUM FILE"]) || null,
        approvato_il: dataIso(p?.["ALBUM APPROVATO"]),
        note: testo(p?.["ALBUM NOTE"]) || null,
      } : null;

      // Timeline: la riga senza giorno né ora è la nota privata
      const timeline = (timelinePerId.get(idFoglio) ?? []).map((r, i) => {
        const descr = testo(r["DESCRIZIONE"]);
        const privata = vuota(r["GIORNO"]) && vuota(r["ORA"]);
        const [fase, ...luogo] = privata ? [descr] : descr.split(" | ");
        return {
          giorno: parseInt(testo(r["GIORNO"]), 10) || 1, ora: oraIso(r["ORA"]),
          fase: fase || null, luogo: luogo.join(" | ") || null, nota_privata: privata, ordine: i,
        };
      }).filter((t) => t.fase);

      const legacy = testo(p?.["CODICE"]);
      matrimoni.push({
        codice_id: codiceId, stato, fonte: testo(w["FONTE"]) || null,
        data_inizio: dataIso(w["DATA INIZIO"]), data_fine: dataIso(w["DATA FINE"]),
        ora_inizio: oraIso(w["ORA INIZIO"]), ora_fine: oraIso(w["ORA FINE"]),
        location: nomeLocation || null,
        preparativi: sposi.some((s) => s.indirizzo_preparativi) || null,
        formula: testo(p?.["FORMULA"]) || null,
        note_private: timeline.filter((t) => t.nota_privata).map((t) => t.fase).join("\n") || null,
        galleria_url: testo(p?.["GALLERIE"]) || null,
        copertina_url: testo(p?.["COPERTINA"]) || null,
        link_upyourshoot: testo(p?.["GALLERIA SPOSI"]) || null,
        pagina_congiunta: congiunta,
        videomaker: video || null,
        memory_box_consegnata: vero(w["MB"]) && importi.some((x) => x.voce === "memory_box"),
        recensione_ricevuta: vero(w["REC"]),
        // date degli automatismi del foglio: scritte dopo l'importazione (vedi importa)
        foto_consegnate_il: dataIso(p?.["CONSEGNA FOTO"]),
        album_proposto_il: dataIso(p?.["PROMEMORIA ALBUM"]),
        sposi, preventivo, importi,
        incassato: euro(w["SALDO"]) ?? 0,
        album,
        timeline: timeline.filter((t) => !t.nota_privata),
        fornitori: fornitoriPerId.get(idFoglio) ?? [],
        token: nuovoToken(),
        codice_legacy: legacy || null,
        legacy_scade_il: legacy && stato.startsWith("clo") ? piuGiorni(oggi, 90) : null,
      });
    }
  }

  const collaboratori = [...new Set([...codiciVideo, ...usati.video])].map((codice) => ({
    codice, nome: NOMI_VIDEOMAKER[codice] ?? codice, ruolo: "videomaker",
  }));

  const dati: DatiImport = {
    listino, location: [...location.values()], collaboratori, fornitori: [...fornitori.values()], matrimoni,
  };
  const conta = (f: (m: Record<string, unknown>) => number) => matrimoni.reduce((s, m) => s + f(m), 0);
  const perStato: Record<string, number> = {};
  for (const m of matrimoni) perStato[m.stato as string] = (perStato[m.stato as string] ?? 0) + 1;
  return {
    dati,
    resoconto: {
      conteggi: {
        matrimoni: matrimoni.length,
        ...Object.fromEntries(Object.entries(perStato).map(([k, v]) => [`stato ${k}`, v])),
        sposi: conta((m) => (m.sposi as unknown[]).length),
        preventivi: conta((m) => (m.preventivo ? 1 : 0)),
        "importi (voci)": conta((m) => (m.importi as unknown[]).length),
        "righe di timeline": conta((m) => (m.timeline as unknown[]).length),
        "voci di listino": listino.length,
        location: location.size,
        fornitori: fornitori.size,
        videomaker: collaboratori.length,
      },
      avvisi,
    },
  };
}
