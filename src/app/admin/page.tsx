import Link from "next/link";
import { supabaseSessione } from "@/lib/supabase/sessione";
import { data, dataEstesa, euroBreve } from "@/lib/formato";
import { STATI, nomiBrevi } from "@/lib/admin/stati";
import { GIORNI_FOLLOWUP, GIORNI_KICKOFF, GIORNI_PROSSIMI, cosaFare, giorniTra, storiaContatti, type MatrimonioOggi } from "@/lib/admin/oggi";
import { salvaKickoff } from "./matrimoni/azioni";
import { Modulo } from "./matrimoni/modulo";
import { Kpi, PillStato, Testata } from "./ui";

const APERTI = STATI.map((s) => s.valore).filter((v) => v.startsWith("qte") || v.startsWith("wdg"));
const NOME_RATA = { acconto: "Acconto", saldo: "Saldo", album: "Album" } as const;
const CANALE: Record<string, string> = { mail: "mail", whatsapp: "WhatsApp", telefono: "telefono", persona: "di persona", altro: "altro" };

export default async function Oggi() {
  const supabase = await supabaseSessione();
  const { data: righe, error } = await supabase.from("matrimonio")
    .select("id, codice_id, stato, data_inizio, kickoff_il, sposi:sposo ( ordine, nome ), preventivo ( versione, inviato_il, confermato_il )")
    .in("stato", APERTI);
  if (error) return <p className="text-errore">Il database non risponde: {error.message}</p>;
  const ids = (righe ?? []).map((m) => m.id);
  const idsPreventivi = (righe ?? []).filter((m) => m.stato.startsWith("qte")).map((m) => m.id);
  const [importi, incassi, aperture, contatti, invii] = await Promise.all([
    supabase.from("importo").select("matrimonio_id, voce, importo").in("matrimonio_id", ids),
    supabase.from("pagamento").select("matrimonio_id, tipo, importo, pagato_il").in("matrimonio_id", ids),
    supabase.from("evento_pagina").select("matrimonio_id, avvenuto_il").eq("tipo", "apertura").in("matrimonio_id", idsPreventivi),
    supabase.from("contatto").select("matrimonio_id, tipo, canale, avvenuto_il, prossimo_il").in("matrimonio_id", idsPreventivi),
    supabase.from("invio").select("matrimonio_id, modello, canale, inviato_il").eq("stato", "inviato").in("modello", ["preventivo", "aggiornato", "duo", "follow_up"]).in("matrimonio_id", idsPreventivi),
  ]);

  const elenco: MatrimonioOggi[] = (righe ?? []).map((m) => {
    const p = [...(m.preventivo as { versione: number; inviato_il: string | null; confermato_il: string | null }[])].sort((a, b) => b.versione - a.versione)[0];
    const ap = (aperture.data ?? []).filter((x) => x.matrimonio_id === m.id).map((x) => x.avvenuto_il).sort();
    return {
      id: m.id, codice: m.codice_id, stato: m.stato, data: m.data_inizio, kickoff: m.kickoff_il,
      nomi: nomiBrevi(m.sposi as { ordine: number; nome: string | null }[]) || m.codice_id,
      preventivo: p ? { inviato: p.inviato_il, confermato: p.confermato_il } : null,
      aperture: ap.length, ultimaApertura: ap.at(-1) ?? null,
      importi: Object.fromEntries((importi.data ?? []).filter((x) => x.matrimonio_id === m.id).map((x) => [x.voce, x.importo])),
      incassi: (incassi.data ?? []).filter((x) => x.matrimonio_id === m.id),
      contatti: [
        ...(contatti.data ?? []).filter((x) => x.matrimonio_id === m.id)
          .map((x) => ({ tipo: x.tipo as "invio" | "follow_up", il: x.avvenuto_il, canale: x.canale, prossimo: x.prossimo_il })),
        ...(invii.data ?? []).filter((x) => x.matrimonio_id === m.id && x.inviato_il)
          .map((x) => ({ tipo: (x.modello === "follow_up" ? "follow_up" : "invio") as "invio" | "follow_up", il: x.inviato_il!, canale: x.canale })),
      ],
    };
  });
  const oggi = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
  const f = cosaFare(elenco, oggi);
  const daIncassare = f.pagamenti.reduce((t, p) => t + p.manca, 0);
  const scheda = (m: MatrimonioOggi, tab?: string) => `/admin/matrimoni/${m.id}${tab ? `?tab=${tab}` : ""}`;
  const ora = Number(new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", hourCycle: "h23" }).format(new Date()));

  return (
    <>
      <Testata titolo={ora < 13 ? "Buongiorno" : ora < 18 ? "Buon pomeriggio" : "Buonasera"} sotto={`Oggi è ${dataEstesa(oggi)}`}
        azioni={<Link href="/admin/matrimoni/nuovo" className="f-btn f-btn-pieno">+ Nuovo Matrimonio</Link>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Kpi etichetta="Da incassare" valore={daIncassare ? euroBreve(daIncassare) : "—"} nota={f.pagamenti.some((p) => p.scaduto) ? `${f.pagamenti.filter((p) => p.scaduto).length} scaduti` : "niente di scaduto"} tono={f.pagamenti.some((p) => p.scaduto) ? "avviso" : "ok"} />
        <Kpi etichetta="Kick-off da fissare" valore={f.kickoff.length} nota={`Matrimoni entro ${GIORNI_KICKOFF} giorni`} tono={f.kickoff.length ? "avviso" : "ok"} />
        <Kpi etichetta="Preventivi" valore={f.daInviare.length + f.followup.length} nota={`${f.daInviare.length} da fare · ${f.followup.length} follow up`} />
        <Kpi etichetta="Prossimi Matrimoni" valore={f.prossimi.length} nota={`nei prossimi ${GIORNI_PROSSIMI} giorni`} />
      </div>

      <div className="grid xl:grid-cols-2 gap-4 items-start">
        <Sezione titolo="Soldi e scadenze" vuoto="Nessun pagamento scaduto o in scadenza.">
          {f.pagamenti.map((p, i) => (
            <Riga key={i} href={scheda(p.m, "pagamenti")} nomi={p.m.nomi}
              dettaglio={`${NOME_RATA[p.rata]}${p.scadenza ? ` · scade il ${data(p.scadenza)}` : " · alla consegna"}`}
              destra={<span className={`tabular-nums font-medium ${p.scaduto ? "text-avviso" : ""}`}>{euroBreve(p.manca)}</span>} />
          ))}
        </Sezione>

        <Sezione titolo="Kick-off da fissare" vuoto="Nessun kick-off da fissare.">
          {f.kickoff.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3">
              <span><Link href={scheda(m, "dati")} className="font-medium hover:underline underline-offset-4">{m.nomi}</Link>
                <span className="block text-xs text-tenue">Matrimonio il {data(m.data)} · tra {giorniTra(oggi, m.data!)} giorni</span></span>
              <Modulo azione={salvaKickoff} etichetta="Segna e crea [KOM]" compatto className="flex items-center gap-2">
                <input type="hidden" name="matrimonio_id" value={m.id} />
                <input type="datetime-local" name="kickoff_il" required aria-label={`Data del kick-off di ${m.nomi}`} className="f-inp !w-auto !py-1.5 text-sm" />
              </Modulo>
            </li>
          ))}
        </Sezione>

        <Sezione titolo="Preventivi da fare" vuoto="Nessun preventivo da preparare o da inviare.">
          {f.daInviare.map((m) => {
            const st = storiaContatti(m);
            const cosa = m.stato === "qte_to_contact" ? "Da contattare"
              : m.stato === "qte_contatto" ? (st.ultimo ? `Ultimo contatto il ${data(st.ultimo.il)}` : "Primo contatto")
              : m.preventivo ? "Da inviare" : "Da preparare";
            const risentire = st.prossimo ? (st.prossimo <= oggi ? " · da risentire" : ` · da risentire dal ${data(st.prossimo)}`) : "";
            return (
              <Riga key={m.id} href={scheda(m, m.stato === "qte_quote" && !m.preventivo ? "preventivo" : "messaggi")} nomi={m.nomi}
                dettaglio={`${cosa}${risentire} · ${m.codice}${m.data ? ` · Matrimonio il ${data(m.data)}` : ""}`}
                destra={<PillStato stato={m.stato} />} />
            );
          })}
        </Sezione>

        <Sezione titolo="Follow up" vuoto="Nessun preventivo da risentire.">
          {f.followup.map((m) => {
            const st = storiaContatti(m);
            const canale = st.ultimo && st.ultimo.canale !== "app" ? ` (${CANALE[st.ultimo.canale] ?? st.ultimo.canale})` : "";
            return (
              <Riga key={m.id} href={scheda(m, "messaggi")} nomi={m.nomi}
                dettaglio={[
                  `Inviato il ${data(st.invio!.il)}`,
                  st.followUp ? `ultimo contatto il ${data(st.ultimo!.il)}${canale}` : null,
                  m.aperture ? `aperto ${m.aperture} ${m.aperture === 1 ? "volta" : "volte"}` : "mai aperto",
                ].filter(Boolean).join(" · ")}
                destra={<span className="text-xs text-avviso whitespace-nowrap">{st.prossimo ? `da risentire dal ${data(st.prossimo)}` : `da ${giorniTra(st.ultimo!.il, oggi)} gg`}</span>} />
            );
          })}
        </Sezione>

        <Sezione titolo="Prossimi Matrimoni" vuoto={`Nessun Matrimonio nei prossimi ${GIORNI_PROSSIMI} giorni.`}>
          {f.prossimi.map((m) => {
            const gg = giorniTra(oggi, m.data!);
            return (
              <Riga key={m.id} href={scheda(m, "timeline")} nomi={m.nomi} dettaglio={dataEstesa(m.data)}
                destra={<span className="text-xs whitespace-nowrap">{gg === 0 ? "oggi" : gg === 1 ? "domani" : `tra ${gg} gg`}</span>} />
            );
          })}
        </Sezione>
      </div>
      <p className="text-xs text-tenue mt-6">Follow-up dopo {GIORNI_FOLLOWUP} giorni senza conferma · acconto a 3 settimane dal Matrimonio · saldo e album per i Matrimoni nello stato Saldo.</p>
    </>
  );
}

function Sezione({ titolo, vuoto, children }: { titolo: string; vuoto: string; children: React.ReactNode[] }) {
  const n = children.flat().filter(Boolean).length;
  return (
    <section className="f-carta p-5">
      <h2 className="text-[0.9375rem] font-semibold mb-3">{titolo} {n > 0 && <span className="text-tenue font-normal">· {n}</span>}</h2>
      {n ? <ul className="f-righe text-sm">{children}</ul> : <p className="text-sm text-ok">✓ {vuoto}</p>}
    </section>
  );
}

function Riga({ href, nomi, dettaglio, destra }: { href: string; nomi: string; dettaglio: string; destra: React.ReactNode }) {
  return (
    <li className="items-center">
      <span className="min-w-0"><Link href={href} className="font-medium hover:underline underline-offset-4">{nomi}</Link>
        <span className="block text-xs text-tenue">{dettaglio}</span></span>
      {destra}
    </li>
  );
}
