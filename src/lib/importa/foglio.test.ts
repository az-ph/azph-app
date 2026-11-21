import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { leggiWorkbook, dataIso, oraIso } from "./foglio";

// Workbook di prova con la stessa struttura del foglio "Matrimoni". Dati inventati.
export function workbookDiProva(): Uint8Array {
  const wb = XLSX.utils.book_new();
  const ag = (nome: string, righe: unknown[][]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(righe), nome);
  const intestAperti = ["ID", "STATO", "FONTE", "SPOSI", "DATA INIZIO", "ORA INIZIO", "DATA FINE", "ORA FINE", "LOCATION", "PROV",
    "MB", "REC", "VIDEO", "PHOTO", "PRE WDG", "PHOTO BOOTH", "PHOTO 2ND", "MEMORY BOX", "ALBUM", "ALBUM GENITORI", "TOT", "SALDO", "DIFF"];
  // 46519 = 12/05/2027 (seriale Excel), 0.625 = 15:00
  ag("Aperti", [
    ["Matrimoni aperti"], intestAperti,
    ["2027-001", "WDG 2027", "MAT", "Anna e Bruno", 46519, 0.625, 46520, 0.0416667, "Villa Prova", "MN", true, "TRUE", "MBA",
      1100, null, null, null, 50, 450, null, 1600, 300],
    ["2027-002", "QTE Quote", "IGR", "Carla e Dario", "20/06/2027", null, null, null, "Location Nuova", "BS", false, "", "GBO",
      null, null, null, null, null, null, null, 0, 0],
    ["2027-003-VdM", "QTE Quote", "VDM", "Elena e Fabio", null, null, null, null, "Villa Prova", "MN", "", "", "MBA",
      null, null, null, null, null, null, null, 0, 0],
    ["2027-004", "", "", "", null, null, null, null, "", "", "", "", "", null, null, null, null, null, null, null, 0, 0],
    ["2027-005", "WDG 2027", "PSP", "Gina e Ugo", 46530, null, null, null, "Villa Prova", "MN", "", "", "",
      1000, null, null, null, 0, null, null, 1200, 0],
  ]);
  ag("Lavorazione", [["Lavorazione"], intestAperti]);
  ag("Chiusi", [["Chiusi"], intestAperti,
    ["2025-010", "CLO Completed", "WEB", "Ivo e Lia", 45800, null, null, null, "Villa Prova", "MN", "", "", "", 950, null, null, null, 0, null, null, 950, 950],
  ]);
  ag("Preventivi", [
    ["ID", "FORMULA", "VERSIONE", "PREZZI SPECIALI", "PROPONI VIDEO", "PREZZO VIDEO", "PROPONI PRE WDG", "PROPONI OP2 IBRIDO",
      "PRESELEZIONE", "COPERTINA", "GALLERIE", "GALLERIA SPOSI", "TIMELINE AGGIORNATA", "CODICE", "LINK", "LINK TIMELINE",
      "DATA PREVENTIVO", "DATA CONFERMA", "MAIL ALBUM", "SCELTE", "SCELTE ID", "VIDEO SCELTO",
      "SPOSO 1 nome", "SPOSO 1 telefono", "SPOSO 1 email", "SPOSO 1 CF", "SPOSO 1 indirizzo", "SPOSO 1 preparativi",
      "SPOSO 2 nome", "SPOSO 2 telefono", "SPOSO 2 email", "SPOSO 2 CF", "SPOSO 2 indirizzo", "SPOSO 2 preparativi",
      "CONSENSO PROMO", "NOTE CLIENTE", "CONSEGNA FOTO", "PROMEMORIA ALBUM", "PROMEMORIA KICKOFF", "ALBUM FILE",
      "ALBUM APPROVATO", "ALBUM NOTE", "PROMEMORIA FOLLOWUP", "PROPONI OP2 IBRIDO"],
    ["2027-001", "W-REL-1F", "v02", "servizio =1100", "TRUE", "", "FALSE", "FALSE", "", "", "", "", "", "ab12", "", "",
      "01/11/2026", "05/11/2026", "", "Memory box, Album Standard, Pacchetto Emozione", "box,alb-std,video", "TRUE",
      "Anna Rossi", "'+39 333 000 0000", "anna@example.com", "RSSNNA90A41E897X", "Via Prova 1", "Via Casa 2",
      "Bruno Verdi", "", "", "", "", "", "Sì", "", "", "", "", "", "", "", "", "TRUE"],
    ["2027-002", "W-CIV-1F", "v01", "box = 0", "FALSE", "", "FALSE", "FALSE", "box", "", "", "", "", "cd34", "", "",
      "10/11/2026", "", "", "", "", "FALSE"],
    ["2027-003-VdM", "W-CIV-1F", "v01", "", "FALSE", "", "FALSE", "FALSE", "", "", "", "", "", "ef56"],
    ["2025-010", "", "", "", "FALSE", "", "FALSE", "FALSE", "", "", "", "", "", "gh78"],
  ]);
  ag("Timeline", [
    ["ID", "SPOSI", "GIORNO", "DATA", "ORA", "DESCRIZIONE"],
    ["2027-001", "", "", "", "", "Nota privata: sconto concordato"],
    ["2027-001", "", 1, "12/05/2027", "14.30", "Preparativi di Anna | Casa privata - Mantova MN"],
    ["2027-001", "", 1, "12/05/2027", 0.6458333, "Rito civile"],
    ["2027-001", "", 2, "13/05/2027", "00.30", "Termine presunto del servizio"],
  ]);
  ag("Dati", [
    ["STATO", "VIDEO", "FONTE", "LOCATION", "PROVINCIA", "COMUNE", "GALLERIA", "COPERTINA"],
    ["QTE To Contact", "MBA", "MAT", "Villa Prova", "MN", "Mantova", "https://example.com/g", "https://example.com/c.jpg"],
    ["QTE Quote", "GBO", "IGR", "", "", "", "", ""],
  ]);
  ag("Fornitori", [
    ["ID", "DATA", "CAT", "VOCE", "SOCIAL"],
    ["2027-001", "12/05/2027", "Bride", "Anna Rossi", "@anna"],
    ["2027-001", "12/05/2027", "Fiori", "Fiorista Uno", "@fiori"],
    ["2025-010", "01/05/2025", "Fiori", "Fiorista Uno", "@fiori"],
  ]);
  ag("Listino", [
    ["ID", "CATEGORIA", "VOCE", "DESCRIZIONE", "PREZZO", "PREZZO BARRATO", "GRUPPO", "COLLEGATO A", "COLONNA APERTI", "ATTIVO", "SOLO SE"],
    ["W-REL-1F", "formula", "[REL][WIDE]", "", 1200, 1400, "", "", "PHOTO", "TRUE"],
    ["W-CIV-1F", "formula", "[CIV][WIDE]", "", 1200, 1300, "", "", "PHOTO", "TRUE"],
    ["box", "extra", "Memory box", "Chiavetta", 50, "", "", "", "MEMORY BOX", "TRUE"],
    ["op2-hyb", "extra", "Ibrido", "", 500, "", "Secondo operatore", "", "PHOTO 2ND", "TRUE", "PROPONI OP2 IBRIDO"],
    ["alb-std", "album", "Album Standard", "", 450, "", "", "", "ALBUM", "TRUE"],
    ["video", "video-base", "Pacchetto Emozione", "", "1.485,17 €", "1.563,12 €", "", "", "", "TRUE"],
    ["savedate", "video", "Save the date", "", "", "", "", "video", "", "FALSE"],
  ]);
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

describe("conversioni di date e ore", () => {
  it("seriale Excel e testi", () => {
    expect(dataIso(46519)).toBe("2027-05-12");
    expect(dataIso("4/7/2026")).toBe("2026-07-04");
    expect(dataIso("04.07.2026")).toBe("2026-07-04");
    expect(oraIso(0.625)).toBe("15:00");
    expect(oraIso("7.30")).toBe("07:30");
    expect(oraIso("TBD")).toBeNull();
  });
});

describe("lettura del foglio Matrimoni", () => {
  const { dati, resoconto } = leggiWorkbook(workbookDiProva(), "2026-11-21");
  const m = (id: string) => dati.matrimoni.find((x) => x.codice_id === id)!;

  it("salta le righe senza stato e legge tutti e tre i fogli", () => {
    expect(dati.matrimoni.map((x) => x.codice_id)).toEqual(["2027-001", "2027-002", "2027-003", "2027-005", "2025-010"]);
  });

  it("matrimonio confermato: stato, date, ore, importi, incassato, preventivo", () => {
    const x = m("2027-001");
    expect(x).toMatchObject({
      stato: "wdg_confermato", fonte: "MAT", data_inizio: "2027-05-12", ora_inizio: "15:00", ora_fine: "01:00",
      videomaker: "MBA", formula: "W-REL-1F", incassato: 30000, codice_legacy: "ab12",
      memory_box_consegnata: true, recensione_ricevuta: true,
      note_private: "Nota privata: sconto concordato",
    });
    expect(x.importi).toEqual([
      { voce: "servizio", importo: 110000 }, { voce: "memory_box", importo: 5000 }, { voce: "album", importo: 45000 },
    ]);
    expect(x.preventivo).toMatchObject({
      versione: 2, opzioni: { proponi_video: true, proponi_prewedding: false, proponi_op2_ibrido: false },
      prezzi_speciali: { servizio: 110000 }, scelte: ["box", "alb-std", "video"], totale: 160000,
      inviato_il: "2026-11-01", confermato_il: "2026-11-05",
    });
    expect(x.album).toMatchObject({ tipo: "standard" });
  });

  it("Sposi dai dati di Preventivi; altrimenti dai nomi di Aperti", () => {
    expect(m("2027-001").sposi).toMatchObject([
      { ordine: 1, nome: "Anna Rossi", codice_fiscale: "RSSNNA90A41E897X", indirizzo_preparativi: "Via Casa 2", consenso_promo: true },
      { ordine: 2, nome: "Bruno Verdi" },
    ]);
    expect((m("2027-002").sposi as { nome: string }[]).map((s) => s.nome)).toEqual(["Carla", "Dario"]);
  });

  it("timeline: luogo separato, nota privata esclusa", () => {
    expect(m("2027-001").timeline).toEqual([
      { giorno: 1, ora: "14:30", fase: "Preparativi di Anna", luogo: "Casa privata - Mantova MN", nota_privata: false, ordine: 1 },
      { giorno: 1, ora: "15:30", fase: "Rito civile", luogo: null, nota_privata: false, ordine: 2 },
      { giorno: 2, ora: "00:30", fase: "Termine presunto del servizio", luogo: null, nota_privata: false, ordine: 3 },
    ]);
  });

  it("flag MB e REC; GBO diventa CNT Centobraccia", () => {
    expect(m("2027-002")).toMatchObject({ memory_box_consegnata: false, recensione_ricevuta: false, videomaker: "CNT" });
  });

  it("pagina congiunta dal suffisso -VdM", () => {
    expect(m("2027-003")).toMatchObject({ pagina_congiunta: true, fonte: "VDM" });
  });

  it("omaggio = importo 0; TOT diverso dalla somma segnalato", () => {
    expect(m("2027-005").importi).toEqual([{ voce: "servizio", importo: 100000 }, { voce: "memory_box", importo: 0 }]);
    expect(resoconto.avvisi).toContain("2027-005: TOT 1200 € diverso dalla somma delle voci 1000 €");
  });

  it("vecchi link dei chiusi scadono dopo 90 giorni", () => {
    expect(m("2025-010")).toMatchObject({ codice_legacy: "gh78", legacy_scade_il: "2027-02-19" });
    expect(m("2027-001").legacy_scade_il).toBeNull();
  });

  it("listino: importi in centesimi, riepilogo, regola ibrido, righe della pagina congiunta", () => {
    const v = (c: string) => dati.listino.find((x) => x.codice === c);
    expect(v("video")).toMatchObject({ prezzo: 148517, prezzo_barrato: 156312 });
    expect(v("box")).toMatchObject({ prezzo: 5000, riepilogo: "memory_box" });
    expect(v("op2-hyb")).toMatchObject({ solo_se: "proponi_op2_ibrido,!proponi_video", riepilogo: "secondo_operatore" });
    expect(v("savedate")).toMatchObject({ attiva: false });
    expect(v("duo-video")).toMatchObject({ prezzo: 146000, collegata_a: "video" });
  });

  it("fornitori senza gli Sposi, location mancanti create e segnalate", () => {
    expect(dati.fornitori).toEqual([{ categoria: "Fiori", nome: "Fiorista Uno", social: "@fiori" }]);
    expect(dati.location.map((l) => l.nome)).toEqual(["Villa Prova", "Location Nuova"]);
    expect(resoconto.avvisi).toContain("2027-002: location non presente in Dati, creata solo con il nome");
    expect(dati.collaboratori).toEqual([
      { codice: "MBA", nome: "Mattia Batalocco", ruolo: "videomaker" }, { codice: "CNT", nome: "Centobraccia", ruolo: "videomaker" },
    ]);
  });

  it("il resoconto non contiene nomi né contatti", () => {
    const testo = JSON.stringify(resoconto);
    for (const s of ["Anna", "Rossi", "example.com", "333"]) expect(testo).not.toContain(s);
  });
});
