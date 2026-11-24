"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { sincronizzaMatrimonio } from "@/lib/admin/sincronizza-calendario";
import { istanteDaRoma } from "@/lib/admin/ora-roma";
import { supabaseSessione } from "@/lib/supabase/sessione";
import { componi, stileDaColori } from "@/lib/mail/testo";
import { inviaMail } from "@/lib/mail/resend";
import { CHIAVI_MESSAGGIO, MESSAGGI, type ChiaveMessaggio } from "@/lib/admin/messaggi";
import type { Esito } from "./azioni";

const Invio = z.object({
  matrimonio_id: z.string().uuid(),
  chiave: z.enum(CHIAVI_MESSAGGIO),
  oggetto: z.string().trim().min(1, "Manca l'oggetto.").max(200),
  corpo: z.string().trim().min(1, "Manca il testo.").max(12000),
  destinatari: z.array(z.string().trim().toLowerCase().email()).min(1, "Scegli almeno un destinatario."),
  idem: z.string().uuid(),
});

/** Dopo l'invio del preventivo: segnato come inviato, e lo stato passa da "Da contattare" a "Preventivo". */
async function segnaPreventivoInviato(mid: string, chiave: ChiaveMessaggio) {
  if (!MESSAGGI.find((m) => m.chiave === chiave)?.segnaInviato) return;
  const supabase = await supabaseSessione();
  const { data: p } = await supabase.from("preventivo").select("id").eq("matrimonio_id", mid).is("confermato_il", null)
    .order("versione", { ascending: false }).limit(1).maybeSingle();
  if (p) await supabase.from("preventivo").update({ inviato_il: new Date().toISOString() }).eq("id", p.id);
  const { data: passato } = await supabase.from("matrimonio").update({ stato: "qte_quote" }).eq("id", mid).in("stato", ["qte_to_contact", "qte_contatto"]).select("id");
  if (passato?.length) {
    const h = await headers();
    await sincronizzaMatrimonio(supabase, mid, process.env.URL || `https://${h.get("host") ?? ""}`);
  }
}

/** Mail agli Sposi dall'indirizzo dell'istanza, risposte al titolare, copia nascosta al titolare. */
export async function inviaMessaggio(_: Esito, fd: FormData): Promise<Esito> {
  const r = Invio.safeParse({
    matrimonio_id: fd.get("matrimonio_id"), chiave: fd.get("chiave"), oggetto: fd.get("oggetto"),
    corpo: fd.get("corpo"), destinatari: fd.getAll("destinatari"), idem: fd.get("idem"),
  });
  if (!r.success) return { errore: r.error.issues[0]?.message ?? "Dati non validi." };
  const d = r.data;
  const supabase = await supabaseSessione();
  const [imp, sposi] = await Promise.all([
    supabase.from("impostazioni").select("marchio, colori, firma").single(),
    supabase.from("sposo").select("email").eq("matrimonio_id", d.matrimonio_id),
  ]);
  // Solo agli indirizzi degli Sposi di questo Matrimonio
  const validi = new Set((sposi.data ?? []).map((s) => s.email?.trim().toLowerCase()).filter(Boolean));
  const a = [...new Set(d.destinatari)].filter((x) => validi.has(x));
  if (!a.length) return { errore: "Nessun indirizzo valido: controlla le email in Sposi e dati." };

  const marchio = (imp.data?.marchio ?? {}) as Record<string, string | undefined>;
  const mittente = marchio.email;
  if (!mittente) return { errore: "Manca l'indirizzo mittente nelle impostazioni." };
  const nome = marchio.titolare || marchio.nome || "";
  const firma = { testo: imp.data?.firma || marchio.firma || nome, html: marchio.firma_mail_html || undefined };
  const corpo = componi(d.corpo, {}, stileDaColori(imp.data?.colori as Record<string, string> | null), firma);

  const esito = await inviaMail({
    da: `${nome} <${mittente}>`, a, rispondiA: mittente, ccn: a.includes(mittente.toLowerCase()) ? undefined : [mittente],
    oggetto: d.oggetto, html: corpo.html, testo: corpo.testo, idempotenza: `messaggio-${d.idem}`,
  });
  await supabase.from("invio").insert({
    matrimonio_id: d.matrimonio_id, modello: d.chiave, canale: "mail",
    stato: esito.ok ? "inviato" : "errore", inviato_il: esito.ok ? new Date().toISOString() : null, errore: esito.ok ? null : esito.errore,
  });
  if (!esito.ok) {
    revalidatePath(`/admin/matrimoni/${d.matrimonio_id}`);
    return { errore: `Mail non inviata (${esito.errore}).` };
  }
  await segnaPreventivoInviato(d.matrimonio_id, d.chiave);
  revalidatePath(`/admin/matrimoni/${d.matrimonio_id}`);
  return { ok: true };
}

