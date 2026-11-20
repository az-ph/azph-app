"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseSessione } from "@/lib/supabase/sessione";

const Codice = z.object({
  fattoreId: z.uuid(),
  codice: z.string().regex(/^\d{6}$/),
});

export type EsitoCodice = { errore?: string };

export async function verificaCodice(_prec: EsitoCodice, form: FormData): Promise<EsitoCodice> {
  const dati = Codice.safeParse({ fattoreId: form.get("fattoreId"), codice: String(form.get("codice") ?? "").trim() });
  if (!dati.success) return { errore: "Il codice è di 6 cifre." };

  const supabase = await supabaseSessione();
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: dati.data.fattoreId,
    code: dati.data.codice,
  });
  if (error) return { errore: "Codice non valido o scaduto. Riprova." };
  redirect("/admin");
}
