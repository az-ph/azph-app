"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const ICONE = {
  matrimoni: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  nuovo: <path d="M12 5v14M5 12h14" />,
  importa: <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />,
  scuro: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  chiaro: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  esci: <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" />,
};

function Icona({ d }: { d: React.ReactNode }) {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
}

const VOCI = [
  { href: "/admin", t: "Matrimoni", i: ICONE.matrimoni, attivo: (p: string) => p === "/admin" || /^\/admin\/matrimoni\/[0-9a-f-]{36}/.test(p) },
  { href: "/admin/matrimoni/nuovo", t: "Nuovo Matrimonio", i: ICONE.nuovo, attivo: (p: string) => p.startsWith("/admin/matrimoni/nuovo") },
  { href: "/admin/importa", t: "Importa e testi", i: ICONE.importa, attivo: (p: string) => p.startsWith("/admin/importa") },
];

/** Barra laterale compatta (in alto su telefono): solo icone, il nome compare al passaggio. */
export function Rail({ iniziale, marchio, temaIniziale, esci }: {
  iniziale: string; marchio: string; temaIniziale: "chiaro" | "scuro"; esci: () => Promise<void>;
}) {
  const p = usePathname();
  const [tema, setTema] = useState(temaIniziale);
  function cambia() {
    const nuovo = tema === "scuro" ? "chiaro" : "scuro";
    setTema(nuovo);
    document.querySelector(".fede")?.setAttribute("data-tema", nuovo);
    // Preferenza tecnica dell'interfaccia: nessun dato personale, solo per l'area admin
    document.cookie = `fede_tema=${nuovo}; path=/admin; max-age=31536000; samesite=lax; secure`;
  }
  return (
    <aside className="f-rail fixed z-30 inset-x-0 top-0 h-14 sm:inset-x-auto sm:left-0 sm:bottom-0 sm:h-auto sm:w-16 flex sm:flex-col items-center gap-2 sm:gap-5 px-3 sm:px-0 sm:py-4 bg-pannello border-b sm:border-b-0 sm:border-r border-bordo">
      <Link href="/admin" data-etichetta={`Fede · ${marchio}`} aria-label="Fede, inizio"
        className="!size-9 !rounded-[10px] !bg-accento !text-su-accento titolo font-semibold text-base">{iniziale}</Link>
      <nav aria-label="Menu" className="flex sm:flex-col gap-1">
        {VOCI.map((v) => (
          <Link key={v.href} href={v.href} data-etichetta={v.t} aria-label={v.t} aria-current={v.attivo(p) ? "page" : undefined}><Icona d={v.i} /></Link>
        ))}
      </nav>
      <div className="ml-auto sm:ml-0 sm:mt-auto flex sm:flex-col gap-1">
        <button type="button" onClick={cambia} data-etichetta={tema === "scuro" ? "Tema chiaro" : "Tema scuro"} aria-label="Cambia tema">
          <Icona d={tema === "scuro" ? ICONE.chiaro : ICONE.scuro} />
        </button>
        <form action={esci}>
          <button data-etichetta="Esci" aria-label="Esci"><Icona d={ICONE.esci} /></button>
        </form>
      </div>
    </aside>
  );
}
