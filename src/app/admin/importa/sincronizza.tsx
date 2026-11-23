"use client";

import { useState } from "react";
import { sincronizzaCalendario } from "../matrimoni/azioni";

/** Crea o aggiorna in calendario gli eventi [WDG]/[QTE] di tutti i Matrimoni, a blocchi. */
export function SincronizzaCalendario() {
  const [stato, setStato] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  async function avvia() {
    setInCorso(true);
    let dopo: string | null = null, totale = 0;
    const avvisi = new Set<string>();
    for (let giro = 0; giro < 40; giro++) {
      const r = await sincronizzaCalendario(dopo);
      if (!r) { setStato("Errore nella richiesta."); break; }
      totale += r.fatti;
      r.avvisi.forEach((a) => avvisi.add(a));
      setStato(`Sincronizzati ${totale}${r.restano ? `, ne restano ${r.restano}…` : "."}`);
      if (!r.restano || !r.fatti) break;
      dopo = r.ultimo;
    }
    if (avvisi.size) setStato((s) => `${s} ${[...avvisi].join(" ")}`);
    setInCorso(false);
  }
  return (
    <div className="f-carta p-5 sm:p-6">
      <h2 className="text-[0.9375rem] font-semibold mb-2">Calendario</h2>
      <p className="text-sm text-tenue mb-4">Crea o aggiorna gli eventi [WDG] e [QTE] di tutti i Matrimoni. Quelli già creati dal foglio vengono ripresi, senza doppioni. Dopo, ogni salvataggio aggiorna l&apos;evento da solo.</p>
      <button className="f-btn" disabled={inCorso} onClick={avvia}>{inCorso ? "Sincronizzazione…" : "Sincronizza il calendario"}</button>
      {stato && <p className="text-sm mt-3" role="status">{stato}</p>}
    </div>
  );
}
