import { describe, expect, it } from "vitest";
import { elenco, messaggioSuggerito, numeroWhatsapp, preparaMessaggi } from "./messaggi";

const modelli = [
  { chiave: "preventivo", oggetto: "Preventivo - {DATA_ESTESA}", corpo_mail: "Ciao {NOMI},\n[!Guarda]({LINK})\n{OMAGGI}Fine.\n{VIDEO}\nA presto\n{FIRMA}", corpo_whatsapp: "Ciao {NOME} >> {LINK}\n{OMAGGI}{VIDEO}" },
  { chiave: "preventivo_omaggi", oggetto: null, corpo_mail: "Come omaggio ho incluso anche {ELENCO}. ", corpo_whatsapp: null },
  { chiave: "preventivo_video", oggetto: null, corpo_mail: "Video di {VIDEOMAKER}.", corpo_whatsapp: null },
  { chiave: "timeline", oggetto: "Timeline", corpo_mail: "Ciao {NOMI}, **guardate** [!la timeline]({LINK_TIMELINE})\n\nA presto\n{FIRMA}", corpo_whatsapp: null },
];
const valori = { NOMI: "Anna e Luca", DATA_ESTESA: "sabato 18 settembre 2027", LINK: "https://x.it/abc", LINK_TIMELINE: "https://x.it/abc#azp-timeline", VIDEOMAKER: "Mattia", FIRMA: "no", NOME: "no" };

describe("messaggi", () => {
  it("riempie omaggi e video, lascia {FIRMA} e {NOME}", () => {
    const p = preparaMessaggi(modelli, valori, { omaggi: ["Memory box", "Photo sharing esteso"], video: true, firma: "Alessandro" });
    const prev = p.find((x) => x.chiave === "preventivo")!;
    expect(prev.oggetto).toBe("Preventivo - sabato 18 settembre 2027");
    expect(prev.mail).toContain("Come omaggio ho incluso anche Memory box e Photo sharing esteso. Fine.");
    expect(prev.mail).toContain("Video di Mattia.");
    expect(prev.mail).toContain("{FIRMA}");
    expect(prev.whatsapp).toContain("Ciao {NOME} >> https://x.it/abc");
  });
  it("WhatsApp dalla mail: link in chiaro, grassetto WhatsApp, firma breve", () => {
    const t = preparaMessaggi(modelli, valori, { omaggi: [], video: false, firma: "Alessandro" }).find((x) => x.chiave === "timeline")!;
    expect(t.whatsapp).toBe("Ciao Anna e Luca, *guardate* la timeline: https://x.it/abc#azp-timeline\n\nA presto\nAlessandro");
  });
  it("senza modello segnala la mancanza", () => {
    expect(preparaMessaggi(modelli, valori, { omaggi: [], video: false, firma: "" }).find((x) => x.chiave === "sposi")?.manca).toBe(true);
  });
  it("elenco, suggerito, numero", () => {
    expect(elenco(["a", "b", "c"])).toBe("a, b e c");
    expect(messaggioSuggerito({ confermato: false, inviato: true, congiunta: false })).toBe("aggiornato");
    expect(numeroWhatsapp("+39 348 006 1131")).toBe("393480061131");
    expect(numeroWhatsapp("348 0061131")).toBe("393480061131");
    expect(numeroWhatsapp("ciao")).toBeNull();
  });
});
