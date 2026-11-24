"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { istanteDaRoma } from "@/lib/admin/ora-roma";
import { sincronizzaKickoff } from "@/lib/admin/kickoff";
import { sincronizzaMatrimonio, sincronizzaTutti } from "@/lib/admin/sincronizza-calendario";
import { supabaseSessione } from "@/lib/supabase/sessione";
import { euroInCentesimi, leggiPrezziSpeciali } from "@/lib/listino/motore";
import { leggiTimeline } from "@/lib/admin/timeline";
import { STATI, nuovoToken } from "@/lib/admin/stati";

export type Esito = { ok?: boolean; errore?: string } | null;

const testo = (max: number) => z.string().trim().max(max).optional().default("");
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).optional().default("");
const ora = z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")).optional().default("");
const uuid = z.string().uuid().or(z.literal("")).optional().default("");
const spunta = z.preprocess((v) => v === "on" || v === "true", z.boolean());
const stato = z.enum(STATI.map((s) => s.valore) as [string, ...string[]]);

function campi(fd: FormData) {
  return Object.fromEntries([...fd.keys()].map((k) => [k, fd.get(k)]));
}

// ---------- Nuovo Matrimonio ----------

const Nuovo = z.object({
  data_inizio: data, ora_inizio: ora, location_id: uuid, formula_id: uuid,
  fonte: z.string().trim().max(20).regex(/^[\w .-]*$/).optional().default(""),
  stato, preparativi: spunta, note_private: testo(4000),
  nome1: testo(120), telefono1: testo(40), email1: testo(160),
  nome2: testo(120), telefono2: testo(40), email2: testo(160),
});

export async function creaMatrimonio(_: Esito, fd: FormData): Promise<Esito> {
  const d = Nuovo.safeParse(campi(fd));
  if (!d.success) return { errore: "Controlla i campi: data gg/mm/aaaa, ora hh:mm." };
  const v = d.data;
  if (!v.nome1 && !v.nome2) return { errore: "Serve almeno il nome di uno degli Sposi." };
  const supabase = await supabaseSessione();
  const { data: id, error } = await supabase.rpc("admin_nuovo_matrimonio", {
    dati: {
      ...v, token: nuovoToken(),
      sposi: [
        { ordine: 1, nome: v.nome1, telefono: v.telefono1, email: v.email1 },
        { ordine: 2, nome: v.nome2, telefono: v.telefono2, email: v.email2 },
      ],
    },
  });
  if (error || !id) return { errore: "Non sono riuscito a creare il Matrimonio: " + (error?.message ?? "") };
  await sincronizzaMatrimonio(supabase, id as string, await baseUrl());
  redirect(`/admin/matrimoni/${id}?tab=preventivo`);
}

// ---------- Dati del Matrimonio e degli Sposi ----------

const Dati = z.object({
  id: z.string().uuid(), stato, data_inizio: data, data_fine: data, ora_inizio: ora, ora_fine: ora,
  location_id: uuid, videomaker_id: uuid,
  fonte: z.string().trim().max(20).regex(/^[\w .-]*$/).optional().default(""),
  preparativi: spunta, pagina_congiunta: spunta, esempio: spunta, note_private: testo(4000),
  galleria_url: testo(2000), copertina_url: testo(500),
  kickoff_il: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).or(z.literal("")).optional().default(""),
});
const SposoForm = z.object({
  nome: testo(120), telefono: testo(40), email: testo(160), codice_fiscale: testo(16),
  indirizzo: testo(300), indirizzo_preparativi: testo(300),
});

export async function salvaDati(_: Esito, fd: FormData): Promise<Esito> {
  const d = Dati.safeParse(campi(fd));
  if (!d.success) return { errore: "Controlla date (gg/mm/aaaa) e orari (hh:mm)." };
  const v = d.data;
  const sposi = [1, 2].map((o) => SposoForm.safeParse(Object.fromEntries(
    ["nome", "telefono", "email", "codice_fiscale", "indirizzo", "indirizzo_preparativi"].map((k) => [k, fd.get(`s${o}_${k}`) ?? ""]),
  )));
  if (sposi.some((s) => !s.success)) return { errore: "Controlla i dati degli Sposi (codice fiscale: 16 caratteri)." };

  const supabase = await supabaseSessione();
  const { error } = await supabase.from("matrimonio").update({
    stato: v.stato, data_inizio: v.data_inizio || null, data_fine: v.data_fine || null,
    ora_inizio: v.ora_inizio || null, ora_fine: v.ora_fine || null, location_id: v.location_id || null,
    videomaker_id: v.videomaker_id || null, fonte: v.fonte || null, preparativi: v.preparativi, esempio: v.esempio,
    pagina_congiunta: v.pagina_congiunta, note_private: v.note_private || null,
    galleria_url: v.galleria_url || null, copertina_url: v.copertina_url || null, kickoff_il: v.kickoff_il ? istanteDaRoma(v.kickoff_il) : null,
  }).eq("id", v.id);
  if (error) return { errore: error.message };

  for (const [i, s] of sposi.entries()) {
    const x = s.data!;
    const vuoto = Object.values(x).every((y) => !y);
    if (vuoto) continue;
    const { error: e } = await supabase.from("sposo").upsert({
      matrimonio_id: v.id, ordine: i + 1, nome: x.nome || null, telefono: x.telefono || null, email: x.email || null,
      codice_fiscale: x.codice_fiscale ? x.codice_fiscale.toUpperCase() : null,
      indirizzo: x.indirizzo || null, indirizzo_preparativi: x.indirizzo_preparativi || null,
    }, { onConflict: "matrimonio_id,ordine" });
    if (e) return { errore: e.message };
  }
  revalidatePath(`/admin/matrimoni/${v.id}`);
  const b = await baseUrl();
  const avviso = [await sincronizzaKickoff(v.id, b), await sincronizzaMatrimonio(supabase, v.id, b)].filter(Boolean).join(" ");
  if (avviso) return { ok: true, errore: avviso };
  return { ok: true };
}

