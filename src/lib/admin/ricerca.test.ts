import { describe, expect, it } from "vitest";
import { filtra, raggruppa, type VoceElenco } from "./ricerca";

const v = (x: Partial<VoceElenco>): VoceElenco => ({ id: x.codice ?? "i", codice: "C", stato: "wdg_confermato", data: null, nomi: "", location: "", fonte: "", token: null, senzaPreventivo: false, ...x });
const elenco = [
  v({ codice: "2026-044", nomi: "Silvia e Andrea", data: "2026-12-12", location: "Castello San Lorenzo - San Lorenzo de' Picenardi", fonte: "WEB" }),
  v({ codice: "2026-030", nomi: "Mariana e Alessandro", data: "2026-07-25", stato: "wdg_lightroom", location: "Villa dei Mulini" }),
  v({ codice: "2026-092", nomi: "Luana e Nicolas", data: "2027-09-17", stato: "qte_quote", fonte: "MAT" }),
  v({ codice: "2025-010", nomi: "Chiara e Niccolò", data: "2025-06-01", stato: "clo_completed", location: "Villa dei Mulini" }),
];

describe("ricerca Matrimoni", () => {
  it("cerca per nome, data, mese, location, stato; tutte le parole", () => {
    expect(filtra(elenco, "silvia", "tutti").map((x) => x.codice)).toEqual(["2026-044"]);
    expect(filtra(elenco, "12.12", "tutti").map((x) => x.codice)).toEqual(["2026-044"]);
    expect(filtra(elenco, "settembre 2027", "tutti").map((x) => x.codice)).toEqual(["2026-092"]);
    expect(filtra(elenco, "mulini", "tutti").map((x) => x.codice)).toEqual(["2026-030", "2025-010"]);
    expect(filtra(elenco, "niccolo", "tutti").map((x) => x.codice)).toEqual(["2025-010"]);
    expect(filtra(elenco, "lightroom", "tutti").map((x) => x.codice)).toEqual(["2026-030"]);
  });
  it("chiusi solo cercando o con il filtro", () => {
    expect(filtra(elenco, "", "tutti").map((x) => x.codice)).toEqual(["2026-044", "2026-030", "2026-092"]);
    expect(filtra(elenco, "", "chiusi").map((x) => x.codice)).toEqual(["2025-010"]);
    expect(filtra(elenco, "", "preventivo").map((x) => x.codice)).toEqual(["2026-092"]);
  });
  it("confermati da fare e fatti", () => {
    const g = raggruppa(elenco, "2026-11-24");
    expect(g.map((x) => `${x.titolo}:${x.voci.map((y) => y.codice).join(",")}`)).toEqual([
      "Preventivi:2026-092", "Confermati da fare:2026-044", "Confermati fatti:2026-030", "Chiusi e persi:2025-010",
    ]);
  });
});
