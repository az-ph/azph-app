import { randomBytes } from "node:crypto";

const ALFABETO = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Token casuale base62 per i link degli Sposi.
 * 22 caratteri ≈ 131 bit di entropia: non indovinabile.
 * Usa il rifiuto dei byte >= 248 per evitare distorsioni del modulo.
 */
export function nuovoToken(lunghezza = 22): string {
  if (lunghezza < 22) throw new Error("Token troppo corto: minimo 22 caratteri");
  let out = "";
  while (out.length < lunghezza) {
    for (const b of randomBytes(lunghezza * 2)) {
      if (b < 248) out += ALFABETO[b % 62];
      if (out.length === lunghezza) break;
    }
  }
  return out;
}
