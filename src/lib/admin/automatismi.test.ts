import { describe, expect, it } from "vitest";
import { cambiDelGiorno } from "./automatismi";
import type { MatrimonioOggi } from "./oggi";

const m = (x: Partial<MatrimonioOggi>): MatrimonioOggi => ({
  id: "1", codice: "2026-001", nomi: "A e B", stato: "wdg_confermato", data: "2026-11-27", kickoff: null, preventivo: null,
  aperture: 0, ultimaApertura: null, importi: {}, incassi: [], ...x,
});

describe("cambiDelGiorno", () => {
  it("il giorno dopo il Matrimonio passa a Lightroom", () => {
    expect(cambiDelGiorno([m({})], "2026-11-28").map((c) => c.a)).toEqual(["wdg_lightroom"]);
    expect(cambiDelGiorno([m({ data: "2026-11-28" })], "2026-11-28")).toEqual([]);
  });
  it("Saldo tutto incassato → Chiuso; album ancora da pagare → no", () => {
    const saldo = { stato: "wdg_invoice", importi: { servizio: 200000, album: 50000 } };
    expect(cambiDelGiorno([m({ ...saldo, incassi: [{ tipo: "acconto", importo: 100000, pagato_il: "x" }, { tipo: "saldo", importo: 150000, pagato_il: "x" }] })], "2026-11-28")[0]?.a).toBe("clo_completed");
    expect(cambiDelGiorno([m({ ...saldo, incassi: [{ tipo: "acconto", importo: 100000, pagato_il: "x" }, { tipo: "saldo", importo: 100000, pagato_il: "x" }] })], "2026-11-28")).toEqual([]);
    expect(cambiDelGiorno([m({ stato: "wdg_invoice", importi: {}, incassi: [] })], "2026-11-28")).toEqual([]);
  });
  it("altri stati non cambiano", () => {
    expect(cambiDelGiorno([m({ stato: "wdg_lightroom" }), m({ stato: "qte_quote" })], "2026-11-28")).toEqual([]);
  });
});