// ---------- Preventivo ----------

const Prev = z.object({
  id: z.string().uuid(), matrimonio_id: z.string().uuid(), formula_id: uuid,
  proponi_video: spunta, proponi_prewedding: spunta, proponi_op2_ibrido: spunta,
  prezzi: testo(2000),
});

export async function salvaPreventivo(_: Esito, fd: FormData): Promise<Esito> {
  const d = Prev.safeParse(campi(fd));
  if (!d.success) return { errore: "Dati del preventivo non validi." };
  const v = d.data;
  let prezzi: Record<string, number>;
  try { prezzi = leggiPrezziSpeciali(v.prezzi); } catch { return { errore: "Prezzi speciali: una riga per voce, \"codice = euro\"." }; }
  if (Object.values(prezzi).some((n) => !Number.isFinite(n) || n < 0)) {
    return { errore: "Prezzi speciali: una riga per voce, \"codice = euro\" (es. servizio = 1100)." };
  }
  const preselezione = fd.getAll("preselezione").map(String).filter((c) => /^[\w-]{1,40}$/.test(c));

  const supabase = await supabaseSessione();
  const { data: p } = await supabase.from("preventivo").select("confermato_il").eq("id", v.id).single();
  if (p?.confermato_il) return { errore: "Il preventivo è già confermato: non si modifica più." };

  const r1 = await supabase.from("matrimonio").update({ formula_id: v.formula_id || null }).eq("id", v.matrimonio_id);
  const r2 = await supabase.from("preventivo").update({
    opzioni: { proponi_video: v.proponi_video, proponi_prewedding: v.proponi_prewedding, proponi_op2_ibrido: v.proponi_op2_ibrido },
    prezzi_speciali: prezzi, preselezione,
  }).eq("id", v.id);
  if (r1.error || r2.error) return { errore: (r1.error ?? r2.error)!.message };
  revalidatePath(`/admin/matrimoni/${v.matrimonio_id}`);
  return { ok: true };
}

/** Segna il preventivo come inviato (data di oggi) e porta lo stato a "Preventivo". */
export async function segnaInviato(fd: FormData) {
  const id = z.string().uuid().parse(fd.get("id"));
  const mid = z.string().uuid().parse(fd.get("matrimonio_id"));
  const supabase = await supabaseSessione();
  await supabase.from("preventivo").update({ inviato_il: new Date().toISOString() }).eq("id", id);
  await supabase.from("matrimonio").update({ stato: "qte_quote" }).eq("id", mid).in("stato", ["qte_to_contact", "qte_contatto"]);
  await sincronizzaMatrimonio(supabase, mid, await baseUrl());
  revalidatePath(`/admin/matrimoni/${mid}`);
}

/** Nuovo link Sposi: revoca quello attuale (chi ha il vecchio link non entra più). */
export async function rigeneraLink(fd: FormData) {
  const mid = z.string().uuid().parse(fd.get("matrimonio_id"));
  const supabase = await supabaseSessione();
  await supabase.from("link_sposi").update({ revocato_il: new Date().toISOString() }).eq("matrimonio_id", mid).is("revocato_il", null);
  await supabase.from("link_sposi").insert({ matrimonio_id: mid, token: nuovoToken() });
  revalidatePath(`/admin/matrimoni/${mid}`);
}

// ---------- Timeline ----------

export async function salvaTimeline(_: Esito, fd: FormData): Promise<Esito> {
  const mid = z.string().uuid().safeParse(fd.get("matrimonio_id"));
  const testoT = z.string().max(20000).safeParse(fd.get("timeline") ?? "");
  if (!mid.success || !testoT.success) return { errore: "Dati non validi." };
  const { righe, errori } = leggiTimeline(testoT.data);
  if (errori.length) return { errore: errori.join(" · ") };
  const supabase = await supabaseSessione();
  const { error } = await supabase.rpc("admin_salva_timeline", { mid: mid.data, righe });
  if (error) return { errore: error.message };
  revalidatePath(`/admin/matrimoni/${mid.data}`);
  const avviso = await sincronizzaMatrimonio(supabase, mid.data, await baseUrl());
  return avviso ? { ok: true, errore: avviso } : { ok: true };
}

