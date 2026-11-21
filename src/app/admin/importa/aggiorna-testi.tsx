"use client";

import { useState, useTransition } from "react";
import { aggiornaTesti } from "./azioni";

export function AggiornaTesti() {
  const [esito, setEsito] = useState<string | null>(null);
  const [inCorso, avvia] = useTransition();
  return (
    <div className="mt-10 pt-6 border-t">
      <h2 className="font-serif text-xl mb-2">Testi della pagina Sposi</h2>
      <p className="text-sm mb-3">Ricarica impostazioni e testi della pagina dalla versione dell&apos;app. Il contratto non cambia.</p>
      <button disabled={inCorso} onClick={() => avvia(async () => {
        const r = await aggiornaTesti();
        setEsito(r.ok ? "Testi aggiornati." : "Errore: " + r.errore);
      })} className="px-4 py-2 rounded border border-salvia-scuro text-salvia-scuro disabled:opacity-60">
        {inCorso ? "Aggiornamento…" : "Aggiorna i testi"}
      </button>
      {esito && <p className="text-sm mt-2">{esito}</p>}
    </div>
  );
}
