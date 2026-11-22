"use client";

import { useActionState } from "react";
import type { Esito } from "./azioni";

/** Modulo con salvataggio e messaggio di esito sotto il pulsante. */
export function Modulo({ azione, etichetta = "Salva", children, className }: {
  azione: (s: Esito, fd: FormData) => Promise<Esito>; etichetta?: string; children: React.ReactNode; className?: string;
}) {
  const [esito, invia, inCorso] = useActionState(azione, null);
  return (
    <form action={invia} className={className}>
      {children}
      <div className="mt-5 flex items-center gap-4">
        <button className="bg-salvia-scuro text-white px-5 py-2 rounded disabled:opacity-60" disabled={inCorso}>
          {inCorso ? "Salvataggio…" : etichetta}
        </button>
        {esito?.ok && <span className="text-salvia-scuro text-sm" role="status">Salvato ✓</span>}
        {esito?.errore && <span className="text-red-700 text-sm" role="alert">{esito.errore}</span>}
      </div>
    </form>
  );
}

export function CopiaLink({ url }: { url: string }) {
  return (
    <button type="button" className="text-sm underline text-salvia-scuro"
      onClick={() => navigator.clipboard.writeText(url).then(() => alertBreve("Link copiato"))}>Copia link Sposi</button>
  );
}

function alertBreve(msg: string) {
  const el = document.createElement("div");
  el.textContent = msg;
  el.className = "fixed bottom-4 left-1/2 -translate-x-1/2 bg-antracite text-white text-sm px-4 py-2 rounded shadow";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}
