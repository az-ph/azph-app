import { describe, expect, it } from "vitest";
import { nomiBrevi, nuovoToken, prezziInTesto } from "./stati";
import { leggiPrezziSpeciali } from "@/lib/listino/motore";

describe("utilità admin", () => {
  it("token di 22 caratteri base62, tutti diversi", () => {
    const t = new Set(Array.from({ length: 200 }, () => nuovoToken()));
    expect(t.size).toBe(200);
    for (const x of t) expect(x).toMatch(/^[A-Za-z0-9]{22}$/);
  });
  it("nomi brevi in ordine", () => {
    expect(nomiBrevi([{ ordine: 2, nome: "Luca Bianchi" }, { ordine: 1, nome: "Anna Rossi" }])).toBe("Anna e Luca");
  });
  it("prezzi speciali andata e ritorno", () => {
    const p = { box: 0, servizio: 110000, "op2-hyb": 40050 };
    expect(leggiPrezziSpeciali(prezziInTesto(p))).toEqual(p);
  });
});

describe("fonti", () => {
  it("unisce quelle di base con quelle usate, ALTRO in fondo", async () => {
    const { unisciFonti } = await import("./stati");
    const f = unisciFonti(["VDM", "MAT", null, " WP "], "ZZZ");
    expect(f.at(-1)).toBe("ALTRO");
    expect(f).toEqual(expect.arrayContaining(["VDM", "WP", "ZZZ", "MAT", "PSP"]));
    expect(new Set(f).size).toBe(f.length);
  });
});
