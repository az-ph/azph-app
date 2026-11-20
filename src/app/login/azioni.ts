"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseSessione } from "@/lib/supabase/sessione";

const Credenziali = z.object({
  email: z.email(),
  password: z.string().min(8).max(200),
});

export type EsitoForm = { errore?: string };

export async function entra(_prec: EsitoForm, form: FormData): Promise<EsitoForm> {
  const dati = Credenziali.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!dati.success) return { errore: "Mail o password non valide." };

  const supabase = await supabaseSessione();
  const { error } = await supabase.auth.signInWithPassword(dati.data);
  // Messaggio volutamente generico: non diciamo se la mail esiste.
  if (error) return { errore: "Accesso non riuscito. Controlla mail e password." };
  redirect("/accesso");
}

export async function esci() {
  const supabase = await supabaseSessione();
  await supabase.auth.signOut();
  redirect("/login");
}
