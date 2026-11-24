"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import type { Esito } from "./azioni";

/** Modulo con salvataggio e messaggio di esito accanto al pulsante. */
export function Modulo({ azione, etichetta = "Salva", children, className, compatto, barra }: {
  azione: (s: Esito, fd: FormData) => Promise<Esito>; etichetta?: string; children: React.ReactNode; className?: string; compatto?: boolean;
  /** Pulsante anche in alto, in una barra che resta visibile scorrendo la pagina. */
  barra?: boolean;
}) {
  const [esito, invia, inCorso] = useActionState(azione, null);
  // Finché la pagina non è pronta il pulsante è spento: un invio "nativo" metterebbe i dati nell'indirizzo
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  return (
    // onSubmit invece di action: React non riporta i campi ai valori di prima dopo il salvataggio
    <form method="post" className={className} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => invia(fd)); }}>
      {barra && (
        <div className="sticky top-14 sm:top-0 z-20 -mx-1 px-1 py-2 bg-fondo/90 backdrop-blur flex items-center justify-end gap-4">
          <Messaggio esito={esito} />
          <button className="f-btn f-btn-pieno !px-6 !py-2.5 !text-[0.9375rem]" disabled={inCorso || !pronto}>{inCorso ? "Salvataggio…" : etichetta}</button>
        </div>
      )}
      {children}
      <div className={compatto ? "flex items-center gap-2" : "mt-5 flex flex-wrap items-center gap-4"}>
        <button className={`f-btn f-btn-pieno ${compatto ? "!py-1.5 !px-3" : "!px-6 !py-2.5 !text-[0.9375rem]"}`} disabled={inCorso || !pronto}>
          {inCorso ? "Salvataggio…" : etichetta}
        </button>
        <Messaggio esito={esito} />
      </div>
    </form>
  );
}

function Messaggio({ esito }: { esito: Esito }) {
  return (
    <>
      {esito?.ok && <span className="text-ok text-sm font-medium" role="status">Salvato ✓</span>}
      {esito?.errore && <span className="text-errore text-sm" role="alert">{esito.errore}</span>}
    </>
  );
}

export function CopiaLink({ url, className = "f-btn" }: { url: string; className?: string }) {
  return (
    <button type="button" className={className}
      onClick={() => navigator.clipboard.writeText(url).then(() => avvisoBreve("Link copiato"))}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h10" /></svg>
      Copia link
    </button>
  );
}

function avvisoBreve(msg: string) {
  const el = document.createElement("div");
  el.textContent = msg;
  el.setAttribute("role", "status");
  el.style.cssText = "position:fixed;bottom:1.25rem;left:50%;transform:translateX(-50%);background:var(--f-testo);color:var(--f-fondo);font-size:.875rem;padding:.55rem 1rem;border-radius:10px;box-shadow:0 8px 24px rgb(0 0 0/.18);z-index:50";
  document.querySelector(".fede")?.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}
