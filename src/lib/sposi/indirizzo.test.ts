import { describe, expect, it } from "vitest";
import { campiMancanti, dividiIndirizzo, indirizzoValido, unisciIndirizzo } from "./indirizzo";

describe("indirizzi e campi obbligatori", () => {
  it("divide e unisce", () => {
    const i = dividiIndirizzo("Via Roma 1 - 46100 Mantova MN");
    expect(i).toEqual({ via: "Via Roma 1", cap: "46100", loc: "Mantova", prov: "MN" });
    expect(unisciIndirizzo(i)).toBe("Via Roma 1 - 46100 Mantova MN");
  });
  it("indirizzo vuoto o completo", () => {
    expect(indirizzoValido({ via: "", cap: "", loc: "", prov: "" })).toBe(true);
    expect(indirizzoValido({ via: "Via Roma 1", cap: "461", loc: "Mantova", prov: "MN" })).toBe(false);
  });
  it("elenca i campi mancanti, spunta compresa", () => {
    const ok = { nome: "Anna Rossi", telefono: "333 1234567", email: "a@b.it", codice_fiscale: "RSSNNA90A41E897X" };
    expect(campiMancanti([ok, ok], true)).toEqual([]);
    const m = campiMancanti([ok, { ...ok, telefono: "", codice_fiscale: "abc" }], false).map((x) => x.chiave);
    expect(m).toEqual(["1.telefono", "1.codice_fiscale", "accetto"]);
  });
});
