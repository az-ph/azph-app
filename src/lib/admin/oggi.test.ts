import { describe, expect, it } from "vitest";
import { cosaFare, type MatrimonioOggi } from "./oggi";

const base = (x: Partial<MatrimonioOggi>): MatrimonioOggi => ({
  id: x.codice ?? "id", codice: "C", nomi: "A e B", stato: "wdg_confermato", data: null, kickoff: null, preventivo: null,
  aperture: 0, ultimaApertura: null, importi: {}, incassi: [], ...x,
});
const oggi = "2026-11-23";

describe("Oggi", () => {
  it("acconto in scadenza, saldo nello stato Saldo, kick-off, preventivi, prossimi", () => {
    const r = cosaFare([
      base({ codice: "acc", data: "2026-12-05", importi: { servizio: 120000 } }),                 // acconto scade il 14.11: scaduto
      base({ codice: "acc-ok", data: "2026-12-05", importi: { servizio: 120000 }, incassi: [{ tipo: "acconto", importo: 60000, pagato_il: "2026-11-20" }], kickoff: "2026-11-20" }),
      base({ codice: "lontano", data: "2027-06-12", importi: { servizio: 120000 } }),
      base({ codice: "saldo", stato: "wdg_invoice", data: "2026-10-01", importi: { servizio: 120000, album: 45000 }, incassi: [{ tipo: "acconto", importo: 60000, pagato_il: "2026-09-10" }] }),
      base({ codice: "nuovo", stato: "qte_to_contact" }),
      base({ codice: "follow", stato: "qte_quote", preventivo: { inviato: "2026-11-10", confermato: null }, aperture: 3 }),
      base({ codice: "fresco", stato: "qte_quote", preventivo: { inviato: "2026-11-20", confermato: null } }),
    ], oggi);
    expect(r.pagamenti.map((p) => `${p.m.codice}:${p.rata}:${p.manca}:${p.scaduto}`)).toEqual(["acc:acconto:60000:true", "saldo:saldo:60000:false", "saldo:album:45000:false"]);
    expect(r.kickoff.map((m) => m.codice)).toEqual(["acc"]);
    expect(r.daInviare.map((m) => m.codice)).toEqual(["nuovo"]);
    expect(r.followup.map((m) => m.codice)).toEqual(["follow"]);
    expect(r.prossimi.map((m) => m.codice)).toEqual(["acc", "acc-ok"]);
  });
});
