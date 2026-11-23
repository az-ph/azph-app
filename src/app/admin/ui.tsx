import { ETICHETTA_STATO } from "@/lib/admin/stati";

/** Colore della pillola di stato in base alla fase del flusso. */
export function PillStato({ stato }: { stato: string }) {
  const tono = stato.startsWith("qte") ? "bg-avviso-fondo text-avviso"
    : stato === "wdg_confermato" ? "bg-ok-fondo text-ok"
    : stato.startsWith("wdg") ? "bg-attivo text-testo"
    : "bg-morbido text-tenue";
  return <span className={`f-pill ${tono}`}><span aria-hidden="true">●</span>{ETICHETTA_STATO[stato] ?? stato}</span>;
}

/** Riquadro con un numero in evidenza. */
export function Kpi({ etichetta, valore, nota, tono }: { etichetta: string; valore: React.ReactNode; nota?: React.ReactNode; tono?: "ok" | "avviso" }) {
  return (
    <div className="f-carta px-4 py-3.5 min-w-0">
      <p className="text-xs text-tenue">{etichetta}</p>
      <p className="titolo text-[1.625rem] leading-tight mt-0.5 tabular-nums truncate">{valore}</p>
      {nota && <p className={`text-xs mt-0.5 truncate ${tono === "ok" ? "text-ok" : tono === "avviso" ? "text-avviso" : "text-tenue"}`}>{nota}</p>}
    </div>
  );
}

/** Intestazione di pagina: titolo grande, sottotitolo, azioni a destra. */
export function Testata({ sopra, titolo, sotto, azioni, extra }: { sopra?: React.ReactNode; titolo: React.ReactNode; sotto?: React.ReactNode; azioni?: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <header className="mb-7">
      {sopra && <div className="text-[0.8125rem] text-tenue mb-3">{sopra}</div>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="titolo text-[2rem] sm:text-[2.5rem] font-semibold leading-[1.05]">{titolo}</h1>
            {extra}
          </div>
          {sotto && <p className="mt-2 text-sm text-tenue">{sotto}</p>}
        </div>
        {azioni && <div className="flex flex-wrap gap-2">{azioni}</div>}
      </div>
    </header>
  );
}

/** Giorni da oggi (Europe/Rome) a una data iso. */
export function giorniDa(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const oggi = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
  return Math.round((Date.parse(iso.slice(0, 10)) - Date.parse(oggi)) / 86400000);
}
