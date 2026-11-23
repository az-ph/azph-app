import { describe, expect, it } from "vitest";
import { eventoDaRiprendere, eventoMatrimonio, type DatiEvento } from "./evento-matrimonio";

const base: DatiEvento = {
  codice: "2026-044", stato: "wdg_confermato", fonte: "WEB", nomi: "Silvia e Andrea", dataInizio: "2026-12-12", dataFine: null,
  oraInizio: null, oraFine: null, luogo: "Castello San Lorenzo", scheda: "https://x/admin/matrimoni/1",
  telefoni: [{ nome: "Silvia", telefono: "+39 333 1" }, { nome: "Andrea", telefono: "" }],
  timeline: [{ giorno: 1, ora: "08:00:00" }, { giorno: 1, ora: null }, { giorno: 1, ora: "19:00:00" }],
};

describe("evento del Matrimonio", () => {
  it("titolo, orari dalla timeline, telefoni e scheda", () => {
    expect(eventoMatrimonio(base)).toEqual({
      titolo: "[WDG][WEB] Silvia e Andrea", luogo: "Castello San Lorenzo",
      descrizione: "Silvia: +39 333 1\nScheda 2026-044: https://x/admin/matrimoni/1",
      inizio: "2026-12-12T08:00", minuti: 660,
    });
  });
  it("dopo mezzanotte, giornata intera senza orari, stati senza evento", () => {
    const notte = eventoMatrimonio({ ...base, timeline: [{ giorno: 1, ora: "16:00" }, { giorno: 2, ora: "01:30" }] });
    expect(notte).toMatchObject({ inizio: "2026-12-12T16:00", minuti: 570 });
    expect(eventoMatrimonio({ ...base, oraInizio: "16:00", oraFine: "01:00" })).toMatchObject({ minuti: 540 });
    expect(eventoMatrimonio({ ...base, timeline: [] })).toMatchObject({ giorni: { dal: "2026-12-12", al: "2026-12-12" } });
    expect(eventoMatrimonio({ ...base, stato: "qte_quote", fonte: null })?.titolo).toBe("[QTE] Silvia e Andrea");
    expect(eventoMatrimonio({ ...base, stato: "clo_lost" })).toBeNull();
    expect(eventoMatrimonio({ ...base, stato: "qte_to_contact" })).toBeNull();
    expect(eventoMatrimonio({ ...base, dataInizio: null })).toBeNull();
    expect(eventoMatrimonio({ ...base, oraInizio: "00:00:00" })).toMatchObject({ inizio: "2026-12-12T08:00" });
    expect(eventoMatrimonio({ ...base, timeline: [], dataFine: "2026-12-01" })).toMatchObject({ giorni: { dal: "2026-12-12", al: "2026-12-12" } });
  });
  it("riprende l'evento del foglio solo se ce n'è uno con gli stessi nomi", () => {
    const ev = [{ id: "a", titolo: "[WDG][WEB] Silvia e Andrea" }, { id: "b", titolo: "Battesimo" }, { id: "c", titolo: "[QTE][MAT] Sara e Luca" }];
    expect(eventoDaRiprendere(ev, "Silvia e Andrea")).toBe("a");
    expect(eventoDaRiprendere(ev, "Sara")).toBeNull();
    expect(eventoDaRiprendere([...ev, { id: "d", titolo: "[WDG] silvia e andrea" }], "Silvia e Andrea")).toBeNull();
  });
});
