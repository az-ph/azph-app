"use client";

import { useActionState, useMemo, useState } from "react";
import { componi, type Firma, type Stile } from "@/lib/mail/testo";
import { numeroWhatsapp, primoNome, type ChiaveMessaggio, type Pronto } from "@/lib/admin/messaggi";
import { inviaMessaggio, registraWhatsapp } from "./messaggi-azioni";

type Persona = { nome: string; email: string; telefono: string };
type Bozza = { oggetto: string; mail: string; whatsapp: string };

export function Messaggi({ mid, pronti, suggerito, persone, stile, firma }: {
  mid: string; pronti: Pronto[]; suggerito: ChiaveMessaggio; persone: Persona[]; stile: Stile; firma: Firma;
}) {
  const [chiave, setChiave] = useState<ChiaveMessaggio>(suggerito);
  const [bozze, setBozze] = useState<Record<string, Bozza>>(() => Object.fromEntries(pronti.map((p) => [p.chiave, { oggetto: p.oggetto, mail: p.mail, whatsapp: p.whatsapp }])));
  const [anteprima, setAnteprima] = useState(false);
  const [idem, setIdem] = useState(() => crypto.randomUUID());
  const [esito, invia, inCorso] = useActionState(async (s: Parameters<typeof inviaMessaggio>[0], fd: FormData) => {
    const r = await inviaMessaggio(s, fd);
    if (r?.ok) setIdem(crypto.randomUUID());
    return r;
  }, null);

  const p = pronti.find((x) => x.chiave === chiave)!;
  const b = bozze[chiave];
  const cambia = (campo: keyof Bozza, v: string) => setBozze((x) => ({ ...x, [chiave]: { ...x[chiave], [campo]: v } }));
  const html = useMemo(() => (anteprima ? componi(b.mail, {}, stile, firma).html : ""), [anteprima, b.mail, stile, firma]);
  const conMail = persone.filter((x) => x.email);
  const conTel = persone.map((x) => ({ ...x, numero: numeroWhatsapp(x.telefono) })).filter((x) => x.numero);
  const modificato = b.oggetto !== p.oggetto || b.mail !== p.mail || b.whatsapp !== p.whatsapp;

  return (
    <div className="flex flex-col gap-4">
      <nav className="f-schede" aria-label="Messaggio">
        {pronti.map((x) => (
          <a key={x.chiave} href="#" aria-current={x.chiave === chiave ? "page" : undefined}
            onClick={(e) => { e.preventDefault(); setChiave(x.chiave); }}>{x.titolo}</a>
        ))}
      </nav>

      {p.manca ? (
        <div className="f-carta p-5 text-sm">Manca il modello di questo messaggio: vai in <b>Importa e testi</b> e premi <b>Aggiorna i testi</b>.</div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_22rem] gap-4 items-start">
          <form action={invia} className="f-carta p-5 sm:p-6 flex flex-col gap-4"
            onSubmit={(e) => { if (!confirm(`Inviare la mail "${b.oggetto}"?`)) e.preventDefault(); }}>
            <input type="hidden" name="matrimonio_id" value={mid} />
            <input type="hidden" name="chiave" value={chiave} />
            <input type="hidden" name="idem" value={idem} />
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[0.9375rem] font-semibold">Mail</h2>
              <div className="flex gap-2">
                {modificato && <button type="button" className="f-btn !py-1 !px-2.5 text-xs" onClick={() => setBozze((x) => ({ ...x, [chiave]: { oggetto: p.oggetto, mail: p.mail, whatsapp: p.whatsapp } }))}>Ripristina il testo</button>}
                <button type="button" className="f-btn !py-1 !px-2.5 text-xs" onClick={() => setAnteprima((x) => !x)}>{anteprima ? "Modifica" : "Anteprima"}</button>
              </div>
            </div>
            <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <legend className="text-tenue font-medium text-[0.8125rem] mb-1.5">A</legend>
              {conMail.length ? conMail.map((x) => (
                <label key={x.email} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="destinatari" value={x.email} defaultChecked className="size-4" />
                  {primoNome(x.nome) || x.email} <span className="text-tenue">{x.email}</span>
                </label>
              )) : <span className="text-errore">Nessuna email: aggiungila in Sposi e dati.</span>}
            </fieldset>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-tenue font-medium text-[0.8125rem]">Oggetto</span>
              <input name="oggetto" value={b.oggetto} onChange={(e) => cambia("oggetto", e.target.value)} className="f-inp" />
            </label>
            {anteprima ? (
              <iframe title="Anteprima della mail" srcDoc={`<body style="margin:16px;background:#fff">${html}</body>`} sandbox="" className="w-full h-[32rem] rounded-[10px] border border-bordo bg-white" />
            ) : (
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-tenue font-medium text-[0.8125rem]">Testo · [!Pulsante](link) · **grassetto** · {"{FIRMA}"} = firma</span>
                <textarea value={b.mail} onChange={(e) => cambia("mail", e.target.value)} rows={18} className="f-inp leading-6" />
              </label>
            )}
            <input type="hidden" name="corpo" value={b.mail} />
            <div className="flex flex-wrap items-center gap-4">
              <button className="f-btn f-btn-pieno" disabled={inCorso || !conMail.length}>{inCorso ? "Invio…" : "Invia la mail"}</button>
              {esito?.ok && <span className="text-ok text-sm font-medium" role="status">Inviata ✓ (copia a te in Ccn)</span>}
              {esito?.errore && <span className="text-errore text-sm" role="alert">{esito.errore}</span>}
            </div>
          </form>

          <aside className="f-carta p-5 flex flex-col gap-3 text-sm lg:sticky lg:top-6">
            <h2 className="text-[0.9375rem] font-semibold">WhatsApp</h2>
            <textarea value={b.whatsapp} onChange={(e) => cambia("whatsapp", e.target.value)} rows={12} aria-label="Testo WhatsApp" className="f-inp text-sm leading-6" />
            <p className="text-xs text-tenue">{"{NOME}"} diventa il nome di chi lo riceve.</p>
            {conTel.length ? conTel.map((x) => (
              <a key={x.numero} className="f-btn justify-center" target="_blank" rel="noopener noreferrer"
                href={`https://wa.me/${x.numero}?text=${encodeURIComponent(b.whatsapp.split("{NOME}").join(primoNome(x.nome)))}`}
                onClick={() => { void registraWhatsapp(mid, chiave); }}>
                Apri WhatsApp con {primoNome(x.nome) || x.telefono}
              </a>
            )) : <p className="text-errore">Nessun numero: aggiungilo in Sposi e dati.</p>}
          </aside>
        </div>
      )}
    </div>
  );
}
