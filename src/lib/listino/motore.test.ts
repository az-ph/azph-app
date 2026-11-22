import { describe, expect, it } from "vitest";
import {
  calcolaOfferta, selezione, importiConferma, piano, leggiPrezziSpeciali, euroInCentesimi, ErroreSelezione,
  type Preventivo,
} from "./motore";
import { LISTINO_TEST as L } from "./listino-test";

const prev = (p: Partial<Preventivo>): Preventivo => ({ opzioni: {}, prezziSpeciali: {}, ...p });
const codici = (voci: { codice: string }[]) => voci.map((v) => v.codice);

describe("parità con le conferme reali del foglio Matrimoni", () => {
  it("2026-096: W-CIV-1F, servizio 1000, memory box → 1.050 €", () => {
    const off = calcolaOfferta(L, prev({ formula: "W-CIV-1F", prezziSpeciali: leggiPrezziSpeciali("servizio = 1000") }));
    const sel = selezione(off.voci, { extra: ["box"] });
    const imp = importiConferma(off, sel);
    expect(imp.perVoce).toEqual({ servizio: 100000, memory_box: 5000 });
    expect(imp.totaleFoto).toBe(105000);
  });

  it("2026-097: N-CIV-1F, servizio 1000, ibrido a 400 → 1.400 €", () => {
    const off = calcolaOfferta(L, prev({
      formula: "N-CIV-1F",
      opzioni: { proponi_op2_ibrido: true },
      prezziSpeciali: leggiPrezziSpeciali("servizio = 1000\nop2-hyb = 400"),
    }));
    const sel = selezione(off.voci, { extra: ["op2-hyb"] });
    const imp = importiConferma(off, sel);
    expect(imp.perVoce).toEqual({ servizio: 100000, secondo_operatore: 40000 });
    expect(imp.totaleFoto).toBe(140000);
    expect(sel.foto[0].etichetta).toBe("Secondo operatore - Foto e video: cerimonia, aperitivo e ricevimento");
  });

  it("2026-106: W-REL-1F, servizio 1100, box + album standard + video Emozione → 1.600 € foto + video a parte", () => {
    const off = calcolaOfferta(L, prev({
      formula: "W-REL-1F", opzioni: { proponi_video: true }, prezziSpeciali: leggiPrezziSpeciali("servizio =1100"),
    }));
    const sel = selezione(off.voci, { extra: ["box", "alb-std"], video: "video" });
    const imp = importiConferma(off, sel);
    expect(imp.perVoce).toEqual({ servizio: 110000, memory_box: 5000, album: 45000 });
    expect(imp.totaleFoto).toBe(160000);
    expect(imp.totaleVideo).toBe(148517);
    expect(piano(imp.perVoce)).toEqual({ totale: 160000, album: 45000, servizi: 115000, acconto: 57500 });
  });
});

describe("regole del listino", () => {
  it("prezzo speciale: barrato = il più alto tra listino e barrato", () => {
    const off = calcolaOfferta(L, prev({ formula: "W-REL-1F", prezziSpeciali: { servizio: 110000 } }));
    expect(off.servizio).toEqual({ prezzo: 110000, barrato: 140000 });
  });

  it("senza formula né prezzo speciale il servizio è 0", () => {
    expect(calcolaOfferta(L, prev({})).servizio).toEqual({ prezzo: 0, barrato: 0 });
  });

  it("extra a 0 diventa omaggio incluso e selezionato da solo", () => {
    const off = calcolaOfferta(L, prev({ formula: "W-REL-1F", prezziSpeciali: leggiPrezziSpeciali("box = 0") }));
    const box = off.voci.find((v) => v.codice === "box")!;
    expect(box).toMatchObject({ prezzo: 0, barrato: 5000, incluso: true });
    const sel = selezione(off.voci, { extra: [] });
    expect(sel.foto.map((x) => x.etichetta)).toEqual(["Memory box (omaggio)"]);
    expect(importiConferma(off, sel).perVoce.memory_box).toBe(0);
  });

  it("video e prematrimoniale compaiono solo se proposti", () => {
    const base = codici(calcolaOfferta(L, prev({})).voci);
    expect(base).not.toContain("video");
    expect(base).not.toContain("prewdg");
    const tutto = codici(calcolaOfferta(L, prev({ opzioni: { proponi_video: true, proponi_prewedding: true } })).voci);
    expect(tutto).toEqual(expect.arrayContaining(["video", "video-sguardo", "v-trailer", "prewdg"]));
  });

  it("voci disattivate non compaiono", () => {
    expect(codici(calcolaOfferta(L, prev({ opzioni: { proponi_video: true } })).voci)).not.toContain("savedate");
  });

  it("ibrido solo se proposto, e mai insieme al video", () => {
    expect(codici(calcolaOfferta(L, prev({})).voci)).not.toContain("op2-hyb");
    expect(codici(calcolaOfferta(L, prev({ opzioni: { proponi_op2_ibrido: true } })).voci)).toContain("op2-hyb");
    expect(codici(calcolaOfferta(L, prev({ opzioni: { proponi_op2_ibrido: true, proponi_video: true } })).voci))
      .not.toContain("op2-hyb");
  });

  it("una sola voce per gruppo e un solo album", () => {
    const off = calcolaOfferta(L, prev({ formula: "W-REL-1F" }));
    expect(() => selezione(off.voci, { extra: ["op2-prep", "op2-full"] })).toThrow(ErroreSelezione);
    expect(() => selezione(off.voci, { extra: ["alb-std", "alb-prm"] })).toThrow(ErroreSelezione);
  });

  it("album genitori solo con l'album collegato, massimo 10 copie, con prezzo speciale", () => {
    const off = calcolaOfferta(L, prev({ formula: "W-CIV-1F", prezziSpeciali: leggiPrezziSpeciali("rep-prm = 80") }));
    expect(selezione(off.voci, { extra: ["alb-std"], qta: { "rep-prm": 2 } }).foto.map((x) => x.codice)).toEqual(["alb-std"]);
    const sel = selezione(off.voci, { extra: ["alb-prm"], qta: { "rep-prm": 25 } });
    const rep = sel.foto.find((x) => x.codice === "rep-prm")!;
    expect(rep).toMatchObject({ qta: 10, totale: 80000, etichetta: "Album genitori × 10" });
    expect(importiConferma(off, sel).perVoce).toMatchObject({ album: 55000, album_genitori: 80000 });
  });

  it("pacchetto video sconosciuto → errore", () => {
    const off = calcolaOfferta(L, prev({ opzioni: { proponi_video: true } }));
    expect(() => selezione(off.voci, { extra: [], video: "inesistente" })).toThrow(ErroreSelezione);
  });

  it("opzionali video solo con un pacchetto scelto", () => {
    const off = calcolaOfferta(L, prev({ opzioni: { proponi_video: true } }));
    expect(selezione(off.voci, { extra: ["v-trailer"] }).video).toEqual([]);
    expect(selezione(off.voci, { extra: ["v-trailer"], video: "video" }).video.map((x) => x.etichetta))
      .toEqual(["Pacchetto Emozione", "Video - Trailer"]);
  });
});

