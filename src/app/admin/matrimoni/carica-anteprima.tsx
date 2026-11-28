"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { preparaCaricamento, registraAnteprima } from "./album-azioni";

/** Carica l'anteprima dell'album nello spazio privato: link firmato dal server, file direttamente dal browser. */
export function CaricaAnteprima({ mid, nuova }: { mid: string; nuova: boolean }) {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; testo: string } | null>(null);
  const [inCorso, avvia] = useTransition();

  function carica() {
    const f = file.current?.files?.[0];
    setMsg(null);
    if (!f) return setMsg({ ok: false, testo: "Scegli un file." });
    if (f.size > 50 * 1024 * 1024) return setMsg({ ok: false, testo: "Il file supera 50 MB: esporta un PDF più leggero." });
    avvia(async () => {
      const p = await preparaCaricamento(mid, f.type);
      if (!p.url || !p.percorso) return setMsg({ ok: false, testo: p.errore ?? "Errore" });
      const r = await fetch(p.url, { method: "PUT", headers: { "content-type": f.type, "x-upsert": "false" }, body: f }).catch(() => null);
      if (!r?.ok) return setMsg({ ok: false, testo: "Caricamento non riuscito: riprova." });
      const reg = await registraAnteprima(mid, p.percorso, f.name);
      if (!reg.ok) return setMsg({ ok: false, testo: reg.errore ?? "Errore" });
      if (file.current) file.current.value = "";
      setMsg({ ok: true, testo: "Anteprima caricata: gli Sposi la vedono nella loro pagina." });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <input ref={file} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="text-sm" />
        <button type="button" className="f-btn f-btn-pieno" onClick={carica} disabled={inCorso}>{inCorso ? "Caricamento…" : nuova ? "Carica la nuova versione" : "Carica l'anteprima"}</button>
      </div>
      <p className="text-xs text-tenue">PDF o immagine, fino a 50 MB. Da &quot;Album da fare&quot; lo stato passa ad &quot;Album&quot;; se gli Sposi avevano risposto, ricompaiono i pulsanti.</p>
      {msg && <p className={`text-sm ${msg.ok ? "text-ok" : "text-errore"}`} role="status">{msg.testo}</p>}
    </div>
  );
}
