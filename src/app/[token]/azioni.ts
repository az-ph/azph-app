"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServizio } from "@/lib/supabase/server";
import { caricaPagina, matrimonioDaToken, registraEvento } from "@/lib/sposi/dati";
import { calcolaOfferta, selezione, importiConferma, righeRiepilogo, ErroreSelezione } from "@/lib/listino/motore";
import { mailConferma } from "@/lib/mail/conferma";
import { sincronizzaMatrimonio } from "@/lib/admin/sincronizza-calendario";
import { nomiSposi } from "@/lib/sposi/componi";
import { euro } from "@/lib/formato";
import { notificaTitolare } from "@/lib/mail/notifica";

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
  const righe = righeRiepilogo(offerta, sel);
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
      righe,
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
      // i nomi appena inseriti nel modulo, non quelli salvati prima della conferma
      nomi: nomiSposi(d.sposi) || pagina.nomi,
      dataInizio: pagina.matrimonio.dataInizio,
      location: pagina.matrimonio.location,
      link: `${base}/${token}`,
      congiunta: pagina.matrimonio.paginaCongiunta,
      formula: offerta.formula,
      righeFoto: righe.map((r): [string, string] => [r.voce, r.importo ? euro(r.importo) : "omaggio"]),
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

  // Evento [WDG] nel calendario del titolare (se collegato): non blocca mai la conferma
  try {
    await sincronizzaMatrimonio(supabaseServizio(), mid, base);
  } catch {
    console.error("Calendario dopo la conferma: errore imprevisto");
  }

  // niente revalidatePath: il browser ricarica la pagina da capo (?confermato=1)
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

// ---------- Album ----------

const Selezione = z.object({
  fatta: z.literal(true),
  copertina: z.string().regex(/^[a-z0-9_-]{1,40}$/),
  copertinaNota: z.string().trim().max(500).default(""),
  note: z.string().trim().max(2000).default(""),
});

/** Scheda del Matrimonio nell'area admin, per le notifiche al titolare. */
async function linkScheda(mid: string, tab: string) {
  const h = await headers();
  const base = (process.env.URL || `https://${h.get("host") ?? ""}`).replace(/\/$/, "");
  return `${base}/admin/matrimoni/${mid}?tab=${tab}`;
}

/** Gli Sposi segnalano la selezione fatta su UpYourShoot e scelgono la copertina. */
export async function albumSelezione(token: string, input: unknown): Promise<{ ok?: true; errore?: string }> {
  const mid = await matrimonioDaToken(token);
  if (!mid) return { errore: "Link non valido." };
  const d = Selezione.safeParse(input);
  if (!d.success) {
    return { errore: d.error.issues.some((i) => i.path[0] === "fatta") ? "Spuntate la casella della selezione fatta." : "Scegliete la copertina." };
  }
  const { pagina } = await caricaPagina(mid);
  const a = pagina.album;
  if (!a || !a.modificabile) return { errore: "La scelta non è più modificabile da qui: scrivetemi pure." };
  const cop = a.copertine.find((c) => c.valore === d.data.copertina);
  if (!cop) return { errore: "Scegliete una delle copertine proposte." };
  if (cop.nota && !d.data.copertinaNota) return { errore: `Per questa copertina serve un'indicazione: ${cop.nota.toLowerCase()}.` };

  const db = supabaseServizio();
  const { error } = await db.from("album").upsert({
    matrimonio_id: mid, tipo: a.tipo, selezione_il: new Date().toISOString(),
    copertina: cop.valore, copertina_nota: d.data.copertinaNota || null, note_sposi: d.data.note || null,
  }, { onConflict: "matrimonio_id" });
  if (error) return { errore: "Salvataggio non riuscito, riprovate tra poco." };

  try {
    await notificaTitolare({
      oggetto: `📖 Selezione album ${pagina.nomi} – ${pagina.matrimonio.codice}`,
      titolo: `${pagina.nomi} hanno fatto la selezione per l'album${a.selezioneIl ? " (scelta aggiornata)" : ""}`,
      righe: [["Album", a.tipo === "standard" ? "Standard" : "Premium"], ["Copertina", cop.etichetta], ["Indicazione", d.data.copertinaNota]],
      testo: d.data.note ? `Note: ${d.data.note}` : undefined,
      link: await linkScheda(mid, "album"),
    });
  } catch { console.error("Notifica selezione album: errore imprevisto"); }
  revalidatePath(`/${token}`);
  return { ok: true };
}

const Risposta = z.object({
  approva: z.boolean(),
  note: z.string().trim().max(3000).default(""),
  /** Versione dell'anteprima vista dagli Sposi: se nel frattempo ne è arrivata un'altra, si ricarica. */
  versione: z.string().max(40),
});

/** Gli Sposi approvano l'anteprima (stato → Saldo) o chiedono modifiche. */
export async function albumRisposta(token: string, input: unknown): Promise<{ ok?: true; errore?: string }> {
  const mid = await matrimonioDaToken(token);
  if (!mid) return { errore: "Link non valido." };
  const d = Risposta.safeParse(input);
  if (!d.success) return { errore: "Richiesta non valida: ricaricate la pagina." };
  if (!d.data.approva && !d.data.note) return { errore: "Scrivete cosa vorreste cambiare." };

  const { pagina } = await caricaPagina(mid);
  const a = pagina.album;
  if (!a || a.fase !== "anteprima" || !a.anteprimaIl) return { errore: "L'anteprima non è più in attesa di risposta: ricaricate la pagina." };
  if (a.anteprimaIl !== d.data.versione) return { errore: "Nel frattempo ho caricato una nuova versione: ricaricate la pagina." };

  const db = supabaseServizio();
  const adesso = new Date().toISOString();
  const { data: prima } = await db.from("album").select("note_modifiche").eq("matrimonio_id", mid).single();
  const quando = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date()).replace(/\//g, ".");
  const storico = d.data.note ? [`${quando} – ${d.data.approva ? "con l'ok" : "modifiche"}: ${d.data.note}`, prima?.note_modifiche].filter(Boolean).join("\n") : prima?.note_modifiche ?? null;
  const { error } = await db.from("album").update(d.data.approva
    ? { approvato_il: adesso, note_modifiche: storico }
    : { modifiche_il: adesso, note_modifiche: storico }).eq("matrimonio_id", mid).eq("anteprima_il", a.anteprimaIl);
  if (error) return { errore: "Salvataggio non riuscito, riprovate tra poco." };

  let esito = "";
  if (d.data.approva) {
    // Dopo l'ok si torna al saldo, come prima: solo se il Matrimonio è ancora nello stato dell'anteprima.
    const { data: agg } = await db.from("matrimonio").update({ stato: "wdg_invoice" }).eq("id", mid).eq("stato", "wdg_album").select("id");
    esito = agg?.length ? "Stato passato a Saldo." : "⚠️ Stato non cambiato: controllalo nella scheda.";
  }
  try {
    await notificaTitolare({
      oggetto: `${d.data.approva ? "✅ Album approvato" : "✏️ Modifiche album"} – ${pagina.nomi}`,
      titolo: `${pagina.nomi} ${d.data.approva ? "hanno approvato l'impaginazione" : "chiedono modifiche all'impaginazione"}`,
      righe: [["Matrimonio", pagina.matrimonio.codice], ["Anteprima del", a.anteprimaIl.slice(0, 10).split("-").reverse().join(".")], ["Esito", esito]],
      testo: d.data.note || undefined,
      link: await linkScheda(mid, "album"),
    });
  } catch { console.error("Notifica risposta album: errore imprevisto"); }
  revalidatePath(`/${token}`);
  return { ok: true };
}
