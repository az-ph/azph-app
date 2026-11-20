"use client";

import { useActionState } from "react";
import { verificaCodice, type EsitoCodice } from "./azioni";

export function FormCodice({ fattoreId }: { fattoreId: string }) {
  const [esito, azione, inCorso] = useActionState<EsitoCodice, FormData>(verificaCodice, {});
  return (
    <form action={azione} className="space-y-4">
      <input type="hidden" name="fattoreId" value={fattoreId} />
      <input name="codice" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required
        placeholder="123456" aria-label="Codice a 6 cifre"
        className="w-full border border-neutral-300 rounded px-3 py-2 text-center text-xl tracking-widest" />
      {esito.errore && <p className="text-sm text-red-700">{esito.errore}</p>}
      <button disabled={inCorso} className="w-full bg-salvia-scuro text-white rounded py-2 disabled:opacity-60">
        {inCorso ? "Verifica…" : "Conferma"}
      </button>
    </form>
  );
}
