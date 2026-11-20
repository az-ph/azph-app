import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client con service role: SOLO lato server (pagina Sposi, job, intake).
 * Bypassa RLS, quindi ogni query deve selezionare campi espliciti.
 */
export function supabaseServizio() {
  const url = process.env.SUPABASE_URL;
  const chiave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chiave) throw new Error("Variabili SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY mancanti");
  return createClient(url, chiave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
