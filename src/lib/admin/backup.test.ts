import { describe, expect, it } from "vitest";
import { daEliminare } from "./backup";

describe("pulizia backup", () => {
  it("tiene 30 giorni e il primo di ogni mese", () => {
    const n = (d: string) => `azph-backup-${d}.sql.gz`;
    const nomi = [n("2026-09-01"), n("2026-09-02"), n("2026-10-05"), n("2026-10-06"), n("2026-11-27"), n("2026-11-28")];
    expect(daEliminare(nomi, "2026-11-28")).toEqual([n("2026-09-02"), n("2026-10-06")]);
  });
});
