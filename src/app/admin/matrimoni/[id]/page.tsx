import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { supabaseSessione } from "@/lib/supabase/sessione";
import { data, dataEstesa, euro, euroBreve } from "@/lib/formato";
import { STATI, etichettaFonte, nomiBrevi, prezziInTesto, unisciFonti } from "@/lib/admin/stati";
import { calcolaOfferta, type Categoria } from "@/lib/listino/motore";
import { listinoDaRighe, preventivoDaRiga } from "@/lib/sposi/dati";
import { eliminaIncasso, registraIncasso, rigeneraLink, salvaDati, salvaPreventivo, salvaTimeline, segnaInviato } from "../azioni";
import { calcolaRate } from "@/lib/sposi/rate";
import { scriviTimeline } from "@/lib/admin/timeline";
import { CopiaLink, Modulo } from "../modulo";
import { AvvisoData } from "../avviso-data";
import { Messaggi } from "../messaggi";
import { MESSAGGI, messaggioSuggerito, preparaMessaggi } from "@/lib/admin/messaggi";
import { stileDaColori } from "@/lib/mail/testo";
import { Campo, Riquadro, Spunta, inp } from "../campi";
import { Kpi, PillStato, Testata, giorniDa } from "../../ui";

const SCHEDE = [
  { k: "dati", t: "Sposi e dati" },
  { k: "preventivo", t: "Preventivo" },
  { k: "timeline", t: "Timeline" },
  { k: "pagamenti", t: "Pagamenti" },
  { k: "messaggi", t: "Messaggi" },
  { k: "attivita", t: "Attività" },
] as const;

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> };

