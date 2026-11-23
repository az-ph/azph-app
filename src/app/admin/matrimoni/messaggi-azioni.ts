"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
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
  await supabase.from("matrimonio").update({ stato: "qte_quote" }).eq("id", mid).eq("stato", "qte_to_contact");
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
