"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServizio } from "@/lib/supabase/server";
import { caricaPagina, matrimonioDaToken, registraEvento } from "@/lib/sposi/dati";
import { calcolaOfferta, selezione, importiConferma, ErroreSelezione } from "@/lib/listino/motore";
import { mailConferma } from "@/lib/mail/conferma";
import { euro } from "@/lib/formato";

const Sposo = z.object({
  nome: z.string().trim().min(2).max(120),
  telefono: z.string().trim().min(6).max(40),
  email: z.email().max(200),
  codice_fiscale: z.string().trim().transform((s) => s.replace(/\s/g, "").toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{16}$/, "Il codice fiscale deve avere 16 caratteri.")),
  indirizzo: z.string().trim().min(5).max(300),
  // l'indirizzo dei preparativi si inserisce più avanti, nell'area Sposi
  indirizzo_preparativi: z.string().trim().max(300).optional().default(""),
});

const ETICHETTE: Record<string, string> = { nome: "nome e cognome", telefono: "telefono", email: "email", codice_fiscale: "codice fiscale di 16 caratteri", indirizzo: "indirizzo di residenza" };

const Conferma = z.object({
  extra: z.array(z.string().max(64)).max(50),
  qta: z.record(z.string(), z.number().int().min(0).max(10)).default({}),
  video: z.string().max(64).nullable(),
  conVideo: z.boolean().default(true),
  sposi: z.array(Sposo).length(2),
  consensoPromo: z.boolean(),
  note: z.string().max(2000).default(""),
  accetto: z.literal(true),
});

export type EsitoConferma = { ok?: true; errore?: string };

export async function conferma(token: string, input: unknown): Promise<EsitoConferma> {
  const mid = await matrimonioDaToken(token);
  if (!mid) return { errore: "Link non valido." };

  const dati = Conferma.safeParse(input);
  if (!dati.success) {
    const manca = [...new Set(dati.error.issues.map((i) => {
      if (i.path[0] === "accetto") return "la spunta di conferma delle condizioni";
      if (i.path[0] === "sposi" && typeof i.path[1] === "number") return `${ETICHETTE[String(i.path[2])] ?? "dati"} (Sposa/o ${i.path[1] + 1})`;
      return "dati del modulo";
    }))];
    return { errore: `Per confermare manca${manca.length > 1 ? "no" : ""}: ${manca.join(", ")}.` };
  }
  const d = dati.data;

  const { pagina, calcolo } = await caricaPagina(mid);
  if (pagina.modo !== "preventivo" || !calcolo.preventivo || !calcolo.preventivoId) {
    return { errore: "Questo preventivo non è più confermabile. Scrivetemi pure." };
  }
  if (!pagina.contratto) return { errore: "Contratto non disponibile: scrivetemi pure." };

  // Gli importi si ricalcolano qui, mai presi dal browser.
  let sel, offerta;
  try {
    offerta = calcolaOfferta(calcolo.listino, calcolo.preventivo, { conVideo: d.conVideo });
    sel = selezione(offerta.voci, { extra: d.extra, qta: d.qta, video: d.conVideo ? d.video : null });
  } catch (e) {
    return { errore: e instanceof ErroreSelezione ? e.message : "Selezione non valida: ricaricate la pagina." };
  }
  const imp = importiConferma(offerta, sel);
  const scelte = [...sel.foto, ...sel.video].map((x) => x.codice + (x.qta > 1 ? "*" + x.qta : ""));

  const h = await headers();
  const ip = (h.get("x-nf-client-connection-ip") || h.get("x-forwarded-for")?.split(",")[0] || "").trim();
  const nomi = d.sposi.map((s) => s.nome).join(" e ");
  // Impronta di ciò che è stato accettato: testo del contratto + scelte + importi.
  const hash = createHash("sha256")
    .update(pagina.contratto.testo).update("\n").update(JSON.stringify({ scelte, importi: imp.perVoce, video: imp.totaleVideo }))
    .digest("hex");

  const { error } = await supabaseServizio().rpc("registra_conferma", {
    dati: {
      matrimonio_id: mid,
      preventivo_id: calcolo.preventivoId,
      scelte,
      totale: imp.totaleFoto,
      importi: Object.entries(imp.perVoce).map(([voce, importo]) => ({ voce, importo })),
      sposi: d.sposi.map((s, i) => ({ ...s, ordine: i + 1 })),
      consenso_promo: d.consensoPromo,
      note: d.note,
      videomaker: sel.video[0]?.collaboratore ?? null,
      accettazione: {
        contratto_versione_id: pagina.contratto.id,
        ip: /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : "",
        user_agent: (h.get("user-agent") ?? "").slice(0, 300),
        nomi,
        hash,
      },
    },
  });
  if (error) {
    return { errore: error.message.includes("già confermato") ? "La conferma risulta già registrata." : "Non sono riuscito a registrare la conferma. Riprovate tra poco o scrivetemi." };
  }

  // Mail agli Sposi e notifica: se falliscono la conferma resta valida (l'esito arriva nella notifica).
  // Indirizzo del sito da Netlify (URL = dominio principale), non dall'intestazione della richiesta.
  const base = (process.env.URL || `https://${h.get("host") ?? ""}`).replace(/\/$/, "");
  try {
    await mailConferma({
      matrimonioId: mid,
      preventivoId: calcolo.preventivoId,
      codice: pagina.matrimonio.codice,
      nomi: pagina.nomi || nomi,
      dataInizio: pagina.matrimonio.dataInizio,
      location: pagina.matrimonio.location,
      link: `${base}/${token}`,
      congiunta: pagina.matrimonio.paginaCongiunta,
      formula: offerta.formula,
      righeFoto: [
        ["Servizio fotografico", euro(offerta.servizio.prezzo)],
        ...offerta.voci.filter((v) => v.categoria === "omaggio").map((v): [string, string] => [v.voce, "omaggio"]),
        ...sel.foto.map((x): [string, string] => [x.etichetta.replace(/ \(omaggio\)$/, ""), x.totale ? euro(x.totale) : "omaggio"]),
      ],
      totaleFoto: imp.totaleFoto,
      video: sel.video.map((x) => ({ etichetta: x.etichetta, totale: x.totale })),
      totaleVideo: imp.totaleVideo,
      videomakerCodice: sel.video[0]?.collaboratore ?? offerta.voci.find((v) => v.collaboratore)?.collaboratore ?? null,
      sposi: d.sposi,
      consensoPromo: d.consensoPromo,
      note: d.note,
    });
  } catch {
    console.error("Mail di conferma: errore imprevisto");
  }

  revalidatePath(`/${token}`);
  return { ok: true };
}

