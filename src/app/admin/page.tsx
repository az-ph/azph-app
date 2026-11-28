import Link from "next/link";
import { supabaseSessione } from "@/lib/supabase/sessione";
import { data, dataEstesa, euroBreve } from "@/lib/formato";
import { GIORNI_FOLLOWUP, GIORNI_KICKOFF, GIORNI_PROSSIMI, giorniTra, storiaContatti, type MatrimonioOggi } from "@/lib/admin/oggi";
import { salvaKickoff, segnaAlbumProposto, segnaRecensione } from "./matrimoni/azioni";
import { Modulo } from "./matrimoni/modulo";
import { Kpi, PillStato, Testata } from "./ui";
import { caricaOggi, GIORNI_RECENSIONE } from "@/lib/admin/carica-oggi";

const NOME_RATA = { acconto: "Acconto", saldo: "Saldo", album: "Album" } as const;

const dataOraBreve = (iso: string) => new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)).replace(/\//g, ".").replace(", ", " alle ").replace(":", ".");
const CANALE: Record<string, string> = { mail: "mail", whatsapp: "WhatsApp", telefono: "telefono", persona: "di persona", altro: "altro" };

export default async function Oggi() {
  const supabase = await supabaseSessione();
  const d = await caricaOggi(supabase);
  if ("errore" in d) return <p className="text-errore">Il database non risponde: {d.errore}</p>;
  const { f, daProporre, albumDaSeguire, recensioni, oggi } = d;
  const { data: log } = await supabase.from("log_job").select("eseguito_il, esito, dettaglio").eq("nome", "controllo_giornaliero").order("eseguito_il", { ascending: false }).limit(1).maybeSingle();
  const ultimo = log ? { eseguito_il: log.eseguito_il, esito: log.esito, cambi: ((log.dettaglio as { cambi?: unknown[] } | null)?.cambi ?? []) } : null;
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

        <Sezione titolo="Album" vuoto="Nessun album in corso.">
          {albumDaSeguire.map(({ m, a, fase, mia }) => (
            <Riga key={m.id} href={scheda(m, "album")} nomi={m.nomi}
              dettaglio={fase === "selezione" ? `selezione ricevuta il ${data(a?.selezione_il ?? null)}`
                : fase === "modifiche" ? `modifiche chieste il ${data(a?.modifiche_il ?? null)}`
                : fase === "anteprima" ? `anteprima del ${data(a?.anteprima_il ?? null)}` : "istruzioni inviate"}
              destra={<span className={`text-xs whitespace-nowrap ${mia ? "text-avviso" : "text-tenue"}`}>
                {fase === "selezione" ? "da impaginare" : fase === "modifiche" ? "nuova versione" : "attesa Sposi"}</span>} />
          ))}
        </Sezione>

        <Sezione titolo="Album da proporre" vuoto="Nessun album da proporre.">
          {daProporre.map((m) => (
            <li key={m.id} className="items-center">
              <span className="min-w-0"><Link href={`/admin/matrimoni/${m.id}?tab=messaggi`} className="font-medium hover:underline underline-offset-4">{m.nomi}</Link>
                <span className="block text-xs text-tenue">foto consegnate il {data(m.consegna)} · mail &quot;Proposta album&quot; in Messaggi</span></span>
              <form action={segnaAlbumProposto}><input type="hidden" name="matrimonio_id" value={m.id} />
                <button className="f-btn text-xs" title="Proposta fatta fuori dall'app, o da non fare">Fatto</button></form>
            </li>
          ))}
        </Sezione>

        <Sezione titolo="Recensioni da chiedere" vuoto="Nessuna recensione da chiedere.">
          {recensioni.map((m) => (
            <li key={m.id} className="items-center">
              <span className="min-w-0"><Link href={`/admin/matrimoni/${m.id}?tab=messaggi`} className="font-medium hover:underline underline-offset-4">{m.nomi}</Link>
                <span className="block text-xs text-tenue">foto consegnate il {data(m.consegna)} · messaggio &quot;Recensione&quot; in Messaggi</span></span>
              <span className="flex gap-2">
                <form action={segnaRecensione}><input type="hidden" name="matrimonio_id" value={m.id} /><input type="hidden" name="cosa" value="chiesta" />
                  <button className="f-btn text-xs" title="Chiesta fuori dall'app">Chiesta</button></form>
                <form action={segnaRecensione}><input type="hidden" name="matrimonio_id" value={m.id} /><input type="hidden" name="cosa" value="arrivata" />
                  <button className="f-btn text-xs" title="Recensione già arrivata">Arrivata</button></form>
              </span>
            </li>
          ))}
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
      <p className="text-xs text-tenue mt-6">Follow-up dopo {GIORNI_FOLLOWUP} giorni senza conferma · acconto a 3 settimane dal Matrimonio · saldo e album per i Matrimoni nello stato Saldo · recensione {GIORNI_RECENSIONE} giorni dopo la consegna.
        {" "}{ultimo ? <>Controllo automatico: {dataOraBreve(ultimo.eseguito_il)}{ultimo.esito !== "ok" ? " (con errori)" : ultimo.cambi.length ? ` (${ultimo.cambi.length} cambi di stato)` : ""}.</> : "Controllo automatico non ancora eseguito."}</p>
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
