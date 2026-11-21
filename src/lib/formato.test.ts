import { describe, expect, it } from "vitest";
import { euro, euroBreve, data, dataEstesa, ora } from "./formato";
import { formatoEuro } from "@/app/[token]/testo";

describe("formati", () => {
  it("euro con il punto delle migliaia", () => {
    expect(euro(110000)).toBe("1.100,00 €");
    expect(euro(128757)).toBe("1.287,57 €");
    expect(euro(5000)).toBe("50,00 €");
    expect(euroBreve(110000)).toBe("1.100 €");
    expect(formatoEuro(1234567)).toBe("12.345,67");
  });
  it("date e ore", () => {
    expect(data("2027-06-12")).toBe("12.06.2027");
    expect(dataEstesa("2027-06-12")).toBe("sabato 12 giugno 2027");
    expect(ora("15:30:00")).toBe("15.30");
  });
});
