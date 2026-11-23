import { describe, expect, it } from "vitest";
import { dataOraRoma, istanteDaRoma } from "./ora-roma";

describe("ora di Roma", () => {
  it("converte con ora solare e legale", () => {
    expect(istanteDaRoma("2026-12-01T18:30")).toBe("2026-12-01T17:30:00.000Z");
    expect(istanteDaRoma("2027-06-10T09:00")).toBe("2027-06-10T07:00:00.000Z");
    expect(dataOraRoma("2026-12-01T17:30:00.000Z")).toBe("01.12.2026 18.30");
  });
});
