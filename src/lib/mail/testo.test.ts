import { describe, expect, it } from "vitest";
import { componi, riempi, stileDaColori, tabella } from "./testo";

describe("mail dai modelli", () => {
  it("riempie i segnaposto e lascia quelli sconosciuti", () => {
    expect(riempi("Ciao {NOMI}, {ALTRO}", { NOMI: "Anna e Bruno" })).toBe("Ciao Anna e Bruno, {ALTRO}");
  });

  it("grassetto, pulsante, blocco e testo semplice", () => {
    const r = componi("Ciao <Anna>,\nriepilogo:\n{RIEPILOGO}\n**Prossimi passi**\n[!Apri](https://x.it/abc)", {
      RIEPILOGO: tabella([["Servizio", "1.050,00 €"]], ["Totale", "1.050,00 €"]),
    });
    expect(r.html).toContain("Ciao &lt;Anna&gt;,");
    expect(r.html).toContain("<b>Prossimi passi</b>");
    expect(r.html).toContain('href="https://x.it/abc"');
    expect(r.html).toContain("<table");
    expect(r.testo).toContain("• Servizio: 1.050,00 €\nTotale: 1.050,00 €");
    expect(r.testo).toContain("Apri: https://x.it/abc");
    expect(r.testo).not.toContain("**");
  });

  it("il pulsante accetta solo link https", () => {
    expect(componi("[!Apri](javascript:alert(1))").html).toContain('href="#"');
  });
});

describe("firma e colori", () => {
  it("firma HTML in coda, firma breve nel testo", () => {
    const r = componi("A presto\n{FIRMA}", {}, stileDaColori({ salvia: "#9caf88", antracite: "#383838" }), { testo: "Alessandro", html: "<b>Firma</b>" });
    expect(r.testo).toBe("A presto\nAlessandro\n");
    expect(r.html).toContain("A presto<br>Alessandro");
    expect(r.html).not.toContain("{FIRMA}");
    expect(r.html.endsWith('<div style="margin-top:4px"><b>Firma</b></div>')).toBe(true);
  });
  it("pulsante salvia con testo antracite", () => {
    const r = componi("[!Apri](https://x.it)", {}, stileDaColori({ salvia: "#9caf88", antracite: "#383838" }));
    expect(r.html).toContain("background:#9caf88;color:#383838");
  });
});