/** Tracciamento delle selezioni: senza IP, senza cookie. Errori ignorati. */
export async function traccia(token: string, codice: string, attiva: boolean): Promise<void> {
  if (typeof codice !== "string" || codice.length > 64) return;
  const mid = await matrimonioDaToken(token);
  if (!mid) return;
  try { await registraEvento(mid, attiva ? "selezione" : "deselezione", { codice }); } catch { /* non blocca la pagina */ }
}

const Indirizzi = z.object({
  sposi: z.array(z.object({
    indirizzo_preparativi: z.string().trim().max(300),
    // facoltativo: solo se lo reinseriscono (in pagina è mostrato in parte)
    codice_fiscale: z.string().trim().transform((s) => s.replace(/\s/g, "").toUpperCase())
      .pipe(z.string().regex(/^([A-Z0-9]{16})?$/)).optional().default(""),
  })).length(2),
});

/** Area Sposi: gli Sposi inseriscono l'indirizzo dei preparativi e possono reinserire il codice fiscale. */
export async function salvaIndirizzi(token: string, input: unknown): Promise<{ ok?: true; errore?: string }> {
  const mid = await matrimonioDaToken(token);
  if (!mid) return { errore: "Link non valido." };
  const dati = Indirizzi.safeParse(input);
  if (!dati.success) {
    return { errore: dati.error.issues.some((i) => i.path.includes("codice_fiscale"))
      ? "Il codice fiscale deve avere 16 caratteri." : "Controllate gli indirizzi." };
  }

  const { pagina } = await caricaPagina(mid);
  if (pagina.modo !== "sposi") return { errore: "I dati non sono più modificabili da qui: scrivetemi pure." };

  const db = supabaseServizio();
  for (const [i, s] of dati.data.sposi.entries()) {
    const { error } = await db.from("sposo")
      .update({ indirizzo_preparativi: s.indirizzo_preparativi || null, ...(s.codice_fiscale ? { codice_fiscale: s.codice_fiscale } : {}) })
      .eq("matrimonio_id", mid).eq("ordine", i + 1);
    if (error) return { errore: "Salvataggio non riuscito, riprovate tra poco." };
  }
  // i preparativi risultano previsti se c'è almeno un indirizzo (non si tolgono da qui)
  if (dati.data.sposi.some((s) => s.indirizzo_preparativi)) {
    await db.from("matrimonio").update({ preparativi: true }).eq("id", mid);
  }
  revalidatePath(`/${token}`);
  return { ok: true };
}
