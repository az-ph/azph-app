/** Backup notturno: quali file tenere nel Drive condiviso. */
export const PREFISSO_BACKUP = "azph-backup-";
const GIORNI = 30;
const PREFISSO = PREFISSO_BACKUP;

/** Da tenere: ultimi 30 giorni + il primo backup di ogni mese. */
export function daEliminare(nomi: string[], oggi: string): string[] {
  const limite = new Date(Date.parse(oggi + "T12:00:00Z") - GIORNI * 86400000).toISOString().slice(0, 10);
  const giorno = (n: string) => n.slice(PREFISSO.length, PREFISSO.length + 10);
  const primiDelMese = new Map<string, string>();
  for (const n of [...nomi].sort()) { const m = giorno(n).slice(0, 7); if (!primiDelMese.has(m)) primiDelMese.set(m, n); }
  const tenuti = new Set(primiDelMese.values());
  return nomi.filter((n) => giorno(n) < limite && !tenuti.has(n));
}

