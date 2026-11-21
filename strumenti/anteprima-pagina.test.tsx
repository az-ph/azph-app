// Anteprima statica della pagina Sposi con dati inventati: ANTEPRIMA=1 MODO=sposi|preventivo npx vitest run → /tmp/anteprima/*.html
// Esclusa dai test normali (vitest.config include solo src/).
import { it, vi } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { LISTINO_TEST } from "@/lib/listino/listino-test";
import { componiPagina } from "@/lib/sposi/componi";
import { ISTANZA_AZPH } from "../istanze/azph";

vi.mock("server-only", () => ({}));
vi.mock("../src/app/[token]/azioni", () => ({ conferma: async () => ({}), traccia: async () => {} }));
vi.mock("@/lib/supabase/sessione", () => ({ statoAccesso: async () => ({ stato: "admin" }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("404"); } }));
vi.mock("@/lib/sposi/dati", () => ({
  matrimonioDaToken: async () => "m1",
  registraEvento: async () => {},
  caricaPagina: async () => {
    const stato = process.env.MODO === "sposi" ? "wdg_confermato" : "qte_quote";
    const pagina = componiPagina({
      matrimonio: { id: "m1", codice_id: "2027-001", stato, data_inizio: "2027-06-12", data_fine: null, preparativi: null,
        galleria_url: "https://example.com/g", copertina_url: null, link_upyourshoot: "https://example.com/u", pagina_congiunta: false,
        location: { nome: "Villa Prova", comune: "Mantova", provincia: "MN", galleria_url: null, copertina_url: null },
        formula: { codice: "W-REL-1F" }, videomaker: { codice: "MBA", nome: "Mattia Batalocco" } },
      sposi: [{ ordine: 1, nome: "Anna Rossi", telefono: "", email: "", codice_fiscale: "", indirizzo: "", indirizzo_preparativi: "", consenso_promo: true },
              { ordine: 2, nome: "Bruno Verdi", telefono: "", email: "", codice_fiscale: "", indirizzo: "", indirizzo_preparativi: "", consenso_promo: true }],
      preventivo: { id: "p1", versione: 1, opzioni: { proponi_video: true }, prezzi_speciali: { servizio: 110000 }, preselezione: ["box"], scelte: [], inviato_il: "2026-11-10", confermato_il: null },
      listino: [], timeline: [
        { giorno: 1, ora: "14:30:00", fase: "Preparativi di Anna", luogo: "Casa privata - Mantova MN", nota_privata: false, ordine: 1 },
        { giorno: 1, ora: "16:00:00", fase: "Rito civile", luogo: null, nota_privata: false, ordine: 2 },
        { giorno: 1, ora: "17:00:00", fase: "Aperitivo", luogo: "Villa Prova - Mantova MN", nota_privata: false, ordine: 3 }],
      importi: stato === "qte_quote" ? [] : [{ voce: "servizio", importo: 110000 }, { voce: "memory_box", importo: 5000 }],
      pagamenti: [],
      blocchi: ISTANZA_AZPH.blocchi.map((b) => { const { chiave, ordine, quando, ...dati } = b as Record<string, unknown>; return { chiave: chiave as string, ordine: ordine as number, quando: quando as string, dati }; }),
      impostazioni: { marchio: ISTANZA_AZPH.impostazioni.marchio, zone: ISTANZA_AZPH.impostazioni.zone, url_recensioni: null, condizioni_pagamento: null },
      contratto: { id: "c1", testo: ISTANZA_AZPH.contratto },
    });
    return { pagina, calcolo: { listino: LISTINO_TEST, preventivo: { formula: "W-REL-1F", opzioni: { proponi_video: true }, prezziSpeciali: { servizio: 110000 } }, preventivoId: "p1" } };
  },
}));

it("anteprima", async () => {
  const { renderToString } = await import("react-dom/server");
  const { default: Pagina } = await import("../src/app/[token]/page");
  const el = await Pagina({ params: Promise.resolve({ token: "x".repeat(22) }), searchParams: Promise.resolve({ confermato: process.env.CONFERMATO }) });
  const css = readFileSync("src/app/[token]/pagina.css", "utf8");
  const font = (p: string) => readFileSync(p, "utf8").replace(/url\(\.\/files\//g, `url(file://${process.cwd()}/node_modules/${p.split("/")[1]}/${p.split("/")[2]}/files/`);
  const fonts = ["node_modules/@fontsource/jost/300.css", "node_modules/@fontsource/jost/500.css", "node_modules/@fontsource/playfair-display/400.css", "node_modules/@fontsource/allison/400.css"]
    .map((p) => readFileSync(p, "utf8").replace(/url\(\.\/files\//g, `url(file://${process.cwd()}/${p.replace(/[^/]+$/, "")}files/`)).join("\n");
  void font;
  writeFileSync(`/tmp/anteprima/${process.env.MODO ?? "preventivo"}.html`, `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${fonts}\nbody{margin:0}\n${css}</style></head><body>${renderToString(el)}</body></html>`);
});
