"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseSessione } from "@/lib/supabase/sessione";
import { supabaseServizio } from "@/lib/supabase/server";
import { BUCKET_ALBUM } from "@/lib/sposi/dati";
import { TIPI_ANTEPRIMA, percorsoAnteprima } from "@/lib/sposi/album";
import type { Esito } from "./azioni";

const uuid = z.string().uuid();

/** Lo spazio delle anteprime è solo del server: prima si verifica che chi chiama veda il Matrimonio (policy admin). */
async function soloAdmin(mid: string): Promise<boolean> {
  if (!uuid.safeParse(mid).success) return false;
  const { data } = await (await supabaseSessione()).from("matrimonio").select("id").eq("id", mid).maybeSingle();
  return !!data;
}

/** Link firmato per caricare l'anteprima direttamente dal browser (i file sono troppo grandi per passare dal server). */
export async function preparaCaricamento(mid: string, tipo: string): Promise<{ percorso?: string; url?: string; errore?: string }> {
  if (!(await soloAdmin(mid))) return { errore: "Non autorizzato." };
  const est = TIPI_ANTEPRIMA[tipo];
  if (!est) return { errore: "Formato non accettato: PDF, JPG, PNG o WebP." };
  const percorso = percorsoAnteprima(mid, est);
  const { data, error } = await supabaseServizio().storage.from(BUCKET_ALBUM).createSignedUploadUrl(percorso);
  if (error || !data) return { errore: "Spazio delle anteprime non disponibile (migrazione applicata?)." };
  return { percorso, url: data.signedUrl };
}

/** Dopo il caricamento: l'anteprima diventa quella attuale e, da "Album da fare", lo stato passa ad "Album". */
export async function registraAnteprima(mid: string, percorso: string, nome: string): Promise<{ ok?: true; errore?: string }> {
  if (!(await soloAdmin(mid))) return { errore: "Non autorizzato." };
  if (!percorso.startsWith(`${mid}/`) || !/^[0-9a-f-]{36}\/\d{8}T\d{6}\.(pdf|jpg|png|webp)$/.test(percorso)) return { errore: "Percorso non valido." };
  const db = supabaseServizio();
  const cartella = await db.storage.from(BUCKET_ALBUM).list(mid, { search: percorso.split("/")[1] });
  if (!cartella.data?.length) return { errore: "Il file non risulta caricato: riprova." };
  const { error } = await db.from("album").upsert({
    matrimonio_id: mid, anteprima_path: percorso, anteprima_nome: nome.slice(0, 200), anteprima_il: new Date().toISOString(),
  }, { onConflict: "matrimonio_id" });
  if (error) return { errore: "Salvataggio non riuscito." };
  await db.from("matrimonio").update({ stato: "wdg_album" }).eq("id", mid).eq("stato", "wdg_album_todo");
  revalidatePath(`/admin/matrimoni/${mid}`);
  return { ok: true };
}

const Dati = z.object({
  matrimonio_id: uuid,
  tipo: z.enum(["", "standard", "premium"]),
  copertina: z.string().trim().regex(/^[a-z0-9_-]{0,40}$/).default(""),
  copertina_nota: z.string().trim().max(500).default(""),
});

/** Dati dell'album dalla scheda: tipo (se diverso da quello del preventivo) e copertina, anche per conto degli Sposi. */
export async function salvaAlbum(_: Esito, fd: FormData): Promise<Esito> {
  const d = Dati.safeParse(Object.fromEntries(fd));
  if (!d.success) return { errore: "Controlla i campi." };
  const supabase = await supabaseSessione();
  const { error } = await supabase.from("album").upsert({
    matrimonio_id: d.data.matrimonio_id, tipo: d.data.tipo || null,
    copertina: d.data.copertina || null, copertina_nota: d.data.copertina_nota || null,
  }, { onConflict: "matrimonio_id" });
  if (error) return { errore: "Salvataggio non riuscito." };
  revalidatePath(`/admin/matrimoni/${d.data.matrimonio_id}`);
  return { ok: true };
}
