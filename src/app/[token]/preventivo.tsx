"use client";

import { useMemo, useState, useTransition } from "react";
import { selezione, importiConferma, legataA, type Offerta, type VoceOfferta, ErroreSelezione } from "@/lib/listino/motore";
import { conferma, traccia } from "./azioni";
import { Contratto, Euro, Evidenzia, Paragrafi, euroTesto } from "./testo";
import type { Blocco } from "@/lib/sposi/componi";
import { PROVINCE, campiMancanti, dividiIndirizzo, unisciIndirizzo, type Indirizzo } from "@/lib/sposi/indirizzo";

type SposoDati = { nome: string; telefono: string; email: string; codice_fiscale: string; indirizzo: string; indirizzo_preparativi: string };

export function Preventivo(props: {
  token: string;
  offerta: Offerta;
  servizioSenzaVideo: number | null;
  preselezione: string[];
  sposi: (SposoDati & { ordine: number; consenso_promo: boolean })[];
  blocchi: { opzionali?: Blocco; album?: Blocco; video?: Blocco };
  contratto: string;
  videomaker: string | null;
}) {
  const { offerta, token } = props;
  const duo = !!offerta.duo;
  const voci = offerta.voci;
  const basiVideo = voci.filter((v) => v.categoria === "video-base");
  const extraVideo = voci.filter((v) => v.categoria === "video");

  const [scelti, setScelti] = useState<Set<string>>(() => new Set(props.preselezione.filter((c) => voci.some((v) => v.codice === c))));
  const [qta, setQta] = useState<Record<string, number>>({});
  const [video, setVideo] = useState<string | null>(duo ? (basiVideo[0]?.codice ?? null) : null);
  const [confermato, setConfermato] = useState(false);

  const servizio = duo && !video && props.servizioSenzaVideo !== null ? props.servizioSenzaVideo : offerta.servizio.prezzo;

  const calcolo = useMemo(() => {
    try {
      const sel = selezione(voci, { extra: [...scelti], qta, video });
      const imp = importiConferma({ ...offerta, servizio: { ...offerta.servizio, prezzo: servizio } }, sel);
      return { sel, imp, errore: null as string | null };
    } catch (e) {
      return { sel: null, imp: null, errore: e instanceof ErroreSelezione ? e.message : "Selezione non valida" };
    }
  }, [voci, scelti, qta, video, offerta, servizio]);

  function cambia(v: VoceOfferta) {
    if (v.incluso || v.categoria === "omaggio" || confermato) return;
    setScelti((prec) => {
      const n = new Set(prec);
      const attiva = !n.has(v.codice);
      if (attiva) {
        // Voci dello stesso gruppo (e gli album) si escludono a vicenda.
        for (const altra of voci) {
          if (altra.codice !== v.codice && ((v.gruppo && altra.gruppo === v.gruppo) || (v.categoria === "album" && altra.categoria === "album"))) n.delete(altra.codice);
        }
        n.add(v.codice);
      } else {
        n.delete(v.codice);
        if (v.categoria === "album") setQta((q) => Object.fromEntries(Object.entries(q).filter(([k]) => !legataA(voci.find((r) => r.codice === k) ?? {}, v.codice))));
      }
      void traccia(token, v.codice, attiva);
      return n;
    });
  }

  const card = (v: VoceOfferta, disabilitata = false) => (
    <Card key={v.codice} v={v} attiva={scelti.has(v.codice)} disabilitata={disabilitata || confermato} onClick={() => cambia(v)} />
  );

  // Opzionali: omaggi, extra e prematrimoniale; le voci dello stesso gruppo in un riquadro unico.
  const opzionali = voci.filter((v) => ["omaggio", "extra", "prewedding"].includes(v.categoria) && !(duo && v.condiviso));
  const blocchiOpz: React.ReactNode[] = [];
  for (let i = 0; i < opzionali.length;) {
    const g = opzionali[i].gruppo;
    if (!g) { blocchiOpz.push(card(opzionali[i])); i++; continue; }
    const membri: VoceOfferta[] = [];
    while (i < opzionali.length && opzionali[i].gruppo === g) membri.push(opzionali[i++]);
    blocchiOpz.push(
      <div key={"g-" + g} className="gruppo">
        <p className="gruppo-tit">{g}</p>
        <p className="gruppo-sub">Scegliete una delle opzioni, oppure nessuna.</p>
        <div className="opzioni due" style={{ margin: 0 }}>{membri.map((v) => card(v))}</div>
      </div>,
    );
  }

  const bO = props.blocchi.opzionali, bA = props.blocchi.album, bV = props.blocchi.video;
  const album = voci.filter((v) => v.categoria === "album");
  const repliche = voci.filter((v) => v.categoria === "replica");

  return (
    <>
      <section id="azp-opzionali">
        <div className="wrap">
          <p className="sez">{bO?.sopratitolo ?? "Opzionale"}</p>
          <h2>{bO?.titolo ?? "Rendetelo vostro"}</h2>
          <Paragrafi testo={bO?.corpo} />
          <div className="duo-opz">
            <div>
              {duo && <p className="gruppo-tit">Per le foto</p>}
              <div className="opzioni">{blocchiOpz}</div>
            </div>
            {duo && extraVideo.length > 0 && (
              <div>
                <p className="gruppo-tit">Per il video</p>
                <div className="opzioni">{extraVideo.map((v) => card(v, !video))}</div>
              </div>
            )}
          </div>
          {duo && voci.some((v) => v.condiviso) && (
            <div className="duo-condivisi">
              <p className="gruppo-tit">Foto e video insieme</p>
              <div className="opzioni">{voci.filter((v) => v.condiviso).map((v) => card(v))}</div>
            </div>
          )}
          {duo && basiVideo.length > 0 && (
            <div className="duo-condivisi">
              <p className="gruppo-tit">Il video</p>
              <div className="opzioni">
                {basiVideo.map((b) => (
                  <Card key={b.codice} v={b} attiva={video === b.codice} disabilitata={confermato}
                    onClick={() => { const n = video === b.codice ? null : b.codice; setVideo(n); void traccia(token, b.codice, !!n); }} />
                ))}
              </div>
              {!video && <p className="omaggio-nota">Senza video il servizio fotografico torna a prezzo pieno.</p>}
            </div>
          )}
        </div>
      </section>

      {album.length > 0 && (
        <section className="banda" id="azp-album">
          <div className="wrap">
            <p className="sez">{bA?.sopratitolo ?? "Opzionale"}</p>
            <h2>{bA?.titolo ?? "Wedding album"}</h2>
            <Paragrafi testo={bA?.corpo} />
            <div className="opzioni due">
              {album.map((v) => card(v))}
              {repliche.map((r) => {
                const attiva = [...scelti].some((c) => legataA(r, c));
                const q = attiva ? (qta[r.codice] ?? 0) : 0;
                const cambiaQta = (d: number) => setQta({ ...qta, [r.codice]: Math.max(0, Math.min(10, q + d)) });
                return (
                  <div key={r.codice} className={`opz${q && attiva ? " on" : ""}`} style={{ cursor: "default" }}>
                    <span className="voce">{r.voce}</span>
                    <span className="euro"><PrezzoCard v={r} suffisso={<small> cad.</small>} /></span>
                    {r.descrizione && <span className="desc">{r.descrizione}</span>}
                    <div className="qta">
                      <button type="button" disabled={!attiva || !q || confermato} onClick={() => cambiaQta(-1)} aria-label="Una copia in meno">−</button>
                      <output>{q}</output>
                      <button type="button" disabled={!attiva || q >= 10 || confermato} onClick={() => cambiaQta(1)} aria-label="Una copia in più">+</button>
                      <span className="stato">{attiva ? "" : "Disponibile scegliendo l’album"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {bA?.lista && <ul className="lista-verde">{bA.lista.map((x, i) => <li key={i}><Evidenzia testo={x} /></li>)}</ul>}
          </div>
        </section>
      )}

      {!duo && basiVideo.length > 0 && (
        <section id="azp-video">
          <div className="wrap">
            <p className="sez">{bV?.sopratitolo ?? "Opzionale"}</p>
            <h2>{bV?.titolo ?? "Video maker"}</h2>
            <Paragrafi testo={bV?.corpo} />
            {bV?.link && (
              <div className="gallerie" style={{ marginTop: "1rem" }}>
                {bV.link.map(([t, u]) => <a key={u} className="btn-scuro" style={{ margin: 0 }} href={u} target="_blank" rel="noopener noreferrer">{t}</a>)}
              </div>
            )}
            <div className={`opzioni${basiVideo.length > 1 ? " due" : ""}`}>
              {basiVideo.map((b) => (
                <Card key={b.codice} v={b} attiva={video === b.codice} disabilitata={confermato}
                  onClick={() => { const n = video === b.codice ? null : b.codice; setVideo(n); void traccia(token, b.codice, !!n); }} />
              ))}
            </div>
            {basiVideo.length > 1 && bV?.nota && <p className="gruppo-sub" style={{ marginTop: ".75rem" }}>{bV.nota}</p>}
            {extraVideo.length > 0 && (
              <>
                <p style={{ marginTop: "2rem" }}>Con il video potete aggiungere:</p>
                <div className="opzioni due">{extraVideo.map((v) => card(v, !video))}</div>
              </>
            )}
          </div>
        </section>
      )}

      <FormConferma {...props} calcolo={calcolo} servizio={servizio} video={video} scelti={scelti} qta={qta}
        conVideo={!duo || !!video} onConfermato={() => setConfermato(true)} confermato={confermato} />

      {!confermato && (
        <div className="barra">
          <div className="wrap">
            <div><span className="lbl">Totale selezionato</span>
              <span className="tot">{calcolo.imp ? <Euro centesimi={calcolo.imp.totaleFoto + calcolo.imp.totaleVideo} /> : "—"}</span></div>
            <a href="#azp-conferma">Conferma</a>
          </div>
        </div>
      )}
    </>
  );
}

function PrezzoCard({ v, suffisso }: { v: VoceOfferta; suffisso?: React.ReactNode }) {
  const barrato = v.barrato ? <span className="barrato">{euroTesto(v.barrato)}</span> : null;
  if (v.prezzo === 0) return <>{barrato}Omaggio</>;
  return <>{barrato}+ <Euro centesimi={v.prezzo} />{suffisso}</>;
}

function Card({ v, attiva, disabilitata, onClick }: { v: VoceOfferta; attiva: boolean; disabilitata?: boolean; onClick: () => void }) {
  const fisso = v.categoria === "omaggio" || v.incluso;
  return (
    <button type="button" className={`opz${fisso ? " fisso" : ""}`} aria-pressed={fisso ? undefined : attiva}
      disabled={fisso || disabilitata} onClick={onClick}>
      <span className="voce">{v.voce}</span>
      <span className="euro"><PrezzoCard v={v} /></span>
      {v.descrizione && <span className="desc">{v.descrizione}</span>}
      <span className="stato">{fisso ? "Incluso ✓" : attiva ? "Aggiunto ✓ - tocca per togliere" : "Tocca per aggiungere"}</span>
    </button>
  );
}

function FormConferma(props: Parameters<typeof Preventivo>[0] & {
  calcolo: { sel: ReturnType<typeof selezione> | null; imp: ReturnType<typeof importiConferma> | null; errore: string | null };
  servizio: number; video: string | null; scelti: Set<string>; qta: Record<string, number>; conVideo: boolean;
  onConfermato: () => void; confermato: boolean;
}) {
  const iniziale = (i: number) => {
    const s = props.sposi[i];
    return {
      nome: s?.nome ?? "", telefono: s?.telefono ?? "", email: s?.email ?? "", codice_fiscale: s?.codice_fiscale ?? "",
      residenza: dividiIndirizzo(s?.indirizzo ?? ""),
    };
  };
  const [sposi, setSposi] = useState(() => [iniziale(0), iniziale(1)]);
  const [consenso, setConsenso] = useState(props.sposi[0]?.consenso_promo ?? true);
  const [note, setNote] = useState("");
  const [accetto, setAccetto] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [mancanti, setMancanti] = useState<Set<string>>(new Set());
  const [provato, setProvato] = useState(false);
  const [inCorso, avvia] = useTransition();


  // dopo il primo tentativo i campi si ricontrollano mentre si scrive
  const controlla = (sp = sposi, acc = accetto) => {
    const m = campiMancanti(sp, acc);
    setMancanti(new Set(m.map((x) => x.chiave)));
    return m;
  };
  const aggiornaEControlla = (i: number, patch: Partial<ReturnType<typeof iniziale>>) => {
    const nuovi = sposi.map((s, j) => (j === i ? { ...s, ...patch } : s));
    setSposi(nuovi);
    if (provato) controlla(nuovi);
  };

  function invia() {
    setErrore(null);
    setProvato(true);
    const m = controlla();
    if (m.length) {
      setErrore(`Per confermare manca${m.length > 1 ? "no" : ""}: ${m.map((x) => x.etichetta).join(", ")}.`);
      const primo = document.querySelector<HTMLElement>(`[data-campo="${m[0].chiave}"]`);
      primo?.focus({ preventScroll: true });
      primo?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    avvia(async () => {
      const r = await conferma(props.token, {
        extra: [...props.scelti], qta: props.qta, video: props.video, conVideo: props.conVideo,
        sposi: sposi.map((s) => ({
          nome: s.nome, telefono: s.telefono, email: s.email, codice_fiscale: s.codice_fiscale,
          indirizzo: unisciIndirizzo(s.residenza),
        })),
        consensoPromo: consenso, note, accetto,
      });
      if (r.ok) {
        props.onConfermato();
        // la pagina diventa l'area Sposi, ricaricata da capo e dall'inizio, con il messaggio di benvenuto
        history.scrollRestoration = "manual";
        window.scrollTo(0, 0);
        location.replace(`${location.pathname}?confermato=1#azp-grazie`);
      } else setErrore(r.errore ?? "Errore");
    });
  }

  const sel = props.calcolo.sel;
  const omaggi = props.offerta.voci.filter((v) => v.categoria === "omaggio");
  const righeFoto: [string, number][] = [
    ["Servizio fotografico", props.servizio],
    ...omaggi.map((v) => [v.voce, 0] as [string, number]),
    ...(sel?.foto ?? []).map((x) => [x.etichetta.replace(/ \(omaggio\)$/, ""), x.totale] as [string, number]),
  ];
  const righeVideo: [string, number][] = (sel?.video ?? []).map((x) => [x.etichetta, x.totale]);
  const tf = righeFoto.reduce((s, r) => s + r[1], 0), tv = righeVideo.reduce((s, r) => s + r[1], 0);
  const li = (r: [string, number][]) => r.map(([k, v], i) => <li key={k + i}><span>{k}</span><span>{v ? euroTesto(v) : "Omaggio"}</span></li>);

  const campoTesto = (i: number, k: "nome" | "telefono" | "email" | "codice_fiscale", etichetta: string, tipo: string, ac: string) => {
    const manca = mancanti.has(`${i}.${k}`);
    return (
      <label className={`campo${manca ? " manca" : ""}`}><span>{etichetta} <abbr className="obb" title="obbligatorio">*</abbr></span>
        <input type={tipo} required aria-required="true" aria-invalid={manca || undefined} data-campo={`${i}.${k}`}
          autoComplete={i === 0 ? ac : "off"} value={sposi[i][k]} onChange={(e) => aggiornaEControlla(i, { [k]: e.target.value })} />
      </label>
    );
  };
  const campoResidenza = (i: number) => {
    const v = sposi[i].residenza;
    const manca = mancanti.has(`${i}.residenza`);
    const set = (patch: Partial<Indirizzo>) => aggiornaEControlla(i, { residenza: { ...v, ...patch } });
    return (
      <div className={`campo ind${manca ? " manca" : ""}`}><span>Indirizzo di residenza <abbr className="obb" title="obbligatorio">*</abbr></span>
        <div className="ind-griglia">
          <input type="text" placeholder="Via e numero civico" required aria-invalid={manca || undefined} data-campo={`${i}.residenza`}
            autoComplete={i === 0 ? "street-address" : "off"} value={v.via} onChange={(e) => set({ via: e.target.value })} />
          <input type="text" placeholder="CAP" inputMode="numeric" maxLength={5} required value={v.cap} onChange={(e) => set({ cap: e.target.value })} />
          <input type="text" placeholder="Località" required value={v.loc} onChange={(e) => set({ loc: e.target.value })} />
          <select aria-label="Provincia" required value={v.prov} onChange={(e) => set({ prov: e.target.value })}>
            <option value="">Prov.</option>{PROVINCE.map((p) => <option key={p}>{p}</option>)}<option value="EE">Estero</option>
          </select>
        </div>
      </div>
    );
  };

  return (
    <section className="conferma" id="azp-conferma">
      <div className="wrap">
        <h2>Conferma</h2>
        <ul className="riepilogo">
          {righeVideo.length ? (
            <>
              {li(righeFoto)}
              <li className="sub"><span>Totale fotografia</span><span>{euroTesto(tf)}</span></li>
              <li className="intest"><span>Video - contratto e pagamento con {props.videomaker ?? "il videomaker"}</span></li>
              {li(righeVideo)}
              <li className="sub"><span>Totale video</span><span>{euroTesto(tv)}</span></li>
              <li className="tot"><span>Totale</span><span><Euro centesimi={tf + tv} /></span></li>
            </>
          ) : (
            <>{li(righeFoto)}<li className="tot"><span>Totale</span><span><Euro centesimi={tf} /></span></li></>
          )}
        </ul>

        {props.confermato ? (
          <div className="ok">
            <p><b>Preventivo confermato. La data è vostra!</b></p>
            <p>Riceverete a breve una mia mail con il riepilogo. Da questo stesso link, d’ora in poi, trovate timeline, riepilogo e pagamenti sempre aggiornati.</p>
            <button type="button" className="cta" onClick={() => location.reload()}>Vai alla vostra area Sposi</button>
          </div>
        ) : (
          <div>
            <details>
              <summary>Leggi le condizioni del servizio</summary>
              <Contratto testo={props.contratto} />
            </details>
            <p>Per preparare il contratto mi servono i vostri dati. Alla conferma non è richiesto alcun versamento.</p>
            <p className="nota-obb"><abbr className="obb" title="obbligatorio">*</abbr> campo obbligatorio. L’indirizzo dei preparativi lo inserirete più avanti, nella vostra area Sposi.</p>
            <div className="sposi">
              {[0, 1].map((i) => (
                <fieldset key={i}>
                  <legend>Sposa/o {i + 1}</legend>
                  {campoTesto(i, "nome", "Nome e cognome", "text", "name")}
                  {campoTesto(i, "telefono", "Telefono", "tel", "tel")}
                  {campoTesto(i, "email", "Email", "email", "email")}
                  {campoTesto(i, "codice_fiscale", "Codice fiscale", "text", "off")}
                  {campoResidenza(i)}
                </fieldset>
              ))}
            </div>
            <fieldset>
              <label className="scelta"><input type="checkbox" checked={consenso} onChange={(e) => setConsenso(e.target.checked)} />
                <span>Acconsentiamo all’uso di alcune foto per portfolio, sito e social (facoltativo)</span></label>
            </fieldset>
            <label className="campo larga"><span>Note o richieste (facoltativo)</span>
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
            <label className={`scelta${mancanti.has("accetto") ? " manca" : ""}`}>
              <input type="checkbox" required aria-required="true" aria-invalid={mancanti.has("accetto") || undefined} data-campo="accetto"
                checked={accetto} onChange={(e) => { setAccetto(e.target.checked); if (provato) controlla(sposi, e.target.checked); }} />
              <span>Abbiamo letto le condizioni e confermiamo il servizio con gli opzionali selezionati. <abbr className="obb" title="obbligatorio">*</abbr></span></label>
            <button className="cta" type="button" onClick={invia} disabled={inCorso || !!props.calcolo.errore}>
              {inCorso ? "Invio in corso…" : "Conferma il preventivo"}
            </button>
            <p className="errore" role="alert" aria-live="assertive">{errore ?? props.calcolo.errore ?? ""}</p>
          </div>
        )}
      </div>
    </section>
  );
}