export default async function SchedaMatrimonio({ params, searchParams }: Params) {
  const { id } = await params;
  const tab = (await searchParams).tab ?? "dati";
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await supabaseSessione();

  const [m, sposi, prev, link, listino, location, videomaker, timeline, pagamenti, importi, eventi, fontiUsate, imp] = await Promise.all([
    supabase.from("matrimonio").select("id, codice_id, stato, fonte, data_inizio, data_fine, ora_inizio, ora_fine, location_id, preparativi, formula_id, note_private, galleria_url, copertina_url, pagina_congiunta, videomaker_id").eq("id", id).maybeSingle(),
    supabase.from("sposo").select("ordine, nome, telefono, email, codice_fiscale, indirizzo, indirizzo_preparativi, consenso_promo").eq("matrimonio_id", id).order("ordine"),
    supabase.from("preventivo").select("id, versione, opzioni, prezzi_speciali, preselezione, scelte, totale, inviato_il, confermato_il, righe_confermate, note_cliente").eq("matrimonio_id", id).order("versione", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("link_sposi").select("token").eq("matrimonio_id", id).is("revocato_il", null).order("creato_il", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("voce_listino").select("id, codice, categoria, voce, descrizione, prezzo, prezzo_barrato, gruppo, collegata_a, solo_se, riepilogo, collaboratore, attiva").order("codice"),
    supabase.from("location").select("id, nome, comune").order("nome"),
    supabase.from("collaboratore").select("id, nome, codice, telefono").eq("ruolo", "videomaker").order("nome"),
    supabase.from("timeline").select("giorno, ordine, ora, fase, luogo, nota_privata").eq("matrimonio_id", id).order("giorno").order("ordine"),
    supabase.from("pagamento").select("id, tipo, importo, scadenza, pagato_il, note").eq("matrimonio_id", id).order("pagato_il", { nullsFirst: false }),
    supabase.from("importo").select("voce, importo").eq("matrimonio_id", id),
    supabase.from("evento_pagina").select("tipo, dettaglio, avvenuto_il").eq("matrimonio_id", id).order("avvenuto_il", { ascending: false }).limit(60),
    supabase.from("matrimonio").select("fonte").not("fonte", "is", null),
    supabase.from("impostazioni").select("fonti").maybeSingle(),
  ]);
  if (!m.data) notFound();
  const mat = m.data;
  const fonti = unisciFonti(imp.data?.fonti, (fontiUsate.data ?? []).map((x) => x.fonte), mat.fonte);
  const s = sposi.data ?? [];
  const h = await headers();
  const base = process.env.URL || `https://${h.get("host") ?? ""}`;
  const urlSposi = link.data ? `${base}/${link.data.token}` : null;
  // Aperta dall'admin sullo stesso dominio: la sessione la esclude dal conteggio delle aperture
  const apriSposi = link.data ? `/${link.data.token}` : null;
  const tel = s.find((x) => x.telefono)?.telefono?.replace(/[^\d+]/g, "");

  const luogo = (location.data ?? []).find((l) => l.id === mat.location_id);
  const aperture = (eventi.data ?? []).filter((e) => e.tipo === "apertura");
  const tocchi = (eventi.data ?? []).filter((e) => e.tipo === "selezione" || e.tipo === "deselezione").length;
  const rate = calcolaRate(Object.fromEntries((importi.data ?? []).map((x) => [x.voce, x.importo])), pagamenti.data ?? [], mat.data_inizio);
  const dovuto = rate.reduce((t, r) => t + r.dovuto, 0);
  const incassato = rate.reduce((t, r) => t + Math.min(r.dovuto, r.incassato), 0);
  const gg = giorniDa(mat.data_inizio);
  const p = prev.data;
  const icona = (d: string) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={d} /></svg>;

  return (
    <div>
      <Testata
        sopra={<><Link href="/admin" className="hover:text-testo">Matrimoni</Link> <span aria-hidden="true">/</span> <span className="tabular-nums">{mat.codice_id}</span></>}
        titolo={nomiBrevi(s) || "Senza nomi"}
        extra={<PillStato stato={mat.stato} />}
        sotto={[mat.data_inizio ? `${dataEstesa(mat.data_inizio)}` : "Data da definire", luogo ? `${luogo.nome}${luogo.comune ? `, ${luogo.comune}` : ""}` : null, mat.fonte ? `fonte ${etichettaFonte(fonti.find((f) => f.codice === mat.fonte) ?? { codice: mat.fonte, nome: mat.fonte })}` : null].filter(Boolean).join(" · ")}
        azioni={<>
          {urlSposi && <CopiaLink url={urlSposi} />}
          {tel && <a href={`https://wa.me/${tel.replace(/^\+/, "").replace(/^(?!39)(\d{9,10})$/, "39$1")}`} target="_blank" rel="noopener noreferrer" className="f-btn">{icona("M4 20l1.3-3.9A8 8 0 1 1 8 19.3z")}WhatsApp</a>}
          {apriSposi && <a href={apriSposi} target="_blank" rel="noopener noreferrer" className="f-btn f-btn-pieno">Apri pagina Sposi ↗</a>}
        </>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
        <Kpi etichetta="Al Matrimonio" valore={gg == null ? "—" : gg > 0 ? `${gg} gg` : gg === 0 ? "Oggi" : "Fatto"} nota={data(mat.data_inizio) || "data da definire"} />
        <Kpi etichetta="Pagina Sposi" valore={`${aperture.length} ${aperture.length === 1 ? "apertura" : "aperture"}`}
          nota={aperture[0] ? `ultima ${data(aperture[0].avvenuto_il)}` : "mai aperta"} tono={aperture.length ? "ok" : undefined} />
        <Kpi etichetta="Preventivo" valore={!p ? "—" : p.confermato_il ? "Confermato" : p.inviato_il ? "Inviato" : "Da inviare"}
          nota={!p ? "nessuno" : p.confermato_il ? `il ${data(p.confermato_il)}` : p.inviato_il ? `il ${data(p.inviato_il)} · ${tocchi} opzioni toccate` : `versione ${p.versione}`}
          tono={p?.confermato_il ? "ok" : p && !p.inviato_il ? "avviso" : undefined} />
        <Kpi etichetta="Pagamenti" valore={dovuto ? euroBreve(incassato) : "—"} nota={dovuto ? (incassato >= dovuto ? "tutto incassato" : `di ${euroBreve(dovuto)}`) : "dopo la conferma"} tono={dovuto && incassato >= dovuto ? "ok" : undefined} />
      </div>

      <nav className="f-schede mb-6" aria-label="Schede">
        {SCHEDE.map((x) => (
          <Link key={x.k} href={`?tab=${x.k}`} aria-current={tab === x.k ? "page" : undefined}>{x.t}</Link>
        ))}
      </nav>

      {tab === "dati" && (
        <Modulo azione={salvaDati} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={mat.id} />
          <Riquadro titolo="Il Matrimonio">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Campo etichetta="Stato">
                <select name="stato" defaultValue={mat.stato} className={inp}>{STATI.map((x) => <option key={x.valore} value={x.valore}>{x.etichetta}</option>)}</select>
              </Campo>
              <div className="flex flex-col gap-2"><Campo etichetta="Data"><input type="date" name="data_inizio" defaultValue={mat.data_inizio ?? ""} className={inp} /></Campo>{mat.stato.startsWith("qte") && <AvvisoData escludi={mat.id} iniziale={mat.data_inizio ?? ""} />}</div>
              <Campo etichetta="Data fine (più giorni)"><input type="date" name="data_fine" defaultValue={mat.data_fine ?? ""} className={inp} /></Campo>
              <Campo etichetta="Ora inizio"><input type="time" name="ora_inizio" defaultValue={mat.ora_inizio?.slice(0, 5) ?? ""} className={inp} /></Campo>
              <Campo etichetta="Ora fine"><input type="time" name="ora_fine" defaultValue={mat.ora_fine?.slice(0, 5) ?? ""} className={inp} /></Campo>
              <Campo etichetta="Fonte">
                <select name="fonte" defaultValue={mat.fonte ?? ""} className={inp}><option value="">—</option>{fonti.map((f) => <option key={f.codice} value={f.codice}>{etichettaFonte(f)}</option>)}</select>
              </Campo>
              <Campo etichetta="Location">
                <select name="location_id" defaultValue={mat.location_id ?? ""} className={inp}>
                  <option value="">—</option>
                  {(location.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.nome}{l.comune ? ` - ${l.comune}` : ""}</option>)}
                </select>
              </Campo>
              <Campo etichetta="Videomaker">
                <select name="videomaker_id" defaultValue={mat.videomaker_id ?? ""} className={inp}>
                  <option value="">—</option>
                  {(videomaker.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.codice ? `${v.codice} · ` : ""}{v.nome}</option>)}
                </select>
              </Campo>
              <div className="flex flex-col gap-2.5 justify-end pb-1">
                <Spunta nome="preparativi" etichetta="Preparativi" attiva={mat.preparativi} />
                <Spunta nome="pagina_congiunta" etichetta="Pagina congiunta con il video" attiva={mat.pagina_congiunta} />
              </div>
            </div>
          </Riquadro>
          <div className="grid lg:grid-cols-2 gap-4">
            {[1, 2].map((o) => {
              const x = s.find((y) => y.ordine === o);
              return (
                <Riquadro key={o} titolo={`Sposa/o ${o}`} azione={x?.consenso_promo ? <span className="f-pill bg-ok-fondo text-ok">consenso foto ✓</span> : null}>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Campo etichetta="Nome e cognome" largo><input name={`s${o}_nome`} defaultValue={x?.nome ?? ""} className={inp} autoComplete="off" /></Campo>
                    <Campo etichetta="Telefono"><input name={`s${o}_telefono`} defaultValue={x?.telefono ?? ""} className={inp} autoComplete="off" /></Campo>
                    <Campo etichetta="Email"><input name={`s${o}_email`} defaultValue={x?.email ?? ""} className={inp} autoComplete="off" /></Campo>
                    <Campo etichetta="Codice fiscale"><input name={`s${o}_codice_fiscale`} defaultValue={x?.codice_fiscale ?? ""} maxLength={16} className={`${inp} uppercase`} autoComplete="off" /></Campo>
                    <Campo etichetta="Residenza"><input name={`s${o}_indirizzo`} defaultValue={x?.indirizzo ?? ""} className={inp} autoComplete="off" /></Campo>
                    <Campo etichetta="Indirizzo preparativi" largo><input name={`s${o}_indirizzo_preparativi`} defaultValue={x?.indirizzo_preparativi ?? ""} className={inp} autoComplete="off" /></Campo>
                  </div>
                </Riquadro>
              );
            })}
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Riquadro titolo="Pagina Sposi">
              <div className="grid gap-4">
                <Campo etichetta="Gallerie (una per riga: Titolo | url)"><textarea name="galleria_url" rows={2} defaultValue={mat.galleria_url ?? ""} className={inp} /></Campo>
                <Campo etichetta="Copertina (url immagine)"><input name="copertina_url" defaultValue={mat.copertina_url ?? ""} className={inp} /></Campo>
              </div>
            </Riquadro>
            <Riquadro titolo="Note private" azione={<span className="text-xs text-tenue">mai visibili agli Sposi</span>}>
              <textarea name="note_private" rows={5} defaultValue={mat.note_private ?? ""} className={inp} aria-label="Note private" />
            </Riquadro>
          </div>
        </Modulo>
      )}

      {tab === "preventivo" && <SchedaPreventivo mat={mat} prev={prev.data} listinoRighe={listino.data ?? []} urlSposi={apriSposi} />}

      {tab === "timeline" && <SchedaTimeline mid={mat.id} righe={timeline.data ?? []} />}

      {tab === "pagamenti" && (
        <SchedaPagamenti mid={mat.id} dataMatrimonio={mat.data_inizio} importi={importi.data ?? []} incassi={pagamenti.data ?? []} />
      )}

      {tab === "messaggi" && (
        <SchedaMessaggi mat={mat} sposi={s} prev={prev.data} listinoRighe={listino.data ?? []} videomaker={videomaker.data ?? []} urlSposi={urlSposi} />
      )}

      {tab === "attivita" && (
        <AttivitaPagina eventi={eventi.data ?? []} />
      )}

      {link.data && (
        <form action={rigeneraLink} className="mt-14 pt-5 border-t border-bordo text-xs text-tenue">
          <input type="hidden" name="matrimonio_id" value={mat.id} />
          <button className="underline underline-offset-2 hover:text-errore">Rigenera il link Sposi</button> · il link attuale smette di funzionare
        </form>
      )}
    </div>
  );
}

type RigaListino = {
  id: string; codice: string; categoria: string; voce: string; descrizione: string | null; prezzo: number; prezzo_barrato: number | null;
  gruppo: string | null; collegata_a: string | null; solo_se: string | null; riepilogo: string | null; collaboratore: string | null; attiva: boolean;
};

function SchedaPreventivo({ mat, prev, listinoRighe, urlSposi }: {
  mat: { id: string; formula_id: string | null; pagina_congiunta: boolean };
  prev: {
    id: string; versione: number; opzioni: unknown; prezzi_speciali: unknown; preselezione: string[]; scelte: string[]; totale: number | null;
    inviato_il: string | null; confermato_il: string | null; righe_confermate: unknown; note_cliente: string | null;
  } | null;
  listinoRighe: RigaListino[]; urlSposi: string | null;
}) {
  if (!prev) return <Riquadro><p className="text-sm text-tenue">Nessun preventivo per questo Matrimonio.</p></Riquadro>;
  const formule = listinoRighe.filter((v) => v.categoria === "formula" && v.attiva);
  const formula = listinoRighe.find((v) => v.id === mat.formula_id);
  const opz = (prev.opzioni ?? {}) as Record<string, boolean>;

  if (prev.confermato_il) {
    const righe = (Array.isArray(prev.righe_confermate) ? prev.righe_confermate : []) as { voce: string; importo: number }[];
    return (
      <div className="grid lg:grid-cols-[1fr_22rem] gap-4 items-start">
        <Riquadro titolo="Servizi confermati" azione={<span className="f-pill bg-ok-fondo text-ok">● Confermato il {data(prev.confermato_il)}</span>}>
          {righe.length > 0 && (
            <ul className="f-righe text-sm">{righe.map((r, i) => <li key={i}><span>{r.voce}</span><span className={`tabular-nums ${r.importo ? "" : "text-ok"}`}>{r.importo ? euro(r.importo) : "omaggio"}</span></li>)}</ul>
          )}
          <p className="text-xs text-tenue mt-4">Versione {prev.versione} · formula {formula?.codice ?? "—"} · non si modifica più.</p>
        </Riquadro>
        <aside className="f-carta p-5 flex flex-col gap-3 text-sm">
          <span className="text-xs text-tenue">Totale fotografia</span>
          <span className="titolo text-[2.5rem] font-semibold leading-none tabular-nums">{prev.totale != null ? euroBreve(prev.totale) : "—"}</span>
          {prev.scelte.length > 0 && <p className="text-tenue">Scelte: {prev.scelte.join(", ")}</p>}
          {prev.note_cliente && <p className="bg-morbido rounded-[10px] p-3">“{prev.note_cliente}”</p>}
        </aside>
      </div>
    );
  }

  // Anteprima dei prezzi con il preventivo salvato
  const listino = listinoDaRighe(listinoRighe);
  let offerta: ReturnType<typeof calcolaOfferta> | null = null;
  let erroreOfferta = "";
  try {
    if (formula) offerta = calcolaOfferta(listino, preventivoDaRiga(prev as never, formula.codice, mat.pagina_congiunta));
  } catch (e) { erroreOfferta = e instanceof Error ? e.message : "Errore nel calcolo"; }
  const sceglibili = listinoRighe.filter((v) => v.attiva && (["extra", "prewedding", "album"] as Categoria[]).includes(v.categoria as Categoria));
  const barrato = offerta && formula && offerta.servizio.prezzo < formula.prezzo ? formula.prezzo : null;

  return (
    <div className="grid lg:grid-cols-[1fr_22rem] gap-4 items-start">
      <Modulo azione={salvaPreventivo} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={prev.id} />
        <input type="hidden" name="matrimonio_id" value={mat.id} />
        <Riquadro titolo="Formula e proposte">
          <div className="grid gap-4">
            <Campo etichetta="Formula">
              <select name="formula_id" defaultValue={mat.formula_id ?? ""} className={inp}>
                <option value="">—</option>
                {formule.map((f) => <option key={f.id} value={f.id}>{f.codice} · {f.voce} · {euro(f.prezzo)}</option>)}
              </select>
            </Campo>
            <div className="flex flex-col gap-2.5">
              <Spunta nome="proponi_video" etichetta="Proponi il video" attiva={opz.proponi_video} />
              <Spunta nome="proponi_prewedding" etichetta="Proponi il servizio prematrimoniale" attiva={opz.proponi_prewedding} />
              <Spunta nome="proponi_op2_ibrido" etichetta="Proponi il secondo operatore ibrido (mai insieme al video)" attiva={opz.proponi_op2_ibrido} />
            </div>
            <Campo etichetta="Prezzi speciali · una riga per voce: codice = euro (0 = omaggio)">
              <textarea name="prezzi" rows={4} defaultValue={prezziInTesto((prev.prezzi_speciali ?? {}) as Record<string, number>)}
                placeholder={"servizio = 1100\nbox = 0"} className={`${inp} font-mono text-sm`} />
            </Campo>
          </div>
        </Riquadro>
        <Riquadro titolo="Già selezionate all'apertura" azione={<span className="text-xs text-tenue">gli Sposi possono toglierle</span>}>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
            {sceglibili.map((v) => (
              <label key={v.codice} className="flex items-center gap-2.5 text-sm cursor-pointer">
                <input type="checkbox" name="preselezione" value={v.codice} defaultChecked={prev.preselezione.includes(v.codice)} className="size-4" />
                <span>{v.voce} <span className="text-tenue text-xs">{v.codice}</span></span>
              </label>
            ))}
          </div>
        </Riquadro>
      </Modulo>

      <aside className="f-carta p-5 flex flex-col gap-3 text-sm lg:sticky lg:top-6">
        <span className="text-xs text-tenue">Come la vedono gli Sposi · versione {prev.versione}</span>
        {erroreOfferta && <p className="text-errore">{erroreOfferta}</p>}
        {!formula && <p className="text-errore">Scegli una formula.</p>}
        {offerta && (
          <>
            <div className="flex items-baseline gap-2.5">
              <span className="titolo text-[2.5rem] font-semibold leading-none tabular-nums">{euroBreve(offerta.servizio.prezzo)}</span>
              {barrato && <s className="text-tenue tabular-nums">{euroBreve(barrato)}</s>}
            </div>
            <ul className="f-righe">
              {offerta.voci.filter((v) => v.categoria !== "formula").map((v) => (
                <li key={v.codice}>
                  <span>{v.voce}{prev.preselezione.includes(v.codice) ? <span className="text-tenue"> · già scelto</span> : ""}</span>
                  <span className={`tabular-nums whitespace-nowrap ${v.incluso || v.categoria === "omaggio" ? "text-ok" : ""}`}>{v.incluso || v.categoria === "omaggio" ? "omaggio" : euroBreve(v.prezzo)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="text-xs text-tenue">{prev.inviato_il ? `Inviato il ${data(prev.inviato_il)}` : "Non ancora inviato"} · si aggiorna dopo il salvataggio.</p>
        <div className="flex flex-col gap-2 pt-1">
          {urlSposi && <a href={urlSposi} target="_blank" rel="noopener noreferrer" className="f-btn justify-center">Apri come gli Sposi ↗</a>}
          <form action={segnaInviato}>
            <input type="hidden" name="id" value={prev.id} />
            <input type="hidden" name="matrimonio_id" value={mat.id} />
            <button className="f-btn w-full justify-center !bg-testo !text-fondo !border-transparent">{prev.inviato_il ? "Segna di nuovo come inviato oggi" : "Segna come inviato"}</button>
          </form>
        </div>
      </aside>
    </div>
  );
}

function AttivitaPagina({ eventi }: { eventi: { tipo: string; dettaglio: unknown; avvenuto_il: string }[] }) {
  const aperture = eventi.filter((e) => e.tipo === "apertura");
  const tocchi = eventi.filter((e) => e.tipo === "selezione" || e.tipo === "deselezione");
  const ora = (t: string) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return `${p.day}.${p.month}.${p.year} ${p.hour}.${p.minute}`;
  };
  if (!eventi.length) return <Riquadro><p className="text-sm text-tenue">La pagina non è ancora stata aperta.</p></Riquadro>;
  const punto: Record<string, string> = { apertura: "bg-tenue", invio: "bg-ok", selezione: "bg-accento", deselezione: "bg-avviso" };
  return (
    <Riquadro titolo={`Aperta ${aperture.length} ${aperture.length === 1 ? "volta" : "volte"} · ${tocchi.length} opzioni toccate`} className="max-w-3xl">
      <ul className="f-righe text-sm">{eventi.map((e, i) => {
        const d = (e.dettaglio ?? {}) as Record<string, unknown>;
        const cosa = e.tipo === "apertura" ? "Apertura" : e.tipo === "invio" ? "Conferma" : `${e.tipo === "selezione" ? "Aggiunto" : "Tolto"} ${String(d.codice ?? "")}`;
        return <li key={i}><span className="flex items-center gap-2.5"><span className={`size-2 rounded-full ${punto[e.tipo] ?? "bg-tenue"}`} aria-hidden="true" />{cosa}</span><span className="tabular-nums text-tenue">{ora(e.avvenuto_il)}</span></li>;
      })}</ul>
    </Riquadro>
  );
}

function SchedaTimeline({ mid, righe }: { mid: string; righe: { ora: string | null; fase: string | null; luogo: string | null; nota_privata: boolean }[] }) {
  const pubbliche = righe.filter((r) => !r.nota_privata);
  return (
    <div className="grid lg:grid-cols-[1fr_22rem] gap-4 items-start">
      <Riquadro titolo="Timeline" azione={<span className="text-xs text-tenue">ora Momento | luogo · # = nota privata</span>}>
        <Modulo azione={salvaTimeline}>
          <input type="hidden" name="matrimonio_id" value={mid} />
          <textarea name="timeline" rows={16} aria-label="Timeline, una riga per momento" className={`${inp} font-mono text-sm leading-6`}
            defaultValue={scriviTimeline(righe.map((r) => ({ ...r, fase: r.fase ?? "" })))}
            placeholder={"13.45 Preparativi della Sposa | Casa\n16.00 Rito civile | Villa\n17.00 Aperitivo\n# parcheggio sul retro\n01.00 Termine presunto del servizio"} />
        </Modulo>
      </Riquadro>
      <aside className="f-carta p-5 text-sm lg:sticky lg:top-6">
        <p className="text-xs text-tenue mb-3">Come la vedono gli Sposi</p>
        {pubbliche.length ? (
          <ol className="relative border-l border-bordo ml-1.5">{pubbliche.map((r, i) => (
            <li key={i} className="pl-4 pb-3 last:pb-0 relative">
              <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-accento" aria-hidden="true" />
              <span className="titolo tabular-nums font-semibold">{r.ora?.slice(0, 5).replace(":", ".") ?? ""}</span>
              <span className="block">{r.fase}</span>
              {r.luogo && <span className="block text-tenue text-xs">{r.luogo}</span>}
            </li>
          ))}</ol>
        ) : <p className="text-tenue">Ancora vuota.</p>}
        <p className="mt-4 text-xs text-tenue">Gli orari dopo mezzanotte passano da soli al giorno dopo. Le note private non compaiono mai.</p>
      </aside>
    </div>
  );
}

const NOME_RATA: Record<string, string> = { acconto: "Acconto", saldo: "Saldo", album: "Album", album_genitori: "Album genitori", altro: "Incasso dal foglio / altro" };

function SchedaPagamenti({ mid, dataMatrimonio, importi, incassi }: {
  mid: string; dataMatrimonio: string | null; importi: { voce: string; importo: number }[];
  incassi: { id: string; tipo: string; importo: number; scadenza: string | null; pagato_il: string | null; note: string | null }[];
}) {
  const perVoce = Object.fromEntries(importi.map((x) => [x.voce, x.importo]));
  const rate = calcolaRate(perVoce, incassi, dataMatrimonio);
  const oggi = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
  if (!importi.length) return <Riquadro><p className="text-sm text-tenue">Nessun importo: le rate compaiono dopo la conferma del preventivo.</p></Riquadro>;
  const registrati = incassi.filter((x) => x.pagato_il);
  return (
    <div className="flex flex-col gap-4">
      <div className="f-carta overflow-x-auto">
        <table className="f-tabella">
          <thead><tr><th>Rata</th><th>Scadenza</th><th className="num">Dovuto</th><th className="num">Incassato</th><th className="num">Manca</th><th></th></tr></thead>
          <tbody>{rate.map((r) => {
            const manca = Math.max(0, r.dovuto - r.incassato);
            const scaduta = manca > 0 && r.scadenza && r.scadenza < oggi;
            return (
              <tr key={r.tipo}>
                <td className="font-medium whitespace-nowrap">{NOME_RATA[r.tipo]}</td>
                <td className={`tabular-nums whitespace-nowrap ${scaduta ? "text-avviso font-medium" : ""}`}>{r.scadenza ? data(r.scadenza) : r.tipo === "saldo" ? "alla consegna" : r.tipo === "album" ? "alla consegna album" : "—"}</td>
                <td className="num">{euro(r.dovuto)}</td>
                <td className="num">{euro(r.incassato)}</td>
                <td className="num">{manca ? euro(manca) : <span className="f-pill bg-ok-fondo text-ok">✓ pagato</span>}</td>
                <td>
                  {manca > 0 && (
                    <Modulo azione={registraIncasso} etichetta="Segna pagato" compatto className="flex items-center gap-2 justify-end">
                      <input type="hidden" name="matrimonio_id" value={mid} />
                      <input type="hidden" name="tipo" value={r.tipo} />
                      <input name="importo" defaultValue={(manca / 100).toFixed(2).replace(".", ",")} className={`${inp} !w-24 !py-1.5 text-sm text-right`} aria-label="Importo" />
                      <input type="date" name="pagato_il" defaultValue={oggi} className={`${inp} !w-auto !py-1.5 text-sm`} aria-label="Data" />
                    </Modulo>
                  )}
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <p className="text-xs text-tenue">Se l&apos;acconto incassato è diverso dal calcolo, l&apos;acconto diventa quello e il saldo si ricalcola. Correggi l&apos;importo prima di premere &quot;Segna pagato&quot;.</p>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Riquadro titolo="Incassi registrati">
          {registrati.length ? (
            <ul className="f-righe text-sm">{registrati.map((x) => (
              <li key={x.id}>
                <span>{NOME_RATA[x.tipo] ?? x.tipo} <span className="text-tenue">· {data(x.pagato_il)}{x.note ? ` · ${x.note}` : ""}</span></span>
                <span className="flex items-center gap-3 tabular-nums">{euro(x.importo)}
                  <form action={eliminaIncasso}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="matrimonio_id" value={mid} />
                    <button className="text-tenue hover:text-errore text-xs" aria-label="Elimina incasso" title="Elimina">✕</button></form>
                </span>
              </li>
            ))}</ul>
          ) : <p className="text-sm text-tenue">Nessun incasso registrato.</p>}
        </Riquadro>
        <Riquadro titolo="Aggiungi incasso">
          <Modulo azione={registraIncasso} etichetta="Registra">
            <input type="hidden" name="matrimonio_id" value={mid} />
            <div className="grid grid-cols-2 gap-4">
              <Campo etichetta="Rata"><select name="tipo" className={inp} defaultValue="acconto">{["acconto", "saldo", "album", "altro"].map((t) => <option key={t} value={t}>{NOME_RATA[t]}</option>)}</select></Campo>
              <Campo etichetta="Importo (€)"><input name="importo" className={inp} placeholder="800" inputMode="decimal" /></Campo>
              <Campo etichetta="Data"><input type="date" name="pagato_il" defaultValue={oggi} className={inp} /></Campo>
              <Campo etichetta="Nota"><input name="note" className={inp} /></Campo>
            </div>
          </Modulo>
        </Riquadro>
      </div>
    </div>
  );
}

async function SchedaMessaggi({ mat, sposi, prev, listinoRighe, videomaker, urlSposi }: {
  mat: { id: string; data_inizio: string | null; formula_id: string | null; pagina_congiunta: boolean; videomaker_id: string | null };
  sposi: { ordine: number; nome: string | null; email: string | null; telefono: string | null }[];
  prev: { versione: number; opzioni: unknown; inviato_il: string | null; confermato_il: string | null } | null;
  listinoRighe: RigaListino[]; videomaker: { id: string; nome: string; codice: string | null; telefono: string | null }[]; urlSposi: string | null;
}) {
  if (!urlSposi) return <Riquadro><p className="text-sm text-tenue">Questo Matrimonio non ha un link Sposi: crealo prima di mandare messaggi.</p></Riquadro>;
  const supabase = await supabaseSessione();
  const [imp, modelli, invii] = await Promise.all([
    supabase.from("impostazioni").select("marchio, colori, firma, url_recensioni").single(),
    supabase.from("modello_messaggio").select("chiave, oggetto, corpo_mail, corpo_whatsapp"),
    supabase.from("invio").select("modello, canale, stato, inviato_il, created_at, errore").eq("matrimonio_id", mat.id).order("created_at", { ascending: false }).limit(30),
  ]);
  const marchio = (imp.data?.marchio ?? {}) as Record<string, string | undefined>;
  const firma = { testo: imp.data?.firma || marchio.firma || marchio.titolare || "", html: marchio.firma_mail_html || undefined };

  // Omaggi e video del preventivo attuale
  const formula = listinoRighe.find((v) => v.id === mat.formula_id);
  let omaggi: string[] = [];
  let codiciVideo: string[] = [];
  if (prev && formula) {
    try {
      const o = calcolaOfferta(listinoDaRighe(listinoRighe), preventivoDaRiga(prev as never, formula.codice, mat.pagina_congiunta));
      omaggi = o.voci.filter((v) => v.categoria !== "formula" && (v.incluso || v.categoria === "omaggio")).map((v) => v.voce);
      codiciVideo = o.voci.map((v) => listinoRighe.find((r) => r.codice === v.codice)?.collaboratore).filter((c): c is string => !!c);
    } catch { /* senza offerta valida: niente omaggi nel testo */ }
  }
  const opz = (prev?.opzioni ?? {}) as Record<string, boolean>;
  const vm = videomaker.find((v) => v.id === mat.videomaker_id) ?? videomaker.find((v) => v.codice && codiciVideo.includes(v.codice)) ?? videomaker[0];
  const valori = {
    NOMI: nomiBrevi(sposi), DATA: data(mat.data_inizio), DATA_ESTESA: dataEstesa(mat.data_inizio),
    DATA_LUNGA: dataEstesa(mat.data_inizio).replace(/^\S+ /, ""),
    LINK: urlSposi, LINK_TIMELINE: `${urlSposi}#azp-timeline`, VERSIONE: prev ? `v${String(prev.versione).padStart(2, "0")}` : "",
    URL_RECENSIONI: imp.data?.url_recensioni ?? "", VIDEOMAKER: vm?.nome ?? "", VIDEOMAKER_TELEFONO: vm?.telefono ?? "",
  };
  const pronti = preparaMessaggi(modelli.data ?? [], valori, { omaggi, video: !!opz.proponi_video && !mat.pagina_congiunta, firma: firma.testo });
  const persone = [...sposi].sort((a, b) => a.ordine - b.ordine).map((x) => ({ nome: x.nome ?? "", email: x.email?.trim() ?? "", telefono: x.telefono ?? "" }));
  const titolo = Object.fromEntries([...MESSAGGI.map((m) => [m.chiave, m.titolo]), ["conferma_sposi", "Conferma"]]);
  return (
    <div className="flex flex-col gap-4">
    <Messaggi mid={mat.id} pronti={pronti} persone={persone} firma={firma} stile={stileDaColori(imp.data?.colori as Record<string, string> | null)}
      suggerito={messaggioSuggerito({ confermato: !!prev?.confermato_il, inviato: !!prev?.inviato_il, congiunta: mat.pagina_congiunta })} />
      {(invii.data ?? []).length > 0 && (
        <Riquadro titolo="Inviati" className="max-w-3xl">
          <ul className="f-righe text-sm">{(invii.data ?? []).map((x, i) => (
            <li key={i}>
              <span>{titolo[x.modello ?? ""] ?? x.modello} <span className="text-tenue">· {x.canale === "mail" ? "mail" : "WhatsApp aperto"}</span>
                {x.stato === "errore" && <span className="text-errore"> · non inviata{x.errore ? ` (${x.errore})` : ""}</span>}</span>
              <span className="tabular-nums text-tenue">{dataOra(x.inviato_il ?? x.created_at)}</span>
            </li>
          ))}</ul>
        </Riquadro>
      )}
    </div>
  );
}

function dataOra(t: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    .formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return `${p.day}.${p.month}.${p.year} ${p.hour}.${p.minute}`;
}
