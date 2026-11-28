"use server";

import { leggiWorkbook, type Resoconto } from "@/lib/importa/foglio";
import { statoAccesso, supabaseSessione } from "@/lib/supabase/sessione";
import { ISTANZA_AZPH } from "../../../../istanze/azph";

export type EsitoImport = {
  errore?: string;
  resoconto?: Resoconto;
  importato?: Record<string, number>;
  prova?: boolean;
};

const MAX_BYTE = 5.5 * 1024 * 1024;

export async function importa(_prec: EsitoImport, form: FormData): Promise<EsitoImport> {
  const accesso = await statoAccesso();
  if (accesso.stato !== "admin") return { errore: "Accesso non valido." };

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { errore: "Scegli il file .xlsx del foglio Matrimoni." };
  if (file.size > MAX_BYTE) return { errore: "Il file supera 5,5 MB." };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { errore: "Serve il file in formato .xlsx." };

  let letto;
  try {
    letto = leggiWorkbook(new Uint8Array(await file.arrayBuffer()));
  } catch (e) {
    return { errore: "Il file non si legge: " + (e instanceof Error ? e.message : "formato non riconosciuto") };
  }

  if (form.get("azione") !== "importa") return { resoconto: letto.resoconto, prova: true };

  const supabase = await supabaseSessione();
  const { data, error } = await supabase.rpc("importa_foglio", { dati: letto.dati });
  if (error) return { errore: "Importazione annullata, nessun dato scritto: " + error.message, resoconto: letto.resoconto };
  // Consegna delle foto e proposta dell'album (colonne degli automatismi del foglio)
  for (const m of letto.dati.matrimoni) {
    if (!m.foto_consegnate_il && !m.album_proposto_il) continue;
    // solo i valori presenti nel foglio: non si cancella ciò che l'app ha già segnato
    const agg = Object.fromEntries((["foto_consegnate_il", "album_proposto_il"] as const).filter((k) => m[k]).map((k) => [k, m[k]]));
    await supabase.from("matrimonio").update(agg)
      .eq("codice_id", m.codice_id as string);
  }
  // Impostazioni, testi della pagina e contratto di AZ-ph (solo se mancano).
  const ist = await supabase.rpc("importa_istanza", { dati: ISTANZA_AZPH });
  if (ist.error) return { errore: "Dati importati, ma impostazioni e testi no: " + ist.error.message, resoconto: letto.resoconto };
  return { resoconto: letto.resoconto, importato: data as Record<string, number> };
}

/** Ricarica impostazioni e testi della pagina Sposi da istanze/azph (il contratto non si tocca). */
export async function aggiornaTesti(): Promise<{ ok?: true; errore?: string }> {
  const accesso = await statoAccesso();
  if (accesso.stato !== "admin") return { errore: "Accesso non valido." };
  const supabase = await supabaseSessione();
  const { error } = await supabase.rpc("importa_istanza", { dati: ISTANZA_AZPH });
  return error ? { errore: error.message } : { ok: true };
}
