"use client";

import { useActionState } from "react";
import { importa, type EsitoImport } from "./azioni";

export function FormImporta() {
  const [esito, azione, inCorso] = useActionState<EsitoImport, FormData>(importa, {});
  return (
    <div className="f-carta p-5 sm:p-6 space-y-6">
      <form action={azione} className="space-y-4">
        <input name="file" type="file" accept=".xlsx" required className="block text-sm file:mr-3 file:rounded-[10px] file:border file:border-bordo file:bg-carta file:text-testo file:px-3 file:py-1.5" />
        <div className="flex gap-3">
          <button name="azione" value="prova" disabled={inCorso}
            className="f-btn">
            {inCorso ? "Lettura…" : "Prova (non scrive niente)"}
          </button>
          <button name="azione" value="importa" disabled={inCorso || !esito.prova}
            title={esito.prova ? "" : "Prima fai la prova con lo stesso file"}
            className="f-btn f-btn-pieno">
            Importa
          </button>
        </div>
        <p className="text-xs text-tenue">Per importare, ricarica lo stesso file dopo la prova.</p>
      </form>

      {esito.errore && <p className="text-errore">{esito.errore}</p>}

      {esito.importato && (
        <div className="p-4 rounded-[12px] bg-ok-fondo">
          <p className="font-medium mb-2">Importazione completata.</p>
          <Tabella valori={esito.importato} />
        </div>
      )}

      {esito.resoconto && (
        <div className="space-y-4">
          <h2 className="text-[0.9375rem] font-semibold">{esito.prova ? "Prova: cosa verrebbe importato" : "Letto dal file"}</h2>
          <Tabella valori={esito.resoconto.conteggi} />
          <h3 className="font-medium">Avvisi ({esito.resoconto.avvisi.length})</h3>
          {esito.resoconto.avvisi.length === 0 ? <p className="text-sm">Nessuno.</p> : (
            <ul className="text-sm list-disc pl-5 space-y-1">
              {esito.resoconto.avvisi.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Tabella({ valori }: { valori: Record<string, number> }) {
  return (
    <table className="text-sm">
      <tbody>
        {Object.entries(valori).map(([k, v]) => (
          <tr key={k}><td className="pr-6 py-0.5">{k}</td><td className="text-right tabular-nums">{v}</td></tr>
        ))}
      </tbody>
    </table>
  );
}
