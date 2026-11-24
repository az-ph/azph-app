"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { data, dataEstesa } from "@/lib/formato";
import { FILTRI_STATO, filtra, raggruppa, type FiltroStato, type VoceElenco } from "@/lib/admin/ricerca";
import { PillStato } from "../ui";

/** Elenco con ricerca (nomi, data, location, fonte, stato) e filtro per stato; q e filtro restano nell'indirizzo. */
export function ElencoMatrimoni({ elenco, oggi }: { elenco: VoceElenco[]; oggi: string }) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<FiltroStato>("tutti");
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const u = new URLSearchParams(location.search);
    setQ(u.get("q") ?? "");
    const f = u.get("stato");
    if (f && FILTRI_STATO.some((x) => x.k === f)) setFiltro(f as FiltroStato);
    const tasto = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") { e.preventDefault(); campo.current?.focus(); }
    };
    addEventListener("keydown", tasto);
    return () => removeEventListener("keydown", tasto);
  }, []);
  useEffect(() => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (filtro !== "tutti") u.set("stato", filtro);
    history.replaceState(null, "", u.size ? `?${u}` : location.pathname);
  }, [q, filtro]);

  const gruppi = useMemo(() => raggruppa(filtra(elenco, q, filtro), oggi), [elenco, q, filtro, oggi]);
  const trovati = gruppi.reduce((t, g) => t + g.voci.length, 0);

  return (
    <>
      <div className="flex flex-col gap-3 mb-6">
        <div className="relative max-w-xl">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-tenue" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input ref={campo} type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca tra i Matrimoni"
            placeholder="Cerca per nomi, data (12.12, settembre 2027), location, fonte…  ( / )" className="f-inp !pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtra per stato">
          {FILTRI_STATO.map((f) => (
            <button key={f.k} type="button" aria-pressed={filtro === f.k} onClick={() => setFiltro(f.k)}
              className={`f-pill !px-3 !py-1.5 !font-medium border ${filtro === f.k ? "bg-testo text-fondo border-transparent" : "border-bordo text-tenue hover:text-testo"}`}>
              {f.t}
            </button>
          ))}
        </div>
        {(q || filtro !== "tutti") && (
          <p className="text-sm text-tenue">{trovati ? `${trovati} ${trovati === 1 ? "Matrimonio" : "Matrimoni"}` : "Nessun Matrimonio trovato"}
            {" · "}<button type="button" className="f-link" onClick={() => { setQ(""); setFiltro("tutti"); }}>azzera</button></p>
        )}
      </div>

      {gruppi.map((g) => (
        <section key={g.titolo} className="mb-8">
          <h2 className="text-sm font-semibold mb-3">{g.titolo} <span className="text-tenue font-normal">· {g.voci.length}</span></h2>
          <div className="f-carta overflow-x-auto">
            <table className="f-tabella">
              <thead><tr><th>Sposi</th><th>Data</th><th className="hidden lg:table-cell">Location</th><th className="hidden md:table-cell">Codice</th><th>Stato</th><th className="text-right">Pagina</th></tr></thead>
              <tbody>
                {g.voci.map((m) => {
                  const gg = m.data ? Math.round((Date.parse(m.data) - Date.parse(oggi)) / 86400000) : null;
                  return (
                    <tr key={m.id} className="f-riga relative cursor-pointer">
                      <td className="font-medium"><Link href={`/admin/matrimoni/${m.id}`} className="hover:underline underline-offset-4 after:absolute after:inset-0">{m.nomi || "Senza nomi"}</Link></td>
                      <td className="whitespace-nowrap">
                        <span className="tabular-nums">{data(m.data) || "—"}</span>
                        {m.data && <span className="block text-xs text-tenue">{dataEstesa(m.data).split(" ")[0]}{gg != null && gg >= 0 && gg <= 60 ? ` · tra ${gg} gg` : ""}</span>}
                      </td>
                      <td className="hidden lg:table-cell text-tenue max-w-[16rem] truncate">{m.location || "—"}</td>
                      <td className="hidden md:table-cell tabular-nums text-tenue">{m.codice}</td>
                      <td>
                        <PillStato stato={m.stato} />
                        {m.senzaPreventivo && <span className="ml-2 text-xs text-errore">senza preventivo</span>}
                      </td>
                      <td className="text-right relative z-10">{m.token ? <a href={`/${m.token}`} target="_blank" rel="noopener noreferrer" className="f-link text-sm">Apri ↗</a> : <span className="text-tenue">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
