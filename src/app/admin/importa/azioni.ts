"use server";

import { leggiWorkbook, type Resoconto } from "@/lib/importa/foglio";
import { statoAccesso, supabaseSessione } from "@/lib/supabase/sessione";

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
  return { resoconto: letto.resoconto, importato: data as Record<string, number> };
}
