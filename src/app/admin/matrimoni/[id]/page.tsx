import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { supabaseSessione } from "@/lib/supabase/sessione";
import { data, euro } from "@/lib/formato";
import { FONTI, STATI, ETICHETTA_STATO, nomiBrevi, prezziInTesto } from "@/lib/admin/stati";
import { calcolaOfferta, type Categoria } from "@/lib/listino/motore";
import { listinoDaRighe, preventivoDaRiga } from "@/lib/sposi/dati";
import { eliminaIncasso, registraIncasso, rigeneraLink, salvaDati, salvaPreventivo, salvaTimeline, segnaInviato } from "../azioni";
import { calcolaRate } from "@/lib/sposi/rate";
import { scriviTimeline } from "@/lib/admin/timeline";
import { CopiaLink, Modulo } from "../modulo";
import { Campo, Spunta, inp } from "../campi";

const SCHEDE = [
  { k: "dati", t: "Sposi e dati" },
  { k: "preventivo", t: "Preventivo" },
  { k: "timeline", t: "Timeline" },
  { k: "pagamenti", t: "Pagamenti" },
  { k: "attivita", t: "Attività pagina" },
] as const;

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> };

export default async function SchedaMatrimonio({ params, searchParams }: Params) {
  const { id } = await params;
  const tab = (await searchParams).tab ?? "dati";
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await supabaseSessione();

  const [m, sposi, prev, link, listino, location, videomaker, timeline, pagamenti, importi, eventi] = await Promise.all([
    supabase.from("matrimonio").select("id, codice_id, stato, fonte, data_inizio, data_fine, ora_inizio, ora_fine, location_id, preparativi, formula_id, note_private, galleria_url, copertina_url, pagina_congiunta, videomaker_id").eq("id", id).maybeSingle(),
    supabase.from("sposo").select("ordine, nome, telefono, email, codice_fiscale, indirizzo, indirizzo_preparativi, consenso_promo").eq("matrimonio_id", id).order("ordine"),
    supabase.from("preventivo").select("id, versione, opzioni, prezzi_speciali, preselezione, scelte, totale, inviato_il, confermato_il, righe_confermate, note_cliente").eq("matrimonio_id", id).order("versione", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("link_sposi").select("token").eq("matrimonio_id", id).is("revocato_il", null).order("creato_il", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("voce_listino").select("id, codice, categoria, voce, descrizione, prezzo, prezzo_barrato, gruppo, collegata_a, solo_se, riepilogo, collaboratore, attiva").order("codice"),
    supabase.from("location").select("id, nome, comune").order("nome"),
    supabase.from("collaboratore").select("id, nome, codice").eq("ruolo", "videomaker").order("nome"),
    supabase.from("timeline").select("giorno, ordine, ora, fase, luogo, nota_privata").eq("matrimonio_id", id).order("giorno").order("ordine"),
    supabase.from("pagamento").select("id, tipo, importo, scadenza, pagato_il, note").eq("matrimonio_id", id).order("pagato_il", { nullsFirst: false }),
    supabase.from("importo").select("voce, importo").eq("matrimonio_id", id),
    supabase.from("evento_pagina").select("tipo, dettaglio, avvenuto_il").eq("matrimonio_id", id).order("avvenuto_il", { ascending: false }).limit(60),
  ]);
  if (!m.data) notFound();
  const mat = m.data;
  const s = sposi.data ?? [];
  const h = await headers();
  const base = process.env.URL || `https://${h.get("host") ?? ""}`;
  const urlSposi = link.data ? `${base}/${link.data.token}` : null;
  // Aperta dall'admin sullo stesso dominio: la sessione la esclude dal conteggio delle aperture
  const apriSposi = link.data ? `/${link.data.token}` : null;
  const tel = s.find((x) => x.telefono)?.telefono?.replace(/[^\d+]/g, "");

  return (
    <section className="max-w-5xl">
      <p className="text-sm mb-2"><Link href="/admin" className="underline text-salvia-scuro">← Matrimoni</Link></p>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-serif text-2xl">{nomiBrevi(s) || "Senza nomi"}</h1>
        <span className="tabular-nums text-antracite/75">{mat.codice_id} · {data(mat.data_inizio)}</span>
        <span className="text-xs bg-salvia-chiaro px-2 py-0.5 rounded">{ETICHETTA_STATO[mat.stato] ?? mat.stato}</span>
      </div>
      <div className="flex flex-wrap gap-4 mt-3 text-sm">
        {apriSposi && <a href={apriSposi} target="_blank" rel="noopener noreferrer" className="underline text-salvia-scuro">Apri pagina Sposi</a>}
        {urlSposi && <CopiaLink url={urlSposi} />}
        {tel && <a href={`https://wa.me/${tel.replace(/^\+/, "").replace(/^(?!39)(\d{9,10})$/, "39$1")}`} target="_blank" rel="noopener noreferrer" className="underline text-salvia-scuro">WhatsApp</a>}
      </div>

      <nav className="flex flex-wrap gap-1 border-b mt-6 mb-6" aria-label="Schede">
        {SCHEDE.map((x) => (
          <Link key={x.k} href={`?tab=${x.k}`} aria-current={tab === x.k ? "page" : undefined}
            className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === x.k ? "border-salvia-scuro font-medium" : "border-transparent text-antracite/70"}`}>{x.t}</Link>
        ))}
      </nav>

      {tab === "dati" && (
        <Modulo azione={salvaDati}>
          <input type="hidden" name="id" value={mat.id} />
          <div className="grid sm:grid-cols-3 gap-4">
            <Campo etichetta="Stato">
              <select name="stato" defaultValue={mat.stato} className={inp}>{STATI.map((x) => <option key={x.valore} value={x.valore}>{x.etichetta}</option>)}</select>
            </Campo>
            <Campo etichetta="Data"><input type="date" name="data_inizio" defaultValue={mat.data_inizio ?? ""} className={inp} /></Campo>
            <Campo etichetta="Data fine (più giorni)"><input type="date" name="data_fine" defaultValue={mat.data_fine ?? ""} className={inp} /></Campo>
            <Campo etichetta="Ora inizio"><input type="time" name="ora_inizio" defaultValue={mat.ora_inizio?.slice(0, 5) ?? ""} className={inp} /></Campo>
            <Campo etichetta="Ora fine"><input type="time" name="ora_fine" defaultValue={mat.ora_fine?.slice(0, 5) ?? ""} className={inp} /></Campo>
            <Campo etichetta="Fonte">
              <select name="fonte" defaultValue={mat.fonte ?? ""} className={inp}><option value="">—</option>{FONTI.map((f) => <option key={f}>{f}</option>)}</select>
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
            <div className="flex flex-col gap-2 justify-end">
              <Spunta nome="preparativi" etichetta="Preparativi" attiva={mat.preparativi} />
              <Spunta nome="pagina_congiunta" etichetta="Pagina congiunta con il video" attiva={mat.pagina_congiunta} />
            </div>
            <Campo etichetta="Gallerie (una per riga: Titolo | url)" largo><textarea name="galleria_url" rows={2} defaultValue={mat.galleria_url ?? ""} className={inp} /></Campo>
            <Campo etichetta="Copertina (url immagine)"><input name="copertina_url" defaultValue={mat.copertina_url ?? ""} className={inp} /></Campo>
            <Campo etichetta="Note private (mai visibili agli Sposi)" largo><textarea name="note_private" rows={3} defaultValue={mat.note_private ?? ""} className={inp} /></Campo>
          </div>
          {[1, 2].map((o) => {
            const x = s.find((y) => y.ordine === o);
            return (
              <fieldset key={o} className="mt-6 grid sm:grid-cols-3 gap-4">
                <legend className="font-serif text-lg mb-2">Sposa/o {o}{x?.consenso_promo ? <span className="ml-2 text-xs font-sans">· consenso foto ✓</span> : null}</legend>
                <Campo etichetta="Nome e cognome"><input name={`s${o}_nome`} defaultValue={x?.nome ?? ""} className={inp} autoComplete="off" /></Campo>
                <Campo etichetta="Telefono"><input name={`s${o}_telefono`} defaultValue={x?.telefono ?? ""} className={inp} autoComplete="off" /></Campo>
                <Campo etichetta="Email"><input name={`s${o}_email`} defaultValue={x?.email ?? ""} className={inp} autoComplete="off" /></Campo>
                <Campo etichetta="Codice fiscale"><input name={`s${o}_codice_fiscale`} defaultValue={x?.codice_fiscale ?? ""} maxLength={16} className={inp} autoComplete="off" /></Campo>
                <Campo etichetta="Residenza"><input name={`s${o}_indirizzo`} defaultValue={x?.indirizzo ?? ""} className={inp} autoComplete="off" /></Campo>
                <Campo etichetta="Indirizzo preparativi"><input name={`s${o}_indirizzo_preparativi`} defaultValue={x?.indirizzo_preparativi ?? ""} className={inp} autoComplete="off" /></Campo>
              </fieldset>
            );
          })}
        </Modulo>
      )}

      {tab === "preventivo" && <SchedaPreventivo mat={mat} prev={prev.data} listinoRighe={listino.data ?? []} urlSposi={apriSposi} />}

      {tab === "timeline" && <SchedaTimeline mid={mat.id} righe={timeline.data ?? []} />}

      {tab === "pagamenti" && (
        <SchedaPagamenti mid={mat.id} dataMatrimonio={mat.data_inizio} importi={importi.data ?? []} incassi={pagamenti.data ?? []} />
      )}

      {tab === "attivita" && (
        <AttivitaPagina eventi={eventi.data ?? []} />
      )}

      {link.data && (
        <form action={rigeneraLink} className="mt-12 text-xs text-antracite/70">
          <input type="hidden" name="matrimonio_id" value={mat.id} />
          <button className="underline">Rigenera il link Sposi</button> (il link attuale smette di funzionare)
        </form>
      )}
    </section>
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
  if (!prev) return <p className="text-sm">Nessun preventivo per questo Matrimonio.</p>;
  const formule = listinoRighe.filter((v) => v.categoria === "formula" && v.attiva);
  const formula = listinoRighe.find((v) => v.id === mat.formula_id);
  const opz = (prev.opzioni ?? {}) as Record<string, boolean>;

  if (prev.confermato_il) {
    const righe = (Array.isArray(prev.righe_confermate) ? prev.righe_confermate : []) as { voce: string; importo: number }[];
    return (
      <div className="text-sm max-w-2xl">
        <p className="mb-4">Confermato il <b>{data(prev.confermato_il)}</b> · versione {prev.versione} · formula {formula?.codice ?? "—"}. Non si modifica più.</p>
        {righe.length > 0 && (
          <ul className="mb-4">{righe.map((r, i) => <li key={i} className="flex justify-between border-b py-1"><span>{r.voce}</span><span className="tabular-nums">{r.importo ? euro(r.importo) : "omaggio"}</span></li>)}</ul>
        )}
        {prev.totale != null && <p>Totale fotografia: <b className="tabular-nums">{euro(prev.totale)}</b></p>}
        {prev.scelte.length > 0 && <p className="mt-2 text-antracite/75">Scelte: {prev.scelte.join(", ")}</p>}
        {prev.note_cliente && <p className="mt-2">Note degli Sposi: {prev.note_cliente}</p>}
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

  return (
    <div className="grid lg:grid-cols-[1fr_22rem] gap-10">
      <Modulo azione={salvaPreventivo}>
        <input type="hidden" name="id" value={prev.id} />
        <input type="hidden" name="matrimonio_id" value={mat.id} />
        <div className="grid sm:grid-cols-2 gap-4">
          <Campo etichetta="Formula" largo>
            <select name="formula_id" defaultValue={mat.formula_id ?? ""} className={inp}>
              <option value="">—</option>
              {formule.map((f) => <option key={f.id} value={f.id}>{f.codice} · {f.voce} · {euro(f.prezzo)}</option>)}
            </select>
          </Campo>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Spunta nome="proponi_video" etichetta="Proponi il video" attiva={opz.proponi_video} />
            <Spunta nome="proponi_prewedding" etichetta="Proponi il servizio prematrimoniale" attiva={opz.proponi_prewedding} />
            <Spunta nome="proponi_op2_ibrido" etichetta="Proponi il secondo operatore ibrido (mai insieme al video)" attiva={opz.proponi_op2_ibrido} />
          </div>
          <Campo etichetta="Prezzi speciali (una riga per voce: codice = euro; 0 = omaggio)" largo>
            <textarea name="prezzi" rows={4} defaultValue={prezziInTesto((prev.prezzi_speciali ?? {}) as Record<string, number>)}
              placeholder={"servizio = 1100\nbox = 0"} className={`${inp} font-mono text-sm`} />
          </Campo>
        </div>
        <fieldset className="mt-5">
          <legend className="text-sm text-antracite/75 mb-2">Già selezionate all&apos;apertura (gli Sposi possono toglierle)</legend>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
            {sceglibili.map((v) => (
              <label key={v.codice} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="preselezione" value={v.codice} defaultChecked={prev.preselezione.includes(v.codice)} className="size-4 accent-salvia-scuro" />
                <span>{v.voce} <span className="text-antracite/60">({v.codice})</span></span>
              </label>
            ))}
          </div>
        </fieldset>
      </Modulo>

      <aside className="text-sm">
        <h2 className="font-serif text-lg mb-2">Anteprima</h2>
        <p className="text-antracite/75 mb-3">Versione {prev.versione}{prev.inviato_il ? ` · inviato il ${data(prev.inviato_il)}` : " · non ancora inviato"}. Si aggiorna dopo il salvataggio.</p>
        {erroreOfferta && <p className="text-red-700">{erroreOfferta}</p>}
        {!formula && <p className="text-red-700">Scegli una formula.</p>}
        {offerta && (
          <ul>
            <li className="flex justify-between border-b py-1 font-medium"><span>Servizio</span><span className="tabular-nums">{euro(offerta.servizio.prezzo)}</span></li>
            {offerta.voci.filter((v) => v.categoria !== "formula").map((v) => (
              <li key={v.codice} className="flex justify-between gap-3 border-b py-1">
                <span>{v.voce}{prev.preselezione.includes(v.codice) ? " ✓" : ""}</span>
                <span className="tabular-nums">{v.incluso || v.categoria === "omaggio" ? "omaggio" : euro(v.prezzo)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-4 mt-4">
          {urlSposi && <a href={urlSposi} target="_blank" rel="noopener noreferrer" className="underline text-salvia-scuro">Apri la pagina come gli Sposi</a>}
          <form action={segnaInviato}>
            <input type="hidden" name="id" value={prev.id} />
            <input type="hidden" name="matrimonio_id" value={mat.id} />
            <button className="underline text-salvia-scuro">{prev.inviato_il ? "Segna di nuovo come inviato oggi" : "Segna come inviato"}</button>
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
  if (!eventi.length) return <p className="text-sm">La pagina non è ancora stata aperta.</p>;
  return (
    <div className="text-sm max-w-2xl">
      <p className="mb-4">Aperta <b>{aperture.length}</b> {aperture.length === 1 ? "volta" : "volte"}{aperture[0] ? `, l'ultima il ${ora(aperture[0].avvenuto_il)}` : ""} · opzioni toccate {tocchi.length}.</p>
      <ul>{eventi.map((e, i) => {
        const d = (e.dettaglio ?? {}) as Record<string, unknown>;
        const cosa = e.tipo === "apertura" ? "Apertura" : e.tipo === "invio" ? "Conferma" : `${e.tipo === "selezione" ? "Aggiunto" : "Tolto"} ${String(d.codice ?? "")}`;
        return <li key={i} className="flex justify-between border-b py-1"><span>{cosa}</span><span className="tabular-nums text-antracite/70">{ora(e.avvenuto_il)}</span></li>;
      })}</ul>
    </div>
  );
}

function SchedaTimeline({ mid, righe }: { mid: string; righe: { ora: string | null; fase: string | null; luogo: string | null; nota_privata: boolean }[] }) {
  return (
    <div className="grid lg:grid-cols-[1fr_20rem] gap-10">
      <Modulo azione={salvaTimeline}>
        <input type="hidden" name="matrimonio_id" value={mid} />
        <Campo etichetta="Una riga per momento: ora, momento | luogo · # all'inizio = nota privata">
          <textarea name="timeline" rows={16} className={`${inp} font-mono text-sm leading-6`}
            defaultValue={scriviTimeline(righe.map((r) => ({ ...r, fase: r.fase ?? "" })))}
            placeholder={"13.45 Preparativi della Sposa | Casa\n16.00 Rito civile | Villa\n17.00 Aperitivo\n# parcheggio sul retro\n01.00 Termine presunto del servizio"} />
        </Campo>
      </Modulo>
      <aside className="text-sm">
        <h2 className="font-serif text-lg mb-2">Come la vedono gli Sposi</h2>
        {righe.filter((r) => !r.nota_privata).length ? (
          <ul>{righe.filter((r) => !r.nota_privata).map((r, i) => (
            <li key={i} className="flex gap-3 border-b py-1.5"><span className="tabular-nums w-12 shrink-0">{r.ora?.slice(0, 5).replace(":", ".") ?? ""}</span><span>{r.fase}{r.luogo ? ` | ${r.luogo}` : ""}</span></li>
          ))}</ul>
        ) : <p className="text-antracite/70">Ancora vuota.</p>}
        <p className="mt-3 text-antracite/70">Gli orari dopo mezzanotte passano da soli al giorno dopo. Le note private non compaiono mai.</p>
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
  if (!importi.length) return <p className="text-sm">Nessun importo: le rate compaiono dopo la conferma del preventivo.</p>;
  return (
    <div className="text-sm max-w-4xl">
      <table className="w-full mb-8">
        <thead><tr className="text-left border-b text-antracite/75"><th className="py-1">Rata</th><th>Scadenza</th><th className="text-right">Dovuto</th><th className="text-right">Incassato</th><th className="text-right">Manca</th><th></th></tr></thead>
        <tbody>{rate.map((r) => {
          const manca = Math.max(0, r.dovuto - r.incassato);
          return (
            <tr key={r.tipo} className="border-b align-middle">
              <td className="py-2 font-medium">{NOME_RATA[r.tipo]}</td>
              <td className="tabular-nums">{r.scadenza ? data(r.scadenza) : r.tipo === "saldo" ? "alla consegna" : r.tipo === "album" ? "alla consegna album" : "—"}</td>
              <td className="text-right tabular-nums">{euro(r.dovuto)}</td>
              <td className="text-right tabular-nums">{euro(r.incassato)}</td>
              <td className="text-right tabular-nums">{manca ? euro(manca) : "✓"}</td>
              <td className="pl-4">
                {manca > 0 && (
                  <Modulo azione={registraIncasso} etichetta="Segna pagato" className="flex items-center gap-2 [&>div]:mt-0">
                    <input type="hidden" name="matrimonio_id" value={mid} />
                    <input type="hidden" name="tipo" value={r.tipo} />
                    <input name="importo" defaultValue={(manca / 100).toFixed(2).replace(".", ",")} className={`${inp} w-24 text-sm`} aria-label="Importo" />
                    <input type="date" name="pagato_il" defaultValue={oggi} className={`${inp} text-sm`} aria-label="Data" />
                  </Modulo>
                )}
              </td>
            </tr>
          );
        })}</tbody>
      </table>
      <p className="text-antracite/75 mb-6">Se l&apos;acconto incassato è diverso dal calcolo, l&apos;acconto diventa quello e il saldo si ricalcola. Correggi l&apos;importo nel campo prima di premere &quot;Segna pagato&quot;.</p>

      <div className="grid sm:grid-cols-2 gap-10">
        <div>
          <h2 className="font-serif text-lg mb-2">Incassi registrati</h2>
          {incassi.filter((x) => x.pagato_il).length ? (
            <ul>{incassi.filter((x) => x.pagato_il).map((x) => (
              <li key={x.id} className="flex justify-between gap-3 border-b py-1.5">
                <span>{NOME_RATA[x.tipo] ?? x.tipo} · {data(x.pagato_il)}{x.note ? <span className="text-antracite/60"> · {x.note}</span> : null}</span>
                <span className="flex items-center gap-3 tabular-nums">{euro(x.importo)}
                  <form action={eliminaIncasso}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="matrimonio_id" value={mid} />
                    <button className="text-red-700 text-xs underline" aria-label="Elimina incasso">elimina</button></form>
                </span>
              </li>
            ))}</ul>
          ) : <p>Nessun incasso registrato.</p>}
        </div>
        <div>
          <h2 className="font-serif text-lg mb-2">Aggiungi incasso</h2>
          <Modulo azione={registraIncasso} etichetta="Registra">
            <input type="hidden" name="matrimonio_id" value={mid} />
            <div className="grid grid-cols-2 gap-3">
              <Campo etichetta="Rata"><select name="tipo" className={inp} defaultValue="acconto">{["acconto", "saldo", "album", "altro"].map((t) => <option key={t} value={t}>{NOME_RATA[t]}</option>)}</select></Campo>
              <Campo etichetta="Importo (€)"><input name="importo" className={inp} placeholder="800" /></Campo>
              <Campo etichetta="Data"><input type="date" name="pagato_il" defaultValue={oggi} className={inp} /></Campo>
              <Campo etichetta="Nota"><input name="note" className={inp} /></Campo>
            </div>
          </Modulo>
        </div>
      </div>
    </div>
  );
}
