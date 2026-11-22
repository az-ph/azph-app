"use client";

import { useState, useTransition } from "react";
import { aggiornaTesti } from "./azioni";

export function AggiornaTesti() {
  const [esito, setEsito] = useState<string | null>(null);
  const [inCorso, avvia] = useTransition();
  return (
    <div className="f-carta p-5 sm:p-6">
      <h2 className="text-[0.9375rem] font-semibold mb-2">Testi della pagina Sposi</h2>
      <p className="text-sm text-tenue mb-4">Ricarica impostazioni e testi della pagina dalla versione dell&apos;app. Il contratto non cambia.</p>
      <button disabled={inCorso} onClick={() => avvia(async () => {
        const r = await aggiornaTesti();
        setEsito(r.ok ? "Testi aggiornati." : "Errore: " + r.errore);
      })} className="f-btn">
        {inCorso ? "Aggiornamento…" : "Aggiorna i testi"}
      </button>
      {esito && <p className="text-sm mt-3">{esito}</p>}
    </div>
  );
}
