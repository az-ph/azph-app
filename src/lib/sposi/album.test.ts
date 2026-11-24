import { describe, expect, it } from "vitest";
import { faseAlbum, piuMesi, propostaAperta, percorsoAnteprima, selezioneModificabile, testoCopertina, tipoAlbum, type BloccoAlbum, type RigaAlbum } from "./album";

const blocco: BloccoAlbum = {
  codici: { standard: "alb-std", premium: "alb-prm" }, soglia_standard: 45000,
  copertine: { standard: [{ valore: "lino", etichetta: "Lino naturale" }, { valore: "metacrilato", etichetta: "Similpelle con foto su metacrilato" }] },
};
const vuoto: RigaAlbum = {
  tipo: null, selezione_il: null, copertina: null, copertina_nota: null, note_sposi: null, anteprima_path: null,
  anteprima_nome: null, anteprima_il: null, approvato_il: null, modifiche_il: null, note_modifiche: null,
};

describe("tipoAlbum", () => {
  it("scheda, poi scelte, poi importo", () => {
    expect(tipoAlbum({ tipo: "premium", scelte: ["alb-std"], importoAlbum: 30000, blocco })).toBe("premium");
    expect(tipoAlbum({ tipo: null, scelte: ["alb-std"], importoAlbum: 90000, blocco })).toBe("standard");
    expect(tipoAlbum({ tipo: null, scelte: ["alb-prm"], importoAlbum: 30000, blocco })).toBe("premium");
    expect(tipoAlbum({ tipo: null, scelte: [], importoAlbum: 45000, blocco })).toBe("standard");
    expect(tipoAlbum({ tipo: null, scelte: [], importoAlbum: 50000, blocco })).toBe("premium");
  });
});

describe("faseAlbum", () => {
  it("istruzioni e selezione", () => {
    expect(faseAlbum("wdg_album_todo", null)).toBe("istruzioni");
    expect(faseAlbum("wdg_album_todo", { ...vuoto, selezione_il: "2026-12-01T10:00:00Z" })).toBe("selezione");
    expect(faseAlbum("wdg_invoice", null)).toBeNull();
  });
  it("anteprima, modifiche, nuova versione, approvazione", () => {
    const a = { ...vuoto, selezione_il: "2026-12-01T10:00:00Z", anteprima_path: "x/1.pdf", anteprima_il: "2026-12-05T10:00:00Z" };
    expect(faseAlbum("wdg_album", a)).toBe("anteprima");
    const mod = { ...a, modifiche_il: "2026-12-06T10:00:00Z" };
    expect(faseAlbum("wdg_album", mod)).toBe("modifiche");
    expect(faseAlbum("wdg_album", { ...mod, anteprima_il: "2026-12-08T10:00:00Z" })).toBe("anteprima");
    const ok = { ...a, approvato_il: "2026-12-09T10:00:00Z" };
    expect(faseAlbum("wdg_album", ok)).toBe("approvato");
    expect(faseAlbum("wdg_invoice", ok)).toBe("approvato");
    // approvazione di una versione precedente: non vale
    expect(faseAlbum("wdg_invoice", { ...ok, anteprima_il: "2026-12-10T10:00:00Z" })).toBeNull();
  });
  it("selezione modificabile solo prima dell'anteprima", () => {
    expect(selezioneModificabile("wdg_album_todo", null)).toBe(true);
    expect(selezioneModificabile("wdg_album", { ...vuoto, anteprima_path: "x" })).toBe(false);
    expect(selezioneModificabile("wdg_invoice", null)).toBe(false);
  });
});

describe("testi", () => {
  it("copertina con nota", () => {
    expect(testoCopertina(blocco, { copertina: "metacrilato", copertina_nota: "foto 123" })).toBe("Similpelle con foto su metacrilato (foto 123)");
    expect(testoCopertina(blocco, { copertina: null, copertina_nota: null })).toBe("");
  });
  it("percorso senza dati personali", () => {
    expect(percorsoAnteprima("abc", "pdf", new Date("2026-12-01T10:20:30.123Z"))).toBe("abc/20261201T102030.pdf");
  });
});

describe("proposta album", () => {
  const base = { stato: "clo_completed", importoAlbum: 0, scelto: false, consegna: "2026-01-31", dataMatrimonio: "2025-12-01", mesi: 12, oggi: "2026-11-24" };
  it("entro i mesi dalla consegna, senza album", () => {
    expect(propostaAperta(base)).toBe(true);
    expect(propostaAperta({ ...base, oggi: "2027-02-01" })).toBe(false);
    expect(propostaAperta({ ...base, importoAlbum: 50000 })).toBe(false);
    expect(propostaAperta({ ...base, stato: "wdg_lightroom" })).toBe(false);
    expect(propostaAperta({ ...base, mesi: undefined })).toBe(false);
  });
  it("senza consegna vale la data del Matrimonio", () => {
    expect(propostaAperta({ ...base, consegna: null, dataMatrimonio: "2025-06-01" })).toBe(false);
    expect(propostaAperta({ ...base, consegna: null, dataMatrimonio: "2026-06-01" })).toBe(true);
  });
  it("mesi", () => { expect(piuMesi("2026-01-31", 1)).toBe("2026-03-03"); expect(piuMesi("2026-11-24", 12)).toBe("2027-11-24"); });
});