/** WhatsApp si apre sul telefono o sul computer: qui resta solo la traccia (e il preventivo segnato come inviato). */
export async function registraWhatsapp(matrimonioId: string, chiave: string): Promise<void> {
  const mid = z.string().uuid().parse(matrimonioId);
  const k = z.enum(CHIAVI_MESSAGGIO).parse(chiave);
  const supabase = await supabaseSessione();
  await supabase.from("invio").insert({ matrimonio_id: mid, modello: k, canale: "whatsapp", stato: "inviato", inviato_il: new Date().toISOString() });
  await segnaPreventivoInviato(mid, k);
  revalidatePath(`/admin/matrimoni/${mid}`);
}

// ---------- Contatti segnati a mano ----------

const Contatto = z.object({
  matrimonio_id: z.string().uuid(),
  tipo: z.enum(["invio", "follow_up"]),
  canale: z.enum(["mail", "whatsapp", "telefono", "persona", "altro"]),
  avvenuto_il: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Scegli data e ora."),
  nota: z.string().trim().max(500).optional().default(""),
  prossimo_il: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).optional().default(""),
});

export async function registraContatto(_: Esito, fd: FormData): Promise<Esito> {
  const r = Contatto.safeParse(Object.fromEntries(fd));
  if (!r.success) return { errore: r.error.issues[0]?.message ?? "Dati non validi." };
  const d = r.data;
  const supabase = await supabaseSessione();
  const { error } = await supabase.from("contatto").insert({
    matrimonio_id: d.matrimonio_id, tipo: d.tipo, canale: d.canale, avvenuto_il: istanteDaRoma(d.avvenuto_il),
    nota: d.nota || null, prossimo_il: d.prossimo_il || null,
  });
  if (error) return { errore: error.message };
  // Un invio segnato a mano porta lo stato da Da contattare a Preventivo, come quello dall'app
  if (d.tipo === "invio") {
    const { data: passato } = await supabase.from("matrimonio").update({ stato: "qte_quote" }).eq("id", d.matrimonio_id).in("stato", ["qte_to_contact", "qte_contatto"]).select("id");
    if (passato?.length) {
      const h = await headers();
      await sincronizzaMatrimonio(supabase, d.matrimonio_id, process.env.URL || `https://${h.get("host") ?? ""}`);
    }
  }
  if (d.tipo === "follow_up") await supabase.from("matrimonio").update({ stato: "qte_contatto" }).eq("id", d.matrimonio_id).eq("stato", "qte_to_contact");
  revalidatePath(`/admin/matrimoni/${d.matrimonio_id}`);
  revalidatePath("/admin");
  return { ok: true };
}

export async function eliminaContatto(fd: FormData): Promise<void> {
  const id = z.string().uuid().parse(fd.get("id"));
  const mid = z.string().uuid().parse(fd.get("matrimonio_id"));
  const supabase = await supabaseSessione();
  await supabase.from("contatto").delete().eq("id", id).eq("matrimonio_id", mid);
  revalidatePath(`/admin/matrimoni/${mid}`);
  revalidatePath("/admin");
}