describe("pagina congiunta foto + video", () => {
  const duo = prev({ formula: "W-CIV-1F", paginaCongiunta: true });

  it("fotografia a prezzo pacchetto, solo il pacchetto video incluso", () => {
    const off = calcolaOfferta(L, duo);
    expect(off.servizio).toEqual({ prezzo: 119000, barrato: 140000 });
    const basi = off.voci.filter((v) => v.categoria === "video-base");
    expect(basi).toHaveLength(1);
    expect(basi[0]).toMatchObject({ codice: "video", voce: "Pacchetto Emozione", prezzo: 146000, barrato: 156312 });
  });

  it("opzionali video a prezzo pieno e memory box condivisa", () => {
    const off = calcolaOfferta(L, duo);
    expect(off.voci.find((v) => v.codice === "v-trailer")).toMatchObject({ prezzo: 20696, barrato: 0 });
    expect(off.voci.find((v) => v.codice === "box")).toMatchObject({ prezzo: 7000, condiviso: true });
  });

  it("togliendo il video la fotografia torna a prezzo pieno, e viceversa", () => {
    expect(calcolaOfferta(L, duo, { conVideo: false }).servizio).toEqual({ prezzo: 140000, barrato: 0 });
    const soloVideo = calcolaOfferta(L, duo, { conFoto: false });
    expect(soloVideo.voci.find((v) => v.codice === "video")).toMatchObject({ prezzo: 156312, barrato: 0 });
  });

  it("senza righe duo nel listino è un errore di configurazione", () => {
    expect(() => calcolaOfferta(L.filter((v) => v.categoria !== "duo"), duo)).toThrow();
  });
});

describe("conversioni", () => {
  it("euro in centesimi dai formati del foglio", () => {
    expect(euroInCentesimi("1.287,57 €")).toBe(128757);
    expect(euroInCentesimi("€ 1.100,00")).toBe(110000);
    expect(euroInCentesimi("1100")).toBe(110000);
    expect(euroInCentesimi(1563.12)).toBe(156312);
    expect(euroInCentesimi("")).toBe(0);
  });

  it("prezzi speciali con spazi e separatori diversi", () => {
    expect(leggiPrezziSpeciali("servizio =1100\nbox = 0; rep-prm = 80")).toEqual({ servizio: 110000, box: 0, "rep-prm": 8000 });
  });
});

describe("album genitori con più album", () => {
  const listino = L.map((v) => (v.codice === "rep-prm" ? { ...v, collegataA: "alb-prm, alb-std" } : v));
  it("si somma anche con l'album Standard", () => {
    const off = calcolaOfferta(listino, prev({ formula: "W-CIV-1F" }));
    const sel = selezione(off.voci, { extra: ["alb-std"], qta: { "rep-prm": 2 } });
    expect(sel.foto.find((x) => x.codice === "rep-prm")?.totale).toBe(20000);
  });
  it("senza album non si somma", () => {
    const off = calcolaOfferta(listino, prev({ formula: "W-CIV-1F" }));
    const sel = selezione(off.voci, { extra: [], qta: { "rep-prm": 2 } });
    expect(sel.foto.find((x) => x.codice === "rep-prm")).toBeUndefined();
  });
});