// ---------- Pagamenti ----------

const TIPI_INCASSO = ["acconto", "saldo", "album", "altro"] as const;
const Incasso = z.object({
  matrimonio_id: z.string().uuid(),
  tipo: z.enum(TIPI_INCASSO),
  importo: z.string().trim().min(1),
  pagato_il: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: testo(300),
});

export async function registraIncasso(_: Esito, fd: FormData): Promise<Esito> {
  const d = Incasso.safeParse(campi(fd));
  if (!d.success) return { errore: "Servono rata, importo e data." };
  const v = d.data;
  // "1.200" è milleduecento (punto delle migliaia), non 1,20
  const grezzo = /^\d{1,3}(\.\d{3})+$/.test(v.importo.replace(/[€\s]/g, "")) ? v.importo.replace(/\./g, "") : v.importo;
  const centesimi = euroInCentesimi(grezzo);
  if (!Number.isFinite(centesimi) || centesimi <= 0) return { errore: "Importo non valido (es. 800 oppure 800,50)." };
  const supabase = await supabaseSessione();
  const { error } = await supabase.from("pagamento").insert({
    matrimonio_id: v.matrimonio_id, tipo: v.tipo, importo: centesimi, pagato_il: v.pagato_il, note: v.note || null,
  });
  if (error) return { errore: error.message };
  revalidatePath(`/admin/matrimoni/${v.matrimonio_id}`);
  return { ok: true };
}

export async function eliminaIncasso(fd: FormData) {
  const id = z.string().uuid().parse(fd.get("id"));
  const mid = z.string().uuid().parse(fd.get("matrimonio_id"));
  const supabase = await supabaseSessione();
  await supabase.from("pagamento").delete().eq("id", id).eq("matrimonio_id", mid);
  revalidatePath(`/admin/matrimoni/${mid}`);
}

// ---------- Data libera ----------

export async function verificaData(iso: string, escludi?: string) {
  const d = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(iso);
  const e = z.string().uuid().optional().safeParse(escludi || undefined);
  if (!d.success || !e.success) return null;
  const { controllaData } = await import("@/lib/admin/data-libera");
  return controllaData(d.data, e.data);
}

// ---------- Kick-off ----------

export async function salvaKickoff(_: Esito, fd: FormData): Promise<Esito> {
  const mid = z.string().uuid().safeParse(fd.get("matrimonio_id"));
  const d = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).safeParse(fd.get("kickoff_il"));
  if (!mid.success || !d.success) return { errore: "Scegli data e ora." };
  const supabase = await supabaseSessione();
  const { error } = await supabase.from("matrimonio").update({ kickoff_il: istanteDaRoma(d.data) }).eq("id", mid.data);
  if (error) return { errore: error.message };
  const avviso = await sincronizzaKickoff(mid.data, await baseUrl());
  revalidatePath("/admin");
  revalidatePath(`/admin/matrimoni/${mid.data}`);
  return avviso ? { ok: true, errore: avviso } : { ok: true };
}

async function baseUrl(): Promise<string> {
  const h = await headers();
  return process.env.URL || `https://${h.get("host") ?? ""}`;
}

// ---------- Calendario: tutti i Matrimoni ----------

export async function sincronizzaCalendario(dopo: string | null) {
  const d = z.string().uuid().nullable().safeParse(dopo);
  if (!d.success) return null;
  return sincronizzaTutti(await supabaseSessione(), await baseUrl(), d.data);
}

// ---------- Voci e importi (album aggiunto dopo, prezzi cambiati) ----------

const VOCI_IMPORTO = ["servizio", "prewedding", "photo_booth", "secondo_operatore", "memory_box", "album", "album_genitori", "extra"] as const;

function centesimiDa(testo: string): number | null {
  const t = testo.replace(/[€\s]/g, "");
  const grezzo = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t) ? t.replace(/\./g, "") : t;
  const n = Number(grezzo.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export async function salvaImporto(_: Esito, fd: FormData): Promise<Esito> {
  const mid = z.string().uuid().safeParse(fd.get("matrimonio_id"));
  const voce = z.enum(VOCI_IMPORTO).safeParse(fd.get("voce"));
  const importo = centesimiDa(String(fd.get("importo") ?? ""));
  if (!mid.success || !voce.success || importo == null) return { errore: "Servono voce e importo." };
  const supabase = await supabaseSessione();
  const { error } = importo === 0 && fd.get("togli") === "1"
    ? await supabase.from("importo").delete().eq("matrimonio_id", mid.data).eq("voce", voce.data)
    : await supabase.from("importo").upsert({ matrimonio_id: mid.data, voce: voce.data, importo }, { onConflict: "matrimonio_id,voce" });
  if (error) return { errore: error.message };
  revalidatePath(`/admin/matrimoni/${mid.data}`);
  revalidatePath("/admin");
  return { ok: true };
}
