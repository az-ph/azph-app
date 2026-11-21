import { describe, expect, it } from "vitest";
import { componiPagina, modoDaStato, nomiSposi, leggiGallerie, type RigheGrezze } from "./componi";

const base = (): RigheGrezze => ({
  matrimonio: {
    id: "m1", codice_id: "2027-001", stato: "qte_quote", data_inizio: "2027-05-12", data_fine: null, preparativi: null,
    galleria_url: "Villa | https://example.com/a\nnon-un-link", copertina_url: null, link_upyourshoot: "https://uys/x",
    pagina_congiunta: false,
    location: { nome: "Villa Prova", comune: "Mantova", provincia: "MN", galleria_url: "https://example.com/b", copertina_url: "https://example.com/c.jpg" },
    formula: { codice: "W-REL-1F" }, videomaker: null,
  },
  sposi: [
    { ordine: 1, nome: "Anna Rossi", telefono: "1", email: "a@x", codice_fiscale: null, indirizzo: null, indirizzo_preparativi: null, consenso_promo: true },
    { ordine: 2, nome: "Bruno", telefono: null, email: null, codice_fiscale: null, indirizzo: null, indirizzo_preparativi: null, consenso_promo: false },
  ],
  preventivo: { id: "p1", versione: 1, opzioni: {}, prezzi_speciali: {}, preselezione: ["box"], scelte: [], confermato_il: null },
  listino: [],
  timeline: [
    { giorno: 1, ora: "15:00:00", fase: "Rito", luogo: "Chiesa", nota_privata: false, ordine: 1 },
    { giorno: 1, ora: null, fase: "SCONTO SEGRETO", luogo: null, nota_privata: true, ordine: 0 },
  ],
  importi: [], pagamenti: [],
  blocchi: [
    { chiave: "mi-presento", ordine: 10, quando: "preventivo", dati: { titolo: "Mi presento" } },
    { chiave: "servizio-duo", ordine: 40, quando: "preventivo_duo", dati: { titolo: "Foto + Video" } },
    { chiave: "opzionali", ordine: 50, quando: "preventivo", dati: { titolo: "Rendetelo vostro" } },
    { chiave: "area-sposi", ordine: 40, quando: "sposi", dati: { titolo: "Il vostro Matrimonio" } },
  ],
  impostazioni: { marchio: { nome: "AZ-ph", email_notifiche: "segreto@x", iban: "IT00" }, zone: ["Mantova"], url_recensioni: null, condizioni_pagamento: null },
  contratto: { id: "c1", testo: "# Contratto" },
});

describe("pagina Sposi", () => {
  it("modo dallo stato", () => {
    expect(modoDaStato("qte_quote")).toBe("preventivo");
    expect(modoDaStato("wdg_lightroom")).toBe("sposi");
    expect(modoDaStato("clo_completed")).toBe("chiuso");
    expect(modoDaStato("clo_lost")).toBe("non_disponibile");
  });

  it("nomi e gallerie", () => {
    expect(nomiSposi([{ nome: "Anna Rossi" }, { nome: "Bruno" }])).toBe("Anna e Bruno");
    expect(leggiGallerie("Villa | https://a\nhttps://b\nniente")).toEqual([
      { titolo: "Villa", url: "https://a" }, { titolo: "Un real wedding pensato per voi", url: "https://b" },
    ]);
  });

  it("niente note private né impostazioni interne verso il browser", () => {
    const p = componiPagina(base());
    const json = JSON.stringify(p);
    expect(json).not.toContain("SCONTO SEGRETO");
    expect(json).not.toContain("segreto@x");
    expect(p.timeline).toEqual([{ giorno: 1, ora: "15:00", fase: "Rito", luogo: "Chiesa" }]);
    expect(p.marchio).toEqual({ nome: "AZ-ph", iban: "IT00" });
  });

  it("galleria degli Sposi solo dopo la conferma", () => {
    expect(componiPagina(base()).matrimonio.galleriaSposi).toBe("");
    const r = base(); r.matrimonio.stato = "wdg_lightroom";
    expect(componiPagina(r).matrimonio.galleriaSposi).toBe("https://uys/x");
  });

  it("blocchi secondo modo e pagina congiunta", () => {
    expect(componiPagina(base()).blocchi.map((b) => b.chiave)).toEqual(["mi-presento", "opzionali"]);
    const duo = base(); duo.matrimonio.pagina_congiunta = true;
    expect(componiPagina(duo).blocchi.map((b) => b.chiave)).toEqual(["servizio-duo", "opzionali"]);
    const sposi = base(); sposi.matrimonio.stato = "wdg_confermato";
    expect(componiPagina(sposi).blocchi.map((b) => b.chiave)).toEqual(["area-sposi"]);
  });

  it("copertina: matrimonio, poi location, poi marchio", () => {
    expect(componiPagina(base()).matrimonio.copertina).toBe("https://example.com/c.jpg");
  });
});
