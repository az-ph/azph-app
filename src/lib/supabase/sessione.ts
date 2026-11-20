import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chiave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chiave) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY mancanti");
  return { url, chiave };
}

/** Client legato alla sessione dell'utente (rispetta RLS). Per Server Components e Server Actions. */
export async function supabaseSessione() {
  const { url, chiave } = env();
  const archivio = await cookies();
  return createServerClient(url, chiave, {
    cookies: {
      getAll: () => archivio.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => archivio.set(name, value, options));
        } catch {
          // In un Server Component i cookie non si scrivono: ci pensa il middleware.
        }
      },
    },
  });
}

export type StatoAccesso =
  | { stato: "anonimo" }
  | { stato: "non_admin" }
  | { stato: "serve_attivazione_2fa" }
  | { stato: "serve_codice_2fa"; fattoreId: string }
  | { stato: "admin" };

/** Dove si trova l'utente nel percorso di accesso. */
export async function statoAccesso(): Promise<StatoAccesso> {
  const supabase = await supabaseSessione();
  const { data: utente } = await supabase.auth.getUser();
  if (!utente.user) return { stato: "anonimo" };
  if (utente.user.app_metadata?.ruolo !== "admin") return { stato: "non_admin" };

  const { data: livello } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (livello?.currentLevel === "aal2") return { stato: "admin" };

  const { data: fattori } = await supabase.auth.mfa.listFactors();
  const totp = fattori?.totp?.find((f) => f.status === "verified");
  if (!totp) return { stato: "serve_attivazione_2fa" };
  return { stato: "serve_codice_2fa", fattoreId: totp.id };
}
