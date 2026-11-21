import { NextResponse } from "next/server";
import { supabaseServizio } from "@/lib/supabase/server";

/**
 * Vecchi link del sistema su WordPress (codice di 4 caratteri): reindirizzano al nuovo link Sposi
 * finché il codice non scade (90 giorni dopo la chiusura del Matrimonio).
 */
export async function GET(req: Request, { params }: { params: Promise<{ codice: string }> }) {
  const { codice } = await params;
  const base = new URL(req.url);
  const nonTrovato = () => new NextResponse("Pagina non disponibile", { status: 404, headers: { "Referrer-Policy": "no-referrer" } });
  if (!/^[0-9a-z]{4,8}$/i.test(codice)) return nonTrovato();

  const db = supabaseServizio();
  const oggi = new Date().toISOString().slice(0, 10);
  const { data: legacy } = await db.from("codice_legacy").select("matrimonio_id, scade_il").eq("codice4", codice.toLowerCase()).maybeSingle();
  if (!legacy || (legacy.scade_il && legacy.scade_il < oggi)) return nonTrovato();

  const { data: link } = await db.from("link_sposi").select("token").eq("matrimonio_id", legacy.matrimonio_id)
    .is("revocato_il", null).order("creato_il", { ascending: false }).limit(1).maybeSingle();
  if (!link) return nonTrovato();
  return NextResponse.redirect(new URL(`/${link.token}`, base), 302);
}
