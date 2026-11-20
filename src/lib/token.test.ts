import { describe, expect, it } from "vitest";
import { nuovoToken } from "./token";

describe("nuovoToken", () => {
  it("genera 22 caratteri base62", () => {
    const t = nuovoToken();
    expect(t).toHaveLength(22);
    expect(t).toMatch(/^[0-9A-Za-z]{22}$/);
  });

  it("non ripete token", () => {
    const set = new Set(Array.from({ length: 1000 }, () => nuovoToken()));
    expect(set.size).toBe(1000);
  });

  it("rifiuta token più corti di 22", () => {
    expect(() => nuovoToken(8)).toThrow();
  });
});
