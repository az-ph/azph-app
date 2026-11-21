"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServizio } from "@/lib/supabase/server";
import { caricaPagina, matrimonioDaToken, registraEvento } from "@/lib/sposi/dati";
import { calcolaOfferta, selezione, importiConferma, ErroreSelezione } from "@/lib/listino/motore";

const Sposo = z.object({
  nome: z.string().trim().min(2).max(120),
  telefono: z.string().trim().min(6).max(40),
  email: z.email().max(200),
  codice_fiscale: z.string().trim().transform((s) => s.replace(/\s/g, "").toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{16}$/, "Il codice fiscale deve avere 16 caratteri.")),
  indirizzo: z.string().trim().min(5).max(300),
  indirizzo_preparativi: z.string().trim().max(300).optional().default(""),
});

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
    const msg = dati.error.issues[0];
    if (msg?.path[0] === "accetto") return { errore: "Spuntate la casella di conferma per procedere." };
    if (msg?.path.includes("codice_fiscale")) return { errore: "Controllate il codice fiscale: deve avere 16 caratteri." };
    return { errore: "Compilate tutti i dati di entrambi gli Sposi." };
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
