import { describe, expect, it } from "vitest";
import { leggiTimeline, scriviTimeline } from "./timeline";

describe("timeline come testo", () => {
  const testo = "13.45 Preparativi | B&B Monzambano\n16:00 Rito civile | Villa\n\n# parcheggio sul retro\n22.30 Balli\n01.00 Fine servizio\nTaglio torta";
  it("legge orari, luoghi, note private e il passaggio dopo mezzanotte", () => {
    const { righe, errori } = leggiTimeline(testo);
    expect(errori).toEqual([]);
    expect(righe.map((r) => [r.giorno, r.ora, r.fase, r.luogo, r.nota_privata])).toEqual([
      [1, "13:45", "Preparativi", "B&B Monzambano", false],
      [1, "16:00", "Rito civile", "Villa", false],
      [1, null, "parcheggio sul retro", null, true],
      [1, "22:30", "Balli", null, false],
      [2, "01:00", "Fine servizio", null, false],
      [2, null, "Taglio torta", null, false],
    ]);
  });
  it("riscrive lo stesso testo", () => {
    expect(scriviTimeline(leggiTimeline(testo).righe)).toBe("13.45 Preparativi | B&B Monzambano\n16.00 Rito civile | Villa\n# parcheggio sul retro\n22.30 Balli\n01.00 Fine servizio\nTaglio torta");
  });
  it("segnala gli orari sbagliati", () => {
    expect(leggiTimeline("25.00 Festa").errori[0]).toContain("non valido");
  });
});
