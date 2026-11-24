import { describe, expect, it } from "vitest";
import { calcolaRate } from "./rate";

const perVoce = { servizio: 110000, secondo_operatore: 50000, album: 45000, album_genitori: 10000 };

describe("rate dei pagamenti", () => {
  it("acconto 50% dei servizi, album a parte, scadenza 3 settimane prima", () => {
    const r = calcolaRate(perVoce, [], "2027-09-18");
    expect(r).toEqual([
      { tipo: "acconto", dovuto: 80000, incassato: 0, scadenza: "2027-08-28" },
      { tipo: "saldo", dovuto: 80000, incassato: 0, scadenza: null },
      { tipo: "album", dovuto: 55000, incassato: 0, scadenza: null },
    ]);
  });
  it("acconto diverso dal calcolo: diventa quanto incassato e il saldo si ricalcola", () => {
    const r = calcolaRate(perVoce, [{ tipo: "acconto", importo: 50000, pagato_il: "2027-08-20" }]);
    expect(r[0]).toMatchObject({ dovuto: 50000, incassato: 50000 });
    expect(r[1]).toMatchObject({ dovuto: 110000, incassato: 0 });
  });
  it("incasso unico dal foglio: copre acconto, poi saldo, poi album", () => {
    const r = calcolaRate(perVoce, [{ tipo: "altro", importo: 170000, pagato_il: "2026-11-21" }]);
    expect(r.map((x) => x.incassato)).toEqual([80000, 80000, 10000]);
  });
  it("le righe senza data di pagamento non contano", () => {
    expect(calcolaRate(perVoce, [{ tipo: "saldo", importo: 80000, pagato_il: null }])[1].incassato).toBe(0);
  });
});

describe("rate pagate in più", () => {
  it("il saldo pagato in più copre l'acconto che manca", () => {
    const r = calcolaRate({ servizio: 100000, memory_box: 5000, album: 50000 }, [
      { tipo: "altro", importo: 50000, pagato_il: "2026-11-21" },
      { tipo: "saldo", importo: 55000, pagato_il: "2026-11-24" },
    ], "2026-07-25");
    expect(r.map((x) => [x.tipo, x.dovuto, x.incassato])).toEqual([["acconto", 52500, 52500], ["saldo", 52500, 52500], ["album", 50000, 0]]);
  });
  it("l'eccedenza oltre il totale resta visibile sull'ultima rata", () => {
    const r = calcolaRate({ servizio: 100000 }, [{ tipo: "saldo", importo: 110000, pagato_il: "2026-11-24" }], null);
    expect(r.map((x) => [x.tipo, x.incassato])).toEqual([["acconto", 50000], ["saldo", 60000]]);
  });
});
