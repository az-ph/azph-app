"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ControlloData } from "@/lib/admin/data-libera";
import { ETICHETTA_STATO } from "@/lib/admin/stati";
import { verificaData } from "./azioni";

/** Sotto il campo data: altri Matrimoni e impegni in calendario quel giorno. */
export function AvvisoData({ nome = "data_inizio", escludi, iniziale }: { nome?: string; escludi?: string; iniziale?: string }) {
  const [iso, setIso] = useState(iniziale ?? "");
  const [c, setC] = useState<ControlloData | null>(null);
  useEffect(() => {
    const campo = document.querySelector<HTMLInputElement>(`input[name="${nome}"]`);
    const leggi = () => setIso(campo?.value ?? "");
    campo?.addEventListener("change", leggi);
    return () => campo?.removeEventListener("change", leggi);
  }, [nome]);
  useEffect(() => {
    let attivo = true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) { setC(null); return; }
    verificaData(iso, escludi).then((r) => { if (attivo) setC(r); });
    return () => { attivo = false; };
  }, [iso, escludi]);
  if (!c) return null;
  const libero = !c.matrimoni.length && !c.impegni.length;
  return (
    <div role="status" className={`rounded-[10px] px-3 py-2 text-[0.8125rem] ${libero ? "bg-ok-fondo text-ok" : "bg-avviso-fondo text-avviso"}`}>
      {libero && <p>Data libera{c.calendario === "ok" ? ", anche in calendario" : ""}.</p>}
      {c.matrimoni.map((m) => (
        <p key={m.id}>{m.stato.startsWith("wdg") ? "Occupata" : "Altro preventivo"}: <Link href={`/admin/matrimoni/${m.id}`} className="underline">{m.nomi || m.codice}</Link> · {ETICHETTA_STATO[m.stato] ?? m.stato}</p>
      ))}
      {c.impegni.map((x, i) => <p key={i}>In calendario: {x.titolo} · {x.intera ? "tutto il giorno" : x.ora}</p>)}
      {c.calendario === "errore" && <p className="text-tenue">Calendario non raggiungibile: controllato solo il database.</p>}
      {c.calendario === "non_impostato" && <p className="text-tenue">Calendario non collegato: controllato solo il database.</p>}
    </div>
  );
}
